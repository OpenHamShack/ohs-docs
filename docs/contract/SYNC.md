# Offline-first sync: logbook and station profile

Status: **design for M1 builders**, 09/10/2026. BETA-PLAN arch change 2:
"every app keeps a local logbook and station profile. When it pairs, it
syncs: each QSO has a UUID, merges are idempotent, and conflicts resolve by
last edit with history kept. Unpairing leaves the local copy complete. A
controller that disappears never stops an app working." This file says how,
for the Python, Kotlin and Swift libraries and the controller's side.
Record shapes are SERVICES.md's. **[guess]** marks the unverified.

## 1. The rules, in one place

1. **Local first.** Every read and write goes to the local store and
   returns. Nothing a person does waits on the network.
2. **State-based merge, per field.** A record is a set of fields; each field
   carries the hybrid logical clock (HLC) of the edit that set it. Merging
   two copies takes, field by field, the value with the greater HLC. The
   merge is commutative, associative and idempotent, so the order and number
   of times copies meet do not matter.
3. **Last edit wins, nothing is lost.** The losing value of a conflict stays
   in the history, marked as lost (SERVICES.md §3.2).
4. **Deletes are tombstones** with their own HLC, and lose to a later edit
   (§5).
5. **The server numbers changes** with a sequence; a client pulls "everything
   since N". The server never rewrites an HLC.
6. **Push is idempotent** by record id (QSO UUID) and op id.
7. **Unpair leaves everything.** Pairing again, with the same or another
   controller, is a full exchange that the merge makes safe.

Why per field rather than per record: two people editing one contact
usually touch different fields (one adds the QSL, the other corrects the
report). Per-record last-edit-wins would throw one away silently. The cost
is one HLC per field, a few dozen bytes per contact.

## 2. The local store

### 2.1 Where

**One store per user per machine, shared by every OpenHamShack app on it**,
so a desktop with QO-100 NB and Radio has one log, not two, and pairs once.

| Platform | Path |
|---|---|
| Linux | `$XDG_DATA_HOME/openhamshack/station.db` (default `~/.local/share/openhamshack/`) |
| Windows | `%LOCALAPPDATA%\OpenHamShack\station.db` (local, not roaming: a roaming profile copying a live SQLite file corrupts it **[guess: worth one test]**) |
| macOS | `~/Library/Application Support/OpenHamShack/station.db` |
| Store app (container) | `/data/shack/station.db` on the app's data volume |
| Android, iOS, tvOS | the app's private storage |

The pairing secret sits beside it in `pairing.json`, mode 0600 (Python, stdlib
only); Android keeps it under an Android Keystore key, Apple in the Keychain.

### 2.2 Schema (SQLite, WAL)

```sql
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,   -- schema_version, store_id, hlc_wall, hlc_count, clock_offset_ms
    value TEXT NOT NULL
);

-- Current merged state, one row per record.
CREATE TABLE records (
    collection  TEXT NOT NULL,          -- 'logbook' | 'profile'
    id          TEXT NOT NULL,          -- QSO uuid, or 'station'
    fields      TEXT NOT NULL,          -- JSON: field -> value (profile: dotted paths, §4.2)
    field_hlc   TEXT NOT NULL,          -- JSON: field -> HLC string
    deleted_hlc TEXT,                   -- tombstone HLC, or NULL
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    origin      TEXT NOT NULL,          -- JSON {app, device, user}
    dirty       INTEGER NOT NULL DEFAULT 0,  -- changed since the last acknowledged push
    PRIMARY KEY (collection, id)
);

-- Every edit made on this machine: the outbox and the local history.
CREATE TABLE ops (
    op_id       TEXT PRIMARY KEY,       -- uuid v4
    collection  TEXT NOT NULL,
    id          TEXT NOT NULL,
    kind        TEXT NOT NULL,          -- create | update | delete
    fields      TEXT NOT NULL,          -- JSON: the fields this edit set (null = cleared)
    hlc         TEXT NOT NULL,
    origin      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    acked_by    TEXT NOT NULL DEFAULT '[]'   -- JSON list of controllerIds that confirmed it
);

-- Where this store is in each controller's change feed.
CREATE TABLE cursors (
    controller_id TEXT PRIMARY KEY,
    epoch         TEXT NOT NULL,
    seq           INTEGER NOT NULL,
    last_sync_at  TEXT
);

-- Query index for the logbook, maintained on every write.
CREATE TABLE qso_index (
    id TEXT PRIMARY KEY, call TEXT, band TEXT, mode TEXT, start TEXT, deleted INTEGER
);
CREATE INDEX qso_by_call  ON qso_index(call, band, mode);
CREATE INDEX qso_by_start ON qso_index(start);

-- Only one process syncs a shared store at a time.
CREATE TABLE sync_lease (one INTEGER PRIMARY KEY CHECK (one = 1), holder TEXT, expires_at REAL);
```

