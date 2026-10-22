# OpenHamShack rename plan: what still carries the old names

Written 09/10/2026 for milestone M0 of the beta. The M0 commits change only
what a person reads (titles, labels, help text, About, installer display
names). Everything below is what deliberately still carries a OpenHamShack,
StationFlow or FlexDeck name, what it should become, and how to move it
without breaking an installed copy or an auto-updater.

## Recommendation in one paragraph

Before the beta: nothing more than M0 already did (names people see). After
the beta: identifiers, one repo at a time, each with the migration path in
its row. The exception is anything **created new** for the beta (a new
Dock360 module, a new store listing, a new package): that starts with the
new identifier and never has an old one.

## Prefix decision needed first

The brief proposed `shack-*` for new identifiers (Dock360 module ids). The
brand kit (`~/openhamshack/brand/README.md`, "The mark") says the opposite:
**never the initials OHS**, "not in the brand, and not as a code prefix
either: code uses `shack`" (OHS reads as occupational health and safety).
This plan therefore writes new identifiers as `shack-*` / `shack` /
`openhamshack`. Brian should confirm one before any new id is minted,
because ids are the thing that is expensive to change twice.

| Kind of identifier | Proposed new form |
|---|---|
| Dock360 module id | `shack-<app>` (`shack-icom`, `shack-flex`, `shack-fakebox`, `shack-qo100-wb`...) |
| Python package / executable | `shack<app>` or keep `lb*` (see below) |
| Android applicationId | `com.openhamshack.<x>` (a new id is a new app: see Remote) |
| iOS bundle id | `com.openhamshack.<x>` (same caveat) |
| Bonjour | `_openhamshack._tcp` advertised **beside** `_openhamshack._tcp` |
| Well-known path | `/.well-known/openhamshack` served beside `/.well-known/openhamshack` |
| Swift package / Kotlin package | `ShackKit`, `com.openhamshack.shack.*` (pure code; no user impact) |

### Executables: recommend keeping `ohsnb`, `ohsradio`, `ohsatv`, `ohsdatv`, `ohsdigi`

They are short, already typed by users and scripts, named in update
manifests and Windows shortcuts, and "lb" is invisible to anyone who does
not open a terminal. Renaming buys nothing a user sees. If they are renamed
anyway, ship the new name and keep the old one as a symlink / tiny
launcher for at least two releases.

## General migration patterns (used in the rows below)

- **Config/data dir:** read the new location; if absent and the old one
  exists, copy (not move) it across once and leave a note file in the old
  one. Copy rather than move so a rollback to an older release still finds
  its settings. Qt: change `QCoreApplication.setOrganizationName/
  setApplicationName` only together with this copy step, because QSettings
  derives its path from them.
- **Update feeds:** keep publishing to the old feed URL and manifest name
  for as long as any old release can be installed. A new release may read a
  new feed, but the last release on the old feed must be one that knows the
  new feed (a "bridge" release). Never redirect a signed manifest across
  hosts without checking the client follows redirects and still verifies the
  signature against the same key.
- **Signing keys:** key *names* are labels; leave them. Rotating a key is a
  separate decision and needs the bridge-release pattern too.
- **Dock360 module id:** Dock360 has no in-place id change. A new id is a new
  module with a new data folder (`/var/lib/dock360/modules/<id>/data`). Path:
  ship the new module, give it a one-time import from the old module's data
  folder (the operator clicks "import from <old>"), then retire the old one.
  Stored settings beat manifest defaults, so settings must be imported too,
  not re-defaulted.
- **Android applicationId / iOS bundle id:** changing either creates a
  different app; installed copies do not update into it and store reviews,
  TestFlight testers and saved data stay with the old one. Only do it when a
  store listing is created for the first time (that is the moment to use the
  new id, since nothing is installed yet from a store).
- **Bonjour / well-known path:** servers advertise both old and new for a
  long overlap; clients browse both and de-duplicate by host+port. Drop the
  old type only when no supported client browses only the old one.
- **Cookies:** a rename signs everyone out. Accept old and new cookie names
  for one release (read either, write the new), then drop the old.
- **Hostnames (e.g. `openhamshack.local`):** a box's mDNS hostname is what users
  and saved boxes in the Remote point at. Add the new name as an avahi alias
  and keep the old one until saved entries have been rewritten.

