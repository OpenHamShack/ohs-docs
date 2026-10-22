#!/usr/bin/env python3
"""Build the family's design tokens from one definition.

This file is the source of truth for colour and type. It writes every
platform's copy (CSS, JSON, Android colors.xml for day and night, a Swift file
and an Xcode asset catalogue) and prints the contrast table that README.md
quotes, so a colour cannot change on one platform and not another, and a
contrast claim cannot drift from the colour it describes.

Standard library only, on purpose: it has to run on any host, including one
with no route out and no virtualenv.

    python3 brand/tools/build_tokens.py          # write everything
    python3 brand/tools/build_tokens.py --check  # also fail if any pair is
                                                 # below its required ratio

App colours are not picked one by one. Each app has a hue, and its colours
are fixed points in OKLCH (a perceptual space), so every app's tint is equally
light and every tile equally deep: no app's icon shouts louder than the rest,
and a new app needs one number. Red's hues (about 10-45) are deliberately
left unused, because red means transmit and nothing else.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "tokens"))

# ---------------------------------------------------------------- colour maths

def _srgb_from_linear(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

def _linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def oklch_to_rgb(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
    g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
    bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
    return r, g, bl

def oklch_hex(L, C, h):
    """Nearest in-gamut colour: keep lightness and hue, give up chroma."""
    while True:
        rgb = oklch_to_rgb(L, C, h)
        if all(-1e-4 <= v <= 1 + 1e-4 for v in rgb) or C <= 0:
            break
        C -= 0.002
    return "#" + "".join("%02x" % round(max(0, min(1, _srgb_from_linear(max(0, v)))) * 255) for v in rgb)

def luminance(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)

def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# ---------------------------------------------------------------- the name

# Code prefix is "shack", not the initials: the brand never abbreviates the
# name to OHS (that is occupational health and safety), and a prefix in
# every stylesheet and layout would teach people to.
# The family name appears in exactly these two places in generated code (the
# CSS/Android/Swift prefix and the app display names), so that a rename of
# the family is a change here and a rebuild, not a search through outputs.
FAMILY = "OpenHamShack"
PREFIX = "shack"

# ---------------------------------------------------------------- the palette

# Neutrals are a cool slate rather than grey, so the cyan accent sits in them
# rather than on them. Dark is not black and ink is not white: on a TV in a
# dark room pure white text on pure black halos and tires the eye, and OLED
# panels smear true black. The light theme is for daylight: the website, a
# phone outdoors, the box's touchscreen in a bright shack.
NEUTRAL = {
    "dark": {
        "bg": "#0a0e13", "surface": "#121922", "raised": "#1a232e",
        "line": "#2b3644", "ink": "#e8eef5", "ink-dim": "#a3b0bf",
        "ink-faint": "#6f7d8e",
    },
    "light": {
        "bg": "#f2f4f7", "surface": "#ffffff", "raised": "#e6eaf0",
        "line": "#c9d1db", "ink": "#0d1520", "ink-dim": "#46536a",
        "ink-faint": "#7d8a9c",
    },
}

# Brand and semantic colours. Each has a foreground (text and icons on bg or
# surface), a fill (a solid badge or button) and on-fill (text on that fill).
# "accent" is the family's signal cyan, carried over from the NB and ATV
# sites and favicons because it already is what the family looks like.
# "tx" is the only red in the system: ON AIR, PTT, the transmit lease.
# "rx" is receive locked / decoding. "warn" is amber: an unlocked tuner, a
# lease about to run out, a hot PA - something to look at, not an alarm.
SEMANTIC = {
    "dark": {
        "accent":  {"fg": "#4fd1e8", "fill": "#4fd1e8", "on": "#04141a"},
        "carrier": {"fg": "#ffb547", "fill": "#ffb547", "on": "#1d1200"},
        "tx":      {"fg": "#ff6b61", "fill": "#d42019", "on": "#ffffff"},
        "rx":      {"fg": "#3ddc84", "fill": "#3ddc84", "on": "#03170b"},
        "warn":    {"fg": "#ffc24d", "fill": "#ffc24d", "on": "#1d1300"},
        "info":    {"fg": "#7cb8ff", "fill": "#7cb8ff", "on": "#04101f"},
    },
    "light": {
        "accent":  {"fg": "#00728f", "fill": "#00728f", "on": "#ffffff"},
        "carrier": {"fg": "#955700", "fill": "#ffb547", "on": "#1d1200"},
        "tx":      {"fg": "#b8160f", "fill": "#c81e17", "on": "#ffffff"},
        "rx":      {"fg": "#0f7038", "fill": "#137a3c", "on": "#ffffff"},
        "warn":    {"fg": "#8f5400", "fill": "#ffc24d", "on": "#1d1300"},
        "info":    {"fg": "#1557b0", "fill": "#1557b0", "on": "#ffffff"},
    },
}

# One hue per app (OKLCH degrees), spaced round the wheel and skipping red.
# The platform and the Remote share the brand hue: they are the family itself,
# not a product on it. Neighbours are deliberately the related products
# (WB beside NB, Icom beside the platform), so the gaps fall between unlike
# things.
APPS = {
    "platform":      {"name": FAMILY,                    "hue": 210},
    "remote":        {"name": FAMILY + " Remote",        "hue": 210},
    "qo100-wb":      {"name": FAMILY + " QO-100 WB",     "hue": 300},
    "qo100-nb":      {"name": FAMILY + " QO-100 NB",     "hue": 245},
    "datv":          {"name": FAMILY + " DATV",          "hue": 335},
    "radio":         {"name": FAMILY + " Radio",         "hue": 60},
    "atv":           {"name": FAMILY + " ATV",           "hue": 95},
    "icom":          {"name": FAMILY + " Icom",          "hue": 172},
    "flex":          {"name": FAMILY + " Flex",          "hue": 272},
    "digital-modes": {"name": FAMILY + " Digital Modes", "hue": 140},
}
# tint: the app's colour on a dark ground (icon glyphs, TV, dark UI).
# tile: the top of the icon tile's gradient, a deep tone of the hue.
# shade: the app's colour as text on a light ground (passes 4.5:1 on white).
APP_STOPS = {"tint": (0.82, 0.13), "tile": (0.30, 0.07), "shade": (0.47, 0.13)}

# ---------------------------------------------------------------- type

FONT = {
    # The platform's own UI face on every OS, then the Linux faces a box or
    # a Debian desktop actually has. Nothing is fetched or vendored.
    "ui": 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "DejaVu Sans", sans-serif',
    # Frequencies, callsigns, locators, codes. Fixed width so a VFO readout
    # does not jitter as digits change, and 0 and O are told apart.
    "mono": 'ui-monospace, "SF Mono", "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Noto Sans Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace',
}
# A 1.25 scale on a per-surface base. Steps are named, not numbered, so a
# surface that changes its base keeps its hierarchy.
SCALE_RATIO = 1.25
SCALE_STEPS = {"xs": -2, "sm": -1, "md": 0, "lg": 1, "xl": 2, "2xl": 3, "3xl": 4, "4xl": 5}
SURFACE_BASE = {
    "web": 16,      # websites, the platform's admin pages, desktop apps
    "touch": 22,    # the box's own touchscreen, read at arm's length
    "tv": 24,       # 10-foot UI; Android TV/tvOS px at 1080p
}
RADIUS = {"sm": 6, "md": 10, "lg": 14, "pill": 999}
SPACE = {"1": 4, "2": 8, "3": 12, "4": 16, "5": 24, "6": 32, "7": 48}

# Pairs the README quotes, with the minimum each must meet: 4.5 for body
# text, 3.0 for large text, icons and fills against their ground.
def checks(theme):
    n, s = NEUTRAL[theme], SEMANTIC[theme]
    out = []
    for ground in ("bg", "surface"):
        out.append(("ink on " + ground, n["ink"], n[ground], 7.0))
        out.append(("ink-dim on " + ground, n["ink-dim"], n[ground], 4.5))
        for k in s:
            out.append((k + " on " + ground, s[k]["fg"], n[ground], 4.5))
    for k in s:
        out.append((k + " on-fill", s[k]["on"], s[k]["fill"], 4.5))
    out.append(("tx fill vs bg", s["tx"]["fill"], n["bg"], 3.0))
    out.append(("line vs bg (decorative)", n["line"], n["bg"], 1.0))
    return out

# ---------------------------------------------------------------- build

def build():
    apps = {}
    for k, a in APPS.items():
        apps[k] = {"name": a["name"], "hue": a["hue"]}
        for stop, (L, C) in APP_STOPS.items():
            apps[k][stop] = oklch_hex(L, C, a["hue"])
    base = "#0b1118"   # the bottom of every icon tile
    scale = {surf: {st: round(b * SCALE_RATIO ** e) for st, e in SCALE_STEPS.items()}
             for surf, b in SURFACE_BASE.items()}
    tokens = {
        "$comment": "Generated by brand/tools/build_tokens.py. Edit that, not this.",
        "family": FAMILY, "prefix": PREFIX,
        "color": {t: {**NEUTRAL[t], **{f"{k}-{r}": v[r2] for k, v in SEMANTIC[t].items()
                                       for r, r2 in (("fg", "fg"), ("fill", "fill"), ("on-fill", "on"))}}
                  for t in ("dark", "light")},
        "app": apps,
        "icon": {"tile-base": base},
        "font": FONT,
        "scale": {"ratio": SCALE_RATIO, "base": SURFACE_BASE, "px": scale},
        "radius": RADIUS, "space": SPACE,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "tokens.json"), "w") as f:
        json.dump(tokens, f, indent=2); f.write("\n")
    write_css(tokens); write_android(tokens); write_swift(tokens)
    return tokens

def _css_block(colors):
    return "".join(f"  --{PREFIX}-{k}: {v};\n" for k, v in colors.items())

def write_css(t):
    c = t["color"]
    common = "".join(f"  --{PREFIX}-app-{k}: {a['tint']};\n  --{PREFIX}-app-{k}-shade: {a['shade']};\n  --{PREFIX}-app-{k}-tile: {a['tile']};\n"
                     for k, a in t["app"].items())
    common += f'  --{PREFIX}-font-ui: {t["font"]["ui"]};\n  --{PREFIX}-font-mono: {t["font"]["mono"]};\n'
    common += "".join(f"  --{PREFIX}-radius-{k}: {v}px;\n" for k, v in t["radius"].items())
    common += "".join(f"  --{PREFIX}-space-{k}: {v}px;\n" for k, v in t["space"].items())
    common += "".join(f"  --{PREFIX}-text-{k}: {v}px;\n" for k, v in t["scale"]["px"]["web"].items())
    surf = ""
    for s in ("touch", "tv"):
        surf += f'\n/* The {s} surface keeps the same steps on a larger base. */\n[data-surface="{s}"] {{\n'
        surf += "".join(f"  --{PREFIX}-text-{k}: {v}px;\n" for k, v in t["scale"]["px"][s].items()) + "}\n"
    css = f"""/* Generated by brand/tools/build_tokens.py. Edit that, not this.
 *
 * Light is the default; dark follows the OS unless the page pins a theme
 * with data-theme on <html>. The dark block appears twice because a media
 * query cannot be combined with an attribute selector into one rule, and
 * the pinned form must win over the OS either way.
 */
