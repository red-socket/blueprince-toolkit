import { useEffect, useRef, useState } from 'preact/hooks';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/homemade-apple/400.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import { query, setQuery } from '../../lib/route';
import { drawDoc, INK, loadAssets, PAPER, TEMPLATE_HEIGHT, type DocSpec, type Hand, type Ink, type Paper, type Template } from './render';
import './letters.css';

const TEMPLATES: [Template, string][] = [
  ['letter', 'Letter'],
  ['memo', 'Memo'],
  ['note', 'Note'],
  ['notice', 'Notice'],
];
const PAPERS: [Paper, string][] = [
  ['ivory', 'Ivory'],
  ['aged', 'Aged'],
  ['white', 'White'],
  ['grey', 'Grey'],
];
const INKS: [Ink, string][] = [
  ['black', 'Black'],
  ['blue', 'Blue'],
  ['red', 'Red'],
  ['green', 'Green'],
  ['sepia', 'Sepia'],
];
const HANDS: [Hand, string][] = [
  ['handwritten', 'Handwritten'],
  ['typed', 'Typewriter'],
  ['printed', 'Printed'],
];

// Made-up examples, nothing from the game.
const EXAMPLES: Record<Template, Partial<DocSpec>> = {
  letter: {
    letterhead: 'Mount Holly',
    date: 'November 7th',
    body: 'Dear friend,\nThe house is quieter than I remember. Every morning the rooms seem to have rearranged themselves, and every evening I fall asleep certain I have missed something obvious.\nWrite soon, and tell me what you would look for first.',
    signature: 'Yours, H.',
    dropCap: true,
    hand: 'handwritten',
  },
  memo: {
    letterhead: 'Mount Holly',
    to: 'All staff',
    from: 'The housekeeper',
    date: 'November 9th',
    heading: 'Muddy boots',
    body: 'Boots are to be left at the door. The carpets in the east hall were cleaned on Monday and will not be cleaned again until spring.',
    signature: '',
    dropCap: false,
    hand: 'typed',
  },
  note: {
    heading: 'Remember',
    body: 'Lamp oil, two candles, and ask the cook about Sunday.\nThe clock in the hall runs five minutes slow.',
    signature: '— M.',
    hand: 'handwritten',
  },
  notice: {
    letterhead: 'Mount Holly',
    heading: 'Garden Party',
    body: 'Guests are invited to the west lawn on Saturday at four. Tea will be served, weather permitting.',
    signature: 'The family',
    hand: 'printed',
  },
};

const DEFAULT: DocSpec = {
  template: 'letter',
  paper: 'ivory',
  ink: 'black',
  hand: 'handwritten',
  letterhead: '',
  heading: '',
  to: '',
  from: '',
  date: '',
  body: '',
  signature: '',
  dropCap: false,
  frame: true,
  hatching: true,
  aged: false,
  stamp: '',
  stampInk: 'red',
  ...EXAMPLES.letter,
};

function readQuery(): DocSpec {
  const raw = query().get('d');
  if (!raw) return DEFAULT;
  try {
    const v = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
    const s = { ...DEFAULT, ...v } as DocSpec;
    if (!TEMPLATES.some(([t]) => t === s.template)) s.template = 'letter';
    if (!PAPERS.some(([p]) => p === s.paper)) s.paper = 'ivory';
    if (!INKS.some(([i]) => i === s.ink)) s.ink = 'black';
    if (!HANDS.some(([h]) => h === s.hand)) s.hand = 'handwritten';
    return s;
  } catch {
    return DEFAULT;
  }
}

function writeQuery(spec: DocSpec) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(spec)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  setQuery('letters', `d=${b64}`);
}

function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="field">
      <span class="field__label">{label}</span>
      <div class="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Text({ label, value, onInput, rows, max = 80 }: { label: string; value: string; onInput: (v: string) => void; rows?: number; max?: number }) {
  return (
    <label class="field">
      <span class="field__label">{label}</span>
      {rows ? (
        <textarea class="input" rows={rows} maxLength={max} value={value} onInput={(e) => onInput(e.currentTarget.value)} />
      ) : (
        <input class="input" type="text" maxLength={max} value={value} onInput={(e) => onInput(e.currentTarget.value)} />
      )}
    </label>
  );
}

