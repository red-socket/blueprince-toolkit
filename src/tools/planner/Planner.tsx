import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ToolGate } from '../../components/Spoiler';
import { downloadPng, downloadSvg, type BuiltSvg } from '../../lib/export';
import { TIER_LABEL, useReveal } from '../../spoilers';
import { Grid, HEIGHT, RoomIcon, WIDTH } from './Grid';
import {
  bestRotation,
  CATEGORY_COLOR,
  colOf,
  decodePlan,
  doorsOf,
  emptyPlan,
  encodePlan,
  isFixed,
  issues,
  RARITY_NAME,
  rankOf,
  reachable,
  ROOM_BY_NAME,
  roomsList,
  SHAPE_NAME,
  stats,
  type Plan,
} from './logic';
import type { Shape } from './types';
import './planner.css';

const STORE = 'bpt.plan';
const CATEGORIES = ['Blueprint', 'Bedroom', 'Hallway', 'Green Room', 'Shop', 'Red Room', 'Blackprint'];
const SHAPES: Shape[] = ['dead', 'straight', 'L', 'T', 'cross'];

function loadPlan(): Plan {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '').get('p');
  if (p) return decodePlan(p) ?? emptyPlan();
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return decodePlan(saved) ?? emptyPlan();
  } catch {
    // Storage blocked: start empty.
  }
  return emptyPlan();
}

function Rarity({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span class="rarity" title={RARITY_NAME[n]} aria-label={RARITY_NAME[n]}>
      {'●'.repeat(n)}
      <span class="rarity__off">{'●'.repeat(4 - n)}</span>
    </span>
  );
}

function Gems({ n }: { n: number }) {
  if (!n) return <span class="gems gems--free">Free</span>;
  return (
    <span class="gems" aria-label={`${n} gem${n > 1 ? 's' : ''}`}>
      {n} <span aria-hidden="true">◆</span>
    </span>
  );
}

