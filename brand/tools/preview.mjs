// Write brand/preview.html: one self-contained page showing the whole kit.
//
//   node brand/tools/preview.mjs                 # write the page
//   node brand/tools/preview.mjs --shots DIR     # and screenshot it there
//
// The page is generated rather than hand-edited so that it cannot show a
// colour, ratio or icon the kit does not have: swatches come from
// tokens.json, ratios from contrast.json (both written by build_tokens.py),
// icons from the same composition code that renders the PNGs. Nothing in it
// is fetched: no fonts, no scripts, no images by URL.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BRAND, tokens, ids, tile, mono, adaptiveFg, adaptiveBg, tvos, INK_DARK, INK_LIGHT } from './icons.mjs';
import { mark, wordmark, horizontal, stacked, banner, MARK_BOX } from './logo.mjs';

const css = fs.readFileSync(path.join(BRAND, 'tokens', 'tokens.css'), 'utf8');
const contrast = JSON.parse(fs.readFileSync(path.join(BRAND, 'tokens', 'contrast.json'), 'utf8'));
const P = tokens.prefix;
const FAMILY = tokens.app.platform.name;
const C = tokens.color;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sized = (svg, w, h = w) => svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`);
const order = ['platform', 'remote', 'qo100-wb', 'qo100-nb', 'datv', 'atv', 'radio', 'icom', 'flex', 'digital-modes'].filter((i) => ids.includes(i));
const short = (id) => id === 'platform' ? 'Platform' : tokens.app[id].name.replace(FAMILY + ' ', '');
// Digit groups are separated by a gap drawn with margin, not a space
// character: a monospaced face makes even a thin space a full cell wide.
const F = (str) => str.split(' ').map((g, i) => i ? `<span class="fg">${g}</span>` : g).join('');
let gid = 0;
const T = (id, s, o = {}) => sized(tile(id, { gid: 'g' + gid++, small: s <= 32, ...o }), s);
const byH = (svg, h) => svg.replace(/width="([\d.]+)" height="([\d.]+)"/, (m, w, hh) => `width="${(w / hh * h).toFixed(1)}" height="${h}"`);

// A theme forced on a panel, independent of the page's own theme, so both
// palettes can be compared side by side whatever the viewer's OS says.
const forced = (t) => Object.entries(C[t]).map(([k, v]) => `--${P}-${k}:${v};`).join('');

const ratio = (pair) => contrast.pairs.find((r) => r.pair === pair);

function neutralPanel(t) {
  const rows = ['bg', 'surface', 'raised', 'line', 'ink', 'ink-dim', 'ink-faint'].map((k) =>
    `<div class="sw"><span class="chip" style="background:${C[t][k]}"></span><span class="k">${k}</span><code>${C[t][k]}</code></div>`).join('');
  return `<div class="panel theme-${t}"><div class="panel-h">${t === 'dark' ? 'Dark' : 'Light'}</div>${rows}</div>`;
}

const SEM = [
  ['tx', 'ON AIR', 'Transmit, PTT, the lease. The only red.'],
  ['rx', 'LOCKED', 'Receiver locked, decoding, link up.'],
  ['warn', 'UNLOCKED', 'Look at this: lease ending, tuner searching, PA hot.'],
  ['accent', 'LIVE', 'Brand signal cyan: selection, focus, links.'],
  ['carrier', 'BEACON', 'Secondary accent: markers, the beacon, highlights.'],
  ['info', 'INFO', 'Neutral notices and help.'],
];
function semanticPanel(t) {
  return `<div class="panel theme-${t}"><div class="panel-h">${t === 'dark' ? 'Dark' : 'Light'}</div>` + SEM.map(([k, label]) => {
    const f = ratio(`${k} on-fill`), g = ratio(`${k} on bg`);
    return `<div class="semrow"><span class="badge" style="background:var(--${P}-${k}-fill);color:var(--${P}-${k}-on-fill)">${k === 'tx' ? '<i class="dot"></i>' : ''}${label}</span>` +
      `<span class="semfg" style="color:var(--${P}-${k}-fg)">${k}</span>` +
      `<span class="ratio">${f[t].toFixed(1)}:1 fill · ${g[t].toFixed(1)}:1 text</span></div>`;
  }).join('') + '</div>';
}

function appColours() {
  return `<div class="apps">` + order.filter((i) => i !== 'remote').map((id) => {
    const a = tokens.app[id], r = contrast.apps.find((x) => x.app === id);
    return `<div class="appc"><div class="appc-top" style="background:linear-gradient(160deg,${a.tile},${tokens.icon['tile-base']} 85%)">` +
      `<span style="color:${a.tint}">${esc(short(id))}</span></div>` +
      `<div class="appc-b"><div><i style="background:${a.tint}"></i><code>${a.tint}</code> tint</div>` +
      `<div><i style="background:${a.shade}"></i><code>${a.shade}</code> shade</div>` +
      `<div class="dim">hue ${a.hue}° · ${r.tint_on_bg}:1 / ${r.shade_on_white}:1</div></div></div>`;
  }).join('') + '</div>';
}

function typeScale() {
  const s = tokens.scale.px;
  const rows = Object.keys(s.web).reverse().map((k) =>
    `<tr><td><code>${k}</code></td><td class="num">${s.web[k]}</td><td class="num">${s.touch[k]}</td><td class="num">${s.tv[k]}</td>` +
    `<td><span style="font-size:${s.web[k]}px;line-height:1.15">Tune 10 491.500</span></td></tr>`).join('');
  return `<table class="scale"><thead><tr><th>Step</th><th>Web</th><th>Touch</th><th>TV</th><th>At web size</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function iconGrid() {
  return `<div class="icons">` + order.map((id) =>
    `<figure>${T(id, 96)}<figcaption>${esc(short(id))}</figcaption></figure>`).join('') +
    `</div>`;
}

