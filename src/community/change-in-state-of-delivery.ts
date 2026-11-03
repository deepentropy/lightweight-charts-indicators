/**
 * Change in State of Delivery (CISD) [LuxAlgo]
 *
 * A bullish candle after a bearish one starts a bullish delivery level at its open; a bearish candle after a bullish
 * one starts a bearish level at its open. A change in state of delivery (CISD) is a close back through the level.
 *
 * - "Classic": each new level (on a closed bar) replaces the previous one of its side unless that one was broken.
 *   The level line (colour of its side, 60 % opacity) follows the current bar for at most "Maximum Swing Validity"
 *   bars. A close below a bullish level (above a bearish one) after at least "Minimum CISD Duration" bars is a CISD:
 *   the line takes the colour of the new direction (dashed when the trend was already in that direction) and a
 *   "CISD" label is placed at the middle of the line. A break that comes too early deletes the line.
 * - "Liquidity Sweep": swing highs and lows (pivots with "Swing Length" bars on the left and 1 bar on the right) are
 *   kept for "Maximum Swing Validity" bars. A bar whose high goes above a swing high and closes below it (a sweep)
 *   draws a line at the swing and a wick line, and, when no close since the latest bullish level went below it,
 *   starts a CISD line at that level. A later close below the level gives the CISD (line coloured, "CISD" label and
 *   a "▼" label above the bar); swing lows work the other way round.
 *
 * At most 500 lines and 500 labels are kept.
 *
 * Chart values (optional third argument of calculate): on the last bar a new "Classic" level needs a closed bar
 * (`lastBarConfirmed`).
 *
 * Reference: "Change in State of Delivery (CISD) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, color, Series, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line,
} from 'oakscriptjs';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface ChangeInStateOfDeliveryLuxAlgoInputs {
  /** Detection Method */
  trackingMethod: 'Classic' | 'Liquidity Sweep';
  /** Swing Length (Liquidity Sweep method) */
  length: number;
  /** Minimum CISD Duration */
  minimumSequenceLength: number;
  /** Maximum Swing Validity */
  maximumSequenceLength: number;
  /** Label/Text Size */
  textSize: 'Tiny' | 'Small';
  /** Bullish colour */
  cBull: string;
  /** Bearish colour */
  cBear: string;
  /** Sweep high colour */
  cSweepH: string;
  /** Sweep low colour */
  cSweepL: string;
}

export const defaultInputs: ChangeInStateOfDeliveryLuxAlgoInputs = {
  trackingMethod: 'Classic',
  length: 10,
  minimumSequenceLength: 0,
  maximumSequenceLength: 100,
  textSize: 'Tiny',
  cBull: '#089981',
  cBear: '#f23645',
  cSweepH: 'rgba(120, 123, 134, 0.52)',
  cSweepL: 'rgba(120, 123, 134, 0.52)',
};

const SPACE = ' '.repeat(31);

