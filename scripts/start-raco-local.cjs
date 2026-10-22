// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const enabledNames = (value = '') =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
const plugins = [
  ...new Set([
    ...enabledNames(process.env.ENABLED_PLUGINS),
    ...enabledNames(process.env.ENABLED_PLUGINS_ONLY_API),
  ]),
];
const services = enabledNames(process.env.ENABLED_SERVICES);
if (
  [...plugins, ...services].some(
    (name) => !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name),
  )
) {
  throw new Error('Invalid enabled plugin or service name');
}
const directories = [
  'backend/core-api',
  ...plugins.map((name) => `backend/plugins/${name}_api`),
  ...services.map((name) => `backend/services/${name}`),
  'backend/gateway',
];
for (const directory of directories) {
  if (!existsSync(path.join(root, directory, 'dist/src/main.js'))) {
    throw new Error(`Build ${directory} before running pnpm start:raco`);
  }
}

let stopping = false;
const children = [];
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
};
for (const directory of directories) {
  const child = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: path.join(root, directory),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push(child);
  child.on('error', () => {
    process.stderr.write(`Could not start ${directory}.\n`);
    process.exitCode = 1;
    stop();
  });
  child.on('exit', (code) => {
    if (!stopping) {
      process.stderr.write(
        `${directory} exited; stopping the local backend.\n`,
      );
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
