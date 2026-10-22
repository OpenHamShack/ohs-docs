// Render every icon output from the SVG glyph masters.
//
//   node brand/tools/render.mjs            # SVG variants + all PNGs
//   node brand/tools/render.mjs --sheet F  # also a contact sheet PNG at F
//
// Why a browser: this host has no rsvg-convert, cairosvg or Inkscape, and
// installing one means a network fetch. Chromium is already here, and its
// SVG renderer is the one the preview page and the websites use, so a PNG
// cannot disagree with what the page shows. Playwright drives it; it is
// found in ~/openhamshack/node_modules unless PLAYWRIGHT_CORE says otherwise, and
// the browser at /usr/bin/chromium unless CHROMIUM does.
//
// The glyph masters (brand/icons/src/*.svg) hold geometry only. Colours come
// from brand/tokens/tokens.json (run build_tokens.py first), so an app's
// colour changes in one place and every output follows.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.resolve(HERE, '..');
const OUT = path.join(BRAND, 'icons');
const PW = process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), 'openhamshack/node_modules/playwright-core/index.mjs');
const { chromium } = await import(PW);
import { tokens, INK_DARK, INK_LIGHT, BASE, ids, tile, mono, adaptiveFg, adaptiveBg, tvos } from './icons.mjs';
import { WAYS, mark, wordmark, horizontal, stacked, banner } from './logo.mjs';

// ------------------------------------------------------------ rendering

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium' });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg, w, h, file, { opaque = false } = {}) {
  const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${opaque ? BASE : 'transparent'}">${sized}</body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: !opaque, clip: { x: 0, y: 0, width: w, height: h } });
  return fs.readFileSync(file);
}

// A .ico is a directory of PNGs; every browser and Windows since Vista read
// PNG entries, so there is nothing to gain from BMP ones.
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(([size, buf], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(([, b]) => b)]);
}

const write = (rel, text) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text + '\n'); };

const MIPMAP = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const id of ids) {
  const app = tokens.app[id];
  write(`svg/${id}.svg`, tile(id));
  write(`svg/${id}-square.svg`, tile(id, { rounded: false }));
  write(`svg/${id}-mono-on-dark.svg`, mono(id, INK_DARK));
  write(`svg/${id}-mono-on-light.svg`, mono(id, INK_LIGHT));
  write(`android/${id}/ic_launcher_foreground.svg`, adaptiveFg(id, app.tint, INK_DARK));
  write(`android/${id}/ic_launcher_background.svg`, adaptiveBg(id));
  write(`android/${id}/ic_launcher_monochrome.svg`, adaptiveFg(id, '#ffffff', '#ffffff'));

  const P = (rel) => path.join(OUT, 'png', id, rel);
  const sizes = {};
  for (const s of [16, 32, 48, 64, 128, 256, 512]) sizes[s] = await png(tile(id, { small: s <= 32 }), s, s, P(`${id}-${s}.png`));
  fs.writeFileSync(P(`${id}.ico`), ico([16, 32, 48, 256].map((s) => [s, sizes[s]])));
  await png(tile(id), 180, 180, P('apple-touch-icon-180.png'));
  // App Store / iOS: 1024 opaque, square; the system rounds it.
  await png(tile(id, { rounded: false }), 1024, 1024, P('ios-1024.png'), { opaque: true });
  await png(tvos(id, 1280, 768), 1280, 768, P('tvos-1280x768.png'), { opaque: true });
  await png(tvos(id, 400, 240), 400, 240, P('tvos-400x240.png'), { opaque: true });
  for (const [d, s] of Object.entries(MIPMAP)) await png(tile(id, { small: s <= 32 }), s, s, P(`android/mipmap-${d}/ic_launcher.png`));
  for (const [n, svg] of [['foreground', adaptiveFg(id, app.tint, INK_DARK)], ['background', adaptiveBg(id)], ['monochrome', adaptiveFg(id, '#ffffff', '#ffffff')]])
    await png(svg, 432, 432, P(`android/ic_launcher_${n}-432.png`), { opaque: n === 'background' });
  process.stdout.write(id + ' ');
}

// ------------------------------------------------------------ logo

