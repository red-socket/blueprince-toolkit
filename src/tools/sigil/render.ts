// Builds sigils as SVG markup. The same string is used for the preview and the exports.
//
// Sigil space is centred on 0,0 with north up. From the inside out:
// core (r < CORE_R), rays (RAY_START..BAND_IN), motes on a ring at MOTE_R, border band BAND_IN..BAND_OUT.

import { BORDERS, CORES, SOCIETIES, TRAVELS, WEATHERS, type BorderPattern, type WeatherId } from './data';
import type { BuiltSvg } from '../../lib/export';
import { CORE_PATHS, MOTE_PATHS } from './paths.generated';

export interface SigilSpec {
  core: number | null;
  travel: number | null;
  weather: number;
  society: number | null;
  border: number | null;
}

export interface SigilStyle {
  ink: string; // a colour, or 'auto'
  background: string | null; // null = transparent
  bandFill: boolean; // fill the border band with the banner colour
  weight: number; // line weight multiplier
}

const CORE_SIZE = 44;
const RAY_START = 32;
const SHORT_RAY_END = 62;
const MOTE_R = 56;
const MOTE_SIZE = 16;
const BAND_IN = 82;
const BAND_OUT = 96;
const BAND_MID = (BAND_IN + BAND_OUT) / 2;
const PAD = 4;

const f = (n: number) => +n.toFixed(2);

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `preferred` if it reads on `bg`, otherwise black or white, whichever reads better. */
export function readableInk(preferred: string, bg: string): string {
  if (contrast(preferred, bg) >= 3) return preferred;
  return contrast('#1b1b1b', bg) >= contrast('#ffffff', bg) ? '#1b1b1b' : '#ffffff';
}

function placedPath(d: string, size: number, fill: string): string {
  const s = size / 512;
  return `<g transform="translate(${f(-size / 2)} ${f(-size / 2)}) scale(${f(s * 1000) / 1000})"><path fill="${fill}" fill-rule="evenodd" d="${d}"/></g>`;
}

// ---- rays ----

/** One ray along the negative y axis (north), from r0 to r1, in the given weather style. */
export function ray(weather: WeatherId, r0: number, r1: number, w: number): string {
  const y0 = -r0;
  const y1 = -r1;
  const len = r1 - r0;
  const line = (x: number) => `<line x1="${f(x)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y1)}"/>`;
  switch (weather) {
    case 'normal':
      return line(0);
    case 'foggy': {
      let s = line(0);
      for (let i = 0; i < 3; i++) {
        const y = y1 + 5 + i * 2.8;
        s += `<line x1="-3.4" y1="${f(y)}" x2="3.4" y2="${f(y)}"/>`;
      }
      return s;
    }
    case 'rainy':
      return line(-2.4) + line(0) + line(2.4);
    case 'stormy': {
      // Lightning: a zigzag of short teeth along the ray.
      const n = Math.max(3, Math.round(len / 5.5));
      const step = len / n;
      const pts = [`0,${f(y0)}`];
      for (let i = 1; i < n; i++) pts.push(`${i % 2 ? 2.6 : -2.6},${f(y0 - i * step)}`);
      pts.push(`0,${f(y1)}`);
      return `<polyline points="${pts.join(' ')}"/>`;
    }
    case 'heat': {
      const waves = Math.max(2, Math.round(len / 8));
      const steps = waves * 16;
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push(`${f(Math.sin(t * waves * 2 * Math.PI) * 2)},${f(y0 - t * len)}`);
      }
      return `<polyline points="${pts.join(' ')}"/>`;
    }
    case 'snow': {
      let s = line(0);
      const n = Math.max(2, Math.floor(len / 7));
      const gap = len / (n + 1);
      for (let i = 1; i <= n; i++) s += `<circle cx="0" cy="${f(y0 - i * gap)}" r="${f(1.1 + w * 0.5)}" stroke="none" fill="currentColor"/>`;
      return s;
    }
    case 'windy':
      return `<path fill="none" d="M0 ${f(y0)}Q${f(-len * 0.32)} ${f((y0 + y1) / 2)} 0 ${f(y1)}"/>`;
  }
}

