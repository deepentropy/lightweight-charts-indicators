/**
 * Market Trend Levels Detector [BigBeluga]
 *
 * A fast and a slow EMA of the close. When the fast EMA crosses above the slow one (on a confirmed bar), every bar of
 * the last Slow + 1 bars whose low equals the lowest low of the last Slow bars gets a level line (25 bars long) and a
 * "●" label; a cross below does the same with the highs. "Extend Lines" draws the levels up to the current bar until
 * the price breaks them (then they stop and become dotted). Only the last "Display Last" lines are kept (the oldest
 * line is deleted, one per bar). The two EMAs are hidden plots; the area between them is filled with a gradient by
 * the EMA gap, and an x-cross marks the fast EMA one bar before each cross.
 *
 * Chart values (optional third argument of calculate): the marker colour (chart foreground colour) and whether the
 * last bar is confirmed (barstate.isconfirmed).
 *
 * Reference: "Market Trend Levels Detector [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, color, Series, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type Line, type PlotConfig,
  type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import { foregroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface MarketTrendLevelsDetectorInputs {
  /** Fast EMA length */
  length1: number;
  /** Slow EMA length (also the window of the levels) */
  length2: number;
  /** Draw the levels up to the current bar until they are broken */
  extend: boolean;
  /** Number of lines kept */
  qty: number;
  col1: string;
  col2: string;
}

export const defaultInputs: MarketTrendLevelsDetectorInputs = {
  length1: 12,
  length2: 25,
  extend: false,
  qty: 50,
  col1: '#26ba9f',
  col2: '#6626ba',
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: 'Fast', defval: 12, group: 'Trend' },
  { id: 'length2', type: 'int', title: 'Slow', defval: 25, group: 'Trend' },
  { id: 'extend', type: 'bool', title: 'Extend Lines', defval: false, group: 'Levels' },
  { id: 'qty', type: 'int', title: 'Display Last', defval: 50, group: 'Levels' },
  { id: 'col1', type: 'color', title: '', defval: '#26ba9f', inline: 'col', group: 'Color' },
  { id: 'col2', type: 'color', title: '', defval: '#6626ba', inline: 'col', group: 'Color' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26ba9f', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Slow EMA', color: '#6626ba', lineWidth: 1, display: 'none' },
];

export const fillConfig: FillConfig[] = [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background' }];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Signal', style: 'xcross', location: 'absolute', color: '#DBDBDB', offset: -1 },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Market Trend Levels Detector [BigBeluga]',
  shortTitle: 'Market Trend Levels Detector [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketTrendLevelsDetectorInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length1, length2, extend, qty, col1, col2 } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const low = bars.map((b) => b.low);
  const high = bars.map((b) => b.high);

  const ema1 = A(ta.ema(close, length1));
  const ema2 = A(ta.ema(close, length2));
  const diff = ema1.map((v, i) => v - ema2[i]);
  const crossUp = A(ta.crossover(Series.fromArray(bars, ema1), Series.fromArray(bars, ema2))).map((v) => v === 1);
  const crossDn = A(ta.crossunder(Series.fromArray(bars, ema1), Series.fromArray(bars, ema2))).map((v) => v === 1);
  const lowest = A(ta.lowest(Series.fromArray(bars, low), length2));
  const highest = A(ta.highest(Series.fromArray(bars, high), length2));
  const diffS = Series.fromArray(bars, diff);
  const diffHigh = A(ta.highest(diffS, 100));
  const diffLow = A(ta.lowest(diffS, 100));
  const lastConfirmed = lastBarConfirmedOf(chart);

  // indicator(max_lines_count = 500); labels: the default 50
  resetDrawings({ line: 500, label: 50 });
  const linesUp: (Line | null)[] = [];
  const linesDn: (Line | null)[] = [];
  const up = new Array<boolean>(n).fill(false);
  const dn = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const confirmed = i < n - 1 || lastConfirmed;
    up[i] = crossUp[i] && confirmed;
    dn[i] = crossDn[i] && confirmed;

    if (up[i]) {
      for (let k = 0; k <= length2; k++) {
        if (i - k >= 0 && eq(low[i - k], lowest[i])) {
          const index = i - k;
          linesDn.push(line.new(index, lowest[i], index + 25, lowest[i], 'bar_index', 'none', col1));
          label.new(index, lowest[i], '●', 'bar_index', 'price', col1, 'label_up', '#FFFFFF', 'tiny');
        }
      }
    }
    if (dn[i]) {
      for (let k = 0; k <= length2; k++) {
        if (i - k >= 0 && eq(high[i - k], highest[i])) {
          const index = i - k;
          linesUp.push(line.new(index, highest[i], index + 25, highest[i], 'bar_index', 'none', col2));
          label.new(index, highest[i], '●', 'bar_index', 'price', col2, 'label_down', '#FFFFFF', 'tiny');
        }
      }
    }

    if (extend) {
      // a line set to na in the array is skipped (methods on na do nothing)
      for (let k = linesUp.length - 1; k >= 0; k--) {
        const l = linesUp[k];
        if (!l) continue;
        line.set_x2(l, i);
        if (gt(high[i], line.get_y2(l))) {
          line.set_style(l, 'dotted');
          linesUp[k] = null;
        }
      }
      for (let k = linesDn.length - 1; k >= 0; k--) {
        const l = linesDn[k];
        if (!l) continue;
        line.set_x2(l, i);
        if (lt(low[i], line.get_y2(l))) {
          line.set_style(l, 'dotted');
          linesDn[k] = null;
        }
      }
    }

    // a_allLines = line.all; if array.size(a_allLines) > qty: line.delete(array.shift(a_allLines))
    const all = line.all();
    if (all.length > qty) line.delete(all[0]);
  }
  setDrawingBar(null);

  // fill(p1, p2, ema1 > ema2 ? color1 : color2)
  const c1Faded = String(color.new(col1, 70));
  const c2Faded = String(color.new(col2, 70));
  const fillColors = bars.map((_, i) => {
    const c = gt(ema1[i], ema2[i])
      ? color.from_gradient(diff[i], 0, diffHigh[i], c1Faded, col1)
      : color.from_gradient(diff[i], diffLow[i], 0, col2, c2Faded);
    return c == null ? 'transparent' : String(c);
  });
  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors },
  ];

  // plotshape(cross_up or cross_dn ? ema1[1] : na, "Signal", shape.xcross, location.absolute, offset = -1)
  const fg = foregroundColorOf(chart);
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    if ((up[i] || dn[i]) && !isNaN(ema1[i - 1])) {
      markers.push({ id: 'shape0', time: bars[i - 1].time, position: 'atPriceMiddle', price: ema1[i - 1], shape: 'xcross', color: fg });
    }
  }

  const pts = (values: number[], c: string) => values.map((v, i) => ({ time: bars[i].time, value: v, color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pts(ema1, col1), plot1: pts(ema2, col2) },
    fills,
    markers,
    ...drawingOutputs(bars),
  };
}

export const MarketTrendLevelsDetector = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  drawingKinds,
};
