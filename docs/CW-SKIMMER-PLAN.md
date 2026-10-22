# CW Skimmer for OpenHamShack Radio: plan

Status: **plan only, 13/10/2026.** Nothing here is built. Brian's brief:
"do it the way CW Skimmer does it and isolate the whole CW portion of the
band and decode them simultaneously". Receive only.

Citations are `repo:path:line` at these commits unless a line says
otherwise: openhamshack-nb `hub/main` d5e6c3b (Release HAM 0.1.19),
openhamshack-remote `main` 162ec8b, ohs-libs `hub/main` 373333d, the CW
accuracy work on ohs-libs `feature/cw-decode-accuracy` (hub d4f459d, and
14de87f, which is still local to shack's `~/wt/cw-decode-accuracy-ohs-libs`).
In Remote paths, `A/` stands for
`android/app/src/main/java/com/openhamshack/remote/`.
Anything marked **guess** was not measured or read.

## 0. Summary

- **One filter bank, many decoders.** The engine already FFTs the wide IQ
  once per frame and cuts every channel from that spectrum
  (openhamshack-nb `ohscore/dsp/bank.py:1-23`). The skimmer adds **one** channel
  per CW segment (20 m: 14.000-14.070 at 96 kS/s). That is the only work
  on the receive thread. A worker then runs a 5 ms short-time FFT over the
  segment. That one transform serves detection, tracking, rejecting
  carriers, and the front end of every decoder. Each signal gets one
  `shack_cw.Decoder`, driven through `feed_frames`, which is the decoder
  without its front end and is what the CW accuracy session built for
  this. The decoder itself is not redesigned.
- **Measured cost** (ohs-dev, Xeon E5-2687W v4 VM; §2): about 2 % of a
  core for the front end over the whole segment, plus about 0.26 % of a
  core per decoded signal. At the proposed default of 64 channels that is
  about a fifth of one core. ohs-box has about 4.9 of its 6 cores idle.
- **It runs in a worker process on the box**, not a thread. Each decoder
  is a Python loop over frames that holds the GIL, and Radio's receive
  thread lives in the same process.
- **Results go on two new event kinds**, `cwskim` (the channels, a
  snapshot each second) and `cwspot` (spots, as they happen), plus
  `GET api/cwskim` for the first fill. **Never on `events`**: today's
  Remote and desktop CW strips would print every channel interleaved
  (`A/shack/ShackProtocol.kt:270`, `ohscore/ui/panels/text.py:169-180`).
- **Spots work the way CW Skimmer and the RBN describe them:** a call
  validated by its shape and its country prefix; repeated hits before a
  spot; busted variants suppressed; tagged CQ, DX or BEACON; SNR given as
  key-on dB in 500 Hz, which is the RBN's convention.
- **Phases.**
  1. MVP: the shared core in ohs-libs, Radio's store server, and the
     Remote CW Activity view on Android.
  2. The desktop views.
  3. Refinements: platform spots, the call history, NB's and Flex's IQ,
     contest tuning.
- Decisions for Brian are in §10.

## 1. Front end: from wide IQ to one channel per signal

### 1.1 What exists, and the choice

Radio's receive thread reads about 75 ms at a time
(`ohscore/engine.py:233`, `BLOCK_HOPS = 5`). It pushes the samples through
the analysis bank (`bank.py:79-100`): an N = fs/50-point FFT per 20 ms
frame, giving 50 Hz bins and 48 000 points at 2.4 MS/s. It then cuts the
VFO, zoom and app channels from the bank's spectra
(`engine.py:1288-1360`). Each app gets a hook after the demodulator,
`_rx_monitor(X, starts, t_stream)` (`engine.py:1354`, empty at `:1673`),
which Radio does not yet override. NB already runs a whole-band skimmer
off the same hook: `ohsnb/radio.py:688-691` hands the spectra by
reference to a queue, and a worker does the rest (`ohsnb/skimmer.py:1-24`).
That worker drops blocks when it falls behind, and never stalls receive.

Options considered:

| Option | Verdict |
|---|---|
| A polyphase channeliser over the full 2.4 MS/s | No. The bank already is the analysis filter bank (overlap-save, `bank.py:5-12`). A second one over 2.4 MS/s doubles the costliest step in receive (PERF.md: the forward FFT is 31 % of the receive path). |
| One bank `Channel` per signal on the receive thread | No. That is cheap in itself (0.5 % of a core for 64 channels, measured, §2), but births and deaths are decided in the worker. Channel churn would then need a feedback path into the receive thread, and the Python per signal would run there. |
| **One `Channel` per CW segment on the receive thread, then a 5 ms STFT filter bank over the segment in the worker** | **Chosen.** The receive thread pays one small inverse FFT per frame (N/D = 1920 bins at D = 25, 2.4 MS/s). The worker gets a plain complex stream at 96 kS/s (768 kB/s). It is the same stream on a box, on a desktop, and when replayed from a recording (§7). |

### 1.2 The segment

- **Where the CW segment comes from.** Radio's plan in force
  (`planInUse`), using the `ohsradio/plans` modules that the scope's strip
  draws. Rows are `Seg(lo, hi, label, modes, max_bw, kind)`
  (`ohsradio/plans/base.py:58-65`). Take the rows whose `modes == {"cw"}` in
  the band holding the receive dial (`ohsradio/bands.py` `band_at`), and
  merge the adjacent ones.
  - IARU R1 and RSGB 2026 give 80 m 3500-3570, 40 m 7000-7040 and 20 m
    14000-14070 kHz (`ohsradio/plans/iaru_r1.py:96,101-104,113,121-122`,
    `rsgb_2026.py:57,64,67`).
  - Do not reach for `shack_bandplan` here. The guard judges with it, the
    strip draws `ohsradio/plans`, and ohs-libs' conformance test keeps the two
    equal (GUIDE §5). The skimmer reads what the operator sees.
  - **Fallback:** a band whose plan has no CW-only rows (R2/R3 rows are
    unchecked, **guess**) uses the lowest rows that allow CW, up to
    100 kHz from the band edge. Status then says so in a sentence.
- **Channel rate.** The smallest bank output at or above
  (segment width + 4 kHz) / 0.84. The bank's cutoff above 24 kHz is
  0.42 × rate (`bank.py:72-77`). The rate must divide the bank geometry,
  and D must divide gcd(N, L) (`bank.py:46-55`).
  - At 2.4 MS/s that gives D = 25 (96 kS/s) for 70 kHz segments, D = 50
    (48 kS/s) for 40 m, and D = 20 (120 kS/s) for a 100 kHz fallback.
  - The centre is the segment's middle. The channel is re-placed every
    block from `self._off(centre)`, because Radio's receiver centre moves
    (`ohsradio/radio.py:613-621`, `_rx_done` at `:669-679`).
  - Each block carries a `generation` counter that changes whenever the
    centre or the converter changes, and the worker restarts its tracks on
    a change, as NB's JUMP_HZ does (`ohsnb/dsp/skim.py`, constants).

### 1.3 When the segment is outside the wide span

- **The common case is fine.** Radio's span is `centre ± 0.46 · fs/2`
  (`ohsradio/radio.py:77,619-621`). A band that fits whole sits on one side of
  DC, with DC 15 kHz below the band's lower edge (`plan_centre`,
  `:108-121`). At the SDRplay's 2.4 MS/s that covers ±552 kHz. **Every HF
  band from 160 m to 12 m fits whole**, so wherever the dial is in the
  band, the CW segment is in view and clear of the DC spur.
