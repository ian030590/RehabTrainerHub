import assert from 'node:assert/strict';

// Browser drivers for the brain games moved from the legacy shell to R2 packages in the 2026-10-22 batch.
// Each one sets a short session, plays it with real browser input and states what the saved record must contain.

// Win when possible, block next, else the first empty cell: enough to finish any board game against the computer.
function PickLineMove(marks, size, winLength) {
  const empty = marks.flatMap((mark, index) => mark ? [] : [index]);
  const wins = mark => empty.find(index => {
    const trial = [...marks];
    trial[index] = mark;
    return HasLine(trial, size, winLength, mark);
  });
  return wins('X') ?? wins('O') ?? empty[0];
}
function HasLine(marks, size, winLength, mark) {
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      let count = 0;
      while (count < winLength) {
        const r = row + dy * count, c = col + dx * count;
        if (r < 0 || r >= size || c < 0 || c >= size || marks[r * size + c] !== mark) break;
        count++;
      }
      if (count >= winLength) return true;
    }
  }
  return false;
}

// Connect 4 board is 6 rows by 7 columns, row 0 at the top; P is the player and A the computer.
const c4Rows = 6, c4Cols = 7;
function C4DropRow(marks, col) {
  for (let row = c4Rows - 1; row >= 0; row--) if (!marks[row * c4Cols + col]) return row;
  return null;
}
function C4Wins(marks, col, mark) {
  const row = C4DropRow(marks, col);
  if (row === null) return false;
  const trial = [...marks];
  trial[row * c4Cols + col] = mark;
  for (let r = 0; r < c4Rows; r++) for (let c = 0; c < c4Cols; c++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    let count = 0;
    while (count < 4) {
      const rr = r + dy * count, cc = c + dx * count;
      if (rr < 0 || rr >= c4Rows || cc < 0 || cc >= c4Cols || trial[rr * c4Cols + cc] !== mark) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

// Hex cells touch six neighbors; the player joins the top and bottom rows, the computer the left and right columns.
function HexNeighbors(index, n) {
  const row = Math.floor(index / n), col = index % n;
  return [[row - 1, col], [row - 1, col + 1], [row, col - 1], [row, col + 1], [row + 1, col - 1], [row + 1, col]]
    .filter(([r, c]) => r >= 0 && r < n && c >= 0 && c < n).map(([r, c]) => r * n + c);
}
function HexJoined(marks, n, mark) {
  const seen = new Set(), queue = [];
  for (let step = 0; step < n; step++) {
    const index = mark === 'P' ? step : step * n;
    if (marks[index] === mark) { seen.add(index); queue.push(index); }
  }
  while (queue.length) {
    const index = queue.shift();
    if (mark === 'P' ? Math.floor(index / n) === n - 1 : index % n === n - 1) return true;
    for (const next of HexNeighbors(index, n)) if (marks[next] === mark && !seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return false;
}
function PickHexMove(marks, n) {
  const empty = marks.flatMap((mark, index) => mark ? [] : [index]);
  const completes = mark => empty.find(index => { const trial = [...marks]; trial[index] = mark; return HexJoined(trial, n, mark); });
  const column = Math.floor(n / 2);
  return completes('P') ?? completes('A') ?? empty.find(index => index % n === column) ?? empty[0];
}

// Dots and Boxes with n dots per side: h<row * (n - 1) + col> across, v<row * n + col> down.
function DotsBoxEdges(n, box) {
  const b = n - 1, row = Math.floor(box / b), col = box % b;
  return [`h${row * b + col}`, `h${(row + 1) * b + col}`, `v${row * n + col}`, `v${row * n + col + 1}`];
}
function DotsReadingOrder(n) {
  const order = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n - 1; col++) order.push(`h${row * (n - 1) + col}`);
    if (row < n - 1) for (let col = 0; col < n; col++) order.push(`v${row * n + col}`);
  }
  return order;
}
// Close a box when possible, else a line that leaves no box on three sides, else the first open line.
function PickDotsLine(drawn, n) {
  const open = DotsReadingOrder(n).filter(line => !drawn.has(line));
  const sidesAfter = (line, box) => DotsBoxEdges(n, box).filter(edge => edge === line || drawn.has(edge)).length;
  const touching = line => Array.from({ length: (n - 1) ** 2 }, (_, box) => box).filter(box => DotsBoxEdges(n, box).includes(line));
  return open.find(line => touching(line).some(box => sidesAfter(line, box) === 4))
    ?? open.find(line => touching(line).every(box => sidesAfter(line, box) < 3)) ?? open[0];
}

// Smallest set of presses that turns a small Lights Out board dark, found by trying every subset.
function LightsSolve(lights, n) {
  let best = null;
  for (let mask = 0; mask < 2 ** (n * n); mask++) {
    const board = [...lights];
    const presses = [];
    for (let index = 0; index < n * n; index++) {
      if (!(mask & (1 << index))) continue;
      presses.push(index);
      const [row, col] = [Math.floor(index / n), index % n];
      for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (r >= 0 && r < n && c >= 0 && c < n) board[r * n + c] = !board[r * n + c];
      }
    }
    if (!board.includes(true) && (!best || presses.length < best.length)) best = presses;
  }
  return best;
}

function SlidingNeighbors(index, n) {
  const [row, col] = [Math.floor(index / n), index % n];
  return [row > 0 && index - n, row < n - 1 && index + n, col > 0 && index - 1, col < n - 1 && index + 1].filter(value => value !== false);
}
// Shortest list of cells to tap (each slides into the gap) for a 3 x 3 board, by breadth-first search.
function SlidingSolve(tiles, n) {
  const goal = Array.from({ length: n * n }, (_, index) => (index + 1) % (n * n)).join(',');
  const seen = new Map([[tiles.join(','), null]]);
  const queue = [tiles.join(',')];
  while (queue.length) {
    const key = queue.shift();
    if (key === goal) break;
    const board = key.split(',').map(Number), blank = board.indexOf(0);
    for (const index of SlidingNeighbors(blank, n)) {
      const next = [...board];
      [next[blank], next[index]] = [next[index], 0];
      const nextKey = next.join(',');
      if (!seen.has(nextKey)) { seen.set(nextKey, [key, index]); queue.push(nextKey); }
    }
  }
  const path = [];
  for (let key = goal; seen.get(key); key = seen.get(key)[0]) path.unshift(seen.get(key)[1]);
  return path;
}
// Where an arrow key lands from a cell: one step, or two when the gap is in the way.
function SlidingArrow(index, key, tiles, n) {
  const [dr, dc] = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[key];
  let [row, col] = [Math.floor(index / n) + dr, index % n + dc];
  if (row >= 0 && row < n && col >= 0 && col < n && tiles[row * n + col] === 0) [row, col] = [row + dr, col + dc];
  return row >= 0 && row < n && col >= 0 && col < n ? row * n + col : index;
}

// Reads the maze walls from the SVG path ("M c r h1" is a wall above cell r,c; "M c r v1" a wall to its left)
// and returns the shortest list of directions from one cell to another.
function MazeRoute(path, n, from, to) {
  const horizontal = new Set(), vertical = new Set();
  for (const [, x, y, kind] of path.matchAll(/M(\d+) (\d+)([hv])1/g)) (kind === 'h' ? horizontal : vertical).add(`${y},${x}`);
  const moves = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const open = (index, direction) => {
    const [row, col] = [Math.floor(index / n), index % n];
    const blocked = { up: horizontal.has(`${row},${col}`), down: horizontal.has(`${row + 1},${col}`), left: vertical.has(`${row},${col}`), right: vertical.has(`${row},${col + 1}`) }[direction];
    const [r, c] = [row + moves[direction][0], col + moves[direction][1]];
    return !blocked && r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  };
  const previous = new Map([[from, null]]);
  for (const queue = [from]; queue.length;) {
    const index = queue.shift();
    for (const direction of Object.keys(moves)) {
      const next = open(index, direction);
      if (next !== null && !previous.has(next)) { previous.set(next, [index, direction]); queue.push(next); }
    }
  }
  const route = [];
  for (let at = to; previous.get(at); at = previous.get(at)[0]) route.unshift(previous.get(at)[1]);
  return { route, open };
}

// Fills the blanks of a 3 x 3 magic square so every row, column and diagonal adds up to 15.
function SolveMagicSquare(values) {
  const blanks = values.flatMap((value, index) => value ? [] : [index]);
  const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(digit => !values.includes(digit));
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const Search = (board, left) => {
    if (!left.length) return lines.every(line => line.reduce((sum, index) => sum + board[index], 0) === 15) ? board : null;
    const index = blanks[blanks.length - left.length];
    for (const digit of left) {
      const found = Search(board.map((value, at) => at === index ? digit : value), left.filter(other => other !== digit));
      if (found) return found;
    }
    return null;
  };
  return Search(values, missing);
}

// Works out which covered cells are surely safe or surely mines from the open numbers (cells: number, 'C' covered, 'F' flagged).
function DeduceMines(cells, size, mineCount) {
  const Neighbors = index => {
    const row = Math.floor(index / size), col = index % size, found = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = row + dy, x = col + dx;
      if ((dx || dy) && y >= 0 && y < size && x >= 0 && x < size) found.push(y * size + x);
    }
    return found;
  };
  const hidden = cells.flatMap((value, index) => typeof value === 'number' ? [] : [index]);
  const mines = new Set(), safe = new Set();
  const mark = (set, indices) => { let changed = false; for (const index of indices) if (!set.has(index)) { set.add(index); changed = true; } return changed; };
  for (let changed = true; changed;) {
    changed = false;
    const rules = cells.flatMap((value, index) => {
      if (typeof value !== 'number' || !value) return [];
      const near = Neighbors(index).filter(next => typeof cells[next] !== 'number');
      const unknown = near.filter(next => !mines.has(next) && !safe.has(next));
      return unknown.length ? [{ unknown, need: value - near.filter(next => mines.has(next)).length }] : [];
    });
    for (const { unknown, need } of rules) {
      if (need === 0) changed = mark(safe, unknown) || changed;
      else if (need === unknown.length) changed = mark(mines, unknown) || changed;
    }
    for (const small of rules) for (const large of rules) {
      if (small === large || small.unknown.length >= large.unknown.length || !small.unknown.every(index => large.unknown.includes(index))) continue;
      const rest = large.unknown.filter(index => !small.unknown.includes(index)), need = large.need - small.need;
      if (need === 0) changed = mark(safe, rest) || changed;
      else if (need === rest.length) changed = mark(mines, rest) || changed;
    }
    const open = hidden.filter(index => !mines.has(index) && !safe.has(index));
    if (mines.size === mineCount) changed = mark(safe, open) || changed;
    else if (open.length && open.length === mineCount - mines.size) changed = mark(mines, open) || changed;
  }
  return { mines, safe };
}

export const migratedBrainGameSpecs = {
  'tic-tac-toe': {
    title: { zh: '圈圈叉叉', en: 'Tic Tac Toe' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', soundEnabled: true },
    tutorialTargets: ['.ttt-cell[data-tutorial="move"]', '.ttt-goal', '.ttt-turn', '.ttt-stop'],
    runningSelector: '.ttt-running',
    stopSelector: '.ttt-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'invalidTaps',
    async play({ game, until, tap, press, capture }) {
      const read = () => game(`(() => ({ turn: document.querySelector('.ttt-running .ttt-board')?.dataset.turn ?? '',
        results: Boolean(document.querySelector('.experiment-results')),
        marks: [...document.querySelectorAll('.ttt-running .ttt-cell')].map(cell => cell.dataset.mark ?? '') }))()`);
      const cell = index => `.ttt-running .ttt-cell[data-index="${index}"]`;
      const plan = { moves: 0, filledTaps: 0, keyboard: false, sawOutcome: false };
      await until(async () => (await read()).turn === 'player', 'first turn');
      await capture('gameplay');
      for (;;) {
        const state = await read();
        if (state.results) break;
        if (state.turn === 'over') {
          plan.sawOutcome = await game(`Boolean(document.querySelector('.ttt-outcome'))`);
          await capture('outcome');
          await until(async () => (await read()).results, 'results after the final board', 8000);
          break;
        }
        if (state.turn === 'computer') {
          assert.equal(await game(`document.querySelector('.ttt-turn').textContent.includes('O')`), true, 'The turn label names the computer.');
          await until(async () => (await read()).turn !== 'computer', 'computer move', 5000);
          continue;
        }
        if (plan.moves === 1 && !plan.filledTaps) {
          await tap(cell(state.marks.findIndex(mark => mark === 'O')));
          await until(() => game(`document.querySelector('.ttt-feedback').textContent.length > 0`), 'filled cell feedback');
          plan.filledTaps++;
          continue;
        }
        const index = PickLineMove(state.marks, 3, 3);
        if (plan.moves === 2) {
          await game(`document.querySelector('${cell(index)}').focus()`);
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(cell(index));
        plan.moves++;
        await until(async () => (await read()).marks[index] === 'X' || (await read()).results, `move ${plan.moves} placed`);
      }
      assert.equal(plan.sawOutcome, true, 'The final board stays visible with the outcome before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.boardSize, summary.winLength], [plan.moves, plan.filledTaps, 3, 3]);
      assert.equal(rounds[1].invalidTaps, plan.filledTaps, 'The filled-cell tap belongs to the second move.');
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.row >= 1 && row.row <= 3 && row.col >= 1 && row.col <= 3));
      assert.ok(summary.completed + summary.draw <= 1);
      assert.ok([plan.moves - 1, plan.moves].includes(summary.opponentMoves));
      assert.ok(summary.duration > 0 && summary.meanThinkMs > 0);
    },
  },
  connect4: {
    title: { zh: '四子棋', en: 'Connect 4' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'hard', soundEnabled: true },
    tutorialTargets: ['.c4-column[data-tutorial="move"]', '.c4-goal', '.c4-turn', '.c4-stop'],
    runningSelector: '.c4-running',
    stopSelector: '.c4-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'invalidTaps',
    // The blocking computer stops three in column 1, so stacking there fills it without a line; one tap then lands on the full column.
    async play({ game, until, tap, press, capture }) {
      const read = () => game(`(() => ({ turn: document.querySelector('.c4-running .c4-board')?.dataset.turn ?? '',
        results: Boolean(document.querySelector('.experiment-results')),
        marks: [...document.querySelectorAll('.c4-running .c4-slot')].sort((a, b) => a.dataset.index - b.dataset.index).map(slot => slot.dataset.mark ?? '') }))()`);
      const column = col => `.c4-running .c4-column[data-col="${col}"]`;
      const plan = { moves: 0, filledTaps: 0, filledTapMove: 0, keyboard: false, sawOutcome: false };
      await until(async () => (await read()).turn === 'player', 'first turn');
      await capture('gameplay');
      for (;;) {
        const state = await read();
        if (state.results) break;
        if (state.turn === 'over') {
          plan.sawOutcome = await game(`Boolean(document.querySelector('.c4-outcome'))`);
          await capture('outcome');
          await until(async () => (await read()).results, 'results after the final board', 8000);
          break;
        }
        if (state.turn === 'computer') {
          await until(async () => (await read()).turn !== 'computer', 'computer move', 5000);
          continue;
        }
        const open = [3, 2, 4, 1, 5, 6, 0].filter(col => C4DropRow(state.marks, col) !== null);
        if (C4DropRow(state.marks, 0) === null && !plan.filledTaps) {
          await capture('full-column');
          await tap(column(0));
          await until(() => game(`document.querySelector('.c4-feedback').textContent.length > 0`), 'full column feedback');
          plan.filledTaps++;
          plan.filledTapMove = plan.moves + 1;
          continue;
        }
        const block = open.find(col => C4Wins(state.marks, col, 'A'));
        const col = plan.filledTaps ? open.find(item => C4Wins(state.marks, item, 'P')) ?? block ?? open[0]
          : block ?? 0;
        const before = state.marks.filter(Boolean).length;
        if (plan.moves === 2) {
          await game(`document.querySelector('${column(Math.min(6, col + 1))}').focus()`);
          if (col < 6) await press('ArrowLeft', 'ArrowLeft', 37);
          assert.equal(await game(`document.activeElement?.dataset.col`), String(col), 'Arrow keys move between columns.');
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(column(col));
        plan.moves++;
        await until(async () => { const next = await read(); return next.results || next.marks.filter(Boolean).length > before; }, `move ${plan.moves} placed`);
      }
      assert.equal(plan.sawOutcome, true, 'The final board stays visible with the outcome before the results.');
      assert.equal(plan.filledTaps, 1, 'Column 1 filled and took one extra tap.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors], [plan.moves, plan.filledTaps]);
      assert.equal(rounds[plan.filledTapMove - 1].invalidTaps, 1, 'The full-column tap belongs to the next move.');
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.col >= 1 && row.col <= 7 && row.height >= 1 && row.height <= 6));
      assert.ok(summary.completed + summary.draw <= 1);
      assert.ok([plan.moves - 1, plan.moves].includes(summary.opponentMoves));
      assert.ok(summary.duration > 0 && summary.meanThinkMs > 0);
    },
  },
  hex: {
    title: { zh: 'Hex 連線棋', en: 'Hex' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', soundEnabled: true },
    tutorialTargets: ['.hx-cell[data-tutorial="move"]', '.hx-edge-player', '.hx-turn', '.hx-stop'],
    runningSelector: '.hx-running',
    stopSelector: '.hx-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'invalidTaps',
    async play({ game, until, tap, press, capture }) {
      const n = 5;
      const read = () => game(`(() => ({ turn: document.querySelector('.hx-running .hx-board')?.dataset.turn ?? '',
        results: Boolean(document.querySelector('.experiment-results')),
        marks: [...document.querySelectorAll('.hx-running .hx-cell')].sort((a, b) => a.dataset.index - b.dataset.index).map(cell => cell.dataset.mark ?? '') }))()`);
      const cell = index => `.hx-running .hx-cell[data-index="${index}"]`;
      const plan = { moves: 0, filledTaps: 0, keyboard: false, sawOutcome: false };
      await until(async () => (await read()).turn === 'player', 'first turn');
      assert.equal(await game(`document.querySelectorAll('.hx-running .hx-cell[tabindex="0"]').length`), 1, 'Only one board cell is in the Tab order.');
      await capture('gameplay');
      for (;;) {
        const state = await read();
        if (state.results) break;
        if (state.turn === 'over') {
          plan.sawOutcome = await game(`Boolean(document.querySelector('.hx-outcome')) && document.querySelectorAll('.hx-cell[data-path]').length >= ${n}`);
          await capture('outcome');
          await until(async () => (await read()).results, 'results after the final board', 8000);
          break;
        }
        if (state.turn === 'computer') {
          await until(async () => (await read()).turn !== 'computer', 'computer move', 5000);
          continue;
        }
        if (plan.moves === 1 && !plan.filledTaps) {
          await tap(cell(state.marks.findIndex(mark => mark === 'A')));
          await until(() => game(`document.querySelector('.hx-feedback').textContent.length > 0`), 'taken cell feedback');
          plan.filledTaps++;
          continue;
        }
        const index = PickHexMove(state.marks, n);
        if (plan.moves === 2) {
          // Walk the roving focus to the chosen cell with the arrow keys, then claim it with Enter.
          await game(`document.querySelector('.hx-running .hx-cell[tabindex="0"]').focus()`);
          let at = Number(await game(`document.activeElement.dataset.index`));
          while (at !== index) {
            const [row, col, toRow, toCol] = [Math.floor(at / n), at % n, Math.floor(index / n), index % n];
            const key = row < toRow ? 'ArrowDown' : row > toRow ? 'ArrowUp' : col < toCol ? 'ArrowRight' : 'ArrowLeft';
            await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
            const next = Number(await game(`document.activeElement.dataset.index`));
            assert.notEqual(next, at, `${key} moves the focus.`);
            at = next;
          }
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(cell(index));
        plan.moves++;
        await until(async () => (await read()).marks[index] === 'P' || (await read()).results, `move ${plan.moves} placed`);
      }
      assert.equal(plan.sawOutcome, true, 'The final board stays visible with the winning chain before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.boardSize], [plan.moves, plan.filledTaps, 5]);
      assert.equal(rounds[1].invalidTaps, plan.filledTaps, 'The taken-cell tap belongs to the second move.');
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.row >= 1 && row.row <= 5 && row.col >= 1 && row.col <= 5));
      assert.ok([plan.moves - 1, plan.moves].includes(summary.opponentMoves));
      assert.ok(summary.duration > 0 && summary.meanThinkMs > 0);
    },
  },
  'dots-and-boxes': {
    title: { zh: '點格成盒', en: 'Dots and Boxes' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', soundEnabled: true },
    tutorialTargets: ['.db-line[data-tutorial="move"]', '.db-score', '.db-turn', '.db-stop'],
    runningSelector: '.db-running',
    stopSelector: '.db-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'invalidTaps',
    async play({ game, until, tap, press, capture }) {
      const n = 4;
      const read = () => game(`(() => ({ turn: document.querySelector('.db-running .db-board')?.dataset.turn ?? '',
        results: Boolean(document.querySelector('.experiment-results')),
        drawn: [...document.querySelectorAll('.db-running .db-line[data-owner]')].map(line => line.dataset.line) }))()`);
      const line = id => `.db-running .db-line[data-line="${id}"]`;
      const plan = { moves: 0, filledTaps: 0, keyboard: false, sawOutcome: false, sawExtraTurn: false };
      await until(async () => (await read()).turn === 'player', 'first turn');
      assert.equal(await game(`document.querySelectorAll('.db-running .db-line[tabindex="0"]').length`), 1, 'Only one line is in the Tab order.');
      await capture('gameplay');
      for (;;) {
        const state = await read();
        if (state.results) break;
        if (state.turn === 'over') {
          plan.sawOutcome = await game(`Boolean(document.querySelector('.db-outcome'))`);
          await capture('outcome');
          await until(async () => (await read()).results, 'results after the final board', 8000);
          break;
        }
        if (state.turn === 'computer') {
          await until(async () => { const next = await read(); return next.turn !== 'computer' || next.drawn.length > state.drawn.length; }, 'computer line', 5000);
          continue;
        }
        if (plan.moves === 1 && !plan.filledTaps) {
          await tap(line(state.drawn[0]));
          await until(() => game(`document.querySelector('.db-feedback').textContent.length > 0`), 'drawn line feedback');
          plan.filledTaps++;
          continue;
        }
        const target = PickDotsLine(new Set(state.drawn), n);
        if (plan.moves === 2) {
          // Walk the roving focus through the lines in reading order with the arrow keys, then draw with Enter.
          const order = DotsReadingOrder(n);
          await game(`document.querySelector('.db-running .db-line[tabindex="0"]').focus()`);
          let at = await game(`document.activeElement.dataset.line`);
          while (at !== target) {
            const key = order.indexOf(at) < order.indexOf(target) ? 'ArrowRight' : 'ArrowLeft';
            await press(key, key, key === 'ArrowRight' ? 39 : 37);
            const next = await game(`document.activeElement.dataset.line`);
            assert.notEqual(next, at, `${key} moves the focus.`);
            at = next;
          }
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(line(target));
        plan.moves++;
        await until(async () => { const next = await read(); return next.results || next.drawn.includes(target); }, `line ${plan.moves} drawn`);
        if (await game(`Boolean(document.querySelector('.db-claimed'))`)) plan.sawExtraTurn = true;
      }
      assert.equal(plan.sawOutcome, true, 'The final board stays visible with the outcome before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.boardSize], [plan.moves, plan.filledTaps, 4]);
      assert.equal(rounds[1].invalidTaps, plan.filledTaps, 'The drawn-line tap belongs to the second line.');
      assert.equal(summary.moves + summary.opponentMoves, 24, 'Every line on a 4 x 4 dot board is drawn.');
      assert.equal(summary.playerBoxes + summary.opponentBoxes, 9);
      assert.equal(rounds.reduce((sum, row) => sum + row.boxes, 0), summary.playerBoxes, 'The rows account for every box you closed.');
      assert.equal(summary.completed, summary.playerBoxes > summary.opponentBoxes ? 1 : 0);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.boxes >= 0 && row.boxes <= 2));
      assert.ok(summary.duration > 0 && summary.meanThinkMs > 0);
    },
  },
  'lights-out': {
    title: { zh: '熄燈解題', en: 'Lights Out' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', timeLimitSec: 60, soundEnabled: true },
    tutorialTargets: ['.lo-cell[data-tutorial="move"]', '.lo-left', '.lo-clock', '.lo-stop'],
    runningSelector: '.lo-running',
    stopSelector: '.lo-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'lightsOn',
    async play({ game, until, tap, press, capture }) {
      const n = 3;
      const read = () => game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')),
        outcome: Boolean(document.querySelector('.lo-outcome')),
        moves: Number(document.querySelector('.lo-moves')?.textContent.match(/\\d+/)?.[0] ?? -1),
        lights: [...document.querySelectorAll('.lo-running .lo-cell')].sort((a, b) => a.dataset.index - b.dataset.index).map(cell => cell.dataset.on === 'true') }))()`);
      const cell = index => `.lo-running .lo-cell[data-index="${index}"]`;
      const plan = { moves: 0, startLights: 0, cancelCell: 0, keyboard: false, sawOutcome: false };
      await until(async () => (await read()).lights.length === n * n, 'board');
      assert.equal(await game(`document.querySelectorAll('.lo-running .lo-cell[tabindex="0"]').length`), 1, 'Only one board cell is in the Tab order.');
      assert.match(await game(`document.querySelector('.lo-clock').textContent`), /^(剩 [01]:\d\d|[01]:\d\d left)$/, 'A time limit shows a countdown.');
      const start = await read();
      plan.startLights = start.lights.filter(Boolean).length;
      await capture('gameplay');
      const presses = LightsSolve(start.lights, n);
      assert.ok(presses?.length, 'Every board can be solved.');
      // Two presses on the same cell cancel out, so the board is back where it started.
      // A board solved by one press at cell 0 would end on the first of them, so it uses the far corner.
      plan.cancelCell = presses.length === 1 && presses[0] === 0 ? n * n - 1 : 0;
      for (let repeat = 0; repeat < 2; repeat++) {
        await tap(cell(plan.cancelCell));
        plan.moves++;
        await until(async () => (await read()).moves === plan.moves, `press ${plan.moves}`);
      }
      assert.deepEqual((await read()).lights, start.lights, 'A second press on the same cell undoes the first.');
      for (const [step, index] of presses.entries()) {
        if (step === 0) {
          // Walk the roving focus to the cell with the arrow keys, then press it with Enter.
          await game(`document.querySelector('.lo-running .lo-cell[tabindex="0"]').focus()`);
          let at = Number(await game(`document.activeElement.dataset.index`));
          while (at !== index) {
            const [row, col, toRow, toCol] = [Math.floor(at / n), at % n, Math.floor(index / n), index % n];
            const key = row < toRow ? 'ArrowDown' : row > toRow ? 'ArrowUp' : col < toCol ? 'ArrowRight' : 'ArrowLeft';
            await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
            const next = Number(await game(`document.activeElement.dataset.index`));
            assert.notEqual(next, at, `${key} moves the focus.`);
            at = next;
          }
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(cell(index));
        plan.moves++;
        await until(async () => { const next = await read(); return next.moves === plan.moves || next.outcome || next.results; }, `press ${plan.moves}`);
      }
      await until(async () => (await read()).outcome, 'final board');
      plan.sawOutcome = (await read()).lights.every(on => !on);
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      assert.equal(plan.sawOutcome, true, 'The dark board stays visible with the outcome before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.completed, summary.lightsLeft, summary.boardSize], [plan.moves, 1, 0, 3]);
      const corner = plan.cancelCell === 0 ? 1 : 3;
      assert.deepEqual([rounds[0].row, rounds[0].col, rounds[1].row, rounds[1].col], [corner, corner, corner, corner]);
      assert.equal(rounds[1].lightsOn, plan.startLights, 'The second press restores the starting board.');
      assert.equal(rounds.at(-1).lightsOn, 0);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.row >= 1 && row.row <= 3 && row.col >= 1 && row.col <= 3));
      assert.ok(summary.duration > 0 && summary.duration < 60 && summary.meanThinkMs > 0);
    },
  },
  'sliding-puzzle': {
    title: { zh: '滑塊拼圖', en: 'Sliding Puzzle' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', timeLimitSec: 0, soundEnabled: true },
    tutorialTargets: ['.sp-tile[data-tutorial="move"]', '.sp-goal', '.sp-clock', '.sp-stop'],
    runningSelector: '.sp-running',
    stopSelector: '.sp-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'misplaced',
    async play({ game, until, tap, press, capture }) {
      const n = 3;
      const read = () => game(`(() => {
        const tiles = Array(${n * n}).fill(0);
        for (const tile of document.querySelectorAll('.sp-running .sp-tile')) tiles[Number(tile.dataset.index)] = Number(tile.dataset.tile);
        return { tiles, results: Boolean(document.querySelector('.experiment-results')), outcome: Boolean(document.querySelector('.sp-outcome')),
          moves: Number(document.querySelector('.sp-moves')?.textContent.match(/\\d+/)?.[0] ?? -1),
          feedback: document.querySelector('.sp-feedback')?.textContent ?? '' };
      })()`);
      const tileAt = (state, index) => `.sp-running .sp-tile[data-tile="${state.tiles[index]}"]`;
      const plan = { moves: 0, stuckTaps: 0, keyboard: false, sawOutcome: false };
      await until(async () => (await read()).tiles.filter(Boolean).length === n * n - 1, 'board');
      assert.equal(await game(`document.querySelectorAll('.sp-running .sp-tile[tabindex="0"]').length`), 1, 'Only one tile is in the Tab order.');
      assert.match(await game(`document.querySelector('.sp-clock').textContent`), /^\d+\.\d (秒|s)$/, 'No time limit shows the time so far.');
      await capture('gameplay');
      let state = await read();
      const blank = state.tiles.indexOf(0);
      const stuck = state.tiles.findIndex((tile, index) => tile && !SlidingNeighbors(blank, n).includes(index));
      await tap(tileAt(state, stuck));
      await until(async () => (await read()).feedback.length > 0, 'feedback for a tile away from the gap');
      plan.stuckTaps++;
      assert.deepEqual((await read()).tiles, state.tiles, 'A tile away from the gap stays put.');
      const path = SlidingSolve(state.tiles, n);
      assert.ok(path.length > 0, 'The board starts scrambled.');
      for (const [step, index] of path.entries()) {
        state = await read();
        if (step === 0) {
          // Walk the roving focus to the tile with the arrow keys, then slide it with Enter.
          await game(`document.querySelector('.sp-running .sp-tile[tabindex="0"]').focus()`);
          let at = Number(await game(`document.activeElement.dataset.index`));
          const distance = cell => Math.abs(Math.floor(cell / n) - Math.floor(index / n)) + Math.abs(cell % n - index % n);
          while (at !== index) {
            const key = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].find(name => distance(SlidingArrow(at, name, state.tiles, n)) < distance(at));
            assert.ok(key, 'An arrow key brings the focus closer to the tile.');
            await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
            const next = Number(await game(`document.activeElement.dataset.index`));
            assert.equal(next, SlidingArrow(at, key, state.tiles, n), `${key} moves the focus to the next tile.`);
            at = next;
          }
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(tileAt(state, index));
        plan.moves++;
        await until(async () => { const next = await read(); return next.moves === plan.moves || next.outcome || next.results; }, `slide ${plan.moves}`);
      }
      await until(async () => (await read()).outcome, 'final board');
      plan.sawOutcome = (await read()).tiles.join(',') === '1,2,3,4,5,6,7,8,0';
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      assert.equal(plan.sawOutcome, true, 'The solved board stays visible with the outcome before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.completed, summary.misplaced, summary.boardSize], [plan.moves, plan.stuckTaps, 1, 0, 3]);
      assert.equal(rounds[0].invalidTaps, plan.stuckTaps, 'The tap away from the gap belongs to the first slide.');
      assert.equal(rounds.at(-1).misplaced, 0);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.tile >= 1 && row.tile <= 8));
      assert.ok(summary.duration > 0 && summary.meanThinkMs > 0);
    },
  },
  maze: {
    title: { zh: '迷宮', en: 'Maze' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', timeLimitSec: 180, soundEnabled: true },
    tutorialTargets: ['.mz-player', '.mz-goal', '.mz-dpad', '.mz-clock', '.mz-stop'],
    runningSelector: '.mz-running',
    stopSelector: '.mz-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'distanceLeft',
    async play({ game, until, tap, press, capture }) {
      const n = 8;
      const keys = { up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39] };
      const read = () => game(`(() => {
        const at = selector => { const style = document.querySelector('.mz-running ' + selector)?.style; return style ? Number(style.getPropertyValue('--r')) * ${n} + Number(style.getPropertyValue('--c')) : -1; };
        return { player: at('.mz-player'), goal: at('.mz-goal'), path: document.querySelector('.mz-running .mz-walls path')?.getAttribute('d') ?? '',
          moves: Number(document.querySelector('.mz-moves')?.textContent.match(/\\d+/)?.[0] ?? -1), feedback: document.querySelector('.mz-feedback')?.textContent ?? '',
          outcome: Boolean(document.querySelector('.mz-outcome')), results: Boolean(document.querySelector('.experiment-results')) };
      })()`);
      const plan = { moves: 0, blocked: 0, shortest: 0, usedPad: false, usedTap: false, usedKeys: false, sawOutcome: false };
      await until(async () => (await read()).player >= 0, 'maze');
      assert.match(await game(`document.querySelector('.mz-clock').textContent`), /^(剩 [23]:\d\d|[23]:\d\d left)$/, 'A time limit shows a countdown.');
      await capture('gameplay');
      const start = await read();
      const { route, open } = MazeRoute(start.path, n, start.player, start.goal);
      plan.shortest = route.length;
      assert.ok(route.length >= 3, 'The goal is several steps from the start.');
      // Walk into a wall or the edge first: the move is counted and you stay put.
      const wall = Object.keys(keys).find(direction => open(start.player, direction) === null);
      await press(keys[wall][0], keys[wall][0], keys[wall][1]);
      await until(async () => (await read()).feedback.length > 0, 'feedback for a blocked move');
      plan.blocked++;
      assert.equal((await read()).player, start.player, 'A blocked move leaves you where you were.');
      let at = start.player;
      for (const [step, direction] of route.entries()) {
        if (step === 0) { await tap(`.mz-running .mz-dpad-${direction}`); plan.usedPad = true; }
        else if (step === 1) { await tap(`.mz-running .mz-cell[data-index="${open(at, direction)}"]`); plan.usedTap = true; }
        else { await press(keys[direction][0], keys[direction][0], keys[direction][1]); plan.usedKeys = true; }
        at = open(at, direction);
        plan.moves++;
        await until(async () => { const next = await read(); return next.player === at || next.results; }, `step ${plan.moves}`);
      }
      await until(async () => (await read()).outcome, 'final board');
      plan.sawOutcome = (await read()).player === start.goal;
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      assert.equal(plan.sawOutcome, true, 'The board stays visible with you on the goal before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.completed, summary.distanceLeft, summary.boardSize, summary.shortestPath],
        [plan.moves, plan.blocked, 1, 0, 8, plan.shortest]);
      assert.equal(rounds[0].invalidTaps, plan.blocked, 'The blocked move belongs to the first step.');
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.distanceLeft === plan.shortest - index - 1));
      assert.ok(summary.duration > 0 && summary.duration < 180 && summary.meanThinkMs > 0);
    },
  },
  sudoku: {
    title: { zh: '數獨', en: 'Sudoku' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'medium', timeLimitSec: 300, soundEnabled: true },
    tutorialTargets: ['.sk-cell[data-tutorial="move"]', '.sk-rule', '.sk-clock', '.sk-stop'],
    runningSelector: '.sk-running',
    stopSelector: '.sk-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'blanksLeft',
    async play({ game, until, tap, press, capture }) {
      const n = 3;
      const read = () => game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')), outcome: Boolean(document.querySelector('.sk-outcome')),
        feedback: document.querySelector('.sk-feedback')?.textContent ?? '', moves: Number(document.querySelector('.sk-moves')?.textContent.match(/\\d+/)?.[0] ?? -1),
        values: [...document.querySelectorAll('.sk-running .sk-cell')].sort((a, b) => a.dataset.index - b.dataset.index).map(cell => Number(cell.textContent) || 0),
        givens: [...document.querySelectorAll('.sk-running .sk-cell')].sort((a, b) => a.dataset.index - b.dataset.index).map(cell => cell.dataset.given === 'true') }))()`);
      const cell = index => `.sk-running .sk-cell[data-index="${index}"]`;
      const plan = { moves: 0, fullWrong: 0, cycled: false, typed: false, sawOutcome: false };
      await until(async () => (await read()).values.length === n * n, 'board');
      assert.equal(await game(`document.querySelectorAll('.sk-running .sk-cell[tabindex="0"]').length`), 1, 'Only one cell is in the Tab order.');
      assert.match(await game(`document.querySelector('.sk-clock').textContent`), /^(剩 [45]:\d\d|[45]:\d\d left)$/, 'A time limit shows a countdown.');
      await capture('gameplay');
      const start = await read();
      await tap(cell(start.givens.indexOf(true)));
      assert.deepEqual((await read()).values, start.values, 'A given number does not change.');
      const answer = SolveMagicSquare(start.values);
      assert.ok(answer, 'The magic square can be completed.');
      const blanks = start.values.flatMap((value, index) => value ? [] : [index]);
      // The first blank cycles with taps, as in the original game.
      for (let value = 1; value <= answer[blanks[0]]; value++) {
        await tap(cell(blanks[0]));
        plan.moves++;
        await until(async () => (await read()).values[blanks[0]] === value, `tap ${value}`);
      }
      plan.cycled = true;
      // The rest are typed: arrow keys walk the focus, a number key fills the cell.
      await game(`document.querySelector('.sk-running .sk-cell[tabindex="0"]').focus()`);
      for (const [step, index] of blanks.slice(1).entries()) {
        let at = Number(await game(`document.activeElement.dataset.index`));
        while (at !== index) {
          const key = Math.floor(at / n) < Math.floor(index / n) ? 'ArrowDown' : Math.floor(at / n) > Math.floor(index / n) ? 'ArrowUp' : at % n < index % n ? 'ArrowRight' : 'ArrowLeft';
          await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
          const next = Number(await game(`document.activeElement.dataset.index`));
          assert.notEqual(next, at, `${key} moves the focus.`);
          at = next;
        }
        const last = step === blanks.length - 2;
        // The last blank first gets a wrong number: the board is full but breaks the rule.
        for (const digit of last ? [answer[index] === 9 ? 1 : answer[index] + 1, answer[index]] : [answer[index]]) {
          await press(String(digit), `Digit${digit}`, 48 + digit);
          plan.moves++;
          await until(async () => { const next = await read(); return next.values[index] === digit || next.outcome || next.results; }, `type ${digit}`);
          if (last && digit !== answer[index]) {
            await until(async () => (await read()).feedback.length > 0, 'feedback for a full board that breaks the rule');
            plan.fullWrong++;
          }
        }
      }
      plan.typed = true;
      await until(async () => (await read()).outcome, 'final board');
      plan.sawOutcome = (await read()).values.join(',') === answer.join(',');
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      assert.equal(plan.sawOutcome, true, 'The finished board stays visible with the outcome before the results.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.completed, summary.blanksLeft, summary.boardSize, summary.puzzleKind, summary.initialBlanks],
        [plan.moves, plan.fullWrong, 1, 0, 3, 1, 6]);
      assert.equal(rounds.at(-1).blanksLeft, 0);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs > 0 && row.value >= 0 && row.value <= 9));
      assert.ok(summary.duration > 0 && summary.duration < 300 && summary.meanThinkMs > 0);
    },
  },
  'memory-match': {
    title: { zh: '記憶配對', en: 'Memory Match' },
    purpose: 'memory',
    settings: { difficulty: 'easy', timeLimitSec: 60, soundEnabled: true },
    tutorialTargets: ['.mm-card[data-tutorial="move"]', '.mm-pairs', '.mm-clock', '.mm-stop'],
    runningSelector: '.mm-running',
    stopSelector: '.mm-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'matchedPairs',
    // Plays like a person: it remembers each letter it has seen and only uses what it has turned over.
    async play({ game, until, tap, press, capture }) {
      const cols = 4, total = 12;
      const read = () => game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')), outcome: Boolean(document.querySelector('.mm-outcome')),
        feedback: document.querySelector('.mm-feedback')?.textContent ?? '',
        cards: [...document.querySelectorAll('.mm-running .mm-card')].map(card => ({ state: card.dataset.state, wrong: card.dataset.wrong === 'true',
          letter: card.dataset.state === 'down' ? null : card.querySelector('.mm-front').firstChild.textContent })) }))()`);
      const card = index => `.mm-running .mm-card[data-index="${index}"]`;
      const seen = new Map(), matched = new Set();
      const plan = { moves: 0, mismatches: 0, keyboard: false, ignoredTap: false, sawOutcome: false };
      await until(async () => (await read()).cards.length === total, 'cards');
      assert.equal(await game(`document.querySelectorAll('.mm-running .mm-card[tabindex="0"]').length`), 1, 'Only one card is in the Tab order.');
      assert.match(await game(`document.querySelector('.mm-clock').textContent`), /^(剩 [01]:\d\d|[01]:\d\d left)$/, 'A time limit shows a countdown.');
      await capture('gameplay');
      const flip = async (index, keyboard = false) => {
        if (keyboard) {
          await game(`document.querySelector('.mm-running .mm-card[tabindex="0"]').focus()`);
          let at = Number(await game(`document.activeElement.dataset.index`));
          while (at !== index) {
            const key = Math.floor(at / cols) < Math.floor(index / cols) ? 'ArrowDown' : at % cols < index % cols ? 'ArrowRight' : 'ArrowLeft';
            await press(key, key, { ArrowDown: 40, ArrowRight: 39, ArrowLeft: 37 }[key]);
            const next = Number(await game(`document.activeElement.dataset.index`));
            assert.notEqual(next, at, `${key} moves the focus.`);
            at = next;
          }
          await press('Enter', 'Enter', 13);
          plan.keyboard = true;
        } else await tap(card(index));
        await until(async () => { const state = await read(); return state.cards[index].state !== 'down' || state.outcome || state.results; }, `flip ${index}`);
        seen.set(index, (await read()).cards[index].letter);
      };
      const hidden = (...skip) => [...Array(total).keys()].find(index => !seen.has(index) && !matched.has(index) && !skip.includes(index));
      while (matched.size < total) {
        const known = [...seen].filter(([index]) => !matched.has(index));
        const pair = known.find(([index, letter]) => known.some(([other, value]) => other !== index && value === letter));
        let a, b;
        if (pair) {
          a = pair[0];
          b = known.find(([other, value]) => other !== a && value === pair[1])[0];
          await flip(a);
        } else {
          // The first card is turned with the keyboard: arrow keys walk to row 2, column 2 and Enter flips it.
          a = plan.keyboard ? hidden() : 5;
          await flip(a, !plan.keyboard);
          const partner = known.find(([other, value]) => other !== a && value === seen.get(a));
          b = partner ? partner[0] : hidden(a);
        }
        await flip(b);
        plan.moves++;
        if (seen.get(a) === seen.get(b)) { matched.add(a); matched.add(b); continue; }
        plan.mismatches++;
        const state = await read();
        assert.ok(state.cards[a].wrong && state.cards[b].wrong, 'A wrong pair is outlined.');
        assert.match(state.feedback, /^(Not a pair|不是一對)/);
        if (!plan.ignoredTap) {
          const other = hidden(a, b);
          await tap(card(other));
          await new Promise(resolve => setTimeout(resolve, 150));
          assert.equal((await read()).cards[other].state, 'down', 'A tap waits while a wrong pair is showing.');
          plan.ignoredTap = true;
        }
        await until(async () => { const next = await read(); return next.cards[a].state === 'down' && next.cards[b].state === 'down'; }, 'wrong pair turns back');
      }
      await until(async () => (await read()).outcome, 'final board');
      plan.sawOutcome = (await read()).cards.every(item => item.state === 'matched');
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      assert.equal(plan.sawOutcome, true, 'The finished board stays visible with the outcome before the results.');
      assert.ok(plan.mismatches >= 1 && plan.keyboard && plan.ignoredTap, JSON.stringify(plan));
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.moves);
      assert.deepEqual([summary.moves, summary.errors, summary.completed, summary.matchedPairs, summary.pairs], [plan.moves, plan.mismatches, 1, 6, 6]);
      assert.equal(rounds.filter(row => row.matched === 1).length, 6);
      assert.equal(rounds.at(-1).matchedPairs, 6);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs >= 0));
      assert.ok(summary.duration > 0 && summary.duration < 60 && summary.meanThinkMs > 0);
    },
  },
  'simon-says': {
    title: { zh: '順序記憶', en: 'Simon Says' },
    purpose: 'memory',
    settings: { difficulty: 'easy', lives: 3, soundEnabled: true },
    tutorialTargets: ['.ss-pad[data-tutorial="move"]', '.ss-status', '.ss-lives', '.ss-stop'],
    runningSelector: '.ss-running',
    stopSelector: '.ss-stop',
    defaultMetric: 'length', alternateMetric: 'correct',
    // Watches the playback through the lit attribute, as a player watches the pads, and repeats it.
    async play({ game, until, tap, press, capture }) {
      await game(`(() => { window.__simonLit = []; new MutationObserver(records => { for (const record of records) if (record.target.dataset?.lit === 'true') window.__simonLit.push(Number(record.target.dataset.pad)); })
        .observe(document.querySelector('.ss-running'), { subtree: true, attributes: true, attributeFilter: ['data-lit'] }); })()`);
      let log = [], known = [];
      const read = async () => {
        const state = await game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')), outcome: Boolean(document.querySelector('.ss-outcome')),
          turn: Boolean(document.querySelector('.ss-status[data-turn]')), status: document.querySelector('.ss-status')?.textContent ?? '',
          length: Number(document.querySelector('.ss-length')?.textContent.match(/(\\d+) \\//)?.[1] ?? 0),
          lives: document.querySelectorAll('.ss-running .ss-heart:not([data-empty])').length, feedback: document.querySelector('.ss-feedback')?.textContent ?? '',
          lit: window.__simonLit ? window.__simonLit.splice(0) : [] }))()`);
        log.push(...state.lit);
        return state;
      };
      const pad = index => `.ss-running .ss-pad[data-pad="${index}"]`;
      const plan = { attempts: 0, wrong: 0, wrongAt: null, keyboard: false, ignoredTap: false, sawOutcome: false };
      for (;;) {
        await until(async () => { const state = await read(); return state.turn || state.outcome; }, 'your turn', 15000);
        const state = await read();
        if (state.outcome) break;
        if (!plan.attempts) await capture('gameplay');
        // A missed first playback falls back to a guess; a wrong guess just replays the order.
        const sequence = log.length >= state.length ? log.slice(-state.length) : [...known.slice(0, state.length - 1), ...log.slice(-1)];
        if (!sequence.length) sequence.push(0);
        log = [];
        const mistake = !plan.wrong && state.length === 2;
        const keyboard = !plan.keyboard && state.length === 3;
        for (const [step, target] of sequence.entries()) {
          const chosen = mistake && step === 1 ? (target + 1) % 4 : target;
          if (keyboard) await press(String(chosen + 1), `Digit${chosen + 1}`, 49 + chosen); else await tap(pad(chosen));
          if (chosen !== target) { plan.wrongAt = step; break; }
        }
        if (keyboard) plan.keyboard = true;
        plan.attempts++;
        await until(async () => { const next = await read(); return !next.turn || next.outcome; }, 'attempt checked');
        const after = await read();
        if (after.lives < state.lives) {
          plan.wrong++;
          if (!after.outcome) assert.match(after.feedback, /^(Wrong pad|點錯了)/);
          continue;
        }
        known = sequence;
        if (!plan.ignoredTap && !after.outcome) {
          await tap(pad((sequence[0] + 1) % 4));
          await new Promise(resolve => setTimeout(resolve, 100));
          const ignored = await read();
          assert.deepEqual([ignored.turn, ignored.lives, ignored.length], [false, after.lives, after.length], 'A tap during playback is ignored.');
          plan.ignoredTap = true;
        }
      }
      plan.sawOutcome = (await read()).outcome;
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final pads', 8000);
      assert.ok(plan.sawOutcome && plan.keyboard && plan.ignoredTap && plan.wrong >= 1, JSON.stringify(plan));
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.equal(rounds.length, plan.attempts);
      assert.deepEqual([summary.completed, summary.trials, summary.correctTrials, summary.remainingLives, summary.maxLives, summary.longestCorrect, summary.targetLength],
        [1, plan.attempts, 5, 3 - plan.wrong, 3, 5, 5]);
      assert.deepEqual(rounds.filter(row => row.correct).map(row => row.length), [1, 2, 3, 4, 5]);
      assert.equal(rounds.find(row => !row.correct && row.length === 2)?.correctTaps, plan.wrongAt);
      assert.ok(rounds.every((row, index) => row.trial === index + 1 && row.recallMs > 0));
    },
  },
  'whack-a-mole': {
    title: { zh: '目標點擊', en: 'Target Click' },
    purpose: 'attention',
    settings: { difficulty: 'easy', durationSec: 30, soundEnabled: true },
    tutorialTargets: ['.wm-hole[data-tutorial="move"]', '.wm-hits', '.wm-clock', '.wm-stop'],
    runningSelector: '.wm-running',
    stopSelector: '.wm-stop',
    defaultMetric: 'responseMs', alternateMetric: 'outcome',
    async play({ game, until, tap, press, capture }) {
      const size = 3;
      const read = () => game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')), outcome: Boolean(document.querySelector('.wm-outcome')),
        up: document.querySelector('.wm-running .wm-hole[data-up]')?.dataset.index ?? null,
        hits: Number(document.querySelector('.wm-running .wm-hits strong')?.textContent ?? -1), misses: Number(document.querySelector('.wm-running .wm-misses')?.textContent.match(/\\d+/)?.[0] ?? -1),
        flash: document.querySelector('.wm-flash-hit') ? 'hit' : document.querySelector('.wm-flash-wrong') ? 'wrong' : null }))()`);
      const hole = index => `.wm-running .wm-hole[data-index="${index}"]`;
      const nextMole = async label => { await until(async () => { const state = await read(); return state.up !== null || state.outcome; }, label); return read(); };
      const plan = { wrong: 0, ducked: 0, keyboard: false, ignoredTap: false, finalHits: 0, finalMisses: 0 };
      assert.match(await game(`document.querySelector('.wm-clock').textContent`), /^(剩 0:[23]\d|0:[23]\d left)$/, 'The session counts down.');
      assert.equal(await game(`document.querySelectorAll('.wm-running .wm-hole[tabindex="0"]').length`), 1, 'Only one hole is in the Tab order.');
      // A tap on another hole while a mole is up is a miss and shows an X.
      let state = await nextMole('first mole');
      await capture('gameplay');
      await tap(hole((Number(state.up) + 1) % (size * size)));
      await until(async () => { const next = await read(); return next.misses === 1 && next.flash === 'wrong'; }, 'wrong hole marked');
      plan.wrong++;
      // A mole left alone ducks back down and counts as a miss.
      state = await nextMole('mole to leave alone');
      await until(async () => (await read()).misses === 2, 'mole ducks');
      plan.ducked++;
      // A keyboard player walks to the mole with the arrow keys and presses Enter.
      state = await nextMole('mole for the keyboard');
      await game(`document.querySelector('.wm-running .wm-hole[tabindex="0"]').focus()`);
      let at = Number(await game(`document.activeElement.dataset.index`));
      const target = Number(state.up);
      while (at !== target) {
        const key = Math.floor(at / size) < Math.floor(target / size) ? 'ArrowDown' : Math.floor(at / size) > Math.floor(target / size) ? 'ArrowUp' : at % size < target % size ? 'ArrowRight' : 'ArrowLeft';
        await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
        at = Number(await game(`document.activeElement.dataset.index`));
      }
      await press('Enter', 'Enter', 13);
      await until(async () => { const next = await read(); return next.hits === 1 && next.flash === 'hit'; }, 'keyboard hit');
      plan.keyboard = true;
      // Right after a hit no mole is up, so a tap does not count.
      await tap(hole((target + 4) % (size * size)));
      await new Promise(resolve => setTimeout(resolve, 60));
      const ignored = await read();
      assert.deepEqual([ignored.hits, ignored.misses], [1, 2], 'A tap with no mole up does not count.');
      plan.ignoredTap = true;
      // A mole that is down sits wholly below its hole, so no sliver peeks out under the pit.
      const peeking = await game(`[...document.querySelectorAll('.wm-running .wm-hole:not([data-up]):not([data-index="${target}"])')]
        .filter(hole => { const svg = hole.querySelector('.wm-mole').getBoundingClientRect(); const body = hole.querySelector('.wm-mole-body');
          const outline = parseFloat(getComputedStyle(body).strokeWidth) * Math.min(svg.width, svg.height) / 200;
          return body.getBoundingClientRect().top - outline < hole.getBoundingClientRect().bottom - 0.5; }).map(hole => hole.dataset.index)`);
      assert.deepEqual(peeking, [], 'Hidden moles stay out of sight.');
      for (;;) {
        state = await nextMole('next mole');
        if (state.outcome) break;
        await tap(hole(state.up));
        await until(async () => { const next = await read(); return next.up !== state.up || next.outcome; }, 'mole goes down');
      }
      state = await read();
      [plan.finalHits, plan.finalMisses] = [state.hits, state.misses];
      assert.ok(plan.finalHits >= 5, `Most moles are hit: ${JSON.stringify(state)}`);
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.deepEqual([summary.hits, summary.misses, summary.wrongTaps], [plan.finalHits, plan.finalMisses, plan.wrong]);
      assert.equal(rounds.length, summary.hits + summary.misses);
      assert.equal(summary.taps, summary.hits + summary.wrongTaps);
      assert.ok(summary.expired >= plan.ducked);
      assert.ok(rounds.every((row, index) => row.trial === index + 1 && (row.outcome === 1 ? row.responseMs > 0 && row.tappedIndex === row.targetIndex : row.responseMs === null)));
      assert.ok(summary.meanMs > 0 && summary.bestMs <= summary.meanMs);
      assert.ok(summary.duration >= 29.5 && summary.duration <= 31.5, String(summary.duration));
    },
  },
  minesweeper: {
    title: { zh: '踩地雷', en: 'Minesweeper' },
    purpose: 'higher-cognition',
    settings: { difficulty: 'easy', boardSize: 'small', soundEnabled: true },
    tutorialTargets: ['.ms-cell[data-tutorial="move"]', '.ms-cell[data-tutorial="number"]', '.ms-flag-mode', '.ms-zoom', '.ms-stop'],
    runningSelector: '.ms-running',
    stopSelector: '.ms-stop',
    defaultMetric: 'thinkMs', alternateMetric: 'opened',
    async play({ game, send, inputSession, until, tap, press, mobile, capture }) {
      const size = 6, mineCount = 4;
      const cell = index => `.ms-running .ms-cell[data-index="${index}"]`;
      const read = () => game(`(() => ({ results: Boolean(document.querySelector('.experiment-results')),
        outcome: document.querySelector('.ms-feedback')?.dataset.outcome ?? null, feedback: document.querySelector('.ms-feedback')?.textContent ?? '',
        cells: [...document.querySelectorAll('.ms-running .ms-cell')].map(cell => cell.dataset.state === 'open' ? (cell.dataset.count === undefined ? 'M' : Number(cell.dataset.count)) : cell.dataset.state === 'flagged' ? 'F' : 'C'),
        flags: Number(document.querySelector('.ms-running .ms-mines strong')?.textContent ?? -1), zoom: document.querySelector('.ms-zoom-reset')?.textContent ?? '',
        boardWidth: document.querySelector('.ms-board')?.getBoundingClientRect().width ?? 0 }))()`);
      const contextMenu = index => game(`document.querySelector(${JSON.stringify(cell(index))}).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`);
      const plan = { actions: 0, guesses: 0, outcome: null };
      let state = await read();
      assert.ok(state.cells.every(value => value === 'C') && state.flags === 0 && state.zoom === '100%', JSON.stringify(state));
      assert.equal(await game(`document.querySelectorAll('.ms-running .ms-cell[tabindex="0"]').length`), 1, 'Only one cell is in the Tab order.');
      // Zoom with the buttons; none of it opens a cell.
      const baseWidth = state.boardWidth;
      await tap('.ms-zoom-in');
      await until(async () => (await read()).zoom === '125%', 'zoom in');
      const zoomed = (await read()).boardWidth / baseWidth;
      assert.ok(zoomed > 1.15 && zoomed < 1.3, `The board grows with the zoom: ${zoomed}`);
      await tap('.ms-zoom-reset');
      await until(async () => (await read()).zoom === '100%', 'zoom reset');
      // The wheel zooms on a computer; the phone pinch runs on the final board, since synthetic two-finger input stops later taps from clicking.
      const boardCenter = () => game(`(() => { const rect = document.querySelector('.ms-board').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
      if (!mobile) {
        const center = await boardCenter();
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: center.x, y: center.y, deltaX: 0, deltaY: -100 }, inputSession);
        await until(async () => (await read()).zoom === '110%', 'wheel zoom');
      }
      await tap('.ms-zoom-reset');
      await until(async () => (await read()).zoom === '100%', 'zoom reset after gesture');
      assert.ok((await read()).cells.every(value => value === 'C'), 'Zooming does not open a cell.');
      // A right click flags a cell; a tap on a flag does not open it; a second right click removes the flag.
      await contextMenu(0);
      await until(async () => (await read()).cells[0] === 'F', 'right-click flag');
      await tap(cell(0));
      await until(async () => /flag|旗/.test((await read()).feedback), 'flagged tap explained');
      assert.equal((await read()).cells[0], 'F', 'A flagged cell does not open.');
      await contextMenu(0);
      await until(async () => (await read()).cells[0] === 'C', 'right-click unflag');
      plan.actions += 2;
      // The first cell opens with the keyboard; it is never a mine.
      await game(`document.querySelector('.ms-running .ms-cell[tabindex="0"]').focus()`);
      const first = Number(await game(`document.activeElement.dataset.index`));
      // The Tab stop follows the last cell acted on, so it is the corner cell flagged above.
      assert.equal(first, 0, 'The Tab stop follows the flagged cell.');
      plan.firstOpen = first;
      await press('Enter', 'Enter', 13);
      await until(async () => typeof (await read()).cells[first] === 'number', 'keyboard open');
      plan.actions++;
      state = await read();
      // A tap on an open cell does nothing.
      await tap(cell(first));
      await new Promise(resolve => setTimeout(resolve, 80));
      assert.deepEqual((await read()).cells, state.cells, 'An open cell does not change.');
      // Flag mode: a tap places a flag and a second tap removes it.
      const covered = state.cells.indexOf('C');
      await tap('.ms-flag-mode');
      await until(() => game(`document.querySelector('.ms-flag-mode').getAttribute('aria-pressed') === 'true'`), 'flag mode on');
      await tap(cell(covered));
      await until(async () => { const next = await read(); return next.cells[covered] === 'F' && next.flags === 1; }, 'flag-mode flag');
      await capture('gameplay');
      await tap(cell(covered));
      await until(async () => (await read()).cells[covered] === 'C', 'flag-mode unflag');
      await tap('.ms-flag-mode');
      await until(() => game(`document.querySelector('.ms-flag-mode').getAttribute('aria-pressed') === 'false'`), 'flag mode off');
      plan.actions += 2;
      // The F key flags the focused cell after the arrow keys reach it.
      await game(`document.querySelector('.ms-running .ms-cell[tabindex="0"]').focus()`);
      let at = Number(await game(`document.activeElement.dataset.index`));
      while (at !== covered) {
        const key = Math.floor(at / size) < Math.floor(covered / size) ? 'ArrowDown' : Math.floor(at / size) > Math.floor(covered / size) ? 'ArrowUp' : at % size < covered % size ? 'ArrowRight' : 'ArrowLeft';
        await press(key, key, { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[key]);
        at = Number(await game(`document.activeElement.dataset.index`));
      }
      await press('f', 'KeyF', 70);
      await until(async () => (await read()).cells[covered] === 'F', 'F key flag');
      await press('f', 'KeyF', 70);
      await until(async () => (await read()).cells[covered] === 'C', 'F key unflag');
      plan.actions += 2;
      // Open the rest by working out safe cells from the numbers; guess only when nothing is certain.
      for (;;) {
        state = await read();
        if (state.outcome) break;
        const { mines, safe } = DeduceMines(state.cells, size, mineCount);
        let next = [...safe].find(index => state.cells[index] === 'C');
        if (next === undefined) { plan.guesses++; next = state.cells.findIndex((value, index) => value === 'C' && !mines.has(index)); }
        await tap(cell(next));
        await until(async () => { const after = await read(); return after.cells[next] !== 'C' || after.outcome; }, 'cell opens');
        plan.actions++;
      }
      plan.outcome = state.outcome;
      if (mobile) {
        const center = await boardCenter();
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x - 30, y: center.y, id: 0 }, { x: center.x + 30, y: center.y, id: 1 }] }, inputSession);
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x - 60, y: center.y, id: 0 }, { x: center.x + 60, y: center.y, id: 1 }] }, inputSession);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, inputSession);
        await until(async () => (await read()).zoom === '200%', 'pinch zoom on the final board', 1200);
      }
      if (state.outcome === 'Victory') assert.equal(state.cells.filter(value => typeof value === 'number').length, size * size - mineCount);
      else assert.equal(state.cells.filter(value => value === 'M').length, mineCount, 'Every mine is shown after a mine opens.');
      await capture('outcome');
      await until(async () => (await read()).results, 'results after the final board', 8000);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.deepEqual([summary.rows, summary.columns, summary.mines, summary.safeCells], [6, 6, 4, 32]);
      assert.equal(summary.completed, plan.outcome === 'Victory' ? 1 : 0);
      if (plan.outcome === 'Victory') assert.equal(summary.revealedSafe, 32);
      assert.deepEqual([summary.moves, rounds.length], [plan.actions, plan.actions]);
      assert.deepEqual([summary.correctFlags, summary.incorrectFlags], [0, 0]);
      assert.deepEqual(rounds.slice(0, 3).map(row => [row.action, row.row, row.col]), [[2, 1, 1], [3, 1, 1], [1, Math.floor(plan.firstOpen / 6) + 1, plan.firstOpen % 6 + 1]]);
      assert.ok(rounds.every((row, index) => row.move === index + 1 && row.thinkMs >= 0 && (row.action === 1 || row.opened === 0)));
      assert.equal(rounds.at(-1).safeLeft, 32 - summary.revealedSafe);
    },
  },
  antisaccade: {
    title: { zh: '反向眼跳抑制（Antisaccade）', en: 'Antisaccade' },
    purpose: 'attention',
    // Phones skip practice so both setups get a real session.
    settings: { exposureMs: 300, rounds: 30, practice: !process.argv.includes('--mobile') },
    tutorialTargets: ['.as-slot[data-tutorial="cue"]', '.as-slot[data-tutorial="arrow"]', '.as-pads', '.as-hud'],
    runningSelector: '.as-running',
    stopSelector: '.as-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer the arrow, except practice item 2 and counted item 3 get a wrong direction and counted item 5 gets no answer.
      const practiceCount = mobile ? 0 : 22;
      const plan = { seen: [], labels: new Set(), cues: new Map(), wrong: 0, practiceWrong: 0, missed: 0, sawBreak: !practiceCount, feedback: new Set(), shot: false };
      const keys = { left: ['ArrowLeft', 37], up: ['ArrowUp', 38], right: ['ArrowRight', 39] };
      const answer = async direction => mobile ? tap(`.as-pad-${direction}`) : press(keys[direction][0], keys[direction][0], keys[direction][1]);
      const wrongFor = direction => direction === 'up' ? 'left' : 'up';
      await until(async () => {
        if (await game(`Boolean(document.querySelector('.experiment-results'))`)) return true;
        const state = await game(`(() => { const field = document.querySelector('.as-running .as-field'); const feedback = document.querySelector('.as-feedback');
          const shown = field ? [...field.querySelectorAll('.as-slot')].filter(slot => slot.dataset.show).map(slot => (slot.classList.contains('as-slot-left') ? 'left' : 'right') + ':' + slot.dataset.show) : [];
          return { label: document.querySelector('.as-progress-label')?.textContent ?? '', state: field?.dataset.state, side: field?.dataset.side, shown,
            arrow: field?.querySelector('.as-slot-' + field.dataset.side + ' .as-arrow')?.dataset.dir, feedback: feedback?.textContent ?? '', result: feedback?.dataset.result }; })()`);
        if (state.state === 'break') plan.sawBreak = true;
        if (state.state === 'cue') { assert.equal(state.shown.length, 1, 'Only the square shows during the cue.'); plan.cues.set(state.label, state.shown[0]); }
        if (state.state === 'feedback') {
          plan.feedback.add(`${state.result}:${state.feedback}`);
          if (state.result === 'wrong' && !plan.shot) { plan.shot = true; await capture('practice-feedback'); }
        }
        if (!['target', 'mask'].includes(state.state) || plan.labels.has(state.label)) return false;
        plan.labels.add(state.label);
        const practice = /練習|Practice/.test(state.label);
        const number = Number((state.label.match(/\d+/) ?? [0])[0]);
        assert.deepEqual(state.shown, [`${state.side}:${state.state === 'target' ? 'arrow' : 'mask'}`], 'The arrow or its mask shows on one side only.');
        plan.seen.push({ label: state.label, side: state.side, arrow: state.arrow, practice, number });
        if (!practice && number === 5) { plan.missed++; await capture('gameplay'); return false; }
        if (number === (practice ? 2 : 3)) { practice ? plan.practiceWrong++ : plan.wrong++; await answer(wrongFor(state.arrow)); return false; }
        await answer(state.arrow);
        return false;
      }, 'Antisaccade item stream', 200000);
      assert.equal(plan.seen.length, practiceCount + 30, 'Every practice and counted item was seen by the driver.');
      assert.ok(plan.sawBreak, 'A break separates practice from the counted items.');
      assert.deepEqual(plan.seen.map(item => item.practice), [...Array(practiceCount).fill(true), ...Array(30).fill(false)]);
      assert.ok(plan.cues.size > 0, 'The driver caught at least one square.');
      for (const item of plan.seen) {
        if (plan.cues.has(item.label)) assert.notEqual(plan.cues.get(item.label).split(':')[0], item.side, `The arrow appears away from the square: ${item.label}`);
      }
      if (practiceCount) {
        const feedback = [...plan.feedback];
        assert.ok(feedback.some(text => /^correct:(答對了|Correct)$/.test(text)), feedback.join(' | '));
        assert.ok(feedback.some(text => /^wrong:(答錯了，箭頭指向|Wrong\. The arrow pointed )/.test(text)), feedback.join(' | '));
      }
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      const practice = plan.seen.filter(item => item.practice).length;
      const code = { left: 0, up: 1, right: 2 };
      assert.equal(rounds.length, practice + 30);
      assert.deepEqual(rounds.map(row => row.practice), [...Array(practice).fill(1), ...Array(30).fill(0)]);
      assert.deepEqual(rounds.map(row => [row.location, row.arrow]), plan.seen.map(item => [item.side === 'left' ? 0 : 1, code[item.arrow]]));
      assert.deepEqual([summary.trials, summary.correct, summary.wrong, summary.misses], [30, 30 - plan.wrong - plan.missed, plan.wrong, plan.missed]);
      assert.deepEqual([rounds[practice + 4].response, rounds[practice + 4].omission], [null, 1]);
      assert.equal(rounds[practice + 2].correct, 0);
      if (practice) assert.equal(rounds[1].correct, 0);
      assert.ok(rounds.every(row => row.setting === 300));
      assert.ok(rounds.filter(row => row.response !== null).every(row => row.responseMs > 0 && row.responseMs < 1300));
    },
    get rows() { return process.argv.includes('--mobile') ? 30 : 52; },
  },
  'keep-track': {
    title: { zh: '類別記憶追蹤（Keep Track）', en: 'Keep Track' },
    purpose: 'memory',
    // Phones skip practice so both setups get a real session.
    settings: { itemExposureMs: 700, rounds: 3, practice: !process.argv.includes('--mobile') },
    tutorialTargets: ['.kt-answer', '.kt-word', '.kt-row[data-tutorial="example"]', '.kt-submit', '.kt-hud'],
    runningSelector: '.kt-running',
    stopSelector: '.kt-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correctItems',
    async play({ game, until, press, tap, mobile, capture }) {
      // Track the last word of each target from the stream, answer every block, and get one word wrong in practice and in counted block 2.
      const plan = { blocks: [], shots: new Set() };
      let block = null;
      const read = () => game(`(() => { const stage = document.querySelector('.kt-running'); const word = document.querySelector('.kt-running .kt-word');
        return { results: Boolean(document.querySelector('.experiment-results')), state: stage?.dataset.state, label: document.querySelector('.kt-progress-label')?.textContent ?? '',
          word: word?.textContent ?? '', index: word?.dataset.index ?? null, submit: document.querySelector('.kt-submit')?.disabled,
          rows: [...document.querySelectorAll('.kt-running .kt-row')].map(row => ({ category: row.dataset.category,
            options: [...row.querySelectorAll('.kt-option')].map(option => ({ word: option.dataset.word, text: option.textContent, disabled: option.disabled, pressed: option.getAttribute('aria-pressed'), mark: option.dataset.mark ?? null })) })) }; })()`);
      await until(async () => {
        const state = await read();
        if (state.results) return true;
        if (state.state === 'prompt' && block?.label !== state.label) {
          block = { label: state.label, practice: /練習|Practice/.test(state.label), targets: state.rows.map(row => row.category), seen: new Set(), last: {}, answered: false };
          plan.blocks.push(block);
          assert.equal(await game(`document.activeElement?.classList.contains('kt-ready')`), true, 'The start button has focus.');
          assert.ok(state.rows.every(row => row.options.length === 5 && row.options.every(option => option.disabled)), 'Answers stay closed while the targets are read.');
          if (mobile) await tap('.kt-ready'); else await press('Enter', 'Enter', 13);
          return false;
        }
        if (state.state === 'stream' && block && state.index !== null && !block.seen.has(state.index)) {
          block.seen.add(state.index);
          for (const row of state.rows) {
            const option = row.options.find(item => item.text === state.word);
            if (option) block.last[row.category] = option.word;
          }
          assert.ok(state.rows.every(row => row.options.every(option => option.disabled)), 'Answers stay closed during the words.');
          if (!block.practice && plan.blocks.filter(item => !item.practice).length === 1 && !plan.shots.has('gameplay')) { plan.shots.add('gameplay'); await capture('gameplay'); }
          return false;
        }
        if (state.state === 'answer' && block && !block.answered) {
          block.answered = true;
          assert.equal(block.seen.size, 15, `Every word in ${block.label} was seen.`);
          assert.deepEqual(Object.keys(block.last).sort(), [...block.targets].sort());
          assert.equal(state.submit, true, 'Submit waits for every category.');
          const slip = block.practice || plan.blocks.filter(item => !item.practice).length === 2;
          block.picks = Object.fromEntries(block.targets.map((category, index) => {
            const words = state.rows.find(row => row.category === category).options.map(option => option.word);
            return [category, slip && index === 0 ? words.find(word => word !== block.last[category]) : block.last[category]];
          }));
          for (const [category, word] of Object.entries(block.picks)) await tap(`.kt-running .kt-row[data-category="${category}"] .kt-option[data-word="${word}"]`);
          await until(async () => (await read()).submit === false, 'submit opens');
          if (!plan.shots.has('answer')) { plan.shots.add('answer'); await capture('answer'); }
          block.correctItems = block.targets.filter(category => block.picks[category] === block.last[category]).length;
          await tap('.kt-submit');
          return false;
        }
        if (state.state === 'feedback' && block?.practice && !block.reviewed) {
          block.reviewed = true;
          const marks = state.rows.flatMap(row => row.options.filter(option => option.mark).map(option => `${row.category}:${option.word}:${option.mark}`));
          const first = block.targets[0];
          assert.deepEqual(marks.sort(), [...block.targets.map(category => `${category}:${block.last[category]}:correct`), `${first}:${block.picks[first]}:wrong`].sort());
          assert.match(await game(`document.querySelector('.kt-feedback').textContent`), /^(答對 2／3|2 of 3 right)/);
          await capture('practice-feedback');
          await press('Enter', 'Enter', 13);
          return false;
        }
        return false;
      }, 'Keep Track blocks', 150000);
      const counted = plan.blocks.filter(item => !item.practice);
      assert.equal(plan.blocks.length, mobile ? 3 : 4);
      assert.deepEqual(counted.map(item => item.targets.length).sort(), [3, 4, 5]);
      if (!mobile) assert.equal(plan.blocks[0].reviewed, true, 'Practice shows the right answers.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.deepEqual(rounds.map(row => [row.practice, row.load, row.requiredItems, row.correctItems]),
        plan.blocks.map(item => [Number(item.practice), item.targets.length, item.targets.length, item.correctItems]));
      const counted = plan.blocks.filter(item => !item.practice);
      assert.deepEqual([summary.trials, summary.correct, summary.correctItems, summary.requiredItems], [3, 2, 11, 12]);
      assert.equal(counted[1].correctItems, counted[1].targets.length - 1);
      assert.ok(rounds.every(row => row.setting === 700 && row.responseMs > 0));
    },
  },
  'letter-memory': {
    title: { zh: '字母記憶更新（Letter Memory）', en: 'Letter Memory' },
    purpose: 'memory',
    // Phones skip practice so both setups get a real session.
    settings: { itemExposureMs: 600, rounds: 3, practice: !process.argv.includes('--mobile') },
    tutorialTargets: ['.lm-letter', '.lm-entry', '.lm-keypad', '.lm-submit', '.lm-hud'],
    runningSelector: '.lm-running',
    stopSelector: '.lm-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correctItems',
    async play({ game, until, press, tap, mobile, capture }) {
      // Record each letter, then enter the last four; practice item 2 and counted item 2 get the first letter wrong.
      const plan = { blocks: [], shots: new Set() };
      let block = null;
      const read = () => game(`(() => { const stage = document.querySelector('.lm-running'); const letter = document.querySelector('.lm-running .lm-letter');
        return { results: Boolean(document.querySelector('.experiment-results')), state: stage?.dataset.state, label: document.querySelector('.lm-progress-label')?.textContent ?? '',
          letter: letter?.textContent ?? '', index: letter?.dataset.index ?? null, submit: document.querySelector('.lm-submit')?.disabled,
          entry: [...document.querySelectorAll('.lm-running .lm-slot')].map(slot => slot.textContent).join(''),
          keysOpen: [...document.querySelectorAll('.lm-running .lm-key[data-letter]')].filter(key => !key.disabled).length }; })()`);
      const typeLetter = async letter => mobile ? tap(`.lm-running .lm-key[data-letter="${letter}"]`) : press(letter, `Key${letter}`, letter.charCodeAt(0));
      await until(async () => {
        const state = await read();
        if (state.results) return true;
        if (state.state === 'prompt' && block?.label !== state.label) {
          block = { label: state.label, practice: /練習|Practice/.test(state.label), letters: [], answered: false };
          plan.blocks.push(block);
          assert.equal(await game(`document.activeElement?.classList.contains('lm-ready')`), true, 'Start has focus.');
          assert.equal(state.keysOpen, 0, 'The keypad stays closed before the letters.');
          if (mobile) await tap('.lm-ready'); else await press('Enter', 'Enter', 13);
          return false;
        }
        if (state.state === 'stream' && block && state.index !== null && block.letters[Number(state.index)] === undefined) {
          block.letters[Number(state.index)] = state.letter;
          assert.equal(state.keysOpen, 0, 'The keypad stays closed during the letters.');
          if (!plan.shots.has('gameplay') && !block.practice) { plan.shots.add('gameplay'); await capture('gameplay'); }
          return false;
        }
        if (state.state === 'answer' && block && !block.answered) {
          block.answered = true;
          assert.ok([5, 7, 9, 11].includes(block.letters.length) && block.letters.every(Boolean), `Every letter of ${block.label} was seen: ${block.letters.join('')}`);
          assert.equal(state.submit, true, 'Submit waits for four letters.');
          const expected = block.letters.slice(-4);
          const order = plan.blocks.filter(item => item.practice === block.practice).length;
          const slip = order === 2;
          block.typed = slip ? [expected[0] === 'Q' ? 'Z' : 'Q', ...expected.slice(1)] : expected;
          block.correctItems = block.typed.filter((letter, index) => letter === expected[index]).length;
          // Delete takes back a stray letter before the real answer.
          await typeLetter('X');
          await until(async () => (await read()).entry === 'X', 'stray letter');
          if (mobile) await tap('.lm-running .lm-back'); else await press('Backspace', 'Backspace', 8);
          await until(async () => (await read()).entry === '', 'letter deleted');
          for (const [index, letter] of block.typed.entries()) {
            await typeLetter(letter);
            await until(async () => (await read()).entry === block.typed.slice(0, index + 1).join(''), `letter ${index + 1}`);
          }
          const full = await read();
          assert.deepEqual([full.submit, full.keysOpen], [false, 0], 'Four letters open Submit and close the letter keys.');
          if (!plan.shots.has('answer')) { plan.shots.add('answer'); await capture('answer'); }
          if (mobile) await tap('.lm-submit'); else await press('Enter', 'Enter', 13);
          return false;
        }
        if (state.state === 'feedback' && block?.practice && !block.reviewed) {
          block.reviewed = true;
          const text = await game(`document.querySelector('.lm-feedback').textContent`);
          if (block.correctItems === 4) assert.match(text, /^(答對了|Correct)$/);
          else { assert.ok(text.includes(block.letters.slice(-4).join(' ')), text); await capture('practice-feedback'); }
          return false;
        }
        return false;
      }, 'Letter Memory sequences', 150000);
      assert.equal(plan.blocks.length, mobile ? 3 : 5);
      if (!mobile) assert.deepEqual(plan.blocks.slice(0, 2).map(item => [item.practice, item.letters.length, Boolean(item.reviewed)]), [[true, 5, true], [true, 7, true]]);
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.deepEqual(rounds.map(row => [row.practice, row.load, row.requiredItems, row.correctItems]),
        plan.blocks.map(item => [Number(item.practice), item.letters.length, 4, item.correctItems]));
      assert.deepEqual([summary.trials, summary.correct, summary.correctItems, summary.requiredItems], [3, 2, 11, 12]);
      assert.ok(rounds.every(row => row.setting === 600 && row.responseMs > 0));
    },
  },
  'plus-minus': {
    title: { zh: '心算加減切換（Plus-Minus）', en: 'Plus-Minus Arithmetic' },
    purpose: 'higher-cognition',
    // Phones skip practice so both setups get a real session.
    settings: { itemsPerList: 6, practice: !process.argv.includes('--mobile') },
    tutorialTargets: ['.pm-number', '.pm-rule', '.pm-keypad', '.pm-submit', '.pm-hud'],
    runningSelector: '.pm-running',
    stopSelector: '.pm-stop',
    defaultMetric: 'responseMs', alternateMetric: 'correct',
    async play({ game, until, press, tap, mobile, capture }) {
      // Answer by each list's rule; practice item 2 and alternating item 3 get a wrong answer.
      const plan = { items: [], intros: [], shots: new Set() };
      const rules = { zh: ['照抄數字', '每個加 3', '每個減 3', '加 3、減 3 輪流'], en: ['Copy the number', 'Add 3', 'Subtract 3', 'Add 3, subtract 3, in turn'] };
      const read = () => game(`(() => { const stage = document.querySelector('.pm-running');
        return { results: Boolean(document.querySelector('.experiment-results')), state: stage?.dataset.state, label: document.querySelector('.pm-progress-label')?.textContent ?? '',
          rule: document.querySelector('.pm-rule')?.textContent ?? '', number: document.querySelector('.pm-running .pm-number')?.textContent ?? '',
          entry: document.querySelector('.pm-running .pm-entry')?.textContent ?? '', submit: document.querySelector('.pm-running .pm-submit')?.disabled,
          keysOpen: [...document.querySelectorAll('.pm-running .pm-key[data-digit]')].filter(key => !key.disabled).length,
          beginFocused: document.activeElement?.classList.contains('pm-begin') ?? false }; })()`);
      const typeDigit = async digit => mobile ? tap(`.pm-running .pm-key[data-digit="${digit}"]`) : press(digit, `Digit${digit}`, 48 + Number(digit));
      let item = null;
      await until(async () => {
        const state = await read();
        if (state.results) return true;
        const condition = [...rules.zh, ...rules.en].indexOf(state.rule) % 4 - 1;
        if (state.state === 'intro' && plan.intros.at(-1) !== state.rule) {
          plan.intros.push(state.rule);
          assert.equal(state.number, '', 'No number shows before Start.');
          assert.equal(state.keysOpen, 0, 'The keys stay closed on the rule screen.');
          if (!mobile) assert.equal(state.beginFocused, true, 'Start has focus.');
          if (!plan.shots.has('intro') && condition === 2) { plan.shots.add('intro'); await capture('intro'); }
          if (mobile) await tap('.pm-begin'); else await press('Enter', 'Enter', 13);
          return false;
        }
        if (state.state === 'item' && state.number && item?.label !== state.label) {
          const question = Number(state.label.match(/(\d+)(?:／| of )\d+$/)?.[1]);
          const number = Number(state.number);
          const expected = condition === -1 ? number : condition === 0 ? number + 3 : condition === 1 ? number - 3 : question % 2 ? number + 3 : number - 3;
          const slip = (condition === -1 && question === 2) || (condition === 2 && question === 3);
          item = { label: state.label, practice: condition === -1, condition: Math.max(condition, -1), question, number, response: slip ? expected + 1 : expected };
          item.correct = item.response === expected;
          plan.items.push(item);
          assert.equal(state.submit, true, 'Submit waits for a digit.');
          // Delete takes back a stray digit before the real answer.
          await typeDigit('9');
          await until(async () => (await read()).entry === '9', 'stray digit');
          if (mobile) await tap('.pm-running .pm-back'); else await press('Backspace', 'Backspace', 8);
          await until(async () => (await read()).entry === '', 'digit deleted');
          const digits = String(item.response);
          for (const [index, digit] of [...digits].entries()) {
            await typeDigit(digit);
            await until(async () => (await read()).entry === digits.slice(0, index + 1), `digit ${index + 1}`);
          }
          if (!plan.shots.has('gameplay') && !item.practice) { plan.shots.add('gameplay'); await capture('gameplay'); }
          if (mobile) await tap('.pm-running .pm-submit'); else await press('Enter', 'Enter', 13);
          return false;
        }
        if (state.state === 'feedback' && item?.practice && !item.reviewed) {
          item.reviewed = true;
          const text = await game(`document.querySelector('.pm-feedback').textContent`);
          if (item.correct) assert.equal(text, '✓');
          else { assert.match(text, new RegExp(`^(應為|It was) ${item.number}$`)); await capture('practice-feedback'); }
          return false;
        }
        return false;
      }, 'Plus-Minus lists', 180000);
      assert.equal(plan.items.length, mobile ? 18 : 33);
      assert.equal(plan.intros.length, mobile ? 3 : 4);
      if (!mobile) assert.ok(plan.items.slice(0, 15).every(entry => entry.reviewed), 'Every practice item showed feedback.');
      return plan;
    },
    verify(saved, plan) {
      const { summary, rounds } = saved.score;
      assert.deepEqual(rounds.map(row => [row.practice, row.condition, row.question, row.number, row.response, row.correct]),
        plan.items.map(item => [Number(item.practice), item.condition, item.question, item.number, item.response, Number(item.correct)]));
      assert.deepEqual([summary.trials, summary.correct], [18, 17]);
      assert.ok(rounds.every(row => row.setting === 6 && row.responseMs > 0));
      const mean = condition => Math.round(rounds.filter(row => !row.practice && row.condition === condition).reduce((sum, row) => sum + row.responseMs, 0) / 6);
      assert.deepEqual([summary.addMs, summary.subtractMs, summary.alternateMs], [mean(0), mean(1), mean(2)]);
      assert.equal(summary.switchCostMs, Math.round(summary.alternateMs - (summary.addMs + summary.subtractMs) / 2));
    },
  },
};
