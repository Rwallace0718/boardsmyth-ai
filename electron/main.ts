import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { loadConfig } from './config';
import type { Draft, FileResult, GenerateRequest, MenuAction, PhoneSession, StatusEvent, UpdateState } from '../shared/types';
import * as arduino from './arduino';
import * as auth from './auth';
import { generateAndVerify } from './ai';
import { POPULAR_BOARDS } from './boards';
import { clearClaudeKey, setClaudeKey } from './keys';

let win: BrowserWindow | null = null;

function send(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

const emitStatus = (stage: StatusEvent['stage'], message: string) =>
  send('status', { stage, message } satisfies StatusEvent);

// The newest version lives in the Supabase table "app_releases" (written by the release workflow, never cached).
// Fallbacks: the version.json file next to each installer, then the old copy on the website.
const platformFolder = () => (process.platform === 'darwin' ? 'mac' : 'win');
interface UpdateSource {
  url: string;
  headers?: Record<string, string>;
}
const updateSources = (): UpdateSource[] => {
  const list: UpdateSource[] = [];
  try {
    const cfg = loadConfig();
    list.push({
      url: `${cfg.supabaseUrl}/rest/v1/app_releases?platform=eq.${platformFolder()}&select=version,url,notes&limit=1`,
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
    });
    list.push({ url: `${cfg.supabaseUrl}/storage/v1/object/public/releases/${platformFolder()}/version.json` });
  } catch {
    /* no config yet */
  }
  list.push({ url: 'https://boardsmythai.com/downloads/version.json' });
  return list;
};
const DOWNLOAD_PAGE = 'https://boardsmythai.com/download.html';

function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

let updateState: UpdateState = { current: app.getVersion(), available: false };

/** Asks the release server for the newest version, remembers it and tells the window. Throws if no server answers. */
async function refreshUpdateState(): Promise<UpdateState> {
  let info: { version?: string; url?: string; notes?: string } | undefined;
  let lastErr = '';
  for (const src of updateSources()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const sep = src.url.includes('?') ? '&' : '?';
      const r = await fetch(`${src.url}${sep}t=${Date.now()}`, {
        signal: ctrl.signal,
        headers: { 'Cache-Control': 'no-cache', ...src.headers },
      });
      if (!r.ok) {
        lastErr = `Server returned ${r.status}`;
        continue;
      }
      const body = (await r.json()) as unknown;
      const row = (Array.isArray(body) ? body[0] : body) as typeof info;
      if (row?.version) {
        info = row;
        break;
      }
      lastErr = 'No version information found';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!info) throw new Error(lastErr || 'No update server reachable');
  const current = app.getVersion();
  const available = !!info.version && isNewer(info.version, current);
  updateState = {
    current,
    available,
    latest: info.version,
    url: info.url || DOWNLOAD_PAGE,
    notes: info.notes ? String(info.notes) : undefined,
  };
  send('update:state', updateState);
  return updateState;
}

/** The "Check for updates" button and menu item. Always answers, so the person sees something happen. */
async function checkForUpdates(): Promise<void> {
  const parent = win && !win.isDestroyed() ? win : undefined;
  const say = (opts: Electron.MessageBoxOptions) =>
    parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts);
  try {
    const u = await refreshUpdateState();
    if (u.available) {
      const r = await say({
        type: 'info',
        title: 'Update available',
        message: `BoardSmyth AI ${u.latest} is available. You have ${u.current}.`,
        detail: u.notes ?? 'Download the new version and install it over this one.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (r.response === 0) void shell.openExternal(u.url || DOWNLOAD_PAGE);
    } else {
      await say({ type: 'info', title: 'Up to date', message: `You have the latest version (${u.current}).` });
    }
  } catch (err) {
    await say({
      type: 'warning',
      title: 'Could not check for updates',
      message: 'Could not reach the BoardSmyth AI update server. Check your internet connection and try again.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Quiet background check: no dialogs, just updates the button in the window. */
let lastUpdateCheck = 0;
const backgroundUpdateCheck = () => {
  lastUpdateCheck = Date.now();
  void refreshUpdateState().catch(() => undefined);
};

const draftFile = () => path.join(app.getPath('userData'), 'draft.json');

function buildMenu(): void {
  const act = (a: MenuAction) => () => send('menu:action', a);
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New program', accelerator: 'CmdOrCtrl+N', click: act('new') },
        { label: 'Open program…', accelerator: 'CmdOrCtrl+O', click: act('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: act('save') },
        { label: 'Save as…', accelerator: 'CmdOrCtrl+Shift+S', click: act('saveAs') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Check for updates…', click: () => void checkForUpdates() },
        {
          label: 'Open-source notices…',
          click: () =>
            void shell.openPath(
              app.isPackaged
                ? path.join(process.resourcesPath, 'THIRD_PARTY_NOTICES.txt')
                : path.join(app.getAppPath(), 'resources', 'THIRD_PARTY_NOTICES.txt')
            ),
        },
        {
          label: 'BoardSmyth AI website',
          click: () => void shell.openExternal('https://boardsmythai.com'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f1115',
    title: 'BoardSmyth AI',
    icon: path.join(app.getAppPath(), 'dist', 'icon.png'),
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required', // splash sound plays on launch
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Right-click menu: Cut / Copy / Paste / Select all (also works inside the code editor).
  win.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]).popup();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:state', () => updateState);
  ipcMain.handle('file:save', async (_e, code: string, target: string, saveAs: boolean): Promise<FileResult> => {
    try {
      let dest = target;
      if (!dest || saveAs) {
        const r = await dialog.showSaveDialog(win!, {
          title: 'Save program',
          defaultPath: dest || path.join(app.getPath('documents'), 'sketch.ino'),
          filters: [
            { name: 'Arduino sketch', extensions: ['ino'] },
            { name: 'All files', extensions: ['*'] },
          ],
        });
        if (r.canceled || !r.filePath) return { ok: false, canceled: true };
        dest = r.filePath;
      }
      fs.writeFileSync(dest, code, 'utf8');
      return { ok: true, path: dest };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('file:open', async (): Promise<FileResult> => {
    try {
      const r = await dialog.showOpenDialog(win!, {
        title: 'Open program',
        defaultPath: app.getPath('documents'),
        properties: ['openFile'],
        filters: [
          { name: 'Arduino sketch', extensions: ['ino', 'cpp', 'c', 'h', 'txt'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
      if (r.canceled || r.filePaths.length === 0) return { ok: false, canceled: true };
      const file = r.filePaths[0];
      return { ok: true, path: file, code: fs.readFileSync(file, 'utf8') };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('draft:get', (): Draft | null => {
    try {
      return JSON.parse(fs.readFileSync(draftFile(), 'utf8')) as Draft;
    } catch {
      return null;
    }
  });
  ipcMain.handle('draft:set', (_e, d: Draft) => {
    try {
      fs.writeFileSync(draftFile(), JSON.stringify(d), 'utf8');
    } catch {
      /* best effort */
    }
  });

  ipcMain.handle('phone:start', async (): Promise<PhoneSession> => {
    const session = randomUUID();
    const url = `https://boardsmythai.com/snap.html?s=${session}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    return { session, url, qr };
  });
  ipcMain.handle('phone:poll', async (_e, session: string): Promise<string[]> => {
    try {
      if (!/^[A-Za-z0-9-]{24,64}$/.test(session)) return [];
      const cfg = loadConfig();
      const res = await fetch(
        `${cfg.supabaseUrl}/functions/v1/photo-relay?session=${encodeURIComponent(session)}`,
        { headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } }
      );
      if (!res.ok) return [];
      const j = (await res.json()) as { images?: string[] };
      return Array.isArray(j.images) ? j.images : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('auth:state', () => auth.getState());
  ipcMain.handle('auth:signIn', (_e, email: string, password: string) =>
    auth.signIn(email, password)
  );
  ipcMain.handle('auth:signUp', (_e, email: string, password: string) =>
    auth.signUp(email, password)
  );
  ipcMain.handle('auth:signOut', () => auth.signOut());
  ipcMain.handle('auth:acceptTerms', () => auth.acceptTerms());
  ipcMain.handle('auth:openCheckout', () => auth.openCheckout());
  ipcMain.handle('auth:openManage', () => auth.openManage());

  ipcMain.handle('claudeKey:set', (_e, key: string) => setClaudeKey(key));
  ipcMain.handle('claudeKey:clear', () => clearClaudeKey());

  ipcMain.handle('boards:popular', () => POPULAR_BOARDS);
  ipcMain.handle('boards:catalog', (_e, refresh: boolean) =>
    arduino.getCatalog(refresh, emitStatus)
  );
  ipcMain.handle('boards:details', (_e, fqbn: string) => arduino.getDetails(fqbn, emitStatus));
  ipcMain.handle('boards:detect', () => arduino.detectPorts());

  ipcMain.handle('ai:generate', (_e, req: GenerateRequest) =>
    generateAndVerify(req, (e) => send('status', e))
  );
  ipcMain.handle('arduino:compile', (_e, code: string, fqbn: string) =>
    arduino.compile(code, fqbn, emitStatus)
  );
  ipcMain.handle('arduino:upload', async (_e, code: string, fqbn: string, port: string) => {
    arduino.stopMonitor(); // the port must be free for uploading
    return arduino.upload(code, fqbn, port, emitStatus);
  });

  ipcMain.handle('monitor:start', (_e, port: string, baud: number) => {
    arduino.startMonitor(port, baud, (chunk) => send('monitor:data', chunk));
  });
  ipcMain.handle('monitor:stop', () => arduino.stopMonitor());
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  createWindow();
  setTimeout(backgroundUpdateCheck, 4_000);
  // Look again every 30 minutes, and whenever the window regains focus (at most once every 5 minutes).
  setInterval(backgroundUpdateCheck, 30 * 60 * 1000);
  app.on('browser-window-focus', () => {
    if (Date.now() - lastUpdateCheck > 5 * 60 * 1000) backgroundUpdateCheck();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  arduino.stopMonitor();
  if (process.platform !== 'darwin') app.quit();
});
