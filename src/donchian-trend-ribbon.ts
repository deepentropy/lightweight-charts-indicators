/**
 * Donchian Trend Ribbon
 *
 * 10 layers of Donchian breakout trend detection at different lengths.
 * Main trend at dlen, sub-trends at dlen-1 through dlen-9.
 * Each layer outputs +1 (bullish) or -1 (bearish).
 *
 * Reference: TradingView "Donchian Trend Ribbon" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DonchianTrendRibbonInputs {
  dlen: number;
}

export const defaultInputs: DonchianTrendRibbonInputs = {
  dlen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'dlen', type: 'int', title: 'Donchian Channel Period', defval: 20, min: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Sum', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Donchian Trend Ribbon',
  shortTitle: 'DTR',
  overlay: false,
};

function dchannel(bars: Bar[], len: number): number[] {
  const highSeries = new Series(bars, (bar) => bar.high);
  const lowSeries = new Series(bars, (bar) => bar.low);
  const hh = ta.highest(highSeries, len).toArray();
  const ll = ta.lowest(lowSeries, len).toArray();

  const trend: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const close = bars[i].close;
    const prevHh = i > 0 ? (hh[i - 1] ?? 0) : 0;
    const prevLl = i > 0 ? (ll[i - 1] ?? 0) : 0;

    if (close > prevHh) {
      trend.push(1);
    } else if (close < prevLl) {
      trend.push(-1);
    } else {
      trend.push(i > 0 ? trend[i - 1] : 0);
    }
  }
  return trend;
}

export function calculate(bars: Bar[], inputs: Partial<DonchianTrendRibbonInputs> = {}): IndicatorResult {
  const { dlen } = { ...defaultInputs, ...inputs };

  // Compute 10 trend layers at dlen, dlen-1, ..., dlen-9
  const layers: number[][] = [];
  for (let offset = 0; offset < 10; offset++) {
    layers.push(dchannel(bars, dlen - offset));
  }

  // Sum all layer trends for a composite score (-10 to +10)
  const sumArr = bars.map((_, i) => {
    let sum = 0;
    for (let l = 0; l < 10; l++) {
      sum += layers[l][i];
    }
    return sum;
  });

  const warmup = dlen;
  const data = sumArr.map((value, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : value,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
  };
}

export const DonchianTrendRibbon = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
