import { useEffect, useMemo, useState } from 'preact/hooks';
import { ToolGate } from '../../components/Spoiler';
import { BORDERS, CORES, SOCIETIES, TRAVELS, WEATHERS } from './data';
import { copyPng, downloadPng, downloadSvg } from '../../lib/export';
import {
  borderIcon,
  buildSvg,
  coreIcon,
  describe,
  societyIcon,
  travelIcon,
  weatherIcon,
  type SigilSpec,
  type SigilStyle,
} from './render';
import './sigil.css';

const PAPER = '#efe7d4';
const BLUEPRINT = '#1d4277';

type InkChoice = 'auto' | 'black' | 'white' | 'banner' | 'custom';
type BgChoice = 'none' | 'paper' | 'blueprint' | 'banner' | 'custom';

const DEFAULT_SPEC: SigilSpec = { core: 0, travel: 6, weather: 0, society: 0, border: 0 };

// ---- URL state: #/sigil?c=0&t=6&w=0&m=0&b=0 (indices only, so links don't name any part) ----

function readHash(): SigilSpec {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const idx = (key: string, list: unknown[], fallback: number | null): number | null => {
    if (!q.has(key)) return fallback;
    const v = q.get(key);
    if (v === '-') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n < list.length ? n : fallback;
  };
  return {
    core: idx('c', CORES, DEFAULT_SPEC.core),
    travel: idx('t', TRAVELS, DEFAULT_SPEC.travel),
    weather: idx('w', WEATHERS, DEFAULT_SPEC.weather) ?? 0,
    society: idx('m', SOCIETIES, DEFAULT_SPEC.society),
    border: idx('b', BORDERS, DEFAULT_SPEC.border),
  };
}

function writeHash(spec: SigilSpec) {
  const v = (n: number | null) => (n === null ? '-' : String(n));
  history.replaceState(null, '', `#/sigil?c=${v(spec.core)}&t=${v(spec.travel)}&w=${spec.weather}&m=${v(spec.society)}&b=${v(spec.border)}`);
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
}

function Picker({ title, hint, count, value, onChange, label, sub, icon, allowNone = true }: PickerProps) {
  return (
    <fieldset class="picker">
      <legend>
        {title}
        {hint && <span class="picker__hint">{hint}</span>}
      </legend>
      <div class="picker__grid">
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

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  children?: preact.ComponentChildren;
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
        {children}
      </div>
    </div>
  );
}

// ---- the tool ----

