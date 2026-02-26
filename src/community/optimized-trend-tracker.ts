/**
 * Optimized Trend Tracker (OTT)
 *
 * Smoothed moving average with percentage-based trailing stop.
 * Support line (MA) determines trend direction;
 * OTT = MA * (200 ± percent) / 200 based on which side of trailing stop.
 *
 * Reference: TradingView "Optimized Trend Tracker" by KivancOzbilgic
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface OTTInputs {
  source: SourceType;
  period: number;
  percent: number;
}

export const defaultInputs: OTTInputs = {
  source: 'close',
  period: 2,
  percent: 1.4,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Percent', defval: 1.4, min: 0, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
  { id: 'plot1', title: 'OTT', color: '#B800D9', lineWidth: 2 },
];

export const metadata = {
  title: 'Optimized Trend Tracker',
  shortTitle: 'OTT',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<OTTInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { source, period, percent } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Default MA type is VAR (Variable Index Dynamic Average)
  const src = getSourceSeries(bars, source);
  const srcArr = src.toArray();

  // VAR calculation (VIDYA-like using CMO)
  const valpha = 2 / (period + 1);
  const mavg: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i] ?? 0;
    // Compute CMO over 9 bars
    let vUD = 0;
    let vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      const cur = srcArr[j] ?? 0;
      const prev = j > 0 ? (srcArr[j - 1] ?? 0) : cur;
      if (cur > prev) vUD += cur - prev;
      if (cur < prev) vDD += prev - cur;
    }
    const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
    mavg[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * mavg[i - 1];
  }

  // Trailing stop logic
  const fark = mavg.map((v) => v * percent * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mavg[i] - fark[i];
    shortStop[i] = mavg[i] + fark[i];

    if (i > 0) {
      if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = period + 9;
  const plot0 = mavg.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  // OTT is plotted with 2-bar offset like the original
  const plot1 = ott.map((_v, i) => ({ time: bars[i].time, value: i < warmup + 2 ? NaN : ott[i - 2] }));

  // Markers: buy when MAvg crosses above OTT[2], sell when crosses below
  const markers: MarkerData[] = [];
  for (let i = warmup + 3; i < n; i++) {
    const ottLag = ott[i - 2];
    const ottLagPrev = ott[i - 3];
    if (mavg[i - 1] <= ottLagPrev && mavg[i] > ottLag) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#2962FF', text: 'Buy' });
    } else if (mavg[i - 1] >= ottLagPrev && mavg[i] < ottLag) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF6D00', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: '#0585E1' } }],
    markers,
  };
}

export const OptimizedTrendTracker = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
