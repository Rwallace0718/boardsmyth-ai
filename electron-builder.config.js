"use strict";
// Windows signing (Azure Artifact Signing, account ccn-signing / profile ccn-public) turns on
// automatically when the three Azure variables are set in the shell that runs the build.
// "npm run dist" refuses to build without them; "npm run dist:unsigned" is for quick test builds only.
const signing = !!(
  process.env.AZURE_TENANT_ID &&
  process.env.AZURE_CLIENT_ID &&
  process.env.AZURE_CLIENT_SECRET
);

module.exports = {
  appId: "com.codecraftednexus.boardsmyth",
  productName: "BoardSmyth AI",
  copyright: "Copyright © 2026 Code Crafted Nexus LLC",
  directories: { output: "release" },
  files: ["dist/**", "dist-electron/**", "package.json"],
  extraResources: [
    { from: "resources/arduino-cli", to: "arduino-cli" },
    { from: "app-config.json", to: "app-config.json" }
  ],
  win: Object.assign(
    {
      target: [{ target: "nsis", arch: ["x64"] }],
      icon: "resources/icon.ico",
      artifactName: "BoardSmyth-AI-Setup.${ext}"
    },
    signing
      ? {
          azureSignOptions: {
            publisherName: "Code Crafted Nexus LLC",
            endpoint: "https://eus.codesigning.azure.net",
            codeSigningAccountName: "ccn-signing",
            certificateProfileName: "ccn-public"
          }
        }
      : {}
  ),
  // No upload happens ("--publish never"); this just gives electron-builder a provider so it can write update info without erroring.
  publish: [{ provider: "generic", url: "https://boardsmythai.com/updates" }],
  nsis: { oneClick: true, perMachine: false, shortcutName: "BoardSmyth AI" },
  // Mac: build on a Mac with "npm run dist:mac". It signs automatically when a "Developer ID Application"
  // certificate is in the login Keychain, and notarizes when APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and
  // APPLE_TEAM_ID are set in the shell. Build once on each kind of Mac (Apple Silicon and Intel), because
  // the bundled arduino-cli is built for one chip type at a time.
  mac: {
    target: ["dmg"],
    icon: "resources/icon.icns",
    category: "public.app-category.developer-tools",
    artifactName: "BoardSmyth-AI-${arch}.${ext}",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)
  }
};
