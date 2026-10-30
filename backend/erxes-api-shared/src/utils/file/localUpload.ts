import { randomUUID } from 'crypto';
import { constants, promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { sanitizeFilename } from '../sanitize';

const isWithin = (root: string, target: string) =>
  target.startsWith(`${root}${path.sep}`);

/** Store generated files in the same persistent mount used by Core's reader. */
export const uploadLocalFile = async ({
  subdomain,
  filePath,
  fileName,
  uploadsDirectory = process.env.LOCAL_UPLOADS_DIR,
}: {
  subdomain: string;
  filePath: string;
  fileName: string;
  uploadsDirectory?: string;
}): Promise<string> => {
  if (!uploadsDirectory || !path.isAbsolute(uploadsDirectory)) {
    throw new Error(
      'LOCAL_UPLOADS_DIR must be an absolute shared storage path',
    );
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(subdomain)) {
    throw new Error('Invalid local storage subdomain');
  }
  const safeName = sanitizeFilename(fileName)
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 180);
  if (!safeName) throw new Error('Invalid local storage filename');

  // Resolve symlinks before checking the boundary, including the /tmp prefix.
  const source = await fs.realpath(filePath);
  const temporaryRoot = await fs.realpath(tmpdir());
  if (!isWithin(temporaryRoot, source) || !(await fs.stat(source)).isFile()) {
    throw new Error('Unsafe file path');
  }

  const storageRoot = await fs.realpath(uploadsDirectory);
  const tenantPath = path.join(storageRoot, subdomain);
  await fs.mkdir(tenantPath, { recursive: true, mode: 0o700 });
  const resolvedTenant = await fs.realpath(tenantPath);
  if (resolvedTenant !== tenantPath || !isWithin(storageRoot, resolvedTenant)) {
    throw new Error('Unsafe local storage directory');
  }

  const key = `${subdomain}/${randomUUID()}-${safeName}`;
  const destination = path.join(storageRoot, key);
  // Exclusive copy cannot overwrite an existing file or follow a target symlink.
  await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
  await fs.chmod(destination, 0o600);
  // Always return a key, so authenticated Core delivery remains authoritative.
  return key;
};
