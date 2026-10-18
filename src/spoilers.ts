// Spoiler gating. Every tool and every spoiler block has a tier; nothing above "none" is
// shown until the visitor asks for it. Choices are remembered per browser.

import { useEffect, useState } from 'preact/hooks';

export type Tier = 'none' | 'early' | 'mid' | 'late';

export const TIER_LABEL: Record<Tier, string> = {
  none: 'No spoilers',
  early: 'Early game',
  mid: 'Mid game',
  late: 'Late game',
};

const KEY = 'bpt.revealed';
const EVENT = 'bpt-reveal';

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function save(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // Storage blocked: the reveal lasts for this page view only.
  }
}

// Fallback for when storage is blocked, so reveals still reach every component on the page.
const session = new Set<string>();

function isRevealed(id: string): boolean {
  return session.has(id) || load().has(id);
}

/**
 * Whether the spoiler block `id` has been revealed, and a setter that remembers the choice.
 * Every component using the same id updates together.
 */
export function useReveal(id: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => isRevealed(id));
  useEffect(() => {
    const sync = () => setOn(isRevealed(id));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [id]);
  return [
    on,
    (v: boolean) => {
      const s = load();
      if (v) {
        s.add(id);
        session.add(id);
      } else {
        s.delete(id);
        session.delete(id);
      }
      save(s);
      window.dispatchEvent(new Event(EVENT));
    },
  ];
}