:root {{
  color-scheme: light dark;
{_css_block(c["light"])}{common}}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
{_css_block(c["dark"]).replace("  --", "    --")}  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
{_css_block(c["dark"])}}}
:root[data-theme="light"] {{ color-scheme: light; }}
{surf}
/* Frequencies, meters, clocks: digits that do not move as they change. */
.{PREFIX}-num {{ font-variant-numeric: tabular-nums slashed-zero; font-feature-settings: "tnum" 1, "zero" 1; }}
.{PREFIX}-freq {{ font-family: var(--{PREFIX}-font-mono); font-variant-numeric: tabular-nums slashed-zero; letter-spacing: 0; }}
"""
    with open(os.path.join(OUT, "tokens.css"), "w") as f:
        f.write(css)

def _android_name(k):
    return PREFIX + "_" + k.replace("-", "_")

def write_android(t):
    for theme, folder in (("light", "values"), ("dark", "values-night")):
        d = os.path.join(OUT, "android", folder); os.makedirs(d, exist_ok=True)
        lines = ['<?xml version="1.0" encoding="utf-8"?>',
                 "<!-- Generated by brand/tools/build_tokens.py. Edit that, not this.",
                 "     values/ is light, values-night/ is dark; the names are the same in",
                 "     both so a layout never names a theme. A TV kind that is always dark",
                 "     can copy values-night/ into values/. -->", "<resources>"]
        lines += [f'    <color name="{_android_name(k)}">{v}</color>' for k, v in t["color"][theme].items()]
        for k, a in t["app"].items():
            lines.append(f'    <color name="{_android_name("app-" + k)}">{a["tint"] if theme == "dark" else a["shade"]}</color>')
        lines.append("</resources>")
        with open(os.path.join(d, PREFIX + "_colors.xml"), "w") as f:
            f.write("\n".join(lines) + "\n")

def _comp(hexc):
    return {k: "0x%s" % hexc[i:i + 2].upper() for k, i in (("red", 1), ("green", 3), ("blue", 5))}

def _swift_name(k):
    parts = k.replace("-", " ").split()
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])

def write_swift(t):
    # An asset catalogue colour set per token, each with an Any and a Dark
    # appearance, so SwiftUI's Color("lbInk") follows the system; and a
    # Swift file naming them so a typo is a compile error, not a clear colour.
    cat = os.path.join(OUT, "apple", FAMILY + "Colors.xcassets")
    os.makedirs(cat, exist_ok=True)
    with open(os.path.join(cat, "Contents.json"), "w") as f:
        json.dump({"info": {"author": "xcode", "version": 1}}, f, indent=2)
    names = []
    pairs = {k: (t["color"]["light"][k], t["color"]["dark"][k]) for k in t["color"]["light"]}
    pairs.update({"app-" + k: (a["shade"], a["tint"]) for k, a in t["app"].items()})
    for k, (light, dark) in pairs.items():
        n = PREFIX + _swift_name(k)[:1].upper() + _swift_name(k)[1:]
        names.append((n, k))
        d = os.path.join(cat, n + ".colorset"); os.makedirs(d, exist_ok=True)
        entry = lambda hx, dark_: {**({"appearances": [{"appearance": "luminosity", "value": "dark"}]} if dark_ else {}),
                                   "color": {"color-space": "srgb", "components": {**_comp(hx), "alpha": "1.000"}},
                                   "idiom": "universal"}
        with open(os.path.join(d, "Contents.json"), "w") as f:
            json.dump({"colors": [entry(light, False), entry(dark, True)], "info": {"author": "xcode", "version": 1}}, f, indent=2)
    sw = ["// Generated by brand/tools/build_tokens.py. Edit that, not this.",
          f"// Colours resolve light/dark from {FAMILY}Colors.xcassets. Apple TV is",
          "// always dark, so tvOS takes the dark half without asking.",
          "import SwiftUI", "", f"public enum {PREFIX.capitalize()} {{"]
    sw += [f'    public static let {n[len(PREFIX)].lower() + n[len(PREFIX) + 1:]} = Color("{n}", bundle: .module)  // {k}' for n, k in names]
    sw += ["", "    /// Frequencies and meters: fixed-width digits that do not jitter.",
           "    public static func freq(_ size: CGFloat) -> Font { .system(size: size, design: .monospaced).monospacedDigit() }",
           "    public static func num(_ size: CGFloat, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight).monospacedDigit() }",
           "}"]
    with open(os.path.join(OUT, "apple", FAMILY + "Colors.swift"), "w") as f:
        f.write("\n".join(sw) + "\n")

def report(t, strict):
    bad = 0
    rows = {"pairs": [], "apps": []}
    print("| Pair | Dark | Light | Needs |\n|---|---|---|---|")
    d, l = checks("dark"), checks("light")
    for (name, a, b, need), (_, a2, b2, _) in zip(d, l):
        rd, rl = contrast(a, b), contrast(a2, b2)
        flag = "" if min(rd, rl) >= need else "  <-- BELOW"
        bad += bool(flag)
        rows["pairs"].append({"pair": name, "dark": round(rd, 1), "light": round(rl, 1), "needs": need})
        print(f"| {name} | {rd:.1f}:1 | {rl:.1f}:1 | {need:.1f} |{flag}")
    print("\n| App | tint on tile | tint on dark bg | shade on white |\n|---|---|---|---|")
    for k, a in t["app"].items():
        r1, r2, r3 = contrast(a["tint"], a["tile"]), contrast(a["tint"], NEUTRAL["dark"]["bg"]), contrast(a["shade"], "#ffffff")
        flag = "" if min(r1, r2) >= 3 and r3 >= 4.5 else "  <-- BELOW"
        bad += bool(flag)
        rows["apps"].append({"app": k, "tint_on_tile": round(r1, 1), "tint_on_bg": round(r2, 1), "shade_on_white": round(r3, 1)})
        print(f"| {k} `{a['tint']}`/`{a['tile']}`/`{a['shade']}` | {r1:.1f}:1 | {r2:.1f}:1 | {r3:.1f}:1 |{flag}")
    # The preview page reads this, so the ratios it shows are computed, not typed.
    with open(os.path.join(OUT, "contrast.json"), "w") as f:
        json.dump(rows, f, indent=2); f.write("\n")
    if strict and bad:
        sys.exit(f"{bad} pair(s) below their minimum")

if __name__ == "__main__":
    report(build(), "--check" in sys.argv)
