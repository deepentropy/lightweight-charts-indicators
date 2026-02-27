/**
 * EMA Enveloper
 *
 * EMA with high/low envelope bands.
 * upper = ema(high, length), lower = ema(low, length).
 *
 * Reference: TradingView "EMA Enveloper" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface EMAEnveloperInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: EMAEnveloperInputs = {
  length: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Enveloper',
  shortTitle: 'EMAE',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAEnveloperInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { length, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  // Pine: e = ema(close, length), eu = ema(high, length), el = ema(low, length)
  const emaArr = ta.ema(srcSeries, length).toArray();
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const euArr = ta.ema(highSeries, length).toArray();
  const elArr = ta.ema(lowSeries, length).toArray();

  const plot0 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : (v ?? NaN),
  }));

  const plot1 = euArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : (v ?? NaN),
  }));

  const plot2 = elArr.map((v, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : (v ?? NaN),
  }));

  const fillColors = bars.map((_b, i) => (i < length ? 'transparent' : '#2962FF20'));

  // Background color: bull/bear/sidewise based on price vs envelope bands
  // Pine: bull_f = high > eu AND low > el, bear_f = high < eu AND low < el
  const bgColors: BgColorData[] = [];
  for (let i = length; i < bars.length; i++) {
    const upper = euArr[i] ?? NaN;
    const lower = elArr[i] ?? NaN;
    if (isNaN(upper) || isNaN(lower)) continue;
    const h = bars[i].high;
    const l = bars[i].low;
    const bullF = h > upper && l > lower;
    const bearF = h < upper && l < lower;
    if (bullF) {
      // Strong bull if low > upper, else normal bull
      const color = l > upper ? 'rgba(0,230,118,0.1)' : 'rgba(38,166,154,0.1)';
      bgColors.push({ time: bars[i].time, color });
    } else if (bearF) {
      // Strong bear if high < lower, else normal bear
      const color = h < lower ? 'rgba(239,83,80,0.1)' : 'rgba(255,152,0,0.1)';
      bgColors.push({ time: bars[i].time, color });
    } else {
      bgColors.push({ time: bars[i].time, color: 'rgba(33,150,243,0.1)' }); // sidewise
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
    bgColors,
  };
}

export const EMAEnveloper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
