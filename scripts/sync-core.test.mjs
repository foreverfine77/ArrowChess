import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

test('syncCore copies core TypeScript files and the shared renderer', async (t) => {
  const scriptPath = resolve('scripts/sync-core.mjs');
  assert.equal(existsSync(scriptPath), true, 'scripts/sync-core.mjs must exist');

  const rootDir = await mkdtemp(resolve(tmpdir(), 'arrow-chess-sync-'));
  t.after(async () => rm(rootDir, { recursive: true, force: true }));

  await mkdir(resolve(rootDir, 'core/src'), { recursive: true });
  await mkdir(resolve(rootDir, 'web/src'), { recursive: true });
  await writeFile(resolve(rootDir, 'core/src/index.ts'), 'export const marker = 1;\n');
  await writeFile(resolve(rootDir, 'core/src/types.ts'), 'export type Marker = number;\n');
  await writeFile(resolve(rootDir, 'core/src/ignored.js'), 'export const ignored = true;\n');
  await writeFile(resolve(rootDir, 'web/src/renderer.ts'), 'export const renderer = true;\n');

  const moduleUrl = `${pathToFileURL(scriptPath).href}?test=${Date.now()}`;
  const { syncCore } = await import(moduleUrl);
  const result = await syncCore(rootDir);

  assert.deepEqual(result.coreFiles, ['index.ts', 'types.ts']);
  assert.equal(
    await readFile(resolve(rootDir, 'miniprogram/core/index.ts'), 'utf8'),
    'export const marker = 1;\n',
  );
  assert.equal(existsSync(resolve(rootDir, 'miniprogram/core/ignored.js')), false);
  assert.equal(
    await readFile(resolve(rootDir, 'miniprogram/src/renderer.ts'), 'utf8'),
    'export const renderer = true;\n',
  );
});
