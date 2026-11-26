import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), '..');

export async function syncCore(rootDir = defaultRoot) {
  const coreSource = resolve(rootDir, 'core/src');
  const coreTarget = resolve(rootDir, 'miniprogram/core');
  const rendererSource = resolve(rootDir, 'web/src/renderer.ts');
  const rendererTarget = resolve(rootDir, 'miniprogram/src/renderer.ts');

  const coreFiles = (await readdir(coreSource, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();

  await mkdir(coreTarget, { recursive: true });
  await mkdir(dirname(rendererTarget), { recursive: true });
  await Promise.all(
    coreFiles.map((name) => copyFile(resolve(coreSource, name), resolve(coreTarget, name))),
  );
  await copyFile(rendererSource, rendererTarget);

  return { coreFiles, renderer: 'renderer.ts' };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await syncCore();
  console.log(`Synced ${result.coreFiles.length} core files and ${result.renderer}.`);
}
