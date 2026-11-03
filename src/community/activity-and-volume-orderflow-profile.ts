/**
 * Activity and Volume Orderflow Profile [AlgoAlpha]
 *
 * A volume profile of the last `Profile Lookback` + 1 bars, drawn on the last bar. The price range of those bars
 * (highest high to lowest low) is cut into `Profile Resolution` rows. A bar adds its volume to every row that its
 * high-low range touches: to the buy volume of the row when it closed above its open, to the sell volume when it
 * closed below. Bars with no lookback history count as na (they add nothing).
 *
 * "Comparison": buy rows grow to the left and sell rows to the right of a vertical axis `Profile Horizontal Offset`
 * + `Profile Horizontal Scale` bars after the last bar; a row is `round(volume) / round(largest row) * scale` bars
 * long (the box x is truncated to a bar). The largest row has the chart foreground colour. "Net Order Flow": one
 * row of `round(sell - buy) / max(round(largest sell), round(largest buy)) * scale` bars from the axis (to the
 * right when sell > buy, else to the left), in the colour of the larger side. Row texts are volumes
 * (`format.volume`).
 *
 * The lookback box spans the lookback bars (highest high to lowest low of `Profile Lookback` bars) and the heatmap
 * paints each row over the lookback with a transparency of 100 - average(buy share, sell share) * 100 + `Minimum
 * Transaprency` (shares of the largest rows; above 100: transparent).
 *
 * The original deletes and draws all boxes again on each bar: only the boxes of the last bar are alive at the end,
 * so the port draws them on the last bar.
 *
 * Chart context: `chart.fg_color` (largest rows, texts, lookback box, heatmap; #DBDBDB, the dark theme value,
 * without a context).
 *
 * Reference: "Activity and Volume Orderflow Profile [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  box, color, str, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface ActivityAndVolumeOrderflowProfileInputs {
  /** Profile Type */
  ptype: 'Comparison' | 'Net Order Flow';
  /** Profile Lookback */
  plook: number;
  /** Profile Resolution */
  res: number;
  /** Profile Horizontal Scale */
  scale: number;
  /** Profile Horizontal Offset */
  off: number;
  /** Show Profile */
  h: boolean;
  /** Show VIsualisation of Lookback Period */
  b: boolean;
  /** Show Heatmap */
  hm: boolean;
  /** Minimum Transaprency */
  mint: number;
  /** Up Color */
  green: string;
  /** Down Color */
  red: string;
}

