/**
 * TASC 2025.01 Linear Predictive Filters
 *
 * John F. Ehlers' Griffiths adaptive filters (TASC, January 2025). The source passes through a 2-pole high-pass
 * filter (upper bound period) and a SuperSmoother (lower bound period), and is normalised by its decaying peak
 * (or replaced by a 30-bar sine test signal). A Griffiths LMS filter adapts its coefficients on this signal each bar.
 * Griffiths Predictor: the signal and its prediction 2 bars forward. Griffiths Spectrum: the power spectrum of the
 * coefficients for the periods from the lower to the upper bound, normalised to its maximum and drawn as a heat map
 * of 22 coloured columns (periods 18 to 39, black / red / yellow). Griffiths Dominant Cycle: the period of maximum
 * power, limited to a change of less than 2 per bar. The indicator choice selects which outputs are shown.
 *
 * Reference: "TASC 2025.01 Linear Predictive Filters" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PineCodersTASC. Article "Linear Predictive Filters And Instataneous Frequency" by John F. Ehlers.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export type LinearPredictiveFiltersChoice =
  | 'Griffiths Predictor'
  | 'Griffiths Spectrum'
  | 'Griffiths Dominant Cycle'
  | 'Griffiths Spectrum and Dominant Cycle';

export interface LinearPredictiveFiltersInputs {
  /** Indicator display choice */
  choice: LinearPredictiveFiltersChoice;
  /** Replace the filtered source by a 30-bar sine test signal */
  useTestSignal: boolean;
  src: SourceType;
  /** Lower bound period (SuperSmoother period, first spectrum period) */
  lowerBound: number;
  /** Upper bound period (high-pass period, last spectrum period) */
  upperBound: number;
  /** Griffiths filter length */
  length: number;
  /** Pine input "Griffiths Predictor Bars Forward": not used by the Pine calculation (the predictor uses 2) */
  barsForward: number;
}

export const defaultInputs: LinearPredictiveFiltersInputs = {
  choice: 'Griffiths Spectrum and Dominant Cycle',
  useTestSignal: false,
  src: 'close',
  lowerBound: 18,
  upperBound: 40,
  length: 40,
  barsForward: 2,
};

const CHOICES: LinearPredictiveFiltersChoice[] = [
  'Griffiths Predictor',
  'Griffiths Spectrum',
  'Griffiths Dominant Cycle',
  'Griffiths Spectrum and Dominant Cycle',
];

export const inputConfig: InputConfig[] = [
  { id: 'choice', type: 'string', title: 'Select Indicator:', defval: 'Griffiths Spectrum and Dominant Cycle', options: CHOICES },
  { id: 'useTestSignal', type: 'bool', title: 'Use Test Signal:', defval: false },
  { id: 'src', type: 'source', title: 'Source:', defval: 'close' },
  { id: 'lowerBound', type: 'int', title: 'Lower Bound:', defval: 18 },
  { id: 'upperBound', type: 'int', title: 'Upper Bound:', defval: 40 },
  { id: 'length', type: 'int', title: 'Length:', defval: 40 },
  { id: 'barsForward', type: 'int', title: 'Griffiths Predictor Bars Forward:', defval: 2 },
];

/** Spectrum columns: plot k (k = 18..39) is a column from k to k + 1 coloured with the spectrum colour of period k */
const SPECTRUM_PERIODS = Array.from({ length: 22 }, (_v, j) => 18 + j);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signal', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Predict', color: color.red, lineWidth: 1 },
  ...SPECTRUM_PERIODS.map((k, j): PlotConfig => ({
    id: `plot${2 + j}`, title: `Spectrum ${k}`, color: '#000000', lineWidth: 1, style: 'columns', histbase: k,
  })),
  { id: 'plot24', title: 'Dominant Cycle', color: color.blue, lineWidth: 3 },
];

export const metadata = {
  title: 'TASC 2025.01 Linear Predictive Filters',
  shortTitle: 'LPF',
  overlay: false,
};

/** Pine float comparisons with the 1e-10 tolerance; na operands give false */
const gt = (a: number, b: number): boolean => a - b > 1e-10;
const ge = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
const ne = (a: number, b: number): boolean => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > 1e-10;

/** Pine `for i = from to to`: counts down when from > to */
function pineFor(from: number, to: number, body: (i: number) => void): void {
  if (from <= to) for (let i = from; i <= to; i++) body(i);
  else for (let i = from; i >= to; i--) body(i);
}

/** Pine array.max / matrix column max of a float array: na and +/-infinity values are skipped */
function arrMax(a: number[]): number {
  let m = NaN;
  for (const v of a) if (Number.isFinite(v) && (isNaN(m) || v > m)) m = v;
  return m;
}

/**
 * Griffiths LMS coefficient update of one bar (shared by the three Pine functions): XX holds the signal of the last
 * `length` bars (XX[length] = current signal), Coef is updated with MU = 1 / length.
 */
