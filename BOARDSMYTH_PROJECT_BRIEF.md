# BoardSmyth AI: Project Brief

Last updated: Oct 18, 2026. Owner: Code Crafted Nexus LLC.
Use this file as the starting document in a Claude Project. It says what the product is, what is built, what is not, every decision made so far, and exactly what to do next.

## 1. What it is

A Windows and Mac desktop app. The user describes what they want an Arduino-family board to do in plain English. The app writes the program, compiles it, fixes its own compile errors, and uploads it to the board over USB. It includes a code editor and a serial monitor.

- Name: **BoardSmyth AI** (picked from a 20-name shortlist; ArdSoft was rejected, see section 8)
- Domain owned: **boardsmythai.com** (GoDaddy). Still open as of Oct 18: boardsmyth.com, boardsmyth.ai, boardsmyth.app, boardsmyth.io
- Emails (GoDaddy, to be created): **support@boardsmythai.com** (decided) plus one more, hello@ or billing@ (undecided)
- Business model: monthly subscription through Paddle. The Claude API key lives on the server, never in the app.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Idea | AI-generated programs (not a fixed library, not block coding) |
| Stack | Electron + React + TypeScript + Vite + Monaco editor |
| Board toolchain | Bundled `arduino-cli` (handles boards, libraries, compile, upload, serial) |
| AI billing | Option B: Supabase edge function holds the Claude key and checks the user's subscription |
| Payments | Paddle (webhook writes subscription status to Supabase) |
| Auth | Supabase email + password, session stored encrypted with the OS keychain |
| AI model | `claude-sonnet-5-5` (changeable with the `CLAUDE_MODEL` secret) |
| Rate limit | 100 generations per user per day (`DAILY_LIMIT` secret). Auto-fix retries do not count. |
| Auto-fix loop | Up to 4 compile attempts per request, compiler errors fed back to the AI |
| Board coverage | Every board in every configured board index, searchable, with per-board option menus |
| Email provider | Resend for sending from the app (connector available), GoDaddy for mailboxes |

## 3. How it works (flow)

1. User signs in. App checks their subscription row in Supabase.
2. User picks a board (search box over every supported board) or plugs one in and it is detected.
3. App installs that board's core on first use and loads its option menus (Processor, Flash Size, Partition Scheme, and so on).
4. User types a request. App calls the `generate-sketch` edge function with the user's session.
5. Edge function verifies the user, checks the subscription and daily limit, asks Claude, returns code, a library list and wiring notes.
6. App installs the needed libraries (exact names resolved through Library Manager search), compiles, and if compile fails with a missing header it finds and installs that library automatically and retries.
7. If other errors remain, errors go back to Claude for a fix (up to 4 attempts).
8. User clicks Upload. Serial monitor shows output. Follow-up requests ("make it blink slower") edit the existing code.

## 4. Board and library coverage

- Catalog comes from `arduino-cli board search`, so it lists boards even for cores not installed yet. It is cached for 7 days in the app data folder.
- Board indexes configured (in `electron/boards.ts`): official Arduino, Espressif (ESP32 family), ESP8266, Raspberry Pi Pico/RP2040/RP2350 (arduino-pico), STM32, Teensy, MiniCore, MegaCore, MightyCore, MicroCore (bare ATmega/ATtiny chips), Adafruit, SparkFun.
- Popular boards shown first: Uno, Nano, Mega, Leonardo, Micro, Nano Every, Uno R4 WiFi/Minima, Nano 33 IoT, MKR WiFi 1010, Nano 33 BLE, Nano RP2040 Connect, Nano ESP32, Due, Portenta H7, ESP32 variants, ESP8266 NodeMCU, Pico and Pico W, Teensy 4.1.
- Per-board option menus (for example Nano "Old Bootloader", ESP32 partition scheme) come from `arduino-cli board details`. Only options the user changes are added to the board id.
- Upload tips by family (BOOTSEL for Pico, BOOT button for ESP32, double-tap reset for mbed and SAMD boards) show in the UI and are appended to upload errors.
- Libraries: the AI lists libraries, the app resolves exact Library Manager names, installs them, and also installs any library whose header is reported missing at compile time.
- The AI system prompt includes board-family guidance (AVR memory limits, ESP32 GPIO and ledcWrite, Pico GP pins, STM32 pin names, Teensy speed, SAMD/Renesas/mbed WiFi and BLE libraries).

## 5. Project layout

```
boardsmyth/
  package.json, tsconfig.json, tsconfig.node.json, vite.config.ts, index.html
  app-config.example.json        copy to app-config.json (never commit the real one)
  scripts/fetch-arduino-cli.mjs  downloads arduino-cli for this OS
  shared/types.ts                types shared by app and UI (the Api contract)
  electron/
    main.ts                      window and IPC handlers
    preload.ts                   safe bridge to the UI
    arduino.ts                   catalog, board details, cores, libraries, compile, upload, ports, serial
    boards.ts                    board index URLs, popular boards, upload tips
    ai.ts                        generate, compile, auto-fix loop
    auth.ts                      Supabase auth, subscription check, checkout link
    config.ts                    reads app-config.json
  src/
    main.tsx, App.tsx            UI shell, editor, chat, serial monitor
    BoardPicker.tsx, picker.css  searchable board picker
    LoginScreen.tsx, styles.css, global.d.ts
  supabase/
    migrations/001_subscriptions_usage.sql   tables, security rules, atomic usage counter
    functions/generate-sketch/index.ts       auth + subscription + limit + Claude call
    functions/paddle-webhook/index.ts        verifies Paddle signature, upserts subscription
  README.md                      setup guide
```