function PlannerTool() {
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const [armed, setArmed] = useState<string | null>(null); // room ready to place
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [shapeFilter, setShapeFilter] = useState<Shape | null>(null);
  const [showMid, setShowMid] = useReveal('planner-mid');
  const [showLate, setShowLate] = useReveal('planner-late');
  const [status, setStatus] = useState('');
  const [art, setArt] = useState(() => {
    try {
      return localStorage.getItem('bpt.planner.art') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('bpt.planner.art', art ? 'on' : 'off');
    } catch {
      // Storage blocked: the choice lasts for this page view.
    }
  }, [art]);
  const svgRef = useRef<SVGSVGElement>(null);

  const code = encodePlan(plan);
  useEffect(() => {
    history.replaceState(null, '', code === '1.' ? '#/planner' : `#/planner?p=${code}`);
    try {
      localStorage.setItem(STORE, code);
    } catch {
      // Storage blocked: the plan lives in the link only.
    }
  }, [code]);
  useEffect(() => {
    const on = () => {
      if (!location.hash.startsWith('#/planner')) return;
      const p = new URLSearchParams(location.hash.split('?')[1] ?? '').get('p');
      if (p && p !== encodePlan(plan)) setPlan(decodePlan(p) ?? emptyPlan());
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  });
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const reach = useMemo(() => reachable(plan), [code]);
  const st = useMemo(() => stats(plan), [code]);
  const problems = useMemo(() => issues(plan), [code]);

  const visibleTier = (t: string) => t === 'early' || t === 'none' || (t === 'mid' && showMid) || (t === 'late' && showLate);
  const rooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roomsList().filter(
      (r) =>
        visibleTier(r.tier) &&
        (!q || r.name.toLowerCase().includes(q)) &&
        (!colorFilter || r.colors.includes(colorFilter)) &&
        (!shapeFilter || r.shape === shapeFilter),
    );
  }, [query, colorFilter, shapeFilter, showMid, showLate]);

  const update = (fn: (cells: Plan['cells']) => void) =>
    setPlan((p) => {
      const cells = p.cells.slice();
      fn(cells);
      return { cells };
    });

  const onCell = (i: number) => {
    const here = plan.cells[i];
    // Placing: an empty square gets the room, which is then selected so it can be turned.
    if (armed && !here) {
      const room = armed;
      update((cells) => (cells[i] = { room, rot: bestRotation(plan, i, room) }));
      setArmed(null);
      setSelected(i);
      return;
    }
    setArmed(null);
    if (here) {
      setSelected(selected === i ? null : i);
      return;
    }
    // Empty cell with a placed room selected: move it there.
    if (selected !== null && !isFixed(selected) && plan.cells[selected]) {
      const moving = plan.cells[selected]!;
      update((cells) => {
        cells[selected] = null;
        cells[i] = { room: moving.room, rot: bestRotation({ cells }, i, moving.room) };
      });
      setSelected(i);
      return;
    }
    setSelected(null);
  };

  const rotate = (dir: 1 | -1) => {
    if (selected === null || isFixed(selected) || !plan.cells[selected]) return;
    update((cells) => {
      const p = cells[selected]!;
      cells[selected] = { ...p, rot: (p.rot + dir + 4) % 4 };
    });
  };
  const remove = () => {
    if (selected === null || isFixed(selected)) return;
    update((cells) => (cells[selected] = null));
    setSelected(null);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
      if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1);
      else if (e.key === 'Delete' || e.key === 'Backspace') remove();
      else if (e.key === 'Escape') {
        setArmed(null);
        setSelected(null);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // The exported file embeds the room cards: an SVG drawn as an image can't load other files.
  const exportSvg = async (): Promise<BuiltSvg | null> => {
    const el = svgRef.current;
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(WIDTH * 2));
    clone.setAttribute('height', String(HEIGHT * 2));
    clone.querySelectorAll('[style]').forEach((n) => n.removeAttribute('style'));
    const cache = new Map<string, Promise<string>>();
    const inline = (url: string) => {
      if (!cache.has(url))
        cache.set(
          url,
          fetch(url)
            .then((r) => r.blob())
            .then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); })),
        );
      return cache.get(url)!;
    };
    await Promise.all(
      [...clone.querySelectorAll('image')].map(async (img) => img.setAttribute('href', await inline(img.getAttribute('href')!))),
    );
    return { svg: new XMLSerializer().serializeToString(clone), width: WIDTH, height: HEIGHT };
  };

  const sel = selected !== null ? plan.cells[selected] : null;
  const selRoom = sel ? ROOM_BY_NAME.get(sel.room) : undefined;

  return (
    <div class="planner">
      <header class="tool-head">
        <h1>House Planner</h1>
        <p>
          Lay out a day's house on the 5 × 9 grid. Pick a room, then click a square to place it; it turns to fit its
          neighbours. The planner adds up the gems, counts the colours and flags doors that can't work.
        </p>
      </header>

      <div class="planner__layout">
        <section class="planner__grid panel" aria-label="House">
          <Grid ref={svgRef} plan={plan} selected={selected} reach={reach} placing={armed !== null} art={art} onCell={onCell} />
          <p class="planner__legend">
            <span><i class="dot dot--open" /> open door</span>
            <span><i class="dot dot--blocked" /> door into a wall</span>
            <span><i class="gem" /> gem cost</span>
            <label class="check planner__art">
              <input type="checkbox" checked={art} onChange={(e) => setArt(e.currentTarget.checked)} /> Room art
            </label>
            <span>Faded: not connected to the Entrance Hall</span>
          </p>
          <div class="planner__actions">
            <button
              type="button"
              class="btn btn--small"
              onClick={() => {
                if (confirm('Clear the whole house?')) {
                  setPlan(emptyPlan());
                  setSelected(null);
                }
              }}
            >
              Clear house
            </button>
            <button type="button" class="btn btn--small" onClick={async () => { const b = await exportSvg(); if (b) await downloadPng(b, WIDTH * 3, 'house-plan'); }}>
              Download PNG
            </button>
            <button type="button" class="btn btn--small" onClick={async () => { const b = await exportSvg(); if (b) downloadSvg(b, 'house-plan'); }}>
              Download SVG
            </button>
            <button
              type="button"
              class="btn btn--small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setStatus('Link copied');
                } catch {
                  setStatus("Couldn't copy the link");
                }
              }}
            >
              Copy link
            </button>
            <span class="export__status" role="status">
              {status}
            </span>
          </div>
        </section>

        <aside class="planner__side">
          <div class="panel">
            {selRoom && selected !== null ? (
              <div class="selected">
                <div class="selected__head">
                  <RoomIcon room={selRoom.name} shape={selRoom.shape} color={CATEGORY_COLOR[selRoom.colors[0]] ?? CATEGORY_COLOR.Blueprint} art={art} />
                  <div>
                    <h2>{selRoom.name}</h2>
                    <p class="selected__where">
                      Rank {rankOf(selected)}, column {colOf(selected)} · {SHAPE_NAME[selRoom.shape]} · doors {doorsOf(sel!).join(' ')}
                    </p>
                  </div>
                </div>
                {!isFixed(selected) ? (
                  <div class="selected__actions">
                    <button type="button" class="btn btn--small" onClick={() => rotate(-1)} title="Rotate left (Shift+R)">
                      ⟲ Rotate
                    </button>
                    <button type="button" class="btn btn--small" onClick={() => rotate(1)} title="Rotate right (R)">
                      Rotate ⟳
                    </button>
                    <button type="button" class="btn btn--small" onClick={remove} title="Remove (Delete)">
                      Remove
                    </button>
                  </div>
                ) : (
                  <p class="planner__note">This room is always here.</p>
                )}
                {!isFixed(selected) && <p class="planner__note">Click an empty square to move it there.</p>}
              </div>
            ) : (
              <p class="planner__note">
                {armed ? (
                  <>
                    Click an empty square to place <b>{armed}</b>. <button type="button" class="linklike" onClick={() => setArmed(null)}>Cancel</button>
                  </>
                ) : (
                  'Pick a room below, or click a room on the grid to turn, move or remove it.'
                )}
              </p>
            )}
          </div>

          <div class="panel picker-panel">
            <h2>Rooms</h2>
            <input class="search" type="search" placeholder="Search rooms" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Search rooms" />
            <div class="chips" role="group" aria-label="Filter by colour">
              {CATEGORIES.filter((c) => c !== 'Blackprint' || showLate).map((c) => (
                <button key={c} type="button" class="chip" aria-pressed={colorFilter === c} onClick={() => setColorFilter(colorFilter === c ? null : c)}>
                  <i style={{ background: CATEGORY_COLOR[c] }} /> {c}
                </button>
              ))}
            </div>
            <div class="chips" role="group" aria-label="Filter by shape">
              {SHAPES.map((s) => (
                <button key={s} type="button" class="chip" aria-pressed={shapeFilter === s} onClick={() => setShapeFilter(shapeFilter === s ? null : s)}>
                  {SHAPE_NAME[s]}
                </button>
              ))}
            </div>
            <ul class="room-list">
              {rooms.map((r) => (
                <li key={r.name}>
                  <button type="button" class="room" aria-pressed={armed === r.name} onClick={() => { setArmed(armed === r.name ? null : r.name); setSelected(null); }}>
                    <RoomIcon room={r.name} shape={r.shape} color={CATEGORY_COLOR[r.colors[0]] ?? CATEGORY_COLOR.Blueprint} art={art} />
                    <span class="room__name">{r.name}</span>
                    <span class="room__meta">
                      <Gems n={r.cost} />
                      <Rarity n={r.rarity} />
                    </span>
                  </button>
                </li>
              ))}
              {rooms.length === 0 && <li class="planner__note">No rooms match.</li>}
            </ul>
            <div class="reveals">
              <label class="check">
                <input type="checkbox" checked={showMid} onChange={(e) => setShowMid(e.currentTarget.checked)} />
                Rooms added later in the game <span class="tier tier--mid">{TIER_LABEL.mid}</span>
              </label>
              <label class="check">
                <input type="checkbox" checked={showLate} onChange={(e) => setShowLate(e.currentTarget.checked)} />
                Rare late rooms <span class="tier tier--late">{TIER_LABEL.late}</span>
              </label>
            </div>
          </div>

          <div class="panel">
            <h2>This house</h2>
            <dl class="figures">
              <div>
                <dt>Rooms drafted</dt>
                <dd>{st.rooms} / 43</dd>
              </div>
              <div>
                <dt>Gems spent</dt>
                <dd>{st.gems}</dd>
              </div>
              <div>
                <dt>Dead ends</dt>
                <dd>{st.deadEnds}</dd>
              </div>
              <div>
                <dt>Open doors</dt>
                <dd>{st.openDoors}</dd>
              </div>
              <div>
                <dt>Antechamber</dt>
                <dd>{st.reachesAntechamber ? 'Reached' : 'Not reached'}</dd>
              </div>
            </dl>
            <ul class="color-counts">
              {CATEGORIES.filter((c) => st.byColor[c]).map((c) => (
                <li key={c}>
                  <i style={{ background: CATEGORY_COLOR[c] }} /> {c} <b>{st.byColor[c]}</b>
                </li>
              ))}
            </ul>
            {problems.length > 0 && (
              <ul class="issues">
                {problems.map((p, k) => (
                  <li key={k} class={`issue issue--${p.level}`}>
                    <button type="button" class="linklike" onClick={() => setSelected(p.cell)}>
                      {p.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Planner() {
  return (
    <ToolGate
      id="tool-planner"
      tier="early"
      title="House Planner"
      warning="The planner lists the rooms you can draft, with their costs, colours and shapes. Rooms that join the house later in the game stay hidden behind their own switches."
    >
      <PlannerTool />
    </ToolGate>
  );
}
