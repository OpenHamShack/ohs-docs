# OpenHamShack website content brief (M5)

This is a research brief for the website builder, not final copy. Read-only research; nothing was changed. The page copy is written to be pasted. Source comments are HTML comments so they don't render. `[check]` marks anything I could not verify. Section 0 lists conflicts between sources. Read it first.

Today is 09/10/2026. The ISO, the store and the Digital Modes app are not finished, so many links will not exist yet.

---

## 0. Read first: conflicts and traps

1. **Transmit "tested into fakes only" is not strictly true for DATV.** On 8 October 2026, with Brian present, PlutoDVB2 transmitted on air from a real Pluto on 1255 MHz. It ran 14 short overs at -30 dB with a MiniTiouner receiving. They locked, and MER was about 10 to 13 dB (`~/openhamshack-datv/HANDOVER.md:1-80`). `~/openhamshack-datv/README.md` still says "nothing has been keyed on a radio", which is stale. BETA-PLAN says to write "transmit tested into fakes only" (`BETA-PLAN.md:215-217`). Suggested site wording: "Nothing in this beta has been through formal on-air transmit testing. Some earlier bench tests exist." **Question for Brian: do you want the DATV on-air test mentioned?**
2. **Windows signing.** The NB guide says "The installer is code-signed by 360 Technology" (`~/openhamshack-nb/docs/USERGUIDE.md:70`). DATV 0.2.0 is also described as signed (`~/openhamshack-datv/HANDOVER.md:113`). BETA-PLAN says installers are unsigned for the beta (`BETA-PLAN.md:22-23`). `PACKAGING.md` says Windows and Linux stay unsigned. The site follows BETA-PLAN: unsigned. Re-check each .exe before publishing and soften the warning if any is in fact signed.
3. **macOS signing.** `~/openhamshack-nb/docs/INSTALL.md:629` and `~/openhamshack-nb/docs/macos.md:3` say the Mac builds are unsigned. HANDOVER and `PACKAGING.md` say beta macOS builds are Developer-ID signed and notarised (`HANDOVER.md:62-63`; `docs/research/PACKAGING.md`, "macOS signing and notarisation"). The site follows HANDOVER. Check each .dmg with `spctl -a -vv` before publishing.
4. **macOS is Apple Silicon only.** NB and Radio need an M1 or later Mac with macOS 14 or later, plus Rosetta 2 for FT8 decoding via `jt9` (`~/openhamshack-nb/docs/INSTALL.md:590-602`). The BETA-PLAN does not say "Apple Silicon only", so the site must say so. [check] for the other apps' Mac builds.
5. **Licences.** BETA-PLAN D13 says every app is GPL-3.0. Today `icom/module.yaml:41` and `flex/module.yaml:41` say MIT, and `~/stationflow-tv` is MIT. The GPL repos are openhamshack, openhamshack-nb, atv, teletext, datv, remote and ohs-libs. Use GPL-3.0 on the site only once Icom and Flex are relicensed. [check]
6. **The QO-100 WB guide describes the Classic box (0.9.x), not the beta store app.** The Classic guide still has the licence option "Other: no band check" (`~/openhamshack/USERGUIDE.md:420`). The beta store app removes it and takes its band limits from the licence dataset (`BETA-PLAN.md:230-233`). Don't copy Classic wording about licence regions.
7. **The openhamshack-net chat server is not on this VM.** It is `~/openhamshack-net`, on shack. See section 7.
8. **The old domains are being deleted.** Do not link to `*.brian-henderson.co.uk`, and don't reuse old site copy as-is. Several app READMEs and USERGUIDE.pdf still carry the old names.
9. **`BETA-PLAN.md:136` calls the ISO "hybrid", with Secure Boot not mentioned.** "Secure Boot off" is the brief's request. It is not documented anywhere I read. [check] with the ISO builder. Set expectations as "turn Secure Boot off if it will not boot".
10. **Initials ban.** Never write "OHS" on the site (`brand/README.md:48-49`). Use "OpenHamShack" as one CamelCase word. Product names are "OpenHamShack <App>". Short names (QO-100 WB, Icom, Remote) go beside icons only.
11. **Brand kit approval.** `brand/README.md:3` still says "draft for Brian's approval". BETA-PLAN says it is adopted with a reserved logo, and that wins.

---

## 1. Home page

<!-- Sources: BETA-PLAN.md:30-66 (architecture, three ways to use it); GUIDE.md:14-22 (family); HANDOVER.md:9-110 (built state). -->

### Headline
**OpenHamShack: open software for your ham shack.**

### Pitch (one paragraph)
OpenHamShack is a family of eight free, open-source apps for amateur radio. They cover QO-100 wideband and narrowband, terrestrial digital and analogue TV, general-purpose radio, Icom and Flex rig control, and FT8/FT4 digital modes. Every app runs on its own on Linux, Windows and macOS, so you don't need anything else. If you want one shared place for your logbook, station profile and hardware, you can add the OpenHamShack controller, a small server you install on any x64 PC. Phones, tablets and TVs can then watch and operate the station through OpenHamShack Remote. It is built by amateurs, for amateurs, and it is a beta.

### Three ways to use it
1. **Desktop apps, standalone.** Install any app on Linux, Windows or macOS. It keeps its own logbook and station profile and works with no server. Most apps start on a built-in simulator, so you can try them before connecting a radio.
2. **The OpenHamShack controller.** A bootable installer for any x64 PC. It runs the apps in a store, shares one logbook, one station profile and one set of band plans, and decides which app may use which radio. Desktop apps and Remote find it on your network and join it. If the controller disappears, the apps keep working.
3. **OpenHamShack Remote.** Native apps for Android phones, tablets and TVs (including Fire TV), with iPhone, iPad and Apple TV versions to follow. Watch the receive picture, tune, and (on phones and tablets) transmit under a safety lease.

