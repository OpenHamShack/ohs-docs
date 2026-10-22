# OpenHamShack Remote: one set of remote-control keys for every face

Status: **design, 11/10/2026**, not built. Written against openhamshack-remote
`main` d1bc93c, with the in-flight branch `feature/face-fullscreen-controls`
(20f6ecc plus uncommitted Flex work, `~/wt/face-fullscreen-controls`) read
but not touched. **[guess]** marks anything not verified in code or a
vendor document. Decisions for Brian are in §8; until he answers them, the
map in §4 is the recommendation, not the rule.

Brian's ask (11/10/2026): every face of the Remote (QO-100 NB, Radio, Icom,
Flex, ATV, DATV, WB and any later one) uses the same remote-control keys:
the D-pad and OK, Back, Menu, the media keys and anything else a Fire TV or
Android TV remote sends that an app can receive.

## 1. What a remote can send to an app

From Amazon's Fire TV remote-input page
(developer.amazon.com/docs/fire-tv/remote-input.html, read 11/10/2026):

| Button | Android key code | Reaches the app? |
|---|---|---|
| Up / Down / Left / Right | `DPAD_UP/DOWN/LEFT/RIGHT` | yes |
| Select (OK) | `DPAD_CENTER` | yes |
| Back | `BACK` | yes |
| Menu (three lines) | `MENU` | yes |
| Play/Pause | `MEDIA_PLAY_PAUSE` | yes |
| Rewind / Fast-forward | `MEDIA_REWIND` / `MEDIA_FAST_FORWARD` | yes |
| Channel up / down | `CHANNEL_UP` / `CHANNEL_DOWN` | yes, on remotes that have them |
| **Home** | none | **no**: "a system event and cannot be intercepted" |
| **Voice / microphone** | none | **no**: "Invoke the system voice search. This is a system event and cannot be intercepted." |
| Volume, power, app shortcut buttons (Prime, Netflix…) | none | no: they go to the TV (CEC/IR) or the system |
| Mute, Live/Guide, Recent apps | not listed | **[guess]** no; treat as unavailable |

