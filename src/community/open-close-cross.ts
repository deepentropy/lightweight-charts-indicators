/**
 * Open Close Cross Alerts (NoRepaint)
 *
 * Applies a selectable MA to both close and open series, then plots
 * a normalized percentage difference as an oscillator. Crossovers
 * generate long/short signals. Optional fractal-based divergence detection.
 *
 * Reference: TradingView "Open Close Cross Strategy R5.1" by JustUncleL
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface OpenCloseCrossInputs {
  maType: string;
  maPeriod: number;
  resMultiplier: number;
  useResMultiplier: boolean;
  showDivergence: boolean;
}

export const defaultInputs: OpenCloseCrossInputs = {
  maType: 'ZEMA',
  maPeriod: 8,
  resMultiplier: 6,
  useResMultiplier: true,
  showDivergence: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ZEMA', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'SMMA', 'SSMA', 'TMA'] },
  { id: 'maPeriod', type: 'int', title: 'MA Period', defval: 8, min: 1 },
  { id: 'resMultiplier', type: 'int', title: 'Resolution Multiplier', defval: 6, min: 1 },
  { id: 'useResMultiplier', type: 'bool', title: 'Use Res Multiplier', defval: true },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'pcd', title: 'PCD Area', color: '#26A69A', lineWidth: 1, style: 'histogram' },
  { id: 'pcdLine', title: 'PCD Line', color: '#26A69A', lineWidth: 2 },
  { id: 'zero', title: 'Zero', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Open Close Cross',
  shortTitle: 'OCC',
  overlay: false,
};

/** Compute a selectable MA variant on raw array, returning raw array */
function variant(srcArr: number[], length: number, maType: string, bars: Bar[]): number[] {
  const n = srcArr.length;

  // Build a Series from the raw array
  const makeSeries = (arr: number[]): Series =>
    new Series(
      arr.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
      (b) => b.close,
    );

  const src = makeSeries(srcArr);

  switch (maType) {
    case 'SMA': return ta.sma(src, length).toArray().map(v => v ?? NaN);
    case 'EMA': return ta.ema(src, length).toArray().map(v => v ?? NaN);
    case 'WMA': return ta.wma(src, length).toArray().map(v => v ?? NaN);
    case 'HullMA': return ta.hma(src, length).toArray().map(v => v ?? NaN);
    case 'TMA': {
      // TMA = SMA(SMA(src, len), len)
      const sma1 = ta.sma(src, length).toArray().map(v => v ?? NaN);
      const sma1Series = makeSeries(sma1);
      return ta.sma(sma1Series, length).toArray().map(v => v ?? NaN);
    }
    case 'DEMA': {
      const e1 = ta.ema(src, length).toArray().map(v => v ?? NaN);
      const e1Series = makeSeries(e1);
      const e2 = ta.ema(e1Series, length).toArray().map(v => v ?? NaN);
      return e1.map((v, i) => 2 * v - (e2[i] ?? NaN));
    }
    case 'TEMA': {
      const e1 = ta.ema(src, length).toArray().map(v => v ?? NaN);
      const e1Series = makeSeries(e1);
      const e2 = ta.ema(e1Series, length).toArray().map(v => v ?? NaN);
      const e2Series = makeSeries(e2);
      const e3 = ta.ema(e2Series, length).toArray().map(v => v ?? NaN);
      return e1.map((v, i) => 3 * (v - e2[i]) + e3[i]);
    }
    case 'ZEMA': {
      // ZEMA: lag = (len-1)/2, ema(src + src - src[lag], len)
      const lag = Math.floor((length - 1) / 2);
      const adjusted: number[] = srcArr.map((v, i) => {
        if (i < lag) return v;
        return v + (v - srcArr[i - lag]);
      });
      const adjSeries = makeSeries(adjusted);
      return ta.ema(adjSeries, length).toArray().map(v => v ?? NaN);
    }
    case 'SMMA': {
      // Smoothed MA: smma[0] = sma(src,len), smma[i] = (smma[i-1]*(len-1) + src[i]) / len
      const out: number[] = new Array(n).fill(NaN);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (isNaN(srcArr[i])) continue;
        if (i < length) {
          sum += srcArr[i];
          if (i === length - 1) out[i] = sum / length;
        } else {
          out[i] = (out[i - 1] * (length - 1) + srcArr[i]) / length;
        }
      }
      return out;
    }
    case 'SSMA': {
      // SuperSmoother: a1 = exp(-1.414*PI/len), b1 = 2*a1*cos(1.414*PI/len)
      // c1 = 1 - b1 + a1^2, v9 = c1*(src+src[1])/2 + b1*v9[1] - a1^2*v9[2]
      const PI = Math.PI;
      const a1 = Math.exp(-1.414 * PI / length);
      const b1 = 2 * a1 * Math.cos(1.414 * PI / length);
      const c1 = 1 - b1 + a1 * a1;
      const out: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(srcArr[i])) continue;
        if (i < 2) {
          out[i] = srcArr[i];
        } else {
          const prev1 = isNaN(out[i - 1]) ? srcArr[i] : out[i - 1];
          const prev2 = isNaN(out[i - 2]) ? srcArr[i] : out[i - 2];
          const srcPrev = isNaN(srcArr[i - 1]) ? srcArr[i] : srcArr[i - 1];
          out[i] = c1 * (srcArr[i] + srcPrev) / 2 + b1 * prev1 - a1 * a1 * prev2;
        }
      }
      return out;
    }
    default: return ta.ema(src, length).toArray().map(v => v ?? NaN);
  }
}

