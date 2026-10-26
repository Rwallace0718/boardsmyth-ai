// Supabase Edge Function: photo-relay
// Passes photos from a phone to the desktop app. The phone page (boardsmythai.com/snap.html) POSTs a photo
// under a random session id shown as a QR code in the app; the app polls with GET and takes the photos.
// The session id is a long random secret, photos are deleted when taken, and stale ones are purged.
// Deploy with JWT verification OFF (the phone has no login).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SESSION_RE = /^[A-Za-z0-9-]{24,64}$/;
const IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 1_800_000;
const MAX_PER_SESSION = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Purge anything older than an hour.
  await admin.from('photo_inbox').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString());

  if (req.method === 'POST') {
    let body: { session?: string; image?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }
    const session = String(body.session ?? '');
    const image = String(body.image ?? '');
    if (!SESSION_RE.test(session)) return json({ error: 'Bad session.' }, 400);
    if (!IMAGE_RE.test(image) || image.length > MAX_IMAGE_CHARS) return json({ error: 'Photo too large or not an image.' }, 400);

    const { count } = await admin.from('photo_inbox').select('id', { count: 'exact', head: true }).eq('session', session);
    if ((count ?? 0) >= MAX_PER_SESSION) return json({ error: 'Too many photos waiting. Wait for the app to pick them up.' }, 429);

    const { error } = await admin.from('photo_inbox').insert({ session, image });
    if (error) return json({ error: 'Could not store the photo.' }, 500);
    return json({ ok: true });
  }

  if (req.method === 'GET') {
    const session = new URL(req.url).searchParams.get('session') ?? '';
    if (!SESSION_RE.test(session)) return json({ error: 'Bad session.' }, 400);
    const { data } = await admin
      .from('photo_inbox')
      .select('id, image')
      .eq('session', session)
      .order('created_at', { ascending: true })
      .limit(MAX_PER_SESSION);
    const rows = data ?? [];
    if (rows.length) await admin.from('photo_inbox').delete().in('id', rows.map((r) => r.id));
    return json({ images: rows.map((r) => r.image) });
  }

  return json({ error: 'Method not allowed.' }, 405);
});
