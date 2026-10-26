import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ActionResult,
  BoardConfigOption,
  BoardDetails,
  BoardOption,
  DetectedPort,
} from '../shared/types';
import { ADDITIONAL_BOARD_URLS, POPULAR_BOARDS, coreForFqbn, uploadHint } from './boards';
import { ALL_KNOWN_BOARDS } from './boards-static';

type Emit = (stage: 'installing' | 'compiling' | 'uploading', message: string) => void;

interface RawResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Paths and config
// ---------------------------------------------------------------------------

function cliPath(): string {
  const exe = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'arduino-cli')
    : path.join(app.getAppPath(), 'resources', 'arduino-cli');
  return path.join(base, exe);
}

function dataRoot(): string {
  const dir = path.join(app.getPath('userData'), 'arduino');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const yq = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Writes arduino-cli's own config so it uses our folders and every board index. */
function configFile(): string {
  const root = dataRoot();
  const file = path.join(root, 'arduino-cli.yaml');
  const yaml = [
    'board_manager:',
    '  additional_urls:',
    ...ADDITIONAL_BOARD_URLS.map((u) => `    - ${yq(u)}`),
    'directories:',
    `  data: ${yq(path.join(root, 'data'))}`,
    `  user: ${yq(path.join(root, 'user'))}`,
    `  downloads: ${yq(path.join(root, 'downloads'))}`,
    'metrics:',
    '  enabled: false',
    'updater:',
    '  enable_notification: false',
    '',
  ].join('\n');
  let current = '';
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    /* first run */
  }
  if (current !== yaml) fs.writeFileSync(file, yaml, 'utf8');
  return file;
}

// ---------------------------------------------------------------------------
// Running the CLI
// ---------------------------------------------------------------------------