### The apps (card grid; order below)
QO-100 WB · QO-100 NB · DATV · Radio · ATV (with Teletext) · Icom · Flex · Digital Modes (coming, being built now). Remote is the client, not one of the eight.

### Beta statement (verbatim candidate)
> **This is a beta.** The software has been tested on simulators, on test rigs and, for receiving, on some real radios. **Nothing in this beta has been through formal on-air transmit testing.** Transmit paths were exercised against fakes. Installers are not code-signed on Windows or Linux, so your system will warn you. Expect rough edges, and tell us what you find. You, not the software, are responsible for your licence.

<!-- Sources: BETA-PLAN.md:22-23 (unsigned), 213-217 (fakes only), 133-134 (M3 "transmit paths tested only into fakes"). See §0 item 1 for DATV. -->

### Home-page honesty notes
- Don't claim "replaces WSJT-X". Digital Modes isn't built (HANDOVER and the GUIDE only say it is "planned"). Say "will replace" or "coming".
- Don't claim all eight ship in the first drop. BETA-PLAN says all eight are in the beta (`BETA-PLAN.md:20`), but status varies (see §6).

---

## 2. A page per app

Use this layout for every page: **What it does · Works with · Forms · Status · Coming**. Each entry in the "forms" line is a claim to re-check against the actual download list at publish time. The Linux, Windows and macOS entries are the BETA-PLAN M3 targets (`.deb` + AppImage, `.exe`, `.dmg`), not necessarily what exists today.

### 2.1 OpenHamShack QO-100 WB
<!-- Sources: ~/openhamshack/USERGUIDE.md (whole file, cited per line below); BETA-PLAN.md:50-56, 230-233. The guide describes the Classic box; verify each point against the store app. -->

**Tagline:** Wideband digital TV through the QO-100 satellite.

**What it does**
- Transmits DVB-S/S2 digital TV: the box encodes video with Intel Quick Sync and an ADALM-Pluto or LibreSDR sends it. `USERGUIDE.md:3`
- Receives with a MiniTiouner or PicoTuner (USB, or PicoTuner over Ethernet). Several receivers run at once, up to four. `USERGUIDE.md:230-252`
- Shows a live spectrum and 2-minute waterfall of the wideband transponder from BATC's monitor. Tap a signal to receive it. `USERGUIDE.md:296`
- Gives a status strip with lock, MER, and the margin in dB with its D number. `USERGUIDE.md:84`
- Checks the uplink before it keys. It refuses to key on a busy channel and keeps your signal off the beacon and the narrowband transponder. `USERGUIDE.md:306-312`
- Watches your power against the beacon and turns it down while you are on air. `USERGUIDE.md:316`
- Reads and posts to BATC's wideband chat, with a double-tap before anything is sent. `USERGUIDE.md:318`
- Offers a logbook of DATV contacts, an aiming display, and HamTV (ISS) pass predictions. `USERGUIDE.md:325-360`
- Uses a double-tap TRANSMIT, a 30-minute time-out, and a callsign gate: it won't transmit until a callsign is set. `USERGUIDE.md:258-262`
- Test cards, webcam, video file, and OBS or phone streaming as picture sources. `USERGUIDE.md:102-200`

**Works with:** ADALM-Pluto (PlutoDVB2/F5OEO firmware), LibreSDR (DL1JM/PA2JSA DVBS2 firmware), MiniTiouner, PicoTuner. `USERGUIDE.md:11-17`

**Forms:** controller store app (the main form, run in a container). Desktop (Linux/Windows/macOS) via `shack_desktop`, the same server in a native window, in progress (`HANDOVER.md:104-107`). Remote kind on Android; Apple kind built but waiting for TestFlight (`GUIDE.md:31`).

**Status:** The Classic box (0.9.17) is live on one real station. The beta store and desktop forms are new.
**Not done:** Classic's "no band check" option is removed. The busy-check-without-BATC option is "new, off by default, not yet tried on real hardware" (`USERGUIDE.md:314`). The guide doesn't mention a wideband-only limit on the beta. [check]

**Coming:** terrestrial DATV bands move to OpenHamShack DATV (`GUIDE.md:31`).

### 2.2 OpenHamShack QO-100 NB
<!-- Sources: ~/openhamshack-nb/docs/USERGUIDE.md:1-40 (features), :969-989 (not verified), docs/INSTALL.md:590-650 (macOS). -->

**Tagline:** A narrowband QO-100 transceiver in one window.

**What it does**
- Receives the whole 500 kHz narrowband transponder, with a bandscope, waterfall, zoom scope and the band plan along the top.
- Transmits through the Pluto family, full duplex, so you hear your own signal come back from the satellite.
- **Beacon lock** measures your LNB's error against the beacons and corrects it. **TX lock** finds your own signal and corrects the uplink. A beacon-level guard turns your power down when you get within 6 dB of the beacon.
- Works beside an IC-9700 as the transmitter (you key it yourself) into an upconverter.
- Modes: USB/LSB, CW, FT8/FT4, PSK31/63/125, RTTY, FreeDV, SSTV and AM for the beacons. Also: logbook with ADIF, voice memories, middle-beacon text decoding, KG-STV pictures, a band skimmer, and Send files with HSmodem.
- Starts on a simulator, so nothing can transmit by accident.

**Works with:** ADALM-Pluto, Pluto+, LibreSDR and Pluto nano for TX/RX. IC-9700 as transmitter. RTL-SDR, Airspy, SDRplay and HackRF for receive only, via SoapySDR (Linux only). `USERGUIDE.md:32-38`

