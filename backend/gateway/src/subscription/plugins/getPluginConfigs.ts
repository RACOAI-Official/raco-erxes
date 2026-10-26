// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import * as path from 'path';
import * as fs from 'fs';

import downloadPlugins from './downloadPlugins';

function getFilesFullPaths(
  dir: string,
  pred: (filename: string) => boolean,
): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .map((fileName) => {
      if (!pred(fileName)) {
        return '';
      }

      const fullName = path.join(dir, fileName);
      const stat = fs.lstatSync(fullName);

      if (stat.isDirectory()) {
        return '';
      }

      return fullName;
    })
    .filter((x) => x);
}

export async function getPluginConfigs(): Promise<unknown[]> {
  await downloadPlugins();
  const directory = path.join(__dirname, '/downloads');
  const files = getFilesFullPaths(directory, (name) => /\.(t|j)s$/.test(name));
  // Subscription bundles are synchronous modules. Node 22 can require both
  // CommonJS and ESM bundles by filesystem path, including Windows drive paths.
  return files.map((file): unknown => require(file));
}
