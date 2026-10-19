// Draws estate-style documents on a canvas: letters, memos, notes and notices.
// Layout works in "page units": the page is 1000 wide and its height depends on the template.

export type Template = 'letter' | 'memo' | 'note' | 'notice';
export type Paper = 'ivory' | 'aged' | 'white' | 'grey';
export type Ink = 'black' | 'blue' | 'red' | 'green' | 'sepia';
export type Hand = 'handwritten' | 'typed' | 'printed';

export const TEMPLATE_HEIGHT: Record<Template, number> = { letter: 1320, memo: 1320, note: 820, notice: 700 };

export const PAPER: Record<Paper, string> = { ivory: '#f3ead6', aged: '#e3cfa2', white: '#f7f5f0', grey: '#dfe3e6' };
export const INK: Record<Ink, string> = { black: '#1f1b18', blue: '#1d3c8f', red: '#8f1414', green: '#1f6a35', sepia: '#5a3a1e' };
export const DOC_RED = '#7a0a14'; // the game's document red, a touch lighter for print

export interface DocSpec {
  template: Template;
  paper: Paper;
  ink: Ink;
  hand: Hand;
  letterhead: string;
  heading: string; // notice title, memo subject
  to: string;
  from: string;
  date: string;
  body: string;
  signature: string;
  dropCap: boolean;
  frame: boolean;
  hatching: boolean;
  aged: boolean; // stains and folds
  stamp: string;
  stampInk: 'red' | 'blue';
}

const BASE = `${import.meta.env.BASE_URL}docs/`;
const CAPS = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'; // the atlas has no S

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImg(name: string): Promise<HTMLImageElement> {
  if (!imgCache.has(name)) {
    imgCache.set(
      name,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = BASE + name + '.webp';
      }),
    );
  }
  return imgCache.get(name)!;
}

export type Assets = Map<string, HTMLImageElement>;

/** Loads every picture a document needs. */
export async function loadAssets(spec: DocSpec): Promise<Assets> {
  const names = ['frame', 'holly'];
  const first = spec.body.trim().charAt(0).toUpperCase();
  if (spec.dropCap && CAPS.includes(first)) names.push('cap-' + first);
  const pairs = await Promise.all(names.map((n) => loadImg(n).then((i) => [n, i] as const).catch(() => null)));
  return new Map(pairs.filter((p): p is readonly [string, HTMLImageElement] => p !== null));
}

/** The pictures are black ink; this returns a copy in another colour. */
const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const key = img.src + color;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return c;
}

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FONT: Record<Hand, (size: number, weight?: number) => string> = {
  handwritten: (s, w = 400) => `${w} ${s}px Kalam, cursive`,
  typed: (s) => `400 ${s}px "Special Elite", monospace`,
  printed: (s) => `400 ${s}px "IM Fell English", Georgia, serif`,
};
const serif = (s: number, italic = false) => `${italic ? 'italic ' : ''}400 ${s}px "IM Fell English", Georgia, serif`;
const signatureFont = (s: number) => `400 ${s}px "Homemade Apple", cursive`;

// ---- paper ----

