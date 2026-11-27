import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

// Exercise the real entry's session and callbacks without a Canvas or WeChat IDE.
const source = await readFile('miniprogram/game.ts', 'utf8');
const bundle = await build({
  stdin: {
    contents: source + '\nexport const sessionTest = { state, placeToken, undo, newGame, buildButtons, doMove, handleBoardTap, scheduleAI, computeLayout, currentView, showHint, stepBack, saveLocalGame: typeof saveLocalGame === "function" ? saveLocalGame : undefined, restoreLocalGame: typeof restoreLocalGame === "function" ? restoreLocalGame : undefined, readLocalGame: typeof readLocalGame === "function" ? readLocalGame : undefined, applyOnlineGame, submitOnlineMove, handleHide: typeof handleHide === "function" ? handleHide : undefined, handleShow: typeof handleShow === "function" ? handleShow : undefined, getLayout: () => ({boardX, boardY, boardLayout, panelX: typeof panelX === "number" ? panelX : 0, panelWidth: typeof panelWidth === "number" ? panelWidth : 0, movelistY, movelistH}) };',
    loader: 'ts', resolveDir: resolve('miniprogram'),
  }, bundle: true, format: 'cjs', platform: 'node', write: false,
});

function session() {
  let nextTimer = 0;
  const timers = new Map();
  const storage = new Map();
  const sandbox = {
    module: { exports: {} }, console,
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => 1, clearInterval() {},
  };
  vm.runInNewContext(bundle.outputFiles[0].text, sandbox);
  sandbox.wx = {
    setStorageSync: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))),
    getStorageSync: key => storage.get(key), removeStorageSync: key => storage.delete(key),
  };
  return { ...sandbox.module.exports.sessionTest, sandbox, timers, storage,
    runAI() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
  };
}

function start(s, options = {}) {
  Object.assign(s.state, { mode: 'ai', humanSide: 'black', first: 'red', phase: 'placing' }, options);
  s.placeToken(1); s.placeToken(9);
}

test('AI opening cannot be undone into a stalled AI turn', () => {
  const s = session(); start(s); s.runAI(); s.undo();
  assert.equal(s.state.game.turn, s.state.humanSide);
  assert.equal(s.state.history.length, 1);
  assert.equal(s.buildButtons().find(b => b.label === '悔棋').disabled(), true);
});

test('new session invalidates an old AI callback, even if already queued', () => {
  const s = session(); start(s);
  const stale = s.timers.values().next().value;
  s.state.mode = '2p'; s.newGame(); s.placeToken(2); s.placeToken(8); stale();
  assert.equal(s.state.history.length, 0);
});

test('AI thinking locks undo and side settings', () => {
  const s = session(); start(s);
  assert.equal(s.buildButtons().find(b => b.label === '悔棋').disabled(), true);
  assert.equal(s.buildButtons().find(b => b.label.startsWith('执方')).disabled(), true);
});

test('save restores exact live state and undo stack, excluding replay and hints', () => {
  const s = session(); start(s, {mode: '2p'});
  s.handleBoardTap(2); s.showHint(); s.stepBack(); s.saveLocalGame();
  const saved = s.readLocalGame();
  assert.ok(saved);
  s.newGame(); s.restoreLocalGame(saved);
  assert.equal(s.state.game.tokens.red, 2);
  assert.equal(s.state.replayIdx, -1);
  assert.equal(s.state.hint, null);
  s.undo(); assert.equal(s.state.game.tokens.red, 1);
});

test('invalid archive is rejected without losing the ability to start a game', () => {
  const s = session(); s.storage.set('arrow-chess:minigame:v1', {version: 1, history: [{to: 99}]});
  assert.equal(s.readLocalGame(), null);
  s.newGame(); s.placeToken(1); s.placeToken(9);
  assert.equal(s.state.phase, 'playing');
});

test('background cancels AI; returning schedules it exactly once', () => {
  const s = session(); start(s); s.handleHide();
  assert.equal(s.timers.size, 0);
  s.handleShow({}); s.handleShow({});
  assert.equal(s.timers.size, 1);
});

test('portrait and landscape keep board and controls on screen', () => {
  for (const [w, h] of [[375,667], [320,568], [667,375], [812,375], [360,640]]) {
    const s = session(); s.computeLayout(w, h);
    const l = s.getLayout();
    assert.ok(l.boardY + l.boardLayout.size <= h, `${w}x${h}: board`);
    for (const b of s.buildButtons()) {
      assert.ok(b.x >= 0 && b.x + b.w <= w && b.y >= 0 && b.y + b.h <= h, `${w}x${h}: ${b.label}`);
    }
    assert.ok(l.movelistY + l.movelistH <= h, `${w}x${h}: history`);
  }
});

test('online taps send a command and wait for authoritative tokens', async () => {
  const s = session(); let request;
  s.sandbox.wx.cloud = {
    callFunction(o) { request = o.data; o.success({result: {success: false, msg: 'test rejection'}}); },
    database: () => ({collection: () => ({doc: () => ({get: o => o.fail(new Error('offline'))})})}),
  };
  start(s, {mode: '2p'});
  Object.assign(s.state, {mode: 'online', onlineSide: 'red', onlinePhase: 'playing', onlineRoomId: 'ABC234', onlineRevision: 2});
  s.handleBoardTap(2);
  assert.equal(request.command.type, 'move');
  assert.equal(request.command.move.to, 2);
  assert.equal(request.expectedRevision, 2);
  assert.equal(s.state.game.tokens.red, 1);
  await new Promise(resolve => setImmediate(resolve));
});
