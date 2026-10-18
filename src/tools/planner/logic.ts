// House plan model: a 5 x 9 grid (rank 1 at the bottom), rooms with a rotation, and the checks the planner shows.

import { ROOMS } from './rooms.generated';
import type { RoomData, Shape, Side } from './types';

export const COLS = 5;
export const RANKS = 9;
export const SIDES: Side[] = ['N', 'E', 'S', 'W'];

export const ROOM_BY_NAME = new Map(ROOMS.map((r) => [r.name, r]));

export const RARITY_NAME = ['', 'Commonplace', 'Standard', 'Unusual', 'Rare'];
export const SHAPE_NAME: Record<Shape, string> = { dead: 'Dead end', straight: 'Straight', L: 'Corner', T: 'Three-way', cross: 'Four-way' };

export const CATEGORY_COLOR: Record<string, string> = {
  Blueprint: '#0093ec',
  Bedroom: '#9a6fcf',
  Hallway: '#e78f52',
  'Green Room': '#52b74f',
  Shop: '#d2be60',
  'Red Room': '#c20f00',
  Blackprint: '#3a3d45',
};

/** Doors of each shape with the entrance at the south, before rotation. */
const BASE_DOORS: Record<Shape, Side[]> = {
  dead: ['S'],
  straight: ['S', 'N'],
  L: ['S', 'W'],
  T: ['S', 'E', 'W'],
  cross: ['N', 'E', 'S', 'W'],
};

const turn = (s: Side, rot: number): Side => SIDES[(SIDES.indexOf(s) + rot) % 4];

export interface Placed {
  room: string;
  rot: number; // quarter turns clockwise
}

export interface Plan {
  cells: (Placed | null)[]; // index = (rank - 1) * COLS + (col - 1)
}

export const idx = (rank: number, col: number) => (rank - 1) * COLS + (col - 1);
export const rankOf = (i: number) => Math.floor(i / COLS) + 1;
export const colOf = (i: number) => (i % COLS) + 1;

export const ENTRANCE = idx(1, 3);
export const ANTECHAMBER = idx(9, 3);
export const isFixed = (i: number) => i === ENTRANCE || i === ANTECHAMBER;

export function emptyPlan(): Plan {
  const cells: (Placed | null)[] = Array(COLS * RANKS).fill(null);
  cells[ENTRANCE] = { room: 'Entrance Hall', rot: 2 }; // doors west, north and east
  cells[ANTECHAMBER] = { room: 'Antechamber', rot: 0 };
  return { cells };
}

export function doorsOf(p: Placed): Side[] {
  const room = ROOM_BY_NAME.get(p.room);
  return room ? BASE_DOORS[room.shape].map((s) => turn(s, p.rot)) : [];
}

const STEP: Record<Side, [number, number]> = { N: [1, 0], S: [-1, 0], E: [0, 1], W: [0, -1] };
const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** The cell a door leads to, or null when it leads out of the house. */
export function neighbor(i: number, side: Side): number | null {
  const r = rankOf(i) + STEP[side][0];
  const c = colOf(i) + STEP[side][1];
  if (r < 1 || r > RANKS || c < 1 || c > COLS) return null;
  return idx(r, c);
}

export type DoorState = 'open' | 'linked' | 'blocked' | 'outside' | 'exit';

export function doorState(plan: Plan, i: number, side: Side): DoorState {
  // The Entrance Hall's south side is the front door, the Antechamber's north side leads on.
  if (i === ANTECHAMBER && side === 'N') return 'exit';
  const n = neighbor(i, side);
  if (n === null) return 'outside';
  const other = plan.cells[n];
  if (!other) return 'open';
  return doorsOf(other).includes(OPPOSITE[side]) ? 'linked' : 'blocked';
}

