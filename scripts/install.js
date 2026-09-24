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

function download(url, destination) {
  const initialHost = new URL(url).hostname;
  if (!REDIRECT_HOSTS.has(initialHost)) throw new Error(`unexpected download host: ${initialHost}`);
  const result = spawnSync("curl", [
    "--fail", "--location", "--silent", "--show-error",
    "--connect-timeout", "10", "--max-time", "120", "--max-redirs", "3",
    "--proto", "=https", "--proto-redir", "=https",
    "--output", destination, "--write-out", "%{url_effective}", url,
  ], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.error) {
    if (process.platform !== "win32") throw new Error("curl is required to download the push-cli binary");
    const command = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri $env:PUSH_CLI_URL -OutFile $env:PUSH_CLI_DEST";
    const fallback = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "ignore",
      env: { ...process.env, PUSH_CLI_URL: url, PUSH_CLI_DEST: destination },
    });
    if (fallback.error || fallback.status !== 0) throw new Error("could not download the push-cli release asset");
    return;
  }
  if (result.status !== 0) throw new Error(`release download failed (curl exit ${result.status})`);
  const finalHost = new URL(result.stdout.trim()).hostname;
  if (!REDIRECT_HOSTS.has(finalHost)) throw new Error(`unexpected download host: ${finalHost}`);
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

function ensureBinary() {
  if (fs.existsSync(BINARY_PATH)) return BINARY_PATH;

  const { platform, arch } = target();
  const tag = releaseTag();
  const asset = assetName(tag, platform, arch);
  const base = `https://github.com/${OWNER}/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}`;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "push-cli-"));
  try {
    const archivePath = path.join(temporary, asset);
    const checksumsPath = path.join(temporary, "checksums.txt");
    download(`${base}/${asset}`, archivePath);
    download(`${base}/checksums.txt`, checksumsPath);
    const checksums = fs.readFileSync(checksumsPath, "utf8");
    const checksumLine = checksums.split(/\r?\n/).find((line) => line.trim().endsWith(`  ${asset}`));
    if (!checksumLine) throw new Error(`release checksums do not include ${asset}`);
    const expected = checksumLine.trim().split(/\s+/)[0].toLowerCase();
    const actual = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
    if (!/^[a-f0-9]{64}$/.test(expected) || actual !== expected) {
      throw new Error(`SHA-256 verification failed for ${asset}`);
    }
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