- `store_id` is minted once (`st_` + 12 base32 characters). It is the HLC's
  node part and never changes, paired or not, so HLCs from one machine are
  always distinguishable.
- **Schema changes are additive only** in v1 (new nullable columns, new
  tables). An older app opening a newer store keeps working; it ignores what
  it does not know and passes unknown record fields through untouched (§8
  T19). A non-additive change would need a new file name.
- The Python library (ohs-libs `shack_client.store`) adds three such
  columns the rules above need: `records.extra` (envelope keys a newer
  contract adds, carried through: T19), `records.rev` (bumped by each local
  write, so a push answer clears `dirty` only for the state it confirmed,
  not an edit made while the push was in flight) and `ops.rejected_by` (ops
  a controller refused for good, such as a profile edit without Transmit,
  which must never be pushed again). Every port uses the same names.
- Several processes: WAL plus `busy_timeout = 5000`. A process syncs only
  while it holds `sync_lease` (taken with `BEGIN IMMEDIATE`, 30 s, renewed);
  others skip their sync tick. Processes notice each other's writes by
  polling `PRAGMA data_version` once a second.

## 3. Hybrid logical clocks

### 3.1 Format

```
000001a1202d7194-0003-st_K4M2Q7Z9XW3A
└ wall ms, 16 hex ┘ └ count, 4 hex ┘ └ store_id ┘
```

Plain string comparison orders them: wall time, then count, then node. Two
edits never share an HLC (the node differs, or the count rises). (The
examples in this file and SERVICES.md were corrected on 09/10/2026: the
first draft's `0001928a3c2f1e40` decoded to the year 15995. The wall part
is milliseconds since 1970 in 16 hex digits, so today's stamps begin
`000001a1`.)

### 3.2 Rules (Kulkarni et al., 2014)

`now()` is the corrected wall clock: system time + `clock_offset_ms`, and
never earlier than the library's **clock floor** (its own build date) or the
largest HLC this store has seen.

- **Local edit:** `wall' = max(wall, now())`; `count' = count + 1` if `wall'
  == wall`, else `0`. Stamp the edit `wall'-count'-store_id`.
- **Receive** (any HLC from a pull or push answer): `wall' = max(wall,
  remote.wall, now())`; `count'` per the paper. So after a store has seen an
  edit, everything it does next is later, whatever its clock says.
- **Offset:** when paired, the library measures the controller's clock from
  `time` in `GET /api/shack/v1/` (SERVICES.md §6), takes half the round trip
  as the error, and stores `clock_offset_ms` when the error is under 2 s.
  Standalone, the offset is 0.

### 3.3 Clocks that are wrong

- **Behind** (a Pi with no RTC, a laptop with a dead battery): the floor and
  the receive rule keep its edits after anything it has seen. Edits it makes
  offline with a clock behind lose to genuinely older edits elsewhere; that
  is the price of no central clock, and history keeps both.
- **Ahead:** the controller refuses edits whose wall part is more than **10
  minutes** ahead of its own clock: per-record `{"status": "rejected",
  "code": "clock_ahead", "serverTime": "…"}`. The library then re-measures
  the offset, resets its HLC to the corrected clock, re-stamps its
  **unacknowledged** ops in their original order, and pushes again. A
  future HLC therefore never reaches the controller, where it would beat
  every real edit for days.

## 4. Merge

### 4.1 One record

