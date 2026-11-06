/**
 * Gabriel's Andean Oscillator
 *
 * Exponential envelopes of the close / open (up1 = max(C, O, up1[1] - (up1[1] - C) * alpha), dn1 = min(...), and the
 * same on the squares). The bullish component is the standard deviation of the lower envelope,
 * sqrt(dn2 - dn1^2), the bearish component the one of the upper envelope, sqrt(up2 - up1^2). "Double Smoothed"
 * uses the shorter envelope length and an EMA of each component. Optional components from envelopes of the high /
 * low, an optional ATR scaling, a signal line (EMA of the larger component) and a "Break" area sqrt(bull - bear).
 * Alerts (alertcondition, `alerts` of the result): regime flips (bull crossing bear), driver / signal crosses, break
 * turns (bull - bear crossing 0, with "Plot Breakes" on) and the flips confirmed by the high / low components (with
 * "Use Highs and Lows?" on).
 *
 * Reference: "Gabriel's Andean Oscillator" by GabrielAmadeusLau
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International
 * (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/ © alexgrover
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';

export interface GabrielsAndeanOscillatorInputs {
  envelopeType: 'Regular' | 'Double Smoothed';
  /** EMA envelope length (Regular) */
  length: number;
  /** EMA envelope length (Double Smoothed) */
  length1: number;
  /** EMA smoothing length of the components (Double Smoothed) */
  length2: number;
  signalLength: number;
  /** Plot the "Break" area */
  breakOn: boolean;
  /** Plot the high / low components */
  hilow: boolean;
  /** Divide the components by the ATR */
  atrScale: boolean;
}

export const defaultInputs: GabrielsAndeanOscillatorInputs = {
  envelopeType: 'Regular',
  length: 50,
  length1: 9,
  length2: 50,
  signalLength: 9,
  breakOn: true,
  hilow: false,
  atrScale: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'envelopeType', type: 'string', title: 'Envelope Type', defval: 'Regular', options: ['Regular', 'Double Smoothed'] },
  { id: 'length', type: 'int', title: 'EMA Envelope Length (Regular)', defval: 50 },
  { id: 'length1', type: 'int', title: 'EMA Envelope Length (Double Smoothed)', defval: 9 },
  { id: 'length2', type: 'int', title: 'EMA Envelope Length Smoothing (Double Smoothed)', defval: 50 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9 },
  { id: 'breakOn', type: 'bool', title: 'Plot Breakes', defval: true },
  { id: 'hilow', type: 'bool', title: 'Use Highs and Lows?', defval: false },
  { id: 'atrScale', type: 'bool', title: 'ATR Normalized?', defval: false },
];