**Forms:** Linux `.deb` (amd64, arm64, all), Windows `.exe` installer, macOS arm64 `.dmg` (`INSTALL.md:1-45, 590`). AppImage and the store app are M3 work [check]. Remote and Apple kinds are "planned" (`GUIDE.md:33`).

**Status (use these words):** "Receive has been on air; transmit has not. Transmit and TX lock are proven only against the simulator. The IC-9700 transmit path has run only against an emulated radio." `USERGUIDE.md:969-989`

**Coming:** a recorder is not there. JS8 is receive-only via `js8call` and "suggested". `INSTALL.md:68` shows a `js8call` package line. Digital Modes will hold FT8/FT4 on the shared ohsdigi engine.

### 2.3 OpenHamShack Radio
<!-- Sources: ~/openhamshack-nb/docs/ham/USERGUIDE.md:1-60, :846-857. -->

**Tagline:** A software-defined transceiver for the amateur bands, 160 m to 6 cm.

**What it does**
- A software receiver and transmitter in one window, with a bandscope, waterfall and band plan.
- A licence guard that holds transmit inside your licence class, sub-allocation by sub-allocation. The UK tables are Ofcom's (Foundation, Intermediate, Full). Other countries use an entered licence. Power figures are advisory until measured.
- A band-plan guard: the RSGB 2026 plan in the UK, the IARU plan of your region elsewhere. Beacon and satellite sub-bands are always refused.
- Modes: USB/LSB, CW, AM, FM with CTCSS and 1750 Hz toneburst, FT8/FT4, PSK, RTTY, FreeDV, SSTV.
- Band stacks, VFO A/B, split, RIT/XIT, a PTT sequencer for a PA, a logbook with ADIF, and memories.

**Works with:** Pluto family on VHF and up, Hermes-Lite 2 on HF, receive-only SDRs via SoapySDR. 6 m only via a transverter. `ham/USERGUIDE.md:36-44`

**Status:** "Preview, tested on the simulator only. Nothing has been tried on a real radio or on air." `ham/USERGUIDE.md:9`

**Forms:** same as NB. A Raspberry Pi is a target but has not been run.

**Not:** a rig controller (it is the transceiver), a satellite station, or a recorder.

### 2.4 OpenHamShack DATV
<!-- Sources: ~/openhamshack-datv/README.md:1-40; HANDOVER.md:1-80, 113-190. -->

**Tagline:** Terrestrial digital TV, DVB-S and DVB-S2.

**What it does**
- Transmits and receives amateur digital TV on 2 m (UK, under the 146 MHz NoV), 70 cm, 23 cm and up.
- Transmits through firmware radios: DL1JM's LibreSDR firmware and F5OEO's PlutoDVB2. Receives on a MiniTiouner or PicoTuner through longmynd.
- Starts on a simulator. Real-radio transmit needs "Transmit on real hardware" set, with licence acknowledgement gates (`HANDOVER.md`, "Gates met on the way").
- Includes a `--safe-off` command that unkeys the radio it last keyed.

**Works with:** Pluto family with DVB firmware, LibreSDR, MiniTiouner, PicoTuner.

**Forms:** Linux and Windows 0.2.0 installer (8 Oct, "for an outside tester") (`HANDOVER.md:113`). Linux packaging for the longmynd helper is "not yet built" in the README. [check] macOS is not built. Store app: later per D7, then added to the beta by BETA-PLAN. [check]

**Windows gaps:** MiniTiouner/PicoTuner and SDRplay/RTL-SDR receive are not on Windows (`HANDOVER.md:180`, line truncated). [check]

**Status:** simulator plus one bench-tested on-air session with a real Pluto (see §0 item 1). No QO-100 and no HamTV here (QO-100 WB owns those).

**Coming:** SDR receive (phase 2) and software transmit from a stock Pluto (phase 3) are in the README (`README.md:33`). Phase 4 is simulator-only.

### 2.5 OpenHamShack ATV (with Teletext)
<!-- Sources: ~/openhamshack-atv/README.md:1-70; HANDOVER.md:195-262; the Teletext editor's README before it was folded into ATV and its repo archived. -->

**Tagline:** Analogue amateur TV, with teletext built in.

**What it does**
- Generates, transmits, receives and decodes 625-line PAL with sound in one window, using its own PAL generator and decoder (no hacktv).
- AM-VSB (UK System I-style) and FM-ATV (IARU R1 V.2).
- 23 cm and 6 cm (5.8 GHz) transmit and receive. 70 cm is allowed inside 430-440 MHz with a prominent warning, because analogue ATV left the RSGB 70 cm plan in December 2020.
- NICAM-728 stereo both ways where the sample rate has room.
- Test card with ident, colour bars, webcam or video file. Waveform monitor and vectorscope on receive.
- **Teletext** (World System Teletext, ETS 300 706 Level 1) is sent with the picture and decoded on receive. The editor, folded into ATV from its own now-archived repo, writes `.tti` pages exactly as vbit2 reads them. Includes sixel drawing, picture import to mosaics, a service checker, live data pages (solar data, DX cluster), and subtitles.

**Works with:** Pluto family (ADALM-Pluto, Pluto+, Pluto nano, LibreSDR), optionally a HackRF One as transmitter. Colour AM-VSB with sound needs 10 MS/s and FM-ATV 20 MS/s. A USB Pluto gives about 6.8 MS/s, so it can only carry a mono AM picture without sound. `README.md:44-56`

**Forms:** Linux `.deb`, Windows installer (`packaging/windows/`). No macOS build (`PACKAGING.md`, "Existing pipelines"). Teletext is a separate editor on Linux only today ("Linux first") and moves into ATV (`GUIDE.md:35`). [check] it is merged.