function Maker() {
  const [spec, setSpec] = useState<SigilSpec>(readHash);
  const [inkChoice, setInkChoice] = useState<InkChoice>('auto');
  const [customInk, setCustomInk] = useState('#3a2f5c');
  const [bgChoice, setBgChoice] = useState<BgChoice>('none');
  const [customBg, setCustomBg] = useState('#f4ead5');
  const [bandFill, setBandFill] = useState(true);
  const [weight, setWeight] = useState(1);
  const [pngSize, setPngSize] = useState(1024);
  const [status, setStatus] = useState('');

  useEffect(() => writeHash(spec), [spec]);
  // A sigil link pasted while the tool is open (replaceState above doesn't fire hashchange).
  useEffect(() => {
    const on = () => location.hash.startsWith('#/sigil') && setSpec(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const banner = spec.border !== null ? BORDERS[spec.border].color : '#d4af37';
  const ink = { auto: 'auto', black: '#1b1b1b', white: '#ffffff', banner, custom: customInk }[inkChoice];
  const background = { none: null, paper: PAPER, blueprint: BLUEPRINT, banner, custom: customBg }[bgChoice];
  const style: SigilStyle = { ink, background, bandFill, weight };
  const built = useMemo(() => buildSvg(spec, style), [spec, ink, background, bandFill, weight]);

  // Behind a transparent picture, the preview uses a dark checkerboard for light ink.
  const stageDark = background === null && (inkChoice === 'white' || (inkChoice === 'custom' && isLight(customInk)));

  const set = (patch: Partial<SigilSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const filename = () =>
    [
      'sigil',
      spec.core !== null ? CORES[spec.core].id : null,
      spec.travel !== null ? TRAVELS[spec.travel].id : null,
      spec.travel !== null ? WEATHERS[spec.weather].id : null,
      spec.society !== null ? SOCIETIES[spec.society].name : null,
      spec.border !== null ? BORDERS[spec.border].id : null,
    ]
      .filter(Boolean)
      .join('-')
      .toLowerCase();

  return (
    <div class="sigil">
      <header class="tool-head">
        <h1>Sigil Maker</h1>
        <p>Pick a core, rays, motes and a border, then export the sigil. The link keeps your choices, so copying the address shares the sigil.</p>
      </header>

      <div class="sigil__layout">
        <section class="sigil__preview panel" aria-label="Preview">
          <div
            class={`stage${background === null ? ' stage--transparent' : ''}${stageDark ? ' stage--dark' : ''}`}
            role="img"
            aria-label={describe(spec)}
            dangerouslySetInnerHTML={{ __html: built.svg }}
          />
          <dl class="reading">
            <div>
              <dt>Realm</dt>
              <dd>{spec.core !== null ? CORES[spec.core].name : 'None'}</dd>
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
              <dt>Colour</dt>
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
                <span class="visually-hidden">PNG size</span>
                <select value={pngSize} onChange={(e) => setPngSize(Number(e.currentTarget.value))}>
                  {[128, 256, 512, 1024, 2048, 4096].map((n) => (
                    <option key={n} value={n}>
                      {n} px
                    </option>
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
                <button
                  type="button"
                  class="btn btn--small"
                  onClick={() =>
                    setSpec({
                      core: rand(CORES.length),
                      travel: rand(TRAVELS.length),
                      weather: rand(WEATHERS.length),
                      society: rand(SOCIETIES.length),
                      border: rand(BORDERS.length),
                    })
                  }
                >
                  Random
                </button>
                <button type="button" class="btn btn--small" onClick={() => setSpec({ core: null, travel: null, weather: 0, society: null, border: null })}>
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
              label={(i) => CORES[i].name}
              sub={(i) => CORES[i].shape}
              icon={(i) => coreIcon(i, 'currentColor')}
            />
            <Picker
              title="Rays"
              hint="transportation"
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
              icon={(i) => borderIcon(i, '#1b1b1b')}
            />
          </div>

          <div class="panel">
            <h2>Style</h2>
            <Choices<InkChoice>
              label="Ink"
              value={inkChoice}
              options={[
                ['auto', 'Auto'],
                ['black', 'Black'],
                ['white', 'White'],
                ['banner', 'Border colour'],
                ['custom', 'Custom'],
              ]}
              onChange={setInkChoice}
            >
              {inkChoice === 'custom' && (
                <input type="color" aria-label="Custom ink colour" value={customInk} onInput={(e) => setCustomInk(e.currentTarget.value)} />
              )}
            </Choices>
            <Choices<BgChoice>
              label="Background"
              value={bgChoice}
              options={[
                ['none', 'Transparent'],
                ['paper', 'Paper'],
                ['blueprint', 'Blueprint'],
                ['banner', 'Border colour'],
                ['custom', 'Custom'],
              ]}
              onChange={setBgChoice}
            >
              {bgChoice === 'custom' && (
                <input type="color" aria-label="Custom background colour" value={customBg} onInput={(e) => setCustomBg(e.currentTarget.value)} />
              )}
            </Choices>
            <label class="check">
              <input type="checkbox" checked={bandFill} onChange={(e) => setBandFill(e.currentTarget.checked)} />
              Fill the border with its colour
            </label>
            <label class="field">
              <span class="field__label">
                Line weight <output>{weight.toFixed(1)}×</output>
              </span>
              <input type="range" min="0.5" max="2" step="0.1" value={weight} onInput={(e) => setWeight(Number(e.currentTarget.value))} />
            </label>
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
      warning="This tool is about the realm sigils, which come up late in the game. It names every part of a sigil and what each part means."
    >
      <Maker />
    </ToolGate>
  );
}
