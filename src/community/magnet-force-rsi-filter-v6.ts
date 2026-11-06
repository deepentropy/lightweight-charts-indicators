/**
 * Magnet Force + RSI Filter
 *
 * A band around the VWMA of the close (the magnet core): core +- mult * stdev(close, length). The background is red
 * when the close is above the upper band with RSI >= overbought, green when the close is below the lower band with
 * RSI <= oversold. A SELL label when the close crosses under the upper band with RSI[1] >= overbought, a BUY label
 * when the close crosses over the lower band with RSI[1] <= oversold.
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close) on the bars of the SELL / BUY signals.
 *
 * Reference: "Magnet Force + RSI Filter V6" by mehmetbezgincan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface MagnetForceRsiFilterV6Inputs {
  /** Magnet core period (VWMA and stdev length) */
  length: number;
  /** Attraction strength (stdev multiplier) */
  mult: number;
  /** RSI period */
  rsiLength: number;
  /** RSI overbought level */
  rsiOverbought: number;
  /** RSI oversold level */
  rsiOversold: number;
}

export const defaultInputs: MagnetForceRsiFilterV6Inputs = {
  length: 20,
  mult: 2.0,
  rsiLength: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Magnet Core Period', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'Attraction Strength (Sigma)', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold Level', defval: 30 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Magnet Core', color: String(color.new(color.gray, 0)), lineWidth: 2 },
  { id: 'plot1', title: 'Upper Bound', color: String(color.new(color.red, 60)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Bound', color: String(color.new(color.green, 60)), lineWidth: 1 },
];

export const metadata = {
  title: 'Magnet Force + RSI Filter V6',
  shortTitle: 'Magnet Force + RSI Filter V6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; alertCalls: AlertCall[] };

interface MagnetRun extends BarRunState<Record<string, never>> {
  vwma: WindowVwma;
  dev: WindowStdev;
  rsi: ReturnType<typeof taStep.rsi>;
  crossUnder: ReturnType<typeof taStep.crossunder>;
  crossOver: ReturnType<typeof taStep.crossover>;
  rsiArr: number[];
  core: Point[];
  upper: Point[];
  lower: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<MagnetForceRsiFilterV6Inputs>): BarStudy<MagnetRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgRed = String(color.new(color.red, 90));
  const bgGreen = String(color.new(color.green, 90));

  return {
    init() {
      // magnet_core = ta.vwma(close, length); dev = mult * ta.stdev(close, length)
      const vwma = new WindowVwma(cfg.length);
      const dev = new WindowStdev(cfg.length);
      const rsi = taStep.rsi(cfg.rsiLength);
      const crossUnder = taStep.crossunder();
      const crossOver = taStep.crossover();
      const s: MagnetRun = {
        vwma, dev, rsi, crossUnder, crossOver, rsiArr: [], core: [], upper: [], lower: [], bgColors: [], markers: [],
        alertCalls: [], steps: [vwma, dev, rsi, crossUnder, crossOver], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, s.alertCalls];
      s.series = [s.rsiArr, s.core, s.upper, s.lower];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      const time = b.time;
      const core = s.vwma.step(c, b.volume ?? NaN);
      const sd = s.dev.step(c);
      const upper = core + cfg.mult * sd;
      const lower = core - cfg.mult * sd;
      const rsi = s.rsi.step(c);
      s.rsiArr[i] = rsi;
      // ta.crossunder(close, upper_attraction) / ta.crossover(close, lower_attraction): exact comparisons
      const crossUnder = s.crossUnder.step(c, upper);
      const crossOver = s.crossOver.step(c, lower);
      s.core[i] = { time, value: core };
      s.upper[i] = { time, value: upper };
      s.lower[i] = { time, value: lower };

      const isOverbought = gt(c, upper) && ge(rsi, cfg.rsiOverbought);
      const isOversold = lt(c, lower) && le(rsi, cfg.rsiOversold);
      const rsiPrev = i > 0 ? s.rsiArr[i - 1] : NaN;
      const sellSignal = crossUnder && ge(rsiPrev, cfg.rsiOverbought);
      const buySignal = crossOver && le(rsiPrev, cfg.rsiOversold);

      // bgcolor(is_overbought ? red 90 : na); bgcolor(is_oversold ? green 90 : na): the later call is drawn on top
      if (isOversold) s.bgColors.push({ time, color: bgGreen });
      else if (isOverbought) s.bgColors.push({ time, color: bgRed });

      if (sellSignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      if (buySignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      // if sell_signal alert("Magnet Pull Down: ...") / if buy_signal alert("Magnet Pull Up: ..."), once per bar close
      if (sellSignal) {
        s.alertCalls.push({ time, message: 'Magnet Pull Down: Price returning to core from Overbought', freq: 'once_per_bar_close' });
      }
      if (buySignal) {
        s.alertCalls.push({ time, message: 'Magnet Pull Up: Price returning to core from Oversold', freq: 'once_per_bar_close' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.core.slice(), plot1: s.upper.slice(), plot2: s.lower.slice() },
        // fill(u_plot, l_plot, color = color.new(color.purple, 92), title = "Magnetic Field")
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Magnetic Field', color: String(color.new(color.purple, 92)) } }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MagnetForceRsiFilterV6Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MagnetForceRsiFilterV6Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MagnetForceRsiFilterV6 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
