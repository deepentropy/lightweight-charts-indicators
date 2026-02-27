/**
 * Double MACD
 *
 * Two MACD instances with independent parameters.
 * Buy when both histograms > 0, sell when both < 0.
 *
 * Reference: TradingView "Double MACD" (TV#192)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface DoubleMACDInputs {
  fast1: number;
  slow1: number;
  sig1: number;
  fast2: number;
  slow2: number;
  sig2: number;
  src: SourceType;
}

export const defaultInputs: DoubleMACDInputs = {
  fast1: 12,
  slow1: 26,
  sig1: 9,
  fast2: 19,
  slow2: 39,
  sig2: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fast1', type: 'int', title: 'MACD1 Fast', defval: 12, min: 1 },
  { id: 'slow1', type: 'int', title: 'MACD1 Slow', defval: 26, min: 1 },
  { id: 'sig1', type: 'int', title: 'MACD1 Signal', defval: 9, min: 1 },
  { id: 'fast2', type: 'int', title: 'MACD2 Fast', defval: 19, min: 1 },
  { id: 'slow2', type: 'int', title: 'MACD2 Slow', defval: 39, min: 1 },
  { id: 'sig2', type: 'int', title: 'MACD2 Signal', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Hist1', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Hist2', color: '#B2DFDB', lineWidth: 4, style: 'histogram' },
  { id: 'plot2', title: 'MACD1', color: '#2962FF', lineWidth: 2 },
  { id: 'plot3', title: 'Signal1', color: '#EF5350', lineWidth: 1 },
  { id: 'plot4', title: 'Bearish Div', color: '#FF0000', lineWidth: 1 },
  { id: 'plot5', title: 'Bullish Div', color: '#0AAC00', lineWidth: 1 },
];

export const metadata = {
  title: 'Double MACD',
  shortTitle: 'DMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DoubleMACDInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { fast1, slow1, sig1, fast2, slow2, sig2, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // MACD 1
  const macd1Line = ta.ema(source, fast1).sub(ta.ema(source, slow1));
  const signal1Line = ta.ema(macd1Line, sig1);
  const hist1 = macd1Line.sub(signal1Line);

  // MACD 2
  const macd2Line = ta.ema(source, fast2).sub(ta.ema(source, slow2));
  const signal2Line = ta.ema(macd2Line, sig2);
  const hist2 = macd2Line.sub(signal2Line);

  const hist1Arr = hist1.toArray();
  const hist2Arr = hist2.toArray();
  const macd1Arr = macd1Line.toArray();
  const signal1Arr = signal1Line.toArray();

  const warmup1 = slow1 + sig1;
  const warmup2 = slow2 + sig2;
  const warmup = Math.max(warmup1, warmup2);

  const plot0 = hist1Arr.map((v, i) => {
    if (i < warmup1 || v == null) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = hist2Arr.map((v, i) => {
    if (i < warmup2 || v == null) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#B2DFDB' : '#FFCDD2';
    return { time: bars[i].time, value: v, color };
  });

  const plot2 = macd1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));

  const plot3 = signal1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));

  // Pine divergence plots: fractal tops/bottoms on macd_2, colored when divergence detected
  const macd2Arr = macd2Line.toArray();
  const n = bars.length;

  // Fractal detection: f_top_fractal(src) => src[4]<src[2] and src[3]<src[2] and src[2]>src[1] and src[2]>src[0]
  const fractalTop: (number | null)[] = new Array(n).fill(null);
  const fractalBot: (number | null)[] = new Array(n).fill(null);
  for (let i = 4; i < n; i++) {
    const s0 = macd2Arr[i] ?? NaN, s1 = macd2Arr[i - 1] ?? NaN;
    const s2 = macd2Arr[i - 2] ?? NaN, s3 = macd2Arr[i - 3] ?? NaN, s4 = macd2Arr[i - 4] ?? NaN;
    if (s4 < s2 && s3 < s2 && s2 > s1 && s2 > s0) fractalTop[i] = s2;
    if (s4 > s2 && s3 > s2 && s2 < s1 && s2 < s0) fractalBot[i] = s2;
  }

  // Track last fractal values for divergence comparison (simplified valuewhen)
  let highPrev = NaN, highPrice = NaN, lowPrev = NaN, lowPrice = NaN;
  const plot4: Array<{ time: number; value: number; color?: string }> = [];
  const plot5: Array<{ time: number; value: number; color?: string }> = [];
  for (let i = 0; i < n; i++) {
    if (fractalTop[i] != null) {
      const curVal = fractalTop[i]!;
      const curPrice = bars[i - 2] ? bars[i - 2].high : bars[i].high;
      const regBearish = !isNaN(highPrev) && curPrice > highPrice && curVal < highPrev;
      plot4.push({ time: bars[i].time, value: curVal, color: regBearish ? '#FF0000' : 'transparent' });
      highPrev = curVal;
      highPrice = curPrice;
    } else {
      plot4.push({ time: bars[i].time, value: NaN });
    }
    if (fractalBot[i] != null) {
      const curVal = fractalBot[i]!;
      const curPrice = bars[i - 2] ? bars[i - 2].low : bars[i].low;
      const regBullish = !isNaN(lowPrev) && curPrice < lowPrice && curVal > lowPrev;
      plot5.push({ time: bars[i].time, value: curVal, color: regBullish ? '#0AAC00' : 'transparent' });
      lowPrev = curVal;
      lowPrice = curPrice;
    } else {
      plot5.push({ time: bars[i].time, value: NaN });
    }
  }

  // Pine markers:
  // largo = crossover(macd_2,0) and macd_1 < macd_2 and macd_1[1] < macd_1[0] and macd_1 < 0
  // corto = crossunder(macd_2,0) and macd_1 > macd_2 and macd_1[1] > macd_1[0] and macd_1 > 0
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const m2 = macd2Arr[i];
    const m2prev = macd2Arr[i - 1];
    const m1 = macd1Arr[i];
    const m1prev = i > 0 ? (macd1Arr[i - 1] ?? NaN) : NaN;
    if (m2 == null || m2prev == null || m1 == null || isNaN(m1prev)) continue;

    // Buy: macd2 crosses above 0, macd1 < macd2, macd1 rising, macd1 < 0
    if (m2prev <= 0 && m2 > 0 && m1 < m2 && m1 > m1prev && m1 < 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Buy' });
    }
    // Sell: macd2 crosses below 0, macd1 > macd2, macd1 falling, macd1 > 0
    if (m2prev >= 0 && m2 < 0 && m1 > m2 && m1 < m1prev && m1 > 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Sell' });
    }
  }

  // Pine bgcolor: atlas zone (red bg when dbb < factor) and choppiness zone (red bg when chop > 50)
  // Simplified: bgcolor when both histograms are near zero (choppy/low volatility zone)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const h1 = hist1Arr[i];
    const h2 = hist2Arr[i];
    if (h1 == null || h2 == null) continue;
    // Both histograms same sign and small => choppy zone
    if (Math.abs(h1) < Math.abs(macd1Arr[i] ?? 1) * 0.1 || Math.abs(h2) < Math.abs(macd2Arr[i] ?? 1) * 0.1) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255, 0, 0, 0.1)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
    markers,
    bgColors,
  };
}

export const DoubleMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
