#!/usr/bin/env python3
"""Draw the 1200x630 link-preview images (Open Graph / Twitter) into public/og/.

Usage: python3 tools/make_og_images.py
Needs: pip install pillow fonttools brotli, and `npm install` (the fonts come from node_modules).
Texts come from src/site/pages.json. Keep the pictures spoiler-free: nothing here may show puzzle content.
"""
import io
import json
import math
import pathlib

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'og'
PAGES = json.loads((ROOT / 'src/site/pages.json').read_text())
S = 2  # supersampling
W, H = 1200 * S, 630 * S

NAVY = (22, 41, 74)
SURFACE = (28, 51, 92)
CHALK = (230, 236, 246)
DIM = (169, 184, 210)
BRASS = (212, 175, 55)
TIER = {'early': ((121, 199, 154), 'Early game'), 'mid': ((230, 173, 85), 'Mid game'), 'late': ((236, 122, 111), 'Late game')}
CATEGORY = [(0, 147, 236), (154, 111, 207), (231, 143, 82), (82, 183, 79), (210, 190, 96), (194, 15, 0)]


def font(path, size, variation=None):
    """Loads a woff2 from node_modules (Pillow can't read woff2 itself)."""
    f = TTFont(ROOT / 'node_modules' / path)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    ft = ImageFont.truetype(buf, size * S)
    if variation:
        ft.set_variation_by_axes(variation)
    return ft


CINZEL = lambda size: font('@fontsource/cinzel/files/cinzel-latin-700-normal.woff2', size)
INTER = lambda size, w=500: font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', size, [w])
BARLOW = lambda size: font('@fontsource/barlow/files/barlow-latin-800-normal.woff2', size)


def wrap(d, text, ft, width):
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if d.textlength(test, font=ft) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def logo(d, x, y, size):
    """The site logo: a room tile with a door gap on each side and a crown."""
    k = size / 64
    P = lambda px, py: (x + px * k, y + py * k)
    d.rounded_rectangle([P(1, 1), P(63, 63)], radius=12 * k, fill=SURFACE)
    w = max(2, int(3 * k))
    for a, b in [((12, 12), (27, 12)), ((37, 12), (52, 12)), ((52, 12), (52, 27)), ((52, 37), (52, 52)),
                 ((52, 52), (37, 52)), ((27, 52), (12, 52)), ((12, 52), (12, 37)), ((12, 27), (12, 12))]:
        d.line([P(*a), P(*b)], fill=CHALK, width=w)
    d.polygon([P(20.5, 41), P(20.5, 27.5), P(26.5, 33), P(32, 24), P(37.5, 33), P(43.5, 27.5), P(43.5, 41)], fill=BRASS)
    d.rounded_rectangle([P(20.5, 43), P(43.5, 46.2)], radius=k, fill=BRASS)
    for cx, cy in [(20.5, 25.6), (32, 21.6), (43.5, 25.6)]:
        d.ellipse([P(cx - 2.4, cy - 2.4), P(cx + 2.4, cy + 2.4)], fill=BRASS)


def art_home(d, cx, cy, r):
    logo(d, cx - r, cy - r, 2 * r)


def art_planner(d, cx, cy, r):
    cell = 2 * r / 9
    x0, y0 = cx - cell * 2.5, cy - r
    filled = {(0, 2): 0, (1, 2): 0, (2, 2): 2, (2, 1): 4, (3, 2): 1, (4, 2): 3, (4, 3): 5, (5, 3): 0, (6, 3): 2, (6, 2): 1,
              (7, 2): 0, (8, 2): 0, (1, 1): 3, (2, 3): 0, (3, 1): 1}
    for rank in range(9):
        for col in range(5):
            x, y = x0 + col * cell, y0 + (8 - rank) * cell
            c = filled.get((rank, col))
            if c is None:
                d.rounded_rectangle([x + 4 * S, y + 4 * S, x + cell - 4 * S, y + cell - 4 * S], radius=4 * S, outline=(60, 82, 120), width=S)
            else:
                col_rgb = CATEGORY[c]
                fill = tuple(int(v * 0.35 + n * 0.65) for v, n in zip(col_rgb, SURFACE))
                d.rounded_rectangle([x + 4 * S, y + 4 * S, x + cell - 4 * S, y + cell - 4 * S], radius=4 * S, fill=fill)
                d.rectangle([x + 9 * S, y + cell - 13 * S, x + cell - 9 * S, y + cell - 9 * S], fill=col_rgb)
    d.rounded_rectangle([x0, y0, x0 + 5 * cell, y0 + 9 * cell], radius=6 * S, outline=(120, 140, 175), width=2 * S)


def wedge(d, cx, cy, r0, r1, a0, a1, fill):
    pts = []
    for k in range(13):
        a = math.radians(a0 + (a1 - a0) * k / 12 - 90)
        pts.append((cx + r1 * math.cos(a), cy + r1 * math.sin(a)))
    for k in range(12, -1, -1):
        a = math.radians(a0 + (a1 - a0) * k / 12 - 90)
        pts.append((cx + r0 * math.cos(a), cy + r0 * math.sin(a)))
    d.polygon(pts, fill=fill, outline=(20, 22, 27))


