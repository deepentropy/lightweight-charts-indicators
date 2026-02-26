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
  { id: 'plot0', title: 'Layer 1', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Layer 2', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Layer 3', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Layer 4', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot4', title: 'Layer 5', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot5', title: 'Layer 6', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot6', title: 'Layer 7', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot7', title: 'Layer 8', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot8', title: 'Layer 9', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot9', title: 'Layer 10', color: '#00FF00', lineWidth: 1, style: 'columns' },
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

  // Main trend = layer 0 (the longest period)
  const mainTrend = layers[0];

  const warmup = dlen;
  // 10 stacked column plots, each at a fixed value (5, 10, 15, ..., 50)
  // Color: bright green/red if confirming main trend, dim green/red if diverging
  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};
  for (let l = 0; l < 10; l++) {
    const value = (l + 1) * 5; // 5, 10, 15, ..., 50
    plots[`plot${l}`] = bars.map((b, i) => {
      if (i < warmup) return { time: b.time, value: NaN };
      const mt = mainTrend[i];
      const lt = layers[l][i];
      let color: string;
      if (mt === 1) {
        color = lt === 1 ? '#00FF00' : 'rgba(0,255,0,0.62)';
      } else if (mt === -1) {
        color = lt === -1 ? '#FF0000' : 'rgba(255,0,0,0.62)';
      } else {
        color = '#787B86';
      }
      return { time: b.time, value, color };
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const DonchianTrendRibbon = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
