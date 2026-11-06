/**
 * Trend Strength Index
 *
 * Measures trend strength using the Pearson correlation between
 * closing prices and bar indices over a rolling window.
 * Range: -1 to 1, where positive = uptrend, negative = downtrend.
 * Formula: ta.correlation(close, bar_index, length)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillData, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendStrengthInputs {
  /** Period length */
  length: number;
  /** Bullish fill color */
  bullishColor: string;
  /** Bearish fill color */
  bearishColor: string;
}

export const defaultInputs: TrendStrengthInputs = {
  length: 14,
  bullishColor: '#0899811A',
  bearishColor: '#F236451A',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#0899811A' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#F236451A' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Strength Index', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot3', title: 'Plot', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid',  price: 0, color: '#787B8680', linestyle: 'dashed', title: 'TSI Middle Band' },
  { id: 'hline_bull', price: 1, color: '#089981', linestyle: 'dashed', title: 'TSI Bullish Band' },
  { id: 'hline_bear', price: -1, color: '#F23645', linestyle: 'dashed', title: 'TSI Bearish Band' },
];

export const metadata = {
  title: 'Trend Strength Index',
  shortTitle: 'TSI',
  overlay: false,
};

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

type Point = { time: number; value: number };

interface TrendStrengthRun extends BarRunState<Record<string, never>> {
  corr: Correlation;
  tsData: Point[];
  midlineData: Point[];
}

function study(inputs: Partial<TrendStrengthInputs>): BarStudy<TrendStrengthRun, IndicatorResult> {
  const { length, bullishColor, bearishColor } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const corr = new Correlation(length);
      const s: TrendStrengthRun = { corr, tsData: [], midlineData: [], steps: [corr], vars: {}, lists: [], series: [] };
      s.series = [s.tsData, s.midlineData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ta.correlation(close, bar_index, length)
      const v = s.corr.step(b.close, i);
      s.tsData[i] = { time: b.time, value: v ?? NaN };
      s.midlineData[i] = { time: b.time, value: 0 };
    },
    result(s, bars) {
      // Pine: midLinePlot = plot(0, display = display.none)
      //   fill(tsiPlot, midLinePlot, 1, 0, top_color = bullishColorInput, bottom_color = color.new(bullishColorInput, 100))
      //   fill(tsiPlot, midLinePlot, 0, -1, top_color = color.new(bearishColorInput, 100), bottom_color = bearishColorInput)
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array(n).fill(v);
      const fills: FillData[] = [
        {
          plot1: 'plot0', plot2: 'plot3', options: { title: 'Bullish Gradient Fill' },
          gradient: { topValue: constant(1), bottomValue: constant(0), topColor: constant(bullishColor), bottomColor: constant(color.new_color(bullishColor, 100) as string) },
        },
        {
          plot1: 'plot0', plot2: 'plot3', options: { title: 'Bearish Gradient Fill' },
          gradient: { topValue: constant(0), bottomValue: constant(-1), topColor: constant(color.new_color(bearishColor, 100) as string), bottomColor: constant(bearishColor) },
        },
      ];

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.tsData.slice(),
          'plot3': s.midlineData.slice(),
        },
        // hline(1, color = color.new(bullishColorInput, 0)); hline(-1, color = color.new(bearishColorInput, 0))
        hlines: [
          { value: 0, options: { title: 'TSI Middle Band', color: '#787B8680', linestyle: 'dashed' } },
          { value: 1, options: { title: 'TSI Bullish Band', color: color.new_color(bullishColor, 0) as string, linestyle: 'dashed' } },
          { value: -1, options: { title: 'TSI Bearish Band', color: color.new_color(bearishColor, 0) as string, linestyle: 'dashed' } },
        ],
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendStrengthInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendStrengthInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendStrengthIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
