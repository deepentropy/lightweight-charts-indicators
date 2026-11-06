/**
 * Adaptive Volatility-Scaled Oscillator (AVSO)
 *
 * A scaled metric is log(source * measure) / 10 (na when the product is not positive), with the measure chosen among
 * volume, close, stdev(close, dev), ATR(dev) or the Yang-Zhang volatility (variances of the open gap, the body and
 * the high-low log ranges). The oscillator is the Z-score of this metric over `length` bars, drawn as columns. An
 * EMA whose length grows with |Z| (smoothingLength + int(|Z| * 2)) smooths it. Both are coloured with a gradient
 * from light blue (Z <= -3) to dark blue (Z >= 3); the background is tinted when Z is above 2 or below -2.
 *
 * Reference: "Adaptive Volatility-Scaled Oscillator [AVSO] (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { taStep, taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface AdaptiveVolatilityScaledOscillatorInputs {
  /** Price source of the scaled metric */
  src: SourceType;
  /** Volatility measure multiplied by the source */
  metricMeasure: 'Volume' | 'Close' | 'Standard Deviation' | 'ATR' | 'Yang';
  /** Bars of the mean and standard deviation of the scaled metric */
  length: number;
  /** ATR / standard deviation period */
  dev: number;
  /** Yang-Zhang volatility period */
  periodVol: number;
  /** Base length of the adaptive smoothing */
  smoothingLength: number;
}

export const defaultInputs: AdaptiveVolatilityScaledOscillatorInputs = {
  src: 'close',
  metricMeasure: 'Standard Deviation',
  length: 20,
  dev: 12,
  periodVol: 14,
  smoothingLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'metricMeasure', type: 'string', title: 'Volatility Measure', defval: 'Standard Deviation',
    options: ['Volume', 'Close', 'Standard Deviation', 'ATR', 'Yang'] },
  { id: 'length', type: 'int', title: 'Bars to Analyze', defval: 20, min: 2 },
  { id: 'dev', type: 'int', title: 'ATR / Standard Deviation Period', defval: 12, min: 1 },
  { id: 'periodVol', type: 'int', title: 'Yang Volatility Period', defval: 14, min: 1 },
  { id: 'smoothingLength', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scaled Volatility', color: '#2962ff', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Adaptive Smoothing', color: '#2962ff', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_high', price: 2, title: 'High Volatility', color: color.blue, linestyle: 'dotted' },
  { id: 'hline_low', price: -2, title: 'Low Volatility', color: color.blue, linestyle: 'dotted' },
];

export const metadata = {
  title: 'Adaptive Volatility-Scaled Oscillator [AVSO] (Zeiierman)',
  shortTitle: 'Adaptive Volatility-Scaled Oscillator [AVSO] (Zeiierman)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface AvsoVars {
  /** var ema = z (adaptive_ema) */
  ema: number;
  /** close of the bar before (log return of the open gap) */
  prevClose: number;
}

