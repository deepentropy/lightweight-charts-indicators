/**
 * Custom Donchian Channels
 *
 * Donchian channels with midline. Upper = highest high, Lower = lowest low,
 * Mid = (upper + lower) / 2.
 *
 * Reference: TradingView "Custom Donchian Channels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DonchianCustomInputs {
  upperLen: number;
  lowerLen: number;
}

export const defaultInputs: DonchianCustomInputs = {
  upperLen: 20,
  lowerLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'upperLen', type: 'int', title: 'Upper Length', defval: 20, min: 1 },
  { id: 'lowerLen', type: 'int', title: 'Lower Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Mid', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Custom Donchian Channels',
  shortTitle: 'DonchianC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DonchianCustomInputs> = {}): IndicatorResult {
  const { upperLen, lowerLen } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const upperArr = ta.highest(highSeries, upperLen).toArray();
  const lowerArr = ta.lowest(lowSeries, lowerLen).toArray();

  const warmup = Math.max(upperLen, lowerLen);

  const upperPlot = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const lowerPlot = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const midPlot = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) || isNaN(lowerArr[i]) ? NaN : (v + lowerArr[i]) / 2,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': upperPlot, 'plot1': lowerPlot, 'plot2': midPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(41,98,255,0.06)' } }],
  };
}

export const DonchianCustom = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
