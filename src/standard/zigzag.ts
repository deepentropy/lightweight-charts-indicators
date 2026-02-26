/**
 * Zig Zag Indicator
 *
 * Identifies trend reversals by connecting pivot highs and lows
 * that exceed a specified percentage deviation threshold.
 *
 * Based on TradingView's ZigZag indicator v8.
 *
 * PineScript display:
 *   line.new(x1, y1, x2, y2, color=lineColorInput)
 *   label.new(x, y, text, style=label.style_label_down/up)
 */

import {
  calculateZigZag,
  type ZigZagSettings,
  type ZigZagPivot,
  type IndicatorResult,
  type Bar,
} from 'oakscriptjs';

import type { InputConfig, PlotConfig } from 'oakscriptjs';
import type { LineDrawingData, LabelData } from '../types';

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
  /** Display reversal price */
  showPrice: boolean;
  /** Display price change */
  showChange: boolean;
}

/**
 * Extended result with pivot data
 */
export interface ZigZagResult extends IndicatorResult {
  /** Raw pivot data for advanced consumers */
  pivots: ZigZagPivot[];
  /** Extension line to current bar (if extendLast enabled) */
  extension: ZigZagPivot | null;
  /** Line drawings connecting pivots */
  lines: LineDrawingData[];
  /** Labels at pivot points */
  labels: LabelData[];
}

/**
 * Default input values
 */
export const defaultInputs: ZigZagInputs = {
  deviation: 5.0,
  depth: 10,
  extendLast: true,
  showPrice: true,
  showChange: true,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'deviation', type: 'float', title: 'Price deviation for reversals (%)', defval: 5.0, min: 0.00001, max: 100 },
  { id: 'depth', type: 'int', title: 'Pivot legs', defval: 10, min: 2 },
  { id: 'extendLast', type: 'bool', title: 'Extend to last bar', defval: true },
  { id: 'showPrice', type: 'bool', title: 'Display reversal price', defval: true },
  { id: 'showChange', type: 'bool', title: 'Display reversal price change', defval: true },
];

// No line plots — rendered via lines and labels
export const plotConfig: PlotConfig[] = [];

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
 */
export function calculate(bars: Bar[], inputs: Partial<ZigZagInputs> = {}): ZigZagResult {
  const opts = { ...defaultInputs, ...inputs };

  if (bars.length === 0) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      pivots: [],
      extension: null,
      lines: [],
      labels: [],
    };
  }

  const settings: Partial<ZigZagSettings> = {
    devThreshold: opts.deviation,
    depth: opts.depth,
    extendLast: opts.extendLast,
  };

  const result = calculateZigZag(bars, settings);
  const lineColor = '#2962FF';

  // Build line segments between consecutive pivots
  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  const allPivots = [...result.pivots];
  if (result.extension) {
    allPivots.push(result.extension);
  }

  for (let i = 1; i < allPivots.length; i++) {
    const prev = allPivots[i - 1];
    const curr = allPivots[i];

    lines.push({
      time1: bars[prev.end.barIndex].time as number,
      price1: prev.end.price,
      time2: bars[curr.end.barIndex].time as number,
      price2: curr.end.price,
      color: lineColor,
      width: 2,
      style: 'solid',
    });
  }

  // Build labels at pivot points
  if (opts.showPrice || opts.showChange) {
    for (let i = 0; i < allPivots.length; i++) {
      const pivot = allPivots[i];
      const isHigh = pivot.end.price > (i > 0 ? allPivots[i - 1].end.price : pivot.end.price);

      let text = '';
      if (opts.showPrice) {
        text += pivot.end.price.toFixed(2);
      }
      if (opts.showChange && i > 0) {
        const prevPrice = allPivots[i - 1].end.price;
        const change = pivot.end.price - prevPrice;
        const pctChange = (change / prevPrice) * 100;
        const sign = change >= 0 ? '+' : '';
        text += `\n(${sign}${change.toFixed(2)}, ${sign}${pctChange.toFixed(2)}%)`;
      }

      if (text) {
        labels.push({
          time: bars[pivot.end.barIndex].time as number,
          price: pivot.end.price,
          text: text.trim(),
          color: lineColor,
          textColor: '#FFFFFF',
          style: isHigh ? 'label_down' : 'label_up',
          size: 'small',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    pivots: result.pivots,
    extension: result.extension,
    lines,
    labels,
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
