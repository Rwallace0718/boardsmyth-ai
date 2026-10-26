// Stops "npm run dist" if the Azure signing variables are missing, so an unsigned installer is never shipped by accident.
const need = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
const missing = need.filter((n) => !process.env[n]);
if (missing.length) {
  console.error('\nSIGNING NOT SET UP: missing ' + missing.join(', '));
  console.error('Set them in this PowerShell window first, for example:');
  console.error('  $env:AZURE_TENANT_ID="..."; $env:AZURE_CLIENT_ID="..."; $env:AZURE_CLIENT_SECRET="..."');
  console.error('For a quick unsigned test build only, run:  npm run dist:unsigned\n');
  process.exit(1);
}
console.log('Azure signing variables found. The installer will be signed.');
