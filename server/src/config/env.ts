import dotenv from 'dotenv';

let envLoaded = false;

export function loadEnv(): void {
  if (envLoaded) {
    return;
  }
  dotenv.config();
  envLoaded = true;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required.`);
  }
  return value;
}
