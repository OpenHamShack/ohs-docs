# OpenHamShack beta: the plan a session executes end to end

Brian, 09/10/2026: "launch a new session and for it to go and get everything
done ready for a beta release". This file is that session's brief. Read
GUIDE.md and PLATFORM-PLAN.md first. Where this file and PLATFORM-PLAN.md
disagree, **this file wins**, because it records later decisions.

## Decisions already made: do not stop to ask about these

- **D1–D13: all recommendations adopted** (PLATFORM-PLAN §5). Edition overlay
  on Dock360; platform starts at 2.0; device tokens; the front door through
  the platform proxy; the broker rules; ohsdatv as its own kind; API first for
  Qt apps; new keys; prebuilt images; ohsdigi as the one decoder; **GPL-3 for
  every app**.
- **Brand:** the kit in `brand/` is adopted as drafted, with a **reserved
  logo** (forks rename). Apply it everywhere.
- **Names:**
  - OpenHamShack (the controller/platform);
  - OpenHamShack QO-100 WB, QO-100 NB, DATV, Radio, ATV (with Teletext),
    Icom, Flex, Digital Modes;
  - OpenHamShack Remote (Android, iOS, TV client).
- **Every one of the eight apps is in the beta.**
- **Installers are unsigned for the beta.** Document the OS warnings on the
  download page.
- **Publishing is allowed.** The session may publish the website, the ISO
  and the store when the gates in §5 pass. The old public sites are being
  deleted; no migration of the three old installs (Brian will send those
  users to the new downloads).

## Architecture changes from PLATFORM-PLAN (Brian, 09/10/2026)

1. **Every app stands alone.** Each app ships as:
   - a **desktop app for Linux, Windows and macOS**, installable on its own;
   - an **app in the controller's store**, like Dock360's catalogue.

   A user never *needs* the controller.
2. **The controller is optional, and apps join it when present.**
   - Desktop apps and store apps are **clients** of the controller. They are
     never servers for other apps, which keeps "no servers inside the desktop
     apps".
   - They find it by Bonjour (`_openhamshack._tcp`, `platform=1`), pair with
     a device token (PLATFORM-PLAN §2.2), and then use its shared services:
     station profile, **logbook**, callsign lookup, spots/activity.
   - **Offline-first.** Every app keeps a local logbook and station profile.
     When it pairs, it syncs: each QSO has a UUID, merges are idempotent, and
     conflicts resolve by last edit with history kept. Unpairing leaves the
     local copy complete. A controller that disappears never stops an app
     working.
3. **One app codebase, two forms.**
   - **Desktop:** existing Qt apps (QO-100 NB/Radio from `~/openhamshack-nb`, ATV,
     DATV/ohsdatv) stay Qt.
   - **Web-UI apps** (QO-100 WB from the box console, Icom, Flex, Digital
     Modes) get a desktop form: the same app server, run locally, inside a
     native window (a webview shell, or open in the default browser if a
     webview isn't viable). Choose the lightest option that works on all
     three operating systems, with no external assets.
   - **Store form:** the same engine plus server in a container, using the
     broker for hardware.
4. **The controller is a bootable installer ISO for any x64 PC.**
   - **Hybrid image:** boots UEFI and legacy BIOS, from a DVD or a USB stick
     written with **Rufus (DD mode)**, or when copied onto a **Ventoy** stick.
   - **Base:** today's `appliance/mkimage.sh`/`mkiso.sh` and `installer/`
     (Debian Trixie), with the Dock360 OpenHamShack edition in place of the 0.9.x
     daemon.
   - **Store on first boot:** the store is preloaded and the QO-100 WB app is
     installed.


5. **Languages and locations** (Brian, 09/10/2026). The beta ships **in
   English only**, but every app must be **ready for other languages and
   other countries** from the start:
   - **Translatable text:** no user-visible text in code. Use each
     platform's normal mechanism (Qt `tr()`/.ts, Android `strings.xml`,
     iOS String Catalogs, gettext or JSON catalogs for web/Python), with
     English as the source language, plurals handled, and room for longer
     languages in layouts. Dates, times, numbers and units follow the user's
     locale; frequencies always show in MHz/kHz with a locale-correct decimal
     separator.
   - **Band plans and licence rules are data, not code:** one shared,
     versioned dataset (a shared library, §1.4 of PLATFORM-PLAN) of IARU
     Region 1/2/3 band plans plus per-country allocations and licence-class
     privileges (UK Foundation/Intermediate/Full and NoVs such as 146 MHz,
     US FCC classes, etc.), with the QO-100 band plan beside them. Seed it
     with Region 1 + UK in full; leave other regions as clearly marked
     partial data, never guessed.
   - **The station profile carries location:** country, IARU region,
     licence class, NoVs, Maidenhead locator and callsign. Every app's band
     limits, TX permission checks, presets and default channels come from
     the profile plus the dataset. Today's hard-coded UK/NoV logic in the
     OpenHamShack box (`txBlocked`, the licence region) moves onto this.
   - **Standalone apps** keep their own station profile (the same schema)
     and sync it when paired with a controller.


