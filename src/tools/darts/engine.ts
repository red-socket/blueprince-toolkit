// Billiard Room dartboard: board model and solver. No imports, so it also runs under plain Node for tests.
//
// Rules (checked against every board stored in the game):
// - Start at 0. Work the rings from the inside out: inner single, triple, outer single, double.
// - Each coloured section applies its number: blue add, yellow subtract, pink multiply, violet divide.
//   A thin strip means a third of the number (add or subtract a third).
// - Within a ring, additions and subtractions come before multiplications and divisions.
// - Marks on the number ring change that number wherever it is used: crossed out (the section is skipped),
//   two dots (double), a slash (half), a diamond (reverse the digits).
// - The bullseye's colour picks an operation group. After every ring that used that group, the bullseye's shape
//   is applied to the running total: square, reverse the digits, or round to 1, 10 or 100 (halves round up).
//   A shape drawn inside another is applied first.

export const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]; // clockwise from the top

export type Ring = 'A' | 'B' | 'C' | 'D'; // inner single, triple, outer single, double
export const RINGS: Ring[] = ['A', 'B', 'C', 'D'];
export const RING_NAME: Record<Ring, string> = { A: 'Inner ring', B: 'Triple ring', C: 'Outer ring', D: 'Double ring' };

export type Op = 'add' | 'sub' | 'mul' | 'div' | 'add3' | 'sub3';
export type Group = 'add' | 'sub' | 'mul' | 'div';
export const GROUP_OF: Record<Op, Group> = { add: 'add', sub: 'sub', mul: 'mul', div: 'div', add3: 'add', sub3: 'sub' };

export type Mark = 'cross' | 'double' | 'half' | 'reverse';
export type Shape = 'square' | 'reverse' | 'round1' | 'round10' | 'round100';

export interface Board {
  /** Section operations, keyed "<ring><number>", e.g. "A20". */
  cells: Record<string, Op>;
  /** Number ring marks, keyed by number. */
  marks: Record<number, Mark>;
  bull: { group: Group | null; outer: Shape | null; inner: Shape | null };
}

export const emptyBoard = (): Board => ({ cells: {}, marks: {}, bull: { group: null, outer: null, inner: null } });

// ---- exact fractions (bigint) ----

export interface Frac {
  n: bigint;
  d: bigint; // > 0
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};

export function frac(n: bigint | number, d: bigint | number = 1n): Frac {
  let N = BigInt(n);
  let D = BigInt(d);
  if (D === 0n) throw new RangeError('division by zero');
  if (D < 0n) [N, D] = [-N, -D];
  const g = gcd(N, D);
  return { n: N / g, d: D / g };
}

const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);

/** Decimal string; repeating decimals are cut to 6 places, as the game's floats would be. */
export function fracToString(x: Frac): string {
  const neg = x.n < 0n;
  let n = neg ? -x.n : x.n;
  const whole = n / x.d;
  n %= x.d;
  if (n === 0n) return (neg ? '-' : '') + whole;
  let digits = '';
  for (let i = 0; i < 6 && n; i++) {
    n *= 10n;
    digits += n / x.d;
    n %= x.d;
  }
  digits = digits.replace(/0+$/, '');
  return (neg ? '-' : '') + whole + (digits ? '.' + digits : '');
}

function parseDecimal(s: string): Frac {
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [w, f = ''] = s.split('.');
  const r = frac(BigInt((w || '0') + f), 10n ** BigInt(f.length));
  return neg ? frac(-r.n, r.d) : r;
}

/** Reverses the digits as written, keeping the sign: 13 -> 31, 1.5 -> 5.1, 10 -> 1. */
export function reverseDigits(x: Frac): Frac {
  const s = fracToString(x);
  const neg = s.startsWith('-');
  return parseDecimal((neg ? '-' : '') + [...(neg ? s.slice(1) : s)].reverse().join(''));
}

/** Rounds to a multiple of `unit`, halves up. */
function roundTo(x: Frac, unit: bigint): Frac {
  // floor(x / unit + 1/2) * unit
  const num = 2n * x.n + unit * x.d;
  const den = 2n * unit * x.d;
  let q = num / den;
  if (num % den !== 0n && num < 0n) q -= 1n;
  return frac(q * unit);
}

export function applyShape(x: Frac, s: Shape): Frac {
  switch (s) {
    case 'square':
      return mul(x, x);
    case 'reverse':
      return reverseDigits(x);
    case 'round1':
      return roundTo(x, 1n);
    case 'round10':
      return roundTo(x, 10n);
    case 'round100':
      return roundTo(x, 100n);
  }
}

// ---- solving ----

export interface Term {
  ring: Ring;
  number: number;
  op: Op;
  mark?: Mark;
  value: Frac; // the number after its mark (and the third)
  skipped: boolean; // crossed out
  before: Frac;
  after: Frac;
}

export interface Step {
  kind: 'term' | 'shape';
  term?: Term;
  shape?: Shape;
  ring: Ring;
  before: Frac;
  after: Frac;
}

export interface Solution {
  steps: Step[];
  answer: Frac;
  error?: string;
}

const ORDER: Record<Op, number> = { add: 0, sub: 0, add3: 0, sub3: 0, mul: 1, div: 1 };

export function markedValue(n: number, mark: Mark | undefined): Frac {
  const v = frac(n);
  switch (mark) {
    case 'double':
      return mul(v, frac(2));
    case 'half':
      return frac(n, 2);
    case 'reverse':
      return reverseDigits(v);
    default:
      return v;
  }
}