export const defaultInputs: ActivityAndVolumeOrderflowProfileInputs = {
  ptype: 'Comparison',
  plook: 70,
  res: 20,
  scale: 30,
  off: 7,
  h: true,
  b: true,
  hm: true,
  mint: 10,
  green: '#00ffbb',
  red: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'ptype', type: 'string', title: 'Profile Type', defval: 'Comparison', options: ['Comparison', 'Net Order Flow'] },
  { id: 'plook', type: 'int', title: 'Profile Lookback', defval: 70 },
  { id: 'res', type: 'int', title: 'Profile Resolution', defval: 20 },
  { id: 'scale', type: 'int', title: 'Profile Horizontal Scale', defval: 30 },
  { id: 'off', type: 'int', title: 'Profile Horizontal Offset', defval: 7 },
  { id: 'h', type: 'bool', title: 'Show Profile', defval: true, group: 'Appearance' },
  { id: 'b', type: 'bool', title: 'Show VIsualisation of Lookback Period', defval: true, group: 'Appearance' },
  { id: 'hm', type: 'bool', title: 'Show Heatmap', defval: true, group: 'Appearance' },
  {
    id: 'mint', type: 'int', title: 'Minimum Transaprency', defval: 10, min: 0, max: 100, group: 'Appearance',
    tooltip: 'Adjust this to make the heatmap highlight only areas of high activity (0-100)',
  },
  { id: 'green', type: 'color', title: 'Up Color', defval: '#00ffbb', group: 'Appearance' },
  { id: 'red', type: 'color', title: 'Down Color', defval: '#ff1100', group: 'Appearance' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box'];

export const metadata = {
  title: 'Activity and Volume Orderflow Profile [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - 👽Activity and Volume',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine math.round: half away from zero */
const round = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));
/** array.max / array.min: na elements are skipped */
const maxOf = (a: number[]) => a.reduce((m, v) => (Number.isNaN(v) || (!Number.isNaN(m) && v <= m) ? m : v), NaN);
const minOf = (a: number[]) => a.reduce((m, v) => (Number.isNaN(v) || (!Number.isNaN(m) && v >= m) ? m : v), NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<ActivityAndVolumeOrderflowProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const result: IndicatorResult = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  // indicator(max_boxes_count = 500)
  resetDrawings({ box: 500 });
  if (n === 0) return { ...result, ...drawingOutputs(bars) };
  const { plook, res, scale, off, mint } = cfg;
  const fg = foregroundColorOf(chart);
  const yel = fg;
  const i = n - 1;
  setDrawingBar(i, true);

  // for i = 0 to plook: high[i], low[i], buy / sell volume of bar i back (na before the first bar)
  const highs: number[] = [];
  const lows: number[] = [];
  const buyVolumes: number[] = [];
  const sellVolumes: number[] = [];
  for (let k = 0; k <= plook; k++) {
    const x = bars[i - k];
    highs.push(x ? x.high : NaN);
    lows.push(x ? x.low : NaN);
    buyVolumes.push(x && gt(x.close, x.open) ? x.volume ?? NaN : 0);
    sellVolumes.push(x && gt(x.open, x.close) ? x.volume ?? NaN : 0);
  }
  const maxx = maxOf(highs);
  const minn = minOf(lows);
  const step = (maxx - minn) / res;

  // rows: bottom / top boundaries and the buy (binlen) and sell (binlen1) volume of each row
  const bottoms: number[] = [];
  const tops: number[] = [];
  const binlen: number[] = [];
  const binlen1: number[] = [];
  for (let r = 0; r < res; r++) {
    const bottom = minn + r * step;
    const top = minn + (r + 1) * step;
    bottoms.push(bottom);
    tops.push(top);
    let buy = 0;
    let sell = 0;
    for (let j = 0; j < highs.length; j++) {
      const inBucket = !(gt(lows[j], top) || gt(bottom, highs[j]));
      buy += inBucket ? buyVolumes[j] : 0;
      sell += inBucket ? sellVolumes[j] : 0;
    }
    binlen.push(buy);
    binlen1.push(sell);
  }
  // the arrays were created with `res` na elements and the rows inserted in front: max skips the na elements
  const maxBuy = maxOf(binlen);
  const maxSell = maxOf(binlen1);

  if (cfg.ptype === 'Comparison') {
    if (cfg.h) {
      for (let r = 0; r < res; r++) {
        const boxRight = i + off + scale;
        const boxLeft = boxRight - round(binlen[r]) / round(maxBuy) * scale;
        const isMax = eq(maxBuy, binlen[r]);
        box.new(Math.trunc(boxLeft), tops[r], boxRight, bottoms[r], String(color.new(isMax ? yel : cfg.green, 0)), 1,
          'solid', undefined, undefined, String(color.new(isMax ? yel : cfg.green, 90)), str.tostring(binlen[r], 'volume'),
          undefined, fg);
      }
      for (let r = 0; r < res; r++) {
        const boxLeft = i + off + scale;
        const boxRight = boxLeft + round(binlen1[r]) / round(maxSell) * scale;
        const isMax = eq(maxSell, binlen1[r]);
        box.new(boxLeft, tops[r], Math.trunc(boxRight), bottoms[r], String(color.new(isMax ? yel : cfg.red, 0)), 1,
          'solid', undefined, undefined, String(color.new(isMax ? yel : cfg.red, 90)), str.tostring(binlen1[r], 'volume'),
          undefined, fg);
      }
    }
  } else if (cfg.h) {
    for (let r = 0; r < res; r++) {
      const boxLeft = i + off + scale;
      const boxRight = boxLeft + (round(binlen1[r] - binlen[r]) / Math.max(round(maxSell), round(maxBuy)) * scale);
      const dircol = gt(binlen1[r], binlen[r]) ? cfg.red : cfg.green;
      box.new(boxLeft, tops[r], Math.trunc(boxRight), bottoms[r], String(color.new(dircol, 0)), 1, 'solid', undefined,
        undefined, String(color.new(dircol, 90)), str.tostring(Math.abs(binlen1[r] - binlen[r]), 'volume'), undefined, fg);
    }
  }

  if (cfg.b) {
    // ta.highest(plook) / ta.lowest(plook): high / low of the last plook bars
    let hh = NaN;
    let ll = NaN;
    if (i >= plook - 1) {
      for (let k = i - plook + 1; k <= i; k++) {
        if (Number.isNaN(hh) || bars[k].high > hh) hh = bars[k].high;
        if (Number.isNaN(ll) || bars[k].low < ll) ll = bars[k].low;
      }
    }
    box.new(i - plook, hh, i, ll, String(color.new(fg, 40)), 1, 'solid', 'none', undefined, String(color.new(fg, 90)),
      'Lookback Data', 'tiny', fg, 'center', 'top');
    if (cfg.hm) {
      for (let r = 0; r < res; r++) {
        const share = ((round(binlen1[r]) / round(maxSell)) + (round(binlen[r]) / round(maxBuy))) / 2;
        const transp = (100 - share * 100) + mint;
        box.new(i - plook, tops[r], i, bottoms[r], String(color.new(fg, 100)), 1, 'solid', undefined, undefined,
          String(color.new(fg, transp)));
      }
    }
  }

  return { ...result, ...drawingOutputs(bars) };
}

export const ActivityAndVolumeOrderflowProfile = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds,
};