const LOGO = path.join(BRAND, 'logo');
const writeLogo = (rel, text) => { const f = path.join(LOGO, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text + '\n'); };
for (const way of Object.keys(WAYS)) {
  writeLogo(`svg/mark-${way}.svg`, mark(way));
  writeLogo(`svg/mark-small-${way}.svg`, mark(way, { small: true }));
  writeLogo(`svg/wordmark-${way}.svg`, wordmark(way));
  writeLogo(`svg/lockup-horizontal-${way}.svg`, horizontal(way));
  writeLogo(`svg/lockup-stacked-${way}.svg`, stacked(way));
}
// Raster lockups for places that will not take SVG (forum avatars, QSL
// printers, slide decks): transparent, at a height that prints well.
async function pngByHeight(svg, h, file) {
  const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  const w = Math.round((parseFloat(m[1]) / parseFloat(m[2])) * h);
  return png(svg, w, h, file);
}
for (const way of ['on-dark', 'on-light']) {
  await pngByHeight(horizontal(way), 256, path.join(LOGO, 'png', `lockup-horizontal-${way}-256h.png`));
  await pngByHeight(stacked(way), 512, path.join(LOGO, 'png', `lockup-stacked-${way}-512h.png`));
  await pngByHeight(mark(way), 512, path.join(LOGO, 'png', `mark-${way}-512h.png`));
}

// TV banners. Only the Remote is a TV app today; the platform's is there
// for a future TV-side install. Android TV wants 320x180 dp; xhdpi is 2x.
for (const [id, sub] of [['remote', 'Remote'], ['platform', '']]) {
  const d = path.join(OUT, 'png', id);
  await png(banner(sub), 320, 180, path.join(d, 'tv-banner-320x180.png'), { opaque: true });
  await png(banner(sub, { w: 640, h: 360 }), 640, 360, path.join(d, 'android', 'drawable-xhdpi', 'tv_banner.png'), { opaque: true });
  write(`svg/${id}-tv-banner.svg`, banner(sub));
}

// The website favicon set, from the platform tile. The maskable PNG keeps
// the glyph inside the 80% safe circle a PWA install may crop to.
const FAV = path.join(BRAND, 'favicon');
fs.mkdirSync(FAV, { recursive: true });
fs.writeFileSync(path.join(FAV, 'favicon.svg'), tile('platform') + '\n');
const fv = {};
for (const s of [16, 32, 48]) fv[s] = await png(tile('platform', { small: s <= 32 }), s, s, path.join(FAV, `favicon-${s}.png`));
fs.writeFileSync(path.join(FAV, 'favicon.ico'), ico([16, 32, 48].map((s) => [s, fv[s]])));
await png(tile('platform', { rounded: false }), 180, 180, path.join(FAV, 'apple-touch-icon.png'), { opaque: true });
await png(tile('platform'), 192, 192, path.join(FAV, 'icon-192.png'));
await png(tile('platform'), 512, 512, path.join(FAV, 'icon-512.png'));
await png(tile('platform', { rounded: false }).replace('<g stroke-width', '<g transform="translate(4.8 4.8) scale(0.8)"><g stroke-width').replace('</g></svg>', '</g></g></svg>'), 512, 512, path.join(FAV, 'icon-maskable-512.png'), { opaque: true });
for (const f of fs.readdirSync(FAV)) if (/^favicon-\d+\.png$/.test(f)) fs.unlinkSync(path.join(FAV, f));

// The contact sheet: every icon at the sizes it must survive, on dark and
// light grounds, for a person to look at. Not committed.
const si = process.argv.indexOf('--sheet');
if (si > 0) {
  const sz = [16, 24, 32, 48, 64, 128];
  const row = (id, bg) => `<div style="display:flex;align-items:center;gap:18px;padding:8px 16px;background:${bg}">` +
    `<div style="width:120px;font:13px system-ui;color:${bg === '#fff' ? '#000' : '#ddd'}">${id}</div>` +
    sz.map((s) => tile(id, { gid: `x${id}${s}${bg.length}`, small: s <= 32 }).replace(/width="48" height="48"/, `width="${s}" height="${s}"`)).join('') +
    mono(id, bg === '#fff' ? INK_LIGHT : INK_DARK).replace(/width="48" height="48"/, 'width="32" height="32"') + '</div>';
  const html = `<div style="display:grid;grid-template-columns:1fr 1fr">${ids.map((id) => row(id, '#05080b') + row(id, '#fff')).join('')}</div>`;
  await page.setViewportSize({ width: 1300, height: 100 });
  await page.setContent(`<!doctype html><body style="margin:0">${html}</body>`);
  await page.screenshot({ path: process.argv[si + 1], fullPage: true });
}
await browser.close();
console.log('\ndone');
