# OpenHamShack development guide

> **Renamed 09/10/2026 (product names) and 21/10/2026 (everything else)**: product names below have used OpenHamShack since 09/10; code paths, repos and packages caught up on 21/10, when the family's git history was rewritten end to end (see §5 below for what that changed and left behind).

Read this before changing **any** OpenHamShack project. OpenHamShack is one family:
the work in one repo almost always has a twin somewhere else (a server
endpoint, a client screen on two platforms, a fake for testing, a contract
document). This guide is how to find all of them before you start, rather than
after something ships half-done.

Keep it current. If you learn something every OpenHamShack session should know,
add it here in the same commit as the work.

## 1. The family at a glance

**OpenHamShack** is the platform: a customised edition of Dock360 that runs on the
station's PC (an Intel N150 today). Each product is a **OpenHamShack app** installed
on it. **OpenHamShack Remote** is the single client app per platform that finds
OpenHamShack servers and opens each app's screens (its *kind*). Classic, the
0.9.x appliance, is **replaced by the platform**: archived, with no live repo
of its own any more, though the hardware at the workshop may still be running
it. Its functions become OpenHamShack apps and platform features, and each app
adds functionality to OpenHamShack. App names are settled: see the table below. The
architecture and phases are in [PLATFORM-PLAN.md](PLATFORM-PLAN.md).

### Every product, every form

Each product can exist in up to five forms. Before you change one, check the
others in its row.

