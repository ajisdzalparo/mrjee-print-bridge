const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const version = process.argv[2];
if (!version) throw new Error("Version argument is required");

const releaseDir = path.join(__dirname, "..", "release");
const source = path.join(releaseDir, `Mrjee Print Bridge Setup ${version}.exe`);
const target = path.join(releaseDir, `Mrjee-Print-Bridge-Setup-${version}.exe`);

fs.copyFileSync(source, target);
fs.copyFileSync(`${source}.blockmap`, `${target}.blockmap`);

const buffer = fs.readFileSync(target);
const sha256 = crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
const metadata = { file: path.basename(target), size: buffer.length, sha256 };
process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
