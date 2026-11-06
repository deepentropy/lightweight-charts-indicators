/**
 * IU Smart Flow System
 *
 * Order flow score = (highest close of `length` bars - close `length` bars ago) - (close `length` bars ago - lowest
 * close of `length` bars). Trend band: SMA(close, trend length) +/- ATR(14), drawn as two lines with a fill. A Long
 * label marks the first bar (not already long) with a positive score, a close above the upper band and RSI above 50;
 * a Short label marks the first bar (not already short) with a negative score, a close below the lower band and RSI
 * below 50. A Long signal ends the short state and a Short signal ends the long state.
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "Long Entry Tiggered!" on each Long signal and
 * "Short Entry Tiggered!" on each Short signal (the original's spelling).
 *
 * Reference: "IU Smart Flow System" by Shivam_Mandrai
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Shivam_Mandrai
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { WindowExtreme, WindowSma, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original calls alert() */
export const hasAlertFunction = true;

export interface IuSmartFlowSystemInputs {
  /** Imbalance length */
  length: number;
  /** Trend length (SMA of the close) */
  trendLength: number;
  /** RSI length */
  rsiLength: number;
}

export const defaultInputs: IuSmartFlowSystemInputs = {
  length: 10,
  trendLength: 50,
  rsiLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Imbalance length', defval: 10 },
  { id: 'trendLength', type: 'int', title: 'Trend length', defval: 50 },
  { id: 'rsiLength', type: 'int', title: 'RSI Lenght = ', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Trend', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'Bear Trned', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'IU Smart Flow System',
  shortTitle: 'IU Smart Flow System',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };
type Point = { time: number; value: number; color: string };

interface IuSmartFlowRun extends BarRunState<{ inLong: boolean; inShort: boolean }> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  sma: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<IuSmartFlowSystemInputs>): BarStudy<IuSmartFlowRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fillCol = String(color.new(color.gray, 90));
  return {
    init() {
      const highest = new WindowExtreme(false, cfg.length);
      const lowest = new WindowExtreme(true, cfg.length);
      const atr = taStep.atr(14);
      const sma = new WindowSma(cfg.trendLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: IuSmartFlowRun = {
        highest, lowest, atr, sma, rsi, plot0: [], plot1: [], markers: [], alertCalls: [],
        steps: [highest, lowest, atr, sma, rsi],
        // var in_long = false; var in_short = false
        vars: { inLong: false, inShort: false },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const close = b.close;
      const highest = s.highest.step(close);
      const lowest = s.lowest.step(close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const sma = s.sma.step(close);
      const rsi = s.rsi.step(close);
      const closeLen = i - cfg.length >= 0 ? bars[i - cfg.length].close : NaN;
      // order_flow_score = (highest - close[length]) - (close[length] - lowest)
      const score = (highest - closeLen) - (closeLen - lowest);
      const bullTrend = sma + atr;
      const bearTrend = sma - atr;
      const trendUp = gt(close, bullTrend);
      const trendDown = lt(close, bearTrend);

      let longEntry = false;
      let shortEntry = false;
      if (gt(score, 0) && trendUp && gt(rsi, 50) && !v.inLong) {
        longEntry = true;
        v.inLong = true;
        v.inShort = false;
      }
      if (lt(score, 0) && trendDown && lt(rsi, 50) && !v.inShort) {
        shortEntry = true;
        v.inShort = true;
        v.inLong = false;
      }

      // plotshape(long_entry, color = color.green, text = "Long", location.belowbar, shape.labelup, textcolor = color.white)
      if (longEntry) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Long',
          textColor: color.white, size: 'auto' });
      }
      // plotshape(short_entry, color = color.red, text = "Short", location.abovebar, shape.labeldown, textcolor = color.white)
      if (shortEntry) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Short',
          textColor: color.white, size: 'auto' });
      }
      // if long_entry: alert("Long Entry Tiggered!", alert.freq_once_per_bar); the same for short_entry
      if (longEntry) s.alertCalls.push({ time: b.time, message: 'Long Entry Tiggered!', freq: 'once_per_bar' });
      if (shortEntry) s.alertCalls.push({ time: b.time, message: 'Short Entry Tiggered!', freq: 'once_per_bar' });
      s.plot0[i] = { time: b.time, value: bullTrend, color: color.gray };
      s.plot1[i] = { time: b.time, value: bearTrend, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(bull_trend_plot, bear_trend_plot, color = color.new(color.gray, 90))
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: fillCol } }],
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IuSmartFlowSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IuSmartFlowSystemInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IuSmartFlowSystem = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
