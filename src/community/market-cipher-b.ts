/**
 * Market Cipher B
 *
 * Extended Market Cipher: WaveTrend + MACD + Stochastic RSI.
 *
 * Reference: TradingView "Market Cipher B" community indicator
 */

import { ta, getSourceSeries, Series, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MarketCipherBInputs {
  wtChannelLen: number;
  wtAvgLen: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochLen: number;
  stochSmooth: number;
}

export const defaultInputs: MarketCipherBInputs = {
  wtChannelLen: 9,
  wtAvgLen: 12,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  stochLen: 14,
  stochSmooth: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAvgLen', type: 'int', title: 'WT Average Length', defval: 12, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'MACD Signal', defval: 9, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'stochSmooth', type: 'int', title: 'Stoch Smooth', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WT1', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'WT2', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'MACD Hist', color: '#26A69A', lineWidth: 3, style: 'histogram' },
  { id: 'plot3', title: 'StochRSI', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'Market Cipher B',
  shortTitle: 'MCB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherBInputs> = {}): IndicatorResult {
  const { wtChannelLen, wtAvgLen, macdFast, macdSlow, macdSignal, stochLen, stochSmooth } = { ...defaultInputs, ...inputs };

  // WaveTrend
  const hlc3 = getSourceSeries(bars, 'hlc3');
  const esa = ta.ema(hlc3, wtChannelLen);
  const d = ta.ema(math.abs(hlc3.sub(esa)) as Series, wtChannelLen);
  const ci = hlc3.sub(esa).div(d.mul(0.015));
  const wt1 = ta.ema(ci, wtAvgLen);
  const wt2 = ta.sma(wt1, 3);

  // MACD histogram
  const close = new Series(bars, (b) => b.close);
  const macdFastEma = ta.ema(close, macdFast);
  const macdSlowEma = ta.ema(close, macdSlow);
  const macdLine = macdFastEma.sub(macdSlowEma);
  const macdSignalLine = ta.ema(macdLine, macdSignal);
  const macdHist = macdLine.sub(macdSignalLine);

  // Stochastic RSI: stoch of RSI values, then smooth
  const rsi = ta.rsi(close, stochLen);
  const stochRaw = ta.stoch(rsi, rsi, rsi, stochLen);
  const stochSmoothed = ta.sma(stochRaw, stochSmooth);
  // Scale to center at 0 (0-100 -> -50 to 50)
  const stochCentered = stochSmoothed.sub(50);

  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();
  const macdHistArr = macdHist.toArray();
  const stochArr = stochCentered.toArray();

  const warmup = Math.max(wtChannelLen + wtAvgLen, macdSlow, stochLen * 2);

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => {
      const val = typeof v === 'number' ? v : NaN;
      return { time: bars[i].time, value: (i < warmup || isNaN(val)) ? NaN : val };
    });

  const macdPlot = macdHistArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (macdHistArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(wt1Arr), 'plot1': toPlot(wt2Arr), 'plot2': macdPlot, 'plot3': toPlot(stochArr) },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
      { value: 60, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB' } },
      { value: -60, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS' } },
    ],
  };
}

export const MarketCipherB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
