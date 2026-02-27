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

  // Pine default source is "Close" for pivots
  const closeSeries = new Series(bars, (b) => b.close);

  // Compute pivot highs and lows
  const pivotHighArr = ta.pivothigh(closeSeries, left, right).toArray();
  const pivotLowArr = ta.pivotlow(closeSeries, left, right).toArray();
  const quickPivotHighArr = ta.pivothigh(closeSeries, left, quickRight).toArray();
  const quickPivotLowArr = ta.pivotlow(closeSeries, left, quickRight).toArray();

  // Convert pivot arrays to boolean condition Series (1 where pivot found, 0 otherwise).
  // oakscriptjs pivothigh/pivotlow place the pivot value at the actual pivot bar,
  // so the close at that bar IS the pivot source value -- no offset needed.
  const toBoolSeries = (arr: number[]) =>
    Series.fromArray(bars, arr.map(v => isNaN(v) ? 0 : 1));

  const pivotHighCond = toBoolSeries(pivotHighArr);
  const pivotLowCond = toBoolSeries(pivotLowArr);
  const quickPivotHighCond = toBoolSeries(quickPivotHighArr);
  const quickPivotLowCond = toBoolSeries(quickPivotLowArr);

  // Pine: valuewhen(pivot_cond, close[offset], occurrence)
  // In Pine, pivot fires at the confirmation bar (offset bars after pivot).
  // close[offset] at the confirmation bar = close at the actual pivot bar.
  // In oakscriptjs, pivot fires at the actual pivot bar, so source is just closeSeries.
  const level1Arr = ta.valuewhen(quickPivotHighCond, closeSeries, 0).toArray();
  const level2Arr = ta.valuewhen(quickPivotLowCond, closeSeries, 0).toArray();
  const level3Arr = ta.valuewhen(pivotHighCond, closeSeries, 0).toArray();
  const level4Arr = ta.valuewhen(pivotLowCond, closeSeries, 0).toArray();
  const level5Arr = ta.valuewhen(pivotHighCond, closeSeries, 1).toArray();
  const level6Arr = ta.valuewhen(pivotLowCond, closeSeries, 1).toArray();
  const level7Arr = ta.valuewhen(pivotHighCond, closeSeries, 2).toArray();
  const level8Arr = ta.valuewhen(pivotLowCond, closeSeries, 2).toArray();

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
