/**
 * Automatic Support & Resistance
 *
 * Auto-detected support and resistance using highest/lowest over a lookback period.
 * Resistance = highest high, Support = lowest low.
 *
 * Reference: TradingView "Automatic Support & Resistance" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoSupportResistanceInputs {
  length: number;
}

export const defaultInputs: AutoSupportResistanceInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Automatic Support & Resistance',
  shortTitle: 'Auto S/R',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AutoSupportResistanceInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const resistanceArr = ta.highest(highSeries, length).toArray();
  const supportArr = ta.lowest(lowSeries, length).toArray();

  const warmup = length;

  const plot0 = resistanceArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const plot1 = supportArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const AutoSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
