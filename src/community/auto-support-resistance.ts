/**
 * Automatic Support & Resistance by getmohsin.py
 *
 * Pine: overlay=true, 8 plots from pivot analysis:
 *   level1/level2 = quick pivot high/low (valuewhen occurrence 0)
 *   level3/level4 = regular pivot high/low (valuewhen occurrence 0)
 *   level5/level6 = regular pivot high/low (valuewhen occurrence 1)
 *   level7/level8 = regular pivot high/low (valuewhen occurrence 2)
 * Each plot colored green when close >= level, red otherwise.
 *
 * Reference: TradingView "Automatic Support & Resistance by getmohsin.py" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoSupportResistanceInputs {
  left: number;
  right: number;
  quickRight: number;
}

export const defaultInputs: AutoSupportResistanceInputs = {
  left: 50,
  right: 25,
  quickRight: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'left', type: 'int', title: 'Left Bars', defval: 50, min: 1 },
  { id: 'right', type: 'int', title: 'Right Bars', defval: 25, min: 1 },
  { id: 'quickRight', type: 'int', title: 'Quick Right', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'level1', title: 'Quick Res', color: '#26A69A', lineWidth: 1 },
  { id: 'level2', title: 'Quick Sup', color: '#26A69A', lineWidth: 1 },
  { id: 'level3', title: 'Res 1', color: '#26A69A', lineWidth: 1 },
  { id: 'level4', title: 'Sup 1', color: '#26A69A', lineWidth: 1 },
  { id: 'level5', title: 'Res 2', color: '#26A69A', lineWidth: 1 },
  { id: 'level6', title: 'Sup 2', color: '#26A69A', lineWidth: 1 },
  { id: 'level7', title: 'Res 3', color: '#26A69A', lineWidth: 1 },
  { id: 'level8', title: 'Sup 3', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Automatic Support & Resistance',
  shortTitle: 'Auto S/R',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AutoSupportResistanceInputs> = {}): IndicatorResult {
  const { left, right, quickRight } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Pine uses close source for pivots (default "Close")
  const closeSeries = new Series(bars, (b) => b.close);

  // Compute pivot highs and lows
  const pivotHighArr = ta.pivothigh(closeSeries, left, right).toArray();
  const pivotLowArr = ta.pivotlow(closeSeries, left, right).toArray();
  const quickPivotHighArr = ta.pivothigh(closeSeries, left, quickRight).toArray();
  const quickPivotLowArr = ta.pivotlow(closeSeries, left, quickRight).toArray();

  // Manual valuewhen implementation: when condition is true, capture source value
  // valuewhen(cond, src[offset], occurrence)
  // For quick pivots: src is close[quickRight], for regular pivots: src is close[right]
  function computeValuewhen(pivotArr: number[], offset: number, occurrence: number): number[] {
    const result = new Array(n).fill(NaN);
    // Track historical pivot values
    const found: number[] = [];
    for (let i = 0; i < n; i++) {
      // pivothigh/pivotlow returns the pivot value at the bar where it's confirmed
      // The actual pivot happened `offset` bars ago
      if (!isNaN(pivotArr[i]) && pivotArr[i] !== 0) {
        // The value at the pivot bar is close[i - offset] (but the pivot detection already
        // returns at bar i, meaning the pivot was at bar i-offset)
        const srcIdx = i - offset;
        if (srcIdx >= 0) {
          found.unshift(bars[srcIdx].close);
        }
      }
      if (found.length > occurrence) {
        result[i] = found[occurrence];
      }
    }
    return result;
  }

  // level1 = valuewhen(quick_pivot_high, close[quick_right], 0)
  const level1Arr = computeValuewhen(quickPivotHighArr, quickRight, 0);
  // level2 = valuewhen(quick_pivot_lows, close[quick_right], 0)
  const level2Arr = computeValuewhen(quickPivotLowArr, quickRight, 0);
  // level3 = valuewhen(pivot_high, close[right], 0)
  const level3Arr = computeValuewhen(pivotHighArr, right, 0);
  // level4 = valuewhen(pivot_lows, close[right], 0)
  const level4Arr = computeValuewhen(pivotLowArr, right, 0);
  // level5 = valuewhen(pivot_high, close[right], 1)
  const level5Arr = computeValuewhen(pivotHighArr, right, 1);
  // level6 = valuewhen(pivot_lows, close[right], 1)
  const level6Arr = computeValuewhen(pivotLowArr, right, 1);
  // level7 = valuewhen(pivot_high, close[right], 2)
  const level7Arr = computeValuewhen(pivotHighArr, right, 2);
  // level8 = valuewhen(pivot_lows, close[right], 2)
  const level8Arr = computeValuewhen(pivotLowArr, right, 2);

  const GREEN = '#26A69A';
  const RED = '#EF5350';

  function makePlot(levelArr: number[]): { time: number; value: number; color?: string }[] {
    return levelArr.map((v, i) => ({
      time: bars[i].time,
      value: isNaN(v) ? NaN : v,
      color: !isNaN(v) ? (bars[i].close >= v ? GREEN : RED) : undefined,
    }));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      level1: makePlot(level1Arr),
      level2: makePlot(level2Arr),
      level3: makePlot(level3Arr),
      level4: makePlot(level4Arr),
      level5: makePlot(level5Arr),
      level6: makePlot(level6Arr),
      level7: makePlot(level7Arr),
      level8: makePlot(level8Arr),
    },
  };
}

export const AutoSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
