// gta6-meme-x-01 — "Post a GTA 6 meme on X" (make.fun, $500, top 50).
//
// What this program does (Node 22, standard library only, no network):
//   1. Renders the GTA 6 launch-week meme as a 1024x1024 PNG, drawn pixel by
//      pixel with the standard library alone (hand-rolled PNG encoder +
//      a 5x7 bitmap font). The joke: after 13 years of waiting for GTA 6,
//      the poster's AI agent is already getting paid on make.fun. The picture
//      carries make.fun twice — its ghost mascot, drawn in the scene over
//      Vice City at sunset, and the name "make.fun" in the bottom band.
//   2. Copies POST.json (the X post's address) from the repository root to
//      /output, where the gate reads it. That is the whole contract with
//      the house: the post itself is the entry, read from X by make.fun.
//
// Run it locally:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The grader runs it with /output as a mount point. This program NEVER
// deletes the output directory (or anything in it): it only creates the
// directory if missing and writes meme.png and POST.json into it.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------------------------------------------------------------- PNG out

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost pixel). Uppercase only;
// drawText uppercases its input. Written out by hand for this meme.

const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x1e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x0e, 0x10, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
  ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
};

// -------------------------------------------------------------- canvas

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mix(c0: RGB, c1: RGB, t: number): RGB {
  return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
}

// Deterministic pseudo-random for the skyline windows (same meme every run).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  readonly px: Buffer;
  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3, 0);
  }

  set(x: number, y: number, c: RGB): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const o = (yi * this.w + xi) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }

  fillRect(x: number, y: number, rw: number, rh: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + rw));
    const y1 = Math.min(this.h, Math.round(y + rh));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const o = (yy * this.w + xx) * 3;
        this.px[o] = c[0];
        this.px[o + 1] = c[1];
        this.px[o + 2] = c[2];
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: RGB): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  // Thick line drawn as discs along the segment.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c);
    }
  }

  // Scanline fill for a simple polygon.
  poly(points: [number, number][], c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
  }

  // Four-point sparkle (a diamond): make.fun's ghost has star eyes.
  star4(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const wdt = r - Math.abs(dy);
      for (let dx = -wdt; dx <= wdt; dx++) this.set(cx + dx, cy + dy, c);
    }
  }

  // Five-point star, for the badge the ghost holds.
  star5(cx: number, cy: number, rOuter: number, rInner: number, c: RGB): void {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    this.poly(pts, c);
  }

  vgrad(y0: number, y1: number, stops: [number, RGB][]): void {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      const t = (y - y0) / (y1 - y0);
      let c: RGB = stops[stops.length - 1][1];
      for (let s = 0; s + 1 < stops.length; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          const lt = (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
          c = mix(stops[s][1], stops[s + 1][1], lt);
          break;
        }
      }
      this.fillRect(0, y, this.w, 1, c);
    }
  }

  textWidth(text: string, scale: number): number {
    return text.length * 6 * scale - scale;
  }

  // Draws one line of text, centred on cx. Outline first, then the face.
  drawText(text: string, cx: number, y: number, scale: number, c: RGB, outline?: RGB): void {
    const s = text.toUpperCase();
    const wdt = this.textWidth(s, scale);
    const x0 = Math.round(cx - wdt / 2);
    const draw = (ox: number, oy: number, color: RGB) => {
      for (let i = 0; i < s.length; i++) {
        const glyph = FONT[s[i]] ?? FONT[' '];
        const gx = x0 + ox + i * 6 * scale;
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            if (glyph[row] & (1 << (4 - col))) {
              this.fillRect(gx + col * scale, y + oy + row * scale, scale, scale, color);
            }
          }
        }
      }
    };
    if (outline) {
      const o = Math.max(1, Math.round(scale / 3));
      draw(-o, 0, outline);
      draw(o, 0, outline);
      draw(0, -o, outline);
      draw(0, o, outline);
      draw(-o, -o, outline);
      draw(o, -o, outline);
      draw(-o, o, outline);
      draw(o, o, outline);
    }
    draw(0, 0, c);
  }
}

// ------------------------------------------------------------- the scene

const PURPLE: RGB = [27, 15, 59];
const MAGENTA: RGB = [255, 46, 136];
const PINK: RGB = [255, 94, 138];
const ORANGE: RGB = [255, 179, 71];
const SUN: RGB = [255, 215, 106];
const DARK: RGB = [26, 11, 46];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 6, 18];

function drawPalm(cv: Canvas, baseX: number, baseY: number, hgt: number, lean: number): void {
  // Curved trunk: a chain of discs along a quadratic bend.
  const topX = baseX + lean;
  const topY = baseY - hgt;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = baseX + (topX - baseX) * t * t + lean * 0.15 * Math.sin(t * Math.PI);
    const y = baseY - hgt * t;
    cv.disc(x, y, 9 - 4 * t, DARK);
  }
  // Fronds: five thick curves arcing out of the crown and drooping down.
  for (let k = 0; k < 5; k++) {
    const a = (-165 + k * 37.5) * (Math.PI / 180);
    const dirX = Math.cos(a);
    const dirY = Math.sin(a);
    const p1x = topX + dirX * 55;
    const p1y = topY + dirY * 40 - 18;
    const p2x = topX + dirX * 100;
    const p2y = topY + dirY * 55 + 62;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const mt = 1 - t;
      const x = mt * mt * topX + 2 * mt * t * p1x + t * t * p2x;
      const y = mt * mt * topY + 2 * mt * t * p1y + t * t * p2y;
      cv.disc(x, y, 7 - 4 * t, DARK);
    }
  }
  cv.disc(topX, topY, 12, DARK);
}

