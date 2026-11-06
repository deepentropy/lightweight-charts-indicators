/**
 * Purple Cloud 2.0
 *
 * xh / xl = close +- ATR(Period) * Alpha. a3 = 2 * a1 - a2 with a1 / a2 the volume-weighted MAs of hl2 * volume
 * divided by those of the volume (lengths ceil(Period / 4) and ceil(Period / 2)); a4 = VWMA(a3, Period). b1 is a
 * running mean of the close ((b1[1] * (Period - 1) + close) / Period, seeded by SMA(close, Period)). Buy when
 * a4 <= xl and close > b1, sell when a4 >= xh and close < b1; the state (1 / -1) colours the bars green / red and
 * BUY / SELL labels mark its changes. ATR bands: close +- ATR(ATR Period) * multiplier.
 * Alerts (alertcondition, `alerts` of the result): 'PC Long' / 'PC Short' on the bars of the BUY / SELL labels.
 *
 * Reference: "Purple Cloud 2.0 [ATP]" by luvuoov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: algotradepro
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PurpleCloud20AtpInputs {
  /** Supertrend ATR length (the script computes ta.supertrend but no output uses it) */
  atrPeriod: number;
  /** Supertrend factor (the script computes ta.supertrend but no output uses it) */
  factor: number;
  /** Period of the ATR, the VWMAs and the running mean */
  x1: number;
  /** ATR multiplier of xh / xl */
  alpha: number;
  /** ATR length of the bands */
  atrBandPeriod: number;
  atrMultiplierUpper: number;
  atrMultiplierLower: number;
}

export const defaultInputs: PurpleCloud20AtpInputs = {
  atrPeriod: 10,
  factor: 3.0,
  x1: 40,
  alpha: 0.9,
  atrBandPeriod: 14,
  atrMultiplierUpper: 1.5,
  atrMultiplierLower: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'Supertrend ATR Length', defval: 10 },
  { id: 'factor', type: 'float', title: 'Supertrend Factor', defval: 3.0, step: 0.01 },
  { id: 'x1', type: 'int', title: 'Period', defval: 40 },
  { id: 'alpha', type: 'float', title: 'Alpha', defval: 0.9, step: 0.1 },
  { id: 'atrBandPeriod', type: 'int', title: 'ATR Period', defval: 14, min: 1 },
  { id: 'atrMultiplierUpper', type: 'float', title: 'ATR Multiplier Upper', defval: 1.5 },
  { id: 'atrMultiplierLower', type: 'float', title: 'ATR Multiplier Lower', defval: 1.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper ATR Band', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Lower ATR Band', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Purple Cloud 2.0 [ATP]',
  shortTitle: 'Purple Cloud 2.0 [ATP]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
/** `ta.vwma(x, len, volume)` from the window sums of x * volume and of the volume (the doubles of taStep.vwma) */
const vwma = (num: number, den: number, len: number): number => {
  const d = den / len;
  return d === 0 || Number.isNaN(d) ? NaN : num / len / d;
};

interface PurpleVars {
  /** b1[1] */
  b1Prev: number;
  /** xs[1] (na before bar 0) */
  xsPrev: number;
}

interface PurpleRun extends BarRunState<PurpleVars> {
  atrX: ReturnType<typeof taStep.atr>;
  atrBand: ReturnType<typeof taStep.atr>;
  /** window sums of the VWMAs: hl2 * volume * volume, volume * volume, volume (lengths x1 / 4, x1 / 2), a3 * volume
   *  and volume (length x1) */
  sums: WindowSum[];
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PurpleCloud20AtpInputs>): BarStudy<PurpleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const x1 = cfg.x1;
  // x1 / 4 is a float division in Pine v6; math.ceil gives the length
  const lenA = Math.ceil(x1 / 4);
  const lenB = Math.ceil(x1 / 2);
  return {
    init() {
      const s: PurpleRun = {
        atrX: taStep.atr(x1), atrBand: taStep.atr(cfg.atrBandPeriod),
        sums: [lenA, lenA, lenA, lenB, lenB, lenB, x1, x1].map((len) => new WindowSum(len)), sma: new WindowSma(x1),
        plot0: [], plot1: [], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { b1Prev: NaN, xsPrev: NaN }, lists: [], series: [],
      };
      s.steps = [s.atrX, s.atrBand, ...s.sums, s.sma];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const t = bar.time as number;
      const c = bar.close;
      const vol = bar.volume ?? NaN;
      const hl2v = ((bar.high + bar.low) / 2) * vol;
      const x2 = s.atrX.step(bar.high, bar.low, c) * cfg.alpha;
      // a3 = 2 * (ta.vwma(hl2v, x1 / 4) / ta.vwma(volume, x1 / 4)) - ta.vwma(hl2v, x1 / 2) / ta.vwma(volume, x1 / 2)
      const w = s.sums;
      const volA = w[2].step(vol);
      const volB = w[5].step(vol);
      const vA = vwma(w[0].step(hl2v * vol), volA, lenA);
      const vVolA = vwma(w[1].step(vol * vol), volA, lenA);
      const vB = vwma(w[3].step(hl2v * vol), volB, lenB);
      const vVolB = vwma(w[4].step(vol * vol), volB, lenB);
      const a3 = 2 * (vA / vVolA) - vB / vVolB;
      const a4 = vwma(w[6].step(a3 * vol), w[7].step(vol), x1);
      // b1 := na(b1[1]) ? ta.sma(close, x1) : ...: the ta.sma call runs on the bars where b1[1] is na. With a close on
      // every bar these are the consecutive bars from bar 0 until the SMA has x1 values, so its history is the full one.
      const smaClose = s.sma.step(c);
      const atrBand = s.atrBand.step(bar.high, bar.low, c);

      const xh = c + x2;
      const xl = c - x2;
      const b1 = isNaN(v.b1Prev) ? smaClose : (v.b1Prev * (x1 - 1) + c) / x1;
      const buy = le(a4, xl) && gt(c, b1);
      const sell = ge(a4, xh) && lt(c, b1);
      // xs = 0; xs := buy ? 1 : sell ? -1 : xs[1]: xs[1] is na on bar 0, so xs stays na until the first signal
      const xs = buy ? 1 : sell ? -1 : v.xsPrev;
      // xs != xs[1]: false when xs[1] is na
      const changed = !isNaN(xs) && !isNaN(v.xsPrev) && xs !== v.xsPrev;

      // alertcondition(buy and xs != xs[1], 'PC Long') / alertcondition(sell and xs != xs[1], 'PC Short')
      const long = buy && changed;
      const short = sell && changed;
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(t);
      if (short) s.times[1].push(t);
      if (xs === 1) s.barColors.push({ time: t, color: color.green });
      else if (xs === -1) s.barColors.push({ time: t, color: color.red });
      if (long) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'tiny' });
      }
      if (short) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'tiny' });
      }
      // plot(srcUpper + atr * atrMultiplierUpper, color = color.green) / plot(srcLower - atr * atrMultiplierLower, ...)
      s.plot0[i] = { time: t, value: c + atrBand * cfg.atrMultiplierUpper };
      s.plot1[i] = { time: t, value: c - atrBand * cfg.atrMultiplierLower };

      v.b1Prev = b1;
      v.xsPrev = xs;
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PurpleCloud20AtpInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PurpleCloud20AtpInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'PC Long', message: 'PC Long' },
  { id: 'alert1', title: 'PC Short', message: 'PC Short' },
];

export const PurpleCloud20Atp = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
