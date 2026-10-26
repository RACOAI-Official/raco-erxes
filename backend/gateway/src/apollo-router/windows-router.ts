import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import fetch from 'node-fetch';

export const verifyRouterChecksum = (
  archive: Buffer,
  checksums: string,
  filename: string,
): void => {
  const expected = checksums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name?.replace(/^\*/, '') === filename)?.[0];
  const actual = createHash('sha256').update(archive).digest('hex');

  if (!expected || expected.toLowerCase() !== actual) {
    throw new Error('Apollo Router archive checksum verification failed');
  }
};

export const downloadWindowsRouter = async (
  version: string,
  directory: string,
  destination: string,
): Promise<void> => {
  if (process.arch !== 'x64') {
    throw new Error('The Windows Apollo Router binary requires x64 Node.js');
  }

  const filename = `router-${version}-x86_64-pc-windows-msvc.tar.gz`;
  const releaseUrl = `https://github.com/apollographql/router/releases/download/${version}`;
  const [archiveResponse, checksumResponse] = await Promise.all([
    fetch(`${releaseUrl}/${filename}`, { timeout: 120_000 }),
    fetch(`${releaseUrl}/sha256sums.txt`, { timeout: 30_000 }),
  ]);

  if (!archiveResponse.ok || !checksumResponse.ok) {
    throw new Error(
      'Could not download the official Windows Apollo Router release',
    );
  }

  const archive = await archiveResponse.buffer();
  verifyRouterChecksum(archive, await checksumResponse.text(), filename);

  const archivePath = path.join(directory, filename);
  writeFileSync(archivePath, archive);
  execFileSync('tar.exe', ['-xzf', archivePath, '-C', directory]);

  const extractedBinary = path.join(directory, 'dist', 'router.exe');
  if (!existsSync(extractedBinary)) {
    throw new Error(
      'The Apollo Router release did not contain dist/router.exe',
    );
  }
  copyFileSync(extractedBinary, destination);
};
