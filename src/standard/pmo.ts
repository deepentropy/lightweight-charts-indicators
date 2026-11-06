/**
 * Price Momentum Oscillator (PMO)
 *
 * A twice-smoothed 1-bar rate of change of the source, with an EMA signal line:
 *
 *   roc    = 100 * (src - src[1]) / src[1]
 *   PMO    = ewma(10 * ewma(roc, 2 / length1), 2 / length2)
 *   signal = ewma(PMO, 2 / (max(1, signalLength) + 1))
 *
 * where ewma(x, alpha) = alpha * x + (1 - alpha) * previous result (the first value, and the value after an na, start
 * from x itself). Drawn with a zero line.
 *
 * Based on the standard Price Momentum Oscillator indicator. The functions pmo, ema2 and ewma of the standard "ta"
 * library are ported in this file.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceMomentumOscillatorInputs {
  /** Source: a price of the bar or the volume */
  src: SourceType | 'volume';
  length1: number;
  length2: number;
  signalLength: number;
}

export const defaultInputs: PriceMomentumOscillatorInputs = {
  src: 'close',
  length1: 35,
  length2: 20,
  signalLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length1', type: 'int', title: 'Length 1', defval: 35, min: 1 },
  { id: 'length2', type: 'int', title: 'Length 2', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PMO', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', linewidth: 1, title: 'Zero' },
];

export const metadata = {
  title: 'Price Momentum Oscillator',
  shortTitle: 'PMO',
  overlay: false,
};

type Point = { time: number; value: number };

interface PmoVars {
  /** result[1] of the three ewma() calls (smooth 1, PMO, signal) */
  e1: number;
  e2: number;
  e3: number;
}

interface PmoRun extends BarRunState<PmoVars> {
  roc: ReturnType<typeof taStep.roc>;
  pmoData: Point[];
  signalData: Point[];
}

/**
 * One bar of ewma() of the "ta" library: result := alpha * source + (1 - alpha) * nz(result[1], source).
 * nz() treats +-infinity as na; an na alpha or source gives na on the bar.
 */
function ewma(s: number, a: number, prev: number): number {
  if (a < 0) throw new Error('Invalid smoothing factor. The value must not be negative.');
  return a * s + (1.0 - a) * (Number.isFinite(prev) ? prev : s);
}

/** The length check of ema2() of the "ta" library (EMA with a float length) */
function checkEma2(length: number): void {
  if (length < 1) throw new Error(`Invalid length (${length}). The value must be greater than or equal to 1.`);
}

function study(inputs: Partial<PriceMomentumOscillatorInputs>): BarStudy<PmoRun, IndicatorResult> {
  const { src, length1, length2, signalLength } = { ...defaultInputs, ...inputs };
  // input.source also offers the volume
  const value = barSource(src);
  const alpha1 = 2.0 / length1;
  const alpha2 = 2.0 / length2;
  const alpha3 = 2.0 / (Math.max(1.0, signalLength) + 1.0);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init(bars) {
      // the old order of the checks: the two ewma() factors on the first bar, then the length of ema2()
      if (bars.length === 0) checkEma2(signalLength);
      const roc = taStep.roc(1);
      const s: PmoRun = { roc, pmoData: [], signalData: [], steps: [roc], vars: { e1: NaN, e2: NaN, e3: NaN }, lists: [], series: [] };
      s.series = [s.pmoData, s.signalData];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const t = bars[i].time;
      // pmo() of the "ta" library
      const roc = s.roc.step(value(bars[i]));
      v.e1 = ewma(roc, alpha1, v.e1);
      const smooth1 = 10.0 * v.e1;
      v.e2 = ewma(smooth1, alpha2, v.e2);
      const pmo = v.e2;
      checkEma2(signalLength);
      v.e3 = ewma(pmo, alpha3, v.e3);
      const signal = v.e3;
      s.pmoData[i] = { time: t, value: Number.isFinite(pmo) ? pmo : NaN };
      s.signalData[i] = { time: t, value: Number.isFinite(signal) ? signal : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.pmoData.slice(),
          plot1: s.signalData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceMomentumOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceMomentumOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceMomentumOscillatorStandard = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
