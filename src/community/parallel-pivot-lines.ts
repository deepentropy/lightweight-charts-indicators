/**
 * Parallel Pivot Lines
 *
 * Pivot-based parallel lines. Calculates a central pivot from last swing high/low,
 * then derives R1, R2, S1, S2 from the swing range.
 *
 * Reference: TradingView "Parallel Pivot Lines" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ParallelPivotLinesInputs {
  pivotLen: number;
}

export const defaultInputs: ParallelPivotLinesInputs = {
  pivotLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'R1', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'S1', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'R2', color: '#EF5350', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'S2', color: '#26A69A', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Parallel Pivot Lines',
  shortTitle: 'PPL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ParallelPivotLinesInputs> = {}): IndicatorResult {
  const { pivotLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, pivotLen, pivotLen).toArray();
  const plArr = ta.pivotlow(lowSeries, pivotLen, pivotLen).toArray();

  const warmup = pivotLen * 2;
  let lastPH = NaN;
  let lastPL = NaN;

  const pivotPlot: { time: number; value: number }[] = [];
  const r1Plot: { time: number; value: number }[] = [];
  const s1Plot: { time: number; value: number }[] = [];
  const r2Plot: { time: number; value: number }[] = [];
  const s2Plot: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (i >= warmup && !isNaN(phArr[i]) && phArr[i] !== 0) {
      lastPH = phArr[i];
    }
    if (i >= warmup && !isNaN(plArr[i]) && plArr[i] !== 0) {
      lastPL = plArr[i];
    }

    if (i < warmup || isNaN(lastPH) || isNaN(lastPL)) {
      pivotPlot.push({ time: bars[i].time, value: NaN });
      r1Plot.push({ time: bars[i].time, value: NaN });
      s1Plot.push({ time: bars[i].time, value: NaN });
      r2Plot.push({ time: bars[i].time, value: NaN });
      s2Plot.push({ time: bars[i].time, value: NaN });
    } else {
      const central = (lastPH + lastPL) / 2;
      const range = lastPH - lastPL;
      pivotPlot.push({ time: bars[i].time, value: central });
      r1Plot.push({ time: bars[i].time, value: central + range });
      s1Plot.push({ time: bars[i].time, value: central - range });
      r2Plot.push({ time: bars[i].time, value: central + 2 * range });
      s2Plot.push({ time: bars[i].time, value: central - 2 * range });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': pivotPlot, 'plot1': r1Plot, 'plot2': s1Plot, 'plot3': r2Plot, 'plot4': s2Plot },
  };
}

export const ParallelPivotLines = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
