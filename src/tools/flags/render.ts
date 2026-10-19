// Icons and flags built from the sigil cores, as SVG markup (same string for preview and export).

import type { BuiltSvg } from '../../lib/export';
import { BORDERS, CORES } from '../sigil/data';
import { CORE_PATHS } from '../sigil/paths.generated';
import { readableInk } from '../sigil/render';

export type Mode = 'icon' | 'flag';
export type IconBack = 'none' | 'circle' | 'rounded' | 'square' | 'shield' | 'diamond';
export type FlagShape = 'rect' | 'pennant' | 'swallowtail' | 'banner';
export type FlagRatio = '3:2' | '2:1' | '5:3' | '1:1';
export type FlagPattern = 'plain' | 'border' | 'band' | 'halves' | 'tricolour' | 'cross' | 'saltire';

export interface EmblemSpec {
  mode: Mode;
  core: number;
  style: 'filled' | 'outline';
  ink: string; // colour or 'auto'
  // icon
  back: IconBack;
  backColor: string;
  scale: number; // core size, 0.3 .. 1
  // flag
  shape: FlagShape;
  ratio: FlagRatio;
  pattern: FlagPattern;
  field: string;
  accent: string;
  emblemPos: 'center' | 'hoist';
  emblemSize: number; // fraction of flag height, 0.15 .. 0.8
  edge: boolean; // thin dark outline
}

/** Banner colours, from the sigil borders. */
export const COLORS = BORDERS.map((b) => ({ id: b.id, name: b.name, color: b.color }));

/**
 * Each realm's core with its national colour, as flags. Spoiler: these colours are part of the sigil solutions.
 * Indices into CORES and COLORS.
 */
export const REALM_FLAGS: { core: number; color: number }[] = [
  { core: 0, color: 2 }, // Arch Aries, yellow
  { core: 1, color: 5 }, // Corarica, orange
  { core: 2, color: 7 }, // Eraja, violet
  { core: 3, color: 4 }, // Fenn Aries, red
  { core: 4, color: 1 }, // Mora Jai, white
  { core: 5, color: 6 }, // Nuance, green
  { core: 6, color: 0 }, // Orinda Aries, black
  { core: 7, color: 3 }, // Verra, pink
];

const f = (n: number) => +n.toFixed(2);

/** The core centred on (cx, cy), `size` units across. */
function core(i: number, cx: number, cy: number, size: number, ink: string, style: EmblemSpec['style']): string {
  const s = size / 512;
  const d = CORE_PATHS[CORES[i].id];
  const paint = style === 'filled' ? `fill="${ink}"` : `fill="none" stroke="${ink}" stroke-width="${f(22)}" stroke-linejoin="round"`;
  // Outline: inset the stroke a little so the drawn size matches the filled one.
  const scale = style === 'filled' ? s : s * 0.92;
  return `<g transform="translate(${f(cx - (512 * scale) / 2)} ${f(cy - (512 * scale) / 2)}) scale(${f(scale * 10000) / 10000})"><path ${paint} fill-rule="evenodd" d="${d}"/></g>`;
}

function inkFor(spec: EmblemSpec, bg: string | null): string {
  if (spec.ink !== 'auto') return spec.ink;
  return bg ? readableInk('#ffffff', bg) : '#1b1b1b';
}

function svg(w: number, h: number, body: string, title: string): BuiltSvg {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}"><title>${title}</title>${body}</svg>`,
    width: w,
    height: h,
  };
}

function iconSvg(spec: EmblemSpec): BuiltSvg {
  const bg = spec.back === 'none' ? null : spec.backColor;
  const ink = inkFor(spec, bg);
  let back = '';
  if (bg) {
    if (spec.back === 'circle') back = `<circle cx="50" cy="50" r="49" fill="${bg}"/>`;
    else if (spec.back === 'rounded') back = `<rect x="1" y="1" width="98" height="98" rx="22" fill="${bg}"/>`;
    else if (spec.back === 'square') back = `<rect width="100" height="100" fill="${bg}"/>`;
    else if (spec.back === 'shield') back = `<path d="M8 6H92V46C92 72 72 88 50 96C28 88 8 72 8 46Z" fill="${bg}"/>`;
    else if (spec.back === 'diamond') back = `<path d="M50 1L99 50L50 99L1 50Z" fill="${bg}"/>`;
  }
  const room = spec.back === 'none' || spec.back === 'square' ? 100 : spec.back === 'rounded' ? 92 : 78;
  const cy = spec.back === 'shield' ? 47 : 50;
  return svg(100, 100, back + core(spec.core, 50, cy, room * spec.scale, ink, spec.style), `${CORES[spec.core].name} icon`);
}

