// Draws a floor-plan card in the style of the game's room cards on a canvas.
// All measurements are in a 512 x 512 card space, scaled to the canvas size.

export type Category = 'Blueprint' | 'Bedroom' | 'Hallway' | 'Green Room' | 'Shop' | 'Red Room' | 'Blackprint';
export type Shape = 'dead' | 'straight' | 'L' | 'T' | 'cross';
export type Side = 'N' | 'E' | 'S' | 'W';
export type Pattern = 'wood' | 'tiles' | 'carpet' | 'stone' | 'grass' | 'marble' | 'plain';

export const CATEGORIES: Category[] = ['Blueprint', 'Bedroom', 'Hallway', 'Green Room', 'Shop', 'Red Room', 'Blackprint'];

/** Frame colours sampled from the game's cards. */
export const FRAME: Record<Category, string> = {
  Blueprint: '#005a8a',
  Bedroom: '#5a3f5b',
  Hallway: '#894f20',
  'Green Room': '#30612a',
  Shop: '#a49a55',
  'Red Room': '#8b0100',
  Blackprint: '#141414',
};

/** Brighter versions for highlighted words in the card text. */
export const KEYWORD: Record<Category, string> = {
  Blueprint: '#33a8ff',
  Bedroom: '#c597ec',
  Hallway: '#f39a52',
  'Green Room': '#6fd75f',
  Shop: '#e6d36f',
  'Red Room': '#f03a2a',
  Blackprint: '#b9bcc4',
};

export const PATTERNS: Pattern[] = ['wood', 'tiles', 'carpet', 'stone', 'grass', 'marble', 'plain'];

export const ICONS = [
  'steps', 'key', 'gem', 'coins', 'gear', 'sparkle', 'food', 'chevron', 'die', 'clock',
  'enter', 'drafting', 'drop', 'puzzle', 'spread', 'ice', 'dumbbell', 'sneaker', 'purse',
] as const;
export type IconName = (typeof ICONS)[number];

/** Short names accepted in {braces} in the card text. */
export const ICON_ALIASES: Record<string, IconName> = {
  step: 'steps', steps: 'steps', key: 'key', keys: 'key', gem: 'gem', gems: 'gem', coin: 'coins', coins: 'coins', gold: 'coins',
  gear: 'gear', star: 'sparkle', sparkle: 'sparkle', food: 'food', chevron: 'chevron', die: 'die', dice: 'die', clock: 'clock',
  enter: 'enter', door: 'enter', drafting: 'drafting', compass: 'drafting', drop: 'drop', water: 'drop', puzzle: 'puzzle',
  spread: 'spread', ice: 'ice', dumbbell: 'dumbbell', weight: 'dumbbell', shoe: 'sneaker', sneaker: 'sneaker', purse: 'purse',
};

export interface CardSpec {
  name: string;
  category: Category;
  shape: Shape;
  rot: number; // quarter turns clockwise; the entrance is south at 0
  pattern: Pattern;
  floor: string; // floor colour for the patterns
  darken: number; // 0..0.8
  icon: IconName | null;
  text: string;
  cost: number; // gems, 0 = not shown
}

export interface Photo {
  img: CanvasImageSource & { width: number; height: number };
  zoom: number; // 1 = cover
  x: number; // pan, -1..1
  y: number;
}

const SIDES: Side[] = ['N', 'E', 'S', 'W'];
const BASE_DOORS: Record<Shape, Side[]> = {
  dead: ['S'],
  straight: ['S', 'N'],
  L: ['S', 'W'],
  T: ['S', 'E', 'W'],
  cross: ['N', 'E', 'S', 'W'],
};
export const doorsOf = (shape: Shape, rot: number): Side[] => BASE_DOORS[shape].map((s) => SIDES[(SIDES.indexOf(s) + rot) % 4]);

// ---- icons ----

const iconCache = new Map<string, Promise<HTMLImageElement>>();
export function loadIcon(name: IconName): Promise<HTMLImageElement> {
  if (!iconCache.has(name)) {
    iconCache.set(
      name,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `${import.meta.env.BASE_URL}card-icons/${name}.webp`;
      }),
    );
  }
  return iconCache.get(name)!;
}

export const iconUrl = (name: IconName) => `${import.meta.env.BASE_URL}card-icons/${name}.webp`;

// ---- colour helpers ----

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
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

// ---- floor patterns ----

