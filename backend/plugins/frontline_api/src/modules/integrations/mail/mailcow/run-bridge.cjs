const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const path = require('node:path');

const required = (name) => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const tenant = required('MAILCOW_SUBDOMAIN');
const childEnv = {};
for (const name of ['PATH', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'LANG',
  'MAILCOW_IMAP_HOST', 'MAILCOW_IMAP_PORT', 'MAILCOW_IMAP_USER',
  'MAILCOW_IMAP_PASSWORD', 'MAILCOW_FOLDER', 'MAILCOW_POLL_SECONDS',
  'MAILCOW_STATE_FILE']) {
  if (process.env[name]) childEnv[name] = process.env[name];
}
childEnv.CRM_MAIL_ADDRESS = required('MAILCOW_ADDRESS');
childEnv.CRM_MAIL_WEBHOOK_URL = required('CRM_MAIL_WEBHOOK_URL');
childEnv.CRM_MAIL_SIGNING_KEY = createHmac('sha256', required('MAIL_WEBHOOK_SECRET'))
  .update(process.env.MAIL_TENANT || tenant).digest('hex');
const child = spawn(process.env.MAILCOW_PYTHON || 'python',
  ['-B', path.join(__dirname, 'bridge.py')],
  { env: childEnv, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Could not start the Mailcow Python runtime'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code || 0; });
process.on('SIGTERM', () => child.kill());
process.on('SIGINT', () => child.kill());
