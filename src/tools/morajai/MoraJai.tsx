import { useEffect, useRef, useState } from 'preact/hooks';
import { ToolGate } from '../../components/Spoiler';
import { query, setQuery } from '../../lib/route';
import { COLORS, CORNER_TILES, press, solved, type Board, type Color, type Corners, type SolveResult } from './engine';
import './morajai.css';

export const TILE: Record<Color, string> = {
  grey: '#7f8083',
  white: '#f1efe9',
  black: '#1c1c1e',
  red: '#c8302c',
  orange: '#ec7f26',
  yellow: '#f0cf3a',
  green: '#3d9a50',
  blue: '#3d7fd8',
  violet: '#7c50b8',
  pink: '#ea8bba',
};
const NAME: Record<Color, string> = {
  grey: 'Grey',
  white: 'White',
  black: 'Black',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet',
  pink: 'Pink',
};
const RULE: Record<Color, string> = {
  grey: 'Does nothing.',
  white: 'It and the tiles beside it (not diagonal) flip between white and grey.',
  black: 'Its row shifts one step to the right, wrapping around.',
  red: 'Every black tile turns red and every white tile turns black.',
  orange: 'Becomes the colour most of the tiles beside it share, if one colour leads.',
  yellow: 'Swaps with the tile above it.',
  green: 'Swaps with the tile on the opposite side of the box.',
  blue: "Does whatever the middle tile's colour does, from where the blue tile is.",
  violet: 'Swaps with the tile below it.',
  pink: 'The tiles around it, diagonals included, turn one step clockwise.',
};
const POS = ['top left', 'top', 'top right', 'left', 'middle', 'right', 'bottom left', 'bottom', 'bottom right'];
const ink = (c: Color) => (c === 'white' || c === 'yellow' || c === 'pink' || c === 'orange' ? '#1b1b1b' : '#ffffff');

const DEFAULT_BOARD: Board = ['grey', 'white', 'grey', 'white', 'white', 'white', 'grey', 'white', 'grey'];
const DEFAULT_CORNERS: Corners = ['white', 'white', 'white', 'white'];

function readQuery(): { board: Board; corners: Corners } {
  const s = query().get('m') ?? '';
  if (!/^\d{13}$/.test(s)) return { board: DEFAULT_BOARD, corners: DEFAULT_CORNERS };
  const c = [...s].map((d) => COLORS[Number(d)]);
  return { board: c.slice(0, 9), corners: c.slice(9) as Corners };
}

function writeQuery(board: Board, corners: Corners) {
  setQuery('morajai', 'm=' + [...board, ...corners].map((c) => COLORS.indexOf(c)).join(''));
}

type Mode = 'paint' | 'play';

