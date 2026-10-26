import type { GenerateRequest, GenerateResult, StatusEvent } from '../shared/types';
import { loadConfig } from './config';
import { accessToken } from './auth';
import { compile, ensureCore, ensureLibraries } from './arduino';
import { getClaudeKey } from './keys';
import { MODEL, SYSTEM_PROMPT, buildUserMessage, parseReply } from '../shared/sketchPrompt';

const MAX_ATTEMPTS = 4;

interface EdgeResponse {
  code?: string;
  libraries?: string[];
  notes?: string;
  safety?: string;
  error?: string;
  code_name?: string;
}

async function callEdge(body: Record<string, unknown>): Promise<EdgeResponse> {
  const cfg = loadConfig();
  const token = await accessToken();
  if (!token) return { error: 'You are signed out. Please sign in again.', code_name: 'auth' };

  const res = await fetch(`${cfg.supabaseUrl}/functions/v1/generate-sketch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: cfg.supabaseAnonKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000), // give up after 3 minutes instead of hanging forever
  });

  let json: EdgeResponse = {};
  try {
    json = (await res.json()) as EdgeResponse;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok && !json.error) json.error = `Server error (${res.status}).`;
  return json;
}

/** Text, plus any photos (first attempt only), as Claude message content. */
function userContent(body: Record<string, unknown>, text: string): unknown {
  const images = Array.isArray(body.images) ? (body.images as string[]).slice(0, 3) : [];
  if (!images.length || body.compileErrors) return text;
  const blocks: unknown[] = [];
  for (const img of images) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(img);
    if (m) blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  blocks.push({ type: 'text', text });
  return blocks;
}

/** Bring-your-own-key plan: call Claude directly with the user's own key. */
async function callClaudeDirect(body: Record<string, unknown>): Promise<EdgeResponse> {
  const key = getClaudeKey();
  if (!key) return { error: 'Add your Claude API key in Settings first.', code_name: 'nokey' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent(body, buildUserMessage({
            boardName: String(body.boardName ?? ''),
            fqbn: String(body.fqbn ?? ''),
            prompt: String(body.prompt ?? ''),
            currentCode: body.currentCode ? String(body.currentCode) : undefined,
            compileErrors: body.compileErrors ? String(body.compileErrors) : undefined,
          })),
        },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (res.status === 401) return { error: 'Anthropic rejected your API key. Check it in Settings.', code_name: 'nokey' };
  if (res.status === 429) return { error: 'Anthropic says you are sending too many requests or are out of credit. Try again shortly.' };
  if (!res.ok) return { error: `Claude returned an error (${res.status}). Try again in a moment.` };

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  const parsed = parseReply(text);
  if (!parsed.code) return { error: 'The AI did not return a program. Try rephrasing.' };
  return parsed;
}

async function callGenerator(body: Record<string, unknown>): Promise<EdgeResponse> {
  const first = await callEdge(body);
  // Subscribers on the bring-your-own-key plan are told by the server to use their own key.
  if (first.code_name === 'plan') return callClaudeDirect(body);
  return first;
}

/**
 * Generate a sketch, compile it, and feed compiler errors back to the model
 * until it builds (or we run out of attempts).
 */
export async function generateAndVerify(
  req: GenerateRequest,
  emit: (e: StatusEvent) => void
): Promise<GenerateResult> {
  let code = '';
  let notes = '';
  let safety = '';
  let lastErrors = '';

  // Install the board core up front so the first compile is not slow mid-loop.
  const core = await ensureCore(req.fqbn, (stage, message) => emit({ stage, message }));
  if (!core.ok) {
    return { ok: false, code: '', notes: '', attempts: 0, error: core.output };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    emit({
      stage: attempt === 1 ? 'generating' : 'fixing',
      message: attempt === 1 ? 'Writing your program…' : `Fixing compile errors (attempt ${attempt})…`,
    });

    const resp = await callGenerator({
      prompt: req.prompt,
      fqbn: req.fqbn,
      boardName: req.boardName,
      currentCode: attempt === 1 ? req.currentCode : code,
      compileErrors: attempt === 1 ? undefined : lastErrors,
      images: attempt === 1 ? req.images : undefined,
    });

    if (resp.error || !resp.code) {
      emit({ stage: 'error', message: resp.error ?? 'No code was returned.' });
      return {
        ok: false,
        code,
        notes,
        attempts: attempt,
        error: resp.error ?? 'No code was returned.',
      };
    }

    code = resp.code;
    notes = resp.notes ?? notes;
    safety = resp.safety || safety;

    const libs = await ensureLibraries(resp.libraries ?? [], (stage, message) =>
      emit({ stage, message })
    );
    if (!libs.ok) {
      lastErrors = libs.output;
      continue;
    }

    const built = await compile(code, req.fqbn, (stage, message) => emit({ stage, message }));
    if (built.ok) {
      emit({ stage: 'done', message: 'Compiled successfully.' });
      return { ok: true, code, notes, safety, attempts: attempt };
    }
    lastErrors = built.output.slice(-4000);
  }

  emit({ stage: 'error', message: 'Could not get the program to compile.' });
  return {
    ok: false,
    code,
    notes,
    attempts: MAX_ATTEMPTS,
    error: `The program still had errors after ${MAX_ATTEMPTS} attempts:\n${lastErrors}`,
  };
}
