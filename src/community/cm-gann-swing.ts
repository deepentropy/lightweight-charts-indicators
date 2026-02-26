/**
 * CM Gann Swing High Low V2
 *
 * Gann swing high/low detection. Tracks the highest high and lowest low
 * over a lookback period as step-style swing lines.
 *
 * Reference: TradingView "CM_Gann Swing High Low V2" by ChrisMoody (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMGannSwingInputs {
  length: number;
}

export const defaultInputs: CMGannSwingInputs = {
  length: 12,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 12, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Swing High', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Swing Low', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Gann Swing High Low V2',
  shortTitle: 'Gann Swing',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMGannSwingInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const highestArr = ta.highest(highSeries, length).toArray();
  const lowestArr = ta.lowest(lowSeries, length).toArray();

  // Track step-style swing levels that only update on new swings
  let swingHigh = NaN;
  let swingLow = NaN;

  const shPlot: { time: number; value: number }[] = [];
  const slPlot: { time: number; value: number }[] = [];

  const warmup = length;

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      shPlot.push({ time: bars[i].time, value: NaN });
      slPlot.push({ time: bars[i].time, value: NaN });
      continue;
    }

    const hh = highestArr[i];
    const ll = lowestArr[i];

    // Update swing high when bar high equals the highest high (new swing high)
    if (bars[i].high >= hh) {
      swingHigh = hh;
    }
    // Update swing low when bar low equals the lowest low (new swing low)
    if (bars[i].low <= ll) {
      swingLow = ll;
    }

    shPlot.push({ time: bars[i].time, value: swingHigh });
    slPlot.push({ time: bars[i].time, value: swingLow });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': shPlot, 'plot1': slPlot },
  };
}

export const CMGannSwing = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