/** The bullseye's shapes in the order they apply: inner first. */
export function bullSteps(b: Board['bull']): Shape[] {
  return [b.inner, b.outer].filter((s): s is Shape => s !== null);
}

export function solve(board: Board): Solution {
  let x = frac(0);
  const steps: Step[] = [];
  const shapes = bullSteps(board.bull);
  try {
    for (const ring of RINGS) {
      const cells = NUMBERS.filter((n) => board.cells[ring + n])
        .map((n) => ({ n, op: board.cells[ring + n] }))
        .sort((a, b) => ORDER[a.op] - ORDER[b.op] || a.n - b.n);
      let hit = false;
      for (const { n, op } of cells) {
        const mark = board.marks[n];
        let value = markedValue(n, mark);
        if (op === 'add3' || op === 'sub3') value = div(value, frac(3));
        const before = x;
        const skipped = mark === 'cross';
        if (!skipped) {
          const g = GROUP_OF[op];
          x = g === 'add' ? add(x, value) : g === 'sub' ? sub(x, value) : g === 'mul' ? mul(x, value) : div(x, value);
          if (g === board.bull.group) hit = true;
        }
        steps.push({ kind: 'term', ring, before, after: x, term: { ring, number: n, op, mark, value, skipped, before, after: x } });
      }
      if (hit) {
        for (const s of shapes) {
          const before = x;
          x = applyShape(x, s);
          steps.push({ kind: 'shape', shape: s, ring, before, after: x });
        }
      }
    }
  } catch (e) {
    return { steps, answer: x, error: e instanceof RangeError ? 'Division by zero' : String(e) };
  }
  return { steps, answer: x };
}

// ---- the game's code format, e.g. "14BE,04AA,10AA" (used by tests and share links) ----

const OP_CODE: Record<string, Op> = { A: 'add', S: 'sub', M: 'mul', D: 'div', '3': 'add3', '1': 'sub3' };
const MARK_CODE: Record<string, Mark> = { X: 'cross', W: 'double', H: 'half', V: 'reverse' };
const GROUP_CODE: Record<string, Group> = { A: 'add', S: 'sub', M: 'mul', D: 'div' };
const SHAPE_CODE: Record<string, Shape> = { S: 'square', V: 'reverse', O: 'round1', T: 'round10', H: 'round100' };
// Two-step bullseye codes: [inner, outer].
const COMBO_CODE: Record<string, [Shape, Shape]> = {
  D: ['square', 'square'],
  W: ['square', 'reverse'],
  Q: ['reverse', 'square'],
  '1': ['round1', 'square'],
  '2': ['round10', 'square'],
  '3': ['round100', 'square'],
  '4': ['reverse', 'round1'],
  '5': ['reverse', 'round10'],
  '6': ['reverse', 'round100'],
  '7': ['round1', 'reverse'],
  '8': ['round10', 'reverse'],
  '9': ['round100', 'reverse'],
  A: ['square', 'round1'],
  B: ['square', 'round10'],
  C: ['square', 'round100'],
};

const invert = <K extends string, V extends string>(o: Record<K, V>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<V, K>;

/** Parses a game code. The first entry is the bullseye: two answer digits (ignored), colour, shape. */
export function parseCode(raw: string): Board {
  const board = emptyBoard();
  const [bull, ...rest] = raw.split(',').map((s) => s.trim());
  const color = bull.slice(-2, -1);
  const shape = bull.slice(-1);
  board.bull.group = GROUP_CODE[color] ?? null;
  if (SHAPE_CODE[shape]) board.bull.outer = SHAPE_CODE[shape];
  else if (COMBO_CODE[shape]) [board.bull.inner, board.bull.outer] = COMBO_CODE[shape];
  for (const c of rest) {
    const m = /^(\d{2})([A-E])(.)$/.exec(c);
    if (!m) continue; // the game skips malformed sections too
    const n = Number(m[1]);
    if (m[2] === 'E') {
      if (MARK_CODE[m[3]]) board.marks[n] = MARK_CODE[m[3]];
    } else if (OP_CODE[m[3]]) board.cells[m[2] + n] = OP_CODE[m[3]];
  }
  return board;
}

/** Encodes a board in the game's format, with "00" in place of the answer. */
export function toCode(board: Board): string {
  const g = board.bull.group ? invert(GROUP_CODE)[board.bull.group] : 'B';
  const { inner, outer } = board.bull;
  let s = 'E';
  if (outer && !inner) s = invert(SHAPE_CODE)[outer];
  else if (outer && inner) s = Object.entries(COMBO_CODE).find(([, [i, o]]) => i === inner && o === outer)?.[0] ?? 'E';
  else if (inner && !outer) s = invert(SHAPE_CODE)[inner];
  const parts = ['00' + g + s];
  const pad = (n: number) => String(n).padStart(2, '0');
  const opCode = invert(OP_CODE);
  for (const ring of RINGS)
    for (const n of [...NUMBERS].sort((a, b) => a - b)) if (board.cells[ring + n]) parts.push(pad(n) + ring + opCode[board.cells[ring + n]]);
  const markCode = invert(MARK_CODE);
  for (const n of [...NUMBERS].sort((a, b) => a - b)) if (board.marks[n]) parts.push(pad(n) + 'E' + markCode[board.marks[n]]);
  return parts.join(',');
}

/** Whether a bullseye shape pair exists in the game (the share format can only hold those). */
export function shapePairSupported(inner: Shape | null, outer: Shape | null): boolean {
  if (!inner || !outer) return true;
  return Object.values(COMBO_CODE).some(([i, o]) => i === inner && o === outer);
}
