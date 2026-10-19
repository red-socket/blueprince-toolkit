import { useEffect, useRef, useState } from 'preact/hooks';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow/800.css';
import {
  CATEGORIES,
  drawCard,
  FRAME,
  ICONS,
  iconsUsed,
  iconUrl,
  loadIcon,
  PATTERNS,
  type CardSpec,
  type Category,
  type IconName,
  type Pattern,
  type Photo,
  type Shape,
} from './render';
import { query, setQuery } from '../../lib/route';
import './cards.css';

const SHAPES: [Shape, string][] = [
  ['dead', 'Dead end'],
  ['straight', 'Straight'],
  ['L', 'Corner'],
  ['T', 'Three-way'],
  ['cross', 'Four-way'],
];
const PATTERN_NAME: Record<Pattern, string> = { wood: 'Wood', tiles: 'Tiles', carpet: 'Carpet', stone: 'Stone', grass: 'Grass', marble: 'Marble', plain: 'Plain' };
const FLOOR_DEFAULT: Record<Pattern, string> = {
  wood: '#5a3d26',
  tiles: '#7d7a72',
  carpet: '#6b2430',
  stone: '#5f6166',
  grass: '#3f6b2e',
  marble: '#9a958c',
  plain: '#2a2d33',
};

const DEFAULT: CardSpec = {
  name: 'Map Room',
  category: 'Blueprint',
  shape: 'T',
  rot: 0,
  pattern: 'wood',
  floor: FLOOR_DEFAULT.wood,
  darken: 0.25,
  icon: 'drafting',
  text: 'Whenever you enter *MAP ROOM*, gain 2{steps}.',
  cost: 1,
};

// ---- URL state (everything but an uploaded picture) ----

function readHash(): CardSpec {
  const raw = query().get('c');
  if (!raw) return DEFAULT;
  try {
    const v = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
    const spec = { ...DEFAULT, ...v } as CardSpec;
    if (!CATEGORIES.includes(spec.category)) spec.category = DEFAULT.category;
    if (!SHAPES.some(([s]) => s === spec.shape)) spec.shape = DEFAULT.shape;
    if (!PATTERNS.includes(spec.pattern)) spec.pattern = DEFAULT.pattern;
    if (spec.icon && !ICONS.includes(spec.icon)) spec.icon = null;
    spec.rot = ((Number(spec.rot) % 4) + 4) % 4 || 0;
    spec.cost = Math.max(0, Math.min(5, Number(spec.cost) || 0));
    spec.darken = Math.max(0, Math.min(0.8, Number(spec.darken) || 0));
    return spec;
  } catch {
    return DEFAULT;
  }
}