function drawSkyline(cv: Canvas, yBase: number): void {
  const rnd = mulberry32(1337);
  let x = -20;
  while (x < W + 20) {
    const bw = 60 + rnd() * 90;
    const bh = 90 + rnd() * 150;
    cv.fillRect(x, yBase - bh, bw, bh, DARK);
    // Lit windows, deterministic per building.
    for (let wy = yBase - bh + 14; wy < yBase - 16; wy += 26) {
      for (let wx = x + 10; wx < x + bw - 12; wx += 22) {
        if (rnd() < 0.42) cv.fillRect(wx, wy, 9, 12, SUN);
      }
    }
    x += bw + 8 + rnd() * 26;
  }
}

// make.fun's ghost: white body, black outline, four-point star eyes,
// wavy hem, holding a magenta badge with a white star — the mark from
// https://make.fun/press/ (mark-1024.png), redrawn in code.
function drawGhost(cv: Canvas, cx: number, topY: number, s: number): void {
  const body = (grow: number, c: RGB) => {
    const r = 105 * s + grow;
    // Rounded head.
    cv.disc(cx, topY + 105 * s, r, c);
    // Body down to the hem.
    cv.fillRect(cx - r, topY + 105 * s, r * 2, 205 * s, c);
    // Wavy hem: three bumps.
    for (let k = -1; k <= 1; k++) {
      cv.disc(cx + k * 70 * s, topY + 310 * s, 38 * s + grow, c);
    }
  };
  body(10, BLACK); // outline
  body(0, WHITE); // face
  // Star eyes.
  cv.star4(cx - 52 * s, topY + 118 * s, 26 * s, BLACK);
  cv.star4(cx + 52 * s, topY + 118 * s, 26 * s, BLACK);
  // Badge the ghost holds at its side: magenta disc, white star.
  const bx = cx + 118 * s;
  const by = topY + 235 * s;
  cv.disc(bx, by, 52 * s, BLACK);
  cv.disc(bx, by, 44 * s, MAGENTA);
  cv.star5(bx, by, 30 * s, 13 * s, WHITE);
}

function renderMeme(): Buffer {
  const cv = new Canvas(W, H);

  // Vice City sunset.
  cv.vgrad(0, 700, [
    [0, [43, 16, 89]],
    [0.45, [123, 47, 190]],
    [0.75, PINK],
    [1, ORANGE],
  ]);
  // Sun with a soft halo.
  cv.disc(512, 580, 190, [255, 150, 90]);
  cv.disc(512, 580, 160, [255, 190, 90]);
  cv.disc(512, 580, 132, SUN);
  // Skyline + palms over the sunset.
  drawSkyline(cv, 700);
  drawPalm(cv, 92, 712, 190, 46);
  drawPalm(cv, 950, 716, 165, -40);
  // Street.
  cv.fillRect(0, 700, W, 180, [36, 26, 51]);
  cv.fillRect(0, 700, W, 6, MAGENTA);
  // Lane dashes, widening toward the viewer.
  for (let i = 0; i < 5; i++) {
    const y = 736 + i * 30;
    const wdt = 26 + i * 12;
    cv.fillRect(512 - wdt / 2, y, wdt, 8, [255, 215, 106]);
  }
  // The ghost floats above the street, big and centre-right.
  cv.ellipse(640, 668, 150, 16, [0, 0, 0]);
  drawGhost(cv, 640, 268, 1.05);
  // Sparkles around the ghost.
  cv.star4(430, 330, 16, WHITE);
  cv.star4(880, 420, 13, SUN);
  cv.star4(480, 560, 11, WHITE);

  // Top joke, white on the purple sky with a black outline.
  cv.drawText('WAITED 13 YEARS', 512, 52, 9, WHITE, BLACK);
  cv.drawText('FOR GTA 6', 512, 138, 9, WHITE, BLACK);

  // Bottom band: the pitch, with make.fun named in pink.
  cv.fillRect(0, 880, W, 144, BLACK);
  cv.fillRect(0, 880, W, 6, MAGENTA);
  cv.drawText('MY AGENT MADE THIS MEME', 512, 906, 6, WHITE);
  const tail = 'AND GOT PAID ON ';
  const brand = 'MAKE.FUN';
  const tailW = cv.textWidth(tail, 6);
  const brandW = cv.textWidth(brand, 6);
  const xStart = 512 - (tailW + brandW) / 2;
  // drawText centres on cx, so centre each part on its own midpoint.
  cv.drawText(tail, xStart + tailW / 2, 962, 6, WHITE);
  cv.drawText(brand, xStart + tailW + brandW / 2, 962, 6, MAGENTA);

  return encodePng(W, H, cv.px);
}

// ------------------------------------------------------------------ main

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const postPath = join(BOT_DIR, 'POST.json');
  let postRaw: string;
  try {
    postRaw = readFileSync(postPath, 'utf8');
  } catch (err) {
    console.error(`POST.json could not be read from ${BOT_DIR}: ${(err as Error).message}`);
    process.exit(1);
  }
  let postUrl: unknown;
  try {
    postUrl = (JSON.parse(postRaw) as { url?: unknown }).url;
  } catch (err) {
    console.error(`POST.json is not valid JSON: ${(err as Error).message}`);
    process.exit(1);
  }
  if (typeof postUrl !== 'string' || !/^https:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\//.test(postUrl)) {
    console.error('POST.json holds no X post address yet — replace its placeholder with the post URL first.');
    process.exit(1);
  }

  const meme = renderMeme();
  writeFileSync(join(OUTPUT_DIR, 'meme.png'), meme);
  copyFileSync(postPath, join(OUTPUT_DIR, 'POST.json'));
  console.log(`wrote ${join(OUTPUT_DIR, 'meme.png')} (${meme.length} bytes)`);
  console.log(`wrote ${join(OUTPUT_DIR, 'POST.json')} (${postUrl})`);
}

main();
