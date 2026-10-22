// Icon composition: turns a glyph master into each variant's SVG text.
// Shared by render.mjs (PNG outputs) and preview.mjs (the preview page), so
// the page shows exactly what the renderer writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BRAND = path.resolve(HERE, '..');
export const SRC = path.join(BRAND, 'icons', 'src');
export const tokens = JSON.parse(fs.readFileSync(path.join(BRAND, 'tokens', 'tokens.json'), 'utf8'));
export const INK_DARK = tokens.color.dark.ink;     // glyph secondary on the dark tile
export const INK_LIGHT = tokens.color.light.ink;
export const BASE = tokens.icon['tile-base'];
export const RX = 10.5;                            // tile corner on the 48 grid (~22%, iOS-like)
export const ids = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).filter((id) => tokens.app[id]);


// <id>.small.svg, where it exists, is a heavier drawing for 32 px and down.
export function glyphOf(id, small = false) {
  const f = small && fs.existsSync(path.join(SRC, id + '.small.svg')) ? id + '.small.svg' : id + '.svg';
  const s = fs.readFileSync(path.join(SRC, f), 'utf8');
  const m = s.match(/<g id="glyph"([^>]*)>([\s\S]*?)<\/g>\s*<\/svg>/);
  if (!m) throw new Error(id + ': no <g id="glyph">');
  return `<g${m[1].replace(' id="glyph"', '')}>${m[2]}</g>`;
}

// Inline the colour roles as attributes. Outputs then carry no <style>, so
// they survive tools that ignore CSS (Android's vector import, some
// launchers, email clients).
export function paint(inner, p, s) {
  return inner
    .replace(/class="pf"/g, `fill="${p}" stroke="none"`)
    .replace(/class="sf"/g, `fill="${s}" stroke="none"`)
    .replace(/class="p"/g, `stroke="${p}" fill="none"`)
    .replace(/class="s"/g, `stroke="${s}" fill="none"`);
}

export const G = (inner) => `<g stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">${inner}</g>`;

export function gradient(gid, app) {
  return `<linearGradient id="${gid}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${app.tile}"/><stop offset="0.85" stop-color="${BASE}"/></linearGradient>`;
}

// The tile: a gradient from the app's deep tone to the shared base, the
// glyph, and a faint inner edge so a dark tile still has an edge on a dark
// launcher. rounded=false is the full-bleed square Apple wants (it masks).
export function tile(id, { rounded = true, gid = 't-' + id, small = false } = {}) {
  const app = tokens.app[id];
  const r = rounded ? RX : 0;
  const edge = rounded ? `<rect x="0.4" y="0.4" width="47.2" height="47.2" rx="${RX - 0.4}" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="0.8"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><defs>${gradient(gid, app)}</defs>` +
    `<rect width="48" height="48" rx="${r}" fill="url(#${gid})"/>${edge}${G(paint(glyphOf(id, small), app.tint, INK_DARK))}</svg>`;
}

export function mono(id, color, { small = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${G(paint(glyphOf(id, small), color, color))}</svg>`;
}

// Android adaptive layers are 108 x 108 dp, of which a 66 dp circle is
// always visible. The glyph's 32-unit live area is scaled to 56 dp so even
// its corners stay inside that circle under the roundest mask.
export const AD = { canvas: 108, live: 56 };
export function adaptiveFg(id, p, s) {
  const k = AD.live / 32, off = AD.canvas / 2 - 24 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108"><g transform="translate(${off} ${off}) scale(${k})">${G(paint(glyphOf(id), p, s))}</g></svg>`;
}
export function adaptiveBg(id, gid = 'a-' + id) {
  const app = tokens.app[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108"><defs>${gradient(gid, app)}</defs><rect width="108" height="108" fill="url(#${gid})"/></svg>`;
}

// tvOS app icons are landscape (400 x 240, 1280 x 768) and unmasked except
// for a small corner; Apple's parallax wants layers, but a flat image is
// accepted. The glyph sits a little high, as the focus lift draws a shadow
// beneath it.
export function tvos(id, w, h, gid = 'v-' + id) {
  const app = tokens.app[id];
  const k = (h * 0.62) / 32, ox = w / 2 - 24 * k, oy = h * 0.47 - 24 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>` +
    `<linearGradient id="${gid}" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${app.tile}"/><stop offset="0.9" stop-color="${BASE}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#${gid})"/><g transform="translate(${ox} ${oy}) scale(${k})">${G(paint(glyphOf(id), app.tint, INK_DARK))}</g></svg>`;
}