6. **The Ajazz AKP03E controller works with every app** (Brian, 09/10/2026).
   The OpenHamShack box already drives it: `Classic's archived appliance/controllers/ajazz.py`
   (driver, key LCDs and knobs), `controllers/keypad.py` (USB keypads),
   `pad.py` (actions and remapping), and `91-openhamshack-pad.rules` /
   `openhamshack-keypad` (udev). Make it a **shared controller library** (§1.4 of
   PLATFORM-PLAN) used everywhere:
   - **One driver and action model:** the library owns the HID protocol, key
     images (brand-kit icons, rendered per key) and knobs. Each app declares
     its actions (tune ±step, step size, band/mode, channel, mute, record,
     show scope, PTT where the app transmits, and so on) and a default layout.
     The user can remap per app, stored in the station profile, so the
     mapping syncs with the controller when paired.
   - **On the controller (platform):** the kiosk/input host service owns the
     device (D9) and sends key presses to whichever app is in front, switching
     the key images and layout as the app changes. A key can also switch
     apps.
   - **Standalone desktop apps (Linux/Windows/macOS):** the app in the
     foreground claims the pad and the others let go, with a clean hand-over
     when focus moves. Windows and macOS need the HID path tested (hidapi or
     the platform API).
   - **Transmit safety:** a PTT key goes through the app's normal TX lease
     and broker checks like any other control, never straight to a radio. The
     pad shows ON AIR state. If the pad disconnects while held, transmit
     stops.
   - **Tests:** the driver is exercised against a recorded/fake HID device in
     CI. A real-pad check on workshop's AKP03E is **read-only** (key events
     and LCDs, never a transmit action).

## Workstreams and milestones

Work in this order. A milestone is done only when its "done when" holds, and
is committed and recorded in HANDOVER.md.

| # | Milestone | Done when |
|---|---|---|
| M0 | **Safety and groundwork** | The `is_local()` loopback trust leak is fixed and has a test that runs behind a proxy and in a container. Platform master/modules keys exist, with offline-backup instructions handed to Brian. User-facing names/strings changed to OpenHamShack in each repo; repo/package/app-id renames planned (renaming repos is optional for beta, user-visible names are not). |
| M1 | **Shared libraries and controller services** | ohsdigi packaged (Python wheel on Linux/Windows/macOS) with FT8/FT4 decode+encode, and JS8 if feasible. Rig-control library extracted from StationFlow. Logbook service + offline-first sync client library (Python, plus Kotlin/Swift for Remote) with tests for merge/conflict/unpair. Station profile (with country, IARU region, licence class, NoVs, locator) and the shared band-plan/licence dataset (Region 1 + UK complete, others marked partial), lookup cache and spots services. String-externalisation scaffolding in place for every app (English only). Shared controller library (AKP03E + USB keypads) extracted from the OpenHamShack box with per-app action declarations. Discovery + pairing (device tokens) in the Dock360 edition. |
| M2 | **Controller edition, store and ISO** | Dock360 OpenHamShack edition (branding, `forward_auth`, levels, `kind`, `/.well-known/openhamshack`, mDNS recipe, fixed ports, `render` group, busy gate, feed polling, prebuilt-image app packages, signatures required). Broker v1 (claims, safe-off recipes, Hardware page). Hybrid ISO that boots in QEMU under **both OVMF (UEFI) and SeaBIOS**, installs to a virtual disk, reboots into the controller with the store. Rufus/Ventoy suitability checked (`isohybrid`-style MBR + EFI El Torito + GPT, checked with `xorriso -indev … -report_el_torito`, and a Ventoy-style loop boot if possible). |
| M3 | **The eight apps, both forms** | For each app: store package (container, manifest, broker claims, controller client) and desktop builds for Linux (.deb + AppImage), Windows (.exe installer) and macOS (.dmg, unsigned). Each launches, finds a controller and works without one, shares the logbook when paired, takes band limits/TX permissions from the station profile + dataset (no hard-coded bands), has no user-visible string outside its translation catalog, declares its controller actions and default AKP03E layout, and passes its own tests. Receive paths verified against fakeboxes and simulators; transmit paths tested only into fakes. |
| M4 | **Remote apps** | OpenHamShack Remote (Android incl. TV): kinds per app (QO-100 WB/DATV video, Icom with the radio-style display, others as their APIs allow), platform pairing, offline mode. APKs on the site. iOS/tvOS builds compile and run in simulators; TestFlight only if Brian has supplied the App Store Connect app record and API key (otherwise noted as pending). |
| M5 | **Website** | Static site for openhamshack.com in a repo, using the brand kit: platform, a page per app, downloads (ISO, per-OS installers, APKs, checksums, unsigned-install instructions), guides, roadmap ("coming" labels honest), community (net chat if kept, contact). No external assets. Built and previewed locally (screenshots at phone and desktop width, light/dark). |
| M6 | **Beta gate and publish** | Gates in §5 all pass. The site is published on openhamshack.com (.co.uk/.radio are not registered; redirects dropped for now) via the Control360 session's 20i API. The ISO, installers and store feed are uploaded. HANDOVER.md has the release record (what, where, versions, checksums, known issues). |

