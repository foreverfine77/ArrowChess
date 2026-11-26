/**
 * 小游戏构建入口：把 miniprogram/game.ts 与其依赖（core + 共享 renderer）
 * 打包为开发者工具可直接加载的 miniprogram/game.js。
 * 见工单 01：纯内核与共享 renderer 单一来源，仅构建。
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncCore } from './sync-core.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(scriptPath), '..');

const entry = resolve(rootDir, 'miniprogram/game.ts');
const outfile = resolve(rootDir, 'miniprogram/minigame/game.js');

if (!existsSync(entry)) {
  console.error(`[build:minigame] missing entry ${entry}`);
  process.exit(1);
}

await syncCore(rootDir);
// Each uploaded function is self-contained; compile the exact same rule source.
await build({
  entryPoints: [resolve(rootDir, 'miniprogram/online-rules.ts')],
  outfile: resolve(rootDir, 'miniprogram/cloudfunctions/makeMove/rules.cjs'),
  bundle: true, format: 'cjs', platform: 'node', target: ['node12'], legalComments: 'none',
});

const result = await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  target: ['es2015'],
  platform: 'browser',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

if (result.warnings.length) {
  console.warn(`[build:minigame] ${result.warnings.length} warning(s)`);
}
console.log(`[build:minigame] wrote ${outfile}`);
