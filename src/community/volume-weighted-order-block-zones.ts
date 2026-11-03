/**
 * Volume-Weighted Order Block Zones [BigBeluga]
 *
 * Swing pivots (ta.pivothigh / ta.pivotlow, "Swing Detection Length" bars on each side) give order blocks. Each pivot
 * gets a volume strength from the volume of the pivot bar against its 20-bar volume average:
 * alpha = clamp(int(96 - 12 * volume / average), 40, 92), strength = 100 - alpha. A pivot with a strength below "Min
 * Volume Strength (%)" is skipped. For a pivot low, the trigger level is the pivot bar low + ATR(100) * "Displacement
 * Multiplier" (pivot high: high - ATR * multiplier):
 * - when a high of the last bars already reached the level, the order block is created at once (unless a low broke
 *   the pivot bar low after the crossing bar): a box from the pivot bar high to its low with the strength as text, and
 *   a solid trigger line from the pivot bar to the crossing bar;
 * - else a dashed trigger line runs from the pivot bar to the current bar until a close crosses the level, which
 *   creates the box and a solid line up to that bar.
 * A new block deletes the blocks of the same side that overlap it, and only the newest "Max Active Order Blocks"
 * stay. The boxes are extended to the current bar; a low below a bullish box (a high above a bearish box) deletes
 * it. A low or a close that crosses back above the top of a bullish box gives a "B" label (a high or close below the
 * bottom of a bearish box gives "S"), at most one per side every 6 bars. Each pivot gets a "PL" / "PH" label whose
 * text fades with the strength.
 *
 * As the original script (calc_bars_count = 3000), only the last 3,000 bars are calculated: the bars before have no
 * drawing and the history of the script starts on the first of these bars.
 *
 * Chart values read: the tick size (pivot price in the label tooltips), the chart foreground colour (box texts, B / S
 * label texts; dark theme #DBDBDB without a context) and whether the last bar is closed (barstate.isconfirmed: no
 * retest label and no trigger on an open last bar).
 *
 * Reference: "Volume-Weighted Order Block Zones [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, str, color, Series, line, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Box,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';

export interface VolumeWeightedOrderBlockZonesInputs {
  swLen: number;
  maxOB: number;
  displacement: number;
  minVolStrength: number;
  lblSize: 'tiny' | 'small' | 'normal' | 'large';
  bullObColor: string;
  bearObColor: string;
  bullLineColor: string;
  bearLineColor: string;
  plTextColor: string;
  phTextColor: string;
}

export const defaultInputs: VolumeWeightedOrderBlockZonesInputs = {
  swLen: 10,
  maxOB: 10,
  displacement: 4.0,
  minVolStrength: 0,
  lblSize: 'small',
  bullObColor: '#4bffa5',
  bearObColor: '#ff784f',
  bullLineColor: '#4bffa5',
  bearLineColor: '#ff784f',
  plTextColor: '#4bffa5',
  phTextColor: '#ff784f',
};

const G_OB = 'Order Block Settings';
const G_DISP = 'Display Settings';
const G_COL = 'Color Settings';

export const inputConfig: InputConfig[] = [
  {
    id: 'swLen', type: 'int', title: 'Swing Detection Length', defval: 10, group: G_OB,
    tooltip: 'Number of bars before and after a pivot high/low required to confirm a swing structure.',
  },
  {
    id: 'maxOB', type: 'int', title: 'Max Active Order Blocks', defval: 10, group: G_OB,
    tooltip: 'Maximum number of active order block zones allowed on the chart simultaneously.',
  },
  {
    id: 'displacement', type: 'float', title: 'Displacement Multiplier', defval: 4.0, step: 0.1, group: G_OB,
    tooltip: 'ATR multiplier added to or subtracted from the pivot to establish the displacement trigger level.',
  },
  {
    id: 'minVolStrength', type: 'int', title: 'Min Volume Strength (%)', defval: 0, min: 0, max: 100, group: G_OB,
    tooltip: 'Filters out pivot points and order blocks with volume strength lower than this percentage.',
  },
  {
    id: 'lblSize', type: 'string', title: 'Label Size', defval: 'small', options: ['tiny', 'small', 'normal', 'large'],
    group: G_DISP, tooltip: 'Controls the font size for PL, PH, B, and S labels.',
  },
  { id: 'bullObColor', type: 'color', title: 'Bullish/Bearish OB Colors', defval: '#4bffa5', group: G_COL, inline: 'ob1' },
  {
    id: 'bearObColor', type: 'color', title: '', defval: '#ff784f', group: G_COL, inline: 'ob1',
    tooltip: 'Base color used for Bullish Order Block background zones.\nBase color used for Bearish Order Block background zones.',
  },
  { id: 'bullLineColor', type: 'color', title: 'Bullish/Bearish Trigger Line', defval: '#4bffa5', group: G_COL, inline: 'ob2' },
  {
    id: 'bearLineColor', type: 'color', title: '', defval: '#ff784f', group: G_COL, inline: 'ob2',
    tooltip: 'Color of the Bullish Displacement Trigger Line.\nColor of the Bearish Displacement Trigger Line.',
  },
  { id: 'plTextColor', type: 'color', title: 'Pivot Low/High Text Color', defval: '#4bffa5', group: G_COL, inline: 'ob3' },
  {
    id: 'phTextColor', type: 'color', title: '', defval: '#ff784f', group: G_COL, inline: 'ob3',
    tooltip: 'Base color of the Pivot Low (PL) label text.\nBase color of the Pivot High (PH) label text.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'Volume-Weighted Order Block Zones [BigBeluga]',
  shortTitle: 'Volume-Weighted Order Block Zones [BigBeluga]',
  overlay: true,
};

/** calc_bars_count of the script */
const CALC_BARS = 3000;
/** max_lines_count / max_labels_count / max_boxes_count of the script */
const MAX_OBJECTS = 500;

