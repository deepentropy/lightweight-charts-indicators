/**
 * Auto-Support v0.3
 *
 * Pine: overlay=true, 28 pairs of resistance (highest) and support (lowest) lines
 * at various multipliers of a sensitivity parameter.
 * Each pair: resistance = highest(close, sensitivity * mult), support = lowest(close, sensitivity * mult)
 *
 * Pine uses offset=-9999 with trackprice=true so only the latest value shows as a horizontal line.
 * In lightweight-charts we render full time-series since trackprice is unavailable.
 *
 * Multipliers: 1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,75,100,150,200,250,300,350,400,450,500
 *
 * Reference: TradingView "Auto-Support v 0.3" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoSupportInputs {
  sensitivity: number;
}

export const defaultInputs: AutoSupportInputs = {
  sensitivity: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 10, min: 1, max: 10 },
];

const MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500];

// Pine: b = #FF0000 (resistance), c = #0000FF (support), transp=85 default
// 85% transparency = 0.15 alpha → rgba
const R_COLOR = 'rgba(255,0,0,0.15)';
const S_COLOR = 'rgba(0,0,255,0.15)';

// Generate plotConfig for all 56 plots (28 resistance + 28 support)
export const plotConfig: PlotConfig[] = MULTIPLIERS.flatMap((m) => [
  { id: `r${m}`, title: `Resistance ${m}x`, color: R_COLOR, lineWidth: 2 },
  { id: `s${m}`, title: `Support ${m}x`, color: S_COLOR, lineWidth: 2 },
]);

export const metadata = {
  title: 'Auto-Support',
  shortTitle: 'AutoSup',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AutoSupportInputs> = {}): IndicatorResult {
  const { sensitivity } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  const plots: Record<string, { time: number; value: number }[]> = {};

  for (const m of MULTIPLIERS) {
    const len = sensitivity * m;
    // Pine: highest(a*N) = highest(close, a*N), lowest(a*N) = lowest(close, a*N)
    const highArr = ta.highest(closeSeries, Math.max(len, 1)).toArray();
    const lowArr = ta.lowest(closeSeries, Math.max(len, 1)).toArray();

    const rPlot = new Array(n);
    const sPlot = new Array(n);
    for (let i = 0; i < n; i++) {
      const ready = i >= len - 1;
      rPlot[i] = { time: bars[i].time, value: ready ? highArr[i] : NaN };
      sPlot[i] = { time: bars[i].time, value: ready ? lowArr[i] : NaN };
    }
    plots[`r${m}`] = rPlot;
    plots[`s${m}`] = sPlot;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const AutoSupport = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
