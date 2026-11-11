// Checks the manifest and the scripts for mistakes that the browser would
// only report at runtime. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const contentScripts = manifest.content_scripts.flatMap((c) => c.js);
const ledgerEntry = manifest.content_scripts.find((c) => c.js.includes("src/ledger/page.js"));

function srcFiles(ext) {
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(dir + "/" + entry.name) : [dir + "/" + entry.name]);
  return walk("src").filter((f) => f.endsWith(ext));
}

test("permissions stay minimal", () => {
  // A new permission or host must be a deliberate decision. If you change
  // this list, explain why in the commit message.
  assert.deepStrictEqual(manifest.permissions, ["storage"]);
  assert.deepStrictEqual(manifest.host_permissions, [
    "https://store.steampowered.com/*",
    "https://api.steampowered.com/*",
    "https://steamcommunity.com/*",
    "https://api.isthereanydeal.com/*",
  ]);
  assert.strictEqual(manifest.web_accessible_resources, undefined);
  assert.strictEqual(manifest.optional_permissions, undefined);
  for (const entry of manifest.content_scripts) {
    for (const match of entry.matches) {
      assert.match(match, /^https:\/\/(store\.steampowered\.com|steamcommunity\.com)\//);
    }
  }
});

test("on all Steam pages only the small menu entry runs", () => {
  const everywhere = manifest.content_scripts.filter((c) => c.matches.some((m) => /\.com\/\*$/.test(m)));
  assert.deepStrictEqual(everywhere.flatMap((c) => c.js), ["src/content/link.js"]);
  // Everything else only runs on the pages it belongs to.
  for (const entry of manifest.content_scripts) {
    if (entry === everywhere[0]) continue;
    for (const match of entry.matches) {
      assert.match(match, /\/(edit\*|account\/|account\/\?\*|account\/history\*|account\/licenses\*)$/);
    }
  }
});

test("only request.js talks to servers, nothing reads cookies", () => {
  for (const file of srcFiles(".js")) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /XMLHttpRequest|document\.cookie|sendBeacon|\.submit\(/, file);
    if (!["src/lib/request.js", "src/background.js"].includes(file)) assert.doesNotMatch(source, /\bfetch\(/, file);
  }
  // The improvements of Steam's pages don't even load request.js.
  for (const entry of manifest.content_scripts) {
    if (entry !== ledgerEntry) assert.ok(!entry.js.includes("src/lib/request.js"));
  }
});

test("the background script only passes requests to allowed hosts", () => {
  const source = fs.readFileSync(path.join(root, "src/background.js"), "utf8");
  assert.match(source, /VL\.ALLOWED_HOSTS\.includes\(target\.hostname\)/);
  assert.match(source, /target\.protocol !== "https:"/);
  assert.match(source, /sender\.id !== chrome\.runtime\.id/);
  assert.deepStrictEqual(manifest.background.scripts, ["src/lib/request.js", "src/background.js"]);
});

test("all files referenced by the manifest exist", () => {
  const files = [
    ...contentScripts,
    ...manifest.background.scripts,
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((c) => c.css || []),
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), file + " is missing");
  }
  // Every script in src/ is used somewhere.
  for (const file of srcFiles(".js")) {
    assert.ok(contentScripts.includes(file) || manifest.background.scripts.includes(file), file + " is not used");
  }
});

test("name and description come from the locales and fit the stores", () => {
  assert.strictEqual(manifest.default_locale, "en");
  for (const lang of ["en", "de"]) {
    const messages = JSON.parse(fs.readFileSync(path.join(root, "_locales", lang, "messages.json"), "utf8"));
    assert.ok(messages.extName.message.length <= 75, lang + " name");
    assert.ok(messages.extDescription.message.length <= 132, lang + " description, Chrome allows 132");
  }
});

test("package.json and manifest have the same version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.strictEqual(pkg.version, manifest.version);
});

test("scripts that share a page don't declare the same top level name twice", () => {
  // The scripts of one manifest entry run in one shared scope. Two top
  // level "const x" in different files would stop the second file with a
  // SyntaxError. "var VL" is the one name every file is allowed to repeat.
  for (const list of manifest.content_scripts.map((c) => c.js)) {
    const seen = new Map();
    for (const file of list) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const names = source.matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm);
      for (const [, name] of names) {
        if (name === "VL") continue;
        assert.ok(!seen.has(name), `"${name}" is declared in ${seen.get(name)} and ${file}`);
        seen.set(name, file);
      }
    }
  }
});

test("the test page loads the same scripts as the Vapor Ledger page", () => {
  const source = fs.readFileSync(path.join(root, "test/harness.html"), "utf8");
  const harness = [...source.matchAll(/<script src="\.\.\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(harness, ledgerEntry.js.slice(0, -1));
  assert.strictEqual(ledgerEntry.js[ledgerEntry.js.length - 1], "src/ledger/start.js");
});

test("no innerHTML or eval in the extension code", () => {
  for (const file of srcFiles(".js")) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(/, file);
  }
});

test("the code only talks to Steam and the optional price services", () => {
  // Requests: Steam and IsThereAnyDeal. Links only: Steam's help pages,
  // SteamDB and IsThereAnyDeal's documentation.
  const allowed = /^https:\/\/(store\.steampowered\.com|api\.steampowered\.com|steamcommunity\.com|help\.steampowered\.com|api\.isthereanydeal\.com|docs\.isthereanydeal\.com\/|steamdb\.info\/app\/)/;
  const ignore = /^http:\/\/www\.w3\.org\/2000\/svg$/; // the SVG namespace, not a request
  for (const file of srcFiles(".js")) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const [url] of source.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
      if (!ignore.test(url)) assert.match(url, allowed, file + ": " + url);
    }
  }
});
