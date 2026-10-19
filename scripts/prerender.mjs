// After `vite build`: write one HTML file per page with its own title, description, canonical URL, Open Graph and
// Twitter tags and spoiler-free intro text, plus 404.html, sitemap.xml and robots.txt.
// Everything comes from src/site/pages.json. The app replaces the pre-rendered text when it starts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pages = JSON.parse(readFileSync(join(root, 'src/site/pages.json'), 'utf8'));
const SITE = (process.env.SITE_URL || pages.site.url).replace(/\/?$/, '/');
const BASE = (process.env.BASE_PATH || new URL(SITE).pathname).replace(/\/?$/, '/');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const TIER = { early: 'Early game', mid: 'Mid game', late: 'Late game' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function head({ title, description, url, image, alt, noindex }) {
  const tags = [
    `<link rel="canonical" href="${esc(url)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : '',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${esc(pages.site.name)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(alt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(alt)}" />`,
  ].filter(Boolean);
  return tags.map((t) => `    ${t}`).join('\n');
}

const frame = (main) =>
  `<header class="site-header"><div class="site-header__inner"><a class="site-header__brand" href="${BASE}">` +
  `<img class="site-header__logo" src="${BASE}favicon.svg" alt="" width="30" height="30" />Blue Prince Toolkit</a></div></header>` +
  `<main class="site-main">${main}</main>` +
  `<footer class="site-footer"><p>Unofficial fan project, free and open source. Not affiliated with or endorsed by Dogubomb or Raw Fury. ` +
  `Room art and icons © Dogubomb. <a href="https://github.com/red-socket/blueprince-toolkit">Source</a></p></footer>`;

function page({ title, description, url, image, alt, body, noindex }) {
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`)
    .replace('</head>', `${head({ title, description, url, image, alt, noindex })}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${frame(body)}</div>`);
}

function write(rel, html) {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// Home
const list = pages.tools
  .map(
    (t) =>
      `<li><a class="tool-card panel" href="${BASE}${t.id}/"><span class="tool-card__kind label">${esc(t.kind)}</span>` +
      (TIER[t.tier] ? `<span class="tier tier--${t.tier}">${TIER[t.tier]}</span>` : '<span class="tier tier--none">No spoilers</span>') +
      `<h2>${esc(t.title)}</h2><p>${esc(t.blurb)}</p></a></li>`,
  )
  .join('');
write(
  'index.html',
  page({
    title: pages.site.name,
    description: pages.site.description,
    url: SITE,
    image: `${SITE}og/home.png`,
    alt: 'Blue Prince Toolkit logo: a room tile with a crown',
    body: `<section class="hero"><h1>${esc(pages.site.name)}</h1><p>${esc(pages.site.intro)}</p></section><ul class="tool-list">${list}</ul>`,
  }),
);

// Tools
for (const t of pages.tools) {
  write(
    `${t.id}/index.html`,
    page({
      title: `${t.title} · ${pages.site.name}`,
      description: t.description,
      url: `${SITE}${t.id}/`,
      image: `${SITE}og/${t.id}.png`,
      alt: `${t.title}, a Blue Prince Toolkit tool`,
      body:
        `<header class="tool-head"><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></header>` +
        '<noscript><p>This tool needs JavaScript.</p></noscript>',
    }),
  );
}

// GitHub Pages serves 404.html for unknown paths.
write(
  '404.html',
  page({
    title: `Page not found · ${pages.site.name}`,
    description: pages.site.description,
    url: SITE,
    image: `${SITE}og/home.png`,
    alt: 'Blue Prince Toolkit logo: a room tile with a crown',
    noindex: true,
    body: `<section class="hero"><h1>Page not found</h1><p>There's nothing at this address. <a href="${BASE}">Back to the toolkit</a></p></section>`,
  }),
);

const today = new Date().toISOString().slice(0, 10);
const urls = [SITE, ...pages.tools.map((t) => `${SITE}${t.id}/`)];
writeFileSync(
  join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n',
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

console.log(`pre-rendered ${urls.length} pages + 404.html for ${SITE}`);
