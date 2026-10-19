import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ToolGate } from '../../components/Spoiler';
import { onNavigate, query, setQuery } from '../../lib/route';
import { DartBoard, GROUP_COLOR, OP_SIGN, shapeGlyph, type Target } from './Board';
import {
  bullSteps,
  emptyBoard,
  fracToString,
  GROUP_OF,
  parseCode,
  RING_NAME,
  shapePairSupported,
  solve,
  toCode,
  type Board,
  type Group,
  type Mark,
  type Op,
  type Shape,
  type Solution,
  type Step,
  type Term,
} from './engine';
import { LEVEL_NAME, randomBoard, type Level } from './generator';
import './darts.css';

type Tool = Op | Mark | 'erase';

const SECTION_TOOLS: [Op, string][] = [
  ['add', 'Add'],
  ['sub', 'Subtract'],
  ['mul', 'Multiply'],
  ['div', 'Divide'],
  ['add3', 'Add a third'],
  ['sub3', 'Subtract a third'],
];
const MARK_TOOLS: [Mark, string][] = [
  ['cross', 'Crossed out'],
  ['double', 'Two dots (double)'],
  ['half', 'Slash (half)'],
  ['reverse', 'Diamond (reverse)'],
];
const SHAPES: [Shape, string][] = [
  ['square', 'Square'],
  ['reverse', 'Diamond'],
  ['round1', 'One wave pair'],
  ['round10', 'Two wave pairs'],
  ['round100', 'Three wave pairs'],
];
const SHAPE_MEANING: Record<Shape, string> = {
  square: 'square it',
  reverse: 'reverse the digits',
  round1: 'round to the nearest 1',
  round10: 'round to the nearest 10',
  round100: 'round to the nearest 100',
};
const GROUP_NAME: Record<Group, string> = { add: 'blue (add)', sub: 'yellow (subtract)', mul: 'pink (multiply)', div: 'violet (divide)' };
const isMark = (t: Tool): t is Mark => t === 'cross' || t === 'double' || t === 'half' || t === 'reverse';

// ---- URL state: darts/?b=<game-format code> ----

function readHash(): Board {
  const b = query().get('b');
  if (!b) return emptyBoard();
  try {
    return parseCode(b);
  } catch {
    return emptyBoard();
  }
}

function writeHash(board: Board) {
  const code = toCode(board);
  setQuery('darts', code === '00BE' ? '' : `b=${code}`);
}

// ---- equation and steps ----

const fmt = fracToString;

function termNumber(t: Term): string {
  let s = String(t.number);
  if (t.mark === 'double') s = `(${t.number}×2)`;
  else if (t.mark === 'half') s = `(${t.number}÷2)`;
  else if (t.mark === 'reverse') s = `rev(${t.number})`;
  if (t.op === 'add3' || t.op === 'sub3') s += '÷3';
  return s;
}

const SIGN: Record<Group, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

function wrapShape(inner: ComponentChildren, s: Shape, color: string): JSX.Element {
  const c = (text: string) => <span style={{ color }}>{text}</span>;
  if (s === 'square')
    return (
      <>
        {c('(')}
        {inner}
        {c(')')}
        <sup style={{ color }}>2</sup>
      </>
    );
  if (s === 'reverse')
    return (
      <>
        {c('rev(')}
        {inner}
        {c(')')}
      </>
    );
  const unit = s === 'round1' ? '' : s === 'round10' ? '10' : '100';
  return (
    <>
      {c('round')}
      {unit && <sub style={{ color }}>{unit}</sub>}
      {c('(')}
      {inner}
      {c(')')}
    </>
  );
}

/** The board written as one expression, read left to right. */
function Equation({ sol, board }: { sol: Solution; board: Board }) {
  let expr: JSX.Element = <></>;
  let first = true;
  for (const st of sol.steps) {
    if (st.kind === 'shape') {
      expr = wrapShape(expr, st.shape!, GROUP_COLOR[board.bull.group!]);
      continue;
    }
    const t = st.term!;
    const g = GROUP_OF[t.op];
    const lead = first && (g === 'mul' || g === 'div') ? '0 ' : '';
    const piece = (
      <span class={t.skipped ? 'eq__skipped' : undefined}>
        {!first && ' '}
        {lead}
        <span class="eq__sign" style={{ color: t.skipped ? undefined : GROUP_COLOR[g] }}>
          {SIGN[g]}
        </span>
        {first ? '' : ' '}
        {termNumber(t)}
      </span>
    );
    expr = (
      <>
        {expr}
        {piece}
      </>
    );
    first = false;
  }
  if (first) return <p class="eq eq--empty">Colour some sections to start.</p>;
  return (
    <>
      <p class="eq">{expr}</p>
      <p class="darts__note">Read it from left to right, one step at a time.</p>
    </>
  );
}

