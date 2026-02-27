/**
 * Bull Bear Power Trend
 *
 * Bull/bear power with fills and hlines.
 * BullTrend = (close - lowest50) / atr5
 * BearTrend = (highest50 - close) / atr5
 * Trend = BullTrend - BearTrend
 *
 * Reference: TradingView "Bull Bear Power Trend" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BullBearPowerTrendInputs {
  showRegTrend: boolean;
  regLength: number;
}

export const defaultInputs: BullBearPowerTrendInputs = {
  showRegTrend: false,
  regLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'showRegTrend', type: 'bool', title: 'Show Regression Trend', defval: false },
  { id: 'regLength', type: 'int', title: 'Regression Length', defval: 8, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Trend', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bear Trend', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Trend', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'Bull Power', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot4', title: 'Bear Power', color: '#EF5350', lineWidth: 4, style: 'histogram' },
  { id: 'plot5', title: 'Level 2', color: 'transparent', lineWidth: 0 },
  { id: 'plot6', title: 'Level -2', color: 'transparent', lineWidth: 0 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
  { value: 2, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Bull Zone' } },
  { value: -2, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Bear Zone' } },
];

export const metadata = {
  title: 'Bull Bear Power Trend',
  shortTitle: 'BBPT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BullBearPowerTrendInputs> = {}): IndicatorResult {
  const { showRegTrend, regLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const highest50 = ta.highest(highSeries, 50).toArray();
  const lowest50 = ta.lowest(lowSeries, 50).toArray();
  const atr5 = ta.atr(bars, 5).toArray();

  const bullArr: number[] = new Array(n);
  const bearArr: number[] = new Array(n);
  const trendArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const atr = atr5[i] ?? 1;
    const safeAtr = atr === 0 ? 1 : atr;
    bullArr[i] = ((bars[i].close - (lowest50[i] ?? bars[i].low)) / safeAtr);
    bearArr[i] = -(((highest50[i] ?? bars[i].high) - bars[i].close) / safeAtr);
    trendArr[i] = bullArr[i] + bearArr[i];
  }

  // Optional linear regression on trend
  const trendSeries = new Series(bars, (_b, i) => trendArr[i]);
  const regArr = showRegTrend ? ta.linreg(trendSeries, regLength, 0).toArray() : null;

  const warmup = 50;
  const makePlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  const trendPlot = bars.map((b, i) => {
    if (i < warmup) return { time: b.time, value: NaN };
    if (showRegTrend && regArr) return { time: b.time, value: regArr[i] ?? NaN };
    return { time: b.time, value: trendArr[i] };
  });

  // Histograms: bull power above 0, bear power below 0
  const bullHist = bullArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : Math.max(v, 0),
  }));
  const bearHist = bearArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : Math.min(v, 0),
  }));

  const level2Plot = bars.map((b) => ({ time: b.time, value: 2 }));
  const levelNeg2Plot = bars.map((b) => ({ time: b.time, value: -2 }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': makePlot(bullArr),
      'plot1': makePlot(bearArr),
      'plot2': trendPlot,
      'plot3': bullHist,
      'plot4': bearHist,
      'plot5': level2Plot,
      'plot6': levelNeg2Plot,
    },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    fills: [
      { plot1: 'plot0', plot2: 'plot5', options: { color: 'rgba(0,128,0,0.15)' } },
      { plot1: 'plot1', plot2: 'plot6', options: { color: 'rgba(255,0,0,0.15)' } },
      { plot1: 'plot6', plot2: 'plot5', options: { color: 'rgba(255,255,255,0.12)' } },
    ],
  };
}

export const BullBearPowerTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