function floor(ctx: CanvasRenderingContext2D, p: Pattern, base: string, seed: string) {
  const r = rng(seed + p);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  if (p === 'plain') return;
  if (p === 'wood') {
    const h = 30;
    for (let y = 0; y < 512; y += h) {
      let x = -r() * 200;
      while (x < 512) {
        const w = 120 + r() * 180;
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.25);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = shade(base, -0.45);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.strokeStyle = shade(base, -0.15);
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gy = y + 6 + r() * (h - 12);
          ctx.beginPath();
          ctx.moveTo(x + 4, gy);
          ctx.bezierCurveTo(x + w * 0.3, gy + (r() - 0.5) * 6, x + w * 0.7, gy + (r() - 0.5) * 6, x + w - 4, gy);
          ctx.stroke();
        }
        x += w;
      }
    }
  } else if (p === 'tiles') {
    const s = 64;
    for (let y = 0; y < 512; y += s)
      for (let x = 0; x < 512; x += s) {
        ctx.fillStyle = (x / s + y / s) % 2 ? shade(base, -0.35) : shade(base, 0.2);
        ctx.fillRect(x, y, s, s);
      }
    ctx.strokeStyle = shade(base, -0.55);
    ctx.lineWidth = 2;
    for (let k = 0; k <= 512; k += s) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k, 512);
      ctx.moveTo(0, k);
      ctx.lineTo(512, k);
      ctx.stroke();
    }
  } else if (p === 'carpet') {
    ctx.fillStyle = shade(base, -0.3);
    ctx.fillRect(70, 70, 372, 372);
    ctx.strokeStyle = shade(base, 0.35);
    ctx.lineWidth = 6;
    ctx.strokeRect(86, 86, 340, 340);
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 100, 312, 312);
    ctx.fillStyle = shade(base, 0.25);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate((k * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -120);
      ctx.lineTo(26, -60);
      ctx.lineTo(0, -40);
      ctx.lineTo(-26, -60);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (p === 'stone') {
    const h = 64;
    for (let y = 0, row = 0; y < 512; y += h, row++) {
      let x = row % 2 ? -40 : 0;
      while (x < 512) {
        const w = 70 + r() * 70;
        ctx.fillStyle = shade(base, (r() - 0.5) * 0.3);
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        x += w;
      }
    }
  } else if (p === 'grass') {
    for (let k = 0; k < 2600; k++) {
      const x = r() * 512;
      const y = r() * 512;
      ctx.strokeStyle = shade(base, (r() - 0.4) * 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 6, y - 5 - r() * 7);
      ctx.stroke();
    }
  } else if (p === 'marble') {
    ctx.fillStyle = shade(base, 0.15);
    ctx.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = shade(base, -0.25 - r() * 0.3);
      ctx.lineWidth = 0.8 + r() * 2;
      ctx.beginPath();
      let x = r() * 512;
      let y = -10;
      ctx.moveTo(x, y);
      while (y < 520) {
        x += (r() - 0.5) * 50;
        y += 20 + r() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

// ---- rich text ----

type Seg = { kind: 'text'; text: string; color: string } | { kind: 'icon'; name: IconName };

/** "{coin}" is an icon, "*WORD*" is highlighted in the card's colour. */
export function parseText(src: string, keyword: string): Seg[][] {
  return src.split('\n').map((line) => {
    const segs: Seg[] = [];
    const re = /\{(\w+)\}|\*([^*]+)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (m.index > last) segs.push({ kind: 'text', text: line.slice(last, m.index), color: '#ffffff' });
      if (m[1] !== undefined) {
        const icon = ICON_ALIASES[m[1].toLowerCase()];
        if (icon) segs.push({ kind: 'icon', name: icon });
        else segs.push({ kind: 'text', text: m[0], color: '#ffffff' });
      } else segs.push({ kind: 'text', text: m[2].replace(/ /g, '\u00a0'), color: keyword }); // highlighted words stay on one line
      last = re.lastIndex;
    }
    if (last < line.length) segs.push({ kind: 'text', text: line.slice(last), color: '#ffffff' });
    return segs;
  });
}

type Piece = { seg: Seg; w: number };
type Word = Piece[];

function words(ctx: CanvasRenderingContext2D, segs: Seg[], size: number): Word[] {
  const out: Word[] = [[]];
  for (const seg of segs) {
    if (seg.kind === 'icon') {
      out[out.length - 1].push({ seg, w: size * 1.15 });
      continue;
    }
    seg.text.split(/( )/).forEach((part) => {
      if (part === ' ') out.push([]);
      else if (part) out[out.length - 1].push({ seg: { ...seg, text: part }, w: ctx.measureText(part).width });
    });
  }
  return out.filter((w) => w.length);
}

const width = (w: Word) => w.reduce((a, p) => a + p.w, 0);

function layout(ctx: CanvasRenderingContext2D, text: string, keyword: string, size: number, maxW: number): Word[][] {
  ctx.font = `700 ${size}px Barlow, sans-serif`;
  const space = ctx.measureText(' ').width;
  const lines: Word[][] = [];
  for (const segs of parseText(text, keyword)) {
    let line: Word[] = [];
    let lw = 0;
    for (const w of words(ctx, segs, size)) {
      const ww = width(w);
      if (line.length && lw + space + ww > maxW) {
        lines.push(line);
        line = [];
        lw = 0;
      }
      lw += (line.length ? space : 0) + ww;
      line.push(w);
    }
    lines.push(line);
  }
  return lines;
}

// ---- the card ----

const F = 30; // frame width
const GAP = 84; // door opening

function frame(ctx: CanvasRenderingContext2D, cat: Category) {
  const c = FRAME[cat];
  const edges: [Side, number[][], number][] = [
    ['N', [[0, 0], [512, 0], [512 - F, F], [F, F]], 0.12],
    ['E', [[512, 0], [512, 512], [512 - F, 512 - F], [512 - F, F]], -0.12],
    ['S', [[512, 512], [0, 512], [F, 512 - F], [512 - F, 512 - F]], -0.2],
    ['W', [[0, 512], [0, 0], [F, F], [F, 512 - F]], 0.05],
  ];
  for (const [, pts, light] of edges) {
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = cat === 'Blackprint' ? shade('#1c1c1c', light) : shade(c, light);
    ctx.fill();
  }
  ctx.strokeStyle = cat === 'Blackprint' ? '#6a6e7b' : shade(c, -0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(F, F);
  ctx.moveTo(512, 0);
  ctx.lineTo(512 - F, F);
  ctx.moveTo(512, 512);
  ctx.lineTo(512 - F, 512 - F);
  ctx.moveTo(0, 512);
  ctx.lineTo(F, 512 - F);
  ctx.stroke();
  ctx.strokeRect(1, 1, 510, 510);
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 4;
  ctx.strokeRect(F, F, 512 - 2 * F, 512 - 2 * F);
}

function doors(ctx: CanvasRenderingContext2D, sides: Side[]) {
  const a = 256 - GAP / 2;
  for (const s of sides) {
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate((SIDES.indexOf(s) * Math.PI) / 2);
    ctx.translate(-256, -256);
    // Opening through the frame, fading into the room.
    ctx.fillStyle = '#000';
    ctx.fillRect(a, -1, GAP, F + 4);
    const g = ctx.createLinearGradient(0, F + 3, 0, F + 40);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(a, F + 3, GAP, 37);
    ctx.restore();
  }
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, outer: string | null, lw: number) {
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (outer) {
    ctx.strokeStyle = outer;
    ctx.lineWidth = lw * 1.9;
    ctx.strokeText(text, x, y);
  }
  ctx.strokeStyle = '#101010';
  ctx.lineWidth = lw;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

/** Splits the title into one or two lines and picks the largest size that fits. */
function titleLayout(ctx: CanvasRenderingContext2D, name: string): { lines: string[]; size: number } {
  const t = name.toUpperCase().trim() || ' ';
  const fits = (lines: string[], size: number) => {
    ctx.font = `800 ${size}px Barlow, sans-serif`;
    return lines.every((l) => ctx.measureText(l).width <= 420);
  };
  for (let size = 78; size >= 44; size -= 2) if (fits([t], size)) return { lines: [t], size };
  const ws = t.split(' ');
  let best: string[] = [t];
  let bestW = Infinity;
  ctx.font = '800 60px Barlow, sans-serif';
  for (let k = 1; k < ws.length; k++) {
    const l = [ws.slice(0, k).join(' '), ws.slice(k).join(' ')];
    const w = Math.max(...l.map((s) => ctx.measureText(s).width));
    if (w < bestW) [best, bestW] = [l, w];
  }
  for (let size = 64; size >= 30; size -= 2) if (fits(best, size)) return { lines: best, size };
  return { lines: best, size: 30 };
}

/** Draws the card on `canvas` at its current size. Icons must already be loaded (see `iconsUsed`). */
export function drawCard(canvas: HTMLCanvasElement, spec: CardSpec, photo: Photo | null, icons: Map<string, HTMLImageElement>) {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / 512;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, 512, 512);

  // Floor
  if (photo) {
    const { img, zoom, x, y } = photo;
    const s = (Math.max(512 / img.width, 512 / img.height) || 1) * zoom;
    const w = img.width * s;
    const h = img.height * s;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, (512 - w) / 2 + (x * (w - 512)) / 2, (512 - h) / 2 + (y * (h - 512)) / 2, w, h);
  } else floor(ctx, spec.pattern, spec.floor, spec.name);

  // Darken and vignette, so the white text reads on any floor.
  ctx.fillStyle = `rgba(0,0,0,${spec.darken})`;
  ctx.fillRect(0, 0, 512, 512);
  const v = ctx.createRadialGradient(256, 256, 120, 256, 256, 380);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 512, 512);

  frame(ctx, spec.category);
  doors(ctx, doorsOf(spec.shape, spec.rot));

  // Title
  const { lines, size } = titleLayout(ctx, spec.name);
  ctx.font = `800 ${size}px Barlow, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = lines.length === 1 ? 160 : 140 - size * 0.1;
  lines.forEach((l, i) => outlinedText(ctx, l, 256, top + i * size * 0.98, spec.category === 'Red Room' ? '#b0100a' : null, size * 0.16));

  // Icon and text
  const textTop = lines.length === 1 ? 0 : size * 0.5;
  let y = 300 + textTop;
  if (spec.icon && icons.get(spec.icon)) {
    const img = icons.get(spec.icon)!;
    const s = 96 / Math.max(img.width, img.height);
    ctx.drawImage(img, 256 - (img.width * s) / 2, y - (img.height * s) / 2 - 4, img.width * s, img.height * s);
    y += 72;
  } else y += 20;

  if (spec.text.trim()) {
    const kw = KEYWORD[spec.category];
    let tsize = 30;
    let tl = layout(ctx, spec.text, kw, tsize, 410);
    while (tl.length * tsize * 1.18 > 470 - y && tsize > 18) {
      tsize -= 2;
      tl = layout(ctx, spec.text, kw, tsize, 410);
    }
    ctx.font = `700 ${tsize}px Barlow, sans-serif`;
    const space = ctx.measureText(' ').width;
    const lh = tsize * 1.18;
    if (!spec.icon) y = Math.max(y, 380 - (tl.length * lh) / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    tl.forEach((line, li) => {
      const lw = line.reduce((a, w, i) => a + width(w) + (i ? space : 0), 0);
      let x = 256 - lw / 2;
      const ly = y + li * lh;
      line.forEach((w, wi) => {
        if (wi) x += space;
        for (const p of w) {
          if (p.seg.kind === 'icon') {
            const img = icons.get(p.seg.name);
            if (img) {
              const s = (tsize * 1.1) / Math.max(img.width, img.height);
              ctx.drawImage(img, x + (p.w - img.width * s) / 2, ly - (img.height * s) / 2, img.width * s, img.height * s);
            }
          } else {
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = tsize * 0.2;
            ctx.strokeText(p.seg.text, x, ly);
            ctx.fillStyle = p.seg.color;
            ctx.fillText(p.seg.text, x, ly);
          }
          x += p.w;
        }
      });
    });
  }

  // Gem cost, as on the drafting screen
  if (spec.cost > 0 && icons.get('gem')) {
    const img = icons.get('gem')!;
    const s = 30 / Math.max(img.width, img.height);
    for (let i = 0; i < spec.cost; i++) {
      const gx = 512 - F - 14 - (i + 1) * 30;
      ctx.drawImage(img, gx, F + 12, img.width * s, img.height * s);
    }
  }
}

/** Icons a card needs: its icon, the ones in its text, and the gem for the cost. */
export function iconsUsed(spec: CardSpec): IconName[] {
  const set = new Set<IconName>();
  if (spec.icon) set.add(spec.icon);
  if (spec.cost > 0) set.add('gem');
  for (const m of spec.text.matchAll(/\{(\w+)\}/g)) {
    const n = ICON_ALIASES[m[1].toLowerCase()];
    if (n) set.add(n);
  }
  return [...set];
}
