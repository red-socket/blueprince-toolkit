// Mora Jai box: a 3 x 3 grid of coloured tiles. Pressing a tile does what its colour does; the box opens when the
// four corner tiles match the four corner symbols. No imports, so it runs in a worker and under plain Node.
//
// Tile rules, from the in-game book on the boxes (cross-checked with joric's open-source solver):
// - grey: nothing. white: it and its orthogonal neighbours flip between its colour and grey.
// - black: its row shifts one step to the right, wrapping around.
// - red: every black tile turns red and every white tile turns black.
// - green: swaps with the tile opposite it through the centre.
// - yellow: swaps with the tile above (moves north). violet: swaps with the tile below (moves south).
// - pink: the up to eight tiles around it rotate one step clockwise.
// - orange: becomes the colour most common among its orthogonal neighbours, if one colour leads.
// - blue: does what the centre tile's colour does, from where the blue tile is; where that rule names the
//   tile's own colour (white, red's "turn red"), blue stands in.

export type Color = 'grey' | 'white' | 'black' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';
export const COLORS: Color[] = ['grey', 'white', 'black', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'pink'];

export type Board = Color[]; // 9 tiles, row by row from the top left
export type Corners = [Color, Color, Color, Color]; // top left, top right, bottom left, bottom right
export const CORNER_TILES = [0, 2, 6, 8];

const ORTHO: number[][] = [[1, 3], [0, 2, 4], [1, 5], [0, 4, 6], [1, 3, 5, 7], [2, 4, 8], [3, 7], [4, 6, 8], [5, 7]];
// Neighbours in clockwise order, starting from the top left (only the ones on the board).
const RING: number[][] = (() => {
  const order: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]];
  return Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return order.filter(([dr, dc]) => r + dr >= 0 && r + dr < 3 && c + dc >= 0 && c + dc < 3).map(([dr, dc]) => (r + dr) * 3 + c + dc);
  });
})();

function swap(b: Board, i: number, j: number) {
  [b[i], b[j]] = [b[j], b[i]];
}

/** Moves the colours one step along `cells` (each takes the previous one's colour; the first takes the last's). */
function rotate(b: Board, cells: number[]) {
  const last = b[cells[cells.length - 1]];
  for (let k = cells.length - 1; k > 0; k--) b[cells[k]] = b[cells[k - 1]];
  b[cells[0]] = last;
}

function act(b: Board, i: number, rule: Color, self: Color) {
  switch (rule) {
    case 'white':
      for (const j of [i, ...ORTHO[i]]) {
        if (b[j] === self) b[j] = 'grey';
        else if (b[j] === 'grey') b[j] = self;
      }
      return;
    case 'black': {
      const r = Math.floor(i / 3) * 3;
      rotate(b, [r, r + 1, r + 2]);
      return;
    }
    case 'red':
      for (let k = 0; k < 9; k++) {
        if (b[k] === 'black') b[k] = self;
        else if (b[k] === 'white') b[k] = 'black';
      }
      return;
    case 'green':
      swap(b, i, 8 - i);
      return;
    case 'yellow':
      if (i > 2) swap(b, i, i - 3);
      return;
    case 'violet':
      if (i < 6) swap(b, i, i + 3);
      return;
    case 'pink':
      rotate(b, RING[i]);
      return;
    case 'orange': {
      const counts = new Map<Color, number>();
      for (const j of ORTHO[i]) counts.set(b[j], (counts.get(b[j]) ?? 0) + 1);
      let best: Color | null = null;
      let top = 0;
      let tie = false;
      for (const [c, n] of counts) {
        if (n > top) [best, top, tie] = [c, n, false];
        else if (n === top) tie = true;
      }
      if (best && !tie) b[i] = best;
      return;
    }
    default:
      return; // grey: nothing; blue as a rule can't happen (see press)
  }
}

/** Presses tile `i` and returns the new board. */
export function press(board: Board, i: number): Board {
  const b = board.slice();
  const c = b[i];
  if (c === 'blue') {
    const centre = b[4];
    if (centre !== 'blue') act(b, i, centre, 'blue');
  } else act(b, i, c, c);
  return b;
}

export const solved = (b: Board, corners: Corners) => CORNER_TILES.every((t, k) => b[t] === corners[k]);

export interface SolveResult {
  moves: number[] | null; // tile indices to press, in order
  explored: number;
  limited: boolean; // gave up at the state limit
}

/** Breadth-first search for the shortest sequence of presses. */
export function solve(start: Board, corners: Corners, maxStates = 2_000_000): SolveResult {
  if (solved(start, corners)) return { moves: [], explored: 1, limited: false };
  const key = (b: Board) => b.map((c) => COLORS.indexOf(c)).join('');
  const parent = new Map<string, [string, number]>();
  const startKey = key(start);
  parent.set(startKey, ['', -1]);
  let frontier: [string, Board][] = [[startKey, start]];
  const needBlue = corners.includes('blue');
  while (frontier.length) {
    const next: [string, Board][] = [];
    for (const [k, b] of frontier) {
      for (let i = 0; i < 9; i++) {
        const nb = press(b, i);
        const nk = key(nb);
        if (parent.has(nk)) continue;
        // Blue never appears from nothing: without a blue tile, blue corners are out of reach.
        if (needBlue && !nb.includes('blue')) continue;
        parent.set(nk, [k, i]);
        if (solved(nb, corners)) {
          const moves: number[] = [];
          let cur = nk;
          while (cur !== startKey) {
            const [p, m] = parent.get(cur)!;
            moves.unshift(m);
            cur = p;
          }
          return { moves, explored: parent.size, limited: false };
        }
        next.push([nk, nb]);
      }
      if (parent.size > maxStates) return { moves: null, explored: parent.size, limited: true };
    }
    frontier = next;
  }
  return { moves: null, explored: parent.size, limited: false };
}
