/**
 * Awesome Oscillator V2
 *
 * AO with signal line.
 * AO = SMA(hl2, fast) - SMA(hl2, slow)
 * Signal = SMA(AO, signal)
 *
 * Reference: TradingView "Awesome Oscillator V2" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AwesomeOscillatorV2Inputs {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export const defaultInputs: AwesomeOscillatorV2Inputs = {
  fastPeriod: 5,
  slowPeriod: 34,
  signalPeriod: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast Period', defval: 5, min: 1 },
  { id: 'slowPeriod', type: 'int', title: 'Slow Period', defval: 34, min: 1 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 7, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#2962FF', lineWidth: 2 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Awesome Oscillator V2',
  shortTitle: 'AOv2',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AwesomeOscillatorV2Inputs> = {}): IndicatorResult {
  const { fastPeriod, slowPeriod, signalPeriod } = { ...defaultInputs, ...inputs };

  const hl2 = getSourceSeries(bars, 'hl2');
  const fastSMA = ta.sma(hl2, fastPeriod);
  const slowSMA = ta.sma(hl2, slowPeriod);
  const ao = fastSMA.sub(slowSMA);
  const signal = ta.sma(ao, signalPeriod);

  const aoArr = ao.toArray();
  const signalArr = signal.toArray();
  const warmup = slowPeriod;

  const aoPlot = aoArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  const signalPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup + signalPeriod - 1 || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': aoPlot, 'plot1': signalPlot },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const AwesomeOscillatorV2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