function ladder() {
  const sizes = [16, 20, 24, 32, 48, 64];
  return order.slice(0, 5).map((id) => `<div class="ladder">${sizes.map((s) => T(id, s)).join('')}` +
    `<span class="mono-pair"><span class="theme-light-bg">${sized(mono(id, INK_LIGHT), 28)}</span><span class="theme-dark-bg">${sized(mono(id, INK_DARK), 28)}</span></span></div>`).join('');
}

function masks(id) {
  const fg = adaptiveFg(id, tokens.app[id].tint, INK_DARK), bg = adaptiveBg(id);
  const layer = (shape, label) => `<figure><div class="mask ${shape}"><div class="lay">${sized(bg, 120)}</div><div class="lay">${sized(fg, 120)}</div></div><figcaption>${label}</figcaption></figure>`;
  return `<div class="masks">${layer('circle', 'Android, circle mask')}${layer('squircle', 'Android, squircle mask')}` +
    `<figure><div class="ios">${T(id, 120, { rounded: false })}</div><figcaption>iOS (system rounds)</figcaption></figure>` +
    `<figure><div class="tvos">${sized(tvos(id, 400, 240), 250, 150)}</div><figcaption>tvOS 400×240, focused</figcaption></figure>` +
    `<figure><div class="tab"><span class="fav">${T('platform', 16)}</span><span>${esc(FAMILY)}</span><span class="x">×</span></div><figcaption>Favicon at 16 px</figcaption></figure>` +
    `<figure><div class="tvos">${sized(banner('Remote'), 250, 140.6)}</div><figcaption>Android TV banner (Remote)</figcaption></figure></div>`;
}

