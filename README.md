<img src="public/favicon.svg" alt="" width="72" height="72">

# Blue Prince Toolkit

A web toolkit for **Blue Prince**: puzzle helpers, references and asset generators.

Blue Prince is a game about discovery, so the toolkit hides anything that could spoil one. Each tool is marked early, mid or late game, and anything past "no spoilers" stays behind a button until you ask to see it. Your choices are remembered in your browser.

> Unofficial fan project, free and open source, never commercial. Not affiliated with or endorsed by Dogubomb or Raw Fury.

## Tools

### Run Tracker *(no spoilers)*

Keep count while you play, on a phone or a second screen: big counters for steps, gems, keys, coins and dice (plus any you add), a one-tap "Entered a room" button (one step, one room), undo, a low-steps warning, notes, and "New day", which files the day in a history (downloadable as CSV) and resets the counters to the start values you set. It can keep a phone's screen on. Everything is saved in your browser only.

### House Planner *(early game)*

Lay out a day's house on the 5 × 9 grid, with the Entrance Hall and Antechamber in place.

- Pick a room from the list (search, or filter by colour and shape) and click a square. The room turns to fit its neighbours; turn it with the buttons or R, move it by clicking an empty square, remove it with Delete.
- Each room shows its doors, colours and gem cost. Open doors, doors into a wall and rooms cut off from the Entrance Hall are marked.
- Totals: rooms drafted, gems spent, dead ends, open doors, rooms per colour, and whether the Antechamber is reached.
- Rooms that join the house later in the game are hidden behind two switches.
- Rooms are drawn with the game's own floor-plan cards (or plain tiles, if you switch the art off).
- The plan is saved in your browser and in the page link. Export it as a PNG or SVG.

The room list holds only facts from the game: names, gem costs, rarities, colours and door shapes.

### Room Card Maker *(no spoilers)*

Design your own room in the style of the game's floor-plan cards: name, colour, doors, gem cost, an icon, effect text with coloured words (`*WORD*`) and inline icons (`{coin}`, `{gem}`, `{key}`, `{steps}`…), and a floor (wood, tiles, carpet, stone, grass, marble, plain, or your own picture). Save it as a PNG up to 2048 px or copy it. The link holds the card, except an uploaded picture, which never leaves your device.

### Letter & Note Maker *(no spoilers)*

Write a letter, memo, note or notice on the estate's paper: a drawn double frame, a red letterhead and rule, an ornate first letter, handwriting, typewriter or printed text in five inks, a rubber stamp, hatched edges and worn paper. Save it as a PNG up to 2500 px wide or copy it; the link holds the document.

### Parlor Solver *(early game)*

Copy the statements on the three boxes, choosing each from a set of templates (where the gems are, what other statements or boxes say, counts of true and false statements, and more). The solver tries every combination against the game's rules and tells you which box holds the gems, or that the statements don't settle it. The answer and the reasoning each sit behind a button.

### Mora Jai Solver *(mid game)*

Paint a puzzle box's nine tiles and four corner symbols in any of the ten colours, then play it in the browser or let the solver find the shortest sequence of presses (in a background thread). Get the first press as a hint, then every press with a step-by-step view. The tile rules follow the in-game book and agree with joric's open-source solver.

### Darts Calculator *(early game)*

Copy the Billiard Room dartboard and the calculator writes it out as an equation, read left to right, in the colours of the sections.

- Colour sections with the add, subtract, multiply and divide tools, including the thin "third" strips. Click or drag to paint.
- Mark numbers on the outer ring: crossed out, two dots (double), slash (half) or diamond (reverse the digits).
- Set the bullseye's colour and shape, including a smaller shape drawn inside another.
- The working, ring by ring, and the answer each stay hidden until you click.
- Random practice boards at three levels, and a link that holds the board.

The solver reproduces the answer of every dartboard stored in the game except two whose data is inconsistent.

### Flag & Icon Maker *(late game)*

Put one of the eight realm cores on an icon (no background, circle, rounded square, square, shield or diamond) or on a flag (rectangle in four proportions, swallowtail, pennant or hanging banner; plain, border, band, halves, tricolour, cross or saltire), filled or outlined, in any colours. Export as SVG or PNG (icons from 16 to 1024 px). Each realm's own flag colours sit behind a second spoiler button.

### Sigil Maker *(late game)*

Build a realm sigil from its four parts and export it.

- **Core**: one of the eight realm shapes.
- **Rays**: their number and layout give the transportation (roads, horseback, trains, aviation, camels, turtleback, naval); their style gives the weather (normal, foggy, rainy, stormy, heat, snow, windy).
- **Motes**: the eight society symbols between the rays.
- **Border**: the eight national colours, each with its own pattern.

Ink and background colours, the line weight and whether the border band is filled can be changed. Export as SVG or as a PNG from 128 to 4096 px wide, or copy the image. The sigil is stored in the page link, so copying the address shares it.

The sigil artwork is original: the cores and motes are vector traces of drawings made for this project, and the rays and borders are drawn in code.

## Development

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev      # local server at http://localhost:5173/blueprince-toolkit/
npm run build    # type-check, build and pre-render into dist/
```

The site is built for GitHub Pages at `https://red-socket.github.io/blueprince-toolkit/`. Each tool has its own path (`/planner/`, `/darts/`…) with its state in the query string; old `#/…` links are redirected.

`npm run build` writes a real HTML page per tool, each with its own title, description, canonical URL, Open Graph and Twitter tags and intro text, plus `404.html`, `sitemap.xml` and `robots.txt`. Page texts live in `src/site/pages.json` and must stay spoiler-free. For a custom domain, build with `SITE_URL=https://example.com/ BASE_PATH=/ npm run build`.

Every push to `main` is built and published by `.github/workflows/deploy.yml`. Once per repository, set Settings → Pages → Source to **GitHub Actions**. For a custom domain, also add the repository variables `SITE_URL` and `BASE_PATH`.

The link-preview images in `public/og/` are drawn from `pages.json`. After changing a title or description, redraw them:

```bash
pip install pillow fonttools brotli
python3 tools/make_og_images.py
```

### Sigil artwork

The core and mote shapes come from the PNG drawings in `assets/sigil-src/`. After changing a drawing, regenerate the paths:

```bash
pip install potracer pillow numpy
python3 tools/trace_sigils.py
```

This rewrites `src/tools/sigil/paths.generated.ts`.

## License

Copyright © 2026 Lucas Pospor.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3. See [LICENSE](LICENSE).

The room floor-plan cards in `public/rooms/`, the card icons in `public/card-icons/` and the drawn frame, holly and ornate capitals in `public/docs/` are artwork from Blue Prince, © Dogubomb. They are not covered by the GPL and are used here, unmodified apart from cropping and resizing, for a free, non-commercial fan tool.
