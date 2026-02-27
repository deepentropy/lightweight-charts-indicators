/**
 * CM RSI Plus EMA
 *
 * RSI with EMA overlay applied to the RSI line.
 * Useful for identifying RSI trend direction and crossover signals.
 *
 * Reference: TradingView "CM_RSI Plus EMA" by ChrisMoody
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface CMRSIPlusEMAInputs {
  rsiLen: number;
  emaLen: number;
  src: SourceType;
}

export const defaultInputs: CMRSIPlusEMAInputs = {
  rsiLen: 20,
  emaLen: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 20, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA of RSI Length', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'EMA of RSI', color: '#FF6D00', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Upper Band', color: 'transparent', lineWidth: 0 },
  { id: 'plot3', title: 'Lower Band', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'CM RSI Plus EMA',
  shortTitle: 'CMRSIEMA',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMRSIPlusEMAInputs> = {}): IndicatorResult {
  const { rsiLen, emaLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // EMA of RSI computed bar-by-bar
  const alpha = 2 / (emaLen + 1);
  const emaArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const r = rsiArr[i];
    if (r == null) {
      emaArr[i] = NaN;
    } else if (i === 0 || isNaN(emaArr[i - 1])) {
      emaArr[i] = r;
    } else {
      emaArr[i] = alpha * r + (1 - alpha) * emaArr[i - 1];
    }
  }

  const warmup = rsiLen;

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  const plot2 = bars.map((b) => ({ time: b.time, value: 80 }));
  const plot3 = bars.map((b) => ({ time: b.time, value: 20 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 80, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper Line' } },
      { value: 20, options: { color: '#00E676', linestyle: 'dashed' as const, title: 'Lower Line' } },
    ],
    fills: [
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(126,87,194,0.1)' } },
    ],
  };
}

export const CMRSIPlusEMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
