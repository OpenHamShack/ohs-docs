# One waterfall, one launcher, screens from the box: the client UI plan

Status: **plan**, 28/10/2026, for Brian's decisions of the same day. Nothing
here is built. **[guess]** marks anything not read in code or a cited
source. Paths are `<repo> <path>:<line>`; repos live under `~`.

Brian's decisions this plan works from (28/10/2026):

1. **One shared waterfall** for every app (QO-100 NB, Radio, WB, Flex, Icom,
   DATV/ATV where relevant), implemented once per platform, fed by one
   spectrum stream contract plus an overlay feed. Android/Fire TV first.
   Labels "smart, by zoom": band segments and the dial always; active
   signals labelled when zoomed in enough to read; everything toggleable.
   **Replace straight away:** no old waterfall kept as a fallback.
2. **Server-driven UI:** the box describes each screen in JSON and one
   generic native renderer per platform draws it (Android/Fire TV, Apple
   TV/iOS). Bespoke views are native components the server places.
3. **One OpenHamShack app, with a launcher inside it** (Brian, same day):
   one icon per device; the in-app launcher is "home" for every OHS app;
   Back from an app returns to it; Back from it leaves (optionally after a
   "Leave OpenHamShack?" confirmation).

Brian's answers to this plan's decisions (28/10/2026, recorded in §13):
receive audio **stops** on going back to the launcher (no mini player);
when the last client leaves, the box **releases everything at once** (on
goodbye, or when the 30 s lease expires; no further grace); the separate
DAB Radio and Ships TV tiles are **retired** for a "Start in" setting;
"Leave OpenHamShack?" is **on by default everywhere**. Still open: the
web-view shell, QO-100 WB's source repo, and the Apple session.

Contents: 1 Where we are · 2 The spectrum stream contract · 3 The overlay
contract · 4 The rendering spec · 5 Server-driven UI · 6 The launcher and
navigation · 7 Client presence: freeing the radios · 8 The web-view option
· 9 Change checklist · 10 Migration, effort, owners · 11 Testing without a
fallback · 12 Risks · 13 Decisions for Brian.

---

## 1. Where we are

### 1.1 Every waterfall today: eight implementations, no shared code

| Where | Code | Drawing | Levels | Colour maps | Overlays |
|---|---|---|---|---|---|
| Desktop Qt (NB, Radio) | openhamshack-nb `ohscore/ui/scope.py`, `scopecore.py` | numpy ring in a `QImage` (RGB32), two `drawImage` blits; static layer cached to a `QPixmap` (`scopecore.py:144-221`, `scope.py:933-952`) | client auto: floor/median/99.7 % percentiles with an EMA, or manual Top/Range (`scope.py:994-1047`); waterfall floor 0.5 x spread under the lower quartile (`scope.py:1048-1073`) | Ember, Glacier, Classic, Phosphor, built in linear light (`palettes.py:19-50`) | band-plan strip from `Face.segments` (`scope.py:1218-1239`), beacons, band marks, alerts, passband, TX; captions dropped on overlap (`scope.py:1297-1300`, `1330-1348`); one "Show signal labels" switch (`scope.py:89-106`); two display styles incl. "SDR Console-like" (`scope.py:82-85`) |
| Desktop Qt (DATV, ATV) | openhamshack-datv `ohsdatv/ui/spectrum.py` (copied from ATV, which copied NB: `spectrum.py:3-9`) | Qt widget on a local FFT (`ohsdatv/rx/sdr.py:145-161`) | local dB | the same four maps (`ohsdatv/ui/palettes.py:1-27`) | plan strip by kind, tuner and planned-width markers (`spectrum.py:5-16`) |
| Remote Android, NB/Radio | openhamshack-remote `android/app/.../remote/shack/Scope.kt` | `IntArray` row scroll into a Bitmap on a Compose Canvas (`Scope.kt:55`) | floor = frame's 20th percentile, fixed 45 dB range (`Scope.kt:13-16, 68`) | radio-style and Brian's TV "polished" palette (`Scope.kt:90-119`) | bookmark ticks and one named label (`ScopeLabels.kt:14-52`); plan strip from the bundled dataset (REMOTE-CONTRACT §12d) |
| Remote Android, Flex | `shack/FlexScope.kt` | the same Bitmap path; rows resampled by frequency (`FlexScope.kt:13-21, 107-123`) | row's 20th percentile + `ROW_RANGE = 18` radio units (`FlexScope.kt:94-100`); ref steps 5 dB | shared `ScopeLook` palettes | `FlexPlanStrip` (`FlexScope.kt:282-297`) |
| Remote Android, Icom | `android/kind-stationflow/.../Waterfall.kt` | 0-255 ring coloured at draw time (`Waterfall.kt:83-94`) | row's 20th percentile | IC-9700's own order (`Waterfall.kt:106-123`) + six `ScopeLook` palettes (`core-candidates .../core/scope/ScopeLook.kt:17`) | dial line only (`kind-stationflow .../ui/Scope.kt:121-127`) |
| Remote Android, QO-100 WB | `ui/Qo100Graph.kt` | Bitmap per frame, `FilterQuality.None` (`Qo100Graph.kt:186-189`) | fixed-ish `-2..max+1` (`Qo100Graph.kt:91-92`) | the console's LUT | plan shading, signal boxes with 3-try label placement, TX/RX marks (`Qo100Graph.kt:120-166`) |
| Remote Apple (all three devices) | openhamshack-remote `ios/Shared/QO100Graph.swift:20-59` | SwiftUI paths; ring in `QO100.swift:286-308` | as WB Android | console LUT ported (`QO100.swift:265-284`) | as WB Android. **The only Apple waterfall**: no NB, Radio, Icom, Flex or DATV UI on Apple (openhamshack-remote `HANDOVER.md:67, 115, 190`) |
| Box web pages | dock360-apps-flex `flex/app/static/display.js`; dock360-apps-icom-9700 `icom/app/static/scope.js` | Flex: **WebGL**, palette texture, B-spline row interpolation (`display.js:1-45, 429-474`); Icom: 2D canvas, offscreen per radio (`scope.js:225-244`) | Flex: own measured floor, never the radio's `auto_black_level` (`flex/docs/PROTOCOL.md:59-69`); Icom: `data/max` | Flex: aether, glacier, ember, mono (`display.js:70-120`); Icom: blue-cyan-white (`scope.js:104-110`) | Flex: plan ribbon, band edges, slices, notches, spots on a 2D canvas over GL (`overlay.js:53-506`); Icom: none on the scope |

Nothing on any platform uses a GPU shader except Flex's web page. No
Android code uses OpenGL or AGSL, and **no waterfall has ever been measured
on the real Fire TV**: TESTING.md has only start-up and video-decode figures
(openhamshack-remote `docs/TESTING.md:577-663`).

### 1.2 Every spectrum feed today: five formats

