/**
 * Breakout Signal Detector with Color-Coded Trends
 *
 * The highest high and the lowest low of the previous X bars (the current bar excluded). A close above the highest
 * high is a bullish signal and a close below the lowest low a bearish signal; a repeated signal of the same side
 * also needs the close to be beyond the close of the last opposite breakout (ta.valuewhen, only evaluated on the bars
 * where Pine's lazy `and` / `or` reach it). The candles are green after a bullish signal and red after a bearish
 * signal.
 *
 * Reference: "Breakout an Reversal Signal Detector with Colored in Bar Trends" by AmGlad_Trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AmGlad_Trader
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData, MarkerData } from '../types';

export interface BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs {
  /** Number of previous bars (X) */
  x: number;
}

export const defaultInputs: BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs = {
  x: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'x', type: 'int', title: 'Número de velas anteriores (X)', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MAX of Last X Period', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'MIN of Last X Period', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Breakout Signal Detector with Color-Coded Trends',
  shortTitle: 'Breakout Signal Detector with Color-Coded Trends',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface BreakoutVars {
  /** var bool prev_bullish_signal = false */
  prevBullishSignal: boolean;
  /** var bool prev_bearish_signal = false */
  prevBearishSignal: boolean;
  /** var bool in_bullish_phase = false */
  inBullishPhase: boolean;
  /** var bool in_bearish_phase = false */
  inBearishPhase: boolean;
  vwBelowLow: number;
  vwAboveHigh: number;
}

interface BreakoutRun extends BarRunState<BreakoutVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs>): BarStudy<BreakoutRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: BreakoutRun = {
        hi: new WindowExtreme(false, cfg.x), lo: new WindowExtreme(true, cfg.x),
        plot0: [], plot1: [], markers: [], barColors: [], steps: [],
        vars: {
          prevBullishSignal: false, prevBearishSignal: false, inBullishPhase: false, inBearishPhase: false,
          // ta.valuewhen(close_below_low, close, 0) / ta.valuewhen(close_above_high, close, 0): each call keeps the
          // history of the bars where it runs (the right side of the lazy `and` / `or`)
          vwBelowLow: NaN, vwAboveHigh: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.hi, s.lo];
      s.lists = [s.markers, s.barColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      // highest_high = ta.highest(high[1], x), lowest_low = ta.lowest(low[1], x)
      const highest = s.hi.step(i > 0 ? bars[i - 1].high : NaN);
      const lowest = s.lo.step(i > 0 ? bars[i - 1].low : NaN);
      const closeBelowLow = lt(b.close, lowest);
      const closeAboveHigh = gt(b.close, highest);

      // bullish_condition = close_above_high and (not prev_bullish_signal or ta.valuewhen(close_below_low, close, 0) < close)
      let bullish = false;
      if (closeAboveHigh) {
        if (!v.prevBullishSignal) bullish = true;
        else {
          if (closeBelowLow) v.vwBelowLow = b.close;
          bullish = lt(v.vwBelowLow, b.close);
        }
      }
      // bearish_condition = close_below_low and (not prev_bearish_signal or ta.valuewhen(close_above_high, close, 0) > close)
      let bearish = false;
      if (closeBelowLow) {
        if (!v.prevBearishSignal) bearish = true;
        else {
          if (closeAboveHigh) v.vwAboveHigh = b.close;
          bearish = gt(v.vwAboveHigh, b.close);
        }
      }

      s.plot0[i] = { time: t, value: highest };
      s.plot1[i] = { time: t, value: lowest };
      // plotshape(bearish_condition, shape.triangledown, location.abovebar, color.red, size.tiny)
      if (bearish) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      // plotshape(bullish_condition, shape.triangleup, location.belowbar, color.green, size.tiny)
      if (bullish) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });

      if (bullish) {
        v.inBullishPhase = true;
        v.inBearishPhase = false;
        v.prevBullishSignal = true;
        v.prevBearishSignal = false;
      }
      if (bearish) {
        v.inBearishPhase = true;
        v.inBullishPhase = false;
        v.prevBearishSignal = true;
        v.prevBullishSignal = false;
      }

      // barcolor(in_bullish_phase ? color.green : na), then barcolor(in_bearish_phase ? color.red : na) on top
      if (v.inBearishPhase) s.barColors.push({ time: t, color: color.red });
      else if (v.inBullishPhase) s.barColors.push({ time: t, color: color.green });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BreakoutAnReversalSignalDetectorWithColoredInBarTrends = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