const RATIO: Record<FlagRatio, number> = { '3:2': 1.5, '2:1': 2, '5:3': 5 / 3, '1:1': 1 };

function flagSvg(spec: EmblemSpec): BuiltSvg {
  const banner = spec.shape === 'banner';
  const H = 200;
  const W = banner ? 140 : Math.round(H * RATIO[spec.ratio]);
  const outline: Record<FlagShape, string> = {
    rect: `M0 0H${W}V${H}H0Z`,
    pennant: `M0 0L${W} ${H / 2}L0 ${H}Z`,
    swallowtail: `M0 0H${W}L${W * 0.8} ${H / 2}L${W} ${H}H0Z`,
    banner: `M0 0H${W}V${H}L${W / 2} ${H * 0.82}L0 ${H}Z`,
  };
  const { field, accent } = spec;
  let pattern = '';
  switch (spec.pattern) {
    case 'border':
      pattern = `<path d="${outline[spec.shape]}" fill="none" stroke="${accent}" stroke-width="${H * 0.14}"/>`;
      break;
    case 'band':
      pattern = `<rect x="0" y="${H / 3}" width="${W}" height="${H / 3}" fill="${accent}"/>`;
      break;
    case 'halves':
      pattern = `<rect x="0" y="${H / 2}" width="${W}" height="${H / 2}" fill="${accent}"/>`;
      break;
    case 'tricolour':
      pattern = `<rect x="0" y="0" width="${W / 3}" height="${H}" fill="${accent}"/><rect x="${(2 * W) / 3}" y="0" width="${W / 3}" height="${H}" fill="${accent}"/>`;
      break;
    case 'cross': {
      const t = H * 0.16;
      const x = banner ? W / 2 : W * 0.36;
      const y = banner ? H * 0.4 : H / 2;
      pattern = `<rect x="${x - t / 2}" y="0" width="${t}" height="${H}" fill="${accent}"/><rect x="0" y="${y - t / 2}" width="${W}" height="${t}" fill="${accent}"/>`;
      break;
    }
    case 'saltire':
      pattern = `<path d="M0 0L${W} ${H}M${W} 0L0 ${H}" stroke="${accent}" stroke-width="${H * 0.16}"/>`;
      break;
  }
  // The emblem sits on the field colour, or on the accent where the pattern puts it there.
  const crossX = banner ? W / 2 : W * 0.36;
  const onAccent = spec.pattern === 'cross' || ((spec.pattern === 'band' || spec.pattern === 'saltire') && spec.emblemPos === 'center');
  const behind = onAccent ? accent : field;
  const ink = inkFor(spec, behind);
  const size = H * spec.emblemSize;
  // On a cross the core sits where the arms meet (near the pole) or in the middle of the horizontal arm.
  const cx =
    spec.pattern === 'cross' && spec.emblemPos === 'hoist'
      ? crossX
      : spec.emblemPos === 'hoist'
        ? Math.min(W * 0.3, H * 0.5)
        : spec.shape === 'pennant'
          ? W * 0.33
          : spec.shape === 'swallowtail'
            ? W * 0.45
            : W / 2;
  const cy = banner ? H * 0.4 : H / 2;
  // Unique per shape and size: several flags can share a page, and ids are global there.
  const id = `flagclip-${spec.shape}-${W}x${H}`;
  const body =
    `<defs><clipPath id="${id}"><path d="${outline[spec.shape]}"/></clipPath></defs>` +
    `<g clip-path="url(#${id})"><path d="${outline[spec.shape]}" fill="${field}"/>${pattern}</g>` +
    core(spec.core, cx, cy, size, ink, spec.style) +
    (spec.edge ? `<path d="${outline[spec.shape]}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="1.5" stroke-linejoin="round"/>` : '');
  return svg(W, H, body, `${CORES[spec.core].name} flag`);
}

export function buildEmblem(spec: EmblemSpec): BuiltSvg {
  return spec.mode === 'icon' ? iconSvg(spec) : flagSvg(spec);
}

export function coreThumb(i: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60" aria-hidden="true">${core(i, 0, 0, 44, 'currentColor', 'filled')}</svg>`;
}
