/**
 * Market Cipher A
 *
 * WaveTrend + Money Flow + MACD combined oscillator.
 * WaveTrend: esa=EMA(hlc3, n), d=EMA(|hlc3-esa|, n), ci=(hlc3-esa)/(0.015*d),
 *   wt1=EMA(ci, avg), wt2=SMA(wt1, 3).
 *
 * Reference: TradingView "Market Cipher A" community indicator
 */

import { ta, getSourceSeries, Series, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketCipherAInputs {
  wtChannelLen: number;
  wtAvgLen: number;
  mfiLen: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: MarketCipherAInputs = {
  wtChannelLen: 9,
  wtAvgLen: 12,
  mfiLen: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAvgLen', type: 'int', title: 'WT Average Length', defval: 12, min: 1 },
  { id: 'mfiLen', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'MACD Signal', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WT1', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'WT2', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'MFI', color: '#00E676', lineWidth: 3, style: 'histogram' },
  { id: 'plot3', title: 'MACD Hist', color: '#E91E63', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Market Cipher A',
  shortTitle: 'MCA',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherAInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { wtChannelLen, wtAvgLen, mfiLen, macdFast, macdSlow, macdSignal } = { ...defaultInputs, ...inputs };

  // WaveTrend
  const hlc3 = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(hlc3, wtChannelLen);
  const d = ta.ema(math.abs(hlc3.sub(esa)) as Series, wtChannelLen);
  const ci = hlc3.sub(esa).div(d.mul(0.015));
  const wt1 = ta.ema(ci, wtAvgLen);
  const wt2 = ta.sma(wt1, 3);

  // MFI (centered at 0)
  const hlc3Arr = bars.map(b => (b.high + b.low + b.close) / 3);
  const rawMoneyFlow = hlc3Arr.map((v, i) => v * (bars[i].volume ?? 0));
  const posFlow: number[] = new Array(bars.length).fill(0);
  const negFlow: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    if (hlc3Arr[i] > hlc3Arr[i - 1]) posFlow[i] = rawMoneyFlow[i];
    else if (hlc3Arr[i] < hlc3Arr[i - 1]) negFlow[i] = rawMoneyFlow[i];
  }
  const mfiArr: number[] = new Array(bars.length).fill(NaN);
  for (let i = mfiLen; i < bars.length; i++) {
    let sumPos = 0, sumNeg = 0;
    for (let j = 0; j < mfiLen; j++) {
      sumPos += posFlow[i - j];
      sumNeg += negFlow[i - j];
    }
    const mfi = sumNeg === 0 ? 100 : 100 - 100 / (1 + sumPos / sumNeg);
    mfiArr[i] = mfi - 50; // Center at 0
  }

  // MACD histogram
  const close = new Series(bars, (b) => b.close);
  const macdFastEma = ta.ema(close, macdFast);
  const macdSlowEma = ta.ema(close, macdSlow);
  const macdLine = macdFastEma.sub(macdSlowEma);
  const macdSignalLine = ta.ema(macdLine, macdSignal);
  const macdHist = macdLine.sub(macdSignalLine);

  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();
  const macdHistArr = macdHist.toArray();

  const warmup = Math.max(wtChannelLen + wtAvgLen, macdSlow, mfiLen);

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => {
      const val = typeof v === 'number' ? v : NaN;
      return { time: bars[i].time, value: (i < warmup || isNaN(val)) ? NaN : val };
    });

  const mfiPlot = mfiArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: v >= 0 ? '#00E676' : '#FF5252' };
  });

  const macdPlot = macdHistArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: v >= 0 ? '#E91E63' : '#9C27B0' };
  });

  // Markers: WT1 crossing WT2 (WaveTrend cross signals)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const w1 = wt1Arr[i];
    const w2 = wt2Arr[i];
    const pw1 = wt1Arr[i - 1];
    const pw2 = wt2Arr[i - 1];
    if (w1 == null || w2 == null || pw1 == null || pw2 == null) continue;

    // Bullish cross: wt1 crosses above wt2
    if (pw1 <= pw2 && w1 > w2) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
    }
    // Bearish cross: wt1 crosses below wt2
    if (pw1 >= pw2 && w1 < w2) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(wt1Arr), 'plot1': toPlot(wt2Arr), 'plot2': mfiPlot, 'plot3': macdPlot },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
      { value: 60, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB' } },
      { value: -60, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS' } },
    ],
    markers,
  };
}

export const MarketCipherA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
