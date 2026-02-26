/**
 * AK TREND ID
 *
 * Trend identification using EMA crossover + ADX filter.
 * Fast/slow EMA cross for signal, ADX > threshold confirms trend.
 * Bars colored green when bullish and confirmed, red when bearish and confirmed.
 *
 * Reference: TradingView "AK TREND ID" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface AKTrendIDInputs {
  emaFast: number;
  emaSlow: number;
  adxLen: number;
  adxThreshold: number;
  src: SourceType;
}

export const defaultInputs: AKTrendIDInputs = {
  emaFast: 8,
  emaSlow: 21,
  adxLen: 14,
  adxThreshold: 25,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA', defval: 8, min: 1 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA', defval: 21, min: 1 },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 25, min: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'AK TREND ID',
  shortTitle: 'AKTID',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AKTrendIDInputs> = {}): IndicatorResult {
  const { emaFast, emaSlow, adxLen, adxThreshold, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const fastArr = ta.ema(srcSeries, emaFast).toArray();
  const slowArr = ta.ema(srcSeries, emaSlow).toArray();

  // Manual ADX calculation
  const adxArr: number[] = new Array(n);
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  let adx = 0;

  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = i > 0 ? bars[i - 1].high : high;
    const prevLow = i > 0 ? bars[i - 1].low : low;
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    if (i <= adxLen) {
      smoothTR += tr;
      smoothPlusDM += plusDM;
      smoothMinusDM += minusDM;
    } else {
      smoothTR = smoothTR - smoothTR / adxLen + tr;
      smoothPlusDM = smoothPlusDM - smoothPlusDM / adxLen + plusDM;
      smoothMinusDM = smoothMinusDM - smoothMinusDM / adxLen + minusDM;
    }

    const diPlus = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const diMinus = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = diPlus + diMinus;
    const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

    if (i === 2 * adxLen - 1) {
      adx = dx;
    } else if (i >= 2 * adxLen) {
      adx = (adx * (adxLen - 1) + dx) / adxLen;
    }

    adxArr[i] = adx;
  }

  const warmup = Math.max(emaFast, emaSlow, 2 * adxLen);
  const barColors: BarColorData[] = [];

  const fastPlot = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));
  const slowPlot = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  for (let i = warmup; i < n; i++) {
    const bullish = fastArr[i] > slowArr[i];
    const confirmed = adxArr[i] >= adxThreshold;
    if (confirmed) {
      barColors.push({ time: bars[i].time as number, color: bullish ? '#26A69A' : '#EF5350' });
    } else {
      barColors.push({ time: bars[i].time as number, color: '#787B86' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': fastPlot, 'plot1': slowPlot },
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const AKTrendID = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
