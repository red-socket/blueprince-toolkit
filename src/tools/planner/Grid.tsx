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
import { ROOM_ART } from './art.generated';
import type { Shape, Side } from './types';

const ART_BASE = `${import.meta.env.BASE_URL}rooms/`;

/** The room's card for a rotation, and how far it still has to be turned (when the game has no card for it). */
export function artFor(room: string, rot: number, shape: Shape): { href: string; turn: number } | null {
  const cards = ROOM_ART[room];
  if (!cards?.length) return null;
  const any = cards.find((c) => c.rot === null);
  if (any) return { href: ART_BASE + any.file, turn: 0 };
  const exact = cards.find((c) => c.rot === rot);
  if (exact) return { href: ART_BASE + exact.file, turn: 0 };
  // A straight room looks the same turned half way round.
  if (shape === 'straight' || shape === 'cross') {
    const half = cards.find((c) => c.rot === (rot + 2) % 4);
    if (half) return { href: ART_BASE + half.file, turn: 0 };
  }
  const c = cards[0];
  return { href: ART_BASE + c.file, turn: (rot - (c.rot ?? 0) + 4) % 4 };
}

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
  /** Draw the game's room cards instead of the plain tiles. */
  art: boolean;
  onCell: (i: number) => void;
  interactive?: boolean;
}

export const Grid = forwardRef<SVGSVGElement, Props>(function Grid({ plan, selected, reach, placing, art, onCell, interactive = true }, ref) {
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
      const card = art ? artFor(room.name, p.rot, room.shape) : null;
      const gems =
        room.cost > 0 ? (
          <g>
            {card && <rect x={x + CELL - 26 - (Math.min(room.cost, 5) - 1) * 8} y={y + 13} width={12 + (Math.min(room.cost, 5) - 1) * 8} height="16" rx="8" fill="rgba(10,18,32,0.75)" />}
            {Array.from({ length: Math.min(room.cost, 5) }, (_, k) => {
              const gx = x + CELL - 20 - k * 8;
              const gy = y + 21;
              return <path key={k} d={`M${gx} ${gy - 4.5}L${gx + 3.5} ${gy}L${gx} ${gy + 4.5}L${gx - 3.5} ${gy}Z`} fill="#f2a7c9" />;
            })}
          </g>
        ) : null;
      if (card) {
        tiles.push(
          <g key={i} data-cell={i} opacity={dim ? 0.55 : 1} {...handlers}>
            <title>{room.name}</title>
            <image
              href={card.href}
              x={x + 2}
              y={y + 2}
              width={CELL - 4}
              height={CELL - 4}
              transform={card.turn ? `rotate(${card.turn * 90} ${x + CELL / 2} ${y + CELL / 2})` : undefined}
            />
            {doors.map((s) => doorMark(x, y, s, doorState(plan, i, s)))}
            {gems}
            {sel && <rect x={x + 2} y={y + 2} width={CELL - 4} height={CELL - 4} rx="3" fill="none" stroke={BRASS} stroke-width="4" />}
          </g>,
        );
        continue;
      }
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
          {gems}
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

/** The room's card as a small picture, or its shape when there's no card or art is off. */
export function RoomIcon({ room, shape, color, art }: { room: string; shape: Shape; color: string; art: boolean }) {
  const card = art ? artFor(room, 0, shape) : null;
  if (card) return <img class="shape-icon shape-icon--art" src={card.href} alt="" loading="lazy" width="64" height="64" />;
  return <ShapeIcon shape={shape} color={color} />;
}

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
