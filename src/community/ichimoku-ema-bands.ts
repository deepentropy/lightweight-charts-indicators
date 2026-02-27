/**
 * Ichimoku EMA Bands
 *
 * Ichimoku cloud with EMA-based ATR bands.
 * Base EMA + ATR upper/lower bands, standard Tenkan/Kijun with conditional color,
 * and displaced Senkou spans with cloud fill.
 *
 * Reference: TradingView "Ichimoku EMA Bands" (community)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface IchimokuEMABandsInputs {
  convLen: number;
  baseLen: number;
  emaLen: number;
  atrLength: number;
  atrMult: number;
  laggingSpan2Periods: number;
  displacement: number;
}

export const defaultInputs: IchimokuEMABandsInputs = {
  convLen: 5,
  baseLen: 26,
  emaLen: 26,
  atrLength: 200,
  atrMult: 2.272,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'convLen', type: 'int', title: 'Conversion Length', defval: 5, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Base Length', defval: 26, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 26, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 2.272, min: 0.1, step: 0.001 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Lagging Span 2 Periods', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema', title: 'EMA', color: '#FFA500', lineWidth: 1 },
  { id: 'emaUp', title: 'EMA Upper Band', color: '#EF5350', lineWidth: 1 },
  { id: 'emaDw', title: 'EMA Lower Band', color: '#26A69A', lineWidth: 1 },
  { id: 'conversion', title: 'Conversion Line', color: '#EF5350', lineWidth: 1 },
  { id: 'base', title: 'Base Line', color: '#2962FF', lineWidth: 2 },
  { id: 'lead1', title: 'Senkou Span A', color: '#26A69A', lineWidth: 1 },
  { id: 'lead2', title: 'Senkou Span B', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku EMA Bands',
  shortTitle: 'Ichi EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IchimokuEMABandsInputs> = {}): IndicatorResult {
  const { convLen, baseLen, emaLen, atrLength, atrMult, laggingSpan2Periods, displacement } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = getSourceSeries(bars, 'close');

  // Pine: out = ema(src, len)
  const emaArr = ta.ema(closeSeries, emaLen).toArray();

  // Pine: ATR = rma(tr(true), ATRlength)
  const atrArr = ta.atr(bars, atrLength).toArray();

  // Ichimoku donchian channels
  const convHighArr = ta.highest(highSeries, convLen).toArray();
  const convLowArr = ta.lowest(lowSeries, convLen).toArray();
  const baseHighArr = ta.highest(highSeries, baseLen).toArray();
  const baseLowArr = ta.lowest(lowSeries, baseLen).toArray();
  const span2HighArr = ta.highest(highSeries, laggingSpan2Periods).toArray();
  const span2LowArr = ta.lowest(lowSeries, laggingSpan2Periods).toArray();

  const warmup = Math.max(convLen, baseLen, emaLen, atrLength);

  // Pre-compute tenkan and kijun values
  const tenkanVals: number[] = new Array(n);
  const kijunVals: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tenkanVals[i] = i < convLen ? NaN : (convHighArr[i] + convLowArr[i]) / 2;
    kijunVals[i] = i < baseLen ? NaN : (baseHighArr[i] + baseLowArr[i]) / 2;
  }

  // Pine: plot(out, title="EMA", color=orange, transp=85)
  const emaPlot = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < emaLen) ? NaN : v,
  }));

  // Pine: emaup = out+(ATR*ATRMult), emadw = out-(ATR*ATRMult)
  const emaUpPlot = bars.map((b, i) => {
    const e = emaArr[i];
    const a = atrArr[i];
    if (e == null || a == null || i < warmup) return { time: b.time, value: NaN };
    return { time: b.time, value: e + a * atrMult };
  });
  const emaDwPlot = bars.map((b, i) => {
    const e = emaArr[i];
    const a = atrArr[i];
    if (e == null || a == null || i < warmup) return { time: b.time, value: NaN };
    return { time: b.time, value: e - a * atrMult };
  });

  // Pine: plot(conversionLine, color=red)
  const convPlot = tenkanVals.map((v, i) => ({
    time: bars[i].time,
    value: v,
  }));

  // Pine: kjuncol = conversionLine > baseLine ? blue : conversionLine < baseLine ? red : orange
  // plot(baseLine, color=kjuncol, linewidth=2)
  const basePlot = kijunVals.map((v, i) => {
    const conv = tenkanVals[i];
    const base = v;
    let color: string;
    if (isNaN(conv) || isNaN(base)) {
      color = '#FFA500'; // orange
    } else if (conv > base) {
      color = '#2962FF'; // blue
    } else if (conv < base) {
      color = '#EF5350'; // red
    } else {
      color = '#FFA500'; // orange
    }
    return { time: bars[i].time, value: v, color };
  });

  // Lead lines with displacement
  const lead1Plot: { time: number; value: number }[] = [];
  const lead2Plot: { time: number; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    const srcIdx = i - displacement;
    if (srcIdx < 0 || isNaN(tenkanVals[srcIdx]) || isNaN(kijunVals[srcIdx])) {
      lead1Plot.push({ time: bars[i].time, value: NaN });
    } else {
      lead1Plot.push({ time: bars[i].time, value: (tenkanVals[srcIdx] + kijunVals[srcIdx]) / 2 });
    }

    if (srcIdx < 0 || srcIdx < laggingSpan2Periods) {
      lead2Plot.push({ time: bars[i].time, value: NaN });
    } else {
      lead2Plot.push({ time: bars[i].time, value: (span2HighArr[srcIdx] + span2LowArr[srcIdx]) / 2 });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'ema': emaPlot,
      'emaUp': emaUpPlot,
      'emaDw': emaDwPlot,
      'conversion': convPlot,
      'base': basePlot,
      'lead1': lead1Plot,
      'lead2': lead2Plot,
    },
    fills: [
      { plot1: 'lead1', plot2: 'lead2', options: { color: 'rgba(192,192,192,0.15)' } },
    ],
  };
}

export const IchimokuEMABands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
