"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __pow = Math.pow;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // core/src/types.ts
  function opponent(p) {
    return p === "red" ? "black" : "red";
  }
  var POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // core/src/board.ts
  function rowOf(p) {
    return Math.floor((p - 1) / 3);
  }
  function colOf(p) {
    return (p - 1) % 3;
  }
  function adjacent(a, b) {
    const dr = Math.abs(rowOf(a) - rowOf(b));
    const dc = Math.abs(colOf(a) - colOf(b));
    return Math.max(dr, dc) === 1;
  }
  function buildEdges() {
    const edges = [];
    let id = 0;
    for (let a = 1; a <= 9; a++) {
      for (let b = a + 1; b <= 9; b++) {
        if (adjacent(a, b)) {
          edges.push({ id, a, b });
          id += 1;
        }
      }
    }
    return edges;
  }
  var EDGES = buildEdges();
  var EDGE_COUNT = EDGES.length;
  var ADJACENCY = POINTS.map(() => []);
  for (const e of EDGES) {
    ADJACENCY[e.a - 1].push({ neighbor: e.b, edgeId: e.id });
    ADJACENCY[e.b - 1].push({ neighbor: e.a, edgeId: e.id });
  }
  function neighbors(p) {
    return ADJACENCY[p - 1];
  }
  function tryEdgeIdBetween(a, b) {
    for (const ref of ADJACENCY[a - 1]) {
      if (ref.neighbor === b) return ref.edgeId;
    }
    return -1;
  }
  function edgeIdBetween(a, b) {
    const id = tryEdgeIdBetween(a, b);
    if (id === -1) throw new Error(`No edge between ${a} and ${b}`);
    return id;
  }

  // core/src/state.ts
  function emptyEdge() {
    return { owner: null, arrows: 0, returnStart: null };
  }
  function createGame(redStart, blackStart, first = "red") {
    if (redStart === blackStart) {
      throw new Error("\u53CC\u65B9\u68CB\u5B50\u4E0D\u80FD\u540C\u70B9\u8D77\u59CB");
    }
    return {
      tokens: { red: redStart, black: blackStart },
      edges: Array.from({ length: EDGE_COUNT }, () => emptyEdge()),
      turn: first,
      moveCount: 0
    };
  }

  // core/src/rules.ts
  function canTraverse(edge, player, from) {
    if (edge.arrows === 0) return true;
    if (edge.owner !== player) return false;
    if (edge.arrows === 2) return false;
    return from === edge.returnStart;
  }
  function isLegal(state2, move) {
    if (move.player !== state2.turn) return false;
    if (state2.tokens[move.player] !== move.from) return false;
    if (move.to === state2.tokens[opponent(move.player)]) return false;
    const eid = tryEdgeIdBetween(move.from, move.to);
    if (eid === -1) return false;
    return canTraverse(state2.edges[eid], move.player, move.from);
  }
  function legalMoves(state2) {
    const player = state2.turn;
    const from = state2.tokens[player];
    const oppPos = state2.tokens[opponent(player)];
    const moves = [];
    for (const ref of neighbors(from)) {
      const to = ref.neighbor;
      if (to === oppPos) continue;
      if (canTraverse(state2.edges[ref.edgeId], player, from)) {
        moves.push({ player, from, to });
      }
    }
    return moves;
  }
  function applyMove(state2, move) {
    const next = __spreadProps(__spreadValues({}, state2), { tokens: __spreadValues({}, state2.tokens), edges: [...state2.edges] });
    const eid = tryEdgeIdBetween(move.from, move.to);
    if (eid === -1) {
      throw new Error(`\u975E\u6CD5\u8D70\u6CD5\uFF08\u4E0D\u76F8\u90BB\uFF09: ${move.player} ${move.from}->${move.to}`);
    }
    const e = __spreadValues({}, state2.edges[eid]);
    next.edges[eid] = e;
    if (e.arrows === 0) {
      e.owner = move.player;
      e.arrows = 1;
      e.returnStart = move.to;
    } else if (e.owner === move.player && e.arrows === 1 && move.from === e.returnStart) {
      e.arrows = 2;
    } else {
      throw new Error(`\u975E\u6CD5\u8D70\u6CD5: ${move.player} ${move.from}->${move.to}`);
    }
    next.tokens[move.player] = move.to;
    next.turn = opponent(move.player);
    next.moveCount += 1;
    return next;
  }
  function gameResult(state2) {
    if (legalMoves(state2).length === 0) {
      const loser = state2.turn;
      return { over: true, winner: opponent(loser), loser, reason: "trapped" };
    }
    return { over: false };
  }

  // core/src/ai.ts
  var DIFFICULTY_DEPTH = { easy: 2, medium: 6, hard: 10 };
  var DIFFICULTY_NODES = { easy: 2e3, medium: 6e3, hard: 12e3 };
  var MATE = 1e5;
  function routes(state2, player) {
    const blocked = state2.tokens[opponent(player)];
    const queue = [state2.tokens[player]];
    let points = 1 << queue[0] - 1;
    let paths = 0;
    let capacity = 0;
    for (let i = 0; i < queue.length; i++) {
      const from = queue[i];
      for (const ref of neighbors(from)) {
        const edge = state2.edges[ref.edgeId];
        if (ref.neighbor === blocked || edge.arrows === 2 || edge.arrows === 1 && (edge.owner !== player || edge.returnStart !== from)) continue;
        const pathBit = 1 << ref.edgeId;
        if (!(paths & pathBit)) {
          paths |= pathBit;
          capacity += 2 - edge.arrows;
        }
        const pointBit = 1 << ref.neighbor - 1;
        if (!(points & pointBit)) {
          points |= pointBit;
          queue.push(ref.neighbor);
        }
      }
    }
    return { mobility: legalMoves(__spreadProps(__spreadValues({}, state2), { turn: player })).length, capacity, points: queue.length };
  }
  function routeScore(r) {
    const forced = r.mobility === 0 ? -48 : r.mobility === 1 ? -16 : 0;
    return r.mobility * 16 + r.capacity * 2 + r.points * 3 + forced;
  }
  function evaluate(state2, player) {
    return routeScore(routes(state2, player)) - routeScore(routes(state2, opponent(player)));
  }
  var SearchLimit = class extends Error {
  };
  function positionKey(state2) {
    let key = `${state2.tokens.red}${state2.tokens.black}${state2.turn === "red" ? "r" : "b"}`;
    for (const edge of state2.edges) {
      const code = edge.arrows === 0 ? 0 : edge.arrows === 2 ? 19 : (edge.owner === "red" ? 0 : 9) + (edge.returnStart || 0);
      key += String.fromCharCode(65 + code);
    }
    return key;
  }
  function orderedChildren(state2, moves, preferred) {
    return moves.map((move) => {
      const next = applyMove(state2, move);
      const nextMoves = legalMoves(next);
      const enemyMobility = nextMoves.length;
      const myMobility = legalMoves(__spreadProps(__spreadValues({}, next), { turn: state2.turn })).length;
      const priority = (move.to === preferred ? 1e4 : 0) + (enemyMobility === 0 ? 1e6 : 0) + myMobility * 4 - enemyMobility * 6;
      return { move, state: next, moves: nextMoves, priority };
    }).sort((a, b) => b.priority - a.priority || a.move.to - b.move.to);
  }
  function search(state2, depth, alpha, beta, ply, context2, moves = legalMoves(state2)) {
    if (context2.nodes >= context2.budget) throw new SearchLimit();
    context2.nodes++;
    if (!moves.length) return -MATE + ply;
    if (depth === 0) return evaluate(state2, state2.turn);
    const key = positionKey(state2);
    const cached = context2.table.get(key);
    if (cached && cached.depth >= depth) {
      if (cached.bound === "exact" || cached.bound === "lower" && cached.score >= beta || cached.bound === "upper" && cached.score <= alpha) return cached.score;
    }
    const originalAlpha = alpha;
    let score = -Infinity;
    let to = null;
    for (const child of orderedChildren(state2, moves, cached == null ? void 0 : cached.to)) {
      const value = -search(child.state, depth - 1, -beta, -alpha, ply + 1, context2, child.moves);
      if (value > score) {
        score = value;
        to = child.move.to;
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    context2.table.set(key, {
      depth,
      score,
      to,
      bound: score <= originalAlpha ? "upper" : score >= beta ? "lower" : "exact"
    });
    return score;
  }
  function analyzeMove(state2, options) {
    var _a2;
    const moves = legalMoves(state2);
    if (!moves.length) return { move: null, score: -MATE, completedDepth: 0, nodes: 0, proven: true };
    const remaining = state2.edges.reduce((sum, edge) => sum + 2 - edge.arrows, 0);
    const maxDepth = Math.min(remaining, Math.max(1, Number.isFinite(options.maxDepth) ? Math.floor(options.maxDepth) : 1));
    const budget = options.nodeBudget === void 0 ? Infinity : Math.max(1, Number.isFinite(options.nodeBudget) ? Math.floor(options.nodeBudget) : 1);
    const context2 = { nodes: 0, budget, table: /* @__PURE__ */ new Map() };
    const fallback = orderedChildren(state2, moves)[0];
    let result = {
      move: fallback.move,
      score: evaluate(fallback.state, state2.turn),
      completedDepth: 0,
      nodes: 0,
      proven: false
    };
    for (let depth = 1; depth <= maxDepth; depth++) {
      let score = -Infinity;
      let move = fallback.move;
      let alpha = -Infinity;
      try {
        for (const child of orderedChildren(state2, moves, (_a2 = result.move) == null ? void 0 : _a2.to)) {
          const value = -search(child.state, depth - 1, -Infinity, -alpha, 1, context2, child.moves);
          if (value > score) {
            score = value;
            move = child.move;
          }
          alpha = Math.max(alpha, score);
        }
      } catch (error) {
        if (!(error instanceof SearchLimit)) throw error;
        break;
      }
      result = { move, score, completedDepth: depth, nodes: context2.nodes, proven: Math.abs(score) > MATE / 2 };
      if (result.proven) break;
    }
    return __spreadProps(__spreadValues({}, result), { nodes: context2.nodes });
  }
  function bestMove(state2, depth, player) {
    if (player !== state2.turn) throw new Error("AI \u53EA\u80FD\u641C\u7D22\u5F53\u524D\u56DE\u5408\u7684\u8D70\u6CD5");
    return analyzeMove(state2, { maxDepth: depth }).move;
  }
  function aiMove(state2, player, difficulty = "medium") {
    if (player !== state2.turn) throw new Error("AI \u53EA\u80FD\u641C\u7D22\u5F53\u524D\u56DE\u5408\u7684\u8D70\u6CD5");
    return analyzeMove(state2, { maxDepth: DIFFICULTY_DEPTH[difficulty], nodeBudget: DIFFICULTY_NODES[difficulty] }).move;
  }

  // web/src/renderer.ts
  var DEFAULT_THEME = {
    bg: "#e7e9df",
    edge: "#9da59d",
    red: "#c83d35",
    black: "#262a2c",
    pointFill: "#f7f8f4",
    pointStroke: "#59635c",
    legal: "#4f7b58",
    selected: "#d58f17",
    lastMove: "#d58f17",
    hint: "#267eb5",
    text: "#272d29",
    arrowOnRed: "#751f1a",
    arrowOnBlack: "#262a2c",
    redClosed: "#7a1f1a",
    blackClosed: "#262a2c",
    arrowOnRedClosed: "#1d2220",
    arrowOnBlackClosed: "#cfd2cc"
  };
  var BAMBOO_THEME = {
    bg: "#E9ECDF",
    // board-surface 棋盘卡片底色
    edge: "#9FAB8A",
    // line-neutral 未占用路径
    red: "#B23A2A",
    // vermilion 朱砂红
    black: "#333B2A",
    // ink 墨色（偏绿）
    pointFill: "#EEF0E4",
    // 落点填充
    pointStroke: "#5F6A4C",
    // 落点描边
    legal: "#7A8B5E",
    // 合法落点高亮（竹青系偏深）
    selected: "#B23A2A",
    // 选中棋子用朱砂
    lastMove: "#C68B5C",
    // 上一手高亮（暖竹黄）
    hint: "#5C8A78",
    // 提示箭头色（竹青偏蓝绿）
    text: "#333B2A",
    // 主文字用墨色
    arrowOnRed: "#7A281E",
    // 红方路径上的箭头（深红）
    arrowOnBlack: "#333B2A",
    // 黑方路径上的箭头（同墨色）
    // 封闭路径统一用 path-closed 竹青灰，规范要求封闭后"哑掉"不区分归属
    redClosed: "#AAB196",
    blackClosed: "#AAB196",
    arrowOnRedClosed: "#7A8B66",
    arrowOnBlackClosed: "#7A8B66"
  };
  function pointXY(layout, p) {
    const row = Math.floor((p - 1) / 3);
    const col = (p - 1) % 3;
    const span = layout.size - layout.padding * 2;
    return {
      x: layout.padding + col * span / 2,
      y: layout.padding + row * span / 2
    };
  }
  function boardCornerRadius(layout) {
    return layout.padding;
  }
  function chevron(ctx2, ax, ay, bx, by, frac, color, size) {
    const px = ax + (bx - ax) * frac;
    const py = ay + (by - ay) * frac;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tipX = px + ux * size;
    const tipY = py + uy * size;
    const baseX = px - ux * size;
    const baseY = py - uy * size;
    const nx = -uy;
    const ny = ux;
    ctx2.beginPath();
    ctx2.moveTo(tipX, tipY);
    ctx2.lineTo(baseX + nx * size * 0.7, baseY + ny * size * 0.7);
    ctx2.lineTo(baseX - nx * size * 0.7, baseY - ny * size * 0.7);
    ctx2.closePath();
    ctx2.fillStyle = color;
    ctx2.fill();
  }
  function edgeArrowSpecs(e, a, b) {
    if (e.arrows === 0 || e.returnStart == null) return [];
    const firstTo = e.returnStart;
    const firstFrom = firstTo === a ? b : a;
    const specs = [{ from: firstFrom, to: firstTo, frac: 0.75 }];
    if (e.arrows === 2) {
      specs.push({ from: firstTo, to: firstFrom, frac: 0.75 });
    }
    return specs;
  }
  function drawEdge(ctx2, layout, theme, e, a, b) {
    const pa = pointXY(layout, a);
    const pb = pointXY(layout, b);
    const owner = e.owner;
    if (e.arrows === 0) {
      ctx2.strokeStyle = theme.edge;
      ctx2.lineWidth = 1.5;
    } else if (e.arrows === 1) {
      ctx2.strokeStyle = owner === "red" ? theme.red : theme.black;
      ctx2.lineWidth = 3;
    } else {
      ctx2.strokeStyle = owner === "red" ? theme.redClosed : theme.blackClosed;
      ctx2.lineWidth = 6;
    }
    ctx2.lineCap = "round";
    ctx2.beginPath();
    ctx2.moveTo(pa.x, pa.y);
    ctx2.lineTo(pb.x, pb.y);
    ctx2.stroke();
    for (const spec of edgeArrowSpecs(e, a, b)) {
      const from = pointXY(layout, spec.from);
      const to = pointXY(layout, spec.to);
      const color = e.arrows === 2 ? owner === "red" ? theme.arrowOnRedClosed : theme.arrowOnBlackClosed : owner === "red" ? theme.arrowOnRed : theme.arrowOnBlack;
      chevron(ctx2, from.x, from.y, to.x, to.y, spec.frac, color, 8);
    }
  }
  function drawPoint(ctx2, layout, theme, p, opts = {}) {
    var _a2, _b, _c;
    const { x, y } = pointXY(layout, p);
    const r = (_a2 = opts.radius) != null ? _a2 : 13;
    if (opts.highlight) {
      ctx2.beginPath();
      ctx2.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx2.fillStyle = opts.highlight;
      ctx2.globalAlpha = 0.25;
      ctx2.fill();
      ctx2.globalAlpha = 1;
    }
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fillStyle = theme.pointFill;
    ctx2.fill();
    ctx2.lineWidth = 2;
    ctx2.strokeStyle = (_b = opts.highlight) != null ? _b : theme.pointStroke;
    ctx2.stroke();
    if (opts.engraved) {
      ctx2.font = opts.label ? '400 17px "Arrow Brush", "Kaiti SC", KaiTi, serif' : "600 11px system-ui, sans-serif";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillStyle = theme.text;
      ctx2.fillText((_c = opts.label) != null ? _c : String(p), x, y + 0.5);
    }
  }
  function drawToken(ctx2, layout, theme, p, player, selected, opts) {
    const dest = pointXY(layout, p);
    let { x, y } = dest;
    const effect2 = opts.effect;
    if ((effect2 == null ? void 0 : effect2.from) && effect2.point === p && effect2.player === player) {
      const from = pointXY(layout, effect2.from);
      const travel = 1 - __pow(1 - Math.min(1, effect2.progress * 2.5), 3);
      x = from.x + (dest.x - from.x) * travel;
      y = from.y + (dest.y - from.y) * travel;
    }
    if (selected) {
      ctx2.beginPath();
      ctx2.arc(x, y, 22, 0, Math.PI * 2);
      ctx2.fillStyle = theme.selected;
      ctx2.globalAlpha = 0.3;
      ctx2.fill();
      ctx2.globalAlpha = 1;
    }
    const grad = ctx2.createRadialGradient(x - 5, y - 6, 2, x, y, 16);
    const base = player === "red" ? theme.red : theme.black;
    grad.addColorStop(0, player === "red" ? "#e26a5e" : "#5a5a5a");
    grad.addColorStop(1, base);
    ctx2.beginPath();
    ctx2.arc(x, y, 16, 0, Math.PI * 2);
    ctx2.fillStyle = grad;
    ctx2.fill();
    ctx2.lineWidth = 2;
    ctx2.strokeStyle = "#ffffff";
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.arc(x, y, 5, 0, Math.PI * 2);
    ctx2.fillStyle = player === "red" ? "#fbe3df" : "#cfcfcf";
    ctx2.fill();
  }
  function drawBoardEffect(ctx2, layout, theme, effect2) {
    const { point, player, kind, progress } = effect2;
    const { x, y } = pointXY(layout, point);
    if (kind === "win") {
      if (!effect2.from) return;
      const from = pointXY(layout, effect2.from);
      const dx = x - from.x;
      const dy = y - from.y;
      const inset = Math.min(0.3, 21 / Math.hypot(dx, dy));
      const fade = Math.sin(Math.PI * progress);
      ctx2.save();
      ctx2.lineCap = "round";
      ctx2.beginPath();
      ctx2.moveTo(from.x + dx * inset, from.y + dy * inset);
      ctx2.lineTo(x - dx * inset, y - dy * inset);
      ctx2.strokeStyle = "#c99539";
      ctx2.lineWidth = 11;
      ctx2.globalAlpha = fade * 0.35;
      ctx2.stroke();
      ctx2.strokeStyle = "#f9df91";
      ctx2.lineWidth = 2.5;
      ctx2.globalAlpha = fade;
      ctx2.stroke();
      ctx2.restore();
      return;
    }
    const color = kind === "hint" ? theme.hint : kind === "close" ? theme.lastMove : player === "black" ? theme.black : theme.red;
    const wave = effect2.from ? Math.max(0, (progress - 0.22) / 0.78) : progress;
    ctx2.save();
    ctx2.strokeStyle = color;
    ctx2.globalAlpha = (1 - wave) * 0.8;
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(x, y, 18 + wave * 14, 0, Math.PI * 2);
    ctx2.stroke();
    if (kind === "close") {
      ctx2.globalAlpha = (1 - wave) * 0.6;
      ctx2.beginPath();
      ctx2.arc(x, y, 15 + wave * 12, 0, Math.PI * 2);
      ctx2.stroke();
    }
    ctx2.restore();
  }
  function renderBoard(ctx2, view, layout, theme = DEFAULT_THEME, opts = {}) {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
    const r = boardCornerRadius(layout);
    ctx2.save();
    roundRectPath(ctx2, 0, 0, layout.size, layout.size, r);
    ctx2.fillStyle = theme.bg;
    ctx2.fill();
    ctx2.clip();
    if (opts.engraved) {
      const glow = ctx2.createRadialGradient(
        layout.size * 0.38,
        layout.size * 0.3,
        0,
        layout.size * 0.5,
        layout.size * 0.5,
        layout.size * 0.66
      );
      glow.addColorStop(0, (_b = (_a2 = theme.paper) == null ? void 0 : _a2.light) != null ? _b : "#f3f2de");
      glow.addColorStop(1, (_d = (_c = theme.paper) == null ? void 0 : _c.dark) != null ? _d : "#dce1c9");
      ctx2.fillStyle = glow;
      ctx2.fillRect(0, 0, layout.size, layout.size);
      ctx2.strokeStyle = (_f = (_e = theme.paper) == null ? void 0 : _e.border) != null ? _f : "#92a17d42";
      ctx2.lineWidth = 1;
      const inset = layout.padding * 0.32;
      roundRectPath(ctx2, inset, inset, layout.size - inset * 2, layout.size - inset * 2, r - inset);
      ctx2.stroke();
    }
    if (opts.lastMove) {
      const pa = pointXY(layout, opts.lastMove.from);
      const pb = pointXY(layout, opts.lastMove.to);
      ctx2.strokeStyle = theme.lastMove;
      ctx2.lineWidth = 8;
      ctx2.globalAlpha = 0.35;
      ctx2.beginPath();
      ctx2.moveTo(pa.x, pa.y);
      ctx2.lineTo(pb.x, pb.y);
      ctx2.stroke();
      ctx2.globalAlpha = 1;
    }
    for (const ed of EDGES) {
      drawEdge(ctx2, layout, theme, view.edges[ed.id], ed.a, ed.b);
    }
    if (opts.hint) {
      const pa = pointXY(layout, opts.hint.from);
      const pb = pointXY(layout, opts.hint.to);
      ctx2.strokeStyle = theme.hint;
      ctx2.lineWidth = 5;
      ctx2.globalAlpha = 0.6;
      ctx2.setLineDash([6, 5]);
      ctx2.beginPath();
      ctx2.moveTo(pa.x, pa.y);
      ctx2.lineTo(pb.x, pb.y);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.globalAlpha = 1;
      chevron(ctx2, pa.x, pa.y, pb.x, pb.y, 0.75, theme.hint, 8);
    }
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      if (p === view.red || p === view.black) continue;
      const highlight = p === ((_g = opts.hint) == null ? void 0 : _g.to) ? theme.hint : opts.placement || ((_h = opts.legalTargets) == null ? void 0 : _h.includes(p)) ? theme.legal : void 0;
      const label = (_i = opts.pointLabels) == null ? void 0 : _i[p];
      drawPoint(ctx2, layout, theme, p, { highlight, label, engraved: opts.engraved, radius: label ? 15 : opts.placement ? 11 : 13 });
    }
    if (view.red) drawToken(ctx2, layout, theme, view.red, "red", opts.selected === view.red, opts);
    if (view.black) drawToken(ctx2, layout, theme, view.black, "black", opts.selected === view.black, opts);
    if (opts.invalid) drawBoardEffect(ctx2, layout, theme, { point: opts.invalid, kind: "invalid", progress: 0.25 });
    if (opts.effect) drawBoardEffect(ctx2, layout, theme, opts.effect);
    ctx2.restore();
  }
  function roundRectPath(ctx2, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + rr, y);
    ctx2.lineTo(x + w - rr, y);
    ctx2.arcTo(x + w, y, x + w, y + rr, rr);
    ctx2.lineTo(x + w, y + h - rr);
    ctx2.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx2.lineTo(x + rr, y + h);
    ctx2.arcTo(x, y + h, x, y + h - rr, rr);
    ctx2.lineTo(x, y + rr);
    ctx2.arcTo(x, y, x + rr, y, rr);
    ctx2.closePath();
  }

  // web/src/sound.ts
  var NOTES = {
    place: [[230, 0, 0.13, 0.08], [620, 0, 0.035, 0.03]],
    claim: [[320, 0, 0.13, 0.08], [810, 0, 0.04, 0.025]],
    close: [[430, 0, 0.07, 0.07], [260, 0.06, 0.16, 0.07]],
    hint: [[550, 0, 0.11, 0.04], [740, 0.075, 0.13, 0.035]],
    invalid: [[170, 0, 0.07, 0.045]],
    win: [[390, 0, 0.19, 0.065], [490, 0.105, 0.2, 0.055], [660, 0.21, 0.32, 0.055]],
    control: [[460, 0, 0.065, 0.04]]
  };
  var STORAGE_KEY = "arrow-chess-sound";
  var context;
  var output;
  var enabled = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch (e) {
  }
  function soundEnabled() {
    return enabled;
  }
  function toggleSound() {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch (e) {
    }
    if (output) output.gain.value = enabled ? 1 : 0;
    if (enabled) playSound("control");
  }
  function playSound(cue) {
    var _a2;
    if (!enabled) return;
    const Audio = (_a2 = window.AudioContext) != null ? _a2 : window.webkitAudioContext;
    if (!Audio) return;
    try {
      const audio = context != null ? context : context = new Audio();
      if (!output) {
        output = audio.createGain();
        output.connect(audio.destination);
      }
      if (audio.state !== "running") void audio.resume().catch(() => {
      });
      const start = audio.currentTime + 8e-3;
      for (const [frequency, offset, duration, volume] of NOTES[cue]) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const at = start + offset;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, at);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.84, at + duration);
        gain.gain.setValueAtTime(1e-3, at);
        gain.gain.linearRampToValueAtTime(volume, at + 5e-3);
        gain.gain.exponentialRampToValueAtTime(1e-3, at + duration);
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(at);
        oscillator.stop(at + duration);
      }
    } catch (e) {
    }
  }

  // web/src/theme.ts
  var BAMBOO_BOARD = __spreadProps(__spreadValues({}, BAMBOO_THEME), {
    bg: "#e6ead5",
    paper: { light: "#f0f0dd", dark: "#dee6cc", border: "#9cab8547" },
    pointFill: "#f1f1df",
    text: "#344a36"
  });
  var INK_BOARD = __spreadProps(__spreadValues({}, BAMBOO_THEME), {
    bg: "#4d634d",
    paper: { light: "#617558", dark: "#4d634d", border: "#c3d7ac42" },
    edge: "#97aa8b",
    red: "#f0967f",
    black: "#182721",
    pointFill: "#4d634a",
    pointStroke: "#becbaf",
    legal: "#dceab8",
    selected: "#ecba75",
    lastMove: "#e6bc73",
    hint: "#b5e3e3",
    text: "#f6f4dc",
    arrowOnRed: "#fad0ba",
    arrowOnBlack: "#17231d",
    redClosed: "#788d6b",
    blackClosed: "#788d6b",
    arrowOnRedClosed: "#d4dfc5",
    arrowOnBlackClosed: "#d4dfc5"
  });
  function boardTheme(ink) {
    return ink ? INK_BOARD : BAMBOO_BOARD;
  }

  // web/src/brush.ttf
  var brush_default = "data:font/ttf;base64,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AQgAAwABBAkADQEiAS4AAwABBAkADgA2AlAAQwBvAHAAeQByAGkAZwBoAHQAIAAyADAAMQA4ACAAVABoAGUAIABNAGEAUwBoAGEAbgBaAGgAZQBuAGcAIABQAHIAbwBqAGUAYwB0ACAAQQB1AHQAaABvAHIAcwAgACgAaAB0AHQAcABzADoALwAvAGcAaQB0AGgAdQBiAC4AYwBvAG0ALwBnAG8AbwBnAGwAZQBmAG8AbgB0AHMALwBtAGEAcwBoAGEAbgB6AGgAZQBuAGcAKQBNAGEAIABTAGgAYQBuACAAWgBoAGUAbgBnAFIAZQBnAHUAbABhAHIATQBhACAAUwBoAGEAbgAgAFoAaABlAG4AZwAgAFIAZQBnAHUAbABhAHIATQBhAFMAaABhAG4AWgBoAGUAbgBnAC0AUgBlAGcAdQBsAGEAcgBUAGgAaQBzACAARgBvAG4AdAAgAFMAbwBmAHQAdwBhAHIAZQAgAGkAcwAgAGwAaQBjAGUAbgBzAGUAZAAgAHUAbgBkAGUAcgAgAHQAaABlACAAUwBJAEwAIABPAHAAZQBuACAARgBvAG4AdAAgAEwAaQBjAGUAbgBzAGUALAAgAFYAZQByAHMAaQBvAG4AIAAxAC4AMQAuACAAVABoAGkAcwAgAGwAaQBjAGUAbgBzAGUAIABpAHMAIABhAHYAYQBpAGwAYQBiAGwAZQAgAHcAaQB0AGgAIABhACAARgBBAFEAIABhAHQAOgAgAGgAdAB0AHAAcwA6AC8ALwBvAHAAZQBuAGYAbwBuAHQAbABpAGMAZQBuAHMAZQAuAG8AcgBnAGgAdAB0AHAAcwA6AC8ALwBvAHAAZQBuAGYAbwBuAHQAbABpAGMAZQBuAHMAZQAuAG8AcgBnAAMAAAAAAAD/nAAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAB//8ADwABAAAACgAcAB4AAURGTFQACAAEAAAAAP//AAAAAAAAAAEAAAAKABwAHgABREZMVAAIAAQAAAAA//8AAAAAAAA=";

  // web/src/ming.ttf
  var ming_default = "data:font/ttf;base64,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AAIFH0hfG4RfDzz1AAMD6AAAAADhAWWQAAAAAONcEgb8IfvmC3IHEgAAAAYAAgAAAAAAAAPoAGQBAwAAASEAXwFbADUCLgAZAhYAOAOKAC4DAQAtALQANQFeAF4BXgAbAdsAFAI7ACcBQwBBAVAAKwFDAGwBTQADAh4AMAHZAE0CIABBAh4AMAIcACICIAAuAiAAPAIVADYCIAA6AiQAOQFDAGwBQwBBAjsAQQI7ACcCOwBDAZ8AUAN5ACcCwwALAo8AOAKuADwC+gA4AoYAOAJuADgC3gA8A1EAOAGMADgBiP/6As0AOAJqADgDxQArAxQAKwL3ADwCdAA4AvcAPAK9ADgCKwA2AoUAFgMUADACwgAFBA4ADQKyABECqgAeAlQAHAFMAGoBTQADAUwALQI7AF8CJ//7Aa4AXgIiADcCcQAqAg8ANAJpADQCGAA0AX4AIwIqAC4CjQAqAUUAKAEu/7gCTgAqAUYAIwPBACcCiwAnAkkANAJwACcCUgA0Ab4AJwHPADgBZQAOAoMAIwIY//gDN//8AiYACwIc//QB6wAuAXQAKwEzAIQBdAAgAjsAPQPoAHAD6AAoA+gAKwPoApQD6AAoA+gANQPoAC0D6AAtA+gAJgPoACYD6ABxA+gALgPoAHED6AAsA+gANwPoAC0D6AAoA+gAKAPoACoD6AAjA+gANAPoACwD6AAsA+gAJgPoACcD6AAuA+gAcgPoAHAD6AAnA+gAJgPoAC8D6AAwA+gALAPoAB8D6AAsA+gAIwPoAFcD6ABgA+gAJQPoACAD6AAoA+gALQPoADUD6ABgA+gAJwPoAC0D6AAoA+gAIQPoAC8D6AAcA+gAIgPoACsD6AAoA+gAMQPoACYD6AAxA+gALgPoACUD6AAoA+gAHgPoAC0D6AAaA+gAIQPoACcD6AAeA+gALAPoACID6AAsA+gAhwPoAGAD6AAtA+gAKgPoACcD6AATA+gAKwPoACUD6AAuA+gAKQPoADAD6AAoA+gALAPoACQD6AAhA+gAKwPoACgD6AAnA+gALAPoACkD6AApA+gAHgPoACED6AAqA+gAKAPoACUD6ABsA+gAIwPoAEAD6AAmA+gAKAPoABoD6AAqA+gAKwLJACMClgAjAooAIwPhACMD1QAjA+gC6QPoAnoD6AG9A+gAIgPoACID6AD/A+gAGQPoAo8D6ABAA+gAVgFlADkAugA5AhYANAIWAFUCFgA1AhYAMQIWACACFgApAhYAMwIWADQCFgA1AhYALAN0AGwAAQAABH/+4gAAC7j8If1aC3IAAQAAAAAAAAAAAAAAAAAAAOIAAwPeAMgABQAAAooCWAAAAEsCigJYAAABXgAyATQAAAICAgAAAAAAAAAAAAABCAEAAAAAABAAAAAAR09PRwAAACD/DANw/4gAAAR/AR4AAAABAAAAAAICAtkAAAAgAAYAAAACAAAAAwAAABQAAwABAAAAFAAEA0gAAADOAIAABgBOAH4gJiGSMAIwDU4ATgtODU4qTi1OO06GTpFOrk66Ts5PYFFIUXNRtVIwUk1TVVPMU+9W3lbwVyhXMFioWRxbUFueW/lcQFxPXHFd8l6mXvpfAF8IXw9fU1+FYB1glGJLYmdi6WPQZT5lsGW5ZeBnCWcsZzpnfmflaAdohWjLaiFrZWw0cLl1NXaEdth3C3k6eft6enr5e0l7gH6ifsh/boADgNyBEYQ9i66Lvov3jDGNcI3vj26P1JAJle2WvpdSmJiYzp5kntH/Cf8M//8AAAAgICYhkjACMAxOAE4KTg1OKk4tTjtOhk6RTq5Ouk7OT2BRSFFzUbVSMFJNU1VTzFPvVt5W8FcoVzBYqFkcW1Bbnlv5XEBcT1xxXfJepl76XwBfCF8PX1NfhWAdYJRiS2JnYulj0GU+ZbBluWXgZwhnLGc6Z35n5WgHaIVoy2oha2VsNHC5dTV2hHbYdwt5Onn7enp6+XtJe4B+on7If26AA4DcgRGEPYuui76L94wxjXCN749uj9SQCZXtlr6XUpiYmM6eZJ7R/wj/DP///+HgOt7P0GDQV7JlslyyW7I/sj2yMLHmsdyxwLG1saKxEa8qrwCuv65FrimtIqysrIqpnKmLqVSpTagdp2KlL6TipIikQqQ0pBOik6HgoY2hiKGBoXuhOKEHoHCf+p5EnimdqJzCm1Wa5JrcmraZj5ltmWCZHZi3mJaYGZfUln+VPJRuj+qLb4ohic6JnIduhq6GMIWyhWOFLYIMgeeBQoCuf9Z/onx3dQd0+HTAdIdzSXLLcU1w6HC0atFqAWluaCln9GJfYfMBygHIAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACcB2gADAAEECQAAAFQAAAADAAEECQABABoAVAADAAEECQACAA4AbgADAAEECQADAE4AfAADAAEECQAEABoAVAADAAEECQAFAEoAygADAAEECQAGACwBFAADAAEECQAHAEQBQAADAAEECQAIAAoBhAADAAEECQAJAdwBjgADAAEECQAKAYQDagADAAEECQALADoE7gADAAEECQAMADQFKAADAAEECQANApYFXAADAAEECQAOADQH8gADAAEECQARABQIJgADAAEECQEAAA4AbgADAAEECQECABQIJgADAAEECQEDAAoIOgADAAEECQEEAA4AbgADAAEECQEFAAwIRAADAAEECQEGABAIUAADAAEECQEHAAgIYAADAAEECQEIAAoIaAADAAEECQEJAAwIcgADAAEECQEKABQIJgADAAEECQELACwBFAADAAEECQEMAAoIOgADAAEECQENACIIfgADAAEECQEOAA4AbgADAAEECQEPACYIoAADAAEECQEQAAwIRAADAAEECQERACQIxgADAAEECQESABAIUAADAAEECQETACgI6gADAAEECQEUAAgIYAADAAEECQEVACAJEgADAAEECQEWAAoIaAADAAEECQEXACIJMgCpACAAMgAwADEANwAtADIAMAAyADMAIABBAGQAbwBiAGUAIAAoAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAGQAbwBiAGUALgBjAG8AbQAvACkALgBOAG8AdABvACAAUwBlAHIAaQBmACAAUwBDAFIAZQBnAHUAbABhAHIAMgAuADAAMAAyADsARwBPAE8ARwA7AE4AbwB0AG8AUwBlAHIAaQBmAFMAQwAtAEUAeAB0AHIAYQBMAGkAZwBoAHQAOwBBAEQATwBCAEUAVgBlAHIAcwBpAG8AbgAgADIALgAwADIAOwAyADQAMQAxADEANAAyADAANAA1ADUAOAA7AG4AbwBuAC0AcgBlAGwAZQBhAHMAZQBOAG8AdABvAFMAZQByAGkAZgBTAEMALQBFAHgAdAByAGEATABpAGcAaAB0AE4AbwB0AG8AIABpAHMAIABhACAAdAByAGEAZABlAG0AYQByAGsAIABvAGYAIABHAG8AbwBnAGwAZQAgAEkAbgBjAC4AQQBkAG8AYgBlAFIAeQBvAGsAbwAgAE4ASQBTAEgASQBaAFUASwBBACCJf1habbxbUAAgACgAawBhAG4AYQAgACYAIABpAGQAZQBvAGcAcgBhAHAAaABzACkAOwAgAEYAcgBhAG4AawAgAEcAcgBpAGUA3wBoAGEAbQBtAGUAcgAgACgATABhAHQAaQBuACwAIABHAHIAZQBlAGsAIAAmACAAQwB5AHIAaQBsAGwAaQBjACkAOwAgAFcAZQBuAGwAbwBuAGcAIABaAEgAQQBOAEcAIF8gZYefmQAgACgAYgBvAHAAbwBtAG8AZgBvACkAOwAgAFMAYQBuAGQAbwBsAGwAIABDAG8AbQBtAHUAbgBpAGMAYQB0AGkAbwBuAHMAIMCws8zO5LukssjPAMd0wVgALAAgAFMAbwBvAGgAeQB1AG4AIABQAEEAUgBLACC8FcIY1gQALAAgAFkAZQBqAGkAbgAgAFcARQAgxwTGCMnEACAAJgAgAEQAbwBuAGcAaABvAG8AbgAgAEgAQQBOACDVXLPZ1sgAIAAoAGgAYQBuAGcAdQBsACAAZQBsAGUAbQBlAG4AdABzACwAIABsAGUAdAB0AGUAcgBzACAAJgAgAHMAeQBsAGwAYQBiAGwAZQBzACkARAByAC4AIABLAGUAbgAgAEwAdQBuAGQAZQAgACgAcAByAG8AagBlAGMAdAAgAGEAcgBjAGgAaQB0AGUAYwB0ACwAIABnAGwAeQBwAGgAIABzAGUAdAAgAGQAZQBmAGkAbgBpAHQAaQBvAG4AIAAmACAAbwB2AGUAcgBhAGwAbAAgAHAAcgBvAGQAdQBjAHQAaQBvAG4AKQA7ACAATQBhAHMAYQB0AGEAawBhACAASABBAFQAVABPAFIASQAgZw2Q6GtjjLQAIAAoAHAAcgBvAGQAdQBjAHQAaQBvAG4AIAAmACAAaQBkAGUAbwBnAHIAYQBwAGgAIABlAGwAZQBtAGUAbgB0AHMAKQA7ACAAWgBhAGMAaABhAHIAeQAgAFEAdQBpAG4AbgAgAFMAYwBoAGUAdQByAGUAbgAgACgAdgBhAHIAaQBhAGIAbABlACAAZgBvAG4AdAAgACYAIABvAHYAZQByAGEAbABsACAAcAByAG8AZAB1AGMAdABpAG8AbgApAGgAdAB0AHAAcwA6AC8ALwBmAG8AbgB0AHMALgBnAG8AbwBnAGwAZQAuAGMAbwBtAC8AbgBvAHQAbwBoAHQAdABwADoALwAvAHcAdwB3AC4AYQBkAG8AYgBlAC4AYwBvAG0ALwB0AHkAcABlAC8AVABoAGkAcwAgAEYAbwBuAHQAIABTAG8AZgB0AHcAYQByAGUAIABpAHMAIABsAGkAYwBlAG4AcwBlAGQAIAB1AG4AZABlAHIAIAB0AGgAZQAgAFMASQBMACAATwBwAGUAbgAgAEYAbwBuAHQAIABMAGkAYwBlAG4AcwBlACwAIABWAGUAcgBzAGkAbwBuACAAMQAuADEALgAgAFQAaABpAHMAIABGAG8AbgB0ACAAUwBvAGYAdAB3AGEAcgBlACAAaQBzACAAZABpAHMAdAByAGkAYgB1AHQAZQBkACAAbwBuACAAYQBuACAAIgBBAFMAIABJAFMAIgAgAEIAQQBTAEkAUwAsACAAVwBJAFQASABPAFUAVAAgAFcAQQBSAFIAQQBOAFQASQBFAFMAIABPAFIAIABDAE8ATgBEAEkAVABJAE8ATgBTACAATwBGACAAQQBOAFkAIABLAEkATgBEACwAIABlAGkAdABoAGUAcgAgAGUAeABwAHIAZQBzAHMAIABvAHIAIABpAG0AcABsAGkAZQBkAC4AIABTAGUAZQAgAHQAaABlACAAUwBJAEwAIABPAHAAZQBuACAARgBvAG4AdAAgAEwAaQBjAGUAbgBzAGUAIABmAG8AcgAgAHQAaABlACAAcwBwAGUAYwBpAGYAaQBjACAAbABhAG4AZwB1AGEAZwBlACwAIABwAGUAcgBtAGkAcwBzAGkAbwBuAHMAIABhAG4AZAAgAGwAaQBtAGkAdABhAHQAaQBvAG4AcwAgAGcAbwB2AGUAcgBuAGkAbgBnACAAeQBvAHUAcgAgAHUAcwBlACAAbwBmACAAdABoAGkAcwAgAEYAbwBuAHQAIABTAG8AZgB0AHcAYQByAGUALgBoAHQAdABwADoALwAvAHMAYwByAGkAcAB0AHMALgBzAGkAbAAuAG8AcgBn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AFgAOgBaAFoAPQBcAFwAPgBeAF4APwDGAMoAQADhAOEARQACAD8AAwADABQABAAEABoABwAHABsACAAIABQACQAJABAACgAKABEACwALABUADQANABIADgAOAA0ADwAPABIAEAAQABwAGwAcABYAIAAgAB0AIQAhAB4AIgAiAAEAIwAjAB8AJAAkABcAJQAlABMAJgAmAAUAJwAnACAAKAAoACEAKQAqAAgAKwArACIALAAsACMALQAtACQALgAuAAgALwAvAA4AMQAxACUAMwAzACYANAA0ACcANQA1ACgANgA2AAMANwA3ACkAOAA4ACoAOQA5ACsAOgA6AAwAOwA7ACwAPAA8ABAAPQA9AC0APgA+ABEAQABAAC4AQgBCAAIAQwBDAAQARABEABgARQBFAA8ARgBGAAYARwBHABkASQBJAAoASgBKAAsATQBNAA8ATgBPAAoAUABRAAQAVgBWAAcAVwBYAAkAWgBaAAkAXABcABAAXgBeABEAxgDGABkAxwDHAAsAyADIAA8AyQDJAAsAygDKAA8A4QDhABIAAgBDAAIAAgAYAAMAAwAUAAQABAAZAAcABwAaAAgACAAUAAkACQARAAoACgASAAsACwAVAA0ADQATAA4ADgANAA8ADwATABAAEAAbABsAHAAWACAAIAAcACEAIQAdACIAIgAFACMAIwACACQAJAADACUAJwACACgAKAADACkAKgACACsAKwAeACwALQACAC4ALwAJADAAMAADADEAMQACADIAMgADADMAMwACADQANAAfADUANQAgADYANgAGADcANwAhADgAOAAiADkAOQAjADoAOgAMADsAOwAkADwAPAARAD0APQAlAD4APgASAEAAQAAmAEIAQgAEAEMAQwAPAEQARgABAEcARwAKAEgASAAnAEkASQAPAEoASgAOAEsASwAoAEwATQAPAE4ATwAIAFAAUAABAFEAUQApAFIAUgABAFMAUwAIAFQAVAAqAFUAVQArAFYAVgAHAFcAWAAXAFkAWQAsAFoAWgALAFsAWwAtAFwAXAARAF4AXgASAGIAYgAQAMYAygAKANQA1AAQAOEA4QATAAAARIAAAAAACYAAAAAAPYAAAAAACIAAAAAAR4AAAAAAEYAAAAAAVIAAAAAATIAAAAAATYAAAAAASYAAAAAAFoAAAAAAQYAAAAAAWYAA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ADCAAAAAACyAAAAAAB2AAAAAADGAAAAAACGAAAAAABCAAAAAACeAAAAAABqAAAAAABGAAAAAAByAAAAAACKAAAAAACWAAAAAACaAAAAAAC2AAAAAADOAAAAAAB6AAAAAACqAAAAAAC6AAAAAAB+AAAAAACiAAAAAAAEAAAAKAHAAqAAGREZMVAAmY3lybABAZ3JlawBAaGFuaQAqa2FuYQAqbGF0bgBAAA4AAAAKAAFaSFMgAC4AAP//AAMAAAADAAQACgABWkhTIAAYAAD//wAEAAAAAQADAAQAAP//AAQAAAACAAMABAAFbGlnYQAgbG9jbAAmbG9jbAAsdmVydAAydnJ0MgAyAAAAAQAAAAAAAQABAAAAAQACAAAAAQADAAQACgBOAIIAnAAEAAAAAQAIAAEANgABAAgABQAMABQAHAAiACgAyQADAEcASgDKAAMARwBNAMYAAgBHAMcAAgBKAMgAAgBNAAEAAQBHAAEAAAABAAgAAgAcAAsA1wDYANkA2gDbANwA3QDeAN8A4ADhAAIAAgARABoAAABgAGAACgABAAAAAQAIAAIACgACANUA1gABAAIAAwAIAAEAAAABAAgAAgAUAAcAzQDMANAA0QDOAM8AywABAAcAYABiAGMAZADSANMA1AAAAAEAAAAAABQAAAB7AAAAAAAAAAAAAQAAABAAAgAAABoAAABbAAEAAQAAQABAAAA5AAAAAQAA9PYACw4RFRYXGhscICEjJCUmKCkqLC0uLzAxMjQ1Njc4OTo+P0BBQkNERUZISUpLTE5PUlNbXGJvAAIAAQABAAAAiQCmAAUA2AIANUAxMDMXLykpBBUFFwU2KwEqKywqKi8qJwUFFRUVMjgeLAcQCw4MBhMbKg0aEA8jDyohKhMRLRoJFB82HxUhCB0lHCAbCiIYDRY0EiUXHCYkLhoaGSErKCIOAxQDFQICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAh4ZLC83AgICAgICAgICAkE1MAAAAQABAAgAAQAAABQABwAAABwBAHdnaHQBCQAAAA4AIgA2AEoAXgByAIYAAgAAAAABAgDIAAAAyAAAASsAAAAC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";

  // web/src/select-menus.ts
  function enhanceSelectMenus(selects) {
    let openMenu;
    const syncMenus = selects.map((select) => {
      var _a2;
      const label = (_a2 = select.labels) == null ? void 0 : _a2[0];
      const menu = document.createElement("div");
      const trigger = document.createElement("button");
      const value = document.createElement("span");
      const list = document.createElement("div");
      menu.className = "select-menu";
      trigger.type = "button";
      trigger.className = "select-trigger";
      trigger.id = `${select.id}-trigger`;
      list.id = `${select.id}-options`;
      list.className = "select-list";
      list.setAttribute("role", "listbox");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-controls", list.id);
      trigger.setAttribute("aria-expanded", "false");
      if (label) {
        label.id = `${select.id}-label`;
        label.htmlFor = trigger.id;
        value.id = `${select.id}-value`;
        trigger.setAttribute("aria-labelledby", `${label.id} ${value.id}`);
        list.setAttribute("aria-labelledby", label.id);
      }
      list.inert = true;
      function close(restoreFocus = false) {
        if ((openMenu == null ? void 0 : openMenu.element) !== menu) return;
        openMenu = void 0;
        if (restoreFocus && !trigger.disabled) trigger.focus({ preventScroll: true });
        delete menu.dataset.open;
        list.inert = true;
        trigger.setAttribute("aria-expanded", "false");
      }
      const options = Array.from(select.options, (option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.tabIndex = -1;
        button.className = "select-option";
        button.setAttribute("role", "option");
        button.textContent = option.text;
        button.addEventListener("click", () => {
          const changed = select.selectedIndex !== index;
          select.selectedIndex = index;
          close(true);
          sync();
          if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        button.addEventListener("keydown", (event) => {
          let next;
          switch (event.key) {
            case "ArrowDown":
              next = Math.min(index + 1, options.length - 1);
              break;
            case "ArrowUp":
              next = Math.max(index - 1, 0);
              break;
            case "Home":
              next = 0;
              break;
            case "End":
              next = options.length - 1;
              break;
            case "Escape":
              event.preventDefault();
              close(true);
              return;
            case "Tab":
              close(true);
              return;
            default:
              return;
          }
          event.preventDefault();
          options[next].focus();
        });
        list.appendChild(button);
        return button;
      });
      function sync() {
        var _a3, _b;
        trigger.disabled = select.disabled;
        if (trigger.disabled) close();
        value.textContent = (_b = (_a3 = select.selectedOptions[0]) == null ? void 0 : _a3.text) != null ? _b : "";
        options.forEach((button, index) => {
          button.setAttribute("aria-selected", String(index === select.selectedIndex));
        });
      }
      function open() {
        if (trigger.disabled) return;
        openMenu == null ? void 0 : openMenu.close();
        const rect = trigger.getBoundingClientRect();
        const above = rect.top - 12;
        const below = window.innerHeight - rect.bottom - 12;
        const opensAbove = below < options.length * 44 + 10 && above > below;
        menu.dataset.side = opensAbove ? "above" : "below";
        list.style.maxHeight = `${Math.max(44, opensAbove ? above : below)}px`;
        openMenu = { element: menu, close };
        menu.dataset.open = "";
        list.inert = false;
        trigger.setAttribute("aria-expanded", "true");
        options[Math.max(0, select.selectedIndex)].focus({ preventScroll: true });
      }
      trigger.addEventListener("click", () => {
        if ((openMenu == null ? void 0 : openMenu.element) === menu) close();
        else open();
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        open();
      });
      select.addEventListener("change", sync);
      trigger.appendChild(value);
      menu.append(trigger, list);
      select.after(menu);
      select.hidden = true;
      sync();
      return sync;
    });
    const closeOutside = (event) => {
      if (openMenu && event.target instanceof Node && !openMenu.element.contains(event.target)) openMenu.close();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => syncMenus.forEach((sync) => sync());
  }

  // web/src/main.ts
  var SIZE = 420;
  var LAYOUT = { size: SIZE, padding: 50 };
  var POINT_LABELS = {
    1: "\u98CE",
    2: "\u5C71",
    3: "\u677E",
    4: "\u4E91",
    5: "\u6708",
    6: "\u7AF9",
    7: "\u9E64",
    8: "\u6C34",
    9: "\u6885"
  };
  var THEME_KEY = "arrow-chess-theme";
  var inkTheme = false;
  try {
    inkTheme = localStorage.getItem(THEME_KEY) === "ink";
  } catch (e) {
  }
  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var elPoints = document.getElementById("points");
  var elArena = document.getElementById("arena");
  var elPlayers = { red: document.getElementById("redPlayer"), black: document.getElementById("blackPlayer") };
  var elRoles = { red: document.getElementById("redRole"), black: document.getElementById("blackRole") };
  var elTurnCount = document.getElementById("turnCount");
  var elDetail = document.getElementById("statusDetail");
  var elHistoryCount = document.getElementById("historyCount");
  var elHistoryEmpty = document.getElementById("historyEmpty");
  var elHistoryPanel = document.getElementById("historyPanel");
  var elSound = document.getElementById("sound");
  var elTheme = document.getElementById("theme");
  var elThemeColor = document.querySelector('meta[name="theme-color"]');
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var effect;
  var animationFrame = 0;
  var invalidPoint = null;
  function resizeBoard() {
    const width = canvas.getBoundingClientRect().width || SIZE;
    const pixels = Math.round(width * Math.min(window.devicePixelRatio || 1, 3));
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    ctx.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
    render();
  }
  function clearEffect() {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    effect = void 0;
  }
  function feedback(next) {
    clearEffect();
    playSound(next.kind);
    if (reducedMotion.matches || document.hidden || state.replayIdx >= 0) return;
    const started = performance.now();
    const duration = next.kind === "win" ? 680 : 340;
    const frame = (now) => {
      const progress = Math.max(0, (now - started) / duration);
      effect = progress < 1 ? __spreadProps(__spreadValues({}, next), { progress }) : void 0;
      animationFrame = effect ? window.requestAnimationFrame(frame) : 0;
      render();
    };
    frame(started);
  }
  var elMode = document.getElementById("mode");
  var elHumanSide = document.getElementById("humanSide");
  var elDifficulty = document.getElementById("difficulty");
  var elFirst = document.getElementById("first");
  var syncSettings = enhanceSelectMenus([elMode, elFirst, elHumanSide, elDifficulty]);
  var elStatus = document.getElementById("status");
  var elMovelist = document.getElementById("movelist");
  var elReplayInfo = document.getElementById("replayInfo");
  var elUndo = document.getElementById("undo");
  var elHint = document.getElementById("hint");
  var elStepBack = document.getElementById("stepBack");
  var elStepFwd = document.getElementById("stepFwd");
  var elToLive = document.getElementById("toLive");
  var state = {
    mode: elMode.value,
    difficulty: elDifficulty.value,
    humanSide: elHumanSide.value,
    first: elFirst.value,
    phase: "placing",
    placeStep: 0,
    red: null,
    black: null,
    game: null,
    initialGame: null,
    history: [],
    stack: [],
    selected: null,
    lastMove: null,
    hint: null,
    replayIdx: -1,
    aiPending: false
  };
  function aiPlayer() {
    return opponent(state.humanSide);
  }
  function emptyEdges() {
    return Array.from({ length: EDGE_COUNT }, () => emptyEdge());
  }
  function currentView() {
    if (state.phase === "placing" || !state.game) {
      return { view: { edges: emptyEdges(), red: state.red, black: state.black }, live: null };
    }
    if (state.replayIdx >= 0 && state.initialGame) {
      let s = state.initialGame;
      for (let i = 0; i <= state.replayIdx && i < state.history.length; i++) {
        s = applyMove(s, state.history[i]);
      }
      return { view: { edges: s.edges, red: s.tokens.red, black: s.tokens.black }, live: s };
    }
    const g = state.game;
    return { view: { edges: g.edges, red: g.tokens.red, black: g.tokens.black }, live: g };
  }
  function render() {
    var _a2;
    const { view, live } = currentView();
    const opts = { engraved: true, pointLabels: POINT_LABELS, effect: state.replayIdx < 0 ? effect : void 0 };
    if (state.phase === "placing") {
      opts.placement = { next: state.placeStep === 0 ? "red" : "black" };
    } else if (live) {
      opts.selected = state.selected;
      opts.lastMove = state.replayIdx >= 0 ? (_a2 = state.history[state.replayIdx]) != null ? _a2 : null : state.lastMove;
      opts.hint = state.replayIdx < 0 ? state.hint : null;
      const humanTurn = state.phase === "playing" && state.replayIdx < 0 && !(state.mode === "ai" && live.turn === aiPlayer());
      if (humanTurn) {
        opts.legalTargets = legalMoves(live).map((m) => m.to);
      }
    }
    ctx.clearRect(0, 0, SIZE, SIZE);
    renderBoard(ctx, view, LAYOUT, boardTheme(inkTheme), opts);
  }
  var sideName = { red: "\u7EA2\u65B9", black: "\u9ED1\u65B9" };
  function updateBoardStatus() {
    const { view, live } = currentView();
    const placing = state.phase === "placing";
    const replaying = state.replayIdx >= 0;
    const over = !replaying && state.phase === "over" && live ? gameResult(live) : null;
    const active = placing ? state.placeStep === 0 ? "red" : "black" : live == null ? void 0 : live.turn;
    const thinking = state.mode === "ai" && active === aiPlayer();
    const options = !placing && !replaying && !over && !thinking && live ? legalMoves(live) : [];
    for (const side of ["red", "black"]) {
      elPlayers[side].classList.toggle("active", replaying ? false : (over == null ? void 0 : over.over) ? side === over.winner : side === active);
      elRoles[side].textContent = state.mode === "ai" ? side === state.humanSide ? "\u4F60" : "AI" : "";
      elRoles[side].hidden = state.mode !== "ai";
    }
    elArena.classList.toggle("finished", !!(over == null ? void 0 : over.over));
    elTurnCount.textContent = placing ? `\u653E\u7F6E ${state.placeStep + 1} / 2` : replaying ? `\u56DE\u653E ${state.replayIdx + 1} / ${state.history.length}` : (over == null ? void 0 : over.over) ? "\u7EC8\u5C40" : `\u7B2C ${state.history.length + 1} \u624B`;
    elStatus.textContent = replaying ? `\u56DE\u653E\u7B2C ${state.replayIdx + 1} \u624B` : placing && active ? `\u8BF7\u653E\u7F6E${sideName[active]}\u68CB\u5B50` : (over == null ? void 0 : over.over) ? `${sideName[over.winner]}\u80DC` : active && thinking ? `AI\uFF08${sideName[active]}\uFF09\u601D\u8003\u4E2D\u2026` : active && state.mode === "ai" ? `\u8F6E\u5230\u4F60\uFF08${sideName[active]}\uFF09` : active ? `\u8F6E\u5230${sideName[active]}` : "";
    elDetail.textContent = replaying ? "\u53EF\u4ECE\u68CB\u8C31\u9009\u62E9\u8D70\u6CD5\uFF0C\u6216\u8FD4\u56DE\u5B9E\u51B5\u3002" : (over == null ? void 0 : over.over) ? `${sideName[over.loser]}\u65E0\u8DEF\u53EF\u8D70\u3002` : invalidPoint ? `\u300C${POINT_LABELS[invalidPoint]}\u300D${placing ? "\u5DF2\u6709\u68CB\u5B50" : "\u5F53\u524D\u4E0D\u53EF\u843D\u5B50"}\u3002` : placing ? "\u9009\u62E9\u68CB\u76D8\u4E0A\u7684\u4E00\u4E2A\u7A7A\u70B9\u3002" : thinking ? "\u7B49\u5F85\u7535\u8111\u843D\u5B50\u3002" : state.hint ? `\u5EFA\u8BAE\u4ECE\u300C${POINT_LABELS[state.hint.from]}\u300D\u79FB\u5230\u300C${POINT_LABELS[state.hint.to]}\u300D\u3002` : `${options.length} \u4E2A\u53EF\u8D70\u843D\u70B9\uFF0C\u5DF2\u5728\u68CB\u76D8\u4E0A\u6807\u4EAE\u3002`;
    pointButtons.forEach((button, index) => {
      var _a2;
      const point = POINTS[index];
      const hasToken = point === view.red || point === view.black;
      const legal = options.some((move) => move.to === point) || placing && !hasToken;
      const label = point === view.red ? "\u7EA2\u65B9\u68CB\u5B50" : point === view.black ? "\u9ED1\u65B9\u68CB\u5B50" : point === ((_a2 = state.hint) == null ? void 0 : _a2.to) ? "\u63D0\u793A\u843D\u70B9" : legal ? "\u53EF\u843D\u5B50" : "\u7A7A\u70B9";
      button.setAttribute("aria-label", `${POINT_LABELS[point]}\uFF0C${label}`);
    });
  }
  function updateStatus() {
    var _a2, _b;
    updateBoardStatus();
    document.body.classList.toggle("ai", state.mode === "ai");
    const inPlay = state.phase === "playing" || state.phase === "over";
    elHumanSide.disabled = state.phase !== "placing";
    elFirst.disabled = state.phase !== "placing";
    syncSettings();
    elUndo.disabled = !inPlay || !canUndo();
    elHint.disabled = state.replayIdx >= 0 || state.phase !== "playing" || state.mode === "ai" && ((_a2 = state.game) == null ? void 0 : _a2.turn) === aiPlayer();
    elStepBack.disabled = state.history.length === 0;
    elStepFwd.disabled = state.replayIdx < 0;
    elToLive.disabled = state.replayIdx < 0;
    elReplayInfo.textContent = state.replayIdx >= 0 ? `\u56DE\u653E\u4E2D\uFF08\u6B65 ${state.replayIdx + 1}/${state.history.length}\uFF09` : "";
    elHistoryCount.textContent = `${state.history.length} \u624B`;
    elHistoryEmpty.hidden = state.history.length > 0;
    while (elMovelist.children.length > state.history.length) (_b = elMovelist.lastElementChild) == null ? void 0 : _b.remove();
    const previousCount = elMovelist.children.length;
    state.history.slice(previousCount).forEach((m, offset) => {
      const i = previousCount + offset;
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-move";
      button.innerHTML = `<span class="move-number">${i + 1}</span><span class="move-side ${m.player}">${sideName[m.player]}</span><span class="move-path">${POINT_LABELS[m.from]} \u2192 ${POINT_LABELS[m.to]}</span>`;
      button.setAttribute("aria-label", `\u7B2C ${i + 1} \u624B\uFF0C${sideName[m.player]}\uFF0C\u4ECE${POINT_LABELS[m.from]}\u5230${POINT_LABELS[m.to]}`);
      button.addEventListener("click", () => {
        clearEffect();
        state.replayIdx = i;
        state.hint = null;
        invalidPoint = null;
        render();
        updateStatus();
      });
      li.appendChild(button);
      elMovelist.appendChild(li);
    });
    Array.from(elMovelist.children).forEach((li, i) => {
      const button = li.firstElementChild;
      if (i === state.replayIdx) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    if (state.replayIdx < 0 && state.history.length > previousCount) elMovelist.scrollTop = elMovelist.scrollHeight;
  }
  var aiTimer = null;
  var sessionGeneration = 0;
  function cancelAI() {
    sessionGeneration++;
    if (aiTimer !== null) clearTimeout(aiTimer);
    aiTimer = null;
    state.aiPending = false;
  }
  function scheduleAI() {
    if (state.mode !== "ai" || !state.game || state.phase !== "playing") return;
    if (state.game.turn !== aiPlayer()) return;
    if (state.aiPending) return;
    state.aiPending = true;
    const generation = sessionGeneration;
    aiTimer = setTimeout(() => {
      if (generation !== sessionGeneration) return;
      aiTimer = null;
      state.aiPending = false;
      if (state.mode !== "ai" || !state.game || state.phase !== "playing" || state.game.turn !== aiPlayer()) return;
      const m = aiMove(state.game, aiPlayer(), state.difficulty);
      if (m) doMove(m);
    }, 320);
  }
  function doMove(move) {
    if (!state.game || !isLegal(state.game, move)) return false;
    state.stack.push(state.game);
    state.game = applyMove(state.game, move);
    state.history.push(move);
    state.lastMove = move;
    state.selected = null;
    state.hint = null;
    invalidPoint = null;
    const res = gameResult(state.game);
    state.phase = res.over ? "over" : "playing";
    const closed = state.game.edges[edgeIdBetween(move.from, move.to)].arrows === 2;
    feedback({ point: move.to, from: move.from, player: move.player, kind: res.over ? "win" : closed ? "close" : "claim" });
    if (state.phase === "playing") scheduleAI();
    render();
    updateStatus();
    return true;
  }
  function rejectPoint(point) {
    invalidPoint = point;
    feedback({ point, kind: "invalid" });
    updateBoardStatus();
  }
  function handleClick(p) {
    if (state.phase === "placing") {
      placeToken(p);
      return;
    }
    if (state.replayIdx >= 0) {
      toLive();
      return;
    }
    if (!state.game || state.phase !== "playing") return;
    if (state.mode === "ai" && state.game.turn === aiPlayer()) return;
    const g = state.game;
    const legal = legalMoves(g);
    const target = legal.find((m) => m.to === p);
    if (target) {
      doMove(target);
      return;
    }
    if (p === g.tokens[g.turn]) {
      invalidPoint = null;
      state.selected = state.selected === p ? null : p;
      state.hint = null;
    } else {
      state.selected = null;
      rejectPoint(p);
    }
    render();
    updateStatus();
  }
  function placeToken(p) {
    const player = state.placeStep === 0 ? "red" : "black";
    if (p === state.red || p === state.black) {
      rejectPoint(p);
      return;
    }
    invalidPoint = null;
    if (state.placeStep === 0) {
      state.red = p;
      state.placeStep = 1;
    } else {
      state.black = p;
      state.game = createGame(state.red, state.black, state.first);
      state.initialGame = state.game;
      state.phase = "playing";
      state.history = [];
      state.stack = [];
      state.lastMove = null;
      state.selected = null;
      state.hint = null;
      state.replayIdx = -1;
      if (state.mode === "ai" && state.game.turn === aiPlayer()) scheduleAI();
    }
    feedback({ point: p, player, kind: "place" });
    render();
    updateStatus();
  }
  function undo() {
    if (!canUndo()) return;
    cancelAI();
    clearEffect();
    invalidPoint = null;
    playSound("control");
    do {
      state.game = state.stack.pop();
      state.history.pop();
    } while (state.mode === "ai" && state.game.turn !== state.humanSide && state.stack.length > 0);
    state.lastMove = state.history.length > 0 ? state.history[state.history.length - 1] : null;
    state.phase = "playing";
    state.selected = null;
    state.hint = null;
    state.replayIdx = -1;
    render();
    updateStatus();
  }
  function canUndo() {
    return !state.aiPending && state.phase !== "placing" && !!state.game && state.stack.length > 0 && (state.mode !== "ai" || state.stack.some((g) => g.turn === state.humanSide));
  }
  function showHint() {
    if (state.replayIdx >= 0) return;
    if (state.phase !== "playing" || !state.game) return;
    if (state.mode === "ai" && state.game.turn === aiPlayer()) return;
    const m = bestMove(state.game, 4, state.game.turn);
    invalidPoint = null;
    state.hint = m;
    state.selected = null;
    if (m) feedback({ point: m.to, kind: "hint" });
    render();
    updateStatus();
  }
  function stepBack() {
    if (state.history.length === 0) return;
    clearEffect();
    invalidPoint = null;
    state.hint = null;
    if (state.replayIdx < 0) state.replayIdx = state.history.length - 1;
    else state.replayIdx = Math.max(0, state.replayIdx - 1);
    render();
    updateStatus();
  }
  function stepFwd() {
    if (state.replayIdx < 0) return;
    state.replayIdx++;
    if (state.replayIdx >= state.history.length) state.replayIdx = -1;
    render();
    updateStatus();
  }
  function toLive() {
    state.replayIdx = -1;
    render();
    updateStatus();
  }
  function newGame() {
    cancelAI();
    clearEffect();
    invalidPoint = null;
    state.phase = "placing";
    state.placeStep = 0;
    state.red = null;
    state.black = null;
    state.game = null;
    state.initialGame = null;
    state.history = [];
    state.stack = [];
    state.selected = null;
    state.lastMove = null;
    state.hint = null;
    state.replayIdx = -1;
    state.aiPending = false;
    render();
    updateStatus();
  }
  var pointButtons = POINTS.map((point, index) => {
    const button = document.createElement("button");
    const position = pointXY(LAYOUT, point);
    button.type = "button";
    button.className = "point";
    button.style.left = `${position.x / SIZE * 100}%`;
    button.style.top = `${position.y / SIZE * 100}%`;
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener("focus", () => {
      pointButtons.forEach((other) => {
        other.tabIndex = other === button ? 0 : -1;
      });
    });
    button.addEventListener("click", () => handleClick(point));
    button.addEventListener("keydown", (event) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      let next = index;
      switch (event.key) {
        case "ArrowLeft":
          if (col > 0) next--;
          break;
        case "ArrowRight":
          if (col < 2) next++;
          break;
        case "ArrowUp":
          if (row > 0) next -= 3;
          break;
        case "ArrowDown":
          if (row < 2) next += 3;
          break;
        default:
          return;
      }
      event.preventDefault();
      pointButtons[next].focus();
    });
    elPoints.appendChild(button);
    return button;
  });
  function updateSoundButton() {
    const enabled2 = soundEnabled();
    elSound.setAttribute("aria-pressed", String(enabled2));
    elSound.title = enabled2 ? "\u5173\u95ED\u97F3\u6548" : "\u5F00\u542F\u97F3\u6548";
  }
  function updateTheme() {
    document.body.dataset.theme = inkTheme ? "ink" : "bamboo";
    elTheme.setAttribute("aria-pressed", String(inkTheme));
    elTheme.title = inkTheme ? "\u5207\u6362\u5230\u7AF9\u9752\u4E3B\u9898" : "\u5207\u6362\u5230\u58A8\u591C\u4E3B\u9898";
    if (elThemeColor) elThemeColor.content = inkTheme ? "#192820" : "#eeefe5";
  }
  elMode.addEventListener("change", () => {
    state.mode = elMode.value;
    newGame();
  });
  elHumanSide.addEventListener("change", () => {
    state.humanSide = elHumanSide.value;
    updateStatus();
  });
  elDifficulty.addEventListener("change", () => {
    state.difficulty = elDifficulty.value;
  });
  elFirst.addEventListener("change", () => {
    state.first = elFirst.value;
  });
  document.getElementById("newGame").addEventListener("click", () => {
    playSound("control");
    newGame();
  });
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("hint").addEventListener("click", showHint);
  document.getElementById("stepBack").addEventListener("click", stepBack);
  document.getElementById("stepFwd").addEventListener("click", stepFwd);
  document.getElementById("toLive").addEventListener("click", toLive);
  elSound.addEventListener("click", () => {
    toggleSound();
    updateSoundButton();
  });
  elTheme.addEventListener("click", () => {
    inkTheme = !inkTheme;
    try {
      localStorage.setItem(THEME_KEY, inkTheme ? "ink" : "bamboo");
    } catch (e) {
    }
    updateTheme();
    render();
  });
  elHistoryPanel.addEventListener("toggle", () => {
    if (elHistoryPanel.open && state.replayIdx < 0) elMovelist.scrollTop = elMovelist.scrollHeight;
  });
  window.addEventListener("resize", resizeBoard);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resizeBoard).observe(canvas);
  var _a;
  (_a = reducedMotion.addEventListener) == null ? void 0 : _a.call(reducedMotion, "change", () => {
    clearEffect();
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearEffect();
      render();
    }
  });
  updateTheme();
  resizeBoard();
  updateSoundButton();
  updateStatus();
  if (typeof FontFace !== "undefined" && document.fonts) {
    const brush = new FontFace("Arrow Brush", `url("${brush_default}")`);
    document.fonts.add(brush);
    void brush.load().then(render).catch(() => {
    });
    const ming = new FontFace("Arrow Ming", `url("${ming_default}")`, { weight: "200 900" });
    document.fonts.add(ming);
    void ming.load().catch(() => {
    });
  }
})();
