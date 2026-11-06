/**
 * ATR Trailing Stop with ATR Targets
 *
 * An ATR trailing stop with a trend state. In an up trend the stop is the highest high since the flip minus
 * ATR * mult; a close below it flips the trend down (stop = close + ATR * mult). In a down trend the stop is the
 * lowest low since the flip plus ATR * mult; a close above it flips the trend up (stop = close - ATR * mult). At each
 * flip three targets are frozen at the flip close +- 1, 2 and 3 ATR (ATR of the flip bar). Buy / Sell labels on the
 * flips and a light gray background on every bar.
 * Alerts (alertcondition, `alerts` of the result): 'ATR Flip Buy' / 'ATR Flip Sell' on the flips up / down (whether
 * the labels are shown or not).
 *
 * Reference: "ATR Trailing Stop with ATR Targets [v6]" by TRDRZone
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AtrTrailingStopWithAtrTargetsInputs {
  /** ATR period */
  atrLength: number;
  /** ATR multiplier of the trailing stop */
  atrMult: number;
  /** Trend state on the first bar */
  initialTrend: 'Bullish' | 'Bearish';
  /** Show the Buy / Sell labels */
  showSignals: boolean;
}

export const defaultInputs: AtrTrailingStopWithAtrTargetsInputs = {
  atrLength: 14,
  atrMult: 2.0,
  initialTrend: 'Bullish',
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Period', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 2.0 },
  { id: 'initialTrend', type: 'string', title: 'Starting Trend', defval: 'Bullish', options: ['Bullish', 'Bearish'] },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Trailing Stop', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Target 1 ATR', color: color.orange, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Target 2 ATR', color: color.yellow, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Target 3 ATR', color: color.purple, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'ATR Trailing Stop with ATR Targets [v6]',
  shortTitle: 'ATR Trailing Stop with ATR Targets [v6]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

/** The var state */
interface AtrTsVars {
  trailStop: number;
  highestHi: number;
  lowestLo: number;
  trend: number;
  flipPrice: number;
  flipBar: number;
  flipAtr: number;
  target1: number;
  target2: number;
  target3: number;
}

interface AtrTsRun extends BarRunState<AtrTsVars> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AtrTrailingStopWithAtrTargetsInputs>): BarStudy<AtrTsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { atrMult } = cfg;
  const bg = String(color.new(color.gray, 95));
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const s: AtrTsRun = {
        atr, plot0: [], plot1: [], plot2: [], plot3: [], markers: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [atr],
        vars: {
          trailStop: NaN, highestHi: NaN, lowestLo: NaN, trend: cfg.initialTrend === 'Bullish' ? 1 : -1,
          flipPrice: NaN, flipBar: NaN, flipAtr: NaN, target1: NaN, target2: NaN, target3: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.bgColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { high, low, close, time } = bars[i]!;
      const v = s.vars;
      const atr = s.atr.step(high, low, close) ?? NaN;
      if (i === 0) {
        v.highestHi = high;
        v.lowestLo = low;
      }
      let buySignal = false;
      let sellSignal = false;
      if (v.trend === 1) {
        v.highestHi = isNaN(v.highestHi) ? high : Math.max(v.highestHi, high);
        v.trailStop = v.highestHi - atr * atrMult;
        if (lt(close, v.trailStop)) {
          v.trend = -1;
          v.highestHi = NaN;
          v.lowestLo = low;
          v.trailStop = close + atr * atrMult;
          v.flipPrice = close;
          v.flipBar = i;
          v.flipAtr = atr;
          v.target1 = v.flipPrice - v.flipAtr * 1;
          v.target2 = v.flipPrice - v.flipAtr * 2;
          v.target3 = v.flipPrice - v.flipAtr * 3;
          sellSignal = true;
        }
      } else {
        v.lowestLo = isNaN(v.lowestLo) ? low : Math.min(v.lowestLo, low);
        v.trailStop = v.lowestLo + atr * atrMult;
        if (gt(close, v.trailStop)) {
          v.trend = 1;
          v.lowestLo = NaN;
          v.highestHi = high;
          v.trailStop = close - atr * atrMult;
          v.flipPrice = close;
          v.flipBar = i;
          v.flipAtr = atr;
          v.target1 = v.flipPrice + v.flipAtr * 1;
          v.target2 = v.flipPrice + v.flipAtr * 2;
          v.target3 = v.flipPrice + v.flipAtr * 3;
          buySignal = true;
        }
      }

      s.plot0[i] = { time, value: v.trailStop, color: v.trend === 1 ? color.green : color.red };
      // showTargets = not na(flipBar) and bar_index >= flipBar
      const showTargets = !isNaN(v.flipBar) && i >= v.flipBar;
      s.plot1[i] = { time, value: showTargets ? v.target1 : NaN, color: color.orange };
      s.plot2[i] = { time, value: showTargets ? v.target2 : NaN, color: color.yellow };
      s.plot3[i] = { time, value: showTargets ? v.target3 : NaN, color: color.purple };

      if (cfg.showSignals && buySignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (cfg.showSignals && sellSignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      // bgcolor(color.new(color.gray, 95))
      s.bgColors[i] = { time, color: bg };
      const flags = [buySignal, sellSignal];
      for (let k = 0; k < 2; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(buySignal, ...) / alertcondition(sellSignal, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrTrailingStopWithAtrTargetsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrTrailingStopWithAtrTargetsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ATR Flip Buy', message: 'ATR trailing stop flipped bullish — BUY' },
  { id: 'alert1', title: 'ATR Flip Sell', message: 'ATR trailing stop flipped bearish — SELL' },
];

export const AtrTrailingStopWithAtrTargets = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