function runRaw(args: string[], timeoutMs = 10 * 60 * 1000): Promise<RawResult> {
  return new Promise((resolve) => {
    const bin = cliPath();
    if (!fs.existsSync(bin)) {
      resolve({
        ok: false,
        stdout: '',
        stderr: `arduino-cli not found at ${bin}. Run "npm run fetch-cli" first.`,
      });
      return;
    }
    const child = spawn(bin, ['--config-file', configFile(), ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: stderr + String(e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

export async function run(args: string[], timeoutMs?: number): Promise<ActionResult> {
  const r = await runRaw(args, timeoutMs);
  return { ok: r.ok, output: `${r.stdout}${r.stderr ? '\n' + r.stderr : ''}`.trim() };
}

function parseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Board catalog
// ---------------------------------------------------------------------------

let indexPromise: Promise<void> | null = null;

/** Shared so concurrent callers wait on one update instead of racing. */
function ensureIndex(emit: Emit): Promise<void> {
  if (!indexPromise) {
    emit('installing', 'Updating the board list…');
    // Some third-party indexes can be unreachable; the others still update, so ignore the exit code.
    indexPromise = runRaw(['core', 'update-index'], 5 * 60 * 1000).then(() => undefined);
  }
  return indexPromise;
}

const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Bump when the catalog format or contents change, so old saved lists are rebuilt. */
const CATALOG_VERSION = 2;

/** Every board from every board package, including ones that are not installed yet. */
export async function getCatalog(force: boolean, emit: Emit): Promise<BoardOption[]> {
  const cache = path.join(dataRoot(), 'catalog.json');
  if (!force && fs.existsSync(cache)) {
    try {
      const age = Date.now() - fs.statSync(cache).mtimeMs;
      if (age < CATALOG_MAX_AGE_MS) {
        const saved = JSON.parse(fs.readFileSync(cache, 'utf8')) as { v?: number; boards?: BoardOption[] };
        if (saved.v === CATALOG_VERSION && Array.isArray(saved.boards) && saved.boards.length > 0) {
          return saved.boards;
        }
      }
    } catch {
      /* rebuild below */
    }
  }

  await ensureIndex(emit);
  emit('installing', 'Loading every supported board…');
  const res = await runRaw(['board', 'search', '--format', 'json'], 5 * 60 * 1000);
  const parsed = parseJson(res.stdout);
  const rows: any[] = !parsed ? [] : Array.isArray(parsed) ? parsed : parsed.boards ?? [];
  const seen = new Set<string>();
  const boards: BoardOption[] = [];
  for (const b of rows) {
    const fqbn: string | undefined = b.fqbn;
    const name: string | undefined = b.name;
    if (!fqbn || !name || seen.has(fqbn)) continue;
    seen.add(fqbn);
    boards.push({
      name,
      fqbn,
      core: coreForFqbn(fqbn),
      vendor: b.platform?.release?.name ?? b.platform?.name ?? undefined,
    });
  }
  // The CLI only lists boards whose package is already installed. Always include the popular
  // boards so they can be picked (their package is downloaded the first time they are used).
  for (const p of [...POPULAR_BOARDS, ...ALL_KNOWN_BOARDS]) {
    if (!seen.has(p.fqbn)) {
      seen.add(p.fqbn);
      boards.push(p);
    }
  }
  boards.sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length > 0) fs.writeFileSync(cache, JSON.stringify({ v: CATALOG_VERSION, boards }), 'utf8');
  return boards;
}

/** Option menus (Processor, Flash Size, Partition Scheme…) for a board. Installs its core first. */
export async function getDetails(fqbn: string, emit: Emit): Promise<BoardDetails> {
  const hint = uploadHint(coreForFqbn(fqbn), fqbn);
  const core = await ensureCore(fqbn, emit);
  if (!core.ok) return { options: [], hint, error: core.output };

  const res = await runRaw(['board', 'details', '-b', fqbn, '--format', 'json'], 60_000);
  const parsed = parseJson(res.stdout);
  if (!parsed) return { options: [], hint };

  const options: BoardConfigOption[] = (parsed.config_options ?? [])
    .map((o: any) => ({
      option: String(o.option),
      label: String(o.option_label ?? o.option),
      values: (o.values ?? []).map((v: any) => ({
        value: String(v.value),
        label: String(v.value_label ?? v.value),
        selected: !!v.selected,
      })),
    }))
    .filter((o: BoardConfigOption) => o.values.length > 1);

  return { options, hint };
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

const installedCores = new Set<string>();

export async function ensureCore(fqbn: string, emit: Emit): Promise<ActionResult> {
  const core = coreForFqbn(fqbn);
  if (installedCores.has(core)) return { ok: true, output: '' };

  const list = await runRaw(['core', 'list']);
  if (list.ok && list.stdout.split('\n').some((l) => l.startsWith(core + ' '))) {
    installedCores.add(core);
    return { ok: true, output: '' };
  }

  await ensureIndex(emit);
  emit('installing', `Installing ${core} (first time only, this can take a few minutes)…`);
  const res = await run(['core', 'install', core]);
  if (res.ok) installedCores.add(core);
  return res;
}

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

let libIndexUpdated = false;

async function ensureLibIndex(): Promise<void> {
  if (libIndexUpdated) return;
  await runRaw(['lib', 'update-index'], 5 * 60 * 1000);
  libIndexUpdated = true;
}

async function installedLibraryNames(): Promise<Set<string>> {
  const res = await runRaw(['lib', 'list', '--format', 'json']);
  const parsed = parseJson(res.stdout);
  const rows: any[] = parsed?.installed_libraries ?? (Array.isArray(parsed) ? parsed : []);
  return new Set(rows.map((r) => norm(String(r.library?.name ?? r.name ?? ''))).filter(Boolean));
}

async function searchLibraries(query: string): Promise<string[]> {
  await ensureLibIndex();
  const res = await runRaw(['lib', 'search', query, '--format', 'json'], 60_000);
  const parsed = parseJson(res.stdout);
  const rows: any[] = parsed?.libraries ?? [];
  return rows.map((r) => String(r.name)).filter(Boolean);
}

/** Finds the exact Library Manager name for a requested library, then installs it. */
export async function ensureLibraries(libs: string[], emit: Emit): Promise<ActionResult> {
  if (libs.length === 0) return { ok: true, output: '' };
  const have = await installedLibraryNames();

  for (const lib of libs) {
    if (have.has(norm(lib))) continue;
    const names = await searchLibraries(lib);
    const target =
      names.find((n) => norm(n) === norm(lib)) ??
      names.find((n) => norm(n).includes(norm(lib)) || norm(lib).includes(norm(n)));
    if (!target) {
      return {
        ok: false,
        output: `The library "${lib}" was not found in the Arduino Library Manager.`,
      };
    }
    if (have.has(norm(target))) continue;
    emit('installing', `Installing library ${target}…`);
    const res = await run(['lib', 'install', target]);
    if (!res.ok) return { ok: false, output: `Could not install library "${target}": ${res.output}` };
    have.add(norm(target));
  }
  return { ok: true, output: '' };
}

/**
 * If a compile failed because a header is missing, find the library that provides it
 * and install it. Returns true when something was installed, so the caller can retry.
 */
async function installForMissingHeaders(output: string, emit: Emit): Promise<boolean> {
  const headers = Array.from(
    new Set(
      [...output.matchAll(/fatal error: ([\w/.+-]+\.h(?:pp)?): No such file or directory/g)].map(
        (m) => m[1]
      )
    )
  );
  if (headers.length === 0) return false;

  const have = await installedLibraryNames();
  let installedAny = false;

  for (const header of headers) {
    const base = header.split('/').pop()!.replace(/\.h(pp)?$/, '');
    const variants = [
      base.replace(/[_-]+/g, ' '),
      base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '),
      base,
    ];
    let target: string | undefined;
    for (const v of variants) {
      const names = await searchLibraries(v);
      target =
        names.find((n) => norm(n) === norm(base)) ??
        names.find((n) => norm(n).startsWith(norm(base)) || norm(base).startsWith(norm(n)));
      if (target) break;
    }
    if (!target || have.has(norm(target))) continue;

    emit('installing', `Installing library ${target} (needed for ${header})…`);
    const res = await run(['lib', 'install', target]);
    if (res.ok) {
      have.add(norm(target));
      installedAny = true;
    }
  }
  return installedAny;
}

// ---------------------------------------------------------------------------
// Compile, upload, ports, monitor
// ---------------------------------------------------------------------------

function sketchDir(code: string): string {
  const dir = path.join(app.getPath('userData'), 'sketches', 'current');
  fs.mkdirSync(dir, { recursive: true });
  // The folder name must match the .ino name for arduino-cli.
  fs.writeFileSync(path.join(dir, 'current.ino'), code, 'utf8');
  return dir;
}

/** Compiles, installing any missing libraries along the way (up to a few rounds). */
export async function compile(code: string, fqbn: string, emit: Emit): Promise<ActionResult> {
  const core = await ensureCore(fqbn, emit);
  if (!core.ok) return core;

  const dir = sketchDir(code);
  let result: ActionResult = { ok: false, output: '' };
  for (let round = 0; round < 4; round++) {
    emit('compiling', round === 0 ? 'Compiling…' : 'Compiling again with the new library…');
    result = await run(['compile', '--fqbn', fqbn, dir]);
    if (result.ok) return result;
    const added = await installForMissingHeaders(result.output, emit);
    if (!added) break;
  }
  return result;
}

export async function upload(
  code: string,
  fqbn: string,
  port: string,
  emit: Emit
): Promise<ActionResult> {
  const built = await compile(code, fqbn, emit);
  if (!built.ok) return built;
  emit('uploading', 'Uploading to board…');
  const dir = sketchDir(code);
  const res = await run(['upload', '-p', port, '--fqbn', fqbn, dir]);
  if (!res.ok) {
    const hint = uploadHint(coreForFqbn(fqbn), fqbn);
    if (hint) return { ok: false, output: `${res.output}\n\nTip: ${hint}` };
  }
  return res;
}

export async function detectPorts(): Promise<DetectedPort[]> {
  const res = await runRaw(['board', 'list', '--format', 'json'], 30_000);
  const parsed = parseJson(res.stdout);
  if (!parsed) return [];
  const entries: any[] = Array.isArray(parsed) ? parsed : parsed.detected_ports ?? [];
  return entries
    .filter((e) => e.port?.address)
    .map((e) => {
      const match = e.matching_boards?.[0] ?? e.boards?.[0];
      return {
        address: e.port.address as string,
        label: (e.port.label as string) ?? e.port.address,
        boardName: match?.name,
        fqbn: match?.fqbn,
      };
    });
}

let monitorProc: ChildProcess | null = null;

export function startMonitor(port: string, baud: number, onData: (s: string) => void): void {
  stopMonitor();
  const bin = cliPath();
  if (!fs.existsSync(bin)) return;
  monitorProc = spawn(
    bin,
    ['--config-file', configFile(), 'monitor', '-p', port, '-c', `baudrate=${baud}`],
    { windowsHide: true }
  );
  monitorProc.stdout?.on('data', (d) => onData(d.toString()));
  monitorProc.stderr?.on('data', (d) => onData(d.toString()));
  monitorProc.on('close', () => {
    monitorProc = null;
  });
}

export function stopMonitor(): void {
  if (monitorProc) {
    monitorProc.kill();
    monitorProc = null;
  }
}
