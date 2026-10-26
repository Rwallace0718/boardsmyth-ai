// Prompt and reply parsing shared by the app (bring-your-own-key plan).
// IMPORTANT: keep SYSTEM_PROMPT identical to the copy in supabase/functions/generate-sketch/index.ts.
import type { WiringRow } from './types';

export const MODEL = 'claude-sonnet-5-5';

export const SYSTEM_PROMPT = `You are an expert embedded developer who writes Arduino sketches for non-expert users.

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

function extractBlock(text: string, lang: string): string {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'i');
  return (text.match(re)?.[1] ?? '').trim();
}

export function buildUserMessage(opts: {
  boardName: string;
  fqbn: string;
  prompt: string;
  currentCode?: string;
  compileErrors?: string;
}): string {
  let msg = `Board: ${opts.boardName} (${opts.fqbn})\n\nRequest: ${opts.prompt.slice(0, 4000)}`;
  if (opts.currentCode)
    msg += `\n\nExisting sketch:\n\`\`\`cpp\n${opts.currentCode.slice(0, 30000)}\n\`\`\``;
  if (opts.compileErrors)
    msg += `\n\nThe sketch above failed to compile with these errors. Fix them:\n${opts.compileErrors.slice(0, 6000)}`;
  return msg;
}

const KINDS = ['led', 'resistor', 'button', 'sensor', 'servo', 'motor', 'buzzer', 'display', 'other'];

/** Reads the AI's wiring block. Anything malformed is dropped rather than shown. */
export function parseWiring(raw: string): WiringRow[] {
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

export function parseReply(text: string): { code: string; libraries: string[]; notes: string; safety: string; wiring: WiringRow[] } {
  const rawSafety = extractBlock(text, 'safety');
  return {
    safety: /^none\.?$/i.test(rawSafety) ? '' : rawSafety,
    code: extractBlock(text, 'cpp'),
    libraries: extractBlock(text, 'libraries')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10),
    notes: extractBlock(text, 'notes'),
    wiring: parseWiring(extractBlock(text, 'wiring')),
  };
}