interface AvsoRun extends BarRunState<AvsoVars> {
  measure: (b: Bar, s: AvsoRun) => number;
  atr: ReturnType<typeof taStep.atr> | null;
  dev: WindowStdev | null;
  vOo: WindowStdev | null;
  vOc: WindowStdev | null;
  vHl: WindowStdev | null;
  mean: WindowSma;
  sd: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AdaptiveVolatilityScaledOscillatorInputs>): BarStudy<AvsoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf = barSource(cfg.src);
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  const zero = (x: number) => (isNaN(x) ? 0 : x);
  // Yang-Zhang volatility: log returns (na -> 0), sigma^2 = k * var(oo) + (1 - k) * var(oc) + c * var(hl)
  const yang = (b: Bar, s: AvsoRun): number => {
    const rOo = zero(Math.log(b.open / s.vars.prevClose));
    const rOc = zero(Math.log(b.close / b.open));
    const rHl = zero(Math.log(b.high / b.low));
    const k = 0.34;
    const c = 0.34;
    let s2 = k * s.vOo!.variance(rOo) + (1 - k) * s.vOc!.variance(rOc) + c * s.vHl!.variance(rHl);
    // sigma_YZ_sq >= 0 ? sigma_YZ_sq : 0 (na compares false -> 0)
    s2 = !isNaN(s2) && !(0 - s2 > EPS) ? s2 : 0;
    return Math.sqrt(s2);
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      let measure: AvsoRun['measure'];
      let atr: AvsoRun['atr'] = null;
      let dev: AvsoRun['dev'] = null;
      let vOo: AvsoRun['vOo'] = null;
      let vOc: AvsoRun['vOc'] = null;
      let vHl: AvsoRun['vHl'] = null;
      switch (cfg.metricMeasure) {
        case 'Volume': measure = (b) => b.volume ?? NaN; break;
        case 'Close': measure = (b) => b.close; break;
        case 'ATR': atr = taStep.atr(cfg.dev); measure = (b, s) => s.atr!.step(b.high, b.low, b.close); break;
        case 'Yang':
          // the length check of ta.variance (the same runtime error), then the biased variances of the window sums
          taCore.variance([], cfg.periodVol);
          vOo = new WindowStdev(cfg.periodVol);
          vOc = new WindowStdev(cfg.periodVol);
          vHl = new WindowStdev(cfg.periodVol);
          measure = yang;
          break;
        default: dev = new WindowStdev(cfg.dev); measure = (b, s) => s.dev!.step(b.close);
      }
      const s: AvsoRun = {
        measure, atr, dev, vOo, vOc, vHl,
        mean: new WindowSma(cfg.length),
        sd: new WindowStdev(cfg.length),
        plot0: [], plot1: [], bgColors: [],
        steps: [], vars: { ema: NaN, prevClose: NaN }, lists: [], series: [],
      };
      s.steps = [atr, dev, vOo, vOc, vHl, s.mean, s.sd].filter((m) => m !== null) as Committable[];
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const m = s.measure(b, s);
      v.prevClose = b.close;
      // scaledMetric(src, vol, 10): log(src * vol) / 10 when src * vol > 0, else na
      const dollarVolume = srcOf(b) * m;
      const metric = gt(dollarVolume, 0) ? Math.log(dollarVolume) / 10 : NaN;
      const mean = s.mean.step(metric);
      const sd = s.sd.step(metric);
      // (x - mean) / std. With a std of 0 it is +-Infinity (0 / 0: NaN): na for the plot, na() and nz(), but the
      // gradient colour and the bgcolor tests `z > 2` / `z < -2` use the infinite value.
      const z = (metric - mean) / sd;

      // adaptive_ema(z, smoothingLength + int(|z| * 2)): var ema = z (na on bar 0); na(z) keeps ema, else
      // alpha * z + (1 - alpha) * nz(ema)
      if (i === 0) v.ema = z;
      if (Number.isFinite(z)) {
        const len = cfg.smoothingLength + Math.trunc(Math.abs(z) * 2);
        const alpha = 2.0 / (len + 1.0);
        v.ema = alpha * z + (1 - alpha) * (Number.isFinite(v.ema) ? v.ema : 0);
      }

      // gradient_color: z clamped to -3..3, RGB from (173, 216, 230) to (41, 98, 255), channels truncated by int()
      const clamped = Math.max(Math.min(z, 3), -3);
      const norm = (clamped + 3) / 6;
      const r = Math.trunc(173 + (41 - 173) * norm);
      const g = Math.trunc(216 + (98 - 216) * norm);
      const bl = Math.trunc(230 + (255 - 230) * norm);
      const zColor = String(color.rgb(r, g, bl));

      // bgcolor(z > 2 ? color.new(z_color, 80) : na) / bgcolor(z < -2 ? color.new(z_color, 80) : na)
      // ('High Volatility' = bgcolor0, 'Low Volatility' = bgcolor1)
      if (gt(z, 2)) s.bgColors.push({ id: 'bgcolor0', time: b.time, color: String(color.new(zColor, 80)) });
      else if (gt(-2, z)) s.bgColors.push({ id: 'bgcolor1', time: b.time, color: String(color.new(zColor, 80)) });
      s.plot0[i] = { time: b.time, value: finite(z), color: zColor };
      s.plot1[i] = { time: b.time, value: finite(v.ema), color: zColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveVolatilityScaledOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveVolatilityScaledOscillatorInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveVolatilityScaledOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
