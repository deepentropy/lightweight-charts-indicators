/**
 * Double MACD Buy and Sell
 *
 * Two MACD instances (12/26 and 5/15) each plotted as both line AND histogram.
 * Divergence detection on MACD2 with fractal tops/bottoms.
 * Entry markers (largo/corto) on MACD2 zero cross with MACD1 confirmation.
 * Counter-trend entries (largo1/corto1) on MACD2/MACD1 cross.
 *
 * Reference: TradingView "DOBLE MACD X" community indicator
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
  fast2: 5,
  slow2: 15,
  sig2: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fast1', type: 'int', title: 'MACD1 Fast', defval: 12, min: 1 },
  { id: 'slow1', type: 'int', title: 'MACD1 Slow', defval: 26, min: 1 },
  { id: 'sig1', type: 'int', title: 'MACD1 Signal', defval: 9, min: 1 },
  { id: 'fast2', type: 'int', title: 'MACD2 Fast', defval: 5, min: 1 },
  { id: 'slow2', type: 'int', title: 'MACD2 Slow', defval: 15, min: 1 },
  { id: 'sig2', type: 'int', title: 'MACD2 Signal', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'macd1Line', title: 'MACD 1226 Line', color: '#C0C0C0', lineWidth: 2 },
  { id: 'macd1Hist', title: 'MACD 1226 Hist', color: '#C0C0C0', lineWidth: 2, style: 'histogram' },
  { id: 'macd2Line', title: 'MACD 515 Line', color: '#FFFF00', lineWidth: 2 },
  { id: 'macd2Hist', title: 'MACD 515 Hist', color: '#FFFF00', lineWidth: 2, style: 'histogram' },
  { id: 'divBear', title: 'Bearish Div', color: '#FF0000', lineWidth: 1 },
  { id: 'divBull', title: 'Bullish Div', color: '#0AAC00', lineWidth: 1 },
];

export const metadata = {
  title: 'Double MACD',
  shortTitle: 'DMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DoubleMACDInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { fast1, slow1, sig1, fast2, slow2, sig2, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  // MACD 1 (12/26) - Pine plots as both line and histogram
  const macd1Line = ta.ema(source, fast1).sub(ta.ema(source, slow1));
  const macd1Arr = macd1Line.toArray();

  // MACD 2 (5/15) - Pine plots as both line and histogram
  const macd2Line = ta.ema(source, fast2).sub(ta.ema(source, slow2));
  const macd2Arr = macd2Line.toArray();

  const warmup1 = slow1;
  const warmup2 = slow2;
  const warmup = Math.max(warmup1, warmup2);

  // MACD1 line + histogram (gray #C0C0C0)
  const macd1LinePlot = macd1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));
  const macd1HistPlot = macd1Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup1 || v == null) ? NaN : v,
  }));

  // MACD2 line + histogram (yellow #FFFF00)
  const macd2LinePlot = macd2Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup2 || v == null) ? NaN : v,
  }));
  const macd2HistPlot = macd2Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup2 || v == null) ? NaN : v,
  }));

  // Divergence detection on MACD2 using fractals
  // f_top_fractal(src) => src[4]<src[2] and src[3]<src[2] and src[2]>src[1] and src[2]>src[0]
  // f_bot_fractal(src) => src[4]>src[2] and src[3]>src[2] and src[2]<src[1] and src[2]<src[0]
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
  const divBearPlot: Array<{ time: number; value: number; color?: string }> = [];
  const divBullPlot: Array<{ time: number; value: number; color?: string }> = [];

  // Divergence label markers + entry markers
  const markers: MarkerData[] = [];

  // Pine: max = highest(macd_2, 100) * 1.5
  // nsc = max, nsv = -max, midpoint = 0, ploff = nsc / 8 = max / 8
  for (let i = 0; i < n; i++) {
    // Compute local scale for label offset
    let localMax = 0;
    for (let j = Math.max(0, i - 99); j <= i; j++) {
      const v = Math.abs(macd2Arr[j] ?? 0);
      if (v > localMax) localMax = v;
    }
    const ploff = (localMax * 1.5) / 8;

    if (fractalTop[i] != null) {
      const curVal = fractalTop[i]!;
      const curPrice = bars[i - 2] ? bars[i - 2].high : bars[i].high;
      const regBearish = !isNaN(highPrev) && curPrice > highPrice && curVal < highPrev;
      const hidBearish = !isNaN(highPrev) && curPrice < highPrice && curVal > highPrev;
      const col = regBearish || hidBearish ? '#FF0000' : 'transparent';
      // Pine: plot with offset=-2, so place at i-2
      divBearPlot.push({ time: bars[i - 2] ? bars[i - 2].time : bars[i].time, value: curVal, color: col });

      // Pine plotshape: regular bearish = Bear R, hidden bearish = Bear O
      // Pine offset=-2, so place label at bar i-2
      const labelTime = bars[i - 2] ? bars[i - 2].time : bars[i].time;
      if (regBearish) {
        markers.push({ time: labelTime, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Bear R' });
      }
      if (hidBearish) {
        markers.push({ time: labelTime, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Bear O' });
      }

      highPrev = curVal;
      highPrice = curPrice;
    } else {
      divBearPlot.push({ time: bars[i].time, value: NaN });
    }

    if (fractalBot[i] != null) {
      const curVal = fractalBot[i]!;
      const curPrice = bars[i - 2] ? bars[i - 2].low : bars[i].low;
      const regBullish = !isNaN(lowPrev) && curPrice < lowPrice && curVal > lowPrev;
      const hidBullish = !isNaN(lowPrev) && curPrice > lowPrice && curVal < lowPrev;
      const col = regBullish || hidBullish ? '#0AAC00' : 'transparent';
      // Pine: plot with offset=-2, so place at i-2
      divBullPlot.push({ time: bars[i - 2] ? bars[i - 2].time : bars[i].time, value: curVal, color: col });

      // Pine plotshape: regular bullish = Bull R, hidden bullish = Bull O
      // Pine offset=-2, so place label at bar i-2
      const labelTime = bars[i - 2] ? bars[i - 2].time : bars[i].time;
      if (regBullish) {
        markers.push({ time: labelTime, position: 'belowBar', shape: 'labelUp', color: '#0AAC00', text: 'Bull R' });
      }
      if (hidBullish) {
        markers.push({ time: labelTime, position: 'belowBar', shape: 'labelUp', color: '#0AAC00', text: 'Bull O' });
      }

      lowPrev = curVal;
      lowPrice = curPrice;
    } else {
      divBullPlot.push({ time: bars[i].time, value: NaN });
    }
  }

  // Entry signals
  // Pine: largo = crossover(macd_2,0) and macd_1 < macd_2 and macd_1[1] < macd_1[0] and macd_1 < 0
  // Pine: largo1 = crossover(macd_2,macd_1) and macd_2 < 0
  // Pine: corto = crossunder(macd_2,0) and macd_1 > macd_2 and macd_1[1] > macd_1[0] and macd_1 > 0
  // Pine: corto1 = crossunder(macd_2,macd_1) and macd_2 > 0
  for (let i = warmup + 1; i < n; i++) {
    const m2 = macd2Arr[i];
    const m2prev = macd2Arr[i - 1];
    const m1 = macd1Arr[i];
    const m1prev = macd1Arr[i - 1] ?? NaN;
    if (m2 == null || m2prev == null || m1 == null || isNaN(m1prev)) continue;

    // Trend buy: macd2 crosses above 0, macd1 < macd2, macd1 rising, macd1 < 0
    if (m2prev <= 0 && m2 > 0 && m1 < m2 && m1 > m1prev && m1 < 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#0AAC00', text: 'Buy' });
    }
    // Trend sell: macd2 crosses below 0, macd1 > macd2, macd1 falling, macd1 > 0
    if (m2prev >= 0 && m2 < 0 && m1 > m2 && m1 < m1prev && m1 > 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'Sell' });
    }

    // Counter-trend buy: macd2 crosses above macd1, macd2 < 0
    const m1prev2 = macd1Arr[i - 1] ?? NaN;
    if (m2prev <= m1prev2 && m2 > m1 && m2 < 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#0AAC00', text: 'CT Buy' });
    }
    // Counter-trend sell: macd2 crosses below macd1, macd2 > 0
    if (m2prev >= m1prev2 && m2 < m1 && m2 > 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'CT Sell' });
    }
  }

  // Pine bgcolor: atlas zone (red bg when dbb < factor) and choppiness zone (red bg when chop > 50)
  const bgColors: BgColorData[] = [];
  // Atlas + choppiness detection
  const bbLen = 20;
  const bbMult = 2.0;
  const chopLen = 14;
  const chopLevel = 50;

  // Pre-compute EMA of dbb for atlas factor (Pine: dbbmed = ema(dbb, 120), factor = dbbmed*4/5)
  const dbbArr: number[] = new Array(n).fill(0);
  for (let i = bbLen - 1; i < n; i++) {
    let sumSrc = 0, sumSq = 0;
    for (let j = i - bbLen + 1; j <= i; j++) {
      sumSrc += bars[j].close;
      sumSq += bars[j].close * bars[j].close;
    }
    const mean = sumSrc / bbLen;
    const stdv = Math.sqrt(Math.max(0, sumSq / bbLen - mean * mean));
    const bbUp = mean + bbMult * stdv;
    const bbLo = mean - bbMult * stdv;
    dbbArr[i] = bbUp > 0 ? Math.sqrt((bbUp - bbLo) / bbUp) * 20 : 0;
  }

  // EMA of dbb with period 120
  const emaLen = 120;
  const emaMult = 2 / (emaLen + 1);
  const dbbEma: number[] = new Array(n).fill(0);
  let emaInit = false;
  for (let i = bbLen - 1; i < n; i++) {
    if (!emaInit) {
      dbbEma[i] = dbbArr[i];
      emaInit = true;
    } else {
      dbbEma[i] = dbbArr[i] * emaMult + dbbEma[i - 1] * (1 - emaMult);
    }
  }

  for (let i = Math.max(warmup, bbLen, chopLen); i < n; i++) {
    // Atlas: atl = dbb - factor, all = atl > 0 ? 0 : 1
    const factor = dbbEma[i] * 4 / 5;
    const atl = dbbArr[i] - factor;
    const atlZone = atl <= 0;

    // Choppiness: 100 * log10(sum(tr, len) / (highest - lowest)) / log10(len)
    let sumTr = 0, hh = -Infinity, ll = Infinity;
    for (let j = i - chopLen + 1; j <= i; j++) {
      const tr = Math.max(bars[j].high - bars[j].low,
        j > 0 ? Math.abs(bars[j].high - bars[j - 1].close) : 0,
        j > 0 ? Math.abs(bars[j].low - bars[j - 1].close) : 0);
      sumTr += tr;
      const cmpL = j > 0 ? Math.min(bars[j].low, bars[j - 1].close) : bars[j].low;
      const cmpH = j > 0 ? Math.max(bars[j].high, bars[j - 1].close) : bars[j].high;
      if (cmpH > hh) hh = cmpH;
      if (cmpL < ll) ll = cmpL;
    }
    const height = hh - ll;
    const chop = height > 0 ? 100 * Math.log10(sumTr / height) / Math.log10(chopLen) : 0;
    const chopZone = chop >= chopLevel;

    if (atlZone || chopZone) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255, 0, 0, 0.1)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'macd1Line': macd1LinePlot,
      'macd1Hist': macd1HistPlot,
      'macd2Line': macd2LinePlot,
      'macd2Hist': macd2HistPlot,
      'divBear': divBearPlot,
      'divBull': divBullPlot,
    },
    hlines: [
      { value: 0, options: { color: '#000000', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    markers,
    bgColors,
  };
}

export const DoubleMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