| Feed | Route and transport | Bins | Units | Rate and flow | Notes |
|---|---|---|---|---|---|
| NB/Radio `wide`, `zoom` | `api/events?kinds=wide,zoom`, hand-rolled WebSocket, JSON (openhamshack-nb `ohscore/server/app.py:1725-1776`) | `cdb`: base64 int16 LE, **centi-dB** (`app.py:148-160`; `docs/SERVER-API.md:51`) | engine dB, uncalibrated | engine `scopeFps` default 20 (`ohscore/state.py:322`); 8-deep queue, oldest dropped (`app.py:1739`) | `wideBins` (default 2048, `state.py:315`) and `scopeFps` are **engine settings at Control**: one client changing them changes every client's view. `dcBins` patch; no sequence number. Radio's span may be pinned by decoder sessions (`SERVER-API.md:288-330`) |
| Flex | `ws` binary, kind 1 sweep / kind 2 row (`flex/docs/API.md:101-108`, `flex/app/wire.py`) | int16 | sweep: tenths of dBm, absolute; row: radio intensity / 128, no zero (`API.md:105`, `PROTOCOL.md:59-69`) | radio `fps`; rows by `line_duration` (~81 ms at 80, `PROTOCOL.md:71-76`) | `display_size` **resizes the radio's panadapter for every client**, so Remote never sends it (openhamshack-remote `docs/REMOTE-CONTRACT.md` §13) |
| Icom | `api/scope?radio=&ack=1`, JSON text WS (`icom/docs/TV-API.md:425-464`) | 475 ints | 0..160, uncalibrated, relative to `ref_db` (`TV-API.md:446-456, 531-535`) | radio ~8.5/s, server cap 16/s, newest wins, `ack=1` keeps ≤2 in flight | scope switched on in the radio only while a socket is open (`TV-API.md:465-471`) |
| QO-100 WB | `/api/qo100` HTTP poll, waterfall by `?wf=<seq>` | 461 | dB from -3; rows 1 byte at 0.125 dB | ~1 row/s | relays **BATC's** wideband FFT, not our receiver; Pluto FFT as fallback (Classic daemon, vendored unchanged in openhamshack-fakebox `openhamshack-fakebox/vendor/openhamshack/appliance/openhamshacklib/qo100.py:22-25, 241`). WB has **no live source repo** (GUIDE §1, HANDOVER 22/10) |
| DATV/ATV | none (desktop only) | | | | |

