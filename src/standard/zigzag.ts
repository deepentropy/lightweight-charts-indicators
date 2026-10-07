/**
 * Zig Zag Indicator
 *
 * Identifies trend reversals by connecting pivot highs and lows
 * that exceed a specified percentage deviation threshold.
 *
 * Based on the standard Zig Zag indicator (ZigZag library v7 / v8).
 *
 * PineScript display:
 *   line.new(start, end, color = lineColorInput, width = 2) for each pivot (the first pivot's line has zero length)
 *   label.new(end, text, yloc = abovebar / belowbar, style = label.style_none, textcolor = green / red)
 *   Label text: "<price> (<change>) \n<cumulative volume>", parts shown per the Display inputs; no label when all
 *   three are off. The change is absolute (format.mintick) or a percentage of the previous pivot ("Percent").
 *   The volume of a pivot sums volume[depth] over the bars that built it; the last-bar extension adds the
 *   volume of the last max(depth, 1) bars (depth = max(2, floor(Pivot legs / 2))).
 *
 * The original formats prices with format.mintick (syminfo.mintick). Bars carry no symbol info, so the port uses a
 * tick of 0.01 (prices rounded to 2 decimals); symbols with another tick show other decimals in the original.
 */

import {
  ZigZag as ZigZagEngine,
  str,
  type ZigZagPivot,
  type IndicatorResult,
  type Bar,
} from 'oakscriptjs';

import type { InputConfig, PlotConfig } from 'oakscriptjs';
import type { LineDrawingData, LabelData } from '../types';

/** syminfo.mintick is not available to the port (Bar has no symbol info): tick 0.01, printed with 2 decimals */
const MINTICK = 0.01;

export type ZigZagPriceDiffMode = 'Absolute' | 'Percent';

/**
 * ZigZag indicator input parameters
 */
export interface ZigZagInputs {
  /** Minimum percentage deviation for reversal (default: 5.0) */
  deviation: number;
  /** Number of bars for pivot point detection (default: 10) */
  depth: number;
  /** Colour of the zig zag lines */
  lineColor: string;
  /** Extend line from last pivot to current bar */
  extendLast: boolean;
  /** Display reversal price */
  showPrice: boolean;
  /** Display cumulative volume */
  showVolume: boolean;
  /** Display price change */
  showChange: boolean;
  /** Price change as an absolute price difference or a percentage */
  priceDiff: ZigZagPriceDiffMode;
}

/**
 * Extended result with pivot data
 */
export interface ZigZagResult extends IndicatorResult {
  /** Raw pivot data for advanced consumers */
  pivots: ZigZagPivot[];
  /** Extension line to current bar (if extendLast enabled) */
  extension: ZigZagPivot | null;
  /** Line drawings connecting pivots */
  lines: LineDrawingData[];
  /** Labels at pivot points */
  labels: LabelData[];
}

/**
 * Default input values
 */
export const defaultInputs: ZigZagInputs = {
  deviation: 5.0,
  depth: 10,
  lineColor: '#2962FF',
  extendLast: true,
  showPrice: true,
  showVolume: true,
  showChange: true,
  priceDiff: 'Absolute',
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'deviation', type: 'float', title: 'Price deviation for reversals (%)', defval: 5.0, min: 1e-05, max: 100, tooltip: '0.00001 - 100', step: 0.5 },
  { id: 'depth', type: 'int', title: 'Pivot legs', defval: 10, min: 2 },
  { id: 'lineColor', type: 'color', title: 'Line color', defval: '#2962FF' },
  { id: 'extendLast', type: 'bool', title: 'Extend to last bar', defval: true, display: 'none' },
  { id: 'showPrice', type: 'bool', title: 'Display reversal price', defval: true, display: 'none' },
  { id: 'showVolume', type: 'bool', title: 'Display cumulative volume', defval: true, display: 'none' },
  { id: 'showChange', type: 'bool', title: 'Display reversal price change', defval: true, inline: 'priceRev', display: 'none' },
  { id: 'priceDiff', type: 'string', title: '', defval: 'Absolute', options: ['Absolute', 'Percent'], inline: 'priceRev', display: 'none', active: 'showChange' },
];

// No line plots — rendered via lines and labels
export const plotConfig: PlotConfig[] = [];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Zig Zag',
  shortTitle: 'ZigZag',
  overlay: true,
};

/**
 * Calculate ZigZag indicator
 */
export function calculate(bars: Bar[], inputs: Partial<ZigZagInputs> = {}): ZigZagResult {
  const opts = { ...defaultInputs, ...inputs };

  if (bars.length === 0) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      pivots: [],
      extension: null,
      lines: [],
      labels: [],
    };
  }

  // Pivot detection and per-pivot volume of the library. The original adds nz(volume[depth]) on each bar.
  const depth = Math.max(2, Math.floor(opts.depth / 2));
  const engine = new ZigZagEngine({ devThreshold: opts.deviation, depth: opts.depth, extendLast: opts.extendLast });
  for (let i = 0; i < bars.length; i++) {
    const v = i >= depth ? bars[i - depth].volume : NaN;
    engine.update({ ...bars[i], volume: Number.isFinite(v) ? v : 0 }, i);
  }
  const pivots = engine.pivots;
  const last = bars.length - 1;
  let extension = engine.getExtension(bars[last], last);
  if (extension) {
    // updatePivot(end, sumVol + math.sum(volume, max(depth, 1)))
    let remVol = 0;
    for (let i = Math.max(0, last - depth + 1); i <= last; i++) remVol += bars[i].volume ?? NaN;
    extension = { ...extension, volume: extension.volume + (last + 1 >= depth ? remVol : NaN) };
  }

  // Each pivot draws its own line and label; the first pivot starts on its own end point (start moves with end)
  const segments = pivots.map((p, k) => (k === 0 ? { ...p, start: p.end } : p));
  if (extension) segments.push(extension);

  // str.tostring(v, format.mintick) with the port's tick
  const fmtPrice = (v: number) => str.tostring(v, 'mintick', MINTICK);
  const labelText = (start: number, end: number, vol: number) => {
    let text = '';
    if (opts.showPrice) text += fmtPrice(end) + ' ';
    if (opts.showChange) {
      const diff = end - start;
      const sign = Math.sign(diff) > 0 ? '+' : '';
      const diffStr = opts.priceDiff === 'Absolute' ? fmtPrice(diff) : str.tostring((diff * 100) / start, 'percent');
      text += `(${sign}${diffStr}) `;
    }
    if (opts.showVolume) text += '\n' + str.tostring(vol, 'volume');
    return text;
  };
  const showLabels = opts.showPrice || opts.showChange || opts.showVolume;

  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  for (const seg of segments) {
    lines.push({
      time1: seg.start.time,
      price1: seg.start.price,
      time2: seg.end.time,
      price2: seg.end.price,
      color: opts.lineColor,
      width: 2,
      style: 'solid',
    });
    if (showLabels) {
      labels.push({
        time: seg.end.time,
        price: seg.end.price,
        text: labelText(seg.start.price, seg.end.price, seg.volume),
        textColor: seg.isHigh ? '#4CAF50' : '#FF5252',
        style: 'none',
        yloc: seg.isHigh ? 'abovebar' : 'belowbar',
        size: 'normal',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    pivots,
    extension,
    lines,
    labels,
  };
}

/**
 * ZigZag indicator module
 */
export const ZigZag = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
