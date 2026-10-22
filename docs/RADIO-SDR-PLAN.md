# OpenHamShack Radio as a full SDR receiver: the plan, and Milestone 1 in detail

Status: **design for Brian's review**, 22/10/2026. Nothing here is built.
Claims cite files; **[guess]** marks anything not checked in code, on a
binary or on hardware. Measurements made for this plan are dated and say
on what.

Brian's decisions this plan takes as given (22/10/2026):

- Radio becomes a full SDR receiver that decodes as much as it can.
- Mode families, in this order: **amateur extras** (RTTY, PSK31/63, SSTV,
  WSPR, POCSAG; APRS through the shared Packet library `shack_packet`;
  FreeDV), then **broadcast** (wideband FM stereo with RDS, synchronous
  AM, DAB+, DRM), then **digital voice** (DMR, D-STAR, YSF, P25, NXDN).
- Every decoder is our own code, in Rust. Anything with licence or patent
  problems is never shipped: it is used only if the user installed it,
  loaded at run time. That is libfdk-aac or faad2 for DAB+/DRM audio,
  mbelib for AMBE/IMBE voice, and codec2. codec2 is LGPL and has no patent
  problem, but Brian chose "use if installed" for now rather than a port.
- Hardware first: what we own. Pluto/LibreSDR, the SDRplay RSPdx (already
  on ohs-box through SoapySDR, broker device `sdrplay-1`) and RTL-SDR. On
  the platform the broker claims devices. Transmit is unchanged and stays
  behind the lease.
- Each milestone ships in desktop Radio (Linux, Windows, macOS) and store
  Radio at the same time.

Brian's answers to this plan's first four questions (22/10/2026):

1. **codec2:** keep shipping it (LGPL) in the Windows and macOS bundles
   and the store image, as now.