Parallelism: M1 and the M2 edition work can run side by side. M3 apps can be
split across agents once M1's libraries exist. Stay within the concurrency
limit (§4).

## How to run it

- **Orchestrate; don't do it all inline.** Use the `ohs-*` agent types
  (GUIDE §8):
  - architect for the controller-client contract and sync design (M1);
  - builder per workstream;
  - verifier for every "done when";
  - researcher for packaging and boot facts;
  - mechanical for renames and copying.
- **At most 2–3 code agents at once.** Queue the rest.
- **Never block the conversation.** Builds and waits go to background agents.
- **Each agent gets its own worktree,** created by you for repos other than
  the session's (GUIDE §8 traps), and commits there. You review and merge.
- **Checkpoint after every milestone:** update HANDOVER.md (state, branches,
  what's next), commit, and tell Brian in a few lines. If the session ends,
  the next one resumes from HANDOVER.md.
- **Ownership:** this beta absorbs products other sessions have worked on
  (OpenHamShack Desktop / QO-100 WB desktop form, NB/HAM). Check `ListAgents` and
  worktrees first. If a session is active on one, send it a short
  `SendMessage` saying what you'll take over, and don't edit its worktree.
- **Build hosts:**
  - **`ssh ohs-build`** = user `ohs` on build-a (office VM 120, Debian 12,
    32 vCPU / 48 GB / ~320 GB free). Brian, 09/10/2026: OpenHamShack build
    code lives here, separate from Control360's. **Nothing may be installed
    system-wide on build-a**; per-user toolchains under `/home/ohs` are fine
    (rustup, Python venvs/uv, node packages). Available: gcc, mingw-w64
    (Windows cross), Node 22, Python 3.11, git. Not available: podman,
    debootstrap, xorriso, ffmpeg, Qt, cmake, and no `/dev/kvm` (its CPU
    must stay `kvm64`; `--cpu host` panics it). So it suits Rust crates
    (ohsdigi, longmynd-rs), Windows cross-builds, and the website; the ISO,
    container images, Qt builds, QEMU boot tests and Android emulators stay
    on shack. Never touch Control360's files on build-a.
  - Linux and Android on shack (`~/android-toolchain`);
  - macOS/iOS on the Mac mini (`/Volumes/OpenHamShackBuild` for everything that
    grows);
  - Windows on the Windows desktop over SSH (memory `windows-desktop-ssh.md`),
    or cross-built where proven;
  - heavy builds may use `build-a`/office per memory, but **never touch VM 110**.
- **Don't release from a dirty tree.** Look at what each release *removes*
  (CLAUDE.md).

## Gates before publishing (§5)

All must hold. Otherwise stage everything, report what failed, and don't
publish.

1. **Ready for other languages and locations:** a check fails on any user-visible string literal outside the catalogs (allow-listed exceptions only), and switching the station profile to a non-UK country changes band limits in at least one app's tests.
2. **Tests:** every repo's own suite is green on its release commit. The full
   suites ran once on the integration branches.
3. **Safety:**
   - nothing in the beta can transmit without the TX lease plus the broker;
   - view-only can't control;
   - the loopback fix is in;
   - no secret appears in any image, package, log or page (scan for keys and
     tokens).
4. **ISO:** installs and boots under UEFI and BIOS in QEMU. The installed
   system serves the controller UI, the store lists all eight apps, and
   installing one works offline (prebuilt image).
5. **Desktop:** each app's Linux, Windows and macOS builds install and launch
   (screenshot each). Standalone mode works; pairing with a test controller
   shares one logbook entry both ways.
6. **Remote:** the APK pairs with the test controller and shows at least the
   QO-100 WB picture (fakebox) and the Icom display (fakeflow).
7. **Website:**
   - every download link resolves;
   - checksums match;
   - it renders at 390 px and 1440 px in light and dark;
   - no external requests.
8. **Domains:** openhamshack.com exists at 20i (registered 09/10/2026, 20i DNS ns1-4.stackdns.com). That alone satisfies this gate; .co.uk and .radio are optional/later and not registered.

## Hard limits (unchanged by autonomy)

- **Never key a real radio or change a real radio's or box's settings.** No
  workshop (workshop) changes, no Pluto, no IC-9700, and no Brian's-TV
  wake-ups at night. On-air transmit tests wait for Brian, so beta notes say
  "transmit tested into fakes only".
- **Shared resources:**
  - don't prune podman images with `-a`;
  - don't fill shack's `/tmp`;
  - kill processes by PID only.
- **Secrets:** don't move any secret between sessions or into a repo. 20i work
  goes through the Control360 session.

## Decisions taken by the beta session (ohs-beta, 09/10/2026)

The contract docs (docs/contract/) raised four questions. Brian said not to
stop for decisions inside D1-D13, so the session took them; each can be
reversed after the beta.

1. **Store packaging lives in each app's own repo** under `store/`
   (REPO-LAYOUT §4.1). "No servers in desktop apps" is kept by process: the
   Qt desktop app never opens a listener; the store form runs `--server` in a
   container. Separate `dock360-apps-openhamshack-<kind>` repos are not created.
2. **QO-100 WB adopts the licence dataset's answers** (2350-2390 MHz refused,
   Foundation/Intermediate limits applied, the box's "no band check" option
   removed in the store app). Every changed answer goes in the release notes.
   Classic 0.9.x is unchanged.
