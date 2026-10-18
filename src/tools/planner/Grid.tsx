// The house grid as an SVG, drawn with inline attributes so the same markup can be exported as an image.

import type { JSX } from 'preact';
import { forwardRef } from 'preact/compat';
import {
  CATEGORY_COLOR,
  COLS,
  doorsOf,
  doorState,
  isFixed,
  RANKS,
  ROOM_BY_NAME,
  type Plan,
} from './logic';
import type { Shape, Side } from './types';

export const CELL = 100;
export const LEFT = 52;
export const TOP = 16;
export const WIDTH = LEFT + COLS * CELL + 16;
export const HEIGHT = TOP + RANKS * CELL + 16;

const NAVY = '#1c335c';
const CHALK = '#e6ecf6';
const BRASS = '#d4af37';
const RED = '#ec7a6f';
const FONT = "'Inter Variable', Inter, system-ui, sans-serif";

/** Mixes a hex colour into the tile background. */
function tint(hex: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(NAVY.slice(1), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * amount + ((b >> shift) & 255) * (1 - amount));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Splits a name into at most three short lines. */
function lines(name: string, max = 11): string[] {
  const out: string[] = [];
  for (const w of name.split(' ')) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w;
    else out.push(w);
  }
  return out.slice(0, 3);
}

/** Walls of a room tile (inset square) with a gap on each door side. */
function walls(x: number, y: number, doors: Side[], inset = 10, gap = 30): string {
  const a = inset;
  const b = CELL - inset;
  const g0 = (CELL - gap) / 2;
  const g1 = (CELL + gap) / 2;
  const P = (px: number, py: number) => `${x + px} ${y + py}`;
  const side = (s: Side, from: [number, number], to: [number, number], mid0: [number, number], mid1: [number, number]) =>
    doors.includes(s) ? `M${P(...from)}L${P(...mid0)}M${P(...mid1)}L${P(...to)}` : `M${P(...from)}L${P(...to)}`;
  return [
    side('N', [a, a], [b, a], [g0, a], [g1, a]),
    side('E', [b, a], [b, b], [b, g0], [b, g1]),
    side('S', [b, b], [a, b], [g1, b], [g0, b]),
    side('W', [a, b], [a, a], [a, g1], [a, g0]),
  ].join('');
}

function doorMark(x: number, y: number, side: Side, state: string): JSX.Element | null {
  const c = CELL / 2;
  const pos: Record<Side, [number, number]> = { N: [c, 10], S: [c, CELL - 10], E: [CELL - 10, c], W: [10, c] };
  const [px, py] = pos[side];
  const cx = x + px;
  const cy = y + py;
  if (state === 'open') return <circle cx={cx} cy={cy} r="4.5" fill={BRASS} />;
  if (state === 'blocked' || state === 'outside') {
    const v = side === 'N' || side === 'S';
    return (
      <path
        d={v ? `M${cx - 9} ${cy}L${cx + 9} ${cy}` : `M${cx} ${cy - 9}L${cx} ${cy + 9}`}
        stroke={RED}
        stroke-width={state === 'outside' ? 5 : 3}
        stroke-linecap="round"
      />
    );
  }
  return null;
}

interface Props {
  plan: Plan;
  selected: number | null;
  reach: Set<number>;
  /** Highlights empty cells while a room is ready to place. */
  placing: boolean;
  onCell: (i: number) => void;
  interactive?: boolean;
}