## 6. Status

Done and verified (typecheck passes for both the UI and the Electron code, UI builds):
- Whole desktop app, arduino-cli service, AI loop, full board catalog, option menus, library auto-install, searchable picker.
- Supabase migration and both edge functions (written, not yet deployed).
- Renamed to BoardSmyth AI, README written.

Not done:
- Never run against a real board or a real Supabase project. Expect small fixes on first real test.
- Supabase project not created, functions not deployed, secrets not set.
- Paddle product, webhook and checkout page not set up.
- `app-config.json` not created. arduino-cli not downloaded (`npm run fetch-cli`).
- Installer not built or tested. Windows code signing and Mac notarization not done.
- Website not built (needs product page, `/subscribe` checkout page that passes `uid` to Paddle, privacy policy, terms).
- Emails not created. Resend domain not verified.
- Trademark search for "BoardSmyth" not done.

## 7. Known limits and risks

- Board detection by USB only suggests a board when its core is already installed. Otherwise the user picks the board by hand.
- RP2040 and STM32 index URLs could not be fetched from the sandbox (blocked), so they are unverified. They are the maintainers' standard URLs. If one is unreachable at runtime, the others still load. ATTinyCore and Seeed indexes were left out on purpose (not verifiable / bad entry).
- First use of each board family downloads its toolchain (can be hundreds of MB for ESP32 and STM32). The UI shows progress.
- Many clone boards need USB driver software on Windows (CH340 or CP210x). Worth a help page.
- AI-written code can compile and still not do what the user meant. The wiring notes and serial output help, but this is not a guarantee.
- Safety: the AI prompt tells it to avoid unsafe hardware setups (for example driving a motor straight from a pin), but users can still wire things wrong. Terms of service should say so.
- Cost: every generation uses Claude tokens. The daily limit protects margins. Pick the subscription price with real usage numbers.

## 8. Naming and trademark rules (important)

- The word **Arduino** is Arduino S.r.l.'s trademark. It must not appear in the product name, company name, domain or logo. It may be used only as a reference, word last: "AI programmer for Arduino", "Compatible with Arduino". Do not use their logo. Add "Arduino® is a trademark of Arduino S.r.l." on the website and store listings.
- ArdSoft was rejected: existing software companies already use it (ArdSoft IT Services, ArdSoft Solutions, ARD SOFT in Poland).
- Domains and web searches were screened for BoardSmyth with no conflict found, but that is not legal clearance. Do a free USPTO search in classes 9 and 42 before launch.
- Runner-up names if needed: Firmsmyth, Wiresmyth, Loopsmyth, Gatesmyth, Circuitling, Solderling.

## 9. Setup steps (in order)

1. GoDaddy: create support@ and one more address on boardsmythai.com. Optionally register boardsmyth.com and boardsmyth.ai.
2. Create a Supabase project. Run the migration. Deploy both functions (`generate-sketch` normally, `paddle-webhook` with `--no-verify-jwt`).
3. Set secrets: `ANTHROPIC_API_KEY`, `PADDLE_WEBHOOK_SECRET` (optional: `DAILY_LIMIT`, `CLAUDE_MODEL`).
4. Paddle: create the subscription product, webhook to the `paddle-webhook` URL for `subscription.*` events, and a checkout page that opens Paddle checkout with `customData: { user_id: <uid from the URL> }`. Without that the webhook cannot link payments to users.
5. Copy `app-config.example.json` to `app-config.json`. Fill in the Supabase URL, the public anon key (never the service role key) and the checkout URL (`https://boardsmythai.com/subscribe`).
6. `npm install`, `npm run fetch-cli`, `npm run dev`. Test with an Uno first, then an ESP32 and a Pico.
7. `npm run dist` for the Windows installer (double-click NSIS install) and the Mac DMG. Sign and notarize.

## 10. Suggested next work, in priority order

1. Deploy Supabase and run one full generate, compile, upload test on a real Uno.
2. Test an ESP32, a Pico and a Nano with the old bootloader. Fix what breaks.
3. Build the website and `/subscribe` checkout page, wire Paddle.
4. Set up emails and Resend, add support link and welcome email.
5. Installer, code signing, notarization, and a first-run welcome that explains driver install.
6. Add: save and open sketches, recent projects, a "explain this code" button, library manager browser, and a wiring diagram helper.
7. Privacy policy, terms of service, refund policy, safety disclaimer.

## 11. Prompt to paste at the start of the Project

> This is BoardSmyth AI, a Windows and Mac desktop app (Electron, React, TypeScript, Vite) that uses AI to write, compile and upload programs for Arduino-family boards. Read BOARDSMYTH_PROJECT_BRIEF.md first, then the code in the attached folder. The code typechecks but has never been run against real hardware or a real Supabase project. Start with section 10, step 1. Keep my preferences: complete file rewrites rather than partial edits, and anything delivered to me should work without running terminal commands where possible. Do not put the word Arduino in the product name, domain or logo.
