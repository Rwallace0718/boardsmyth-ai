import { app, safeStorage, shell } from 'electron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthResult, AuthState } from '../shared/types';
import { loadConfig } from './config';
import { hasClaudeKey } from './keys';

/** Change this date whenever the Terms of Service or Privacy Policy change in a way people must agree to again. */
export const TERMS_VERSION = '2026-10-26';

/**
 * Asks our server to log that this signed-in person accepted the current Terms, with the IP address the server sees.
 * Best effort: it never blocks signing in. `signin_backfill` covers people whose acceptance could not be logged at the time.
 */
async function recordAcceptance(source: 'signup' | 'gate' | 'signin_backfill'): Promise<void> {
  try {
    const cfg = loadConfig();
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${cfg.supabaseUrl}/functions/v1/accept-terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: cfg.supabaseAnonKey },
      body: JSON.stringify({ terms_version: TERMS_VERSION, source }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* try again next time the app starts */
  }
}
let backfillTried = false;

/** Session storage on disk, encrypted with the OS keychain when available. */
function storageFile(): string {
  return path.join(app.getPath('userData'), 'session.bin');
}

const fileStorage = {
  getItem(key: string): string | null {
    try {
      const raw = fs.readFileSync(storageFile());
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
      const obj = JSON.parse(text) as Record<string, string>;
      return obj[key] ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    let obj: Record<string, string> = {};
    try {
      const raw = fs.readFileSync(storageFile());
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
      obj = JSON.parse(text);
    } catch {
      /* fresh file */
    }
    obj[key] = value;
    const text = JSON.stringify(obj);
    fs.writeFileSync(
      storageFile(),
      safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text)
    );
  },
  removeItem(key: string): void {
    try {
      const raw = fs.readFileSync(storageFile());
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
      const obj = JSON.parse(text) as Record<string, string>;
      delete obj[key];
      const out = JSON.stringify(obj);
      fs.writeFileSync(
        storageFile(),
        safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(out) : Buffer.from(out)
      );
    } catch {
      /* nothing stored */
    }
  },
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const cfg = loadConfig();
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    // Electron's Node has no built-in WebSocket; we never use realtime, but the client needs one to construct.
    realtime: { transport: WebSocket as unknown as never },
    auth: {
      storage: fileStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function getState(): Promise<AuthState> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return { signedIn: false };

  const { data: sub } = await sb
    .from('subscriptions')
    .select('status, current_period_end, plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const active =
    !!sub &&
    ['active', 'trialing'].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now());

  const plan: 'hosted' | 'byok' = sub?.plan === 'hosted' ? 'hosted' : 'byok';

  // Monthly usage is stored under the first day of the (UTC) month.
  const monthKey = new Date().toISOString().slice(0, 7) + '-01';
  const { data: usage } = await sb
    .from('usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('day', monthKey)
    .maybeSingle();

  const termsAccepted = user.user_metadata?.terms_version === TERMS_VERSION;
  if (termsAccepted && user.user_metadata?.terms_logged_version !== TERMS_VERSION && !backfillTried) {
    backfillTried = true;
    void recordAcceptance('signin_backfill');
  }

  return {
    signedIn: true,
    email: user.email ?? undefined,
    subscribed: active,
    plan,
    usageMonth: usage?.count ?? 0,
    monthlyLimit: 300,
    hasOwnKey: hasClaudeKey(),
    freeLimit: 5,
    termsAccepted,
  };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, state: await getState() };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  // The sign-up form only lets people through after they tick "I agree"; we keep the version and time with the account.
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: { data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() } },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    return {
      ok: false,
      error: 'Account created. Check your email to confirm it, then sign in.',
    };
  }
  await recordAcceptance('signup');
  return { ok: true, state: await getState() };
}

/** Records that the signed-in person accepted the current Terms and Privacy Policy. */
export async function acceptTerms(): Promise<AuthResult> {
  const { error } = await supabase().auth.updateUser({
    data: { terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
  });
  if (error) return { ok: false, error: error.message };
  await recordAcceptance('gate');
  return { ok: true, state: await getState() };
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

/** Opens the web checkout page with the user id so the Paddle webhook can link the payment. */
export async function openCheckout(): Promise<void> {
  const cfg = loadConfig();
  const { data } = await supabase().auth.getSession();
  const user = data.session?.user;
  const url = new URL(cfg.checkoutUrl);
  if (user) {
    url.searchParams.set('uid', user.id);
    if (user.email) url.searchParams.set('email', user.email);
  }
  await shell.openExternal(url.toString());
}

/** Opens the Paddle-hosted page where the user can cancel or update their payment method. */
export async function openManage(): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { data: sub } = await sb
    .from('subscriptions')
    .select('management_cancel_url')
    .eq('user_id', user.id)
    .maybeSingle();
  const url = sub?.management_cancel_url as string | undefined;
  if (!url || !/^https:\/\//.test(url)) {
    return {
      ok: false,
      error: 'No management link on file yet. Use the cancellation link in your Paddle receipt email, or email support@boardsmythai.com.',
    };
  }
  await shell.openExternal(url);
  return { ok: true };
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
