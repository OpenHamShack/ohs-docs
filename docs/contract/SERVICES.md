# Shared platform services, API version 1

Status: **design for M1 builders**, 09/10/2026. The services PLATFORM-PLAN
§1.4 names (station profile, one logbook, callsign lookup, spots/activity),
as HTTP APIs on the controller under `/api/shack/v1/`, and the shapes every
app and `shack_client` use for them when there is no controller at all.
Transport, credentials, levels and errors are CONTROLLER-CONTRACT.md's; how
local copies stay in step is SYNC.md's. **[guess]** marks the unverified.

## 1. Common rules

- **Base:** `/api/shack/v1/` on the front door for devices (`Authorization:
  Bearer shackdev_…`), and `$DOCK360_SHACK_URL` (`http://dock360-host:8800/api/shack/v1`)
  for store apps (`Bearer shackapp_…`, plus `X-OpenHamShack-Acting-Device`
  when acting for a person): CONTROLLER-CONTRACT.md §5.4.
- **Levels:** the services are platform-wide, not per app, so they use the
  device's highest level across apps, capped by its `maxLevel`: read needs
  `view`; writing a QSO needs `control`; editing the station profile needs
  `transmit` on at least one app (it changes what may be transmitted);
  service settings (the lookup credential, spot feeders) need admin. An app
  token may read everything and write QSOs and spots; it may not edit the
  profile.
- **Versioning:** `v1` is additive-only. A field a client does not know is
  kept and sent back untouched, never dropped (the logbook's ADIF
  pass-through depends on it). A breaking change is `/api/shack/v2/`, served
  beside v1 for at least one platform release.
- **Times:** ISO 8601 UTC with `Z`, milliseconds optional
  (`2026-10-09T10:15:02.120Z`). Frequencies are integer **Hz** on the wire;
  formatting is the client's (I18N.md §4).
- **Errors:** CONTROLLER-CONTRACT.md §9.
- **Storage on the controller:** `/var/lib/dock360/shack/services.db`
  (SQLite, WAL), its own migrations, in Dock360's backups.
- **Standalone:** every service except spots feeders and the shared lookup
  credential works on a desktop with no controller, through `shack_client`'s
  local store (SYNC.md §2). The HTTP API below is what it syncs with when
  paired.

## 2. Station profile

One profile per station (per controller), synced to every paired app.
PLATFORM-PLAN §1.1 ("callsign, locator, licence region and NoV held once")
and BETA-PLAN arch change 5, with the fields today's apps already keep:
`ohscore/countries.py` (`callsign`, `stationCountry`, `licence`,
`licenceClass`, `customLicence`, `stationConditions`) and the box's
`licenceRegion`/`nov146` (`Classic's archived appliance/openhamshacklib/bands.py:40-63`).

### 2.1 Schema

```json
{
  "schema": 1,
  "callsign": "GM4BRI",
  "operatorName": "Brian",
  "locator": "IO75RL",
  "country": "GB",
  "dxccPrefix": "GM",
  "iaruRegion": 1,
  "licence": {"regime": "auto", "class": "full", "custom": []},
  "novs": [
    {"id": "gb-146", "reference": "NoV 123456", "validTo": "2027-10-31"}
  ],
  "conditions": {"nearLondon": false, "scotland40km": true},
  "antennaGainDbi": {"2m": 6.0, "13cm": 22.0},
  "units": "metric",
  "timeDisplay": "utc",
  "controllerMaps": {
    "qo100wb": {"ajazz-akp03e": {"pages": [{"K1": {"press": "transmit"}}]}}
  },
  "pskReporter": false,
  "updatedAt": "2026-10-09T10:15:02.120Z"
}
```

