/**
 * Volume Price Confirmation Indicator (VPCI)
 *
 * Combines VWMA, SMA, and volume ratios to confirm price-volume trends.
 * VPCI = VPC * VPR * VM
 * where VPC = VWMA(long) - SMA(long), VPR = VWMA(short) / SMA(short),
 * VM = SMA(vol, short) / SMA(vol, long)
 *
 * Reference: TradingView "Volume Price Confirmation Indicator [LazyBear]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VPCIInputs {
  longLength: number;
  shortLength: number;
  signalLength: number;
}

export const defaultInputs: VPCIInputs = {
  longLength: 30,
  shortLength: 5,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 30, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VPCI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Price Confirmation Indicator',
  shortTitle: 'VPCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VPCIInputs> = {}): IndicatorResult {
  const { longLength, shortLength, signalLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = getSourceSeries(bars, 'close');
  const volSeries = new Series(bars, (b) => b.volume ?? 0);

  const vwmaLongArr = ta.vwma(closeSeries, longLength, volSeries).toArray();
  const smaLongArr = ta.sma(closeSeries, longLength).toArray();
  const vwmaShortArr = ta.vwma(closeSeries, shortLength, volSeries).toArray();
  const smaShortArr = ta.sma(closeSeries, shortLength).toArray();
  const smaVolShortArr = ta.sma(volSeries, shortLength).toArray();
  const smaVolLongArr = ta.sma(volSeries, longLength).toArray();

  const vpciArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vwmaL = vwmaLongArr[i];
    const smaL = smaLongArr[i];
    const vwmaS = vwmaShortArr[i];
    const smaS = smaShortArr[i];
    const volS = smaVolShortArr[i];
    const volL = smaVolLongArr[i];

    if (isNaN(vwmaL) || isNaN(smaL) || isNaN(vwmaS) || isNaN(smaS) || isNaN(volS) || isNaN(volL) || smaS === 0 || volL === 0) {
      vpciArr[i] = 0;
    } else {
      const vpc = vwmaL - smaL;
      const vpr = vwmaS / smaS;
      const vm = volS / volL;
      vpciArr[i] = vpc * vpr * vm;
    }
  }

  const vpciSeries = new Series(bars, (_b, i) => vpciArr[i]);
  const signalArr = ta.ema(vpciSeries, signalLength).toArray();

  const warmup = longLength;

  const plot0 = vpciArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const VPCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
