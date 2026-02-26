/**
 * Bollinger Bands (BB) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Volatility bands placed above and below a moving average, using standard deviation.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

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
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'Basis MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#F23645', lineWidth: 2 },
  { id: 'plot2', title: 'Lower', color: '#089981', lineWidth: 2 },
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
export function calculate(bars: Bar[], inputs: Partial<BBInputs> = {}): IndicatorResult {
  const { length, maType, src, mult } = { ...defaultInputs, ...inputs };

  // Get source series
  const source = getSourceSeries(bars, src);
  const volume = new Series(bars, (bar) => bar.volume ?? 0);

  // Calculate basis (moving average)
  let basis: Series;
  switch (maType) {
    case 'EMA':
      basis = ta.ema(source, length);
      break;
    case 'SMMA (RMA)':
      basis = ta.rma(source, length);
      break;
    case 'WMA':
      basis = ta.wma(source, length);
      break;
    case 'VWMA':
      basis = ta.vwma(source, length, volume);
      break;
    case 'SMA':
    default:
      basis = ta.sma(source, length);
      break;
  }

  // Calculate deviation
  const dev = ta.stdev(source, length).mul(mult);

  // Calculate upper and lower bands
  const upper = basis.add(dev);
  const lower = basis.sub(dev);

  // Convert to plot format
  const basisData = basis.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const upperData = upper.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const lowerData = lower.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': basisData,
      'plot1': upperData,
      'plot2': lowerData,
    },
  };
}

/**
 * BB indicator module
 */
export const BollingerBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
