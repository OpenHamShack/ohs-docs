# OpenHamShack, the platform: architecture and phased plan

> **Renamed 09/10/2026 (product names) and 21/10/2026 (everything else)**: product names below have used OpenHamShack since 09/10; code paths, repos and packages caught up on 21/10, when the family's git history was rewritten end to end (see GUIDE.md §5 for what that changed and left behind).

Status: **draft for Brian's review** (09/10/2026). Nothing in it is built yet.
Research was read-only; claims cite files. **[guess]** marks anything not
verified in code or on hardware.

## Names

- **OpenHamShack** is the platform: the server and OS. It is a customised
  edition of Dock360. Users never see the name Dock360.
- **An OpenHamShack app** is a product installed on it: OpenHamShack DATV, NB, HAM, ATV,
  Teletext, StationFlow, and others later.
- **OpenHamShack Remote** is the one client app per platform: Android (phones,
  tablets, Fire TV/Google TV) and Apple (iPhone, iPad, Apple TV). It finds
  OpenHamShack servers and opens the screens for each app's *kind*.
- **Today's appliance** (`~/openhamshack`, 0.9.x) is **replaced by the platform**
  (Brian, 09/10/2026). It is not a product of its own: its functions split
  into OpenHamShack apps (QO-100 wideband side to the wideband app, terrestrial
  bands to the terrestrial DATV app) and platform features (network, updates,
  local screen, hardware). Each app adds functionality to OpenHamShack. "Classic"
  below is only shorthand for the 0.9.x code and boxes still running it until
  they move.
- **App names (all decided 09/10/2026)** (the family is two pairs: QO-100 = **OpenHamShack QO-100 WB** (decided) +
  **OpenHamShack QO-100 NB** (decided); terrestrial = **OpenHamShack DATV** (decided;
  ohsdatv + today's box app's terrestrial DATV bands) + **OpenHamShack Radio**
  (decided; was HAM, all-band normal radio); others e.g. **OpenHamShack ATV** (decided, with Teletext built in), **Icom** (decided: StationFlow becomes OpenHamShack Icom), **Flex** (decided: FlexDeck becomes OpenHamShack Flex), and **OpenHamShack Remote** (decided).
  **Rig apps are one per maker** (decided): OpenHamShack Icom, OpenHamShack Flex, later
  OpenHamShack Yaesu / Kenwood, each on a shared rig-control library plus the shared
  decoders, logbook, lookups and spots
  for the client). See the guide's family table once settled.

> **Superseded in part by [BETA-PLAN.md](BETA-PLAN.md) (09/10/2026):** every app also ships standalone for Linux/Windows/macOS; the controller is OPTIONAL and apps join it as clients (offline-first logbook sync); the controller ships as a hybrid UEFI/BIOS installer ISO (Rufus/Ventoy); all D1-D13 recommendations and the brand kit are adopted; all eight apps are in the beta.

## 0. Facts that shape everything

1. **Dock360 already does most of the hard work.**
   - Apps run as rootless podman containers from quadlets, proxied by Caddy
     under `/app/<id>/` and on subdomains.
   - Signed self-update with a snapshot, migration, `/healthz` check and
     automatic rollback (`~/dock360/docs/roadmap.md`, "Self-update").
   - Backups, and apps that carry their own image (`src/dock360/backups.py`).
   - USB-bus passthrough with a udev allow (`src/dock360/quadlet.py:134-179`).
   - Exclusive devices with hand-over (`src/dock360/claims.py`).
   - Named root operations (`src/dock360_helper/ops/`).
2. **Radio apps already run in Dock360 containers.**
   - `datv-rx` drives a MiniTiouner over `usb_bus: true` and transmits through
     a Pluto.
   - `openhamshack-fakebox` runs the real OpenHamShack box API in a container, with a
     host-side Bonjour announcer (`~/openhamshack-fakebox`).
3. **Dock360 lacks** (verified by searching `src/` and `docs/`):
   - mDNS;
   - editions or branding ("Dock360" appears in 26 templates);
   - a kiosk or local display;
   - an update *feed* (uploads and pushes only);
   - automatic OS updates;
   - non-browser user credentials;
   - roles (`users.is_admin` exists but nothing checks it, so every account
     is an admin);
   - fixed host ports (`ports.allocate` always picks 20000–29999).