**Status:** "Nothing has run on real hardware yet." `README.md:60`. Transmit on a real radio needs "Allow transmit on real hardware". Teletext is "simulator only, nothing on air" (`HANDOVER.md:201-204`). Teletext carries only on video bandwidth of 3.75 MHz or more, so the 5 MS/s USB-Pluto profiles refuse it with a message (`HANDOVER.md:236-245`).

### 2.6 OpenHamShack Icom
<!-- Sources: ~/dock360-apps-icom-9700/icom/README.md:1-170, module.yaml:1-50; HANDOVER.md:35-50, 248-255; GUIDE.md:36. -->

**Tagline:** Control a networked Icom from any browser, and share it with WSJT-X.

**What it does**
- Controls an IC-9700 (and IC-7610/IC-705 profiles) over its Ethernet port or over USB. The module finds the right serial port, speed and CI-V address itself on USB.
- Shows frequency, mode, filter, VFO, split, S-meter, power and SWR, following the radio's own dial.
- Implements Icom's own three-stream LAN protocol, so you can share the single connection. It re-serves the radio as Hamlib NET rigctl for WSJT-X, loggers and others.
- Streams receive audio and a band scope on demand, and has a radio-shaped on-screen face (IC-9700, IC-7610, IC-705).
- Has decoders (FT8, JS8, APRS, SSTV) and a signal map, a logbook (ADIF in and out) and optional QRZ lookup (`README.md:131-165`). These move onto the shared engines and services.
- Transmitting is off by default. No automatic keying.

**Works with:** Icom IC-9700 (real receive test done), IC-7610 and IC-705 [check: only emulated or faked]. Write "works with Icom IC-9700/7610/705" and never imply endorsement (`brand/README.md:224-229`).

**Real-radio test (9 Oct):** connect, receive audio, scope on demand and the live face worked on the real IC-9700. Transmit was off (`HANDOVER.md:35-44`).

**Forms:** controller store app (the main form). Desktop in a native window (planned). Remote: Android TV kind, receive-only. Apple TV is planned (`GUIDE.md:36`).

**Not here:** transmit audio from anywhere but the digital-mode transmitter, memories, and DD mode over rigctl (`README.md:75-84`).

**Coming:** the main VFO only is shown on the faces (sub VFO, dualwatch, satellite dropped for now, `HANDOVER.md:253`). Missing radio data is drawn as absent, not invented.

### 2.7 OpenHamShack Flex
<!-- Sources: ~/dock360-apps-flex/flex/README.md:1-150; HANDOVER.md:45-50. -->

**Tagline:** A FlexRadio 6000 in a browser, built the way a Flex operator expects.

**What it does**
- GPU-drawn panadapter and waterfall at the radio's frame rate, with several panadapters, and a waterfall that survives zoom.
- Slices: create, tune (click, drag a flag, spin a digit, drag the passband), mode, filter, AGC, DSP, squelch, RIT and audio. It exposes the radio's own noise reduction, blankers and notch.
- Tracking notches, a per-slice S-meter, band and mode buttons, receive audio as Opus, and a colour-coded band-plan strip.
- Supports an Ajazz AKP03E over WebHID.
- Transmit and ATU are off by default and refused unless switched on at install.

**Works with:** FlexRadio 6000 series. Built and tested against a FLEX-6400 on SmartSDR 4.2.20.

**Status:** Receive "in full and on real hardware". Transmit "has not been tested against the radio" (`README.md:117-118`).
**Known:** the radio rejects the client name "FlexDeck" (error 0x10000002), so the rename is free (`HANDOVER.md:47-50`). The band edges are IARU Region 1 and the plan is UK, so it should be driven from the dataset in the beta.
**Not here:** DAX, CAT/rigctl, a CW keyer, memories, spots, digital modes, logging (`README.md:75-86`).

**Forms:** controller store app; desktop in a native window (planned). Remote kind planned.

### 2.8 OpenHamShack Digital Modes (coming)
<!-- Sources: GUIDE.md:37; PLATFORM-PLAN.md:185-196; ~/openhamshack-nb/docs/OHSDIGI-PYTHON.md:1-30; HANDOVER.md:56-61, 78-79; digimodes-rust.md:1-20. -->

**Say first:** this app is being built now and is not available yet.

**What it will do**
- FT8 and FT4 encode and decode on ohsdigi, a Rust port of WSJT-X 2.7.0's encoder and decoder. WSJT-X is the specification.
- Work with any radio app by audio routing: it takes receive audio from whichever app holds the radio and transmits through that app's transmit lease.
- Send decodes to shared spots and activity, and QSOs to the one shared logbook.

**What exists today (verified)**
- The ohsdigi engine as a Python wheel, `ohs-ohsdigi` 0.1.0, for Linux x86_64 and aarch64, Windows and macOS (`HANDOVER.md:56-61`). NB and Radio already use it for FT8/FT4 on air-less paths.
- NB's 150,000-message comparison with WSJT-X's symbols (`USERGUIDE.md:977`) is the evidence for the encoder.

**Coming:** JS8 is not in the beta ("weeks, plan in `digimodes-rust.md`", `HANDOVER.md:78-79`). The Digital Modes app's forms, supported radios and feature list are all [check] with the session building it.

### 2.9 OpenHamShack Remote (client page; not one of the eight)
<!-- Sources: ~/openhamshack-remote/README.md; ios/README.md; HANDOVER.md:145-157; docs/TESTING.md:154-160; CONTROLLER-CONTRACT.md:173-260. -->

