// Run tracker state, kept in this browser only (localStorage).

export interface Counter {
  id: string;
  name: string;
  icon: string | null; // card icon name, or null for a custom counter
  value: number;
  start: number; // value at the start of each day
}

export interface DayRecord {
  day: number;
  finished: string; // ISO date
  rooms: number;
  values: { name: string; value: number }[];
  note: string;
}

export interface Change {
  id: string; // counter id, or 'rooms'
  delta: number;
}

export interface TrackerState {
  day: number;
  rooms: number;
  counters: Counter[];
  note: string;
  undo: Change[][]; // grouped changes, newest last
  history: DayRecord[];
  lowSteps: number;
}

export const DEFAULT_COUNTERS: Counter[] = [
  { id: 'steps', name: 'Steps', icon: 'steps', value: 50, start: 50 },
  { id: 'gems', name: 'Gems', icon: 'gem', value: 0, start: 0 },
  { id: 'keys', name: 'Keys', icon: 'key', value: 0, start: 0 },
  { id: 'coins', name: 'Coins', icon: 'coins', value: 0, start: 0 },
  { id: 'dice', name: 'Dice', icon: 'die', value: 0, start: 0 },
];

export const initialState = (): TrackerState => ({
  day: 1,
  rooms: 0,
  counters: DEFAULT_COUNTERS.map((c) => ({ ...c })),
  note: '',
  undo: [],
  history: [],
  lowSteps: 10,
});

const KEY = 'bpt.tracker';

export function load(): TrackerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as TrackerState;
    if (!Array.isArray(s.counters) || typeof s.day !== 'number') return initialState();
    return { ...initialState(), ...s, undo: [] };
  } catch {
    return initialState();
  }
}

export function save(s: TrackerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, undo: [] }));
  } catch {
    // Storage blocked: the tracker works for this page view only.
  }
}

/** Applies changes and records them for undo. */
export function apply(s: TrackerState, changes: Change[]): TrackerState {
  const counters = s.counters.map((c) => {
    const d = changes.filter((ch) => ch.id === c.id).reduce((a, ch) => a + ch.delta, 0);
    return d ? { ...c, value: c.value + d } : c;
  });
  const rooms = s.rooms + changes.filter((ch) => ch.id === 'rooms').reduce((a, ch) => a + ch.delta, 0);
  return { ...s, counters, rooms, undo: [...s.undo.slice(-199), changes] };
}

export function undo(s: TrackerState): TrackerState {
  const last = s.undo[s.undo.length - 1];
  if (!last) return s;
  const reverted = apply(s, last.map((c) => ({ ...c, delta: -c.delta })));
  return { ...reverted, undo: s.undo.slice(0, -1) };
}

/** Ends the day: records it in the history and resets the counters to their start values. */
export function newDay(s: TrackerState): TrackerState {
  const record: DayRecord = {
    day: s.day,
    finished: new Date().toISOString(),
    rooms: s.rooms,
    values: s.counters.map((c) => ({ name: c.name, value: c.value })),
    note: s.note,
  };
  return {
    ...s,
    day: s.day + 1,
    rooms: 0,
    note: '',
    undo: [],
    counters: s.counters.map((c) => ({ ...c, value: c.start })),
    history: [record, ...s.history].slice(0, 500),
  };
}

export function historyCsv(h: DayRecord[]): string {
  const names = [...new Set(h.flatMap((r) => r.values.map((v) => v.name)))];
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['Day', 'Finished', 'Rooms', ...names, 'Note'].map(q).join(',')];
  for (const r of [...h].reverse()) {
    rows.push([String(r.day), r.finished.slice(0, 10), String(r.rooms), ...names.map((n) => String(r.values.find((v) => v.name === n)?.value ?? '')), r.note].map(q).join(','));
  }
  return rows.join('\n') + '\n';
}