def art_darts(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 22, 27))
    rings = [(0.13, 0.42), (0.42, 0.52), (0.52, 0.76), (0.76, 0.86)]
    painted = {(0, 0): (118, 206, 229), (2, 5): (255, 245, 30), (1, 12): (180, 112, 151), (3, 15): (126, 105, 197), (0, 9): (118, 206, 229)}
    for ri, (a, b) in enumerate(rings):
        for i in range(20):
            base = [(37, 38, 43), (233, 223, 199)][i % 2] if ri in (0, 2) else [(59, 60, 67), (211, 198, 165)][i % 2]
            wedge(d, cx, cy, a * r, b * r, i * 18 - 9, i * 18 + 9, painted.get((ri, i), base))
    for i in range(20):
        wedge(d, cx, cy, 0.86 * r, 0.99 * r, i * 18 - 9, i * 18 + 9, (239, 231, 212))
    d.ellipse([cx - 0.13 * r, cy - 0.13 * r, cx + 0.13 * r, cy + 0.13 * r], fill=(178, 58, 50), outline=(20, 22, 27))


def art_cards(d, cx, cy, r):
    x0, y0, x1, y1 = cx - r, cy - r, cx + r, cy + r
    f = r * 0.12
    d.rectangle([x0, y0, x1, y1], fill=(0, 90, 138))
    d.rectangle([x0 + f, y0 + f, x1 - f, y1 - f], fill=(48, 36, 26))
    for k in range(int((2 * r - 2 * f) // (r * 0.12))):
        y = y0 + f + k * r * 0.12
        d.line([(x0 + f, y), (x1 - f, y)], fill=(70, 50, 34), width=2 * S)
    d.rectangle([x0 + f, y0 + f, x1 - f, y1 - f], outline=(5, 5, 5), width=3 * S)
    for (a, b, c, e) in [(cx - r * 0.17, y1 - f - 2, cx + r * 0.17, y1 + 1), (x0 - 1, cy - r * 0.17, x0 + f + 2, cy + r * 0.17),
                         (x1 - f - 2, cy - r * 0.17, x1 + 1, cy + r * 0.17)]:
        d.rectangle([a, b, c, e], fill=(0, 0, 0))
    ft = BARLOW(int(r / S * 0.3))
    for text, y, size in [('YOUR', cy - r * 0.32, ft), ('ROOM', cy + r * 0.0, ft)]:
        d.text((cx, y), text, font=size, anchor='mm', fill=(255, 255, 255), stroke_width=int(r * 0.05), stroke_fill=(16, 16, 16))


def art_sigil(d, cx, cy, r):
    # A plain ring with rays: the idea of a sigil, not any real one.
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BRASS, width=int(r * 0.07))
    for i in range(40):
        a = math.radians(i * 9)
        rr = r * 0.9
        d.ellipse([cx + rr * math.cos(a) - r * 0.03, cy + rr * math.sin(a) - r * 0.03, cx + rr * math.cos(a) + r * 0.03, cy + rr * math.sin(a) + r * 0.03], fill=CHALK)
    for i in range(8):
        a = math.radians(i * 45)
        d.line([(cx + r * 0.22 * math.cos(a), cy + r * 0.22 * math.sin(a)), (cx + r * 0.78 * math.cos(a), cy + r * 0.78 * math.sin(a))], fill=CHALK, width=int(r * 0.025))
    d.ellipse([cx - r * 0.14, cy - r * 0.14, cx + r * 0.14, cy + r * 0.14], outline=CHALK, width=int(r * 0.03))


ART = {'home': art_home, 'planner': art_planner, 'darts': art_darts, 'cards': art_cards, 'sigil': art_sigil}


def draw(name, title, text, tier=None):
    im = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(im)
    m = 36 * S
    d.rounded_rectangle([m, m, W - m, H - m], radius=10 * S, outline=(70, 92, 130), width=2 * S)
    for (x, y, dx, dy) in [(m, m, 1, 1), (W - m, H - m, -1, -1)]:
        d.line([(x, y), (x + dx * 40 * S, y)], fill=(150, 168, 200), width=3 * S)
        d.line([(x, y), (x, y + dy * 40 * S)], fill=(150, 168, 200), width=3 * S)

    left = 88 * S
    logo(d, left, 82 * S, 54 * S)
    d.text((left + 72 * S, 109 * S), 'BLUE PRINCE TOOLKIT', font=CINZEL(24), fill=CHALK, anchor='lm')

    tsize = 80
    while d.textlength(title, font=CINZEL(tsize)) > 640 * S and tsize > 48:
        tsize -= 4
    d.text((left, 250 * S), title, font=CINZEL(tsize), fill=CHALK, anchor='ls')
    y = 300 * S
    for line in wrap(d, text, INTER(28), 600 * S)[:5]:
        d.text((left, y), line, font=INTER(28), fill=DIM, anchor='la')
        y += 42 * S
    if tier in TIER:
        color, label = TIER[tier]
        ft = INTER(20, 650)
        tw = d.textlength(label.upper(), font=ft)
        d.rounded_rectangle([left, 520 * S, left + tw + 32 * S, 556 * S], radius=18 * S, outline=color, width=2 * S)
        d.text((left + 16 * S, 538 * S), label.upper(), font=ft, fill=color, anchor='lm')

    ART[name](d, 935 * S, 315 * S, 175 * S)
    OUT.mkdir(parents=True, exist_ok=True)
    im.resize((1200, 630), Image.LANCZOS).save(OUT / f'{name}.png', optimize=True)


def main():
    site = PAGES['site']
    draw('home', 'Blue Prince Toolkit', site['description'])
    for t in PAGES['tools']:
        draw(t['id'], t['title'], t['description'], t['tier'])
    print('wrote', ', '.join(sorted(p.name for p in OUT.glob('*.png'))))


if __name__ == '__main__':
    main()