2. **Encumbered codecs on a controller come from a host package**, not an
   admin upload. The platform installs the codec on the controller itself
   (for example Debian's faad2), and store Radio uses it from there (§5.6).
3. **The SDRplay API is "use if installed" on every form.**
   - It comes out of the store image.
   - The desktop builds never carried it: checked, nothing under
     openhamshack-nb `packaging/` or the desktop build scripts names it;
     only `tools/build-store.sh` and the store Containerfile do.
   - Radio loads the user's own installed API at run time, as it loads
     codecs, and a missing one reads "install SDRplay's API to use this
     radio".
   - On a controller it arrives the same way as the codecs (§6.3).

   With that, store Radio carries nothing whose redistribution is in doubt
   and can be **published on a feed**.
4. **CW gets a Rust port too, as a later milestone, M5** (after digital
   voice, §8.5). `shack_cw` stays the live decoder until the port beats it
   on the existing CW benchmarks. Icom and Flex switch when it does.
   M1 starts now as designed.

## 0. The decisions, in one place

| # | Question | Decision (reasons in the section) |
|---|---|---|
| 1 | Where the new Rust lives | A new crate **`shack_sdr`** in `~/ohs-libs/rust/shack_sdr`. It is one mixed Rust+Python wheel, `shack-sdr`. It is not called `ohssdr`: the brand kit forbids those initials as a code prefix. It does not go inside ohsdigi, and it does not go in openhamshack-nb (§2). |
| 2 | DSP pipeline | M1 adds **no new channeliser**. The engine's existing FFT filter bank cuts one channel for each decoder session. Rust worker threads decode with the GIL released, and Python polls for the results. The bank moves into Rust later, as the one channeliser for every app (§3). |
| 3 | Decoder interface | One Rust trait (`Decoder`) and one Python face (`shack_sdr.Host` plus a catalogue). Every decoder produces five kinds of output: text, frame, image, audio and meta. They reach the desktop through a new engine feed, `decoders`, and the store through a new `api/decoders` (§4). |
| 4 | Codec loader | Lives in `shack_sdr`. It opens libraries only by full path from a fixed list of folders on each OS, checks the version and probes each new file in a child process first. It returns codes, never sentences. It is backed by a build check that fails if an encumbered library is linked or bundled anywhere (§5). On a controller, codecs come from host packages that a named privileged operation stages and a read-only mount declared in the manifest exposes to the app (§5.6). |
| 5 | SDR sources | Packet's own ctypes bindings for the RTL-SDR and the SDRplay API move into `shack_sdr`, so all three desktop OSes get both radios without SoapySDR. The SDRplay API is the user's own on every form: on a controller it is staged on the host like a codec, and the store image stops carrying it and SoapySDRPlay3 (§6.3). SoapySDR stays as the generic route on Linux. The Pluto is unchanged, transmit included (§6). |
| 6 | Tests with no transmitter | Synthetic generators in Rust, the Python decoder kept as a reference until the Rust one beats it, and recordings in iqlib. Fixtures that are not ours stay out of the public repos (§7). |
| 7 | The first decoder | **RTTY**, both as the mode decoder and as fixed-frequency sessions independent of the dial (§8.2). |
| 8 | Licensing | Read and port from GPL-3.0-compatible sources, with credit. AAC, AMBE and IMBE are only ever loaded at run time, never ported, even from permissively licensed code (§9). |

Brian's answers to the first questions are above; what is still open is in §10.

## 1. Where Radio stands today (what this builds on)

- **The engine is Python with numpy.** One receive thread runs every
  consumer on each block. Slow decoders run on their own worker thread.
  Audio is 12 kHz mono everywhere (openhamshack-nb `DESIGN.md` "The radio
  thread model"; `docs/ham/DESIGN-HAM.md` §1 inherits it).
- **One FFT filter bank already feeds every channel.** It is an
  overlap-save bank, and a channel decimates by any D that divides both N
  and L (`ohscore/dsp/bank.py` docstring). `Engine._rx_block`
  (`ohscore/engine.py:1423`) pushes each block through it. Radio's CW
  skimmer cuts one extra channel from it for a child process
  (`ohsradio/cwskim.py` docstring). That is the precedent for a decoder
  that ignores the dial.
- **Today's decoders** are listed in `ohscore/modes/__init__.py`, which
  lists every mode whether it is available or not, with a sentence saying
  why (`available`/`why`):
  - Python: CW (now ohs-libs `shack_cw`), RTTY (45.45 Bd/170 Hz only,
    `rtty.py`), PSK31/63/125, SSTV (four modes) and KG-STV.
  - ohsdigi in Rust: FT8/FT4/Q65/JS8/HSmodem (the wheel is described in
    openhamshack-nb `docs/OHSDIGI-PYTHON.md`).
  - FreeDV: codec2 bound with ctypes (`ohscore/modes/freedv.py:59`). The
    library is found by `host.find_library` (`ohscore/host.py:135`), which
    looks in the bundle first.
- **The mode-decoder path already reaches every client.** Decodes are
  `events` items (ENGINE-API.md "`events`"). The store server sends them on
  `api/events` (SERVER-API.md). Remote's Android Radio kind shows them in a
  panel chosen by mode, and a mode it does not know is learnt from its
  first event (openhamshack-remote `android/.../shack/DecoderPanel.kt`).
  The Apple client has no Radio kind yet: nothing under `ios/` names
  `qo100nb` or `radio`.
- **Sources:**
  - Radio has `pluto` (libiio), `hl2`, `soapy` and the simulator
    (`ohscore/devices/registry.py`, `ohscore/devices/soapy.py`).
  - SoapySDR is excluded from the Windows and macOS builds
    (`packaging/windows/openhamshack-radio.spec:84`,
    `packaging/macos/openhamshack-radio.spec:68`). On those systems Radio
    therefore receives only from a Pluto or an HL2.
  - ohs-libs `shack_packet.sdr` already has receive-only `IqSource`
    backends with their own ctypes bindings:
    - `RtlSdrSource`, using librtlsdr, bundled on Windows and macOS;
    - `SdrplaySource`, using the user's own SDRplay API, never bundled;
    - rtl_tcp, Pluto, recordings and a synthetic band.

    It also has a channeliser (`shack_packet/sdr/{source,rtlsdr,sdrplay,channeliser}.py`).
- **The store image** comes from `store/radio/Containerfile`:
  - Debian 13, with `libcodec2-1.2` from Debian (line 69);
  - SDRplay's API unpacked from its installer, plus SoapySDRPlay3 built
    from source;
  - ohsdigi's wheel, checked against `tools/vendor/ohsdigi.lock` and
    unpacked as `ohscore/ohsdigi.abi3.so` (line 106).

  The manifest declares `broker_devices: [pluto, hl2, sdrplay]` and
  `cpu_quota: 200%` (`store/radio/module.yaml:50,149`).
- **The broker already knows both receivers.** Classes `sdrplay` and
  `rtlsdr` are receive-only, exclusive and reached over USB. `libresdr` is
  a class of its own (dock360 `feature/ohs-edition`
  `src/dock360/shack/broker.py`, `CLASSES`). Radio declares neither
  `rtlsdr` nor `libresdr`.
- **What Radio costs today:**
  - **ohs-box live**, read 13/10: an i5-9400T, which is **not an N150**.
    RSPdx at 2.4 MS/s in CW: `ohsradio --server` 31 % of a core, plus
    `sdrplay_apiService` 15 % (openhamshack `docs/CW-SKIMMER-PLAN.md`
    §2.2).
  - **CW skimmer at 64 channels**, measured on the box in Radio's image
    with one CPU: 29 % of a core (HANDOVER, 13/10).
  - **Shack**, Ryzen 9 6900HX, measured for this plan on 22/10: Radio
    headless on the simulator at 2.4 MS/s on 20 m, for 30 s, with
    `--no-audio --receive-only`. The whole process used 11.7-13.6 % of one
    core, with the simulator generating the band included; the engine's
    own `cpu` status read 4.6-5.5 %.
  - **The bank alone** (`ohscore/dsp/bank.py` driven directly, one core,
    numpy 2.2.4):

    | | 1.2 MS/s | 2.4 MS/s |
    |---|---|---|
    | Forward FFT only | 3.6 % | 7.5 % |
    | Each extra 12 kHz channel | +0.07 % | +0.07 % |
    | A 240 kHz channel | +0.45 % | +0.6 % |

    With glibc's heap top pad set as `shack_packet.sdr.memory.keep_heap()`
    sets it, the same FFT cost **0.95 % / 2.7 %** and a 12 kHz channel
    +0.04 %. ohscore never calls `keep_heap` (a grep of `ohscore/` finds
    no `mallopt`). Whether the engine's own process lands in the slow
    case is **[guess]**: GUIDE §5 says it depends on the process's
    history. Worth a one-line experiment in M1 (§8.3).
  - **The N150**, for scale: **[guess]** a core is about half the
    6900HX's and about 0.85 of the i5-9400T's. On that guess, Radio as it
    is costs about 36 % plus 18 % for the API service on an N150 at
    2.4 MS/s with an RSPdx. That leaves roughly half of "one core shared
    with everything else" before the CW skimmer.

## 2. Decision 1: where the Rust lives, who reuses it, how it is built

### 2.1 Decision

A new crate, **`shack_sdr`**, in `~/ohs-libs/rust/shack_sdr`. That makes
`ohs-libs/rust/` the Cargo workspace REPO-LAYOUT §2 planned (it does not
exist yet: `ls ~/ohs-libs` shows no `rust/`).

- **Packaging:** maturin, in its mixed layout. The Rust extension
  `shack_sdr._native` and a Python package `shack_sdr` go in **one
  wheel**, `shack-sdr`.
- **What the Python half holds:**
  - the receive-only IQ sources moved from `shack_packet.sdr` (§6);
  - the adapters that let Python-backed decoders (shack_cw,
    shack_packet, ohsdigi) appear in the same catalogue;
  - the codec-status helpers.
- **What the Rust half holds:**
  - the decoder host, its threads and queues;
  - the decoders themselves;
  - the test-signal generators;
  - the codec loader;
  - later, the channeliser.
- **Licence:** GPL-3.0-or-later, as ohs-libs (REPO-LAYOUT §2) and Radio
  (`store/radio/module.yaml:29`; openhamshack-nb `LICENSE` is GPL v3, and
  every package declares `-or-later`).
- **Version:** ohs-libs' lockstep version (REPO-LAYOUT §3). The first
  release with it is ohs-libs 0.2.0.

**Name.** The brief said `ohssdr`. The brand kit says "Never the initials
OHS ... not as a code prefix either: code uses `shack`" (openhamshack
`brand/README.md:48-49`), and REPO-LAYOUT's "Identifier prefix" keeps
`ohsdigi` only as a legacy name awaiting renaming. A new crate should not
add a second such name. The Rust crate is `shack_sdr`, the distribution
`shack-sdr`, the import `shack_sdr`.

**Rejected:**

- **Inside ohsdigi.** ohsdigi is a port of WSJT-X and JS8Call, held
  bit-exact against them (openhamshack-nb `docs/digimodes-rust.md`), and
  released at NB's pace. Putting broadcast and voice decoders and a codec
  loader in it would mean:
  - every app that wants FT8 carries DAB, and every app that wants RDS
    carries a 2 MB JS8 dictionary (`Cargo.toml`: `jsc.bin.gz`);
  - one version line would move for unrelated reasons.

  Slot modes stay in ohsdigi, and that includes **WSPR** (M2): it is a
  WSJT-X mode, and its Fano decoder and slot API belong with the others.
  `shack_sdr`'s catalogue lists ohsdigi's modes through a Python adapter
  (§4.2).
- **Next to ohsdigi in `openhamshack-nb/rust/`.** The NB session owns that
  repository. Icom, Flex, Digital Modes, DATV and Packet would then depend
  on an app's repo, which REPO-LAYOUT §1 already rejected for the same
  reason. ohsdigi itself is meant to move to `ohs-libs/rust/`
  (REPO-LAYOUT §2.1). Once it does, the two crates sit side by side in one
  workspace and can share a small common crate (FFT plans, resamplers) by
  path, with no version skew.
- **A Python package in ohs-libs with no Rust.** Brian decided the
  decoders are Rust. The Python half exists only for what is already
  Python and works: the ctypes sources and the adapters.

**Cost, accepted:** two native wheels, `shack-sdr` and ohsdigi's, each
carrying its own copy of rustfft, until ohsdigi joins the workspace and
then possibly the same wheel. ohs-libs gains a Rust build, which it has
never had (§2.3).

### 2.2 Who reuses it

| App | What it takes from `shack_sdr` | When |
|---|---|---|
| Radio and QO-100 NB (one engine, `ohscore`) | Everything. NB's RTTY mode switches to the Rust decoder in M1 along with Radio's, because the mode table is shared (`ohscore/modes/__init__.py:133`). | M1 |
| Digital Modes (`~/openhamshack-digimodes`) | The audio-input decoders: RTTY, PSK, SSTV, POCSAG on discriminator audio, WSPR through ohsdigi. | M2 |
| Icom, Flex | The audio decoders on the radio's receive audio. On Flex, IQ decoders on DAX IQ too, once the channeliser is in Rust (Flex DAX IQ is float32 IQ: GUIDE §5). | M2-M3 |
| Packet Radio (`shack_packet`) | Its IQ sources, which move into `shack_sdr` (§6). Later, the Rust channeliser in place of its own numpy one (the "one of each" rule: today there are two, `bank.py` and `shack_packet.sdr.channeliser`). | M1 sources, M3 channeliser |
| DATV | The channeliser and resamplers, if DATV ever demodulates in software. **[guess]**: no plan says it will. | not planned |

### 2.3 How wheels are built and vendored on every platform

The pattern is openhamshack-nb `tools/build-wheels.sh` and
`rust/build.Containerfile`, moved into ohs-libs without changes in kind:

| Target | Built | Tag | Tested by the build |
|---|---|---|---|
| Linux x86_64, aarch64 | bookworm container with the toolchain pinned by digest (Rust 1.98.1, maturin pinned by hash). Glibc 2.36 keeps it loadable on Pi OS bookworm. | `manylinux_2_35` (or whatever maturin's symbol check allows) | x86_64: round trip in Python 3.11 in the container and the host's Python; aarch64: built only, as today |
| Windows x64 | the same container, mingw-w64, PyO3 abi3 linking `python3.dll` by raw-dylib | `win_amd64` | built only. The proof is the Windows desktop build's smoke test (§8.3) |
| macOS | natively on the Mac mini under `/Volumes/OpenHamShackBuild`, universal2 | `macosx_11_0_universal2` | round trip on arm64, and on x86_64 under Rosetta 2 |

- Wheels land in `~/build/ohs-dist/shack-sdr/` with `SHA256SUMS`. They
  are never committed (as ohsdigi's: `tools/vendor/ohsdigi.lock` comment).
- **Each consuming app** pins them in `tools/vendor/shack-sdr.lock`, one
  line per platform with its sha256. A bump is a commit of its own
  (REPO-LAYOUT §4).
- **Desktop forms:**
  - the .deb and AppImage unpack the Linux wheel beside `ohscore`;
  - `build-windows.ps1` and `build-macos.sh` unpack theirs into the
    frozen bundle;
  - checkouts and tests use `ohscore/shacklibs.py`'s unpack-by-hash cache,
    which needs one change: it learns platform wheels as well as pure ones.
- **Store image:** a Containerfile step, cut and pasted from the ohsdigi
  step (Containerfile lines 82-107), checks the wheel for `$(uname -m)`
  against the lock and unpacks it into site-packages. `tools/store-check.sh`
  then proves it loads and decodes (§8.3). GUIDE §5 records 0.1.10-beta.1
  shipping with no decoder; the check exists for that.
- **ohs-libs `tools/test.sh`** gains two steps run in the build container,
  `cargo test --release` and `cargo deny check`, plus the Python tests of
  `shack_sdr`'s Python half. The nightly beta-build already runs
  `test-ohs-libs` (openhamshack `tools/beta-build/beta-build.sh:76`), so
  nothing new is scheduled.

## 3. Decision 2: the DSP pipeline

### 3.1 Shape

```
 Pluto / RSPdx / RTL-SDR / HL2 / file / sim
        │ complex64 at fs (1.2 or 2.4 MS/s today; 2.048 added in M3)
        ▼
 Python RX thread (engine)                         unchanged: scopes, VFO demod, audio, recording
  _rx_block(x) ─► bank.push(x) ─► X (spectra, shared)
        │                 │
        │                 ├─► VFO channel ─► demod ─► 12 kHz audio ─► mode decoder adapter ─┐
        │                 └─► per session: Channel.take(X) ─► channel IQ at its rate ───────┤
        │                                                                                   ▼
        │                                       host.feed(session, samples, t0, index)   (copies into the
        │                                                                                 session's ring and
        │                                                                                 returns; never blocks)
        ▼                                                                                   │
 engine supervisor (10 Hz) ◄── host.poll() ◄── result queue ◄── shack_sdr worker thread(s) ◄┘
        │                                                       no GIL; one decoder session at a time
        ▼                                                       per worker, catch_unwind around each
 feeds "decoders" (new) and "events" (unchanged shape)
        ├─► Qt window (desktop Radio and NB)
        └─► ohscore/server ─► api/decoders, api/events?kinds=decoder
```

### 3.2 Rates

- **From the radio:** Radio offers 1.2 and 2.4 MS/s
  (`ohsradio/state.py:43`).
  - SoapySDRPlay3 refuses 1.2 MS/s, so the RSPdx runs at 2.4
    (`ohscore/devices/soapy.py` docstring).
  - Packet's RTL-SDR default is 2.4 (`shack_packet/sdr/rtlsdr.py`).

  M1 keeps those two and adds a per-device rate list (§6). **2.048 MS/s**
  arrives in M3 for DAB. The bank accepts it (it needs fs to be a multiple
  of 200 Hz with fs/50 divisible by 4, `bank.py` `Geometry`). On a Pluto,
  below its no-FIR floor, DAB runs at 2.4 and is resampled in Rust (GUIDE
  §5 on the AD936x floor).
- **To each decoder:** a session asks for a rate and the engine picks the
  bank's nearest decimation at or above it (`Geometry.decimation_for`).
  Both rates give an exact 12 kHz (D = 200 at 2.4 MS/s, 100 at 1.2) and an
  exact 48 kHz (D = 50, 25). The 240 kHz that wideband FM needs is D = 10
  at 2.4 MS/s. A decoder whose symbol timing wants another rate resamples
  inside Rust, so the bank is never asked for odd rates.

### 3.3 One channeliser, not two

M1 adds **no** channeliser. Sessions take their IQ from the engine's bank,
which already serves the VFO, zoom, trackers and the CW skimmer.

- **Why not a Rust channeliser now, beside the bank:**
  - it would be the third channeliser in the family (after `bank.py` and
    `shack_packet.sdr.channeliser`), against GUIDE §1's "one of each";
  - it would be a second forward FFT of every block: 2.7-7.5 % of a 6900HX
    core at 2.4 MS/s, about twice that on an N150 **[guess]**;
  - it would change NB's proven receive path in the first milestone.

  The bank's per-channel cost, measured above, is 0.04-0.07 % of a core
  for a 12 kHz channel, so eight sessions cost less than one percent.
- **When it moves (M3).** The bank becomes `shack_sdr.Channeliser`, in
  Rust, with the same geometry, the same phase continuity and the same
  test vectors. ohscore uses it in place of `bank.py`, and `shack_packet`
  in place of its own. It moves then because M3 needs it:
  - WFM and DAB want the GIL-free path at full rate;
  - Flex DAX IQ and Packet need a channeliser outside ohscore.

  The swap needs a test that holds the Rust channeliser within float
  tolerance of `bank.py` on the bank's existing tests, run against both.

### 3.4 How many decoders at once, and the CPU budget

- **M1 sessions:** the mode decoder (as today), plus up to
  **`decodersMax` fixed-frequency sessions** (default 4, range 0-16).
- **The budget** is "one core shared with everything else". On an N150
  that leaves Radio about half a core beyond what it uses today (§1).
  Decoders get **`decodeCpuMax`, default 25 % of one core.**
  - The host measures each worker's own CPU time
    (`CLOCK_THREAD_CPUTIME_ID` on Linux and macOS, `GetThreadTimes` on
    Windows) and the time inside each session.
  - Over the cap, it pauses the newest fixed session (state `budget`,
    with a reason code) and resumes it when there is room. It never
    touches the mode decoder.
  - This copies NB's `skimBudget` and Radio's `cwSkimCpu` idea
    (CW-SKIMMER-PLAN §2.2).
- **M1's target on an N150:** RTTY at four sessions plus the mode decoder,
  under **10 % of one core**. **[guess]** about 0.5-1 % a session,
  measured in M1.
- **Workers:** one by default, both on the desktop and in the store (the
  store's quota is 200 %). `decodeThreads` (1-4, desktop) exists for M3's
  DAB and M4's voice decoders. More than one worker never runs one
  session on two threads: state stays single-threaded.

### 3.5 Threading across the Python/Rust boundary

- **`feed` never blocks.** It copies the samples into the session's
  bounded ring (2 s) and returns. A full ring drops the oldest block and
  counts it (`stats.dropped`), so a slow decoder can never stall receive.
  That is the engine's own rule for feeds (ENGINE-API "Feeds"). The copy
  is about 20 MB/s at most at 2.4 MS/s full rate, and nothing in M1 feeds
  full rate.
- **No Python callbacks from Rust threads.** Results go on a Rust queue,
  and the engine's supervisor calls `poll()` at 10 Hz. Calling into Python
  from a foreign thread is what `shack_packet`'s rtlsdr binding avoided as
  "fragile at shutdown on every platform" (`rtlsdr.py` docstring).
- **The GIL is released for every call that does work** (`py.detach`, as
  ohsdigi does in `src/decode/py.rs:111`). Samples cross through the
  buffer protocol: a numpy array is read in place, not converted to bytes
  as HsReceiver does (`src/hsmodem/py.rs`), because the IQ path is
  heavier.
- **Threads, not a child process** (unlike the CW skimmer): Rust threads
  hold no GIL, and the crate has no transmit path. A panic in a decoder is
  caught per session (`catch_unwind`) and becomes `state: error`. The one
  thing threads cannot contain is a crash inside a dlopen'd codec. That is
  why each new codec file is probed in a child process before it is used
  in-process (§5.3).
- **Shutdown:** `Host.close()` stops the workers and joins them within
  1 s. Engine `stop()` calls it before closing the device. It holds no
  hardware, so it never delays the broker's release (GUIDE §5: "A stop
  that overruns `stop_timeout` gets SIGKILLed").

## 4. Decision 3: one decoder interface

### 4.1 The Rust trait

```rust
pub enum Input<'a> {
    Iq    { samples: &'a [Complex32], rate: f64, t0: f64, index: u64 },  // complex baseband centred on the session
    Audio { samples: &'a [f32],       rate: f64, t0: f64, index: u64 },  // real audio, e.g. the VFO's 12 kHz
}                                                                         // index: sample number since start; a jump is a gap

pub struct Info {                       // static, one per decoder kind: the catalogue
    pub id: &'static str,               // "rtty"
    pub family: Family,                 // Amateur | Broadcast | DigitalVoice
    pub inputs: &'static [InputKind],   // which of Iq/Audio it takes natively; the host adapts the other where it can
    pub rate_hz: f64,                   // preferred input rate
    pub bandwidth_hz: f64,              // channel it needs
    pub outputs: &'static [OutputKind],
    pub panel: Panel,                   // Text | Slots | Frames { columns } | Image | Meta | Audio: how a client shows it
    pub params: &'static [ParamSpec],   // key, type, choices/range, default (labels are catalog keys, never text)
    pub needs: &'static [CodecId],      // codecs it cannot work without, or that it needs only for audio
}

pub trait Decoder: Send {
    fn info(&self) -> &'static Info;
    fn configure(&mut self, params: &Params) -> Result<(), DecodeError>;  // live where the decoder allows
    fn feed(&mut self, input: Input<'_>, out: &mut Sink) -> Result<(), DecodeError>;
    fn reset(&mut self);                 // a retune, a gap the decoder cannot bridge
    fn status(&self) -> Status;          // sync, snr_db, offset_hz, rate measures (baud), counters
}

pub enum Output {                        // what Sink takes
    Text  { text: String, offset_hz: f32, snr_db: Option<f32> },                       // streaming characters
    Frame { kind: &'static str, fields: Fields, raw: Option<Vec<u8>> },                // a POCSAG message, an RDS group, a DMR header
    Image { event: ImageEvent },                                                       // start{w,h,format} | lines{from,rgb} | done{file}
    Audio { pcm: Vec<f32>, rate: u32, channels: u8 },                                  // WFM, DAB+, voice (M3-M4)
    Meta  { fields: Fields },                                                          // RDS PS/RT, a DAB service list, a talkgroup
}

pub enum DecodeError {
    BadInput(Code),                      // wrong rate or kind: a bug in the caller
    NeedsCodec(CodecId),                 // asked for audio with no codec: the session keeps decoding everything else
    Codec(CodecId, Code),                // the loaded codec refused a frame (counted; not fatal)
    Internal(Code),                      // the session goes to `error`
}
```

Rules that cut across:

- **No user-visible text in Rust.** Errors, reasons and labels are
  snake_case codes with parameters. The app turns them into catalog
  sentences (I18N.md rules 1 and 8).
- **Time comes from the samples, never the clock.** `t0`/`index` give
  every output its time. An IQ recording played back keeps its own times,
  as the file device does (ENGINE-API "IQ playback").
- **The host adapts input** so one decoder serves every app:
  - audio to IQ: an analytic signal shifted by the audio offset, so RTTY
    on Icom's or Flex's audio is the same decoder as on Radio's IQ;
  - IQ to discriminator audio, for FM-based modes that only take audio.
- **Receive only by construction.** Nothing in `shack_sdr` has a transmit
  method or imports a radio link. A test checks it, as `shack_packet.sdr`
  does (its `__init__` docstring). Transmit encoders, such as RTTY's for
  Enable TX (SERVER-API "Automatic transmit"), stay where they are.

### 4.2 The Python face

```python
from shack_sdr import Host, catalogue, codecs

host = Host(threads=1, cpu_max=0.25)
catalogue()          # [{"id", "family", "inputs", "rateHz", "bandwidthHz", "outputs", "panel",
                     #   "params", "needs", "engine", "available", "why", "version"}, ...]
sid = host.start("rtty", params={"baud": 45.45, "shift": 170, "reverse": False}, input="iq", rate=12_000)
host.feed(sid, samples, t0, index)      # numpy complex64 or float32, read in place; never blocks
host.poll(max_items=500)                # [{"session", "rev", "t", "type", ...}, ...]; never blocks
host.status(sid) / host.stats()         # state, why (a code), counters, cpu share
host.reset(sid); host.stop(sid); host.close()
codecs.status(rescan=False)             # §5
```

**The catalogue lists Python-backed decoders too.** shack_cw (CW),
shack_packet (APRS, M2) and ohsdigi's slot modes register through a small
Python protocol with the same shape (`feed`, `poll`, `status`), so an app
and its clients see one list.

- Their `engine` field says which library decodes:
  `"shack_sdr" | "ohsdigi" | "shack_cw" | "shack_packet"`.
- They run on their own existing threads or processes. The CW skimmer
  keeps its child process (Brian, 13/10/2026, `ohsradio/cwskim.py`).

This keeps "one of each" without forcing a rewrite of decoders that work
(see M5 in §8.5: CW is ported later, and `shack_cw` stays live until the port beats it).

### 4.3 Engine (desktop and store alike)

- **The engine's methods:**
  - `Engine.decoders.catalogue()`
  - `start(decoder, freq_hz, **params) -> id`
  - `stop(id)`
  - `sessions()`
  - `codecs(rescan=False)`

  A fixed session's channel is `Channel(geo, D, freq=self._off(freq_hz))`,
  made and dropped beside the others in `_rx_block`.
- **A session whose frequency leaves the receiver's span** goes to
  `outside` and is fed nothing. It comes back by itself when the span
  covers it again, as the CW skimmer's `outside`/`partial` states do
  (ENGINE-API "`cwskim`").
- **The mode decoder** is a session with id `vfo`, fed the VFO's 12 kHz
  audio. It keeps emitting `events` items in today's shapes (DESIGN.md
  "Modes"), so the window's panels, Remote and Enable TX's reply logic
  need no change.
- **New feed kind `decoders`** (not in any default set). Items carry
  `{"t", "session", "rev", "type", …}` as in §4.4. Radio's `FEED_KINDS`
  (`ohsradio/radio.py:74`) gains it, and so does NB's.
- **Persistence:** fixed sessions are saved in the config
  (`decoderSessions`, a list) and restarted with the radio. Never
  restarted after a broker hand-over until the radio is back.

### 4.4 Store API: `api/decoders` (to add to openhamshack-nb `docs/SERVER-API.md`)

Same rules as the rest of that file: paths are relative to the app's
base; the levels are view, control and transmit; errors are
`{"error", "code"}`. Nothing here transmits.

| Method, path | Level | Does |
|---|---|---|
| `GET api/decoders` | view | `{"decoders": [catalogue entry...], "codecs": [codec...], "limits": {"sessions", "cpuMax", "threads"}, "sessions": [session...]}`. A client fetches it once when a view opens. |
| `POST api/decoders/sessions` | control | `{"decoder": "rtty", "freqHz": 14083500, "params": {...}}`. Answers `201` with the session, or one of: `400 bad_params`, `404 unknown_decoder`, `409 decoder_unavailable` (with `needs` naming the codec), `409 outside_span`, `429 too_many_sessions`, `503 not_running`. |
| `DELETE api/decoders/sessions/{id}` | control | stop it; `{"stopped": true}` |
| `GET api/decoders/sessions/{id}?since=<rev>` | view | the session, plus its kept results newer than `rev` (the last 500 or 30 minutes, whichever is fewer). Fetch it after a gap in `rev`, as with `api/cwskim`. |
| `POST api/decoders/sessions/{id}/listen` | control | M3. Routes the session's audio to `api/audio/rx` in place of the demodulator, one session at a time. `{"listen": false}` puts the demodulator back. |
| `GET api/decoders/files?id=&download=1` | view | a picture or file a decoder saved, such as SSTV's (this fills the gap REMOTE-CONTRACT §12a records: "there is no route to fetch a finished picture") |
| `POST api/decoders/codecs/rescan` | control | look again for codecs, without a restart |
| `GET api/events?kinds=…,decoder` | view | WebSocket. Each result is `{"kind": "decoder", "session", "rev", "t", "type", …}`. Not in the default set. Coalesced to at most 20 items a second for each session. Snapshots (`state`, `meta`) may be dropped by a slow client; text and frames are recovered through `rev`. |

Shapes:

```json
{"id": "ds_3f2a", "decoder": "rtty", "freqHz": 14083500, "params": {"baud": 45.45, "shift": 170, "reverse": false},
 "state": "running", "why": null, "since": "2026-10-22T10:00:00Z", "rev": 812,
 "stats": {"snrDb": 14.2, "offsetHz": -12.5, "cpu": 0.004, "dropped": 0}, "panel": "text"}

{"kind": "decoder", "session": "ds_3f2a", "rev": 813, "t": 1792663200.25, "type": "text", "text": "CQ TEST DE ", "offsetHz": -12.5, "snrDb": 14.0}
{"kind": "decoder", "session": "ds_9a01", "rev": 22, "t": ..., "type": "frame", "frame": "pocsag", "fields": {"address": 1234567, "function": 3, "text": "..."}}
{"kind": "decoder", "session": "ds_1b77", "rev": 9, "t": ..., "type": "meta", "fields": {"ps": "...", "pi": "C201"}}
{"kind": "decoder", "session": "ds_3f2a", "rev": 814, "t": ..., "type": "state", "state": "budget", "why": "cpu_budget"}

{"id": "faad2", "for": ["dabplus", "drm"], "state": "missing", "path": null, "version": null, "why": "not_found"}
```

- `state` is one of `starting`, `running`, `nosignal`, `synced`,
  `outside`, `budget`, `error` or `stopped`. `why` is a code; the server
  sends the sentence from its catalog as `whyText`, and clients prefer
  their own translation of the code (CONTROLLER-CONTRACT §9).
- `api/status` gains `decoders: {"sessions": n, "cpuMax", "codecsMissing": [...]}`,
  without a scan, so a client knows whether to show the view.

### 4.5 How results reach each client

| Client | M1 | Later |
|---|---|---|
| Desktop Radio (Qt) | **Decoders view**: a tab beside Logbook and Memories in the Operate panel's tab row, with session cards (a text terminal for RTTY) and Add (decoder, frequency defaulting to the dial). Right-click on the scope gives "Decode here as ▸". Settings › Decoders: codec status, Open codecs folder, Look again, CPU cap. | panels for frames, pictures and audio (M2-M3) |
| Desktop NB | the same code in ohscore; the view is shown in Radio only for M1 | NB decides |
| Store Radio | `api/decoders` and the `decoder` events (§4.4) | `listen` (M3) |
| Remote Android, including TV | **nothing to change**: the mode-decoder RTTY sends today's `events` | a generic Decoders screen driven by each entry's `panel` hint (`text`, `slots`, `frames` with `columns`, `image`, `meta`), so a new decoder needs no client release. TV is D-pad only, as REMOTE-CONTRACT §12 lays out. |
| Remote Apple | n/a: there is no Radio kind yet | built on the same hints when the kind is |
| `fakeshack.py` (openhamshack-remote) | serves `api/decoders` from fixtures, with one RTTY session streaming text, so Remote work can start before a controller runs it | grows with each family |

## 5. Decision 4: the runtime codec loader

### 5.1 What it loads

| Codec | For | Library names tried | Licence and problem | May we ship it? |
|---|---|---|---|---|
| codec2 | FreeDV (today), M17 later | `libcodec2.so.1.2`, `libcodec2.so.1.0`; `libcodec2.dll`, `codec2.dll`; `libcodec2.dylib`, `libcodec2.1.2.dylib` | LGPL-2.1, no patent problem | **Yes, and we keep doing so** (Brian, 22/10): in the Windows and macOS bundles (`packaging/windows/THIRD-PARTY.txt:84`, `packaging/macos/THIRD-PARTY.txt:80`) and Debian's in the store image (Containerfile line 69). |
| faad2 | DAB+, DRM (AAC, HE-AAC v1/v2, 960-sample frames) | `libfaad.so.2`; `libfaad-2.dll`, `libfaad2.dll`, `libfaad.dll`; `libfaad.2.dylib`, `libfaad.dylib` | GPL-2.0-or-later (`libfaad/decoder.c` header, checked 22/10/2026); AAC patents | **never**: user-installed only. Debian 13 main has `libfaad2` 2.11.2 (apt-cache on shack, 22/10). |
| fdk-aac | DAB+, DRM including xHE-AAC | `libfdk-aac.so.2`; `libfdk-aac-2.dll`, `libfdk-aac.dll`; `libfdk-aac.2.dylib` | Fraunhofer's own licence, which names patent licensing through Via Licensing (`NOTICE`, checked 22/10). **[guess]** GPL-incompatible as Debian and the FSF read it; not in Debian main. | **never** |
| mbelib (or mbelib-neo) | DMR, D-STAR, YSF, P25, NXDN voice | `libmbe.so.1`, `libmbe.so`; `libmbe.dll`, `mbelib.dll`; `libmbe.dylib` | mbelib: ISC (its `COPYRIGHT`) with its own patent notice (README "PATENT NOTICE"). mbelib-neo: GPL-2.0-or-later (OnAir's README). The AMBE/IMBE patents are the problem. **[guess]** not packaged in Debian 13 (no candidate on shack). | **never** |

The same rule covers anything later found to be encumbered (HDC, DRA).
Those are out of this plan.

### 5.2 Where it looks

Every codec is looked for in the same order. The first file that passes
the checks (§5.3) wins.

1. **An explicit path:** `SHACK_CODEC_<ID>` (for example
   `SHACK_CODEC_FAAD2=/path/libfaad.so.2`), for tests and odd installs.
2. **The app's codecs folder**, which the user fills:

   | Form | Folder |
   |---|---|
   | Linux desktop | `~/.local/share/openhamshack-radio/codecs/` (NB: `openhamshack-nb/codecs/`; `$OHS_RADIO_DATA/codecs` when set) |
   | Windows | `%APPDATA%\openhamshack-radio\data\codecs\` |
   | macOS | `~/Library/Application Support/openhamshack-radio/codecs/` (beside the data folder `ohscore/host.py` gives) |
   | Store | `/opt/hostlibs/<codec>/`: the controller's staged host library, mounted read-only (§5.6). There is no user-writable codecs folder on a controller. |

3. **Only for codecs we may ship (codec2 today):** the app's own bundle,
   as `host.find_library` does now. **Never for an encumbered codec**, so
   a stray copy inside a bundle could never be used even if one slipped in.
4. **The system:**
   - Linux: the dynamic loader's own search, by soname (ldconfig cache,
     `/usr/lib/<multiarch>`, `/usr/local/lib`).
   - macOS: `/opt/homebrew/lib`, `/usr/local/lib`, `/opt/local/lib`
     (`ohscore/host.py:132`, `MAC_LIB_DIRS`).
   - Windows: no system search. The loader never calls `LoadLibrary` with
     a bare name, which would open DLL search-order hijacking; it uses
     `LoadLibraryExW(full_path, …, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR |
     LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)` so a codec's own dependencies
     (`libgcc_s_seh-1.dll`, `libwinpthread-1.dll`) are found beside it.
   - The store image: the image's own library path. Only codec2 is there.

**Prior art:** OnAir (GPL-3.0-or-later) works exactly this way:

- codecs folders on each OS;
- "Open codecs folder" and "Look again" in its UI;
- shipped copies searched after the user's;
- a version check for faad2 before use.

See github.com/adswill/OnAir `docs/CODECS.md` "File names and search
order", read 22/10/2026. It also records that FFmpeg's AAC decoder cannot
apply SBR to DAB+'s 960-sample frames, which is why faad2 matters
(§8.5 M3).

### 5.3 Checks before a library is used

- **Symbols and version.** Every entry point is resolved with `dlsym` or
  `GetProcAddress` through `libloading` (ISC). A missing one refuses the
  file, with the name as the reason. Version floors **[guess, verify in
  M1 against real builds]**:
  - faad2: `NeAACDecGetVersion` must report at least 2.8.
    `NeAACDecGetCapabilities` and the presence of `NeAACDecInitDRM`
    decide whether DRM and 960-sample frames can be offered.
  - fdk-aac: `aacDecoder_GetLibInfo` must report version 2 or later
    (xHE-AAC).
  - mbelib: `mbe_printVersion` must give 1.3 or later, and the three
    process functions must be present.
  - codec2: `freedv_open` and the probe freedv.py already runs (its
    docstring: modes are found by opening them).
- **ABI probe in a child process.** The first time the loader sees a file
  (keyed by path, size, mtime and sha256) it runs
  `python -m shack_sdr.codecs probe <id> <path>`. The child loads the
  library and feeds it a fixed known-answer input: a silent AAC frame, a
  zero AMBE frame, a codec2 frame. It checks that the output has the
  right length and is finite.
  - A crash, a hang (5 s) or a wrong answer marks the file `refused` with
    the reason (`crashed`, `timeout`, `bad_output`), cached until the file
    changes.
  - Only a file that passed is loaded into the app's own process.

  This is what stops a wrong-ABI library from taking the app down: the
  one failure §3.5's threads cannot contain. The probe inputs are data,
  not codec code, and are committed under `rust/shack_sdr/testdata/`.
- **Status, never sentences.** Each codec is `found` (with `path` and
  `version`), `missing`, or `refused` (with `why`). The app words it from
  its catalog:
  - "Install faad2 to hear DAB+ stations. Radio never includes it: see
    Help › Codecs."
  - "The libfaad in your codecs folder was refused: it crashed when it was
    tested."

  The rest of a decoder keeps working without its codec. A DAB ensemble
  still lists its services and their data, and a DMR call still shows its
  IDs and talkgroup. That is what OnAir does too (README "Good to know").

### 5.4 macOS will refuse these libraries unless the entitlement changes

**[guess, from Apple's documented behaviour; not yet tried on the Mac
mini]** A notarised app runs under the hardened runtime, and the hardened
runtime includes **library validation**. It refuses to load a library not
signed by the same team. Radio's entitlements hold only the microphone
(openhamshack-nb `packaging/macos/entitlements.plist`), and ohs-libs' kit
is empty on purpose (`packaging/macos/entitlements.plist`).

So today a notarised Radio could load the codec2 we sign, but not:

- Homebrew's faad2;
- a user's mbelib;
- SDRplay's own API (signed by SDRplay).

M1 adds `com.apple.security.cs.disable-library-validation` to Radio's and
NB's entitlements, and proves it on the Mac mini by loading an unbundled
dylib from the codecs folder in a notarised build. The risk this opens is
dylib injection, and it is held down by §5.2: full paths only, from three
known folders. Packet's macOS build presumably has the same gap for its
SDRplay source. **[guess]**: not checked.

### 5.5 The build-time check that nothing encumbered is linked or bundled

One tool in ohs-libs, **`tools/check-encumbered.py`**, with its denylist
as data (`spec/encumbered.json`). Every artefact is checked, and the check
fails the build.

| Layer | What it checks | Where it runs |
|---|---|---|
| Rust dependencies | `cargo deny check bans licenses` with a `deny.toml` that bans crates by name (for example `fdk-aac`, `fdk-aac-sys`, `faad2`, `faad2-sys`, any `mbelib*`, `symphonia-codec-aac`, and Symphonia with its `aac` feature), allows only GPL-3.0-compatible licences, and bans `cc`, `cmake` and `bindgen` in `shack_sdr` (no C is ever compiled into it) | ohs-libs `tools/test.sh`, `build-wheels.sh` |
| Every native binary we build (`.so`, `.pyd`, `.dylib` in each wheel) | its **imports** (`readelf -d` NEEDED, `objdump -p` DLL imports, `otool -L`) name no denylisted library; its **defined or exported** symbols (`nm --defined-only`, PE exports) include none of the codec entry points (`NeAACDec*`, `aacDecoder_*`, `mbe_process*`). The names may appear as strings, because the loader looks them up, but never as linked or defined symbols. | `build-wheels.sh`, after each wheel |
| Every package | no file whose name matches the denylist: `libfaad*`, `*faad*.dll`, `libfdk-aac*`, `*fdk-aac*.dll`, `libmbe*`, `mbelib*` | the .deb and AppImage (`build-deb.sh`, `build-appimage.sh`), the Windows staging folder (`build-windows.ps1`), the macOS `.app` (`build-macos.sh`) |
| Every store image | the same file scan over the image's filesystem (`podman image mount` or `podman export`), plus `dpkg-query -W` showing no denylisted package (`libfaad2`, `libfdk-aac2`) | `tools/store-check.sh`, which beta-build runs on every image |
| The loader itself | a test builds the wheel, installs it in a clean container with no codecs, and checks that `codecs.status()` reports every encumbered codec `missing`. That proves nothing is hidden inside the wheel. | `tools/test.sh` |

**The check's own test** builds a stub library at test time, the way
`shack_packet`'s tests build a stand-in librtlsdr (`tests/sdrhelp.py`).
The stub defines `NeAACDecDecode` and is linked into a dummy extension.
The test asserts the check **fails** on it and passes on the real wheel.
Tests execute behaviour; none of them read source text.

Today's Radio artefacts carry none of these libraries. Its THIRD-PARTY
files and the Containerfile name no AAC or AMBE library (grep, 22/10).
So the check goes in green and stays that way.

### 5.6 Codecs, and the SDRplay API, on a controller: host libraries

Brian, 22/10/2026: a controller gets an encumbered codec from a **host
package** that the platform installs, never from an admin's upload. The
SDRplay API arrives the same way (§6.3). The pieces, in the Dock360
edition, are below.

**What Dock360 allows today.** Checked on dock360
`feature/ohs-edition-030-c`:

- A manifest volume is always a directory the platform creates under the
  module's own data folder. `VolumeSpec` has `name`, `container_path`,
  `mode` (`rw` or `ro`) and nothing that names a host path
  (`src/dock360/manifest.py` `VolumeSpec`; `src/dock360/quadlet.py` writes
  `Volume=<data_dir>/<name>:<path>:<mode>`).
- `runtime.devices` takes only `/dev` paths. `usb_bus` binds
  `/dev/bus/usb` (`quadlet.py`).
- So there is **no declared way to mount a host file or directory** into
  an app.
- `runtime.extra_args` is passed to podman verbatim, unvalidated
  (`manifest.py` `RuntimeSpec.parse`; `quadlet.py` `PodmanArgs={arg}`), so
  a manifest *could* bind any host path. We must not build on that.
  Separately from this plan, the platform owner should consider refusing
  `extra_args` in signed `shack-` modules: as it stands, any one of them
  can mount anything.

**1. The named privileged operations** (`src/dock360_helper/ops/hostlib.py`):

| Verb | Arguments (validated) | Does |
|---|---|---|
| `hostlib.list` | none | for each allow-listed name: installed or not, version, staged files with sha256, when, by whom |
| `hostlib.install` | `{"name": <one of the allow-list>}`, plus for `sdrplay-api` only `{"version": <one of its pinned versions>}` | installs and stages that one library (below). Refused while any app is on the air (the busy gate's rule for updates). |
| `hostlib.remove` | `{"name"}` | empties its staged folder and removes the package it installed. It never removes a package that was on the host before. |
| `hostlib.restage` | `{"name"}` | copies the files again after an `apt.upgrade` (run by the platform after every upgrade, so the staged copy follows Debian's security updates) |

- **The allow-list is code in the helper**, not data the web tier sends,
  as `apt.py`'s fixed command lines are. Each entry fixes:
  - the Debian package, with its archive area and component;
  - the file patterns to stage, matched against `dpkg -L` of that package
    only;
  - for SDRplay, the vendor's installer URL, pinned versions and sha256.
- **Nothing else from the request reaches a command line.**
- **The arguments are logged** through the helper's redaction (GUIDE §5).

**2. Staging.** Each library is copied, root-owned with mode 0644, into
`/var/lib/dock360/hostlibs/<name>/`. A `stamp.json` beside it records the
package, version, files and hashes.

- Files are written beside the old ones and renamed into place. The
  folder itself is never replaced, because a bind mount holds the folder:
  replacing it would leave the app looking at the old, deleted one.
- **Why a staged copy, not a bind of `/usr/lib/<multiarch>/libfaad.so.2`.**
  A bound file pins its inode, so after apt replaced the library the
  container would keep the old one until a restart, and never learn it
  had changed. A bind of all of `/usr/lib` would show the app everything
  on the host.

**3. The manifest key.** The `openhamshack:` block gains
`host_libraries: [sdrplay-api, faad2, fdk-aac]`.

- Validation is strict: each name must be on the edition's allow-list, the
  same list the helper holds.
- For each name, quadlet writes
  `Volume=/var/lib/dock360/hostlibs/<name>:/opt/hostlibs/<name>:ro`, and
  sets `SHACK_HOSTLIBS=/opt/hostlibs` in the container's environment.
- The platform creates every declared folder, empty, when the module is
  installed. The mount therefore exists from the first start, and a
  library installed later appears inside the running container with no
  restart. The loader's "Look again" finds it.
- `SPEC_VERSION` rises (CONTROLLER-CONTRACT §8's rule for manifest
  additions).

**4. How an administrator triggers it.**

- **Where:** the controller's admin interface gains an **Optional
  libraries** section (on the Hardware page, or each app's page).
  - It lists what the installed apps declared in `host_libraries`, each
    with its state from `hostlib.list`, what it is for ("DAB+ and DRM
    sound in Radio"), and a short licence and patent note.
  - Install and Remove buttons are admin-only (`403 not_admin`
    otherwise; CONTROLLER-CONTRACT §9) and audited.
- **The app cannot trigger root work.** Radio, and so a stolen app token,
  can only show "Ask your controller's administrator to install faad2
  (Controller › Optional libraries)". Radio's `api/decoders` `codecs`
  entries carry `"host": true` and the state, so Remote can say the same.
- **Later:** the same three verbs behind admin-only routes under
  `/api/shack/v1/hostlibs` for a Remote admin screen. Not in M1.

**5. What each library is on Debian 13** (the controller's: podman 5.4 on
Debian 13 per `quadlet.py`'s comment). Checked 22/10/2026 on
packages.debian.org and sources.debian.org:

| Name | Debian | Result on a controller |
|---|---|---|
| `faad2` | `libfaad2` 2.11.2-1 in **main** (trixie; 2.11.4 in forky and sid) | `hostlib.install faad2` is plain `apt-get install libfaad2`. Covers DAB+ and DRM's plain AAC and HE-AAC; not xHE-AAC. |
| `fdk-aac` | `libfdk-aac2t64` 2.0.3-1 in **non-free** (trixie) | needs the non-free component, which a controller does not have. The op adds one pinned source (`/etc/apt/sources.list.d/openhamshack-fdk-aac.sources`, non-free only, with an apt preference pinning everything from it to -1 except `libfdk-aac2t64`), installs, and removes both again on `hostlib.remove`. It is the only route to xHE-AAC (DRM). **Needs Brian:** §10 A. |
| `mbelib` | **not packaged** in Debian at all (no source package by that name or `libmbe` on sources.debian.org or packages.debian.org) | **not available on a controller** under this rule. DMR, D-STAR, YSF, P25 and NXDN decode everything but voice there, and the UI says so. A desktop user installs it as OnAir's users do. **Needs Brian:** §10 B, whether to allow an exception. |
| `codec2` | in the image already (`libcodec2-1.2`) | not a host library |
| `sdrplay-api` | not packaged by anyone; SDRplay publishes a `.run` installer | §6.3 |

**6. The loader, unchanged.**

- On a controller, step 2 of §5.2 is `/opt/hostlibs/<name>/`.
- The child-process probe (§5.3) still runs on first sight of each file,
  which is what catches a host library built against a different glibc
  from the image's, if the two Debian versions ever drift apart.
- The build check (§5.5) still scans the image. Host libraries are never
  in it, so it stays green.

## 6. Decision 5: SDR sources and the broker

### 6.1 The three families

| Family | Linux desktop | Windows | macOS | Store (controller) | Transmit |
|---|---|---|---|---|---|
| **Pluto / LibreSDR** | `pluto` (libiio), unchanged | unchanged (ADI's libiio 0.26 bundled) | unchanged (libiio built from source) | `pluto-1` as today. **Add `libresdr-1` and the `libresdr` class** to `broker_devices`: the broker has it as a class of its own, and Radio does not declare it. | unchanged: Radio's own driver, the lease, the broker's `onair` (SERVER-API "Transmitting") |
| **SDRplay RSPdx** | new `sdrplay`: the user's installed API through `shack_sdr`'s ctypes binding (moved from `shack_packet.sdr.sdrplay`) | the same; the API from SDRplay's own Windows installer, never bundled | the same, which needs §5.4's entitlement | M1: the direct `sdrplay` kind (`sdrplay-1`), with the API from the controller's staged host library (§6.3). The image stops carrying the API and SoapySDRPlay3. | receive only |
| **RTL-SDR** | new `rtlsdr`: Debian's `librtlsdr0` (a .deb Recommends), its udev rule, and the DVB driver kept off it | new `rtlsdr`: `rtlsdr.dll` and `libusb-1.0.dll` bundled; the user fits the WinUSB driver once with Zadig, and the setup page says how (wording from `shack_packet/sdr/rtlsdr.py`) | new `rtlsdr`: `librtlsdr.dylib` and `libusb-1.0.dylib` bundled, install names rewritten | new `rtlsdr` (the image adds `librtlsdr0`); manifest gains `rtlsdr-1` (`usb_id: 0bda:2838`, `claim: runtime`) and `rtlsdr` in `broker_devices` | receive only |
| **Others** (Airspy, HackRF as a receiver, …) | `soapy`, as today | **not in M1**: listed greyed, with the sentence "This radio needs SoapySDR, which Radio for Windows does not include yet" | the same, for macOS | `soapy` where the image has the module (only SDRplay today) | receive only |

Why move Packet's bindings rather than bundle SoapySDR on Windows and
macOS:

- they already exist, with tests against stand-in libraries;
- they need nothing compiled for each Python version (the reason
  `rtlsdr.py` gives for ctypes over pyrtlsdr);
- SoapySDR's Python bindings are SWIG modules that would have to be built
  for each frozen Python;
- the SDRplay API is the user's own install on every form (Brian,
  22/10/2026), and a ctypes binding needs only its C library at run time.
  SoapySDRPlay3, by contrast, has to be compiled against SDRplay's
  headers.

The move happens inside one repository (ohs-libs), and `shack_packet.sdr`
re-exports the moved names so Packet changes nothing. It needs the Packet
session's agreement first (GUIDE §6: one owner per repository).

Licences of what we bundle: librtlsdr is GPL-2.0-or-later and libusb is
LGPL-2.1; both are compatible with Radio's GPL-3.0-or-later and are listed
in THIRD-PARTY and `sources.txt`. **[guess]**: check the exact librtlsdr
release's headers when it is vendored.

### 6.2 Claim, release, rates and gain

**Claim and release** follow the store server's existing broker client
(`ohscore/server/shack.py`):

- claim on start (`mode: rx` for both receivers);
- heartbeat;
- release on `api/stop`;
- `api/shack/release` on a hand-over;
- re-claim with `reclaim: true` after a broker restart (GUIDE §5).

The claim's `access` gives the RTL's USB `busPath` and serial
(CONTROLLER-CONTRACT §7.2). The driver opens that device and no other, by
serial where the dongle has one.

**Decoder sessions never claim anything.** They live inside Radio's one
claim, and stopping the radio stops them.

**Sample rates:** each source reports a list (`rates()`), and the Settings
page and `api/spec` offer only those.

| Radio | M1 rates | Notes |
|---|---|---|
| RTL-SDR | 1.2, 2.4 MS/s (2.048 in M3) | above 2.4 drops samples on many hosts **[guess]** |
| RSPdx | 2.4 MS/s (2.048 in M3) | refuses 1.2 (`soapy.py` docstring) |
| Pluto | 1.2, 2.4 MS/s | unchanged |

**Gain:** Radio keeps one control (`rxGainMode` and `rxGain`) and each
source maps it, with its own ranges reported in the device's `caps`
(DESIGN-HAM §4.1):

- **RTL-SDR:** automatic (the tuner's AGC) or the nearest tuner step. The
  RTL2832's own AGC stays off, because it pumps on strong signals
  (`rtlsdr.py`).
- **RSPdx:** automatic (the API's 50 Hz AGC) or a gain reduction. The LNA
  state becomes a setting of its own, `sdrplayLna`, in place of today's
  `rfgain_sel=4` in `soapyArgs` (GUIDE §5).
- **Pluto:** unchanged.

Bias-T is never touched by Radio (`rtlsdr.py`, `sdrplay.py`: it powers
whatever is on the socket).

**Safety.** Both new sources are receive-only by construction.
`shack_packet`'s Pluto source, which also holds the transmitter quiet, is
**not** used by Radio: Radio keeps its own Pluto driver, whose transmit
path, lease and broker `onair` are unchanged. A key-up on an RTL or an RSP
is refused before the broker is asked ("This radio can only receive",
SERVER-API "What it is not").

### 6.3 The SDRplay API: the user's own, on every form

Brian, 22/10/2026: use if installed, everywhere.

| Form | Where the API comes from | What Radio shows without it |
|---|---|---|
| Linux desktop | SDRplay's own installer, which puts `libsdrplay_api.so.3` in `/usr/local/lib` and runs its service under systemd **[guess: check the 3.15 installer's layout]** | the RSP listed, greyed: "Install SDRplay's API to use this radio" (catalog text, with a link to sdrplay.com) |
| Windows | SDRplay's installer ("SDRplay API 3.x", which installs and starts its service), found at its install path, or by `SHACK_SDRPLAY_LIB` (as `shack_packet/sdr/sdrplay.py` does today) | the same |
| macOS | SDRplay's installer. Needs §5.4's entitlement, because SDRplay signs the library and we do not. | the same |
| Store (controller) | the host library `sdrplay-api` (§5.6), mounted at `/opt/hostlibs/sdrplay-api/`. `store/radio/entrypoint.sh` starts `sdrplay_apiService` from there when it is present. Today it starts `/usr/local/bin/sdrplay_apiService`. The service still runs inside the container, because it must share the client's `/dev/shm` (GUIDE §5). | the same sentence, as "Ask your controller's administrator to install SDRplay's API (Controller › Optional libraries)" |

**Is anything bundled today?**

- **Desktop:** no. Nothing in openhamshack-nb `packaging/`,
  `tools/build-deb.sh`, `build-appimage.sh`, `build-macos.sh` or the
  Windows specs names it (grep, 22/10).
- **Store:** yes, and it comes out.
  - The image carries it: `store/radio/Containerfile`'s `sdrplay` stage,
    `tools/build-store.sh`'s `SDRPLAY_DIST`, `tools/vendor/sdrplay.lock`.
  - All of those go.
  - So does the SoapySDRPlay3 build, which needs SDRplay's headers.
  - The image then carries only Debian packages and our own GPL code.

**`hostlib.install sdrplay-api`** is the one host library without a
Debian package.

- **The allow-list pins** SDRplay's published installer URL, the versions
  we have tested and each one's sha256: today's `tools/vendor/sdrplay.lock`
  hash moves there.
- **The op:**
  - downloads the installer;
  - checks the hash;
  - **unpacks it without running it** (`--noexec --target`, as the
    Containerfile does now: the installer wants systemd and udev, and
    running it on the host would start a second service that fights the
    container's for the radio);
  - stages `libsdrplay_api.so.3*`, `sdrplay_apiService` and SDRplay's
    licence text.
- **A controller with no route out:** the same op accepts the installer
  file, checked against the same pinned hashes. That is SDRplay's own
  file proved by hash, not an arbitrary library.
- **The udev rule:** the RSP's rule stays `udev.allow`, as today
  (GUIDE §5).
- **Needs Brian:** §10 C. The licence acceptance and the download on the
  administrator's behalf.

**Publishing.** With the API and SoapySDRPlay3 out of the image, store
Radio carries nothing whose redistribution is in doubt. GUIDE §5's "Brian
decides before that package goes on a public feed" is answered, and store
Radio can go on the feeds from the first release built this way.

**Order of work, so ohs-box never loses its radio:**

1. Ship the platform release with `hostlib.*`, `host_libraries` and the
   Optional libraries page.
2. Install `sdrplay-api` on the controller.
3. Only then ship a Radio image without the API.

An image without the API, on a controller without the host library, shows
the RSP greyed with the sentence above. That is a clear failure, not a
silent one.

## 7. Decision 6: testing with no transmitter

### 7.1 Where the signals come from

| Source | What | Where it lives | Licence |
|---|---|---|---|
| **Our generators** (Rust, `shack_sdr::testsig`) | each mode's encoder, made for tests (RTTY first), plus channel models: AWGN, Watterson fading (ITU-R F.1487 "moderate" and "poor"), frequency offset and drift, clock error, selective fading on mark or space, impulse noise, an adjacent signal | in the crate; the tests make their signals at run time | ours, GPL-3.0-or-later |
| **The Python decoder as reference** | `ohscore/modes/rtty.py`. Its scores on the synthetic sweep and the corpus are captured as golden numbers **before** it is removed, so the Rust decoder is held to "never worse" ever after | numbers committed in openhamshack-nb tests | ours |
| **Brian's and our recordings** | RTTY contest and DWD weather RTTY (50 Bd, 450 Hz, continuous on HF, **[guess]** still on its published frequencies in 2026), recorded with the RSPdx or RTL as SigMF, plus KiwiSDR captures taken as the CW corpus was (GUIDE §5) | **iqlib** on office (`iqlib put` with the truth beside it). Today iqlib has no RTTY recording (`iqlib list --mode rtty`: none, 22/10). | ours to use. Recordings of **broadcast** content (FM, DAB, DRM from M3 on) carry copyrighted programme material, so they **never go into a repository**, which is public on GitHub (GUIDE §6). |
| **Public sample files** | sigidwiki, OnAir's sample library (files.on-air.dev), others per mode | iqlib only, with the source URL and licence in its metadata. **Never committed**: their terms vary, and the hubs are mirrored publicly. | per file; anything without a stated licence is for private testing only |

A test that needs an iqlib recording **skips with a sentence** when the
file is absent (the CW corpus does this), so the per-commit suite needs
only what is in the repository.

### 7.2 Accuracy targets for RTTY in M1

**[guess, to be set by the first week's measurements: the theory below
says where they should land]**

- **AWGN, 45.45 Bd and 170 Hz, SNR in 2.5 kHz:** character error rate at
  most **1 % at −5 dB**.
  - The ideal non-coherent FSK reaches a 1.5 × 10⁻³ bit error rate, about
    1 % CER at 7.5 bits a character, near −7 dB.
  - −5 dB allows 2 dB of real-world loss, about what mature RTTY decoders
    show.
- **Fading:** Watterson "moderate": CER at most **5 % at +5 dB**.
- **Never worse than `rtty.py`** at any step of the sweep, at any speed or
  shift both support.
- **Noise only:** at most **1 false character a minute** with the default
  squelch. `rtty.py`'s docstring explains why this matters: noise left in
  FIGS turned our own "CQ CQ DE" into ":1 :1 $3".
- **Real recordings:** on the contest corpus, at least as many callsigns
  copied whole as `rtty.py`. Report fldigi's copy by hand as a reference.
  It is not automated: fldigi has no batch decoder. **[guess]**

### 7.3 CI time

- **Per commit:**
  - `cargo test --release` with the synthetic sweep at a coarse grid:
    under 60 s in the build container **[guess]**;
  - the Python adapter and engine tests: under 30 s;
  - the server's `api/decoders` tests: under 30 s.
- **Nightly:** a beta-build step `score-sdr` runs the fine sweep and the
  iqlib corpus on office (12 workers, as `tools/skim_eval.py` does for the
  CW skimmer). It writes a one-line summary and fails on a regression
  against the committed numbers. **[guess]** about 5 minutes for RTTY.

### 7.4 Hardware tests, all receive only

- An RTL-SDR on the desktop on Linux, Windows (VM 130 has no USB
  passthrough **[guess]**, so Brian's own Windows PC) and macOS (the Mac
  mini).
- The RSPdx through store Radio on a controller.

Nothing keys. M1 changes nothing that transmits, so the dummy-load rules
are not engaged. RTTY's Enable TX encoder is untouched.

## 8. Milestone 1: exact scope and "done"

### 8.1 Scope

1. **The framework:**
   - `shack_sdr` (Rust and Python halves), its wheels on every platform,
     and the vendoring;
   - the host with its threads and budget;
   - the catalogue, including the Python-backed decoders already shipping
     (CW, FT8/FT4/Q65/JS8 as mode decoders).
2. **The codec loader:**
   - all four codec entries, though nothing in M1 needs faad2, fdk-aac or
     mbelib;
   - the search paths, the child-process probe and status;
   - codec2's lookup moved onto it, keeping `freedv.py`'s ctypes binding
     but taking the library's path from `shack_sdr.codecs`;
   - the build-time check on every artefact;
   - the macOS entitlement.
3. **Host libraries on the platform** (§5.6), Dock360 edition work for
   its owning session:
   - `hostlib.list`, `install`, `remove` and `restage`;
   - the `host_libraries` manifest key;
   - the Optional libraries page;
   - allow-list entries `sdrplay-api` and `faad2`. faad2 has no user until
     M3, but proves the apt path. `fdk-aac` waits for §10 A.
4. **SDR sources:**
   - `rtlsdr` and `sdrplay` (the direct API) on all three desktop OSes and
     in store Radio;
   - the store image stops carrying the SDRplay API and SoapySDRPlay3
     (§6.3);
   - `rtlsdr` and `libresdr` declared in store Radio;
   - per-device rate lists and gain mapping.
5. **The decoder panel:**
   - desktop Radio's Decoders view, "Decode here as", and Settings ›
     Decoders;
   - store Radio's `api/decoders` and `decoder` events;
   - `fakeshack.py` fixtures.
6. **One decoder end to end: RTTY in Rust.**
   - 45.45, 50 and 75 Bd; 170, 425, 450 and 850 Hz; normal or reversed;
   - ITA2 with the US-TTY figures (as `rtty.py`), unshift-on-space, AFC
     and squelch;
   - IQ and audio inputs;
   - as the mode decoder (NB and Radio) and as fixed sessions.
   - The Python `rtty.Decoder` is removed once its golden numbers are
     captured; its `Encoder` stays, because transmit is unchanged.

**Out of M1:** any other decoder, the Rust channeliser, audio output from
decoders, background "decode everything" scanning, and Remote screens
beyond the unchanged mode path.

### 8.2 Why RTTY first, not POCSAG

| | RTTY | POCSAG |
|---|---|---|
| Can we check it against something we already have? | yes: `rtty.py`, its tests, its simulator signals (`ohscore/devices/simsignals.py`) | no |
| Signals to test on in the UK, any day | plenty: contests most weekends, DWD weather RTTY around the clock **[guess]** | amateur paging (DAPNET) is sparse **[guess]**; commercial paging must not be decoded and disclosed in the UK (Wireless Telegraphy Act 2006 s.48; **[guess]**, not legal advice) |
| Does it test the IQ path? | yes, as a fixed session on channel IQ | yes |
| Does it test the audio path? | yes: the mode decoder on Icom, Flex and Digital Modes audio, same decoder | only on discriminator audio |
| Gives users something new | multiple RTTY channels beside the dial, 50 and 75 Bd, the wider shifts (`rtty.py` is 45.45/170 only) | a new mode |
| What it leaves for M2 | the FM discriminator in Rust (POCSAG, APRS, SSTV) | — |

### 8.3 "Done" checklist

**Framework**

- [ ] `ohs-libs/rust/` is a Cargo workspace with `shack_sdr`.
  `cargo test --release` and `cargo deny check` are green in the pinned
  build container, and `tools/test.sh` runs both.
- [ ] Wheels are built for Linux x86_64 and aarch64, Windows x64 and macOS
  universal2, with round trips where they can run (§2.3) and SHA256SUMS.
  The ohs-libs release is 0.2.0.
- [ ] The host:
  - `feed` never blocks: a test saturates a ring and checks the counted
    drops;
  - the GIL is released: a test runs Python work in parallel with decoding;
  - a deliberately panicking test decoder gives `state: error` and nothing
    else;
  - `close()` joins within 1 s;
  - the budget pauses the newest session at the cap.
- [ ] Engine: `Engine.decoders`, the `decoders` feed, sessions saved and
  restored, and the `outside` state on a retune.
  - The NB and Radio suites are green, with NB's RTTY on the Rust decoder.
  - `tests/test_core_isolation.py` still holds.
- [ ] The one-line heap experiment: start Radio's engine on the simulator
  with and without `keep_heap()` and compare the `cpu` status. If it
  helps, adopt it in ohscore as a change of its own.

**Codec loader**

- [ ] codec2, faad2, fdk-aac and mbelib have entries.
  - The search order is §5.2's on each OS.
  - The child-process probe is tested with stand-in libraries built at
    test time: a good one, one missing a symbol, one that crashes, one that
    hangs and one with a wrong version.
  - `freedv.py` finds codec2 through it.
- [ ] `check-encumbered.py` runs on every wheel, .deb, AppImage, Windows
  staging folder, macOS `.app` and the store image. Its own test fails on
  the `NeAACDecDecode` stub (§5.5).
- [ ] macOS: `disable-library-validation` is in the entitlements, and a
  notarised build loads a dylib from the codecs folder on the Mac mini.
  Windows: a DLL from the codecs folder loads under Smart App Control as
  shipped. **[guess]** whether SAC blocks an unsigned user DLL; test it.

**Sources**

- [ ] `rtlsdr` and `sdrplay` are Radio device kinds on Linux, Windows and
  macOS, from `shack_sdr`'s moved bindings. `shack_packet.sdr` re-exports
  them and Packet's tests are green.
- [ ] The Windows bundle carries `rtlsdr.dll` and `libusb-1.0.dll`; the
  macOS bundle carries their dylibs; the .deb Recommends `librtlsdr0`.
  THIRD-PARTY and `sources.txt` are updated.
- [ ] Store Radio:
  - the image has `librtlsdr0`;
  - `module.yaml` declares `rtlsdr-1` and `libresdr-1`, with `rtlsdr` and
    `libresdr` in `broker_devices`;
  - the claim, release and re-claim tests cover `rtlsdr`.
- [ ] SDRplay is use-if-installed everywhere:
  - The store image carries no SDRplay file and no SoapySDRPlay3.
    `check-encumbered.py`'s file scan gains `libsdrplay_api*` and
    `sdrplay_apiService`, so it cannot come back unnoticed.
  - `entrypoint.sh` starts the service from `/opt/hostlibs/sdrplay-api/`.
  - Without it, every form shows "Install SDRplay's API to use this
    radio".
- [ ] **Platform host libraries** (§5.6):
  - the helper verbs, with tests that every argument outside the
    allow-list is refused and that nothing but the pinned files is staged;
  - `host_libraries` validation and the quadlet `Volume=` lines (tested
    with `quadlet -dryrun`, as `quadlet.py`'s comments do);
  - the folders created at module install;
  - `hostlib.restage` after `apt.upgrade`;
  - the admin page, admin-only and audited.
  - A platform release carrying them goes **before** the Radio image
    without the API (§6.3's order). ohs-box's RSPdx works through the host
    library: a receive-only check, with Brian's approval for the session.

**Panel and API**

- [ ] Desktop Radio: the Decoders view, "Decode here as", and Settings ›
  Decoders (codec status, Open codecs folder, Look again, CPU cap). Every
  string is in the catalogs and `shack-i18n-check` is clean. The tier
  layouts (Full, Compact, Tight) hold, checked by the existing layout
  tests.
- [ ] Store: `api/decoders` exactly as SERVER-API.md now says, in the same
  commit as the code, with `tests/test_server_decoders.py` covering:
  - levels (view reads, control starts and stops);
  - every error code;
  - `rev` recovery;
  - `outside`;
  - the session limit.
- [ ] `tools/store-check.sh radio` proves `shack_sdr` loads, RTTY decodes a
  synthetic over inside the image (read-only root, no capabilities), and
  the encumbered scan is clean.
- [ ] `fakeshack.py` serves `api/decoders` fixtures (openhamshack-remote).
- [ ] ENGINE-API.md (methods, `decoders` feed) and SERVER-API.md
  (`api/decoders`) are updated. REMOTE-CONTRACT §12 gains a short 12d:
  "the mode decoder is unchanged; `api/decoders` exists; Remote does not
  use it yet".

**RTTY**

- [ ] §7.2's synthetic targets are met.
  - "Never worse than `rtty.py`" holds on the golden numbers captured
    before its removal.
  - At most 1 false character a minute on noise.
- [ ] The corpus is in iqlib with its truth: one contest hour and an hour
  of DWD weather RTTY at least. It is scored, and the summary is
  committed.
- [ ] Live, receive only, it decoded:
  - in desktop Radio with an RTL-SDR on Linux, Windows and macOS;
  - in store Radio on a controller with the RSPdx (ohs-box, if Brian
    approves the session, because it is live hardware).
- [ ] CPU measured on an N150 in Radio's image with `--cpus=1` (GUIDE §5:
  bench in the image, on the target). Four sessions plus the mode decoder
  stay under 10 % of a core. ohs-box is an i5-9400T, so this needs an N150
  host (PLATFORM-PLAN D11's second N150, or the workshop's only with
  Brian's say-so).

**Release**

- [ ] openhamshack-nb pins `shack-sdr` 0.2.0 (`tools/vendor/shack-sdr.lock`).
- [ ] NB and Radio are released together through `tools/release-all.sh`
  (Linux, Windows and macOS built and proven).
- [ ] Store Radio is built, checked and uploaded to Brian's controllers
  (the store Radio built this way may go on a public feed: §6.3). There
  are release notes for both.

### 8.4 The change checklist (GUIDE §3) for M1

1. **Contract:** yes.
   - openhamshack-nb ENGINE-API.md and SERVER-API.md (`api/decoders`);
   - openhamshack-remote REMOTE-CONTRACT §12d (a note only);
   - ohs-libs: a README for `shack_sdr` (the Python and Rust contract);
   - REPO-LAYOUT §2 and §3 (`rust/` becomes real; a `shack-sdr` row in
     the artefacts table).

   CONTROLLER-CONTRACT §8: the `host_libraries` manifest key (§5.6). The
   broker classes already exist.
2. **Server:**
   - store Radio (`ohscore/server/`, shared with NB's store form);
   - the platform (Dock360 edition): the `hostlib.*` helper operations,
     quadlet mounts and the Optional libraries page, owned by the platform
     session.
3. **Fake:** `fakeshack.py` fixtures. The Dock360 fakebox: n/a (it serves
   the QO-100 WB API).
4. **Android, including TV:** n/a for M1. The mode path's `events` shape is
   unchanged, and the Decoders screen is M2.
5. **Apple:** n/a. There is no Radio kind on iPhone, iPad or Apple TV yet.
6. **Desktop:** Radio and NB, which share ohscore, on all three OSes. No
   pinned commit to refresh: one repository.
7. **Hardware:** RTL-SDR and RSPdx through the broker in the store; on the
   desktop, opened directly. Safe-off: none needed, receive only (the
   broker's classes say `tx: false`).
8. **Transmit:** n/a. Nothing keys; RTTY's encoder and Enable TX are
   unchanged.
9. **Release:**
   - ohs-libs 0.2.0, cut by its owner;
   - NB and Radio desktop, cut by the NB session (GUIDE §6: "The NB
     session also cuts Radio releases");
   - the platform release with host libraries, **before** store Radio;
   - store Radio, which can now go on a public feed (§6.3).

   VERSION files move only at release (CLAUDE.md).

### 8.5 Milestones 2-5 in outline

**M2: the amateur extras.**

- **PSK31/63:** ported from `psk.py`, with the Python decoder as reference
  as for RTTY.
- **SSTV:** ported from `sstv.py`, through the Image output and
  `api/decoders/files`.
- **WSPR:** a port of WSJT-X's `wsprd` in **ohsdigi**, with Radio's
  WSPRnet upload off by default (DESIGN-HAM §5.5).
- **POCSAG:** 512/1200/2400 Bd, BCH(31,21), the FM discriminator in Rust.
  Bookmarks default to amateur paging (DAPNET).
- **APRS:** `shack_packet`'s demodulators as a Python-backed session.
- **FreeDV:** codec2 through the shared loader.

Also in M2:

- Remote's generic Decoders screen (Android, then Apple when its Radio
  kind exists);
- `fdk-aac` added to the host-library allow-list, if §10 A allows it.

**Riskiest item:** fixed sessions against a moving span. Radio's span
follows the dial, so every background session goes `outside` whenever the
operator tunes away. M2 must choose between:

- pinning the span while sessions run;
- a second receiver for the background (an RTL beside the main radio),
  which the engine's one-device model cannot do today.

That choice reaches into the engine's device model.

**M3: broadcast.**

- **Wideband FM stereo with RDS:** a 240 kHz channel, pilot PLL, 50 or
  75 µs de-emphasis by region, 1187.5 bit/s RDS. Read `redsea` (MIT) for
  RDS.
- **Synchronous AM.**
- **DAB+:** 2.048 MS/s, Mode I OFDM, FIC and MSC, RS(120,110) on the
  superframe, audio through faad2 or fdk-aac.
- **DRM:** robustness modes A to D, audio through fdk-aac for xHE-AAC.

Also in M3:

- the channeliser moves to Rust (§3.3);
- `decodeThreads` above 1 on the desktop;
- `listen`.

**Riskiest item:** the audio contract. Everything assumes **12 kHz mono**:

- the engine's audio (DESIGN.md);
- `api/audio/rx` (`audio/L16; rate=12000; channels=1`, SERVER-API);
- Remote's PCM players;
- `shack_rec`'s FLAC recordings.

Broadcast needs 48 kHz stereo. That is a contract change across desktop,
store, Android, Apple and recordings: the format is announced up front
(GUIDE §2 "Audio"), and clients that only take 12 kHz mono get a
downmix. A close second is DAB+'s HE-AAC with 960-sample frames: FFmpeg
cannot apply SBR to them (OnAir `docs/CODECS.md`), so only a user's faad2
or fdk-aac gives full audio. **[guess]**: whether Debian's `libfaad2`
2.11.2 handles them needs testing early.

**M4: digital voice.**

- **DMR** (TS 102 361: 4FSK, two slots, BPTC and Golay);
- **D-STAR** (GMSK, header and slow data, written from JARL's
  specification);
- **YSF** (DN and VW);
- **P25 Phase 1** (C4FM, NID, Trellis);
- **NXDN** (48 and 96).

Each runs on a 12.5 or 6.25 kHz channel at 48 kS/s. Calls, IDs,
talkgroups and data work with no codec; voice comes from the user's
mbelib. An encrypted call is reported as encrypted and nothing more:
there is no setting to decode it.

**Riskiest item:** the voice path is the one part we can neither ship
nor test with the real library in CI.

- mbelib has no Debian package, so every desktop user builds it, and a
  controller has no voice at all unless §10 B allows an exception.
- Its AMBE+2 quality is uneven **[guess]**.
- Our CI can only use a stand-in library with the same ABI.

The probe (§5.3) and the "everything but voice works" rule must carry the
product. The legal note for non-amateur services (public safety, business
radio) also has to be settled: §9.3.

**M5: CW in Rust** (Brian, 22/10/2026). A port of ohs-libs `shack_cw`:

- the classic engine;
- the neural engine's inference (the causal TCN and CTC, with weights
  exported from the existing Python training in `tools/cw_neural`, which
  stays Python);
- the language-model beam search;
- the skimmer's tracking and its callsign rules.

All of it sits behind the same `Decoder` trait, so the skimmer could leave
its child process for the host's threads.

**`shack_cw` stays the live decoder until the port beats it** on the
benchmarks that already exist:

- the decoder bench's 136 clips and beacon CER;
- the KiwiSDR corpus;
- `shack_cw.skim.recovery` per call;
- `tools/skim_eval.py`'s replayed spot rule on the 57 RBN-labelled
  recordings;
- held-out real validation (`tools/cw_neural/realval.py`).

The GUIDE §5 CW entries say why only real recordings count. Then Radio,
Icom and Flex switch together, and `shack_cw`'s decoders retire.

**Riskiest item:** the neural engine's equivalence. Training stays in
Python while inference moves to Rust, so every checkpoint must give the
same outputs in both, to within float tolerance. The LM's commit
behaviour, measured to the output (GUIDE §5: "Commit beams output by
output"), must survive the port exactly. A test runs both on
`tools/cw_lm/dump.py`'s saved network outputs and compares the text.

## 9. Licensing

Radio is **GPL-3.0-or-later**: openhamshack-nb `LICENSE` is the GPL
version 3, and `store/radio/module.yaml:29`, `rust/ohsdigi/Cargo.toml:10`
and `pyproject.toml:18` all say `-or-later`. ohs-libs is the same
(REPO-LAYOUT §2). We may read GPL code and port it with credit (the
original copyright line kept, as ohsdigi keeps WSJT-X's:
`docs/digimodes-rust.md`), provided its licence is compatible with
GPL-3.0-or-later.

### 9.1 Safe to read and port (with credit)

Licences checked 22/10/2026 through GitHub's API and the file headers
named. Where only GitHub's summary was seen, the headers must be checked
before porting (**[verify]**): GitHub says "GPL-2.0" for both `-only` and
`-or-later`.

| Reference | Licence | For |
|---|---|---|
| OnAir (github.com/adswill/OnAir) | GPL-3.0-or-later (README "License"). Its logo is not covered, and `third_party/` is per file. | ideas in every family; the codecs-folder approach (§5) |
| fldigi | GPL-3.0 **[verify -or-later in the headers]** | RTTY, PSK |
| WSJT-X (`wsprd`) | GPL-3 (ohsdigi already ports it) | WSPR |
| multimon-ng | GPL-2.0-or-later (`pocsag.c` header) | POCSAG |
| direwolf | GPL-2.0-or-later (`src/demod_afsk.c` header) | APRS (already in `shack_packet`) |
| redsea | MIT | RDS |
| slowrx | ISC | SSTV |
| welle.io | GPL-2.0-or-later (`src/backend/ofdm-decoder.cpp` header) | DAB OFDM, FIC, MSC |
| dablin | GPL-3.0 | DAB+ superframes, PAD |
| qt-dab, dab-cmdline | GPL-2.0 per GitHub **[verify -or-later in the headers]** | DAB |
| SDR++, SDRangel | GPL-3.0 | demodulators, DSP |
| liquid-dsp | MIT | DSP primitives (bits already ported for HSmodem) |
| GNU Radio, gr-rds | GPL-3.0-or-later **[verify gr-rds]** | RDS, general DSP |
| Dream (DRM) | **[verify]** | DRM |
| OP25 | **[verify]** | P25 framing |
| dsd-fme | **[verify]**: its `COPYRIGHT` is mixed | DMR, NXDN, YSF framing, file by file |
| Specifications: ETSI EN 300 401 (DAB), TS 102 563 (DAB+), ES 201 980 (DRM), IEC 62106 (RDS), TS 102 361 (DMR), TIA-102 (P25), JARL's D-STAR specification, ITU-R M.584 (POCSAG), BS.450 (FM stereo), F.1487 (HF channel models) | free to read; ETSI's are free downloads **[guess for each]** | the first source wherever one exists |

### 9.2 Only ever loaded at run time: never ported, linked or bundled

| Library | Why |
|---|---|
| faad2 | AAC patents. Its GPL-2.0-or-later licence is compatible; the patents are the problem. |
| libfdk-aac | AAC patents, and its own licence, GPL-incompatible as Debian reads it **[guess]** |
| mbelib, mbelib-neo | AMBE/IMBE patents. mbelib's own README carries a "PATENT NOTICE". |
| codec2 | not encumbered (LGPL-2.1). It is the exception: we keep shipping it (Brian, 22/10/2026), and the loader still treats it as optional. |

**The rule that matters most:** the patents cover the **algorithms**, not
any one program's code. So we never port or re-implement an AAC, AMBE or
IMBE decoder from **any** source. That includes permissively licensed
ones (mbelib's ISC code) and our own clean-room attempts. Only a library
the user installed decodes them. The build check (§5.5) enforces the
linking half; reviews enforce the porting half, and ohs-libs' CONTRIBUTING
note says so.

### 9.3 Avoid entirely

- **GPL-2.0-only files.** They are not compatible with GPL-3.0-or-later.
  DSD's `dstar_header.c/h`, `fcs.h` and `descramble.h` are GPL-2.0-only
  (DSD's `COPYRIGHT`, checked 22/10/2026), so D-STAR's header, scrambler
  and FCS are written from JARL's specification instead.
- **"Non-commercial" or unlicensed code and samples.** Samples go to
  iqlib only, never into code or the repositories.
- **The SDRplay API.** It is proprietary: it is dlopen'd from the user's
  own install on every form, and on a controller a staged host library (§6.3).
- **Receiving others' traffic.** **[guess, not legal advice]** In the UK,
  receiving and disclosing messages from non-broadcast services you are
  not meant to receive is an offence (WT Act 2006 s.48). That covers
  commercial paging and public-safety or business DMR, P25 and NXDN. The
  decoders work on any frequency, but:
  - bookmarks and defaults are amateur and broadcast only;
  - a one-time notice explains the law;
  - nothing decodes encrypted traffic.

## 10. Questions only Brian can answer

Brian answered the first four on 22/10/2026 (top of this file). His
answers on host libraries and on the SDRplay API leave three things only
he can decide.

**A. fdk-aac on a controller means enabling Debian's non-free on the
host.**

`libfdk-aac2t64` is in non-free (trixie 2.0.3-1), and it is the only
route to xHE-AAC, which some DRM stations use. faad2, in main, covers
DAB+ and the rest of DRM.

The op would add one non-free source, pinned so that only that one
package can come from it, and take it away again on remove (§5.6).

**Recommend:** allow it, pinned exactly so, installed only when an
administrator presses Install. Without it, DRM's xHE-AAC stations are
silent on controllers and play only on desktops where the user installed
fdk-aac.

**B. mbelib on a controller.**

It is not packaged in Debian at all, so under "host package only" a
controller has no AMBE/IMBE voice: DMR, D-STAR, YSF, P25 and NXDN show
calls, IDs and data, but are silent. The alternatives:

- an op that builds mbelib on the host from a pinned source tarball when
  an administrator asks;
- an exception allowing an administrator to supply a built `libmbe.so`,
  checked by the probe.

The first means our platform compiles patented code on the user's
machine. The second is the upload you ruled out for codecs.

**Recommend:** neither. Voice stays desktop-only, where the user builds
mbelib themselves as OnAir's users do. Revisit only if a distribution
ever packages it. This does not touch M1-M3.

**C. How a controller gets SDRplay's installer.**

The op would do two things:

- download SDRplay's published installer from sdrplay.com when an
  administrator presses Install, **after the page shows SDRplay's licence
  and the administrator accepts it**, then check it against our pinned
  hashes and unpack it without running it;
- on a controller with no route out, accept that same file from the
  administrator, checked against the same hashes.

Two points need your yes:

- that the platform fetching the file on the administrator's behalf,
  with the licence accepted on the page, counts as the user installing it;
- that a hash-pinned vendor installer is not the "admin upload" you ruled
  out for codecs.

**Recommend:** yes to both. The alternative, an administrator running
SDRplay's installer on the host by hand, starts a host service that
fights the container's service for the radio, and needs a shell.

## 11. What this plan guessed (to check first)

- N150 single-core speed relative to the 6900HX and the i5-9400T, and so
  every N150 figure in §1, §3.4 and §8.3.
- That the engine's process pays glibc's FFT page-fault tax without
  `keep_heap()`. Measured only on the bank alone.
- macOS library validation blocking user dylibs and SDRplay's API (§5.4),
  and Windows Smart App Control's view of user DLLs.
- The faad2, fdk-aac and mbelib version symbols and floors (§5.3), and
  whether Debian's faad2 decodes DAB+'s 960-sample HE-AAC.
- RTTY's accuracy targets (§7.2), the CI times (§7.3), and DWD's RTTY
  still being on the air.
- The licences marked **[verify]** in §9.1. The legal notes in §9.3 are
  not legal advice.
- SDRplay's installer layout on Linux, and its unpacked file set being
  enough for the service in the container once it comes from
  `/opt/hostlibs` rather than `/usr/local` (§6.3).
- That one pinned non-free source can deliver `libfdk-aac2t64` alone,
  with nothing else from non-free ever installable through it (§5.6, §10
  A). Not tried on a controller.
