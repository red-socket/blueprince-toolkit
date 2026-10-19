// Parlor boxes: three boxes, each with statements; the solver finds where the gems are.
//
// The game's rules: at least one box shows only true statements, at least one shows only false statements, and
// exactly one box holds the gems. A box with no statements counts as neither all true nor all false.
// Every combination of prize box and true/false for each statement is tried; a combination is kept when each
// statement's claim matches the truth it was given and the rules hold.

export type Box = 'blue' | 'white' | 'black';
export const BOXES: Box[] = ['blue', 'white', 'black'];
export type BoxRef = Box | 'this';
export type Quant = 'all' | 'some' | 'none' | 'one'; // all / at least one / none / exactly one
export type Cmp = 'exactly' | 'atLeast' | 'atMost';
export type Scope = 'thisOther' | 'thisBox' | 'othersAll' | 'box';
export type BoxKind = 'allTrue' | 'allFalse' | 'mixed';

export type Statement =
  | { kind: 'gemsIn'; target: BoxRef }
  | { kind: 'gemsNotIn'; target: BoxRef }
  | { kind: 'gemsNextTo'; target: BoxRef }
  | { kind: 'gemsNotNextTo'; target: BoxRef }
  | { kind: 'gemsWithCount'; cmp: Cmp; n: number }
  | { kind: 'gemsInKind'; boxKind: Exclude<BoxKind, 'mixed'> }
  | { kind: 'truth'; quant: Quant; value: boolean; scope: Scope; box: Box }
  | { kind: 'boxIs'; target: BoxRef; boxKind: BoxKind }
  | { kind: 'count'; cmp: Cmp; n: number; value: boolean; scope: 'thisBox' | 'all' }
  | { kind: 'sameCount' }
  | { kind: 'fixed'; value: boolean }
  | { kind: 'either' };

export interface Puzzle {
  boxes: Record<Box, Statement[]>;
  /** Left-to-right order on the table, for "next to" statements. */
  order: Box[];
}

export interface World {
  prize: Box;
  truth: boolean[][]; // per box, per statement
}

export interface Result {
  worlds: World[];
  prizes: Box[]; // boxes the gems can be in
}

const NAME: Record<Box, string> = { blue: 'blue', white: 'white', black: 'black' };

function resolve(ref: BoxRef, self: Box): Box {
  return ref === 'this' ? self : ref;
}

function cmp(c: Cmp, a: number, n: number) {
  return c === 'exactly' ? a === n : c === 'atLeast' ? a >= n : a <= n;
}

function quant(q: Quant, values: boolean[], want: boolean) {
  const hits = values.filter((v) => v === want).length;
  if (q === 'all') return values.length > 0 && hits === values.length;
  if (q === 'some') return hits >= 1;
  if (q === 'none') return hits === 0;
  return hits === 1;
}

function kindOf(values: boolean[]): BoxKind | 'blank' {
  if (!values.length) return 'blank';
  if (values.every(Boolean)) return 'allTrue';
  if (values.every((v) => !v)) return 'allFalse';
  return 'mixed';
}

/** What a statement claims in a world; null when it can't be judged (either way is fine). */
function claim(s: Statement, self: Box, index: number, p: Puzzle, w: World): boolean | null {
  const at = (b: Box) => p.order.indexOf(b);
  const truths = (b: Box) => w.truth[BOXES.indexOf(b)];
  switch (s.kind) {
    case 'gemsIn':
      return w.prize === resolve(s.target, self);
    case 'gemsNotIn':
      return w.prize !== resolve(s.target, self);
    case 'gemsNextTo':
      return Math.abs(at(w.prize) - at(resolve(s.target, self))) === 1;
    case 'gemsNotNextTo':
      return Math.abs(at(w.prize) - at(resolve(s.target, self))) !== 1;
    case 'gemsWithCount':
      return cmp(s.cmp, p.boxes[w.prize].length, s.n);
    case 'gemsInKind':
      return kindOf(truths(w.prize)) === s.boxKind;
    case 'truth': {
      let values: boolean[];
      if (s.scope === 'thisOther') values = truths(self).filter((_, k) => k !== index);
      else if (s.scope === 'thisBox') values = truths(self);
      else if (s.scope === 'box') values = truths(s.box);
      else values = BOXES.flatMap((b) => truths(b).filter((_, k) => b !== self || k !== index));
      return quant(s.quant, values, s.value);
    }
    case 'boxIs':
      return kindOf(truths(resolve(s.target, self))) === s.boxKind;
    case 'count': {
      const values = s.scope === 'thisBox' ? truths(self) : BOXES.flatMap(truths);
      return cmp(s.cmp, values.filter((v) => v === s.value).length, s.n);
    }
    case 'sameCount': {
      const all = BOXES.flatMap(truths);
      return all.filter(Boolean).length === all.filter((v) => !v).length;
    }
    case 'fixed':
      return s.value;
    case 'either':
      return null;
  }
}

