// Raco AI modifications, 2026-10-21. Preserve upstream license notices.
const { execFileSync } = require('node:child_process');
const {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
} = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { createGzip } = require('node:zlib');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const git = (args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
const privateFile = (file) =>
  file
    .split('/')
    .some(
      (part) =>
        part === '.env' ||
        (part.startsWith('.env.') && !/\.(sample|example)$/.test(part)),
    ) || file.startsWith('.raco-');

const main = async () => {
  const tempRoot = path.join(root, 'tmp');
  mkdirSync(tempRoot, { recursive: true });
  const stage = mkdtempSync(path.join(tempRoot, 'raco-source-'));
  const archive = path.join(stage, 'source.tar');
  const compressed = path.join(stage, 'raco-source.tar.gz');
  const tracked = git(['ls-files', '--cached', '-z']);
  const deleted = git(['ls-files', '--deleted', '-z']);
  const exclusions = [...tracked.filter(privateFile), ...deleted].map(
    (file) => `:(exclude,literal)${file}`,
  );
  execFileSync(
    'git',
    [
      'archive',
      '--format=tar',
      `--output=${archive}`,
      'HEAD',
      '--',
      '.',
      ...exclusions,
    ],
    { cwd: root },
  );

  const changed = [
    ...new Set([
      ...git(['diff', '--name-only', '-z', 'HEAD']),
      ...git(['ls-files', '--others', '--exclude-standard', '-z']),
    ]),
  ]
    .filter((file) => existsSync(path.join(root, file)) && !privateFile(file))
    .filter(
      (file) =>
        (file.includes('/') || /^[A-Za-z0-9_.-]+$/.test(file)) &&
        file !== 'frontend/core-ui/src/assets/raco-source.tar.gz',
    );
  if (changed.length) {
    const list = path.join(stage, 'changes.txt');
    writeFileSync(list, changed.join('\0') + '\0');
    execFileSync('tar', ['-rf', archive, '--null', '-T', list], { cwd: root });
  }
  await pipeline(
    createReadStream(archive),
    createGzip(),
    createWriteStream(compressed),
  );
  renameSync(
    compressed,
    path.join(root, 'frontend/core-ui/src/assets/raco-source.tar.gz'),
  );
  process.stdout.write(
    `Packaged repository source with ${changed.length} local file overlays and upstream license notices.\n`,
  );
};
main().catch(() => {
  process.stderr.write(
    'Source packaging failed; inspect git and tar availability.\n',
  );
  process.exitCode = 1;
});
