/**
 * Keltner Channels (KC) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Volatility-based envelope set above and below an exponential moving average.
 * Uses ATR (Average True Range) to set channel distance.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

/**
 * Keltner Channels indicator input parameters
 */
export interface KeltnerInputs {
  /** EMA period length */
  length: number;
  /** ATR multiplier */
  mult: number;
  /** Price source */
  src: SourceType;
  /** Use exponential MA (true) or simple MA (false) */
  useEMA: boolean;
  /** Bands style: ATR, True Range, or Range */
  bandsStyle: 'Average True Range' | 'True Range' | 'Range';
  /** ATR period length */
  atrLength: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: KeltnerInputs = {
  length: 20,
  mult: 2,
  src: 'close',
  useEMA: true,
  bandsStyle: 'Average True Range',
  atrLength: 10,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2, min: 0.001, max: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'useEMA', type: 'bool', title: 'Use Exponential MA', defval: true },
  { id: 'bandsStyle', type: 'string', title: 'Bands Style', defval: 'Average True Range', options: ['Average True Range', 'True Range', 'Range'] },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
];

/**
 * Plot configuration - order matches CSV: Upper, Basis, Lower
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Basis', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Keltner Channels',
  shortTitle: 'KC',
  overlay: true,
};

/**
 * Calculate Keltner Channels indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<KeltnerInputs> = {}): IndicatorResult {
  const { length, mult, src, useEMA, bandsStyle, atrLength } = { ...defaultInputs, ...inputs };

  // Get source series
  const source = getSourceSeries(bars, src);
  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);

  // Calculate basis (moving average)
  const basis = useEMA ? ta.ema(source, length) : ta.sma(source, length);

  // Calculate range based on bands style
  let rangema: Series;
  switch (bandsStyle) {
    case 'True Range':
      rangema = ta.tr(bars, true); // True Range without averaging
      break;
    case 'Range':
      rangema = ta.rma(high.sub(low), length); // RMA of high-low range
      break;
    case 'Average True Range':
    default:
      rangema = ta.atr(bars, atrLength);
      break;
  }

  // Calculate upper and lower bands
  const upper = basis.add(rangema.mul(mult));
  const lower = basis.sub(rangema.mul(mult));

  // Convert to plot format - order: Upper, Basis, Lower (matching CSV)
  const upperData = upper.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const basisData = basis.toArray().map((value, i) => ({
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
      'plot0': upperData,
      'plot1': basisData,
      'plot2': lowerData,
    },
  };
}

/**
 * Keltner Channels indicator module
 */
export const KeltnerChannels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
