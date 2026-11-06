/**
 * ROC-Weighted MA Oscillator
 *
 * The rate of change of the source (length rocLen) is normalised to 0..1 over rocLen bars. A moving average of the
 * source (type and length selectable) is moved towards the source by this weight: rwma = ma + weight * (src - ma).
 * The oscillator is the z-score of rwma over rocLen bars, with an EMA signal line. The histogram colour is bull above
 * the neutral threshold, bear below its negative, and keeps the previous colour inside the neutral zone. A colour
 * change from bear to bull (bull to bear) gives a long (short) triangle on the price pane. Gradient fills between
 * 2.5 and 3 (and -2.5 and -3) follow the oscillator; optional candle colours.
 * Alerts (alertcondition, `alerts` of the result): 'ROC Weighted MA Postive Trend' (oscillator above the neutral
 * threshold) and 'ROC Weighted MA Negative Trend' (oscillator below the neutral threshold), as the original.
 *
 * Reference: "ROC-Weighted MA Oscillator [SeerQuant]" by SeerQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type RocWeightedMAType = 'SMA' | 'EMA' | 'SMMA' | 'WMA' | 'VWMA' | 'TEMA' | 'DEMA' | 'LSMA' | 'HMA' | 'ALMA';
export type RocWeightedColorScheme = 'Default' | 'Modern' | 'Cool' | 'Alternate' | 'Bright';

export interface RocWeightedMAOscillatorInputs {
  /** ROC length (also the normalisation and z-score length) */
  rocLen: number;
  /** MA length */
  maLen: number;
  /** Signal EMA length */
  sigLen: number;
  /** Calculation source */
  src: SourceType;
  /** Neutral threshold */
  neutralThr: number;
  /** MA type */
  maType: RocWeightedMAType;
  /** Colour the candles */
  paint: boolean;
  /** Colour scheme */
  colScheme: RocWeightedColorScheme;
}

export const defaultInputs: RocWeightedMAOscillatorInputs = {
  rocLen: 55,
  maLen: 7,
  sigLen: 9,
  src: 'hlcc4',
  neutralThr: 0.5,
  maType: 'TEMA',
  paint: false,
  colScheme: 'Default',
};

const MA_TYPES: RocWeightedMAType[] = ['SMA', 'EMA', 'SMMA', 'WMA', 'VWMA', 'TEMA', 'DEMA', 'LSMA', 'HMA', 'ALMA'];