/** Pine float comparisons (within 1e-10; na compares false) */
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

interface OB {
  body: Box;
  triggerLevel: Line;
  isBullish: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeWeightedOrderBlockZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const swLen = Math.trunc(cfg.swLen);
  const maxOB = Math.trunc(cfg.maxOB);
  const { displacement, minVolStrength } = cfg;
  const lblSize = cfg.lblSize;
  const lblSize1 = ({ tiny: 'small', small: 'normal', normal: 'large', large: 'huge' } as const)[lblSize];
  const fg = foregroundColorOf(chart);
  const mintick = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const N = bars.length;
  const ms = N > 0 && bars[0].time >= 1e12;
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  if (N === 0) return base;

  // calc_bars_count: the script runs on the last 3,000 bars only (bar index s + j of the chart bars)
  const s = Math.max(0, N - CALC_BARS);
  const cb = bars.slice(s);
  const n = cb.length;
  const high = cb.map((b) => b.high);
  const low = cb.map((b) => b.low);
  const close = cb.map((b) => b.close);
  const volume = cb.map((b) => b.volume ?? NaN);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const arr = (x: Series) => x.toArray().map(num);
  const highS = new Series(cb, (b) => b.high);
  const lowS = new Series(cb, (b) => b.low);
  const pHigh = arr(ta.pivothigh(highS, swLen, swLen));
  const pLow = arr(ta.pivotlow(lowS, swLen, swLen));
  const volMA = arr(ta.sma(new Series(cb, (b) => b.volume ?? NaN), 20));
  const atr = arr(ta.atr(cb, 100));
  const highestSincePivot = arr(ta.highest(highS, swLen));
  const lowestSincePivot = arr(ta.lowest(lowS, swLen));
  const at = (a: number[], j: number) => (j >= 0 && j < a.length ? a[j] : NaN);