- **10 m** (1.7 MHz) and the HL2 at 192 kS/s follow the dial instead
  (`c = dial - fs/8`). The segment can then be partly or wholly out of
  view. Example (**guess**, from the formula): an HL2 with the dial at
  14.025 sees 13.957-14.045, so 14.000-14.045 is covered.
- **Rules:**
  1. The skimmer **never retunes the receiver.** The operator owns the
     dial, and on a box other people may be listening.
  2. It skims the overlap of segment and span, less 3 kHz at each edge.
     Status is `partial`, with the covered `lo`/`hi`.
  3. With no overlap, status is `outside`, with a sentence naming both
     ranges. The worker idles and holds no decoders.
  4. When the dial changes band, the segment follows the new band; tracks
     and spots of the old band are kept for their 30 minutes, labelled
     with their band.
  5. A ±500 Hz notch round DC is treated as a birdie whenever DC falls
     inside the segment (10 m, the HL2).
  6. Phase 3 offers **"Skim this band's CW"**, an ordinary tune by the
     operator (`api/set`, Control) to a dial that puts the segment in view.
     Never an automatic retune.

### 1.4 The worker's filter bank (STFT), detection and tracking

All of this is numpy over the whole segment at once. Per-signal Python
happens only in the decoders and the call matcher.

1. **STFT, matched to the decoder's frames.** The hop is 5 ms
   (`Decoder.FRAME_S`); the window is a Hann two frames long (10 ms),
   exactly the decoder's own front end
   (`shack_cw/decoder.py` `_feed`, 14de87f:240-296); the FFT is
   zero-padded to 4096 at 96 kS/s, giving 23.4 Hz bins. One complex
   spectrum per frame, 200 a second.
2. **Detection spectrum.** Power per bin, kept for the last 4 s.
   - Every 0.5 s, per bin: the 90th percentile (key-down level), the 25th
     (key-up) and the median.
   - The floor is the 10th percentile in 2 kHz blocks, as NB's skimmer
     does it, because the floor is not flat across a segment (`FLOOR_PCT`).
   - A candidate is a local maximum of p90 that is at least the birth
     threshold over the floor and has a 2-bin valley against any stronger
     neighbour.
   - Its frequency comes from parabolic interpolation of three bins.
     **Guess:** a few hertz at 10 dB SNR. The synthetic test measures it
     (§7).
3. **Birth.** A candidate seen in two consecutive passes (1 s) becomes a
   track with a stable `id`.
4. **Tracking and drift.** Each pass matches candidates to tracks:
   strongest first, nearest within ±35 Hz (1.5 bins). A matched track's
   frequency moves by an exponential average of the interpolated peaks.
   A signal drifting across bins is followed continuously, because a
   track is a frequency, not a bin.
5. **Merging.** Two tracks within 30 Hz of each other for 3 s are one
   station split by keying sidebands or chirp. The younger is folded into
   the older: its id goes, and the older keeps its text and call.
6. **Death.** Under the threshold for 20 s, a track is `quiet`: kept and
   listed, and its decoder stops being fed. At 120 s it is forgotten.
   These are NB's QUIET_S and FORGET_S.
7. **Carriers and birdies.** The keying index is p90/p25 in dB.
   - Keyed CW stands well over 6 dB. A steady carrier stands under 2 dB.
   - A track whose index stays under 3 dB for 10 s is `carrier`: listed
     on the scope layer, and given no decoder.
   - One that holds within ±5 Hz for 10 minutes joins a per-device,
     per-band birdie list in the app's data folder. Those frequencies are
     never offered a decoder again until the list is cleared.
   - NCDXF/IARU beacons are not birdies. They key, and they are spotted
     `BEACON` (§3).
8. **Decoder pool.** Channels go to tracks in order of SNR, up to
   `cwSkimMax`. A new track stronger than the weakest decoded one takes
   that channel, but only after it has outranked it for 5 s, so that
   decoders do not thrash. A track losing its channel keeps its text.

### 1.5 Driving the decoders (the interface with the CW accuracy work)

`Decoder.feed_frames(tone, quiet, loud)` (ohs-libs 14de87f, decoder.py
around `:300-325`) takes three amplitudes per 5 ms frame:

- the tone;
- the median of the three noise references on the quieter side;
- the same on the louder side, for the click test.

It returns the same events as `feed()`. It costs about 1.2 ms of CPU per
second per channel on shack, per the commit message, or 2.6 ms on ohs-dev
measured with `bench.backend_us`. The skimmer builds those three numbers
from the STFT:

- The tone sits at the track's frequency f, and the six references sit
  at f ±125/175/225 Hz (`_ref_off`). Each is taken from its nearest bin,
  at most 11.7 Hz away. A 10 ms Hann loses about 0.03 dB there.
- Each value is de-rotated by its residual offset and by the bin's
  frame-to-frame phase. Without that, the coherent window turns, and the
  window is m frames, up to 8 (`m = round(0.25 · dot / FRAME_S)`).
- Then come the coherent window, the moving average, and the quiet/loud
  medians.

