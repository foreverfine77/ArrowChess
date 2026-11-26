// Build both the local-file entry and a self-contained static hosting directory.
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/web');
const result = await build({
  entryPoints: [resolve(root, 'web/src/main.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2015'],
  legalComments: 'none',
  loader: { '.ttf': 'dataurl' },
  write: false,
});
const sourceHtml = await readFile(resolve(root, 'web/index.html'), 'utf8');
const loaders = sourceHtml.match(/<script>[\s\S]*?<\/script>/g) || [];
if (loaders.length !== 1 || !loaders[0].includes('./src/main.ts')) {
  throw new Error('Expected one development loader in web/index.html');
}
const html = sourceHtml.replace(loaders[0], '<script src="./game.js"></script>');
await mkdir(output, { recursive: true });
const bundle = result.outputFiles[0].contents;
await writeFile(resolve(root, 'web/game.js'), bundle);
await writeFile(resolve(output, 'game.js'), bundle);
await writeFile(resolve(output, 'index.html'), html);
await copyFile(resolve(root, 'web/icon.png'), resolve(output, 'icon.png'));
await copyFile(resolve(root, 'web/brush-OFL.txt'), resolve(output, 'brush-OFL.txt'));
await copyFile(resolve(root, 'web/ming-OFL.txt'), resolve(output, 'ming-OFL.txt'));
console.log('[build:web] Updated web/game.js and dist/web.');