export function solve(p: Puzzle): Result {
  const sizes = BOXES.map((b) => p.boxes[b].length);
  const total = sizes.reduce((a, b) => a + b, 0);
  const worlds: World[] = [];
  for (const prize of BOXES) {
    for (let mask = 0; mask < 1 << total; mask++) {
      let bit = 0;
      const truth = sizes.map((n) => Array.from({ length: n }, () => ((mask >> bit++) & 1) === 1));
      const w: World = { prize, truth };
      const kinds = truth.map(kindOf);
      if (!kinds.includes('allTrue') || !kinds.includes('allFalse')) continue;
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        const b = BOXES[k];
        p.boxes[b].forEach((s, i) => {
          const c = claim(s, b, i, p, w);
          if (c !== null && c !== truth[k][i]) ok = false;
        });
      }
      if (ok) worlds.push(w);
    }
  }
  return { worlds, prizes: BOXES.filter((b) => worlds.some((w) => w.prize === b)) };
}

// ---- wording ----

function boxName(ref: BoxRef, self: Box) {
  return ref === 'this' || ref === self ? 'this box' : `the ${NAME[ref]} box`;
}

const QUANT: Record<Quant, string> = { all: 'All', some: 'At least one', none: 'None', one: 'Exactly one' };
const CMP: Record<Cmp, string> = { exactly: 'exactly', atLeast: 'at least', atMost: 'at most' };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** The statement as a sentence, for the list and the explanation. */
export function sentence(s: Statement, self: Box): string {
  switch (s.kind) {
    case 'gemsIn':
      return `The gems are in ${boxName(s.target, self)}.`;
    case 'gemsNotIn':
      return `The gems are not in ${boxName(s.target, self)}.`;
    case 'gemsNextTo':
      return `The gems are in a box next to ${boxName(s.target, self)}.`;
    case 'gemsNotNextTo':
      return `The gems are not in a box next to ${boxName(s.target, self)}.`;
    case 'gemsWithCount':
      return `The gems are in a box with ${CMP[s.cmp]} ${plural(s.n, 'statement')}.`;
    case 'gemsInKind':
      return `The gems are in a box whose statements are all ${s.boxKind === 'allTrue' ? 'true' : 'false'}.`;
    case 'truth': {
      const where = { thisOther: 'of the other statements on this box', thisBox: 'of the statements on this box', othersAll: 'of the other statements', box: `of the statements on the ${NAME[s.box]} box` }[s.scope];
      return `${QUANT[s.quant]} ${where} ${s.quant === 'all' || s.quant === 'none' ? 'are' : 'is'} ${s.value ? 'true' : 'false'}.`;
    }
    case 'boxIs':
      return `${boxName(s.target, self).replace(/^./, (c) => c.toUpperCase())} ${s.boxKind === 'allTrue' ? 'has only true statements' : s.boxKind === 'allFalse' ? 'has only false statements' : 'has both true and false statements'}.`;
    case 'count':
      return `${s.scope === 'thisBox' ? 'On this box' : 'Across all the boxes'}, ${CMP[s.cmp]} ${plural(s.n, 'statement')} ${s.n === 1 ? 'is' : 'are'} ${s.value ? 'true' : 'false'}.`;
    case 'sameCount':
      return 'There are as many true statements as false ones.';
    case 'fixed':
      return s.value ? '(A statement that is simply true.)' : '(A statement that is simply false.)';
    case 'either':
      return '(A statement that could be either, like "This statement is of no help".)';
  }
}
