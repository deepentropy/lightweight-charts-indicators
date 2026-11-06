/**
 * Moneyball EMA-MACD indicator
 *
 * MACD = fast MA - slow MA of the source (SMA, EMA, DEMA or TEMA; default EMA 9 / 50), signal = MA of the MACD
 * (SMA, EMA, DEMA or TEMA; default SMA 16). The price bars are coloured: fuchsia when EMA 3 > EMA 9 while the close
 * is below EMA 20 and EMA 50 and the MACD is below 0; orange when MACD < 0 and MACD > signal; green when MACD > 0 and
 * MACD > signal; red when MACD < 0 and MACD < signal (optional); white when MACD < signal. Zero line at 0.
 *
 * Alerts (alertcondition, `alerts` of the result): MACD / signal crossing the zero line, MACD new high above zero /
 * new low below zero, and one per bar colour condition (orange, green, white, red, fuchsia), as the original.
 *
 * Reference: "Moneyball EMA-MACD indicator [VinnieTheFish]" by VinnieTheFish
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'DEMA' | 'TEMA';

export interface MoneyballEmaMacdInputs {
  fastLength: number;
  slowLength: number;
  src: SourceType;
  /** Signal smoothing length */
  signalLength: number;
  /** MA type of the fast and slow lines */
  smaSource: MaType;
  /** MA type of the signal line */
  smaSignal: MaType;
  barGreenColor: string;
  barOrangeColor: string;
  barWhiteColor: string;
  barFuchsiaColor: string;
  barRedColor: string;
  /** Show red bars (MACD < signal when MACD < 0) */
  showRedColor: boolean;
}

export const defaultInputs: MoneyballEmaMacdInputs = {
  fastLength: 9,
  slowLength: 50,
  src: 'close',
  signalLength: 16,
  smaSource: 'EMA',
  smaSignal: 'SMA',
  barGreenColor: color.green,
  barOrangeColor: color.orange,
  barWhiteColor: color.white,
  barFuchsiaColor: color.fuchsia,
  barRedColor: color.red,
  showRedColor: true,
};

const MA_TYPES = ['SMA', 'EMA', 'DEMA', 'TEMA'];

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 9 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 16, min: 1, max: 50 },
  { id: 'smaSource', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: MA_TYPES },
  { id: 'smaSignal', type: 'string', title: 'Signal Line MA Type', defval: 'SMA', options: MA_TYPES },
  { id: 'barGreenColor', type: 'color', title: 'Green', defval: color.green },
  { id: 'barOrangeColor', type: 'color', title: 'Orange', defval: color.orange },
  { id: 'barWhiteColor', type: 'color', title: 'White', defval: color.white },
  { id: 'barFuchsiaColor', type: 'color', title: 'Fuchsia', defval: color.fuchsia },
  { id: 'barRedColor', type: 'color', title: 'Red', defval: color.red },
  { id: 'showRedColor', type: 'bool', title: 'Show Red Bars MACD < Signal when MACD < 0', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: color.yellow, lineWidth: 1 },
];

