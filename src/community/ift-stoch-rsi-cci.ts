/**
 * Inverse Fisher Transform COMBO [Stoch + RSI + CCI + MFI]
 *
 * Combines IFT of Stochastic, RSI, CCI, and MFI into a single oscillator.
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
  mfiLength: number;
  wmaLength: number;
}

export const defaultInputs: IFTStochRSICCIInputs = {
  stochLength: 5,
  rsiLength: 5,
  cciLength: 5,
  mfiLength: 5,
  wmaLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 5, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 5, min: 1 },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 5, min: 1 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 5, min: 1 },
  { id: 'wmaLength', type: 'int', title: 'WMA Smoothing', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'IFT Stoch', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'IFT RSI', color: '#000000', lineWidth: 2 },
  { id: 'plot2', title: 'IFT CCI', color: '#EF5350', lineWidth: 3 },
  { id: 'plot3', title: 'IFT MFI', color: '#9C27B0', lineWidth: 2 },
  { id: 'plot4', title: 'Average', color: '#9C27B0', lineWidth: 3 },
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
  const { stochLength, rsiLength, cciLength, mfiLength, wmaLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Raw indicators
  const rawStochArr = ta.stoch(closeSeries, highSeries, lowSeries, stochLength).toArray();
  const rawRsiArr = ta.rsi(closeSeries, rsiLength).toArray();
  const hlc3Series = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const rawCciArr = ta.cci(hlc3Series, cciLength).toArray();

  // Pine MFI calculation:
  // source = hlc3
  // up = sum(volume * (change(source) <= 0 ? 0 : source), mfilength)
  // lo = sum(volume * (change(source) >= 0 ? 0 : source), mfilength)
  // mfi = 100.0 - 100.0 / (1.0 + up / lo)
  const hlc3Arr = hlc3Series.toArray();
  const mfiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < mfiLength) {
      mfiRaw[i] = NaN;
      continue;
    }
    let upSum = 0;
    let loSum = 0;
    for (let j = i - mfiLength + 1; j <= i; j++) {
      const vol = bars[j].volume ?? 0;
      const hlcVal = hlc3Arr[j] ?? 0;
      const prevHlc = j > 0 ? (hlc3Arr[j - 1] ?? 0) : hlcVal;
      const change = hlcVal - prevHlc;
      if (change > 0) {
        upSum += vol * hlcVal;
      } else if (change < 0) {
        loSum += vol * hlcVal;
      }
    }
    mfiRaw[i] = loSum === 0 ? 100 : 100.0 - 100.0 / (1.0 + upSum / loSum);
  }

  // Normalize: Pine uses 0.1*(stoch-50), 0.1*(rsi-50), 0.1*(cci/4), 0.1*(mfi-50)
  const v1Stoch: number[] = new Array(n);
  const v1Rsi: number[] = new Array(n);
  const v1Cci: number[] = new Array(n);
  const v1Mfi: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    v1Stoch[i] = 0.1 * ((rawStochArr[i] ?? 50) - 50);
    v1Rsi[i] = 0.1 * ((rawRsiArr[i] ?? 50) - 50);
    v1Cci[i] = 0.1 * ((rawCciArr[i] ?? 0) / 4);
    v1Mfi[i] = 0.1 * ((isNaN(mfiRaw[i]) ? 50 : mfiRaw[i]) - 50);
  }

  // WMA smoothing
  const v2StochArr = ta.wma(new Series(bars, (_b, i) => v1Stoch[i]), wmaLength).toArray();
  const v2RsiArr = ta.wma(new Series(bars, (_b, i) => v1Rsi[i]), wmaLength).toArray();
  const v2CciArr = ta.wma(new Series(bars, (_b, i) => v1Cci[i]), wmaLength).toArray();
  const v2MfiArr = ta.wma(new Series(bars, (_b, i) => v1Mfi[i]), wmaLength).toArray();

  const warmup = Math.max(stochLength, rsiLength, cciLength, mfiLength) + wmaLength;

  const plot0Data: { time: number | string; value: number }[] = [];
  const plot1Data: { time: number | string; value: number }[] = [];
  const plot2Data: { time: number | string; value: number }[] = [];
  const plot3Data: { time: number | string; value: number }[] = [];
  const plot4Data: { time: number | string; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup || v2StochArr[i] == null || v2RsiArr[i] == null || v2CciArr[i] == null || v2MfiArr[i] == null) {
      plot0Data.push({ time: bars[i].time, value: NaN });
      plot1Data.push({ time: bars[i].time, value: NaN });
      plot2Data.push({ time: bars[i].time, value: NaN });
      plot3Data.push({ time: bars[i].time, value: NaN });
      plot4Data.push({ time: bars[i].time, value: NaN });
    } else {
      const iftStoch = ift(v2StochArr[i]!);
      const iftRsi = ift(v2RsiArr[i]!);
      const iftCci = ift(v2CciArr[i]!);
      const iftMfi = ift(v2MfiArr[i]!);
      const avg = (iftStoch + iftRsi + iftCci + iftMfi) / 4;
      plot0Data.push({ time: bars[i].time, value: iftStoch });
      plot1Data.push({ time: bars[i].time, value: iftRsi });
      plot2Data.push({ time: bars[i].time, value: iftCci });
      plot3Data.push({ time: bars[i].time, value: iftMfi });
      plot4Data.push({ time: bars[i].time, value: avg });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0Data, 'plot1': plot1Data, 'plot2': plot2Data, 'plot3': plot3Data, 'plot4': plot4Data },
    hlines: [
      { value: 0.5, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: -0.5, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
  };
}

export const IFTStochRSICCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