export const Grid = forwardRef<SVGSVGElement, Props>(function Grid({ plan, selected, reach, placing, onCell, interactive = true }, ref) {
  const tiles: JSX.Element[] = [];
  for (let r = RANKS; r >= 1; r--) {
    for (let c = 1; c <= COLS; c++) {
      const i = (r - 1) * COLS + (c - 1);
      const x = LEFT + (c - 1) * CELL;
      const y = TOP + (RANKS - r) * CELL;
      const p = plan.cells[i];
      const room = p ? ROOM_BY_NAME.get(p.room) : undefined;
      const sel = selected === i;
      const handlers = interactive ? { onClick: () => onCell(i), style: { cursor: 'pointer' } } : {};
      if (!p || !room) {
        tiles.push(
          <g key={i} data-cell={i} {...handlers}>
            <rect x={x + 3} y={y + 3} width={CELL - 6} height={CELL - 6} rx="4" fill={placing ? 'rgba(212,175,55,0.08)' : 'rgba(230,236,246,0.03)'} stroke={sel ? BRASS : 'rgba(230,236,246,0.18)'} stroke-width={sel ? 3 : 1} stroke-dasharray={sel ? undefined : '4 5'} />
          </g>,
        );
        continue;
      }
      const doors = doorsOf(p);
      const colors = room.colors.length ? room.colors : ['Blueprint'];
      const main = CATEGORY_COLOR[colors[0]] ?? CATEGORY_COLOR.Blueprint;
      const dim = !reach.has(i);
      const bandW = (CELL - 20) / colors.length;
      const nameLines = lines(room.name);
      tiles.push(
        <g key={i} data-cell={i} opacity={dim ? 0.55 : 1} {...handlers}>
          <rect x={x + 3} y={y + 3} width={CELL - 6} height={CELL - 6} rx="4" fill={tint(main, isFixed(i) ? 0.22 : 0.3)} stroke={sel ? BRASS : 'none'} stroke-width="3" />
          {colors.map((col, k) => (
            <rect key={col} x={x + 10 + k * bandW} y={y + CELL - 22} width={bandW} height="7" fill={CATEGORY_COLOR[col] ?? main} />
          ))}
          <path d={walls(x, y, doors)} stroke={CHALK} stroke-width="3" fill="none" stroke-linecap="square" />
          {doors.map((s) => doorMark(x, y, s, doorState(plan, i, s)))}
          <text x={x + CELL / 2} y={y + CELL / 2 - (nameLines.length - 1) * 6.5 - 3} fill={CHALK} font-family={FONT} font-size="11.5" font-weight="600" text-anchor="middle">
            {nameLines.map((l, k) => (
              <tspan key={k} x={x + CELL / 2} dy={k ? 13 : 0}>
                {l}
              </tspan>
            ))}
          </text>
          {room.cost > 0 && (
            <g>
              {Array.from({ length: Math.min(room.cost, 5) }, (_, k) => {
                const gx = x + CELL - 20 - k * 8;
                const gy = y + 21;
                return <path key={k} d={`M${gx} ${gy - 4.5}L${gx + 3.5} ${gy}L${gx} ${gy + 4.5}L${gx - 3.5} ${gy}Z`} fill="#7fd1ae" />;
              })}
            </g>
          )}
        </g>,
      );
    }
  }
  return (
    <svg ref={ref} class="house" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} xmlns="http://www.w3.org/2000/svg" role="group" aria-label="House plan">
      <rect width={WIDTH} height={HEIGHT} fill="#16294a" />
      {Array.from({ length: RANKS }, (_, k) => {
        const r = RANKS - k;
        return (
          <text key={r} x={LEFT - 14} y={TOP + k * CELL + CELL / 2 + 5} fill="#a9b8d2" font-family={FONT} font-size="15" font-weight="600" text-anchor="end">
            {r}
          </text>
        );
      })}
      <rect x={LEFT} y={TOP} width={COLS * CELL} height={RANKS * CELL} fill="none" stroke="rgba(230,236,246,0.45)" stroke-width="2" rx="6" />
      {tiles}
    </svg>
  );
});

/** Small picture of a shape for the room list. */
export function ShapeIcon({ shape, color }: { shape: Shape; color: string }) {
  const doors: Record<Shape, Side[]> = { dead: ['S'], straight: ['S', 'N'], L: ['S', 'W'], T: ['S', 'E', 'W'], cross: ['N', 'E', 'S', 'W'] };
  return (
    <svg viewBox="0 0 100 100" class="shape-icon" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="8" fill={tint(color, 0.45)} />
      <path d={walls(0, 0, doors[shape], 18, 34)} stroke={CHALK} stroke-width="9" fill="none" stroke-linecap="square" />
    </svg>
  );
}
