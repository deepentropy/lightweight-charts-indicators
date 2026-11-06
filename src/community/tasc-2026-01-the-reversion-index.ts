/**
 * TASC 2026.01 The Reversion Index (John F. Ehlers)
 *
 * d = close - close[1]; the ratio is sum(d, length) / sum(|d|, length) (0 when the sum of |d| is 0 or na). Two
 * SuperSmoother filters of the ratio give the Smooth line (period 8) and the Trigger line (period 4). Each filter
 * smooths the 2-bar average of its input: f = c0 * avg(x, x[1]) + c1 * f[1] + c2 * f[2].
 *
 * Reference: "TASC 2026.01 The Reversion Index" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Tasc202601TheReversionIndexInputs {
  /** Normalization length of the data */
  length: number;
}

export const defaultInputs: Tasc202601TheReversionIndexInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RI Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smooth', color: '#F23645', lineWidth: 1 },
  { id: 'plot1', title: 'Trigger', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.01 The Reversion Index',
  shortTitle: 'RI',
  overlay: false,
};

const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);

/** superSmoother(Series, Period): the coefficients are `var` (computed on the first bar) */
function superSmootherCoefs(period: number): [number, number, number] {
  const ALPHA = (Math.PI * Math.sqrt(2.0)) / period;
  const BETA = math.exp(-ALPHA);
  const COEF2 = -math.pow(BETA, 2);
  const COEF1 = math.cos(ALPHA) * 2.0 * BETA;
  const COEF0 = 1.0 - COEF1 - COEF2;
  return [COEF0, COEF1, COEF2];
}

type Point = { time: number; value: number; color?: string };

interface RiVars {
  /** ri of the bar before */
  prevRi: number;
  /** The smooth / trigger filters of the two bars before */
  sm1: number;
  sm2: number;
  tr1: number;
  tr2: number;
}

interface RiRun extends BarRunState<RiVars> {
  ds: WindowSum;
  ads: WindowSum;
  smData: Point[];
  trData: Point[];
}

function study(inputs: Partial<Tasc202601TheReversionIndexInputs>): BarStudy<RiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const [s0, s1, s2] = superSmootherCoefs(8);
  const [t0, t1, t2] = superSmootherCoefs(4);
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    init() {
      // the length check of math.sum (the same runtime error)
      math.sum([], cfg.length);
      const ds = new WindowSum(cfg.length);
      const ads = new WindowSum(cfg.length);
      return {
        ds, ads, smData: [], trData: [], steps: [ds, ads],
        vars: { prevRi: NaN, sm1: NaN, sm2: NaN, tr1: NaN, tr2: NaN },
        lists: [], series: [],
      } as RiRun;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vars = s.vars;
      const d = i > 0 ? b.close - bars[i - 1].close : NaN;
      const dsum = s.ds.step(d);
      const asum = s.ads.step(Math.abs(d));
      // ratio = ads != 0.0 ? ds / ads : 0.0 (`!=` within 1e-10; na != 0 is false)
      const ri = !isNaN(asum) && Math.abs(asum) > 1e-10 ? dsum / asum : 0.0;
      // math.avg(Series, nz(Series[1], Series))
      const prev = i > 0 ? vars.prevRi : NaN;
      const sma2 = (ri + nz(prev, ri)) / 2;
      const sm = s0 * sma2 + s1 * nz(i > 0 ? vars.sm1 : NaN) + s2 * nz(i > 1 ? vars.sm2 : NaN);
      const tr = t0 * sma2 + t1 * nz(i > 0 ? vars.tr1 : NaN) + t2 * nz(i > 1 ? vars.tr2 : NaN);
      vars.prevRi = ri;
      vars.sm2 = vars.sm1;
      vars.sm1 = sm;
      vars.tr2 = vars.tr1;
      vars.tr1 = tr;
      s.smData[i] = { time: b.time, value: v(sm), color: '#F23645' };
      s.trData[i] = { time: b.time, value: v(tr), color: '#2962FF' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.smData.slice(), plot1: s.trData.slice() },
        // hline(0): Pine defaults (colour #787B86, dashed, width 1)
        hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Tasc202601TheReversionIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Tasc202601TheReversionIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Tasc202601TheReversionIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