4. **Fix first: the loopback trust leak.** `appliance/openhamshack.py:11824`
   `is_local()` trusts `127.0.0.1`/`::1` as "the box's own screen", and
   `authorised()` then grants everything. Behind a proxy or rootless podman's
   port forwarding that test no longer means anything. **[guess]** pasta may
   present host connections as loopback inside the container. This must be
   closed and tested before any container exposure.

## 1. Target architecture

### 1.1 The OpenHamShack platform

| Area | Target | Reuse |
|---|---|---|
| **Engine** | Dock360 with an **edition overlay**, not a fork. Dock360's `main` moves daily. | `src/dock360/*` |
| **Branding** | An `edition = openhamshack` setting chooses the name, logo, colours, help and visible admin pages. | `web/templates` |
| **Default apps** | OpenHamShack DATV preinstalled with its image, plus a catalogue: NB, HAM, ATV, Teletext, StationFlow. | `catalogue.py`, `backups.py` |
| **Station profile** | Callsign, locator, licence region and NoV held once by the platform and given to every app read-only. | `host_facts` gains `station` |
| **Local screen** | A host service running sway + Chromium kiosk on the OpenHamShack UI, plus mpv for the app "on the TV". `screens.py` moves here, with a local-screen device token. | `appliance/sway.config`, `screens.py`; StationFlow `docs/PI-KIOSK.md` |
| **Hardware** | Owned by the platform's **hardware broker** (1.3). | `claims.py`, `hardware.py` |
| **First boot** | Installer and Try ISO, then a wizard: network, admin account, station profile, apps, update channel. | `appliance/mkimage.sh`, `mkiso.sh`, `installer/`, `openhamshack-net` |
| **Platform updates** | A signed stable/beta feed the box polls, applied through Dock360's `release apply`, only when no app is busy. | `release.py`; Classic `tools/release.sh`, `promote.sh` |
| **App updates** | A signed catalogue feed with prebuilt images, so a box never needs Docker Hub. Same busy gate. | `bundles.py`, `signing.py` |
| **OS updates** | Classic's unattended security updates, skipped while busy, with a "restart needed" banner. | `appliance/openhamshack-os-update`; Dock360 `hostupdates.py` |
| **Diagnostics** | A platform report plus a section per app, posting to the existing `report.php`. | `openhamshacklib/diagnostics.py`, `tools/reports.py` |

### 1.2 Each product as an OpenHamShack app

The rule is **no servers in the desktop apps**. Each app's server layer lives
in its own repo (`~/dock360-apps-openhamshack-<kind>`), which pins the desktop
app's engine by commit, the way the fakebox vendors OpenHamShack. The engines
already run headless (`ohsnb --headless`, `ohsradio --headless`, `ohsatv`/`ohsdatv`
`--headless`).

| App (kind) | In the container | Hardware (through the broker) | UI | Notes |
|---|---|---|---|---|
| **Wideband / QO-100 DATV** (`datv`; terrestrial bands move to the terrestrial app) | `openhamshack.py` + `openhamshacklib` + `www/` in platform mode; ffmpeg VA-API, longmynd, MQTT to the Pluto | Pluto/LibreSDR, MiniTiouner/PicoTuner, `/dev/dri`, cameras, PTT (broker), audio | The existing console | **First**, because OpenHamShack Remote already speaks its API. 84 absolute `/api/` URLs in `www/js` need prefix support. |
| **NB** (`nb`), **HAM** (`ham`) | `ohsnb`/`ohsradio` headless, a new HTTP/WebSocket server, a network PCM audio backend (`ohscore/audio.py` `Backend`) | Pluto family (libiio), HL2, SoapySDR | Needs a web UI or the remote app as its UI (D8) | Engine API is documented (`~/openhamshack-nb/docs/ENGINE-API.md`) |
| **ATV** (`atv`) | `ohsatv` headless plus a server | Pluto family, HackRF, cameras | Needs a UI | **[guess]** N150 load for 20 MS/s PAL is unmeasured |
| **Teletext** | **Part of the ATV app** (Brian, 09/10/2026): ATV holds the pages and the editor | none | Page editor inside ATV | No inter-app sharing needed |
| **OpenHamShack Flex** (`flex`) | Today's Dock360 app FlexDeck (`~/dock360-apps-flex`), rebuilt as an OpenHamShack app; SmartSDR TCP API, VITA-49 audio/spectrum | FlexRadio on the LAN | Web + remote kinds | After the shared components; Flex is too different from CAT/CI-V rigs to share an app |
| **OpenHamShack DATV** (`ohsdatv`; terrestrial digital TV) | Takes the terrestrial DATV bands out of today's box app (Brian, 09/10) as well as ohsdatv's own; OpenHamShack Desktop (`ohsqo`, QO-100 WB on DATV code, another session) is the wideband app's desktop form | as DATV plus SDRs | | D7 |
| **StationFlow** (`stationflow`) | **Rebuilt as an OpenHamShack app** (Brian, 09/10): today's Dock360 app `icom` is the starting point, not the end state | IC-9700 on LAN or USB, via the broker | Web, plus remote kinds | Its decoders, logbook, lookups and spots move onto the shared layer (1.4); RX audio + scope API on `feature/icom-rx-audio` |

