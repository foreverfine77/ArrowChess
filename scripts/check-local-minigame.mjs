import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const commands = {
  build: ['scripts/build-minigame.mjs'],
  test: [
    '--test',
    'scripts/test-minigame-build.test.mjs',
    'scripts/minigame-session.test.mjs',
    'scripts/cloud-functions.test.mjs',
  ],
  typecheck: ['node_modules/typescript/bin/tsc', '-p', 'miniprogram/tsconfig.json', '--noEmit'],
};

const check = process.argv[2];
if (!Object.hasOwn(commands, check)) throw new Error(`Unknown minigame check: ${check}`);
if (!existsSync('miniprogram/game.ts')) {
  console.log(`[minigame] Skipping ${check}: local WeChat project is not installed.`);
} else {
  const result = spawnSync(process.execPath, commands[check], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
