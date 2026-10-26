# BoardSmyth AI

AI programmer for Arduino. Describe what you want your board to do. BoardSmyth writes the sketch, compiles it, fixes its own compile errors, and uploads it.

Windows and Mac desktop app. Electron + React + TypeScript + Vite, with a bundled `arduino-cli` and a Supabase backend that holds the Claude API key and checks subscriptions (Paddle).

> Naming note: the Arduino name may only appear as a reference ("for Arduino", word last). Never put it in the product name, company name, domain or logo. Include "Arduino® is a trademark of Arduino S.r.l." wherever you mention it on your website or store listings.

## How it works

1. The user picks a board (or it is detected over USB) and types a request.
2. The app calls the `generate-sketch` Supabase edge function with the user's session.
3. The function checks the subscription and daily limit, then asks Claude for the sketch.
4. The app installs any needed board core and libraries, compiles with `arduino-cli`, and sends compiler errors back for up to 4 attempts.
5. One click uploads to the board. A serial monitor shows its output.

## One-time setup

### 1. Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_subscriptions_usage.sql` in the SQL editor.
3. Deploy the functions:
   ```
   supabase functions deploy generate-sketch
   supabase functions deploy paddle-webhook --no-verify-jwt
   ```
4. Set secrets:
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
   ```
   Optional: `DAILY_LIMIT` (default 100) and `CLAUDE_MODEL` (default `claude-sonnet-5-5`).

### 2. Paddle

- Create a subscription product and price.
- Add a webhook destination pointing at `https://YOUR-PROJECT.supabase.co/functions/v1/paddle-webhook` with the `subscription.*` events.
- On your website checkout page, read `uid` from the URL (the app appends it) and open Paddle checkout with `customData: { user_id: uid }`. Without this the webhook cannot link a payment to an account.

### 3. App config

```
cp app-config.example.json app-config.json
```

Fill in `supabaseUrl`, `supabaseAnonKey` (the public anon key, never the service role key) and `checkoutUrl`.

## Develop

```
npm install
npm run fetch-cli     # downloads arduino-cli for this OS
npm run dev
```

## Build installers

```
npm run dist
```

Output goes to `release/`. Windows produces a double-click NSIS installer. Mac produces a DMG. Sign the Windows build with your Azure Artifact Signing setup and notarize the Mac build before distributing.

## First run behavior

The first compile for each board family downloads its toolchain (a few hundred MB for ESP32). The app shows progress while this happens and caches it afterwards.

## Project layout

- `electron/` main process: arduino-cli wrapper, auth, AI loop, IPC
- `src/` React UI (Monaco editor, chat panel, serial monitor)
- `shared/types.ts` types shared by both sides
- `supabase/` migration and edge functions
- `scripts/fetch-arduino-cli.mjs` downloads the CLI binary

## Releases (GitHub builds, Supabase stores)

Installers are built by the **Release** workflow (`.github/workflows/release.yml`) and uploaded to the public
Supabase Storage bucket `releases` in the `boardsmyth-ai` project:

| Platform | Files | Build job |
| --- | --- | --- |
| Windows | `win/BoardSmyth-AI-Setup.exe`, `win/BoardSmyth-AI-Setup-<version>.exe`, `win/version.json` | `windows` (Azure Artifact Signing) |
| Mac (Apple Silicon) | `mac/BoardSmyth-AI-arm64.dmg`, `mac/BoardSmyth-AI-arm64-<version>.dmg`, `mac/version.json` | `mac` (Developer ID + notarization) |

To release: bump `version` in `package.json`, commit, then GitHub > Actions > Release > Run workflow (add a one-line note).
The app's "Check for updates" reads `releases/<win|mac>/version.json`; the website download buttons point at the fixed-name files.

Repository secrets needed: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CHECKOUT_URL`,
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`,
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
