// The interactive dartboard drawing.

import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { GROUP_OF, NUMBERS, RINGS, type Board, type Group, type Mark, type Op, type Ring, type Shape } from './engine';

export const GROUP_COLOR: Record<Group, string> = { add: '#76cee5', sub: '#fff51e', mul: '#b47097', div: '#7e69c5' };
export const OP_SIGN: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷', add3: '+⅓', sub3: '−⅓' };

// Radii in board units. The thin rings are drawn wider than on a real board so they're easy to click.
const R: Record<Ring | 'bull' | 'num', [number, number]> = {
  bull: [0, 16],
  A: [16, 52],
  B: [52, 65],
  C: [65, 94],
  D: [94, 107],
  num: [107, 128],
};

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const pt = (r: number, deg: number) => `${(r * Math.cos(rad(deg))).toFixed(2)} ${(r * Math.sin(rad(deg))).toFixed(2)}`;

function wedge(r0: number, r1: number, a0: number, a1: number): string {
  return `M${pt(r0, a0)}L${pt(r1, a0)}A${r1} ${r1} 0 0 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0} ${r0} 0 0 0 ${pt(r0, a0)}Z`;
}

const BASE = ['#25262b', '#e9dfc7'];
const BASE_THIN = ['#3b3c43', '#d3c6a5'];

