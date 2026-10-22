# Band plans and licence rules as data: `shack-bandplan`

Status: **design for M1 builders**, 09/10/2026. BETA-PLAN arch change 5:
"band plans and licence rules are data, not code: one shared, versioned
dataset … Seed it with Region 1 + UK in full; leave other regions as clearly
marked partial data, never guessed." Every app's band limits, transmit
checks, presets and default channels come from the station profile
(SERVICES.md §2) plus this dataset. **[guess]** marks the unverified.

## 1. Start from what exists, do not redesign it

Most of this dataset is already written, checked and tested, in Python, in
`~/openhamshack-nb`:

| Today | What it is | Status in its own words |
|---|---|---|
| `ohscore/licences/` | 16 licence regimes: UK (`ofcom.py`) and 15 more (IE, DE, NL, BE, FR, ES, IT, NO, SE, DK, FI, US, CA, AU, NZ), each with a dated, checksummed source | UK "checked line by line" (`docs/ham/licence-check.md`); the 15 "researched on 08/10/2026 … not yet had that second check" (`ohscore/licences/__init__.py` REGIMES comment) |
| `ohscore/licences/__init__.py` docstring and `validate()` | the regime schema and its validator | the contract the regimes obey |
| `ohscore/countries.py` | callsign → DXCC entity → country, region, regime, plan; whole sentences when transmit must stay locked | — |
| `ohsradio/plans/` | RSGB 2026, IARU R1, R2, R3 band plans (160 m to 6 cm), repeater pairs | sourced, each with its pages |
| `ohsradio/guard.py` | the transmit guard: licence (law, always), plan (warn/enforce/off), reserved segments (always) | pure functions |
| `ohsnb/bandplan.py` | the QO-100 narrowband plan (AMSAT-DL), beacons, presets | from `docs/qo100-research.md` |
| `Classic's archived appliance/openhamshacklib/bands.py` | the box's guard: a reduced UK list, the 146 MHz NoV, QO-100 wideband edges and BATC channels | "UK behaviour frozen answer-for-answer by LicenceRegions in test_openhamshack.py" |

**Decision:** `shack-bandplan` is these, converted to JSON with their
semantics unchanged and their sources carried row by row, plus three things
they lack: NoVs as permits (§4.4), the QO-100 wideband plan as data (§5),
and per-app presets (§4.6). The conversion is done by a script from the
Python modules, so the UK transcription that `licence-check.md` verified is
carried exactly, not retyped. After the switch the JSON is the source of
truth and `ohscore/licences`, `ohsradio/plans` and `openhamshacklib/bands.py` are
retired from their apps.

## 2. Files and versions

```
ohs-libs/data/bandplan/
  manifest.json              schema, dataVersion, every file with its sha256
  vocab.json                 mode classes, engine mode -> class, units, segment kinds
  countries.json             ISO country -> regulator, DXCC entities, regimes, plan, region, status
  regimes/<id>.json          one licence regime per file (ofcom-2024.json, fcc-2026.json …)
  plans/<id>.json            band plans (rsgb-2026, iaru-r1, iaru-r2, iaru-r3)
  satellite/<id>.json        qo100-nb.json, qo100-wb.json
  repeaters.json             repeater pairs by plan and country (ohsradio/plans/repeaters.py)
  presets.json               per-app default channels by country or region
  cty/cty.dat                Country Files' cty.dat with its copyright file (ohscore/data/)
```

- **Format:** JSON, UTF-8, frequencies in integer **Hz**, powers in watts,
  dates ISO. Machine-written key order; one row per line so diffs read.
- **`schema`:** an integer, `1`. A reader refuses a schema it does not know
  and keeps its bundled data.
- **`dataVersion`:** CalVer `YYYY.MM.N` (`2026.10.1`), raised on any data
  change, recorded in every verdict (§6) and in `/.well-known/openhamshack`
  (CONTROLLER-CONTRACT.md §3) so a disagreement between two apps names the
  data each used.
- **Distribution:** the data ships **inside** the `shack-bandplan` package
  (Python import `shack_bandplan`; JSON readers for Kotlin and Swift later,
  §8). An update to the data is a library release, pinned by each app
  (REPO-LAYOUT.md §3). No over-the-air data feed in v1: the data is law
  transcribed by hand, and it should arrive the same way code does, signed
  inside an app package.

## 3. Status and `partial`