  // f_getVolumeColor(vol, sma, baseColor) -> [colour, strength] (na volume: na alpha and strength)
  const volumeColor = (vol: number, sma: number, baseColor: string): [string, number] => {
    const volRatio = sma > 0 ? vol / sma : 1.0;
    const rawAlpha = Math.trunc(96 - volRatio * 12);
    const alpha = Number.isNaN(rawAlpha) ? NaN : Math.min(Math.max(rawAlpha, 40), 92);
    return [String(color.new(baseColor, alpha)), 100 - alpha];
  };

  // bullLevel / bearLevel (var): set on each pivot with enough volume strength, whatever the drawings; the
  // breakout crossings of section 5 run on every bar
  const bullLevels: number[] = new Array(n).fill(NaN);
  const bearLevels: number[] = new Array(n).fill(NaN);
  {
    let bull = NaN, bear = NaN;
    for (let j = 0; j < n; j++) {
      if (!Number.isNaN(pLow[j]) && volumeColor(at(volume, j - swLen), at(volMA, j - swLen), cfg.plTextColor)[1] >= minVolStrength) {
        bull = at(low, j - swLen) + atr[j] * displacement;
      }
      if (!Number.isNaN(pHigh[j]) && volumeColor(at(volume, j - swLen), at(volMA, j - swLen), cfg.phTextColor)[1] >= minVolStrength) {
        bear = at(high, j - swLen) - atr[j] * displacement;
      }
      bullLevels[j] = bull;
      bearLevels[j] = bear;
    }
  }
  const closeS = new Series(cb, (b) => b.close);
  const crossUp = ta.crossover(closeS, Series.fromArray(cb, bullLevels)).toArray().map((v) => !!v);
  const crossDown = ta.crossunder(closeS, Series.fromArray(cb, bearLevels)).toArray().map((v) => !!v);

  const obBoxes: OB[] = [];
  let bullObHigh = NaN, bullObLow = NaN, bullObBar = NaN, bullObVol = NaN, bullLevel = NaN;
  let bullTriggered = true;
  let bearObHigh = NaN, bearObLow = NaN, bearObBar = NaN, bearObVol = NaN, bearLevel = NaN;
  let bearTriggered = true;
  let lastBullRetest = 0;
  let lastBearRetest = 0;
  let liveBullLine: Line | null = null;
  let liveBearLine: Line | null = null;

  const removeOverlapping = (bullish: boolean, hi: number, lo: number) => {
    for (let k = obBoxes.length - 1; k >= 0; k--) {
      const ob = obBoxes[k];
      if (ob.isBullish === bullish) {
        const oldHigh = box.get_top(ob.body);
        const oldLow = box.get_bottom(ob.body);
        if (ge(hi, oldLow) && le(lo, oldHigh)) {
          box.delete(ob.body);
          line.delete(ob.triggerLevel);
          obBoxes.splice(k, 1);
        }
      }
    }
  };
  const store = (ob: OB) => {
    obBoxes.push(ob);
    if (obBoxes.length > maxOB) {
      const old = obBoxes.shift()!;
      box.delete(old.body);
      line.delete(old.triggerLevel);
    }
  };
  const newBox = (x1: number, top: number, x2: number, bottom: number, bg: string, baseColor: string, strength: number) =>
    box.new(x1, top, x2, bottom, String(color.new(baseColor, 100)), undefined, undefined, undefined, undefined, bg,
      `${str.tostring(strength)}%`, 'small', fg, 'center', 'center');