function stepText(st: Step): string {
  if (st.kind === 'shape') return `Bullseye: ${SHAPE_MEANING[st.shape!]}. ${fmt(st.before)} → ${fmt(st.after)}`;
  const t = st.term!;
  if (t.skipped) return `${t.number} is crossed out, so this section is skipped.`;
  const g = GROUP_OF[t.op];
  let value = '';
  if (t.mark || t.op === 'add3' || t.op === 'sub3') value = ` (${termNumber(t)} = ${fmt(t.value)})`;
  return `${fmt(t.before)} ${SIGN[g]} ${fmt(t.value)} = ${fmt(t.after)}${value}`;
}

function Steps({ sol }: { sol: Solution }) {
  const rings: { ring: string; items: Step[] }[] = [];
  for (const st of sol.steps) {
    const last = rings[rings.length - 1];
    if (last && last.ring === st.ring) last.items.push(st);
    else rings.push({ ring: st.ring, items: [st] });
  }
  return (
    <ol class="steps">
      {rings.map((r) => (
        <li key={r.ring}>
          <span class="steps__ring">{RING_NAME[r.ring as keyof typeof RING_NAME]}</span>
          <ul>
            {r.items.map((st, i) => (
              <li key={i} class={st.kind === 'shape' ? 'steps__shape' : undefined}>
                {stepText(st)}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Reveal({ label, shown, onShow, children }: { label: string; shown: boolean; onShow: () => void; children: ComponentChildren }) {
  if (shown) return <>{children}</>;
  return (
    <button type="button" class="reveal" onClick={onShow}>
      {label}
    </button>
  );
}

// ---- palette pieces ----

function ToolButton({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ComponentChildren; label: string }) {
  return (
    <button type="button" class="tool" aria-pressed={active} onClick={onClick} title={label}>
      {children}
      <span class="tool__label">{label}</span>
    </button>
  );
}

function Swatch({ op }: { op: Op }) {
  const g = GROUP_OF[op];
  const third = op === 'add3' || op === 'sub3';
  return (
    <span class={`swatch${third ? ' swatch--third' : ''}`} style={{ '--c': GROUP_COLOR[g] } as Record<string, string>} aria-hidden="true">
      {OP_SIGN[op]}
    </span>
  );
}

function MarkIcon({ mark }: { mark: Mark }) {
  return (
    <svg class="swatch swatch--mark" viewBox="-14 -14 28 28" aria-hidden="true">
      <text x="0" y="5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" opacity={mark === 'cross' ? 0.5 : 1}>
        7
      </text>
      {mark === 'cross' && <path d="M-7 -7L7 7M7 -7L-7 7" stroke="#e0675c" stroke-width="2" stroke-linecap="round" />}
      {mark === 'half' && <path d="M6 -8L-6 8" stroke="#e0675c" stroke-width="2" stroke-linecap="round" />}
      {mark === 'double' && (
        <g fill="#e0675c">
          <circle cx="-3" cy="-9" r="1.7" />
          <circle cx="3" cy="-9" r="1.7" />
        </g>
      )}
      {mark === 'reverse' && <path d="M0 -11L11 0L0 11L-11 0Z" stroke="#e0675c" stroke-width="1.6" fill="none" />}
    </svg>
  );
}

function ShapeIcon({ shape }: { shape: Shape | null }) {
  return (
    <svg class="swatch swatch--mark" viewBox="-14 -14 28 28" aria-hidden="true">
      {shape ? shapeGlyph(shape, 17, 'currentColor') : <path d="M-7 7L7 -7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />}
    </svg>
  );
}

// ---- the tool ----

function Solver() {
  const [board, setBoard] = useState<Board>(readHash);
  const [tool, setTool] = useState<Tool>('add');
  const [shown, setShown] = useState({ steps: false, answer: false });
  const [level, setLevel] = useState<Level>(1);
  const [status, setStatus] = useState('');
  const sol = useMemo(() => solve(board), [board]);
  const code = toCode(board);

  useEffect(() => writeHash(board), [code]);
  useEffect(() => setShown({ steps: false, answer: false }), [code]);
  useEffect(() => {
    return onNavigate(() => setBoard(readHash()));
  }, []);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  // Dragging repeats whatever the press did: paint, or clear when the press cleared.
  const [dragClears, setDragClears] = useState(false);

  const onTarget = (t: Target, first: boolean) => {
    setBoard((b) => {
      const next: Board = { cells: { ...b.cells }, marks: { ...b.marks }, bull: { ...b.bull } };
      if (t.kind === 'bull') {
        if (tool === 'erase') next.bull = { group: null, outer: null, inner: null };
        else if (!isMark(tool)) next.bull.group = next.bull.group === GROUP_OF[tool] ? null : GROUP_OF[tool];
        return next;
      }
      if (t.kind === 'cell') {
        if (isMark(tool)) return b;
        const clear = tool === 'erase' || (first ? next.cells[t.key] === tool : dragClears);
        if (first) setDragClears(clear);
        if (clear) delete next.cells[t.key];
        else next.cells[t.key] = tool as Op;
        return next;
      }
      if (!isMark(tool) && tool !== 'erase') return b;
      const clear = tool === 'erase' || (first ? next.marks[t.n] === tool : dragClears);
      if (first) setDragClears(clear);
      if (clear) delete next.marks[t.n];
      else next.marks[t.n] = tool as Mark;
      return next;
    });
  };

  const setBull = (patch: Partial<Board['bull']>) =>
    setBoard((b) => {
      const bull = { ...b.bull, ...patch };
      if (!bull.outer) bull.inner = null;
      if (!shapePairSupported(bull.inner, bull.outer)) bull.inner = null;
      return { ...b, bull };
    });

  const answer = sol.answer;
  const whole = answer.d === 1n;
  const hint = isMark(tool)
    ? 'Click numbers on the outer ring to mark them.'
    : tool === 'erase'
      ? 'Click a section, number or the bullseye to clear it.'
      : 'Click or drag over sections to colour them. Click the bullseye to give it this colour.';

  return (
    <div class="darts">
      <header class="tool-head">
        <h1>Darts Calculator</h1>
        <p>
          Copy the Billiard Room dartboard by colouring its sections, and the calculator writes it out as an equation. The
          working and the answer stay hidden until you ask.
        </p>
      </header>

      <div class="darts__layout">
        <section class="darts__board panel" aria-label="Board">
          <div class="palette" role="toolbar" aria-label="Tools">
            <div class="palette__group">
              <span class="palette__title">Sections</span>
              <div class="palette__tools">
                {SECTION_TOOLS.map(([op, label]) => (
                  <ToolButton key={op} active={tool === op} onClick={() => setTool(op)} label={label}>
                    <Swatch op={op} />
                  </ToolButton>
                ))}
              </div>
            </div>
            <div class="palette__group">
              <span class="palette__title">Numbers</span>
              <div class="palette__tools">
                {MARK_TOOLS.map(([m, label]) => (
                  <ToolButton key={m} active={tool === m} onClick={() => setTool(m)} label={label}>
                    <MarkIcon mark={m} />
                  </ToolButton>
                ))}
                <ToolButton active={tool === 'erase'} onClick={() => setTool('erase')} label="Eraser">
                  <span class="swatch swatch--erase" aria-hidden="true" />
                </ToolButton>
              </div>
            </div>
          </div>
          <p class="darts__hint">{hint}</p>
          <DartBoard board={board} onTarget={onTarget} />
          <div class="bull-controls">
            <div class="field">
              <span class="field__label">Bullseye shape</span>
              <div class="segmented">
                {[null, ...SHAPES.map(([s]) => s)].map((s) => (
                  <button
                    key={s ?? 'none'}
                    type="button"
                    role="radio"
                    aria-checked={board.bull.outer === s}
                    title={s ? SHAPES.find(([x]) => x === s)![1] : 'None'}
                    onClick={() => setBull({ outer: s })}
                  >
                    <ShapeIcon shape={s} />
                  </button>
                ))}
              </div>
            </div>
            {board.bull.outer && (
              <div class="field">
                <span class="field__label">Smaller shape inside it</span>
                <div class="segmented">
                  {[null, ...SHAPES.map(([s]) => s)]
                    .filter((s) => shapePairSupported(s, board.bull.outer))
                    .map((s) => (
                      <button
                        key={s ?? 'none'}
                        type="button"
                        role="radio"
                        aria-checked={board.bull.inner === s}
                        title={s ? SHAPES.find(([x]) => x === s)![1] : 'None'}
                        onClick={() => setBull({ inner: s })}
                      >
                        <ShapeIcon shape={s} />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div class="darts__actions">
            <button type="button" class="btn btn--small" onClick={() => setBoard(emptyBoard())}>
              Clear board
            </button>
            <span class="darts__random">
              <button type="button" class="btn btn--small" onClick={() => setBoard(randomBoard(level))}>
                Random practice board
              </button>
              <select value={level} onChange={(e) => setLevel(Number(e.currentTarget.value) as Level)} aria-label="Practice difficulty">
                {([1, 2, 3] as Level[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_NAME[l]}
                  </option>
                ))}
              </select>
            </span>
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

        <section class="darts__result" aria-label="Solution">
          <div class="panel">
            <h2>Equation</h2>
            <Equation sol={sol} board={board} />
            {board.bull.group && bullSteps(board.bull).length > 0 && (
              <p class="darts__note">
                The bullseye is {GROUP_NAME[board.bull.group]}: its shape applies after each ring with a {board.bull.group === 'add' ? 'blue' : board.bull.group === 'sub' ? 'yellow' : board.bull.group === 'mul' ? 'pink' : 'violet'} section.
              </p>
            )}
          </div>
          <div class="panel">
            <h2>Working</h2>
            <Reveal label="Show the working" shown={shown.steps} onShow={() => setShown((s) => ({ ...s, steps: true }))}>
              {sol.steps.length ? <Steps sol={sol} /> : <p class="darts__note">Nothing to work out yet.</p>}
            </Reveal>
          </div>
          <div class="panel">
            <h2>Answer</h2>
            <Reveal label="Show the answer" shown={shown.answer} onShow={() => setShown((s) => ({ ...s, answer: true }))}>
              {sol.error ? (
                <p class="darts__warn">{sol.error}: check the board.</p>
              ) : (
                <>
                  <p class="answer">{fmt(answer)}</p>
                  {(!whole || answer.n < 1n || answer.n > 99n) && (
                    <p class="darts__warn">The game's answers are whole numbers from 1 to 99, so a section or mark may be off.</p>
                  )}
                </>
              )}
            </Reveal>
          </div>
          <details class="panel rules">
            <summary>How the board works</summary>
            <ul>
              <li>Start at 0 and work outwards, one ring at a time: inner ring, triple ring, outer ring, double ring.</li>
              <li>
                Each coloured section applies its number: <b style={{ color: GROUP_COLOR.add }}>blue</b> adds,{' '}
                <b style={{ color: GROUP_COLOR.sub }}>yellow</b> subtracts, <b style={{ color: GROUP_COLOR.mul }}>pink</b> multiplies,{' '}
                <b style={{ color: GROUP_COLOR.div }}>violet</b> divides. A thin strip uses a third of the number.
              </li>
              <li>Within a ring, adding and subtracting come before multiplying and dividing.</li>
              <li>Marks on a number change it everywhere: crossed out skips it, two dots double it, a slash halves it, a diamond reverses its digits.</li>
              <li>
                The bullseye's shape applies after every ring that has a section of the bullseye's colour: a square squares the total, a
                diamond reverses its digits, and one, two or three pairs of waves round it to the nearest 1, 10 or 100 (halves round up). A
                smaller shape inside another applies first.
              </li>
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}

export function DartsSolver() {
  return (
    <ToolGate
      id="tool-darts"
      tier="early"
      title="Darts Calculator"
      warning="This tool explains every marking the Billiard Room dartboard can have, including some that only appear on later boards. Answers stay hidden until you ask for them."
    >
      <Solver />
    </ToolGate>
  );
}