**Requests to the CW accuracy session** (the decoder stays theirs):

1. Push and merge 14de87f (`feed_frames`, the `snr` property) and
   e335801 (`polarity=False`; Radio passes False on HF).
2. Factor the step from per-frame complex sums to tone/quiet/loud
   (coherent window m, moving average, side medians) into one pure
   function that `feed()` calls too. For example
   `shack_cw.amplitudes(c[frames, 7], m, hist) -> (tone, quiet, loud, hist)`,
   plus a public `Decoder.window_frames` (m). The skimmer then runs the
   same arithmetic vectorised over channels, grouped by m, and the bench
   still measures what the skimmer runs. Without it the skimmer carries a
   copy, and the copy will drift.
3. Keep the per-instance state small and `reset()` cheap. The pool
   creates and drops decoders all the time.
4. Open: in a contest, both reference sides of a weak signal may hold
   neighbours 150-250 Hz away. The skimmer could pass the band floor from
   its detection spectrum as a lower bound for `quiet`. That changes what
   the learnt ratio means, so it is their call. The pileup clip (§7)
   decides it.

With the decoder's own AFC off (`afc=False`), the tracker steers the
frequency. AFC's ±100 Hz would pull two decoders onto one strong
station in a pileup.

## 2. The decoder pool: channels, CPU, process

### 2.1 Measured

Measured 13/10/2026 with the scripts in this session's scratchpad. They
used the decoder at the accuracy branch's d4f459d and 14de87f.

| What | ohs-dev (Xeon E5-2687W v4 @ 3.0 GHz, VM) |
|---|---|
| `Decoder.feed()` at 4 kHz audio, the whole decoder with its own front end | 0.79 % of a core per channel (signal), 0.73 % (noise) |
| `Decoder.feed()` at 12 kHz | 0.88 % / 0.80 % |
| `feed_frames` alone (`bench.backend_us`, 120 s) | 2.6 ms/s = **0.26 % per channel** (the CW session measured 1.2 ms/s on shack) |
| STFT front end on a 96 kS/s segment (5 ms hop, 4096-point, gather K × 7 bins) | **1.7 % (64 ch), 1.8 % (128), 2.1 % (256)** |
| Cutting K bank channels at 4 kHz from 2.4 MS/s, vectorised (the rejected option) | 0.28 % (32), 0.50 % (64), 0.94 % (128) |

So the worker costs about **2 % + 0.26 % × channels** of one ohs-dev
core, plus tracking and call matching. **Guess:** that extra is under 3 %
at 64 channels. The receive thread adds one 96 kS/s channel. **Guess:**
0.2-0.3 % of a core at 2.4 MS/s, scaled from PERF.md's "24 % of 3.1 % for
five channels at 1.2 MS/s".

### 2.2 ohs-box

- **Hardware** (read 13/10 08:22): Intel Core i5-9400T, 6 cores, 6
  threads, max 3.4 GHz; 31 GiB RAM, 29 GiB available; load average 1.37.
- **Containers** (`podman stats --interval 6`; lifetime averages in
  brackets):

  | Container | Now | Lifetime |
  |---|---|---|
  | shack-radio | 43-46 % | 46 % |
  | shack-qo100nb | 39-41 % | |
  | shack-flex | 14 % | |
  | shack-qo100wb | 2 % | |
  | shack-icom | 3 % | |

  Total: about **1.05 cores of 6 in use; about 4.9 idle.**
- **Inside shack-radio** (`podman top`): `python3 -m ohsradio --server`
  31 %, `sdrplay_apiService` 15 %. It was on 3.650 LSB, then mode CW, at
  2.4 MS/s, so it already runs one CW decoder.
- **Radio's container limits:** `cpu_quota: 200%`, `memory_high: 768M`,
  `memory_max: 1G`, `pids_max: 512`
  (openhamshack-nb `store/radio/module.yaml:147-150`). It uses 210 MB today.

**Budget.** The i5-9400T's single-core speed is close to or above ohs-dev's
(**guess:** it was not benchmarked on the box, which was read-only for
this plan). Taking ohs-dev's figures:

| Channels | Worker CPU (guess for the box) | Radio container total |
|---|---|---|
| 32 | ~13 % | ~60 % |
| **64 (proposed default)** | **~22 %** | **~70 %** |
| 128 | ~37 % | ~85 % |
| 256 (proposed hard cap) | ~70 % | ~120 % |

Every row is inside the 200 % quota and the box's idle capacity. The
worker adds about 80-120 MB (numpy plus 256 decoders; **guess**), still
under `memory_high`. One process cannot use more than one core for the
decoders, because of the GIL. Past 256 channels, Phase 3 shards the pool
over a second process.

How many signals there are (**guess**, from operating experience): 20 m
CW on an ordinary evening has 15-40; a CW contest weekend has 150-300 in
70 kHz. A default of 64 covers everything except contests. The pool
always keeps the strongest. A self-limit like NB's `skimBudget` drops the
weakest channels if the worker's own CPU passes its share
(`cwSkimCpu` in status).

### 2.3 Process, not thread (box)

- **The problem.** Today everything in the engine is threads, relying on
  numpy releasing the GIL (`docs/PERF.md:36-38`). The decoders' frame loop
  is plain Python. 64 channels would hold the GIL for about 17 % of
  wall time, in the process whose receive thread feeds the SDRplay.
  PERF.md:176-213 has already traced receive stalls to GIL contention
  (Qt painting).
- **The worker is a child process.** It uses the `spawn` context and
  imports only numpy, `shack_cw` and the call data.
- **Traffic.** One bounded queue in carries `(generation, t, centreHz,
  rate, complex64 block)` at about 13 blocks a second (57 kB each at
  96 kS/s). One queue out carries results.
- **A full queue drops the block** and counts it (`cwSkimDropped`). It
  never blocks receive.
- **A thread in the server publishes.** It drains the results onto the
  `cwskim`/`cwspot` feeds through `radio._publish`, as NB's `BandSkimmer`
  does (`ohsnb/skimmer.py:105-134`).
- **If the worker dies**, status says `error` with the reason, and the
  worker restarts after 2, 4, 8, … s up to 60 s. Nothing the worker does
  can stop receive, and it holds no device.
- **The same runner has a thread mode**, for tests and as a fallback.

### 2.4 Desktop