function rays(travel: number, weather: number, w: number, ink: string): string {
  const t = TRAVELS[travel];
  const end = t.short ? SHORT_RAY_END : BAND_IN;
  const body = ray(WEATHERS[weather].id, RAY_START, end, w);
  const each = t.rays.map((a) => `<g transform="rotate(${a})">${body}</g>`).join('');
  return `<g stroke="${ink}" color="${ink}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round" fill="none">${each}</g>`;
}

// ---- motes ----

function motes(society: number, ink: string): string {
  const d = MOTE_PATHS[SOCIETIES[society].id];
  let s = '';
  for (let i = 0; i < 8; i++) {
    const a = 22.5 + i * 45;
    s += `<g transform="rotate(${a}) translate(0 ${-MOTE_R})">${placedPath(d, MOTE_SIZE, ink)}</g>`;
  }
  return s;
}

// ---- border ----

function around(n: number, piece: string, r = BAND_MID): string {
  let s = '';
  for (let i = 0; i < n; i++) s += `<g transform="rotate(${f((i * 360) / n)}) translate(0 ${-r})">${piece}</g>`;
  return s;
}

function star(ro: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = (i * Math.PI) / 5;
    pts.push(`${f(Math.sin(a) * r)},${f(-Math.cos(a) * r)}`);
  }
  return `<polygon points="${pts.join(' ')}" stroke="none" fill="currentColor"/>`;
}

/** Border pattern in local piece space: x along the ring, y outwards (negative = outer edge). */
function borderPattern(p: BorderPattern, w: number): string {
  const ring = (r: number, sw: number) => `<circle r="${r}" stroke-width="${f(sw)}"/>`;
  switch (p) {
    case 'beads':
      return ring(BAND_MID, 1.6 * w) + around(40, `<circle r="4.4" stroke="none" fill="currentColor"/>`);
    case 'chain':
      return around(40, `<ellipse rx="7.4" ry="3.9" stroke-width="${f(1.6 * w)}"/>`);
    case 'chevrons':
      return around(40, `<polyline points="-3,-6 3,0 -3,6" stroke-width="${f(1.6 * w)}"/>`);
    case 'rails':
      return (
        ring(BAND_MID - 3.6, 1.3 * w) +
        ring(BAND_MID + 3.6, 1.3 * w) +
        around(40, `<line x1="0" y1="-6.8" x2="0" y2="6.8" stroke-width="${f(1.9 * w)}"/>`)
      );
    case 'waves':
      return around(40, `<path d="M-1 -6.8C4 -3 -4 3 1 6.8" stroke-width="${f(1.7 * w)}"/>`);
    case 'stars':
      return ring(BAND_MID, 1.3 * w) + around(20, star(5.6, 2.3));
    case 'slashes':
      return around(40, `<line x1="-3.6" y1="-6.6" x2="3.6" y2="6.6" stroke-width="${f(2.3 * w)}"/>`);
    case 'ticks':
      return ring(BAND_MID, 1.8 * w) + around(20, `<rect x="-1.3" y="-6.4" width="2.6" height="12.8" stroke="none" fill="currentColor"/>`);
  }
}