  for (let j = 0; j < n; j++) {
    const bi = s + j;
    const isLast = j === n - 1;
    setDrawingBar(bi, isLast);
    const confirmed = !isLast || lastConfirmed;

    // 1. swing low and bullish order block
    if (!Number.isNaN(pLow[j])) {
      const tempObVol = at(volume, j - swLen);
      const [, plStrength] = volumeColor(tempObVol, at(volMA, j - swLen), cfg.plTextColor);
      if (plStrength >= minVolStrength) {
        bullObHigh = at(high, j - swLen);
        bullObLow = at(low, j - swLen);
        bullObBar = bi - swLen;
        bullObVol = tempObVol;
        bullLevel = bullObLow + atr[j] * displacement;
        bullTriggered = ge(highestSincePivot[j], bullLevel);
        const plTextColor = String(color.new(cfg.plTextColor, 80 - plStrength));
        if (liveBullLine) line.delete(liveBullLine);
        if (!bullTriggered) {
          liveBullLine = line.new(bullObBar, bullLevel, bi, bullLevel, 'bar_index', 'none', cfg.bullLineColor, 'dashed');
        } else {
          liveBullLine = null;
          let crossOffset = 0;
          for (let off = swLen - 1; off >= 0; off--) {
            if (ge(at(close, j - off), bullLevel) || ge(at(high, j - off), bullLevel)) {
              crossOffset = off;
              break;
            }
          }
          const crossBar = bi - crossOffset;
          let isMitigated = false;
          for (let off = crossOffset; off >= 0; off--) {
            if (lt(at(low, j - off), bullObLow)) {
              isMitigated = true;
              break;
            }
          }
          if (!isMitigated) {
            const [bullColor, bullStrength] = volumeColor(bullObVol, at(volMA, j - swLen), cfg.bullObColor);
            removeOverlapping(true, bullObHigh, bullObLow);
            const l = line.new(bullObBar, bullLevel, crossBar, bullLevel, 'bar_index', 'none', cfg.bullLineColor, 'solid');
            const b = newBox(bullObBar, bullObHigh, bi, bullObLow, bullColor, cfg.bullObColor, bullStrength);
            store({ body: b, triggerLevel: l, isBullish: true });
          }
        }
        label.new(bullObBar, pLow[j], 'PL', 'bar_index', 'price', String(color.new(color.black, 100)), 'label_up',
          plTextColor, lblSize, undefined,
          `Pivot Low: ${str.tostring(pLow[j], 'mintick', mintick)}\nVolume Strength: ${str.tostring(plStrength)}%`);
      }
    }

    // 2. swing high and bearish order block
    if (!Number.isNaN(pHigh[j])) {
      const tempObVol = at(volume, j - swLen);
      const [, phStrength] = volumeColor(tempObVol, at(volMA, j - swLen), cfg.phTextColor);
      if (phStrength >= minVolStrength) {
        bearObHigh = at(high, j - swLen);
        bearObLow = at(low, j - swLen);
        bearObBar = bi - swLen;
        bearObVol = tempObVol;
        bearLevel = bearObHigh - atr[j] * displacement;
        bearTriggered = le(lowestSincePivot[j], bearLevel);
        const phTextColor = String(color.new(cfg.phTextColor, 80 - phStrength));
        if (liveBearLine) line.delete(liveBearLine);
        if (!bearTriggered) {
          liveBearLine = line.new(bearObBar, bearLevel, bi, bearLevel, 'bar_index', 'none', cfg.bearLineColor, 'dashed');
        } else {
          liveBearLine = null;
          let crossOffset = 0;
          for (let off = swLen - 1; off >= 0; off--) {
            if (le(at(close, j - off), bearLevel) || le(at(low, j - off), bearLevel)) {
              crossOffset = off;
              break;
            }
          }
          const crossBar = bi - crossOffset;
          let isMitigated = false;
          for (let off = crossOffset; off >= 0; off--) {
            if (gt(at(high, j - off), bearObHigh)) {
              isMitigated = true;
              break;
            }
          }
          if (!isMitigated) {
            const [bearColor, bearStrength] = volumeColor(bearObVol, at(volMA, j - swLen), cfg.bearObColor);
            removeOverlapping(false, bearObHigh, bearObLow);
            const l = line.new(bearObBar, bearLevel, crossBar, bearLevel, 'bar_index', 'none', cfg.bearLineColor, 'solid');
            const b = newBox(bearObBar, bearObHigh, bi, bearObLow, bearColor, cfg.bearObColor, bearStrength);
            store({ body: b, triggerLevel: l, isBullish: false });
          }
        }
        label.new(bearObBar, pHigh[j], 'PH', 'bar_index', 'price', String(color.new(color.black, 100)), 'label_down',
          phTextColor, lblSize, undefined,
          `Pivot High: ${str.tostring(pHigh[j], 'mintick', mintick)}\nVolume Strength: ${str.tostring(phStrength)}%`);
      }
    }

    // 3. extend the pending trigger lines
    if (!bullTriggered && liveBullLine) line.set_x2(liveBullLine, bi);
    if (!bearTriggered && liveBearLine) line.set_x2(liveBearLine, bi);

    // 4. active zones: extension, invalidation and retest labels
    for (let k = obBoxes.length - 1; k >= 0; k--) {
      const ob = obBoxes[k];
      box.set_right(ob.body, bi);
      const obTop = box.get_top(ob.body);
      const obBottom = box.get_bottom(ob.body);
      const isInvalidated = ob.isBullish ? lt(low[j], obBottom) : gt(high[j], obTop);
      if (isInvalidated) {
        box.delete(ob.body);
        line.delete(ob.triggerLevel);
        obBoxes.splice(k, 1);
      } else if (ob.isBullish) {
        const bullCrossUp = (le(at(low, j - 1), obTop) && gt(low[j], obTop))
          || (le(at(close, j - 1), obTop) && gt(close[j], obTop));
        if (bullCrossUp && confirmed && bi - lastBullRetest > 5) {
          label.new(bi, low[j], 'B', 'bar_index', 'price', String(color.new(cfg.bullLineColor, 80)), 'label_up', fg,
            lblSize1, undefined, 'Bullish OB Retest');
          lastBullRetest = bi;
        }
      } else {
        const bearCrossDown = (ge(at(high, j - 1), obBottom) && lt(high[j], obBottom))
          || (ge(at(close, j - 1), obBottom) && lt(close[j], obBottom));
        if (bearCrossDown && confirmed && bi - lastBearRetest > 5) {
          label.new(bi, high[j], 'S', 'bar_index', 'price', String(color.new(cfg.bearLineColor, 80)), 'label_down', fg,
            lblSize1, undefined, 'Bearish OB Retest');
          lastBearRetest = bi;
        }
      }
    }

    // 5. breakout of a pending trigger level (ta.crossover / ta.crossunder run on every bar)
    if (crossUp[j] && !Number.isNaN(bullObBar) && !bullTriggered && confirmed) {
      bullTriggered = true;
      const [bullColor, bullStrength] = volumeColor(bullObVol, at(volMA, j - (bi - bullObBar)), cfg.bullObColor);
      if (liveBullLine) line.delete(liveBullLine);
      liveBullLine = null;
      removeOverlapping(true, bullObHigh, bullObLow);
      const b = newBox(bullObBar, bullObHigh, bi, bullObLow, bullColor, cfg.bullObColor, bullStrength);
      const l = line.new(bullObBar, bullLevel, bi, bullLevel, 'bar_index', 'none', cfg.bullLineColor, 'solid');
      store({ body: b, triggerLevel: l, isBullish: true });
    }
    if (crossDown[j] && !Number.isNaN(bearObBar) && !bearTriggered && confirmed) {
      bearTriggered = true;
      const [bearColor, bearStrength] = volumeColor(bearObVol, at(volMA, j - (bi - bearObBar)), cfg.bearObColor);
      if (liveBearLine) line.delete(liveBearLine);
      liveBearLine = null;
      removeOverlapping(false, bearObHigh, bearObLow);
      const b = newBox(bearObBar, bearObHigh, bi, bearObLow, bearColor, cfg.bearObColor, bearStrength);
      const l = line.new(bearObBar, bearLevel, bi, bearLevel, 'bar_index', 'none', cfg.bearLineColor, 'solid');
      store({ body: b, triggerLevel: l, isBullish: false });
    }
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const VolumeWeightedOrderBlockZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
