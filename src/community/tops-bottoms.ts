/**
 * Tops/Bottoms
 *
 * CVI-based overbought/oversold detection.
 * Plots constant bull/bear threshold lines and star markers
 * when price exits the bull or bear zone.
 *
 * CVI = (close - SMA(hl2, length)) / (SMA(ATR(length), length) * sqrt(length))
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
  length: 3,
  bull: -0.51,
  bear: 0.43,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 3, min: 1 },
  { id: 'bull', type: 'float', title: 'Bullish', defval: -0.51, step: 0.01 },
  { id: 'bear', type: 'float', title: 'Bearish', defval: 0.43, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: 'Bearish', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Tops/Bottoms',
  shortTitle: 'TB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TopsBottomsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, bull, bear } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const markers: MarkerData[] = [];

  // Pine: ValC = sma(hl2, length)
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const valC = ta.sma(hl2Series, length).toArray();

  // Pine: vol = sma(atr(length), length)
  const atrArr = ta.atr(bars, length).toArray();
  const volArr = ta.sma(new Series(bars, (_b, i) => atrArr[i] ?? NaN), length).toArray();
  const sqrtLen = Math.sqrt(length);

  // Pine: plot(bull, color=green) and plot(bear, color=red) -- constant threshold lines
  const bullLine: { time: number; value: number }[] = [];
  const bearLine: { time: number; value: number }[] = [];

  let prevBull1 = false;
  let prevBear1 = false;

  for (let i = 0; i < n; i++) {
    bullLine.push({ time: bars[i].time, value: bull });
    bearLine.push({ time: bars[i].time, value: bear });

    const v = volArr[i];
    if (v == null || isNaN(v) || v === 0) continue;
    const vc = valC[i];
    if (vc == null || isNaN(vc)) continue;

    // Pine: cvi = (close - ValC) / (vol * sqrt(length))
    const cvi = (bars[i].close - vc) / (v * sqrtLen);
    const bull1 = cvi <= bull;
    const bear1 = cvi >= bear;

    // Pine: bull2 = bull1[1] and not bull1 (exited bullish zone)
    if (prevBull1 && !bull1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: '#00E676', text: '*' });
    }
    // Pine: bear2 = bear1[1] and not bear1 (exited bearish zone)
    if (prevBear1 && !bear1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: '#EF5350', text: '*' });
    }

    prevBull1 = bull1;
    prevBear1 = bear1;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': bullLine, 'plot1': bearLine },
    markers,
  };
}

export const TopsBottoms = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