// The two places colour decides safety: the box's touchscreen and a TV in
// a dark room. Both shown with real tokens, transmit and receive states.
function console_(t) {
  const tx = t === 'tx';
  return `<div class="console theme-dark">
  <div class="c-bar"><span class="c-app" style="color:var(--${P}-app-qo100-wb)">QO-100 WB</span><span class="c-call">GM4BRI · IO75RL</span>
   ${tx ? `<span class="badge big" style="background:var(--${P}-tx-fill);color:var(--${P}-tx-on-fill)"><i class="dot"></i>ON AIR</span>`
        : `<span class="badge big" style="background:var(--${P}-rx-fill);color:var(--${P}-rx-on-fill)">LOCKED</span>`}</div>
  <div class="c-main"><div><div class="c-l">${tx ? 'Transmit' : 'Receive'}</div><div class="freq">${F(tx ? '2 409.750' : '10 499.250')}<small> MHz</small></div>
   <div class="c-sub ${P}-num">${tx ? '333 kS · DVB-S2 QPSK 2/3' : '1500 kS · DVB-S2 QPSK 4/5'}</div></div>
   <div class="meter"><div class="m-l"><span>${tx ? 'PWR' : 'MER'}</span><span class="${P}-num">${tx ? '18.2 W' : '9.4 dB'}</span></div><div class="m-bar"><i style="width:${tx ? 72 : 63}%;background:var(--${P}-${tx ? 'tx' : 'rx'}-fg)"></i></div>
   <div class="m-l"><span>Lease</span><span class="${P}-num" style="color:var(--${P}-${tx ? 'warn-fg' : 'ink-dim'})">${tx ? '0:04' : '—'}</span></div></div></div>
  <div class="c-btns"><span class="btn sel">Tune</span><span class="btn">Beacon</span><span class="btn">Record</span><span class="btn ptt ${tx ? 'on' : ''}">${tx ? 'UNKEY' : 'PTT'}</span></div></div>`;
}

function tvRow() {
  return `<div class="tv theme-dark"><div class="tv-h">Shack · 4 apps running</div><div class="tv-row">` +
    ['qo100-wb', 'atv', 'icom', 'digital-modes'].map((id, i) => `<div class="tv-card${i === 0 ? ' focus' : ''}">${sized(tvos(id, 400, 240), 200, 120)}<div class="tv-n">${esc(short(id))}</div></div>`).join('') +
    `</div></div>`;
}


