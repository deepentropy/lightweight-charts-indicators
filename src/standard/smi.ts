/**
 * Stochastic Momentum Index (SMI)
 *
 * Position of the close relative to the middle of the highest high / lowest low range of the last %K Length bars,
 * smoothed twice with an EMA of %D Length:
 *
 *   range    = highest(high, lengthK) - lowest(low, lengthK)
 *   relative = close - (highest + lowest) / 2
 *   SMI      = 200 * ema(ema(relative, lengthD), lengthD) / ema(ema(range, lengthD), lengthD)
 *   signal   = ema(SMI, lengthEMA)  ("SMI-based EMA")
 *
 * Drawn with overbought / oversold lines at 40 / -40 (filled), a middle line at 0 and gradient fills between the
 * SMI and 0 above 40 (green) and below -40 (red).
 *
 * Based on the standard Stochastic Momentum Index indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochasticMomentumIndexStandardInputs {
  /** Lookback of the highest high / lowest low */
  lengthK: number;
  /** Length of the two EMAs of the relative range and of the range */
  lengthD: number;
  /** Length of the EMA of the SMI */
  lengthEMA: number;
}

export const defaultInputs: StochasticMomentumIndexStandardInputs = {
  lengthK: 10,
  lengthD: 3,
  lengthEMA: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthK', type: 'int', title: '%K Length', defval: 10, min: 1, max: 15000 },
  { id: 'lengthD', type: 'int', title: '%D Length', defval: 3, min: 1, max: 4999 },
  { id: 'lengthEMA', type: 'int', title: 'EMA Length', defval: 3, min: 1, max: 4999 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'SMI-based EMA', color: '#FF9800', lineWidth: 1 },
  // midLinePlot = plot(0, color = na, editable = false, display = display.none): base of the gradient fills
  { id: 'plot2', title: 'Plot', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_overbought', price: 40, color: '#787B86', linestyle: 'dashed', linewidth: 1, title: 'Overbought Line' },
  { id: 'hline_oversold', price: -40, color: '#787B86', linestyle: 'dashed', linewidth: 1, title: 'Oversold Line' },
  { id: 'hline_middle', price: 0, color: '#787B8680', linestyle: 'dashed', linewidth: 1, title: 'Middle Line' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_hlines', plot1: 'hline_overbought', plot2: 'hline_oversold', color: '#2962FF1A', title: 'Hlines Background' },
];

export const metadata = {
  title: 'Stochastic Momentum Index',
  shortTitle: 'SMI',
  overlay: false,
};

type Point = { time: number; value: number };
type Ema = ReturnType<typeof taStep.ema>;

interface SmiRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  /** emaEma(relativeRange, lengthD) / emaEma(highestLowestRange, lengthD) / ta.ema(smi, lengthEMA) */
  num1: Ema;
  num2: Ema;
  den1: Ema;
  den2: Ema;
  sig: Ema;
  smiData: Point[];
  emaData: Point[];
  midData: Point[];
}

function study(inputs: Partial<StochasticMomentumIndexStandardInputs>): BarStudy<SmiRun, IndicatorResult> {
  const { lengthK, lengthD, lengthEMA } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const highest = new WindowExtreme(false, lengthK);
      const lowest = new WindowExtreme(true, lengthK);
      const num1 = taStep.ema(lengthD);
      const num2 = taStep.ema(lengthD);
      const den1 = taStep.ema(lengthD);
      const den2 = taStep.ema(lengthD);
      const sig = taStep.ema(lengthEMA);
      const s: SmiRun = {
        highest, lowest, num1, num2, den1, den2, sig, smiData: [], emaData: [], midData: [],
        steps: [highest, lowest, num1, num2, den1, den2, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.smiData, s.emaData, s.midData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const hh = s.highest.step(b.high);
      const ll = s.lowest.step(b.low);
      const highestLowestRange = hh - ll;
      const relativeRange = b.close - (hh + ll) / 2;
      // emaEma(source, length) => ta.ema(ta.ema(source, length), length)
      const num = s.num2.step(s.num1.step(relativeRange));
      const den = s.den2.step(s.den1.step(highestLowestRange));
      // x / 0 is +-infinity and 0 / 0 is na, as in Pine; ta.ema skips the non-finite values
      const smi = 200 * (num / den);
      const smiEma = s.sig.step(smi);
      s.smiData[i] = { time, value: Number.isFinite(smi) ? smi : NaN };
      s.emaData[i] = { time, value: Number.isFinite(smiEma) ? smiEma : NaN };
      s.midData[i] = { time, value: 0 };
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array(n).fill(v);

      // fill(smiPlot, midLinePlot, 120, 40, top_color = color.new(#4caf4f, 50), bottom_color = color.new(color.green, 100))
      // fill(smiPlot, midLinePlot, -40, -120, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 50))
      const fills: FillData[] = [
        {
          plot1: 'plot0', plot2: 'plot2', options: { title: 'Overbought Gradient Fill' },
          gradient: { topValue: constant(120), bottomValue: constant(40), topColor: constant('#4CAF4F80'), bottomColor: constant('#4CAF5000') },
        },
        {
          plot1: 'plot0', plot2: 'plot2', options: { title: 'Oversold Gradient Fill' },
          gradient: { topValue: constant(-40), bottomValue: constant(-120), topColor: constant('#F2364500'), bottomColor: constant('#F2364580') },
        },
      ];

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.smiData.slice(),
          plot1: s.emaData.slice(),
          plot2: s.midData.slice(),
        },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticMomentumIndexStandardInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticMomentumIndexStandardInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const StochasticMomentumIndexStandard = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
