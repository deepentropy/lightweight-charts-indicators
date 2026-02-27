/**
 * Ehlers Instantaneous Trend
 *
 * John Ehlers' adaptive trend filter using a 2nd-order IIR filter.
 * IT[i] = (a - a²/4)*src + 0.5*a²*src[1] - (a - 0.75*a²)*src[2] + 2*(1-a)*IT[1] - (1-a)²*IT[2]
 * Lag = 2*IT - IT[2]
 *
 * Reference: TradingView "Ehlers Instantaneous Trend [LazyBear]"
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface EhlersInstantaneousTrendInputs {
  alpha: number;
  colorBars: boolean;
}

export const defaultInputs: EhlersInstantaneousTrendInputs = {
  alpha: 0.07,
  colorBars: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'alpha', type: 'float', title: 'Alpha', defval: 0.07, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trigger', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'ITrend', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Ehlers Instantaneous Trend',
  shortTitle: 'EIT',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EhlersInstantaneousTrendInputs> = {}): IndicatorResult {
  const { alpha, colorBars } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const a = alpha;

  const srcArr = getSourceSeries(bars, 'hl2').toArray();
  const it: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s0 = srcArr[i] ?? 0;
    const s1 = i > 0 ? (srcArr[i - 1] ?? 0) : s0;
    const s2 = i > 1 ? (srcArr[i - 2] ?? 0) : s0;

    if (i < 7) {
      // Warmup: simple average
      it[i] = (s0 + 2 * s1 + s2) / 4;
    } else {
      it[i] = (a - (a * a / 4)) * s0
        + 0.5 * a * a * s1
        - (a - 0.75 * a * a) * s2
        + 2 * (1 - a) * it[i - 1]
        - (1 - a) * (1 - a) * it[i - 2];
    }
  }

  const warmup = 7;
  const barColors: BarColorData[] = [];

  const lagPlot = it.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const lag = 2 * v - (i >= 2 ? it[i - 2] : v);
    const bullish = lag > v;
    const color = bullish ? '#26A69A' : '#EF5350';
    if (colorBars) barColors.push({ time: bars[i].time as number, color });
    return { time: bars[i].time, value: lag, color };
  });

  const itPlot = it.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const lag = 2 * v - (i >= 2 ? it[i - 2] : v);
    const color = lag > v ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const fillColors = bars.map((_, i) => {
    if (i < warmup) return 'transparent';
    const lag = 2 * it[i] - (i >= 2 ? it[i - 2] : it[i]);
    return lag > it[i] ? 'rgba(0,128,0,0.15)' : 'rgba(255,0,0,0.15)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': lagPlot, 'plot1': itPlot },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,128,0,0.15)' }, colors: fillColors },
    ],
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const EhlersInstantaneousTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