function paper(ctx: CanvasRenderingContext2D, w: number, h: number, spec: DocSpec, r: () => number) {
  const base = PAPER[spec.paper];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Grain and fibres
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.05)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.strokeStyle = 'rgba(110,90,60,0.07)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, x + (r() - 0.5) * 50, y + (r() - 0.5) * 50);
    ctx.stroke();
  }
  // Light from the upper left
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(80,60,30,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (spec.aged) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(120,80,30,0)');
    v.addColorStop(1, 'rgba(120,80,30,0.28)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    // A tea ring and a fold
    const cx = w * (0.62 + r() * 0.25);
    const cy = h * (0.55 + r() * 0.3);
    const rad = 70 + r() * 40;
    ctx.strokeStyle = 'rgba(120,75,25,0.16)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0.3, Math.PI * 1.85);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(120,75,25,0.12)';
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 3, rad + 6, 0, Math.PI * 2);
    ctx.stroke();
    if (spec.template === 'letter' || spec.template === 'memo') {
      for (const fy of [h / 3, (2 * h) / 3]) {
        ctx.fillStyle = 'rgba(90,60,30,0.08)';
        ctx.fillRect(0, fy, w, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, fy + 2, w, 2);
      }
    }
  }
  if (spec.hatching) {
    // Hand hatching along the bottom and right edges, crossed in the corner, like the game's paper.
    ctx.save();
    ctx.strokeStyle = '#4a3b2a';
    for (let i = 0; i < 260; i++) {
      const d = Math.pow(r(), 1.8) * 260; // distance from the corner
      const t = r() * Math.PI * 0.5;
      const x = w - 10 - Math.cos(t) * d;
      const y = h - 10 - Math.sin(t) * d;
      const len = 18 + r() * 26;
      ctx.globalAlpha = 0.22 * (1 - d / 260);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (i % 2) {
        ctx.moveTo(x - len / 2, y + len / 2);
        ctx.lineTo(x + len / 2, y - len / 2);
      } else {
        ctx.moveTo(x - len / 2, y - len / 2);
        ctx.lineTo(x + len / 2, y + len / 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#4a3b2a';
    ctx.lineWidth = 1.2;
    for (let x = 0; x < w; x += 9 + r() * 5) {
      ctx.beginPath();
      ctx.moveTo(x, h - 4);
      ctx.lineTo(x + 14 + r() * 8, h - 22 - r() * 14);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 9 + r() * 5) {
      ctx.beginPath();
      ctx.moveTo(w - 4, y);
      ctx.lineTo(w - 22 - r() * 14, y + 14 + r() * 8);
      ctx.stroke();
    }
    ctx.restore();
  }
  // The game's dark outline
  ctx.strokeStyle = 'rgba(40,30,20,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

/** Nine-slice: draws the hand-drawn double frame stretched to a rectangle, keeping its corners. */
function frameRect(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number, corner: number) {
  const c = Math.round(img.width * 0.16);
  const sw = img.width - 2 * c;
  const sh = img.height - 2 * c;
  const d = corner;
  const parts: [number, number, number, number, number, number, number, number][] = [
    [0, 0, c, c, x, y, d, d],
    [c, 0, sw, c, x + d, y, w - 2 * d, d],
    [c + sw, 0, c, c, x + w - d, y, d, d],
    [0, c, c, sh, x, y + d, d, h - 2 * d],
    [c + sw, c, c, sh, x + w - d, y + d, d, h - 2 * d],
    [0, c + sh, c, c, x, y + h - d, d, d],
    [c, c + sh, sw, c, x + d, y + h - d, w - 2 * d, d],
    [c + sw, c + sh, c, c, x + w - d, y + h - d, d, d],
  ];
  for (const p of parts) ctx.drawImage(img, ...p);
}

// ---- text ----

interface Line {
  text: string;
  indent: number;
  gapAfter: number; // extra space after a paragraph
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, firstIndent: number, indentLines: number): Line[] {
  const out: Line[] = [];
  const paras = text.split('\n');
  paras.forEach((para, pi) => {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    const indentFor = () => (out.length < indentLines ? firstIndent : 0);
    if (!words.length) out.push({ text: '', indent: 0, gapAfter: 0 });
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > width - indentFor()) {
        out.push({ text: line, indent: indentFor(), gapAfter: 0 });
        line = w;
      } else line = test;
    }
    if (line) out.push({ text: line, indent: indentFor(), gapAfter: pi < paras.length - 1 ? 0.35 : 0 });
  });
  return out;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Writes `text` into the block, shrinking the size until it fits. Returns the bottom of the text. */
function body(ctx: CanvasRenderingContext2D, spec: DocSpec, text: string, b: Block, maxSize: number, r: () => number, assets: Assets, align: 'left' | 'center' = 'left') {
  const color = INK[spec.ink];
  const font = FONT[spec.hand];
  const capImg = spec.dropCap && align === 'left' ? assets.get('cap-' + text.trim().charAt(0).toUpperCase()) : undefined;
  const source = capImg ? text.trim().slice(1) : text;
  let size = maxSize;
  let lines: Line[] = [];
  let lh = 0;
  let capW = 0;
  let capLines = 0;
  for (; size >= 14; size -= 1) {
    ctx.font = font(size);
    lh = size * (spec.hand === 'handwritten' ? 1.45 : 1.5);
    capLines = capImg ? 3 : 0;
    capW = capImg ? ((lh * capLines - lh * 0.3) / capImg.naturalHeight) * capImg.naturalWidth + size * 0.4 : 0;
    lines = wrap(ctx, source, b.w, capW, capLines);
    const total = lines.reduce((a, l) => a + lh * (1 + l.gapAfter), 0);
    if (total <= b.h) break;
  }
  ctx.font = font(size);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  if (capImg) {
    const ch = lh * capLines - lh * 0.3;
    const cw = (ch / capImg.naturalHeight) * capImg.naturalWidth;
    ctx.drawImage(tinted(capImg, spec.ink === 'black' ? DOC_RED : color), b.x, b.y + lh * 0.12, cw, ch);
  }
  let y = b.y + size;
  for (const l of lines) {
    const jitter = spec.hand === 'handwritten' ? (r() - 0.5) * 2.2 : 0;
    if (align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(l.text, b.x + b.w / 2, y + jitter);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(l.text, b.x + l.indent, y + jitter);
    }
    y += lh * (1 + l.gapAfter);
  }
  return y - lh + size * 0.4;
}

function rule(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y - 2.2, x1 - x0, 2.6);
  ctx.fillRect(x0, y + 3, x1 - x0, 0.9);
  const cx = (x0 + x1) / 2;
  ctx.beginPath();
  ctx.moveTo(cx, y - 8);
  ctx.lineTo(cx + 8, y);
  ctx.lineTo(cx, y + 8);
  ctx.lineTo(cx - 8, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function letterhead(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  const t = text.toUpperCase().split('').join(' ');
  ctx.font = serif(26);
  ctx.fillStyle = DOC_RED;
  ctx.textAlign = 'center';
  ctx.fillText(t, cx, y);
  const w = ctx.measureText(t).width;
  for (const dir of [-1, 1]) {
    const x0 = cx + dir * (w / 2 + 18);
    const x1 = x0 + dir * 70;
    ctx.fillRect(Math.min(x0, x1), y - 9, 70, 1.6);
    ctx.beginPath();
    ctx.arc(x0 + dir * 4, y - 8.2, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function stamp(ctx: CanvasRenderingContext2D, text: string, color: string, cx: number, cy: number, r: () => number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.font = `400 46px "Special Elite", monospace`;
  const t = text.toUpperCase();
  const w = ctx.measureText(t).width + 50;
  const h = 78;
  ctx.globalAlpha = 0.78;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, 0, 3);
  // Worn rubber
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.4 + r() * 0.6})`;
    ctx.fillRect(-w / 2 + r() * w, -h / 2 + r() * h, 1 + r() * 3, 1 + r() * 2);
  }
  ctx.restore();
}

// ---- templates ----

export function drawDoc(canvas: HTMLCanvasElement, spec: DocSpec, assets: Assets) {
  const W = 1000;
  const H = TEMPLATE_HEIGHT[spec.template];
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const r = rng(spec.template + spec.body.length + spec.heading);
  paper(ctx, W, H, spec, r);
  const frameImg = assets.get('frame');
  const sigTop = (y: number) => {
    if (!spec.signature.trim()) return;
    ctx.font = signatureFont(34);
    ctx.fillStyle = INK[spec.ink];
    ctx.textAlign = 'right';
    ctx.fillText(spec.signature, W - 120, Math.min(y + 70, H - 110));
  };

  if (spec.template === 'letter') {
    if (spec.frame && frameImg) frameRect(ctx, tinted(frameImg, '#2b2420'), 34, 34, W - 68, H - 68, 60);
    let y = 120;
    if (spec.letterhead.trim()) {
      letterhead(ctx, spec.letterhead, W / 2, y);
      rule(ctx, 110, W - 110, y + 32, DOC_RED);
      y += 90;
    }
    if (spec.date.trim()) {
      ctx.font = serif(26, true);
      ctx.fillStyle = '#5a4a3a';
      ctx.textAlign = 'right';
      ctx.fillText(spec.date, W - 120, y + 10);
      y += 50;
    }
    const bottom = body(ctx, spec, spec.body, { x: 120, y: y + 10, w: W - 240, h: H - y - 280 }, 40, r, assets);
    sigTop(bottom);
  } else if (spec.template === 'memo') {
    if (spec.frame && frameImg) frameRect(ctx, tinted(frameImg, '#2b2420'), 34, 34, W - 68, H - 68, 60);
    let y = 130;
    if (spec.letterhead.trim()) {
      letterhead(ctx, spec.letterhead, W / 2, y - 30);
    }
    ctx.font = serif(64);
    ctx.fillStyle = DOC_RED;
    ctx.textAlign = 'center';
    ctx.fillText('MEMORANDUM', W / 2, y + 40);
    rule(ctx, 110, W - 110, y + 70, DOC_RED);
    y += 130;
    const rows: [string, string][] = [
      ['To', spec.to],
      ['From', spec.from],
      ['Date', spec.date],
      ['Subject', spec.heading],
    ];
    for (const [label, value] of rows) {
      if (!value.trim()) continue;
      ctx.font = serif(28);
      ctx.fillStyle = DOC_RED;
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase() + ':', 120, y);
      ctx.font = FONT.typed(28);
      ctx.fillStyle = INK[spec.ink];
      ctx.fillText(value, 290, y);
      ctx.fillStyle = 'rgba(90,70,50,0.35)';
      ctx.fillRect(290, y + 9, W - 410, 1.2);
      y += 52;
    }
    y += 20;
    ctx.fillStyle = 'rgba(90,70,50,0.5)';
    ctx.fillRect(120, y, W - 240, 1.5);
    const bottom = body(ctx, spec, spec.body, { x: 120, y: y + 30, w: W - 240, h: H - y - 230 }, 32, r, assets);
    sigTop(bottom);
  } else if (spec.template === 'note') {
    // A page torn from a pocket notebook: blue rules and a red margin.
    const lh = 54;
    ctx.strokeStyle = 'rgba(70,110,170,0.35)';
    ctx.lineWidth = 1.4;
    for (let y = 130; y < H - 30; y += lh) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(170,40,40,0.5)';
    ctx.beginPath();
    ctx.moveTo(110, 0);
    ctx.lineTo(110, H);
    ctx.stroke();
    // Torn top edge
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 14) ctx.lineTo(x, 8 + r() * 14);
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    let y = 76;
    if (spec.heading.trim()) {
      ctx.font = FONT[spec.hand](40, 700);
      ctx.fillStyle = INK[spec.ink];
      ctx.textAlign = 'left';
      ctx.fillText(spec.heading, 140, y + 36);
      y += lh;
    }
    // Text sits on the rules.
    const font = FONT[spec.hand];
    let size = 36;
    let lines: Line[] = [];
    const rows = Math.floor((H - 130 - (spec.heading.trim() ? lh : 0)) / lh) - (spec.signature.trim() ? 1 : 0);
    for (; size >= 18; size--) {
      ctx.font = font(size);
      lines = wrap(ctx, spec.body, W - 200, 0, 0);
      if (lines.length <= rows) break;
    }
    ctx.fillStyle = INK[spec.ink];
    let row = spec.heading.trim() ? 2 : 1;
    for (const l of lines.slice(0, rows)) {
      ctx.fillText(l.text, 140, 130 + (row - 1) * lh - 10 + (spec.hand === 'handwritten' ? (r() - 0.5) * 2 : 0));
      row++;
    }
    if (spec.signature.trim()) {
      ctx.font = signatureFont(30);
      ctx.textAlign = 'right';
      ctx.fillText(spec.signature, W - 80, 130 + (row - 1) * lh - 10);
    }
  } else {
    // Notice: a framed card with a printed title and holly sprigs.
    if (frameImg) frameRect(ctx, tinted(frameImg, DOC_RED), 40, 40, W - 80, H - 80, 70);
    const holly = assets.get('holly');
    if (holly) {
      const t = tinted(holly, '#3a5a2c');
      const s = 120 / holly.naturalHeight;
      ctx.drawImage(t, 70, 70, holly.naturalWidth * s, 120);
      ctx.save();
      ctx.translate(W - 70, 70);
      ctx.scale(-1, 1);
      ctx.drawImage(t, 0, 0, holly.naturalWidth * s, 120);
      ctx.restore();
    }
    let y = 150;
    if (spec.letterhead.trim()) {
      letterhead(ctx, spec.letterhead, W / 2, y - 20);
      y += 20;
    }
    let tsize = 76;
    ctx.font = serif(tsize);
    while (ctx.measureText(spec.heading).width > W - 300 && tsize > 36) ctx.font = serif((tsize -= 2));
    ctx.fillStyle = DOC_RED;
    ctx.textAlign = 'center';
    ctx.fillText(spec.heading, W / 2, y + tsize * 0.7);
    y += tsize + 10;
    rule(ctx, 260, W - 260, y, DOC_RED);
    body(ctx, { ...spec, dropCap: false }, spec.body, { x: 150, y: y + 30, w: W - 300, h: H - y - 150 }, 34, r, assets, 'center');
    if (spec.signature.trim()) {
      ctx.font = serif(28, true);
      ctx.fillStyle = '#4a3b2a';
      ctx.textAlign = 'center';
      ctx.fillText(`— ${spec.signature}`, W / 2, H - 100);
    }
  }

  if (spec.stamp.trim()) stamp(ctx, spec.stamp, spec.stampInk === 'red' ? '#b01818' : '#22489c', W * 0.68, H * (spec.template === 'notice' ? 0.78 : 0.86), r);
}
