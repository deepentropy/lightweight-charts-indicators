/**
 * Pivot Point SuperTrend
 *
 * SuperTrend using pivot high/low based center line with ATR bands.
 * Direction flips when price crosses the opposite band.
 *
 * Reference: TradingView "Pivot Point SuperTrend" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PivotPointSupertrendInputs {
  pivotLen: number;
  atrFactor: number;
  atrLen: number;
}

export const defaultInputs: PivotPointSupertrendInputs = {
  pivotLen: 2,
  atrFactor: 3.0,
  atrLen: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 2, min: 1 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Center Line', color: '#2196F3', lineWidth: 1 },
  { id: 'plot2', title: 'Support', color: '#26A69A', lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Resistance', color: '#EF5350', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Pivot Point SuperTrend',
  shortTitle: 'PPST',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PivotPointSupertrendInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { pivotLen, atrFactor, atrLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, pivotLen, pivotLen).toArray();
  const plArr = ta.pivotlow(lowSeries, pivotLen, pivotLen).toArray();
  const atrArr = ta.atr(bars, atrLen).toArray();

  // Track last known pivot values
  let lastPH = NaN;
  let lastPL = NaN;

  const centerArr: number[] = new Array(n);
  const upperArr: number[] = new Array(n);
  const lowerArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (phArr[i] != null && !isNaN(phArr[i]!)) lastPH = phArr[i]!;
    if (plArr[i] != null && !isNaN(plArr[i]!)) lastPL = plArr[i]!;

    const center = (!isNaN(lastPH) && !isNaN(lastPL)) ? (lastPH + lastPL) / 2 : bars[i].close;
    const atr = (atrArr[i] ?? 0) * atrFactor;

    centerArr[i] = center;
    upperArr[i] = center + atr;
    lowerArr[i] = center - atr;
  }

  // SuperTrend trailing logic
  const stArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = bullish, -1 = bearish

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      stArr[i] = lowerArr[i];
      dirArr[i] = 1;
      continue;
    }

    const prevDir = dirArr[i - 1];
    const prevSt = stArr[i - 1];
    const close = bars[i].close;

    if (prevDir === 1) {
      // Bullish: use lower band, ratchet up
      const newLower = lowerArr[i];
      stArr[i] = newLower > prevSt ? newLower : prevSt;
      dirArr[i] = close < stArr[i] ? -1 : 1;
    } else {
      // Bearish: use upper band, ratchet down
      const newUpper = upperArr[i];
      stArr[i] = newUpper < prevSt ? newUpper : prevSt;
      dirArr[i] = close > stArr[i] ? 1 : -1;
    }
  }

  // Support/Resistance tracking (Pine: support := pl ? pl : support[1])
  const supportArr: number[] = new Array(n);
  const resistanceArr: number[] = new Array(n);
  let lastSupport = NaN;
  let lastResistance = NaN;
  for (let i = 0; i < n; i++) {
    if (plArr[i] != null && !isNaN(plArr[i]!)) lastSupport = plArr[i]!;
    if (phArr[i] != null && !isNaN(phArr[i]!)) lastResistance = phArr[i]!;
    supportArr[i] = lastSupport;
    resistanceArr[i] = lastResistance;
  }

  const warmup = Math.max(atrLen, pivotLen * 2 + 1);

  const plot0 = stArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Center line: colored by position relative to hl2 (Pine: center < hl2 ? blue : red)
  const plot1 = centerArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const color = v < hl2 ? '#2196F3' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Support level (circles)
  const plot2 = supportArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Resistance level (circles)
  const plot3 = resistanceArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Markers: trend direction change signals
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    // Buy: trend flips from bearish to bullish
    if (dirArr[i] === 1 && dirArr[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
    }
    // Sell: trend flips from bullish to bearish
    if (dirArr[i] === -1 && dirArr[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    markers,
  };
}

export const PivotPointSupertrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