export function calculate(bars: Bar[], inputs: Partial<OpenCloseCrossInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const effectiveLen = cfg.useResMultiplier ? cfg.maPeriod * cfg.resMultiplier : cfg.maPeriod;

  const closeArr = bars.map(b => b.close);
  const openArr = bars.map(b => b.open);

  // Apply MA to close and open
  const closeMA = variant(closeArr, effectiveLen, cfg.maType, bars);
  const openMA = variant(openArr, effectiveLen, cfg.maType, bars);

  // diff = closeMA - openMA
  // pcd = 50000 * diff / ((closeMA + openMA) / 2)
  const diff: number[] = new Array(n);
  const pcd: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    diff[i] = closeMA[i] - openMA[i];
    const avg = (closeMA[i] + openMA[i]) / 2;
    pcd[i] = avg !== 0 ? 50000 * diff[i] / avg : 0;
  }

  const warmup = effectiveLen;
  const markers: MarkerData[] = [];

  // Cross signals
  for (let i = 1; i < n; i++) {
    if (i < warmup || isNaN(closeMA[i]) || isNaN(openMA[i])) continue;

    const xlong = closeMA[i - 1] <= openMA[i - 1] && closeMA[i] > openMA[i];
    const xshort = closeMA[i - 1] >= openMA[i - 1] && closeMA[i] < openMA[i];

    if (xlong) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: '#26A69A', text: 'Long' });
    }
    if (xshort) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: '#EF5350', text: 'Short' });
    }
  }

  // --- Fractal-based divergences on pcd oscillator ---
  if (cfg.showDivergence) {
    let prevTopPcd = NaN;
    let prevTopPrice = NaN;
    let prevBotPcd = NaN;
    let prevBotPrice = NaN;

    for (let i = 4; i < n; i++) {
      if (i - 2 < warmup) continue;

      // Top fractal at i-2
      const isTopFractal = pcd[i - 4] < pcd[i - 2] && pcd[i - 3] < pcd[i - 2] &&
                           pcd[i - 2] > pcd[i - 1] && pcd[i - 2] > pcd[i];

      // Bottom fractal at i-2
      const isBotFractal = pcd[i - 4] > pcd[i - 2] && pcd[i - 3] > pcd[i - 2] &&
                           pcd[i - 2] < pcd[i - 1] && pcd[i - 2] < pcd[i];

      if (isTopFractal && !isNaN(prevTopPcd)) {
        const curPcd = pcd[i - 2];
        const curPrice = bars[i - 2].high;
        // Regular bearish: price higher high but pcd lower high
        if (curPrice > prevTopPrice && curPcd < prevTopPcd) {
          markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'diamond', color: '#EF5350', text: 'Bear Div' });
        }
        // Hidden bearish: price lower high but pcd higher high
        if (curPrice < prevTopPrice && curPcd > prevTopPcd) {
          markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'diamond', color: '#FF9800', text: 'H.Bear' });
        }
      }

      if (isBotFractal && !isNaN(prevBotPcd)) {
        const curPcd = pcd[i - 2];
        const curPrice = bars[i - 2].low;
        // Regular bullish: price lower low but pcd higher low
        if (curPrice < prevBotPrice && curPcd > prevBotPcd) {
          markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'diamond', color: '#26A69A', text: 'Bull Div' });
        }
        // Hidden bullish: price higher low but pcd lower low
        if (curPrice > prevBotPrice && curPcd < prevBotPcd) {
          markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'diamond', color: '#FF9800', text: 'H.Bull' });
        }
      }

      if (isTopFractal) {
        prevTopPcd = pcd[i - 2];
        prevTopPrice = bars[i - 2].high;
      }
      if (isBotFractal) {
        prevBotPcd = pcd[i - 2];
        prevBotPrice = bars[i - 2].low;
      }
    }
  }

  // --- Build plot arrays ---
  const bullish = (i: number) => closeMA[i] > openMA[i];

  const pcdAreaPlot = pcd.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
    color: bullish(i) ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
  }));

  const pcdLinePlot = pcd.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
    color: bullish(i) ? '#26A69A' : '#EF5350',
  }));

  const zeroPlot = bars.map(b => ({ time: b.time, value: 0 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      pcd: pcdAreaPlot,
      pcdLine: pcdLinePlot,
      zero: zeroPlot,
    },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
    markers,
  };
}

export const OpenCloseCross = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
