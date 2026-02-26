/**
 * Volume-Weighted MACD & Sentiment Zone Oscillator
 *
 * Two oscillators combined:
 * VWMACD = EMA(close*vol, fast)/EMA(vol, fast) - EMA(close*vol, slow)/EMA(vol, slow)
 * SZO = EMA(sign(close - close[1]) * volume, len) / EMA(volume, len) * 100
 *
 * Reference: TradingView "VWMACD & SZO" community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VWMACDSZOInputs {
  vwFast: number;
  vwSlow: number;
  vwSignal: number;
  szoLen: number;
}

export const defaultInputs: VWMACDSZOInputs = {
  vwFast: 12,
  vwSlow: 26,
  vwSignal: 9,
  szoLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'vwFast', type: 'int', title: 'VWMACD Fast', defval: 12, min: 1 },
  { id: 'vwSlow', type: 'int', title: 'VWMACD Slow', defval: 26, min: 1 },
  { id: 'vwSignal', type: 'int', title: 'VWMACD Signal', defval: 9, min: 1 },
  { id: 'szoLen', type: 'int', title: 'SZO Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMACD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'VWMACD Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'SZO', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'VWMACD & SZO',
  shortTitle: 'VWMACDSZO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VWMACDSZOInputs> = {}): IndicatorResult {
  const { vwFast, vwSlow, vwSignal, szoLen } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const closeVol = closeSeries.mul(volSeries);

  // VWMACD = EMA(close*vol, fast)/EMA(vol, fast) - EMA(close*vol, slow)/EMA(vol, slow)
  const emaCloseVolFast = ta.ema(closeVol, vwFast);
  const emaVolFast = ta.ema(volSeries, vwFast);
  const emaCloseVolSlow = ta.ema(closeVol, vwSlow);
  const emaVolSlow = ta.ema(volSeries, vwSlow);

  const vwmaFast = emaCloseVolFast.div(emaVolFast);
  const vwmaSlow = emaCloseVolSlow.div(emaVolSlow);
  const vwmacd = vwmaFast.sub(vwmaSlow);
  const vwSignalLine = ta.ema(vwmacd, vwSignal);

  // SZO = EMA(sign(close - close[1]) * volume, len) / EMA(volume, len) * 100
  const signVolArr: number[] = new Array(bars.length);
  signVolArr[0] = 0;
  for (let i = 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    signVolArr[i] = sign * (bars[i].volume ?? 0);
  }
  const signVolSeries = new Series(bars, (_b, i) => signVolArr[i]);
  const emaSignVol = ta.ema(signVolSeries, szoLen);
  const emaVol = ta.ema(volSeries, szoLen);
  const szo = emaSignVol.div(emaVol).mul(100);

  const vwmacdArr = vwmacd.toArray();
  const vwSigArr = vwSignalLine.toArray();
  const szoArr = szo.toArray();

  const warmup = vwSlow;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(vwmacdArr), 'plot1': toPlot(vwSigArr), 'plot2': toPlot(szoArr) },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const VWMACDSZO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
