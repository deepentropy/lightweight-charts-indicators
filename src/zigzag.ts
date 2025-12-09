/**
 * Zig Zag Indicator
 *
 * Identifies trend reversals by connecting pivot highs and lows
 * that exceed a specified percentage deviation threshold.
 *
 * Based on TradingView's ZigZag indicator v8.
 */

import {
  calculateZigZag,
  type ZigZagSettings,
  type ZigZagPivot,
  type IndicatorResult,
  type Bar,
} from 'oakscriptjs';

import type { InputConfig, PlotConfig } from './index.js';

/**
 * ZigZag indicator input parameters
 */
export interface ZigZagInputs {
  /** Minimum percentage deviation for reversal (default: 5.0) */
  deviation: number;
  /** Number of bars for pivot point detection (default: 10) */
  depth: number;
  /** Extend line from last pivot to current bar */
  extendLast: boolean;
}

/**
 * Extended result with pivot data
 */
export interface ZigZagResult extends IndicatorResult {
  /** Raw pivot data for advanced consumers */
  pivots: ZigZagPivot[];
  /** Extension line to current bar (if extendLast enabled) */
  extension: ZigZagPivot | null;
}

/**
 * Default input values
 */
export const defaultInputs: ZigZagInputs = {
  deviation: 5.0,
  depth: 10,
  extendLast: true,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'deviation', type: 'float', title: 'Price deviation for reversals (%)', defval: 5.0, min: 0.00001, max: 100 },
  { id: 'depth', type: 'int', title: 'Pivot legs', defval: 10, min: 2 },
  { id: 'extendLast', type: 'bool', title: 'Extend to last bar', defval: true },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zig Zag', color: '#2962FF', lineWidth: 2 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Zig Zag',
  shortTitle: 'ZigZag',
  overlay: true,
};

/**
 * Calculate ZigZag indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data and raw pivot information
 */
export function calculate(bars: Bar[], inputs: Partial<ZigZagInputs> = {}): ZigZagResult {
  const opts = { ...defaultInputs, ...inputs };

  if (bars.length === 0) {
    return {
      metadata: {
        title: metadata.title,
        shorttitle: metadata.shortTitle,
        overlay: metadata.overlay,
      },
      plots: {
        'plot0': [],
      },
      pivots: [],
      extension: null,
    };
  }

  const settings: Partial<ZigZagSettings> = {
    devThreshold: opts.deviation,
    depth: opts.depth,
    extendLast: opts.extendLast,
  };

  const result = calculateZigZag(bars, settings);

  // Convert pivots to plot data (NaN except at pivot points)
  // Chart libraries will connect non-NaN points with lines
  const plotData = bars.map((bar) => ({
    time: bar.time,
    value: NaN,
  }));

  // Mark pivot points
  for (const pivot of result.pivots) {
    const idx = pivot.end.barIndex;
    if (idx >= 0 && idx < plotData.length) {
      plotData[idx].value = pivot.end.price;
    }
  }

  // Include extension point if present
  if (result.extension) {
    const extIdx = result.extension.end.barIndex;
    if (extIdx >= 0 && extIdx < plotData.length) {
      plotData[extIdx].value = result.extension.end.price;
    }
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
    // Expose raw pivot data for advanced consumers
    pivots: result.pivots,
    extension: result.extension,
  };
}

/**
 * ZigZag indicator module
 */
export const ZigZag = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