Takeaways for the contract: four unit systems (dB, dBm, radio units,
counts); three apps let one client's display choice change the radio or
engine for everyone; none sends a sequence number *and* a capture time *and*
the resolution bandwidth together, though GUIDE §5 ("How tall a signal
looks depends on the scope's resolution bandwidth") says every scope must
show its RBW.

### 1.3 Overlay data today

| Source | Where | Shape |
|---|---|---|
| Band plan | **client-side only**: desktop reads `shack_bandplan` (`ohscore/ui/face.py:69`); Remote ships its own copy of the dataset (REMOTE-CONTRACT §12d); Flex's module sends segments in `tables` | Radio sends only `segment` and `planInUse` |
| Local frequencies (airband, marine, PMR, repeaters, beacons, NCDXF, "mine") | Radio `GET api/local-frequencies` (`SERVER-API.md:1621-1685`) | `{id, category, name, sub, freqHz, mode, step, distanceKm, bearingDeg, source}` |
| FM stations | `GET api/fm/stations`, `stations` feed (`SERVER-API.md:1346-1356`) | `{pi, ps, pty, rt, best:{hz, level, stereo}, alts}` |
| DAB | `GET api/dab/stations` (`SERVER-API.md:1366-1392`) | ensembles and services by block |
| Decoder sessions (PSK, RTTY, SSTV, DAB, DMR, AIS) | `api/decoders`, `decoder` feed `meta`/`frame` (`SERVER-API.md:104-251`); DMR `cc`, slots, talkgroup `dst`, alias (`SERVER-API.md:1440-1463`); AIS `ais` feed (`SERVER-API.md:1849-1857`) | per-session offset and width in `meta` |
| CW skimmer | `cwskim`, `cwspot`, `GET api/cwskim` | channels, spots with `rev` |
| ADS-B | **none found** | |
| Flex slices, spots | module `state`/`tables` | |

### 1.4 Server-driven screens today

None. Remote picks a hard-coded native screen by the exact `kind` string
(REMOTE-CONTRACT §11, §13); no schema-driven form exists on either
platform, and neither uses a web view (grep of `android/` and `ios/`, 28/10).
Two things already point the way: the radio displays are a layout spec
carried as data (`~/stationflow-tv/docs/RADIO-DISPLAYS.md` §5, GUIDE §4),
and the NB/Radio engine already declares every setting with type, default,
level, range, unit, choices and help (openhamshack-nb `ohscore/state.py:235`
onwards, e.g. `:315`, `:322`) - a settings screen can be generated from it.
ohs-libs already carries the pattern for shared contracts: JSON schemas
and vectors in `spec/`, with Python, Kotlin (`kotlin/`) and Swift
(`swift/`) implementations tested against them (ohs-libs `README.md:22-23`).

### 1.5 Platform facts that shape the design

- `/.well-known/openhamshack` lists each app with `id, kind, name, version,
  base, running, txCapable, anonymousView` (dock360 `feature/ohs-edition`
  `src/dock360/shack/discovery.py:88-97`). The contract's optional `icon`
  (CONTROLLER-CONTRACT §3) **is not built**.
- From platform beta.9 a controller **refuses** an app whose `openhamshack:`
  block has a key it does not know (CONTROLLER-CONTRACT §8), and kinds are a
  fixed list (`manifest.py:885`). Anything new in the manifest therefore
  needs a platform release first; anything an app serves from its own base
  does not.
- Effective level per app is min(user level, device `maxLevel`), and the
  proxy enforces route minimums (CONTROLLER-CONTRACT §5.1-5.2). TV tokens are
  capped at Control (REMOTE-CONTRACT §13).
- tvOS has **no web view** (no WKWebView on tvOS) and **TVMLKit is
  deprecated from tvOS 18**: "it'll remain available ... but won't be
  growing with the platform" ([WWDC24 10207, Migrate your TVML app to
  SwiftUI](https://developer.apple.com/videos/play/wwdc2024/10207/);
  [TVML docs](https://developer.apple.com/documentation/tvml)). So Apple TV
  parity means a native SwiftUI renderer; nothing web-based reaches it.
- Fire TV is API 28, armv7 (GUIDE §4). Compose for TV (`androidx.tv`) runs
  from API 21; **AGSL `RuntimeShader` needs API 33**, so it is out. OpenGL
  ES is the GPU route [guess: ES 3.0 present on Brian's stick; ES 2.0 is the
  safe baseline].
- Fire OS **blocks third-party home launchers** since Fire OS 7.2.7.3 and
  6.2.8.7 ([AFTVnews](https://www.aftvnews.com/amazon-blocks-custom-home-launchers-with-latest-fire-tv-software-update/),
  [XDA](https://www.xda-developers.com/fire-tv-software-update-reportedly-blocks-custom-launchers/)).
- Fire OS's launcher sends a package with two LEANBACK activities to
  Android's chooser, which is why DAB Radio is a separate stub app
  (openhamshack-remote `android/app/src/main/AndroidManifest.xml:65-74`,
  `android/dab-launcher`).

---

## 2. The spectrum stream contract (`spectrum/1`)

One feed shape for every app, served by each app under its own base.
Lives in ohs-libs `spec/schemas/spectrum.schema.json` plus binary vectors
in `spec/vectors/spectrum/`; encoders in Python (`shack_spectrum`, new),
decoders in Kotlin, Swift and JS, all tested against the same vectors.

### 2.1 Transport

`GET <base>api/spectrum/v1` upgrades to a WebSocket (view level, so the
proxy's default for upgrades holds: CONTROLLER-CONTRACT §5.2). Text frames
are JSON control messages; binary frames are spectrum rows. The client
pings every 30 s (Cloudflare closes idle sockets at ~100 s: GUIDE §5).
Relative URL, `X-Forwarded-Prefix` honoured, HTTP or HTTPS.

Client to server, any time:

```json
{"type": "subscribe", "stream": "main", "cols": 1280, "fps": 15,
 "loHz": 144100000, "hiHz": 144500000, "reduce": "peak", "depth": 8}
```

- `cols` is the client's drawn width in pixels: the **server decimates per
  client** to at most that many columns. It never changes the radio's or
  engine's FFT for a client (the Flex `display_size` and NB `wideBins`
  traps in §1.2). Engine resolution stays an operator setting.
- `loHz`/`hiHz` crop inside the stream's span: zoom within what the receiver
  already sees costs nothing and needs only view. Zooming **beyond** the span
  is a tune or span change: an ordinary Control action (§5.5), never implied
  by a subscription.
- `reduce`: `peak` (a column takes its highest bin: NB today) or `mean`
  (power average: "SDR Console-like", GUIDE §5). This is per-client
  decimation, not an engine change, so the receive SNR the engine reads is
  untouched.
- `depth`: 8 (uint8, default) or 16 (uint16, for measuring clients such as
  the dish survey, GUIDE §5).
- `fps` is a ceiling; the server sends at most min(client fps, source rate,
  the per-client cap of §2.4).

Server to client: `{"type": "stream", ...}` describing each stream (below)
on connect and whenever it changes; `{"type": "levels", ...}` when the
quantisation window moves; binary rows.

### 2.2 The stream description (JSON)

```json
{"type": "stream", "stream": "main", "rev": 7,
 "centreHz": 144300000, "spanHz": 2400000, "loHz": 143100000, "hiHz": 145500000,
 "binHz": 1171.875, "rbwHz": 1757.8, "srcBins": 2048, "rate": 20.0,
 "units": "dB", "calibrated": false, "dcBins": [1023, 1025],
 "pinned": {"by": ["ais-1"]}, "label": "Wide"}
```

`units` is `dBm` (Flex sweep), `dB` (an engine's own, `calibrated` false),
or `rel` (Icom's 0..160 mapped to dB by its `ref_db`); the client prints
"dBm" only for `dBm`. `rbwHz` is what the scope shows as its RBW. Streams:
`main`, plus `zoom` (NB/Radio), `pan-<id>` (Flex: one per panadapter),
`receiver-<n>` (Icom).

### 2.3 The binary row

Little-endian, 32-byte header then the columns:

| Offset | Type | Field |
|---|---|---|
| 0 | u8[2] | magic `0x4F 0x53` |
| 2 | u8 | version `1` |
| 3 | u8 | flags: bit0 `depth16`, bit1 `levelsChanged`, bit2 `streamChanged` (the description's `rev` moved: refetch before drawing), bit3 `gap` (rows were dropped before this one) |
| 4 | u16 | stream index (order of `stream` messages) |
| 6 | u16 | column count `n` |
| 8 | u32 | sequence, per stream, per client |
| 12 | u64 | capture time, ms since the Unix epoch (the FFT's last sample, box clock) |
| 20 | f64 | `loHz` of column 0's left edge (columns are equal width across `loHz..hiHz` of the subscription) |
| 28 | f32 | `colHz` |
| 32 | `n` x u8 (or u16) | values |

Value `v` means `dB = dbFloor + v x dbStep`; 0 is "at or below the floor",
the top value "at or above the top". `dbFloor` and `dbStep` come from the
last `levels` message:

```json
{"type": "levels", "stream": "main", "dbFloor": -142.0, "dbStep": 0.375,
 "noiseDb": -131.5, "peakDb": -62.0}
```

The **server** chooses the window: floor = noise estimate (20th percentile,
the rule every client already uses: §1.1) minus 10 dB, top = max(floor +
60 dB, 99.7th percentile + 6 dB), moved only when the signal leaves it by
more than 3 dB for 2 s (hysteresis), so `levelsChanged` is rare. It also
sends `noiseDb`/`peakDb` once a second for the client's **display**
auto-levels (§4.2), which are a separate, faster thing. uint8 over a 96 dB
window is 0.38 dB a step: finer than any colour map can show. Numbers and
readings (SNR, S-meter, dish meter) stay server-side and never come from
these rows.

Size: 1280 columns at 15 fps is ~20 kB/s, against ~2048 x 2 x 4/3 x 20 =
~110 kB/s for Radio's base64 `wide` today.

### 2.4 Rate limits and flow

- **Latest wins.** The server keeps one pending row per client per stream
  and replaces it if the socket has not drained; it never queues. A
  replaced row sets `gap` on the next. (Icom's `ack` window and NB's 8-deep
  queue both become this.)
- **Per-client caps** the client cannot raise: 25 fps and 2048 columns by
  default; 15 fps for a client whose token is a TV [guess: the TV's own
  budget, §4.6, will confirm]; 4 fps and 512 columns for a tunnel (internet)
  client. An app's whole budget is at most 8 subscribed clients; the ninth
  is refused with `{"type": "error", "code": "busy"}`.
- The box sends nothing for a stream nobody watches, and an app whose radio
  needs a scope switched on (Icom `27 10`/`27 11`) keeps today's rule: on
  while any subscription lasts, off 5 s after the last.

### 2.5 Back-compat during migration

- Old feeds stay: Radio/NB `wide`/`zoom`, Flex kinds 1/2, Icom `api/scope`,
  WB `/api/qo100`. Installed Remotes (sideloaded on Fire TVs) and desktop
  apps read them. Each app removes its old feed **one Remote release after**
  the last client reading it has moved, and says so in its release notes.
- The client's shared waterfall does **not** wait for servers: until an
  app serves `spectrum/1`, a small **feed adapter** in the client turns the
  old feed into the same internal rows (decimate, quantise, compute the
  window client-side). The renderer is replaced at once (Brian's rule);
  adapters are deleted as each server catches up. Adapters are the only
  per-app spectrum code a client keeps.
- A client finds `spectrum/1` from the app's UI descriptor (§5.3,
  `"spectrum": 1`), never by probing.

---

## 3. The overlay contract (`overlay/1`)

### 3.1 Transport

The same socket as spectrum (fewer connections on a Fire TV): text frames
`{"type": "overlay", "rev": 41, "op": "snapshot" | "upsert" | "remove",
"items": [...]}`. A snapshot comes on subscribe and after any `rev` gap;
`GET <base>api/overlay/v1?loHz=&hiHz=` gives the same snapshot over HTTP.
The server sends only items inside the subscribed range plus a margin of
half a span.

### 3.2 The item

```json
{"id": "rpt:GB3XX", "kind": "channel", "layer": "channels",
 "loHz": 145787500, "hiHz": 145787500, "centreHz": 145787500,
 "label": "GB3XX", "short": "GB3XX", "detail": "Repeater · 88.5 Hz · 12 km",
 "prio": 60, "readAtHzPerPx": 400, "role": "channel.repeater",
 "active": false, "expires": null, "source": "local-frequencies",
 "actions": [{"id": "tune", "label": "Tune", "do": "post", "path": "api/set",
              "body": {"vfo": 145787500, "mode": "fm"}, "level": "control"}]}
```

| Field | Rule |
|---|---|
| `kind` | `segment`, `dial`, `passband`, `tx`, `channel`, `station`, `session`, `spot`, `bookmark`, `beacon`, `alert`, `signal` |
| `layer` | `band` and `dial` are always on. Toggleable: `channels`, `stations`, `sessions`, `spots`, `bookmarks`, `beacons`, `alerts`, `signals` |
| `prio` | 0-100; ties broken by nearness to the dial, then age |
| `readAtHzPerPx` | the label shows once the view is at or below this many Hz a pixel (zoomed in enough); a band segment uses `null` = always. Server defaults by kind, client may scale them by a "label density" setting |
| `role` | a semantic colour role, never RGB (the client's theme maps it; Flex's plan colours become the `segment.*` roles) |
| `label`, `short`, `detail` | already translated by the server for the request's `Accept-Language` (I18N.md) |
| `active` | now on air / decoding (bold, may break the zoom rule when `prio` ≥ 80) |
| `actions` | §5.5 actions; the first is the item's OK/tap action. **Never a transmit action** (§5.6) |

### 3.3 Sources (all server-side, one per app)

| Layer | Source | Apps |
|---|---|---|
| `band` | `shack_bandplan` for the station's country and licence (BANDPLAN-DATA.md), sent as `segment` items. Remote then **drops its bundled copy** of the dataset, as REMOTE-CONTRACT §12d already asks | all radio apps |
| `dial`, `passband`, `tx` | the app's state (the client also draws the dial locally at once on a key press, then follows the server) | all |
| `channels` | Radio local frequencies: airband, marine, PMR/CB, repeaters, "mine" | Radio |
| `stations` | FM scan (PS name), DAB ensembles and services | Radio |
| `sessions` | decoder sessions: FT8/PSK/RTTY/SSTV, DMR (`TG 2350 · CC1`), AIS (`AIS 1/2`), ADS-B when it exists | Radio, NB, Flex |
| `spots` | CW skimmer, DX cluster | Radio, Flex |
| `bookmarks` | memories, bookmarks | all |
| `beacons` | QO-100 beacons, NCDXF | NB, Radio |
| `alerts` | LEILA/overpower | NB |
| `signals` | detected carriers (WB's signal boxes, NB's peak marks) | WB, NB |

Each app converts its existing routes (§1.3) to items in one module of its
own server using a shared helper (ohs-libs `shack_spectrum.overlay`); no new
data is invented for the overlay.

### 3.4 Focus and selection

The waterfall stays **unfocusable** on TV, as every TV face does today
(REMOTE-CONTRACT §13; `kind-stationflow .../ui/Scope.kt:44-47`), and the key
map is unchanged (REMOTE-CONTRACT §14: Left/Right tune, Up opens Choose):

- **Choose (Up) gains an "On screen" list**: every labelled item now
  visible, nearest the dial first; OK runs its first action (tune, open the
  session panel, open the station).
- On touch: tap a label runs its first action; long-press shows `detail`
  and all actions.
- Desktop: hover shows `detail` (as `r_strip` tooltips do today, GUIDE §5),
  click runs the first action.

---

## 4. The rendering spec

### 4.1 One engine per platform

| Platform | Drawing | Where |
|---|---|---|
| Android phone, tablet, TV, Fire TV | OpenGL ES 2.0 in a `TextureView` hosted by Compose (`AndroidView`): an R8 (`GL_LUMINANCE`) ring texture, rows written with `glTexSubImage2D`, scroll by a texture-offset uniform, colour by a 256 x 1 LUT texture, zoom by UV scale. Labels and chrome in Compose above it. No per-frame allocation: one direct `ByteBuffer` reused | new `android/core-spectrum` module in openhamshack-remote |
| iPhone, iPad, Apple TV | Metal (`MTKView` in SwiftUI): the same ring and LUT as `r8Unorm` textures | `OpenHamShackKit` target `ShackSpectrum` |
| Desktop Qt (NB, Radio, DATV, ATV) | `QImage.Format_Indexed8` ring with the LUT as its colour table (levels and maps cost nothing), two blits as today | ohs-libs `python/shack_spectrum/qt.py`, replacing `scopecore.py` and DATV/ATV's copies |
| Box web pages, desktop forms of web apps (Flex, Icom, WB) | WebGL 1, Flex's `display.js` approach generalised | ohs-libs `js/` [guess: no shared JS package exists yet; the i18n vectors name a JS `fmt`] |

The pure parts are shared by vectors, not by code: decoding rows,
quantising, display auto-levels, the label layout algorithm (§4.4) and the
colour map tables, each in `spec/vectors/spectrum/` and run by every
implementation's tests.

### 4.2 Levels

- **Display auto-levels** (client): floor = EMA of `noiseDb` (attack 0.5 s,
  decay 3 s) minus 3 dB; range = clamp(`peakDb` - floor + 6, 30, 90) dB.
  The trace and waterfall share the floor; the waterfall's top may be
  lower ("contrast"). Manual Ref and Range override, per app and device,
  as the desktop and Flex already offer (`scope.py:1037-1047`;
  `POST api/scope` in Flex `API.md:208-243`, which becomes a client setting).
- **Peak hold and averaging** are client-side transforms of the same rows
  (GUIDE §5): averaging an EMA with a per-app time constant (default 0.13 s,
  NB's `GHOST_TAU`, `scope.py:44`); peak hold decays at 15 dB/s after 0.2 s
  (NB's SDR-Console-like constants, `scope.py:83-85`). Waterfall rows are
  never averaged.

### 4.3 Colour, themes and contrast

| Map | Use |
|---|---|
| **Calm** (Brian's approved TV palette: navy, blue, teal, sea green, amber; `Scope.kt:90-92`) | default on TV |
| **Ember**, **Glacier**, **Classic**, **Phosphor** (`palettes.py:19-25`, built in linear light) | default Classic on phone and desktop, as today |
| **Inferno-like** perceptual (monotonic lightness) | offered everywhere |
| **High contrast**: black to white, and a colour-blind safe blue to yellow | accessibility; chosen automatically when the OS asks for high contrast |

One table file, `spec/colourmaps.json` (256 sRGB entries each), replaces the
eight copies. The waterfall body stays dark in light and dark themes (the
desktop's rule, `theme.py:139-140`); grid, labels and chrome follow the
theme.

### 4.4 Labels: collision and fade

- Up to three label rows above the trace, plus the band strip at the foot.
- Placement: candidates are items whose `readAtHzPerPx` the current zoom
  meets (or `active` with `prio` ≥ 80), sorted by priority then nearness to
  the dial; each takes the first row where its measured box fits, else falls
  back to `short`, else shows only its tick (today's "drop the caption, keep
  the mark": `scope.py:1297-1300`).
- **Hysteresis**: a placed label keeps its row while it fits, and is only
  displaced by one of higher priority that has wanted the place for 300 ms.
  Labels fade in and out over 150 ms. Remote's tested `ScopeLabels.place`
  (`ScopeLabels.kt:14-52`, 2000 random layouts) is the starting point.
- Toggles per layer, per app, per device; "Show signal labels" (the desktop's
  one switch, `scope.py:89-106`) becomes "all toggleable layers".

### 4.5 Scroll and zoom

Rows scroll at the source rate; between rows the GPU paths interpolate
the scroll offset so motion is smooth at the display's refresh (Flex's
B-spline row interpolation, `display.js:429-474`, is the reference). Zoom
and pan inside the span re-map the texture at once; history rows keep their
own frequency (the desktop's `Waterfall.remap`, `scopecore.py:191-204`).

### 4.6 Fire TV stick budgets (to be measured, never yet done)

| Budget | Value |
|---|---|
| Waterfall at 1920 x ~540 px, 15 rows/s, 60 Hz scroll | ≤ 4 ms GPU, ≤ 2 ms main thread per frame (`dumpsys gfxinfo` janky frames < 1 %) |
| Ingest a row (decode, texture upload, levels) | ≤ 1 ms off the main thread |
| Labels | layout ≤ 1 ms, run only when the view or the items change |
| Memory | ring 2048 x 512 R8 = 1 MB; no allocation per frame (no GC pauses over 10 min) |
| Network | ≤ 30 kB/s spectrum + overlay |
| CPU | whole app ≤ 35 % of one core while showing Radio with audio [guess at a fair share; measure today's Canvas path first as the baseline] |

---

## 5. Server-driven UI (`ui/1`)

### 5.1 What it is and is not

The box sends a **screen document**: a tree of components with bindings to
the app's live state and actions to call. The client's renderer draws it
natively (Compose on Android, SwiftUI on Apple). Updates ship with the box
app, so a new panel or setting needs no client release. It is **not** a
browser: no scripting, no layout maths, no styling beyond semantic tokens.
Anything that needs frame-rate drawing, hardware or safety logic is a
**native component** that the screen places by name.

### 5.2 The document

```json
{"ui": "1.0", "screen": "radio/home", "rev": "b13-4f2a", "title": "Radio",
 "data": {"state": "ws:api/events?kinds=state,meter", "stations": "get:api/dab/stations"},
 "root": {"c": "column", "children": [
   {"c": "nowPlaying", "title": {"bind": "state.dab.service"},
    "subtitle": {"bind": "state.dab.dls"}, "image": {"bind": "state.dab.slideUrl"}},
   {"c": "native", "name": "waterfall", "v": 1,
    "props": {"stream": "main", "layers": ["band", "dial", "stations"]},
    "fallback": {"c": "text", "text": "This needs a newer OpenHamShack app."}},
   {"c": "row", "children": [
     {"c": "button", "label": "Scan", "icon": "scan",
      "action": {"do": "post", "path": "api/dab/scan", "level": "control"}},
     {"c": "slider", "label": "Volume", "value": {"bind": "state.volume"},
      "min": 0, "max": 1, "action": {"do": "post", "path": "api/set",
      "body": {"volume": "$value"}, "level": "control"}}]}]}}
```

- `data` names the feeds the screen binds to, all relative to the app's
  base: `ws:` for an existing event socket, `get:` for a JSON resource
  (re-fetched on its feed's change event or every `poll` seconds).
- `bind` is a dotted path into those; `format` names a shared formatter
  (`freq`, `db`, `time`, `distance`) from ShackFormat, whose vectors already
  exist (ohs-libs `spec/vectors/i18n/format.json`). No expressions.
- Strings are translated by the server for `Accept-Language`
  (contract/I18N.md); numbers and frequencies are formatted by the client.

### 5.3 Routes, discovery and versioning

- `GET <base>ui/v1/app`: the **app descriptor**: name, icon (PNG 512 and a
  monochrome mask, relative URLs), `entries[]` (the launcher tiles this app
  offers: §6.2), `screens` (ids), `spectrum: 1`, `overlay: 1`,
  `minClient`, and a small `status` binding for the launcher tile.
- `GET <base>ui/v1/screen/<id>?<params>`: one screen.
- All under the app's own base, so **no platform release and no manifest
  key** is needed (§1.5); relative references only, `X-Forwarded-Prefix`
  for anything the server builds, HTTP or HTTPS.
- The client sends `X-OpenHamShack-UI: 1.0` and
  `X-OpenHamShack-Components: waterfall/1, map.ais/1, audio/1, ...`. The
  server leaves out what the client lacks or gives a `fallback`; an unknown
  component with no fallback renders "needs a newer OpenHamShack app".
  Unknown properties are ignored. A breaking change is `ui: 2`, and the
  server serves both for one release (CONTROLLER-CONTRACT §1's rule).
- Schema and render vectors (document in, resolved layout tree out) in
  ohs-libs `spec/schemas/ui-screen.schema.json`; servers build screens with
  ohs-libs `python/shack_ui` (dataclasses, validated against the schema in
  each app's tests).

### 5.4 Component vocabulary (v1)

| Group | Components |
|---|---|
| Layout | `column`, `row`, `grid`, `list` (lazy, paged by `next`), `tabs`, `section`, `card`, `sheet` (a TV side panel), `spacer` |
| Content | `text`, `value` (big readout: frequency, S-meter text), `badge`, `chip`, `image` (relative URL, cached), `meter`, `nowPlaying` (logo, title, subtitle, progress), `empty` (nothing here, with a reason) |
| Controls | `button`, `toggle`, `slider`, `stepper`, `choice` (picker), `textField`, `frequencyField`, `settingsForm` (generated from a key list such as `ohscore/state.py`'s: type, range, unit, help, level) |
| Native (client code, placed by the server) | `waterfall` (incl. Flex `pan-<id>` streams), `map` (`ais`, `adsb`, `aprs`; tiles from the app's `api/map/*`), `audio` (player, timeshift), `video` (MPEG-TS player with the weak-signal options), `radioFace` (Icom's radio-shaped displays, RADIO-DISPLAYS.md), `sstvPicture`, `decodeList`, `ptt` and `enableTx` (§5.6), `camera` (phone only) |

TV layout is the renderer's job, not the server's: the same document
renders calm on a TV (frequency large, everything else behind OK: Remote's
TV rules, REMOTE-CONTRACT §13) and denser on a tablet. A node may carry
`tv: false` or `phone: false` to drop it on one form factor.

### 5.5 Actions

| `do` | Effect |
|---|---|
| `post` | POST JSON to a path under the app's base; `body` may use `$value` and bindings; declares its `level`. The answer may carry `{"toast"}` or `{"open"}` |
| `open` | push a screen (`screen`, params) |
| `back` | pop |
| `local` | set a client-side preference (layer toggles, palette, label density) |
| `native` | a verb on a native component (`waterfall.zoomIn`, `audio.mute`) |
| `confirm` | wraps another action with a question; Stay is focused |

The client greys out an action whose `level` exceeds its effective level for
the app (learnt from the launcher, §6.4); the proxy refuses it anyway
(CONTROLLER-CONTRACT §5.2), and a 403 `level_too_low` shows its own message.

### 5.6 Transmit and hardware safety

- **No generic action may transmit.** The renderer refuses any `post` that
  declares `level: transmit`, and a TV's token is capped at Control in any
  case. PTT and Enable TX are the native `ptt`/`enableTx` components, whose
  lease, 1 s heartbeat, 5 s time-out, unkey on background, and TV key rules
  (GUIDE §2; REMOTE-CONTRACT §5, §12c, §14) are client code with tests,
  exactly as today. The server only decides whether to place them.
- **Leaving a screen that holds a lease unkeys and disarms** (the renderer
  calls the component's teardown); so does going back to the launcher (§6.3).
- Subscriptions never touch hardware beyond today's rules (§2.4); every
  tune, span or radio change is an explicit Control action. Hardware stays
  the broker's (CONTROLLER-CONTRACT §7); n/a otherwise.

### 5.7 Caching, offline and accessibility

- Descriptors, screens and icons are cached per `controllerId`, app id and
  app version with `ETag`. A box that does not answer shows the launcher
  from cache with the tile greyed and "not answering"; a screen never
  opens from cache (its controls would lie). The client keeps working fully
  with no internet; only the box is needed (Brian: radio internet is
  optional).
- Every node has a spoken label (TalkBack, VoiceOver); focus order is
  document order, with `focusGroup` for rows; text scales with the system;
  touch targets ≥ 48 dp; colour comes only from theme roles, so high
  contrast works everywhere.

### 5.8 How it sits with "one client app per platform, with kinds"

The rule is kept and gets cheaper. A **kind** stays the app's identity
(manifest, discovery, levels); it no longer decides which compiled screens
exist. The client ships the renderer and the native components; each app
ships its screens. A kind with no `ui/v1/app` (an older app) opens its
existing hand-written screen until that app serves screens, then the
hand-written screen is deleted. Icom's `kind-stationflow` becomes the
`radioFace` native component plus server screens around it.

---

## 6. The launcher and navigation

### 6.1 One app, one icon

The OpenHamShack app has **one** launcher icon on every device. Its home
is the **OHS launcher**: a grid of tiles for the apps the paired boxes
actually run, and the feature views they offer.

### 6.2 What the launcher shows

- **Apps** come from each box's `/.well-known/openhamshack` `apps[]`
  (§1.5), less any at level `none` (CONTROLLER-CONTRACT §5.1).
- **Entries** come from each app's `ui/v1/app` `entries[]`: Radio offers
  "Radio", "DAB Radio", "FM", "Ships", "Aircraft" (when ADS-B exists); NB
  offers "QO-100 NB"; and so on. Each entry has an icon, a title, the
  screen it opens, and a `status` binding (now playing, "3 decoders",
  "on the air" in red, "stopped").
- **An app added on the box appears with no client update**: the
  well-known lists it, its descriptor gives its tile, its screens draw it.
  An app the client cannot render (no `ui/v1`, unknown kind) still gets a
  tile that explains why rather than vanishing.
- **Several boxes**: one row (TV) or section (phone) per box, named by
  callsign and box name, keyed by `controllerId`, never by address. The
  first row is the box last used. A Classic box shows as one QO-100 WB tile
  (CONTROLLER-CONTRACT §2.3).
- Icons need the box: `icon` in the well-known is in the contract but not
  built (`discovery.py:88-97`); the descriptor's icon serves meanwhile, and
  the platform adds `icon` in a later release [recommend: in the next
  edition release, from the manifest's existing icon].

### 6.3 Navigation model

The stack, on every device: **Launcher > app or entry > screens > panels
(overlays)**.

| Key | Android TV / Fire TV | Apple TV (Siri Remote) | Phone / tablet |
|---|---|---|---|
| Back (Menu on older Siri Remotes) | closes the innermost panel, then pops a screen, then from an app's first screen **returns to the launcher**; on the launcher it leaves (§6.6) | the same through SwiftUI's `NavigationStack` and `onExitCommand` | system back / swipe, same order |
| Home / TV button | system: goes to the device's home and is **never seen by the app** on Android (and the TV button on tvOS). The app goes to the background | system | system |
| Return from the device home (the tile again) | the same task resumes at the screen it was on (single activity, `launchMode="singleTask"`) | the app resumes where it was | the same |

Android detail: one activity (today's `MainActivity`, the only LEANBACK
launcher activity), Compose navigation for the stack, an
`OnBackPressedCallback` at the launcher only when §6.6's confirmation is
on. While transmit is armed or on, Back first disarms or stops (REMOTE-
CONTRACT §14), unchanged. Going back to the launcher **always** unkeys and
disarms Enable TX (§5.6). Background (Home) keeps today's rule: unkey and
stop transmit; receive audio follows §6.5.

### 6.4 Permissions and sign-in per app

- One device token per box (pairing by password on phones, by code on TVs:
  CONTROLLER-CONTRACT §4). The launcher needs the device's effective level
  for each app: a new platform route `GET api/shack/v1/devices/self/levels`
  [guess: nothing returns per-app levels to a device today; `levels.py:94`
  `chosen_levels` serves the admin pages]. Until it exists, the level is
  learnt from a refusal, as Icom's kind does now (REMOTE-CONTRACT §13).
- Tiles show a small "View only" badge below Control; an app at `none` is
  not shown; an `anonymousView` app opens before pairing.
- A 401 from an app is never a sign-out: the client asks the platform and
  forgets the token only on `token_revoked`/`bad_credentials` (GUIDE §5).

### 6.5 Audio when going back to the launcher (decided)

**Decided (Brian, 28/10/2026): receive audio stops when you go back to the
launcher. There is no mini player.** Back from an app's first screen closes
its audio stream and its spectrum and overlay socket, and the client tells
the box it has left that app (a presence renewal with no app, §7.2), so the
box frees what it held at once (§7.3). The launcher is silent; opening the
app again starts it afresh (a DAB station plays again from the "Start in"
or last-station memory on the client).

Not covered by the decision and left as the plan's default: pressing the
device's Home key **inside** an app. On a TV that stops everything (the app
is no longer on screen: `onStop`, goodbye). On a phone or tablet a listening
app (DAB, FM) keeps playing in the background with the system media
notification, renewing presence from the media service, and every other
app stops.

### 6.6 "Leave OpenHamShack?" (decided)

A client setting, **Ask before leaving OpenHamShack**, per device, offered
on every device. **Decided (Brian, 28/10/2026): on by default everywhere**:
Android TV, Fire TV, phones, tablets, iPhone, iPad and Apple TV.

- With it on, Back on the launcher shows: **Leave OpenHamShack?** with
  **Stay** (focused) and **Leave**. Back inside the dialog is Stay. There
  is no time-out.
- Nothing plays on the launcher (§6.5), so there is no audio choice to
  make: the two buttons are all. With the setting off, Back leaves at once.
- Android: an `OnBackPressedCallback` enabled only on the launcher and only
  with the setting on, so predictive back keeps working elsewhere; Leave
  sends the presence goodbye (§7.2), then `finish()`.
- Apple TV: `onExitCommand` on the launcher root while the setting is on;
  Leave lets tvOS go home. Apple's guidance is that Menu at the top level
  returns to the home screen, so a confirmation there may be questioned at
  App Review [guess]. Brian chose on by default regardless; if review
  objects, the fallback is off by default on Apple TV only (§12).

### 6.7 The separate DAB Radio and Ships tiles (decided)

**Decided (Brian, 28/10/2026): retire them.** DAB Radio's stub app (`android/dab-launcher`)
and its separate task (`DabRadioActivity`, `taskAffinity`: manifest
`:75-89`) go, and Ships never gets one. Instead a **Start in** setting
(the launcher, the last app used, or a chosen app or entry such as DAB
Radio, on a chosen box) gives one-press DAB from the single tile, and the
launcher remembers focus on the last entry. A chosen app that the box no
longer runs, or a box that does not answer, starts in the launcher with
the reason shown on its tile.
Optional shortcuts stay possible later without new architecture: a deep
link `openhamshack://open?controller=<id>&entry=<app>/<entry>` that a stub
tile, an Android TV home channel or a tvOS Top Shelf item can call.

### 6.8 As a real home screen?

On a **dedicated Android TV box** (not Fire TV) it could be: an
`activity-alias` with the `HOME` category, disabled until the user turns
on "Use as this device's home screen". Fire TV refuses third-party home
launchers (§1.5). Google TV may need adb to change the default home
[guess]. Not in this plan's steps; worth doing only if Brian wants a
shack-only TV box.

---

## 7. Client presence: freeing the radios

**Goal (Brian, 28/10/2026): when nobody is using a radio any more, give it
back, so another app, a desktop or a scan can use it.** Today a TV that is
switched off, killed by Android or cut off by the network tells the box
nothing, and what it started keeps the radio.

### 7.1 The leases that exist today

| Lease | Who renews, how often, expiry | What expiry does | Where |
|---|---|---|---|
| Transmit (PTT) | client, 1 s, 5 s | unkeys | GUIDE §2; openhamshack-nb `docs/SERVER-API.md:45-46` |
| Enable TX arm | client, 1 s (between overs too), 5 s | disarms and unkeys | GUIDE §2; `SERVER-API.md:761` |
| AIS ship map | client, every 10 s, `leaseS` 30 s; `lingerS` 60 s after the last | ends AIS, gives the receiver back exactly as it was | `SERVER-API.md:1741-1776` |
| ADS-B | **being built** (28/10/2026), shaped like AIS's session and lease; not yet on openhamshack-nb main | as AIS | |
| Broker claim | app to platform, every 2 s; 10 s (6 s on air) | frees the device; on air, runs safe-off first | CONTROLLER-CONTRACT §7.2-7.3 |
| Icom scope | while a scope socket is open; off 5 s after the last | radio's scope output off | `icom/docs/TV-API.md:465-471` |
| DAB playback, a session's `listen`, the receive audio stream | **no lease**: DAB holds the receiver (`rxOwner`) until someone stops it (`SERVER-API.md:105, 830-850`); audio ends only when TCP notices | nothing | |

### 7.2 One client lease, the others hang off it

A platform service, **presence** (listed in the well-known `services` map
when it answers, SERVICES.md style):

```http
POST   api/shack/v1/presence            {"client": "<id>", "app": "shack-radio",
                                          "screen": "radio/dab", "holds": ["dab", "audio"]}
  -> 200 {"leaseS": 30, "renewEveryS": 10}
DELETE api/shack/v1/presence/<id>       (goodbye; best-effort)
GET    api/shack/v1/presence            (who is here; view)
GET    api/shack/v1/presence/events     (SSE: arrived, moved, gone{why: goodbye|expired})
```

- `<id>` is the client's existing stable id (the `remote` of the transmit
  lease, the `client` of AIS). One lease per client, renewed every **10 s**,
  expiring after **30 s** (AIS's numbers). The platform binds the id to
  the caller's device token, so no device can say goodbye for another. The renewal carries the
  current app, screen and holds, so it doubles as "what they are viewing".
- **Goodbye, best-effort, on every way out:** the leave confirmation;
  Android `onStop` on a TV (the app is no longer on screen) and `onDestroy`;
  a phone's `onStop` only when nothing plays in the background; Apple's
  scene going to `.background`. A short request with a 1 s time-out, never
  blocking the exit. Coming back sends a fresh renewal.
- **The lease is the backstop** for everything with no callback: Android
  killing the app, the TV switched off at the wall, the network dropping.
- Apps hang their client-scoped holds off it: an app subscribes to
  `presence/events` and, on `gone`, ends what that client held. AIS's own
  `api/ais/session` keeps working for older clients during migration; a
  client that has presence may stop renewing AIS separately (the app treats
  a present client with `ais` in `holds` as renewing it).
- An app on a controller without the service (older platform), or a desktop
  form, keeps its feature leases as today.

### 7.3 What the box does when a client goes

Two kinds of hold, and only one is released:

| Client-scoped (released when its last client goes) | Station-scoped (kept; started on purpose to run unattended) |
|---|---|
| DAB or wide-FM playback, a session's `listen`, the AIS map, ADS-B map, the receive audio and spectrum streams, a span pinned for a viewer | saved background decoder sessions, the CW skimmer, recordings, scheduled scans, Packet's BBS reservation (GUIDE §5) |

On `gone` (goodbye at once; expiry after 30 s), for each app the client
used:

1. Close that client's audio, spectrum and overlay streams.
2. If it was the **last** client holding a client-scoped hold, end it
   **at once** (decided, Brian 28/10/2026: no linger): `rxOwner` goes back
   to `{}`, the receiver returns to its `prior` dial and mode, and any span
   pin the hold made is lifted (`SERVER-API.md:340-352`). This changes
   AIS's `lingerS` from 60 s to 0 (`SERVER-API.md:1753, 1774`), and ADS-B
   is built the same way.
3. If the app then holds a device for **nothing** (no client, no
   station-scoped hold, no local operator), it **releases its broker claim
   at once**: the same path as `api/stop`, which releases the claim
   (`SERVER-API.md:44`). The radio shows free on the Hardware page, and
   another app, a desktop or the band scan can claim it. The next client to
   open the app claims it again (receive only).
4. **Timing is the lease alone:** a goodbye frees things immediately; a
   client that vanishes is freed when its 30 s lease expires. There is no
   per-app "keep playing with nobody watching" policy (decided: stop).
   The price: a TV that goes back to the launcher and straight into the
   same app restarts AIS or DAB from cold (a few seconds).

**Several radios on one box** (say an RSPdx for Radio, a Pluto for NB
and an RTL-SDR another app wants): presence is per client per app, holds are per app per
receiver, and claims are per app per device. The broker never sees a
client: it sees an app keep or drop its claim on each device
(CONTROLLER-CONTRACT §7). So when the last viewer of Radio leaves, Radio
frees the RSPdx; NB, still watched by a phone, keeps the Pluto. A holds
entry names the receiver (`"holds": ["dab@rspdx-1"]`) once an app runs
more than one.

### 7.4 Transmit stays exactly as it is

- Presence never unkeys and never frees a transmitter. A vanished client's
  transmit lease (5 s) and Enable TX arm (5 s) have already ended long
  before its presence (30 s) does, by their own rules.
- An app **never releases a broker claim while on air** (its
  `api/shack/release` already answers `409 {"onAir": true}`:
  `SERVER-API.md:70`), and a lapsed on-air claim runs safe-off first
  (CONTROLLER-CONTRACT §7.3-7.4). Releasing receive holds is refused while
  keyed, and retried after.
- Station-scoped transmitters (the Packet BBS reservation, acting for the
  sysop who armed it) are untouched by presence.

### 7.5 Presence in status

- `GET api/shack/v1/presence`: each client's device name, kind (TV, phone,
  desktop), user, app, screen, holds, since, last seen. Full detail for
  administrators; counts per app for everyone else [guess at the right
  privacy line].
- Each app's `api/status` gains `clients` per hold (AIS already has
  `clients`: `SERVER-API.md:1774`), and the launcher tile and the Hardware
  page show "Brian's Fire TV is listening to DAB on the RSPdx", so a person
  who wants the radio sees who has it and can ask for it (the broker's
  release request, CONTROLLER-CONTRACT §7.5).

---

## 8. The web-view shell option (Android)

| | Web-view shell | Native renderer (this plan) |
|---|---|---|
| Apple TV | impossible: tvOS has no web view, TVML deprecated (§1.5); a second UI stack anyway | the same renderer design in SwiftUI |
| Fire TV stick | Fire OS's WebView, armv7, a canvas or WebGL waterfall plus page layout in the browser's budget [guess: worse than GL ES in-process] | GL ES 2 waterfall, Compose for the rest |
| D-pad | web pages need spatial navigation written by hand; Remote's TV rules (focus traps, BACK, safe area: GUIDE §5) would be re-solved in JS | already solved in `core-candidates` TV kit |
| Audio, video, PTT lease | must bridge to native (libVLC, PcmPlayer, the lease) through JS interfaces: a security surface | native already |
| Updates with the box | yes | yes (screens), client releases only for new native components |
| Work | low to start, high to make good on TV | medium, done once per platform |

**Recommended: no web-view shell.** The box console and the desktop forms
of web apps stay web (BETA-PLAN §3); phones and TVs use the native
renderer. If a rarely used admin page is ever wanted on a phone, a
`webPage` native component could open it in the system browser rather than
embed one.

---

## 9. The change checklist (GUIDE §3)

1. **Contract:** new `spectrum/1`, `overlay/1`, `ui/1` in ohs-libs `spec/`;
   REMOTE-CONTRACT gains a section per contract; CONTROLLER-CONTRACT gains
   `devices/self/levels`, the built `icon` and the presence service (§7);
   SERVER-API gains each app's client-scoped holds (released at once).
2. **Server:** every app serves the three, via ohs-libs `shack_spectrum` and
   `shack_ui`: NB/Radio (openhamshack-nb), Flex, Icom (dock360-apps), WB
   (no live repo: §12), DATV/ATV store apps (screens only); each app
   releases client-scoped holds and idle broker claims on presence (§7.3).
   Platform: two small routes and the presence service.
3. **Fake:** Remote's fakeshack and `tools/fakebox.py`, the Dock360
   fakebox's vendored copy, and `stationflow-tv/tools/fakeflow.py` serve all
   three, with fixed overlay items and a scripted spectrum; there is no Flex
   fake today [gap].
4. **Android (incl. TV):** `core-spectrum`, `core-ui` renderer, launcher,
   feed adapters; each kind's screens move to server screens.
5. **Apple:** `ShackSpectrum`, `ShackUI` and the launcher in OpenHamShackKit
   with tests; the iPhone, iPad and Apple TV apps adopt them. Parity comes
   from the renderer, since Apple has only QO-100 today.
6. **Desktop:** the Qt waterfall moves to `shack_spectrum.qt` (NB, Radio,
   DATV, ATV), reading the same colour maps, label rules and overlay
   items; desktop apps keep their own Qt screens (no server-driven UI on
   desktop, and no servers inside desktop apps).
7. **Hardware:** no new device access; subscriptions never change radios
   (§2.4); the broker is unchanged and never sees a client: apps drop
   their claims when nobody needs the device (§7.3), which is the point.
8. **Transmit:** no generic transmit action; native `ptt`/`enableTx` only;
   leaving a screen unkeys (§5.6); presence never frees a transmitter or a
   claim on air (§7.4). Nothing here keys a radio, and no test needs one.
9. **Release:** Remote (tablet session) and each app's owner; the platform
   routes go in an edition release (ohs-beta).

---

## 10. Migration order, effort and owners

Effort is in **session-days** (one focused session with its agents)
[guess, from the size of today's code]. Steps 1-3 overlap.

| # | Step | Work | Effort | Owner |
|---|---|---|---|---|
| 0 | **Contracts and shared code** | `spec/` schemas and vectors; `shack_spectrum` (encoder, per-client decimation, levels, latest-wins sender, overlay helper) and `shack_ui` in Python; Kotlin and Swift decoders | 4 | architect then builder, ohs-libs |
| 0b | **Presence** | platform service (lease, goodbye, events, status) in the edition; Radio's client-scoped holds, released at once with the broker claim (AIS `lingerS` to 0); the client's goodbye and renewals | 4 (platform 1.5, Radio 1.5, client 1) | ohs-beta (edition); OHS Radio session; tablet session |
| 1a | **Fire TV spike** | GL ES 2 waterfall on Brian's Fire TV vs today's Canvas path, against §4.6; one day before anything depends on it | 1 | tablet session (verifier) |
| 1b | **Radio's TV screen** | Android `core-spectrum`, `core-ui` renderer, the launcher, Radio's adapter; Radio serves `spectrum/1`, `overlay/1` (band, channels, stations, sessions, spots) and its TV screens (home, DAB, FM, Ships with `map.ais`) | 12 (client 8, server 4) | tablet session (Remote); OHS Radio session (server) |
| 2 | **NB** | NB's screens and overlays (beacons, alerts, sessions); its TV face moves | 3 | NB/Radio server owner; tablet session |
| 3 | **Flex** | Flex serves `spectrum/1` per panadapter and its overlays (slices, spots, plan); `FlexScope` adapter deleted | 4 | Flex app owner [none named in GUIDE §6]; tablet session |
| 4 | **Icom** | `api/scope` to `spectrum/1` (units `rel`); `radioFace` as a native component in server screens | 4 | Icom app owner [none named]; tablet session |
| 5 | **WB, DATV, ATV** on TV and phone | WB's `/api/qo100` as `spectrum/1` (`signals` overlay) once it has a repo; DATV/ATV screens only | 3 + WB repo | open decision 2 |
| 6 | **Apple** | Metal waterfall, SwiftUI renderer, launcher, Top Shelf optional; every app at once, because the screens already exist | 12 | **no Apple owner is named in GUIDE §6**; HANDOVER says "Apple twin via the Mac script". Open decision 3 |
| 7 | **Desktop** | `shack_spectrum.qt` in NB/Radio, DATV, ATV; WebGL waterfall shared by Flex/Icom/WB web pages | 5 | NB session for openhamshack-nb (it also cuts Radio releases, GUIDE §6); app owners for web |
| 8 | **Clean-up** | old feeds removed one Remote release after the last reader; adapters and hand-written kind screens deleted | 2 | each owner |

About **54 session-days** in all; Radio on the Fire TV with the launcher
and presence is about 21 (steps 0, 0b, 1a, 1b). NB, Flex and Icom each add
about half a day for their own holds in steps 2-4.

---

## 11. Testing without a fallback

Replacing straight away means the previous release is the only way back:
the **previous APK / TestFlight build is the rollback**, not code kept in
the app. So each switch is gated on proof, not on hope:

| Proof | What it shows | Where |
|---|---|---|
| Shared vectors green in Python, Kotlin, Swift, JS | rows, quantisation, levels, label layout, colour maps and screen rendering agree everywhere | ohs-libs `tools/test.sh`, each repo's suite |
| A **parity list per screen** (every control, overlay and key the old screen had, item by item), ticked from screenshots | nothing the old screen did is lost | the PR, Brian's review of screenshots |
| Fake box: emulator `ohsr-tv` and a phone emulator against fakeshack serving all three contracts, screenshot set | renders and navigates, incl. Back to the launcher and the leave dialog | openhamshack-remote `docs/TESTING.md` |
| **Real Fire TV against ohs-box Radio**, 10 minutes: `dumpsys gfxinfo`, memory, CPU against §4.6 | the budget holds on the weakest device | verifier |
| Old feed and new feed side by side on one box: same peaks at the same frequencies within one column, same noise floor within 1 dB | the server's quantisation is right | app tests on recorded IQ (GUIDE §5: real captures, `iqlib`) |
| A transmit test proves the renderer refuses `level: transmit` and that leaving a screen unkeys | §5.6 | unit tests; no radio |
| Presence: goodbye, expiry (client killed with `am force-stop`, network cut, TV to standby) free the RSPdx at once on goodbye and within 30 s on expiry, and the broker shows it free; a keyed simulator is never released | §7 | app tests on the simulator; the Fire TV against ohs-box, receive only |

A switch ships only when all seven pass for that app.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| A renderer gap or bug with no fallback (Brian's rule) | parity lists, the six proofs, previous release as rollback, Radio first and alone |
| The Fire TV stick cannot hold the budget | the 1a spike before any dependency; GL ES 2 baseline; per-client caps |
| Server-driven UI grows into a browser (expressions, styling) | the vocabulary is closed; anything more is a native component; schema changes reviewed by the architect |
| Platform refuses unknown manifest keys (§1.5) | everything app-served; only two small platform routes |
| WB has no live source repo, so it cannot serve anything new | open decision 2; until then it keeps its feed through an adapter |
| No Apple owner and no TestFlight (needs Brian's App Store Connect record and key, HANDOVER) | open decision 3; Apple starts after step 1b proves the contracts |
| Old sideloaded Remotes still read old feeds | old feeds kept one Remote release past the last reader (§2.5) |
| Presence frees a radio someone still wanted (a TV in standby while DAB plays to the room) | accepted by Brian's decision (stop at once); station-scoped holds are never released, so unattended work belongs there |
| App Review questions "Leave OpenHamShack?" on by default on Apple TV | fall back to off by default on Apple TV only, and say so to Brian |
| An old client with no presence looks gone and loses its DAB | apps release only holds made by clients that have presence; older clients keep today's behaviour until they update |

---

## 13. Decisions for Brian

### 13.1 Decided (Brian, 28/10/2026)

| Question | Decision | Where |
|---|---|---|
| Audio on going back to the launcher | **stops**; no mini player | §6.5 |
| When the last client leaves | **release everything at once**: on goodbye immediately, otherwise when the 30 s lease expires; no linger, no idle grace | §7.3 |
| Separate DAB Radio and Ships TV tiles | **retired**; a "Start in" setting (launcher, last app, or a chosen app) | §6.7 |
| "Leave OpenHamShack?" | **on by default everywhere** (TV, phone, tablet, Apple TV), the setting offered on all | §6.6 |

### 13.2 Still open

1. **Web-view shell on Android?** Recommend **no**: native renderer on
   phones and TVs (Apple TV cannot have a web view, so it would be a second
   UI stack anyway); web stays for the box console and desktop forms.
2. **QO-100 WB:** it has no live source repo, so it cannot serve the new
   contracts. Recommend **give WB a repo again** (from the store app's
   source, under its current name) before step 5; until then the shared
   waterfall shows it through a client adapter.
3. **Apple:** recommend **a dedicated Apple session starting after step 1b**
   (Radio on the Fire TV proves the contracts), and Brian's App Store
   Connect record and API key so TestFlight can carry it to the iPhone,
   iPad and three Apple TVs.
