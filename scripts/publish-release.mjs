// Uploads the finished installer to the public Supabase "releases" bucket and writes that platform's version.json.
// Usage: node scripts/publish-release.mjs win|mac "release notes"
// Needs env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Run by the GitHub release workflow, never on a laptop by default.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const platform = process.argv[2];
const notes = process.argv[3] ?? '';
if (!['win', 'mac'].includes(platform)) throw new Error('First argument must be win or mac');
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const files = readdirSync('release');
const wanted =
  platform === 'win'
    ? files.filter((f) => /^BoardSmyth-AI-Setup\.exe$/.test(f))
    : files.filter((f) => /^BoardSmyth-AI-.*\.dmg$/.test(f));
if (wanted.length === 0) throw new Error(`No ${platform} installer found in release/: ${files.join(', ')}`);

async function put(path, body, type) {
  const res = await fetch(`${base}/storage/v1/object/releases/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=60' },
    body,
  });
  if (!res.ok) throw new Error(`Upload of ${path} failed: ${res.status} ${await res.text()}`);
  console.log(`Uploaded ${path}`);
}
const publicUrl = (path) => `${base}/storage/v1/object/public/releases/${path}`;

// GPL-3.0 section 6: the source code of the bundled Arduino CLI must be available from the same place as the installer.
// Upload it BEFORE the installer so an installer is never published without its source.
{
  const cliVersion = process.env.ARDUINO_CLI_VERSION ?? '1.1.1';
  const srcUrl = `https://github.com/arduino/arduino-cli/archive/refs/tags/v${cliVersion}.tar.gz`;
  const r = await fetch(srcUrl);
  if (!r.ok) throw new Error(`Could not download the Arduino CLI source (${srcUrl}): ${r.status}`);
  await put(`source/arduino-cli-${cliVersion}-source.tar.gz`, Buffer.from(await r.arrayBuffer()), 'application/gzip');
}

let mainUrl = '';
for (const f of wanted) {
  const data = readFileSync(join('release', f));
  const type = f.endsWith('.exe') ? 'application/vnd.microsoft.portable-executable' : 'application/x-apple-diskimage';
  await put(`${platform}/${f}`, data, type);
  // Keep every version too, e.g. win/BoardSmyth-AI-Setup-0.2.0.exe
  await put(`${platform}/${f.replace(/(\.[a-z]+)$/, `-${version}$1`)}`, data, type);
  if (!mainUrl || /arm64/.test(f)) mainUrl = publicUrl(`${platform}/${f}`);
}
const info = { version, url: mainUrl, notes, published: new Date().toISOString() };
await put(`${platform}/version.json`, JSON.stringify(info), 'application/json');
// The app reads the newest version from this table (the file CDN can serve an old copy for a while).
const dbRes = await fetch(`${base}/rest/v1/app_releases?on_conflict=platform`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  },
  body: JSON.stringify({ platform, version, url: mainUrl, notes, published: info.published }),
});
if (!dbRes.ok) throw new Error(`Could not record the release in app_releases: ${dbRes.status} ${await dbRes.text()}`);
console.log(`Published ${platform} ${version}: ${mainUrl}`);