- **Cost.** It costs the same per channel. The desktop default is
  32 channels (about 10 % of a core) and it runs only while the CW
  Activity view is open, or while spotting is on (Phase 3).
- **The same worker process.** This is not a server: no sockets and no
  ports, just a child process with two pipes. It keeps the Qt thread and
  the receive thread free of the GIL, the same reason as on the box.
- **The risk is frozen builds.** PyInstaller under Windows and macOS
  needs `multiprocessing.freeze_support()` and a spawn-safe entry point.
- **The guard:** a `--cw-skim-selftest` command line decodes the synthetic
  IQ of §7 in the frozen build, and `build-windows.ps1` and `try-dmg.sh`
  run it. GUIDE §6: the Windows smoke test catches what Linux does not.
  If the child cannot start, the thread runner takes over, and status
  says so.
- This is decision 6 in §10.

## 3. Callsigns and spots, the CW Skimmer way

What CW Skimmer itself documents (manual,
http://www.dxatlas.com/CwSkimmer/Files/CwSkimmer.pdf):

- a call is spotted only if it passes validation: the watch list,
  Master.dta (Super Check Partial), the callsign's pattern, and the ITU
  prefix block;
- four validation levels, Minimal to Paranoid. **Unconfirmed:** an NCJ
  article says the higher levels require extra repetitions;
- "CQ" is added once the station is seen to be running, and "DE" when it
  sends its call without CQ;
- an option sends only stations that are calling CQ;
- spot SNR is the "key-on signal-to-noise ratio in the 500 Hz bandwidth
  averaged over QSB".

The RBN's live line is (read 13/10):
`DX de JJ2VLY-#: 14033.50  JI2MED  CW  15 dB  22 WPM  CQ  0828Z`. Its
tags are CQ, BEACON, DX or blank. Its "Q:n" (how many skimmers heard a
spot) is added by cluster software, not by a single skimmer
(wiki.dxcluster.org "Analysing the RBN").

### 3.1 Extraction (per channel, on each completed word)

The pool keeps each channel's last 200 characters. When a word completes,
the matcher looks at the last few words:

| Pattern | Gives |
|---|---|
| `CQ [CQ…] [TEST\|DX\|POTA\|SOTA\|NA…] <CALL> [<CALL>]` | `<CALL>` is running here: kind `cq` |
| `<CALL> TEST`, `TEST <CALL>` | `cq` (contest CQ) |
| `DE <CALL>` (`<X> DE <CALL> [K\|KN\|AR\|BK]`) | `<CALL>` is transmitting here: kind `dx` |
| `TU <CALL>`, `<CALL> <CALL>` (twice running), `<CALL> 5NN/599 …` (`5NN` sent by the one on frequency after `TU`/CQ) | the same station identifying: `dx`; becomes `cq` if a CQ is seen within 10 min |
| `VVV DE <CALL>`, `<CALL>/B`, or a call on an NCDXF slot frequency | kind `beacon` |
| A call after another call (`<OTHER> DE <ME>`: `<OTHER>` is being worked) | **not** a spot for this frequency; only `<ME>` is |

Tokens are matched against
`ohscore/callsign.py`'s shape (`_HOME` at `:37`). It is lenient on
purpose, for a typing check, so the skimmer adds:

- a stop list of words with a call's shape (`5NN`, `TU`, `QRZ`, `QSL`,
  `73`, `TEST`, locators);
- no `*` (the decoder's undecodable letter), and nothing printed while
  the decoder was not `locked`.

### 3.2 Validation (CW Skimmer's levels, in our terms)

A candidate call becomes a spot when all of these hold:

1. **Shape:** `callsign.valid()`, and its home part resolves to a DXCC
   entity through cty.dat. This uses the engine's own loader, the
   operator's file first (`ohscore/dxcc.py:142,176`), which is what
   `Engine._with_country` uses (`engine.py:1179`). It is injected into
   the shared core as a callable, so `shack_cw` stays free of ohscore. That
   is CW Skimmer's ITU prefix-block test.
2. **Hits:**
   - **2 decodes** on the same track, or within ±150 Hz, within
     10 minutes; or
   - **1 decode**, if the call is in the **call history**: the station's
     logbook (`api/log`), calls already confirmed this session, and an
     optional MASTER.SCP the operator downloads (§10, decision 4; never
     bundled until its terms are read).
   - A single-hit call outside the history is listed as `unconfirmed`:
     dim in the channel text and in the spot list, and never sent outward.
3. **Busted check (Morse-aware).** A candidate is `busted` if it is one
   Morse-similar edit from a call that is confirmed within ±150 Hz in the
   last 10 minutes and has more hits.
   - Similar means one letter swapped for one that sounds alike: E↔I↔S↔H↔5
     (dits), T↔M↔O↔0 (dahs), A↔W↔J↔1, N↔D↔B↔6, U↔V↔4, or a dropped or
     added leading or trailing element.
   - Busted calls are kept with a pointer to the winner, shown struck in
     the channel's text, and never spotted.
4. **Confidence**, 0-1, for sorting and dimming:
   - hits (saturating at 4);
   - in the call history (+);
   - the decoder `locked` with a steady WPM (±15 % across the hits);
   - key-on SNR over 10 dB;
   - kind `cq`.

   Statuses follow the cluster convention: `valid` (passed 1-3),
   `unconfirmed`, `busted`, and `qsy` (a valid call now confirmed more
   than 1 kHz from where it was).

   "RBN-style" agreement with other skimmers is Phase 3, and only if the
   platform's spot feeders are on (`dock360/shack/services/spots.py`
   carries `rbn` as a feeder-only source). A call the RBN also reports
   near the same frequency then gains confidence.

### 3.3 Each spot

- **Frequency.** `f` is the signal's on-air frequency, to the RBN's
  10 Hz. `dial` is where Radio's dial goes to hear it in CW, which is
  `f - cwPitch` by the engine's CW passband (`engine.py:1765-1766`;
  Remote's `ModeAudio.dialFor` agrees, `A/shack/ModeAudio.kt:43-52`).
- **WPM** is the decoder's `wpm` (median over the hits).
- **SNR** is key-on, in 500 Hz: the track's p90 bin power over the floor,
  less 10·log10(500 / 150). 150 Hz is the noise bandwidth of a 10 ms Hann
  bin, so the subtraction is 5.2 dB. That is the RBN's definition, so our
  numbers compare with reversebeacon.net.
