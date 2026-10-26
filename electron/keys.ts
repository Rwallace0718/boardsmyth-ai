import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** The user's own Claude API key (bring-your-own-key plan), encrypted with the OS keychain. */
function keyFile(): string {
  return path.join(app.getPath('userData'), 'claude-key.bin');
}

export function hasClaudeKey(): boolean {
  return getClaudeKey() !== null;
}

export function getClaudeKey(): string | null {
  try {
    const raw = fs.readFileSync(keyFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : null;
  } catch {
    return null;
  }
}

export function setClaudeKey(key: string): { ok: boolean; error?: string } {
  const trimmed = key.trim();
  if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(trimmed)) {
    return { ok: false, error: 'That does not look like a Claude API key (it starts with sk-ant-).' };
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'Secure storage is not available on this computer, so the key was not saved.' };
  }
  fs.writeFileSync(keyFile(), safeStorage.encryptString(trimmed));
  return { ok: true };
}

export function clearClaudeKey(): void {
  try {
    fs.unlinkSync(keyFile());
  } catch {
    /* nothing stored */
  }
}
