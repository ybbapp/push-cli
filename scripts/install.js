const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const OWNER = "ybbapp";
const REPOSITORY = "push-cli";
const PACKAGE_VERSION = require("../package.json").version;
const VENDOR_DIR = path.join(__dirname, "..", "vendor");
const BINARY_NAME = process.platform === "win32" ? "push-cli.exe" : "push-cli";
const BINARY_PATH = path.join(VENDOR_DIR, BINARY_NAME);
const REDIRECT_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

function target() {
  const platform = { darwin: "darwin", linux: "linux", win32: "windows" }[process.platform];
  const arch = { x64: "amd64", arm64: "arm64", riscv64: "riscv64" }[process.arch];
  if (!platform || !arch) {
    throw new Error(`unsupported platform: ${process.platform}-${process.arch}`);
  }
  return { platform, arch };
}

function releaseTag() {
  const alpha = PACKAGE_VERSION.match(/^(\d+\.\d+\.\d+)-alpha\.\d+$/);
  if (alpha) return `alpha-${alpha[1]}`;
  if (/^\d+\.\d+\.\d+$/.test(PACKAGE_VERSION)) return `v${PACKAGE_VERSION}`;
  throw new Error(`cannot map npm version ${PACKAGE_VERSION} to a GitHub release`);
}

function assetName(tag, platform, arch) {
  const extension = platform === "windows" ? "zip" : "tar.gz";
  return `push-cli-${tag}-${platform}-${arch}.${extension}`;
}

async function get(url, redirects = 0) {
  const parsed = new URL(url);
  if (!REDIRECT_HOSTS.has(parsed.hostname)) throw new Error(`unexpected download host: ${parsed.hostname}`);
  const response = await fetch(url, { redirect: "manual" });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 3) throw new Error("too many redirects while downloading the release");
    const location = response.headers.get("location");
    if (!location) throw new Error("release download redirect has no location");
    return get(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error(`download failed (${response.status}): ${url}`);
  const finalHost = new URL(response.url).hostname;
  if (!REDIRECT_HOSTS.has(finalHost)) throw new Error(`unexpected download host: ${finalHost}`);
  return Buffer.from(await response.arrayBuffer());
}

function extract(archive, directory, platform) {
  if (platform === "windows") {
    const command = "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:PUSH_CLI_ARCHIVE -DestinationPath $env:PUSH_CLI_DEST -Force";
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "inherit",
      env: { ...process.env, PUSH_CLI_ARCHIVE: archive, PUSH_CLI_DEST: directory },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("could not extract the Windows release archive");
    return;
  }
  const result = spawnSync("tar", ["-xzf", archive, "-C", directory], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("could not extract the release archive; install tar and retry");
}

async function ensureBinary() {
  if (fs.existsSync(BINARY_PATH)) return BINARY_PATH;

  const { platform, arch } = target();
  const tag = releaseTag();
  const asset = assetName(tag, platform, arch);
  const base = `https://github.com/${OWNER}/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}`;
  const [archiveData, checksums] = await Promise.all([
    get(`${base}/${asset}`),
    get(`${base}/checksums.txt`),
  ]);
  const checksumLine = checksums.toString("utf8").split(/\r?\n/).find((line) => line.trim().endsWith(`  ${asset}`));
  if (!checksumLine) throw new Error(`release checksums do not include ${asset}`);
  const expected = checksumLine.trim().split(/\s+/)[0].toLowerCase();
  const actual = crypto.createHash("sha256").update(archiveData).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`SHA-256 verification failed for ${asset}`);
  }

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "push-cli-"));
  try {
    const archivePath = path.join(temporary, asset);
    fs.writeFileSync(archivePath, archiveData, { mode: 0o600 });
    extract(archivePath, temporary, platform);
    const extracted = path.join(temporary, BINARY_NAME);
    if (!fs.existsSync(extracted)) throw new Error(`release archive does not contain ${BINARY_NAME}`);
    fs.mkdirSync(VENDOR_DIR, { recursive: true });
    fs.copyFileSync(extracted, BINARY_PATH);
    fs.chmodSync(BINARY_PATH, 0o755);
    return BINARY_PATH;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = { ensureBinary, releaseTag, target, assetName };
