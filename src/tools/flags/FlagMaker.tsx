import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Spoiler, ToolGate } from '../../components/Spoiler';
import { copyPng, downloadPng, downloadSvg } from '../../lib/export';
import { query, setQuery } from '../../lib/route';
import { CORES } from '../sigil/data';
import { buildEmblem, COLORS, coreThumb, REALM_FLAGS, type EmblemSpec, type FlagPattern, type FlagRatio, type FlagShape, type IconBack } from './render';
import '../sigil/sigil.css';
import './flags.css';

const DEFAULT: EmblemSpec = {
  mode: 'flag',
  core: 0,
  style: 'filled',
  ink: 'auto',
  back: 'rounded',
  backColor: '#1d4277',
  scale: 0.72,
  shape: 'rect',
  ratio: '3:2',
  pattern: 'plain',
  field: COLORS[7].color,
  accent: '#d4af37',
  emblemPos: 'center',
  emblemSize: 0.36,
  edge: false,
};

const BACKS: [IconBack, string][] = [
  ['none', 'None'],
  ['circle', 'Circle'],
  ['rounded', 'Rounded'],
  ['square', 'Square'],
  ['shield', 'Shield'],
  ['diamond', 'Diamond'],
];
const SHAPES: [FlagShape, string][] = [
  ['rect', 'Flag'],
  ['swallowtail', 'Swallowtail'],
  ['pennant', 'Pennant'],
  ['banner', 'Hanging banner'],
];
const RATIOS: FlagRatio[] = ['3:2', '5:3', '2:1', '1:1'];
const PATTERNS: [FlagPattern, string][] = [
  ['plain', 'Plain'],
  ['border', 'Border'],
  ['band', 'Band'],
  ['halves', 'Halves'],
  ['tricolour', 'Tricolour'],
  ['cross', 'Cross'],
  ['saltire', 'Saltire'],
];

const HEX = /^#[0-9a-f]{6}$/i;

function readQuery(): EmblemSpec {
  const raw = query().get('e');
  if (!raw) return DEFAULT;
  try {
    const v = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
    const s = { ...DEFAULT, ...v } as EmblemSpec;
    if (s.mode !== 'icon' && s.mode !== 'flag') s.mode = 'flag';
    if (!(s.core >= 0 && s.core < CORES.length)) s.core = 0;
    for (const k of ['backColor', 'field', 'accent'] as const) if (!HEX.test(s[k])) s[k] = DEFAULT[k];
    if (s.ink !== 'auto' && !HEX.test(s.ink)) s.ink = 'auto';
    return s;
  } catch {
    return DEFAULT;
  }
}

