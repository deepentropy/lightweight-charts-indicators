/**
 * Coral Trend Indicator
 *
 * 6 cascaded EMA filters combined with polynomial coefficients.
 * bfr = -cd^3*i6 + c3*i5 + c4*i4 + c5*i3
 *
 * Reference: TradingView "Coral Trend Indicator" by LazyBear
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';

export interface CoralTrendInputs {
  smoothingPeriod: number;
  constantD: number;
  src: SourceType;
  enableBarColor: boolean;
  ribbonMode: boolean;
}

export const defaultInputs: CoralTrendInputs = {
  smoothingPeriod: 21,
  constantD: 0.4,
  src: 'close',
  enableBarColor: false,
  ribbonMode: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 21, min: 1 },
  { id: 'constantD', type: 'float', title: 'Constant D', defval: 0.4, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'enableBarColor', type: 'bool', title: 'Enable Bar Color', defval: false },
  { id: 'ribbonMode', type: 'bool', title: 'Ribbon Mode', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Coral Trend', color: '#2962FF', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Coral Trend',
  shortTitle: 'Coral',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CoralTrendInputs> = {}): IndicatorResult {
  const { smoothingPeriod, constantD, src, enableBarColor, ribbonMode } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, src).toArray();

  const cd = constantD;
  const di = (smoothingPeriod - 1.0) / 2.0 + 1.0;
  const c1 = 2 / (di + 1.0);
  const c2 = 1 - c1;
  const c3 = 3.0 * (cd * cd + cd * cd * cd);
  const c4 = -3.0 * (2.0 * cd * cd + cd + cd * cd * cd);
  const c5 = 3.0 * cd + 1.0 + cd * cd * cd + 3.0 * cd * cd;

  let i1 = 0, i2 = 0, i3 = 0, i4 = 0, i5 = 0, i6 = 0;
  const bfrArr: number[] = [];

  for (let idx = 0; idx < bars.length; idx++) {
    const s = sourceArr[idx] ?? 0;
    i1 = c1 * s + c2 * i1;
    i2 = c1 * i1 + c2 * i2;
    i3 = c1 * i2 + c2 * i3;
    i4 = c1 * i3 + c2 * i4;
    i5 = c1 * i4 + c2 * i5;
    i6 = c1 * i5 + c2 * i6;

    const bfr = -cd * cd * cd * i6 + c3 * i5 + c4 * i4 + c5 * i3;
    bfrArr.push(bfr);
  }

  // Warm-up: roughly smoothingPeriod bars for the cascaded filters to settle
  const warmup = smoothingPeriod;
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const data = bfrArr.map((value, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? bfrArr[i - 1] : value;
    const color = value > prev ? '#26A69A' : value < prev ? '#EF5350' : '#2962FF';
    if (enableBarColor) barColors.push({ time: bars[i].time as number, color });
    if (ribbonMode) bgColors.push({ time: bars[i].time as number, color: value > prev ? 'rgba(38,166,154,0.15)' : value < prev ? 'rgba(239,83,80,0.15)' : 'rgba(41,98,255,0.15)' });
    return { time: bars[i].time, value, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
    barColors,
    bgColors,
  } as IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const CoralTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
