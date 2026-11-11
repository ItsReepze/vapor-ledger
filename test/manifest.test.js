// Checks the manifest, the extension page and the scripts for mistakes
// that the browser would only report at runtime. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const contentScripts = manifest.content_scripts.flatMap((c) => c.js);

// The scripts of the extension page, in the order app.html loads them.
function pageScripts(htmlFile) {
  const source = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const dir = path.posix.dirname(htmlFile);
  return [...source.matchAll(/<script src="([^"]+)"/g)].map((m) => path.posix.normalize(dir + "/" + m[1]));
}
const appScripts = pageScripts("src/app/app.html");

test("permissions stay minimal", () => {
  // A new permission or host must be a deliberate decision. If you change
  // this list, explain why in the commit message.
  assert.deepStrictEqual(manifest.permissions, ["storage"]);
  assert.deepStrictEqual(manifest.host_permissions, [
    "https://store.steampowered.com/*",
    "https://api.steampowered.com/*",
    "https://steamcommunity.com/*",
  ]);
  assert.strictEqual(manifest.web_accessible_resources, undefined);
  assert.strictEqual(manifest.optional_permissions, undefined);
  for (const entry of manifest.content_scripts) {
    for (const match of entry.matches) {
      assert.match(match, /^https:\/\/(store\.steampowered\.com|steamcommunity\.com)\//);
    }
  }
});

test("only the small header link runs on Steam's pages", () => {
  assert.deepStrictEqual(contentScripts, ["src/content/link.js"]);
  const source = fs.readFileSync(path.join(root, "src/content/link.js"), "utf8");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|document\.cookie|chrome\.storage/);
});

test("all files referenced by the manifest and the page exist", () => {
  const files = [
    ...contentScripts,
    ...manifest.background.scripts,
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...appScripts,
    "src/app/app.css",
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), file + " is missing");
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

test("the page scripts don't declare the same top level name twice", () => {
  // All scripts of the page run in one shared scope. Two top level "const x"
  // in different files would stop the second file with a SyntaxError.
  // "var VL" is the one name every file is allowed to repeat.
  for (const list of [appScripts, contentScripts]) {
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

test("the test page loads the same scripts as the extension page", () => {
  const harness = pageScripts("test/harness.html");
  assert.deepStrictEqual(harness.slice(0, appScripts.length - 1), appScripts.slice(0, -1));
  assert.strictEqual(appScripts[appScripts.length - 1], "src/app/start.js");
});

test("no innerHTML or eval in the extension code", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = dir + "/" + entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (rel.endsWith(".js") || rel.endsWith(".html")) files.push(rel);
    }
  };
  walk("src");
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(/, file);
    if (file.endsWith(".html")) assert.doesNotMatch(source, /<script>|<script [^>]*>[^<]/, file + " has inline script");
  }
});

test("the only hosts the code talks to are Steam's", () => {
  const allowed = /^https:\/\/(store\.steampowered\.com|api\.steampowered\.com|steamcommunity\.com|help\.steampowered\.com)/;
  const ignore = /^http:\/\/www\.w3\.org\/2000\/svg$/; // the SVG namespace, not a request
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(dir + "/" + entry.name) : [dir + "/" + entry.name]);
  for (const file of walk("src").filter((f) => f.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const [url] of source.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
      if (!ignore.test(url)) assert.match(url, allowed, file + ": " + url);
    }
  }
});
