'use strict';
/**
 * PM2 process definition for ALPHA DESIGN ERP.
 *
 * Paths are resolved relative to this file, so the config is portable: it works
 * whether the repo lives at /opt/alpha-erp on the server or somewhere else on a
 * dev machine — no need to edit absolute paths per environment.
 *
 * The app is started via ../passenger.js, which loads .env.production.local from
 * the project root before importing backend/server.mjs. Keep all secrets in that
 * env file (git-ignored); this config holds only non-secret runtime settings.
 *
 * Usage (from anywhere):
 *   pm2 start pm2/ecosystem.config.cjs
 *   pm2 restart alpha-erp
 */
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const logsDir = path.join(__dirname, 'logs');

module.exports = {
  apps: [
    {
      name: 'alpha-erp',
      script: path.join(projectRoot, 'passenger.js'),
      cwd: projectRoot,
      instances: 1,            // server holds in-process state → single instance
      exec_mode: 'fork',       // NOT cluster mode
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',     // nginx is the public listener; keep Node on loopback
        PORT: '8787',
      },
      out_file: path.join(logsDir, 'out.log'),
      error_file: path.join(logsDir, 'error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