| Product | Desktop app | Classic appliance | OpenHamShack app (server) | Android kind (phone/tablet/TV) | Apple kind (iPhone/iPad/Apple TV) |
|---|---|---|---|---|---|
| **OpenHamShack QO-100 WB** (QO-100 wideband DATV: today's box app; its terrestrial bands move to OpenHamShack DATV) | **archived** (was its desktop form; see the OpenHamShack Desktop row) | Classic, **archived**, no live repo (0.9.x appliance; may still be running on the workshop hardware; replaced by the platform) | planned (phase 1) | `~/openhamshack-remote/android` (built; TV mode built) | `~/openhamshack-remote/ios` (built; Apple TV RX-only built) |
| **OpenHamShack DATV** (terrestrial digital TV: ohsdatv + the box app's terrestrial DATV bands) | `~/openhamshack-datv` | — | later (D7) | — | — |
| **OpenHamShack QO-100 NB** (was NB, QO-100 narrowband) and **OpenHamShack Radio** (was HAM, terrestrial all-band normal radio) | `~/openhamshack-nb` (PyQt6; `ohsnb`/`ohsradio`) | — | planned | planned | planned |
| **ATV** (analogue PAL/AM-VSB) | `~/openhamshack-atv` | — | planned | planned | planned |
| **Teletext** (built into ATV, not its own app) | **archived**, folded into ATV: no longer a repo of its own | — | part of the ATV app | with ATV | with ATV |
| **OpenHamShack Icom** (was StationFlow; IC-9700/7610/705 control) | — | — | **exists as a Dock360 app, to be rebuilt as an OpenHamShack app** on the shared components: `icom` (`~/dock360-apps-icom-9700/icom`, branch `icom` of `~/dock360-apps`) | in progress: `~/stationflow-tv` (`:kind-stationflow`, RX-only) | planned (Apple TV wanted) |
| **OpenHamShack Digital Modes** (replaces WSJT-X) | ohsdigi in `~/openhamshack-nb/rust` | — | planned: works with any radio app via audio routing | planned | planned |
| **OpenHamShack Flex** (was FlexDeck; FlexRadio) | — | — | **exists as a Dock360 app, to be rebuilt as an OpenHamShack app**: `~/dock360-apps-flex` | planned | planned |
| **OpenHamShack Packet Radio** (AX.25 packet, APRS, connected-mode chat, IP over AX.25, SDR monitor; Brian 17/10/2026) | `~/shack-packet` (PyQt6, `shack_packet_app`; in progress) on ohs-libs `shack_packet` | — | **building (0.3.0)**: store app `shack-packet` (kind `packet`) in `~/shack-packet` `store/packet` + `src/shack_packet_box`: BBS, always-on conference room, mail store and FBB forwarding on a broker-reserved radio (shack-packet docs/BBS-DESIGN.md; forwarding contract ohs-libs `python/shack_packet/FORWARDING.md`) | — | — |
| **OpenHamShack Desktop** (QO-100 station on DATV code) | **archived**: no live repo any more, nothing may depend on it | — | out of scope (D7) | — | — |

**Supporting pieces:**
- `~/longmynd-rs`: Rust port of longmynd (MiniTiouner/PicoTuner).
- `ohsdigi`: FT8/FT4/JS8 in Rust, inside `~/openhamshack-nb`.
- `~/openhamshack-net`: station chat and RX reports (PHP, 20i hosting).
- `~/openhamshack-fakebox`: the test box, a Dock360 app.
- `~/dock360`: the engine.
- `~/openhamshack`: this guide, the plan and handovers.

### Rules that apply to all of them

- **No servers inside the desktop apps** (Brian, 09/10/2026). A product
  reaches phones and TVs as an OpenHamShack app on the platform. The server layer
  lives in its own `~/dock360-apps-openhamshack-<kind>` repo and pins the desktop
  engine by commit.
- **One client app per platform**, with kinds. Not one app per product.
- **Ready for other languages and countries:** English-only for beta, but no user-visible text in code (translation catalogs), locale-aware formats, and band plans/licence rules as shared data driven by the station profile's country/region/licence class - never hard-coded (BETA-PLAN §5 of the architecture changes).
- **The Ajazz AKP03E controller works with every app** through one shared controller library: apps declare actions, the platform (or the foreground desktop app) routes the pad, and PTT always goes through the TX lease (BETA-PLAN arch change 6).
- **Every app also stands alone** on Linux/Windows/macOS; the controller is optional and apps join it as clients, offline-first (BETA-PLAN.md).
- **Shared components, one of each** (Brian, 09/10/2026): digital-mode decoding (ohsdigi), CW decoding (ohs-libs `shack_cw`, NB's decoder; NB, Radio and Icom use it, Flex next), APRS, SSTV, recording (ohs-libs `shack_rec`: FLAC audio + SigMF IQ behind one `api/recordings` in every app; NR2 is `shack_dsp`), grid/prefix data and log formats are shared libraries; station profile, logbook, callsign lookup and spots are OpenHamShack platform services. Never add a second decoder, logbook or lookup to an app: use or extend the shared one (PLATFORM-PLAN §1.4).
- **Rig apps are one per maker** (OpenHamShack Icom, OpenHamShack Flex, later Yaesu/Kenwood) on a shared rig-control library; Flex is separate because SmartSDR is nothing like CAT/CI-V.
- **OpenHamShack owns the hardware.** Apps claim devices from the platform's
  broker and never assume exclusive access (PLATFORM-PLAN §1.3).
- **Never key a radio** without Brian's say-so and presence. Transmit only on
  licensed frequencies, into a dummy load until the PA and filter are proven.
  A Pluto reboot keys its TX LO.

## 2. The shared contract

Everything a client relies on is one contract, whichever box serves it. The
sources of truth:

- **Classic DATV box API:** `~/openhamshack/docs/REMOTE-API.md`.
- **Client-side rules:** `~/openhamshack-remote/docs/REMOTE-CONTRACT.md`. This
  covers transmit-safety timing, player options, view-only wording, and the
  QO-100 tune rules (§7a).
- **StationFlow app API:** `icom/docs/TV-API.md`, on branch
  `feature/icom-rx-audio` until merged.
- **Platform-level contract** (discovery, pairing, levels, the broker,
  shared services, sync, band-plan data, the pad, i18n, repo layout):
  [contract/](contract/README.md), version 1, designed 09/10/2026 for the
  beta; it supersedes PLATFORM-PLAN §2 where they differ. Not built yet.

The pieces every box shares:

| Piece | Rule |
|---|---|
| **Discovery** | Bonjour `_openhamshack._tcp`. Classic adverts carry `name`, `version`, `port`. Platform adverts add `platform=1`, `kinds=…` and `/.well-known/openhamshack`. Clients must handle both. |
| **Sign-in** | Classic: `POST /api/login {pin}` gives an `ohssession` cookie lasting a year; `/api/logout`; a PIN change ends all sessions. Platform: per-device tokens tied to an OpenHamShack user (planned). |
| **Levels** | view, control, transmit. TV kinds never ask for transmit, except digital modes on a TV an administrator switched on (CONTROLLER-CONTRACT §5.5: `X-OpenHamShack-Transmit: digital`, level stays control; manifest routes opt in with `digital: true`; on-air sends `"digital": true`). |
| **Transmit lease** | Key with `{"on":true,"remote":"<client-id>"}` and start heartbeats only after the key-up answers. `POST /api/ptt/heartbeat` every **1 s**; the box unkeys after **5 s** of silence. Any unkey ends the lease. Clients unkey on background, screen lock or network loss. Refuse to transmit through a box without `tx.remote` in its status (too old to have the lease). |
| **Enable TX (digital auto-TX)** | NB/Radio store form `POST api/autotx` (openhamshack-nb `docs/SERVER-API.md`): the server keys each over itself through PTT's path. The arm is a lease too: the arming client heartbeats it every 1 s **between overs as well**, 5 s of silence disarms and unkeys; halt/PTT off/stop/mode change disarm. Off after a restart. A TV may only ever get this (never voice PTT), per TV, when an administrator allows it on the controller's Devices page (CONTROLLER-CONTRACT §5.5; NB/Radio honour it since openhamshack-nb 2b73306). |
| **Video** | Raw MPEG-TS over a long-lived HTTP response (`/api/rx/stream.ts`); ten null packets a second when idle. |
| **Audio** | PCM, format announced up front: `/api/audio/rx` now, and later `/api/audio/tx` beside it. |
| **Errors** | `{"error": "…"}` with an HTTP status. |
| **URLs** | Never absolute. Read `X-Forwarded-Prefix`. Don't assume HTTPS. Clients take a base URL. |
| **QO-100** | The box polls BATC; clients never do. Every tune sends frequency, symbol rate and LNB offset together. The beacon is **1500 kS**. |

## 3. The change checklist

For any feature, answer each line before writing code. Say "n/a" out loud
rather than skipping it.

1. **Contract:** does a contract document change? Update it first, in the
   same commit as the code.
2. **Server:** which box serves it? Classic (archived, no live repo), an
   OpenHamShack app repo, StationFlow, the platform (Dock360)?
3. **Fake:** does `tools/fakebox.py` in openhamshack-remote (and the Dock360
   fakebox's vendored copy) need it to stay testable?
4. **Android:** the phone/tablet screens and the TV mode. TV is D-pad only:
   focus, BACK, safe area, scrolling only as far as focus needs.
5. **Apple:** iPad, iPhone (compact layout) and Apple TV (Siri Remote focus).
   Shared logic goes in the Swift package (OpenHamShackKit), with tests.
6. **Desktop:** does the desktop app share the engine, and does a pinned
   commit need refreshing?
7. **Hardware:** does it touch a device? Then it goes through the broker
   (platform) or radio-lock (Classic), and needs a safe-off story.
8. **Transmit:** does it key anything? Then the lease, the time-out, Brian
   present, licensed frequencies only.
9. **Release:** which feeds and versions move, and who cuts them? (§6)

## 4. Testing without a radio

- **Test box:** Dock360 app `openhamshack-fakebox`, **off by default**. Start it
  in Dock360 (shack:8800).
  - Devices reach it at `198.51.100.208:20033`, PIN 1234.
  - While it answers, avahi announces it as "Fakebox (test)".
  - Settings: `BOX_CLIP`, `BOX_CODEC` (h264/hevc), `BOX_LOSS_PERCENT`,
    `BOX_CUT_SECONDS`, `BOX_NO_SIGNAL`, `BOX_PIN`, set with
    `sudo dock360ctl module set openhamshack-fakebox K=V`.
  - Clips live in `/var/lib/dock360/modules/openhamshack-fakebox/data/clips/`.
  - It has no SRT camera ingest; use a real box for that.
- **Developer fakebox:** `~/openhamshack-remote/tools/fakebox.py` with
  `FAKEBOX_PORT`, `FAKEBOX_FILE`, `FAKEBOX_CODEC`, `FAKEBOX_CORRUPT`,
  `FAKEBOX_CUT`, `FAKEBOX_NOSIGNAL`.
  - Use your own ports and a uniquely named pid file. Kill by PID only;
    **never `pkill -f`**, which matches every app on shack.
- **2% packet loss** (`CORRUPT=0.02`) is the standing weak-signal test.
- **StationFlow without a radio:** `~/stationflow-tv/tools/fakeflow.py
  --tls` speaks the final `TV-API.md` (form login, ack flow control, a
  1000 Hz test tone, a scope, decodes, APRS, SSTV) on :18300, https :18343,
  its CA on :18380. `/fake/posts` lists any transmit path a client asked for.
  See `~/stationflow-tv/docs/TESTING.md`.
  `/fake/model?key=ic-7610|ic-705|ic-9700` switches radio (the radio-shaped
  displays follow the model) and `/fake/onair?on=1` shows the radio on the
  air as if keyed elsewhere. Debug test-host builds open a box directly with
  `am start ... --es open http://10.0.2.2:<port>/icom/`.
- **Radio-shaped displays (OpenHamShack Icom):** (the Android kind now lives in openhamshack-remote android/kind-stationflow, via git subtree 10/10; change it there) one layout spec,
  `~/stationflow-tv/docs/RADIO-DISPLAYS.md` §5, carried as data in Android
  `radio/Faces.kt` and the web page's `display.js` `FACES`. Change the
  document first, then both tables; Swift follows the document.
- **The real feed:** fakeboxes run the real box code, so `/api/qo100` pulls
  BATC live (read-only).

### Devices and hosts

| What | Where | Notes |
|---|---|---|
| **workshop** | Classic box, N150, `workshop`, LAN `198.51.100.209` | **Real radio.** Check `/api/status` `onAir` before any install or restart. Brian installs releases or asks you to. Its Pluto is not to be reconfigured. |
| **Fire TV** | `198.51.100.45`, Fire OS 7.7 (Android 9), armv7 only | `adb connect` from shack (authorised). `KEYCODE_SLEEP` puts it into standby; never wake it at night. |
| **Android TV emulator** | AVD `ohsr-tv` (phone/tablet: `ohsr`) | Toolchain in `~/android-toolchain` |
| **ohs-build** | user `ohs` on build-a (office VM 120), `ssh ohs-build` | OpenHamShack build code, separate from Control360's. Nothing installed system-wide; per-user toolchains in /home/ohs. No KVM, no podman. Rust, mingw Windows cross-builds, Node website builds. |
| **Mac mini** | `ssh user@mac-mini` | Xcode 26.6; `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. Builds, SPM, DerivedData and vendor files go on `/Volumes/OpenHamShackBuild`; stop if it's missing. The internal disk is small. |
| **Brian's devices** | iPhone, iPad, 3 Apple TVs, Galaxy Tab S-series (Android), TCL Google TV | Apple devices wait for TestFlight (needs an App Store Connect app record + API key from Brian) |
| **Test APKs** | `https://shack.tail547521.ts.net:8443/apps/` | tailnet only, from `/srv/openhamshack-apps`; never the public release folder |

## 5. Traps already paid for
- **The 21/10/2026 rename rewrote every hub's history, not just its
  surface.** `git filter-repo` replaced the old brand everywhere - text,
  paths, branch names, commit messages - across every family repo. The
  commit ids in HANDOVER entries written before that date no longer exist:
  those entries are a true record of what happened, but you cannot `git
  show` their SHAs any more. Backups of every pre-rename repo (bundles and
  bare clones) are on shack at `~/archive/pre-rename-20261021`; read from
  there, never restore from it into a live checkout. shack and office's
  gitsync (and buildtree-sync) recreate a hub from any checkout under `~`
  on their next pass, so never leave an old-named checkout sitting under
  `~` - it will get mirrored back as if it were still current. The rewrite
  treated anything without a NUL byte as text and rewrote it; a binary
  fixture that happens to be NUL-free reads as text and gets corrupted
  silently (one, a 7PLUS fixture, was found broken and restored from the
  pre-rename backup) - check fixtures that are binary data with no NUL byte
  of their own whenever a rename or similar bulk rewrite runs again.
  Brian wants no record of the former name anywhere: never write it, or
  its short module prefixes, in code, comments, docs, commit messages or
  host paths, not even to explain the rename. Say "the former name". A
  second pass on 22/10 had to rewrite the fix-up commits that did, which
  changed their ids again and cost every session another re-fetch.
- **A parallel suite run on the shared ohs-dev VM gets OOM-killed (/tmp is
  RAM, no swap); use tools/run-suite-split.sh and rerun red modules
  serially before believing them.** (openhamshack-nb; 16 GB of swap was added
  on 18/10, but the advice stands.) The same holds for a release on shack:
  at NB 0.1.22 one `unittest discover` interpreter grew past 14 GB and
  aborted with no summary (a Qt timer firing after its test's teardown;
  PyQt6 aborts on an exception in a slot), and with other sessions holding
  shack at load 10-28 every whole-suite run left 20-60 real-time-paced
  tests red that passed alone. `release.sh` now runs `run-suite-split.sh`
  with `RERUN_RED=${SUITE_RERUNS:-2}` (red modules rerun alone, up to twice;
  the last run decides) and `-j ${SUITE_JOBS:-1}`. A module red three times
  is real. Keep host names out of comments: `test_source_site` runs the
  source scrub on the tree, so a comment naming shack fails the release.
- **Packet Radio: what the first build found (18/10/2026, shack_packet).**
  - *numpy FFT page-faults itself slow on Linux.* In some processes glibc
    returned and re-faulted the FFT's buffers ~42,000 times a second, and
    the SDR channeliser cost 86 ms/s instead of 23. `shack_packet.sdr`
    calls `memory.keep_heap()` (pads glibc's heap) from the first Pipeline;
    any numpy SDR code on Linux wants the same.
  - *Live direwolf in tests, without a sound card:* audio in over UDP, out
    through ALSA's user-space `file:` plugin to a FIFO; pace the audio in
    real time or we answer while direwolf is still "transmitting"; its AGW
    port must be below 32768 (else 8000); pass its config by bare file name
    (a long path and the AGW port never opens). Never load snd-aloop on
    shack: other apps enumerate its audio devices.
  - *The FTX-1 can key itself when a computer opens its serial ports* if
    RPTT SELECT names RTS/DTR (CAT manual p.2). shack_rig opens every port
    with RTS and DTR low and raises one only when it is the chosen PTT.
  - *shack_rig has USB transmit audio (`txaudio.py`) but it is off unless
    the profile asks,* so the Icom app's USB radios are unchanged.
  - The FTX-1 CAT manual and a packet digest are on shack in
    `~/vendor/manuals/yaesu/` (Yaesu's document, kept out of repos).
- **Packet Radio 0.2.0: what the radios taught (18/10/2026, on air with
  an IC-9700, Plutos, a HackRF and an RSPdx).**
  - *The IC-9700's noise reduction ruins AFSK.* With NR on (`16 40 01`) 2 m
    packet decoded 0/3 (Direwolf too): its adaptive filter reshapes the
    two tones during each frame. Any data set-up turns NR, NB and the auto
    notch off and puts them back (shack_rig `datasetup.py`).
  - *IC-9700 USB transmit audio slips inside the radio,* so Packet uses LAN
    audio (DATA MOD = LAN). The host sends a perfect 48 kHz stream (usbmon:
    no mismatch), yet the 9700's PCM2901 drops and repeats 1/3 ms blocks at
    about 1,500 ppm: harmless to FT8, fatal to 1200 baud on some radios
    (another 9700 on another PC sent clean AFSK over USB). USB receive is
    fine. The app warns for a 9700 transmitting over USB.
  - *A LAN keepalive must never idle mid-over.* shack_rig's `lan.py` sent a
    tracked idle every 100 ms on every stream; on the audio stream that
    took a sequence slot with no audio, and the 9700 played it as a 20 ms
    hole every ~100 ms (0/3 decoded). Idle only after `IDLE_PERIOD` with
    nothing tracked sent, as wfview does (804593b).
  - *An SDR hears itself,* so the engine drops its own echoes: a Pluto's
    receiver heard our own SABM and the engine took it as an incoming
    connect to another SSID of the same call, and refused it with a DM
    over the real answer. The channel now remembers every frame it sends
    for 30 s and the engine drops one heard back byte for byte
    (`stats["own_echo"]`); a digipeated copy differs in its H bit, so APRS
    still hears itself via a digi (4269cb5).
  - *A Pluto cannot stream receive and transmit together over its USB
    network at 2.4 MS/s:* iiod on one ARM core and RNDIS kept only 96 % of
    real time, so long overs became runs of LO leakage the 9700 decoded as
    nothing. PlutoLink is half-duplex (receive stops for our own overs and
    restarts on a fresh buffer) with a deeper TX queue (49b222c, 464e731).
  - *A Pluto reboot radiates its TX LO* (2450 MHz, about -10 dB) until
    something quiets it. Shack's rebooted by itself at 15:28 and radiated
    for four minutes; the systemd user service `pluto-quiet-on-boot` on
    shack now quiets it after any reboot. Anything that reboots a Pluto
    (the AD9364 enable) does it under a quiet watcher.
  - *BusyBox `read -t` differs between versions:* on a timeout it returns
    1 on 1.36.1 (the ADI-derived clone) and 142 on 1.37.0 (Tezuka), and EOF
    is 1 on both. The Pluto transmitter guard tells EOF from a timeout by
    the clock, never by the status (shack_pluto `guard.py`).
  - *Tezuka answers on MQTT 1883 too,* so "MQTT answers" does not mean
    PlutoDVB2: shack_pluto `identity.py` asks for Tezuka first.
  - *A HackRF keeps a weak carrier after a crash:* the firmware stops the
    signal when the host stops feeding it, but the transmitter stays on
    until the program starts again or the HackRF is unplugged. Every open
    switches the transmitter off first; the app says so on its setup page.
    HackRF transmit shipped in 0.2.0 marked experimental, never heard on air.
  - *The IC-9700 limiter fixes FM-D deviation whatever the MOD level:* LAN
    MOD 35-50 % all gave about 4.1 kHz peak, 3.4 kHz on the 2200 Hz tone.
    MOD level is read and reported, not set; a real deviation calibration
    needs much lower levels.
  - *A restore must be journalled to survive a crash.* Every value is
    written to disk before its setting is changed, so a `kill -9` (and a
    radio that stopped answering mid-session) left exactly what the next
    open needed to put NR, COMP, AF SQL and MOD level back
    (shack_rig `datasetup.Journal`). Something not readable is not changed
    at all: an IC-9700's duplex is changed only after `0F` has reported it.
- **Packet Radio 0.2.1: what the fast modes taught (18/10/2026 night,
  two Plutos on air, 9600-153 600 baud; ohs-libs shack_packet README).**
  - *The fast modes run at 2.4576 MS/s (9600 x 256), not 2.4.* At 2.4 MS/s
    38 400 baud is 62.5 samples a bit and no decimation gives the
    transmitter a whole number; 2.4576 divides for every mode up to
    153 600 and is above the AD936x's no-FIR floor. 1200 AFSK keeps 2.4.
  - *Use RNDIS on Linux and Windows, ECM on a Mac; never NCM.* A Tezuka
    nano on NCM stalled receive at 2.4576 MS/s, froze, was reset by its
    own watchdog (`watchdog -t 5 -T 10`) and came back transmitting (next
    item). RNDIS soaked 10 min at 100 % kept. macOS has no RNDIS driver,
    hence ECM there. Packet's Check this Pluto shows the mode and switches
    it (`fw_setenv usb_ethernet_mode`, reboot under the quiet watcher).
  - *A Pluto reboot radiates its TX LO, and a safety path must never
    block on libiio.* The nano's watchdog reboot left 2450 MHz at -10 dB up
    for nearly five minutes; the first quiet watcher hung inside libiio
    while iiod was still starting and the nano radiated about two minutes
    more. Shack and workbench both run a hardened `pluto-quiet-on-boot`
    (`~/bin/pluto-quiet-on-boot.py`: every external call under a hard
    timeout, acts only while uptime < 180 s), and PlutoLink quiets the
    Pluto first on any fresh context its receive recovery opens. Never
    call libiio without a timeout anywhere that is meant to make a Pluto
    quiet (shack_pluto's QuietWatcher still uses libiio's default: open).
  - *The band plan (RSGB 2026): 1298.000-1299.000 is 20 kHz channels*
    (1298.500 is one; the 38 400 baud run there on 18/10 was out of plan);
    *high-speed data is 1299.000-1299.750 (and 1241.000-1241.750) in
    150 kHz channels* (1299.075/.225/.375/.525/.675), and nothing on
    23 cm is wider; gfsk153600 (166 kHz) only on 13 cm, 2311-2315. A
    Pluto's LO leakage and IQ image (ifo and 2 x ifo below; ifo 200 kHz
    for modes over 100 kHz) must be inside the segment too: 1299.525 is
    the channel for the wide modes. `shack_packet.fastsettings` holds the
    check (the shared band-plan data lacks the 23 cm DD rows yet); Arm
    and fastfsk_test refuse out of plan.
  - *An SDR's own echo:* a Pluto hears its own overs (PlutoLink pauses
    receive, but catches tails and leakage), and the engine drops a frame
    heard back byte for byte within 30 s (`stats["own_echo"]`). Anything
    that counts what a station heard - the path test's tally, the link
    test's telemetry, adaptation's evidence - must count after that
    filter, never the demodulators' raw output.
  - *PlutoDVB2's SSH is slow:* its dropbear took 5.9 s to say ready
    through the controller box against the 5 s the guard allowed; the
    guard now waits 25 s (connect/banner/auth 20 s). Expect any SSH to a
    PlutoDVB2 Pluto, especially via `pluto://host?iiod=30431&ssh=30422`
    on the controller, to need that.
  - *Set OPENBLAS_NUM_THREADS=1.* OpenBLAS's idle threads spin after every
    FX.25 tag search (a small matrix product per slicer per block): at
    38 400 baud the process used 329 ms of CPU a second of IQ against
    about 116. Every published CPU figure is with one thread; Packet Radio
    sets it before numpy loads from 0.2.1 (`shack_packet_app/__init__.py`).
    Any app or tool running shack_packet's receivers should do the same.
- **Packet Radio 0.3.0: the controller BBS (20/10/2026, simulator only).**
  - *A caller's SABM while connected drops what the answerer queued.* The
    datalink resets on it (AX.25: discard the I queue), so a caller that
    missed the first UA and sent SABM again lost the BBS's greeting, and an
    FBB partner would wait for the `>` prompt for ever. Any service that
    speaks first on a connection must act on the `reset` event: the BBS
    sends its greeting again (ohs-libs shack_packet `bbs.py` `reset`).
  - *An automated transmitter has no acting identity in broker v1*
    (CONTROLLER-CONTRACT §6.2: `requester: auto` claims rx only, and
    `onair` with acting `-` is `level_too_low`). The BBS transmits on
    behalf of the sysop who armed it: their `X-OpenHamShack-Device` is
    sent as the acting identity on every `onair`, so the broker re-checks
    that person each over; the arm lasts 24 h and is renewed by arming
    again (Brian, 20/10/2026, for 0.3.0). A Full licence permits the
    unattended operation and 15 minutes is the ID interval (confirmed by
    GM4BRI 20/10/2026).
  - *Reservations* (`reserve: true` on a claim, `reserved` on the device
    row, `device_reserved`) are built on dock360
    `feature/ohs-edition-030-c` with the kind `packet`, unmerged, for the
    platform owner's review (its `docs/openhamshack-030-c-review.md`).
  - *Dock360's manifest validator knows a fixed list of kinds*
    (`SHACK_KINDS`, dock360 feature/ohs-edition manifest.py): a new kind
    such as `packet` is refused until the edition adds it.
- **Radio already has a band row, band stacks and a band-plan strip:
  read `docs/ham/USERGUIDE.md` in openhamshack-nb before planning a Radio
  feature.** A 13/10/2026 brief asked for "a band-plan overlay" and "an
  easier band selector" as if new; both had shipped since 0.1.0
  (`ohsradio/ui/widgets.py` BandBar, `bandStacks` in engine state,
  `HamFace.segments` drawn by `ohscore/ui/scope.py`). The real work was the
  gap: first-visit defaults by mode and a row filtered to the receiver's
  coverage (openhamshack-nb `feature/radio-bandplan-bands`). The strip draws
  `ohsradio/plans`, the guard judges `shack_bandplan`; ohs-libs'
  conformance test keeps them equal, so never switch one alone. The RSGB
  plan has **no 6 m rows** yet, so a UK 6 m transverter shows an empty
  strip. To test the strip as an operator reads it, hover with
  `QTest.mouseMove` over `r_strip` and read `QToolTip.text()`: it works
  on the offscreen platform (`tests/test_ham_band_buttons.py`).
- **Adding a USB rule on the controller can hang the Pluto, and NB does not
  recover by itself.** On 12/10/2026 the SDRplay's udev rule (Host ›
  Hardware) re-ran device detection for every USB device; the controller
  stalled (NB logged "controller has not answered for 11 s, so pluto-1 is no
  longer held") and NB lost the Pluto at 21:24 UTC. The Pluto's network side
  still answered (iiod open) but its receive timed out until it was
  power-cycled by hand; a module restart was not enough. Before touching USB
  rules on a box with a Pluto, stop NB, and expect to power-cycle the Pluto.
  NB not re-claiming pluto-1 after a controller stall is an open bug.
- **ohs-dev's /tmp is RAM.** Recording tests left ~1,800 `tmp*` folders of
  275 MB IQ files (7.4 GB); with an app under test at 10 GB the OOM killer
  took the LMSurveys session down (12/10/2026 21:37). Tests must clean their
  temp folders; clear stale ones with `find /tmp -maxdepth 1 -name 'tmp*'
  -mmin +120` when memory is short.
- **A mode sent from its own view is judged as itself, not as the rail's
  mode** (NB KG-STV transmit, 12/10/2026, openhamshack-nb feature/kgstv-tx).
  The engine's guard judged every over in `st["mode"]`, which was right
  only because send() insisted the two matched; a KG-STV picture sent
  from USB would have been "SSB" and refused in the digimode segment.
  Such modes go in `Engine.OVER_MODES` (send() takes them from any mode,
  `_judged_mode` judges them as themselves, a rail mode change unkeys
  them). Two more traps from the same work: the shared band-plan data
  (shack_bandplan vocab.json) gives a mode it does not know **no class**,
  and a classless signal passes every segment's mode rule - name a new
  mode in ohscore/txguard.py `MODE_ALIASES` until ohs-libs adds it; and
  an unfiltered MSK signal's 99.5 % width (what send() measures and the
  plan judges) swings 2.3-5.6 kHz with content because its sidelobes fall
  only as f^-4 - band-limit a constant-envelope FSK over its main lobe
  before measuring it (KG-STV: 1.4 kHz, stable).
- **How tall a signal looks depends on the scope's resolution bandwidth,
  not only its power.** A carrier reads its level at any RBW; a wide signal
  reads its power per RBW. NB's zoom scope (RBW 18 Hz, a column takes its
  highest bin) draws the 400-baud PSK middle beacon ~15 dB under a carrier of
  the same power, so Ray (12/10/2026) saw the beacons relatively higher in
  SDR Console, which averages its bins to one per pixel (~100 Hz on a usual
  NB view) and uses Hang & Decay. Neither is wrong; operators compare their
  downlink with the beacon by eye, so NB's scopes now say their RBW and offer
  an "SDR Console-like" display style (openhamshack-nb ohscore/ui/scope.py
  DISPLAY_STYLES). Any scope that draws server lines (Remote, Icom, Flex)
  should show its RBW too, and a style is a client-side transform of the
  same lines: never change the engine's FFT for a look, because the
  window's receive SNR reads those lines, and the server sends them as
  they are (`binHz` in each item says their resolution).
- **TX lock on an external radio must match what was sent, not a band
  edge.** Ray's IC-9700 FT8 (CAT PTT, 1500 Hz offset, 1104 MHz
  upconverter) landed +840 Hz off every over and NB logged
  `searching -> idle` each time, rigTxCorr 0, untrusted: for any 9700
  over TX lock looked for a template, outside CW "the edge of the band
  nearest the carrier" against the SSB filter's low edge, blind to the FT8
  offset, and only a CW carrier was ever applied. His brief "TX LOCKED
  -20 Hz" was that estimate landing near zero by chance. But NB renders a
  CAT over's audio itself: since openhamshack-nb 0533e98 and 0a44608 the engine hands the
  monitor that audio as USB baseband (timed by the sound card's queue) and
  the Pluto's matched own-signal search finds the tones wherever they sit;
  the over's agreeing measurements correct rigTxCorr between overs (at
  most 2 kHz an over, through the existing frequency write) and the next
  over reads TX LOCKED. A matched search with no own signal present still
  "finds" something: a CAT PSK line that never came down matched the
  keyed lower beacon 41 kHz away three times alike, so a find that would
  put the signal on a beacon is discarded and two agreeing finds are the
  minimum (a Pluto over always has its signal there, so it never showed).
  Speech or another program's data on the radio's
  own PTT is still shown roughly and never applied. Test end to end with
  `SimDevice.attach_external(fn, audio=...)`, which transmits the
  emulated 9700's sound card audio (tests/test_extrig_txlock.py); the old
  "carrier"/"voice" kinds could never have caught this. Workaround before
  0.1.17: key a CW carrier on the radio for 3-4 s (USERGUIDE §6); no UI
  field edits rigTxCorr.
- **An IC-9700's ALC meter is no level criterion; its Po is.** In USB-D
  the 9700's ALC (CI-V 15 13) reads with any audio at all, -40 dBFS
  included, runs past 0120 to about 160, and reads higher the lower RF
  POWER is: the ALC is how the radio holds its output to the setting.
  NB's first level set ("raise until the ALC just moves") told Ray, at
  23 cm into a dummy load, that the ALC moved at -40 dB and to set USB
  MOD Level to the 50 % it already was. Measured on Brian's 9700
  (12/10/2026, 2 m, dummy load; table in openhamshack-nb
  docs/ic9700-research.md): Po rises with the level and goes flat at the
  setting - near -28 dBFS at 50 %, already flat at -40 dBFS at 5 %, where
  no audio level changes the power. Po also drops out now and then (3
  between 26 and 70): read it more than once. And a level change reaches
  the radio only after the sound card's queue has played (NB 0.2 s plus
  90 ms under Windows MME), so a 0.3 s settle reads the previous level.
  Ray's own 9700 (23 cm, RF POWER 59) showed the other shape: ALC at its
  keyed 5 until the Po knee (-31 dBFS), then rising - so use Po, with the
  ALC as a cross-check and ceiling, and keep the knee itself rather than
  3 dB under it (that lost a third of his power). NB's level set does
  this, climbing only (openhamshack-nb 34d7fad, e73f68f); civsim `real_9700()`
  models both shapes. Any app that sets a 9700's drive (Icom, Digital
  Modes) must do the same. NB's pyserial reads each take 50 ms (its read
  timeout, not the radio).