function LetterTool() {
  const [spec, setSpec] = useState<DocSpec>(readQuery);
  const [width, setWidth] = useState(1500);
  const [status, setStatus] = useState('');
  const [fontsReady, setFontsReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const set = (patch: Partial<DocSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const H = TEMPLATE_HEIGHT[spec.template];

  useEffect(() => {
    const fonts = ['400 30px Kalam', '700 30px Kalam', '400 30px "Homemade Apple"', '400 30px "Special Elite"', '400 30px "IM Fell English"', 'italic 400 30px "IM Fell English"'];
    Promise.all(fonts.map((f) => document.fonts.load(f))).then(() => setFontsReady(true));
  }, []);
  useEffect(() => writeQuery(spec), [spec]);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(t);
  }, [status]);
  useEffect(() => {
    let live = true;
    loadAssets(spec).then((assets) => {
      const c = canvas.current;
      if (!live || !c) return;
      c.width = 1000;
      c.height = H;
      drawDoc(c, spec, assets);
    });
    return () => {
      live = false;
    };
  }, [spec, fontsReady]);

  const render = async (w: number): Promise<Blob> => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round((w * H) / 1000);
    drawDoc(c, spec, await loadAssets(spec));
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
  };

  const download = async () => {
    const url = URL.createObjectURL(await render(width));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.template}-${width}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const t = spec.template;
  return (
    <div class="letters">
      <header class="tool-head">
        <h1>Letter &amp; Note Maker</h1>
        <p>Write a letter, memo, note or notice on the estate's paper, then save it as a picture.</p>
      </header>

      <div class="letters__layout">
        <section class="letters__preview panel" aria-label="Preview">
          <canvas ref={canvas} width={1000} height={H} class="doc-canvas" style={{ aspectRatio: `1000 / ${H}` }} role="img" aria-label={`${t} preview`} />
          <div class="export">
            <div class="export__row">
              <button type="button" class="btn btn--primary" onClick={download}>
                Download PNG
              </button>
              <label class="export__size">
                <span class="visually-hidden">PNG width</span>
                <select value={width} onChange={(e) => setWidth(Number(e.currentTarget.value))}>
                  {[750, 1000, 1500, 2500].map((n) => (
                    <option key={n} value={n}>
                      {n} px wide
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                class="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': render(width) })]);
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

        <section class="letters__controls" aria-label="Document">
          <div class="panel">
            <div class="panel__head">
              <h2>Document</h2>
              <button type="button" class="btn btn--small" onClick={() => set(EXAMPLES[t])}>
                Example text
              </button>
            </div>
            <Choices label="Kind" value={t} options={TEMPLATES} onChange={(template) => set({ template })} />
            {t !== 'note' && <Text label="Letterhead" value={spec.letterhead} onInput={(letterhead) => set({ letterhead })} max={30} />}
            {t === 'memo' && (
              <>
                <Text label="To" value={spec.to} onInput={(to) => set({ to })} max={40} />
                <Text label="From" value={spec.from} onInput={(from) => set({ from })} max={40} />
              </>
            )}
            {(t === 'letter' || t === 'memo') && <Text label="Date" value={spec.date} onInput={(date) => set({ date })} max={40} />}
            {t !== 'letter' && <Text label={t === 'memo' ? 'Subject' : t === 'note' ? 'Heading' : 'Title'} value={spec.heading} onInput={(heading) => set({ heading })} max={40} />}
            <Text label="Text" value={spec.body} onInput={(body) => set({ body })} rows={6} max={900} />
            <Text label={t === 'notice' ? 'Signed' : 'Signature'} value={spec.signature} onInput={(signature) => set({ signature })} max={40} />
          </div>

          <div class="panel">
            <h2>Style</h2>
            <Choices label="Writing" value={spec.hand} options={HANDS} onChange={(hand) => set({ hand })} />
            <div class="field">
              <span class="field__label">Ink</span>
              <div class="segmented" role="radiogroup" aria-label="Ink">
                {INKS.map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={spec.ink === v} onClick={() => set({ ink: v })}>
                    <i class="swatch-dot" style={{ background: INK[v] }} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div class="field">
              <span class="field__label">Paper</span>
              <div class="segmented" role="radiogroup" aria-label="Paper">
                {PAPERS.map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={spec.paper === v} onClick={() => set({ paper: v })}>
                    <i class="swatch-dot" style={{ background: PAPER[v] }} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div class="checks">
              {(t === 'letter' || t === 'memo') && (
                <label class="check">
                  <input type="checkbox" checked={spec.frame} onChange={(e) => set({ frame: e.currentTarget.checked })} /> Drawn frame
                </label>
              )}
              {t !== 'note' && t !== 'notice' && (
                <label class="check">
                  <input type="checkbox" checked={spec.dropCap} onChange={(e) => set({ dropCap: e.currentTarget.checked })} /> Ornate first letter
                </label>
              )}
              <label class="check">
                <input type="checkbox" checked={spec.hatching} onChange={(e) => set({ hatching: e.currentTarget.checked })} /> Hatched edges
              </label>
              <label class="check">
                <input type="checkbox" checked={spec.aged} onChange={(e) => set({ aged: e.currentTarget.checked })} /> Worn (stains and folds)
              </label>
            </div>
            {spec.dropCap && /^\s*s/i.test(spec.body) && t !== 'note' && t !== 'notice' && (
              <p class="field__note">There's no ornate S, so text starting with S gets a plain first letter.</p>
            )}
          </div>

          <div class="panel">
            <h2>Stamp</h2>
            <Text label="Stamp text (leave empty for none)" value={spec.stamp} onInput={(stamp) => set({ stamp })} max={20} />
            <Choices
              label="Stamp ink"
              value={spec.stampInk}
              options={[
                ['red', 'Red'],
                ['blue', 'Blue'],
              ]}
              onChange={(stampInk) => set({ stampInk })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export function LetterMaker() {
  return <LetterTool />;
}