function writeQuery(s: EmblemSpec) {
  setQuery('flags', 'e=' + btoa(JSON.stringify(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="field">
      <span class="field__label">{label}</span>
      <div class="segmented">{children}</div>
    </div>
  );
}

function Opt<T>({ value, current, onPick, children }: { value: T; current: T; onPick: (v: T) => void; children: ComponentChildren }) {
  return (
    <button type="button" role="radio" aria-checked={value === current} onClick={() => onPick(value)}>
      {children}
    </button>
  );
}

/** Palette of the banner colours plus a free colour picker. */
function ColorRow({ label, value, onPick }: { label: string; value: string; onPick: (c: string) => void }) {
  return (
    <Row label={label}>
      {COLORS.map((c) => (
        <button key={c.id} type="button" class="color-chip" role="radio" aria-checked={value.toLowerCase() === c.color} title={c.name} onClick={() => onPick(c.color)}>
          <i style={{ background: c.color }} />
        </button>
      ))}
      <input type="color" aria-label={`${label}: any colour`} value={value} onInput={(e) => onPick(e.currentTarget.value)} />
    </Row>
  );
}

function Maker() {
  const [spec, setSpec] = useState<EmblemSpec>(readQuery);
  const [png, setPng] = useState(512);
  const [status, setStatus] = useState('');
  const set = (patch: Partial<EmblemSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const built = useMemo(() => buildEmblem(spec), [spec]);

  useEffect(() => writeQuery(spec), [spec]);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const name = `${CORES[spec.core].id.toLowerCase()}-${spec.mode}`;
  const icon = spec.mode === 'icon';
  const sizes = icon ? [16, 32, 64, 128, 256, 512, 1024] : [300, 600, 1200, 2400];

  return (
    <div class="flags">
      <header class="tool-head">
        <h1>Flag &amp; Icon Maker</h1>
        <p>Put a realm's core on an icon or a flag, in any colours, and export it as an SVG or PNG.</p>
      </header>

      <div class="flags__layout">
        <section class="flags__preview panel" aria-label="Preview">
          <div class="segmented flags__mode" role="radiogroup" aria-label="Picture">
            <Opt value="flag" current={spec.mode} onPick={(mode: EmblemSpec['mode']) => set({ mode })}>
              Flag
            </Opt>
            <Opt value="icon" current={spec.mode} onPick={(mode: EmblemSpec['mode']) => set({ mode })}>
              Icon
            </Opt>
          </div>
          <div class={`flags__stage${icon ? ' flags__stage--icon' : ''}`} role="img" aria-label={built.svg.match(/<title>(.*?)<\/title>/)?.[1]} dangerouslySetInnerHTML={{ __html: built.svg }} />
          <div class="export">
            <div class="export__row">
              <button type="button" class="btn btn--primary" onClick={() => downloadSvg(built, name)}>
                Download SVG
              </button>
              <button type="button" class="btn btn--primary" onClick={() => downloadPng(built, png, name)}>
                Download PNG
              </button>
              <label class="export__size">
                <span class="visually-hidden">PNG width</span>
                <select value={sizes.includes(png) ? png : sizes[icon ? 5 : 2]} onChange={(e) => setPng(Number(e.currentTarget.value))}>
                  {sizes.map((n) => (
                    <option key={n} value={n}>
                      {n} px{icon ? '' : ' wide'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div class="export__row">
              <button type="button" class="btn" onClick={async () => setStatus((await copyPng(built, png)) ? 'Image copied' : "Your browser can't copy images")}>
                Copy image
              </button>
              <button
                type="button"
                class="btn"
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
          </div>
        </section>

        <section class="flags__controls" aria-label="Design">
          <div class="panel">
            <h2>Core</h2>
            <div class="picker__grid">
              {CORES.map((c, i) => (
                <button key={c.id} type="button" class="tile" aria-pressed={spec.core === i} title={c.shape} onClick={() => set({ core: i })}>
                  <span class="tile__icon" dangerouslySetInnerHTML={{ __html: coreThumb(i) }} />
                  <span class="tile__label">{c.name}</span>
                </button>
              ))}
            </div>
            <Row label="Drawn">
              <Opt value="filled" current={spec.style} onPick={(style: EmblemSpec['style']) => set({ style })}>
                Filled
              </Opt>
              <Opt value="outline" current={spec.style} onPick={(style: EmblemSpec['style']) => set({ style })}>
                Outline
              </Opt>
            </Row>
            <Row label="Ink">
              <Opt value="auto" current={spec.ink} onPick={(ink: string) => set({ ink })}>
                Auto
              </Opt>
              <Opt value="#ffffff" current={spec.ink} onPick={(ink: string) => set({ ink })}>
                White
              </Opt>
              <Opt value="#1b1b1b" current={spec.ink} onPick={(ink: string) => set({ ink })}>
                Black
              </Opt>
              <Opt value="#d4af37" current={spec.ink} onPick={(ink: string) => set({ ink })}>
                Gold
              </Opt>
              <input type="color" aria-label="Ink: any colour" value={spec.ink === 'auto' ? '#ffffff' : spec.ink} onInput={(e) => set({ ink: e.currentTarget.value })} />
            </Row>
          </div>

          {icon ? (
            <div class="panel">
              <h2>Icon</h2>
              <Row label="Background">
                {BACKS.map(([v, t]) => (
                  <Opt key={v} value={v} current={spec.back} onPick={(back: IconBack) => set({ back })}>
                    {t}
                  </Opt>
                ))}
              </Row>
              {spec.back !== 'none' && <ColorRow label="Background colour" value={spec.backColor} onPick={(backColor) => set({ backColor })} />}
              <label class="field">
                <span class="field__label">
                  Core size <output>{Math.round(spec.scale * 100)}%</output>
                </span>
                <input type="range" min="0.3" max="1" step="0.02" value={spec.scale} onInput={(e) => set({ scale: Number(e.currentTarget.value) })} />
              </label>
            </div>
          ) : (
            <div class="panel">
              <h2>Flag</h2>
              <Row label="Shape">
                {SHAPES.map(([v, t]) => (
                  <Opt key={v} value={v} current={spec.shape} onPick={(shape: FlagShape) => set({ shape })}>
                    {t}
                  </Opt>
                ))}
              </Row>
              {spec.shape !== 'banner' && (
                <Row label="Proportions">
                  {RATIOS.map((r) => (
                    <Opt key={r} value={r} current={spec.ratio} onPick={(ratio: FlagRatio) => set({ ratio })}>
                      {r}
                    </Opt>
                  ))}
                </Row>
              )}
              <Row label="Pattern">
                {PATTERNS.map(([v, t]) => (
                  <Opt key={v} value={v} current={spec.pattern} onPick={(pattern: FlagPattern) => set({ pattern })}>
                    {t}
                  </Opt>
                ))}
              </Row>
              <ColorRow label="Field" value={spec.field} onPick={(field) => set({ field })} />
              {spec.pattern !== 'plain' && <ColorRow label="Second colour" value={spec.accent} onPick={(accent) => set({ accent })} />}
              <Row label="Core position">
                <Opt value="center" current={spec.emblemPos} onPick={(emblemPos: EmblemSpec['emblemPos']) => set({ emblemPos })}>
                  Centre
                </Opt>
                <Opt value="hoist" current={spec.emblemPos} onPick={(emblemPos: EmblemSpec['emblemPos']) => set({ emblemPos })}>
                  Near the pole
                </Opt>
              </Row>
              <label class="field">
                <span class="field__label">
                  Core size <output>{Math.round(spec.emblemSize * 100)}%</output>
                </span>
                <input type="range" min="0.12" max="0.8" step="0.02" value={spec.emblemSize} onInput={(e) => set({ emblemSize: Number(e.currentTarget.value) })} />
              </label>
              <label class="check">
                <input type="checkbox" checked={spec.edge} onChange={(e) => set({ edge: e.currentTarget.checked })} /> Dark outline
              </label>
            </div>
          )}

          <div class="panel">
            <h2>Realm flags</h2>
            <Spoiler id="flags-realms" tier="late" label="Each realm's flag in its national colour. The colours are part of the sigil solutions.">
              <div class="picker__grid">
                {REALM_FLAGS.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    class="tile"
                    onClick={() => set({ mode: 'flag', core: r.core, field: COLORS[r.color].color, pattern: 'plain', shape: 'rect', ratio: '3:2', emblemPos: 'center', emblemSize: 0.36, ink: 'auto' })}
                  >
                    <span class="tile__icon realm-swatch" style={{ background: COLORS[r.color].color }} dangerouslySetInnerHTML={{ __html: coreThumb(r.core) }} />
                    <span class="tile__label">{CORES[r.core].name}</span>
                  </button>
                ))}
              </div>
            </Spoiler>
          </div>
        </section>
      </div>
    </div>
  );
}

export function FlagMaker() {
  return (
    <ToolGate
      id="tool-flags"
      tier="late"
      title="Flag & Icon Maker"
      warning="This tool uses the realm emblems from late in the game and names each realm. The realms' own flag colours stay hidden behind a second button."
    >
      <Maker />
    </ToolGate>
  );
}
