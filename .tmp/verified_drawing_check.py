"""Check verified TS<->Pine matches for missing drawing primitive support."""

import os
import re

BASE = r"D:\WebstormProjects\lightweight-charts-indicators"
TS_DIR = os.path.join(BASE, "src", "community")
PINE_DIR = os.path.join(BASE, "docs", "official", "indicators_community")

MATCHES = [
    ("cm-price-action.ts", "CM_Price-Action-Bars-Price Patterns That Work!.pine"),
    ("price-action-system.ts", "Price Action Trading System v0.3 by JustUncleL.pine"),
    ("ema-wave.ts", "EMA Wave Indicator [LazyBear].pine"),
    ("liquidity-grabs.ts", "Liquidity Grabs _ Flux Charts.pine"),
    ("macd-divergence.ts", "MACD Divergences by @DaviddTech.pine"),
    ("multiple-divergences.ts", "Multiple divergences NON-REPAINT by PeterO.pine"),
    ("price-divergence-detector.ts", "Price Divergence Detector V3 revised by JustUncleL.pine"),
    ("rsi-supply-demand.ts", "RSI Based Automatic Supply and Demand.pine"),
    ("sr-levels-breaks.ts", "Support and Resistance Levels with Breaks [LuxAlgo].pine"),
    ("forex-sessions.ts", "Code for All 4 Forex Sessions W_ Background Highlight!!!.pine"),
    ("ma-shift.ts", "Moving Average Shift [ChartPrime].pine"),
    ("ml-momentum-index.ts", "Machine Learning Momentum Index (MLMI) [Zeiierman].pine"),
    ("momentum-zigzag.ts", "Momentum-based ZigZag (incl. QQE) NON-REPAINTING.pine"),
    ("range-detector.ts", "Range Detector [LuxAlgo].pine"),
    ("turtle-trade-channels.ts", "Turtle Trade Channels Indicator TUTCI.pine"),
    ("wavetrend-oscillator.ts", "Indicator_ WaveTrend Oscillator [WT].pine"),
    ("atr-plus.ts", "ATR+ (Stop Loss Indicator).pine"),
    ("bitcoin-log-curves.ts", "Bitcoin Logarithmic Growth Curves.pine"),
    ("cm-time-lines.ts", "CM Time Based Vertical Lines.pine"),
    ("divergence-indicator.ts", "Divergence Indicator (any oscillator).pine"),
    ("dmi-adx-levels.ts", "Directional Movement Index + ADX & Keylevel Support.pine"),
    ("ema-enveloper.ts", "EMA Enveloper Indicator & a crazy prediction.pine"),
    ("evwma-envelope.ts", "Elastic Volume Weighted Moving Average & Envelope [LazyBear].pine"),
    ("fvg-positioning-average.ts", "FVG Positioning Average [LuxAlgo].pine"),
    ("hema-trend-levels.ts", "HEMA Trend Levels [AlgoAlpha].pine"),
    ("intraday-volume-swings.ts", "Intraday Volume Swings.pine"),
    ("isolated-peak-bottom.ts", "Isolated Peak and Bottom (Tuncer SENGOZ) by Kivanc fr3762.pine"),
    ("market-structure-trailing-stop.ts", "Market Structure Trailing Stop [LuxAlgo].pine"),
    ("ott-bands.ts", "Optimized Trend Tracker Bands.pine"),
    ("pivot-trailing-maxmin.ts", "Pivot Based Trailing Maxima & Minima [LuxAlgo].pine"),
    ("price-volume-profile.ts", "Price & Volume Profile (Expo).pine"),
    ("rs-support-resistance.ts", "[RS]Support and Resistance V0.pine"),
    ("rsi-momentum-divergence.ts", "RSI Momentum Divergence Zones [ChartPrime].pine"),
    ("rsi-tops-bottoms.ts", "RSI Tops and Bottoms.pine"),
    ("tma-bands.ts", "Triangular Moving Average (TMA) bands.pine"),
    ("trendlines-with-breaks.ts", "Trendlines with Breaks [LuxAlgo].pine"),
    ("volume-footprint.ts", "Volume Footprint [LuxAlgo].pine"),
    ("auto-trendline.ts", "Auto Trendline Indicator (based on fractals).pine"),
    ("ml-adaptive-supertrend.ts", "Machine Learning Adaptive SuperTrend [AlgoAlpha].pine"),
]