- **Android** (phones, tablets, Android TV and Fire TV, minSdk 26): receive picture (libVLC), tune, the transmit lease, camera-to-box over SRT, a QO-100 page, Bonjour discovery. It tested on emulators, fakeboxes and one real Fire TV, where H.264 and H.265 film played and the PIN flow worked.
- **iPhone/iPad (iOS 17+) and Apple TV (tvOS 17+):** built and tested in simulators. The Apple TV is receive-only. iOS needs the same weak-signal player options as Android (`HANDOVER.md:163`). TestFlight needs a build uploaded. [check]
- Transmit is keyed only by a deliberate one-second hold. Every way of losing touch with the box ends with it off air (`README.md:22-24`). TVs never transmit.
- Pairing: phones and tablets sign in with a username, password and (if on) TOTP code. TVs show a 6-digit code that a user approves on the controller (`CONTROLLER-CONTRACT.md:173-260`).
- **One app per platform, with kinds:** QO-100 WB/DATV video, Icom with the radio-style display, others as their APIs allow (`BETA-PLAN.md:134`).

---

## 3. Platform page: the OpenHamShack controller

<!-- Sources: BETA-PLAN.md:30-66, 95-121; PLATFORM-PLAN.md:69-130; contract/CONTROLLER-CONTRACT.md; SERVICES.md; SYNC.md; CONTROLLER-PAD.md; HANDOVER.md:88-107. -->

**Say first:** the controller is optional, and no app needs it.

