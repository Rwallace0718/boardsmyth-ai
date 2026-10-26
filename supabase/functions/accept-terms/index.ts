// Supabase Edge Function: accept-terms
// Records that the signed-in user accepted a version of the Terms and Privacy Policy, with the caller's IP address.
// Needs a valid user session (JWT verification ON). Table: public.terms_acceptances (service role only).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SOURCES = ['signup', 'gate', 'signin_backfill'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Please sign in again.' }, 401);
  const user = userData.user;

  let body: { terms_version?: unknown; source?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const version = typeof body.terms_version === 'string' ? body.terms_version.trim() : '';
  const source = typeof body.source === 'string' ? body.source : '';
  if (!/^[0-9A-Za-z._-]{1,32}$/.test(version) || !SOURCES.includes(source)) return json({ error: 'Bad request.' }, 400);

  // The caller's IP as seen by the server (the app cannot reliably know its own public address).
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300) || null;

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Keep the FIRST record for this user and version; later calls do not overwrite it.
  const { error: insErr } = await admin
    .from('terms_acceptances')
    .upsert(
      { user_id: user.id, email: user.email ?? null, terms_version: version, source, ip_address: ip, user_agent: userAgent },
      { onConflict: 'user_id,terms_version', ignoreDuplicates: true }
    );
  if (insErr) {
    console.error('terms_acceptances insert failed', insErr.message);
    return json({ error: 'Could not save the record.' }, 500);
  }

  // Mark the account so the app knows this acceptance has been logged.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), terms_logged_version: version },
  });
  return json({ ok: true });
});
