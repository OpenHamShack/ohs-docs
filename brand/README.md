# OpenHamShack brand kit

Status: **draft for Brian's approval** (09/10/2026). Nothing here has been
applied to a product yet. Open [`preview.html`](preview.html) in a browser
to see everything on one page, with a light/dark switch.

Everything in this folder is generated from four sources, so a colour or
icon cannot drift between platforms:

| Source | What it decides | Generator |
|---|---|---|
| `tools/build_tokens.py` | colours, type stacks, scale, spacing, contrast | writes `tokens/` |
| `icons/src/*.svg` | each app's glyph (geometry only) | `tools/render.mjs` |
| `logo/src/mark.svg`, `mark-small.svg` | the mark | `tools/render.mjs` |
| `logo/src/wordmark.json` | the wordmark outlines (from Lato) | `tools/build_wordmark.py` |

## Regenerating

```
brand/tools/build.sh                 # tokens -> icons/logo/favicons -> preview.html
brand/tools/build.sh --shots DIR     # also screenshot the preview (light, dark, phone)
python3 brand/tools/build_wordmark.py  # only when changing the wordmark itself
```

- **Needs:** Python 3 (stdlib only for tokens), Node 20, Playwright-core and
  Chromium. No SVG rasteriser is installed on shack, so PNGs are rendered by
  the Chromium already there; Playwright is found in
  `~/openhamshack/node_modules` (override with `PLAYWRIGHT_CORE=`), the browser at
  `/usr/bin/chromium` (`CHROMIUM=`). Nothing is fetched.
- **Wordmark only:** `fontTools` (`python3-fonttools`) and the Debian
  `fonts-lato` package.
- `build_tokens.py --check` fails if any colour pair drops below its
  required contrast; `preview.mjs --shots` warns if the page scrolls
  sideways on a phone.

## The mark

A shack whose roofline carries on past the ridge as an aerial, aimed up and
right, with its element at the end. The open floor is the "open" in the
name. The aerial is the same up-and-right gesture as the dish and Yagi in
the app icons, so the platform and its apps read as one family. It
deliberately avoids radio shorthand (lightning, concentric waves from a
mast, a globe) and the clock-and-world-map look of OpenHamClock.

**Wordmark:** "Open" in Lato Medium, "HamShack" in Lato Heavy, outlined to
paths. The weight change keeps the name readable in one colour; in colour,
"Open" takes the accent. Always one word, CamelCase **OpenHamShack**.
**Never the initials OHS** (occupational health and safety) - not in the
brand, and not as a code prefix either: code uses `shack`.

Files in `logo/svg/`, each in four colourways:

| File | Use |
|---|---|
| `lockup-horizontal-*` | default: site headers, about screens, documents |
| `lockup-stacked-*` | square spaces: splash screens, stickers, a QSL card |
| `wordmark-*` | where the mark is already beside it (an app icon next to the title) |
| `mark-*` | above 24 px on its own |
| `mark-small-*` | 24 px and below: heavier strokes, larger element |

Colourways: `on-dark` and `on-light` (full colour), `mono-white`,
`mono-black` (one-colour printing, engraving, Android themed icons).
Raster copies for places that refuse SVG are in `logo/png/`.

### Clear space and minimum size

- **u** = the diameter of the element (the dot at the end of the aerial).
  Keep **2u** clear round a lockup and **1u** round the mark alone.
- Minimum: horizontal lockup **120 px** wide (24 mm in print), stacked
  **64 px** wide, wordmark **80 px**. Smaller than that, use the mark; from
  24 px down to 16 px use `mark-small`.

### Do / don't

- Do put the full-colour mark on `bg` or `surface` of either theme, or on an
  app tile. Do use mono where only one ink exists.
- Don't swap the two colours, set the name in another face, stretch or
  rotate it, add outlines, shadows or glow, place it on a busy photo,
  rebuild it from live text, or abbreviate it.
- Don't put the red transmit colour anywhere near the mark.

## Colour

Tokens are in `tokens/`: `tokens.css` (custom properties, prefix `--shack-`),
`tokens.json`, `android/values{,-night}/shack_colors.xml` (prefix
`shack_`), `apple/OpenHamShackColors.xcassets` plus
`OpenHamShackColors.swift` (`Shack.ink`, `Shack.txFill`, ...).

- **Neutrals** are a cool slate. Dark is `#0a0e13`, not black, and ink is
  `#e8eef5`, not white: on a TV in a dark room pure white on black halos,
  and OLED panels smear true black.
