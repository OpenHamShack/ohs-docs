// Logo composition: the mark and the outlined wordmark into each lockup's
// SVG text. Shared by render.mjs (files and PNGs) and preview.mjs.
//
// Lockups are built, not drawn, so the proportions below are the only place
// the relation between mark and wordmark is decided:
//  - the wordmark's cap height is just under half the mark's height, so the
//    name holds its own beside the mark (at the wall height it looked
//    timid: tried first, and the mark dominated);
//  - the wordmark's baseline sits on the mark's floor line;
//  - the gap between them is one wall-to-wall width of the shack.
import fs from 'node:fs';
import path from 'node:path';
import { BRAND, tokens } from './icons.mjs';

const SRC = path.join(BRAND, 'logo', 'src');
const WM = JSON.parse(fs.readFileSync(path.join(SRC, 'wordmark.json'), 'utf8'));
const inner = (f) => fs.readFileSync(path.join(SRC, f), 'utf8').match(/<g id="glyph"[^>]*>([\s\S]*?)<\/g>/)[1];
const MARK = inner('mark.svg'), MARK_SMALL = inner('mark-small.svg');

// Colourways. "on-dark"/"on-light" are the full-colour versions; mono is
// one ink for one-colour printing, embossing, a QSL card, a laser-etched
// panel - and Android's themed icons.
export const WAYS = {
  'on-dark':  { ink: tokens.color.dark.ink,  accent: tokens.color.dark['accent-fg'],  bg: tokens.color.dark.bg },
  'on-light': { ink: tokens.color.light.ink, accent: tokens.color.light['accent-fg'], bg: tokens.color.light.bg },
  'mono-white': { ink: '#ffffff', accent: '#ffffff', bg: tokens.color.dark.bg },
  'mono-black': { ink: '#000000', accent: '#000000', bg: '#ffffff' },
};

const paint = (s, w) => s
  .replace(/class="pf"/g, `fill="${w.accent}" stroke="none"`)
  .replace(/class="p"/g, `stroke="${w.accent}" fill="none"`)
  .replace(/class="s"/g, `stroke="${w.ink}" fill="none"`);

export function markGroup(w, { small = false } = {}) {
  return `<g stroke-width="${small ? 5 : 4}" stroke-linecap="round" stroke-linejoin="round" fill="none">${paint(small ? MARK_SMALL : MARK, w)}</g>`;
}

// The mark alone. Its viewBox is trimmed to the drawing plus stroke, so a
// consumer sizing it by height gets the drawing that height.
export const MARK_BOX = { x: 9.5, y: 2, w: 31.5, h: 43.5 };
export function mark(way = 'on-dark', { small = false } = {}) {
  const w = WAYS[way], b = MARK_BOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${b.w}" height="${b.h}" role="img" aria-label="${tokens.family}">${markGroup(w, { small })}</svg>`;
}

const FLOOR = 43 + 2;                              // the mark's floor line plus its stroke cap, from mark.svg
const CAP = 20;                                    // wordmark cap height, mark units
const K = CAP / WM.capHeight;                      // font units -> mark units
const WM_W = WM.advance * K;

function words(w, x, baseline) {
  const [open, rest] = WM.parts;
  return `<g transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${K.toFixed(6)})">` +
    `<path fill="${w.accent}" d="${open.d}"/><path fill="${w.ink}" d="${rest.d}"/></g>`;
}

export function wordmark(way = 'on-dark') {
  const w = WAYS[way];
  const top = -WM.yMax * K, h = (WM.yMax - WM.yMin) * K;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top.toFixed(2)} ${WM_W.toFixed(2)} ${h.toFixed(2)}" width="${WM_W.toFixed(1)}" height="${h.toFixed(1)}" role="img" aria-label="${tokens.family}">${words(w, 0, 0)}</svg>`;
}

const GAP = 22;                                    // one wall-to-wall width (34 - 12)

export function horizontal(way = 'on-dark') {
  const w = WAYS[way], b = MARK_BOX;
  // The box runs down to the p's descender, which hangs below the floor.
  const x0 = b.x, W = b.w + GAP * 0.55 + WM_W, H = Math.max(b.h, FLOOR - 2 - WM.yMin * K - b.y);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${b.y} ${W.toFixed(2)} ${H.toFixed(2)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" role="img" aria-label="${tokens.family}">` +
    markGroup(w) + words(w, b.x + b.w + GAP * 0.55, FLOOR - 2) + `</svg>`;
}

export function stacked(way = 'on-dark') {
  const w = WAYS[way], b = MARK_BOX;
  const W = Math.max(WM_W, b.w), cx = W / 2;
  const mx = cx - (b.x + b.w / 2), wmBase = b.h + GAP * 0.45 + CAP;
  const H = wmBase - WM.yMin * K;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" role="img" aria-label="${tokens.family}">` +
    `<g transform="translate(${mx.toFixed(2)} ${(-b.y).toFixed(2)})">${markGroup(w)}</g>` + words(w, cx - WM_W / 2, wmBase) + `</svg>`;
}

// TV launcher banner (Android TV / Fire TV: 320 x 180 dp, drawn at xhdpi
// 640 x 360). The launcher puts nothing over it, so the name has to be in
// it; a second line names the app when there is one.
export function banner(sub = '', { w = 320, h = 180 } = {}) {
  const way = WAYS['on-dark'], b = MARK_BOX;
  const app = tokens.app.platform;
  const scale = (w * 0.78) / (b.w + GAP * 0.55 + WM_W);
  const lockW = (b.w + GAP * 0.55 + WM_W) * scale;
  const ox = (w - lockW) / 2 - b.x * scale, oy = (sub ? h * 0.40 : h * 0.5) - (b.y + b.h / 2) * scale;
  let subText = '';
  if (sub) {
    // Outlined, like the wordmark, so the banner looks the same on every
    // device; the label's cap height is 0.8 of the wordmark's.
    const L = WM.labels[sub], k2 = (CAP * 0.8 / WM.capHeight) * scale;
    const lx = w / 2 - (L.advance * k2) / 2, ly = h * 0.40 + (b.h * scale) / 2 + h * 0.2;
    subText = `<path fill="${app.tint}" transform="translate(${lx.toFixed(2)} ${ly.toFixed(2)}) scale(${k2.toFixed(6)})" d="${L.d}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>` +
    `<linearGradient id="bn" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${app.tile}"/><stop offset="0.9" stop-color="${tokens.icon['tile-base']}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#bn)"/><g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${markGroup(way)}${words(way, b.x + b.w + GAP * 0.55, FLOOR - 2)}</g>${subText}</svg>`;
}
