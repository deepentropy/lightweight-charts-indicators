/**
 * Ichimoku w/Heikin-Ashi
 *
 * Heikin-Ashi candles (close = OHLC average, open = average of the previous Heikin-Ashi open and close; white when
 * the open is below the close, else blue) with Ichimoku lines from Donchian midpoints (average of the lowest low and
 * the highest high): Conversion Line (9), Base Line (26), Leading Span A (average of the two) and Leading Span B (52).
 * The close and both spans are drawn `displacement - 1` bars forward, with a green / dark cloud fill between the
 * spans.
 *
 * Reference: "Ichimoku w/Heikin-Ashi" by yasujiy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © yasujiy
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IchimokuWHeikinAshiInputs {
  /** Conversion Line length */
  conversionPeriods: number;
  /** Base Line length */
  basePeriods: number;
  /** Leading Span B length */
  laggingSpan2Periods: number;
  /** Displacement (the forward plots use displacement - 1) */
  displacement: number;
}

export const defaultInputs: IchimokuWHeikinAshiInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Line Length', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Line Length', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Leading Span B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conversion Line', color: '#0000FF', lineWidth: 1 },
  { id: 'plot1', title: 'Base Line', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'Leading Lagging Span', color: '#800080', lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span A', color: '#00FF00', lineWidth: 1 },
  { id: 'plot4', title: 'Leading Span B', color: '#008000', lineWidth: 1 },
];

export const metadata = {
  title: 'IchimokuHeikinAshi',
  shortTitle: 'Ichimoku2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** plotcandle without bordercolor: the style default of the plot (no colorer) */
const CANDLE_BORDER = '#000000';

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface IchimokuVars {
  /** h_open[1], h_close[1] */
  prevOpen: number;
  prevClose: number;
}

interface IchimokuRun extends BarRunState<IchimokuVars> {
  /** ta.lowest(low, len) / ta.highest(high, len) of the conversion, base and span B lengths */
  lows: WindowExtreme[];
  highs: WindowExtreme[];
  leadLine1: number[];
  leadLine2: number[];
  fillColors: string[];
  plot0: Point[];
  plot1: Point[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<IchimokuWHeikinAshiInputs>): BarStudy<IchimokuRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.conversionPeriods, cfg.basePeriods, cfg.laggingSpan2Periods];
  const bull = String(color.rgb(67, 160, 71, 90));
  const bear = String(color.rgb(67, 60, 71, 90));
  return {
    init() {
      const s: IchimokuRun = {
        lows: lengths.map((len) => new WindowExtreme(true, len)), highs: lengths.map((len) => new WindowExtreme(false, len)),
        leadLine1: [], leadLine2: [], fillColors: [], plot0: [], plot1: [], candles: [],
        steps: [], vars: { prevOpen: NaN, prevClose: NaN }, lists: [], series: [],
      };
      s.steps = [...s.lows, ...s.highs];
      s.lists = [s.candles];
      s.series = [s.leadLine1, s.leadLine2, s.fillColors, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // Heikin-Ashi
      const hClose = (b.open + b.high + b.low + b.close) / 4;
      // h_open := na(h_open[1]) ? (open + close) / 2 : (nz(h_open[1]) + nz(h_close[1])) / 2
      const hOpen = isNaN(v.prevOpen) ? (b.open + b.close) / 2 : (v.prevOpen + (isNaN(v.prevClose) ? 0 : v.prevClose)) / 2;
      const hHigh = Math.max(b.high, Math.max(hOpen, hClose));
      const hLow = Math.min(b.low, Math.min(hOpen, hClose));
      v.prevOpen = hOpen;
      v.prevClose = hClose;
      // plotcandle(h_open, h_high, h_low, h_close, color = h_open < h_close ? color.white : color.blue,
      //   wickcolor = color.black)
      if (!isNaN(hOpen) && !isNaN(hHigh) && !isNaN(hLow) && !isNaN(hClose)) {
        s.candles.push({ time: b.time, open: hOpen, high: hHigh, low: hLow, close: hClose,
          color: lt(hOpen, hClose) ? color.white : color.blue, wickColor: color.black, borderColor: CANDLE_BORDER });
      }

      // Ichimoku: donchian(len) => math.avg(ta.lowest(len), ta.highest(len))
      const donchian = (k: number) => (s.lows[k].step(b.low) + s.highs[k].step(b.high)) / 2;
      const conversionLine = donchian(0);
      const baseLine = donchian(1);
      const leadLine1 = (conversionLine + baseLine) / 2;
      const leadLine2 = donchian(2);
      s.leadLine1[i] = leadLine1;
      s.leadLine2[i] = leadLine2;
      // fill(p1, p2, color = leadLine1 > leadLine2 ? color.rgb(67, 160, 71, 90) : color.rgb(67, 60, 71, 90)); the fill
      // colour of bar i goes with the plot points of bar i
      s.fillColors[i] = gt(leadLine1, leadLine2) ? bull : bear;
      s.plot0[i] = { time: b.time, value: conversionLine, color: '#0000FF' };
      s.plot1[i] = { time: b.time, value: baseLine, color: '#FF0000' };
    },
    result(s, bars) {
      // plot(..., offset = displacement - 1): the value of bar i is drawn on bar i + displacement - 1 (the time of a
      // bar after the last one follows the bar count: built from the per-bar values)
      const n = bars.length;
      const k = cfg.displacement - 1;
      const interval = barInterval(bars);
      const shifted = (value: (i: number) => number, col: string) => {
        const out: Point[] = new Array(n);
        for (let i = 0; i < n; i++) out[i] = { time: barTime(bars, i + k, interval), value: value(i), color: col };
        return out;
      };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: shifted((i) => bars[i].close, '#800080'),
          plot3: shifted((i) => s.leadLine1[i], '#00FF00'),
          plot4: shifted((i) => s.leadLine2[i], '#008000'),
        },
        fills: [{ plot1: 'plot3', plot2: 'plot4', colors: s.fillColors.slice() }],
        plotCandles: { haCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuWHeikinAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuWHeikinAshiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuWHeikinAshi = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
};