3. **ohsdigi stays in `~/openhamshack-nb` for the beta** (wheels built there,
   `ohs-libs` pins the wheel). Moving it with its history into `ohs-libs`
   waits until after the beta, agreed with the NB session, so the beta does
   not disturb NB/HAM releases.
4. **The 146 MHz NoV ships as `researched`** from the box's transcription
   until someone cites the NoV document for the power figure and 40 km rule.
5. **Website content** (docs/research/SITE-CONTENT.md): the site says nothing
   has had formal on-air transmit testing, and mentions the one supervised
   DATV bench session (8 Oct, 1255 MHz). Net chat is left off the beta site
   ("coming"): its old host is being deleted. Contact is a role mailbox
   `hello@openhamshack.com`, requested from the Control360 session at publish;
   no personal name or address on the site. Icom and Flex are relicensed MIT ->
   GPL-3.0 in their M3 work (D13). Per-app "forms" lines must match the real
   download list at publish time.
6. **macOS back, by script only (Brian, 09/10 evening):** paused earlier the
   same evening to save credit, then resumed once the builds moved to
   `tools/beta-build/desktop-remote.sh macos <app>`. No agent builds, signs or
   watches a Mac build; the script does it, notarisation wait included. Gate 5
   checks Linux, Windows and macOS again.
7. **Icom, Digital Modes and DATV ship without macOS for the beta (Brian,
   10/10 ~13:15):** the site lists their macOS form as "coming later" and
   gate 5 is met for them on Linux and Windows. Not an exemption forever:
   each gets a macOS form after the beta.
