import { existsSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';

const minigameTests = [
  'audio',
  'font-loading',
  'minigame-header',
  'minigame-touch',
  'online-rules',
  'welcome',
].map(name => `web/tests/${name}.test.ts`);

export default defineConfig({
  test: {
    include: ['core/tests/**/*.test.ts', 'web/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: existsSync('miniprogram/game.ts') ? configDefaults.exclude : [...configDefaults.exclude, ...minigameTests],
  },
});