- **Accent** is the signal cyan the NB and ATV products already use
  (`#4fd1e8` on dark, a deeper `#00728f` on light to pass on white).
- **Status colours**, each with `-fg` (text/icons), `-fill` (badges,
  buttons) and `-on-fill` (text on the fill):

| Token | Means | Notes |
|---|---|---|
| `tx` | ON AIR, PTT, the transmit lease | **The only red.** Never errors, deletes or decoration. |
| `rx` | receiver locked, decoding, link up | |
| `warn` | look at this: lease ending, tuner searching, PA hot | an error is `warn` or ink, never `tx` |
| `accent` | selection, focus, links, live | |
| `carrier` | markers, the beacon, highlights | amber secondary |
| `info` | neutral notices, help | |

Every state is also written in words (ON AIR, LOCKED): colour alone fails
colour-blind operators and washed-out TVs.

- **Per-app colours** are one OKLCH hue each at a fixed lightness, so no
  app's icon shouts louder than another; red's hues are skipped. `tint` is
  for dark grounds, `shade` is text on light, `tile` is the icon tile's top.
  Platform and Remote share the brand cyan. A new app needs one hue in
  `build_tokens.py`.

### Contrast (WCAG 2, computed by `build_tokens.py`)

| Pair | Dark | Light | Needs |
|---|---|---|---|
| ink on bg | 16.6:1 | 16.6:1 | 7.0 |
| ink-dim on bg | 8.8:1 | 7.0:1 | 4.5 |
| accent on bg | 10.7:1 | 5.0:1 | 4.5 |
| carrier on bg | 11.0:1 | 5.2:1 | 4.5 |
| tx on bg | 6.9:1 | 6.0:1 | 4.5 |
| rx on bg | 10.8:1 | 5.6:1 | 4.5 |
| warn on bg | 12.1:1 | 5.5:1 | 4.5 |
| info on bg | 9.4:1 | 6.3:1 | 4.5 |
| ink on surface | 15.1:1 | 18.3:1 | 7.0 |
| accent on-fill | 10.4:1 | 5.5:1 | 4.5 |
| tx on-fill (white on red) | 5.2:1 | 5.7:1 | 4.5 |
| rx on-fill | 10.4:1 | 5.4:1 | 4.5 |
| warn on-fill | 11.4:1 | 11.4:1 | 4.5 |
| tx fill vs bg | 3.7:1 | 5.2:1 | 3.0 |

App tints are 7.6-8.0:1 on their tile and 10.5-11.7:1 on the dark
background; shades are 6.5-7.3:1 on white. Full table: `tokens/contrast.json`
or the script's output.

## Type

System faces only (house rule: no font fetched or vendored; a station may
have no route out). The wordmark is the one exception, and it ships as
outlines, not a font.

- **UI:** `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans",
  Ubuntu, Cantarell, "DejaVu Sans", sans-serif`
- **Mono** (frequencies, callsigns, locators, codes):
  `ui-monospace, "SF Mono", "Cascadia Mono", "Segoe UI Mono", "Roboto Mono",
  "Noto Sans Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace`
- **Numbers that change** (meters, timers, levels in UI text) use
  `font-variant-numeric: tabular-nums slashed-zero` (`.shack-num`), or
  `.monospacedDigit()` in SwiftUI, `fontFeatureSettings = "tnum"` on Android.
- **Frequencies:** MHz, digits grouped in threes, mono, e.g. `10 489.750`.
  Draw the group gap with spacing (CSS margin, a `SpanStyle` letter
  spacing), not a space character: monospaced faces make even a thin space
  a full cell wide.
- **Scale:** ratio 1.25, named steps `xs`...`4xl`, on a per-surface base:
  web/desktop 16 px, the box's touchscreen 22 px, TV 24 px (set
  `data-surface="touch"` or `"tv"` on the root to switch).

## Icons

`icons/src/` holds one glyph per app on a 48-unit grid: live area 32
(8-40), stroke 3, round caps and joins, two colour roles (app colour,
ink). Every tile is the same dark tile with a gradient from the app's deep
tone; the app colour rides on the glyph. The radio apps share a grammar:
**lower left is how the signal arrives** (dish = QO-100, Yagi =
terrestrial), **upper right is what the signal is** (flat-topped carrier =
digital TV, narrow carriers = NB, sine = analogue). Rig apps show the
radio's face (Radio: dial and knob; Icom: front panel; Flex: panadapter);
Digital Modes shows an FSK tone sequence on its time slots. `platform.small.svg`
is a heavier drawing used at 32 px and below.

Short names go *beside* icons, never inside them: "QO-100 WB", "Icom",
"Remote" under a TV tile or a launcher icon, as the platform and TV use.