**What it is.** A bootable installer you put on any x64 PC. It is a customised edition of Dock360, a container platform (users don't see the name Dock360, per `PLATFORM-PLAN.md:11`). It runs the apps from a store and shares services between them. [check] whether the web UI says "Dock360" anywhere: `PLATFORM-PLAN.md:58-59` noted "Dock360" in 26 templates, and the edition work was meant to remove it.

**What it gives you** (all under "design/planned" unless the edition build says otherwise; the edition branch `feature/ohs-edition` is not merged to Dock360 main, `HANDOVER.md:89-90`):
- **A store.** The store is preloaded and QO-100 WB is installed on first boot. Apps ship with their container images, so installing works offline. Updates come from signed feeds, and a busy gate stops updates while an app is on air (`BETA-PLAN.md:65-66`).
- **One shared logbook.** Every QSO has a UUID, merges are idempotent, conflicts resolve by last edit per field with history kept. Apps keep a local copy and sync on pairing, and unpairing leaves the local copy complete (`BETA-PLAN.md:41-48`; `SYNC.md`).
- **A station profile.** Callsign, locator, country, IARU region, licence class, NoVs, antenna gain, units, time display and AKP03E layouts (`SERVICES.md:47-95`). Credentials (QRZ and the like) stay in the service that uses them and are never synced (`SERVICES.md:95`).
- **Band plans from data.** One versioned dataset (2026.10.2) with 16 regimes, RSGB 2026 plus IARU Regions 1-3, QO-100 NB/WB and BATC channels. **Region 1 and UK are complete from 2200 m to 3 cm. Other regimes are marked "researched" and partial, never guessed.** Switching to a German profile changes 2 m power, which is the test for gate 1 (`HANDOVER.md:66-72`).
- **A callsign lookup** with one QRZ credential and a shared cache. It doesn't keep email, phone or street address (`SERVICES.md:267-275`).
- **Spots and activity.** The DX cluster and PSK Reporter feeders are off by default. A decode heard by one app is visible to all (`SERVICES.md:361-370`).
- **A hardware broker.** The controller owns the radios. An app claims a device only when nobody else holds it. A device that is on air is never taken automatically, and when a holder disappears the broker makes the radio safe first. A Hardware page shows who holds what. **Safe-off actions are untested on real kit** (`HANDOVER.md:96-97`).
- **The Ajazz AKP03E pad** works with every app. The controller owns the pad and sends keys to whichever app is in front, changing key images as the app changes. Transmit always goes through the app's lease. The pad shows ON AIR, and if the pad disconnects while held, transmit stops (`BETA-PLAN.md:95-121`). Windows and macOS hidapi paths are untested guesses (`CONTROLLER-PAD.md:290-300`).
- **Pairing.** Phones, tablets and desktop apps sign in once and get a revocable device token. TVs show a 6-digit code. Apps find the controller by Bonjour (`_openhamshack._tcp`).
- **Levels** of view, control and transmit per user and app. Some devices are capped (TVs never transmit).

**Not on this page:** the old OpenHamShack box's local touchscreen/kiosk is part of the plan but I didn't verify it in the ISO. [check]

**Requirements:** any x64 PC; boots UEFI and legacy BIOS. Minimum RAM/disk: not stated anywhere I read. [check] with the ISO builder.

---

## 4. Downloads page copy

<!-- Sources: BETA-PLAN.md:22-23, 59-66; research/PACKAGING.md; ~/openhamshack-nb/docs/USERGUIDE.md:41-100; docs/INSTALL.md:590-650; ~/openhamshack-remote/docs/TESTING.md:154-160. Download URLs, file names and versions: none exist yet [check]. -->

### Before you start
> This is a beta. Windows and Linux installers are not signed. Your system will ask whether you trust them. That is expected. Check the checksum first (below). Nothing here has been through on-air transmit testing.

### Windows
1. Download the `.exe` installer and check its SHA-256 (below).
2. Double-click. It installs for you alone, with no administrator needed except the optional Pluto USB drivers (`USERGUIDE.md:70`).
3. **SmartScreen will say "Windows protected your PC".** Click **More info**, then **Run anyway**. This appears because the installer is unsigned and new. (If a given .exe turns out to be signed, change the wording. See §0 item 2.)
4. **Smart App Control** (Windows 11) can block unsigned installers outright. It must be **Off** to install. Windows only lets you turn it back on by resetting the PC, so decide on a test machine first (`USERGUIDE.md:72`).
5. **S mode** can't run it at all (`USERGUIDE.md:73`).
6. For a Pluto, tick **Install the PlutoSDR USB drivers** and install before plugging the Pluto in. Answer **Install** when Windows asks about the Analog Devices software. Without it, the Pluto's USB network adapter won't appear (`USERGUIDE.md:78`).
7. Uninstalling leaves your settings and log in `%APPDATA%\<app>\`.

### Linux
- **`.deb`** (Debian 12/13, Ubuntu 24.04 or later, Mint built on those):
  ```
  sha256sum <file>.deb
  sudo apt install ./<file>.deb
  ```
  Use `apt install ./…`, not `dpkg -i`, so apt fetches dependencies (`USERGUIDE.md:55-60`). The `amd64` and `arm64` packages carry their own FT8/FT4 engine, and `all` relies on WSJT-X. The arm64 build "has never been run on a Pi" (`USERGUIDE.md:984`).
- **AppImage:**
  ```
  chmod +x <file>.AppImage
  ./<file>.AppImage
  ```
  AppImages need FUSE 2 (`libfuse2` on Debian/Ubuntu; on newer Ubuntu the package is `libfuse2t64`). Without FUSE, run `./<file>.AppImage --appimage-extract-and-run`. [check] The pipeline for AppImages did not exist when `PACKAGING.md` was written ("Nothing builds AppImage anywhere yet"). Include this only if AppImages are actually published.
- A Pluto on USB needs `libiio-utils` for its permission rule (`USERGUIDE.md:57`).

### macOS
- Apple Silicon Macs (M1 or later), macOS 14 (Sonoma) or later. Intel Macs are not supported by the NB/Radio builds (`INSTALL.md:596`). [check] for the other apps.
- Open the `.dmg` and drag the app to Applications.
- Builds are **Developer-ID signed and notarised**, so a normal open works (`PACKAGING.md`, "Beta: macOS .app/.dmg are signed AND notarised"). Verify per build.
- **If Gatekeeper still complains**, use the fallback recorded for unsigned builds (`INSTALL.md:629-641`):
  - macOS 15 or later: try to open once, choose **Done**, then **System Settings › Privacy & Security › Open Anyway**, twice.
  - macOS 14: right-click the app, choose **Open**, then **Open** again.
- **Microphone:** allow it when asked, or transmit audio is silence (`INSTALL.md:649-655`). Also on macOS 15+, **Local Network** permission is needed for a LibreSDR or Pluto on your LAN, or the app falls back to the simulator without saying why (`docs/macos.md`).
- Rosetta 2 is needed for FT8 decoding in NB and Radio.

### The controller ISO
<!-- Sources: BETA-PLAN.md:59-66; PACKAGING.md "ISO"; HANDOVER.md:101-103 (ISO in progress). -->
- Hybrid image for any x64 PC. It boots UEFI and legacy BIOS (BETA-PLAN M2 gate, tested in QEMU under OVMF and SeaBIOS). **Status on 09/10: ISO in progress; not built when this was written.**
- **USB stick with Rufus:** choose the ISO and, when asked, **DD Image mode** (not ISO mode). All data on the stick is erased.
- **Ventoy:** copy the ISO onto a Ventoy stick and boot it from the menu. Loop-boot compatibility is a to-do in M2 ("if possible"), so state it as tested or not. [check]
- **DVD:** burn the ISO as an image.
- **Secure Boot:** turn it off in firmware if it won't boot. [check] (see §0 item 9.)
- The installer asks which disk to use, and it writes to that disk. [check] the wording of the installer, which came from the Classic installer.
- Try-without-installing: Classic had a "Try OpenHamShack (nothing is written)" boot entry (`~/openhamshack/USERGUIDE.md:30-37`). [check] it survives in the new ISO.

### Android and Fire TV (OpenHamShack Remote)
- **Phone or tablet:** download the APK. Allow "Install unknown apps" for your browser or file manager when asked. Open the APK to install. minSdk 26 (Android 8.0).
- **Fire TV via Downloader:** install the Downloader app, enable **Install unknown apps** for it, enter the APK URL, install. [check] the exact current URL and the armv7 vs arm64 build. Fire TV Stick/Cube models are often armv7 (`TESTING.md:154`). Pick the right APK by model (armeabi-v7a for older sticks).
- **Fire TV via adb:** enable **ADB debugging** and **Apps from unknown sources** under TV Settings › My Fire TV › Developer options, then:
  ```
  adb connect <tv-ip>:5555
  adb -s <tv-ip>:5555 install -r app-armeabi-v7a-debug.apk
  ```
  Accept the prompt on the TV (`TESTING.md:154-160`). The app appears under Apps / Your Apps & Channels. The currently built APKs are debug builds. [check]
- **Android TV / Google TV:** the same APK via adb or Downloader. [check] the Google TV model is untested beyond emulators.
- iPhone, iPad and Apple TV: not downloadable yet. TestFlight possible only after a build is uploaded. Never submit for App Store review (`PACKAGING.md`). Say "coming".

### Checksums (how to verify)
Publish a `SHA256SUMS` file beside every download.

| System | Command |
|---|---|
| Linux | `sha256sum -c SHA256SUMS` or `sha256sum <file>` |
| macOS | `shasum -a 256 <file>` |
| Windows (PowerShell/cmd) | `certutil -hashfile <file> SHA256` |

Compare the output with the published line. If it differs, don't install, and re-download.

**Note:** the apps' own in-app updaters verify an Ed25519 signature on a signed feed (`~/openhamshack-nb/docs/USERGUIDE.md:88-100`). That is separate from OS signing. State it once; don't oversell it.

---

## 5. Guides list

Each outline is 3 lines. All are [check] against the shipped controller and apps, since the beta is not finished. They are derived from the contract docs and the Classic guide.

1. **First boot of the controller**
   - Write the ISO to a stick (Rufus DD mode or Ventoy), boot, pick a disk, install.
   - First start: set an admin account, the network, your callsign and locator, and which apps to install. [check] (per `PLATFORM-PLAN.md:81`: network, admin account, station profile, apps, update channel).
   - Open the store, confirm QO-100 WB is there, and see where the controller shows its address.
2. **Pairing a desktop app**
   - Install the app and open it. It runs standalone, with its own logbook.
   - It finds the controller by Bonjour, you sign in once, and the device appears in the controller's device list.
   - Your logbook and station profile sync. Unpair at any time and the local copy stays complete.
3. **Pairing Remote**
   - Phone or tablet: pick the controller, sign in with your user (and TOTP if on).
   - TV: it shows a 6-digit code, and you approve it on the controller. TVs can look and tune but never transmit.
   - Revoke any device from the controller. Check the view, control and transmit level of the device. [check] the UI wording.
4. **Station profile and licence settings**
   - Set callsign, locator, country, IARU region, licence class and any NoVs.
   - See what that changes: band limits, the transmit gate, default channels. Other regions' data is partial and marked.
   - Understand the limit: the software helps, the licence condition is yours.
5. **Using the AKP03E**
   - Plug it in. The controller (or the app in front, on a desktop) claims it.
   - Default layouts per app. Remap keys and knobs, then the map is stored in your profile.
   - Transmit uses a double-press. The pad shows ON AIR. If the pad is unplugged while keyed, transmit stops. Windows and macOS pad support is untested. [check]
6. **QO-100 WB first contact**
   - Receive first: check the beacon and your own downlink, dummy load and filter in line.
   - Pick an uplink channel, set DVB-S2 QPSK, test card until the camera is known good.
   - TRANSMIT twice, with the busy check watching. Log the contact.
   - Source: `~/openhamshack/USERGUIDE.md:525-535`. Note step 3, "Carry UDP 8282".

---

## 6. Roadmap

<!-- Sources: HANDOVER.md; BETA-PLAN.md; GUIDE.md; app "Not yet verified" sections. Label every item Coming, Planned or Not planned. -->

**In the beta (but check status per app)**
- All eight apps standalone on Linux, Windows and macOS, with the controller store form. [check] per app at publish time.
- English only, but built for translation: string catalogs, locale-aware frequency formats, and band plans as data (BETA-PLAN §5). **Gate 1 requires a test that a non-UK profile changes band limits.**

**Coming after the beta**
- **JS8** in Digital Modes. "Weeks", not in the beta (`HANDOVER.md:78-79`).
- **Digital Modes app:** being built; FT8/FT4 first.
- **More rig apps:** "later OpenHamShack Yaesu / Kenwood" on the shared rig-control library (`GUIDE.md:60`).
- **Apple Remote** on TestFlight. The App Store Connect record exists, the build needs uploading, and review submission is not planned yet (EU trader status undecided, `PACKAGING.md`).
- **Other languages.** The scaffolding is in every app, and the remaining untranslated-string baselines are large (e.g. openhamshack 1010, nb 694, icom 421 strings, `HANDOVER.md:82-87`). The gate demands zero. [check]
- **Other regions' band plans and licence rules,** completed from "partial" (`HANDOVER.md:68-70`). Country licence classes beyond the UK. The 146 MHz NoV ships as `researched` until someone cites the NoV document for the power figure and 40 km rule (`BETA-PLAN.md:243-244`).
- **On-air transmit testing** of every app, once Brian is present with a dummy load and the licence in hand. Broker safe-off actions on real kit.
- **iOS weak-signal player options.** The Android fix is merged; VLCKit still needs it (`GUIDE.md:177-181`).
- **Icom:** sub-VFO, dualwatch and satellite faces; memories, repeater settings and RIT data the server lacks (`HANDOVER.md:253`).
- **Flex:** DAX and CAT are deliberately not built; a local helper is the stated approach (`flex/README.md:75-86`).
- **Other pads:** Mirabox, Stream Deck and MIDI controllers each need a driver of their own (`USERGUIDE.md:518-520`).
- **Code signing** for Windows and Linux (the NB guide says a Windows signing arrangement exists, but the beta ships unsigned).
- **Moving ohsdigi into ohs-libs** after the beta (`BETA-PLAN.md:239-242`).
- **Not planned:** a recorder in NB/Radio (none today).

---

## 7. Community

### Net chat
- **Status: unknown whether it is kept.** The server is `~/openhamshack-net` (PHP + MySQL on 20i shared hosting, short polling). It went live on 8 October at `openhamshack.brian-henderson.co.uk/net/api/v1/`. Brian said "try it first and see how we get on" (memory `openhamshack-net-chat.md`). GUIDE lists it as a supporting piece (`GUIDE.md:44`). The old hosts are being **deleted** (`HANDOVER.md:258`), so the live endpoint will go. BETA-PLAN says "net chat if kept" (`BETA-PLAN.md:135`). Nothing I read says it was moved to openhamshack.com. The `~/openhamshack-net` directory isn't on this VM, so I couldn't read its state. **Question for the session/Brian: keep it, and if so where does the API live?**
- **If kept:** explain that stations join a net, chat, and post receive reports (lock, MER, D value, CC). A transmitting app can suggest the best MODCOD/symbol rate for the weakest station. **Nothing from the net ever keys or changes a radio.** Suggestions need the operator's own Apply.
- **If not kept:** drop the section. Don't link anything.

### Contact (proposal; no personal email)
**Question for the session/Brian: which route do you want?** Options:
1. A role mailbox on the domain, e.g. `hello@openhamshack.com`, created at 20i. Simple, but it needs Brian (or the Control360 session) to create it and it will collect spam.
2. A public issue tracker on a code host. [check] I found no public repo URL in the docs. The code is GPL, so it is probably meant to be public, but no remote is documented.
3. A contact form: not possible on a static site without a backend, and the brief forbids external assets. Avoid.

Recommended: option 1 now, option 2 added when the repos have a public home. Don't put Brian's name or personal address on the page. Whether to show the GM4BRI callsign is a Brian decision. [check]

### Testers
Tell testers what to send: app and version, OS, radio, and the app's built-in diagnostics bundle. NB has Help › Save diagnostics (`~/openhamshack-nb/DESIGN.md`, "diag.py"). Don't invite anyone to key a radio on the site's say-so.

---

## 8. Safety and legal

<!-- Sources: ~/openhamshack/USERGUIDE.md:5; ~/openhamshack-nb/docs/USERGUIDE.md:7-9; BETA-PLAN.md:15-16, 213-217; brand/README.md:216-234; GUIDE.md:63-65. -->

### Blurb (paste-ready)
> **Your licence, your responsibility.** OpenHamShack helps you stay inside your licence and the band plan. It checks band edges, licence class and power before it will transmit. It is not a substitute for knowing your licence. Transmit only on frequencies and at powers your licence allows. The licence condition is always yours to keep.
>
> **Transmit with care.** SDR outputs such as an ADALM-Pluto are unfiltered. Start into a dummy load, use a proper band filter and a linear amplifier, and check your output on an analyser before connecting an antenna. A Pluto that is rebooted, or on the wrong firmware, can radiate. Every app starts on a simulator, so you can learn it with nothing connected.
>
> **Beta, and transmit.** In this beta, transmit paths were tested against simulators and fake radios. Nothing has been through formal on-air transmit testing. Treat every transmit function as unproven until you have checked it into a dummy load yourself. Receive has been tested on real radios in some apps.
>
> **Software licence.** The apps and libraries are free software under the GNU General Public Licence, version 3 (GPL-3.0). You can read, change and share the code under that licence. Some parts follow other projects' work (WSJT-X for FT8/FT4, JS8Call, wfview's reverse-engineering of the Icom LAN protocol) and keep their copyright notices. [check] the exact list from each NOTICES.md.
>
> **The name and logo.** The OpenHamShack name and logo are reserved. The code is yours to fork, but a fork must use its own name and logo. The brand assets are not code. Icom and FlexRadio are their makers' trademarks and are used here only to say which radios the apps work with. We are not endorsed by either. WSJT-X and JS8Call are the work of their authors.

### Facts behind the blurb
- Transmit gating in the apps: callsign needed (QO-100 WB), licence acknowledgement and "Transmit on real hardware" (DATV), "Allow transmit on real hardware" (ATV), `TX_ENABLED` / install-time switches (Icom, Flex). Each is off by default. Say so on each app page.
- Reserved logo: `BETA-PLAN.md:15-16`. The question was still open in `brand/README.md:240-241`, and BETA-PLAN settles it.
- The brand rules the page must follow: no OHS initials, no external fonts or assets, and the red `tx` colour is never used for errors or decoration (`brand/README.md:99-101`).
- Trademark caution: a proper UK IPO/EUIPO/USPTO search is "still worth doing before printing anything" (`brand/README.md:220-221`).

---

## Open questions to relay to Brian or the ohs-beta session

1. Mention the DATV on-air bench test (§0 item 1)?
2. Is the net chat kept, and where does it live now (§7)?
3. Contact route (§7)?
4. Secure Boot, minimum PC spec and Ventoy status for the ISO (§4)?
5. Icom and Flex licences (MIT today) to GPL-3.0 before the site says "all GPL-3.0" (§0 item 5)?
6. Are AppImages actually being built (§4)?
7. Which of the eight apps will have which OS builds on day one? The page-by-page "forms" lines must match the real download list.

## Files read (absolute paths)

- `/home/user/openhamshack/docs/BETA-PLAN.md`, `GUIDE.md`, `PLATFORM-PLAN.md`
- `/home/user/openhamshack/docs/contract/CONTROLLER-CONTRACT.md`, `SERVICES.md`, `CONTROLLER-PAD.md`
- `/home/user/openhamshack/docs/research/PACKAGING.md`
- `/home/user/openhamshack/HANDOVER.md`, `brand/README.md`
- `/home/user/openhamshack/USERGUIDE.md`
- `/home/user/openhamshack-nb/docs/USERGUIDE.md`, `docs/ham/USERGUIDE.md`, `docs/INSTALL.md`, `docs/OHSDIGI-PYTHON.md`, `docs/digimodes-rust.md`
- `/home/user/openhamshack-atv/README.md`, `HANDOVER.md`
- `/home/user/openhamshack-teletext/README.md`
- `/home/user/openhamshack-datv/README.md`, `HANDOVER.md`
- `/home/user/dock360-apps-icom-9700/icom/README.md`, `module.yaml`
- `/home/user/dock360-apps-flex/flex/README.md`, `module.yaml`
- `/home/user/openhamshack-remote/README.md`, `ios/README.md`, `docs/TESTING.md`
- `/home/user/openhamshack-os/README.md`

I did not read in full: `~/openhamshack-nb/DESIGN.md`, `docs/macos.md`, `ENGINE-API.md`, the Icom `TV-API.md`, `SYNC.md`, `BANDPLAN-DATA.md`, `I18N.md`, `REPO-LAYOUT.md`, or the ATV `docs/guide/index.html`. `~/openhamshack-net` is not on this VM.
