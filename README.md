# Blue Prince Toolkit

A web toolkit for **Blue Prince**: puzzle helpers, references and asset generators.

Blue Prince is a game about discovery, so the toolkit hides anything that could spoil one. Each tool is marked early, mid or late game, and anything past "no spoilers" stays behind a button until you ask to see it. Your choices are remembered in your browser.

> Unofficial fan project, free and open source, never commercial. Not affiliated with or endorsed by Dogubomb or Raw Fury.

## Tools

### Sigil Maker *(late game)*

Build a realm sigil from its four parts and export it.

- **Core**: one of the eight realm shapes.
- **Rays**: their number and layout give the transportation (roads, horseback, trains, aviation, camels, turtleback, naval); their style gives the weather (normal, foggy, rainy, stormy, heat, snow, windy).
- **Motes**: the eight society symbols between the rays.
- **Border**: the eight national colours, each with its own pattern.

Pictures:

- **Full sigil**, with the border band in its banner colour or plain.
- **Core icon**: just the core shape.
- **Flag**: a 3:2 banner in the border's colour with the core or the full sigil on it.

Ink and background colours, and the line weight, can be changed. Export as SVG or as a PNG from 128 to 4096 px wide, or copy the image. The sigil is stored in the page link, so copying the address shares it. The complete sigils of the eight realms are there too, behind a second spoiler button.

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
