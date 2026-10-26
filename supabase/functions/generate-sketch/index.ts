// Supabase Edge Function: generate-sketch
// Verifies the caller's session and subscription, rate limits, then asks Claude for an Arduino sketch.
// Secrets required: ANTHROPIC_API_KEY (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are built in).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5';
const MONTHLY_LIMIT = Number(Deno.env.get('MONTHLY_LIMIT') ?? '300');
const FREE_LIMIT = Number(Deno.env.get('FREE_LIMIT') ?? '5');
const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 2_000_000;
const MAX_CODE_CHARS = 30000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SYSTEM_PROMPT = `You are an expert embedded developer who writes Arduino sketches for non-expert users.

Rules:
- Write a complete, compilable sketch for the exact board given. Respect that board's real pin names, voltage, memory and capabilities.
- Match the board family. AVR boards (Uno, Nano, Mega, Leonardo, ATmega/ATtiny) have little RAM: no Serial.printf, use snprintf and F() for strings. ESP32/ESP8266 use GPIO numbers, built-in WiFi.h/ESP8266WiFi.h, and ledcWrite on ESP32 for PWM. Raspberry Pi Pico uses GP pin numbers and LED_BUILTIN; Pico W needs the WiFi library for its LED. STM32 uses names like PA5. Teensy runs much faster and its Serial is USB at full speed. SAMD, Renesas (Uno R4) and mbed boards support analogWriteResolution and use their own WiFi/BLE libraries (WiFiNINA, WiFiS3, ArduinoBLE). Only use hardware and libraries that exist on the chosen board.
- Use setup() and loop(). Never use delay() when the user needs responsiveness; prefer millis() timing for anything with buttons or multiple tasks.
- Prefer built-in libraries. Only list an external library when it is genuinely needed, using its exact Arduino Library Manager name.
- Add a short comment above each pin definition saying what to wire there. Use Serial output (9600 baud unless there is a reason otherwise) to report what the program is doing.
- If the user's request is unsafe for hardware (for example driving a motor directly from a pin), write the safe version and mention the needed part in the notes.
- If existing code and a change request are given, modify the existing code and keep everything the user did not ask to change.
- If compiler errors are given, fix them. Do not change the program's behaviour.
- If photos are attached, they show the user's real board, breadboard or parts. Use them to work out what is connected to which pin and write code that matches the actual wiring. If a wire, part or voltage in the photo looks wrong, missing or unsafe, say so in the safety block.
- Always include a wiring block: a JSON array with one object per physical connection the user must make, in the order they should wire them. Each object has "pin" (the board pin, e.g. "D13", "GPIO4", "GND", "5V"), "part" (what it connects to, e.g. "Red LED anode"), "to" (the full wire path in plain words, including any resistor, e.g. "through a 220 ohm resistor to the LED's long leg; short leg to GND") plus "group" (a short label for the physical part this wire belongs to, e.g. "LED1", "Button", "Servo"; every wire to the same part uses the same group), "kind" (one of: led, resistor, button, sensor, servo, motor, buzzer, display, other) and optionally "note". Use an empty array [] only if nothing needs wiring.
- Always check the hardware for risks: LEDs without resistors, motors, relays or servos powered or driven straight from a pin, 5V signals into 3.3V boards, shorted pins, too many LEDs for the supply, or pins that are not safe to use on this board. List each real risk in the safety block, one per line, with the fix.

Reply in exactly this format and nothing else:

\`\`\`cpp
<the full sketch>
\`\`\`

\`\`\`libraries
<one library name per line, or leave empty>
\`\`\`

\`\`\`notes
<2-5 short plain-English lines: wiring and anything the user should know>
\`\`\`

\`\`\`wiring
<JSON array of connections as described above>
\`\`\`

\`\`\`safety
<one hardware risk and its fix per line, or the single word none>
\`\`\``;

const KINDS = ['led', 'resistor', 'button', 'sensor', 'servo', 'motor', 'buzzer', 'display', 'other'];