function logoSection() {
  const pair = (fn, h, cls = '') => `<div class="lk ${cls}"><div class="lk-d theme-dark">${byH(fn('on-dark'), h)}</div><div class="lk-l theme-light">${byH(fn('on-light'), h)}</div></div>`;
  const ladderM = [16, 20, 24, 32, 48, 64, 96].map((h) => `<span title="${h}px">${byH(mark('on-dark', { small: h <= 24 }), h)}</span>`).join('');
  // Clear space: the unit is the element's diameter (the dot at the end of
  // the aerial). Drawn, so the rule is seen rather than read.
  const hz = horizontal('on-dark'), dims = hz.match(/width="([\d.]+)" height="([\d.]+)"/);
  const u = 8.4, H = 110, k = H / parseFloat(dims[2]);
  const lw = parseFloat(dims[1]) * k;
  const pad = u * k * 2;
  const cs = `<div class="cs theme-dark" style="width:${(lw + pad * 2).toFixed(0)}px;height:${(H + pad * 2).toFixed(0)}px">` +
    `<div class="cs-in" style="inset:${pad.toFixed(0)}px"></div><div style="position:absolute;left:${pad.toFixed(0)}px;top:${pad.toFixed(0)}px;line-height:0">${byH(hz, H)}</div>` +
    `<span class="cs-u" style="left:0;top:${pad.toFixed(0)}px;width:${pad.toFixed(0)}px;height:${H}px">2u</span>` +
    `<span class="cs-u" style="left:${pad.toFixed(0)}px;top:0;height:${pad.toFixed(0)}px;width:${lw.toFixed(0)}px">2u</span></div>`;
  return `
  <h3>Lockups</h3>
  <div class="lockups">${pair(horizontal, 64)}${pair(stacked, 120)}</div>
  <div class="lockups three">
    <div class="lk"><div class="lk-d theme-dark">${byH(wordmark('on-dark'), 34)}</div><div class="lk-l theme-light">${byH(wordmark('on-light'), 34)}</div><div class="lk-cap">Wordmark alone</div></div>
    <div class="lk"><div class="lk-l" style="background:#fff">${byH(horizontal('mono-black'), 40)}</div><div class="lk-d" style="background:#000">${byH(horizontal('mono-white'), 40)}</div><div class="lk-cap">One colour</div></div>
    <div class="lk"><div class="lk-d theme-dark ladder-m">${ladderM}</div><div class="lk-cap">Mark, 16 to 96 px (heavier drawing at 24 px and below)</div></div>
  </div>
  <h3>Clear space and minimum size</h3>
  <div class="csrow">${cs}<div class="cs-notes">
    <p><b>u</b> is the diameter of the aerial's element, the dot. Keep <b>2u</b> clear on every side of a lockup, and <b>1u</b> round the mark alone.</p>
    <p>Minimum: horizontal lockup <b>120 px</b> wide (24 mm in print), stacked <b>64 px</b>, wordmark <b>80 px</b>. Below that use the mark: the small drawing from 24 px down to 16 px.</p>
    <p>Never: swap the two colours, set the name in another face, stretch, outline, add a shadow or glow, put the mark on a busy photo, or abbreviate the name to its initials.</p>
  </div></div>`;
}

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(FAMILY)} brand kit</title>
<meta name="description" content="Colour, type and icons for the ${esc(FAMILY)} family. Draft for approval.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(tile('platform', { gid: 'fav' }))}">
<style>
${css}
.theme-dark { ${forced('dark')} color-scheme: dark; }
.theme-light { ${forced('light')} color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--${P}-bg); color: var(--${P}-ink); font: 16px/1.5 var(--${P}-font-ui); -webkit-font-smoothing: antialiased; }
code, .num { font-family: var(--${P}-font-mono); font-size: 0.86em; font-variant-numeric: tabular-nums slashed-zero; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
header.top { border-bottom: 1px solid var(--${P}-line); background: var(--${P}-surface); position: sticky; top: 0; z-index: 5; }
header.top .wrap { display: flex; align-items: center; gap: 14px; height: 64px; }
.hdr-mark svg, .hdr-mark-l svg { display: block; }
.hdr-mark-l { display: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .hdr-mark { display: none; } :root:not([data-theme="dark"]) .hdr-mark-l { display: block; } }
:root[data-theme="light"] .hdr-mark { display: none; } :root[data-theme="light"] .hdr-mark-l { display: block; }
.lockups { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
.lockups.three { grid-template-columns: 1fr 1fr 1fr; margin-top: 16px; }
.lk { border: 1px solid var(--${P}-line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
.lk > div:not(.lk-cap) { flex: 1; display: grid; place-items: center; padding: 28px 16px; min-height: 96px; }
.lk-d { background: var(--${P}-bg); } .lk-l { background: var(--${P}-bg); }
.lk svg { max-width: 100%; height: auto; }
.lk-cap { font-size: 13px; color: var(--${P}-ink-dim); padding: 8px 12px; border-top: 1px solid var(--${P}-line); background: var(--${P}-surface); }
.ladder-m { display: flex !important; align-items: flex-end; justify-content: center; gap: 14px; flex-wrap: wrap; }
.ladder-m svg { display: block; height: auto; }
.csrow { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.cs { position: relative; border-radius: 12px; max-width: 100%; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--${P}-accent-fg) 16%, var(--${P}-bg)) 0 6px, var(--${P}-bg) 6px 12px); border: 1px solid var(--${P}-line); }
.cs-in { position: absolute; background: var(--${P}-bg); outline: 1px dashed color-mix(in srgb, var(--${P}-accent-fg) 60%, transparent); }
.cs-u { position: absolute; display: grid; place-items: center; font: 600 12px var(--${P}-font-mono); color: var(--${P}-accent-fg); }
.cs-notes { flex: 1; min-width: 260px; } .cs-notes p { margin: 0 0 10px; color: var(--${P}-ink-dim); font-size: 15px; } .cs-notes b { color: var(--${P}-ink); }
.brandname { font-weight: 650; font-size: 18px; letter-spacing: -0.01em; }
.brandname span { color: var(--${P}-ink-dim); font-weight: 450; margin-left: 6px; }
.seg { margin-left: auto; display: inline-flex; border: 1px solid var(--${P}-line); border-radius: 999px; padding: 3px; background: var(--${P}-bg); }
.seg button { font: inherit; font-size: 14px; border: 0; background: none; color: var(--${P}-ink-dim); padding: 5px 14px; border-radius: 999px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--${P}-surface); color: var(--${P}-ink); box-shadow: 0 1px 2px rgb(0 0 0 / .18); }
.seg button:focus-visible { outline: 2px solid var(--${P}-accent-fg); outline-offset: 1px; }
.hero { padding: 56px 0 24px; }
.eyebrow { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--${P}-accent-fg); font-weight: 600; }
h1 { text-wrap: balance; max-width: 22em; font-size: 40px; line-height: 1.1; letter-spacing: -0.02em; margin: 8px 0 12px; font-weight: 700; }
.lede { font-size: 18px; color: var(--${P}-ink-dim); max-width: 46em; margin: 0; }
section { padding: 40px 0; border-top: 1px solid var(--${P}-line); }
h2 { font-size: 24px; letter-spacing: -0.01em; margin: 6px 0 6px; }
h3 { font-size: 15px; margin: 28px 0 12px; color: var(--${P}-ink-dim); font-weight: 600; }
p.note { color: var(--${P}-ink-dim); max-width: 48em; margin: 0 0 8px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { background: var(--${P}-bg); color: var(--${P}-ink); border: 1px solid var(--${P}-line); border-radius: 14px; padding: 16px; }
.panel-h { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--${P}-ink-dim); margin-bottom: 10px; font-weight: 600; }
.sw { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 12px; padding: 5px 0; }
.sw .chip { width: 36px; height: 24px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgb(127 127 127 / .35); }
.sw code { color: var(--${P}-ink-dim); }
.semrow { display: grid; grid-template-columns: 128px 72px 1fr; align-items: center; gap: 12px; padding: 7px 0; }
.badge { display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 700; font-size: 13px; letter-spacing: .06em; padding: 5px 10px; border-radius: 6px; }
.badge .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.semfg { font-weight: 650; }
.ratio { font-size: 13px; color: var(--${P}-ink-dim); font-variant-numeric: tabular-nums; text-align: right; }
.apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 12px; }
.appc { border: 1px solid var(--${P}-line); border-radius: 12px; overflow: hidden; background: var(--${P}-surface); }
.appc-top { height: 64px; display: flex; align-items: flex-end; padding: 10px 12px; font-weight: 650; }
.appc-b { padding: 10px 12px; font-size: 13px; display: grid; gap: 4px; }
.appc-b i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; }
.dim { color: var(--${P}-ink-dim); }
.stack { background: var(--${P}-surface); border: 1px solid var(--${P}-line); border-radius: 12px; padding: 16px 18px; }
.stack + .stack { margin-top: 12px; }
.stack .lbl { font-size: 13px; color: var(--${P}-ink-dim); }
.stack .sample { font-size: 28px; margin: 4px 0 6px; }
.stack code { font-size: 12.5px; color: var(--${P}-ink-dim); word-break: break-word; }
table.scale { border-collapse: collapse; width: 100%; background: var(--${P}-surface); border: 1px solid var(--${P}-line); border-radius: 12px; overflow: hidden; }
table.scale th, table.scale td { text-align: left; padding: 8px 14px; border-bottom: 1px solid var(--${P}-line); vertical-align: middle; }
table.scale th { font-size: 13px; color: var(--${P}-ink-dim); font-weight: 600; }
table.scale tr:last-child td { border-bottom: 0; }
table.scale td.num { color: var(--${P}-ink-dim); }
.freqdemo { display: flex; gap: 12px 40px; flex-wrap: wrap; align-items: baseline; margin-top: 14px; }
.freqdemo .freq { font-size: 44px; }
.freq { font-family: var(--${P}-font-mono); font-variant-numeric: tabular-nums slashed-zero; font-weight: 600; letter-spacing: -0.02em; }
.freq .fg { margin-left: .28em; }
.freq small { font-size: .4em; font-weight: 500; color: var(--${P}-ink-dim); letter-spacing: 0; margin-left: 4px; }
.icons { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px 8px; }
figure { margin: 0; text-align: center; }
figcaption { font-size: 13px; color: var(--${P}-ink-dim); margin-top: 8px; }
.icons figure svg { display: block; margin: 0 auto; filter: drop-shadow(0 2px 6px rgb(0 0 0 / .25)); }
.ladder { display: flex; align-items: center; gap: 16px; padding: 6px 0; flex-wrap: wrap; }
.mono-pair { display: inline-flex; gap: 8px; margin-left: 12px; }
.mono-pair > span { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--${P}-line); }
.theme-light-bg { background: ${C.light.surface}; } .theme-dark-bg { background: ${C.dark.bg}; }
.masks { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
.mask { position: relative; width: 120px; height: 120px; overflow: hidden; }
.mask .lay { position: absolute; inset: 0; } .mask .lay svg { display: block; }
.mask.circle { border-radius: 50%; width: 92px; height: 92px; }
.mask.circle .lay { inset: -14px; }
.mask.squircle { border-radius: 30%; width: 92px; height: 92px; }
.mask.squircle .lay { inset: -14px; }
.ios svg { border-radius: 22.4%; width: 92px; height: 92px; display: block; }
.tvos svg { border-radius: 10px; display: block; box-shadow: 0 18px 30px rgb(0 0 0 / .45); transform: scale(1.04); }
.tab { display: inline-flex; align-items: center; gap: 8px; background: var(--${P}-surface); border: 1px solid var(--${P}-line); border-radius: 10px 10px 0 0; padding: 8px 12px; font-size: 13px; }
.tab .fav svg { display: block; }
.tab .x { color: var(--${P}-ink-faint); margin-left: 10px; }
.consoles { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.console { background: var(--${P}-bg); color: var(--${P}-ink); border-radius: 16px; border: 1px solid var(--${P}-line); overflow: hidden; }
.c-bar { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--${P}-surface); border-bottom: 1px solid var(--${P}-line); }
.c-app { font-weight: 700; } .c-call { color: var(--${P}-ink-dim); font-family: var(--${P}-font-mono); font-size: 14px; }
.badge.big { margin-left: auto; font-size: 14px; padding: 6px 12px; }
.c-main { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; padding: 18px 16px; align-items: center; }
.c-l { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--${P}-ink-dim); }
.console .freq { font-size: 40px; line-height: 1.1; white-space: nowrap; }
.c-sub { color: var(--${P}-ink-dim); font-size: 14px; margin-top: 4px; }
.meter { display: grid; gap: 8px; }
.m-l { display: flex; justify-content: space-between; font-size: 14px; color: var(--${P}-ink-dim); }
.m-l .${P}-num { color: var(--${P}-ink); }
.m-bar { height: 10px; border-radius: 5px; background: var(--${P}-raised); overflow: hidden; }
.m-bar i { display: block; height: 100%; border-radius: 5px; }
.c-btns { display: grid; grid-template-columns: repeat(3, 1fr) 1.3fr; gap: 10px; padding: 0 16px 16px; }
.btn { display: grid; place-items: center; height: 48px; border-radius: 10px; background: var(--${P}-raised); font-weight: 600; border: 1px solid var(--${P}-line); }
.btn.sel { background: var(--${P}-accent-fill); color: var(--${P}-accent-on-fill); border-color: transparent; }
.btn.ptt { border: 2px solid var(--${P}-tx-fg); color: var(--${P}-tx-fg); background: transparent; letter-spacing: .06em; }
.btn.ptt.on { background: var(--${P}-tx-fill); color: var(--${P}-tx-on-fill); border-color: var(--${P}-tx-fill); }
.tv { background: radial-gradient(120% 90% at 20% 0%, #121a24, var(--${P}-bg) 60%); border-radius: 16px; padding: 26px 28px 30px; border: 1px solid var(--${P}-line); margin-top: 16px; }
.tv-h { font-size: 20px; font-weight: 600; margin-bottom: 18px; color: var(--${P}-ink); }
.tv-row { display: flex; gap: 22px; flex-wrap: wrap; }
.tv-card svg { display: block; border-radius: 10px; }
.tv-card { border-radius: 12px; transition: transform .2s; }
.tv-card.focus svg { transform: scale(1.08); box-shadow: 0 0 0 3px var(--${P}-ink), 0 16px 32px rgb(0 0 0 / .6); }
.tv-card.focus .tv-n { margin-top: 16px; }
.tv-n { font-size: 15px; color: var(--${P}-ink-dim); margin-top: 10px; }
.tv-card.focus .tv-n { color: var(--${P}-ink); font-weight: 600; }
.rules { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.rule { background: var(--${P}-surface); border: 1px solid var(--${P}-line); border-radius: 12px; padding: 14px 16px; }
.rule b { display: block; margin-bottom: 4px; }
.rule p { margin: 0; color: var(--${P}-ink-dim); font-size: 14px; }
footer { padding: 32px 0 48px; color: var(--${P}-ink-faint); font-size: 13px; border-top: 1px solid var(--${P}-line); }
@media (max-width: 760px) {
  .wrap { padding: 0 16px; }
  .two, .consoles, .lockups, .lockups.three { grid-template-columns: 1fr; }
  .cs { zoom: .5; }
  .seg button { padding: 5px 9px; font-size: 13px; }
  header.top .wrap { gap: 10px; }
  .c-btns { grid-template-columns: repeat(2, 1fr); }
  .tv-row { gap: 14px; } .tv-card svg { width: 140px; height: 84px; }
  .icons { grid-template-columns: repeat(3, 1fr); }
  .c-call { display: none; } .c-app { white-space: nowrap; }
  .masks { gap: 18px; }
  table.scale td:last-child, table.scale th:last-child { display: none; }
  h1 { font-size: 30px; }
  .c-main { grid-template-columns: 1fr; }
  .semrow { grid-template-columns: 112px 1fr; } .semrow .ratio { grid-column: 1 / -1; text-align: left; }
  .brandname span { display: none; }
  .freqdemo .freq { font-size: 34px; }
}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <span class="hdr-mark">${byH(mark('on-dark'), 30)}</span><span class="hdr-mark-l">${byH(mark('on-light'), 30)}</span>
  <div class="brandname">${esc(FAMILY)}<span>brand kit · draft</span></div>
  <div class="seg" role="group" aria-label="Theme">
    <button data-t="auto" aria-pressed="true">Auto</button><button data-t="light" aria-pressed="false">Light</button><button data-t="dark" aria-pressed="false">Dark</button>
  </div>
</div></header>
<main class="wrap">
<div class="hero">
  <div class="eyebrow">Draft for approval · ${new Date().toISOString().slice(0, 10).split('-').reverse().join('/')}</div>
  <h1>From a 16 px browser tab to a TV across the room</h1>
  <p class="lede">Colour, type and icons for the ${esc(FAMILY)} platform, its apps and ${esc(tokens.app.remote.name)}. Everything on this page is generated from the token and glyph sources in <code>brand/</code>; nothing is fetched.</p>
</div>

<section id="mark">
  <div class="eyebrow">01</div><h2>Mark and wordmark</h2>
  <p class="note">A shack whose roofline carries on past the ridge as an aerial, aimed up and right with its element at the end. The open floor is the open in the name. The aerial makes the same gesture as the dish and the Yagi in the app icons, so the mark and the apps read as one family. The wordmark is outlined from Lato (SIL OFL): <span style="font-weight:500">Open</span> in Medium, <b>HamShack</b> in Heavy, so the name still parses in one colour.</p>
  ${logoSection()}
</section>

<section id="colour">
  <div class="eyebrow">02</div><h2>Colour</h2>
  <p class="note">A cool slate neutral, the signal cyan the NB and ATV products already use, and red kept for transmit alone. Dark is near-black and ink is off-white so a TV in a dark room does not glare.</p>
  <h3>Neutrals</h3><div class="two">${neutralPanel('light')}${neutralPanel('dark')}</div>
  <h3>Status</h3><div class="two">${semanticPanel('light')}${semanticPanel('dark')}</div>
  <h3>Per app</h3>
  <p class="note">One hue per app at a fixed perceptual lightness, so none is louder than another. <b>Tint</b> is the app's colour on dark grounds; <b>shade</b> is its colour as text on light ones. Ratios: tint on the dark background / shade on white.</p>
  ${appColours()}
</section>

<section id="type">
  <div class="eyebrow">03</div><h2>Type</h2>
  <p class="note">System faces only: each device's own UI font, then the faces a Debian box actually has. No font is fetched or bundled, because a station may have no route out.</p>
  <div class="stack"><div class="lbl">Interface · <code>--${P}-font-ui</code></div><div class="sample" style="font-family:var(--${P}-font-ui)">Receiving the beacon on 10 491.500</div><code>${esc(tokens.font.ui)}</code></div>
  <div class="stack"><div class="lbl">Frequencies, callsigns, locators · <code>--${P}-font-mono</code></div><div class="sample freq" style="font-weight:500">GM4BRI&nbsp; IO75RL&nbsp; ${F('10 489.750 000')}</div><code>${esc(tokens.font.mono)}</code></div>
  <h3>Frequencies</h3>
  <p class="note">Megahertz, digits grouped in threes with a thin space, tabular figures and a slashed zero. The digits never shift as they change.</p>
  <div class="freqdemo"><span class="freq">${F('10 489.750')}<small>MHz</small></span><span class="freq">${F('144.174 000')}<small>MHz</small></span><span class="freq" style="color:var(--${P}-tx-fg)">${F('2 403.250')}<small>MHz TX</small></span></div>
  <h3>Scale · ratio ${tokens.scale.ratio}, per-surface base</h3>${typeScale()}
</section>

<section id="icons">
  <div class="eyebrow">04</div><h2>App icons</h2>
  <p class="note">One glyph per app on a 48-unit grid: live area 32, stroke 3, round ends, on the shared dark tile. Antenna lower left says how the signal arrives (dish for QO-100, Yagi for terrestrial); the shape upper right says what it is (flat-topped digital carrier, narrow carriers, analogue sine). Rig apps show the radio's face.</p>
  ${iconGrid()}
  <h3>Sizes, and mono for single-colour contexts</h3>${ladder()}
  <h3>On each platform</h3>${masks('qo100-wb')}
</section>

<section id="use">
  <div class="eyebrow">05</div><h2>In use</h2>
  <p class="note">The box's touchscreen and a TV are where colour decides safety. Receive locked on the left, transmitting on the right: the red appears only when the station is on air.</p>
  <div class="consoles">${console_('rx')}${console_('tx')}</div>
  ${tvRow()}
</section>

<section id="rules">
  <div class="eyebrow">06</div><h2>Rules of thumb</h2>
  <div class="rules">
    <div class="rule"><b>Red means transmit</b><p>Never use the tx colour for errors, deletes or decoration. An error is warn or ink.</p></div>
    <div class="rule"><b>Colour plus words</b><p>Every state also says itself: ON AIR, LOCKED. Colour alone fails for colour-blind operators and on a washed-out TV.</p></div>
    <div class="rule"><b>Digits don't move</b><p>Frequencies, meters and timers use the mono stack or tabular figures.</p></div>
    <div class="rule"><b>Tokens, not hex</b><p>Use <code>--${P}-*</code>, <code>@color/${P}_*</code> or <code>${P[0].toUpperCase() + P.slice(1)}.*</code>. A hex value in product code is a bug.</p></div>
  </div>
</section>
</main>
<footer><div class="wrap">Generated by <code>brand/tools/preview.mjs</code> from <code>tokens.json</code>, <code>contrast.json</code> and <code>icons/src/</code>.</div></footer>
<script>
// Theme override: auto follows the OS; light/dark pin it via data-theme,
// remembered per viewer where storage works.
(function () {
  var root = document.documentElement, btns = document.querySelectorAll('.seg button');
  function set(t) {
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === t)); });
    try { localStorage.setItem('brand-theme', t); } catch (e) {}
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.t); }); });
  try { var s = localStorage.getItem('brand-theme'); if (s) set(s); } catch (e) {}
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(BRAND, 'preview.html'), html);
console.log('wrote preview.html', (html.length / 1024).toFixed(0) + ' KiB');

const si = process.argv.indexOf('--shots');
if (si > 0) {
  const dir = process.argv[si + 1];
  const PW = process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), 'openhamshack/node_modules/playwright-core/index.mjs');
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium' });
  for (const [name, scheme, w] of [['light', 'light', 1280], ['dark', 'dark', 1280], ['mobile-dark', 'dark', 390]]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
    await page.goto('file://' + path.join(BRAND, 'preview.html'));
    await page.screenshot({ path: path.join(dir, `brand-${name}.png`), fullPage: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (over) console.log(`WARNING: ${name} scrolls horizontally`);
    await page.close();
  }
  await browser.close();
  console.log('screenshots in', dir);
}
