'use strict';
/**
 * Startup file tương thích cPanel/Plesk Passenger.
 * Ưu tiên biến môi trường do control panel cung cấp; nếu thiếu, nạp
 * .env.production.local từ Application Root. File secret phải nằm ngoài public/.
 */
const fs = require('node:fs');
const path = require('node:path');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [match[1], value.replace(/\\n/g, '\n')];
}

const envFile = path.join(__dirname, '.env.production.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const pair = parseEnvLine(line);
    if (pair && process.env[pair[0]] === undefined) process.env[pair[0]] = pair[1];
  }
}

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
if (!process.env.ALPHA_ENV) process.env.ALPHA_ENV = 'production';
if (!process.env.DATA_MODE) process.env.DATA_MODE = 'server-authoritative';
if (!process.env.HOST) process.env.HOST = '0.0.0.0';

import('./backend/server.mjs').catch((error) => {
  console.error('ALPHA ERP startup failed:', error?.message || error);
  process.exitCode = 1;
});
