/**
 * Ultimate RSI [LuxAlgo]
 *
 * Augmented RSI using highest/lowest range normalization.
 * diff = highest expanding ? +range : lowest expanding ? -range : close change.
 * arsi = ma(diff) / ma(abs(diff)) * 50 + 50.
 * Signal line is a smoothed MA of the arsi.
 *
 * Reference: TradingView "Ultimate RSI [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface UltimateRSIInputs {
  length: number;
  smoType1: 'EMA' | 'SMA' | 'RMA' | 'TMA';
  src: SourceType;
  smooth: number;
  smoType2: 'EMA' | 'SMA' | 'RMA' | 'TMA';
  obValue: number;
  osValue: number;
}

export const defaultInputs: UltimateRSIInputs = {
  length: 14,
  smoType1: 'RMA',
  src: 'close',
  smooth: 14,
  smoType2: 'EMA',
  obValue: 80,
  osValue: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'smoType1', type: 'string', title: 'Method', defval: 'RMA', options: ['EMA', 'SMA', 'RMA', 'TMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'smooth', type: 'int', title: 'Signal Length', defval: 14, min: 1 },
  { id: 'smoType2', type: 'string', title: 'Signal Method', defval: 'EMA', options: ['EMA', 'SMA', 'RMA', 'TMA'] },
  { id: 'obValue', type: 'float', title: 'Overbought', defval: 80, min: 50, max: 100 },
  { id: 'osValue', type: 'float', title: 'Oversold', defval: 20, min: 0, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ultimate RSI', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: '#ff5d00', lineWidth: 1 },
  { id: 'plot_up', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot_avg', title: 'Midline', color: 'transparent', lineWidth: 0 },
  { id: 'plot_dn', title: 'OS Level', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Ultimate RSI [LuxAlgo]',
  shortTitle: 'URSI',
  overlay: false,
};

function applyMA(series: Series, length: number, maType: string): Series {
  switch (maType) {
    case 'EMA': return ta.ema(series, length);
    case 'SMA': return ta.sma(series, length);
    case 'RMA': return ta.rma(series, length);
    case 'TMA': return ta.sma(ta.sma(series, length), length);
    default: return ta.rma(series, length);
  }
}

export function calculate(bars: Bar[], inputs: Partial<UltimateRSIInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { length, smoType1, src, smooth, smoType2, obValue, osValue } = { ...defaultInputs, ...inputs };
  const len = bars.length;

  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  // highest/lowest of source over length
  const upperArr = ta.highest(source, length).toArray();
  const lowerArr = ta.lowest(source, length).toArray();

  // Build diff array bar-by-bar
  const diffArr: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const upper = upperArr[i];
    const lower = lowerArr[i];
    const r = upper - lower;
    const d = i > 0 ? srcArr[i] - srcArr[i - 1] : 0;

    const prevUpper = i > 0 ? upperArr[i - 1] : NaN;
    const prevLower = i > 0 ? lowerArr[i - 1] : NaN;

    if (isNaN(upper) || isNaN(lower) || isNaN(prevUpper) || isNaN(prevLower)) {
      diffArr[i] = d;
    } else if (upper > prevUpper) {
      diffArr[i] = r;
    } else if (lower < prevLower) {
      diffArr[i] = -r;
    } else {
      diffArr[i] = d;
    }
  }

  // ma(diff, length) and ma(abs(diff), length)
  const diffSeries = Series.fromArray(bars, diffArr);
  const absDiffArr = diffArr.map((v) => Math.abs(v));
  const absDiffSeries = Series.fromArray(bars, absDiffArr);

  const numArr = applyMA(diffSeries, length, smoType1).toArray();
  const denArr = applyMA(absDiffSeries, length, smoType1).toArray();

  // arsi = num / den * 50 + 50
  const arsiArr: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const num = numArr[i];
    const den = denArr[i];
    if (isNaN(num) || isNaN(den) || den === 0) {
      arsiArr[i] = NaN;
    } else {
      arsiArr[i] = (num / den) * 50 + 50;
    }
  }

  // Signal line
  const arsiSeries = Series.fromArray(bars, arsiArr);
  const signalArr = applyMA(arsiSeries, smooth, smoType2).toArray();

  const warmup = length + (smoType1 === 'TMA' ? length : 0);

  const plot0 = arsiArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = v > obValue ? '#089981' : v < osValue ? '#f23645' : '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  const signalWarmup = warmup + smooth + (smoType2 === 'TMA' ? smooth : 0);
  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < signalWarmup || isNaN(v)) ? NaN : v,
  }));

  // Hidden level plots for fill references
  const plot_up = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : obValue }));
  const plot_avg = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : 50 }));
  const plot_dn = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : osValue }));

  // Fill: RSI to OB line when RSI > OB (green OB area)
  const fillOBColors = arsiArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v > obValue ? 'rgba(8,153,129,0.20)' : 'transparent';
  });

  // Fill: OS line to RSI when RSI < OS (red OS area)
  const fillOSColors = arsiArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v < osValue ? 'rgba(242,54,69,0.20)' : 'transparent';
  });

  // Gradient fill: RSI to midline (upper half - green gradient)
  const fillGradUpColors = arsiArr.map((v, i) => {
    if (i < warmup || isNaN(v) || v <= 50) return 'transparent';
    const intensity = Math.min((v - 50) / (obValue - 50), 1);
    const alpha = (intensity * 0.15).toFixed(2);
    return `rgba(8,153,129,${alpha})`;
  });

  // Gradient fill: midline to RSI (lower half - red gradient)
  const fillGradDnColors = arsiArr.map((v, i) => {
    if (i < warmup || isNaN(v) || v >= 50) return 'transparent';
    const intensity = Math.min((50 - v) / (50 - osValue), 1);
    const alpha = (intensity * 0.15).toFixed(2);
    return `rgba(242,54,69,${alpha})`;
  });

  // bgColors: highlight bars when RSI crosses into OB/OS zones
  const bgColors: BgColorData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const v = arsiArr[i];
    const pv = arsiArr[i - 1];
    if (isNaN(v) || isNaN(pv)) continue;
    // Entering OB
    if (v > obValue && pv <= obValue) {
      bgColors.push({ time: bars[i].time, color: 'rgba(8,153,129,0.12)' });
    }
    // Entering OS
    if (v < osValue && pv >= osValue) {
      bgColors.push({ time: bars[i].time, color: 'rgba(242,54,69,0.12)' });
    }
    // Leaving OB
    if (v <= obValue && pv > obValue) {
      bgColors.push({ time: bars[i].time, color: 'rgba(8,153,129,0.06)' });
    }
    // Leaving OS
    if (v >= osValue && pv < osValue) {
      bgColors.push({ time: bars[i].time, color: 'rgba(242,54,69,0.06)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot_up': plot_up, 'plot_avg': plot_avg, 'plot_dn': plot_dn },
    hlines: [
      { value: obValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
      { value: osValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot0', plot2: 'plot_up', colors: fillOBColors },
      { plot1: 'plot_dn', plot2: 'plot0', colors: fillOSColors },
      { plot1: 'plot0', plot2: 'plot_avg', colors: fillGradUpColors },
      { plot1: 'plot_avg', plot2: 'plot0', colors: fillGradDnColors },
    ],
    bgColors,
  };
}

export const UltimateRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
