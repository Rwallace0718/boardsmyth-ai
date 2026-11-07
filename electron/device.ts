import { app } from 'electron';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cached: string | null = null;

/** The computer's own id, read from the operating system. Never sent anywhere as is. */
function machineId(): string {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
      if (m) return m[1];
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 5000 });
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } else {
      for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
      }
    }
  } catch {
    /* fall through to a saved random id */
  }
  // Last resort: a random id saved next to the app's settings (a reinstall or deleted settings folder resets it).
  const file = path.join(app.getPath('userData'), 'device-id.txt');
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const id = randomUUID();
    fs.writeFileSync(file, id);
    return id;
  } catch {
    return 'unknown-device';
  }
}

/** A one-way hash of the computer id. It is only used to enforce the one-time free trial limit. */
export function deviceHash(): string {
  if (!cached) cached = createHash('sha256').update(`boardsmyth-ai:${machineId()}`).digest('hex');
  return cached;
}