```
merge(a, b):
  for each field f in a.field_hlc ∪ b.field_hlc:
      take (value, hlc) from whichever side has the greater hlc for f
  deleted_hlc = max(a.deleted_hlc, b.deleted_hlc)        -- NULL is lowest
  created_at  = min(a.created_at, b.created_at)
  origin      = origin of the side with the earlier created_at
                (a tie breaks on the origin's sorted JSON, so the merge stays
                commutative for copies that disagree)
  live        = deleted_hlc is NULL or max(field_hlc) > deleted_hlc
```

The same function, from the same test vectors (§8), runs in the Python,
Kotlin and Swift libraries **and** the controller.

### 4.2 The profile

The profile is one record, `collection: "profile", id: "station"`. Its
fields are the top-level keys of SERVICES.md §2.1, except two maps that are
split into dotted paths so their entries merge independently:

- `conditions.<key>` (`conditions.nearLondon`),
- `controllerMaps.<kind>.<model>` (`controllerMaps.qo100wb.ajazz-akp03e`,
  value the whole `{"pages": […]}` for that app and model).

Everything else (`licence`, `novs`, `antennaGainDbi`) is one field, because
its parts only make sense together (a class without its regime is wrong).

Profile edits pushed by a device without `transmit` anywhere, or by an app
token, are rejected per record (`403 level_too_low`). The library rolls the
local copy back to the controller's on the next pull and reports
`profileRejected` so the app can say "GM4BRI did not accept your change to
the station profile: it needs the Transmit level".

## 5. Deletes

- A delete writes `deleted_hlc = hlc` and leaves the fields.
- **Delete wins** over edits with a lower HLC; **a later edit wins** over the
  delete and brings the contact back, with history showing the delete and
  the edit. Chosen because a log is the one thing in a shack that cannot be
  regenerated (`icom/app/logbook.py` docstring): a contact brought back by a
  later edit is a nuisance; a contact silently lost is not recoverable.
- Deleting again needs a new delete, whose HLC is above every field's.
- Tombstones are kept for ever in v1 (a large log is tens of thousands of
  rows; pruning would need every replica to have seen the delete, which a
  laptop in a drawer may never confirm).
- Lists, exports and lookups skip deleted records; history and sync do not.

## 6. The wire protocol

All under `/api/shack/v1/sync/` (device token, or app token for store apps).

### 6.1 Push

```http
POST /api/shack/v1/sync/push
{"storeId": "st_K4M2Q7Z9XW3A",
 "records": [
   {"collection": "logbook", "id": "01927c4e-6b1a-7cc2-8a3b-5d2c1e0f9a77",
    "fields": {"call": "DL1ABC", "start": "2026-10-09T10:12:30Z", "rst_rcvd": "57"},
    "fieldHlc": {"call": "000001a1202666b0-0000-st_K4M2Q7Z9XW3A",
                 "start": "000001a1202666b0-0000-st_K4M2Q7Z9XW3A",
                 "rst_rcvd": "000001a1202d7194-0000-st_K4M2Q7Z9XW3A"},
    "deletedHlc": null, "createdAt": "2026-10-09T10:13:46.002Z",
    "origin": {"app": "shack-qo100nb", "device": "dev_K4M2Q7Z9XW3A", "user": "brian"}}
 ],
 "ops": [
   {"opId": "a2c9d1e0-…", "collection": "logbook", "id": "01927c4e-…",
    "kind": "update", "hlc": "000001a1202d7194-0000-st_K4M2Q7Z9XW3A",
    "fields": {"rst_rcvd": "57"},
    "origin": {"app": "shack-qo100nb", "device": "dev_K4M2Q7Z9XW3A", "user": "brian"}}
 ]}
```

`200`:

```json
{"controllerId": "7f3c2a9e-…", "epoch": "e_3",
 "records": [{"collection": "logbook", "id": "01927c4e-…", "status": "merged", "seq": 1841, "lost": []}],
 "ops": {"accepted": ["a2c9d1e0-…"], "duplicate": []}}
```

- `records` are states (dirty rows); the server merges each with §4.1.
  `status`: `merged` (something changed), `unchanged` (it already had all of
  it), `rejected` (+ `code`).
