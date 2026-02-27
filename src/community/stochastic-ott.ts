/**
 * Stochastic OTT
 *
 * Optimized Trend Tracker applied to Stochastic oscillator.
 * Calculates Stochastic K, applies OTT trailing stop logic.
 *
 * Reference: TradingView "Stochastic OTT" by Anilcan Ozcan
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface StochasticOTTInputs {
  kLen: number;
  kSmooth: number;
  ottPct: number;
  showSupport: boolean;
}

export const defaultInputs: StochasticOTTInputs = {
  kLen: 14,
  kSmooth: 3,
  ottPct: 1.0,
  showSupport: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'ottPct', type: 'float', title: 'OTT Percent', defval: 1.0, min: 0.01, step: 0.1 },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: '#0094FF', lineWidth: 1 },
  { id: 'plot1', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  { id: 'plot2', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Stochastic OTT',
  shortTitle: 'StochOTT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochasticOTTInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { kLen, kSmooth, ottPct, showSupport } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const kArr = k.toArray();

  // OTT: trailing stop on K
  const fup = ottPct / 100;
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const val = kArr[i] ?? 50;
    const newLong = val * (1 - fup);
    const newShort = val * (1 + fup);

    if (i === 0) {
      longStop[i] = newLong;
      shortStop[i] = newShort;
      dir[i] = 1;
    } else {
      const prevVal = kArr[i - 1] ?? 50;
      longStop[i] = val > longStop[i - 1] ? Math.max(newLong, longStop[i - 1]) : newLong;
      shortStop[i] = val < shortStop[i - 1] ? Math.min(newShort, shortStop[i - 1]) : newShort;

      if (prevVal <= longStop[i - 1] && val > longStop[i - 1]) {
        dir[i] = 1;
      } else if (prevVal >= shortStop[i - 1] && val < shortStop[i - 1]) {
        dir[i] = -1;
      } else {
        dir[i] = dir[i - 1];
      }
    }
    ott[i] = dir[i] === 1 ? longStop[i] : shortStop[i];
  }

  const warmup = kLen + kSmooth;

  // Markers: buy when stoch crosses above OTT[2], sell when crosses below OTT[2]
  // Pine: buySignalc = crossover(src, OTT[2]), sellSignallc = crossunder(src, OTT[2])
  const markers: MarkerData[] = [];
  for (let i = warmup + 2; i < n; i++) {
    const srcCur = kArr[i] ?? 50;
    const srcPrev = kArr[i - 1] ?? 50;
    const ottLag = ott[i - 2];
    const ottLagPrev = i > 2 ? ott[i - 3] : ott[0];
    if (srcPrev <= ottLagPrev && srcCur > ottLag) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    }
    if (srcPrev >= ottLagPrev && srcCur < ottLag) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  // Fill between upper band (80) and lower band (20)
  // Pine: fill(h0, h1, color=#9915FF, transp=80)

  // Pine: plot(k+1000, title="%K", color=#0094FF)
  // We keep values in 0-100 range (no +1000 offset since our hlines are 80/20)
  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  // Pine: pALL=plot(nz(OTT[2]), color=#B800D9, linewidth=2) -- 2-bar lag
  const plot1 = ott.map((_v, i) => ({
    time: bars[i].time,
    value: (i < warmup + 2) ? NaN : ott[i - 2],
  }));

  // Pine: plot(showsupport ? MAvg : na, color=#0585E1, linewidth=2, title="Support Line")
  // In our TS, MAvg ≈ kArr (the smoothed K that feeds OTT)
  const plot2 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup || !showSupport) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      // Pine: fill(h0, h1, color=#9915FF, transp=80) between hlines 80 and 20
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(153,21,255,0.2)' } },
    ],
    hlines: [
      { value: 80, options: { color: '#606060', linestyle: 'solid' as const, title: 'Upper Band' } },
      { value: 20, options: { color: '#606060', linestyle: 'solid' as const, title: 'Lower Band' } },
    ],
    markers,
  };
}

export const StochasticOTT = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
