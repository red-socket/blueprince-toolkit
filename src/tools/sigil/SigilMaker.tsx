import { useEffect, useMemo, useState } from 'preact/hooks';
import { Spoiler, ToolGate } from '../../components/Spoiler';
import { useReveal } from '../../spoilers';
import { BORDERS, CORES, REALMS, SOCIETIES, TRAVELS, WEATHERS } from './data';
import { copyPng, downloadPng, downloadSvg } from './export';
import {
  borderIcon,
  buildSvg,
  coreIcon,
  describe,
  societyIcon,
  travelIcon,
  weatherIcon,
  type Layout,
  type SigilSpec,
  type SigilStyle,
} from './render';
import './sigil.css';

const PAPER = '#efe7d4';
const BLUEPRINT = '#1d4277';
const INK_BLACK = '#1b1b1b';
const INK_WHITE = '#ffffff';

type InkChoice = 'auto' | 'black' | 'white' | 'banner' | 'custom';
type BgChoice = 'none' | 'paper' | 'blueprint' | 'banner' | 'custom';

const DEFAULT_SPEC: SigilSpec = { core: 0, travel: 6, weather: 0, society: 0, border: 0 };

// ---- URL state: #/sigil?c=0&t=6&w=0&m=0&b=0&l=sigil (indices only, so no spoiler words in links) ----

function readHash(): { spec: SigilSpec; layout: Layout } {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const idx = (key: string, list: unknown[], fallback: number | null): number | null => {
    if (!q.has(key)) return fallback;
    const v = q.get(key);
    if (v === '-') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n < list.length ? n : fallback;
  };
  const l = q.get('l');
  return {
    spec: {
      core: idx('c', CORES, DEFAULT_SPEC.core),
      travel: idx('t', TRAVELS, DEFAULT_SPEC.travel),
      weather: idx('w', WEATHERS, DEFAULT_SPEC.weather) ?? 0,
      society: idx('m', SOCIETIES, DEFAULT_SPEC.society),
      border: idx('b', BORDERS, DEFAULT_SPEC.border),
    },
    layout: l === 'core' || l === 'flag' ? l : 'sigil',
  };
}

function writeHash(spec: SigilSpec, layout: Layout) {
  const v = (n: number | null) => (n === null ? '-' : String(n));
  const q = `c=${v(spec.core)}&t=${v(spec.travel)}&w=${spec.weather}&m=${v(spec.society)}&b=${v(spec.border)}&l=${layout}`;
  history.replaceState(null, '', `#/sigil?${q}`);
}

function sameSpec(a: SigilSpec, b: SigilSpec) {
  return a.core === b.core && a.travel === b.travel && a.weather === b.weather && a.society === b.society && a.border === b.border;
}

const rand = (n: number) => Math.floor(Math.random() * n);

// ---- pickers ----

interface PickerProps {
  title: string;
  hint?: string;
  count: number;
  value: number | null;
  onChange: (v: number | null) => void;
  label: (i: number) => string;
  sub?: (i: number) => string | undefined;
  icon: (i: number) => string;
  allowNone?: boolean;
  wide?: boolean;
}