- **Never pick a radio's sound device by the name "USB Audio CODEC".**
  Every Icom with USB has one, so two radios mean two; NB took Ray's
  FTDX10's and keyed the 9700 into silence (ALC 5, Po 0 at every level).
  Windows MME also cuts names at 31 characters ("IC9700 Speakers (USB
  Audio CODE"), so a renamed one may not even contain the word. Pair by
  USB place: the CODEC on the same hub as the CI-V port that answered
  (openhamshack-nb ohscore/rig/usbpair.py: sysfs on Linux, the PnP tree via
  PowerShell `-EncodedCommand` on Windows - `-Command -` runs stdin line
  by line and silently drops a multi-line block); a root hub never
  counts. If that cannot decide, ask, and prove it with a tone into each
  CODEC while reading Po. And "keyed, Po 0 at every level" means the
  audio is not reaching the radio, not a level problem. The same PC's
  9700 answered CI-V only at 19200 baud: try every rate.
- **The AKP03E on a desktop: three silent ways to a dead pad.** (1) A
  frozen build needs hidapi *and* Pillow in its bundle; NB/Radio's
  Windows and macOS specs carried no hidapi and excluded PIL until
  12/10/2026, and shack_pad swallows the ImportError by design, so the
  pad would have done nothing on Windows with no message. Check the
  "controller pad:" start-up fact and run `--pad-report` on the frozen
  build (openhamshack-nb build-windows.ps1 does). (2) hidapi on Windows lists
  one entry per HID collection, not per interface: pick the vendor
  collection by usage page 0xFFA0 / usage 1, never "interface 0, first
  entry". (3) Windows lets the Ajazz/Mirabox Stream Dock app open the pad
  too, and the two fight over the keys; only a process check sees it.
  On Linux a desktop needs its own `uaccess` udev rule numbered below 73
  (shack_pad's 91- rule is for the controller's group). The first-revision
  AKP03E (0300:1002) sends no key releases: never drive PTT from it.
  Desktop apps show all this in Settings › Control pad (openhamshack-nb
  ohscore/ui/padpage.py) and keep pad PTT off until the operator allows it.
- **The AKP03E drops a host that goes quiet, about 39 s after the last
  wake.** Ray's (NB 0.1.20, Windows) logged "Controller disconnected (read
  error)" every 39.2 s, and each reconnect cleared and re-woke all six
  keys: he reported every key flickering. shack_pad sends nothing once the
  keys are drawn, so it needs mirajazz's keep-alive (`CRT\0\0CONNECT`;
  OpenDeck sends it every 15 s). Fixed on ohs-libs and openhamshack-nb
  `feature/nb-pad-flicker` (every 10 s), unverified on a real pad. A pad
  report says nothing about this: look for that log line in the app's
  diagnostics upload (`~/ohs-reports` on shack).