function writeHash(spec: CardSpec) {
  const json = JSON.stringify(spec);
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  setQuery('cards', `c=${b64}`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card';
}

function CardTool() {
  const [spec, setSpec] = useState<CardSpec>(readHash);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [size, setSize] = useState(1024);
  const [status, setStatus] = useState('');
  const [fontsReady, setFontsReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<CardSpec>) => setSpec((s) => ({ ...s, ...patch }));

  useEffect(() => {
    Promise.all([document.fonts.load('800 60px Barlow'), document.fonts.load('700 30px Barlow')]).then(() => setFontsReady(true));
  }, []);
  useEffect(() => writeHash(spec), [spec]);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);

  // Redraw whenever anything changes, once the icons it uses are loaded.
  useEffect(() => {
    let live = true;
    const names = iconsUsed(spec);
    Promise.all(names.map((n) => loadIcon(n).then((img) => [n, img] as const))).then((pairs) => {
      if (!live || !canvas.current) return;
      drawCard(canvas.current, spec, photo, new Map(pairs));
    });
    return () => {
      live = false;
    };
  }, [spec, photo, fontsReady]);

  const render = async (px: number): Promise<Blob> => {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const names = iconsUsed(spec);
    const pairs = await Promise.all(names.map((n) => loadIcon(n).then((img) => [n, img] as const)));
    drawCard(c, spec, photo, new Map(pairs));
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
  };

  const download = async () => {
    const url = URL.createObjectURL(await render(size));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(spec.name)}-${size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const insert = (token: string) => {
    const el = textArea.current;
    if (!el) return set({ text: spec.text + token });
    const a = el.selectionStart ?? spec.text.length;
    const b = el.selectionEnd ?? a;
    const text = spec.text.slice(0, a) + token + spec.text.slice(b);
    set({ text });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + token.length;
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setPhoto({ img, zoom: 1, x: 0, y: 0 });
    img.src = url;
  };

  return (
    <div class="cards">
      <header class="tool-head">
        <h1>Room Card Maker</h1>
        <p>Design your own floor plan in the style of the estate's room cards, then save it as a picture.</p>
      </header>

      <div class="cards__layout">
        <section class="cards__preview panel" aria-label="Preview">
          <canvas ref={canvas} width={1024} height={1024} class="card-canvas" role="img" aria-label={`Room card: ${spec.name}`} />
          <div class="export">
            <div class="export__row">
              <button type="button" class="btn btn--primary" onClick={download}>
                Download PNG
              </button>
              <label class="export__size">
                <span class="visually-hidden">PNG size</span>
                <select value={size} onChange={(e) => setSize(Number(e.currentTarget.value))}>
                  {[256, 512, 1024, 2048].map((n) => (
                    <option key={n} value={n}>
                      {n} px
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                class="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': render(size) })]);
                    setStatus('Image copied');
                  } catch {
                    setStatus("Your browser can't copy images");
                  }
                }}
              >
                Copy image
              </button>
              <button
                type="button"
                class="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(location.href);
                    setStatus(photo ? 'Link copied (without your picture)' : 'Link copied');
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

        <section class="cards__controls" aria-label="Card">
          <div class="panel">
            <h2>Room</h2>
            <label class="field">
              <span class="field__label">Name</span>
              <input class="input" type="text" value={spec.name} maxLength={40} onInput={(e) => set({ name: e.currentTarget.value })} />
            </label>
            <div class="field">
              <span class="field__label">Colour</span>
              <div class="segmented">
                {CATEGORIES.map((c: Category) => (
                  <button key={c} type="button" role="radio" aria-checked={spec.category === c} onClick={() => set({ category: c })}>
                    <i class="swatch-dot" style={{ background: FRAME[c] }} /> {c}
                  </button>
                ))}
              </div>
            </div>
            <div class="field">
              <span class="field__label">Doors</span>
              <div class="segmented">
                {SHAPES.map(([s, label]) => (
                  <button key={s} type="button" role="radio" aria-checked={spec.shape === s} onClick={() => set({ shape: s })}>
                    {label}
                  </button>
                ))}
                {spec.shape !== 'cross' && (
                  <button type="button" onClick={() => set({ rot: (spec.rot + 1) % 4 })} title="Turn the doors">
                    Turn ⟳
                  </button>
                )}
              </div>
            </div>
            <div class="field">
              <span class="field__label">Gem cost</span>
              <div class="segmented">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={spec.cost === n} onClick={() => set({ cost: n })}>
                    {n === 0 ? 'None' : n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div class="panel">
            <h2>Text</h2>
            <div class="field">
              <span class="field__label">Icon</span>
              <div class="icon-grid">
                <button type="button" class="icon-btn" aria-pressed={spec.icon === null} onClick={() => set({ icon: null })} title="No icon">
                  <span class="icon-btn__none">None</span>
                </button>
                {ICONS.map((n: IconName) => (
                  <button key={n} type="button" class="icon-btn" aria-pressed={spec.icon === n} onClick={() => set({ icon: n })} title={n}>
                    <img src={iconUrl(n)} alt={n} loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
            <label class="field">
              <span class="field__label">Effect</span>
              <textarea ref={textArea} class="input" rows={3} maxLength={200} value={spec.text} onInput={(e) => set({ text: e.currentTarget.value })} />
            </label>
            <p class="field__note">
              Put a word in <code>*stars*</code> to colour it. Add an icon to the text:
            </p>
            <div class="icon-grid icon-grid--small">
              {(['steps', 'key', 'gem', 'coins', 'die', 'sparkle'] as IconName[]).map((n) => (
                <button key={n} type="button" class="icon-btn" onClick={() => insert(`{${n === 'coins' ? 'coin' : n === 'sparkle' ? 'star' : n}}`)} title={`Insert ${n}`}>
                  <img src={iconUrl(n)} alt={n} />
                </button>
              ))}
            </div>
          </div>

          <div class="panel">
            <h2>Floor</h2>
            <div class="field">
              <span class="field__label">Pattern</span>
              <div class="segmented">
                {PATTERNS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={!photo && spec.pattern === p}
                    onClick={() => {
                      setPhoto(null);
                      set({ pattern: p, floor: FLOOR_DEFAULT[p] });
                    }}
                  >
                    {PATTERN_NAME[p]}
                  </button>
                ))}
                {!photo && <input type="color" aria-label="Floor colour" value={spec.floor} onInput={(e) => set({ floor: e.currentTarget.value })} />}
              </div>
            </div>
            <div class="field">
              <span class="field__label">Or your own picture</span>
              <input class="file" type="file" accept="image/*" onChange={(e) => onFile(e.currentTarget.files?.[0])} />
              <p class="field__note">The picture stays on your device; links don't include it.</p>
            </div>
            {photo && (
              <>
                <label class="field">
                  <span class="field__label">Zoom</span>
                  <input type="range" min="1" max="3" step="0.05" value={photo.zoom} onInput={(e) => setPhoto({ ...photo, zoom: Number(e.currentTarget.value) })} />
                </label>
                <label class="field">
                  <span class="field__label">Left / right</span>
                  <input type="range" min="-1" max="1" step="0.02" value={photo.x} onInput={(e) => setPhoto({ ...photo, x: Number(e.currentTarget.value) })} />
                </label>
                <label class="field">
                  <span class="field__label">Up / down</span>
                  <input type="range" min="-1" max="1" step="0.02" value={photo.y} onInput={(e) => setPhoto({ ...photo, y: Number(e.currentTarget.value) })} />
                </label>
                <button type="button" class="btn btn--small" onClick={() => setPhoto(null)}>
                  Remove picture
                </button>
              </>
            )}
            <label class="field">
              <span class="field__label">
                Darken <output>{Math.round(spec.darken * 100)}%</output>
              </span>
              <input type="range" min="0" max="0.8" step="0.05" value={spec.darken} onInput={(e) => set({ darken: Number(e.currentTarget.value) })} />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export function CardMaker() {
  return <CardTool />;
}
