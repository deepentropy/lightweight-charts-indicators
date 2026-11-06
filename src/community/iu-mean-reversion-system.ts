/**
 * IU Mean Reversion System
 *
 * The mean is the RMA (9) of the EMA (9) of the close. The bands are the mean +- ATR * multiplier. A long trade
 * starts when the close crosses over the lower band and ends when the high crosses over the mean; a short trade
 * starts when the close crosses under the upper band and ends when the low crosses under the mean. Labels mark the
 * entries and exits. The "Mean length" input is not used by the original script (the lengths are fixed at 9).
 *
 * Reference: "IU Mean Reversion System" by Shivam_Mandrai
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Shivam_Mandrai
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IUMeanReversionSystemInputs {
  /** Mean length (not used by the original script: the EMA and RMA lengths are fixed at 9) */
  meanLength: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier of the bands */
  multi: number;
}

export const defaultInputs: IUMeanReversionSystemInputs = {
  meanLength: 9,
  atrLength: 100,
  multi: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'meanLength', type: 'int', title: 'Mean length = ', defval: 9 },
  { id: 'atrLength', type: 'int', title: 'ATR Length = ', defval: 100 },
  { id: 'multi', type: 'float', title: 'Multiplier', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mean', color: color.lime, lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: color.gray, lineWidth: 1 },
];

const FILL_COLOR = String(color.new(color.blue, 90));

/** fill(upper_plot, lower_plot, color.new(color.blue, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', color: FILL_COLOR },
];

export const metadata = {
  title: 'IU Mean Reversion System',
  shortTitle: 'IU Mean Reversion System',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface IuVars {
  /** var in_long = false; var in_short = false */
  inLong: boolean;
  inShort: boolean;
}

interface IuRun extends BarRunState<IuVars> {
  ema: ReturnType<typeof taStep.ema>;
  rma: ReturnType<typeof taStep.rma>;
  atr: ReturnType<typeof taStep.atr>;
  mean: number[];
  upper: number[];
  lower: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<IUMeanReversionSystemInputs>): BarStudy<IuRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const white = color.white;
  return {
    init() {
      const ema = taStep.ema(9);
      const rma = taStep.rma(9);
      const atr = taStep.atr(cfg.atrLength);
      const s: IuRun = {
        ema, rma, atr, mean: [], upper: [], lower: [], plot0: [], plot1: [], plot2: [], markers: [],
        steps: [ema, rma, atr], vars: { inLong: false, inShort: false }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.mean, s.upper, s.lower, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const m = s.rma.step(s.ema.step(b.close));
      const atr = s.atr.step(b.high, b.low, b.close);
      const up = m + atr * cfg.multi;
      const lo = m - atr * cfg.multi;
      s.mean[i] = m;
      s.upper[i] = up;
      s.lower[i] = lo;
      s.plot0[i] = { time: t, value: m, color: color.lime };
      s.plot1[i] = { time: t, value: up, color: color.gray };
      s.plot2[i] = { time: t, value: lo, color: color.gray };

      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; exact comparisons
      // (na compares false; the bands and the mean are never na again after their first value)
      const p = i > 0 ? bars[i - 1] : null;
      const long = p !== null && b.close > lo && p.close <= s.lower[i - 1];
      const short = p !== null && b.close < up && p.close >= s.upper[i - 1];
      const longExit = p !== null && b.high > m && p.high <= s.mean[i - 1];
      const shortExit = p !== null && b.low < m && p.low >= s.mean[i - 1];
      // in_long[1] / in_short[1]: false on the first bar
      const prevLong = v.inLong;
      const prevShort = v.inShort;
      if (long && !v.inLong) v.inLong = true;
      if (short && !v.inShort) v.inShort = true;
      if (longExit) v.inLong = false;
      if (shortExit) v.inShort = false;

      // plotshape(long_exit and in_long[1], "Long Exit", shape.labeldown, location.abovebar, color.gray)
      if (longExit && prevLong) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.gray, text: 'Long Exit', textColor: white });
      }
      // plotshape(short_exit and in_short[1], "Short Exit", shape.labelup, location.belowbar, color.gray)
      if (shortExit && prevShort) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.gray, text: 'Short Exit', textColor: white });
      }
      // plotshape(in_long and not in_long[1], "Long Entry", shape.labelup, location.belowbar, color.green)
      if (v.inLong && !prevLong) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Long Entry', textColor: white });
      }
      // plotshape(in_short and not in_short[1], "Short Entry", shape.labeldown, location.abovebar, color.red)
      if (v.inShort && !prevShort) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Short Entry', textColor: white });
      }
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', colors: new Array<string>(bars.length).fill(FILL_COLOR) }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IUMeanReversionSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IUMeanReversionSystemInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IUMeanReversionSystem = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
