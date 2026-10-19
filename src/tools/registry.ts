import type { FunctionComponent } from 'preact';
import pages from '../site/pages.json';
import type { Tier } from '../spoilers';
import { CardMaker } from './cards/CardMaker';
import { DartsSolver } from './darts/DartsSolver';
import { FlagMaker } from './flags/FlagMaker';
import { LetterMaker } from './letters/LetterMaker';
import { MoraJai } from './morajai/MoraJai';
import { Parlor } from './parlor/Parlor';
import { Planner } from './planner/Planner';
import { SigilMaker } from './sigil/SigilMaker';
import { Tracker } from './tracker/Tracker';

export interface Tool {
  id: string; // route: /<id>/
  title: string;
  kind: string;
  /** Spoiler-free summary for the tool list. */
  blurb: string;
  tier: Tier;
  component: FunctionComponent;
}

// Titles and texts live in site/pages.json, which the build also uses for each page's HTML and meta tags.
const COMPONENTS: Record<string, FunctionComponent> = {
  planner: Planner,
  tracker: Tracker,
  cards: CardMaker,
  letters: LetterMaker,
  darts: DartsSolver,
  morajai: MoraJai,
  parlor: Parlor,
  sigil: SigilMaker,
  flags: FlagMaker,
};

export const TOOLS: Tool[] = pages.tools.map((t) => ({
  id: t.id,
  title: t.title,
  kind: t.kind,
  blurb: t.blurb,
  tier: t.tier as Tier,
  component: COMPONENTS[t.id],
}));

export const SITE = pages.site;