### 1.3 The hardware broker

**Principle (Brian):** OpenHamShack owns all radio hardware. An app gets a device
only when nobody else holds it, and the platform makes a transmitter safe
whenever its holder goes away.

- **Where it lives:** inside `dock360-api` (`broker.py`), built on
  `claims.py` and `hardware.py`. Apps reach it through
  `dock360-host:host-gateway` with a per-app token, like
  `DOCK360_ALERT_TOKEN`.
- **Inventory:**

| Device | Identity | Reaches the app by | Exclusive | Safe-off |
|---|---|---|---|---|
| Pluto (PlutoDVB2/Tezuka) | USB-gadget MAC or configured address (the nano's serial is `ffff…`) | network via host | yes | MQTT ptt 0; TX LO powerdown, −89.75 dB. **A reboot keys the TX LO.** |
| LibreSDR | address | network | yes | `PTT=off` |
| MiniTiouner / PicoTuner-USB | FTDI `0403:6010` (PicoTuner id **[guess]**) | `usb_bus` + udev | yes | LNB supply off |
| PicoTuner-Eth | address | network + inbound UDP 9941 (needs a fixed port) | yes | — |
| SDRplay RSPdx | `1df7:3030`, rendezvous `sdrplay-rsp` (SigScope) | `usb_bus` | yes | — |
| HackRF, RTL-SDR | USB id | `usb_bus` | yes | stop TX |
| IC-9700 | address, or serial + USB audio | network/devices | yes | CI-V TX off **[guess]** |
| Hermes-Lite 2 | address | network | yes | — |
| PTT outputs (dcttech HID, CH340, Pluto GPO, GPIO) | rules, by-id | **broker only**, never passed to apps | yes | open relay |
| GPU `/dev/dri` | render node | `devices` | **shared** | — |
| Local audio, cameras/HDMI capture | card, by-id | `devices` | yes | — |
| Local screen, touch, pads, keypads | host | **never passed to apps**; the kiosk owns them | — | — |
| USB recording sticks | `/media/openhamshack` | bind with propagation (gap) | — | — |

- **Claim API (sketch):**
  - `GET /api/broker/devices`
  - `POST /api/broker/claim {device, mode: rx|tx, wait}` returns
    `granted` (how to reach the device), `queued`, or
    `refused {holder, holderState}`
  - a 2 s heartbeat on a 10 s lease, then `POST /api/broker/release`
  - `POST /api/broker/onair {device, on}`
  - apps declare a `release_request` endpoint so the broker can ask before
    it forces anything.
- **Arbitration:**
  1. A free device is granted at once.
  2. A device held for receive:
     - a request from a person shows "NB has the Pluto (receiving). Give it
       to ATV?"; on yes the broker asks the holder, then forces after 60 s;
     - an automated request is queued.
  3. A device that is **on air is never pre-empted automatically**. The only
     way is an explicit "stop transmitting and hand over", which runs safe-off
     first.
  4. If the holder crashes, its lease expires or its container stops, the
     broker runs **safe-off**, then frees the device.
  5. After a broker restart there is a 15 s grace for apps to re-claim.
- **Relation to existing code:** `claims.py` stays for settings-driven apps
  (SigScope, SIGINT, datv-rx). Broker-aware apps use
  `exclusive_devices: claim: runtime`. Both appear in one list, and SigScope's
  `sdrplay-rsp` keeps working.
- **Enforcement, honestly:** every app runs as the same host uid.
  - USB v1 is cooperative (`usb_bus` plus libusb's own refusal).
  - USB v2 grants by restarting the holder with `AddDevice=`, and re-grants
    on re-enumeration.
  - Network radios can't be locked by the host. The broker writes the
    radio-side marker (`~/openhamshack-datv/docs/radio-lock.md`), and apps keep
    their "radio changed" checks.
- **UI:** a Hardware page. Each device shows its holder, RX or **ON AIR**,
  the queue, and Hand over / Release / Safe-off now, with every action
  audited. Any app on air shows on the local screen's status strip.

### 1.4 Shared components: one of each, used by every app

**Principle (Brian, 09/10/2026):** things like the FT8 decoder are shared by
every OpenHamShack app, not rebuilt per app. Today there are two of most things:
StationFlow uses WSJT-X's `jt9` plus its own JS8 codec, APRS modem, SSTV,
logbook, contest logs, SOTA, QRZ and spots (`icom/app/digi`, `aprs`, `sstv`,
`contest`, `sota`, `logbook.py`, `qrz.py`, `spots.py`), while OpenHamShack NB/HAM
have `ohsdigi` (Rust FT8/FT4, JS8 next) in `~/openhamshack-nb/rust`.

Two kinds of sharing:

| Kind | What | Form |
|---|---|---|
| **Libraries** (computation; each app runs its own copy) | Digital modes (FT8/FT4/JS8 encode and decode: **ohsdigi becomes the one implementation**, replacing `jt9` and StationFlow's JS8 codec); APRS/AX.25 AFSK modem; a **rig-control library** (CAT/CI-V transports, rig model, rigctl server) shared by the per-maker rig apps; SSTV encode/decode; Maidenhead/grid, prefixes and DXCC entities; ADIF, Cabrillo, EDI; the remote-player and PCM audio helpers | Versioned packages (Python wheels around the Rust crates; Kotlin/Swift for clients) built once and pinned by each app |
| **Platform services** (shared state; one per OpenHamShack) | Station profile (callsign, locator, licence); **one logbook** every app writes QSOs to; callsign lookup with one QRZ credential and a shared cache; spots and activity (DX cluster, PSK Reporter, BATC, decodes heard by any app); the hardware broker | Services in OpenHamShack with an API for apps (and the remote kinds), like the broker |

**An OpenHamShack digital-modes app replaces WSJT-X** (Brian, 09/10/2026). Built on
ohsdigi (FT8/FT4 now, JS8 next; WSJT-X source as its spec), it works with ANY
radio app: it takes receive audio from whichever app holds the rig
(`/api/audio/rx`) and transmits through that app's TX lease and
`/api/audio/tx`. Decodes go to the shared spots/activity service, QSOs to the
one logbook, lookups to the shared callsign service. Per-app digital modes
(StationFlow's jt9 + own JS8) are retired in its favour; the rigctl server
stays for third-party software. Needs a new platform piece: **audio routing**
between apps (one app's RX audio to another, TX audio back, under the holder's
lease). Name: **OpenHamShack Digital Modes** (decided).

Rules: an app never keeps its own logbook or credentials for a shared
service; a decode heard by one app is visible to all (e.g. NB hears FT8 on
QO-100, StationFlow shows it). **Licence:** ohsdigi and the JS8 data are
GPL-derived (WSJT-X/JS8Call); StationFlow declares MIT. Apps that link the
shared decoder must be GPL-compatible (decision D13).

## 2. The client contract (phones, tablets, TVs)

### 2.1 Discovery
- **One `_openhamshack._tcp` advert per server**, from an avahi host-service
  recipe (LAN NIC, IPv4).
  - Instance name: the callsign.
  - Port: 80.
  - TXT: `name`, `version`, `platform=1`, `kinds=datv,nb,…`,
    `path=/.well-known/openhamshack`.
- `GET /.well-known/openhamshack` (open) returns
  `{name, version, auth, apps: [{id, kind, name, version, base, running, txCapable}]}`,
  from a manifest field `openhamshack: {kind: …}`.
- Classic boxes keep their own advert (no `platform` key), and the remote
  apps handle both.

### 2.2 Native-app sign-in

| | Today | Needed |
|---|---|---|
| Browser | Password + TOTP, Tailscale SSO, a 60 min idle cookie | unchanged |
| `/app/<id>/` | Needs a Dock360 session | unchanged |
| Published routes | **No platform auth**; apps protect themselves | Caddy `forward_auth` on every OpenHamShack app route |
| Non-human credentials | deploy, alert and wall tokens | **device tokens** (`lbdev_…`) tied to a user, named, revocable |

- **Phone or tablet:** `POST /api/openhamshack/token {username, password, totp?, deviceName}`.
- **TV:** shows a 6-digit code, which an admin approves in the UI.
- **Local screen:** a token minted at install time, held root-only.
- **Identity to apps:** `forward_auth` passes `X-OpenHamShack-User/Level/Device`
  plus a shared-secret header, and apps trust the headers only when the
  secret matches. Use `header_up` set only, never strip-then-set (memory:
  Caddy applies delete last), and test against `caddy adapt` output.

### 2.3 Permission levels
- Per user and app: `none | view | control | transmit`. Platform admin is
  separate.
- A per-app option allows view without sign-in on the LAN (on for DATV).
- Box-only settings (`remotePin`, `plutoPassword`, `youtubeUrl`) become local
  screen or admin only.
- `transmit` requires a station profile with a callsign.

### 2.4 Through the proxy
- Base URL `http(s)://<server>/<prefix>/`. The remote apps must accept a base
  path and HTTPS (today the contract refuses `https://`).
- The edition's `trusted_networks` must include `100.64.0.0/10`.
- Long-lived streams (`/api/rx/stream.ts`, PCM `/api/audio/rx`) go through
  **Caddy routes**, not the 8800 Python proxy, with `websockets: true`.
- **[guess]** Caddy flushes unknown-length responses immediately.
- **[guess]** `encode zstd gzip` leaves `video/mp2t` and audio alone.
- Measure with `~/openhamshack/tools/latency.py` and the clock burnt into the
  fakebox picture.
- SRT camera ingest and PicoTuner-Eth are UDP, so they need fixed host ports
  and the app must be told its mapping.

### 2.5 TX safety
Per app and unchanged: client id, 1 s heartbeat, 5 s server unkey
(`~/openhamshack/docs/REMOTE-API.md` §7). The broker's safe-off is a second line
of defence and never keys anything.

## 3. Gaps to build

### 3.1 Dock360 (generic first, edition second)
1. Edition overlay (name, logo, defaults, catalogue, tailnet in
   `trusted_networks`, UI on port 80) plus static-asset cache busting.
2. Device tokens, pairing, `forward_auth`, per-app levels.
3. The `kind` field, `/.well-known/openhamshack`, and an mDNS recipe.
4. Fixed or requested host ports (UDP too), told to the app. Allocate on
   update, not only at install.
5. The `render` group for `/dev/dri` **[guess: check on the N150]**.
6. The hardware broker.
7. Hotplug for hidraw, v4l and serial, or broker-owned equivalents.
8. Removable media bind for recordings.
9. A kiosk host service (sway, Chromium, mpv, `screens.py`) plus a local
   token.
10. Network setup ops (Wi-Fi, static IPv4 with timed confirm), from
    `openhamshack-net`.
11. A busy gate that platform, app and OS updates and reboots all respect.
12. Update feed polling (platform and catalogue, signed, stable and beta).
13. Automatic OS security updates behind the busy gate.
14. Prebuilt images in app packages, for offline install.
15. Signatures required from day one in the edition.
16. Known traps to fix first:
    - `install.sh` logs `ADMIN_PASSWORD`;
    - `create-admin` defaults to `admin`;
    - `dev sync` jobs hang.
17. **Audio routing between apps** (rig app RX audio to the digital-modes app, TX audio back under the holder's lease).
18. ~~A shared volume for Teletext pages to ATV~~: not needed, Teletext is part of ATV.
19. A pipe-buffer budget for many TS pipes.

### 3.2 OpenHamShack Classic, split out
Keep **one codebase** with a `OPENHAMSHACK_PLATFORM=dock360` switch, so Classic
keeps releasing from the same repo.

| Classic | On the platform |
|---|---|
| `is_local`/`authorised` | trust only verified proxy identity headers |
| updates, rollback | off (the platform does it) |
| OS updates, network, power, Try mode, growroot | platform |
| USB sticks | platform mount and bind |
| screens/mpv/sway | kiosk host service |
| Bonjour | platform advert |
| PTT outputs | broker |
| pads/keypads | kiosk agent calling the app's API (D9) |
| PicoTuner firmware (BOOTSEL) | broker plus a helper op |
| callsign, locator, licence | station profile |
| setup wizard | platform wizard; the app keeps only radio and tuner steps |
| backup | Dock360 volumes, plus import of a Classic backup file |
| diagnostics | the app's own section only |
| radio-lock | broker plus the radio-side marker |

## 4. Phases

Classic boxes are **never migrated automatically**, and no platform package
ever appears in a Classic feed.

| Phase | Ships | Stays working |
|---|---|---|
| **0. Decide and protect** | This plan agreed; an **offline backup of the Classic signing key**; new platform keys | everything |
| **1. DATV as a container app, receive only** | platform mode in `openhamshack.py` behind the switch; app `openhamshack-datv` with all ports declared, `pids_max`, MiniTiouner, `/dev/dri`; TX hard-disabled | Classic releases, Remote, the fakebox |
| **2. Platform contract** | device tokens, `forward_auth`, levels, `kind`, `/.well-known/openhamshack`, mDNS recipe, fixed ports, `render` group (generic Dock360 releases) | existing Dock360 apps |
| **3. Remote learns the platform** | base path, HTTPS, token pairing, kinds list, while still supporting Classic `host:8080` + PIN | Classic boxes, the fakebox |
| **4. Broker v1** | `broker.py`, `claim: runtime`, safe-off for Pluto/LibreSDR/relays, the Hardware page; DATV TX under the broker, on the bench **with Brian present** | SigScope/datv-rx claims |
| **5. Edition and image** | edition overlay, kiosk, wizard, busy gate, feeds, catalogue with images, OS updates; image from `mkimage.sh`/`mkiso.sh`; QEMU boot test | workshop stays on Classic |
| **6. Brian's beta** | OpenHamShack 2.0-beta ISO; Classic gains "Export for the new OpenHamShack" | Classic feeds, ISO, report.php |
| **7. More apps** | Shared components first (ohsdigi packaged, logbook/lookup/spots services), then NB/HAM, StationFlow rebuilt as an OpenHamShack app on them, ATV (with Teletext built in), then DATV terrestrial | the desktop apps' own feeds |
| **8. Public, and Classic sunset** | public ISO; Ray invited; Classic security fixes for a stated period, then an end-of-support release | Classic boxes until the end date |

**Keys and feeds.**
- Classic keeps `openhamshack-release-2026.pub` and its feeds.
- The platform uses a Dock360 **master** key (platform updates) and a
  **modules** key (apps).
- Proposed feed paths: `…/openhamshack/platform/{stable,beta}.json` and
  `…/openhamshack/apps/`.

## 5. Decisions for Brian (recommendation first)

- **D1. Engine:** an edition overlay in the Dock360 repo, not a fork.
- **D2. Versions:** the platform starts at **OpenHamShack 2.0**, so it can never be
  confused with the 0.9.x appliance it replaces (no separate "Classic" name).
- **D3. Device credentials:** per-device tokens tied to a user (password
  exchange on phones and tablets, code approval on TVs), plus per-app "view
  on the LAN without sign-in" (on for DATV).
- **D4. Front door:** Caddy routes with `forward_auth`, no per-app LAN ports;
  a legacy `:8080` DATV listener until Remote 3.x.
- **D5. Hardware principles:** the broker may connect to known radio classes
  for safe-off (this reverses Dock360's "never connects to the address"
  rule), and PTT relays are broker-only.
- **D6. USB enforcement:** v1 cooperative, v2 grant-by-restart. An app on air
  is never pre-empted automatically.
- **D7. DATV engine:** Classic's `openhamshack.py` first; `ohsdatv` later as its
  own kind; `ohsqo` stays out of scope.
- **D8. Web UIs for the Qt apps:** API first, with the remote app as the UI;
  full web UIs per app only when asked for.
- **D9. Pads and keypads:** the kiosk agent owns them (interim: hidraw into
  the DATV app).
- **D10. Keys:** new platform keys, with offline backups of all three before
  phase 5.
- **D11. Test hardware:** a second N150 or a second SSD in workshop.
- **D12. Offline boxes:** app packages carry prebuilt images.
- **D13. Shared components and licence:** ohsdigi as the one FT8/FT4/JS8 implementation for every app; shared libraries for computation, platform services for state (logbook, lookups, spots, station); OpenHamShack apps licensed GPL-3 so they can link it (StationFlow moves from MIT).

**Risks:**
- the loopback trust leak;
- stream latency through Caddy and pasta;
- network radios can't be locked by the host;
- image size and N150 load **[guess]**;
- stored settings beat manifest defaults;
- many sessions touching many repos, so each phase needs one owning session
  per repo.

**Critical files:**
- `openhamshack.py` in the archived Classic appliance (no live repo; see the
  fakebox's vendored frozen copy, `~/openhamshack-fakebox/openhamshack-fakebox/vendor/openhamshack/appliance/openhamshack.py`)
- `~/dock360/src/dock360/{claims,caddy,quadlet}.py`
- `~/openhamshack-fakebox/openhamshack-fakebox/module.yaml`
