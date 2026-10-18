// Random practice boards. These are made up here, not copied from the game.

import { emptyBoard, NUMBERS, RINGS, solve, type Board, type Mark, type Op, type Shape, type Group } from './engine';

export type Level = 1 | 2 | 3;
export const LEVEL_NAME: Record<Level, string> = { 1: 'Simple', 2: 'Marked', 3: 'Bullseye' };

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function attempt(level: Level): Board {
  const b = emptyBoard();
  const ringCount = level === 1 ? 2 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
  const rings = [...RINGS].sort(() => Math.random() - 0.5).slice(0, ringCount).sort();
  const ops: Op[] = level === 1 ? ['add', 'add', 'sub'] : level === 2 ? ['add', 'sub', 'mul', 'div'] : ['add', 'sub', 'mul', 'div', 'add3', 'sub3'];
  for (const ring of rings) {
    const count = 1 + Math.floor(Math.random() * (level === 1 ? 2 : 3));
    // One kind of operation per ring keeps the boards readable, like most of the game's.
    // The first ring adds or subtracts: multiplying or dividing the starting 0 would do nothing.
    const op = ring === rings[0] ? pick(ops.filter((o) => o !== 'mul' && o !== 'div')) : pick(ops);
    for (let i = 0; i < count; i++) b.cells[ring + pick(NUMBERS)] = i === 0 ? op : pick(op === 'mul' || op === 'div' ? [op] : ['add', 'sub'] as Op[]);
  }
  if (level >= 2) {
    const used = [...new Set(Object.keys(b.cells).map((k) => Number(k.slice(1))))];
    const marks: Mark[] = level === 2 ? ['double', 'half', 'cross'] : ['double', 'half', 'cross', 'reverse'];
    for (const n of used) if (Math.random() < 0.35) b.marks[n] = pick(marks);
    if (Math.random() < 0.3) b.marks[pick(NUMBERS)] = pick(marks); // a mark on an unused number changes nothing
  }
  if (level === 3) {
    const groups = [...new Set(Object.values(b.cells).map((op) => (op === 'add3' ? 'add' : op === 'sub3' ? 'sub' : op)))] as Group[];
    b.bull.group = pick(groups);
    const shapes: Shape[] = ['square', 'reverse', 'round1', 'round10', 'round100'];
    b.bull.outer = pick(shapes);
    if (Math.random() < 0.3) b.bull.inner = b.bull.outer === 'square' ? pick(['square', 'reverse', 'round10'] as Shape[]) : 'square';
  }
  return b;
}

/** A board whose answer is a whole number from 1 to 99, like the game's. */
export function randomBoard(level: Level): Board {
  for (let i = 0; i < 2000; i++) {
    const b = attempt(level);
    const s = solve(b);
    if (s.error || s.answer.d !== 1n || s.answer.n < 1n || s.answer.n > 99n) continue;
    // Every intermediate total a whole number too, so it can be done in your head.
    if (s.steps.some((st) => st.after.d !== 1n)) continue;
    return b;
  }
  const b = emptyBoard();
  b.cells.A20 = 'add';
  return b;
}