export const metadata = {
  title: 'Moneyball EMA-MACD indicator [VinnieTheFish]',
  shortTitle: 'Moneyball EMA-MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Step = { step(v: number): number; commit(): void };

/** The MA of one line: dema = 2 * ema1 - ema(ema1); tema = 3 * ema1 - 3 * ema2 + ema(ema2) */
function maStep(type: MaType, len: number): Step {
  if (type === 'SMA') return new WindowSma(len);
  const e1 = taStep.ema(len);
  if (type === 'EMA') return e1;
  const e2 = taStep.ema(len);
  if (type === 'DEMA') {
    return {
      step: (x) => { const v = e1.step(x); return 2 * v - e2.step(v); },
      commit: () => { e1.commit(); e2.commit(); },
    };
  }
  const e3 = taStep.ema(len);
  return {
    step: (x) => { const v = e1.step(x); const w = e2.step(v); return 3 * v - 3 * w + e3.step(w); },
    commit: () => { e1.commit(); e2.commit(); e3.commit(); },
  };
}

interface MoneyballRun extends BarRunState<Record<string, never>> {
  fastMa: Step;
  slowMa: Step;
  sigMa: Step;
  emas: ReturnType<typeof taStep.ema>[];
  macd: number[];
  signal: number[];
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MoneyballEmaMacdInputs>): BarStudy<MoneyballRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MoneyballRun = {
        fastMa: maStep(cfg.smaSource, cfg.fastLength), slowMa: maStep(cfg.smaSource, cfg.slowLength),
        sigMa: maStep(cfg.smaSignal, cfg.signalLength), emas: [],
        macd: [], signal: [], plot0: [], plot1: [], barColors: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.emas = [3, 9, 20, 50].map((l) => taStep.ema(l));
      s.steps = [s.fastMa, s.slowMa, s.sigMa, ...s.emas];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.macd, s.signal, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const m = s.fastMa.step(src) - s.slowMa.step(src);
      const sig = s.sigMa.step(m);
      s.macd[i] = m;
      s.signal[i] = sig;
      const pm = i > 0 ? s.macd[i - 1] : NaN;
      const ps = i > 0 ? s.signal[i - 1] : NaN;
      const ema3 = s.emas[0].step(src);
      const ema9 = s.emas[1].step(src);
      const ema20 = s.emas[2].step(src);
      const ema50 = s.emas[3].step(src);
      const close = b.close;

      const aboveZero = gt(m, 0);
      const belowZero = lt(m, 0);
      const macdAboveSignal = gt(m, sig);
      const macdBelowSignal = lt(m, sig);
      const green = aboveZero && macdAboveSignal;
      const white = macdBelowSignal;
      const orange = belowZero && macdAboveSignal;
      const red = belowZero && macdBelowSignal;
      const fuchsia = gt(ema3, ema9) && lt(close, ema20) && lt(close, ema50) && lt(m, 0);
      // switch: the first true case; no case: na (the bar keeps its colour)
      const c = fuchsia ? cfg.barFuchsiaColor
        : orange ? cfg.barOrangeColor
          : green ? cfg.barGreenColor
            : red && cfg.showRedColor ? cfg.barRedColor
              : white ? cfg.barWhiteColor
                : null;
      if (c) s.barColors.push({ time: b.time, color: c });
      // new_high_macd = ta.change(macd) > 0 / new_low_macd = ta.change(macd) < 0
      const change = i > 0 ? m - pm : NaN;
      const newHigh = gt(change, 0);
      const newLow = lt(change, 0);
      const f = [m > 0 && pm <= 0, m < 0 && pm >= 0, sig > 0 && ps <= 0, sig < 0 && ps >= 0,
        aboveZero && macdAboveSignal && newHigh, belowZero && macdBelowSignal && newLow, orange, green, white, red, fuchsia];
      for (let k = 0; k < f.length; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(b.time as number);
      }
      s.plot0[i] = { time: b.time, value: m, color: color.red };
      s.plot1[i] = { time: b.time, value: sig, color: color.yellow };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // hline(0, 'Zero Line', color = color.white): default style dashed, width 1
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.white, linestyle: 'dashed', linewidth: 1 } }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MoneyballEmaMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MoneyballEmaMacdInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MACD Crossed Above Zero', message: 'MACD has crossed above the zero line' },
  { id: 'alert1', title: 'MACD Crossed Below Zero', message: 'MACD has crossed below the zero line' },
  { id: 'alert2', title: 'Signal Line Crossed Above Zero', message: 'Signal line has crossed above the zero line' },
  { id: 'alert3', title: 'Signal Line Crossed Below Zero', message: 'Signal line has crossed below the zero line' },
  { id: 'alert4', title: 'MACD New High Above Zero Line', message: 'MACD has made a new high above the zero line' },
  { id: 'alert5', title: 'MACD New Low Below Zero Line', message: 'MACD has made a new low below the zero line' },
  { id: 'alert6', title: 'MACD Orange bar', message: 'MACD Orange bar condition' },
  { id: 'alert7', title: 'MACD Green bar', message: 'MACD Green bar condition' },
  { id: 'alert8', title: 'MACD White bar', message: 'MACD White bar condition' },
  { id: 'alert9', title: 'MACD Red bar', message: 'MACD Red bar condition' },
  { id: 'alert10', title: 'MACD Fuchsia bar', message: 'MACD Fuchsia bar condition' },
];

export const MoneyballEmaMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
