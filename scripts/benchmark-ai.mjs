import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';


const built = await build({entryPoints: ['core/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false});
const compiled = {exports: {}};
// Load the local bundle in the native Node realm, without vm global lookup overhead.
new Function('module','exports',built.outputFiles[0].text)(compiled,compiled.exports);
const core = compiled.exports;

// Frozen reference implementation from before the strategy upgrade.
function oldEvaluate(state, player) {
  return core.legalMoves({...state,turn:player}).length -
    core.legalMoves({...state,turn:core.opponent(player)}).length;
}
function oldSearch(state, depth, alpha, beta, player, ply) {
  const moves = core.legalMoves(state);
  if (!moves.length) return state.turn === player ? -1e6 + ply : 1e6 - ply;
  if (!depth) return oldEvaluate(state, player);
  const maximize = state.turn === player;
  let best = maximize ? -Infinity : Infinity;
  for (const move of moves) {
    const value = oldSearch(core.applyMove(state,move),depth-1,alpha,beta,player,ply+1);
    best = maximize ? Math.max(best,value) : Math.min(best,value);
    if (maximize) alpha = Math.max(alpha,best); else beta = Math.min(beta,best);
    if (beta <= alpha) break;
  }
  return best;
}
function oldMove(state, difficulty) {
  const depth = {easy:2,medium:4,hard:6}[difficulty];
  let alpha = -Infinity; let best = -Infinity; let chosen = null;
  for (const move of core.legalMoves(state)) {
    const score = oldSearch(core.applyMove(state,move),depth-1,alpha,Infinity,state.turn,1);
    if (score > best) {best=score;chosen=move;} alpha=Math.max(alpha,best);
  }
  return chosen;
}

const openings = [[1,9],[1,3],[1,2],[1,5],[2,8],[2,6],[4,6],[5,1],[5,9],[3,7],[3,8],[7,6]];
const report = { note: 'Desktop Node timings; fixed openings with both colors, not a human win-rate estimate.', timings: [], matches: [] };
for (const difficulty of ['medium','hard']) {
  const samples=[];
  for (const [red,black] of openings) {
    const state=core.createGame(red,black);
    const start=performance.now();
    const result=core.analyzeMove(state,{maxDepth:core.DIFFICULTY_DEPTH[difficulty],nodeBudget:core.DIFFICULTY_NODES[difficulty]});
    samples.push({opening:[red,black],ms:Number((performance.now()-start).toFixed(2)),depth:result.completedDepth,nodes:result.nodes,proven:result.proven});
  }
  report.timings.push({difficulty,samples});
  let wins=0;
  for (const [red,black] of openings) for (const newSide of ['red','black']) {
    let state=core.createGame(red,black);
    while (!core.gameResult(state).over) {
      const move=state.turn===newSide ? core.aiMove(state,state.turn,difficulty) : oldMove(state,difficulty);
      if (!move || !core.isLegal(state,move)) throw new Error('AI produced no legal move');
      state=core.applyMove(state,move);
    }
    if (core.gameResult(state).winner===newSide) wins++;
  }
  report.matches.push({difficulty,wins,losses:openings.length*2-wins,games:openings.length*2});
}
console.log(JSON.stringify(report,null,2));
