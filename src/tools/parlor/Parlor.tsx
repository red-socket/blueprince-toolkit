import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ToolGate } from '../../components/Spoiler';
import { query, setQuery } from '../../lib/route';
import { BOXES, sentence, solve, type Box, type BoxKind, type BoxRef, type Cmp, type Puzzle, type Quant, type Scope, type Statement } from './engine';
import './parlor.css';

const BOX_NAME: Record<Box, string> = { blue: 'Blue', white: 'White', black: 'Black' };
const MAX = 4;

type Kind = Statement['kind'];
const KINDS: [Kind, string][] = [
  ['gemsIn', 'The gems are in …'],
  ['gemsNotIn', 'The gems are not in …'],
  ['gemsNextTo', 'The gems are next to …'],
  ['gemsNotNextTo', 'The gems are not next to …'],
  ['gemsWithCount', 'The gems are in a box with N statements'],
  ['gemsInKind', 'The gems are in a box with only true/false statements'],
  ['truth', 'All / some / none of the statements … are true/false'],
  ['boxIs', 'A box has only true / only false / mixed statements'],
  ['count', 'Exactly / at least / at most N statements are true/false'],
  ['sameCount', 'As many true statements as false'],
  ['either', "Could be either (e.g. \"This statement is of no help\")"],
  ['fixed', 'Simply true or simply false'],
];

function defaults(kind: Kind): Statement {
  switch (kind) {
    case 'gemsIn':
    case 'gemsNotIn':
    case 'gemsNextTo':
    case 'gemsNotNextTo':
      return { kind, target: 'this' };
    case 'gemsWithCount':
      return { kind, cmp: 'exactly', n: 1 };
    case 'gemsInKind':
      return { kind, boxKind: 'allTrue' };
    case 'truth':
      return { kind, quant: 'some', value: false, scope: 'othersAll', box: 'blue' };
    case 'boxIs':
      return { kind, target: 'this', boxKind: 'allTrue' };
    case 'count':
      return { kind, cmp: 'exactly', n: 1, value: true, scope: 'thisBox' };
    case 'sameCount':
      return { kind };
    case 'fixed':
      return { kind, value: true };
    case 'either':
      return { kind };
  }
}

const EMPTY: Puzzle = { boxes: { blue: [{ kind: 'gemsIn', target: 'this' }], white: [{ kind: 'gemsNotIn', target: 'this' }], black: [{ kind: 'gemsIn', target: 'blue' }] }, order: ['blue', 'white', 'black'] };

function readQuery(): Puzzle {
  const raw = query().get('p');
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as Puzzle;
    if (!v.boxes || !BOXES.every((b) => Array.isArray(v.boxes[b])) || !Array.isArray(v.order)) return EMPTY;
    for (const b of BOXES) v.boxes[b] = v.boxes[b].filter((s) => KINDS.some(([k]) => k === s?.kind)).slice(0, MAX);
    if (v.order.length !== 3 || !BOXES.every((b) => v.order.includes(b))) v.order = EMPTY.order;
    return v;
  } catch {
    return EMPTY;
  }
}

