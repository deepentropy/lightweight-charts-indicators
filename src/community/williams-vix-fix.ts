/**
 * CM Williams Vix Fix
 *
 * Finds market bottoms using synthetic VIX calculation.
 * WVF = (highest(close, pd) - low) / highest(close, pd) * 100
 * Highlights when WVF exceeds upper Bollinger Band or percentile range.
 *
 * Reference: TradingView "CM_Williams_Vix_Fix" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WilliamsVixFixInputs {
  pd: number;
  bbl: number;
  mult: number;
  lb: number;
  ph: number;
  pl: number;
  hp: boolean;
  sd: boolean;
}

export const defaultInputs: WilliamsVixFixInputs = {
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  pl: 1.01,
  hp: false,
  sd: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pd', type: 'int', title: 'LookBack Period', defval: 22, min: 1 },
  { id: 'bbl', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lb', type: 'int', title: 'Percentile Lookback', defval: 50, min: 1 },
  { id: 'ph', type: 'float', title: 'Highest Percentile', defval: 0.85, min: 0.01, step: 0.01 },
  { id: 'pl', type: 'float', title: 'Lowest Percentile', defval: 1.01, min: 0.01, step: 0.01 },
  { id: 'hp', type: 'bool', title: 'Show High Range', defval: false },
  { id: 'sd', type: 'bool', title: 'Show StdDev Line', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WVF', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Upper Band', color: '#00BCD4', lineWidth: 2 },
  { id: 'plot2', title: 'Range High Pct', color: '#FF9800', lineWidth: 4 },
  { id: 'plot3', title: 'Range Low Pct', color: '#FF9800', lineWidth: 4 },
];

export const metadata = {
  title: 'Williams Vix Fix',
  shortTitle: 'WVF',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsVixFixInputs> = {}): IndicatorResult {
  const { pd, bbl, mult, lb, ph, pl, hp, sd } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highestClose = ta.highest(closeSeries, pd).toArray();

  // WVF
  const wvfArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hc = highestClose[i];
    if (hc == null || hc === 0 || isNaN(hc)) {
      wvfArr[i] = 0;
    } else {
      wvfArr[i] = ((hc - bars[i].low) / hc) * 100;
    }
  }

  // BB on WVF
  const wvfSeries = new Series(bars, (_b, i) => wvfArr[i]);
  const midLine = ta.sma(wvfSeries, bbl).toArray();
  const sDev = ta.stdev(wvfSeries, bbl).toArray();

  // Percentile range
  const wvfHighest = ta.highest(wvfSeries, lb).toArray();
  const wvfLowest = ta.lowest(wvfSeries, lb).toArray();

  const warmup = Math.max(pd, bbl);
  const wvfPlot = wvfArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const upperBand = (midLine[i] ?? 0) + mult * (sDev[i] ?? 0);
    const rangeHigh = (wvfHighest[i] ?? 0) * ph;
    const alert = v >= upperBand || v >= rangeHigh;
    const color = alert ? '#00E676' : '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  // Pine: plot(sd and upperBand ? upperBand : na) - conditional on sd input
  const upperPlot = bars.map((b, i) => {
    if (!sd || i < warmup || midLine[i] == null || sDev[i] == null) return { time: b.time, value: NaN };
    return { time: b.time, value: (midLine[i]!) + mult * (sDev[i]!) };
  });

  // Pine: plot(hp and rangeHigh ? rangeHigh : na) - conditional on hp input
  const rangeHighPlot = wvfHighest.map((v, i) => {
    if (!hp || i < Math.max(warmup, lb) || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v * ph };
  });

  // Pine: rangeLow = lowest(wvf, lb) * pl
  // Pine: plot(hp and rangeLow ? rangeLow : na, title="Range Low Percentile", style=line, linewidth=4, color=orange)
  const rangeLowPlot = wvfLowest.map((v, i) => {
    if (!hp || i < Math.max(warmup, lb) || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v * pl };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': wvfPlot, 'plot1': upperPlot, 'plot2': rangeHighPlot, 'plot3': rangeLowPlot },
  };
}

export const WilliamsVixFix = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