function annulus(r1: number, r2: number, fill: string): string {
  const c = (r: number) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`;
  return `<path fill="${fill}" fill-rule="evenodd" d="${c(r2)}${c(r1)}"/>`;
}

function border(index: number, w: number, ink: string, bandFill: boolean): string {
  const b = BORDERS[index];
  let s = '';
  let patternInk = ink;
  if (bandFill) {
    s += annulus(BAND_IN, BAND_OUT, b.color);
    patternInk = readableInk(ink, b.color);
  }
  s += `<g stroke="${patternInk}" color="${patternInk}" fill="none" stroke-linecap="round" stroke-linejoin="round">${borderPattern(b.pattern, w)}</g>`;
  return s;
}

// ---- whole pictures ----

/** The sigil itself, centred on 0,0, fitting in a circle of radius BAND_OUT. */
function sigilGroup(spec: SigilSpec, style: SigilStyle, ink = style.ink): string {
  const w = 1.6 * style.weight;
  let s = '';
  if (spec.border !== null) s += border(spec.border, style.weight, ink, style.bandFill);
  if (spec.travel !== null) s += rays(spec.travel, spec.weather, w, ink);
  if (spec.society !== null) s += motes(spec.society, ink);
  if (spec.core !== null) s += placedPath(CORE_PATHS[CORES[spec.core].id], CORE_SIZE, ink);
  return s;
}


function wrap(viewBox: [number, number, number, number], body: string, bg: string | null, title: string): BuiltSvg {
  const [x, y, w, h] = viewBox;
  const rect = bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${w * 4}" height="${h * 4}">` +
    `<title>${title}</title>${rect}${body}</svg>`;
  return { svg, width: w, height: h };
}

export function describe(spec: SigilSpec): string {
  const parts: string[] = [];
  if (spec.core !== null) parts.push(CORES[spec.core].name + ' core');
  if (spec.travel !== null) parts.push(`${TRAVELS[spec.travel].name}, ${WEATHERS[spec.weather].name}`);
  if (spec.society !== null) parts.push(SOCIETIES[spec.society].name);
  if (spec.border !== null) parts.push(BORDERS[spec.border].name + ' border');
  return parts.length ? 'Sigil: ' + parts.join(', ') : 'Empty sigil';
}

/** The sigil on a square canvas. Ink 'auto' is black, or white on a dark background. */
export function buildSvg(spec: SigilSpec, input: SigilStyle): BuiltSvg {
  const ink = input.ink !== 'auto' ? input.ink : input.background ? readableInk('#1b1b1b', input.background) : '#1b1b1b';
  const r = BAND_OUT + PAD;
  return wrap([-r, -r, 2 * r, 2 * r], sigilGroup(spec, { ...input, ink }), input.background, describe(spec));
}

// ---- option icons (small previews for the pickers) ----

function icon(viewBox: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`;
}

export function coreIcon(i: number, ink: string): string {
  return icon('-30 -30 60 60', placedPath(CORE_PATHS[CORES[i].id], 44, ink));
}

export function travelIcon(i: number, ink: string): string {
  const t = TRAVELS[i];
  const body = t.rays.map((a) => `<g transform="rotate(${a})">${ray('normal', 7, t.short ? 18 : 26, 2.2)}</g>`).join('');
  return icon(
    '-30 -30 60 60',
    `<g stroke="${ink}" stroke-width="2.4" stroke-linecap="round" fill="none"><circle r="5"/>${body}</g>`,
  );
}

export function weatherIcon(i: number, ink: string): string {
  return icon(
    '-15 -30 30 60',
    `<g transform="translate(0 30)" stroke="${ink}" color="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">${ray(WEATHERS[i].id, 4, 56, 1.8)}</g>`,
  );
}

export function societyIcon(i: number, ink: string): string {
  return icon('-30 -30 60 60', placedPath(MOTE_PATHS[SOCIETIES[i].id], 40, ink));
}

export function borderIcon(i: number, ink: string): string {
  const b = BORDERS[i];
  const patternInk = readableInk(ink, b.color);
  return icon(
    '-100 -100 200 200',
    annulus(BAND_IN - 6, BAND_OUT + 2, b.color) +
      `<g stroke="${patternInk}" color="${patternInk}" fill="none" stroke-linecap="round" stroke-linejoin="round">${borderPattern(b.pattern, 1.6)}</g>`,
  );
}