- `ops` feed the history; the server keeps each `opId` once. An op without a
  matching state is ignored (the state is the truth; ops are the story).
- A batch is at most 500 records; the library pages larger pushes. The
  controller applies a batch in one transaction with a savepoint per record
  (ohs-libs `shack_client.controller`), so a dropped connection leaves
  nothing half-applied and resending the batch is harmless (§8 T13). One
  commit per batch, not per record: one fsync per record made a
  10,000-contact first sync take a minute on a disk.
- `lost` (here and in SERVICES.md §3.2 history) is arrival order: the
  fields an arriving edit set that an edit with a greater HLC *from another
  store* had already set. A greater stamp from the edit's own store is that
  store's next edit, not a conflict. Without causality tracking the
  controller cannot tell a concurrent loser that arrived first from a
  superseded value, so only the late arrival is marked (§8 T4's vector is
  written that way).
- The library clears `dirty` and adds the controller to `acked_by` only for
  what the answer confirms.

### 6.2 Pull

```http
GET /api/shack/v1/sync/pull?since=1800&epoch=e_3&limit=500&collections=logbook,profile
```

```json
{"controllerId": "7f3c2a9e-…", "epoch": "e_3", "latestSeq": 1841,
 "records": [ {"collection": "logbook", "id": "…", "seq": 1841,
               "fields": {…}, "fieldHlc": {…}, "deletedHlc": null,
               "createdAt": "…", "origin": {…}} ],
 "next": 1841, "more": false}
```

- Records with `seq > since`, in `seq` order, each at its current state.
  `next` is the cursor to store **after** merging the page. A record changed
  again while a client pages is simply sent again later (§8 T16).
- **Epoch.** The controller mints a new `epoch` when its services database
  is created or restored from a backup (the restore path calls it). A pull
  whose `epoch` differs, or whose `since` exceeds `latestSeq`, answers
  `409 {"code": "epoch_changed", "epoch": "e_4"}`; the library drops its
  cursor, pushes every record, and pulls from 0 (§8 T15).

### 6.3 A sync round

1. Take `sync_lease`. 2. Measure the clock offset (once per pairing, then
hourly). 3. Push dirty records and unacknowledged ops. 4. Pull until `more`
is false, merging each record locally (receive rule, §3.2, for every HLC
seen). 5. Store the cursor. 6. Release the lease.

Triggers: a local write (debounced 2 s), every 60 s while paired, on
`GET /api/shack/v1/sync/stream` (server-sent `{"seq": N}` events) when the
client holds it open, and on reconnect. Failures back off 1 s, 2 s, 4 s … to
5 min. Request timeout 10 s; nothing in the UI path waits for any of it.

## 7. Pairing, unpairing, re-pairing

- **Pair** (CONTROLLER-CONTRACT.md §4) with a controller this store has
  never synced with: if the controller's logbook is empty, this store's
  logbook is empty, or the controller's station callsign (its
  `/.well-known/openhamshack` `station.callsign`, else its synced profile)
  matches the local profile's, the library does a full exchange
  (push everything, pull from 0), which the merge makes a union. Otherwise
  it returns `needsDecision` and the app asks:
  - **Merge** this computer's log and the controller's (the default when the
    callsigns match);
  - **Use the controller's log**: the local store is first archived
    (`station-<date>.db` and an `.adi` export beside it), then replaced by a
    pull from 0.
  There is no third "keep two logs" choice in v1: one store is one station.
- A first exchange with a controller marks every local record dirty: records
  another controller confirmed are not dirty, but this one lacks them (§8
  T11). A controller this store has synced with before (remembered in
  `meta.synced_with`) needs no decision on re-pairing, even after unpairing
  dropped its cursor (§8 T1).
- **Unpair:** delete `pairing.json` and that controller's cursor. Records,
  ops and history stay exactly as they are; the app goes on logging.
- **Re-pair** with the same controller: as a first pairing; nothing is
  duplicated because records are keyed by UUID and merged.
- **The controller disappears** (switched off, Wi-Fi gone, being updated):
  sync reports `offline` and backs off; the app does not change behaviour.

