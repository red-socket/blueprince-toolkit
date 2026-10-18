import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource-variable/inter';
import './styles/global.css';
import { TIER_LABEL } from './spoilers';
import { TOOLS } from './tools/registry';

/** The route is the part of the hash before any "?": "#/sigil?c=1" -> "sigil". */
function currentRoute(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}

function Home() {
  return (
    <>
      <section class="hero">
        <h1>Blue Prince Toolkit</h1>
        <p>
          Fan-made helpers, references and generators for the estate. Anything that could spoil a discovery stays
          hidden until you ask for it.
        </p>
      </section>
      <ul class="tool-list">
        {TOOLS.map((t) => (
          <li key={t.id}>
            <a class="tool-card panel" href={`#/${t.id}`}>
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

function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const tool = TOOLS.find((t) => t.id === route);
  useEffect(() => {
    document.title = tool ? `${tool.title} · Blue Prince Toolkit` : 'Blue Prince Toolkit';
    window.scrollTo(0, 0);
  }, [tool?.id]);

  const Page = tool?.component ?? Home;
  return (
    <>
      <header class="site-header">
        <div class="site-header__inner">
          <a class="site-header__brand" href="#/">
            <span class="site-header__mark" aria-hidden="true" />
            Blue Prince Toolkit
          </a>
        </div>
      </header>
      <main class="site-main">
        <Page />
      </main>
      <footer class="site-footer">
        <p>
          Unofficial fan project, free and open source. Not affiliated with or endorsed by Dogubomb or Raw Fury.{' '}
          <a href="https://github.com/red-socket/blueprince-toolkit">Source</a>
        </p>
      </footer>
    </>
  );
}

render(<App />, document.getElementById('app')!);
