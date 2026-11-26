import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const rules = require('../miniprogram/cloudfunctions/makeMove/rules.cjs');
const makeSource = await readFile('miniprogram/cloudfunctions/makeMove/index.js', 'utf8');
const joinSource = await readFile('miniprogram/cloudfunctions/joinGame/index.js', 'utf8');
function backend() {
  let actor = 'r'; let tail = Promise.resolve();
  let room = { _id: 'ABC234', creator: 'r', creatorSide: 'red', opponent: '', status: 'waiting',
    first: 'red', turn: 'red', phase: 'placing', placeStep: 0, edges: [], redPos: null,
    blackPos: null, initialRed: null, initialBlack: null, history: [], winner: null, revision: 0 };
  const db = { serverDate: () => 1,
    runTransaction(fn) {
      const result = tail.then(async () => {
        const snapshot = structuredClone(room);
        const transaction = { collection: () => ({doc: () => ({
          get: async () => ({data: snapshot}), update: async ({data}) => Object.assign(snapshot, data),
        })}) };
        const value = await fn(transaction); room = snapshot;
        return {result: value};
      });
      tail = result.catch(() => {}); return result;
    },
  };
  const cloud = {init() {}, database: () => db, getWXContext: () => ({OPENID: actor})};
  function load(source) {
    const sandbox = {exports: {}, require: name => name === 'wx-server-sdk' ? cloud : rules};
    vm.runInNewContext(source, sandbox); return sandbox.exports.main;
  }
  const makeMove = load(makeSource); const joinGame = load(joinSource);
  return {get room() { return room; }, join(who) {actor=who; return joinGame({roomId:'ABC234'});},
    move(who, command, revision, requestId, extras={}) {actor=who; return makeMove({roomId:'ABC234',command,expectedRevision:revision,requestId,...extras});},
  };
}
test('concurrent joins reserve exactly one opponent slot', async () => {
  const b = backend(); const results = await Promise.all([b.join('b'), b.join('other')]);
  assert.equal(results.filter(r => r.success).length, 1);
  assert.equal(b.room.opponent, 'b');
});
test('real cloud handlers complete placement and refuse snapshot forgery', async () => {
  const b = backend(); await b.join('b');
  assert.equal((await b.move('r',{type:'place',point:1},1,'red')).success,true);
  assert.equal((await b.move('b',{type:'place',point:9},2,'black')).success,true);
  assert.equal((await b.move('r',undefined,3,'forged',{winner:'red',phase:'over',redPos:9})).success,false);
  assert.equal(b.room.winner,null); assert.equal(b.room.redPos,1);
  const command={type:'move',move:{player:'red',from:1,to:2}};
  const result=await b.move('r',command,3,'first-move',{winner:'red'});
  assert.equal(result.success,true); assert.equal(b.room.redPos,2); assert.equal(b.room.winner,null);
  const duplicate=await b.move('r',command,3,'first-move');
  assert.equal(duplicate.success,true); assert.equal(b.room.history.length,1);
});
