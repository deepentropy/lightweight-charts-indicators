/**
 * CM Sling Shot System
 *
 * Two-EMA crossover system with bar coloring for trend and pullback zones.
 * Fill between EMAs indicates overall trend; bar colors show four states:
 * aggressive long, pullback in uptrend, aggressive short, pullback in downtrend.
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
  { id: 'plot0', title: 'EMA Fast', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'EMA Slow', color: '#FF6D00', lineWidth: 2 },
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

  const fastPlot = emaFastArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const slow = emaSlowArr[i] ?? 0;
    const color = v > slow ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const slowPlot = emaSlowArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const fast = emaFastArr[i] ?? 0;
    const color = fast > v ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillColors.push('transparent');
      continue;
    }

    const close = bars[i].close;
    const fast = emaFastArr[i] ?? 0;
    const slow = emaSlowArr[i] ?? 0;

    // Fill color
    fillColors.push(fast > slow ? '#26A69A80' : '#EF535080');

    // Bar color
    let barColor: string;
    if (close > fast && fast > slow) {
      barColor = '#00E676'; // Lime - aggressive long
    } else if (close < fast && close > slow && fast > slow) {
      barColor = '#00BCD4'; // Aqua - pullback in uptrend
    } else if (close < fast && fast < slow) {
      barColor = '#B71C1C'; // Maroon - aggressive short
    } else if (close > fast && close < slow && fast < slow) {
      barColor = '#FF6D00'; // Orange - pullback in downtrend
    } else {
      barColor = fast > slow ? '#26A69A' : '#EF5350';
    }
    barColors.push({ time: bars[i].time as number, color: barColor });
  }

  // Markers: persistent trend triangles every bar + conservative entry arrows
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    const fast = emaFastArr[i] ?? 0;
    const slow = emaSlowArr[i] ?? 0;
    const prevFast = emaFastArr[i - 1] ?? 0;
    const prevSlow = emaSlowArr[i - 1] ?? 0;
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    // Pine: plotshape(st and upTrend, style=shape.triangleup, location=location.bottom, color=lime)
    // Persistent every-bar trend triangles
    if (fast >= slow) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#00E676', text: '' });
    }
    // Pine: plotshape(st and downTrend, style=shape.triangledown, location=location.top, color=red)
    if (fast < slow) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: '' });
    }

    // Conservative entry: close crosses above fast EMA in uptrend
    if (fast > slow && prevClose < prevFast && close > fast) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00E676', text: 'Buy' });
    }
    // Conservative entry: close crosses below fast EMA in downtrend
    if (fast < slow && prevClose > prevFast && close < fast) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
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
