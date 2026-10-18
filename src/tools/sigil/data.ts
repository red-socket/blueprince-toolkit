// The four parts of a realm sigil, as described in the in-game book on sigils:
// core (which realm), rays (transportation by number, weather by style),
// motes (society) and border (national colour).
// Option order follows the Inner Sanctum control wheels.

export interface Core {
  id: string; // key in CORE_PATHS
  name: string;
  shape: string; // plain description of the shape, used as a label
}

export const CORES: Core[] = [
  { id: 'ARCH-ARIES', name: 'Arch Aries', shape: 'Mountain' },
  { id: 'CORARICA', name: 'Corarica', shape: 'Heart' },
  { id: 'ERAJA', name: 'Eraja', shape: 'Hourglass' },
  { id: 'FENN-ARIES', name: 'Fenn Aries', shape: 'Pentagon' },
  { id: 'MORA-JAI', name: 'Mora Jai', shape: 'Arch' },
  { id: 'NUANCE', name: 'Nuance', shape: 'Diamond' },
  { id: 'ORINDA-ARIES', name: 'Orinda Aries', shape: 'Coffin' },
  { id: 'VERRA', name: 'Verra', shape: 'Slant' },
];

export interface Travel {
  id: string;
  name: string;
  /** Ray directions in degrees, clockwise from north. */
  rays: number[];
  /** Rays stop short of the border (turtleback travel). */
  short?: boolean;
  hint: string;
}

export const TRAVELS: Travel[] = [
  { id: 'roads', name: 'Roads', rays: [45, 135, 225, 315], hint: 'Four rays, like crossroads on a map' },
  { id: 'horseback', name: 'Horseback', rays: [90, 135, 225, 270], hint: 'Four rays, set like a galloping horse' },
  { id: 'trains', name: 'Trains', rays: [315, 45, 180], hint: 'Three rays, for track-based travel' },
  { id: 'aviation', name: 'Aviation', rays: [270, 315, 0, 45, 90], hint: 'Five rays, above the horizon' },
  { id: 'camels', name: 'Camels', rays: [90, 270], hint: 'Two rays, for flat terrain' },
  { id: 'turtle', name: 'Turtleback', rays: [0, 45, 90, 180, 270], short: true, hint: 'Five short rays that stop before the border' },
  { id: 'naval', name: 'Naval', rays: [0, 45, 90, 135, 180, 225, 270, 315], hint: 'Eight rays, like a compass rose' },
];

export type WeatherId = 'normal' | 'foggy' | 'rainy' | 'stormy' | 'heat' | 'snow' | 'windy';

export interface Weather {
  id: WeatherId;
  name: string;
  hint: string;
}

export const WEATHERS: Weather[] = [
  { id: 'normal', name: 'Normal', hint: 'A plain straight ray' },
  { id: 'foggy', name: 'Foggy', hint: 'Crossbars near the end of the ray' },
  { id: 'rainy', name: 'Rainy', hint: 'Three lines pouring down' },
  { id: 'stormy', name: 'Stormy', hint: 'A jagged lightning ray' },
  { id: 'heat', name: 'Heat', hint: 'A wavy, shimmering ray' },
  { id: 'snow', name: 'Snow', hint: 'A ray dotted with falling circles' },
  { id: 'windy', name: 'Windy', hint: 'A ray bent by the wind' },
];

export interface Society {
  id: string; // key in MOTE_PATHS
  name: string;
}

export const SOCIETIES: Society[] = [
  { id: 'mote-1', name: 'Tribal' },
  { id: 'mote-2', name: 'Agricultural' },
  { id: 'mote-3', name: 'Martial' },
  { id: 'mote-4', name: 'Metropolitan' },
  { id: 'mote-5', name: 'Academic' },
  { id: 'mote-6', name: 'Industrial' },
  { id: 'mote-7', name: 'Spiritual' },
  { id: 'mote-8', name: 'Poetic' },
];

export type BorderPattern = 'beads' | 'chain' | 'chevrons' | 'rails' | 'waves' | 'stars' | 'slashes' | 'ticks';

export interface Border {
  id: string;
  name: string;
  color: string; // banner colour
  pattern: BorderPattern;
}

export const BORDERS: Border[] = [
  { id: 'black', name: 'Black', color: '#1a1a1a', pattern: 'beads' },
  { id: 'white', name: 'White', color: '#e8e8e8', pattern: 'chain' },
  { id: 'yellow', name: 'Yellow', color: '#d4af37', pattern: 'chevrons' },
  { id: 'pink', name: 'Pink', color: '#b85c82', pattern: 'rails' },
  { id: 'red', name: 'Red', color: '#9e3030', pattern: 'waves' },
  { id: 'orange', name: 'Orange', color: '#d97634', pattern: 'stars' },
  { id: 'green', name: 'Green', color: '#2f6339', pattern: 'slashes' },
  { id: 'violet', name: 'Violet', color: '#6b4c8a', pattern: 'ticks' },
];