function parseWiring(raw: string) {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    return data
      .slice(0, 40)
      .map((r) => ({ pin: clip(r?.pin, 24), part: clip(r?.part, 80), to: clip(r?.to, 240), note: clip(r?.note, 160) || undefined, group: clip(r?.group, 24) || undefined, kind: KINDS.includes(clip(r?.kind, 12)) ? clip(r?.kind, 12) : 'other' }))
      .filter((r) => r.pin && (r.part || r.to));
  } catch {
    return [];
  }
}

function extractBlock(text: string, lang: string): string {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'i');
  return (text.match(re)?.[1] ?? '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // 1. Who is calling?
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Please sign in again.', code_name: 'auth' }, 401);
  const user = userData.user;

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 2. Do they have an active subscription?
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status, current_period_end, plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const active =
    !!sub &&
    ['active', 'trialing'].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now());

  // Bring-your-own-key subscribers call Claude directly from the app; they must not use our key.
  if (active && sub?.plan !== 'hosted') {
    return json({ error: 'Your plan uses your own Claude API key. Add it in Settings.', code_name: 'plan' }, 403);
  }

  // Everyone else is on the free plan: a few hosted generations a month.
  const limit = active ? MONTHLY_LIMIT : FREE_LIMIT;

  // 3. Validate input
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const prompt = String(body.prompt ?? '').slice(0, MAX_PROMPT_CHARS);
  const fqbn = String(body.fqbn ?? '').slice(0, 100);
  const boardName = String(body.boardName ?? '').slice(0, 100);
  const currentCode = body.currentCode ? String(body.currentCode).slice(0, MAX_CODE_CHARS) : '';
  const compileErrors = body.compileErrors ? String(body.compileErrors).slice(0, 6000) : '';
  if (!prompt.trim() || !fqbn) return json({ error: 'Describe what you want the board to do.' }, 400);

  const images: { media: string; data: string }[] = [];
  if (Array.isArray(body.images)) {
    for (const raw of body.images.slice(0, MAX_IMAGES)) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(raw));
      if (!m || m[2].length > MAX_IMAGE_CHARS) return json({ error: 'A photo was too large or not a supported image.' }, 400);
      images.push({ media: m[1], data: m[2] });
    }
  }

  // 4. Monthly cap (only count the first attempt of a request; auto-fix retries are free)
  if (!compileErrors) {
    const { data: allowed, error: usageErr } = await admin.rpc('increment_usage_monthly', {
      p_user: user.id,
      p_limit: limit,
    });
    if (usageErr) return json({ error: 'Could not check usage. Try again.' }, 500);
    if (!allowed) {
      return active
        ? json({ error: `Monthly limit of ${MONTHLY_LIMIT} generations reached. It resets on the 1st.` }, 429)
        : json({ error: `You have used your ${FREE_LIMIT} free generations this month. Subscribe to keep going.`, code_name: 'free_limit' }, 402);
    }
  }

  // 5. Ask Claude
  let userMessage = `Board: ${boardName} (${fqbn})\n\nRequest: ${prompt}`;
  if (currentCode) userMessage += `\n\nExisting sketch:\n\`\`\`cpp\n${currentCode}\n\`\`\``;
  if (compileErrors) userMessage += `\n\nThe sketch above failed to compile with these errors. Fix them:\n${compileErrors}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: images.length && !compileErrors
            ? [
                ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.media, data: i.data } })),
                { type: 'text', text: userMessage },
              ]
            : userMessage,
        },
      ],
    }),
  });

  if (!apiRes.ok) {
    console.error('Anthropic error', apiRes.status, await apiRes.text());
    return json({ error: 'The AI service is busy. Please try again in a moment.' }, 502);
  }

  const result = await apiRes.json();
  const text: string = (result.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');

  const code = extractBlock(text, 'cpp');
  if (!code) return json({ error: 'The AI did not return a program. Try rephrasing.' }, 502);

  const libraries = extractBlock(text, 'libraries')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);

  const rawSafety = extractBlock(text, 'safety');
  const safety = /^none\.?$/i.test(rawSafety) ? '' : rawSafety;
  return json({ code, libraries, notes: extractBlock(text, 'notes'), safety, wiring: parseWiring(extractBlock(text, 'wiring')) });
});
