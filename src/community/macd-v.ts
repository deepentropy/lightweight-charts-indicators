/**
 * MACD-V (Volatility Normalized MACD)
 *
 * MACD line (EMA(fast) - EMA(slow) of the source) divided by ATR(atrLength) and multiplied by 100, with an EMA
 * signal line and their difference as a histogram. The histogram columns are teal / light teal above zero and
 * light red / red below zero, the stronger colour when the histogram rises (above zero) or falls (below zero).
 * Horizontal lines at 150, 50, 0, -50 and -150.
 * Alerts (alertcondition, `alerts` of the result): 'Rising to falling' (the histogram turns negative) and 'Falling to
 * rising' (it turns positive).
 *
 * Reference: "MACD-V (Volatility Normalized MACD)" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface MACDVInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  atrLength: number;
  src: SourceType;
}

export const defaultInputs: MACDVInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  atrLength: 26,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD-V', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF299B', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'MACD-V (Volatility Normalized MACD)',
  shortTitle: 'MACD-V',
  overlay: false,
};

/** Pine float comparison a > b: true only when a - b > 1e-10; na operands give false */
const gt = (a: number, b: number): boolean => a - b > 1e-10;
/** Pine float comparison a >= b: false only when b - a > 1e-10; na operands give false */
const ge = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface MacdvRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  sig: ReturnType<typeof taStep.ema>;
  hist: number[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  plot2: { time: number; value: number; color: string }[];
  flags: boolean[][];
  times: number[][];
}

const finite = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<MACDVInputs>): BarStudy<MacdvRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const atr = taStep.atr(cfg.atrLength);
      const sig = taStep.ema(cfg.signalLength);
      const s: MacdvRun = {
        fast, slow, atr, sig, hist: [], plot0: [], plot1: [], plot2: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, atr, sig], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.hist, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = value(b);
      // macdLine = ta.ema(src, fastLength) - ta.ema(src, slowLength); atrValue = ta.atr(atrLength)
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      const atrValue = s.atr.step(b.high, b.low, b.close);
      // macdV = macdLine / atrValue * 100. With an ATR of 0 it is +-Infinity (0 / 0: NaN): na for the plots and for
      // ta.ema (Pine ta.ema skips an infinite value as na), but `hist > hist[1]` compares the infinite value.
      const macdV = ((f - sl) / atrValue) * 100;
      const signal = s.sig.step(finite(macdV));
      const h = macdV - signal;
      s.hist[i] = h;
      const prev = i > 0 ? s.hist[i - 1] : NaN;

      // alertcondition(hist[1] >= 0 and hist < 0, "Rising to falling") / alertcondition(hist[1] <= 0 and hist > 0, ...)
      const flags = [i > 0 && ge(prev, 0) && gt(0, h), i > 0 && ge(0, prev) && gt(h, 0)];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }

      s.plot0[i] = { time: t, value: finite(macdV) };
      s.plot1[i] = { time: t, value: signal };
      // hColor = hist >= 0 ? hist > hist[1] ? #26a69a : #b2dfdb : hist > hist[1] ? #ffcdd2 : #ff5252
      const rising = gt(h, prev);
      const hColor = ge(h, 0) ? (rising ? '#26A69A' : '#B2DFDB') : rising ? '#FFCDD2' : '#FF5252';
      s.plot2[i] = { time: t, value: finite(h), color: hColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 150, options: { title: 'Extreme Overbought', color: color.red, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Strong Momentum Up', color: color.green, linestyle: 'dotted' } },
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
          { value: -50, options: { title: 'Strong Momentum Down', color: color.orange, linestyle: 'dotted' } },
          { value: -150, options: { title: 'Extreme Oversold', color: color.red, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Zero', color: '#787B8680', linestyle: 'dashed' } },
        ],
        markers: [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDVInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACDVInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Rising to falling', message: 'MACD Volatility histogram switched from a rising to falling state' },
  { id: 'alert1', title: 'Falling to rising', message: 'MACD Volatility histogram switched from a falling to rising state' },
];

export const MACDV = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
