"""
Verify which PineScript files correctly match to TypeScript indicator files.
"""

import os
import re
from pathlib import Path

TS_DIR = Path(r"D:\WebstormProjects\lightweight-charts-indicators\src\community")
PINE_DIR = Path(r"D:\WebstormProjects\lightweight-charts-indicators\docs\official\indicators_community")

TS_FILES = [
    "cm-price-action.ts",
    "price-action-system.ts",
    "ema-wave.ts",
    "liquidity-grabs.ts",
    "macd-divergence.ts",
    "multiple-divergences.ts",
    "price-divergence-detector.ts",
    "rsi-supply-demand.ts",
    "sr-levels-breaks.ts",
    "forex-sessions.ts",
    "ma-shift.ts",
    "ml-momentum-index.ts",
    "momentum-zigzag.ts",
    "range-detector.ts",
    "turtle-trade-channels.ts",
    "wavetrend-oscillator.ts",
    "atr-plus.ts",
    "bitcoin-log-curves.ts",
    "cm-time-lines.ts",
    "divergence-indicator.ts",
    "dmi-adx-levels.ts",
    "ema-enveloper.ts",
    "evwma-envelope.ts",
    "fvg-positioning-average.ts",
    "hema-trend-levels.ts",
    "intraday-volume-swings.ts",
    "isolated-peak-bottom.ts",
    "market-structure-trailing-stop.ts",
    "ott-bands.ts",
    "pivot-trailing-maxmin.ts",
    "price-volume-profile.ts",
    "rs-support-resistance.ts",
    "rsi-momentum-divergence.ts",
    "rsi-tops-bottoms.ts",
    "tma-bands.ts",
    "trendlines-with-breaks.ts",
    "volume-footprint.ts",
    "auto-trendline.ts",
    "ml-adaptive-supertrend.ts",
]


def get_pine_files():
    return [f.name for f in PINE_DIR.iterdir() if f.suffix == ".pine"]


def read_header(ts_path):
    try:
        with open(ts_path, "r", encoding="utf-8") as f:
            lines = [f.readline() for _ in range(20)]
        return "".join(lines)
    except Exception:
        return ""


def extract_reference(text):
    m = re.search(r'Reference:\s*(?:TradingView\s+)?"?([^"\n]+)"?', text)
    if m:
        return m.group(1).strip().rstrip('"')
    return None


def extract_title(text):
    m = re.search(r'/\*\*\s*\n\s*\*\s+(.+)', text)
    if m:
        return m.group(1).strip()
    return None


def normalize(s):
    s = s.lower()
    s = re.sub(r'\[.*?\]', '', s)
    s = re.sub(r'\bv\d+[\.\d]*\b', '', s)
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def keywords_from_filename(ts_filename):
    name = ts_filename.replace(".ts", "").replace("-", " ")
    return [w for w in name.split() if len(w) > 1]


def score_match(pine_name, keywords, reference, title):
    pine_norm = normalize(pine_name.replace(".pine", ""))
    best_score = 0
    reason = ""

    if reference:
        ref_norm = normalize(reference)
        if ref_norm and ref_norm in pine_norm:
            s = 100
            if s > best_score: best_score, reason = s, "ref exact in pine"
        elif pine_norm and pine_norm in ref_norm:
            s = 95
            if s > best_score: best_score, reason = s, "pine in ref"
        else:
            ref_words = [w for w in ref_norm.split() if len(w) > 1]
            if ref_words:
                matching = sum(1 for w in ref_words if w in pine_norm)
                ratio = matching / len(ref_words)
                if ratio >= 0.6:
                    s = int(80 * ratio)
                    if s > best_score: best_score, reason = s, f"ref words {matching}/{len(ref_words)}"

    if title:
        title_norm = normalize(title)
        if title_norm and title_norm in pine_norm:
            s = 90
            if s > best_score: best_score, reason = s, "title exact in pine"
        elif pine_norm and pine_norm in title_norm:
            s = 85
            if s > best_score: best_score, reason = s, "pine in title"
        else:
            title_words = [w for w in title_norm.split() if len(w) > 2]
            if title_words:
                matching = sum(1 for w in title_words if w in pine_norm)
                ratio = matching / len(title_words)
                if ratio >= 0.5:
                    s = int(70 * ratio)
                    if s > best_score: best_score, reason = s, f"title words {matching}/{len(title_words)}"

    if keywords:
        matching = sum(1 for w in keywords if w in pine_norm)
        ratio = matching / len(keywords)
        if ratio >= 0.5:
            s = int(60 * ratio)
            if s > best_score: best_score, reason = s, f"fname kw {matching}/{len(keywords)}"

    return best_score, reason


def find_matches(ts_filename, pine_files):
    ts_path = TS_DIR / ts_filename
    header = read_header(ts_path)
    reference = extract_reference(header)
    title = extract_title(header)
    keywords = keywords_from_filename(ts_filename)

    results = []
    for pine in pine_files:
        score, reason = score_match(pine, keywords, reference, title)
        if score > 0:
            results.append((pine, score, reason))

    results.sort(key=lambda x: -x[1])
    return results[:5], reference, title, keywords


def main():
    pine_files = get_pine_files()
    print(f"Found {len(pine_files)} Pine files\n")

    # Summary table
    print(f"{'TS File':<42} | {'Scr':>3} | {'Best Pine Match':<65} | {'Reason':<22} | Ref/Title from TS")
    print("-" * 195)

    for ts_file in TS_FILES:
        ts_path = TS_DIR / ts_file
        if not ts_path.exists():
            print(f"{ts_file:<42} | {'N/A':>3} | {'FILE NOT FOUND':<65} | {'':<22} |")
            continue

        matches, ref, title, kw = find_matches(ts_file, pine_files)
        ref_display = (ref or title or "NO REF")[:55]

        if matches:
            best_pine, best_score, best_reason = matches[0]
            pd = best_pine[:65] if len(best_pine) > 65 else best_pine
            print(f"{ts_file:<42} | {best_score:>3} | {pd:<65} | {best_reason:<22} | {ref_display}")
            for pine, score, reason in matches[1:3]:
                if score >= best_score * 0.7:
                    pd2 = pine[:65] if len(pine) > 65 else pine
                    print(f"{'':42} | {score:>3} | {pd2:<65} | {reason:<22} |")
        else:
            print(f"{ts_file:<42} | {'0':>3} | {'NO MATCH FOUND':<65} | {'':<22} | {ref_display}")

    # Detailed per indicator
    print("\n\n" + "=" * 120)
    print("DETAILED ANALYSIS PER INDICATOR")
    print("=" * 120)

    for ts_file in TS_FILES:
        ts_path = TS_DIR / ts_file
        if not ts_path.exists():
            print(f"\n--- {ts_file}: FILE NOT FOUND ---")
            continue

        matches, ref, title, kw = find_matches(ts_file, pine_files)

        print(f"\n--- {ts_file} ---")
        print(f"  Title:     {title}")
        print(f"  Reference: {ref}")
        print(f"  Keywords:  {kw}")

        if matches:
            print(f"  Top candidates:")
            for pine, score, reason in matches[:5]:
                print(f"    [{score:>3}] {pine:<70} ({reason})")
        else:
            print(f"  No scored matches. Broad keyword search:")
            for k in kw:
                if len(k) < 3: continue
                broad = [p for p in pine_files if k.lower() in p.lower()]
                if broad:
                    print(f"    keyword '{k}' found in: {broad[:5]}")


if __name__ == "__main__":
    main()
