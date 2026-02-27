/**
 * AK TREND ID
 *
 * Trend identification using EMA spread oscillator.
 * bspread = (EMA(close,3) - EMA(close,8)) * 1.001
 * Plotted as non-overlay oscillator with zero line.
 * Bars colored green/red by spread sign.
 *
 * Reference: TradingView "AK_TREND ID (M)" by Algokid
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface AKTrendIDInputs {
  input1: number;
  input2: number;
  src: SourceType;
}

export const defaultInputs: AKTrendIDInputs = {
  input1: 3,
  input2: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'input1', type: 'int', title: 'Fast EMA', defval: 3, min: 1 },
  { id: 'input2', type: 'int', title: 'Slow EMA', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'plot1', title: 'Spread', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'AK TREND ID',
  shortTitle: 'AKTID',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AKTrendIDInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { input1, input2, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const fastArr = ta.ema(srcSeries, input1).toArray();
  const slowArr = ta.ema(srcSeries, input2).toArray();

  const warmup = Math.max(input1, input2);
  const barColors: BarColorData[] = [];

  const plot0 = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup ? NaN : 0,
  }));

  const plot1 = bars.map((b, i) => {
    const f = fastArr[i];
    const s = slowArr[i];
    if (i < warmup || f == null || s == null || isNaN(f) || isNaN(s)) {
      return { time: b.time, value: NaN };
    }
    const bspread = (f - s) * 1.001;
    return { time: b.time, value: bspread, color: bspread > 0 ? '#00FF00' : '#FF0000' };
  });

  for (let i = warmup; i < n; i++) {
    const f = fastArr[i];
    const s = slowArr[i];
    if (f != null && s != null) {
      const bspread = (f - s) * 1.001;
      barColors.push({ time: bars[i].time, color: bspread > 0 ? '#008000' : '#FF0000' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    barColors,
  };
}

export const AKTrendID = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