function griffithsUpdate(signal: number[], i: number, length: number, XX: number[], Coef: number[]): void {
  const MU = 1.0 / length;
  let XBar = 0.0;
  XX[length] = signal[i];
  pineFor(1, length - 1, (count) => {
    const k = i - (length - count);
    XX[count] = k >= 0 && !isNaN(signal[k]) ? signal[k] : 0; // nz(Signal[length - count])
  });
  pineFor(1, length, (count) => {
    XBar += XX[length - count] * Coef[count];
  });
  pineFor(1, length, (count) => {
    Coef[count] = Coef[count] + MU * (XX[length] - XBar) * XX[length - count];
  });
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface LpfVars {
  peak: number;
  /** Griffiths Predictor state */
  xx1: number[];
  coef1: number[];
  /** Griffiths Spectrum / Dominant Cycle state */
  xx2: number[];
  coef2: number[];
  pwr: number[];
}

interface LpfRun extends BarRunState<LpfVars> {
  src: number[];
  hp: number[];
  lp: number[];
  signal: number[];
  cycle: number[];
  plots: Point[][];
}

function study(inputs: Partial<LinearPredictiveFiltersInputs>): BarStudy<LpfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lowerBound: LBound, upperBound: UBound, length: Length, useTestSignal } = cfg;
  const value = barSource(cfg.src);
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  const FROT = 2.0 * Math.PI;

  // CF(Source, LowerB, UpperB, Test): HP(Source, UpperB) -> SS(HP, LowerB) -> divided by the decaying peak.
  // GP, GS and GD call CF with the same arguments, so the three Pine call sites give the same series.
  const hpA0 = (Math.PI * Math.sqrt(2.0)) / UBound;
  const hpA1 = Math.exp(-hpA0);
  const hpC2 = 2.0 * hpA1 * Math.cos(hpA0);
  const hpC3 = -hpA1 * hpA1;
  const hpC1 = (1.0 + hpC2 - hpC3) * 0.25;
  const ssA0 = (Math.PI * Math.sqrt(2.0)) / LBound;
  const ssA1 = Math.exp(-ssA0);
  const ssC2 = 2.0 * ssA1 * Math.cos(ssA0);
  const ssC3 = -ssA1 * ssA1;
  const ssC1 = 1.0 - ssC2 - ssC3;

  // Griffiths Spectrum and Dominant Cycle: GS / GD(Src, LBound, UBound, math.max(UBound, Length), iTest).
  // Both compute the same coefficients and the same raw power column; GS normalises it, GD takes its peak index.
  const length2 = Math.max(UBound, Length);
  const LP1 = length2 + 1;
  // a0 = FROT * count / period: cos / sin table per period
  const cosT = new Map<number, number[]>();
  const sinT = new Map<number, number[]>();
  pineFor(LBound, UBound, (period) => {
    const c: number[] = [];
    const s: number[] = [];
    for (let count = 1; count <= length2; count++) {
      const a0 = (FROT * count) / period;
      c[count] = Math.cos(a0);
      s[count] = Math.sin(a0);
    }
    cosT.set(period, c);
    sinT.set(period, s);
  });

  // D1 = GP choice; D2 = GS or GSD; D3 = GD or GSD (display.none plots are returned as na)
  const d1 = cfg.choice === 'Griffiths Predictor';
  const d2 = cfg.choice === 'Griffiths Spectrum' || cfg.choice === 'Griffiths Spectrum and Dominant Cycle';
  const d3 = cfg.choice === 'Griffiths Dominant Cycle' || cfg.choice === 'Griffiths Spectrum and Dominant Cycle';

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: LpfRun = {
        src: [], hp: [], lp: [], signal: [], cycle: [], plots: Array.from({ length: 25 }, () => []),
        steps: [],
        vars: {
          peak: NaN,
          xx1: new Array(Length + 1).fill(0.0),
          coef1: new Array(Length + 1).fill(0.0),
          xx2: new Array(LP1).fill(0.0),
          coef2: new Array(LP1).fill(0.0),
          pwr: new Array(LP1).fill(0.0), // Pwr column 0 (column 1 is written by Pine but not used)
        },
        lists: [], series: [],
      };
      s.series = [s.src, s.hp, s.lp, s.signal, s.cycle, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const { src, hp, lp, signal, cycle } = s;
      const v = s.vars;
      src[i] = value(bars[i]);
      // HP: hp = 0.0; if bar_index >= 4: hp := c1 * (S - 2 * S[1] + S[2]) + c2 * nz(hp[1]) + c3 * nz(hp[2])
      hp[i] = i >= 4
        ? hpC1 * (src[i] - 2.0 * src[i - 1] + src[i - 2]) + hpC2 * nz(hp[i - 1]) + hpC3 * nz(hp[i - 2])
        : 0.0;
      // SS: ss = Source; if bar_index >= 4: ss := c1 * ((S + S[1]) / 2) + c2 * nz(ss[1]) + c3 * nz(ss[2])
      lp[i] = i >= 4
        ? ssC1 * ((hp[i] + hp[i - 1]) / 2.0) + ssC2 * nz(lp[i - 1]) + ssC3 * nz(lp[i - 2])
        : hp[i];
      // Peak := 0.991 * nz(Peak[1]); if math.abs(LP) > Peak: Peak := math.abs(LP)
      v.peak = 0.991 * nz(v.peak);
      if (gt(Math.abs(lp[i]), v.peak)) v.peak = Math.abs(lp[i]);
      // Test ? TS : (Peak != 0 ? LP / Peak : 0); TS = math.sin(FROT * bar_index / 30)
      signal[i] = useTestSignal ? Math.sin((FROT * i) / 30.0) : ne(v.peak, 0.0) ? lp[i] / v.peak : 0.0;

      // Griffiths Predictor: GP(Src, LBound, UBound, Length, 2, iTest)
      let XPred = 0.0;
      {
        const length = Length;
        const XX = v.xx1;
        const Coef = v.coef1;
        const barsF = 2;
        griffithsUpdate(signal, i, length, XX, Coef);
        pineFor(1, barsF, (advance) => {
          XPred = 0.0;
          pineFor(1, length, (count) => {
            XPred += XX[length + 1 - count] * Coef[count];
          });
          pineFor(advance, length - advance, (count) => {
            XX[count] = XX[count + 1];
          });
          pineFor(1, length - 1, (count) => {
            XX[count] = XX[count + 1];
          });
          XX[length] = XPred;
        });
      }

      const sp: string[] = new Array(100).fill('#000000');
      {
        const length = length2;
        const XX = v.xx2;
        const Coef = v.coef2;
        const pwr = v.pwr;
        griffithsUpdate(signal, i, length, XX, Coef);
        pineFor(LBound, UBound, (period) => {
          let re = 0.0;
          let im = 0.0;
          const c = cosT.get(period)!;
          const s = sinT.get(period)!;
          pineFor(1, length, (count) => {
            re += Coef[count] * c[count];
            im += Coef[count] * s[count];
          });
          const denom = Math.pow(1.0 - re, 2.0) + Math.pow(im, 2.0);
          pwr[period] = 0.1 / denom; // 0.1 / 0 is +infinity (skipped by the max, drawn white below)
        });
        const MaxPwr = arrMax(pwr);

        // GD: cycle = Pwr.col(0).indexof(MaxPwr), then limited to a change of less than 2 from cycle[1]
        let cyc = pwr.indexOf(MaxPwr);
        const prev = i > 0 ? cycle[i - 1] : NaN;
        if (ge(cyc, prev + 2.0)) cyc = prev + 2.0;
        else if (ge(prev - 2.0, cyc)) cyc = prev - 2.0;
        cycle[i] = cyc;

        // GS: normalise by MaxPwr (if MaxPwr != 0), then r = p0 >= 0.5 ? 255 : 510 * p0, g = p0 >= 0.5 ? 255 * (2 * p0 - 1) : 0
        const norm = pwr.slice();
        if (ne(MaxPwr, 0)) pineFor(LBound, UBound, (period) => { norm[period] = norm[period] / MaxPwr; });
        // Spectrum = array.new<color>(100, #000000); Spectrum.set(period, color.rgb(r, g, 0.0))
        pineFor(LBound, UBound, (period) => {
          const p0 = norm[period];
          const r = ge(p0, 0.5) ? 255.0 : 255.0 * 2.0 * p0;
          const g = ge(p0, 0.5) ? 255.0 * (2.0 * p0 - 1.0) : 0.0;
          // color.rgb(255, +infinity, 0) (power +infinity) is white in Pine
          sp[period] = Number.isFinite(g) ? String(color.rgb(r, g, 0.0)) : String(color.rgb(255, 255, 255));
        });
      }

      const time = bars[i].time;
      s.plots[0][i] = { time, value: d1 ? signal[i] : NaN };
      s.plots[1][i] = { time, value: d1 ? XPred : NaN };
      // plot(k + 1, '', SP.get(k), 1, plot.style_columns, false, k, display = D2) for k = 18..39 (histbase k)
      SPECTRUM_PERIODS.forEach((k, j) => { s.plots[2 + j][i] = { time, value: d2 ? k + 1 : NaN, color: sp[k] }; });
      s.plots[24][i] = { time, value: d3 ? cycle[i] : NaN };
    },
    copyVars: (v) => ({
      peak: v.peak, xx1: v.xx1.slice(), coef1: v.coef1.slice(), xx2: v.xx2.slice(), coef2: v.coef2.slice(),
      pwr: v.pwr.slice(),
    }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // hline(0, display = D1): Pine default hline colour and dashed style
        hlines: d1 ? [{ value: 0, options: { color: '#787B86', linestyle: 'dashed' } }] : [],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LinearPredictiveFiltersInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LinearPredictiveFiltersInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const LinearPredictiveFilters = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
