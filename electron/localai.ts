import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { LocalAiSettings } from '../shared/types';

/** Settings for using a local Ollama server instead of the hosted AI. Nothing secret is stored here. */
const file = () => path.join(app.getPath('userData'), 'local-ai.json');

const DEFAULTS: LocalAiSettings = { enabled: false, url: 'http://localhost:11434', model: '' };

export function getLocalAi(): LocalAiSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8')) as Partial<LocalAiSettings>;
    return { ...DEFAULTS, ...raw, enabled: raw.enabled === true };
  } catch {
    return { ...DEFAULTS };
  }
}

function cleanUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function setLocalAi(s: LocalAiSettings): { ok: boolean; error?: string } {
  const url = cleanUrl(s.url);
  if (!url) return { ok: false, error: 'That address does not look right. It should look like http://localhost:11434' };
  const model = String(s.model ?? '').trim().slice(0, 100);
  if (s.enabled && !model) return { ok: false, error: 'Pick a model name first (use Test connection to see yours).' };
  fs.writeFileSync(file(), JSON.stringify({ enabled: s.enabled === true, url, model }), 'utf8');
  return { ok: true };
}

/** Lists the models installed in the Ollama server. */
export async function testLocalAi(url: string): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const base = cleanUrl(url);
  if (!base) return { ok: false, models: [], error: 'That address does not look right.' };
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, models: [], error: `The server answered with an error (${res.status}).` };
    const j = (await res.json()) as { models?: { name?: string }[] };
    const models = (j.models ?? []).map((m) => String(m.name ?? '')).filter(Boolean);
    return models.length
      ? { ok: true, models }
      : { ok: false, models: [], error: 'Ollama is running but has no models yet. In a terminal, run: ollama pull qwen2.5-coder:7b' };
  } catch {
    return { ok: false, models: [], error: 'Could not reach Ollama. Is it installed and running? Get it at ollama.com.' };
  }
}