/** Cells reachable from the Entrance Hall through linked doors. */
export function reachable(plan: Plan): Set<number> {
  const seen = new Set([ENTRANCE]);
  const queue = [ENTRANCE];
  while (queue.length) {
    const i = queue.shift()!;
    for (const side of doorsOf(plan.cells[i]!)) {
      if (doorState(plan, i, side) !== 'linked') continue;
      const n = neighbor(i, side)!;
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

export interface Issue {
  cell: number;
  level: 'error' | 'warn';
  text: string;
}

export function issues(plan: Plan): Issue[] {
  const out: Issue[] = [];
  const reach = reachable(plan);
  plan.cells.forEach((p, i) => {
    if (!p) return;
    const room = ROOM_BY_NAME.get(p.room);
    const where = `${p.room} (rank ${rankOf(i)}, column ${colOf(i)})`;
    const doors = doorsOf(p);
    const outside = doors.filter((s) => doorState(plan, i, s) === 'outside');
    if (outside.length) out.push({ cell: i, level: 'error', text: `${where}: a door faces the outer wall. The game never offers a room that doesn't fit.` });
    if (!reach.has(i) && i !== ANTECHAMBER) out.push({ cell: i, level: 'warn', text: `${where} isn't connected to the Entrance Hall.` });
    if (room?.name === 'Tunnel') {
      if (!doors.includes('N') || !doors.includes('S')) out.push({ cell: i, level: 'error', text: `${where}: the Tunnel only runs north to south.` });
      if (rankOf(i) === 1 || rankOf(i) === RANKS) out.push({ cell: i, level: 'warn', text: `${where}: the Tunnel doesn't normally appear in the first or last rank.` });
    }
  });
  return out;
}

/** Picks the rotation that fits best: no doors into the outer wall, an entrance linked to a neighbour, few blocked doors. */
export function bestRotation(plan: Plan, i: number, room: string): number {
  const shape = ROOM_BY_NAME.get(room)?.shape;
  if (!shape) return 0;
  let best = 0;
  let bestScore = -Infinity;
  const turns = shape === 'cross' ? 1 : shape === 'straight' ? 2 : 4;
  for (let rot = 0; rot < turns; rot++) {
    const test: Plan = { cells: plan.cells.slice() };
    test.cells[i] = { room, rot };
    let score = 0;
    const doors = doorsOf(test.cells[i]!);
    for (const side of doors) {
      const st = doorState(test, i, side);
      if (st === 'outside') score -= 100;
      if (st === 'linked') score += 10;
      if (st === 'blocked') score -= 3;
    }
    // The drafted entrance is the south door: prefer it to be the linked one.
    if (doorState(test, i, turn('S', rot)) === 'linked') score += 2;
    if (score > bestScore) [best, bestScore] = [rot, score];
  }
  return best;
}

export interface Stats {
  rooms: number;
  gems: number;
  byColor: Record<string, number>;
  byRarity: number[];
  deadEnds: number;
  openDoors: number;
  reachesAntechamber: boolean;
}

export function stats(plan: Plan): Stats {
  const s: Stats = { rooms: 0, gems: 0, byColor: {}, byRarity: [0, 0, 0, 0, 0], deadEnds: 0, openDoors: 0, reachesAntechamber: false };
  const reach = reachable(plan);
  plan.cells.forEach((p, i) => {
    if (!p || isFixed(i)) return;
    const room = ROOM_BY_NAME.get(p.room);
    if (!room) return;
    s.rooms++;
    s.gems += room.cost;
    for (const c of room.colors) s.byColor[c] = (s.byColor[c] ?? 0) + 1;
    if (room.rarity) s.byRarity[room.rarity]++;
    if (room.shape === 'dead') s.deadEnds++;
  });
  plan.cells.forEach((p, i) => {
    if (!p || !reach.has(i)) return;
    for (const side of doorsOf(p)) if (doorState(plan, i, side) === 'open') s.openDoors++;
  });
  s.reachesAntechamber = reach.has(ANTECHAMBER);
  return s;
}

// ---- share format: "1." then per cell two base-36 digits for the room (00 = empty) and one for the rotation ----

const ROOM_INDEX = new Map(ROOMS.map((r, k) => [r.name, k + 1]));

export function encodePlan(plan: Plan): string {
  let s = '1.';
  plan.cells.forEach((p, i) => {
    if (isFixed(i)) return;
    if (!p) s += '000';
    else s += (ROOM_INDEX.get(p.room) ?? 0).toString(36).padStart(2, '0') + p.rot;
  });
  return s.replace(/(000)+$/, '');
}

export function decodePlan(code: string): Plan | null {
  if (!code.startsWith('1.')) return null;
  const plan = emptyPlan();
  let k = 2;
  for (let i = 0; i < plan.cells.length; i++) {
    if (isFixed(i)) continue;
    const chunk = code.slice(k, k + 3);
    k += 3;
    if (chunk.length < 3) break;
    const n = parseInt(chunk.slice(0, 2), 36);
    const rot = Number(chunk[2]) % 4;
    const room = n > 0 ? ROOMS[n - 1] : undefined;
    plan.cells[i] = room ? { room: room.name, rot } : null;
  }
  return plan;
}

export function roomsList(): RoomData[] {
  return ROOMS.filter((r) => r.name !== 'Entrance Hall' && r.name !== 'Antechamber');
}
