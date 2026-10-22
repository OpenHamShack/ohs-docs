# The OpenHamShack contract (version 1)

Design documents for the M1/M2 builders (BETA-PLAN.md). They make
PLATFORM-PLAN §1.3, §1.4 and §2 concrete under BETA-PLAN's architecture;
where they differ from PLATFORM-PLAN they are later and win, and BETA-PLAN
wins over them. **[guess]** marks anything not verified in code or on a
binary; **[needs Brian]** marks a recommendation that changes something he
decided.

| Document | What it fixes |
|---|---|
| [CONTROLLER-CONTRACT.md](CONTROLLER-CONTRACT.md) | Discovery (`_openhamshack._tcp`, legacy `_openhamshack._tcp`), `/.well-known/openhamshack`, pairing and `shackdev_` device tokens, levels and identity through `forward_auth`, the per-app TX lease, the broker claim API, manifest additions, errors |
| [SERVICES.md](SERVICES.md) | Station profile, logbook (ADIF-named QSO fields), callsign lookup, spots, under `/api/shack/v1/` |
| [SYNC.md](SYNC.md) | Offline-first sync: the local SQLite store, HLCs, per-field merge, tombstones, push/pull, pairing and re-pairing, 21 test cases, Python/Kotlin/Swift shapes |
| [BANDPLAN-DATA.md](BANDPLAN-DATA.md) | `shack-bandplan`: ohscore's regimes and ohsradio's plans as JSON, permits (NoVs), QO-100 plans, `partial` marking, the "may I transmit?" check |
| [CONTROLLER-PAD.md](CONTROLLER-PAD.md) | `shack_pad`: AKP03E and keypads for every app, action declarations, remaps in the profile, platform routing and desktop hand-over, PTT through the lease |
| [I18N.md](I18N.md) | String catalogs per platform, the `shack-i18n-check` literal check and its allow-list, locale formatting of frequencies and the rest |
| [REPO-LAYOUT.md](REPO-LAYOUT.md) | `~/ohs-libs` monorepo, pinned dependencies, module and app ids |

Change a contract document first, in the same commit as the code that
follows it (GUIDE §3 item 1).
