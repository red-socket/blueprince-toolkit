import type { FunctionComponent } from 'preact';
import type { Tier } from '../spoilers';
import { DartsSolver } from './darts/DartsSolver';
import { SigilMaker } from './sigil/SigilMaker';

export interface Tool {
  id: string; // route: #/<id>
  title: string;
  kind: 'Generator' | 'Solver' | 'Reference' | 'Tracker';
  /** Spoiler-free summary for the tool list. */
  blurb: string;
  tier: Tier;
  component: FunctionComponent;
}

export const TOOLS: Tool[] = [
  {
    id: 'darts',
    title: 'Darts Calculator',
    kind: 'Solver',
    blurb: 'Copy the Billiard Room dartboard and get it written out as an equation, with the working and answer behind a click.',
    tier: 'early',
    component: DartsSolver,
  },
  {
    id: 'sigil',
    title: 'Sigil Maker',
    kind: 'Generator',
    blurb: 'Build a realm sigil from its parts and export it as an SVG or PNG.',
    tier: 'late',
    component: SigilMaker,
  },
];
