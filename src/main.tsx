import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource-variable/inter';
import './styles/global.css';
import { currentRoute, interceptLinks, onNavigate, pathFor, redirectHashLink } from './lib/route';
import { TIER_LABEL } from './spoilers';
import { SITE, TOOLS } from './tools/registry';

function Home() {
  return (
    <>
      <section class="hero">
        <h1>Blue Prince Toolkit</h1>
        <p>{SITE.intro}</p>
      </section>
      <ul class="tool-list">
        {TOOLS.map((t) => (
          <li key={t.id}>
            <a class="tool-card panel" href={pathFor(t.id)}>
              <span class="tool-card__kind label">{t.kind}</span>
              <span class={`tier tier--${t.tier}`}>{TIER_LABEL[t.tier]}</span>
              <h2>{t.title}</h2>
              <p>{t.blurb}</p>
            </a>
          </li>
        ))}
        <li>
          <div class="tool-card tool-card--soon">
            <span class="tool-card__kind label">Coming next</span>
            <h2>More tools</h2>
            <p>Puzzle helpers, a house planner and more generators are on the way.</p>
          </div>
        </li>
      </ul>
    </>
  );
}

function NotFound() {
  return (
    <section class="hero">
      <h1>Page not found</h1>
      <p>
        There's nothing at this address. <a href={pathFor('')}>Back to the toolkit</a>
      </p>
    </section>
  );
}

function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => onNavigate(() => setRoute(currentRoute())), []);

  const tool = TOOLS.find((t) => t.id === route);
  const missing = route !== '' && !tool;
  useEffect(() => {
    document.title = tool ? `${tool.title} · ${SITE.name}` : missing ? `Page not found · ${SITE.name}` : SITE.name;
    window.scrollTo(0, 0);
  }, [route]);

  const Page = tool?.component ?? (missing ? NotFound : Home);
  return (
    <>
      <header class="site-header">
        <div class="site-header__inner">
          <a class="site-header__brand" href={pathFor('')}>
            <img class="site-header__logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="30" height="30" />
            Blue Prince Toolkit
          </a>
        </div>
      </header>
      <main class="site-main">
        <Page />
      </main>
      <footer class="site-footer">
        <p>
          Unofficial fan project, free and open source. Not affiliated with or endorsed by Dogubomb or Raw Fury. Room art and icons © Dogubomb.{' '}
          <a href="https://github.com/red-socket/blueprince-toolkit">Source</a>
        </p>
      </footer>
    </>
  );
}

redirectHashLink();
interceptLinks();
// The build pre-renders each page's text for search engines and link previews; the app replaces it.
const root = document.getElementById('app')!;
root.textContent = '';
render(<App />, root);
