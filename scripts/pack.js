// Builds the store package: dist/vapor-ledger-<version>.zip
// The same ZIP works for the Chrome Web Store and Firefox Add-ons.
// Only the files the extension needs go in: no tests, no dev files.
//
// Run with: npm run pack
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");

// Everything the browser loads, plus the license.
const INCLUDE = ["manifest.json", "LICENSE", "_locales", "src", "icons"];
const EXCLUDE = [/\.svg$/, /(^|\/)\./];

function listFiles() {
  const files = [];
  function walk(relative) {
    const full = path.join(root, relative);
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) walk(relative + "/" + name);
    } else if (!EXCLUDE.some((pattern) => pattern.test(relative))) {
      files.push(relative);
    }
  }
  for (const entry of INCLUDE) walk(entry);
  return files;
}

// Minimal ZIP writer (deflate, no extras). Dates are fixed, so the same
// sources always give the same ZIP.
function buildZip(files) {
  const DOS_TIME = 0;
  const DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1; // 2026-01-01
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const name of files) {
    const data = fs.readFileSync(path.join(root, name));
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const nameBuffer = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function pack(outDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const files = listFiles();
  const zip = buildZip(files);
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "vapor-ledger-" + manifest.version + ".zip");
  fs.writeFileSync(target, zip);
  return { target, files, size: zip.length };
}

module.exports = { listFiles, buildZip, pack };

if (require.main === module) {
  const result = pack(path.join(root, "dist"));
  console.log("Wrote " + path.relative(root, result.target) + " (" + result.files.length
    + " files, " + Math.round(result.size / 1024) + " KB)");
}
