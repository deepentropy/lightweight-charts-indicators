/**
 * Lumina Trend Channels
 *
 * The baseline is the EMA of the close; four bands sit at baseline +- ATR * outer / inner multiplier (EMA and ATR
 * with the same length). The trend is up when the baseline rose over the last 2 bars, down when it fell, else
 * unchanged. Bands, baseline and the layered fills take the trend colour; a circle marks the baseline on a trend
 * change. Buy: the close crosses above the baseline in an uptrend; sell: the close crosses below it in a downtrend.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal', 'Sell Signal' and 'Trend Change' (the trend flips).
 *
 * Reference: "Lumina Trend Channels [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LuminaTrendChannelsInputs {
  /** Length of the EMA baseline and of the ATR */
  length: number;
  /** Outer band multiplier (ATR) */
  multOuter: number;
  /** Inner band multiplier (ATR) */
  multInner: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: LuminaTrendChannelsInputs = {
  length: 21,
  multOuter: 2.0,
  multInner: 1.0,
  bullColor: '#00E676',
  bearColor: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Channel Length', defval: 21, min: 5, group: 'Calculation' },
  { id: 'multOuter', type: 'float', title: 'Outer Band Multiplier', defval: 2.0, step: 0.1, group: 'Calculation' },
  { id: 'multInner', type: 'float', title: 'Inner Band Multiplier', defval: 1.0, step: 0.1, group: 'Calculation' },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#00E676', group: 'Style' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#FF5252', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Outer', color: String(color.new('#00E676', 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Upper Inner', color: String(color.new('#00E676', 70)), lineWidth: 1 },
  { id: 'plot2', title: 'Baseline', color: '#00E676', lineWidth: 2 },
  { id: 'plot3', title: 'Lower Inner', color: String(color.new('#00E676', 70)), lineWidth: 1 },
  { id: 'plot4', title: 'Lower Outer', color: String(color.new('#00E676', 50)), lineWidth: 1 },
  { id: 'plot5', title: 'Trend Change', color: '#00E676', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Lumina Trend Channels [Pineify]',
  shortTitle: 'Lumina Channels [Pineify]',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface LuminaVars {
  /** var int trend = 1 */
  trend: number;
  /** ta.rising(basis, 2) / ta.falling(basis, 2): the counts of rises / falls (a step from or to na keeps them) */
  rises: number;
  falls: number;
  /** ta.crossover / crossunder: the last bar where both values were not na */
  lastClose: number;
  lastBasis: number;
}

interface LuminaRun extends BarRunState<LuminaVars> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  basis: number[];
  plots: Point[][];
  fillCols: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** The 1e-10 tolerance of ta.rising / ta.falling */
const EPS = 1e-10;

function study(inputs: Partial<LuminaTrendChannelsInputs>): BarStudy<LuminaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: LuminaRun = {
        ema: taStep.ema(cfg.length), atr: taStep.atr(cfg.length), basis: [],
        plots: Array.from({ length: 6 }, () => []), fillCols: [[], [], [], []], markers: [],
        flags: [[], [], []], times: [[], [], []], steps: [],
        vars: { trend: 1, rises: 0, falls: 0, lastClose: NaN, lastBasis: NaN }, lists: [], series: [],
      };
      s.steps = [s.ema, s.atr];
      s.lists = [s.markers, ...s.times];
      s.series = [s.basis, ...s.plots, ...s.fillCols, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const bs = s.ema.step(b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      s.basis[i] = bs;
      const prevBasis = i > 0 ? s.basis[i - 1] : NaN;
      if (Number.isFinite(bs) && Number.isFinite(prevBasis)) {
        v.rises = !Number.isNaN(bs) && !Number.isNaN(prevBasis) && bs - prevBasis > EPS ? v.rises + 1 : 0;
        v.falls = !Number.isNaN(bs) && !Number.isNaN(prevBasis) && prevBasis - bs > EPS ? v.falls + 1 : 0;
      }
      const rising = v.rises >= 2;
      const falling = v.falls >= 2;

      const prevTrend = v.trend;
      v.trend = rising ? 1 : falling ? -1 : v.trend;
      const trend = v.trend;
      const css = trend === 1 ? cfg.bullColor : cfg.bearColor;
      const c50 = String(color.new(css, 50));
      const c70 = String(color.new(css, 70));
      const c85 = String(color.new(css, 85));
      const t = b.time;
      s.plots[0][i] = { time: t, value: bs + atr * cfg.multOuter, color: c50 };
      s.plots[1][i] = { time: t, value: bs + atr * cfg.multInner, color: c70 };
      s.plots[2][i] = { time: t, value: bs, color: css };
      s.plots[3][i] = { time: t, value: bs - atr * cfg.multInner, color: c70 };
      s.plots[4][i] = { time: t, value: bs - atr * cfg.multOuter, color: c50 };
      s.fillCols[0][i] = c85;
      s.fillCols[1][i] = c70;
      s.fillCols[2][i] = c70;
      s.fillCols[3][i] = c85;
      // plot(ta.change(trend) != 0 ? basis : na): ta.change is na on the first bar
      const changed = i > 0 && trend !== prevTrend;
      s.plots[5][i] = { time: t, value: changed ? bs : NaN, color: css };

      let crossUp = false;
      let crossDown = false;
      if (!isNaN(b.close) && !isNaN(bs)) {
        if (!isNaN(v.lastClose)) {
          // exact comparisons (no 1e-10 tolerance): close > basis and close[1] <= basis[1]
          crossUp = b.close > bs && v.lastClose <= v.lastBasis;
          crossDown = b.close < bs && v.lastClose >= v.lastBasis;
        }
        v.lastClose = b.close;
        v.lastBasis = bs;
      }
      const buy = crossUp && trend === 1;
      const sell = crossDown && trend === -1;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      s.flags[2][i] = changed;
      if (buy) s.times[0].push(t as number);
      if (sell) s.times[1].push(t as number);
      if (changed) s.times[2].push(t as number);
      // plotshape(buySignal, "Buy Signal", shape.triangleup, location.belowbar, color = bullCss, size = size.small)
      if (buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.bullColor, size: 'small' });
      }
      // plotshape(sellSignal, "Sell Signal", shape.triangledown, location.abovebar, color = bearCss, size = size.small)
      if (sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.bearColor, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Outer Upper Fill' }, colors: s.fillCols[0].slice() },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Inner Upper Fill' }, colors: s.fillCols[1].slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Inner Lower Fill' }, colors: s.fillCols[2].slice() },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Outer Lower Fill' }, colors: s.fillCols[3].slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(buySignal, ...) / alertcondition(sellSignal, ...) / alertcondition(ta.change(trend) != 0, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LuminaTrendChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LuminaTrendChannelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Lumina Channels: Bullish Entry Detected' },
  { id: 'alert1', title: 'Sell Signal', message: 'Lumina Channels: Bearish Entry Detected' },
  { id: 'alert2', title: 'Trend Change', message: 'Lumina Channels: Channel Trend Changed Color' },
];

export const LuminaTrendChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