PINE_DRAWINGS = {
    "line.new": "line",
    "box.new": "box",
    "label.new": "label",
    "table.new": "table",
}

# TS output patterns: lines: in return, boxes: in return, labels: in return, tables:/setTable
TS_PATTERNS = {
    "line": re.compile(r'\blines\s*:', re.IGNORECASE),
    "box": re.compile(r'\bboxes\s*:', re.IGNORECASE),
    "label": re.compile(r'\blabels\s*:', re.IGNORECASE),
    "table": re.compile(r'\btables\s*:|setTable', re.IGNORECASE),
}


def count_pine_drawings(content: str) -> dict[str, int]:
    counts = {}
    for call, kind in PINE_DRAWINGS.items():
        c = len(re.findall(re.escape(call), content))
        if c > 0:
            counts[kind] = c
    return counts


def check_ts_drawings(content: str) -> set[str]:
    found = set()
    for kind, pat in TS_PATTERNS.items():
        if pat.search(content):
            found.add(kind)
    return found


def main():
    missing_rows = []
    all_rows = []

    for ts_name, pine_name in MATCHES:
        ts_path = os.path.join(TS_DIR, ts_name)
        pine_path = os.path.join(PINE_DIR, pine_name)

        # Check files exist
        if not os.path.exists(ts_path):
            print(f"WARNING: TS file not found: {ts_name}")
            continue
        if not os.path.exists(pine_path):
            print(f"WARNING: Pine file not found: {pine_name}")
            continue

        with open(pine_path, "r", encoding="utf-8", errors="replace") as f:
            pine_content = f.read()
        with open(ts_path, "r", encoding="utf-8", errors="replace") as f:
            ts_content = f.read()

        pine_draws = count_pine_drawings(pine_content)
        ts_draws = check_ts_drawings(ts_content)

        pine_kinds = set(pine_draws.keys())
        missing = pine_kinds - ts_draws

        pine_str = ", ".join(f"{k}({v})" for k, v in sorted(pine_draws.items())) if pine_draws else "none"
        ts_str = ", ".join(sorted(ts_draws)) if ts_draws else "none"
        missing_str = ", ".join(sorted(missing)) if missing else ""

        row = {
            "ts": ts_name,
            "pine": pine_name,
            "pine_draws": pine_str,
            "ts_draws": ts_str,
            "missing": missing_str,
            "has_missing": bool(missing),
            "pine_counts": pine_draws,
            "missing_set": missing,
        }
        all_rows.append(row)
        if missing:
            missing_rows.append(row)

    # Print full table
    print("=" * 160)
    print("ALL VERIFIED PAIRS - DRAWING PRIMITIVE ANALYSIS")
    print("=" * 160)
    print(f"{'TS FILE':<42} | {'PINE DRAWINGS':<35} | {'TS DRAWINGS':<25} | {'MISSING'}")
    print("-" * 160)
    for r in all_rows:
        marker = " <<<" if r["has_missing"] else ""
        print(f"{r['ts']:<42} | {r['pine_draws']:<35} | {r['ts_draws']:<25} | {r['missing']}{marker}")

    print()
    print("=" * 160)
    print("PAIRS WITH MISSING DRAWING PRIMITIVES")
    print("=" * 160)

    if not missing_rows:
        print("None! All verified pairs have complete drawing support.")
    else:
        print(f"{'TS FILE':<42} | {'PINE FILE':<60} | {'PINE DRAWINGS':<30} | {'TS DRAWINGS':<20} | {'MISSING'}")
        print("-" * 160)
        for r in missing_rows:
            print(f"{r['ts']:<42} | {r['pine']:<60} | {r['pine_draws']:<30} | {r['ts_draws']:<20} | {r['missing']}")

        print()
        print(f"Total pairs with missing drawings: {len(missing_rows)} / {len(all_rows)}")
        print()

        # Summary by drawing type
        type_counts = {}
        for r in missing_rows:
            for m in r["missing_set"]:
                if m not in type_counts:
                    type_counts[m] = []
                type_counts[m].append((r["ts"], r["pine_counts"].get(m, 0)))

        print("MISSING BY TYPE:")
        for dtype in sorted(type_counts.keys()):
            items = type_counts[dtype]
            print(f"\n  {dtype.upper()} ({len(items)} files):")
            for ts_name, count in sorted(items, key=lambda x: -x[1]):
                print(f"    {ts_name:<42} ({count} {dtype}.new calls in Pine)")


if __name__ == "__main__":
    main()