function writeQuery(p: Puzzle) {
  setQuery('parlor', 'p=' + btoa(JSON.stringify(p)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

function Sel<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <select class="pl-select" aria-label={label} value={String(value)} onChange={(e) => onChange(options.find(([v]) => String(v) === e.currentTarget.value)![0])}>
      {options.map(([v, t]) => (
        <option key={String(v)} value={String(v)}>
          {t}
        </option>
      ))}
    </select>
  );
}

const REF_OPTS = (self: Box): [BoxRef, string][] => [['this', 'this box'], ...BOXES.filter((b) => b !== self).map((b) => [b, `the ${b} box`] as [BoxRef, string])];
const CMP_OPTS: [Cmp, string][] = [
  ['exactly', 'exactly'],
  ['atLeast', 'at least'],
  ['atMost', 'at most'],
];
const N_OPTS: [number, string][] = [0, 1, 2, 3, 4, 5, 6].map((n) => [n, String(n)]);
const TF: [string, string][] = [
  ['true', 'true'],
  ['false', 'false'],
];

/** The parameter dropdowns for one statement. */
function Params({ s, self, set }: { s: Statement; self: Box; set: (s: Statement) => void }) {
  const tf = (v: boolean, on: (b: boolean) => void) => <Sel label="True or false" value={v ? 'true' : 'false'} options={TF} onChange={(x) => on(x === 'true')} />;
  switch (s.kind) {
    case 'gemsIn':
    case 'gemsNotIn':
    case 'gemsNextTo':
    case 'gemsNotNextTo':
      return <Sel label="Box" value={s.target} options={REF_OPTS(self)} onChange={(target) => set({ ...s, target })} />;
    case 'gemsWithCount':
      return (
        <>
          <Sel label="Comparison" value={s.cmp} options={CMP_OPTS} onChange={(cmp) => set({ ...s, cmp })} />
          <Sel label="Number" value={s.n} options={N_OPTS.slice(0, 5)} onChange={(n) => set({ ...s, n })} />
        </>
      );
    case 'gemsInKind':
      return (
        <Sel
          label="Kind"
          value={s.boxKind}
          options={[
            ['allTrue', 'only true statements'],
            ['allFalse', 'only false statements'],
          ]}
          onChange={(boxKind) => set({ ...s, boxKind })}
        />
      );
    case 'truth':
      return (
        <>
          <Sel
            label="How many"
            value={s.quant}
            options={
              [
                ['all', 'all'],
                ['some', 'at least one'],
                ['one', 'exactly one'],
                ['none', 'none'],
              ] as [Quant, string][]
            }
            onChange={(quant) => set({ ...s, quant })}
          />
          <Sel
            label="Of which statements"
            value={s.scope === 'box' ? `box:${s.box}` : s.scope}
            options={[
              ['othersAll', 'of the other statements'],
              ['thisOther', 'of the other statements on this box'],
              ['thisBox', 'of the statements on this box'],
              ...BOXES.filter((b) => b !== self).map((b) => [`box:${b}`, `of the statements on the ${b} box`] as [string, string]),
            ]}
            onChange={(v) => (v.startsWith('box:') ? set({ ...s, scope: 'box', box: v.slice(4) as Box }) : set({ ...s, scope: v as Scope }))}
          />
          {tf(s.value, (value) => set({ ...s, value }))}
        </>
      );
    case 'boxIs':
      return (
        <>
          <Sel label="Box" value={s.target} options={REF_OPTS(self)} onChange={(target) => set({ ...s, target })} />
          <Sel
            label="Kind"
            value={s.boxKind}
            options={
              [
                ['allTrue', 'only true'],
                ['allFalse', 'only false'],
                ['mixed', 'both true and false'],
              ] as [BoxKind, string][]
            }
            onChange={(boxKind) => set({ ...s, boxKind })}
          />
        </>
      );
    case 'count':
      return (
        <>
          <Sel
            label="Where"
            value={s.scope}
            options={[
              ['thisBox', 'on this box'],
              ['all', 'across all boxes'],
            ]}
            onChange={(scope) => set({ ...s, scope })}
          />
          <Sel label="Comparison" value={s.cmp} options={CMP_OPTS} onChange={(cmp) => set({ ...s, cmp })} />
          <Sel label="Number" value={s.n} options={N_OPTS} onChange={(n) => set({ ...s, n })} />
          {tf(s.value, (value) => set({ ...s, value }))}
        </>
      );
    case 'fixed':
      return tf(s.value, (value) => set({ ...s, value }));
    default:
      return null;
  }
}

function Reveal({ label, children }: { label: string; children: ComponentChildren }) {
  const [shown, setShown] = useState(false);
  if (shown) return <>{children}</>;
  return (
    <button type="button" class="reveal" onClick={() => setShown(true)}>
      {label}
    </button>
  );
}

function Solver() {
  const [puzzle, setPuzzle] = useState<Puzzle>(readQuery);
  const result = useMemo(() => solve(puzzle), [puzzle]);
  const key = JSON.stringify(puzzle);
  useEffect(() => writeQuery(puzzle), [key]);
  const usesNextTo = BOXES.some((b) => puzzle.boxes[b].some((s) => s.kind === 'gemsNextTo' || s.kind === 'gemsNotNextTo'));

  const update = (b: Box, fn: (list: Statement[]) => Statement[]) => setPuzzle((p) => ({ ...p, boxes: { ...p.boxes, [b]: fn(p.boxes[b].slice()) } }));

  return (
    <div class="parlor">
      <header class="tool-head">
        <h1>Parlor Solver</h1>
        <p>Copy the statements from the three boxes. The solver works out which box holds the gems; the answer and the reasoning stay hidden until you ask.</p>
      </header>

      <div class="pl-boxes">
        {BOXES.map((b) => (
          <section key={b} class={`panel pl-box pl-box--${b}`} aria-label={`${BOX_NAME[b]} box`}>
            <h2>
              <span class={`pl-lid pl-lid--${b}`} aria-hidden="true" /> {BOX_NAME[b]} box
            </h2>
            {puzzle.boxes[b].length === 0 && <p class="pl-note">No statements. A blank box counts as neither true nor false.</p>}
            <ol class="pl-list">
              {puzzle.boxes[b].map((s, i) => (
                <li key={i} class="pl-statement">
                  <Sel label="Statement type" value={s.kind} options={KINDS} onChange={(k) => update(b, (l) => ((l[i] = defaults(k)), l))} />
                  <div class="pl-params">
                    <Params s={s} self={b} set={(ns) => update(b, (l) => ((l[i] = ns), l))} />
                  </div>
                  <p class="pl-sentence">{sentence(s, b)}</p>
                  <button type="button" class="linklike pl-remove" onClick={() => update(b, (l) => (l.splice(i, 1), l))}>
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            {puzzle.boxes[b].length < MAX && (
              <button type="button" class="btn btn--small" onClick={() => update(b, (l) => [...l, defaults('gemsIn')])}>
                Add a statement
              </button>
            )}
          </section>
        ))}
      </div>

      <div class="pl-bottom">
        <div class="panel">
          <h2>Answer</h2>
          {result.prizes.length === 0 ? (
            <p class="pl-warn">No arrangement fits these statements and the rules. Check that each statement matches its box.</p>
          ) : (
            <Reveal label="Show where the gems are" key={key}>
              {result.prizes.length === 1 ? (
                <p class="pl-answer">
                  <span class={`pl-lid pl-lid--${result.prizes[0]}`} aria-hidden="true" /> The gems are in the <b>{result.prizes[0]}</b> box.
                </p>
              ) : (
                <p class="pl-warn">
                  These statements don't settle it: the gems could be in the {result.prizes.join(' or the ')} box. A statement may be missing or entered
                  differently from the box.
                </p>
              )}
            </Reveal>
          )}
          {result.worlds.length > 0 && (
            <div class="pl-why">
              <Reveal label="Show the reasoning" key={key + 'why'}>
                {result.worlds.slice(0, 6).map((w, k) => (
                  <div key={k} class="pl-world">
                    <p class="pl-world__head">
                      {result.worlds.length > 1 ? `Possibility ${k + 1}: ` : ''}gems in the {w.prize} box
                    </p>
                    <ul>
                      {BOXES.map((b, bi) =>
                        puzzle.boxes[b].map((s, i) => (
                          <li key={b + i}>
                            <span class={`pl-tf pl-tf--${w.truth[bi][i]}`}>{w.truth[bi][i] ? 'True' : 'False'}</span> {BOX_NAME[b]}: {sentence(s, b)}
                          </li>
                        )),
                      )}
                    </ul>
                  </div>
                ))}
                {result.worlds.length > 6 && <p class="pl-note">…and {result.worlds.length - 6} more.</p>}
              </Reveal>
            </div>
          )}
        </div>

        <div class="panel">
          <h2>Setup</h2>
          {usesNextTo && (
            <div class="field">
              <span class="field__label">Boxes from left to right</span>
              <div class="segmented">
                {[
                  ['blue', 'white', 'black'],
                  ['blue', 'black', 'white'],
                  ['white', 'blue', 'black'],
                  ['white', 'black', 'blue'],
                  ['black', 'blue', 'white'],
                  ['black', 'white', 'blue'],
                ].map((o) => (
                  <button key={o.join()} type="button" role="radio" aria-checked={puzzle.order.join() === o.join()} onClick={() => setPuzzle((p) => ({ ...p, order: o as Box[] }))}>
                    {o.map((b) => BOX_NAME[b as Box][0]).join(' · ')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div class="pl-actions">
            <button type="button" class="btn btn--small" onClick={() => setPuzzle({ boxes: { blue: [], white: [], black: [] }, order: puzzle.order })}>
              Clear all
            </button>
            <button
              type="button"
              class="btn btn--small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                } catch {
                  // Nothing to do: the address bar has the link too.
                }
              }}
            >
              Copy link
            </button>
          </div>
          <details class="rules">
            <summary>The rules</summary>
            <ul>
              <li>At least one box shows only true statements.</li>
              <li>At least one box shows only false statements.</li>
              <li>Exactly one box holds the gems; the other two are empty.</li>
              <li>A box with no statements counts as neither all true nor all false.</li>
            </ul>
            <p class="pl-note">
              For statements that don't fit a template, pick the closest one, or "Simply true or false" if you can tell, or "Could be either" if it
              says nothing.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

export function Parlor() {
  return (
    <ToolGate
      id="tool-parlor"
      tier="early"
      title="Parlor Solver"
      warning="This tool solves the Parlor's box puzzle. The answer and the reasoning stay hidden until you ask for them."
    >
      <Solver />
    </ToolGate>
  );
}
