/**
 * HTF Candle Profile [ChartPrime]
 *
 * The bar after each new "TimeFrame" period (daily, weekly, monthly) is marked with a light background and the
 * timeframe letter at the bottom of the chart (last 1000 bars). On the last bar the current higher-timeframe candle is
 * drawn to the right of the chart: when the current period is younger than "Min Period Profile" bars it also covers
 * the period before (open of the period before, close of the first bar of the current period), else it covers the
 * current period (open of its first bar, last close). Over the bars of that span:
 * - a volume profile of the closes (rows of 0.3 x ATR(200)), boxes ending 50 + "Profile Offset" bars after the last
 *   bar, the widest row (the PoC) with a line and its volume back to the start of the span;
 * - the candle (a wick line from the high to the low, a 10 px body line from the close to the open), 55 + offset bars
 *   after the last bar, green when the close is above the open, else red;
 * - dashed high / low lines and dotted open / close lines from the start of the span, with their labels.
 * The chart colours (`chart.fg_color` / `chart.bg_color`) come from the chart context (`foregroundColorOf` /
 * `backgroundColorOf`); the periods follow the exchange calendar of the context (src/anchor-period.ts).
 *
 * Reference: "HTF Candle Profile [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  ta, str, color, line, label, box, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { periodChanges, timeAfterLastBar } from '../anchor-period';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';
import { barTime } from '../bar-time';

export interface HtfCandleProfileInputs {
  /** Higher timeframe of the candle */
  tf: 'D' | 'W' | 'M';
  /** Profile Offset (bars) */
  offset: number;
  /** Min Period Profile (bars) */
  minPeriod: number;
  dHigh: boolean;
  dLow: boolean;
  dClose: boolean;
  dOpen: boolean;
  dPoc: boolean;
  bullishColor: string;
  bearishColor: string;
}

export const defaultInputs: HtfCandleProfileInputs = {
  tf: 'W',
  offset: 5,
  minPeriod: 50,
  dHigh: true,
  dLow: true,
  dClose: true,
  dOpen: true,
  dPoc: true,
  bullishColor: '#4CAF50',
  bearishColor: '#F23645',
};

const LEVELS = 'Levels';

export const inputConfig: InputConfig[] = [
  { id: 'tf', type: 'timeframe', title: 'TimeFrame', defval: 'W', options: ['D', 'W', 'M'], tooltip: 'Daily, Weekly, Monthly' },
  { id: 'offset', type: 'int', title: 'Profile Offset', defval: 5 },
  {
    id: 'minPeriod', type: 'int', title: 'Min Period Profile', defval: 50, min: 10,
    tooltip: 'Defines how many bars must pass before calculating the HTF candle profile to ensure enough data for accurate volume distribution.',
  },
  { id: 'dHigh', type: 'bool', title: 'High', defval: true, group: LEVELS, inline: 'Levels' },
  { id: 'dLow', type: 'bool', title: 'Low', defval: true, group: LEVELS, inline: 'Levels' },
  { id: 'dClose', type: 'bool', title: 'Close', defval: true, group: LEVELS, inline: 'Levels' },
  { id: 'dOpen', type: 'bool', title: 'Open', defval: true, group: LEVELS, inline: 'Levels' },
  { id: 'dPoc', type: 'bool', title: 'PoC', defval: true, group: LEVELS, inline: 'Levels', tooltip: 'HTF Levels' },
  { id: 'bullishColor', type: 'color', title: '', defval: '#4CAF50', inline: 'candle' },
  { id: 'bearishColor', type: 'color', title: '', defval: '#F23645', inline: 'candle' },
];

// No plot(): a background colour, a plotchar and drawings
export const plotConfig: PlotConfig[] = [];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'TimeFrame', char: 'W', location: 'bottom', color: '#2962ff', size: 'small' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box', 'label'];

export const metadata = {
  title: 'HTF Candle Profile [ChartPrime]',
  shortTitle: 'HTF Candle Profile [ChartPrime]',
  overlay: true,
};

/** bgcolor / plotchar show_last = 1000 */
const SHOW_LAST = 1000;

