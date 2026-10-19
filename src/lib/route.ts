// Path routing under Vite's base: /blueprince-toolkit/<tool>/?<tool state>.

export const BASE = import.meta.env.BASE_URL; // ends with "/"
const NAV = 'bpt-navigate';

/** URL path of a route ('' is the home page). */
export const pathFor = (route: string) => BASE + (route ? `${route}/` : '');

/** The first path segment after the base: "/blueprince-toolkit/sigil/" -> "sigil". */
export function currentRoute(): string {
  let p = location.pathname;
  p = p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\//, '');
  return p.replace(/index\.html$/, '').split('/')[0] ?? '';
}

export const query = () => new URLSearchParams(location.search);

/** Stores a tool's state in the query string without adding a history entry. */
export function setQuery(route: string, qs: string) {
  const url = pathFor(route) + (qs ? `?${qs}` : '');
  if (url !== location.pathname + location.search) history.replaceState(history.state, '', url);
}

export function navigate(url: string) {
  history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV));
}

/** Calls `cb` after client navigation and back/forward. Returns the unsubscribe function. */
export function onNavigate(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(NAV, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(NAV, cb);
  };
}

/** Old links used hash routes ("#/sigil?c=1"); turn them into paths. Returns true if it did. */
export function redirectHashLink(): boolean {
  if (!location.hash.startsWith('#/')) return false;
  const [route, qs] = location.hash.slice(2).split('?');
  history.replaceState(null, '', pathFor(route.replace(/\/+$/, '')) + (qs ? `?${qs}` : ''));
  return true;
}

/** Handles clicks on links inside the site without reloading the page. */
export function interceptLinks() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
    e.preventDefault();
    if (url.pathname + url.search !== location.pathname + location.search) navigate(url.pathname + url.search + url.hash);
  });
}
