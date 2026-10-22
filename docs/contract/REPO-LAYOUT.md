# Where the shared pieces live, how apps depend on them, and the ids

Status: **design for M1 builders**, 09/10/2026. Answers: which repo holds
the shared libraries and data (CONTROLLER-CONTRACT, SERVICES, SYNC,
BANDPLAN-DATA, CONTROLLER-PAD, I18N), how the eight apps, Remote and the
Dock360 edition take them, and the id scheme for store apps. **[guess]**
marks the unverified.

## 1. Decision: one new monorepo, `~/ohs-libs`

Every shared, client-side piece goes in **one** new repository with
`python/`, `kotlin/`, `swift/`, `js/`, `rust/`, `data/` and `spec/`
directories, released in lockstep. The platform side stays in `~/dock360`
(D1: an edition overlay in the Dock360 repo, not a fork).

Why one repo rather than one per library or per language:

- **The contract is one thing.** A change to the QSO schema touches the JSON
  schema, the Python, Kotlin and Swift libraries, the controller's merge and
  the test vectors at once. In one repo that is one commit and one review;
  across five it is five commits that can land out of step.
- **Shared vectors cannot drift.** SYNC.md §8, BANDPLAN-DATA.md §9, I18N.md
  §5 and CONTROLLER-PAD.md §9 all rely on the same vector files run by every
  implementation. Copied into separate repos they would diverge, and each
  repo's suite would stay green while the union was wrong: the failure
  CLAUDE.md records from 20 September ("each internally consistent - only
  the union was wrong").
- **One owning session** (GUIDE §6), one hub to mirror, one place for an
  agent to look.

Costs, accepted: a Python-only fix bumps the Swift version too (lockstep,
§3); SwiftPM needs `Package.swift` at the repository root (§2), so the root
is not purely a directory of languages.

Rejected: putting the libraries inside `~/openhamshack` (that repo is
guides, plans and the brand kit; libraries with CI and releases would bury
them), and inside an app repo such as `~/openhamshack-nb` (owned by the NB
session, and the other seven apps would depend on an app).

## 2. Layout of `~/ohs-libs`

```
ohs-libs/
  README.md, LICENSE (GPL-3.0-or-later: D13), CHANGELOG.md, VERSION
  Package.swift                 SwiftPM manifest; must be at the root; targets point into swift/
  spec/
    schemas/                    JSON Schema: well-known, profile, qso, sync push/pull, verdict,
                                pad-actions, pad-layout, bandplan files, error
    vectors/sync/               SYNC.md §8 cases T1-T21
    vectors/bandplan/           profile + signal -> verdict
    vectors/i18n/               formatting and parsing
    vectors/pad/                captured AKP03E reports -> events; event scripts -> lease calls
  data/bandplan/                BANDPLAN-DATA.md §2 (the JSON is the source of truth)
  python/
    shack_client/                 SYNC.md §9.1 (+ shack_client.server helpers)
    shack_bandplan/               BANDPLAN-DATA.md §6.1; data copied in at build from data/
    shack_pad/                    CONTROLLER-PAD.md
    shack_i18n/                   I18N.md: the check, fmt helpers, shack-i18n.js as package data
    shack_rig/                    rig-control library extracted from StationFlow (BETA-PLAN M1)
    (each with its own pyproject.toml and tests/)
  kotlin/                       Gradle multi-project
    shack-client-core/            pure Kotlin/JVM, runs spec/vectors on the JVM
    shack-client-android/         SQLite store, Keystore
    shack-i18n/                   ShackFormat
  swift/
    Sources/ShackClient/, Sources/ShackFormat/
    Tests/
  js/
    shack-i18n.js                 the web catalog loader and fmt (also shipped inside the shack_i18n wheel)
  rust/
    ohsdigi/                     moved from ~/openhamshack-nb/rust/ohsdigi (§2.1)
  tools/
    release.sh                  builds, tests, tags, publishes every artefact (§3)
    export_ohscore.py            one-time conversion of ohscore/ohsradio Python data to JSON
```

Repository hygiene: the hub is `shack:git/ohs-libs.git` like the others
(`hub` remote, as `~/openhamshack`'s). Create it with `git clone --bare` or
fix HEAD afterwards (`git symbolic-ref HEAD refs/heads/main`), and give it
the mirroring hook: both traps fail silently (memory
`bare-repo-head-and-mirror.md`).

### 2.1 ohsdigi moves here

BETA-PLAN M1 makes ohsdigi a wheel every app uses (D13: "ohsdigi as the one
FT8/FT4/JS8 implementation"). It lives in `~/openhamshack-nb/rust` today, in a
repo the NB session owns. Move it with history (`git subtree split` from
`openhamshack-nb`, `git subtree add` here), **after** a `SendMessage` to the NB
session saying so (BETA-PLAN "Ownership"); `openhamshack-nb` then pins the wheel
like every other app. Until the move, `ohs-libs` builds the wheel from a
pinned `openhamshack-nb` commit.

## 3. Versions and artefacts

**Lockstep SemVer for the whole repo.** One version in `VERSION`, one tag
per release, every artefact carrying it: `0.1.0` … during M1-M3, `1.0.0` when
the beta freezes contract version 1. Tags are plain `0.3.1` (SwiftPM reads
tags as versions; whether it also accepts a `v` prefix is **[guess]**, so
none is used). The band-plan data carries its own CalVer `dataVersion`
(BANDPLAN-DATA.md §2), independent of the package version.

| Artefact | Built on | Published to | Consumed by |
|---|---|---|---|
| Python wheels, pure (`shack-client`, `shack-bandplan`, `shack-pad`, `shack-i18n`, `shack-rig`) | `ohs-build` (build-a, user `ohs`: per-user Python only, BETA-PLAN "Build hosts") | a static PEP 503 index, `/srv/shack-index/simple/` on shack, served on the tailnet beside `/srv/openhamshack-apps` **[guess: exact URL set by the builder]** | every Python app, the Dock360 edition |
| `ohsdigi` wheels (native: PyO3) | Linux x86_64/aarch64 and Windows (mingw cross) on `ohs-build`; macOS arm64/x86_64 on the Mac mini (`/Volumes/OpenHamShackBuild`) | same index | apps that decode |
| Kotlin (`com.openhamshack:shack-client-core`, `-android`, `shack-i18n`) | shack (`~/android-toolchain`) | a file Maven repository, `/srv/shack-index/maven/` | Remote (Android, incl. TV) |
| Swift (`ShackClient`, `ShackFormat`) | the Mac mini | the git tag itself (SwiftPM) | Remote (iOS, iPadOS, tvOS) via OpenHamShackKit |
| `shack-i18n.js` | — | inside the `shack-i18n` wheel as package data | web UIs serve it from the installed package; nothing is copied by hand |
| Band-plan JSON | — | inside the `shack-bandplan` wheel | through the library only |

`tools/release.sh <version>` refuses a dirty tree, runs every language's
tests and every vector set, then tags and publishes. Nothing is released
from a worktree whose contents are not committed (CLAUDE.md "Releases").

## 4. How the eight apps depend on it

- **Exact pins with hashes.** Each Python app has `requirements.lock`
  (`shack-client==0.3.1 --hash=sha256:…`), installed with `pip install
  --require-hashes --index-url <ohs index>`. Remote pins exact Maven
  versions and `exact: "0.3.1"` in SwiftPM. No ranges, no "latest".
- **A bump is its own commit**, "Take ohs-libs 0.4.0: …", saying what
  changed for that app. Releasing an app with a new pin means running its
  suite against it.
- **Store images and desktop bundles both build from the lock**, so the
  form a user installs from the store and the one from a download carry the
  same library (BETA-PLAN arch change 3). Store packages carry prebuilt
  images (D12), so a controller never needs the index.
- **Development against an unreleased change:** Python `pip install -e
  ../ohs-libs/python/shack_client` in a venv; Gradle `includeBuild("../ohs-libs/kotlin")`
  behind a `local.properties` switch; SwiftPM `.package(path: "../ohs-libs")`.
  Never committed that way.
- **The Dock360 edition** pins `shack-client` (the merge, HLC and wire models
  it must share with every client) and `shack-bandplan` (the broker's check)
  in its own virtualenv's requirements. A Dock360 release that changes them
  is a platform release.

### 4.1 Each app's repo and its two forms

**Decided by the beta session (BETA-PLAN, "Decisions taken by the beta session")** (it changes PLATFORM-PLAN §1.2's
"each app's server layer lives in its own repo"). BETA-PLAN arch change 3,
"one app codebase, two forms": the store form's
packaging (`store/module.yaml`, `store/Containerfile`, `pad-actions.json`,
`pad-layout.json`) lives **in the app's own repo** beside the desktop
packaging (`packaging/`), so one commit changes both forms. This replaces
GUIDE §1's earlier "server layer in its own `~/dock360-apps-openhamshack-<kind>`
repo pinning the engine by commit", which existed to keep servers out of the
desktop apps; that rule is kept by **process**, not by repo: the store form
runs `<app> --server` in a container, and the Qt desktop app never opens a
listener. (The web-UI apps' desktop form runs their server on loopback for
their own window, as BETA-PLAN arch change 3 allows.)

| Module id | Kind | Product | Repo (today's path) | Desktop form | Owner to check first |
|---|---|---|---|---|---|
| `shack-qo100wb` | `qo100wb` | QO-100 WB | Classic (`appliance/openhamshack.py` + `www/`), archived, no live repo | the console in a native window | ohs-beta; the desktop form (`ohsqo`) is archived too |
| `shack-qo100nb` | `qo100nb` | QO-100 NB | `~/openhamshack-nb` (`ohsnb`) | PyQt6 | the NB session |
| `shack-radio` | `radio` | Radio | `~/openhamshack-nb` (`ohsradio`) | PyQt6 | the NB session (cuts HAM releases) |
| `shack-datv` | `datv` | DATV | `~/openhamshack-datv` (`ohsdatv`) | PyQt6 | check `ListAgents` |
| `shack-atv` | `atv` | ATV (with Teletext) | `~/openhamshack-atv` (Teletext folded in; its own repo is archived) | PyQt6 | check `ListAgents` |
| `shack-icom` | `icom` | Icom | `~/dock360-apps` branch `icom` (`icom/`) | web UI in a native window | ohs-beta; see HANDOVER for open branches |
| `shack-flex` | `flex` | Flex | `~/dock360-apps-flex` | web UI in a native window | check `ListAgents` |
| `shack-digimodes` | `digimodes` | Digital Modes | **new** `~/shack-digimodes` | web UI in a native window | ohs-beta |

Repo renames stay optional for the beta (BETA-PLAN M0); module ids,
product names and desktop ids (§5) are what users see, and are not.

## 5. Ids

| Thing | Scheme | Example |
|---|---|---|
| Store module id | `ohs-<kind>` (fits Dock360's `^[a-z][a-z0-9-]{1,38}[a-z0-9]$`, `manifest.py:28`) | `shack-qo100wb` |
| Kind | the module id without `ohs-` | `qo100wb` |
| Route on the front door | `/<module id>/` (Dock360's default hostname is the module id) | `/shack-icom/` |
| Container, unit | Dock360's own (`dock360-<id>`, `dock360-<id>.service`: `manifest.py` `container_name`, `unit_name`) | `dock360-shack-icom` |
| App version | SemVer per app, independent of the platform and of `ohs-libs` | `shack-icom 1.24.0` |
| Desktop app id (Linux desktop file, macOS bundle id) | `com.openhamshack.<kind>` | `com.openhamshack.qo100nb` |
| Windows AppUserModelID | `OpenHamShack.<Kind>` | `OpenHamShack.Qo100Nb` |
| Desktop executable | `ohs-<kind>` | `shack-radio` |
| Installer file | `OpenHamShack-<Name>-<version>-<os>-<arch>.<ext>` | `OpenHamShack-QO-100-NB-1.0.0-windows-x64.exe` |
| Remote | Android `applicationId` and Apple bundle id `com.openhamshack.remote`; Gradle modules `:core`, `:kind-<kind>`; Swift package `OpenHamShackKit` | `:kind-icom` |
| Device client id | a UUID per installation (REMOTE-API §7 `remote`) | — |
| Python packages | distribution `shack-<name>`, import `shack_<name>` | `shack-bandplan` / `shack_bandplan` |
| Kotlin | group `com.openhamshack`, artefact `ohs-<name>` | `com.openhamshack:shack-client-core` |
| Swift | product `OHS<Name>` | `ShackClient` |

Rules:

- **`ohs-` module ids are first-party.** The edition requires signatures
  (PLATFORM-PLAN §3.1 item 15); it also refuses an `ohs-` id unless the
  package is signed by the OpenHamShack modules key (Dock360's module-only
  key scope: `~/dock360/src/dock360/signing.py` docstring, "Two scopes"), so
  nobody else's package can claim to be an OpenHamShack app.
- **Reserved module ids:** `api`, `ohs`, `internal` (front-door paths:
  CONTROLLER-CONTRACT.md §10).
- Remote's new `applicationId` means today's test builds
  (`com.openhamshack.remote`) install beside it rather than
  upgrading; acceptable because they are test builds only (HANDOVER:
  debug APKs on the tailnet), and the beta has no store users to migrate.
- Engine package names (`ohsnb`, `ohsradio`, `ohscore`, `openhamshacklib`) stay
  until each repo is renamed deliberately (the GUIDE's rename note).

## Identifier prefix (ohs-beta, 09/10/2026)

The brand kit (adopted) forbids the initials OHS in code: identifiers use
`shack` (`shack_client`, `shack-qo100wb`, `shackdev_`, `/api/shack/v1/`). Full
names stay where they read as the product: `_openhamshack._tcp`,
`/.well-known/openhamshack`, `X-OpenHamShack-*`, edition `openhamshack`. The
repo directory `~/ohs-libs`, the `ohs-*` Claude agent types, the `ohs-build`
host and the `ohs-ohsdigi` wheel name are internal and renamed later (the wheel
becomes `shack-ohsdigi` at its next build).
