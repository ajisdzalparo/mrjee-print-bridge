const fs = require("fs");
const https = require("https");
const { execFileSync } = require("child_process");

const owner = "ajisdzalparo";
const repo = "mrjee-print-bridge";
const version = process.argv[2];
if (!version) throw new Error("Version argument is required");

const credentialOutput = execFileSync("git", ["credential", "fill"], {
  input: `protocol=https\nhost=github.com\n\n`,
  encoding: "utf8",
});
const token = credentialOutput
  .split(/\r?\n/)
  .find((line) => line.startsWith("password="))
  ?.slice("password=".length);
if (!token) throw new Error("GitHub credential was not found");

function request({ hostname = "api.github.com", method = "GET", path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        method,
        path,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "mrjee-release-publisher",
          "X-GitHub-Api-Version": "2022-11-28",
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(text ? JSON.parse(text) : {});
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${text}`));
          }
        });
      },
    );
    req.on("error", reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

function upload(releaseId, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const name = encodeURIComponent(filePath.split(/[\\/]/).pop());
    const req = https.request(
      {
        hostname: "uploads.github.com",
        method: "POST",
        path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${name}`,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "mrjee-release-publisher",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": contentType,
          "Content-Length": stat.size,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(text));
          } else {
            reject(new Error(`GitHub upload ${res.statusCode}: ${text}`));
          }
        });
      },
    );
    req.on("error", reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

(async () => {
  const notes = fs.readFileSync(`release-notes-v${version}.md`, "utf8");
  const release = await request({
    method: "POST",
    path: `/repos/${owner}/${repo}/releases`,
    body: {
      tag_name: `v${version}`,
      name: `Mrjee Print Bridge v${version} — Privacy-first Telemetry`,
      body: notes,
      draft: false,
      prerelease: false,
      make_latest: "true",
    },
  });

  const assets = [
    [`release/Mrjee-Print-Bridge-Setup-${version}.exe`, "application/vnd.microsoft.portable-executable"],
    [`release/Mrjee-Print-Bridge-Setup-${version}.exe.blockmap`, "application/octet-stream"],
    ["release/latest.yml", "text/yaml"],
  ];
  for (const [file, contentType] of assets) {
    const asset = await upload(release.id, file, contentType);
    process.stdout.write(`Uploaded ${asset.name} (${asset.size} bytes)\n`);
  }
  process.stdout.write(`${release.html_url}\n`);
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
