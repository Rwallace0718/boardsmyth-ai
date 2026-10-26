// Supabase Edge Function: paddle-webhook
// Deploy with --no-verify-jwt (Paddle calls it, not a signed-in user).
// Secrets required: PADDLE_WEBHOOK_SECRET.
// The checkout page must pass custom_data: { user_id: "<supabase user id>" } when opening Paddle checkout.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  // Reject events older than 5 minutes to prevent replays
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const expected = await hmacHex(Deno.env.get('PADDLE_WEBHOOK_SECRET')!, `${ts}:${rawBody}`);
  return timingSafeEqual(expected, h1);
}

const HANDLED = new Set([
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.resumed',
  'subscription.paused',
  'subscription.canceled',
  'subscription.past_due',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  const valid = await verifySignature(rawBody, req.headers.get('Paddle-Signature'));
  if (!valid) return new Response('Invalid signature', { status: 401 });

  const event = JSON.parse(rawBody);
  if (!HANDLED.has(event.event_type)) return new Response('ignored', { status: 200 });

  const data = event.data ?? {};
  const userId: string | undefined = data.custom_data?.user_id;
  if (!userId) {
    console.error('Subscription event without custom_data.user_id', data.id);
    return new Response('missing user_id', { status: 200 }); // 200 so Paddle does not retry forever
  }

  // Plan comes from the price's internal description ('hosted' or 'byok'). Unknown -> 'byok' (never grants our key).
  const priceLabel = String(data.items?.[0]?.price?.description ?? '').trim().toLowerCase();
  const plan = priceLabel === 'hosted' ? 'hosted' : 'byok';

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customer_id,
      plan,
      status: data.status, // active | trialing | past_due | paused | canceled
      current_period_end: data.current_billing_period?.ends_at ?? null,
      management_cancel_url: data.management_urls?.cancel ?? null,
      management_update_url: data.management_urls?.update_payment_method ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Upsert failed', error);
    return new Response('db error', { status: 500 }); // Paddle will retry
  }
  return new Response('ok', { status: 200 });
});
