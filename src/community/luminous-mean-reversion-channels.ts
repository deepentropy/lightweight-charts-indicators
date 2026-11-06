/**
 * Luminous Mean Reversion Channels
 *
 * A volatility-stepped mean level: it starts at the source and moves by one step (ATR(length) * mult) only when the
 * source is more than one step away from it. When the mean level changes, half the step is kept as the channel
 * half width; the bands are the mean level +/- 2 * that width. Gradient fills between each band and the mean level.
 * BUY when the source crosses over the lower band, SELL when it crosses under the upper band.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Mean Reversion' (BUY) and 'Bearish Mean Reversion' (SELL).
 *
 * Reference: "Luminous Mean Reversion Channels [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LuminousMeanReversionChannelsInputs {
  /** ATR length of the step */
  length: number;
  /** ATR multiplier of the step */
  mult: number;
  /** Source of the mean level and of the signals */
  src: SourceType;
}

export const defaultInputs: LuminousMeanReversionChannelsInputs = {
  length: 200,
  mult: 6.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volatility Length', defval: 200, min: 2 },
  { id: 'mult', type: 'float', title: 'Channel Width Factor', defval: 6.0, min: 0, step: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const RED = '#f23645';
const GREEN = '#089981';
const MID = String(color.new('#787b86', 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Band', color: RED, lineWidth: 2 },
  { id: 'plot1', title: 'Mean Reversion Level', color: MID, lineWidth: 1 },
  { id: 'plot2', title: 'Oversold Band', color: GREEN, lineWidth: 2 },
];

export const metadata = {
  title: 'Luminous Mean Reversion Channels [Pineify]',
  shortTitle: 'Luminous MRC [Pineify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine a != b: false when a value is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface LuminousVars {
  /** var float avg_line = src (first bar) */
  avgLine: number;
  /** var float hold_atr = 0.0 */
  holdAtr: number;
}

interface LuminousRun extends BarRunState<LuminousVars> {
  atr: ReturnType<typeof taStep.atr>;
  src: number[];
  avg: number[];
  upper: number[];
  lower: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LuminousMeanReversionChannelsInputs>): BarStudy<LuminousRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(cfg.length);
      const s: LuminousRun = {
        atr, src: [], avg: [], upper: [], lower: [], plot0: [], plot1: [], plot2: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [atr], vars: { avgLine: NaN, holdAtr: 0.0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.src, s.avg, s.upper, s.lower, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = s.src;
      src[i] = value(b) ?? NaN;
      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      if (i === 0) v.avgLine = src[0];
      const prev = i > 0 ? s.avg[i - 1] : NaN;
      // atr_val = nz(ta.atr(length)) * mult
      const atrVal = (isNaN(atr) ? 0 : atr) * cfg.mult;
      let avgLine = v.avgLine;
      // avg_line := src - avg_line > atr_val ? avg_line + atr_val : avg_line - src > atr_val ? avg_line - atr_val : avg_line
      avgLine = gt(src[i] - avgLine, atrVal) ? avgLine + atrVal : gt(avgLine - src[i], atrVal) ? avgLine - atrVal : avgLine;
      v.avgLine = avgLine;
      // hold_atr := avg_line != avg_line[1] ? atr_val / 2 : hold_atr
      if (ne(avgLine, prev)) v.holdAtr = atrVal / 2;
      const upper = avgLine + v.holdAtr * 2;
      const lower = avgLine - v.holdAtr * 2;
      s.avg[i] = avgLine;
      s.upper[i] = upper;
      s.lower[i] = lower;
      const time = b.time;
      s.plot0[i] = { time, value: upper, color: RED };
      s.plot1[i] = { time, value: avgLine, color: MID };
      s.plot2[i] = { time, value: lower, color: GREEN };

      let buy = false;
      let sell = false;
      if (i >= 1) {
        // buy_signal = ta.crossover(src, lower_band); sell_signal = ta.crossunder(src, upper_band): exact comparisons
        buy = src[i] > lower && src[i - 1] <= s.lower[i - 1];
        sell = src[i] < upper && src[i - 1] >= s.upper[i - 1];
        if (buy) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'BUY',
            textColor: color.white, size: 'small' });
        }
        if (sell) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'SELL',
            textColor: color.white, size: 'small' });
        }
      }
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          // fill(up_plot, mid_plot, top_color = color.new(#f23645, 85), bottom_color = color.new(#f23645, 100)):
          // the gradient goes from the upper band (top) to the mean level (bottom)
          {
            plot1: 'plot0', plot2: 'plot1', options: { title: 'Bearish Reversal Aura' },
            gradient: { topValue: s.upper.slice(), bottomValue: s.avg.slice(),
              topColor: new Array(n).fill(String(color.new(RED, 85))), bottomColor: new Array(n).fill(String(color.new(RED, 100))) },
          },
          // fill(dn_plot, mid_plot, top_color = color.new(#089981, 100), bottom_color = color.new(#089981, 85)):
          // the gradient goes from the mean level (top) to the lower band (bottom)
          {
            plot1: 'plot2', plot2: 'plot1', options: { title: 'Bullish Reversal Aura' },
            gradient: { topValue: s.avg.slice(), bottomValue: s.lower.slice(),
              topColor: new Array(n).fill(String(color.new(GREEN, 100))), bottomColor: new Array(n).fill(String(color.new(GREEN, 85))) },
          },
        ],
        markers: s.markers.slice(),
        // alertcondition(buy_signal, ...) / alertcondition(sell_signal, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LuminousMeanReversionChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LuminousMeanReversionChannelsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Mean Reversion', message: 'Price crossed back above the lower mean reversion band.' },
  { id: 'alert1', title: 'Bearish Mean Reversion', message: 'Price crossed back below the upper mean reversion band.' },
];

export const LuminousMeanReversionChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
