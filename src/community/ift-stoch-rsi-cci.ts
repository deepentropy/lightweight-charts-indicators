/**
 * Inverse Fisher Transform COMBO [Stoch + RSI + CCI]
 *
 * Combines IFT of Stochastic, RSI, and CCI into a single oscillator.
 * Each raw indicator is normalized, smoothed with WMA, then passed through
 * the Inverse Fisher Transform: IFT(x) = (e^(2x) - 1) / (e^(2x) + 1)
 *
 * Reference: TradingView "IFT Stoch RSI CCI COMBO" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface IFTStochRSICCIInputs {
  stochLength: number;
  rsiLength: number;
  cciLength: number;
  wmaLength: number;
}

export const defaultInputs: IFTStochRSICCIInputs = {
  stochLength: 14,
  rsiLength: 14,
  cciLength: 14,
  wmaLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 'wmaLength', type: 'int', title: 'WMA Smoothing', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'IFT Stoch', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'IFT RSI', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'IFT CCI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Average', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'IFT Stoch RSI CCI',
  shortTitle: 'IFTCombo',
  overlay: false,
};

function ift(x: number): number {
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

export function calculate(bars: Bar[], inputs: Partial<IFTStochRSICCIInputs> = {}): IndicatorResult {
  const { stochLength, rsiLength, cciLength, wmaLength } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Raw indicators
  const rawStochArr = ta.stoch(closeSeries, highSeries, lowSeries, stochLength).toArray();
  const rawRsiArr = ta.rsi(closeSeries, rsiLength).toArray();
  const hlc3Series = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const rawCciArr = ta.cci(hlc3Series, cciLength).toArray();

  // Normalize
  const v1Stoch: number[] = new Array(bars.length);
  const v1Rsi: number[] = new Array(bars.length);
  const v1Cci: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    v1Stoch[i] = 0.1 * ((rawStochArr[i] ?? 50) - 50);
    v1Rsi[i] = 0.1 * ((rawRsiArr[i] ?? 50) - 50);
    v1Cci[i] = 0.025 * (rawCciArr[i] ?? 0);
  }

  // WMA smoothing
  const v2StochArr = ta.wma(new Series(bars, (_b, i) => v1Stoch[i]), wmaLength).toArray();
  const v2RsiArr = ta.wma(new Series(bars, (_b, i) => v1Rsi[i]), wmaLength).toArray();
  const v2CciArr = ta.wma(new Series(bars, (_b, i) => v1Cci[i]), wmaLength).toArray();

  const warmup = Math.max(stochLength, rsiLength, cciLength) + wmaLength;

  const plot0Data: { time: number | string; value: number }[] = [];
  const plot1Data: { time: number | string; value: number }[] = [];
  const plot2Data: { time: number | string; value: number }[] = [];
  const plot3Data: { time: number | string; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < warmup || v2StochArr[i] == null || v2RsiArr[i] == null || v2CciArr[i] == null) {
      plot0Data.push({ time: bars[i].time, value: NaN });
      plot1Data.push({ time: bars[i].time, value: NaN });
      plot2Data.push({ time: bars[i].time, value: NaN });
      plot3Data.push({ time: bars[i].time, value: NaN });
    } else {
      const iftStoch = ift(v2StochArr[i]!);
      const iftRsi = ift(v2RsiArr[i]!);
      const iftCci = ift(v2CciArr[i]!);
      const avg = (iftStoch + iftRsi + iftCci) / 3;
      plot0Data.push({ time: bars[i].time, value: iftStoch });
      plot1Data.push({ time: bars[i].time, value: iftRsi });
      plot2Data.push({ time: bars[i].time, value: iftCci });
      plot3Data.push({ time: bars[i].time, value: avg });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0Data, 'plot1': plot1Data, 'plot2': plot2Data, 'plot3': plot3Data },
    hlines: [
      { value: 0.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: -0.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower' } },
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const IFTStochRSICCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
