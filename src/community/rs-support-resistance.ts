/**
 * [RS] Support and Resistance V0
 *
 * Pivot-based support and resistance levels.
 * Uses ta.pivothigh/pivotlow to detect swing highs/lows,
 * then extends the last detected levels horizontally.
 *
 * Reference: TradingView "[RS]Support and Resistance V0" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RSSupportResistanceInputs {
  leftBars: number;
  rightBars: number;
  window1: number;
  window2: number;
  tradeZonePct: number;
}

export const defaultInputs: RSSupportResistanceInputs = {
  leftBars: 10,
  rightBars: 10,
  window1: 8,
  window2: 21,
  tradeZonePct: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 10, min: 1 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 10, min: 1 },
  { id: 'window1', type: 'int', title: 'Short-term Window', defval: 8, min: 1 },
  { id: 'window2', type: 'int', title: 'Long-term Window', defval: 21, min: 1 },
  { id: 'tradeZonePct', type: 'float', title: 'Trade Zone %', defval: 25, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
  { id: 'plot2', title: 'Long-term Resist', color: 'rgba(33,150,243,0.3)', lineWidth: 4 },
  { id: 'plot3', title: 'Long-term Support', color: 'rgba(33,150,243,0.3)', lineWidth: 4 },
  { id: 'plot4', title: 'Resist Trade Limit', color: '#EF5350', lineWidth: 1 },
  { id: 'plot5', title: 'Support Trade Limit', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: '[RS] Support and Resistance V0',
  shortTitle: 'RS S/R',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RSSupportResistanceInputs> = {}): IndicatorResult {
  const { leftBars, rightBars, window1, window2, tradeZonePct } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  const warmup = leftBars + rightBars;
  let lastResistance = NaN;
  let lastSupport = NaN;

  const resistancePlot: Array<{ time: number; value: number }> = [];
  const supportPlot: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < n; i++) {
    if (i >= warmup && !isNaN(phArr[i]) && phArr[i] !== 0) {
      lastResistance = phArr[i];
    }
    if (i >= warmup && !isNaN(plArr[i]) && plArr[i] !== 0) {
      lastSupport = plArr[i];
    }
    resistancePlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastResistance });
    supportPlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastSupport });
  }

  // Pine long-term S/R: valuewhen(h >= highest(h, window2), h, 0)
  const hhW2 = ta.highest(highSeries, window2).toArray();
  const llW2 = ta.lowest(lowSeries, window2).toArray();
  const ltWarmup = Math.max(warmup, window2);

  let ltTop = NaN;
  let ltBot = NaN;
  const ltResistArr: number[] = new Array(n);
  const ltSupportArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i >= window2) {
      if (bars[i].high >= (hhW2[i] ?? 0)) ltTop = bars[i].high;
      if (bars[i].low <= (llW2[i] ?? Infinity)) ltBot = bars[i].low;
    }
    ltResistArr[i] = ltTop;
    ltSupportArr[i] = ltBot;
  }

  // Show as linebr: na when value changes
  const ltResistPlot = ltResistArr.map((v, i) => {
    if (i < ltWarmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const changed = i > 0 && ltResistArr[i] !== ltResistArr[i - 1];
    return { time: bars[i].time, value: changed ? NaN : v };
  });
  const ltSupportPlot = ltSupportArr.map((v, i) => {
    if (i < ltWarmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const changed = i > 0 && ltSupportArr[i] !== ltSupportArr[i - 1];
    return { time: bars[i].time, value: changed ? NaN : v };
  });

  // Trade zone limits: Pine uses short_term values but we use our existing resist/support
  const pctMult = tradeZonePct / 100;
  const resistTradePlot = resistancePlot.map((p, i) => {
    const r = p.value;
    const s = supportPlot[i].value;
    if (isNaN(r) || isNaN(s)) return { time: bars[i].time, value: NaN };
    const diff = r - s;
    return { time: bars[i].time, value: r - diff * pctMult };
  });
  const supportTradePlot = supportPlot.map((p, i) => {
    const r = resistancePlot[i].value;
    const s = p.value;
    if (isNaN(r) || isNaN(s)) return { time: bars[i].time, value: NaN };
    const diff = r - s;
    return { time: bars[i].time, value: s + diff * pctMult };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': resistancePlot,
      'plot1': supportPlot,
      'plot2': ltResistPlot,
      'plot3': ltSupportPlot,
      'plot4': resistTradePlot,
      'plot5': supportTradePlot,
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(255,152,0,0.2)' } },
      { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(128,128,0,0.2)' } },
    ],
  };
}

export const RSSupportResistance = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
