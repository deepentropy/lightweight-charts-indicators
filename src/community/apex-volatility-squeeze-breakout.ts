/**
 * Apex Volatility Squeeze & Breakout
 *
 * Bollinger bands (SMA of the close +- mult * stdev) smoothed by an EMA, with a squeeze state when the band width
 * (mult * stdev) is below the Keltner width (mult * ATR). A trend state is 1 when the close is above the smoothed
 * upper band and no squeeze, -1 when below the smoothed lower band and no squeeze, 0 in a squeeze (kept otherwise).
 * The bands, the basis circles, the cloud fill and the candles take the trend colour. The Buy / Sell conditions of
 * the source require trend == 1 (or -1) and trend == 0 on the same bar, so they never fire (ported as written).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Volatility Breakout' / 'Bearish Volatility Breakout' on
 * the Buy / Sell conditions (so, as in the original, they never trigger).
 *
 * Reference: "Apex Volatility Squeeze & Breakout [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface ApexVolatilitySqueezeBreakoutInputs {
  /** Lookback length of the SMA, stdev and ATR */
  length: number;
  /** Band multiplier (stdev) */
  bbMult: number;
  /** Squeeze multiplier (ATR) */
  kcMult: number;
  /** EMA length of the band smoothing */
  smoothLen: number;
  bullColor: string;
  bearColor: string;
  sqzColor: string;
  /** Colour the candles by the trend state */
  colorBars: boolean;
}

export const defaultInputs: ApexVolatilitySqueezeBreakoutInputs = {
  length: 20,
  bbMult: 2.0,
  kcMult: 1.5,
  smoothLen: 5,
  bullColor: '#089981',
  bearColor: '#f23645',
  sqzColor: '#ffb74d',
  colorBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Length', defval: 20, min: 2 },
  { id: 'bbMult', type: 'float', title: 'Band Multiplier (StDev)', defval: 2.0, step: 0.1 },
  { id: 'kcMult', type: 'float', title: 'Squeeze Multiplier (ATR)', defval: 1.5, step: 0.1 },
  { id: 'smoothLen', type: 'int', title: 'Band Smoothing', defval: 5, min: 1 },
  { id: 'bullColor', type: 'color', title: 'Bullish Trend', defval: '#089981' },
  { id: 'bearColor', type: 'color', title: 'Bearish Trend', defval: '#f23645' },
  { id: 'sqzColor', type: 'color', title: 'Squeeze (Consolidation)', defval: '#ffb74d' },
  { id: 'colorBars', type: 'bool', title: 'Color Candles Based on Volatility Trend', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Volatility Band', color: '#ffb74d', lineWidth: 2 },
  { id: 'plot1', title: 'Lower Volatility Band', color: '#ffb74d', lineWidth: 2 },
  { id: 'plot2', title: 'Center Basis', color: '#ffb74d', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Apex Volatility Squeeze & Breakout [Pineify]',
  shortTitle: 'Apex Volatility Squeeze & Breakout [Pineify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface ApexRun extends BarRunState<{ trend: number }> {
  /** math.sum of the close and of its squares: ta.sma and the biased ta.stdev (WindowSma / WindowStdev) */
  sum: WindowSum;
  squares: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  upper: ReturnType<typeof taStep.ema>;
  lower: ReturnType<typeof taStep.ema>;
  basis: ReturnType<typeof taStep.ema>;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ApexVolatilitySqueezeBreakoutInputs>): BarStudy<ApexRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = Math.floor(cfg.length);
  return {
    init() {
      const s: ApexRun = {
        sum: new WindowSum(cfg.length), squares: new WindowSum(cfg.length), atr: taStep.atr(cfg.length),
        upper: taStep.ema(cfg.smoothLen), lower: taStep.ema(cfg.smoothLen), basis: taStep.ema(cfg.smoothLen),
        crossUp: taStep.crossover(), crossDown: taStep.crossunder(), plot0: [], plot1: [], plot2: [], fillColors: [],
        barColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { trend: 0 }, lists: [], series: [],
      };
      s.steps = [s.sum, s.squares, s.atr, s.upper, s.lower, s.basis, s.crossUp, s.crossDown];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      const sum = s.sum.step(c);
      const sq = s.squares.step(Number.isFinite(c) ? c * c : NaN);
      const basis = sum / len;
      const variance = sq / len - basis * basis;
      const sd = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
      const atrRaw = s.atr.step(b.high, b.low, c);
      const dev = cfg.bbMult * sd;
      const atr = cfg.kcMult * atrRaw;
      const isSqueeze = lt(dev, atr);
      const smoothUpper = s.upper.step(basis + dev);
      const smoothLower = s.lower.step(basis - dev);
      const smoothBasis = s.basis.step(basis);

      // var int trend = 0
      const v = s.vars;
      if (gt(c, smoothUpper) && !isSqueeze) v.trend = 1;
      else if (lt(c, smoothLower) && !isSqueeze) v.trend = -1;
      else if (isSqueeze) v.trend = 0;
      const trend = v.trend;
      const currentColor = trend === 1 ? cfg.bullColor : trend === -1 ? cfg.bearColor : cfg.sqzColor;

      const time = b.time;
      s.plot0[i] = { time, value: smoothUpper, color: currentColor };
      s.plot1[i] = { time, value: smoothLower, color: currentColor };
      s.plot2[i] = { time, value: smoothBasis, color: String(color.new(currentColor, 50)) };

      // fill(p_upper, p_lower, color = color.new(current_color, 90), title = "Volatility Cloud")
      s.fillColors[i] = String(color.new(currentColor, 90));

      // barcolor(color_bars ? (close > open ? current_color : color.new(current_color, 40)) : na)
      if (cfg.colorBars) {
        s.barColors[i] = { time, color: gt(b.close, b.open) ? currentColor : String(color.new(currentColor, 40)) };
      }

      // long_breakout = ta.crossover(close, smooth_upper) and trend == 1 and trend == 0 (never true, as in the source)
      const crossUp = s.crossUp.step(c, smoothUpper);
      const crossDown = s.crossDown.step(c, smoothLower);
      const isTrend = (k: number) => trend === k;
      const longBreakout = !!crossUp && isTrend(1) && isTrend(0);
      const shortBreakout = !!crossDown && isTrend(-1) && isTrend(0);
      s.flags[0][i] = longBreakout;
      s.flags[1][i] = shortBreakout;
      if (longBreakout) s.times[0].push(time as number);
      if (shortBreakout) s.times[1].push(time as number);
      if (longBreakout) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: cfg.bullColor, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (shortBreakout) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: cfg.bearColor, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Volatility Cloud' }, colors: s.fillColors.slice() }],
        barColors: cfg.colorBars ? s.barColors.slice() : [],
        markers: s.markers.slice(),
        // alertcondition(long_breakout, ...) / alertcondition(short_breakout, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ApexVolatilitySqueezeBreakoutInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ApexVolatilitySqueezeBreakoutInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Volatility Breakout', message: 'Price broke out of the squeeze upwards. Buy Signal.' },
  { id: 'alert1', title: 'Bearish Volatility Breakout', message: 'Price broke out of the squeeze downwards. Sell Signal.' },
];

export const ApexVolatilitySqueezeBreakout = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