function Picker({ title, hint, count, value, onChange, label, sub, icon, allowNone = true, wide }: PickerProps) {
  return (
    <fieldset class="picker">
      <legend>
        {title}
        {hint && <span class="picker__hint"> {hint}</span>}
      </legend>
      <div class={`picker__grid${wide ? ' picker__grid--wide' : ''}`}>
        {allowNone && (
          <button type="button" class="tile tile--none" aria-pressed={value === null} onClick={() => onChange(null)}>
            <span class="tile__icon" aria-hidden="true">
              <svg viewBox="-30 -30 60 60">
                <line x1="-14" y1="14" x2="14" y2="-14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              </svg>
            </span>
            <span class="tile__label">None</span>
          </button>
        )}
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" class="tile" aria-pressed={value === i} onClick={() => onChange(i)} title={sub?.(i)}>
            <span class="tile__icon" dangerouslySetInnerHTML={{ __html: icon(i) }} />
            <span class="tile__label">{label(i)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div class="field">
      <span class="field__label">{label}</span>
      <div class="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- the tool ----

function Maker() {
  const initial = useMemo(readHash, []);
  const [spec, setSpec] = useState<SigilSpec>(initial.spec);
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [inkChoice, setInkChoice] = useState<InkChoice>('auto');
  const [customInk, setCustomInk] = useState('#3a2f5c');
  const [bgChoice, setBgChoice] = useState<BgChoice>('none');
  const [customBg, setCustomBg] = useState('#f4ead5');
  const [bandFill, setBandFill] = useState(true);
  const [weight, setWeight] = useState(1);
  const [flagEmblem, setFlagEmblem] = useState<'core' | 'sigil'>('core');
  const [pngSize, setPngSize] = useState(1024);
  const [status, setStatus] = useState('');
  const [realmsShown] = useReveal('sigil-realms');

  useEffect(() => writeHash(spec, layout), [spec, layout]);
  // A sigil link pasted while the tool is open (replaceState above doesn't fire hashchange).
  useEffect(() => {
    const on = () => {
      if (!location.hash.startsWith('#/sigil')) return;
      const h = readHash();
      setSpec(h.spec);
      setLayout(h.layout);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const banner = spec.border !== null ? BORDERS[spec.border].color : '#d4af37';
  const ink = { auto: 'auto', black: INK_BLACK, white: INK_WHITE, banner, custom: customInk }[inkChoice];
  const background = { none: null, paper: PAPER, blueprint: BLUEPRINT, banner, custom: customBg }[bgChoice];
  const style: SigilStyle = { layout, ink, background, bandFill, weight, flagEmblem };
  const built = useMemo(() => buildSvg(spec, style), [spec, layout, ink, background, bandFill, weight, flagEmblem]);

  // What the preview stage shows behind a transparent picture: a dark stage for light ink.
  const stageDark = background === null && (inkChoice === 'white' || (inkChoice === 'custom' && isLight(customInk)));

  const set = (patch: Partial<SigilSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const filename = () => {
    const parts = [
      'sigil',
      spec.core !== null ? CORES[spec.core].shape : null,
      spec.travel !== null ? TRAVELS[spec.travel].id : null,
      spec.travel !== null ? WEATHERS[spec.weather].id : null,
      spec.society !== null ? SOCIETIES[spec.society].name : null,
      spec.border !== null ? BORDERS[spec.border].id : null,
      layout !== 'sigil' ? layout : null,
    ];
    return parts.filter(Boolean).join('-').toLowerCase();
  };
  const matchedRealm = REALMS.findIndex((r) =>
    sameSpec({ core: r.core, travel: r.travel, weather: r.weather, society: r.society, border: r.border }, spec),
  );

  const randomize = () =>
    setSpec({
      core: rand(CORES.length),
      travel: rand(TRAVELS.length),
      weather: rand(WEATHERS.length),
      society: rand(SOCIETIES.length),
      border: rand(BORDERS.length),
    });

  return (
    <div class="sigil">
      <header class="tool-head">
        <h1>Sigil Maker</h1>
        <p>
          Pick a core, rays, motes and a border, then export the result. Your choices are kept in the link, so you can
          share a sigil by copying the address.
        </p>
      </header>

      <div class="sigil__layout">
        <section class="sigil__preview panel" aria-label="Preview">
          <div
            class={`stage stage--${layout}${background === null ? ' stage--transparent' : ''}${stageDark ? ' stage--dark' : ''}`}
            role="img"
            aria-label={describe(spec)}
            dangerouslySetInnerHTML={{ __html: built.svg }}
          />
          <dl class="reading">
            <div>
              <dt>Core</dt>
              <dd>
                {spec.core !== null ? CORES[spec.core].shape : 'None'}
                {matchedRealm >= 0 && realmsShown && <em> · the sigil of {CORES[REALMS[matchedRealm].core].name}</em>}
              </dd>
            </div>
            <div>
              <dt>Transportation</dt>
              <dd>{spec.travel !== null ? `${TRAVELS[spec.travel].name}: ${TRAVELS[spec.travel].hint.toLowerCase()}` : 'None'}</dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>{spec.travel !== null ? `${WEATHERS[spec.weather].name}: ${WEATHERS[spec.weather].hint.toLowerCase()}` : '(no rays)'}</dd>
            </div>
            <div>
              <dt>Society</dt>
              <dd>{spec.society !== null ? SOCIETIES[spec.society].name : 'None'}</dd>
            </div>
            <div>
              <dt>Border</dt>
              <dd>{spec.border !== null ? BORDERS[spec.border].name : 'None'}</dd>
            </div>
          </dl>

          <div class="export">
            <div class="export__row">
              <button type="button" class="btn btn--primary" onClick={() => downloadSvg(built, filename())}>
                Download SVG
              </button>
              <button type="button" class="btn btn--primary" onClick={() => downloadPng(built, pngSize, filename())}>
                Download PNG
              </button>
              <label class="export__size">
                <span class="visually-hidden">PNG width</span>
                <select value={pngSize} onChange={(e) => setPngSize(Number(e.currentTarget.value))}>
                  {[128, 256, 512, 1024, 2048, 4096].map((n) => (
                    <option key={n} value={n}>{n} px</option>
                  ))}
                </select>
              </label>
            </div>
            <div class="export__row">
              <button
                type="button"
                class="btn"
                onClick={async () => setStatus((await copyPng(built, pngSize)) ? 'Image copied' : "Your browser can't copy images")}
              >
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

        <section class="sigil__controls" aria-label="Sigil parts">
          <div class="panel">
            <div class="panel__head">
              <h2>Parts</h2>
              <div class="panel__actions">
                <button type="button" class="btn btn--small" onClick={randomize}>
                  Random
                </button>
                <button
                  type="button"
                  class="btn btn--small"
                  onClick={() => setSpec({ core: null, travel: null, weather: 0, society: null, border: null })}
                >
                  Clear
                </button>
              </div>
            </div>
            <Picker
              title="Core"
              hint="the realm"
              count={CORES.length}
              value={spec.core}
              onChange={(core) => set({ core })}
              label={(i) => CORES[i].shape}
              icon={(i) => coreIcon(i, 'currentColor')}
            />
            <Picker
              title="Rays"
              hint="number of rays: transportation"
              count={TRAVELS.length}
              value={spec.travel}
              onChange={(travel) => set({ travel })}
              label={(i) => TRAVELS[i].name}
              sub={(i) => TRAVELS[i].hint}
              icon={(i) => travelIcon(i, 'currentColor')}
            />
            <Picker
              title="Ray style"
              hint="weather"
              count={WEATHERS.length}
              value={spec.weather}
              onChange={(w) => set({ weather: w ?? 0 })}
              label={(i) => WEATHERS[i].name}
              sub={(i) => WEATHERS[i].hint}
              icon={(i) => weatherIcon(i, 'currentColor')}
              allowNone={false}
            />
            <Picker
              title="Motes"
              hint="society"
              count={SOCIETIES.length}
              value={spec.society}
              onChange={(society) => set({ society })}
              label={(i) => SOCIETIES[i].name}
              icon={(i) => societyIcon(i, 'currentColor')}
            />
            <Picker
              title="Border"
              hint="national colour"
              count={BORDERS.length}
              value={spec.border}
              onChange={(border) => set({ border })}
              label={(i) => BORDERS[i].name}
              icon={(i) => borderIcon(i, INK_BLACK)}
            />
          </div>

          <div class="panel">
            <h2>Style</h2>
            <Segmented<Layout>
              label="Picture"
              value={layout}
              options={[
                ['sigil', 'Full sigil'],
                ['core', 'Core icon'],
                ['flag', 'Flag'],
              ]}
              onChange={setLayout}
            />
            {layout === 'flag' && (
              <Segmented<'core' | 'sigil'>
                label="On the flag"
                value={flagEmblem}
                options={[
                  ['core', 'Core'],
                  ['sigil', 'Full sigil'],
                ]}
                onChange={setFlagEmblem}
              />
            )}
            <div class="field">
              <span class="field__label">Ink</span>
              <div class="segmented" role="radiogroup" aria-label="Ink">
                {(
                  [
                    ['auto', 'Auto'],
                    ['black', 'Black'],
                    ['white', 'White'],
                    ['banner', 'Banner colour'],
                    ['custom', 'Custom'],
                  ] as [InkChoice, string][]
                ).map(([v, t]) => (
                  <button key={v} type="button" role="radio" aria-checked={inkChoice === v} onClick={() => setInkChoice(v)}>
                    {t}
                  </button>
                ))}
                {inkChoice === 'custom' && (
                  <input type="color" aria-label="Custom ink colour" value={customInk} onInput={(e) => setCustomInk(e.currentTarget.value)} />
                )}
              </div>
              {layout === 'flag' && spec.border !== null && <p class="field__note">On a flag, any ink that wouldn't show on the banner switches to black or white.</p>}
            </div>
            {layout !== 'flag' || spec.border === null ? (
              <div class="field">
                <span class="field__label">Background</span>
                <div class="segmented" role="radiogroup" aria-label="Background">
                  {(
                    [
                      ['none', 'Transparent'],
                      ['paper', 'Paper'],
                      ['blueprint', 'Blueprint'],
                      ['banner', 'Banner colour'],
                      ['custom', 'Custom'],
                    ] as [BgChoice, string][]
                  ).map(([v, t]) => (
                    <button key={v} type="button" role="radio" aria-checked={bgChoice === v} onClick={() => setBgChoice(v)}>
                      {t}
                    </button>
                  ))}
                  {bgChoice === 'custom' && (
                    <input type="color" aria-label="Custom background colour" value={customBg} onInput={(e) => setCustomBg(e.currentTarget.value)} />
                  )}
                </div>
              </div>
            ) : (
              <p class="field__note">The flag uses the border's banner colour as its background.</p>
            )}
            {layout === 'sigil' && (
              <label class="check">
                <input type="checkbox" checked={bandFill} onChange={(e) => setBandFill(e.currentTarget.checked)} />
                Fill the border with its banner colour
              </label>
            )}
            {layout !== 'core' && (
              <label class="field">
                <span class="field__label">
                  Line weight <output>{weight.toFixed(1)}×</output>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={weight}
                  onInput={(e) => setWeight(Number(e.currentTarget.value))}
                />
              </label>
            )}
          </div>

          <div class="panel">
            <h2>Realm sigils</h2>
            <Spoiler id="sigil-realms" tier="late" label="The eight realms' complete sigils. These are the solutions to the sigil rooms.">
              <div class="realms">
                {REALMS.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    class="tile"
                    aria-pressed={matchedRealm === i}
                    onClick={() => setSpec({ core: r.core, travel: r.travel, weather: r.weather, society: r.society, border: r.border })}
                  >
                    <span class="tile__icon" dangerouslySetInnerHTML={{ __html: coreIcon(r.core, 'currentColor') }} />
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

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}

export function SigilMaker() {
  return (
    <ToolGate
      id="tool-sigil"
      tier="late"
      title="Sigil Maker"
      warning="This tool is about the realm sigils. They come up late in the game, and the tool names their parts and what each part means. The full sigil for each realm stays hidden behind a second button."
    >
      <Maker />
    </ToolGate>
  );
}
