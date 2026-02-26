/**
 * [RS] Support and Resistance V0
 *
 * Pivot-based support and resistance levels.
 * Uses ta.pivothigh/pivotlow to detect swing highs/lows,
 * then extends the last detected levels horizontally.
 *
 * Reference: TradingView "[RS]Support and Resistance V0" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RSSupportResistanceInputs {
  leftBars: number;
  rightBars: number;
}

export const defaultInputs: RSSupportResistanceInputs = {
  leftBars: 10,
  rightBars: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 10, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: '[RS] Support and Resistance V0',
  shortTitle: 'RS S/R',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RSSupportResistanceInputs> = {}): IndicatorResult {
  const { leftBars, rightBars } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  const warmup = leftBars + rightBars;
  let lastResistance = NaN;
  let lastSupport = NaN;

  const resistancePlot = [];
  const supportPlot = [];

  for (let i = 0; i < n; i++) {
    if (i >= warmup && !isNaN(phArr[i]) && phArr[i] !== 0) {
      lastResistance = phArr[i];
    }
    if (i >= warmup && !isNaN(plArr[i]) && plArr[i] !== 0) {
      lastSupport = plArr[i];
    }
    resistancePlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastResistance });
    supportPlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastSupport });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': resistancePlot, 'plot1': supportPlot },
  };
}

export const RSSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
