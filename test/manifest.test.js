// Checks the manifest and the content scripts for mistakes that the browser
// would only report at runtime. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const contentScripts = manifest.content_scripts.flatMap((c) => c.js);

test("permissions stay minimal", () => {
  // A new permission or host must be a deliberate decision. If you change
  // this list, explain why in the commit message.
  assert.deepStrictEqual(manifest.permissions, ["storage"]);
  assert.deepStrictEqual(manifest.host_permissions, [
    "https://store.steampowered.com/*",
    "https://api.steampowered.com/*",
  ]);
  for (const entry of manifest.content_scripts) {
    for (const match of entry.matches) {
      assert.match(match, /^https:\/\/(store\.steampowered\.com|steamcommunity\.com)\//);
    }
  }
});

test("all files referenced by the manifest exist", () => {
  const files = [
    ...contentScripts,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), file + " is missing");
  }
});

test("package.json and manifest have the same version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.strictEqual(pkg.version, manifest.version);
});

test("content scripts don't declare the same top level name twice", () => {
  // All content scripts run in one shared scope. Two top level "const x"
  // in different files would stop the second file with a SyntaxError.
  // "var VL" is the one name every file is allowed to repeat.
  const seen = new Map();
  for (const file of contentScripts) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const names = source.matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm);
    for (const [, name] of names) {
      if (name === "VL") continue;
      assert.ok(!seen.has(name), `"${name}" is declared in ${seen.get(name)} and ${file}`);
      seen.set(name, file);
    }
  }
});

test("no innerHTML or eval in the extension code", () => {
  for (const file of [...contentScripts, "src/popup/popup.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(/, file);
  }
});
