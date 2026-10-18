<img src="public/favicon.svg" alt="" width="72" height="72">

# Blue Prince Toolkit

A web toolkit for **Blue Prince**: puzzle helpers, references and asset generators.

Blue Prince is a game about discovery, so the toolkit hides anything that could spoil one. Each tool is marked early, mid or late game, and anything past "no spoilers" stays behind a button until you ask to see it. Your choices are remembered in your browser.

> Unofficial fan project, free and open source, never commercial. Not affiliated with or endorsed by Dogubomb or Raw Fury.

## Tools

### Darts Calculator *(early game)*

Copy the Billiard Room dartboard and the calculator writes it out as an equation, read left to right, in the colours of the sections.

- Colour sections with the add, subtract, multiply and divide tools, including the thin "third" strips. Click or drag to paint.
- Mark numbers on the outer ring: crossed out, two dots (double), slash (half) or diamond (reverse the digits).
- Set the bullseye's colour and shape, including a smaller shape drawn inside another.
- The working, ring by ring, and the answer each stay hidden until you click.
- Random practice boards at three levels, and a link that holds the board.

The solver reproduces the answer of every dartboard stored in the game except two whose data is inconsistent.

### Sigil Maker *(late game)*

Build a realm sigil from its four parts and export it.

- **Core**: one of the eight realm shapes.
- **Rays**: their number and layout give the transportation (roads, horseback, trains, aviation, camels, turtleback, naval); their style gives the weather (normal, foggy, rainy, stormy, heat, snow, windy).
- **Motes**: the eight society symbols between the rays.
- **Border**: the eight national colours, each with its own pattern.

Ink and background colours, the line weight and whether the border band is filled can be changed. Export as SVG or as a PNG from 128 to 4096 px wide, or copy the image. The sigil is stored in the page link, so copying the address shares it.

All the artwork is original. The cores and motes are vector traces of drawings made for this project, and the rays and borders are drawn in code.

## Development

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev      # local server with hot reload
npm run build    # type-check and build into dist/
```

`dist/` is a static site with relative paths, so it can be served from any folder (GitHub Pages included).

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
