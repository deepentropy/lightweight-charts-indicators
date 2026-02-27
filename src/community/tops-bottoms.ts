/**
 * Tops/Bottoms
 *
 * Swing high/low detection using pivot points.
 * Plots horizontal lines at last detected top and bottom levels.
 *
 * Reference: TradingView "Tops/Bottoms" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TopsBottomsInputs {
  length: number;
  bull: number;
  bear: number;
}

export const defaultInputs: TopsBottomsInputs = {
  length: 5,
  bull: -0.51,
  bear: 0.43,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 5, min: 1 },
  { id: 'bull', type: 'float', title: 'Bullish', defval: -0.51, step: 0.01 },
  { id: 'bear', type: 'float', title: 'Bearish', defval: 0.43, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Top Level', color: '#EF5350', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Bottom Level', color: '#26A69A', lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Tops/Bottoms',
  shortTitle: 'TB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TopsBottomsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, bull, bear } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const pivotHighs = ta.pivothigh(highSeries, length, length);
  const pivotLows = ta.pivotlow(lowSeries, length, length);

  const phArr = pivotHighs.toArray();
  const plArr = pivotLows.toArray();

  let lastTop = NaN;
  let lastBottom = NaN;
  const markers: MarkerData[] = [];

  const topData: { time: number; value: number }[] = [];
  const bottomData: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) {
      lastTop = phArr[i]!;
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Top' });
    }
    if (plArr[i] != null && !isNaN(plArr[i]!)) {
      lastBottom = plArr[i]!;
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bot' });
    }
    topData.push({ time: bars[i].time, value: lastTop });
    bottomData.push({ time: bars[i].time, value: lastBottom });
  }

  // Pine CVI strong signal detection: cvi = (close - ValC) / (vol * sqrt(length))
  // bull1 = cvi <= bull, bear1 = cvi >= bear
  // bull2 = bull1[1] and not bull1 (exit from bullish zone), bear2 = bear1[1] and not bear1
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const valC = ta.sma(hl2Series, length).toArray();
  const atrArr = ta.atr(bars, length).toArray();
  const volArr = ta.sma(new Series(bars, (_b, i) => atrArr[i] ?? NaN), length).toArray();
  const sqrtLen = Math.sqrt(length);

  let prevBull1 = false;
  let prevBear1 = false;
  for (let i = length; i < n; i++) {
    const v = volArr[i];
    if (v == null || isNaN(v) || v === 0) continue;
    const cvi = (bars[i].close - (valC[i] ?? 0)) / (v * sqrtLen);
    const bull1 = cvi <= bull;
    const bear1 = cvi >= bear;
    // Strong bullish signal: was in bull zone, now exited
    if (prevBull1 && !bull1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: '#00E676', text: '*' });
    }
    // Strong bearish signal: was in bear zone, now exited
    if (prevBear1 && !bear1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: '#EF5350', text: '*' });
    }
    prevBull1 = bull1;
    prevBear1 = bear1;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': topData, 'plot1': bottomData },
    hlines: [
      { value: bull, options: { color: '#4CAF50', linestyle: 'solid' as const, title: 'Bullish' } },
      { value: bear, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Bearish' } },
    ],
    markers,
  };
}

export const TopsBottoms = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
