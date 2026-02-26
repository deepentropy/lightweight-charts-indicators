/**
 * Madrid Trend Squeeze
 *
 * Three EMA-based histograms showing trend direction and squeeze.
 * CMA = close - EMA(close, length)
 * RMA = EMA(close, ref) - EMA(close, length)
 * SMA = EMA(close, sqzLen) - EMA(close, length)
 *
 * Reference: TradingView "Madrid Trend Squeeze"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MadridTrendSqueezeInputs {
  length: number;
  ref: number;
  sqzLen: number;
}

export const defaultInputs: MadridTrendSqueezeInputs = {
  length: 34,
  ref: 13,
  sqzLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 34, min: 1 },
  { id: 'ref', type: 'int', title: 'Reference Length', defval: 13, min: 1 },
  { id: 'sqzLen', type: 'int', title: 'Squeeze Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CMA', color: '#00BCD4', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'RMA', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot2', title: 'SMA', color: '#00E676', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Madrid Trend Squeeze',
  shortTitle: 'MTS',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MadridTrendSqueezeInputs> = {}): IndicatorResult {
  const { length, ref, sqzLen } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'close');
  const closeSeries = getSourceSeries(bars, 'close');
  const maMain = ta.ema(src, length);
  const maRef = ta.ema(src, ref);
  const maSqz = ta.ema(src, sqzLen);

  const cma = closeSeries.sub(maMain);
  const rma = maRef.sub(maMain);
  const sma2 = maSqz.sub(maMain);

  const cmaArr = cma.toArray();
  const rmaArr = rma.toArray();
  const smaArr = sma2.toArray();

  const warmup = length;

  const cmaPlot = cmaArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const color = v > 0 ? '#00BCD4' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });

  const rmaPlot = rmaArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    // Yellow on zero cross, green if positive, maroon if negative
    const prev = i > 0 ? (rmaArr[i - 1] ?? 0) : 0;
    const cross = (prev <= 0 && v > 0) || (prev >= 0 && v < 0);
    const color = cross ? '#FFEB3B' : v > 0 ? '#26A69A' : '#800000';
    return { time: bars[i].time, value: v, color };
  });

  const smaPlot = smaArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const color = v > 0 ? '#00E676' : '#FF5252';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': cmaPlot, 'plot1': rmaPlot, 'plot2': smaPlot },
  };
}

export const MadridTrendSqueeze = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