Outputs (`icons/`):

| Path | For |
|---|---|
| `svg/<id>.svg`, `<id>-square.svg` | master tile; full-bleed square |
| `svg/<id>-mono-on-dark.svg`, `-mono-on-light.svg` | single-colour glyph |
| `android/<id>/ic_launcher_{foreground,background,monochrome}.svg` | adaptive icon layers (108 dp, glyph in the 66 dp safe circle); import to vector drawables |
| `png/<id>/android/mipmap-*/ic_launcher.png` | legacy launcher, mdpi-xxxhdpi |
| `png/<id>/android/ic_launcher_*-432.png` | adaptive layers as PNG (xxxhdpi) |
| `png/<id>/ios-1024.png` | App Store / iOS (opaque, square; iOS rounds it) |
| `png/<id>/tvos-1280x768.png`, `tvos-400x240.png` | Apple TV app icon, flat (Xcode accepts a single layer) |
| `png/<id>/<id>-16...512.png`, `<id>.ico`, `apple-touch-icon-180.png` | desktop apps, Dock360 catalogue, web |
| `png/remote/tv-banner-320x180.png`, `android/drawable-xhdpi/tv_banner.png` | Android TV / Fire TV banner |
| `../favicon/` | website set: `favicon.svg`, `.ico` (16/32/48), `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |

## Applying it (after approval - not done yet)

- **Websites** (`~/openhamshack/site`, NB, ATV sites): inline `tokens.css`
  (sites must work offline too), swap `--bg`/`--accent` etc. for the
  `--shack-*` names, header uses `lockup-horizontal-on-*` as inline SVG,
  favicon set from `favicon/`.
- **OpenHamShack platform UI** (Dock360 edition overlay, PLATFORM-PLAN D1):
  the edition's name, logo (`lockup-horizontal`, `mark` for the nav),
  favicon set and `tokens.css` go in the overlay; Dock360's own CSS
  variables map to `--shack-*`. Each app's catalogue image is its
  `png/<id>/<id>-256.png`. The box touchscreen sets `data-surface="touch"`
  and defaults to dark.
- **OpenHamShack Remote, Android** (`~/openhamshack-remote/android`): copy
  `tokens/android/values*/shack_colors.xml`; replace the mast launcher with
  `icons/android/remote/*` (adaptive + monochrome) and the banner with
  `png/remote/android/drawable-xhdpi/tv_banner.png`. Kinds' screens use
  `shack_app_<id>` for their accent. TV is always dark.
- **OpenHamShack Remote, Apple** (`~/openhamshack-remote/ios`): add
  `OpenHamShackColors.xcassets` and the Swift file to OpenHamShackKit (it uses
  `Bundle.module`, i.e. an SPM resource); app icon from `ios-1024.png`,
  Apple TV from the `tvos-*` PNGs.
- **Desktop apps** (PyQt6 NB/Radio/ATV, DATV): window icon and installer
  icon from `png/<id>/<id>.ico` / `-256.png`; Qt palette from
  `tokens.json`; mono stack for frequency readouts.

## Trademark and naming cautions

- **OpenHamShack:** the coordinator's prior-art check found no other
  product of that name; the neighbour **OpenHamClock** exists, and the mark
  was drawn not to resemble it (no clock, map or terminator). A proper UK
  IPO / EUIPO / USPTO search is still worth doing before printing anything.
  Note that "OpenHamShack", the old name, is used by unrelated products (a
  file-sharing service among them), which is one reason to move off it.
- **Icom** and **FlexRadio** are their makers' trademarks. "OpenHamShack
  Icom" and "OpenHamShack Flex" use them to say what radio the app works
  with (nominative use); never use either maker's logo, lettering or
  colours, and say "works with Icom IC-9700/7610/705" rather than implying
  endorsement. The glyphs are generic radio faces, not their products.
  WSJT-X likewise: "replaces WSJT-X" in prose is fine; never its icon.
- **Lato** (wordmark) is SIL OFL 1.1, which permits outlining it into a
  logo. No font file is shipped.
- The project is GPL; the brand assets are not code. Decide whether the
  mark is licensed with the code (anyone can use it on forks) or reserved
  (forks must rename). See open questions.

## Open questions for Brian

1. Approve the mark (shack + aerial) and wordmark, or ask for alternatives.
2. App hues - especially DATV (pink-violet) and ATV (gold): fine?
3. Licence for the logo: reserved for the official project (usual for GPL
   projects, e.g. "forks must not use the name or mark"), or free.