(Per-repo sections follow.)

## Per repo

"When" says **pre-beta** (do before the beta), **post-beta** (after), or
**new-id** (only if a new package or store app is being created anyway, then
use the new id from the start).

### OpenHamShack (Classic box) - `~/openhamshack`

M0 commit c61863d (worktree ohs-rename-openhamshack) renamed the console, wizard,
help, installer page, ISO boot menu, motd, test card, diagnostics, USERGUIDE.md.
The Classic box is **replaced by the platform**, so most of its identifiers
should simply die with it, not be renamed.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| repo `openhamshack`, `appliance/openhamshack.py`, `openhamshacklib/` | repo | none (retired with Classic) | - | never |
| executables `openhamshack-apply-update`, `-os-update`, `-net`, `-usb`, `-keypad`, `-growroot` | appliance/ | none | - | never |
| systemd units `openhamshack*.service/.timer`, udev `90-93-openhamshack-*.rules`, `logind-openhamshack.conf` | appliance/ | none; but **`Description=` lines** ("OpenHamShack DATV console", "OpenHamShack screens") are shown by `systemctl` | change Description only (safe, no unit rename) | pre-beta (cheap) |
| unix user `openhamshack`, `/home/openhamshack/*`, `/etc/openhamshack/openhamshack.conf`, `/opt/openhamshack.prev`, `/media/openhamshack` | mkimage.sh, openhamshack.py | none | renaming a user/home on installed boxes is risky for no visible gain | never |
| hostname `openhamshack` -> `openhamshack.local` | mkimage.sh:192 | `openhamshack` | add avahi alias `openhamshack.local` on update; keep `openhamshack` | post-beta (platform does its own) |
| disk/ISO labels `openhamshack`, `lbinstall`, `LBI-EFI`, `OPENHAMSHACK` | mkimage.sh, mkiso.sh | none for installed disks; new ISOs could use `OPENHAMSHACK` volume id | `openhamshack-usb` matches labels, change both together | post-beta, optional |
| image names `openhamshack.img(.zst)`, `openhamshack-installer-*.iso` | tools | `openhamshack-*` for new downloads | files are downloaded by people, not updaters | post-beta |
| env `OPENHAMSHACK_*` (16 vars) | openhamshack.py | none | internal | never |
| update feed `https://openhamshack.brian-henderson.co.uk/latest.json` / `beta.json` | openhamshacklib/settings.py:148 | keep | the public mirror is pushed by hand; a new domain needs the bridge-release pattern | post-beta, only with the website move |
| signing key `openhamshack-release-2026.pub` | release-keys/ | keep the file name | label only | never (rotate separately) |
| Bonjour `_openhamshack._tcp`, instance falls back to "openhamshack" | openhamshack.py:6854/6864 | also advertise `_openhamshack._tcp` | dual-advertise; Remote browses both | platform work (PLATFORM-PLAN), not Classic |
| cookie `ohssession`, headers `X-OpenHamShack-Version`, `X-OpenHamShack-Token`, UA `OpenHamShack/<v>` | openhamshack.py, tools/reports.py | none | clients and the report endpoint match on them | never on Classic |
| placeholder callsign `OPENHAMSHACK` | openhamshacklib/settings.py:15 | none | the daemon treats it as "unset" | never |
| backup marker `openhamshackBackup`, `openhamshack-backup-*.json`, `openhamshack-report-*.txt`, USB folder `OpenHamShack` | openhamshack.py | new names for **new** files, accept old on restore | restore must read both forever | post-beta |
| update kind `"openhamshack"` | openhamshack.py:10651 | none | updater contract | never |
| `site/` (public website, openhamshack.brian-henderson.co.uk) | site/ | OpenHamShack site | move with the domain decision; keep old URLs redirecting | before public beta announcement, separate task |
| USERGUIDE.pdf, guide screenshots | docs | rebuild | regenerate after M0 lands | pre-beta |
| Larix default connection name: **changed** in M0 to "OpenHamShack" | streams.py:275 | - | phones that scanned the old QR keep "OpenHamShack" and gain a second entry; revert the one line if that is unwanted | decide pre-beta |

