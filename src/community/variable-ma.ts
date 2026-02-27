/**
 * Variable Moving Average (VMA) [LazyBear] / Chande VMA
 *
 * Adaptive moving average that adjusts its smoothing based on directional
 * movement index. Faster when trending, slower when ranging.
 *
 * Reference: TradingView "Variable Moving Average" by LazyBear
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface VariableMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: VariableMAInputs = {
  length: 6,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 6, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Variable Moving Average',
  shortTitle: 'VMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VariableMAInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length, src } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, src).toArray();

  const k = 2 / (length + 1);
  const invLen = 1 / length;

  const vmaArr: number[] = new Array(bars.length);
  let pdmS = 0;
  let mdmS = 0;
  let prevVMA = 0;

  for (let i = 0; i < bars.length; i++) {
    const s = sourceArr[i] ?? 0;
    const sPrev = i > 0 ? (sourceArr[i - 1] ?? 0) : s;

    const pdm = Math.max(s - sPrev, 0);
    const mdm = Math.max(sPrev - s, 0);

    if (i === 0) {
      pdmS = pdm;
      mdmS = mdm;
      prevVMA = s;
      vmaArr[i] = s;
      continue;
    }

    pdmS = pdmS * (1 - invLen) + pdm * invLen;
    mdmS = mdmS * (1 - invLen) + mdm * invLen;

    const sumDM = pdmS + mdmS;
    const pdi = sumDM !== 0 ? pdmS / sumDM : 0;
    const mdi = sumDM !== 0 ? mdmS / sumDM : 0;
    const sumDI = pdi + mdi;
    const vI = sumDI !== 0 ? Math.abs(pdi - mdi) / sumDI : 0;

    const vma = k * vI * s + (1 - k * vI) * prevVMA;
    vmaArr[i] = vma;
    prevVMA = vma;
  }

  const warmup = length * 3;

  const plot0 = vmaArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const prev = vmaArr[i - 1];
    let color: string;
    if (v > prev) color = '#26A69A';
    else if (v < prev) color = '#EF5350';
    else color = '#9C27B0';
    return { time: bars[i].time, value: v, color };
  });

  // barcolor: matches VMA line color - green when rising, red when falling, blue when flat
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const v = vmaArr[i];
    const prev = vmaArr[i - 1];
    if (v > prev) barColors.push({ time: bars[i].time, color: '#26A69A' });
    else if (v < prev) barColors.push({ time: bars[i].time, color: '#EF5350' });
    else barColors.push({ time: bars[i].time, color: '#2196F3' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    barColors,
  };
}

export const VariableMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
