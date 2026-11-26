import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(process.cwd());
const GAME_DIR = resolve(ROOT, 'miniprogram/minigame');
const GAME_JSON = resolve(GAME_DIR, 'game.json');
const GAME_JS = resolve(GAME_DIR, 'game.js');
const PROJECT_CONFIG = resolve(ROOT, 'miniprogram/project.config.json');

test('project.config.json declares the project as a minigame with an isolated game root', async () => {
  assert.equal(existsSync(PROJECT_CONFIG), true, 'miniprogram/project.config.json must exist');
  const cfg = JSON.parse(await readFile(PROJECT_CONFIG, 'utf8'));
  assert.equal(
    cfg.compileType,
    'minigame',
    'compileType must be "minigame" for the official minigame account',
  );
  assert.equal(
    cfg.miniprogramRoot,
    './minigame',
    'miniprogramRoot must point at an isolated game directory so the dev tool never scans the legacy miniprogram shell or the TS entry source',
  );
});

test('minigame manifest is a valid wechat game config', async () => {
  assert.equal(existsSync(GAME_JSON), true, 'miniprogram/minigame/game.json must exist');
  const cfg = JSON.parse(await readFile(GAME_JSON, 'utf8'));
  assert.ok(
    ['portrait', 'landscape', 'auto'].includes(cfg.deviceOrientation),
    `deviceOrientation must be one of portrait/landscape/auto, got ${cfg.deviceOrientation}`,
  );
});

test('the isolated game root ships only built JS, no TypeScript the dev tool would try to compile', async () => {
  assert.equal(existsSync(GAME_DIR), true, 'miniprogram/minigame/ must exist');
  const entries = readdirSync(GAME_DIR);
  const tsFiles = entries.filter((name) => name.endsWith('.ts'));
  assert.deepEqual(
    tsFiles,
    [],
    `miniprogram/minigame/ must contain no .ts source; found ${tsFiles.join(', ')}`,
  );
});

test('built game.js is self-contained, references the shared core, and uses no syntax the dev tool ES6 transpiler rejects', async () => {
  assert.equal(existsSync(GAME_JS), true, 'miniprogram/minigame/game.js must exist after build:minigame');
  const source = await readFile(GAME_JS, 'utf8');
  assert.ok(source.length > 0, 'game.js must be a non-empty built bundle');
  for (const marker of ['createGame', 'legalMoves', 'renderBoard', 'applyMove', 'gameResult']) {
    assert.ok(
      source.includes(marker),
      `game.js must contain the shared ${marker} API so the minigame shares one core with web/miniprogram`,
    );
  }
  // Self-contained IIFE: no runtime module resolution the dev tool has to perform.
  assert.ok(
    !/require\s*\(/.test(source),
    'game.js must not contain require() calls; the bundle must inline all dependencies',
  );
  assert.ok(
    !/^\s*import\s/m.test(source),
    'game.js must not contain ESM import statements; the bundle must inline all dependencies',
  );
  // The dev tool ES6 transpiler (setting.es6) parses without the optional-chaining /
  // nullish-coalescing plugins on older toolchains; ship syntax it can always compile.
  assert.ok(
    !source.includes('?.'),
    'game.js must not use optional chaining (?.); esbuild must transpile it so the dev tool can compile',
  );
  assert.ok(
    !source.includes('??'),
    'game.js must not use nullish coalescing (??); esbuild must transpile it so the dev tool can compile',
  );
});