export const inputConfig: InputConfig[] = [
  { id: 'trackingMethod', type: 'string', title: 'Detection Method', defval: 'Classic', options: ['Classic', 'Liquidity Sweep'] },
  { id: 'length', type: 'int', title: 'Swing Length', defval: 10, min: 1,
    tooltip: 'Only applicable on the Liquidity Sweep Detection Method' },
  { id: 'minimumSequenceLength', type: 'int', title: 'Minimum CISD Duration', defval: 0, min: 0 },
  { id: 'maximumSequenceLength', type: 'int', title: 'Maximum Swing Validity', defval: 100, min: 1, max: 1000,
    tooltip: 'Maximum allowed swing level duration without a new detected sweep' },
  { id: 'textSize', type: 'string', title: 'Label/Text Size', defval: 'Tiny', options: ['Tiny', 'Small'], group: 'Style' },
  { id: 'cBull', type: 'color', title: 'Bullish', defval: '#089981', group: 'Style' },
  { id: 'cBear', type: 'color', title: 'Bearish', defval: '#f23645', group: 'Style' },
  { id: 'cSweepH', type: 'color', title: `Sweeps${SPACE}`, defval: 'rgba(120, 123, 134, 0.52)', group: 'Style', inline: 'S' },
  { id: 'cSweepL', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.52)', group: 'Style', inline: 'S',
    tooltip: 'Sweep High/Low' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawings of the script */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Change in State of Delivery (CISD) [LuxAlgo]',
  shortTitle: 'LuxAlgo - CISD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const INV = 'transparent';
/** Version 5 colour constants */
const GREEN = '#4CAF50';
const RED = '#FF5252';

interface Bin {
  ln: Line;
  active: boolean;
  broken: boolean;
}

interface Swing {
  /** Bar index and price of the swing (chart.point) */
  x: number;
  price: number;
  ln: Line | null;
  wick: Line | null;
  active: boolean;
}

/** A chart point (index, price); na index / price as NaN */
interface Point {
  index: number;
  price: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ChangeInStateOfDeliveryLuxAlgoInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = Math.trunc(cfg.length);
  const minLen = cfg.minimumSequenceLength;
  const maxLen = cfg.maximumSequenceLength;
  const size = cfg.textSize.toLowerCase();
  const { cBull, cBear, cSweepH, cSweepL } = cfg;
  const bullLevelColor = String(color.new(cBull, 40));
  const bearLevelColor = String(color.new(cBear, 40));
  const sweep = cfg.trackingMethod === 'Liquidity Sweep';
  const lastConfirmed = lastBarConfirmedOf(chart);

  const ph = ta.pivothigh(new Series(bars, (b) => b.high), length, 1).toArray();
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), length, 1).toArray();

  resetDrawings({ line: 500, label: 500 });

  let trend = 0;
  const arrBull: Bin[] = [];
  const arrBear: Bin[] = [];
  const swingsH: Swing[] = [];
  const swingsL: Swing[] = [];
  let lastPh: Point = { index: NaN, price: NaN };
  let lastPl: Point = { index: NaN, price: NaN };
  let trackBull: Point = { index: NaN, price: NaN };
  let trackBear: Point = { index: NaN, price: NaN };
  let oBull: Bin | null = null;
  let oBear: Bin | null = null;

  /** `for j = 0 to n - track.index`: no close since the level went beyond it (`below` for a bullish level) */
  const unbroken = (i: number, track: Point, below: boolean): boolean => {
    const end = i - track.index;
    if (isNaN(end)) return true; // a loop to na does not run
    for (let j = 0; j <= end; j++) {
      const c = bars[i - j].close;
      if (below ? lt(c, track.price) : gt(c, track.price)) return false;
    }
    return true;
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const bull = gt(b.close, b.open);
    const bear = lt(b.close, b.open);
    const prev = i > 0 ? bars[i - 1] : null;
    const bull1 = prev !== null && gt(prev.close, prev.open);
    const bear1 = prev !== null && lt(prev.close, prev.open);

    if (i === 0) {
      // var chart.point and var bin of the first bar
      lastPh = { index: 0, price: b.high };
      lastPl = { index: 0, price: b.low };
      oBull = { ln: line.new(0, b.open, 0, b.open, undefined, undefined, GREEN), active: true, broken: false };
      oBear = { ln: line.new(0, b.open, 0, b.open, undefined, undefined, RED), active: true, broken: false };
    }
    const bullBin = oBull!;
    const bearBin = oBear!;

    const phi = ph[i] ?? NaN;
    const pli = pl[i] ?? NaN;
    if (!isNaN(phi)) {
      swingsH.push({ x: i - 1, price: phi, ln: null, wick: null, active: false });
      lastPh = { index: i - 1, price: phi };
    }
    if (!isNaN(pli)) {
      swingsL.push({ x: i - 1, price: pli, ln: null, wick: null, active: false });
      lastPl = { index: i - 1, price: pli };
    }
    if (bull && bear1) trackBull = { index: i, price: b.open };
    if (bear && bull1) trackBear = { index: i, price: b.open };

    // reset when the last swing is broken
    if (gt(b.close, lastPh.price)) lastPh = { index: NaN, price: NaN };
    if (lt(b.close, lastPl.price)) lastPl = { index: NaN, price: NaN };

    if (!sweep) {
      const confirmed = i < n - 1 || lastConfirmed;
      if (confirmed && bull && bear1) {
        if (bullBin.active && !bullBin.broken) line.delete(bullBin.ln);
        bullBin.active = true;
        bullBin.ln = line.new(trackBull.index, trackBull.price, i, trackBull.price, undefined, undefined, bullLevelColor);
        bullBin.broken = false;
      }
      if (confirmed && bear && bull1) {
        if (bearBin.active && !bearBin.broken) line.delete(bearBin.ln);
        bearBin.active = true;
        bearBin.ln = line.new(trackBear.index, trackBear.price, i, trackBear.price, undefined, undefined, bearLevelColor);
        bearBin.broken = false;
      }

      // bearish CISD
      if (bullBin.active) {
        const ln = bullBin.ln;
        if (i - line.get_x1(ln) <= maxLen) {
          line.set_x2(ln, i);
          if (lt(b.close, line.get_y2(ln))) {
            if (i - line.get_x1(ln) >= minLen) {
              line.set_color(ln, cBear);
              if (trend === -1) line.set_style(ln, 'dashed');
              bullBin.active = false;
              bullBin.broken = true;
              trend = -1;
              const x = Math.ceil((line.get_x1(ln) + i) / 2);
              label.new(x, line.get_y2(ln), 'CISD', undefined, undefined, INV, 'label_up', cBear, size);
            } else {
              bullBin.active = false;
              line.delete(ln);
            }
          }
        } else {
          bullBin.active = false;
          line.delete(ln);
        }
      }

      // bullish CISD
      if (bearBin.active) {
        const ln = bearBin.ln;
        if (i - line.get_x1(ln) <= maxLen) {
          line.set_x2(ln, i);
          if (gt(b.close, line.get_y2(ln))) {
            if (i - line.get_x1(ln) >= minLen) {
              line.set_color(ln, cBull);
              if (trend === 1) line.set_style(ln, 'dashed');
              bearBin.active = false;
              bearBin.broken = true;
              trend = 1;
              const x = Math.ceil((line.get_x1(ln) + i) / 2);
              label.new(x, line.get_y2(ln), 'CISD', undefined, undefined, INV, 'label_down', cBull, size);
            } else {
              bearBin.active = false;
              line.delete(ln);
            }
          }
        } else {
          bearBin.active = false;
          line.delete(ln);
        }
      }
      continue;
    }

    // Liquidity Sweep
    for (let k = swingsH.length - 1; k >= 0; k--) {
      const get = swingsH[k];
      const y = get.price;
      if (i - get.x > maxLen) {
        swingsH.splice(k, 1);
      } else if (get.ln !== null) {
        if (gt(b.close, line.get_y2(get.ln))) swingsH.splice(k, 1);
      } else if (gt(b.close, y)) {
        swingsH.splice(k, 1);
      } else if (!get.active && gt(b.high, y) && lt(b.close, y)) {
        get.ln = line.new(get.x, y, i, y, undefined, undefined, cSweepH);
        get.wick = line.new(i, y, i, b.high, undefined, undefined, cSweepH, undefined, 3);
        get.active = true;
        if (unbroken(i, trackBull, true)) {
          arrBull.push({
            ln: line.new(trackBull.index, trackBull.price, i, trackBull.price, undefined, undefined, bullLevelColor),
            active: true, broken: false,
          });
        }
      }
    }
    for (let k = swingsL.length - 1; k >= 0; k--) {
      const get = swingsL[k];
      const y = get.price;
      if (i - get.x > maxLen) {
        swingsL.splice(k, 1);
      } else if (get.ln !== null) {
        if (lt(b.close, line.get_y2(get.ln))) swingsL.splice(k, 1);
      } else if (lt(b.close, y)) {
        swingsL.splice(k, 1);
      } else if (!get.active && lt(b.low, y) && gt(b.close, y)) {
        get.ln = line.new(get.x, y, i, y, undefined, undefined, cSweepL);
        get.wick = line.new(i, y, i, b.low, undefined, undefined, cSweepL, undefined, 3);
        get.active = true;
        if (unbroken(i, trackBear, false)) {
          arrBear.push({
            ln: line.new(trackBear.index, trackBear.price, i, trackBear.price, undefined, undefined, bearLevelColor),
            active: true, broken: false,
          });
        }
      }
    }
    for (let k = arrBull.length - 1; k >= 0; k--) {
      const ln = arrBull[k].ln;
      line.set_x2(ln, i);
      const x1 = line.get_x1(ln);
      if (i - x1 > maxLen) {
        line.delete(ln);
        arrBull.splice(k, 1);
      } else if (lt(b.close, line.get_y2(ln))) {
        if (i - x1 >= minLen) {
          line.set_color(ln, cBear);
          if (trend === -1) line.set_style(ln, 'dashed');
          trend = -1;
          label.new(Math.ceil((x1 + i) / 2), line.get_y2(ln), 'CISD', undefined, undefined, INV, 'label_up', cBear, size);
          label.new(i, b.high, '▼', undefined, undefined, INV, 'label_down', cBear, size);
        } else {
          line.delete(ln);
        }
        arrBull.splice(k, 1);
      }
    }
    for (let k = arrBear.length - 1; k >= 0; k--) {
      const ln = arrBear[k].ln;
      line.set_x2(ln, i);
      const x1 = line.get_x1(ln);
      if (i - x1 > maxLen) {
        line.delete(ln);
        arrBear.splice(k, 1);
      } else if (gt(b.close, line.get_y2(ln))) {
        if (i - x1 >= minLen) {
          line.set_color(ln, cBull);
          if (trend === 1) line.set_style(ln, 'dashed');
          trend = 1;
          label.new(Math.ceil((x1 + i) / 2), line.get_y2(ln), 'CISD', undefined, undefined, INV, 'label_down', cBull, size);
          label.new(i, b.low, '▲', undefined, undefined, INV, 'label_up', cBull, size);
        } else {
          line.delete(ln);
        }
        arrBear.splice(k, 1);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const ChangeInStateOfDeliveryLuxAlgo = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
