/**
 * RSI Swing Signal
 *
 * RSI(rsiSrc, rsiLen), red above the overbought level, lime below the oversold level, else blue, with levels at the
 * overbought / oversold inputs and a dashed midpoint at 50. Exhaustion setups are painted in the background:
 * - "123 Fractal": a bullish (bearish) engulfing-like bar after a down (up) bar whose low (high) was a lower low
 *   (higher high) and the lowest low (highest high) of the lookback, with RSI oversold (overbought) now or on the bar
 *   before: lime (buy) / red (sell);
 * - "Swing Fractal": the same reversal bar making itself a new low (high) of the lookback: lime / red.
 * An alert condition fires on any of the four signals.
 *
 * Reference: "RSI Swing Signal" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenAndTheArtOfTrading | PineScriptMastery
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSISwingSignalInputs {
  lookback: number;
  rsiOB: number;
  rsiOS: number;
  rsiLen: number;
  src: SourceType;
}

export const defaultInputs: RSISwingSignalInputs = {
  lookback: 7,
  rsiOB: 80,
  rsiOS: 20,
  rsiLen: 7,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback:', defval: 7 },
  { id: 'rsiOB', type: 'int', title: 'RSI Overbought Level:', defval: 80 },
  { id: 'rsiOS', type: 'int', title: 'RSI Oversold Level:', defval: 20 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length:', defval: 7 },
  { id: 'src', type: 'source', title: 'RSI Source:', defval: 'close' },
];

const RSI_COLOR = '#4985e7';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 2 },
];

/** hline(rsiOB / rsiOS / 50) with the default inputs (the result `hlines` carry the input levels) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 80, title: 'RSI Overbought', color: color.red, linestyle: 'solid' },
  { id: 'hline_os', price: 20, title: 'RSI Oversold', color: color.green, linestyle: 'solid' },
  { id: 'hline_mid', price: 50, title: 'Midpoint', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: 'RSI Swing Signal',
  shortTitle: 'RSI+',
  overlay: false,
};

/** The original's alertcondition() */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSI SIGNAL', message: 'RSI Exhaustion signal for {{ticker}}' },
];

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[]; alerts: AlertConditionState[] };

interface RssRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  swingHigh: WindowExtreme;
  swingLow: WindowExtreme;
  rsisell: boolean[];
  rsibuy: boolean[];
  plot0: { time: number; value: number; color: string }[];
  bgColors: BgColorData[];
  signal: boolean[];
  times: number[];
}

function study(inputs: Partial<RSISwingSignalInputs>): BarStudy<RssRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const num = (v: number | null | undefined) => (v == null ? NaN : v);
  const lime = String(color.lime);
  const red = String(color.red);
  /** The bars of the bar being calculated */
  let all: Bar[] = [];
  const O = (k: number) => (k >= 0 ? all[k].open : NaN);
  const H = (k: number) => (k >= 0 ? all[k].high : NaN);
  const L = (k: number) => (k >= 0 ? all[k].low : NaN);
  const C = (k: number) => (k >= 0 ? all[k].close : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // rsi = ta.rsi(rsiSrc, rsiLen)
      const rsi = taStep.rsi(cfg.rsiLen);
      // swingHigh = ta.highest(high, lookback); swingLow = ta.lowest(low, lookback)
      const swingHigh = new WindowExtreme(false, cfg.lookback);
      const swingLow = new WindowExtreme(true, cfg.lookback);
      const s: RssRun = {
        rsi, swingHigh, swingLow, rsisell: [], rsibuy: [], plot0: [], bgColors: [], signal: [], times: [],
        steps: [rsi, swingHigh, swingLow], vars: {}, lists: [], series: [],
      };
      s.series = [s.rsisell, s.rsibuy, s.plot0, s.signal];
      s.lists = [s.bgColors, s.times];
      return s;
    },
    bar(s, i, bars) {
      all = bars;
      const b = bars[i];
      const rsi = num(s.rsi.step(value(b)));
      const swingHigh = num(s.swingHigh.step(b.high));
      const swingLow = num(s.swingLow.step(b.low));
      // rsisell = rsi > rsiOB; rsibuy = rsi < rsiOS
      const rsisell = gt(rsi, cfg.rsiOB);
      const rsibuy = lt(rsi, cfg.rsiOS);
      s.rsisell[i] = rsisell;
      s.rsibuy[i] = rsibuy;

      const t = b.time as number;
      const buyRsi = rsibuy || (i > 0 && s.rsibuy[i - 1]);
      const sellRsi = rsisell || (i > 0 && s.rsisell[i - 1]);
      const buysignal1 = buyRsi && lt(C(i - 1), O(i - 1)) && gt(C(i), O(i - 1)) && gt(L(i), L(i - 1)) && lt(L(i - 1), L(i - 2))
        && eq(L(i - 1), swingLow) && le(O(i), C(i - 1));
      const buysignal2 = buyRsi && lt(C(i - 1), O(i - 1)) && gt(C(i), O(i - 1)) && lt(L(i), L(i - 1))
        && eq(L(i), swingLow) && le(O(i), C(i - 1));
      const sellsignal2 = sellRsi && gt(C(i - 1), O(i - 1)) && lt(C(i), O(i - 1)) && gt(H(i), H(i - 1))
        && eq(H(i), swingHigh) && ge(O(i), C(i - 1));
      const sellsignal1 = sellRsi && gt(C(i - 1), O(i - 1)) && lt(C(i), O(i - 1)) && lt(H(i), H(i - 1)) && gt(H(i - 1), H(i - 2))
        && eq(H(i - 1), swingHigh) && ge(O(i), C(i - 1));

      // bgcolor(buysignal1 ? color.lime : sellsignal1 ? color.red : na, title="123 Fractal")
      if (buysignal1) s.bgColors.push({ id: 'bgcolor0', time: t, color: lime });
      else if (sellsignal1) s.bgColors.push({ id: 'bgcolor0', time: t, color: red });
      // bgcolor(buysignal2 ? color.lime : sellsignal2 ? color.red : na, title="Swing Fractal")
      if (buysignal2) s.bgColors.push({ id: 'bgcolor1', time: t, color: lime });
      else if (sellsignal2) s.bgColors.push({ id: 'bgcolor1', time: t, color: red });

      // plot(rsi, "RSI", rsisell ? color.red : rsibuy ? color.lime : #4985e7, linewidth=2)
      s.plot0[i] = { time: t, value: rsi, color: rsisell ? red : rsibuy ? lime : RSI_COLOR };

      // alertcondition(sellsignal1 or sellsignal2 or buysignal1 or buysignal2, ...)
      const sig = sellsignal1 || sellsignal2 || buysignal1 || buysignal2;
      s.signal[i] = sig;
      if (sig) s.times.push(t);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { id: 'hline_ob', value: cfg.rsiOB, options: { title: 'RSI Overbought', color: color.red, linestyle: 'solid' } },
          { id: 'hline_os', value: cfg.rsiOS, options: { title: 'RSI Oversold', color: color.green, linestyle: 'solid' } },
          { id: 'hline_mid', value: 50, options: { title: 'Midpoint', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.signal[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSISwingSignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSISwingSignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSISwingSignal = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, alertConditions };
