"""Cross-reference PineScript drawing primitives with TypeScript implementations."""

import os
import re
from difflib import SequenceMatcher
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
PINE_DIR = ROOT / "docs" / "official" / "indicators_community"
TS_DIR = ROOT / "src" / "community"

# Drawing primitives: Pine keyword -> TS output key
DRAWING_MAP = {
    "line.new": "lines",
    "box.new": "boxes",
    "label.new": "labels",
    "table.new": "tables",
}


def normalize_pine_name(fname: str) -> str:
    """Convert Pine filename to a comparable lowercase string."""
    name = fname.removesuffix(".pine")
    # Remove bracketed prefixes like [RS], [@btc_charlie], [blackcat], [STRATEGY]
    name = re.sub(r"\[.*?\]\s*", "", name)
    # Remove version suffixes like V4, V0, v9
    name = re.sub(r"\s*[Vv]\d+(\.\d+)?$", "", name)
    # Replace separators with spaces
    name = name.replace("_", " ").replace("-", " ")
    # Lowercase, strip, collapse whitespace
    name = re.sub(r"\s+", " ", name.lower().strip())
    return name


def normalize_ts_name(fname: str) -> str:
    """Convert TS filename to a comparable lowercase string."""
    name = fname.removesuffix(".ts")
    name = name.replace("-", " ")
    return name.lower().strip()


def find_pine_drawings(filepath: Path) -> set:
    """Return set of drawing primitive types used in a Pine file."""
    text = filepath.read_text(encoding="utf-8", errors="replace")
    found = set()
    for pine_kw, ts_kw in DRAWING_MAP.items():
        if pine_kw in text:
            found.add(ts_kw)
    return found


def find_ts_drawings(filepath: Path) -> set:
    """Return set of drawing output types present in a TS file."""
    text = filepath.read_text(encoding="utf-8", errors="replace")
    found = set()
    if re.search(r"\blines\s*:", text):
        found.add("lines")
    if re.search(r"\bboxes\s*:", text):
        found.add("boxes")
    if re.search(r"\blabels\s*:", text):
        found.add("labels")
    if re.search(r"\btables\s*:", text) or "setTable" in text:
        found.add("tables")
    return found


def match_ts_to_pine(ts_names, pine_names, threshold=0.55):
    """For each TS file, find the best matching Pine file via fuzzy matching."""
    matches = {}
    pine_items = list(pine_names.items())  # (normalized, original)

    for ts_norm, ts_orig in ts_names.items():
        best_score = 0.0
        best_pine = None
        for pine_norm, pine_orig in pine_items:
            score = SequenceMatcher(None, ts_norm, pine_norm).ratio()
            if score > best_score:
                best_score = score
                best_pine = pine_orig
        if best_score >= threshold:
            matches[ts_orig] = best_pine
        else:
            matches[ts_orig] = None
    return matches


def main():
    # Gather files
    pine_files = sorted(f.name for f in PINE_DIR.glob("*.pine"))
    ts_files = sorted(f.name for f in TS_DIR.glob("*.ts"))

    print(f"Found {len(pine_files)} Pine files, {len(ts_files)} TS files\n")

    # Build normalized name dicts: normalized -> original
    pine_names = {normalize_pine_name(f): f for f in pine_files}
    ts_names = {normalize_ts_name(f): f for f in ts_files}

    # Match
    matches = match_ts_to_pine(ts_names, pine_names)

    # Analyze gaps
    gaps = []
    matched_count = 0
    for ts_file, pine_file in matches.items():
        if pine_file is None:
            continue
        matched_count += 1

        pine_drawings = find_pine_drawings(PINE_DIR / pine_file)
        if not pine_drawings:
            continue  # Pine doesn't use drawings, nothing to check

        ts_drawings = find_ts_drawings(TS_DIR / ts_file)
        missing = pine_drawings - ts_drawings

        if missing:
            gaps.append({
                "ts": ts_file,
                "pine": pine_file,
                "pine_has": sorted(pine_drawings),
                "ts_has": sorted(ts_drawings),
                "missing": sorted(missing),
            })

    # Sort by number of missing (most first), then by name
    gaps.sort(key=lambda g: (-len(g["missing"]), g["ts"]))

    # Report
    print(f"Matched {matched_count} / {len(ts_files)} TS files to Pine files")
    print(f"Indicators with drawing gaps: {len(gaps)}\n")

    print("MISSING DRAWINGS REPORT")
    print("=" * 23)
    print()

    # Column widths
    col_ts = max((len(g["ts"]) for g in gaps), default=7)
    col_pine = max((len(g["pine"]) for g in gaps), default=9)
    col_pine = min(col_pine, 60)  # cap for readability

    hdr = (
        f"{'TS File':<{col_ts}} | {'Pine File':<{col_pine}} | "
        f"{'Pine Has':<28} | {'TS Has':<28} | Missing"
    )
    sep = "-" * len(hdr)
    print(hdr)
    print(sep)

    for g in gaps:
        pine_display = g["pine"][:col_pine]
        ts_has_str = ", ".join(g["ts_has"]) if g["ts_has"] else "(none)"
        print(
            f"{g['ts']:<{col_ts}} | {pine_display:<{col_pine}} | "
            f"{', '.join(g['pine_has']):<28} | {ts_has_str:<28} | "
            f"{', '.join(g['missing'])}"
        )

    # Summary by type
    print(f"\n{'SUMMARY BY DRAWING TYPE':=^60}")
    type_counts = Counter()
    for g in gaps:
        for m in g["missing"]:
            type_counts[m] += 1
    for dtype, count in type_counts.most_common():
        print(f"  {dtype}: {count} indicators missing")


if __name__ == "__main__":
    main()