Status, for every app to show the same way:

```json
{"state": "idle", "controller": "GM4BRI", "lastSyncAt": "2026-10-09T10:20:11Z",
 "pendingRecords": 0, "error": ""}
```

`state` is `unpaired`, `idle`, `syncing`, `offline`, `error` (with `error`
a sentence), or `needsDecision`.

## 8. Test cases every implementation must pass

The cases live as language-neutral vectors in `ohs-libs/spec/vectors/sync/`
(REPO-LAYOUT.md §2): replicas, their clocks, a script of edits and syncs,
and the expected final states and history. The Python, Kotlin and Swift
libraries and the controller's merge run the same files.

| # | Case | Expected |
|---|---|---|
| T1 | Two stores add different QSOs offline, then sync | both stores and the controller hold both |
| T2 | The same push sent 3 times; overlapping pull pages | identical state; each op once in history |
| T3 | Concurrent edits to different fields of one QSO | both edits kept |
| T4 | Concurrent edits to one field | the greater HLC wins everywhere; the other is in history with `lost` |
| T5 | Delete with a greater HLC than an edit | deleted everywhere |
| T6 | Edit with a greater HLC than a delete | live, with the edit; history shows both |
| T7 | Store A's clock 2 h slow edits after pulling B's value | A's edit wins (receive rule) |
| T8 | Store's clock 2 days fast | `clock_ahead`; offset re-measured, unacked ops re-stamped; no future HLC on the controller; final state correct |
| T9 | Store's clock reads 1970 | HLCs at or above the clock floor |
| T10 | Unpair | every record still present and equal; adding a QSO works; no network request is made |
| T11 | Re-pair to a different controller, same callsign | union of both logs; a UUID on both merges per field |
| T12 | Re-pair to a different controller, "use the controller's log" | local equals the controller's; the archive `.db` and `.adi` exist |
| T13 | Connection dropped after the server applied a push, before the answer | retry is harmless: no duplicates, same final state |
| T14 | Controller unreachable (packets dropped) | adding a QSO returns in under 50 ms |
| T15 | Controller restored from a backup (new epoch) | client detects it, re-pushes; nothing lost on either side |
| T16 | 10,000 records pulled in pages while another store keeps writing | no record missed; all converge |
| T17 | Profile: A sets `conditions.nearLondon`, B sets `controllerMaps.qo100wb.ajazz-akp03e` | both kept |
| T18 | Two processes writing one store | no write lost; only one syncs at a time |
| T19 | A record with fields this library does not know | kept and pushed back unchanged |
| T20 | Delete on A; B offline 30 days, then syncs | B sees it deleted |
| T21 | Profile edit from a device without `transmit` | rejected; local copy rolled back on the next pull; `profileRejected` reported |

## 9. Library shapes

Same concepts and names in all three; each idiomatic for its language. No
library call that a UI makes ever does network I/O on the caller's thread.

### 9.1 Python: `shack_client`

Distribution `shack-client`, import `shack_client`, Python 3.11+ (build-a has
3.11, Debian 13 3.13), **stdlib only** in the core so Qt apps, servers and
PyInstaller bundles take it without baggage. Discovery is the optional extra
`shack-client[discovery]` (python-zeroconf, LGPL-2.1, GPL-3 compatible).

```python
from shack_client import Station, discover

station = Station.open(app="shack-qo100nb", app_version="1.0.0")     # per-user path, §2.1
station = Station.open(app="shack-qo100nb", app_version="1.0.0", path="/data/shack/station.db")

profile = station.profile.get()                  # dict, SERVICES.md §2.1 shape
station.profile.update({"locator": "IO75RL"})

qso = station.logbook.add({"call": "DL1ABC", "start": "2026-10-09T10:12:30Z",
                           "freq_hz": 2400250000, "mode": "SSB", "submode": "USB"})
station.logbook.update(qso.uuid, {"rst_rcvd": "57"})
station.logbook.delete(qso.uuid)
rows = station.logbook.query(call="DL1ABC", band="13cm", limit=50)
station.logbook.worked_before("DL1ABC", band="13cm", mode="SSB")
station.logbook.history(qso.uuid)
text = station.logbook.export_adif()
report = station.logbook.import_adif(data)

station.on_change(lambda collection, ids: ...)   # local or synced changes, any process

found = discover(timeout=3.0)                    # [Controller(name, id, url, kinds)]
result = station.pair("http://198.51.100.208/", "brian", "…", totp=None,
                      device_name="Shack laptop")          # Pairing | NeedsDecision
station.resolve(result, choice="merge")          # or "use-controller"
station.sync.status()                            # §7 status dict
station.sync.now()                               # ask for a round; returns at once
station.unpair()
station.close()
```

