/**
 * Auto Key Levels
 *
 * Automatically marks recent horizontal support/resistance levels from confirmed
 * pivot highs and lows. Each retained level is drawn as a horizontal ray that
 * extends to the right from the pivot that formed it.
 *
 * Approximation of TradingView's built-in "Auto Key Levels" (STD;Auto_Key_Levels),
 * which uses a proprietary level-selection/merging scheme. Here we keep the most
 * recent `maxLevels` confirmed pivots (pivot highs = resistance, lows = support).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, LabelData } from '../types';

export interface AutoKeyLevelsInputs {
  /** Bars on each side required to confirm a pivot */
  pivotLength: number;
  /** Max number of levels to keep */
  maxLevels: number;
}

export const defaultInputs: AutoKeyLevelsInputs = {
  pivotLength: 20,
  maxLevels: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 20, min: 1 },
  { id: 'maxLevels', type: 'int', title: 'Max Levels', defval: 6, min: 1, max: 50 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Key Levels',
  shortTitle: 'Key Levels',
  overlay: true,
};

const RESISTANCE = '#F23645';
const SUPPORT = '#089981';

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoKeyLevelsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] } {
  const { pivotLength: p, maxLevels } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  interface Pivot { barIndex: number; price: number; kind: 'high' | 'low'; }
  const pivots: Pivot[] = [];

  for (let i = p; i < n - p; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= p; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ barIndex: i, price: bars[i].high, kind: 'high' });
    if (isLow) pivots.push({ barIndex: i, price: bars[i].low, kind: 'low' });
  }

  // Keep the most recent `maxLevels` pivots.
  const kept = pivots.slice(-maxLevels);
  const lastTime = n > 0 ? bars[n - 1].time : 0;

  const lines: LineDrawingData[] = kept.map((pv) => ({
    time1: bars[pv.barIndex].time,
    price1: pv.price,
    time2: lastTime,
    price2: pv.price,
    color: pv.kind === 'high' ? RESISTANCE : SUPPORT,
    width: 1,
    style: 'dashed',
    extend: 'right',
  }));

  const labels: LabelData[] = kept.map((pv) => ({
    time: lastTime,
    price: pv.price,
    text: pv.price.toFixed(2),
    textColor: pv.kind === 'high' ? RESISTANCE : SUPPORT,
    style: 'label_left',
    size: 'small',
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {},
    lines,
    labels,
  };
}

export const AutoKeyLevels = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
