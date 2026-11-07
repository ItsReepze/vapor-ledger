// Checks the store package built by scripts/pack.js. Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { listFiles, pack } = require("../scripts/pack.js");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

// Reads the central directory of a ZIP and inflates every file.
function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let pos = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.strictEqual(buffer.readUInt32LE(pos), 0x02014b50);
    const size = buffer.readUInt32LE(pos + 20);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString("utf8", pos + 46, pos + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(offset + 26);
    const dataStart = offset + 30 + localNameLength;
    entries.set(name, zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + size)));
    pos += 46 + nameLength;
  }
  return entries;
}

test("the package contains everything the manifest needs and nothing else", () => {
  const files = listFiles();
  const needed = [
    "manifest.json",
    ...manifest.content_scripts.flatMap((c) => c.js),
    manifest.action.default_popup,
    "src/popup/popup.js",
    ...Object.values(manifest.icons),
  ];
  for (const file of needed) assert.ok(files.includes(file), file + " is missing");
  for (const file of files) {
    assert.doesNotMatch(file, /^(test|node_modules|scripts|store|dist)\/|\.svg$|eslint|package/, file);
  }
});

test("the ZIP unpacks to the original files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-pack-"));
  try {
    const result = pack(dir);
    assert.strictEqual(path.basename(result.target), "vapor-ledger-" + manifest.version + ".zip");
    const entries = readZip(fs.readFileSync(result.target));
    assert.deepStrictEqual([...entries.keys()], result.files);
    for (const [name, data] of entries) {
      assert.ok(data.equals(fs.readFileSync(path.join(root, name))), name + " differs");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the manifest is ready for both stores", () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description.length <= 132, "Chrome allows 132 characters");
  const gecko = manifest.browser_specific_settings.gecko;
  assert.ok(gecko.id, "Firefox needs a fixed add-on id");
  assert.deepStrictEqual(gecko.data_collection_permissions, { required: ["none"] });
  // data_collection_permissions is only understood from Firefox 140 on.
  assert.ok(parseFloat(gecko.strict_min_version) >= 140);
});
