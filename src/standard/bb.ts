/**
 * Bollinger Bands (BB) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Volatility bands placed above and below a moving average, using standard deviation.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * BB indicator input parameters
 */
export interface BBInputs {
  /** Period length */
  length: number;
  /** Moving average type for basis */
  maType: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** Price source */
  src: SourceType;
  /** Standard deviation multiplier */
  mult: number;
  /** Plot offset */
  offset: number;
}

/**
 * Default input values
 */
export const defaultInputs: BBInputs = {
  length: 20,
  maType: 'SMA',
  src: 'close',
  mult: 2,
  offset: 0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1, tooltip: 'The time period to be used in calculating the MA which creates the base for the Upper and Lower Bands.' },
  { id: 'maType', type: 'string', title: 'Basis MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], tooltip: 'Determines the type of Moving Average that is applied to the basis plot line.' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', tooltip: 'Determines what data from each bar will be used in calculations.' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50, tooltip: 'The number of Standard Deviations away from the MA that the Upper and Lower Bands should be.' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, tooltip: 'Changing this number will move the Bollinger Bands either Forwards or Backwards relative to the current market.', display: 'none' },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: '#F23645', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#089981', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Bollinger Bands',
  shortTitle: 'BB',
  overlay: true,
};

/**
 * Calculate BB indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
type Point = { time: number; value: number };

interface BbRun extends BarRunState<Record<string, never>> {
  basis: { step(v: number, volume: number): number; commit(): void };
  dev: ReturnType<typeof taStep.stdev>;
  basisData: Point[];
  upperData: Point[];
  lowerData: Point[];
}

function study(inputs: Partial<BBInputs>): BarStudy<BbRun, IndicatorResult> {
  const { length, maType, src, mult } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const basisStep = (): BbRun['basis'] => {
    switch (maType) {
      case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(length); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      case 'SMA':
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const basis = basisStep();
      const dev = taStep.stdev();
      const s: BbRun = { basis, dev, basisData: [], upperData: [], lowerData: [], steps: [basis, dev], vars: {}, lists: [], series: [] };
      s.series = [s.basisData, s.upperData, s.lowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const basis = s.basis.step(v, b.volume ?? 0);
      // dev = mult * ta.stdev(src, length); upper = basis + dev; lower = basis - dev
      const dev = s.dev.step(v, length) * mult;
      s.basisData[i] = { time: b.time, value: basis };
      s.upperData[i] = { time: b.time, value: basis + dev };
      s.lowerData[i] = { time: b.time, value: basis - dev };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.basisData.slice(), 'plot1': s.upperData.slice(), 'plot2': s.lowerData.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: '#2196F3', transp: 95, title: 'Background' } }] as FillData[],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * BB indicator module
 */
export const BollingerBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