- Country, DXCC and continent come from the same loader as the decodes.
- Time is UTC: first and last heard.

**Rate.** A call is re-spotted on the same track no more often than every
10 minutes, unless its status or kind changes, or it moves more than
1 kHz (`qsy`).

## 4. The contract (proposed additions)

These land **first**, in the same commit as the code they describe
(GUIDE §3.1): openhamshack-nb `docs/ENGINE-API.md`, `docs/SERVER-API.md`, and
openhamshack-remote `docs/REMOTE-CONTRACT.md` (new §12e).

### 4.1 ENGINE-API.md: feeds `cwskim` and `cwspot` (Radio)

> | `cwskim` | once a second while the CW skimmer runs (Radio) | `{"t", "state", ...}`, below |
> | `cwspot` | as spots are made or change (Radio) | `{"t", "rev", "spot"}`, below |
>
> ### `cwskim` (Radio)
>
> The CW skimmer (shack_cw.skim, run by ohsradio/cwskim.py): every keyed
> signal in the band's CW segment, decoded at once, whatever the dial is
> tuned to and whatever the mode. Each item is the whole picture: a UI
> replaces what it showed. It does not merge.
>
> ```json
> {"t": 1791100000.2, "state": "running", "band": "20m",
>  "segment": {"lo": 14000000, "hi": 14070000, "plan": "rsgb-2026"},
>  "cover": {"lo": 14000000, "hi": 14070000},
>  "spotsRev": 812,
>  "channels": [
>    {"id": 41, "f": 14025310.0, "dial": 14024610.0, "wpm": 27.5, "snr": 18.2,
>     "text": "TU GM4BRI 5NN TEST DL1ABC", "call": "DL1ABC", "kind": "cq",
>     "first": 1791099880.1, "active": true, "decoding": true}
>  ],
>  "carriers": [{"f": 14012000.0, "snr": 30.1}]}
> ```
>
> - `state`: `running`, `partial` (`cover` narrower than `segment`),
>   `outside` (no overlap; `channels` empty; `why` a sentence), `off`,
>   or `error` (with `why`).
> - `channels`: at most `cwSkimMax`, strongest first.
>   - `text`: the channel's last 48 characters; keep your own history by
>     `id`.
>   - `call`: the station identified there, if any.
>   - `kind`: `cq`, `dx` or `beacon`, or absent.
>   - `active`: seen in the last 20 s. A quiet one stays listed for
>     2 minutes.
>   - `decoding`: has a decoder. A tail track waiting for a channel has
>     none.
> - `carriers`: steady unkeyed lines, for a scope layer; never decoded.
> - `spotsRev`: the newest `cwspot` revision. A client that sees it jump
>   past what it holds fetches `GET api/cwskim`.
>
> ### `cwspot` (Radio)
>
> `{"t", "rev", "spot": {"id", "call", "f", "dial", "mode": "cw", "wpm",
> "snr", "kind", "status", "hits", "first", "last", "band", "channel",
> "country", "dxcc", "continent"[, "bustedOf"]}}`.
>
> - `rev` counts up by one per item.
> - `status`: `valid`, `unconfirmed`, `busted` or `qsy`.
> - `kind`: `cq`, `dx` or `beacon`.
> - `snr`: key-on dB in 500 Hz (the RBN's measure).
> - A spot whose status, kind, hits or frequency changes is sent again
>   with the same `id`.
> - Skimmer output is **never** on `events`. A client's CW strip shows
>   only the dial's decoder.

### 4.2 SERVER-API.md

> | `GET api/events?kinds=…,cwskim,cwspot` | view | as above; neither kind is in the default set, so clients that do not ask never get them |
> | `GET api/cwskim` | view | `{"state", "band", "segment", "cover", "channels", "carriers", "spotsRev", "spots": [...]}`: the item above plus every spot of the last 30 minutes (at most 500, newest first). For a view opening, and after a gap in `rev`. |

- **Settings** are ordinary `api/set` keys at Control level, listed in
  `api/spec`. None of them is a transmit key, so no `auth`.
- **Rate limits:**
  - `cwskim` once a second, each item at most `cwSkimMax` × ~120 bytes
    (about 8 kB/s at 64 channels);
  - `cwspot` coalesced to at most 5 items a second;
  - per subscriber, the existing drop-oldest feed of 256 items
    (`app.py:1003`): a slow client loses snapshots, which are harmless,
    and spots, which it recovers through `rev`.
- **Manifest:** `api/cwskim` takes the default read level. No new
  `levels:` row is needed (`store/radio/module.yaml:36-47`).

### 4.3 State keys (ohsradio/state.py; Radio only for now)

| Key | Kind | Type | Default | Notes |
|---|---|---|---|---|
| `cwSkim` | setting | bool | **box: true; desktop: true but on demand** (§10, decision 1) | "Decode every CW signal in the band's CW segment, whatever the dial is on" |
| `cwSkimSquelch` | setting | float dB, 3-20 | 6 | the decoders' `snr_db`. Birth needs this plus 2 dB in the detection spectrum. |
| `cwSkimMax` | setting | int, 8-256 | 64 | channels decoded at once, strongest first |
| `cwSkimState`, `cwSkimWhy` | status | | | as `cwskim.state`/`why` |
| `cwSkimSignals`, `cwSkimChannels` | status | int | | tracks heard / decoders running |
| `cwSkimCpu` | status | float % of a core | | the worker's own CPU |
| `cwSkimDropped` | status | int | | blocks the worker missed |

Feeds: add `"cwskim", "cwspot"` to Radio's `FEED_KINDS`
(`ohsradio/radio.py:71`).

### 4.4 REMOTE-CONTRACT §12e (summary of what the client does)

- Subscribe to `cwskim,cwspot` only while the CW Activity view or the
  scope's spot layer is visible. Remote already reopens the events
  socket per feed set (`A/shack/EngineSession.kt:219`).
- Fill from `GET api/cwskim` when the view opens.
- A tap or OK on a spot or channel **tunes**: one
  `api/set {"mode": "cw", "vfo": dial}`, Control level. It **never
  replies**: no Enable TX from CW Activity (§8, transmit).
- Countries: the server's win; `Cty` is the fallback, as for FT8
  (`A/shack/BandActivity.kt:70-74`).
- At view level, rows are not actionable, and they say so, as the decode
  list does.

## 5. UI

### 5.1 Remote (Android: phone, tablet, TV)

The Band Activity pattern (research of 162ec8b) and what changes:

| Piece | Today | CW Activity |
|---|---|---|
| Socket and parse | `EngineSession.eventsLoop` (`EngineSession.kt:219`); `EngineEvent.parse` (`ShackProtocol.kt:252-274`) | New `EngineEvent.CwSkim`/`CwSpot`, plus a `CwSkimStore` (new `A/shack/CwSkim.kt`): channels replaced per snapshot; spots by `id`, 30 min, at most 500; a `rev` gap triggers a refetch |
| List | `SlotDecodes`/`DecodeList` (`Decodes.kt`, `EngineDecodes.kt`) | New `A/ui/CwActivity.kt`. **Spots** tab: UTC, kHz, call, WPM, dB, country, with CQ in the accent, `unconfirmed` dim and `busted` hidden; sorted by frequency (CW Skimmer's band map) or newest, toggled. **Signals** tab: one row per channel, kHz · WPM · rolling text with the call highlighted, as `DecodedStrip` draws a line (`core/decode/DecodedStrip.kt:57-76`). Column dropping by width as `BandActivity.kt:42-51` does. |
| Layout | Tablet 50/50 split (`ShackPhone.kt:327-346`; Radio `RadioPhone.kt:151-166`); phone docked 220 dp | The same split with the CW Activity panel. It is a decoder panel the operator opens, not one tied to the mode, because the skimmer runs in any mode. Phone: full-screen panel. |
| Scope | Bookmark ticks with one label (`EngineViews.kt:143-166`), `ScopeLabels.place` (`ScopeLabels.kt:26-34`), `sc.xOf(hz)` | A spot layer: a tick per spot on the span and call labels placed by `ScopeLabels` without overlap, CQ in the accent, carriers as a faint mark. A tap near a label tunes to that spot. Otherwise the scope's tap-to-tune is unchanged (`RadioPhone.kt:140-146`). |
| TV | Docked list never takes focus; OK opens `TvDecodesPanel`; `LocalTvInert` | Docked spot list (time, call, kHz, WPM, country), kept calm per §12b. **CW Activity** in the OK row opens the full list. OK on a row tunes and closes it, with a toast. BACK closes it. Everything beneath is inert. |

**Files that must not collide:**

- Flex* files are another session's; none are touched.
- `DecodeList`, `TvDecodesPanel` and `SlotDecodes` are shared with Flex
  (`FlexSession.kt:186`, `FlexScreens.kt:297`, `FlexControlsUi.kt:424`).
  CW Activity gets its own composables rather than changing their
  signatures.
- `ScopeView` in `A/ui/EngineViews.kt` is changed by the unmerged
  `feature/radio-cw-width` (2de02d2, 6afd28a, 3b0088f). The spot layer
  lands after that branch, or is rebased onto it.

**Fake:**

- openhamshack-remote `tools/fakeshack.py` passes the simulator's decodes
  through and injects SSTV itself (`:56-66`, `:347-357`). It gains a
  `cwskim`/`cwspot` replay from a fixture, plus `GET api/cwskim`.
- The fixture is `android/app/src/test/resources/shack/radio-events-cwskim.txt`,
  recorded from the real server on the synthetic IQ (§7).
- The Dock360 fakebox's vendored copy follows (GUIDE §3.3).

### 5.2 Apple

**n/a for now.** iOS has no NB/Radio kind. The package is `OpenHamShackKit`,
with no events or decode code (research of `ios/`). When a Radio kind is
built, the store and the parser go in the Swift package with tests,
following §4.

### 5.3 Desktop (Radio, Qt)

- **The view.** A **CW Activity** view through the main window's extra
  views, as NB's Band view is wired (`ohsnb/ui/mainwindow.py:42-44,
  75-110`: `EXTRA_VIEWS`, a store that outlives the widgets, a table, and
  a click to tune).
  - New `ohscore/ui/cwskimview.py`, shared, so NB can use it in Phase 3.
  - Wired from `ohsradio/ui/mainwindow.py`.
  - Two tables, Spots and Signals. They are the same columns as Remote,
    from the same engine feeds through the bridge
    (`ohscore/ui/bridge.py:114-115`).
- **The scope.**
  - Spots become `set_band_marks` bars on the wide scope
    (`ohscore/ui/scope.py:1237`), whose `mark_clicked` tunes. Radio
    doesn't wire `mark_clicked` yet; NB does
    (`ohsnb/ui/mainwindow.py:106-108`).
  - Calls become `add_label` labels on the waterfall, the FT8 label layer
    (`scope.py:599`, `_paint_decodes` `:1512-1559`), aged as the FT8
    labels are.
  - A click tunes as `scope_click` → `tune_to` does
    (`ohscore/ui/window.py:651-673`), with mode CW.
- **Settings.** The three settings go on Radio's Settings page
  (`ohsradio/ui/settings.py`, `LABELS` in `ohscore/ui/settings.py:43`), in
  the translation catalogs. They are user-visible text, so never in code
  (GUIDE §1).

## 6. Settings

| Setting | Default | Why |
|---|---|---|
| On/off (`cwSkim`) | **On** (decision 1). Box: runs while Radio runs and the band has a CW segment in view, so the list is full when someone opens it. Desktop: on, but the worker starts only while CW Activity is open (or spotting is on). | Brian asked for it; ~0.2 core on a box with ~4.9 idle; zero cost on a laptop until looked at |
| Squelch (`cwSkimSquelch`) | 6 dB | the decoder's tested `snr_db` (`decoder.py:114-120`); the corpus may move it |
| Max channels (`cwSkimMax`) | 64 (cap 256) | §2.2: ~22 % of a core at 64; ~70 % at 256 |

Phase 3 adds `cwSkimSpots` (post to the platform's spots service,
default on when paired) and, if Brian wants it, PSK Reporter. Its CW mode
is not in `ohscore/pskreporter.py:97` `MODES` today.

## 7. Testing

All of it receive-only; nothing keys.

1. **Synthetic multi-signal IQ** (ohs-libs `shack_cw/skim/synth.py`, also
   the selftest's input).
   - **What it renders:** a 96 kS/s segment carrying N stations from a
     call list, at 12-40 WPM, human and machine fists.
     - Spacing down to 60 Hz; QSB; drift up to 1 Hz/s.
     - Steady carriers, a DC spur, static crashes, noise.
     - A busted-call trap: two stations, one sending GM4BRI, the other a
       Morse-similar variant 2 kHz away.
   - **What it scores, against ground truth:**
     - spot recall and precision;
     - busted spots, which should be 0;
     - frequency error (target ≤ 10 Hz) and WPM error (≤ 10 %);
     - time to first spot;
     - channel churn;
     - per-channel CER through `shack_cw.bench.cer`.
   - The tests run in ohs-libs' suite.
2. **The real corpus.** shack `~/build/cw-corpus`: KiwiSDR IQ with a
   manifest (`shack_cw/corpus.py:1-45`) and RBN spots captured alongside
   (`tools/rbn.py`).
   - Each Kiwi recording is a narrow slice. **Guess:** about 10 kHz of IQ
     per file. That still holds several signals, so the skimmer is scored
     on it as is: our spots against the RBN's in the same minutes and
     ±0.5 kHz (recall), and our spots the RBN never made (checked by ear).
   - Plus **one wideband capture from ohs-box** of 20 m CW at a busy time.
     The skimmer writes its own 96 kS/s segment as SigMF (46 MB a minute,
     a developer switch), or Radio's existing IQ recording is used
     (580 MB a minute at 2.4 MS/s, `api/recordings`). This needs Brian's
     OK on the box (decision 5).
3. **Pileup and contest clips.**
   - Record a CWops CWT: one hour, packed 40/20 m.
     **Guess** at the times: Wednesdays 13:00 and 19:00 UTC, Thursdays
     03:00 and 07:00 UTC; check cwops.org first. The next is 14/10.
   - Record ARRL Sweepstakes CW (early November) or CQ WW DX CW (28-29
     November 2026). **Guess** at both dates; check them.
   - Scored like the corpus, against the RBN.
   - This clip decides the open floor question (§1.5, request 4) and
     whether a 256 cap is enough.
4. **CPU benchmark** (`shack_cw/skim/bench.py`). It reports the front end
   and K channels as % of a core:
   - on ohs-dev and shack in CI;
   - on ohs-box in place, from `podman stats` on shack-radio before and
     after `cwSkim` on (today's baseline: 43-46 %), at 32, 64 and 128
     channels.
   - Pass: the 64-channel row of §2.2 holds within 2x, and
     `cwSkimDropped` stays 0 for an hour.
5. **Contract and safety tests** (openhamshack-nb `tests/test_ham_cwskim.py`,
   `tests/test_server.py`):
   - `events` carries no skimmer output; `cwskim`/`cwspot` only when
     asked;
   - `api/cwskim` at view level;
   - a worker crash leaves receive running and status `error`, then
     recovers;
   - broker restart: the skimmer pauses while the claim is retaken and
     resumes (GUIDE §5);
   - a band change or re-centre restarts the tracks;
   - `outside` and `partial` with the HL2 geometry;
   - the skimmer module imports nothing that can key: a test asserts this
     by importing and checking, not by reading source text.
6. **Remote:**
   - unit tests on the fixture: store, `rev` gaps, sorting, column
     dropping;
   - TV focus in the emulator (`ohsr-tv` 32-bit: install
     `app-universal-debug.apk`, GUIDE §5);
   - a screen with any new regex opened on an emulator before landing
     (the ICU trap, GUIDE §5);
   - then the Fire TV and the Tab S9 against ohs-box.

## 8. The change checklist (GUIDE §3)

1. **Contract:** yes. ENGINE-API, SERVER-API and REMOTE-CONTRACT §12e
   (§4), in the same commits as the code.
2. **Server:**
   - the Radio store app, openhamshack-nb: `ohsradio/cwskim.py`, an
     `_rx_monitor` override, state keys, `api/cwskim`;
   - the core in ohs-libs `shack_cw`, vendored as a wheel
     (`tools/vendor/requirements.lock`; re-vendor and run
     `tools/store-check.sh radio`).
   - NB later (Phase 3), on its own CW segment, feeding its band skimmer.
   - Flex later, on DAX IQ at 96 kHz; that is the Flex session's call.
   - Icom: n/a, no IQ.
3. **Fake:** yes. A `fakeshack.py` replay and fixture; the Dock360
   fakebox copy follows.
4. **Android (incl. TV):** yes, §5.1, with no Flex files.
5. **Apple:** n/a until a Radio kind exists (§5.2).
6. **Desktop:** yes, Phase 2. The same engine code runs in the desktop
   app, so there is no pinned commit to refresh. Frozen builds must prove
   the worker process (§2.4).
7. **Hardware:** no new claim. The skimmer rides Radio's existing
   receive claim through the filter bank and never tunes the device (§1.3).
   - After a lost claim and re-claim it simply gets blocks again.
   - On the box the only resource it uses is CPU, inside Radio's
     200 % quota.
8. **Transmit:** none. Receive only.
   - No reply or Enable TX from a CW spot.
   - A tap tunes through `api/set` at Control level.
   - The worker cannot import a transmit path (tested, §7.5).
9. **Release:**
   - ohs-libs `shack_cw` (new modules) → a openhamshack-nb re-vendor.
   - The Radio store package goes to ohs-box with Brian's OK. Radio's
     package carries the SDRplay API, so it is not for a public feed
     until he decides (GUIDE §5).
   - Desktop Radio is cut by the NB session (GUIDE §6), with the Windows
     build before publishing.
   - The Remote APK goes to the Fire TV freely; the tablet by its session.

## 9. Phases, sizes and who builds what

Sizes are a builder agent's working time (**guess**), with rough line
counts including tests.

### Phase 0: freeze the interfaces (half a day, architect + coordination)

- The contract text of §4 is committed in openhamshack-nb and openhamshack-remote,
  docs only.
- The CW accuracy session pushes `feed_frames`/`snr`/`polarity` and agrees
  the shared amplitude function (§1.5, requests 1-2).
- Skimmer work branches from whatever ohs-libs carries those.

### Phase 1: MVP, box server and Remote list (about 5-6 builder-days in total, 3 waves)

| Wave | Agent | Repo, worktree | Files (new unless marked) | Size |
|---|---|---|---|---|
| 1 | builder A: core | ohs-libs `feature/cw-skim-core` | `shack_cw/skim/{frontend,detect,pool,runner,synth,bench}.py`, tests | ~1.5-2 days, ~1200 lines |
| 1 | builder B: calls | ohs-libs `feature/cw-skim-calls` | `shack_cw/skim/calls.py` (extraction, validation, busted, confidence; pure Python on text and timestamps, no numpy), tests | ~1 day, ~700 lines |
| 1 | builder C: Remote | openhamshack-remote `feature/cw-activity` | `A/shack/CwSkim.kt`, `A/ui/CwActivity.kt`, fixture, `CwSkimTest.kt`; edits `ShackProtocol.kt`, `EngineSession.kt`, `RadioPhone.kt`, `TvEngine.kt`; `tools/fakeshack.py` replay | ~2 days, ~1100 lines |
| 2 | builder D: server | openhamshack-nb `feature/radio-cw-skim` | `ohsradio/cwskim.py`; edits `ohsradio/radio.py` (FEED_KINDS, `_rx_monitor`), `ohsradio/state.py`, `ohscore/server/app.py` (`api/cwskim`), docs, re-vendor; `tests/test_ham_cwskim.py`; a multi-CW case in Radio's simulator, so fakeshack and Remote see real output | ~1.5 days, ~800 lines |
| 3 | verifier | ohs-box (with Brian's OK), Fire TV, Tab S9 | §7.4 in place, the Remote on the box, screenshots | ~half a day |

**Parallel without collisions:**

- A and B work in different files of one repo, each in its own worktree
  and branch. Only B touches `shack_cw/README.md`/`CHANGELOG.md`, and A
  lands first.
- C is another repo, working against the Phase 0 contract and fixture.
- That makes three code agents, the GUIDE's limit.
- D starts when A's `runner` API is merged; it may stub `calls`.
- Builder C's `EngineViews.kt` spot layer waits for
  `feature/radio-cw-width` to merge, so C does the list first and the
  scope layer last.

### Phase 2: desktop (about 1.5 builder-days)

- builder E, openhamshack-nb `feature/radio-cw-activity-desktop`:
  `ohscore/ui/cwskimview.py`, `ohsradio/ui/mainwindow.py` (extra view, scope
  marks, labels, click-to-tune), `ohsradio/ui/settings.py`, i18n catalogs,
  `--cw-skim-selftest`, `build-windows.ps1`/`try-dmg.sh` hooks.
- A Windows and macOS proof through `desktop-remote.sh`.
- About 700 lines.
- No collision with Phase 1: D's files are server and engine; E's are UI.

### Phase 3: refinements (each half a day to a day; independent)

1. Spots to the platform's spots service (`POST /api/shack/v1/spots`,
   source `decode`, mode `CW`, extra `{wpm, kind, hits, status}`; only
   `valid` ones).
2. Call history from the station logbook, plus an operator-supplied
   MASTER.SCP (decision 4).
3. Agreement with the RBN, when the platform's feeders are on.
4. Contest tuning on the pileup clip: the floor hint (§1.5, request 4), a
   second worker process past 256 channels.
5. "Skim this band's CW" (an explicit tune).
6. Birdie list management in Settings.
7. NB: the skimmer on 10489.500-540, naming CW calls in NB's Band view.
8. Flex DAX IQ, offered to the Flex session.
9. PSK Reporter CW spots, if Brian wants them (decision 3).

## 10. Decisions for Brian

**Settled by Brian 13/10/2026:**
- 1: **off by default, switched on per use**, on the box as well as the
  desktop. The box runs it only while `cwSkim` is true, and the Remote's
  CW Activity view offers the switch. §4.3 and §6 still say "on"; where
  they differ, this line wins.
- 3: **box only**: no RBN or PSK Reporter.
- 5: **yes** to the ohs-box capture.
- The other decisions take the recommendation: 2 (64/256), 4 (operator
  downloads MASTER.SCP), 6 (child process), 7 (tune only), 8 (dial's band
  only).
- The single-signal decoder fix ships first as Radio 0.1.20, ahead of
  the skimmer.


1. **On by default?** Recommend **on**. On the box it runs continuously
   while Radio runs, so the list is populated when anyone opens it
   (~0.2 core of ~4.9 idle). On the desktop it is on, but runs only while
   CW Activity is open. Alternative: off until the corpus scores are in.
2. **Channel limits.** Recommend **64 by default, 256 at most**
   (one worker process), and a second process only if a contest clip
   shows 256 is short.
3. **Spots leaving the station.** Recommend **into the platform's spots
   service only** (Phase 3; other apps and Remote see them).
   - **No PSK Reporter or RBN for now.** The RBN takes spots through its
     own Aggregator, and our decoder is not yet proven against it.
   - Revisit after a contest clip.
4. **MASTER.SCP.** Recommend **the operator downloads it** (Settings
   names the file and where to get it), and **we never bundle it** until
   its redistribution terms have been read. The research could not reach
   them (supercheckpartial.com is a script-only page). Without the file,
   validation leans on the logbook and repeated hits.
5. **A wideband test capture on ohs-box.** Recommend allowing one
   receive-only 10-minute capture of 20 m CW at a busy time (the
   skimmer's own 96 kS/s tap, about 0.5 GB), plus an RBN capture alongside.
   It changes nothing on the radio, but it is an action on the box, so it
   waits for a yes.
6. **Desktop: worker process or thread?** Recommend a **child process**
   (no ports, two pipes, so not a server), with the thread as the fallback
   and the Windows/macOS frozen builds proving it with
   `--cw-skim-selftest`. A thread is simpler, but at 32 channels it puts
   ~8 % GIL load beside the Qt UI and the receive thread.
7. **Tap on a spot.** Recommend **tune only**, with no reply and no Enable
   TX from CW Activity. It keeps the feature receive-only. A later
   "answer this CQ" would go through Enable TX's arm and confirm, like
   FT8 replies.
8. **Which segment.** Recommend **the dial's band only**, as CW Skimmer on
   one receiver does, with no automatic retune and no skimming of a band
   the receiver is not on. A second, independent skimmer band would need
   a second receiver claim, which is Phase 3+, if ever.