### OpenHamShack QO-100 NB and OpenHamShack Radio - `~/openhamshack-nb`

M0 commit 6d85fd7 (worktree ohs-rename-openhamshack-nb). The NB session owns
releases; it must merge and cut this. The About box carries "Formerly
OpenHamShack NB" via `Face.former_name`. Note: `setApplicationName` now carries
the new name; safe today only because nothing derives a path from it (no
QSettings/QStandardPaths App* location) - `qtapp.make_app` says so; anyone
adding QSettings later must pin the old name or migrate.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| repo `openhamshack-nb`, packages `ohscore`, `ohsnb`, `ohsradio`, `ohsdigi` | repo | keep (see "Executables" above) | - | never / with a platform move |
| executables `ohsnb`, `ohsradio`; .deb / launcher names `openhamshack-nb`, `openhamshack-ham` | tools/build-deb.sh, packaging | keep, or `openhamshack-qo100-nb`, `openhamshack-radio` with old names as symlinks | new .deb `Replaces/Provides` old; keep symlinks two releases | post-beta |
| config/data `openhamshack-nb`, `openhamshack-ham` (XDG, %APPDATA%) | ohscore/host.py | `openhamshack-qo100-nb`, `openhamshack-radio` | copy-on-first-run from old dir | post-beta |
| update feeds `https://openhamshacknb.brian-henderson.co.uk/update.json`, `https://openhamshackham.../update.json` | ohsnb/ui/face.py:73, ohsradio/ui/face.py:73 | new host when the website moves | bridge release: last release on old feed knows the new feed; keep old feed live and signed | post-beta |
| key name "360 Technology OpenHamShack release key 2026" | ohscore/update.py:87 | keep | the name is a label; changing it is cosmetic | never (rotate separately) |
| Windows AppId `{5B0E6A3C-...}` (NB), `{6CB153AC-...}` (HAM); `DefaultDirName={autopf}\OpenHamShack NB` / `OpenHamShack HAM`; setup file names | packaging/windows/*.iss | **keep AppId forever**; install dir may move | Inno keeps the previous dir on upgrade (UsePreviousAppDir), so a new DefaultDirName only affects fresh installs; M0 already deletes old-named shortcuts on upgrade | post-beta (fresh installs only) |
| macOS bundle file "OpenHamShack NB.app", bundle ids `com.openhamshack-nb` / `-ham` | packaging/macos/*.spec | new id only for a Mac App Store / notarised first release | the drag-to-replace update only works with the same .app name; a renamed .app leaves the old one beside it, so ship a one-line "delete the old app" note | new-id (when Developer ID signing starts) |
| `.desktop` file names `openhamshack-nb.desktop`, `openhamshack-ham.desktop` | packaging | keep (menu entries are keyed by file name) | Name= already changed; Keywords include OpenHamShack | never |
| env `OHSNB_*`, `OHSRADIO_*`, `OPENHAMSHACK_PSKREPORTER`, `OPENHAMSHACK_RELEASE_KEY`; release dirs `/srv/openhamshack-{nb,ham}-releases`; key file `~/.config/openhamshack-release/ed25519.key` | various | keep | internal | never |
| ADIF `PROGRAM_ID = "OpenHamShackNB"` / `"OpenHamShackHAM"`; SigMF `openhamshack:*` keys | ohsnb/radio.py:137, ohsradio/radio.py:129, ohscore/engine.py:2161 | `OpenHamShackQO100NB` / `OpenHamShackRadio`; write `openhamshack:*`, read both | PROGRAM_ID is visible in loggers but may be keyed on by them (the Icom app did change its PROGRAMID in M0); recordings must still open | decide pre-beta for PROGRAM_ID; SigMF post-beta |
| macOS `CFBundleName` still follows the bundle file name, so the menu bar likely still says "OpenHamShack NB"; INSTALL.md still quotes macOS dialogs with the old name | packaging/macos, docs/INSTALL.md | check on the Mac mini | - | pre-beta check |
| sites `openhamshacknb.` / `openhamshackham.brian-henderson.co.uk` | tools/site-build.py | OpenHamShack site sections | redirects | with the website move |

### OpenHamShack DATV - `~/openhamshack-datv`

M0 commit 3111ab7. `identity.NAME = "OpenHamShack DATV"`; a new
`identity.QT_APP = "OpenHamShack DATV"` keeps Qt's application name unchanged.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| package `ohsdatv`, executables/.deb `openhamshack-datv`, `openhamshack-datv-helpers`, `-console.exe` | identity.py:49-58, tools/build-*.sh/.ps1 | keep, or `openhamshack-datv` + symlink | as NB | post-beta |
| Qt org/app (`identity.APP`, `QT_APP`) | identity.py | new names only with a dir migration | no QSettings today | post-beta |
| config/data `openhamshack-datv` | identity.APP | `openhamshack-datv` | copy-on-first-run | post-beta |
| env `OHSDATV_*`, `OHSRADIO_LOCK_DIR`, `OPENHAMSHACK_SIGNING_ACCOUNT`, `OPENHAMSHACK_MQTT_PORT` | identity.ENV_PREFIX etc. | keep | - | never |
| shared radio lock `/run/lock/openhamshack-radio.<id>.lock`, `/tmp/openhamshack-radio.lock` on the Pluto, `%ProgramData%\openhamshack-radio` | radiolock.py, radio-lock-folder.iss | **keep** | every family app must agree on it; replaced by the platform broker, not renamed | never |
| Windows AppId `{FFAB800B-...}`, `{autopf}\OpenHamShack DATV` | openhamshack-datv.iss | keep AppId; dir for fresh installs only | as NB | post-beta |
| ADIF `APP_OPENHAMSHACK_*` fields | logbook.py:570, rxlog.py:135 | `APP_OPENHAMSHACK_*` for writing, read both | importers must accept old forever | post-beta (with the shared logbook service) |
| net server `https://openhamshack.brian-henderson.co.uk/net/api/v1/` | state.py:176 | new host | keep old path served; clients read the new | with the website move |
| no self-updater | - | - | - | - |

### OpenHamShack ATV - `~/openhamshack-atv`

M0 commit 63fe244. Installer deletes old-named shortcuts on upgrade.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| package `ohsatv`, executable/.deb `openhamshack-atv` | build-deb.sh, build-windows.ps1:72 | as DATV | | post-beta |
| Qt "OpenHamShack ATV"/`openhamshack-atv` | ohsatv/ui/__init__.py | with dir migration | no QSettings today | post-beta |
| config/data `openhamshack-atv` | ohsatv/host.py:38 | `openhamshack-atv` | copy-on-first-run | post-beta |
| `.desktop`/.menu/.metainfo/`openhamshack-atv-hamradio.directory` file names | packaging | keep | menu keys | never |
| SigMF `openhamshack:*` keys | iqrec.py, devices/filedev.py | write `openhamshack:*`, read both | old recordings must still open | post-beta |
| Windows AppId `{B92D9921-...}`, `{autopf}\OpenHamShack ATV` | openhamshack-atv.iss | keep AppId | as NB | post-beta |
| On-air teletext header name OPENHAMSHACK (when no callsign) | ohsatv/carousel.py | OPENHAMSHACK needs 12 of the header's columns where OPENHAMSHACK had 9: drop a field (e.g. weekday) | broadcast content: Brian's call | decide pre-beta |
| site `openhamshackatv.brian-henderson.co.uk`, source site `#openhamshack-atv` | tools/site-build.py | OpenHamShack site | redirects | with the website move |

### OpenHamShack Teletext - `~/openhamshack-teletext` (merging into ATV)

M0 commit b0e9eb7. Since it merges into ATV, rename **nothing** else here:
its identifiers disappear in the merge, and ATV's take over.

| Old identifier | Where | Note |
|---|---|---|
| package `ohstxt`, launcher/.deb `openhamshack-teletext`, unit `openhamshack-teletext-live.service`, config `openhamshack-teletext` (prefs.py:35), env `OHSTXT_*`, UA `openhamshack-teletext/<v>` | various | disappear with the merge |
| clipboard MIME `application/x-openhamshack-teletext-block` | ohstxt/clipboard.py:29 | keep in ATV (copy/paste between versions) |
| default page header OPENHAMSHACK (ohstxt/header.py:24), sample pages "OPENHAMSHACK NEWS" / "Pages from OpenHamShack Teletext" | tests compare them byte for byte with a vbit2 capture; changing needs a new capture | decide with ATV's header |

### OpenHamShack Remote - `~/openhamshack-remote`

M0 commit 9da3725 (worktree ohs-rename-openhamshack-remote). Launcher label,
display names, plists, all messages, and the TV banner (existing art, new
text) changed.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| repo `openhamshack-remote` | - | `openhamshack-remote` | git remote rename; worktrees re-pointed | post-beta |
| Android applicationId/namespace `com.openhamshack.remote` | android/app/build.gradle.kts:9,13 | `com.openhamshack.remote` **only if the Play/Amazon listing is created new** | sideloaded beta users would install a second app and lose saved boxes; if the store app is new anyway, use the new id from the start and offer "import boxes" via a share/QR export | new-id |
| iOS bundle id `com.openhamshack.remote` (both targets) | ios/tools/genproject.py:32 | `com.openhamshack.remote` | **No App Store Connect record exists yet** (TestFlight awaits Brian), so this is the cheapest moment: create the record with the new id. Recommend doing it before the first TestFlight build. | new-id, pre-TestFlight |
| Kotlin packages `com.openhamshack.*`, Swift `OpenHamShackKit`, `OpenHamShackMedia`, `OpenHamShackPlayer`, `OpenHamShackCamera`, project `OpenHamShackRemote.xcodeproj`, `OpenHamShackRemoteApp`, `Theme.OpenHamShackRemote` | code | `shack` / `OpenHamShackKit` (GUIDE already calls it OpenHamShackKit) | pure code; one mechanical commit; no user impact | post-beta |
| DataStore file `openhamshack-remote` (saved boxes, PINs/sessions) | data/Store.kt:57 | keep | renaming loses every saved box | never (or read-old-write-new) |
| Bonjour browse `_openhamshack._tcp` | Discovery, Info.plist NSBonjourServices | browse `_openhamshack._tcp` too | add the type to NSBonjourServices and the Android NSD browse; de-duplicate | when the platform advertises it |
| example `openhamshack.local` in address hints | BoxAddress.kt:40, BoxListView.swift:114 | follow the box hostname | | with hostname alias |
| launcher icons (mast), Apple app icon | res/mipmap, Assets | brand kit `icons/android/remote/*`, `ios-1024.png`, `tvos-*`, `png/remote/android/drawable-xhdpi/tv_banner.png` | simple swap once Brian approves the kit (it is still a draft) | after brand approval |

### OpenHamShack Icom - Dock360 app `icom` (`~/dock360-apps`, branch icom), TV app `~/stationflow-tv`

M0 commits: icom 1a14b85 (a real Cabrillo SOAPBOX 80-column bug the rename
exposed) and 499fed9 (names); stationflow-tv 63ba8bf.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| Dock360 module id `icom` | icom/module.yaml | **keep** (`icom` is already neutral); a rebuilt OpenHamShack app would be `shack-icom` | a new id is a new module + data import; only when rebuilt on the shared components | new-id at rebuild |
| standalone units/scripts `icom-*`, appliance updater | icom/standalone | keep | already neutral | never |
| release tag/announce text "StationFlow" in `standalone/icom-release` | developer tool | change next time it is touched | none | post-beta |
| kind id `stationflow` (platform directory, TV-API.md, Android `kind-stationflow`) | docs/TV-API.md, Discovery | `icom` | platform lists both kinds for an overlap; clients accept either | before any second client depends on it (ideally pre-beta, since no client is released) |
| TV-API.md prose "StationFlow" | docs | OpenHamShack Icom | doc edit | pre-beta (cheap) |
| repo `stationflow-tv`, applicationId `com.openhamshack.stationflow.testapp`, packages `...openhamshack.kind.stationflow`, `StationFlow*` classes, project name `StationFlowTV` | android | the kind folds into OpenHamShack Remote (one client app per platform), so it never ships under its own id | no migration: test app only | with the Remote merge |
| TV launcher icon | testapp res | brand `icons/.../icom` (no TV banner in the kit: needs a 320x180 banner added) | after brand approval | after brand approval |

### OpenHamShack Flex - Dock360 app `flex` (`~/dock360-apps`, branch flex)

M0 commit f02984e.

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| module id `flex` | module.yaml | keep (neutral); rebuilt app `shack-flex` | as Icom | new-id at rebuild |
| cookie `flexdeck` | app/main.py:47 | `flex_session` | accept both one release | post-beta |
| localStorage `flexdeck.keyRotate`, `flexdeck.keyFit`; `window.flexdeck` | static/*.js, tools/*.js | `shack.flex.*` | read old once, write new | post-beta |
| radio identity: `client program FlexDeck`, `CLIENT_STATION` default `FlexDeck` | app/radio.py:480, settings.py:203, module.yaml:161 | `OpenHamShack` | **shown in SmartSDR's and Maestro's client list**, so user-visible; the radio restores slices per station name, so installed copies must keep their stored name (they do: stored settings beat defaults). Change only the default for new installs, after checking on a real radio that the program string accepts it | pre-beta if a radio test is possible, else post-beta |
| `FLEX_*` env, `flexdeck-test-` temp prefix | settings, selftest | keep | - | never |

### OpenHamShack Fakebox - Dock360 app `openhamshack-fakebox`

M0 commit 35688bf (display name and README only).

| Old identifier | Where | Proposed | Migration | When |
|---|---|---|---|---|
| module id `openhamshack-fakebox`, data `/var/lib/dock360/modules/openhamshack-fakebox`, `host/openhamshack-fakebox-announce.service`, repo `dock360-apps-openhamshack-fakebox` | module.yaml, host/ | `shack-fakebox` | it is a test tool with no users: install the new module, copy `data/clips/`, uninstall the old, update GUIDE §4 commands | post-beta (any time; no users) |
| vendored box code (vendor/PINNED) | vendor/ | follows `~/openhamshack` | re-vendor | with Classic |

### Not covered by an M0 worktree

- **OpenHamShack QO-100 WB / OpenHamShack Desktop (`~/openhamshack-desktop`)**:
  owned by another session; not touched.
- **OpenHamShack Digital Modes (ohsdigi)**: a Rust library inside
  `~/openhamshack-nb/rust`; no user-visible name of its own yet. When it gets a
  UI, it is named OpenHamShack Digital Modes from the start.
- **`~/openhamshack-net`** (chat/RX reports, 20i): server paths under
  `openhamshack.brian-henderson.co.uk/net/` are used by DATV; move with the site.
- **Websites and domains** (`openhamshack.`, `openhamshacknb.`, `openhamshackham.`,
  `openhamshackatv.brian-henderson.co.uk`): every update feed lives on these
  hosts. Whatever new domain is chosen, the old hosts must keep serving
  signed feeds (or a bridge release must have moved every client) - this is
  the single largest migration and should be its own planned task.

## Open questions for Brian

1. `shack-*` (brand kit rule) or `shack-*` (this brief) for new ids?
2. Apple: create the App Store Connect record with
   `com.openhamshack.remote` before the first TestFlight build?
3. On-air teletext: drop a header field to fit OPENHAMSHACK, or keep the
   callsign-only header?
4. Flex: change the radio-facing program/station name for new installs?
5. Home-screen labels: "OpenHamShack Remote" is truncated on iOS/Android
   launchers (about 12 characters show). Keep the full name, or use
   "OpenHamShack" as the short label (Apple TV already does)?
6. Brand kit approval, which unlocks the icon/banner swaps listed above.

## Settled by ohs-beta (09/10/2026)
- Prefix is `shack` (brand kit), see contract/REPO-LAYOUT.md "Identifier prefix".
- OpenHamShack Remote: **com.openhamshack.remote** on iOS/tvOS and Android, from
  the M4 builds (App Store Connect record exists). Test installs on the Fire TV
  become a second app.
- ADIF PROGRAMID: one rule for every app, `OpenHamShack <App>` (Icom already;
  NB/Radio's `OpenHamShackNB` moves in M3).
- Larix default connection name stays "OpenHamShack" (two entries on phones that
  scanned the old QR are acceptable for a beta).
- On-air teletext header keeps OPENHAMSHACK for the beta (known issue: OPENHAMSHACK
  needs 12 characters and a header field would have to go).
- Flex's `client program FlexDeck` waits for a real-radio test.
- The 1920 box header hides the wordmark (as phones do): accepted.