- **The AKP03E keep-alive is verified on macOS.** On 17/10/2026 NB on the
  Mac mini (0.1.21+local) ran the pad for over 40 minutes with no
  disconnect in the log, keys drawn and pressed.
- **ohs-dev's system Python has neither Pillow nor ohsdigi,** so many NB UI
  and decoder tests *skip* there rather than fail (pad key pictures, FT8
  decodes). A green scoped run on ohs-dev is not proof those paths work:
  use the build venv on the Mac mini or VM 130, or install Pillow and build
  ohsdigi into a venv. The .deb should also Recommend python3-pil (a Linux
  install without it shows a blank pad).
- **NB and Radio are renamed (openhamshack-nb 97318d5, 17/10/2026).** Settings
  folders `openhamshack-nb`/`-radio` (migrated at first start by
  `ohscore/rename.py`), env vars `OHS_NB_*`/`OHS_RADIO_*` (the new name wins,
  so a test setting only `OHSNB_*` is silently ignored), .deb
  `openhamshack-nb` (Conflicts/Replaces the old), Mac bundle
  `com.openhamshack.qo100nb`, Windows keeps the same AppId. Still named
  openhamshack on purpose: the Python packages, SigMF `openhamshack:` keys, the feed
  manifest's `"app"` (old copies refuse any other), the repo. Full list:
  openhamshack-nb docs/names.md.
- **BATC's NB WebSDR is not flat.** Its readings and its noise floor fall
  about 5.5 dB from the middle of the transponder to its edges (measured
  17/10/2026), so its CW beacons read ~7 dB under the middle beacon while
  NB's flat Pluto reads all three within 1 dB. Compare a signal with the
  beacon on one receiver only, never powers across two receivers, and on
  the WebSDR only near the middle beacon. (I blamed a Pluto DC notch first;
  there is none - openhamshack-nb docs/qo100-research.md §9.)
- **LEILA is a two-tone siren, not a sweep.** Measured on Brian's
  recordings, 17/10/2026: two steady tones ~205-213 Hz apart, alternating
  every 200 ms for 3-6 s, ~2 dB over the beacon, in the slot after the
  over. Its threshold is still unknown, so the UI says "LEILA?".
  openhamshack-nb `ohsnb/dsp/overpower.py` detects it live; facts and recording
  ids in openhamshack-nb docs/qo100-research.md §9.
- **gfortran tools abort under macOS's hardened runtime.** The bundled
  WSJT-X jt9 (x86_64) exited 134 (SIGABRT, from `libgcc_s`'s executable
  stack trampolines) on every run once signed with `--options runtime`,
  which notarisation requires; unsigned or ad-hoc it decoded. NB discarded
  the exit status, so the shadow just logged "jt9 0" for weeks. Since
  17/10 NB and Radio bundle no WSJT-X at all (ohsdigi decodes; a WSJT-X the
  user installed is still found as the shadow), every decoder-tool run
  goes through `run_decoder_tool` (non-zero exit and stderr are logged),
  and `SHACK_NO_WSJTX=1` makes the app find none, so tests and smoke runs
  test what ships. A build check that names a tool must actually run it:
  the old "FT8 decoded by the bundle's jt9" step ran ohsdigi.
- **PyQt: never name a pyqtSignal `event`** (or after any other QObject
  virtual). It shadows `QObject.event()`, and every event the object then
  receives raises "TypeError: native Qt signal is not callable" with no
  traceback, typically only when a window closes in a later test.
- **Flex DAX IQ is little-endian float32 (I, then Q), unlike every other
  Flex stream.** Read big-endian it decodes as near-zero garbage. The
  VITA sequence counter wraps at 16, so a gap of 16 or more packets is
  counted short. See flex PROTOCOL.md §14 (flex 261759c..dbb0945).
  The FLEX-6300 and 6400 stop at 96 kHz DAX IQ, and the radio does not
  report its limit, so flex app/iqrates.py keeps a per-model table and
  learns from refusals. Samples arrive unnormalised (RMS ~500 on a
  6400), and the SigMF metadata says so (flex 333265a, c426fbc).
- **The WB frequency shown is the found carrier plus the configured offset.**
  To get the LNB's true oscillator, take the configured offset and add
  (published frequency − shown frequency). Do not subtract it. On 11/10
  the beacon showed at 10491.401 with 9749.85 set, so the truth was
  9749.949; setting 9749.751 moved it the other way, to 10491.302.
- **Upstream longmynd drops a good lock after 5 s without TS data.**
  At marginal MER that re-inits the tuner every few seconds. WB now
  patches it to ride fades for up to 60 s while the demod holds lock, on
  a single fixed config (openhamshack 0960a44). WB's module stop also overruns
  the 20 s limit and gets SIGKILLed.

- **An SDRplay RSP in an app container (Radio on ohs-box, 12/10/2026).**
  The API service (`sdrplay_apiService`) must share the client's
  `/dev/shm`, so it runs inside the container (openhamshack-nb
  store/radio/entrypoint.sh starts it, then execs the server). The image
  unpacks SDRplay's `.run` (`--noexec --target`; never run it) and builds
  SoapySDRPlay3 from source - Debian has neither. Access is three pieces:
  `runtime.usb_bus: true` (an RSP re-enumerates when the service first
  opens it - 001/006 became 001/007 - so only the bound directory follows
  it, and that very first open can fail with ENOENT; the next works), a
  udev rule for the id (helper `udev.allow`, i.e. Host -> Hardware,
  1df7:3030 to plugdev), and keep-groups, which the platform adds with
  usb_bus and which works with `user: "1000:1000"` (SIGINT's manifest says
  otherwise; tested). SoapySDRPlay3 silently ignores an antenna name it does
  not know (Radio checks `soapyAntenna` against the list), refuses 1.2 MS/s
  (stays at 2; Radio uses 2.4), and opens at LNA state 0: on the 80 m dipole
  in the evening that pins the IF AGC at full reduction, so ohs-box carries
  `rfgain_sel=4` in soapyArgs. SDRplay's licence grants no explicit right
  to redistribute the API, and the Radio package carries it (image and
  build context). Brian decided on 22/10/2026: the SDRplay API is "use if
  installed" on every form. The image stops carrying it. A controller gets
  it as a staged host library through a named privileged operation, and
  Radio loads it at run time (RADIO-SDR-PLAN.md §5.6, §6.3). Store Radio
  built that way may go on a public feed.
- **openhamshack.com (20i): a new web folder answers 403 for about a
  minute.** Apache reports "Server unable to read htaccess file, denying
  access to be safe" for every request in a folder made or re-moded a
  moment ago (the web servers see the shared storage through an attribute
  cache), and permanently if the folder was made under `umask 077`. Make
  web folders 755 and retry checks for a few minutes before calling a
  deploy broken (openhamshack-os tools/publish-diag.sh does both). PHP
  there is 8.0 (CLI and web): no enums, readonly or `never`. REMOTE_ADDR is
  the real client, not the CDN.
- **Opt-in diagnostics upload (NB/Radio from 0.1.18):** any new automatic
  sender reuses openhamshack-nb `ohscore/diagupload.py`: consent is the ui.json
  switch AND a stamp for the current CONSENT_VERSION that only Settings
  writes, never while keyed or metered, scrub with `diag.redact_text`.
  Faults are reported by calling `diag.notable(trigger, detail)` where they
  happen. Reference codes are SHACK-XXXX: never OHS (brand/README.md).
  Endpoint, fetcher and contract: openhamshack-os docs/DIAGNOSTICS.md.

- **A Caddy site's `respond @untrusted ... 403` never guarded its
  `handle` blocks** (found 13/10/2026, dock360 `feature/ohs-tunnel`
  a745741). Caddy sorts directives itself and `respond` runs after
  `handle`/`handle_path`, so every app, the front door, the deploy API and
  the CA were served to any address that reached the port; only unmatched
  paths got the 403. Harmless behind a home router, an open door on a
  public address. Fixed by wrapping the site from the guard down in a
  `route` block (literal order); a Dock360-wide bug, wanted on Dock360
  main too. Check with `caddy adapt` or a real request, never the text.
