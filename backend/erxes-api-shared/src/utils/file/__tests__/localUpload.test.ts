import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { uploadLocalFile } from '../localUpload';

describe('shared local export storage', () => {
  let workspace: string;
  let uploadsDirectory: string;
  let filePath: string;
  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(tmpdir(), 'shared-upload-'));
    uploadsDirectory = path.join(workspace, 'uploads');
    await fs.mkdir(uploadsDirectory);
    filePath = path.join(workspace, 'export.csv');
    await fs.writeFile(filePath, 'Name\nবাংলা audit\n');
  });
  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });
  const upload = (subdomain = 'erxes', fileName = 'tickets.csv') =>
    uploadLocalFile({ subdomain, fileName, filePath, uploadsDirectory });

  it('copies exact CSV bytes into a tenant key and preserves the source', async () => {
    const key = await upload();
    expect(key).toMatch(/^erxes\/[a-f0-9-]+-tickets\.csv$/);
    expect(await fs.readFile(path.join(uploadsDirectory, key))).toEqual(
      await fs.readFile(filePath),
    );
    if (process.platform !== 'win32') {
      expect(
        (await fs.stat(path.join(uploadsDirectory, key))).mode & 0o777,
      ).toBe(0o600);
    }
  });
  it('creates distinct keys on repeated exports and isolates tenants', async () => {
    const keys = await Promise.all([upload(), upload(), upload('other')]);
    expect(new Set(keys).size).toBe(3);
    expect(keys[2]).toMatch(/^other\//);
  });
  it('sanitizes destination filenames without allowing path traversal', async () => {
    const key = await upload('erxes', '../../tickets.csv');
    expect(key).not.toContain('..');
    expect(path.dirname(path.join(uploadsDirectory, key))).toBe(
      path.join(uploadsDirectory, 'erxes'),
    );
  });
  it.each(['../other', '', '/root', 'a/b'])(
    'rejects invalid tenant %s',
    async (tenant) => {
      await expect(upload(tenant)).rejects.toThrow(
        'Invalid local storage subdomain',
      );
    },
  );
  it('requires an explicit absolute persistent mount', async () => {
    await expect(
      uploadLocalFile({
        subdomain: 'erxes',
        fileName: 'a.csv',
        filePath,
        uploadsDirectory: 'relative',
      }),
    ).rejects.toThrow('LOCAL_UPLOADS_DIR');
  });
  it('rejects directories as sources', async () => {
    await expect(
      uploadLocalFile({
        subdomain: 'erxes',
        fileName: 'a.csv',
        filePath: workspace,
        uploadsDirectory,
      }),
    ).rejects.toThrow('Unsafe file path');
  });
  it('rejects sources outside the OS temporary directory', async () => {
    await expect(
      uploadLocalFile({
        subdomain: 'erxes',
        fileName: 'a.csv',
        filePath: __filename,
        uploadsDirectory,
      }),
    ).rejects.toThrow('Unsafe file path');
  });
  it('rejects a tenant directory symlink outside the mount', async () => {
    const outside = path.join(workspace, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(uploadsDirectory, 'erxes'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(upload()).rejects.toThrow('Unsafe local storage directory');
    expect(await fs.readdir(outside)).toEqual([]);
  });
});
