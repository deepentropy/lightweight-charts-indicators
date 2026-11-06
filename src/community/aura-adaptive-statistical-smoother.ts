/**
 * Aura: Adaptive Statistical Smoother
 *
 * A zero-lag target: the EMA of the source, then a second EMA pass over the last `length` values of that EMA
 * (newest to oldest). R² is the squared correlation of the close with the bar index over `length` bars. When R² > 0.5
 * the Aura MA moves toward the target by R² (aura = R² * target + (1 - R²) * aura); otherwise it is held. Bands are
 * the Aura MA +- mult * stdev(source, length). The trend is +1 above the Aura MA and -1 below it (held on a tie); it
 * colours the line, the bands, the cloud between the bands and the bars. BUY / SELL labels mark the close crossing
 * the Aura MA when R² > 0.3.
 *
 * Reference: "Aura: Adaptive Statistical Smoother [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface AuraAdaptiveStatisticalSmootherInputs {
  /** Statistical window: R² and stdev length, backward EMA pass length */
  length: number;
  /** Forward-backward smoothing: EMA length */
  smooth: number;
  /** Volatility multiplier of the bands */
  mult: number;
  src: SourceType;
  bullCss: string;
  bearCss: string;
}

export const defaultInputs: AuraAdaptiveStatisticalSmootherInputs = {
  length: 20,
  smooth: 10,
  mult: 1.5,
  src: 'close',
  bullCss: '#089981',
  bearCss: '#F23645',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Statistical Window', defval: 20, min: 2 },
  { id: 'smooth', type: 'int', title: 'Forward-Backward Smoothing', defval: 10, min: 1 },
  { id: 'mult', type: 'float', title: 'Volatility Multiplier', defval: 1.5, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'bullCss', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'bearCss', type: 'color', title: 'Bearish Color', defval: '#F23645' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: String(color.new('#089981', 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: String(color.new('#089981', 70)), lineWidth: 1 },
  { id: 'plot2', title: 'Aura MA', color: '#089981', lineWidth: 3 },
];

export const metadata = {
  title: 'Aura: Adaptive Statistical Smoother [Pineify]',
  shortTitle: 'Aura Trend [Pineify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number, y: number) => (isNaN(x) ? y : x);

/**
 * `ta.correlation(a, b, length)` with a constant length from the fast window steps: the doubles of
 * taStep.correlation (covariance over the square root of the two biased variances).
 */
class Correlation {
  private readonly meanXY: WindowSma;
  private readonly meanX: WindowSma;
  private readonly meanY: WindowSma;
  private readonly varX: WindowStdev;
  private readonly varY: WindowStdev;

  constructor(length: number) {
    this.meanXY = new WindowSma(length);
    this.meanX = new WindowSma(length);
    this.meanY = new WindowSma(length);
    this.varX = new WindowStdev(length);
    this.varY = new WindowStdev(length);
  }

  step(a: number, b: number): number {
    const product = a === null || a === undefined || b === null || b === undefined ? NaN : a * b;
    const mxy = this.meanXY.step(product);
    const cov = mxy - this.meanX.step(a) * this.meanY.step(b);
    const vx = this.varX.variance(a);
    const vy = this.varY.variance(b);
    if (Number.isNaN(cov)) return NaN;
    if (Math.abs(cov) <= 1e-10) return 0;
    const denominator = Math.sqrt(vx * vy);
    return denominator === 0 ? NaN : cov / denominator;
  }

  commit(): void {
    this.meanXY.commit();
    this.meanX.commit();
    this.meanY.commit();
    this.varX.commit();
    this.varY.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface AuraVars {
  /** var float aura_ma = 0.0 */
  auraMa: number;
  /** var float os = 0.0 */
  os: number;
  /** var int trend = 1 */
  trend: number;
}

interface AuraRun extends BarRunState<AuraVars> {
  ema: ReturnType<typeof taStep.ema>;
  corr: Correlation;
  dev: WindowStdev;
  xUp: ReturnType<typeof taStep.crossover>;
  xDown: ReturnType<typeof taStep.crossunder>;
  ema1: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  areaColors: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<AuraAdaptiveStatisticalSmootherInputs>): BarStudy<AuraRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, smooth, mult } = cfg;
  const value = barSource(cfg.src);
  const alpha = 2 / (smooth + 1);
  // the band (70) and cloud (85) colours of each trend colour
  const bullBand = String(color.new(cfg.bullCss, 70));
  const bearBand = String(color.new(cfg.bearCss, 70));
  const bullArea = String(color.new(cfg.bullCss, 85));
  const bearArea = String(color.new(cfg.bearCss, 85));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AuraRun = {
        ema: taStep.ema(smooth), corr: new Correlation(length), dev: new WindowStdev(length),
        xUp: taStep.crossover(), xDown: taStep.crossunder(), ema1: [], plot0: [], plot1: [], plot2: [],
        areaColors: [], barColors: [], markers: [],
        steps: [], vars: { auraMa: 0.0, os: 0.0, trend: 1 }, lists: [], series: [],
      };
      s.steps = [s.ema, s.corr, s.dev, s.xUp, s.xDown];
      s.lists = [s.markers];
      s.series = [s.ema1, s.plot0, s.plot1, s.plot2, s.areaColors, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const src = value(b);
      const v = s.vars;

      // Forward-backward zero-lag approximation
      const e1 = s.ema.step(src);
      s.ema1[i] = e1;
      let ema2 = e1;
      // for i = 1 to length - 1 (a loop from 1 down to a lower bound counts down)
      const step = length - 1 >= 1 ? 1 : -1;
      for (let k = 1; step > 0 ? k <= length - 1 : k >= length - 1; k += step) {
        const past = i - k >= 0 ? s.ema1[i - k] : NaN;
        ema2 += alpha * (nz(past, e1) - ema2);
      }
      const t = ema2;

      // r2 = nz(math.pow(ta.correlation(close, bar_index, length), 2), 0)
      const r2 = nz(Math.pow(s.corr.step(close, i), 2), 0);
      const stdev = s.dev.step(src) * mult;

      // abs_diff = math.abs(target - nz(target, target)): 0, or na while the target is na
      const absDiff = Math.abs(t - nz(t, t));
      v.os = gt(r2, 0.5) ? Math.sign(nz(src, src) - nz(t, t)) : nz(v.os, 0);
      v.auraMa = gt(r2, 0.5) ? r2 * t + (1 - r2) * nz(v.auraMa, t) : nz(v.auraMa, t) - absDiff * v.os;
      const auraMa = v.auraMa;
      v.trend = gt(close, auraMa) ? 1 : lt(close, auraMa) ? -1 : nz(v.trend, 1);

      const lineColor = v.trend === 1 ? cfg.bullCss : cfg.bearCss;
      const bandColor = v.trend === 1 ? bullBand : bearBand;
      s.areaColors[i] = v.trend === 1 ? bullArea : bearArea;

      // ta.crossover(close, aura_ma) / ta.crossunder(close, aura_ma): exact comparisons
      const xUp = s.xUp.step(close, auraMa);
      const xDown = s.xDown.step(close, auraMa);
      if (xUp && gt(r2, 0.3)) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: cfg.bullCss, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (xDown && gt(r2, 0.3)) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: cfg.bearCss, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      s.barColors[i] = { time, color: lineColor };
      s.plot0[i] = { time, value: auraMa + stdev, color: bandColor };
      s.plot1[i] = { time, value: auraMa - stdev, color: bandColor };
      s.plot2[i] = { time, value: auraMa, color: lineColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        // fill(p_upper, p_lower, areaColor, title = "Volatility Cloud")
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Volatility Cloud' }, colors: s.areaColors.slice() }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AuraAdaptiveStatisticalSmootherInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AuraAdaptiveStatisticalSmootherInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AuraAdaptiveStatisticalSmoother = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
