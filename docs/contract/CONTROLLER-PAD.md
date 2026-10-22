# The shared controller library: `shack_pad`

Status: **design for M1 builders**, 09/10/2026. BETA-PLAN arch change 6:
"the Ajazz AKP03E controller works with every app" through one library that
owns the HID protocol, key images and knobs; apps declare actions and a
default layout; remaps live in the station profile; the platform routes the
pad to the app in front; standalone desktop apps hand it over on focus; PTT
goes through the app's TX lease; the pad shows ON AIR; a pad that
disconnects while keyed stops transmitting. **[guess]** marks the
unverified.

## 1. What exists, and what is kept

The OpenHamShack box already does most of this, in three layers that this
library keeps (`Classic's archived appliance/pad.py` docstring):

| Layer | Today | In `shack_pad` |
|---|---|---|
| **Drivers** | `controllers/base.py` (`Driver`: model, controls, find/open/read/show), `controllers/ajazz.py` (AKP03E: CRT/ACK framing, 1024-byte reports, 64×64 JPEG keys turned a quarter, knobs as one report per detent), `controllers/keypad.py` (any USB keyboard: evdev, `EVIOCGRAB`, auto-repeat ignored) | moved as they are, plus a hidapi transport for Windows and macOS (§8) |
| **Actions** | `pad.py` `ACTIONS`: each action carries its own rules (transmit's two-press arming lives in the action, not a key) | the **mechanism** moves to the library; the **actions themselves** move to each app, as declarations (§3) |
| **Mapping** | `pad.py` `resolve()`: model default + operator changes, up to 4 pages, checked against actions and layout on every read, so a stored map "can only fall back, never misfire"; transmit and the page key fixed on one control on every page; no remapping the transmit key while on air | moved unchanged; storage moves from the box's settings (`controllerMaps`) to the station profile (§5) |

Also kept: the udev rule giving the pad to a group without root and the
`openhamshack-keypad` helper that admits only keypads the operator chose
(`91-openhamshack-pad.rules`, `openhamshack-keypad`), renamed for the platform (§6.1).

Gaps this design closes, found in the code: `Controller.serve()` closes the
device when it disappears and **does not unkey** (`pad.py:934-940`); faces
are drawn with ffmpeg (`controllers/base.py key_image`), which is not on a
Windows or macOS desktop; the action list is one app's.

## 2. The package

Distribution `shack-pad`, import `shack_pad`, Python 3.11+. Core is stdlib;
`shack-pad[hid]` adds `hidapi` (Windows/macOS transport) and `Pillow` (key
images). Lives in `ohs-libs/python/shack_pad` (REPO-LAYOUT.md §2).

```
shack_pad/
  drivers/base.py, ajazz.py, keypad.py      from Classic's archived appliance/controllers/
  transport/hidraw.py, hidapi.py, evdev.py
  actions.py      declaration schema, shared vocabulary, validation
  mapping.py      resolve(), set_binding(), pages: from pad.py
  faces.py        Pillow renderer, brand colours, system fonts, icons
  router.py       events -> the app in front (platform) / this app (desktop)
  tx.py           the pad as a TX lease client (§7)
  focus.py        desktop claim and hand-over (§6.2)
  fake.py         a recorded/fake HID device for tests (§9)
  icons/          64 px PNGs rendered from ~/openhamshack/brand/icons
```

## 3. Action declarations

Each app ships `pad-actions.json` (named by its manifest's
`openhamshack.actions`, CONTROLLER-CONTRACT.md §8; a desktop app bundles the
same file). An action is something the app can do; the app decides what it
means.

```json
{
  "schema": 1,
  "app": "qo100nb",
  "actions": [
    {"id": "tune", "kind": "turn", "label": "pad.tune", "group": "receive",
     "short": ["TUNE", "Hz"], "icon": "tune"},
    {"id": "step", "kind": "press", "label": "pad.step", "group": "receive", "short": ["STEP", ""]},
    {"id": "band", "kind": "turn", "label": "pad.band", "group": "receive"},
    {"id": "mode:next", "kind": "press", "label": "pad.mode_next", "group": "receive"},
    {"id": "mute", "kind": "press", "label": "pad.mute", "group": "audio"},
    {"id": "volume", "kind": "turn", "label": "pad.volume", "group": "audio"},
    {"id": "record", "kind": "press", "label": "pad.record", "group": "receive"},
    {"id": "scope", "kind": "press", "label": "pad.scope", "group": "screens"},
    {"id": "ptt", "kind": "press", "hold": true, "tx": true, "single": true,
     "label": "pad.ptt", "group": "transmit"}
  ]
}
```

| Field | Rule |
|---|---|
| `id` | lower-case, `a-z0-9-:`; unique in the app. Shared vocabulary ids (below) mean the same thing in every app. |
| `kind` | `press` or `turn` (from `controllers/base.py slots`) |
| `label` | a **catalog key** (I18N.md), never English text |
| `group` | `transmit`, `receive`, `audio`, `screens`, `other` (the box's `GROUPS`, plus `audio`) |
| `short` | two short lines for a plain face when the app sends none; a catalog key pair is also accepted |
| `tx` | true for anything that keys: only `ptt` and `transmit` may set it |
| `hold` | true: momentary (key on press, unkey on release). Only with `tx`. |
| `arm` | true: the box's toggle with arming (press, press again within 4 s to key; one press unkeys: `pad.py` `ARM_SECONDS`). Only with `tx`. |
| `single` | at most one control holds it, the same one on every page (`pad.py` `Action.single`) |
| `needs` | optional app capabilities; an action whose need is absent is not offered (the box's `needs`) |

Every `turn` action also gives `<id>:up` and `<id>:down` press actions so a
keypad can do a knob's job (`pad.py _press_pairs`). The library adds
`none`, `none-turn` and `page` itself; on the platform it adds `app:next`
and `app:<kind>`.

**Shared vocabulary** (use these ids where the meaning fits, so a remap
learned in one app carries to the next): `tune` (turn: frequency by the
current step), `step` (press: next step size), `band` (turn), `band:next`,
`mode:next`, `channel` (turn: the app's channel list, e.g. QO-100 channels),
`mute`, `volume`, `record`, `scope`, `receivers` (several receivers: grid →
1 → 2), `preset:<n>`, `ptt`, `transmit`, `power` (turn).

Two transmit actions, by kind of operating:

- **`ptt`** (`hold: true`): voice and CW operating (Radio, QO-100 NB, Icom,
  Flex). Keyed while held.
- **`transmit`** (`arm: true`): long transmissions (QO-100 WB, DATV, ATV),
  exactly the box's K1 behaviour.

An app may declare one or both; both are `single`.

## 4. Default layouts

`pad-layout.json` (manifest `openhamshack.controller_layout`): per model,
the box's `default_map` shape (`controllers/ajazz.py`, `keypad.py`).

```json
{
  "schema": 1,
  "ajazz-akp03e": {
    "K1": {"press": "ptt"}, "K2": {"press": "mute"}, "K3": {"press": "record"},
    "K4": {"press": "mode:next"}, "K5": {"press": "scope"}, "K6": {"press": "step"},
    "B1": {"press": "band:next"}, "B2": {"press": "none"}, "B3": {"press": "app:next"},
    "D1": {"press": "none", "turn": "volume"}, "D2": {"press": "step", "turn": "tune"},
    "D3": {"press": "none", "turn": "band"}
  },
  "keypad": {
    "KPENTER": {"press": "ptt"}, "KPPLUS": {"press": "tune:up"}, "KPMINUS": {"press": "tune:down"},
    "KP0": {"press": "mute"}
  }
}
```

Validated at install and at load: unknown controls, slots a control cannot
take, or actions the app does not declare become `none` with a note, never
an error that stops the pad (`pad.py resolve`). The QO-100 WB app's default
is the box's own map unchanged (`ajazz.py` `default_map`), so the workshop
operator's hands do not have to relearn anything.

Standard placement, so every app agrees: **transmit/PTT on K1** on the
AKP03E and **KPENTER** on a keypad (the box's choice: "the largest key and
furthest from the others", `keypad.py`); app switching, where offered, on B3.

## 5. Remaps, stored in the station profile

The operator's changes are stored per app kind and pad model in the station
profile, so they sync with the controller and follow the operator to a
standalone desktop app:

```json
"controllerMaps": {
  "qo100nb": {"ajazz-akp03e": {"pages": [{"K6": {"press": "record"}}, {"K2": {"press": "preset:1"}}]}}
}
```

Same shape as the box's `controllerMaps[model].pages` (`pad.py
stored_pages`), now one level deeper by kind. Each `controllerMaps.<kind>.<model>`
is one sync field (SYNC.md §4.2). The library's `set_binding`, `set_pages`
and `reset` keep their checks: `single` actions only on page 1 and fixed on
every page; **the transmit key cannot be moved or removed while that app is
on air** (`pad.py _on_air_guard`).

Writing the profile needs `transmit` on some app (SERVICES.md §1). A
controller with a pad attached edits maps from its local screen (the
`local` device has it); a desktop edits its own profile and syncs.

## 6. Who owns the pad

One owner at a time; the owner routes events to exactly one app.

### 6.1 On the controller: the input host service

- A platform host service, `shack-input`, owns every pad and chosen keypad on
  the controller (D9: the kiosk agent owns them; PLATFORM-PLAN §1.3: "local
  screen, touch, pads, keypads … never passed to apps"). The udev rules give
  the AKP03E's hidraw node and the chosen keypads' event nodes to group
  `shack-input` only (`91-openhamshack-pad.rules`, from the box's
  `91-openhamshack-pad.rules`); apps never see them.
- The kiosk tells `shack-input` which app is in front (`foreground: kind`).
  `shack-input` loads that app's actions (from its manifest file) and layout,
  resolves the operator's map, redraws every key, and sends that app the
  pad's actions:

  ```http
  POST <app base>api/shack/pad/action
  Authorization: Bearer shackdev_<local-screen token>
  {"action": "tune", "kind": "turn", "step": -2, "control": "D2", "model": "ajazz-akp03e",
   "pad": "pad-ctl-ajazz-akp03e"}
  ```

  through Caddy on loopback, so it passes `forward_auth` as the `local`
  device (CONTROLLER-CONTRACT.md §4.5) and is held to that device's levels
  like any other client.
- **Faces** come from the app:

  ```http
  GET <app base>api/shack/pad/faces          (or …/faces/stream, server-sent, on change)
  {"faces": {"tune": {"l1": "10489.540", "l2": "MHz", "tone": "normal"},
             "ptt":  {"l1": "ON AIR", "l2": "", "tone": "onair"},
             "record": {"l1": "REC", "l2": "on", "tone": "active"}},
   "onAir": true}
  ```

  `l1`/`l2` are already translated by the app (I18N.md). `tone` is one of
  `normal`, `active`, `info`, `warn`, `onair`, `disabled`, `big` (a large
  number with a caption, the box's `big` face); the library maps tones to
  the brand colours (`~/openhamshack/brand/tokens/tokens.json`), so every
  app's ON AIR is the same red. An action the app sends no face for shows
  its `short`.
- **Switching apps:** `app:next` / `app:<kind>` ask the kiosk to bring an
  app forward; the kiosk confirms, then `shack-input` switches layouts.
- **An app on air keeps its transmit key** (§7.3), whatever is in front.

### 6.2 Standalone desktop apps (Linux, Windows, macOS)

No platform, no service, and no listening socket (the "no servers inside
desktop apps" rule): the pad belongs to whichever OpenHamShack app the
operator is using, through a lock file.

- Per user: `<store dir>/pad/<model>.lock` (the store dir of SYNC.md §2.1).
  The owner holds an OS file lock on it (`fcntl.flock` / `LockFileEx`) for
  as long as it has the device open. A crashed owner's lock is released by
  the OS.
- An app that **gains focus** writes `<model>.want` (`{"pid": …, "app":
  "shack-radio", "at": …}`) and waits for the lock.
- The owner checks `<model>.want` every 250 ms; when another app wants the
  pad and **this app is not on air from the pad**, it blanks the keys,
  closes the device and releases the lock (target: hand-over under 1 s).
  While on air it keeps the pad until unkeyed, and the new app's keys stay
  blank with a "QO-100 NB is on air" face on K1 **[decision: shown on the
  pad, not hidden]**.
- An app that loses focus does nothing until asked, so switching to a
  browser does not take the pad away from the last OpenHamShack app.
- Paired with a controller or not makes no difference: a pad plugged into
  the desktop is that desktop's hardware.

Desktop apps call their own action handlers in process; there is no HTTP on
the desktop path.

## 7. Transmit through the pad

### 7.1 The pad is a lease client

The pad never keys anything itself. A `tx` action makes the library a
client of the app's ordinary transmit lease (CONTROLLER-CONTRACT.md §6.1;
REMOTE-API §7), with client id `pad-<host>-<model>`:

| Action | Press | Release | While keyed |
|---|---|---|---|
| `ptt` (hold) | `POST api/ptt {"on": true, "remote": "pad-…"}` | `POST api/ptt {"on": false}` | heartbeat every 1 s |
| `transmit` (arm) | first press arms (face ARM, 4 s); second press keys; on air one press unkeys | — | heartbeat every 1 s |

So every check an app makes for any client (level, transmit switch, licence
and band plan, broker claim and `onair`: CONTROLLER-CONTRACT.md §6.2) applies
to the pad too. A refused key-up is a `200` with `txError`; the library
shows it on the key (`TX` / the first words of the reason, tone `warn`) and
flashes it on the status key, as the box does with `txBlocked`
(`pad.py _transmit_face`). On a desktop the same calls are made in process
to the app's lease object, with the same timings.

### 7.2 Disconnect while keyed

`read()` raising `OSError` (unplugged, USB reset, hub power) is the signal:

1. If this pad keyed a transmission that is still on (held `ptt`, or a
   `transmit` it keyed), send `api/ptt {"on": false}` **at once**, before
   anything else, and stop heartbeats. Target under 0.5 s from the error.
2. Then close the device and look for it again (`pad.py run`).
3. If the library's process dies instead, its heartbeats stop and the app's
   5 s lease unkeys (REMOTE-API §7); the broker's 6 s on-air lease is behind
   that (CONTROLLER-CONTRACT.md §6.3).

A pad that comes back does not re-key, whatever was held.

### 7.3 ON AIR on the pad

- The `ptt`/`transmit` key shows `ON AIR` (tone `onair`) whenever **its
  app** is on air, keyed from the pad or not (status `onAir`), with the
  time-out countdown in its last minute (`pad.py _transmit_face`).
- On the controller, if **any** app is on air (broker state), the pad shows
  it: the on-air app's transmit key stays bound to that app on its control,
  whatever app is in front, so the key that stops the carrier never moves.
  Other keys follow the front app.
- Momentary `ptt` held while the operator switches apps: the switch waits
  for release.
- Auto-repeat never presses (`keypad.py decode` drops value 2), so a held
  keypad key cannot step into keying by itself.

## 8. Drivers and transports

| Platform | AKP03E | USB keypad |
|---|---|---|
| Linux (controller, desktop) | hidraw, as today (`ajazz.find_device`: interface `input0`, not the keyboard face) | evdev with `EVIOCGRAB`, only the chosen devices (`keypad.py`) |
| Windows | hidapi, the vendor collection chosen by usage page 0xFFA0 / usage 1 (as mirajazz/opendeck-akp03; interface 0 only as a fallback), write with report id 0 prefix; Windows does not refuse a second opener, so `shack_pad.diagnose` looks for the makers' Stream Dock software (ohs-libs 373333d) **[guess: no real pad on Windows yet]** | no exclusive grab: the focused app reads keys from its own window (Qt key events, the webview's key events) and maps them through the same action map, model `keyboard` |
| macOS | hidapi (IOHIDManager) **[guess: whether a vendor-usage HID device needs Input Monitoring permission]** | as Windows |

- Key images: Pillow, 64×64 JPEG, turned per model (AKP03E: a quarter
  clockwise, measured: `ajazz.py` docstring), cached with the box's bound
  (`JPEG_CACHE_MAX = 400`). Text in the platform's **system** font (DejaVu
  Sans Bold on Linux as today, Segoe UI Bold on Windows, the system font on
  macOS **[guess: paths]**): the brand rule is system faces only, nothing
  vendored (`~/openhamshack/brand/README.md`). Icons are our own PNGs,
  rendered from `brand/icons` by the brand build.
- Only changed keys are written (the box's `shown` cache: a key is 2-3 kB
  of USB).
- Other Mirabox/Ajazz models are subclasses once measured (`ajazz.py`
  docstring); nothing else in the library names a model.

## 9. Tests

The driver and router are exercised against `shack_pad.fake.FakeHid`, which
replays captured reports and records writes, in CI on all three operating
systems. Ported from `Classic's archived appliance/test_pad.py` (decode as captured,
noise ignored, wake sequence, image framing, finding the vendor interface,
two-press arming, presets, faces) and added:

1. **Disconnect while held:** `ptt` held, fake raises `OSError` → `api/ptt
   {"on": false}` sent within 100 ms; nothing re-keys on reconnect.
2. Disconnect while a `transmit` keyed from the pad is on air → unkeyed.
3. Library killed while held → the fake app's lease unkeys at 5 s.
4. Auto-repeat on a keypad never produces a press.
5. On-air pinning: app A on air from the pad, app B brought forward → K1
   still stops A; other keys are B's.
6. Desktop hand-over: two processes, focus moves → the second owns the pad
   within 1 s; the owner on air refuses until unkeyed; a killed owner's lock
   frees.
7. Mapping fallbacks: an unknown action, a control the model lacks, a turn
   on a key, `transmit` on page 2 → each falls back with a note (the box's
   `resolve` cases), and the transmit key cannot be remapped while on air.
8. A view-level device cannot drive `ptt` through the pad (the proxy
   refuses; the key shows the reason).

**Real pad:** workshop's AKP03E, **read-only**: key, button and knob events
and LCD images only, never a transmit action (BETA-PLAN arch change 6). Only
with Brian's go-ahead for that exact check, since workshop is a live box.
