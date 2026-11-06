/**
 * Heikin Ashi Colored Regular OHLC Candles
 *
 * Draws the regular OHLC candles coloured by the Heikin Ashi direction. HA close = (open + high + low + close) / 4,
 * HA open = (previous HA open + previous HA close) / 2 (first bar: (open + close) / 2). Lime when HA close > HA open,
 * red when HA close < HA open, gray when they are equal. Body, wick and border use the same colour.
 *
 * Reference: "Heikin Ashi Colored Regular OHLC Candles" by LuxmiAI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxmiAI
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type HeikinAshiColoredRegularOhlcCandlesInputs = Record<string, never>;

export const defaultInputs: HeikinAshiColoredRegularOhlcCandlesInputs = {};

export const inputConfig: InputConfig[] = [];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'HA Colored Candles' },
];

export const metadata = {
  title: 'Heikin Ashi Colored Regular OHLC Candles',
  shortTitle: 'Heikin Ashi Colored Regular OHLC Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface HaVars {
  /** haOpen[1], haClose[1] */
  prevHaOpen: number;
  prevHaClose: number;
}

interface HaRun extends BarRunState<HaVars> {
  candles: PlotCandleData[];
}

function study(): BarStudy<HaRun, Result> {
  return {
    init() {
      const s: HaRun = { candles: [], steps: [], vars: { prevHaOpen: NaN, prevHaClose: NaN }, lists: [], series: [] };
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      // var float haOpen = na; haOpen := na(haOpen[1]) ? (open + close) / 2 : (haOpen[1] + haClose[1]) / 2
      const haOpen = isNaN(v.prevHaOpen) ? (b.open + b.close) / 2 : (v.prevHaOpen + v.prevHaClose) / 2;
      const isBull = gt(haClose, haOpen);
      const isBear = lt(haClose, haOpen);
      const candleColor = isBull ? color.lime : isBear ? color.red : color.gray;
      // plotcandle(open, high, low, close, color = candleColor, wickcolor = candleColor, bordercolor = candleColor)
      s.candles[i] = {
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        color: candleColor,
        wickColor: candleColor,
        borderColor: candleColor,
      };
      v.prevHaOpen = haOpen;
      v.prevHaClose = haClose;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  _inputs: Partial<HeikinAshiColoredRegularOhlcCandlesInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<HeikinAshiColoredRegularOhlcCandlesInputs> = {},
): Result {
  return fullResult(createRun().update(bars));
}

export const HeikinAshiColoredRegularOhlcCandles = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
