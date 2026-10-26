// Downloads the arduino-cli binary for the current OS into resources/arduino-cli/.
// Run with: npm run fetch-cli   (it runs automatically before "npm run dist")
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const VERSION = process.env.ARDUINO_CLI_VERSION ?? '1.1.1';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'resources', 'arduino-cli');
mkdirSync(outDir, { recursive: true });

const platform = process.platform;
const arch = process.arch;

let asset;
if (platform === 'win32') asset = `arduino-cli_${VERSION}_Windows_64bit.zip`;
else if (platform === 'darwin')
  asset = arch === 'arm64' ? `arduino-cli_${VERSION}_macOS_ARM64.tar.gz` : `arduino-cli_${VERSION}_macOS_64bit.tar.gz`;
else asset = `arduino-cli_${VERSION}_Linux_64bit.tar.gz`;

const exe = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
if (existsSync(join(outDir, exe))) {
  console.log(`arduino-cli already present at ${join(outDir, exe)}`);
  process.exit(0);
}

const url = `https://github.com/arduino/arduino-cli/releases/download/v${VERSION}/${asset}`;
const work = join(tmpdir(), `arduino-cli-${Date.now()}`);
mkdirSync(work, { recursive: true });
const archive = join(work, asset);

console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
const { writeFileSync } = await import('node:fs');
writeFileSync(archive, Buffer.from(await res.arrayBuffer()));

// tar ships with Windows 10+, macOS and Linux and can read both .zip and .tar.gz
execFileSync('tar', ['-xf', archive, '-C', work]);

const found = readdirSync(work).find((f) => f === exe);
if (!found) throw new Error(`${exe} not found in archive`);
execFileSync(platform === 'win32' ? 'cmd' : 'cp', platform === 'win32'
  ? ['/c', 'copy', join(work, exe), join(outDir, exe)]
  : [join(work, exe), join(outDir, exe)]);
if (platform !== 'win32') chmodSync(join(outDir, exe), 0o755);

rmSync(work, { recursive: true, force: true });
console.log(`Installed arduino-cli ${VERSION} to ${outDir}`);