const RED_30 = String(color.rgb(242, 54, 70, 30));
const GREEN_30 = String(color.rgb(8, 153, 129, 30));
const BREAK_COL = String(color.rgb(33, 149, 243, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish Open Component', color: '#089981', lineWidth: 1 },
  { id: 'plot1', title: 'Bearish Close Component', color: '#f23645', lineWidth: 1 },
  { id: 'plot2', title: 'Bullish High Component', color: GREEN_30, lineWidth: 1 },
  { id: 'plot3', title: 'Bearish Low Component', color: GREEN_30, lineWidth: 1 },
  { id: 'plot4', title: 'Signal', color: color.orange, lineWidth: 1 },
  { id: 'plot5', title: 'Break', color: BREAK_COL, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: "Gabriel's Andean Oscillator",
  shortTitle: "Gabriel's Andean Oscillator",
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine nz(x, y): na (and +-infinity) -> y */
const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);
/** Pine math.max / math.min: na when an argument is na */
const max = (...a: number[]) => (a.some((v) => Number.isNaN(v)) ? NaN : Math.max(...a));
const min = (...a: number[]) => (a.some((v) => Number.isNaN(v)) ? NaN : Math.min(...a));

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface AndeanVars {
  up1: number; up2: number; dn1: number; dn2: number;
  up12: number; up22: number; dn12: number; dn22: number;
  /** bull, bear, the driver and the signal of the bar before (the crosses) */
  pBull: number; pBear: number; pDriver: number; pSignal: number;
}

interface AndeanRun extends BarRunState<AndeanVars> {
  atr: ReturnType<typeof taStep.atr> | null;
  atrSma: WindowSma | null;
  emas: ReturnType<typeof taStep.ema>[];
  signal: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<GabrielsAndeanOscillatorInputs>): BarStudy<AndeanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, length1, length2, signalLength, breakOn, hilow, atrScale } = cfg;
  const regular = cfg.envelopeType === 'Regular';

  // var alpha = 2 / (length + 1): Pine v6 int / int keeps the fraction
  const alpha = 2 / (length + 1);
  const alpha0 = 2 / (length1 + 1);
  const alpha2 = 2.0 / (length + 1.0);
  const alpha22 = 2.0 / (length1 + 1.0);
  const a = regular ? alpha : alpha0;
  const a2 = regular ? alpha2 : alpha22;

  return {
    init() {
      const s: AndeanRun = {
        atr: atrScale ? taStep.atr(regular ? length : length1) : null,
        atrSma: atrScale && !regular ? new WindowSma(length2) : null,
        emas: regular ? [] : [taStep.ema(length2), taStep.ema(length2), taStep.ema(length2), taStep.ema(length2)],
        signal: taStep.ema(signalLength),
        plots: Array.from({ length: 6 }, () => []),
        flags: Array.from({ length: 8 }, () => []),
        times: Array.from({ length: 8 }, () => []),
        steps: [],
        // up1[1] ... is na on bar 0 (the var history starts on bar 0), so math.max(...) is na and nz(..., C) gives C;
        // up12[1] ... are read through nz(): 0 on bar 0
        vars: {
          up1: NaN, up2: NaN, dn1: NaN, dn2: NaN, up12: NaN, up22: NaN, dn12: NaN, dn22: NaN,
          pBull: NaN, pBear: NaN, pDriver: NaN, pSignal: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [...(s.atr ? [s.atr] : []), ...(s.atrSma ? [s.atrSma] : []), ...s.emas, s.signal];
      s.lists = [...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      // Raw components: dev of the close / open envelopes (vBull / vBear) and of the high / low envelopes (vBull2 / vBear2)
      const C = bars[i].close;
      const O = bars[i].open;
      const nUp1 = nz(max(C, O, v.up1 - (v.up1 - C) * a), C);
      const nUp2 = nz(max(C * C, O * O, v.up2 - (v.up2 - C * C) * a), C * C);
      const nDn1 = nz(min(C, O, v.dn1 + (C - v.dn1) * a), C);
      const nDn2 = nz(min(C * C, O * O, v.dn2 + (C * C - v.dn2) * a), C * C);
      v.up1 = nUp1;
      v.up2 = nUp2;
      v.dn1 = nDn1;
      v.dn2 = nDn2;

      const C2 = bars[i].high;
      const O2 = bars[i].low;
      const p12 = nz(v.up12);
      const p22 = nz(v.up22);
      const q12 = nz(v.dn12);
      const q22 = nz(v.dn22);
      v.up12 = nz(max(C2, O2, p12 - (p12 - C2) * a2), C2);
      // "Double Smoothed" up22: nz(math.max(C2 * C2, O2 * O2, nz(up22[1]) - (nz(up22[1]) - C2 * C2))) (no alpha)
      v.up22 = regular
        ? nz(max(C2 * C2, O2 * O2, p22 - (p22 - C2 * C2) * alpha2), C2 * C2)
        : nz(max(C2 * C2, O2 * O2, p22 - (p22 - C2 * C2)));
      v.dn12 = nz(min(C2, O2, q12 + (C2 - q12) * a2), C2);
      v.dn22 = nz(min(C2 * C2, O2 * O2, q22 + (C2 * C2 - q22) * a2), C2 * C2);

      const vBull = Math.sqrt(v.dn2 - v.dn1 * v.dn1);
      const vBear = Math.sqrt(v.up2 - v.up1 * v.up1);
      const vBull2 = Math.sqrt(v.dn22 - v.dn12 * v.dn12);
      const vBear2 = Math.sqrt(v.up22 - v.up12 * v.up12);

      // The envelope type and the ATR switch are inputs: each ternary takes the same branch on every bar
      let bull: number;
      let bear: number;
      let bull2: number;
      let bear2: number;
      if (regular) {
        if (s.atr) {
          const atr = s.atr.step(bars[i].high, bars[i].low, C);
          bull = vBull / atr;
          bear = vBear / atr;
          bull2 = vBull2 / atr;
          bear2 = vBear2 / atr;
        } else {
          bull = vBull / 1;
          bear = vBear / 1;
          bull2 = vBull2 / 1;
          bear2 = vBear2 / 1;
        }
      } else {
        const e = s.emas;
        bull = e[0]!.step(vBull);
        bear = e[1]!.step(vBear);
        bull2 = e[2]!.step(vBull2);
        bear2 = e[3]!.step(vBear2);
        if (s.atr) {
          const den = s.atrSma!.step(s.atr.step(bars[i].high, bars[i].low, C));
          bull /= den;
          bear /= den;
          bull2 /= den;
          bear2 /= den;
        } else {
          bull /= 1;
          bear /= 1;
          bull2 /= 1;
          bear2 /= 1;
        }
      }

      const driver = max(bull, bear);
      const signal = s.signal.step(driver);

      const p = s.plots;
      p[0]![i] = { time, value: fin(bull) };
      p[1]![i] = { time, value: fin(bear) };
      // color = bull > bull2 ? color.rgb(242, 54, 70, 30) : color.rgb(8, 153, 129, 30)
      p[2]![i] = { time, value: hilow ? fin(bull2) : NaN, color: gt(bull, bull2) ? RED_30 : GREEN_30 };
      p[3]![i] = { time, value: hilow ? fin(bear2) : NaN, color: gt(bear, bear2) ? RED_30 : GREEN_30 };
      p[4]![i] = { time, value: fin(signal) };
      // math.sqrt(bull - bear): na when bear > bull
      p[5]![i] = { time, value: breakOn ? fin(Math.sqrt(bull - bear)) : NaN };

      // Alerts: crosses of bull / bear, of the driver (larger component) and the signal, of bull - bear and 0
      // (ta.crossover / ta.crossunder: exact comparisons with the values of the bar before, na on bar 0)
      const diff = bull - bear;
      const pDiff = v.pBull - v.pBear;
      const bullCrossUp = bull > bear && v.pBull <= v.pBear;
      const bearCrossDn = bull < bear && v.pBull >= v.pBear;
      const fl = s.flags;
      fl[0]![i] = bullCrossUp;
      fl[1]![i] = bearCrossDn;
      fl[2]![i] = driver > signal && v.pDriver <= v.pSignal;
      fl[3]![i] = driver < signal && v.pDriver >= v.pSignal;
      fl[4]![i] = breakOn && diff > 0 && pDiff <= 0;
      fl[5]![i] = breakOn && diff < 0 && pDiff >= 0;
      fl[6]![i] = hilow && bullCrossUp && gt(bull, bull2);
      fl[7]![i] = hilow && bearCrossDn && gt(bear, bear2);
      v.pBull = bull;
      v.pBear = bear;
      v.pDriver = driver;
      v.pSignal = signal;
      for (let k = 0; k < 8; k++) if (fl[k]![i]) s.times[k]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GabrielsAndeanOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GabrielsAndeanOscillatorInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'Andean • Bullish Regime Flip',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Bull crossed ABOVE Bear (Bullish regime flip).',
  },
  {
    id: 'alert1',
    title: 'Andean • Bearish Regime Flip',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Bull crossed BELOW Bear (Bearish regime flip).',
  },
  {
    id: 'alert2',
    title: 'Andean • Signal Cross Up',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Driver crossed ABOVE Signal (bullish thrust).',
  },
  {
    id: 'alert3',
    title: 'Andean • Signal Cross Down',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Driver crossed BELOW Signal (bearish thrust).',
  },
  {
    id: 'alert4',
    title: 'Andean • Break Turned Positive',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Break turned POSITIVE (bull > bear).',
  },
  {
    id: 'alert5',
    title: 'Andean • Break Turned Negative',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Break turned NEGATIVE (bear > bull).',
  },
  {
    id: 'alert6',
    title: 'Andean • Bullish Regime Flip (Hi/Lo Confirmed)',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Bullish flip CONFIRMED by High/Low envelopes.',
  },
  {
    id: 'alert7',
    title: 'Andean • Bearish Regime Flip (Hi/Lo Confirmed)',
    message: '{{ticker}} {{interval}} • Andean Oscillator: Bearish flip CONFIRMED by High/Low envelopes.',
  },
];

export const GabrielsAndeanOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