/** Pine float comparisons (1e-10) */
const gt = (a: number, b: number) => a - b > 1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<HtfCandleProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const ms = chart?.timeUnit === 'ms' || (n > 0 && bars[0].time >= 1e12);
  const changeBg = String(color.new(fg, 90));
  const changes = n > 0 ? periodChanges(bars, cfg.tf, chart) : [];
  const atr = ta.atr(bars, 200).toArray().map((v) => v ?? NaN);

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const start: number[] = [];
  const O: number[] = [];
  const C: number[] = [];
  let period = 0;
  let Op = NaN;
  let Cl = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // timeframe.change(tf)[1]
    const changed = i > 0 && changes[i - 1];
    if (changed) {
      O.push(b.open);
      C.push(b.close);
      start.push(i);
    }
    if (start.length > 1) {
      if (i - start[start.length - 1] < cfg.minPeriod) {
        period = i - start[start.length - 2];
        Op = O[O.length - 2];
        Cl = C[C.length - 1];
      } else {
        period = i - start[start.length - 1];
        Op = O[O.length - 1];
        Cl = b.close;
      }
    }
    if (i >= n - SHOW_LAST) {
      if (changed) bgColors.push({ id: 'bgcolor0', time: b.time, color: changeBg });
      // plotchar(timeframe.change(tf)[1], "TimeFrame", tf, location.bottom, chart.fg_color, size = size.small)
      if (changed) {
        markers.push({ id: 'char0', time: b.time, position: 'bottom', shape: 'circle', char: cfg.tf, color: fg, size: 'small' });
      }
    }
  }

  resetDrawings({ line: 500, box: 500, label: 50, polyline: 100 });
  if (n > 0) {
    const L = n - 1;
    setDrawingBar(L, true);
    const HL: number[] = [];
    for (let i = 0; i <= period; i++) {
      HL.push(L - i >= 0 ? bars[L - i].high : NaN);
      HL.push(L - i >= 0 ? bars[L - i].low : NaN);
    }
    const vals = HL.filter((v) => !Number.isNaN(v));
    const max = vals.length ? Math.max(...vals) : NaN;
    const min = vals.length ? Math.min(...vals) : NaN;
    const atrL = atr[L] * 0.3;

    // Auto bins size
    const height = max - min;
    const size = Math.ceil(height / atrL);
    const step = height / size;
    if (!(size > 0)) {
      // array.new<float>(size) with size 0 (or na), then binsVol.get(0): Pine runtime error
      throw new Error(`Index 0 is out of bounds, array size is 0`);
    }
    const binsVol = new Array<number>(size).fill(0);
    for (let k = 0; k <= period; k++) {
      const close = L - k >= 0 ? bars[L - k].close : NaN;
      const vol = L - k >= 0 ? bars[L - k].volume ?? NaN : NaN;
      for (let i = 0; i <= size - 1; i++) {
        const loww = min + step * i;
        const mid = loww + step / 2;
        if (le(Math.abs(close - mid), step)) binsVol[i] = binsVol[i] + vol;
      }
    }
    const binsDefined = binsVol.filter((v) => !Number.isNaN(v));
    const binsMax = binsDefined.length ? Math.max(...binsDefined) : NaN;

    const barColor = gt(Cl, Op) ? cfg.bullishColor : cfg.bearishColor;
    const faded = color.new(barColor, 90);
    for (let i = 0; i <= size - 1; i++) {
      const bot = min + step * i;
      const top = bot + step;
      const volumeVal = Math.trunc(binsVol[i] / binsMax * 50);
      const indx = L + 50 + cfg.offset;
      const bgColor = String(color.from_gradient(volumeVal, 0, 50, faded, barColor));
      box.new(indx, top, indx - volumeVal, bot, bg, 1, 'solid', 'none', 'bar_index', bgColor);
      // PoC
      if (volumeVal === 50 && cfg.dPoc) {
        const y = (bot + top) / 2;
        line.new(indx - volumeVal, y, L - period, y, 'bar_index', 'none', barColor);
        label.new(L - period, (top + bot) / 2, str.tostring(binsVol[i], 'volume'), 'bar_index', 'price', 'transparent',
          'label_right', fg);
      }
    }
    const indxBar = L + 55 + cfg.offset;

    // Bar render
    line.new(indxBar, max, indxBar, min, 'bar_index', 'none', barColor);
    line.new(indxBar, Cl, indxBar, Op, 'bar_index', 'none', barColor, 'solid', 10);
    if (cfg.dHigh) {
      label.new(indxBar, max, 'High: ' + str.tostring(max), 'bar_index', 'price', 'transparent', 'label_down', fg);
      line.new(L - period, max, indxBar, max, 'bar_index', 'none', barColor, 'dashed');
    }
    if (cfg.dLow) {
      label.new(indxBar, min, 'Low: ' + str.tostring(min), 'bar_index', 'price', 'transparent', 'label_up', fg);
      line.new(L - period, min, indxBar, min, 'bar_index', 'none', barColor, 'dashed');
    }
    if (cfg.dClose) {
      label.new(indxBar, Cl, 'Close: ' + str.tostring(Cl), 'bar_index', 'price', 'transparent', 'label_left', fg);
      line.new(L - period, Cl, indxBar, Cl, 'bar_index', 'none', barColor, 'dotted');
    }
    if (cfg.dOpen) {
      label.new(indxBar, Op, 'Open: ' + str.tostring(Op), 'bar_index', 'price', 'transparent', 'label_left', fg);
      line.new(L - period, Op, indxBar, Op, 'bar_index', 'none', barColor, 'dotted');
    }
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars, ms ? 'ms' : 's');
  resetDrawings();

  // Points after the last bar: the bar `k` bars after it on the exchange calendar of the context
  if (n > 1) {
    const lastTime = bars[n - 1].time;
    const future = new Map<number, number>();
    for (let k = 1; k <= 60 + Math.max(0, cfg.offset); k++) future.set(barTime(bars, n - 1 + k), timeAfterLastBar(bars, k, chart));
    const at = (t: number) => (t > lastTime ? future.get(t) ?? t : t);
    for (const l of drawn.lines ?? []) {
      l.time1 = at(l.time1);
      l.time2 = at(l.time2);
    }
    for (const b of drawn.boxes ?? []) {
      b.time1 = at(b.time1);
      b.time2 = at(b.time2);
    }
    for (const l of drawn.labels ?? []) l.time = at(l.time);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    bgColors,
    ...drawn,
  };
}

export const HtfCandleProfile = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, barColorConfig, drawingKinds,
};
