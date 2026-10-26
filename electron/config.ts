import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  checkoutUrl: string;
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'app-config.json')
    : path.join(app.getAppPath(), 'app-config.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      'app-config.json not found. Copy app-config.example.json to app-config.json and fill in your Supabase details.'
    );
  }
  cached = JSON.parse(fs.readFileSync(file, 'utf8')) as AppConfig;
  return cached;
}