- **Internet access to a controller is the tunnel site, never port 80**
  (CONTROLLER-CONTRACT §4.7). cloudflared connects from loopback, and port
  80 trusts loopback (anonymous view, the screen's session exchange). On
  ohs-box: tunnel `ohs-box` (40f7c599-…) → `http://127.0.0.1:8081`,
  `/etc/cloudflared/` root-only, unit `cloudflared.service`; the account
  cert stays on shack. If the tunnel site is missing the tunnel answers 502:
  that is the safe failure. Every name under dock360.net resolves (proxied
  wildcard to 20i), so prove a tunnel name with `cloudflared tunnel route
  dns` (it refuses a name that has a record) and a request, not with DNS.
  Cloudflare closes a websocket idle ~100 s: clients must ping. Phone
  sign-in from the internet needs TOTP on the account (ohs-box's `admin`
  had none on 13/10); a TV pairs by code, approved by an admin.
- **A where-may-this-token-be-used rule belongs in `devices.authenticate`, not in a route** (dock360 96100c9, platform 2.0.0-beta.8). beta.7 refused the screen token from the tunnel in the app gate only. Every /api/shack/v1 route still answered it, because each route had its own copy of the lookup. A new token path calls `authenticate(..., via=door(request))` and gets the rule. Never test whether a *mutating* route refuses something with a live credential on a real box: a check of `devices/self/revoke` through the tunnel revoked ohs-box's screen token, which had to be re-minted.
- **The privileged helper logs every operation's arguments.** Until
  12/10/2026 it logged `caddy.write_sites` whole, so every app install put
  the SSO hop secret and each app's proxy secret in the controller's
  journal (found on ohs-box). Its redaction now recurses and summarises long
  strings as a hash (dock360 `src/dock360_helper/redact.py`); a new helper
  operation that carries a secret still wants a key name with `secret`,
  `token`, `password` or `key` in it, and a test like
  `tests/test_helper_log_secrets.py`.

- **An app's 401 is not a sign-out.** A module answers 401 while it restarts
  (update, caddy reload). Remote once forgot its device token on any module
  401 and threw Brian's Fire TV back to pairing during a Flex update. Clients
  ask the platform (`GET api/shack/v1/devices`) and forget the token only on
  `token_revoked`/`bad_credentials`; otherwise reconnect with backoff
  (openhamshack-remote eb7a6f9). The Apple twin needs the same rule.
- **A platform update drops every hardware claim; apps must re-claim.**
  The controller restart (any Dock360 platform update) empties the broker;
  heartbeats then answer 404/410 "There is no such claim for this app."
  NB and Icom read that as a hand-over and stayed off for hours on 10/10
  (blank spectrum, "No receive audio", "NO RADIO"). Rule: a lost claim while
  still wanted = unkey, then claim again (`reclaim: true`, backoff, honour
  503 `broker_restarting` retryAfter), receive only; only a person's stop or
  a release request ends it. Fixed: openhamshack-nb 9747285, icom f519526/0be9ade;
  WB and Flex recover by claiming in a loop. Any new app needs a
  broker-restart test.
- **QO-100 beacons are F1A: the key-down tone must sit on the CW pitch.**
  Each beacon moves one carrier 400 Hz between key-up and key-down; the
  key-up (space) tone is the one nearest the published frequency. Tuned on
  the space tone, the decoder hears the keying upside down and prints E/T
  soup with no spaces (Brian's TV, 10/10). Bookmarks fixed in openhamshack-nb
  493e004; the decoder now also turns inverted keying over itself (ed2687d).
- **If NB's beacon lock fails and the Pluto RSSI is above ~110 dB with gain
  at max, check the LNB/feed hardware first** (from the NB session). The
  receiver is then hearing its own noise, not a downlink: no setting in the
  app will find a beacon that never arrives.
- **NB's TX lock on an external radio must correct the error it measured
  against the frequency the radio reported, check each step on the next over,
  and stay under `rigTxCorrMaxHz`.** 0.1.18 added every over's error on top of
  the last. On Ray's 9700 (13/10, SHACK-41CC) the signal it locked onto never
  moved, likely another FT8 station in the same slot, and it saved +5441 Hz.
  Fix on openhamshack-nb `fix/nb-txlock-accumulate`. A stuck `rigTxCorr` survives
  restarts because it is saved as trusted.
- **The station profile never deletes a `controllerMaps` entry,** so a pad
  remap reset must be written as an empty entry, or the old mapping comes back
  on the next load. The ohs-libs pad library's own reset deletes the entry and
  would lose a reset on the desktop; the NB/Radio editor (openhamshack-nb
  `feature/nb-pad-remap`) writes the empty entry. Fix the library before
  anything else uses its reset.
- **openhamshack.com sits behind 20i StackProtect,** which answers VPN and
  datacentre addresses with a JavaScript "Security Verification" page (HTTP
  401, header `x-stackprotect-id`). An app's update check or diagnostics upload
  can't pass it, and reports "the server answered 401". This hit Ray behind
  PrivateVPN (14/10). It is a StackCP setting, not `.htaccess`, and Control360's
  20i module can't reach it yet.
- **`~/build/venvs/ohs-libs` imports ohs-libs from `~/ohs-libs` (editable),**
  not from a worktree. `merge.sh --test` run in an ohs-libs feature worktree
  tests the new tests against main's library and fails. Merge, then run the
  tests in `~/ohs-libs`, or give the agent its own venv for the worktree.
  Since 10/10 `shack_cw` needs numpy: a fresh ohs-libs venv needs `numpy`
  and `-e python/shack_cw` (README), or tools/test.sh fails on import.
- **Measure the CW decoder on real bands, not only the bench** (ohs-libs
  `feature/cw-decode-accuracy`, 13/10/2026). The bench's Gaussian noise
  said "0 characters on noise" while Radio printed "27.4 WPM .2 NE TU A
  H OW..." from 20 m static. `shack_cw.corpus` scores real KiwiSDR IQ
  (27 recordings, 80-12 m, in shack:~/build/cw-corpus; ground truth in
  `python/shack_cw/tests/corpus/manifest.json`); openhamshack-nb
  `tools/cw_bench.py --corpus` runs it through NB's own Demod. Public
  KiwiSDRs refuse a second connection from one address, and a recording's
  first sample is 1-3 s after it is asked for (find NCDXF slots from the
  keying, not the clock). Inside-out (F1A) correction is QO-100 only:
  apps without F1A pass `polarity=False` (Radio's `CW_POLARITY`), or an
  NCDXF beacon's fading dashes turn the next station inside out.
  `Decoder.feed_frames` is the per-channel back end for the skimmer.
- **The CW skimmer meets real fists and a real receiver, not the bench**
  (ohs-libs `shack_cw.skim`, openhamshack-nb `ohsradio/cwskim.py`, branches
  `feature/cw-skimmer`, 13/10/2026). On ohs-box's 20 m recording
  (iqlib `20261013-ohs-box-20m-cwskimmer-200k`, RBN truth beside it):
  - Decoders print CQ and DE glued to the call ("TIQCQDESM5D", "CQDE"), and
    split calls at letter gaps ("DE OE 7AJI", "I Z 5FDE"). A word-pattern
    matcher sees no call in either. `calls.segment()` (ohs-libs
    `feature/cw-spacing`) re-spaces each channel's unjudged words for the
    most calls and keywords at the fewest changes; the two-hit rule still
    guards them.
  - Measure call recovery per call, not as one count:
    `python -m shack_cw.skim.recovery MANIFEST --show` names the stage that
    lost each RBN call (absent, squelch, letters, split, glued, matcher,
    unconfirmed). Most losses on both recordings are `letters` and
    `absent` (weak or faded signals), not spacing.
  - A per-sender gap model (letter and word thresholds learnt from a
    histogram of his gaps) helped synthetic fists and lost calls on real
    ones (box: 6 calls in the text against 10; decoder corpus beacon CER
    0.789 against 0.758). It is kept unmerged on ohs-libs
    `feature/cw-gap-model`; don't reintroduce it without the recovery
    numbers. A per-letter Viterbi with a character prior turned weak
    signals into E/T soup: E and T cost nothing to split into.
  - Matching candidates to tracks strongest-first let a station's keying
    sidebands steal its candidate until its own track died and was reborn
    with an empty decoder. Match oldest-first, and allow no birth within
    75 Hz of a stronger track.
  - A CQ-and-listen station is quiet for 20 s between overs. Dropping its
    decoder then meant each over was decoded by a new Decoder that
    relearnt the speed and lost the call. Quiet tracks keep their decoder
    until an active one needs the channel.
  - The box has an RFI comb: 38 lines exactly 240 Hz apart (a local
    switching source). Weak steady lines show a high keying index, because
    noise moves their power. A line is steady when its index is within
    1.5 dB of a simulated unkeyed line's at its level (`steady_index`).
    `comb_of()` finds the grid, so new lines on it are carriers from birth.
  - A segment channel can come at 48, 60, 96, 120 or 200 kS/s. 60 kS/s
    (Radio's 40 m) broke a fixed FFT size. Test every rate a bank channel
    can produce.
  - `multiprocessing` spawn runs the parent's main *script* again in the
    child, though not a package's `__main__`. A worker meant to import only
    numpy must be started with `__main__` hidden (`runner._main_hidden`).
  - Scores, 13/10: the Kiwi corpus spots 3 of the 18 RBN calls (6 are in
    the channels' text), with no spot on 43 quiet targets. The box spots 3
    of the RBN's 39 calls through the 80 m dipole, plus pileup callers the
    RBN never spots. CPU on the box's i5-9400T: 6.3 % front end and
    0.36 % a channel, so 64 channels take 29 % of a core.
- **A neural CW engine: judge it on held-out real recordings, never the
  bench or synthetic validation alone** (ohs-libs `feature/cw-neural`,
  13/10/2026; `Decoder(engine="nn")`, `Skimmer(engine="nn")`, classic still
  the default). Our own 72 k-parameter causal TCN + CTC behind the classic
  front end and squelch, NumPy at run time, trained on synthetic bands
  (`tools/cw_neural`). On the decoder bench's 136 clips: 23 of 78 RBN calls
  as words (classic 16, DeepCW 24), beacon CER 25.3 % (32 %, 21 %), 0.0
  characters a minute on noise; a skimmer channel costs 0.06-0.09 % of a
  core in a batch of 64, under half the classic back end.
  - Synthetic validation kept improving while real copy stood still: pick
    settings and checkpoints on `tools/cw_neural/realval.py` (KiwiSDR + RBN
    recorded for it, `iqlib list` `*-cwval*`), and keep the bench's clips
    for a final score only. The receivers the bench's Kiwi corpus used are
    the ones that yield most; recording training data from them blurs the
    test.
  - A network trained to 30 dB in 2.5 kHz printed nothing from a 45 dB
    local (its noise references then hold the tone's own main lobe) where
    the classic engine read it all. Train to 60 dB; test_nn guards it.
  - Weak beacons (-5..5 dB) stayed at 25-30 % CER whatever the data mix or
    squelch: that is this front end and size, not the training.
  - shack <-> office copies run at about 2 MB/s over the tailnet: make
    training data where it trains.
  - Round 2 (ohs-libs `feature/cw-neural-r2`, 14/10): a v2 front end
    (bins beside the tone, an 80 ms window), 0.3 s look-ahead, ensembles
    and a synthetic-text space model all landed within the realval dev
    set's noise (43-50 of 128 calls; the shipped soup 49). Networks from
    scratch lose to fine-tuning round 1's lineage at equal compute
    (`train.py --init` takes a v1 checkpoint into v2). The dev set's call
    count cannot tell candidates apart; it has no ohs-box or Flex clips,
    where the test set loses most.
  - The real strong-signal failure: a weaker station on the same
    frequency keying at once (QSO partner, pileup). 15 dB under a 38 dB
    signal the classic engine reads every letter and the shipped network
    prints rubbish; `tools/cw_neural/probe.py` shows it, `data.py
    --profile cochan` mostly fixes it.
  - On shack: start python from a directory other than ~ (an import from
    ~ hung for minutes); its sftp drops connections, so copy with
    `ssh shack cat`; keep to 5 workers (it is shared).
- **A CW language model helps when the calls are real and the network
  keeps the last word** (ohs-libs `feature/cw-lm`, 14/10/2026;
  `Decoder(engine="nn", lm=0.5)`, off by default). A streaming CTC beam
  search with a character 6-gram built from the survey's agreed real text
  (calls masked) refilled from a week of RBN calls. On 262 held-out survey
  lines (box, Flex, Kiwi; 341 RBN calls) it copies 127 calls as words
  against 106 greedy (134 against 119 after `calls.segment`); dev set 55
  of 128 against 49; about 1 % of letters both engines agreed on change;
  +0.02 % of a core a channel; characters up to 0.5 s late.
  - Round 2's space model lost calls because it was synthetic text and
    it overruled each gap greedily with no way back. In a beam search the
    network's confidence and the LM are weighed together and nothing
    prints until the beams agree or the lag passes.
  - The real call list carries the letters: the same search with random
    calls of the right shape lost letters (141 against 142 any, dev 47
    against 49). Rebuild `nn/cwlm.npz` from a recent RBN week now and then
    (`tools/cw_lm/build.py`). Super Check Partial held only 32 % of the
    RBN's calls (the RBN week 75 %) and states no terms; not used.
  - Keep held-out data honest: fit the LM by recording fold
    (`build.py --hold-fold`), never on the dev set's or bench's text.
    A bonus for words on the call list found no more calls and printed
    more listed calls in unreadable windows; it is off.
  - Commit beams output by output: committed at block ends, an app's
    150 ms blocks and a replay printed different text from the same
    network outputs. `tools/cw_lm/dump.py` keeps the network's outputs so
    any search setting replays through the live `Bank._read` in minutes.
- **The skimmer runs both CW engines, and a call needs the callsign
  check and seen-twice** (Brian, 14/10/2026; ohs-libs `feature/cw-dual`,
  Radio 0.1.21-beta.3 on ohs-box). Every channel is read by the network
  (with the LM) and the classic engine; each engine's words are judged
  as their own stream; a call is valid after 2 decodes by either engine
  if a callsign list holds it, 3 if it only has a call's shape and DXCC
  entity. The constants and the table behind them are at the top of
  `shack_cw/skim/calls.py`.
  - Measure a spot rule by replaying hits, not by rerunning the band:
    `tools/skim_eval.py run` (office, 12 workers, ~15 min) logs every
    candidate hit of the real Skimmer once; `score` replays them through
    a fresh `Calls` per variant in seconds, one engine's hits alone
    standing for that engine alone. On 57 RBN-labelled recordings (not
    the bench, not `-cwval`): 0.1.21-beta.1 52 RBN calls / 114 valid,
    beta.3's rule 70 / 157, the share the RBN heard that day 73 % ->
    77 %.
  - Half the RBN-confirmed calls we spot are on no contest list: a list
    confirms a call, never gates it ("SCP only" found 34 of 70). Any
    precision measured against the RBN favours a list built from the
    RBN; four decodes for unlisted calls looked better for that reason
    alone.
  - MASTER.SCP is never bundled (no terms): Radio's `cwSkimScp` (off)
    downloads it as the site's developer guide asks, and it adds to the
    RBN week shipped in `nn/cwlm.npz` (72 against 70 calls).
  - **Debian's numpy in a store image uses the reference BLAS.** The
    network then cost 0.36 % of a core a channel on ohs-box, twice what
    a pip numpy (OpenBLAS) costs; Radio's image installs
    `libopenblas0-pthread` with `OPENBLAS_NUM_THREADS=1`. Any other app
    image that runs the network (Flex, Icom) wants the same. Bench inside
    the image on the box (`podman run --cpus=1 ... -m
    shack_cw.skim.bench --engine both cpu`), not on a dev machine.
  - Both engines on 256 busy channels needed 160-175 % of a core, past
    the one worker process; beside the network the classic engine now
    reads only the strongest 64 (`pool.CLASSIC_MAX`). On the box,
    beta.3: 44 % of a core at 64 busy channels, 72 % at 256 (beta.1
    34 % and 93 %); the box's own 20 m capture replayed through each
    image: beta.1 4 valid spots at 23 %, beta.3 7 at 32 %.
- **ohs-box is an Intel i5-9400T (6 cores), not an N150** (read 13/10,
  openhamshack docs/CW-SKIMMER-PLAN.md §2.2). A CPU figure measured there
  says nothing exact about the N150 the beta targets: measure in the app's
  image with `--cpus=1` on an N150 before calling a budget met.
- **Before porting from another SDR project, read each file's licence
  header, not GitHub's summary.** GitHub reports "GPL-2.0" for both
  `-only` and `-or-later`, and only `-or-later` can join our
  GPL-3.0-or-later code. DSD's D-STAR files (`dstar_header.c/h`, `fcs.h`,
  `descramble.h`) are GPL-2.0-only by its `COPYRIGHT` (checked
  22/10/2026). And AAC, AMBE and IMBE are never ported from any source,
  permissive ones included: the patents are on the algorithm, so only a
  library the user installed may decode them (RADIO-SDR-PLAN.md §9).
- **Getting at a store app's API on ohs-box from a shell, read-only:**
  `podman exec` into the app's container (as `dock360`,
  `XDG_RUNTIME_DIR=/run/user/987`) and call `127.0.0.1:$SHACK_PORT` with
  the `X-OpenHamShack-Proxy-Secret` from its own environment and an honest
  `X-OpenHamShack-User`. The secret never leaves the container. ohs-box
  has no rsync and no numpy on the host: cut or convert IQ in a one-shot
  `podman run --rm --entrypoint python3` of the app's own image, with
  `--cpus=1`.
- **NB's dish meter cannot be opened through its server API** (0.1.14):
  only the desktop window calls `Radio.dish_open`, and `dishOpen` is a
  status key. The phone page for the caravan survey (`tools/dish-survey`,
  ohs-box :8098, 16/10/2026) therefore applies the same measure to the
  wide-scope lines from `/api/events?kinds=wide` as a View-level client:
  within 0.3 dB of the dish meter's SNR on the same IQ. If the store app is
  ever to drive the dish meter, it needs a route; a host service with
  `LoadCredential=` of the module env is how to read the proxy secret
  without root.
- **ohs-box's Pluto answers iiod on the tailnet at `ip:ohs-box:30431`,
  and a client there bypasses the broker.** Ku Sweep (`tools/ku-sweep`, a
  Mac app, 17/10/2026) uses it to sweep the dish's Ku low band; anything
  like it must be run with NB stopped, gate every attribute write (only RX
  settings, plus TX LO powerdown=1 and TX gain -89.75), and put NB's RX
  settings back at close. The box's Pluto is an AD9364 (LO 46.875 MHz-6
  GHz, up to 30.72 MS/s); at 20 MS/s with NB's x4 FIR still loaded the ADC
  runs at its 640 MHz ceiling and the driver accepts it, so nothing need
  touch the FIR (which is shared with TX). Behind the Bullseye LNB at 20
  MS/s: 20 dB gain peaks at -16 dBFS, 40 dB clips.
- **A client off the box that needs a store app's tuner goes through a
  box-side service, never the app's secret** (Ku Sweep 0.2.0, 17/10/2026).
  To identify Ku carriers Ku Sweep asks the dish survey service on ohs-box
  (`POST /api/ku/scan`, tailnet only), which already holds QO-100 WB's
  proxy secret via `LoadCredential`, to retune WB's MiniTiouner through
  WB's own `/api/rx/tune` at the Control level, one gate sending only
  id/frequencyMHz/symbolRateKs, and to put WB back from a restore file
  written before the first tune (also replayed at service start). WB's
  `/api/rx/raw` `t` is when WB answered, not when longmynd wrote the line,
  and the last line of the old tuning lingers after a retune: judge a
  lock by `$6` being inside the target's search window, not by `t`. WB's
  status gives `name` = longmynd `$13` (provider) and `provider` = `$14`
  (service): read the raw fields when it matters which is which.
- **At 26 E Es'hail 2 repeats V and H on the same frequencies,** so a
  sweep's polarisation can only be judged by the transponders with no
  co-frequency twin (in the low band mostly Badr's). The shipped list is
  `tools/ku-sweep/kusweep/data/26E-transponders-2026-10-17.csv`
  (KingOfSat + LyngSat, fetched once by hand): refresh it the same way,
  never with a crawler, and keep the date in the name.
- **`shack_cw` wants 75 ms blocks, not a radio's 20 ms packets.** AFC skips
  any block under 256 samples and averages over blocks; NB feeds 900-sample
  blocks at 12 kHz and the bench measures that. Icom gathers its LAN
  packets (`app/cw.py`); Flex's 24 kHz stream must too. Decode off the
  event loop.
- **The Remote TV emulator `ohsr-tv` is 32-bit x86:** install
  `app-universal-debug.apk`; the x86_64 split fails with
  INSTALL_FAILED_NO_MATCHING_ABIS and leaves the old build running.
- **Fire TV screenshots work.** `adb exec-out screencap -p` prints
  "Init wrapper sys mutex…" before the PNG; strip up to `\x89PNG`.
- **Weak-signal playback in libVLC 3 (freezes, not blocks):**
  - The cause is TS continuity checking, not the clock or the CPU. Each lost
    packet flags a discontinuity, and VLC's H.264/HEVC packetizers then drop
    everything to the next clean I-frame: 5-70 s freezes at 0.5-5 % loss,
    hardware or software. `--no-ts-cc-check` (instance option; Android's
    libVLC ignores the media form) passes damaged frames to the decoder.
  - Then decode MP2 with libavcodec (`:codec=avcodec,all`, or MediaCodec/
    VideoToolbox first then `avcodec,all`): mpg123 drifts behind the clock
    on damaged audio and goes silent for 10-38 s.
  - On the Fire TV (MediaTek) hardware decoders paint damaged frames grey
    until the next I-frame; software keeps the film recognisable, so the TV
    defaults to software. Measured matrix: openhamshack-remote docs/TESTING.md.
    The iOS VLCKit player still needs the same change.
- **Compose on TV:** the first BACK only clears focus. Handle BACK
  explicitly. Default TV scrolling holds the focused row a third of the way
  down, which gives an empty top or a clipped title.
- **Compose on TV: focus leaks out of overlays.** Focus search is geometric
  and ignores what is drawn on top, so D-pad Down on a full-screen panel can
  land on a control of the screen hidden beneath it - and OK then acts on a
  screen nobody can see (on StationFlow TV it retuned the radio). Make
  everything under an open panel unfocusable: `LocalTvInert` in
  `~/stationflow-tv`'s core TV kit.
- **A TV text dialog's error line under the field is clipped** by the
  on-screen keyboard; put the reason above the field.
- **Compose: `Modifier.fillMaxSize().aspectRatio(r)` ignores the ratio**
  (fillMaxSize fixes both constraints first), so a fixed-proportion picture
  overflows a tablet. Give `aspectRatio` unconstrained room inside a centred
  Box instead.
- **Kotlin `Regex` on Android is ICU, not the JVM's: escape every closing
  bracket.** `Regex("""\[.*?]|\{.*?}""")` passes every JVM unit test and
  throws `PatternSyntaxException` on a device; in a companion object that
  is an `ExceptionInInitializerError` the first time the class is touched,
  which no `runCatching` around the call catches. Remote's cty.dat lookup
  (core-candidates `decode/Cty.kt`) took the app down on the emulator that
  way (12/10/2026) with its tests green. Write `\]` and `\}`, and open a
  screen that uses a new pattern on an emulator before landing.
- **Remote's decode lists name countries from their own cty.dat** when the
  server sends none (core-candidates `decode/Cty.kt`, openhamshack-nb's pinned
  Big CTY in its assets with the MIT notice). The NB/Radio engine names
  them itself on `api/events` (`country`, `dxcc`, `continent`) from openhamshack-nb
  branch `feature/decode-country` on; the server's answer wins (it reads
  the operator's own file). Refresh both copies together.
- **icom web harnesses: `Scope.setData` drops untagged frames while no radio
  is selected.** A harness must `Scope.select(id)` and stamp `radio_id`, or
  every waterfall check passes or fails on nothing.
- **Android Fire TV packaging:** needs LEANBACK_LAUNCHER plus a banner,
  `uses-feature … required=false` for touch, camera and mic, no Play
  services, and an armv7 APK.
- **iOS ATS:** "allow local networking" beside "allow arbitrary loads" makes
  iOS ignore the latter.
- **iOS camera:** the HaishinKit sender always encodes landscape.
- **Keep the screen awake while a box is open,** or auto-lock unkeys.
- **Shack's `/tmp` is a 31 GB tmpfs shared by every session.** Big files go
  in `~/build/`, and delete what you make. It filled on 09/10.
- **Shack's ufw drops inbound UDP;** add narrow rules. Containers reach
  siblings via the tailnet address, not 192.168.
- **OpenHamShack `release.sh`** runs the whole suite and refuses on any failure;
  the git remote is `hub`, not `origin`. Browser tests flaked under load
  until 0.9.17 fixed them; if one fails, find out why rather than re-running.
- **Image builds: never bind-mount the host's /dev into a chroot.** A package
  script re-owned ohs-dev's /dev/kvm and broke QEMU until `systemctl restart
  systemd-udevd`. `~/openhamshack-os` uses a private /dev; Classic's
  mkimage.sh (archived, frozen at its last commit) still binds it.
- **Desktop shell (`shack_desktop`) traps:** headless GTK waits 25 s for
  xdg-desktop-portal - run headless tests under `dbus-run-session`; a frozen
  macOS app that writes to an external volume (e.g. /Volumes/OpenHamShackBuild)
  raises a permission prompt and waits behind the lock screen; apps built on
  `http.server` must use `shack_desktop.LoopbackHTTPServer` (a reverse DNS
  lookup of 127.0.0.1 hangs on macOS); pages need `script-src 'self'
  'unsafe-eval'` for pywebview's bridge on WebKitGTK.
- **Screenshots on Brian's Windows desktop: PrintWindow on the app's own
  window only, never a copy of the screen** - a screen copy caught his
  messaging app on 09/10 (deleted at once everywhere).
- **Mac screenshots over SSH: the app photographs itself.** `screencapture`
  is refused without a Screen Recording grant nobody can give remotely. The
  kit shell and the Qt apps (ohscore/ui/snapshot.py, ohsatv/ui/snapshot.py)
  save their own front window when `SHACK_DESKTOP_SNAPSHOT` names a file;
  `try-dmg.sh` sets it. A Qt app without that module proves its launch but
  brings back no picture (desktop-remote says "NO SCREENSHOT").
- **The Qt apps' Windows installers tick ADI's Pluto drivers by default.** A
  silent install (`/VERYSILENT`) would put them on the machine; pass
  `/MERGETASKS=!plutodrivers` (try-install.ps1 `-SetupArgs`). They install
  under `Program Files\OpenHamShack <name>`, not `Program Files\OpenHamShack`.
- **A store image can ship without its decoders and nobody notices:** NB/Radio
  0.1.10-beta.1 went out with no ohsdigi (build-store.sh drops the host-built
  .so) so FT8/FT4/HSmodem silently never decoded on a controller. Run
  `tools/store-check.sh <app>` (openhamshack-nb) on every built image; beta-build
  does. Store releases need `~/build/ohs-dist/ohsdigi` (or `OHSDIGI_WHEELS`).
- **An IC-9700 in standby still logs in over the LAN** and answers every CI-V
  poll with a bare NG (`FE FE E0 A2 FA FD`): treat that as "asleep", not
  connected. Power-on over the LAN is just `FE FE A2 E0 18 01 FD` (no FE
  preamble; wfview adds the run only on USB/serial). Icom app:
  `POST /api/radios/{id}/power {"on":true}` (Control level).
- **Every `dock360ctl install/update` rewrites the controller's caddy config.**
  A hand fix there lasts only until the next app install; fix the platform.
- **Store images:** selftests inside an app image need `-w /opt/<app> --entrypoint
  python3` (podman run doesn't replace ENTRYPOINT otherwise).
- **Websocket proxies must not forward the browser's `Sec-WebSocket-*` headers
  upstream** - it broke Chrome's sockets through a test controller.
- **`setsid cmd &` can leave `$!` pointing at an already-exited process;** kill
  by the PID the process writes itself (pid file), not `$!`.
- **Subagents with worktree isolation** get a worktree of the *session's*
  repo. For another repo, create the worktree yourself and spawn without
  isolation.
- **Copying an edited tree into a rebased worktree reverts other people's
  commits.** An agent pinned to an openhamshack worktree cannot run git in
  another repo on ohs-dev, so it edits a plain copy there and tars it into
  its clone on shack to build. After a rebase onto a moved `main`, a tar of
  the whole `android/app/src` put the copy's old FlexScreens.kt back over
  the tablet session's Flex fix (13/10/2026), and a `git add` of the
  directory committed the revert. Caught only because `git status` listed
  a Flex file the work never touched. Copy back only the files you edited,
  refresh the local copy from the clone after every rebase, and run
  `git diff --stat origin/main HEAD` before landing: it must list only
  your files.

- **An installed ohs-libs package shadows the vendored wheels.** A venv
  that has `shack_client` (or any shack_* package) pip-installed tests
  that copy, not the app's `tools/vendor/` pin, so a re-vendor looks
  unfixed (WB in `~/build/venvs/dock360` tested the old Store, 10/10).
  Run WB's tests with system `python3` (as `tools/ci.sh` does); for other
  apps refresh the venv from the lock (`tools/vendor/install.py`) after a
  re-vendor.

- **A stop that overruns `stop_timeout` gets SIGKILLed, and the radio is
  never told.** In an aiohttp app, aiohttp waits up to 60 s by default for
  open handlers *after* on_shutdown, and on_cleanup comes after that wait.
  So release hardware in on_shutdown: unkey, close every websocket for a
  bounded time, then log out. Also pass `shutdown_timeout` below the
  module's stop timeout. A second trap: since Python 3.12,
  `asyncio.Server.wait_closed()` waits for every connected client, so a
  rigctl server with WSJT-X attached never stopped. Close the clients'
  writers first. An IC-9700 left with a dead session refuses the next
  login for 35-81 s. On 10/10 it then gave the next session a CI-V stream
  that never carried a frame: audio played, but the frequency showed
  dashes and the scope stayed empty. shack_rig now logs out and back in
  when that happens (`CivStream.wedged`). Check a box's log for
  `StopSignal SIGTERM failed` after any restart.

- **WB's browser layout checks time out on shack** unless run with
  `OPENHAMSHACK_LOCAL_SCREEN=loopback` (`appliance/test_console.py`); ohs-dev
  has no chromium, so there they skip silently. Neither says why.

- **A desktop app's child processes outlive its window.** Closing WB's
  window left ffmpeg feeding the radio with no TX time-out and mpv windows
  open (fixed 10/10: shutdown unkeys via set_ptt(False) and stops every
  player/tuner). Any desktop form that spawns encoders or players needs the
  same shutdown path.
- **Console programs started from a frozen Windows app flash a console
  window** unless started with `CREATE_NO_WINDOW`.
- **"Installs and opens a window" is not a Windows proof.** WB 0.9.17
  passed it while shipping no ffmpeg/mpv and a Linux-only player, encoder
  probe and font. A proof must run the self-test and a receive.

- **NB may key an IC-9700 by CAT, for its own digital overs only** (Brian,
  12/10/2026). Before that ohscore/rig could not key a radio at all. Now
  PTT (CI-V `1C 00 01/00`, rigctld `T 1/0`) passes the drivers' whitelist
  only with a `PttPermit` armed on the engine's transmit thread for one
  `send()` over in a CAT mode (FT8/FT4/Q65/JS8, PSK, RTTY, CW lines), with
  `rigCatPtt` on (off by default). Voice, voice memories, FreeDV, SSTV and
  HSmodem never key it. Audio goes to the 9700's USB CODEC by name
  (`rigTxAudioOut`, never the system default), the radio is put in USB-D
  (`06` + `1A 06`), and DATA MOD is read (`1A 05 01 16`) and must include
  USB. Any new caller that wants to key a rig must go through that path,
  not around the permit; tests in openhamshack-nb `tests/test_extrig_catptt.py`
  and `test_rig_*.py` prove a stray call is refused.
- **IC-9700 menu writes go only through NB's setup assistant**
  (openhamshack-nb `ohsnb/rigsetup.py`, 12/10/2026). The CI-V driver can now
  write DATA MOD, USB MOD Level, satellite mode and MAIN/SUB exchange and
  selection, but each body only under a `SetupPermit` the assistant arms
  for exactly the writes the operator just confirmed; no permit can name
  any other write (RF power, other menus). It saves the originals
  (`rigSetupSaved`) and restores them on request: leave as found. Its level
  set is the one other thing that keys the 9700, through the CAT PTT path,
  only after a dummy-load tick, 6 s at most. Nothing runs on connect. The
  IC-9700 diagnostic (ohsnb/rigdiag.py, also `--rig-diagnostic`) keys the
  same kind of over (`ToneOver`), only after the tick and a confirmation
  naming band and power, writes nothing, and its CLI `--keyed` is refused
  without `--i-have-a-dummy-load-and-operator-present`.

- **Shared IQ library (office:/srv/iq).** Before recording IQ, run `iqlib list`
  (filters `--band --mode --source --since`): the clip you need may exist, with
  ground truth. After recording, `iqlib put` it with full metadata; put refuses
  without format, rate, centre, UTC start and source. Prefer SigMF for fresh
  recordings (put reads rate/centre/start from the `.sigmf-meta`). Example:
  `iqlib put box.sigmf-data box.sigmf-meta --source "ohs-box sdrplay RSPdx ant C" --slug skimmer --mode cw --truth rbn-spots.txt`.
  `iqlib get <id>` caches it in `~/.cache/iqlib/<id>` and verifies sha256;
  `iqlib path <id>` gives the path for jobs running on office. Old recordings
  move to the 9 TB disk with `iqlib archive <id>` (or `--older-than DAYS`);
  `get` reads either tier, `restore` brings one back. ohs-box has no rsync, so
  iqlib falls back to scp there. Layout, fields and conversions: README.md on
  office (`/srv/iq/README.md`); tool `tools/iqlib`, tests `tools/iqlib-tests`.

## 6. Releases and ownership

- **Classic:** `tools/release.sh <v>` writes `beta.json` and signs it;
  `tools/promote.sh` makes it stable.
  - Never put a platform package in a Classic feed.
  - The public mirror (openhamshack.brian-henderson.co.uk) is pushed by hand via
    the Control360 session.
- **OpenHamShack Remote:** debug APKs to `/srv/openhamshack-apps` for now. Apple builds
  go through TestFlight once it's set up.
- **Dock360 and its apps:** follow `~/.claude/CLAUDE.md`: commit first, diff
  the installed copy, no per-feature VERSION bumps, and look at what a release
  *removes*.
- **One owning session per repo** per phase. Check `git worktree list`, and
  `ListAgents` for who is active, before starting.
  - OpenHamShack Desktop (`ohsqo`, QO-100 station on DATV code) is archived: nothing may depend on it any more.
  - The NB session also cuts Radio releases.
- **QO-100 NB and Radio desktop releases live on openhamshack.com** (Brian,
  12/10/2026; the brian-henderson.co.uk hosts were deleted on 09/10 and are
  not coming back):
  - **One command (Brian, 18/10/2026), on ohs-dev from a clean checkout at
    hub/main:** `tools/release-all.sh nb=<v> ham=<v> [--platforms
    linux,windows,macos] [--dry-run] [--yes]`. It lists what the release
    removes and waits for "yes", runs the suite once, makes both release
    commits, builds Linux (shack, into scratch copies of /srv), Windows
    (VM 130, signed, install-checked) and macOS (Mac mini, notarised,
    Gatekeeper + headless proof) in parallel, and publishes only if all
    passed: main fast-forwarded, feeds written from the live ones, /srv
    updated, publish.sh, the downloads page, live checks. One ntfy
    notification at the end. Logs: `~/build/release-all/<run>/` on ohs-dev
    and shack. Hosts: `~/.config/openhamshack/nb-release.conf` (ohs-dev).
    A dry run's version takes a `+label` (`0.1.23+rc0`), never `-rc0`.
    It refuses a release without `docs/release-notes/<app>-<v>.txt`. The
    steps below are what it does; use them by hand only to finish a run
    that failed after "hub main fast-forwarded". Dry run 18/10 (NB
    0.1.23+rc0, Radio 0.1.22+rc0): 36 min, of which the suite 25.
  - Update feeds (baked into every build from 0.1.16; never move them
    again, or every installed copy is stranded as 0.1.15 and earlier were):
    `https://openhamshack.com/desktop/nb/update.json` and
    `https://openhamshack.com/desktop/ham/update.json`, signed
    `ed25519:dad6e2ca90668fce`. GPL source: `https://openhamshack.com/source/`.
  - Cut with `tools/release.sh` on shack as before. Then upload with
    openhamshack-nb `tools/publish.sh nb|ham|source`, source first: it uses the
    month key and sends the payload, then the feed last. For nb/ham it
    uploads only what update.json names, plus checksums, the feed and
    `.htaccess`. The product pages stay behind because they name people,
    and the site publishes no personal name.
  - Then put copies on the website's downloads page: copy the release
    files to `~/build/nb-radio-release/{nb,ham}/` on ohs-dev and rebuild
    `~/openhamshack-site` (collect-downloads offers NB/Radio only from
    0.1.16).
  - publish.sh nb|ham prunes on its own (from openhamshack-nb d90c6c2, 19/10):
    once the feed is up, every .deb/.exe/.dmg (+.sha256) the feed does not
    name goes from /srv and the site into `/srv/openhamshack-{nb,ham}-releases-archive`,
    and must then 404. Before that every superseded .deb stayed live for
    good. release.sh's "remove from the remote site:" list (`--remove`,
    `--remove-list`) still works; `publish.sh nb|ham --prune-only [--dry-run]`
    prunes against the live feed without uploading anything.
    Check signatures with release.sh's own call (`osslsigncode verify
    -CAfile/-TSA-CAfile packaging/windows/microsoft-identity-verification-root-2020.pem
    -ignore-crl`); a bare `osslsigncode verify` reports "Failed" on a good file.
  - **A release for one platform only** (NB 0.1.19, Windows only): cut it as
    usual, then move the other platforms' new packages out of the release
    folder, put the previous update.json/.sig back and run `update-feed.py
    write --version <v>`: a slot with no file keeps the previous manifest's
    entry, so the others stay on the old version cleanly. publish.sh
    uploads only what the feed names, so nothing else goes up.
  - **macOS in the feed (from NB 0.1.22 / Radio 0.1.21):** `release.sh
    --macos` publishes labelled previews only and refuses a release .dmg.
    A release .dmg (`build-macos.sh --sign`: Developer ID, notarised,
    stapled) goes in by hand: publish the `<package>-macos` source project
    with `source-site.py publish-own` (the release's own src tarball) and
    `publish` of the commit's `packaging/macos/sources.txt`, then `build`,
    copy `<package>-<v>-arm64.dmg(.sha256)` into the release folder and
    `update-feed.py write`; then publish.sh source and nb|ham. The script
    used is shack `~/build/nb0122-rel/mac-feed.sh`; fold it into release.sh.
  - **The website's collect-downloads.py does not recognise the renamed
    package names** (`openhamshack-nb_<v>_amd64.deb`, `openhamshack-nb-<v>-setup.exe`):
    give it copies under the published names (`OpenHamShack-QO-100-NB-<v>-linux-x86_64.deb`,
    `...-windows-x64.exe`; macOS `...-macos-arm64.dmg`, taken only from
    `~/build/beta-build/desktop/macos/*`). ohs-dev `~/build/nb-radio-release`
    holds them so named since 0.1.22.
  - The Windows build's smoke tests (FT8 decode on the simulator via the
    command line) can catch what the Linux suite does not: HAM 0.1.18 died
    there and shipped as 0.1.19. Build Windows before publishing anything.
  - Run plain, collect-downloads.py offers the newest build of every
    product it finds under ~/build, not only NB/Radio (on 13/10 it would
    have moved six other products to unreleased builds). An NB/Radio
    release replaces only its own entries in the committed
    `data/downloads.json`, stages into a copy of `~/build/site-dist` (the
    live dist), and checks with `diff -r` against it that nothing else
    changed before publish-web.sh site.
  - `/feeds/` (platform) and the website belong to openhamshack-os
    `publish-web.sh`. Each tool touches only its own folders.
  - `/tv/remote.apk` (+ `.sha256`, `.htaccess`) is Remote's sideload copy
    for Fire TV Downloader (`openhamshack.com/tv/remote.apk`), uploaded by
    hand with shack's month key (13/10/2026: armeabi-v7a, feature/remote-https
    e123586, signer 0fd614f6…ba83d5). Not part of the website build; replace
    it in place, never delete the folder.
- **Packet Radio desktop releases are one command** (Brian, 18/10/2026;
  first used for 0.2.0), on shack in `~/shack-packet` (or its release
  worktree): `PYTHON=<venv with ohs-libs editable> OHS_LIBS=<ohs-libs
  checkout> tools/release.sh <v> [--only linux,windows,mac,feed]
  [--firewall-test]` refuses a dirty tree (either repo) or missing release
  notes, bumps VERSION and commits "Release Packet Radio <v>", runs the
  ohs-libs and app suites, builds and proves Linux (+ .deb install test),
  Windows on VM 130 (signed, installed, self/library/diagnostics tests,
  uninstalled, cleaned up) and macOS on the Mac mini (Developer ID,
  notarised, stapled), then signs `update.json` with NB's release key
  (`ed25519:dad6e2ca90668fce`) and prints the remove list. Then
  `tools/publish.sh source` (the shared source site, project
  `openhamshack-packet`, before any binary), `tools/publish.sh packet
  --remove-list ~/build/shack-packet/rel-<v>/remove-list.txt`
  (`/desktop/packet/`, feed last; the feed URL is baked into every build
  from 0.2.0, never move it), and `tools/release-site.sh <v>` (downloads
  page: only the Packet entries, refused if the stage differs from the
  live dist in anything else). Build hosts are named in
  `~/.config/openhamshack/packet-release.conf`, never in the repo, whose
  source tarballs are public.

- **Public copies on GitHub** (Brian, 21/10/2026): every OpenHamShack repo
  except the Classic appliance is public at `github.com/openhamshack/ohs-*`,
  as a *separate, cleaned* history. The hub stays the master; a post-receive
  hook (hung off `core.hooksPath`, because gitsync rewrites
  `hooks/post-receive`) replays each new commit on the published branch (main; feature/app for
  Packet; packet-monitor for the Mayhem fork) with HANDOVER.md, agents and
  tooling dropped and tailnet/LAN addresses replaced. Never push to GitHub by
  hand and never add it as a remote in a checkout: its commits share nothing
  with the hub's. Anything you would not want public - keys, customer names,
  a home address - must not be committed to a hub repo either; the cleaner
  only knows addresses and Brian's own identifiers (emails, user name, the com.openhamshack package and bundle ids, which become com.openhamshack). Tool, names and rules: `tools/github-mirror/`; the
  log for a repo is `~/.local/state/ohs-github/<repo>.log`, and a failure
  pings Brian's phone and retries on the next push.

## 7. Where things are written down

- **The plan:** [PLATFORM-PLAN.md](PLATFORM-PLAN.md).
- **Radio as a full SDR receiver** (Rust decoders in ohs-libs `shack_sdr`,
  the runtime codec loader and host libraries, Milestones 1-5):
  [RADIO-SDR-PLAN.md](RADIO-SDR-PLAN.md).
- **The latest handover:** [../HANDOVER.md](../HANDOVER.md).
- **Per-repo detail:**
  - `~/openhamshack/docs/next-session.md` and `HANDOVER.md`
  - `~/openhamshack-remote/docs/{REMOTE-CONTRACT,TESTING}.md`
  - `~/openhamshack-nb/HANDOVER.md`
  - StationFlow `icom/README.md` and `docs/`
- **Brian's memory notes** (`~/.claude/projects/-home-user/memory/`):
  - `openhamshack-*.md`
  - `openhamshack-app-family.md`
  - `stationflow-tv.md`
  - `pluto-reboot-keys-tx-lo.md`

## 8. Working with subagents

Delegate. Brian's standing rules: hand investigations, builds, long waits and
device tests to background subagents so the conversation is never blocked;
give each job the cheapest model that will do it well; run at most **2-3 code
agents at once**; agents test only what they changed (the full suite runs once,
before a release).

Use the OpenHamShack agent types (definitions in `~/.claude/agents/ohs-*.md`,
copies in this repo's `agents/`); each preloads this skill and the house rules:

| Agent type | Model / effort | Use for |
|---|---|---|
| `shack-architect` | opus / high | Platform and protocol design, the broker, contracts, migration plans - decisions that are expensive to get wrong |
| `shack-builder` | opus / medium | Real code changes with tests: app servers, Android/Apple kinds, platform, fakebox. The default for code |
| `shack-verifier` | sonnet / medium | Measuring on the Fire TV, emulators, Mac simulators, fakebox; screenshots and numbers, no fixes |
| `shack-researcher` | sonnet / medium, read-only | Manuals, protocols, API facts, prior art, name checks; findings with sources |
| `shack-mechanical` | haiku / low | Renames, doc updates from given facts, regenerating assets, copying APKs - no judgement needed |

Choosing: if a wrong answer would ship a bug or a bad decision, use builder or
architect; if it only gathers or measures, researcher or verifier; if a junior
could do it from the brief alone, mechanical. Plain `general-purpose` or `Plan`
still work for one-offs outside the family.

Traps (each cost real time):
- `subagent_type: "fork"` **ignores the model setting** - a fork always runs on
  the parent's model. For a cheaper model, spawn a named type with a full brief.
- `isolation: "worktree"` gives a worktree of the **session's** repo, not the
  one you mean. For another repo, create the worktree yourself
  (`git -C <repo> worktree add ~/wt/<topic> -b feature/<topic> <base>`) and
  spawn without isolation, telling the agent the path.
- Two agents in one checkout collide; never commit while an agent is editing
  the same tree; commit agents' work with explicit pathspecs.
- Background agents can't be watched mid-run; give them a clear stopping
  point and a report format, and relay what matters to Brian - their report
  is not shown to him.
- Pass the session's commit attribution lines in the brief.
- **Builds and tests run from a script, not an agent (Brian, 09/10):**
  `tools/beta-build/beta-build.sh` (nightly user timer `beta-build.timer` on
  ohs-dev, 02:30) runs every repo's tests, every store package and the Linux
  installers, skipping anything already green on the same commit, and writes
  `~/build/beta-build/summary`. Read that file, not build output; open a
  step's log only when it says FAIL. To rebuild now:
  `systemctl --user start --no-block beta-build.service` (or the script with
  `--only <step>`). Agents write code and fix failures; they don't babysit builds.
  Same folder: `merge.sh <repo> <branch> [--into line] [--test cmd]` lands a
  finished branch (fast-forward only, push, worktree and branches removed);
  `desktop-remote.sh windows|macos <app>` builds and proves an installer on
  the Windows desktop or the Mac (on demand, never timed); `housekeeping.sh`
  runs nightly from beta-build. The autopilot nudges an idle session only
  when something changed, and after a milestone checkpoint the session writes
  `~/.local/state/ohs-autopilot/RESTART` to be replaced by a fresh one.
- **Credit (Brian, 09/10):** tell every agent in its brief: no sub-agents of
  its own, no `until ... sleep` watcher loops (run in the foreground with a
  timeout, or wait for the background-task notification), scoped tests only.
  Agents left alone fan out into sub-agents and pile up duplicate watchers.
