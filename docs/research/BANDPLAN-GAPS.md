# Band-plan gaps: 3 cm, 2200 m, 630 m, and the 13/9/6 cm check (researched 09/10/2026)

Transcribed from the source PDFs (text layer and page images). Apply to
`~/ohs-libs/data/bandplan` through the export's source data, not by hand-editing
generated files.

Sources:
- **R1** RSGB 2026: https://rsgb.services/public/bandplans/docs/260125_rsgb_band_plan_2026.pdf
  (sha256 ea57433369857cc69be4dccc0fbb085ddcf1e8c16b5e2364bd96c2e1af773c83; PDF page numbers).
  Each band has its own effective date: p.6 2200 m 2022; p.7 630 m 2024; pp.25,27,28 2024; p.26 9 cm 2021.
- **I1** IARU R1 HF plan (eff. 16 Oct 2020): https://www.iaru-r1.org/wp-content/uploads/2021/06/hf_r1_bandplan.pdf
  (sha256 8deb428d565ce79a173d773ff2c0226201c09f0afbb2e46ef1a68729840835cf). Not checked for 2023/2026 changes.
- **I2** IARU R1 VHF Handbook v10.03, §7.10 printed p.51: https://www.iaru-r1.org/wp-content/uploads/2026/02/VHF_Handbook_V10_03_final.pdf
  (sha256 147190bd1295cd9050dd735f7d8088f9dbeb1a30c228784fb91b611428caf631).

## Rows: rsgb-2026

```json
{"loHz":135700,"hiHz":137800,"label":"CW, QRSS and narrow-band digital","modes":["cw","digi"],"kind":"","maxBwHz":200,"src":"R1 p.6"}
{"loHz":472000,"hiHz":479000,"label":"CW, QRSS and narrow-band digital","modes":["cw","digi"],"kind":"","maxBwHz":500,"src":"R1 p.7"}
{"loHz":10000000000,"hiHz":10125000000,"label":"all modes (Note-4: Primary User restrictions); 10065 ATV repeater outputs","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10225000000,"hiHz":10250000000,"label":"all modes; 10240 ATV repeaters","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10250000000,"hiHz":10350000000,"label":"digital modes","modes":["digi"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10350000000,"hiHz":10368000000,"label":"all modes; wideband 10352.5-10368 (Note-2: wideband FM preferred 10350-10400)","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10368000000,"hiHz":10368750000,"label":"narrow band (centre of activity 10368.1)","modes":["cw","digi","ssb"],"kind":"","maxBwHz":2700,"src":"R1 p.28"}
{"loHz":10368750000,"hiHz":10368800000,"label":"local beacons, 10 W erp max","modes":null,"kind":"beacon","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10368800000,"hiHz":10368995000,"label":"propagation beacons only","modes":null,"kind":"beacon","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10370000000,"hiHz":10450000000,"label":"all modes; 10371 voice repeater RX, 10425 ATV repeaters","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
{"loHz":10450000000,"hiHz":10452000000,"label":"alternative narrow band (Note-3); unattended 10400-10475","modes":["cw","digi","ssb"],"kind":"","maxBwHz":2700,"src":"R1 p.28"}
{"loHz":10452000000,"hiHz":10475000000,"label":"all modes and satellites; unattended 10400-10475; 10471 voice repeater TX","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"R1 p.28"}
```
The existing 10475-10500 satellites-only row stays. Not printed in the source, so
declare as gaps: 10125-10225 MHz (no UK row; nb doc says unavailable) and
10368.995-10370. Licence notes: 2200 m 1 W erp secondary; 630 m 5 W eirp, Full
only, secondary. 630 m Note-1 recommends 472-475 CW only at 200 Hz (a
recommendation; the table row is 472-479 at 500 Hz) - session decision: keep the
table row, add the note as a warning, not a refusal.

## Rows: iaru-r1

```json
{"loHz":135700,"hiHz":137800,"label":"CW, QRSS and narrow band digital modes","modes":["cw","digi"],"kind":"","maxBwHz":200,"src":"I1 p.1"}
{"loHz":472000,"hiHz":475000,"label":"CW","modes":["cw"],"kind":"","maxBwHz":200,"src":"I1 p.1"}
{"loHz":475000,"hiHz":479000,"label":"narrow band modes: CW, digimodes (500 Hz suggested)","modes":["cw","digi"],"kind":"","maxBwHz":null,"src":"I1 p.1"}
{"loHz":10000000000,"hiHz":10150000000,"label":"MGM","modes":["digi"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10150000000,"hiHz":10250000000,"label":"all modes","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10250000000,"hiHz":10350000000,"label":"MGM","modes":["digi"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10350000000,"hiHz":10368000000,"label":"all modes","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10368000000,"hiHz":10368800000,"label":"all modes; narrow band centre of activity 10368.2; 10368.750-10368.800 local beacon","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":2700,"src":"I2 p.51"}
{"loHz":10368800000,"hiHz":10368990000,"label":"beacons only","modes":null,"kind":"beacon","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10369000000,"hiHz":10370000000,"label":"all modes","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10370000000,"hiHz":10450000000,"label":"all modes","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10450000000,"hiHz":10452000000,"label":"narrow band modes where 10368-10370 is not available","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
{"loHz":10452000000,"hiHz":10500000000,"label":"all modes; amateur satellite service","modes":["am","cw","digi","dv","fm","image","ssb"],"kind":"","maxBwHz":null,"src":"I2 p.51"}
```
Gap as printed: 10368.990-10369.000. 630 m is "proposed usage" (VA14_C4_Rec_02).
IARU 10 GHz footnote letters are inconsistent in the source (no footnote d).

## rsgb-2026 13/9/6 cm against the source (existing rows came from the nb doc)

- **13 cm (p.25):** 2321-2322 FM/DV `maxBwHz` is **20000, not 25000** (fix). Missing:
  2310.000-2310.500 repeater links 200 kHz; 2311-2315 high speed data; 2322-2350
  wideband incl. data and ATV; 2390-2400 all modes; 2400-2450 satellites (ATV
  repeater outputs 2435, 2440; Note 3: 2433-2443 ATV if no satellite uses it);
  sub-features 2320.000-.025 EME, 2320.200 SSB centre, 2320.750-.800 local
  beacons 10 W erp.
- **9 cm (p.26):** missing 3401-3402 data/remote control 200 kHz; 3402-3410
  wideband incl. DATV repeater outputs; 3400.750-.800 local beacons; 3400.100
  centre. (Source's IARU column misprints 3400-3401 beside 200 kHz; UK column
  taken.)
- **6 cm (p.27):** narrow row modes should include EME wording ("CW, SSB, MGM,
  EME"). Missing: 5650-5668 all modes, satellite Earth-to-space only; 5668-5670
  2.7 kHz alt narrowband (centre 5668.2); 5670-5680 all modes; 5755-5760 all
  modes; 5760.750-.800 local beacons; 5760.800-.995 propagation beacons;
  5762-5765 all modes; 5820-5830 all modes; 5830-5850 satellite space-to-Earth only.
- The plan declares no 13 cm gap, so its coverage is overstated until these land.