Every regime, plan and satellite file carries:

```json
"status": "checked",
"partial": false,
"coverage": {"loHz": 135700, "hiHz": 10500000000},
"gaps": []
```

| Field | Meaning |
|---|---|
| `status` | `checked` (verified row by row against the source by a second reading, with the record in a check file), `researched` (transcribed from a cited source, not yet second-checked), `draft` (incomplete transcription) |
| `partial` | `true` when the file does not cover everything its subject governs: bands left out, classes left out, a region's plan that stops at 6 cm. **A partial file never fills its gaps by inference.** |
| `coverage` | the frequency span the file speaks for |
| `gaps` | `[{"loHz", "hiHz", "why"}]`, what is known to be missing inside `coverage` |

How the guard treats them:

- A frequency **outside** a regime's allocations is refused, whether or not
  the regime is partial (the licence's silence is a refusal, as today).
- A frequency in a regime's `gaps`, or a row with `unconfirmed: true`, is
  refused with the dataset's sentence ("… is marked unconfirmed in
  OpenHamShack's data for …": `ohsradio/guard.py` UNCONFIRMED). Never guessed
  open.
- A `researched` regime is used, and every verdict under it carries a
  warning that its data has not been second-checked.
- A country with no regime: transmit stays locked with the sentence saying
  how to unlock it (choose a regime or enter your own licence:
  `ohscore/countries.py` NO_REGIME_IN). Receive always works.

**Seed for the beta (M1 "done when"):** `ofcom-2024` `checked`,
`partial: false`; `rsgb-2026` and `iaru-r1` `partial: false` across every
UK and Region 1 amateur allocation the regime lists. Today's plans stop at
6 cm while `ofcom-2024` runs to 10.5 GHz, so 3 cm must be transcribed from
the plans' cited sources, or the plan files ship `partial: true` with a
`gaps` row and M1 is not done **[verify: what RSGB 2026 and the IARU R1 VHF
Handbook give above 6 cm]**. The 15 other regimes ship as `researched`;
IARU R2 and R3 as `partial: true` above 6 cm.

**Where dataset 2026.10.2 (ohs-libs) stands:** `ofcom-2024` `checked`,
`partial: false`, coverage 135.7 kHz-10.5 GHz. `rsgb-2026` and `iaru-r1` are
`partial: false` from 2200 m to 3 cm: the missing rows (2200 m, 630 m, 3 cm,
and RSGB 13/9/6 cm) were transcribed from the PDFs
(docs/research/BANDPLAN-GAPS.md) into `data/bandplan-overrides/`, which
`tools/export_ohscore.py` applies over the ohscore conversion so a re-export
keeps them. Spans the source prints nothing for are `unplanned` (a
`plan_unplanned` warning, not a gap). RSGB 2 m, 70 cm and 23 cm rows are a
selection from ohsradio, not every PDF row; the space between rows is the plan
saying nothing. No plan is `checked`
(licence-check.md covered RSGB 160 m-10 m, 2 m, 70 cm and 23 cm only). The
15 other regimes are `researched` and also `partial: true` with a
`partialWhy` (their module docstrings list what was left out, such as
Germany's weekend uplift); `partial` changes no answer, the `researched`
warning does the work. `gb-146` is `researched` (beta decision 4).

## 4. Schemas

Every row that states a rule carries `src`: the source key and page, as
today (`"O1 Sch.1 A p.15"`). The validator refuses a row without one.

Values in the examples are copied from the Python modules where a module is
cited (`ofcom.py`, `bands.py`); page numbers and sentences in the IARU and
RSGB plan examples, and the plan warning in §6.2, are **illustrative** and
come from the plan files at conversion time.

### 4.1 `vocab.json`

```json
{
  "schema": 1,
  "modeClasses": ["cw", "ssb", "am", "fm", "digi", "dv", "image", "datv", "atv"],
  "modeClass": {"usb": "ssb", "lsb": "ssb", "cw": "cw", "am": "am", "fm": "fm",
                "ft8": "digi", "ft4": "digi", "q65": "digi", "js8": "digi", "wspr": "digi",
                "psk31": "digi", "rtty": "digi", "hsmodem": "digi", "freedv": "dv",
                "sstv": "image", "dvbs": "datv", "dvbs2": "datv", "pal-am": "atv", "pal-fm": "atv"},
  "units": ["PEP", "mean", "carrier", "ERP", "EIRP"],
  "segmentKinds": ["", "beacon", "satellite", "protected", "output"]
}
```

`ohscore` has seven mode classes; NB's own plan says `digital` where ohscore
says `digi` and files AM under SSB (`ohsnb/bandplan.py` MODE_CLASS). One
vocabulary now, ohscore's, plus two new classes, `datv` and `atv`, because
the DATV and ATV apps transmit wide image modes that a plan's "image"
(SSTV, fax) does not describe. Plans written before them treat `datv` and
`atv` as `image` until a plan row names them **[decision: a builder adds the
ATV/DATV segments of RSGB 2026 and IARU R1 as explicit `datv`/`atv` rows]**.

### 4.2 `countries.json`

```json
[
  {"iso": "GB", "name": "United Kingdom", "regulator": "Ofcom",
   "entities": ["G", "GM", "GM/s", "GW", "GI", "GD", "GJ", "GU"],
   "regimes": ["ofcom-2024"], "plan": "rsgb-2026", "region": 1,
   "src": "Ofcom Amateur Radio Guidance (14 Oct 2025) s.3.4 p.25"}
]
```

`ohscore/countries.py` WRITTEN, one-for-one. An entity no country lists has a
region (from cty.dat) and nothing else.

### 4.3 `regimes/<id>.json`

The `ohscore/licences/__init__.py` docstring, as JSON. Abridged example:

```json
{
  "schema": 1,
  "id": "ofcom-2024",
  "title": "Ofcom amateur licence (2024 conditions)",
  "short": "UK (Ofcom)",
  "authority": "Ofcom",
  "countries": ["GB"],
  "plan": "rsgb-2026",
  "status": "checked", "partial": false,
  "coverage": {"loHz": 135700, "hiHz": 10500000000}, "gaps": [],
  "source": {"key": "O1", "title": "Ofcom OFW611 … Schedule 1", "url": "https://www.ofcom.org.uk/…",
             "version": "Published 21 February 2024 …", "date": "2024-02-21",
             "checked": "2026-10-04", "sha256": "718e8136…baded6"},
  "classes": [{"id": "foundation", "name": "Foundation"},
              {"id": "intermediate", "name": "Intermediate"},
              {"id": "full", "name": "Full"}],
  "edges": "closed",
  "allocations": [
    {"loHz": 1810000, "hiHz": 1830000,
     "limits": {"foundation": [{"watts": 25, "unit": "PEP"}],
                "intermediate": [{"watts": 100, "unit": "PEP"}],
                "full": [{"watts": 1000, "unit": "PEP"}]},
     "note": "primary (no interference basis to non-UK stations)",
     "src": "O1 Sch.1 A p.15, B p.17, C p.20"},
    {"loHz": 2400000000, "hiHz": 2450000000,
     "limits": {"foundation": [{"watts": 2, "unit": "PEP"}],
                "intermediate": [{"watts": 100, "unit": "PEP"}],
                "full": [{"watts": 400, "unit": "PEP"}]},
     "note": "secondary (must accept ISM interference)",
     "src": "O1 Sch.1 A p.16, B p.17, C p.20"}
  ],
  "channelled": [
    {"loHz": 5250000, "hiHz": 5450000, "label": "60 m", "where": "the eleven UK segments",
     "segments": [[5258500, 5264000], [5276000, 5284000]],
     "limits": {"full": [{"watts": 100, "unit": "PEP"}, {"watts": 200, "unit": "EIRP"}]},
     "maxBwHz": 6000, "src": "O1 Sch.1 C p.20, Note G p.23"}
  ],
  "refused": [
    {"loHz": 2350000000, "hiHz": 2390000000,
     "text": "2350-2390 MHz is not in the UK amateur licence", "src": "bandplan-r1-uk.md s.1, gaps"},
    {"loHz": 146000000, "hiHz": 147000000, "permit": "gb-146",
     "text": "146-147 MHz is an innovation band: it needs a Full licence and a Notice of Variation",
     "src": "bandplan-r1-uk.md s.1, innovation bands; licence-check.md s.6"}
  ],
  "permits": [ "… §4.4 …" ],
  "conditions": [
    {"key": "nearLondon", "loHz": 431000000, "hiHz": 432000000,
     "label": "Station within 100 km of Charing Cross", "default": false, "when": true,
     "refuse": "431-432 MHz may not be used within 100 km of Charing Cross (…)",
     "src": "O1 Sch.1 A p.16, B p.17, C p.20"}
  ],
  "satellite": [{"loHz": 2400000000, "hiHz": 2450000000, "direction": "both",
                 "src": "O1 Sch.1 status column"}],
  "emissions": [],
  "cept": {"T/R 61-01": ["full"], "T/R 61-02": ["full"]},
  "ceptSrc": "Ofcom, Amateur Radio Guidance … s.7.1-7.2.1",
  "ceptVisitor": {},
  "notes": [{"topic": "unattended", "text": "Repeaters, beacons and data stations under 25 W ERP no longer need a Notice of Variation.",
             "src": "O1 cond. 6(12-18)"}]
}
```

Rules carried from `ohscore` unchanged (they are what the guard and the
validator rely on):

- Allocation rows never overlap where they apply together (same region,
  overlapping dates): one frequency, one answer.
- A class absent from a row may not transmit there.
- `limits[class]` is a list of limits that all apply; a limit with `modes`
  applies only to those mode classes; when the mode is unknown every limit
  applies and the strictest wins.
- Row extras: `validFrom`/`validTo`, `regions` (IARU regions, for US
  territories), `unconfirmed`, `satelliteOnly` (allowed only as a satellite
  uplink; the row needs a `satellite` entry).
- `refused` rows lie outside every allocation and carry a whole sentence.
- `conditions` default to the restrictive answer unless a decision says
  otherwise (`nearLondon` defaults to no: Brian, 05/10/2026,
  `ofcom.py` CONDITIONS).
- Every sentence is whole, with names put in by format, never assembled
  (`ohscore/countries.py` comment), so a catalog translates it whole
  (I18N.md §3).

US FCC classes are `fcc-2026`'s: `novice`, `technician`, `general`,
`advanced`, `extra` (`ohscore/licences/fcc.py:60`), with Technician's
CW-only HF segments as `emissions` rows.

### 4.4 Permits (Notices of Variation)

New. A permit turns a `refused` range into an allocation for a station that
holds it (the profile's `novs`, SERVICES.md §2.1). OpenHamShack HAM refuses the
UK innovation bands today because "OpenHamShack HAM has no NoV setting yet"
(`ofcom.py` INNOVATION comment); the box allows 146 MHz behind its `nov146`
setting, with a lower top edge in Scotland (`openhamshacklib/bands.py:13-18`).

```json
"permits": [
  {"id": "gb-146", "label": "146-147 MHz Notice of Variation",
   "loHz": 146000000, "hiHz": 147000000,
   "classes": ["full"],
   "limits": null,
   "variants": [
     {"condition": "scotland40km", "when": true, "hiHz": 146937500,
      "text": "In Scotland, and within 40 km of the Scottish border or coast, the 146 MHz NoV stops at 146.9375 MHz"}
   ],
   "status": "researched",
   "src": "Classic's archived appliance/openhamshacklib/bands.py:13-18 (box transcription); the NoV document itself to be cited"}
],
"conditions": [
  {"key": "scotland40km", "label": "Station in Scotland or within 40 km of the Scottish border or coast",
   "default": true, "derive": {"dxccPrefix": ["GM", "GM/s"]}, "src": "as gb-146"}
]
```

- A permit applies when the profile lists its `id`, the class is in
  `classes`, and `validTo` has not passed.
- `limits: null` means the dataset holds no power figure for it: power is
  not judged there, and the verdict says so. It never means "unlimited".
- `variants` narrow the permit when a condition holds. `derive` lets the
  profile's DXCC prefix answer the condition by default (GM is Scotland); an
  operator's explicit answer wins. The default is the restrictive side, as
  the box's own rule (`licence_region`: "anything unrecognised Scotland").
- **[verify]** The 146 MHz NoV's own terms (power, the 40 km rule) must be
  cited from the NoV document before `gb-146` can be `checked`.

### 4.5 `plans/<id>.json`

`ohsradio/plans/base.py`, as JSON: `id`, `title`, `short`, `source`, `region`,
`countries` (`[]` for an IARU plan), `status`, `partial`, `coverage`, optional `unplanned` (spans the source prints nothing for) and `advisories` (warnings that never refuse),
`gaps`, and:

```json
"segments": [
  {"loHz": 144000000, "hiHz": 144002500, "label": "no transmission (EME guard)",
   "modes": null, "kind": "satellite", "maxBwHz": null, "src": "I2 p.38"},
  {"loHz": 144025000, "hiHz": 144110000, "label": "CW", "modes": ["cw"],
   "kind": "", "maxBwHz": 500, "src": "I2 p.38"}
],
"centres": [{"hz": 144300000, "label": "SSB calling", "mode": "usb"}],
"ibp": [14100000, 18110000]
```

`modes: null` is reserved (kind `beacon`, `satellite` or `protected`) and is
refused for everyone; `[]` is "not for transmitting" (a repeater output);
between segments the plan is silent and only the licence applies. A plan is
complete in itself, never a patch on another (`ohsradio/plans/__init__.py`).

### 4.6 `presets.json`

Default channels per app kind, replacing hard-coded lists such as the pad's
`TX_PRESETS = [146.5, 437.0, 1255.0, 2405.25]` and `RX_PRESETS`
(`Classic's archived appliance/pad.py:34-37`):

```json
[
  {"kind": "datv", "country": "GB",
   "presets": [{"label": "2 m NoV DATV", "txHz": 146500000, "permit": "gb-146"},
               {"label": "70 cm DATV", "txHz": 437000000},
               {"label": "23 cm DATV", "txHz": 1255000000}],
   "src": "rsgb-2026 DATV segments"},
  {"kind": "datv", "region": 1, "presets": [ … ], "src": "iaru-r1 …"}
]
```

Most specific wins: country, then region, then `"everywhere": true`
(QO-100's presets). A preset whose `permit` the profile lacks, or that the
class may not use, is shown disabled with the verdict's sentence, never
hidden (the operator learns why).

Found in conversion: the pad's 437.0 MHz DATV preset lies inside
`rsgb-2026`'s 435-438 MHz satellite segment, which the plan reserves (always
refused), so it shows disabled for a UK station. The RSGB plan's own table
says "satellites 435-438 (DATV 437)"; carrying that allowance needs a
decision on how a plan row can permit DATV inside a reserved segment.

## 5. Satellite plans: QO-100

Both transponders are international (AMSAT-DL; BATC for the wideband
channel plan) and apply in every country, on top of the licence: a signal
must be allowed by the licence **as a satellite uplink** (`satellite`
rows, `ohscore/licences satellite_uplink`) **and** fit the satellite plan.

```json
{
  "schema": 1, "id": "qo100-wb", "kind": "satellite",
  "title": "QO-100 wideband transponder", "status": "checked", "partial": false,
  "source": {"key": "BATC", "title": "QO-100 WB Bandplan", "url": "https://wiki.batc.org.uk/QO-100_WB_Bandplan",
             "version": "V3, Feb 2021", "date": "2021-02-01", "checked": "…"},
  "uplinkToDownlinkHz": 8089500000,
  "uplink": {"loHz": 2401000000, "hiHz": 2410000000},
  "segments": [
    {"loHz": 2401000000, "hiHz": 2403000000, "label": "beacon", "modes": null, "kind": "beacon"},
    {"loHz": 2403000000, "hiHz": 2410000000, "label": "users", "modes": ["datv"], "kind": ""}
  ],
  "neighbours": [{"loHz": 2400000000, "hiHz": 2400500000, "label": "QO-100 narrowband transponder"}],
  "edgeRule": "symbolRate",
  "channels": [
    {"srKs": [1000, 1500], "downlinkHz": [10493250000, 10494750000, 10496250000]},
    {"srKs": [500], "downlinkFirstHz": 10492750000, "stepHz": 500000, "count": 9},
    {"srKs": [333, 250], "downlinkFirstHz": 10492750000, "stepHz": 500000, "count": 14},
    {"srKs": [125, 66, 33], "downlinkFirstHz": 10492750000, "stepHz": 250000, "count": 27}
  ],
  "preferred": {"belowKs": 333, "rule": "333 kS and below use the segment above 10497.0 MHz first",
                "aboveDownlinkHz": 10497000000}
}
```

- Values from `openhamshacklib/bands.py:72-158` (`QO100_*`, `qo100_channels`,
  `qo100_blocked`). `edgeRule: symbolRate` records that QO-100's edges are
  judged at the symbol rate, as BATC draws the plan, while licence edges use
  the occupied width (`OCCUPIED_FACTOR = 1.35`): the box's comment explains
  why both are right.
- `qo100-nb.json` carries `ohsnb/bandplan.py`'s segments (in downlink Hz,
  with `uplinkToDownlinkHz`), beacons and presets, `MAX_BW` 2700 Hz.
- Reserved segments (beacons, the broadcast slot) are **always** refused,
  whatever the plan-guard setting.

## 6. Asking "may I transmit?"

### 6.1 Python API (`shack_bandplan`)

Pure functions, no I/O after `load()`, stdlib only.

```python
import shack_bandplan as bp

data = bp.load()                                     # the bundled dataset
ctx = bp.context(profile, data, today="2026-10-09")  # regime, class, permits, conditions, region resolved

v = bp.check(ctx, bp.Signal(
        centre_hz=2_405_250_000,
        occupied_bw_hz=round(333_000 * 1.35),        # licence edges: DVB-S2 occupied width
        plan_bw_hz=333_000,                          # satellite edges: the symbol rate (edgeRule)
        mode="dvbs2",
        power_w=2.0, power_at="antenna", measured=False,
        purpose="satellite-uplink", satellite="qo100-wb"),
    plan_guard="warn")                               # warn | enforce | off (the band plan; law is always enforced)

bp.limits(ctx, 144_000_000, 148_000_000, mode="fm")  # tuning bounds and shading
bp.bands(ctx)                                        # named bands: allowed?, limit, plan
bp.channels(data, "qo100-wb", sr_ks=333)             # [{uplinkHz, downlinkHz, preferred}]
bp.presets(ctx, kind="datv")
bp.in_force(profile, data)                           # regime, class, why-not sentence (ohscore/countries.py in_force)
bp.dvb_occupied_hz(sr_ks)                            # sr × 1.35
```

### 6.2 The verdict

```json
{
  "allowed": false,
  "refusal": {"code": "class_not_allowed",
              "text": "Foundation licence: 1240-1325 MHz is not available to this class",
              "params": {"class": "Foundation", "span": "1240-1325 MHz"},
              "src": "O1 Sch.1 A p.16"},
  "warnings": [],
  "limit": null,
  "segment": null,
  "regime": "ofcom-2024", "class": "foundation",
  "dataVersion": "2026.10.1", "dataStatus": "checked"
}
```

```json
{
  "allowed": true, "refusal": null,
  "warnings": [{"code": "plan_mode", "text": "The RSGB plan keeps 144.150-144.400 MHz for SSB and CW; FM belongs in 145.200-145.5935 MHz",
                "src": "R1 p.20"}],
  "limit": {"watts": 1000, "unit": "PEP", "maxPepAtAntennaW": 1000},
  "segment": {"plan": "rsgb-2026", "label": "SSB, CW, MGM"},
  "regime": "ofcom-2024", "class": "full",
  "dataVersion": "2026.10.1", "dataStatus": "checked"
}
```

Checks, in order (each a refusal unless said): no class / no regime / at sea
(the `ohscore/countries.py` sentences) → both edges of the occupied signal
inside the class's allocations, channelled segments or held permits →
conditions → emissions (mode, bandwidth) → satellite uplink rules when
`purpose` is `satellite-uplink` → the satellite plan (reserved segments, the
user segment's edges at `plan_bw_hz`) → the band plan's reserved segments →
power (refusal only when `measured`; an estimate over the limit is a
warning: Brian, 05/10/2026, `ohsradio/guard.py` docstring) → the band plan's
modes and bandwidths (warning under `warn`, refusal under `enforce`,
nothing under `off`) → a `researched` regime adds a warning.

`code` values: `no_class`, `no_regime`, `no_country`, `at_sea`,
`outside_allocations`, `class_not_allowed`, `edge_above`, `edge_below`,
`unconfirmed`, `refused_range`, `permit_needed`, `condition`, `emission`,
`satellite_not_permitted`, `satellite_reserved`, `satellite_edge`,
`plan_reserved`, `power_measured_over`, `power_estimated_over`,
`plan_mode`, `plan_bandwidth`, `data_researched`, `plan_unplanned` (warning: the source prints nothing there; only the licence was checked), `plan_advice` (warning from a plan `advisories` entry, e.g. 630 m Note-1; never refuses), plus four the
implementation needed (09/10/2026): `power_not_judged` (warning: a permit
with `limits: null`, power was not checked), `plan_gap` (warning: the
signal is in the plan's `gaps`; only the licence was checked),
`satellite_mode` (refusal: QO-100 NB's per-segment mode or bandwidth, or
its 2.7 kHz ceiling) and `satellite_unstated` (warning: a regime with no
`satellite` table says nothing about the satellite service, which OpenHamShack
NB treats as "cannot check", not "refused").

Each refusal and warning object is `{"code", "key", "text", "params",
"src"}`: `key` names the sentence (several sentences share a code, e.g.
`no_regime` for an unwritten country and for no custom segments) so
`translate()` can render it; `key: "data"` means the text is a dataset
sentence and its own msgid. A refused verdict carries `limit: null` and
`segment: null`, except `power_measured_over`, whose limit is the point.
A signal touching a satellite uplink that is not addressed to that
satellite (a terrestrial signal at 2405 MHz) is refused
`satellite_reserved`, as the box refused anything touching the
transponders.

### 6.3 Who calls it

- **The app**, before every key-up (CONTROLLER-CONTRACT.md §6.2 step 3), and
  for its tuning bounds, band menus and presets. Standalone apps do the same
  with their local profile.
- **The broker**, again, on `onair` (CONTROLLER-CONTRACT.md §7.4): same
  profile, its own copy of the library. If the two disagree, the stricter
  wins and both `dataVersion`s appear in the audit line.
- **Clients without the library** (Remote kinds): the controller serves it:
  `GET /api/shack/v1/bandplan/check?centreHz=…&occupiedBwHz=…&mode=…&powerW=…&purpose=…`
  and `GET /api/shack/v1/bandplan/limits?loHz=…&hiHz=…&mode=…` (`view`), with
  the verdict JSON above. A client never decides transmit permission itself;
  the app's server does.

## 7. What changes for the QO-100 WB app (the box's guard)

Moving `openhamshacklib/bands.py` onto the dataset changes answers the box
froze in `LicenceRegions` (`Classic's archived appliance/test_openhamshack.py:2869`),
because the box's UK list is a simplification of the licence `ohscore`
checked:

| Box today | Dataset |
|---|---|
| UK 2310-2450 MHz in one piece | 2350-2390 MHz refused (not in the licence) |
| Every station treated as Full | Foundation 2 W PEP at 2400-2450; Intermediate 100 W; no 23 cm for Foundation |
| 10000-10500 MHz in one piece | 10125-10225 MHz refused |
| `iaru1`: the R1 plan used as a licence | the station country's regime; an R1 country without one is locked until chosen |
| `other`: no band check at all | removed: choose a regime or enter your own licence (`custom`) |
| QO-100 edges and channels in code | the same values from `satellite/qo100-wb.json` |

**Decision:** adopt the dataset's answers (they are the licence; the box's
were a short-cut), regenerate the frozen vectors from the new library, and
list every changed answer in the QO-100 WB app's release notes. The QO-100
guard's answers must not change at all; a test pins them.

## 8. Readers in other languages

The JSON is the contract; the Python package is the first reader. Kotlin
(`com.openhamshack:shack-bandplan`) and Swift (`ShackBandplan`) readers are
**not** needed for the beta, because clients ask the controller (§6.3) and
never transmit by themselves. When written, they run the same conformance
vectors (§9).

## 9. Validation and tests

- `python -m shack_bandplan.validate` ports `ohscore/licences validate()` and
  `ohsradio/plans/base.py validate()` to the JSON, plus: every `permit` sits
  on a `refused` row that names it; every `variants.condition` exists;
  `partial: false` files have empty `gaps`; every file's sha256 matches
  `manifest.json`. CI fails on any problem.
- **Equivalence before retirement:** a grid of frequencies (every band edge
  ±1 kHz and a sample inside) × every class × every mode class × powers,
  through `ohsradio/guard.py licence_check`+`plan_check` and through
  `shack_bandplan.check`: identical allow/refuse, limit and `src`. Only then
  are the Python modules removed from `~/openhamshack-nb`.
- Vectors in `ohs-libs/spec/vectors/bandplan/`: profile + signal →
  verdict code and limit, run by every reader.
- **The beta's country gate** (BETA-PLAN §5 gate 1): at least one app's
  tests switch the profile from `GB` to another country (`DE`, `bnetza-2024`)
  and assert that band limits change (for example 2 m Full 1000 W PEP in the
  UK against the German class A figure from `bnetza.py`).