Server-side helpers in the same package, for app servers in store mode:

```python
from shack_client.server import identity, PlatformClient
who = identity(request.headers, os.environ["DOCK360_SHACK_PROXY_SECRET"])   # None if not via the proxy
platform = PlatformClient.from_env()            # DOCK360_SHACK_URL / DOCK360_SHACK_TOKEN
claim = platform.broker.claim("pluto-1", mode="tx", acting_device=who.device)
platform.spots.post([...]); platform.revocations.watch(close_streams_for)
```

### 9.2 Kotlin: `com.openhamshack:shack-client`

Two artefacts: `shack-client-core` (pure Kotlin/JVM: HLC, merge, models, wire
protocol with kotlinx.serialization; runs the vectors on the JVM in CI) and
`shack-client-android` (the SQLite store on `android.database.sqlite`, Keystore
for the token). minSdk 28 (the Fire TV is Android 9: GUIDE §4). No Google
Play services.

```kotlin
val station = ShackStation.open(context, app = "remote")
station.profile.state: StateFlow<Profile>
station.profile.update(mapOf("locator" to "IO75RL"))
val qso: Qso = station.logbook.add(QsoFields(call = "DL1ABC", start = Instant.now(), freqHz = 2_400_250_000))
station.logbook.observe(LogQuery(call = "DL1ABC")): Flow<List<Qso>>
station.pairing.pair(baseUrl, username, password, totp = null, deviceName = "Tab S9"): PairResult
station.pairing.pairTv(baseUrl, deviceName = "Fire TV"): Flow<TvPairState>   // Code(…) → Approved | Denied | Expired
station.sync.state: StateFlow<SyncStatus>
station.unpair()
```

### 9.3 Swift: `ShackClient`

Swift package product `ShackClient` (iOS 16, tvOS 16, macOS 13 **[guess:
match the Remote targets when the iOS split happens]**), SQLite through the
system `SQLite3` module, no third-party dependency. An `actor` owns the
store; observation is `AsyncStream`. Used by OpenHamShackKit (GUIDE §3
item 5).

```swift
let station = try await Station.open(app: "remote")
let profile = await station.profile.current
try await station.profile.update(["locator": "IO75RL"])
let qso = try await station.logbook.add(QSOFields(call: "DL1ABC", start: .now, freqHz: 2_400_250_000))
for await rows in station.logbook.observe(LogQuery(call: "DL1ABC")) { … }
let result = try await station.pairing.pair(baseURL, username: "brian", password: "…", deviceName: "iPad")
for await state in station.pairing.pairTV(baseURL, deviceName: "Apple TV") { … }
for await status in station.sync.status { … }
try await station.unpair()
```

## 10. The controller's side

- Tables in `services.db`: `records` (as §2.2 plus `seq INTEGER`, indexed),
  `ops` (as §2.2 plus `received_at`, `received_seq`, `lost TEXT`), `meta`
  (`epoch`, `latest_seq`). Every merge that changes a record takes the next
  `seq` in the same transaction.
- The controller's own writes (an edit in its web UI, an app token's QSO)
  are stamped with the controller's HLC, node `ctl_<first 12 of
  controllerId>`.
- `GET /api/shack/v1/sync/stream` sends `{"seq": N}` on each change, so a
  paired app pulls within a second instead of a minute.
- Store apps on the controller use `shack_client` with their own local store
  on their data volume, syncing to `dock360-host` like any desktop. One code
  path, and a platform update (when the services are briefly down) never
  stops an app logging.