So the voice key cannot be used, on Fire TV for certain. On Google TV
remotes (Brian's TCL) the Assistant key is also handled by the system
**[guess: not measured; nothing in our code has ever seen it]**.

Every key that does arrive also gives us, for free, a **hold** (Android
repeats the key down while held, `repeatCount > 0`, after about half a
second) and its key-up. Holds are already in use: the in-flight Icom face
types a frequency on OK held (`radio/RadioControls.kt`, branch
face-fullscreen-controls).

Two constraints follow:

- **D-pad, OK and Back are the only keys every remote has.** Fire TV
  remotes have Menu and the media keys; Google TV remotes commonly do not
  **[guess for the TCL: to measure, §9]**. So every action must be
  reachable with D-pad, OK and Back alone. Menu, the media keys and the
  channel keys are **accelerators**, never the only way.
- **Apple TV's Siri Remote is smaller still:** move (clickpad/touch),
  Select, Back (Menu on the first-generation remote), Play/Pause; TV/Home,
  Siri and volume belong to the system. No Menu key in Android's sense, no
  rewind or fast-forward keys **[guess: the second-generation ring's
  skip gestures only reach a Now Playing session]**.

Keyboard and gamepad aliases, so a tablet's keyboard or a Bluetooth pad
gets the same map: Enter, NumPad Enter → OK; Escape → Back; Page Up/Down →
channel up/down; `MEDIA_PLAY`/`MEDIA_PAUSE` → Play/Pause; `INFO` → help.
Gamepad A/B arrive as `DPAD_CENTER`/`BACK` through Android's fallback keys
when unhandled **[guess: Generic.kcm fallbacks, not tested]**.

## 2. The faces today

Which screen a kind opens: `ui/TvShack.kt:89-95` (Android TV). The `Kind`
enum (`shack/ShackProtocol.kt:14`) has QO100WB, QO100NB, RADIO, DATV, ICOM,
FLEX: **ATV and Digital Modes have no Remote face yet**, and are listed but
not opened. Apple TV has only the Classic/WB watch screen
(`ios/TV/TVViews.swift`).

Paths below are under `android/app/src/main/java/com/openhamshack/remote/`
unless they start with `kind-stationflow/` (under
`android/kind-stationflow/src/main/java/com/openhamshack/kind/stationflow/`)
or `core/` (under `android/core-candidates/src/main/java/com/openhamshack/core/`).

| Face | Screen | Key handling |
|---|---|---|
| **WB** (Classic box and the platform `qo100wb` app) | `TvWatch`, `ui/TvUi.kt:448` | root `onKeyEvent` `ui/TvUi.kt:513-529`; Back `:465`; tune panel `ui/TvTune.kt:84,166-176`; QO-100 list `ui/TvQo100.kt:73` |
| **DATV** | `TvDatv`, `ui/DatvScreens.kt:208` | root `onKeyEvent` `:232-236`; Back `:219`; panel Back `:271` |
| **NB / Radio** | `TvEngine`, `ui/TvEngine.kt:109` | waterfall `onPreviewKeyEvent` `:200-224`; Back `:133-139`; picker `:416-425` (`shack/Picker.kt`, 8 s idle close `:34`); decoder panel `:493-498`; transient hints `shack/KeyHints.kt` |
| **Icom**, radio-shaped face (IC-9700/7610/705) | `RadioFaceTv` via `kind-stationflow/ui/StationFlowTvScreen.kt:213` | face controls `kind-stationflow/radio/RadioControls.kt:91-130`; screen-wide keys `StationFlowTvScreen.kt:191-201`; Back `:164` |
| **Icom**, plain layout (other radios) | `StationFlowTvScreen.kt:225-270` | dial `:362-372`; chips `:447-466` |
| **Flex** | `TvFlex`, `ui/FlexScreens.kt:102` | display `onPreviewKeyEvent` `:148-160`; Back `:124`; side pages, Left/Right levels `ui/FlexControlsUi.kt:200,231-235` |
| ATV, Digital Modes | none | — |
| **Apple TV** (WB only) | `ios/TV/TVViews.swift:146-170` | `onPlayPauseCommand`, `onMoveCommand`, `onExitCommand` |

Shared already: Back routed by hand to the innermost `BackHandler`
(`core/tv/TvKit.kt:255-270` `rememberBackRouting`; the same code inline in
`ui/TvUi.kt:145-149`), and `LocalTvInert` (`core/tv/TvKit.kt:145`) making
the screen under an overlay unfocusable (GUIDE §5). Nothing else is shared:
each face reads raw `Key`s in its own `when`.

## 3. Inventory: face × key, main screen with nothing open

"Surface" is where focus starts: WB/DATV the picture, NB/Radio the
waterfall, Icom the dial, Flex the display.

| Key | WB | DATV | NB / Radio | Icom (face) | Flex |
|---|---|---|---|---|---|
| **Left / Right** | nothing with the info overlay hidden; between its Tune/QO-100 buttons when shown (`TvUi.kt:528`) | nothing | **tune** ± step, repeats (`TvEngine.kt:204-205`) | **tune** ± step, repeats (`RadioControls.kt:117-118`) | **tune** ± step, repeats (`FlexScreens.kt:152-153`) |
| **Up** | **previous channel** (`TvUi.kt:521`) | nothing | **open picker**: bookmarks, then modes (`TvEngine.kt:206-213`) | main: from keys back to the dial. Branch: dial → **badges** (mode, filter, P.AMP/ATT, VFO) | **step larger** (`FlexScreens.kt:154`) |
| **Down** | **next channel** (`:522`) | nothing | focus to the **decoder panel** (`:214-217`) | dial → **MODE key** (`RadioControls.kt` `down = keyFocus[1]`). Branch: dial → **scope**, then keys | **step smaller** (`:155`) |
| **OK** | toggle **info overlay** (key down) (`:517-520`); on the overlay's Tune button, open the tune panel | toggle **info overlay** (key down) (`:235`) | open **controls row** (key **up**) (`:220-222`) | **cycle step** (one way, wraps). Branch: on key up; **held → type frequency** | open **extras** (modes, bands, receive controls) (`:156`) |
| **Back** | hide overlay, else leave | hide overlay, else leave | close picker/controls, else leave | leave (panels close themselves) | close extras/page, else leave |
| **Menu** | **tune panel** (`:524`) | **tune panel** (`:236`) | nothing | **Tune panel** (`StationFlowTvScreen.kt:201`) | **NR on/off** (`:160`) |
| **Play/Pause** | toggle **info overlay** (`:517`) | nothing | nothing (mute only in the controls row) | **mute** (`:196`) | **mute** (`:159`) |
| **Rewind / FF** | nothing | nothing | **step** smaller/larger (`:218-219`) | **tune** ± step (`:199-200`) | **tune** ± step (`:152-153`) |
| **Ch+/− , PgUp/Dn** | previous/next channel | nothing | **step** (`:218-219`) | **band** ± (`:197-198`) | **band** ± (`:157-158`) |
| **Info** | toggle overlay (`:529`) | nothing | nothing | nothing | nothing |
| **Space** | toggle overlay | nothing | nothing | nothing | nothing |
| **OK held** | nothing | nothing | nothing | branch: type a frequency | nothing |
| **Transmit** | none on TV (contract) | none | none | none | none |
| **Key help** | one line in the info overlay | one line in the overlay (`datv_tv_keys`) | transient hints for keys not yet used (`KeyHints.kt`) | a permanent hint line for what has focus (plain layout only) | a hint naming the step for 6 s |

### Where they disagree

1. **Step size** is on five different keys: NB rewind/FF and channel;
   Flex Up/Down; Icom OK (one way only); WB's tune panel step chips. A
   Flex user who goes to NB and presses Up gets a picker; an NB user who
   presses OK on Icom changes the step.
2. **Rewind/FF** tune on Icom and Flex, which only repeats Left/Right, but
   change the step on NB.
3. **Channel up/down** change the step (NB), the band (Icom, Flex) or the
   channel (WB).
4. **Menu** opens tuning (WB, DATV, Icom), switches NR (Flex) or does
   nothing (NB).
5. **Play/Pause** mutes (Icom, Flex), toggles the overlay (WB) or does
   nothing (NB, DATV). NB and DATV have no mute key.
6. **Up/Down** mean four things: channel (WB), picker/decoder (NB), focus
   movement (Icom), step (Flex). Icom's own comment
   (`StationFlowTvScreen.kt:110-116`) argues Up/Down must stay movement;
   NB's (`TvEngine.kt:85-101`) gives Up to an overlay. Both are deliberate.
7. **OK** opens controls (NB, Flex), changes the step (Icom) or toggles an
   overlay (WB, DATV), and fires on key **down** (WB, DATV, Flex) or key
   **up** (NB; Icom on the branch). NB moved to key up so the release could
   not land on the screen that opened (`TvEngine.kt:400-406`).
8. **Global keys only work from the surface** on NB and Flex (their
   handlers sit on the waterfall/display), but from anywhere on the main
   screen on Icom (`StationFlowTvScreen.kt:191`). On NB, with the decoder
   panel focused, rewind/FF do nothing.
9. **Help** is four different things and none of them lists every key.
10. **Back** already agrees (innermost overlay first, then leave), except
    that WB and DATV treat their info overlay as something Back closes.
    That is consistent enough to keep.

## 4. The standard map

Principles, in order:

1. **The same key does the same job on every face.** What the job means
   can differ (on a radio Left/Right tunes the dial; on a video receiver it
   changes channel), but the job doesn't.
2. **D-pad, OK and Back reach everything.** Menu, media and channel keys
   are accelerators.
3. **Nothing transmits from one press.** (§5)
4. **Back closes before it leaves.** Back never leaves a face while
   anything is open over it, and never while this device has the
   transmitter (§5).
5. **Accelerators work from anywhere on the main screen**, whatever has
   focus, as Icom does now; inside an overlay only Back, mute and the
   transmit keys reach beyond it.
6. **OK acts on key up** (a press) or at the first repeat (a hold), never
   on key down, so a release cannot land on whatever just opened.

Two face classes: **radio** faces (NB, Radio, Icom, Flex, later Digital
Modes) and **video** faces (WB, DATV, later ATV).

| Key | Job | Radio faces | Video faces | Why |
|---|---|---|---|---|
| **Left / Right** | change what you receive, by the smallest move | tune − / + one step; held, runs on | previous / next channel (presets, receivers, channels in the band); one per press, no repeat (each retune costs the tuner a lock, `TvTune.kt` comment) | Already tuning on 3 of 4 radio faces; on a video face it makes "Left/Right changes what I'm watching" true everywhere. |
| **Up** | **choose**: open the Choose overlay | modes, then bookmarks/bands (NB's picker generalised; Icom's MODE/FIL grids; Flex's mode and band rows) | channels and band presets as a list | The thing changed most after frequency is the mode; Brian asked for a mode overlay; on every remote; NB already proves it. |
| **Down** | move into the face's controls | Icom: the scope, then the keys along the bottom; NB/Radio: the decoder panel; Flex: the docked panel | the info overlay's buttons (Tune, QO-100) | Down to the controls on screen; Up from the top control returns to the surface. Inside the controls the D-pad moves by focus, as Icom's comment wants. |
| **OK** (press) | **quick controls** | a row at the foot of the screen: Step, Mute, NR, Span/Zoom, Frequency…, Decoder, Log, Settings (each face lists what it has) | show/hide the info overlay, focus on its first button | NB, Flex, WB and DATV already open their controls on OK. Icom gives up "OK = step"; Step is first in the row, so OK, OK still changes the step. |
| **OK** (held ½ s) | type a frequency | the frequency dialog | the same (DATV, WB) | The branch's Icom gesture; every radio and video face already has the dialog somewhere. |
| **Back** | close, then leave | innermost overlay; then leave for the apps | info overlay; then leave | Unchanged. While this device has the transmitter, Back **stops transmitting** and does nothing else. |
| **Menu** | **settings** | the face's settings panel (Icom SET, Flex pages, NB scope look/audio/decoder options) | the Tune panel (band, rate, frequency, receiver): a video face's settings | Android's meaning of Menu; already the tune panel on WB, DATV and Icom. Flex's NR moves into quick controls. |
| **Menu** (held) | key help | the legend (§6.2) | the legend | Fire TV has no Info key. |
| **Play/Pause** | **mute / unmute** | mute | mute the picture's sound | Mutes already on Icom and Flex; "pause" is what a viewer expects. WB's overlay toggle stays on OK and Info. |
| **Play/Pause** (held 1 s) | **arm transmit** | §5 | §5 | A hold is distinct from the mute press; see §5. |
| **Rewind / FF** | coarser change | step size smaller / larger (shown for a moment) | band down / up (2 m, 70 cm, 23 cm…; QO-100 presets) | Gives step a key pair on remotes that have one; tune already has Left/Right. |
| **Channel ± , Page Up/Down** | bigger jump | band ± (Radio, Icom, Flex); NB, which has one band: bookmark ± | channel ± (as Left/Right) | Band on two faces already; matches a TV's channel keys. |
| **Info, F1, ?** | key help | legend | legend | Where the remote or keyboard has one. |
| **Digits 0-9** | type | open the frequency dialog with the digit typed | ATV: teletext page number. Others: frequency dialog | **[guess]** Only some Google TV remotes and keyboards have them. |
| **Colour keys** | reserved | — | ATV: teletext Fastext | Kept free for teletext. |
| **Home, Voice** | — | not received | not received | §1 |

Inside overlays: arrows move within the overlay, OK picks (on key up),
Back closes; the screen beneath is inert (`LocalTvInert`). Overlays that
only offer choices (Choose, quick controls) close by themselves after 8 s
without a key, as NB's picker does (`shack/Picker.kt:34`). Panels that
edit settings do not time out.

Per-face meaning of the map, where it is not obvious:

| Face | Up (Choose) | Down | Quick controls (OK) | Menu (settings) |
|---|---|---|---|---|
| NB | bookmarks, modes | decoder panel | Step, Mute, Span, Frequency, Log, Decoder, Auto-open, Transmit… | scope look, audio, decoder options |
| Radio | bands, bookmarks, modes | decoder panel | as NB, without band ± (band is on Choose and Ch±) | as NB |
| Icom | modes (MODE grid), filter (FIL grid), bands | scope (adjust mode on OK, branch), then keys | Step, Mute, P.AMP/ATT, VFO, Frequency, Decodes, SSTV | the SET panel (branch `FacePanels.kt`) |
| Flex | modes, bands | docked panel | Step, Mute, NR, Frequency, Decodes | Noise, AGC, RF, Antenna, Decoder, Pictures pages |
| WB | channels, presets, QO-100 signal list | info overlay buttons | (the info overlay) | Tune panel |
| DATV | bands, channels | info overlay buttons | (the info overlay) | Tune panel |
| ATV | channels; teletext on digits | info overlay buttons | (the info overlay) | Tune panel |
| Digital Modes | modes, bookmarks | decodes list | Step, Mute, Enable TX…, Halt | options |

### What each face's users will notice

- **WB (and the Apple TV twin):** channel moves from Up/Down to
  Left/Right; Up opens a channel list; Play/Pause mutes instead of
  toggling the overlay (OK and Info still do).
- **DATV:** gains channel keys, band on rewind/FF, mute.
- **NB/Radio:** gains mute (Play/Pause), settings (Menu), band
  (Radio, channel keys); channel keys stop changing the step; OK held types
  a frequency.
- **Icom:** OK opens quick controls instead of cycling the step (Step is
  their first item); rewind/FF change the step instead of tuning; Up from
  the dial opens the mode overlay rather than reaching the badges (the
  badges stay reachable from the Choose overlay's rows and by touch).
- **Flex:** Up/Down no longer change the step (rewind/FF and quick
  controls do); rewind/FF no longer tune; Menu opens settings and NR moves
  to quick controls.

## 5. Transmit from a remote

### 5.1 Today, and the contract

TVs cannot transmit at all, and the remote map must not quietly change
that:

- The controller caps a TV at the `control` level and it cannot be raised
  (`contract/CONTROLLER-CONTRACT.md:192-193`, "TV kinds never ask for
  transmit": GUIDE §2); a TV's request to `api/ptt*` is refused (`:541-542`).
- Remote's Icom and Flex kinds have no transmit path on any device
  (openhamshack-remote `docs/REMOTE-CONTRACT.md` §13).
- A phone or tablet keys with a 1 s on-screen hold, and stops with one tap
  (`REMOTE-CONTRACT.md` §5).

So everything in §5.2 is the **shape the keys take when** Brian allows
transmit from a TV (decision 5, §8). Until then the transmit gestures show
"Transmit from a phone or at the station" and send nothing.

### 5.2 One transmit key, armed then confirmed

A TV has no microphone that an app can use (the voice key is the
system's, §1), so **voice PTT has no place on a TV**. What a remote can
sensibly start is a transmission whose source is at the station:

| Face | What "transmit" means | Pad action it matches (`contract/CONTROLLER-PAD.md` §3) |
|---|---|---|
| NB, Radio, Digital Modes, in a digital mode | **Enable TX**: the engine sends at its next slots (the operator-armed auto-TX being built for NB, `~/wt/nb-digi-autotx`, branch empty when read) | `transmit` (arm) |
| NB, Radio in a voice or CW mode | not offered on a TV ("needs a microphone: use a phone or the station") | — |
| WB, DATV, ATV | **transmit** the station's source (camera, file, test card) | `transmit` (arm) |
| Icom, Flex | not offered: receive-only kinds (REMOTE-CONTRACT §13) | — |

The gesture, the same on every face:

1. **Arm:** hold **Play/Pause for 1 s**, or press OK on **Transmit…** in
   quick controls (the D-pad-only path). A red overlay names exactly what
   will happen: "Enable TX: FT8, 14.074 MHz, CQ GM4BRI IO75" or "Transmit
   on 2 m DATV, 437.000 MHz, 333 kS, camera", with a 5 s countdown ring.
   Nothing is sent yet.
2. **Confirm:** press **OK** or **Play/Pause** within 5 s. Only now does
   the client key (the lease: `{"on": true, "remote": …}`, heartbeats
   after the answer, GUIDE §2), or enable TX.
3. **Disarm:** any other key, Back, or the 5 s running out. Nothing was
   sent.
4. **Stop:** while this device is on air or has TX enabled, **any key
   stops it**: unkey, Enable TX off, and the key does nothing else. One
   press, whatever it is, in every state, as the contract wants stopping
   to be (REMOTE-CONTRACT §5, "Stopping is one tap").
5. The usual stops still apply: app to the background, screen off
   (`ACTION_SCREEN_OFF`), the Fire TV's screensaver or sleep, network loss
   (REMOTE-CONTRACT §5), and the box's 5 s lease.

Why this shape:

- **A press of Play/Pause is mute**, so "press twice within 4 s" (the
  pad's and console's arming) would turn mute-then-unmute into a
  transmission. A 1 s hold is never an accidental press, and a hold
  followed by a separate press within 5 s, with the overlay in between
  naming the frequency, is two deliberate acts.
- **Hold-to-talk on a TV remote fails unsafe.** A remote whose release
  never arrives (Bluetooth drop, flat battery) leaves the key held
  **[guess: whether Android sends a cancelled key-up on a Bluetooth remote's
  disconnect]**; the lease would end it after 5 s, but "any key stops" plus
  a toggle with a lease does not depend on a key-up at all.
- **Enable TX is a state, not a key held:** a digital-mode QSO runs for
  minutes. Its dead-man is the device's lease: Enable TX from a TV must
  stop when the TV's heartbeats stop. That is a requirement on the
  auto-TX work's server side (Enable TX owned by a client id, heartbeated,
  like PTT) **[guess: the auto-TX agent's design was not readable; the
  branch had no changes]**.
- **"Any key stops" makes the remote useless for anything else while
  transmitting.** That is deliberate for WB/DATV/ATV. For a digital QSO
  that runs on its own it means watching, not tuning, until it ends;
  decision 7 offers the alternative.
- On a **phone or tablet** nothing changes: the on-screen 1 s hold
  (REMOTE-CONTRACT §5). A keyboard or Bluetooth remote on a tablet gets the
  same arm/confirm keys as a TV, through the same dispatcher.

Testing: only against the fakebox and a fake lease (GUIDE §4); never a
real transmitter without Brian present (GUIDE §1).

## 6. The shared implementation

One key layer in core that every face plugs actions into, so the map
exists once and the help overlay is generated from it. All new code goes
in `:core-candidates` (both the app and `:kind-stationflow` depend on it).
Under `android/core-candidates/src/main/java/com/openhamshack/core/`:

### 6.1 Files

| File | What | Tests (JVM, pure Kotlin) |
|---|---|---|
| `keys/RemoteKey.kt` | `enum RemoteKey { LEFT, RIGHT, UP, DOWN, OK, BACK, MENU, PLAY_PAUSE, REWIND, FAST_FORWARD, CHANNEL_UP, CHANNEL_DOWN, INFO, DIGIT_0..9 }` and `fromKeyCode(Int): RemoteKey?`, the alias table of §1 (Enter, Escape, Page Up, MediaPlay…). Takes Android key codes as ints so it needs no Compose. | `RemoteKeyTest`: every alias |
| `keys/Gesture.kt` | `KeyGestures`: down / repeat / up in, `Press`, `Hold` (first repeat after ½ s; 1 s for transmit), `Repeat` out. OK and Play/Pause decide on key up unless a hold fired; arrows act on down and repeats. | `GestureTest`: press vs hold, a hold never also presses, repeats |
| `keys/RemoteAction.kt` | The action vocabulary, using `shack_pad`'s shared ids where they exist (`contract/CONTROLLER-PAD.md` §3) so a pad and a remote mean the same thing: `tune:down/up`, `step:down/up`, `band:prev/next`, `channel:prev/next`, `choose`, `controls`, `focus:down`, `frequency`, `settings`, `help`, `mute`, `transmit` (arm), `back`. | — |
| `keys/KeyMap.kt` | **The map in §4 as one table**: `(FaceClass, RemoteKey, Gesture) → RemoteAction`. Faces never see raw keys. | `KeyMapTest`, driven by the shared vectors file below |
| `keys/TxArm.kt` | The §5.2 state machine: `Idle → Armed(untilMs) → On`, `key(…)` returns `Arm`, `Confirm`, `Disarm`, `Stop`; any key while `On` is `Stop`; nothing but `Confirm` from `Armed` keys. Pure, like `PickerFocus`. | `TxArmTest`: single press never keys; timeout disarms; every key stops; mute press while armed disarms |
| `tv/RemoteKeys.kt` | Compose glue. `interface FaceKeys { val faceClass; fun can(a: RemoteAction): Boolean; fun perform(a: RemoteAction, repeat: Boolean) }`. `Modifier.remoteKeys(face, tx)` on the face's root: `onPreviewKeyEvent` for the transmit guard only (it must win over a focused control), `onKeyEvent` for the rest (after the focused control has had its turn). Also an overlay stack (`rememberOverlays()`) that provides `LocalTvInert`, routes Back to the top overlay, puts focus back on the surface when one closes, and runs the 8 s idle close. Folds in `rememberBackRouting` (`tv/TvKit.kt:255`). | instrumented: one smoke test per face on `ohsr-tv` |
| `tv/QuickControls.kt` | The OK row: a face passes a list of `QuickControl(label, action/onClick, selected)`; the same look and focus rules everywhere (NB's controls row is the model, `ui/TvEngine.kt:312-347`). | — |
| `tv/ChooseOverlay.kt` | The Up overlay: rows of choices, highlight moved by the D-pad, OK picks on key up. Generalises NB's picker (`shack/Picker.kt`, `ui/TvEngine.kt:400-470`) and reuses the branch's `ChoiceOverlay` (`core/tv/Panels.kt` on face-fullscreen-controls) for grids. | `ChooseTest` (from `PickerTest`) |
| `tv/KeyLegend.kt` | §6.2 | `KeyLegendTest`: the legend lists exactly the keys `KeyMap` binds to actions the face `can` |
| `tv/TxOverlay.kt` | The armed/on-air overlay: what will be sent, the countdown ring, ON AIR with the clock, "any key stops". | — |

`shack/KeyHints.kt` (app) moves to `core/keys/KeyHints.kt`, keyed by
`RemoteAction` instead of NB's own enum, and becomes the transient
half of the legend.

Shared vectors: `openhamshack-remote/docs/remote-keys.json`, a list of
`{class, key, gesture, action}` that `KeyMapTest` reads on Android and the
Swift test reads on Apple, as `FormatVectorsTest` does for i18n
(`app/src/test/java/com/openhamshack/i18n/FormatVectorsTest.kt`). The two
platforms then cannot drift from each other.

Each face then shrinks to an implementation of `FaceKeys`: what `choose`,
`controls`, `settings`, `focus:down` open; how it tunes, steps and mutes;
whether it has a band. Its own `when (e.key)` blocks (§2) go. Controls
inside a face that need the arrows for themselves (Icom scope adjust mode,
Flex level rows `FlexControlsUi.kt:231`, WB's frequency nudge
`TvTune.kt:166`, the SSTV viewer) keep their own handlers: they run first,
because they hold focus.

### 6.2 The key legend

- **Transient hints** (NB's behaviour, now everywhere): on opening a face,
  for 6 s, the keys not yet used; again for 4 s the first time each is
  used (`KeyHints.OPEN_MS`, `AGAIN_MS`).
- **The legend:** Menu held, Info, F1/?, or "Remote keys" at the end of
  quick controls. A full-screen panel drawing a Fire TV remote's outline
  in our own vector shapes (no external assets) with a label beside each
  key for **this face and this state**: built from `KeyMap` and the face's
  `can()`, in the face's words from the catalog (I18N), so it cannot
  disagree with what the keys do. Keys the face does not use are shown
  dimmed with "—", Home and Voice as "the TV's own". Back closes it.
- When transmit is armed or on, the legend line in the TX overlay
  replaces the hints: "OK or ▶❚❚ to start · any other key cancels" /
  "Any key stops".

### 6.3 The change checklist (GUIDE §3)

1. **Contract:** openhamshack-remote `docs/REMOTE-CONTRACT.md` gains a "Remote
   keys" section pointing here; §13's "no transmit path" stands until
   decision 5. If Brian allows TV transmit, `contract/CONTROLLER-CONTRACT.md`
   §4 (TV `maxLevel`) changes first, and the auto-TX contract needs an
   Enable TX lease.
2. **Server:** none for the keys. Mute is client-side on every face
   **[guess for WB/DATV: the player has no mute today; it needs one in
   `player/RxPlayer.kt`]**. Enable TX lease: the auto-TX work.
3. **Fake:** none for the keys; transmit tests need the fakebox's PTT lease
   (it runs the real box code) and a fake Enable TX.
4. **Android (incl. TV):** §6.1. Phones and tablets get the same
   dispatcher for hardware keys; touch is unchanged.
5. **Apple:** the Siri Remote has no Menu, rewind or FF, so on Apple TV:
   Play/Pause mutes; Select held types a frequency (tvOS long-press on
   Select **[guess: works on a focused SwiftUI view, to verify on the
   Mac's simulator]**); settings and step are in quick controls; Play/Pause
   held arms transmit **[guess: whether tvOS delivers a long press of
   Play/Pause to an app]**. The map lives in OpenHamShackKit
   (`ios/OpenHamShackKit`) as `RemoteKeyMap.swift` and `TxArm.swift`, tested
   with the same `remote-keys.json`. Apple TV has only the WB face today
   (`ios/TV/TVViews.swift`).
6. **Desktop:** n/a for remotes. Desktop apps could adopt the action ids
   for their keyboard shortcuts later; not proposed here.
7. **Hardware:** n/a; no device is claimed by a key.
8. **Transmit:** §5. Nothing keys from one press; any key stops; tested
   only on the fakebox.
9. **Release:** Remote APKs only (debug to `/srv/openhamshack-apps`; the Fire TV
   may be updated freely), then the Apple TV build.

### 6.4 Order of work

1. **After `feature/face-fullscreen-controls` merges** (it is rewriting
   the Icom and Flex keys now): core `keys/` with tests, the legend, and
   the overlay stack.
2. Move faces one at a time, smallest first: DATV, WB (with Apple TV), NB/
   Radio, Flex, Icom. One builder agent; a verifier on `ohsr-tv` per face
   with a screenshot of the legend and a keystroke script (`adb shell input
   keyevent`), then the Fire TV.
3. Transmit keys only after decision 5, and after the auto-TX lease
   exists.

## 7. Not decided here

- **Remapping:** the remote's keys are fixed for the beta. A later
  `remoteKeys` entry in the station profile, like `controllerMaps`
  (`contract/CONTROLLER-PAD.md` §5), is possible; the action ids above are
  chosen so it would be.
- **Number keys** depend on remotes that have them; ATV teletext is the
  case that needs them.

## 8. Decisions for Brian

1. **Up opens a Choose overlay (mode first) on every face**, rather than
   moving focus spatially. *Recommend: yes.* Mode is the most-changed thing
   after frequency and you asked for a mode overlay. Down still moves into
   the controls, so focus movement is not lost.
2. **Left/Right change channel on video faces (WB, DATV, ATV)**, so they
   mean "change what I receive" everywhere. WB and Apple TV move channel
   off Up/Down. *Recommend: yes.*
3. **Rewind/FF change the step size** (as NB), not tune (as Icom and Flex
   today, which only repeats Left/Right). *Recommend: yes.*
4. **OK on the tuning surface opens quick controls on every face**, Step
   first; Icom loses "OK = next step". *Recommend: yes.*
5. **May a TV ever transmit?** The contract caps TVs at Control today.
   *Recommend: keep the cap for the beta; later, allow it per TV as an
   opt-in on the controller, for arm-type transmit (WB, DATV, ATV) and
   digital-mode Enable TX only, never voice PTT.*
6. **Transmit gesture:** hold Play/Pause 1 s to arm (or Transmit… in
   quick controls), then OK or Play/Pause within 5 s; any other key or the
   timeout disarms. *Recommend: yes.*
7. **While Enable TX is on, does every key stop it, or only Back, OK and
   Play/Pause** (leaving the arrows free to browse decodes)? *Recommend:
   every key, for the beta.*
8. **Menu opens settings everywhere**; Flex's one-press NR moves into
   quick controls. *Recommend: yes.*
9. **Play/Pause mutes on every face**, including WB/DATV (where it
   toggles the overlay today). *Recommend: yes.*
10. **When:** after `feature/face-fullscreen-controls` merges, one
    builder, face by face. *Recommend: yes, so the Icom/Flex agent's work
    is not rewritten under it.*

## 9. To measure before building

- What Brian's **TCL Google TV remote** actually sends: Menu, the media
  keys, channel keys, digits, colour keys, the Assistant key. Needs Brian
  to press each key while `adb shell getevent -l` runs on the TCL, or a
  tiny key-echo screen in a debug build. Until then §4 assumes D-pad, OK
  and Back only.
- Whether a **Fire TV remote's Bluetooth drop** gives the app a cancelled
  key-up (affects only hold-to-talk, which this design avoids).
- Apple TV: long press of Select and of Play/Pause reaching a SwiftUI
  view (simulator on the Mac mini).

## Decided (Brian, 11/10/2026)

- **Key map:** the proposed map is accepted as it stands, with all of §8's recommendations on the layout (1-4, 8, 9).
  - Build after feature/face-fullscreen-controls merges, one face at a time (10).
- **TV transmit:** opt-in per TV, digital only. That means digital-mode Enable TX and sending the station's own source (WB/DATV/ATV); never voice.
  - Platform built 12/10/2026 (CONTROLLER-CONTRACT §5.5): an administrator's switch per TV on the Devices page; `X-OpenHamShack-Transmit: digital`; manifest `digital: true` routes; on-air `"digital": true`. NB/Radio honour it (openhamshack-nb 2b73306). WB, DATV and ATV do not yet, and Remote's TV kinds do not yet offer it.
  - Arm by holding Play/Pause for 1 s, then confirm with OK or Play/Pause within 5 s.
  - While armed or on air, any key stops it.
  - Enable TX is tied to a heartbeat from the device that armed it.
- **Deferred:** measuring the TCL / Google TV remote. Brian said not now; design for the Fire TV remote.
- **Built:** Remote 2d1db9d (12/10/2026), covering all five faces and Enable TX.
- **Not yet checked on a device:** the 1 s Play/Pause hold; adb can't hold a key that long.
