/**
 * CM Sling Shot System
 *
 * Two-EMA crossover system that keeps traders on the trending side of the market.
 * EMA cloud with silver fill, bar coloring for pullback (yellow) and entry (aqua)
 * signals, persistent per-bar trend triangles, and conservative entry arrows.
 *
 * Reference: TradingView "CM Sling Shot System" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface CMSlingShotInputs {
  emaFast: number;
  emaSlow: number;
}

export const defaultInputs: CMSlingShotInputs = {
  emaFast: 38,
  emaSlow: 62,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA Length', defval: 38, min: 1 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA Length', defval: 62, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA Fast', color: '#00FF00', lineWidth: 2 },
  { id: 'plot1', title: 'EMA Slow', color: '#00FF00', lineWidth: 4 },
];

export const metadata = {
  title: 'CM Sling Shot System',
  shortTitle: 'CMSlShot',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMSlingShotInputs> = {}): IndicatorResult & { barColors: BarColorData[]; markers: MarkerData[] } {
  const { emaFast, emaSlow } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const emaFastArr = ta.ema(closeSeries, emaFast).toArray();
  const emaSlowArr = ta.ema(closeSeries, emaSlow).toArray();

  const warmup = emaSlow;
  const barColors: BarColorData[] = [];
  const fillColors: string[] = [];

  // Pine: col = emaFast > emaSlow ? lime : emaFast < emaSlow ? red : yellow
  const getColor = (fast: number, slow: number): string =>
    fast > slow ? '#00FF00' : fast < slow ? '#FF0000' : '#FFFF00';

  const fastPlot = emaFastArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const slow = emaSlowArr[i] ?? 0;
    return { time: bars[i].time, value: v, color: getColor(v, slow) };
  });

  const slowPlot = emaSlowArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const fast = emaFastArr[i] ?? 0;
    return { time: bars[i].time, value: v, color: getColor(fast, v) };
  });

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillColors.push('transparent');
      continue;
    }

    const close = bars[i].close;
    const prevClose = i > 0 ? bars[i - 1].close : close;
    const fast = emaFastArr[i] ?? 0;
    const slow = emaSlowArr[i] ?? 0;
    const prevFast = i > 0 ? (emaFastArr[i - 1] ?? 0) : fast;

    // Pine: fill(p1, p2, color=silver, transp=50) => #C0C0C080
    fillColors.push('#C0C0C080');

    // Pine barcolor logic: second barcolor overrides first when both match.
    // 1st: pullbackUpT (fast>slow && close<fast) => yellow
    //      pullbackDnT (fast<slow && close>fast) => yellow
    // 2nd: entryUpT (fast>slow && close[1]<fast && close>fast) => aqua
    //      entryDnT (fast<slow && close[1]>fast && close<fast) => aqua
    const pullbackUp = fast > slow && close < fast;
    const pullbackDn = fast < slow && close > fast;
    const entryUp = fast > slow && prevClose < prevFast && close > fast;
    const entryDn = fast < slow && prevClose > prevFast && close < fast;

    // Second barcolor overrides first in Pine
    if (entryUp || entryDn) {
      barColors.push({ time: bars[i].time as number, color: '#00FFFF' }); // aqua
    } else if (pullbackUp || pullbackDn) {
      barColors.push({ time: bars[i].time as number, color: '#FFFF00' }); // yellow
    }
    // No barcolor push when neither condition met (leave candle default)
  }

  // Markers: persistent trend triangles every bar + conservative entry arrows
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    const fast = emaFastArr[i] ?? 0;
    const slow = emaSlowArr[i] ?? 0;
    const prevFast = i > 0 ? (emaFastArr[i - 1] ?? 0) : fast;
    const close = bars[i].close;
    const prevClose = i > 0 ? bars[i - 1].close : close;

    // Pine: plotshape(st and upTrend, style=shape.triangleup, location=location.bottom, color=lime)
    // Persistent every-bar trend triangles
    if (fast >= slow) {
      markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: '' });
    }
    // Pine: plotshape(st and downTrend, style=shape.triangledown, location=location.top, color=red)
    if (fast < slow) {
      markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: '' });
    }

    // Pine: plotarrow(pa and codiff, colorup=lime) - conservative entry up
    if (fast > slow && prevClose < prevFast && close > fast) {
      markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'Buy' });
    }
    // Pine: plotarrow(pa and codiff2*-1, colordown=red) - conservative entry down
    if (fast < slow && prevClose > prevFast && close < fast) {
      markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': fastPlot, 'plot1': slowPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
    barColors,
    markers,
  };
}

export const CMSlingShot = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