| Field | Type | Rule |
|---|---|---|
| `callsign` | string | normalised upper case, `/` allowed (`EA8/GM4BRI`); empty until set. Empty caps every level at `control` (CONTROLLER-CONTRACT.md §5.1). |
| `operatorName` | string | optional, ≤ 60 chars |
| `locator` | string | Maidenhead, 4, 6 or 8 characters, normalised `IO75rl` → `IO75RL` (as `icom/app/grid.py normalise_locator`) |
| `country` | string | ISO 3166-1 alpha-2. Derived from the callsign's location part through cty.dat by default (`ohscore/countries.py station()`); stored explicitly once the operator confirms or overrides it |
| `dxccPrefix` | string | the DXCC entity's primary prefix (`GM`), derived; distinguishes Scotland from England inside `GB` |
| `iaruRegion` | 1 \| 2 \| 3 | derived from the entity (`ohscore/countries.py region_of`), overridable |
| `licence.regime` | string | `auto` (the country's default regime), a regime id from the dataset (`ofcom-2024`), or `custom` |
| `licence.class` | string | a class id of that regime (`foundation`, `intermediate`, `full`; `technician`, `general`, `extra`); empty locks transmit (the guard's NO_CLASS rule, `ohsradio/guard.py`) |
| `licence.custom` | list | the operator's own segments when `regime` is `custom`, shape of `ohscore/licences clean_custom()` |
| `novs[]` | list | Notices of Variation and permits held: `id` is a dataset permit id (BANDPLAN-DATA.md §4.4), `reference` and `validTo` optional. An expired one stops counting on `validTo`. |
| `conditions` | map | yes/no answers to the regime's conditions (`ohscore/licences condition_answers`); an unanswered one takes the dataset default |
| `antennaGainDbi` | map | band → dBi, for ERP/EIRP limits (`ohsradio/guard.py power_in`) |
| `units` | `metric` \| `imperial` | distance display; default from locale, `imperial` only for `US`, `LR`, `MM` |
| `timeDisplay` | `utc` \| `local` | how apps show clock times; logs are always stored UTC |
| `controllerMaps` | map | kind → pad model → `{"pages": [...]}` (CONTROLLER-PAD.md §5) |
| `pskReporter` | bool | report this station's decodes to PSK Reporter (§5.4) |

Credentials are **not** in the profile (QRZ, LoTW, cluster logins): they
stay in the service that uses them and are never synced to a device.

### 2.2 API

```http
GET   /api/shack/v1/profile                -> 200 the profile, plus "derived" (below)
PATCH /api/shack/v1/profile                -> 200 the profile
```

`PATCH` takes a partial object; each top-level key, and each key inside
`conditions` and `controllerMaps.<kind>.<model>`, is one field for
last-edit-wins (SYNC.md §4). The body may carry `"hlc"` (SYNC.md §3); the
controller stamps one if it is absent.

`GET` adds read-only `derived`, computed from the profile and the dataset:

```json
"derived": {
  "entity": "Scotland", "regimeId": "ofcom-2024",
  "regimeShort": "UK (Ofcom)", "className": "Full",
  "canTransmit": true, "why": "",
  "bandplanDataVersion": "2026.10.1"
}
```

`why` is the dataset's whole sentence when `canTransmit` is false (no class,
no regime for the country, at sea: `ohscore/countries.py` NO_* sentences).

## 3. Logbook

**One logbook per station** (PLATFORM-PLAN §1.4 rule: "an app never keeps
its own logbook"). Every app writes to it through `shack_client`, which keeps
a local replica and syncs (SYNC.md).

### 3.1 The QSO record

The envelope is camelCase; the **fields are ADIF**, lower-case ADIF 3.1.4
field names, so import and export are lossless and every field has a home
in other people's software (Icom's rule: "a field that cannot be exported
is a field that will be lost", `icom/app/logbook.py` docstring).

```json
{
  "uuid": "01927c4e-6b1a-7cc2-8a3b-5d2c1e0f9a77",
  "fields": {
    "call": "DL1ABC",
    "start": "2026-10-09T10:12:30Z",
    "end": "2026-10-09T10:13:45Z",
    "band": "13cm",
    "band_rx": "3cm",
    "freq_hz": 2400250000,
    "freq_rx_hz": 10489750000,
    "mode": "SSB",
    "submode": "USB",
    "rst_sent": "59", "rst_rcvd": "57",
    "gridsquare": "JO62", "name": "Hans",
    "prop_mode": "SAT", "sat_name": "QO-100",
    "tx_pwr": "10",
    "station_callsign": "GM4BRI", "operator": "GM4BRI",
    "my_gridsquare": "IO75RL",
    "comment": "First QSO through the new controller",
    "qsl_sent": "N", "qsl_rcvd": "N",
    "app_shack_grid_source": "decode"
  },
  "createdAt": "2026-10-09T10:13:46.002Z",
  "updatedAt": "2026-10-09T10:20:11.540Z",
  "origin": {"app": "shack-qo100nb", "device": "dev_K4M2Q7Z9XW3A", "user": "brian"},
  "deleted": false,
  "hlc": "000001a1202d7194-0000-st_K4M2Q7Z9XW3A"
}
```

Field rules:

| Field | Rule |
|---|---|
| `uuid` | RFC 9562 UUID, lower case. Clients generate **v7** (time-ordered, good for indexes) where they can; any version is accepted. Minted once, on the device that logged the contact; never reused. |
| ADIF fields | lower-case ADIF names, string values in ADIF's own formats (`qsl_sent: "Y"`, `band: "2m"`). Any ADIF field is accepted and kept, known or not. |
| `start`, `end` | the four exceptions to ADIF names: ISO UTC timestamps replacing `QSO_DATE`+`TIME_ON` and `QSO_DATE_OFF`+`TIME_OFF`. `end` only when really known (Icom's rule, `logbook.py` FIELDS comment). |
| `freq_hz`, `freq_rx_hz` | integers in Hz replacing `FREQ` and `FREQ_RX` (ADIF's MHz decimals lose nothing at 6 places, but integer Hz removes a parse in every client) |
| `mode`, `submode` | ADIF's enumeration as the pair: FT4 is `MFSK`/`FT4`, JS8 `MFSK`/`JS8` (Icom's `ADIF_MODES`, `icom/app/logbook.py:83-103`). NB's map (`ohscore/logbook.py` ADIF_MODE) differs for Q65 and JS8; the shared library settles on ADIF 3.1.4's enumeration and both apps move to it. |
| `app_shack_*` | OpenHamShack's own fields, using ADIF's `APP_<PROGRAMID>_<NAME>` form so they survive a round trip through other loggers: `app_shack_grid_source` (`decode`, `lookup`, `operator`), `app_shack_decode_snr`, `app_shack_contest_serial`. |
| `createdAt` | when the contact was first stored (any device), set once |
| `updatedAt` | wall time of the last edit, display only; ordering uses `hlc` |
| `origin` | the app, device and user that **created** it; never changes. Edits carry their own origin in the history. |
| `deleted` | tombstone; the record stays, without being exported or listed (SYNC.md §5) |
| `hlc` | the hybrid logical clock of the last edit (SYNC.md §3) |

Required to store a QSO: `call` and `start`. Everything else is optional
(a contact typed in from memory may have no frequency).

Duplicate detection is advice, not a rule: same `call`, `band`, `mode`
within 300 s is "probably the same contact" (`icom/app/logbook.py
DUPLICATE_WINDOW`). The API reports it; it never refuses or merges two UUIDs
by itself. Merging two records is an explicit edit (delete one, edit the
other), so it syncs like any other edit.

### 3.2 API

```http
GET    /api/shack/v1/logbook/qsos?call=DL1ABC&band=13cm&mode=SSB&from=…&to=…&limit=100&cursor=…
GET    /api/shack/v1/logbook/qsos/{uuid}
POST   /api/shack/v1/logbook/qsos                  {"uuid": …, "fields": {…}, "hlc": …}
PATCH  /api/shack/v1/logbook/qsos/{uuid}           {"fields": {"rst_rcvd": "55"}, "hlc": …}
DELETE /api/shack/v1/logbook/qsos/{uuid}?hlc=…
GET    /api/shack/v1/logbook/qsos/{uuid}/history
GET    /api/shack/v1/logbook/worked?call=DL1ABC&band=13cm&mode=SSB
GET    /api/shack/v1/logbook/stats
GET    /api/shack/v1/logbook/export.adi?from=…&to=…    (text/plain; ADIF 3.1.4)
POST   /api/shack/v1/logbook/import                (body: an .adi file)
```

- The list answers `{"qsos": [...], "cursor": "100" | null, "total": 412}`,
  newest first; `cursor` is null on the last page; `total` counts all
  matches, not the page (as built, 09/10/2026).
- `worked` answers whether this call has been worked, band and mode
  optional, and carries the matching contacts (as built, 09/10/2026):
  `{"call": "DL1ABC", "band": "13cm", "mode": "SSB", "worked": true,
  "count": 3, "qsos": [...]}` (`qsos` as in the list, capped at the list's
  maximum page).
- `POST` is **idempotent by `uuid`**: posting the same record again is `200`
  with the stored record, not a second contact. A first store is `201`. The
  response carries `"duplicateOf": ["uuid", …]` when §3.1's advice applies.
- `PATCH` merges fields with last-edit-wins per field (SYNC.md §4). Setting a
  field to `null` clears it (that is an edit with its own HLC).
- `DELETE` writes a tombstone; it is an edit too, and can lose to a later
  edit (SYNC.md §5).
- These are the same operations as SYNC.md's push, one at a time, for apps
  and clients that do not keep a replica (Remote's view-only kinds).
- `history` lists every edit ever applied, oldest first:

```json
{"uuid": "01927c4e-…", "edits": [
  {"opId": "6f1d…", "hlc": "000001a12026…", "kind": "create", "fields": {"call": "DL1ABC", "…": "…"},
   "origin": {"app": "shack-qo100nb", "device": "dev_K4M2…", "user": "brian"}, "receivedAt": "…"},
  {"opId": "a2c9…", "hlc": "000001a1202d…", "kind": "update", "fields": {"rst_rcvd": "57"},
   "origin": {"app": "remote", "device": "dev_P8D1…", "user": "brian"}, "receivedAt": "…",
   "lost": []}
]}
```

`lost` names fields this edit set that a later-HLC edit had already set
(it arrived late and lost), so nothing an operator typed vanishes without a
trace.

- `import` parses ADIF (`icom/app/adif.py` is the parser to lift), maps
  through §3.3, gives each record a fresh v7 UUID unless it carries
  `app_shack_uuid`, and reports duplicates rather than skipping them silently:
  `{"added": 412, "duplicates": [{"line": 37, "of": "uuid"}], "errors": []}`.
- `export.adi` writes `app_shack_uuid` on every record, so a file exported
  here and imported elsewhere (another controller, a standalone app) is the
  same contacts, not copies.

### 3.3 ADIF mapping

Stored field ↔ ADIF, where they are not simply upper-cased:

| Stored | ADIF |
|---|---|
| `start` | `QSO_DATE` (YYYYMMDD) + `TIME_ON` (HHMMSS) |
| `end` | `QSO_DATE_OFF` + `TIME_OFF` (written only together; a file with `TIME_OFF` and no `QSO_DATE_OFF` ends on the start date: `icom/app/logbook.py adif_to_record`) |
| `freq_hz` | `FREQ` = MHz, 6 decimals |
| `freq_rx_hz` | `FREQ_RX` = MHz, 6 decimals |
| `uuid` | `APP_SHACK_UUID` |
| `origin.app` | `APP_SHACK_ORIGIN` |
| anything else | the field name upper-cased (`rst_sent` ↔ `RST_SENT`, `my_gridsquare` ↔ `MY_GRIDSQUARE`) |

Export header: `ADIF_VER 3.1.4`, `PROGRAMID OpenHamShack`, `PROGRAMVERSION`
the platform's or app's version. The NB/Radio and Icom logs today use
different field names (NB `rstSent`, `dl`, `t`; Icom snake_case with
`grid`, `notes`, `my_grid`); each app's first-run migration converts its old
log into this schema once, through this table, keeping the old file.

## 4. Callsign lookup

One credential and one cache per station (PLATFORM-PLAN §1.4). Built from
`icom/app/qrz.py`, whose rules carry over: credentials never leave the
service, a lookup is never made just because a station was decoded, and
contact details QRZ returns (email, phone, street address) are **not** kept.

```http
GET /api/shack/v1/lookup/DL1ABC?fresh=0
```

```json
{"callsign": "DL1ABC", "found": true, "source": "qrz", "cached": true,
 "fetchedAt": "2026-10-08T19:02:11Z",
 "name": "Hans Muster", "qth": "Bayern, Germany", "country": "Germany",
 "dxcc": "230", "cqz": "14", "ituz": "28", "gridsquare": "JO62",
 "lat": 52.5, "lon": 13.4, "geoloc": "user",
 "positionNote": "The operator gave this position themselves.",
 "positionUncertaintyKm": 1.0,
 "licenceClass": "A", "qslVia": "", "url": "https://www.qrz.com/db/DL1ABC"}
```

- `fresh=1` asks for a live lookup (`control` level; rate limited to 1/s
  per station, 500/day **[guess: QRZ's limits are not documented to us]**).
- Not found: `200 {"callsign": …, "found": false, "cached": true}`; negative
  answers are cached 24 h, positive ones 30 days.
- No credential configured (as built, 09/10/2026): the answer comes from `cty.dat` (country,
  DXCC, zones; no name or QTH) with `"source": "cty"` instead of a 503;
  cached answers are still served. `lookup_not_configured` stays for
  `fresh=1`.
  ```json
  {"callsign": "DL1ABC", "found": true, "source": "cty", "cached": false,
   "country": "Germany", "dxcc": "230", "cqz": "14", "ituz": "28"}
  ```
- The cache is shared: a lookup by any app or device is free to all others.
- Settings (admin): `PUT /api/shack/v1/lookup/settings {"provider": "qrz",
  "username": "…", "password": "…"}` → `204`; `GET` returns `{"provider":
  "qrz", "configured": true, "status": "ok"}`, never the credential.
  Credentials are stored encrypted with Dock360's module key
  (`security.encrypt_secret`, as `alerts.py` stores tokens).
- Providers: `qrz` in v1. HamQTH and callbook fall-backs are later.

**Standalone apps** keep the same cache schema locally and may hold their
own credential; when paired they use the controller's and leave theirs
unused (one credential per station, not one per app).

## 5. Spots and activity

What is being heard and spotted now, by any app or feed, visible to all
(PLATFORM-PLAN §1.4: "a decode heard by one app is visible to all"). In
memory, like `icom/app/spots.py`: **nothing is stored**; a spot is not a
contact.

### 5.1 The spot

```json
{
  "id": "sp_01927c4e7a12",
  "source": "decode",
  "heardAt": "2026-10-09T10:15:00Z",
  "call": "DL1ABC",
  "freqHz": 10489540750,
  "mode": "FT8",
  "snrDb": -12,
  "gridsquare": "JO62",
  "message": "CQ DL1ABC JO62",
  "spotter": "GM4BRI",
  "app": "shack-qo100nb",
  "band": "3cm",
  "extra": {}
}
```

`source` is one of `decode` (an app heard it here), `cluster` (DX cluster),
`pskreporter` (heard elsewhere, from PSK Reporter), `batc` (the BATC
wideband spectrum's station list), `rbn` later. `extra` carries
source-specific fields (BATC: `symbolRateKs`, `dbAboveNoise`; cluster: the
spot comment) and is passed through untouched.

### 5.2 API

```http
GET  /api/shack/v1/spots?since=…&band=3cm&mode=FT8&source=decode,cluster&limit=500
GET  /api/shack/v1/spots/stream?band=…            (text/event-stream: one "spot" event per spot)
POST /api/shack/v1/spots   {"spots": [ … up to 200 … ]}      (app token or control device)
GET  /api/shack/v1/spots/stations?band=…          (one row per call: best position, last report, age)
```

- Retention 30 min, ceiling 5000 spots, oldest out first (Icom's KEEP_S and
  MAX_SPOTS reasoning, `icom/app/spots.py:35-44`, scaled for several apps).
- `stations` is Icom's map view (one entry per station), using cached
  lookups only, never live ones.
- An app posts its decodes in batches each period. `id` is the server's.

### 5.3 Feeders (on the controller)

| Feeder | Default | Notes |
|---|---|---|
| Decodes from apps | on | apps post them (§5.2) |
| DX cluster | **off** | admin sets host, port, login callsign; one telnet session per station; spots in |
| PSK Reporter (reception reports of this station, in) | **off** | **[guess]** via its public query interface; polled no faster than its published guidance |
| BATC wideband | owned by the QO-100 WB app | "the box polls BATC; clients never do" (GUIDE §2). The app keeps polling and posts what it sees here, so other apps never poll BATC. |

### 5.4 Reporting this station's decodes out

When `pskReporter` is on in the profile, the **controller** uploads every
app's decodes once, as one reporter, deduplicated by call+band+mode per
5 minutes (`ohscore/pskreporter.py` is the uploader to lift). A paired app
stops uploading on its own, so a decode heard by two apps is never reported
twice. A standalone app uploads by itself, as today.

## 6. Service discovery and health

```http
GET /api/shack/v1/                       -> 200
{"services": {"profile": 1, "logbook": 1, "lookup": 1, "spots": 1, "sync": 1, "broker": 1, "bandplan": 1},
 "controllerId": "7f3c…", "time": "2026-10-09T10:15:02Z"}
```

(as built, 09/10/2026): the map lists only services that answer, and the controller does not
serve `bandplan` in v1 (apps use the `shack_bandplan` package), so the
example's `bandplan` entry is absent from it. When served, `bandplan` is the
check-and-limits endpoint for clients without the
library (BANDPLAN-DATA.md §6.3). The same `services` map appears in `/.well-known/openhamshack`
(CONTROLLER-CONTRACT.md §3). A client uses `time` to measure its clock
offset (SYNC.md §3.2).

## 7. Tests the services must carry

1. A QSO posted twice with one UUID is one QSO; posted with two UUIDs, two
   QSOs and a `duplicateOf` hint.
2. ADIF round trip: import a WSJT-X file and an Icom export, export again;
   every field present before is present after, with the same value;
   `MFSK`/`FT4` stays a pair.
3. A `view` device cannot `POST` a QSO; an app token can; nobody without
   `transmit` can `PATCH` the profile.
4. The lookup never returns a credential, and a decode never triggers a
   live lookup.
5. A paired app's decode reaches `spots/stream` for another device within
   one second; nothing about spots survives a restart.
6. History: an edit that lost to a later one is listed with `lost` naming
   its fields.