function Box({
  board,
  corners,
  highlight,
  onTile,
  onCorner,
  small,
}: {
  board: Board;
  corners: Corners;
  highlight?: number | null;
  onTile?: (i: number) => void;
  onCorner?: (k: number) => void;
  small?: boolean;
}) {
  return (
    <div class={`mj-box${small ? ' mj-box--small' : ''}`}>
      {corners.map((c, k) => (
        <button
          key={'c' + k}
          type="button"
          class={`mj-corner mj-corner--${k}${board[CORNER_TILES[k]] === c ? ' mj-corner--ok' : ''}`}
          style={{ background: TILE[c] }}
          title={`${POS[CORNER_TILES[k]]} symbol: ${NAME[c]}`}
          aria-label={`${POS[CORNER_TILES[k]]} corner symbol, ${NAME[c]}`}
          disabled={!onCorner}
          onClick={() => onCorner?.(k)}
        />
      ))}
      <div class="mj-grid">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            class={`mj-tile${highlight === i ? ' mj-tile--next' : ''}`}
            style={{ background: TILE[c], color: ink(c) }}
            aria-label={`${POS[i]} tile, ${NAME[c]}`}
            disabled={!onTile}
            onClick={() => onTile?.(i)}
          >
            <span class="mj-tile__letter">{c === 'grey' ? '' : NAME[c][0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Solver() {
  const init = readQuery();
  const [start, setStart] = useState<Board>(init.board);
  const [corners, setCorners] = useState<Corners>(init.corners);
  const [board, setBoard] = useState<Board>(init.board); // the box as played
  const [mode, setMode] = useState<Mode>('paint');
  const [brush, setBrush] = useState<Color>('white');
  const [cornerBrush, setCornerBrush] = useState(true); // paint corners with the brush too
  const [result, setResult] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<'none' | 'hint' | 'all'>('none');
  const [step, setStep] = useState(0);
  const worker = useRef<Worker | null>(null);
  const job = useRef(0);

  useEffect(() => writeQuery(start, corners), [start, corners]);
  useEffect(() => () => worker.current?.terminate(), []);
  // Any change to the puzzle forgets the old answer.
  useEffect(() => {
    setResult(null);
    setShown('none');
    setStep(0);
  }, [start.join(), corners.join()]);

  const runSolve = () => {
    worker.current?.terminate();
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const id = ++job.current;
    setBusy(true);
    setResult(null);
    setShown('none');
    setStep(0);
    setBoard(start);
    w.onmessage = (e: MessageEvent<SolveResult & { id: number }>) => {
      if (e.data.id !== id) return;
      setResult(e.data);
      setBusy(false);
      w.terminate();
    };
    w.postMessage({ id, board: start, corners });
  };

  const onTile = (i: number) => {
    if (mode === 'paint') {
      const next = start.slice();
      next[i] = brush;
      setStart(next);
      setBoard(next);
    } else setBoard((b) => press(b, i));
  };
  const onCorner = (k: number) => {
    const next = corners.slice() as Corners;
    next[k] = cornerBrush ? brush : COLORS[(COLORS.indexOf(next[k]) + 1) % COLORS.length];
    setCorners(next);
  };

  const moves = result?.moves ?? null;
  // Step-through: the board after `step` presses of the solution.
  const stepBoard = moves ? moves.slice(0, step).reduce((b, m) => press(b, m), start) : start;
  const open = solved(board, corners);

  return (
    <div class="mj">
      <header class="tool-head">
        <h1>Mora Jai Solver</h1>
        <p>Paint the box's tiles and its four corner symbols, then play it here or let the solver find the shortest way to open it.</p>
      </header>

      <div class="mj__layout">
        <section class="panel mj__main" aria-label="Box">
          <div class="segmented mj__mode" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" aria-checked={mode === 'paint'} onClick={() => { setMode('paint'); setBoard(start); }}>
              Set up the box
            </button>
            <button type="button" role="radio" aria-checked={mode === 'play'} onClick={() => { setMode('play'); setBoard(start); }}>
              Play it
            </button>
          </div>

          <Box board={mode === 'paint' ? start : board} corners={corners} onTile={onTile} onCorner={mode === 'paint' ? onCorner : undefined} />

          {mode === 'paint' ? (
            <>
              <div class="mj-palette" role="radiogroup" aria-label="Tile colour">
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={brush === c} class="mj-swatch" style={{ background: TILE[c], color: ink(c) }} onClick={() => setBrush(c)} title={NAME[c]}>
                    <span>{NAME[c]}</span>
                  </button>
                ))}
              </div>
              <p class="mj__hint">Pick a colour, then click tiles to paint them. Click the corner symbols to paint those too.</p>
              <label class="check">
                <input type="checkbox" checked={!cornerBrush} onChange={(e) => setCornerBrush(!e.currentTarget.checked)} /> Clicking a corner cycles its colour instead
              </label>
              <div class="mj__actions">
                <button type="button" class="btn btn--small" onClick={() => setCorners([brush, brush, brush, brush])}>
                  All corners {NAME[brush].toLowerCase()}
                </button>
                <button type="button" class="btn btn--small" onClick={() => { const g: Board = Array(9).fill('grey'); setStart(g); setBoard(g); }}>
                  Clear tiles
                </button>
              </div>
            </>
          ) : (
            <>
              <p class={`mj__status${open ? ' mj__status--open' : ''}`} role="status">
                {open ? 'All four corners match: the box opens.' : 'Click tiles to press them.'}
              </p>
              <div class="mj__actions">
                <button type="button" class="btn btn--small" onClick={() => setBoard(start)}>
                  Start over
                </button>
              </div>
            </>
          )}
        </section>

        <aside class="mj__side">
          <div class="panel">
            <h2>Solution</h2>
            {!result && (
              <button type="button" class="btn btn--primary" disabled={busy} onClick={runSolve}>
                {busy ? 'Searching…' : 'Solve'}
              </button>
            )}
            {result && moves === null && (
              <p class="mj__warn">
                {result.limited
                  ? `No solution within ${result.explored.toLocaleString()} positions. Check the tiles and corner symbols.`
                  : `This box can't be opened as painted (all ${result.explored.toLocaleString()} reachable positions tried). Check the tiles and corner symbols.`}
              </p>
            )}
            {moves && moves.length === 0 && <p>It's already open: all four corners match.</p>}
            {moves && moves.length > 0 && (
              <>
                <p>
                  Shortest solution: <b>{moves.length}</b> press{moves.length > 1 ? 'es' : ''}.
                </p>
                {shown === 'none' && (
                  <div class="mj__reveal">
                    <button type="button" class="reveal" onClick={() => setShown('hint')}>
                      Show the first press
                    </button>
                    <button type="button" class="reveal" onClick={() => setShown('all')}>
                      Show every press
                    </button>
                  </div>
                )}
                {shown === 'hint' && (
                  <>
                    <p>
                      First, press the <b>{POS[moves[0]]}</b> tile ({NAME[start[moves[0]]].toLowerCase()}).
                    </p>
                    <button type="button" class="reveal" onClick={() => setShown('all')}>
                      Show every press
                    </button>
                  </>
                )}
                {shown === 'all' && (
                  <>
                    <ol class="mj-steps">
                      {moves.map((m, k) => {
                        const before = moves.slice(0, k).reduce((b, mm) => press(b, mm), start);
                        return (
                          <li key={k} class={k === step ? 'is-current' : k < step ? 'is-done' : undefined}>
                            <button type="button" class="linklike" onClick={() => setStep(k)}>
                              {POS[m]} <span class="mj-dot" style={{ background: TILE[before[m]] }} />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <Box board={stepBoard} corners={corners} highlight={step < moves.length ? moves[step] : null} small />
                    <div class="mj__actions">
                      <button type="button" class="btn btn--small" disabled={step === 0} onClick={() => setStep(step - 1)}>
                        Back
                      </button>
                      <button type="button" class="btn btn--small" disabled={step >= moves.length} onClick={() => setStep(step + 1)}>
                        {step >= moves.length ? 'Open' : `Press ${step + 1}`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            {result && (
              <button type="button" class="btn btn--small mj__again" onClick={runSolve}>
                Solve again
              </button>
            )}
          </div>

          <details class="panel rules">
            <summary>How the tiles work</summary>
            <ul class="mj-rules">
              {COLORS.map((c) => (
                <li key={c}>
                  <span class="mj-dot" style={{ background: TILE[c] }} /> <b>{NAME[c]}</b>: {RULE[c]}
                </li>
              ))}
            </ul>
            <p class="mj__hint">The box opens when each corner tile matches the symbol at its corner.</p>
          </details>
        </aside>
      </div>
    </div>
  );
}

export function MoraJai() {
  return (
    <ToolGate
      id="tool-morajai"
      tier="mid"
      title="Mora Jai Solver"
      warning="This tool explains what every tile colour on the puzzle boxes does, including colours you only meet later in the game. Solutions stay hidden until you ask."
    >
      <Solver />
    </ToolGate>
  );
}