/** Bullseye shape glyph centred on 0,0, about `s` units across. */
export function shapeGlyph(shape: Shape, s: number, color: string): JSX.Element {
  const w = s * 0.09;
  const common = { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linejoin': 'round' as const, 'stroke-linecap': 'round' as const };
  if (shape === 'square') return <rect x={-s / 2} y={-s / 2} width={s} height={s} {...common} />;
  if (shape === 'reverse') return <path d={`M0 ${-s * 0.62}L${s * 0.62} 0L0 ${s * 0.62}L${-s * 0.62} 0Z`} {...common} />;
  const pairs = shape === 'round1' ? 1 : shape === 'round10' ? 2 : 3;
  const wave = (y: number) => `M${-s * 0.55} ${y}q${s * 0.275} ${-s * 0.16} ${s * 0.55} 0t${s * 0.55} 0`;
  const d: string[] = [];
  for (let i = 0; i < pairs; i++) {
    d.push(wave(-s * 0.42 + i * s * 0.17), wave(s * 0.42 - i * s * 0.17));
  }
  return <path d={d.join('')} {...common} />;
}

function markGlyph(mark: Mark, color: string): JSX.Element {
  const c = { stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round' as const, fill: 'none' };
  switch (mark) {
    case 'cross':
      return <path d="M-7 -7L7 7M7 -7L-7 7" {...c} stroke-width={2} />;
    case 'half':
      return <path d="M6 -8L-6 8" {...c} stroke-width={2} />;
    case 'double':
      return (
        <g fill={color}>
          <circle cx="-3" cy="-9" r="1.7" />
          <circle cx="3" cy="-9" r="1.7" />
        </g>
      );
    case 'reverse':
      return <path d="M0 -10L10 0L0 10L-10 0Z" {...c} />;
  }
}

export type Target = { kind: 'cell'; key: string } | { kind: 'num'; n: number } | { kind: 'bull' };

interface Props {
  board: Board;
  /** Called for a click, and for each new target while dragging with a mouse. `first` is true on press. */
  onTarget: (t: Target, first: boolean) => void;
}

function targetAt(el: Element | null): Target | null {
  const t = el?.closest('[data-cell],[data-num],[data-bull]') as HTMLElement | SVGElement | null;
  if (!t) return null;
  if (t.dataset.cell) return { kind: 'cell', key: t.dataset.cell };
  if (t.dataset.num) return { kind: 'num', n: Number(t.dataset.num) };
  return { kind: 'bull' };
}

const keyOf = (t: Target) => (t.kind === 'cell' ? t.key : t.kind === 'num' ? 'n' + t.n : 'bull');

export function DartBoard({ board, onTarget }: Props) {
  const drag = useRef<{ last: string } | null>(null);

  const down = (e: PointerEvent) => {
    const t = targetAt(e.target as Element);
    if (!t) return;
    e.preventDefault();
    onTarget(t, true);
    if (e.pointerType === 'mouse') drag.current = { last: keyOf(t) };
  };
  const move = (e: PointerEvent) => {
    if (!drag.current || !(e.buttons & 1)) return;
    const t = targetAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!t || t.kind === 'bull' || keyOf(t) === drag.current.last) return;
    drag.current.last = keyOf(t);
    onTarget(t, false);
  };
  const up = () => (drag.current = null);

  const bullColor = board.bull.group ? GROUP_COLOR[board.bull.group] : '#b23a32';
  const glyphInk = board.bull.group === 'sub' || board.bull.group === 'add' ? '#1b1b1b' : '#f4efe2';

  return (
    <svg
      class="dartboard"
      viewBox="-131 -131 262 262"
      role="group"
      aria-label="Dartboard"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
    >
      <circle r="130" fill="#14161b" />
      {RINGS.map((ring) =>
        NUMBERS.map((n, i) => {
          const key = ring + n;
          const op = board.cells[key];
          const [r0, r1] = R[ring];
          const a = i * 18;
          const thin = ring === 'B' || ring === 'D';
          const base = (thin ? BASE_THIN : BASE)[i % 2];
          const mid = (r0 + r1) / 2;
          const third = op === 'add3' || op === 'sub3';
          const color = op ? GROUP_COLOR[GROUP_OF[op]] : null;
          const [lx, ly] = pt(mid, a).split(' ');
          return (
            <g key={key} data-cell={key} class="dartboard__cell">
              <title>{`${ring === 'A' ? 'Inner' : ring === 'B' ? 'Triple' : ring === 'C' ? 'Outer' : 'Double'} ring, ${n}${op ? `: ${OP_SIGN[op]}` : ''}`}</title>
              <path d={wedge(r0, r1, a - 9, a + 9)} fill={color && !third ? color : base} stroke="#14161b" stroke-width="0.8" />
              {third && color && <path d={wedge(r0, r1, a - 3, a + 3)} fill={color} />}
              {op && (
                <text x={lx} y={ly} class={`dartboard__sign${thin ? ' dartboard__sign--thin' : ''}`} fill={third ? (i % 2 ? '#1b1b1b' : '#f4efe2') : '#1b1b1b'}>
                  {OP_SIGN[op]}
                </text>
              )}
            </g>
          );
        }),
      )}
      {NUMBERS.map((n, i) => {
        const a = i * 18;
        const [r0, r1] = R.num;
        const [x, y] = pt((r0 + r1) / 2, a).split(' ');
        const mark = board.marks[n];
        return (
          <g key={'n' + n} data-num={n} class="dartboard__num">
            <title>{`Number ${n}${mark ? `: ${mark}` : ''}`}</title>
            <path d={wedge(r0, r1, a - 9, a + 9)} fill="#efe7d4" stroke="#14161b" stroke-width="0.8" />
            <text x={x} y={y} class="dartboard__numtext" fill={mark === 'cross' ? '#8a8a8a' : '#1b1b1b'}>
              {n}
            </text>
            {mark && <g transform={`translate(${x} ${y})`}>{markGlyph(mark, '#b23a32')}</g>}
          </g>
        );
      })}
      <g data-bull="1" class="dartboard__cell">
        <title>Bullseye</title>
        <circle r={R.bull[1]} fill={bullColor} stroke="#14161b" stroke-width="0.8" />
        {board.bull.outer && shapeGlyph(board.bull.outer, 17, glyphInk)}
        {board.bull.inner && shapeGlyph(board.bull.inner, 8.5, glyphInk)}
      </g>
    </svg>
  );
}
