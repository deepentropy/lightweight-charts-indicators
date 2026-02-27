/**
 * RSI Bands [LazyBear]
 *
 * Overlay price-level bands derived from RSI internals.
 * Computes price levels where RSI would equal overbought/oversold thresholds.
 * ub = price level where RSI = obLevel (Resistance)
 * lb = price level where RSI = osLevel (Support)
 * mid = average(ub, lb) (RSI Midline)
 *
 * Reference: TradingView "RSI Bands [LazyBear]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIBandsInputs {
  obLevel: number;
  osLevel: number;
  length: number;
  src: SourceType;
}

export const defaultInputs: RSIBandsInputs = {
  obLevel: 70,
  osLevel: 30,
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'obLevel', type: 'int', title: 'RSI Overbought', defval: 70, min: 50, max: 100 },
  { id: 'osLevel', type: 'int', title: 'RSI Oversold', defval: 30, min: 0, max: 50 },
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
  { id: 'plot2', title: 'RSI Midline', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Bands',
  shortTitle: 'RSIB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RSIBandsInputs> = {}): IndicatorResult {
  const { obLevel, osLevel, length, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // Pine: ep = 2 * length - 1
  const ep = 2 * length - 1;

  // Compute auc = ema(max(src - src[1], 0), ep) and adc = ema(max(src[1] - src, 0), ep)
  // Manual EMA since we need change(src) which is src - src[1]
  const aucArr: number[] = new Array(n).fill(0);
  const adcArr: number[] = new Array(n).fill(0);
  const mult = 2 / (ep + 1);

  for (let i = 1; i < n; i++) {
    const s = srcArr[i] ?? 0;
    const sp = srcArr[i - 1] ?? 0;
    const up = Math.max(s - sp, 0);
    const dn = Math.max(sp - s, 0);

    if (i === 1) {
      aucArr[i] = up;
      adcArr[i] = dn;
    } else {
      aucArr[i] = up * mult + aucArr[i - 1] * (1 - mult);
      adcArr[i] = dn * mult + adcArr[i - 1] * (1 - mult);
    }
  }

  const warmup = ep;

  const plot0: Array<{ time: number; value: number }> = [];
  const plot1: Array<{ time: number; value: number }> = [];
  const plot2: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const s = srcArr[i] ?? 0;

    if (i < warmup) {
      plot0.push({ time: t, value: NaN });
      plot1.push({ time: t, value: NaN });
      plot2.push({ time: t, value: NaN });
      continue;
    }

    const auc = aucArr[i];
    const adc = adcArr[i];

    // Pine: x1 = (length - 1) * ( adc * obLevel / (100-obLevel) - auc)
    const x1 = (length - 1) * (adc * obLevel / (100 - obLevel) - auc);
    // Pine: ub = iff( x1 >= 0, src + x1, src + x1 * (100-obLevel)/obLevel )
    const ub = x1 >= 0 ? s + x1 : s + x1 * (100 - obLevel) / obLevel;

    // Pine: x2 = (length - 1) * ( adc * osLevel / (100-osLevel) - auc)
    const x2 = (length - 1) * (adc * osLevel / (100 - osLevel) - auc);
    // Pine: lb = iff( x2 >= 0, src + x2, src + x2 * (100-osLevel)/osLevel )
    const lb = x2 >= 0 ? s + x2 : s + x2 * (100 - osLevel) / osLevel;

    plot0.push({ time: t, value: ub });
    plot1.push({ time: t, value: lb });
    plot2.push({ time: t, value: (ub + lb) / 2 });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const RSIBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