export const inputConfig: InputConfig[] = [
  { id: 'rocLen', type: 'int', title: 'ROC Length', defval: 55 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 7 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 9 },
  { id: 'src', type: 'source', title: 'Calculation Source', defval: 'hlcc4' },
  { id: 'neutralThr', type: 'float', title: 'Neutral Threshold', defval: 0.5 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'TEMA', options: MA_TYPES },
  { id: 'paint', type: 'bool', title: 'Colour Candles?', defval: false },
  { id: 'colScheme', type: 'string', title: 'Color Scheme', defval: 'Default', options: ['Default', 'Modern', 'Cool', 'Alternate', 'Bright'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#00ff73', lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: color.white, lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bound 3', color: '#606060', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Bound 2.5', color: '#606060', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Bound -3', color: '#606060', lineWidth: 1 },
  { id: 'plot5', title: 'Lower Bound -2.5', color: '#606060', lineWidth: 1 },
];

export const metadata = {
  title: 'ROC-Weighted MA Oscillator',
  shortTitle: 'ROCWMA',
  overlay: false,
};

const SCHEMES: Record<RocWeightedColorScheme, [string, string, string]> = {
  Default: ['#00ff73', '#ff0040', '#606060'],
  Modern: ['#23d7e4', '#e11179', '#707070'],
  Cool: ['#00ffcc', '#1600db', '#505050'],
  Alternate: ['#00ff80', '#ff6600', '#505050'],
  Bright: ['#e8ec00', '#f200fa', '#505050'],
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** x / 0 of the normalised ROC: highest = lowest means roc = lowest, so Pine also gives 0 / 0 = na */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);
/** Pine na() / plots / ta.ema treat +-infinity as na */
const finite = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

/** One moving average stepped bar by bar: step(value, volume) */
interface MaStep extends Committable {
  step(value: number, volume: number): number;
}

/** ta.alma(source, length, offset, sigma): the weighted sum of the last `length` values, in the order of the oakscriptjs function */
class AlmaStep implements MaStep {
  private readonly weights: number[] = [];
  private readonly values: number[] = [];
  private current = NaN;
  private stepped = false;

  constructor(private readonly length: number, offset: number, sigma: number) {
    // the length check of ta.alma (an error for a length below 1)
    taCore.alma([], length, offset, sigma);
    const m = offset * (length - 1);
    const s = length / sigma;
    let weightSum = 0;
    for (let i = 0; i < length; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
      this.weights.push(weight);
      weightSum += weight;
    }
    for (let i = 0; i < length; i++) this.weights[i]! /= weightSum;
  }

  step(value: number): number {
    this.stepped = true;
    this.current = value;
    const i = this.values.length;
    const length = this.length;
    if (i < length - 1) return NaN;
    let almaValue = 0;
    for (let j = 0; j < length; j++) {
      const k = i - length + 1 + j;
      almaValue += (k === i ? value : this.values[k]!) * this.weights[j]!;
    }
    return almaValue;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.current);
  }
}

/** ma(source, length, type) of the script, one bar at a time */
function maStep(length: number, type: RocWeightedMAType): MaStep {
  const of = (ms: Committable[], step: (v: number, vol: number) => number): MaStep => ({
    step,
    commit: () => { for (const m of ms) m.commit(); },
  });
  switch (type) {
    case 'SMA': { const m = taStep.sma(); return of([m], (v) => m.step(v, length)); }
    case 'EMA': { const m = taStep.ema(length); return of([m], (v) => m.step(v)); }
    case 'SMMA': { const m = taStep.rma(length); return of([m], (v) => m.step(v)); }
    case 'WMA': { const m = taStep.wma(); return of([m], (v) => m.step(v, length)); }
    case 'VWMA': { const m = taStep.vwma(length); return of([m], (v, vol) => m.step(v, vol)); }
    case 'TEMA': {
      const e1 = taStep.ema(length);
      const e2 = taStep.ema(length);
      const e3 = taStep.ema(length);
      return of([e1, e2, e3], (v) => {
        const a1 = e1.step(v);
        const a2 = e2.step(a1);
        const a3 = e3.step(a2);
        return 3 * (a1 - a2) + a3;
      });
    }
    case 'DEMA': {
      const e1 = taStep.ema(length);
      const e2 = taStep.ema(length);
      return of([e1, e2], (v) => {
        const a1 = e1.step(v);
        return 2 * a1 - e2.step(a1);
      });
    }
    case 'LSMA': { const m = taStep.linreg(length, 0); return of([m], (v) => m.step(v)); }
    case 'HMA': {
      // ta.wma(2 * ta.wma(source, length / 2) - ta.wma(source, length), math.floor(math.sqrt(length)))
      // (length / 2 is fractional for an odd length; the WMA length is its integer part, as ta.wma here)
      const half = taStep.wma();
      const full = taStep.wma();
      const out = taStep.wma();
      const len = Math.floor(Math.sqrt(length));
      return of([half, full, out], (v) => out.step(2 * half.step(v, length / 2) - full.step(v, length), len));
    }
    case 'ALMA': return new AlmaStep(length, 0.85, 6);
  }
}

interface RocwVars {
  /** currentCol of the bar before */
  prevColor: string | null;
}

interface RocwRun extends BarRunState<RocwVars> {
  roc: ReturnType<typeof taStep.roc>;
  rocLo: WindowExtreme;
  rocHi: WindowExtreme;
  ma: MaStep;
  mean: WindowSma;
  sd: WindowStdev;
  sig: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  upperFill: string[];
  lowerFill: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RocWeightedMAOscillatorInputs>): BarStudy<RocwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { rocLen, maLen, sigLen, neutralThr, paint } = cfg;
  const [bull, bear] = SCHEMES[cfg.colScheme];
  const neutral = SCHEMES[cfg.colScheme][2];
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const roc = taStep.roc(rocLen);
      // the length checks of ta.lowest / ta.highest (of the ROC), ta.sma and ta.stdev
      taStep.lowest().step(0, rocLen);
      const ma = maStep(maLen, cfg.maType);
      taStep.sma().step(0, rocLen);
      taStep.stdev().step(0, rocLen);
      const s: RocwRun = {
        roc, rocLo: new WindowExtreme(true, rocLen), rocHi: new WindowExtreme(false, rocLen), ma,
        mean: new WindowSma(rocLen), sd: new WindowStdev(rocLen), sig: taStep.ema(sigLen),
        plots: Array.from({ length: 6 }, () => []), upperFill: [], lowerFill: [], markers: [], barColors: [],
        flags: [[], []], times: [[], []], steps: [], vars: { prevColor: null }, lists: [], series: [],
      };
      s.steps = [s.roc, s.rocLo, s.rocHi, s.ma, s.mean, s.sd, s.sig];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [...s.plots, s.upperFill, s.lowerFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      // roc = ta.roc(src, rocLen); normalized_roc = (roc - lowest(roc)) / (highest(roc) - lowest(roc))
      const roc = s.roc.step(src);
      const rocLo = s.rocLo.step(roc);
      const rocHi = s.rocHi.step(roc);
      const normRoc = div(roc - rocLo, rocHi - rocLo);

      const m = s.ma.step(src, b.volume ?? NaN);
      // rwma = base_ma + normalized_roc * (src - base_ma)
      const rwma = m + normRoc * (src - m);
      // oscillator = zscore(rwma, rocLen) = (rwma - sma) / stdev
      const mean = s.mean.step(rwma);
      const sd = s.sd.step(rwma);
      // a non-zero value / 0 stays +-infinity (comparisons and fill gradients use it), 0 / 0 is na
      const o = (rwma - mean) / sd;
      const signal = s.sig.step(finite(o));

      // inNeutralZone = oscillator > -neutralThr and oscillator < neutralThr (na: false)
      const prevColor = v.prevColor;
      const inNeutralZone = gt(o, -neutralThr) && gt(neutralThr, o);
      const currentCol: string | null = inNeutralZone ? prevColor : gt(o, neutralThr) ? bull : gt(-neutralThr, o) ? bear : neutral;
      const longSignal = currentCol === bull && prevColor === bear;
      const shortSignal = currentCol === bear && prevColor === bull;
      v.prevColor = currentCol;

      const p = s.plots;
      p[0][i] = { time: t, value: finite(o), color: currentCol ?? 'transparent' };
      p[1][i] = { time: t, value: signal, color: color.white };
      p[2][i] = { time: t, value: 3, color: '#606060' };
      p[3][i] = { time: t, value: 2.5, color: '#606060' };
      p[4][i] = { time: t, value: -3, color: '#606060' };
      p[5][i] = { time: t, value: -2.5, color: '#606060' };
      // oscillator > 0 ? color.from_gradient(oscillator, 0, 3, #0e0e0e, bear) : na
      s.upperFill[i] = gt(o, 0) ? String(color.from_gradient(o, 0, 3, '#0e0e0e', bear)) : 'transparent';
      // oscillator < 0 ? color.from_gradient(oscillator, -3, 0, bull, #0e0e0e) : na
      s.lowerFill[i] = gt(0, o) ? String(color.from_gradient(o, -3, 0, bull, '#0e0e0e')) : 'transparent';
      // barcolor(paint ? currentCol : na)
      if (paint && currentCol !== null) s.barColors.push({ time: t, color: currentCol });
      // plotshape(longSignal, triangleup, bull, belowbar, text "𝐋", textcolor bull, size.small, force_overlay)
      if (longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: bull, text: '𝐋', textColor: bull, size: 'small', forceOverlay: true });
      }
      if (shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: bear, text: '𝐒', textColor: bear, size: 'small', forceOverlay: true });
      }
      // alertcondition(oscillator > neutralThr) / alertcondition(oscillator < neutralThr)
      const up = gt(o, neutralThr);
      const dn = gt(neutralThr, o);
      s.flags[0][i] = up;
      s.flags[1][i] = dn;
      if (up) s.times[0].push(t as number);
      if (dn) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3, plot4, plot5] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
        fills: [
          { plot1: 'plot2', plot2: 'plot3', colors: s.upperFill.slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.lowerFill.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RocWeightedMAOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RocWeightedMAOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ROC Weighted MA Postive Trend', message: 'ROC Weighted MA Bullish Signal on: {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'ROC Weighted MA Negative Trend', message: 'ROC Weighted MA Bearish Signal on: {{exchange}}:{{ticker}}' },
];

export const RocWeightedMAOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
