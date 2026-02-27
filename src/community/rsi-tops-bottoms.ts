/**
 * RSI Tops and Bottoms
 *
 * RSI divergence detector. Tracks when RSI enters overbought/oversold zones,
 * finds the extreme RSI value within that zone, then compares consecutive
 * OB/OS events for bearish/bullish divergence (price makes new high but
 * RSI doesn't, or vice versa). Outputs RSI plot with OB/OS bands and
 * optionally colors bars on divergence signals.
 *
 * Reference: TradingView "RSI Tops and Bottoms" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface RsiTopsBottomsInputs {
  rsiLength: number;
  src: string;
  upperBand: number;
  lowerBand: number;
  maxBarsInZone: number;
  minDist: number;
  maxDist: number;
  changeBarColor: boolean;
}

export const defaultInputs: RsiTopsBottomsInputs = {
  rsiLength: 14,
  src: 'close',
  upperBand: 70,
  lowerBand: 30,
  maxBarsInZone: 10,
  minDist: 5,
  maxDist: 100,
  changeBarColor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'upperBand', type: 'int', title: 'Upper Band', defval: 70 },
  { id: 'lowerBand', type: 'int', title: 'Lower Band', defval: 30 },
  { id: 'maxBarsInZone', type: 'int', title: 'Max Bars in OB/OS', defval: 10, min: 1 },
  { id: 'minDist', type: 'int', title: 'Min Bars Between Tops/Bottoms', defval: 5, min: 1 },
  { id: 'maxDist', type: 'int', title: 'Max Bars Between Tops/Bottoms', defval: 100, min: 1 },
  { id: 'changeBarColor', type: 'bool', title: 'Change Bar Color', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'rsi', title: 'RSI', color: '#8E1599', lineWidth: 1 },
  { id: 'upper', title: 'Upper Band', color: '#C0C0C0', lineWidth: 1 },
  { id: 'lower', title: 'Lower Band', color: '#C0C0C0', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Tops and Bottoms',
  shortTitle: 'RSI T&B',
  overlay: false,
};

function getSource(bar: Bar, src: string): number {
  switch (src) {
    case 'open': return bar.open;
    case 'high': return bar.high;
    case 'low': return bar.low;
    case 'hl2': return (bar.high + bar.low) / 2;
    case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
    case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
    default: return bar.close;
  }
}

export function calculate(bars: Bar[], inputs: Partial<RsiTopsBottomsInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = new Series(bars, (b) => getSource(b, cfg.src));
  const rsiArr = ta.rsi(srcSeries, cfg.rsiLength).toArray();
  const lowArr = new Series(bars, (b) => b.low).toArray();
  const highArr = new Series(bars, (b) => b.high).toArray();

  const ob = cfg.upperBand;
  const os = cfg.lowerBand;
  const prd = cfg.maxBarsInZone;

  // --- Oversold (bottom) divergence detection ---
  let belowOs = false;
  let osCount = 0;
  let lastLowestRsi = NaN;
  let lastLowestPrice = NaN;
  let lastLowestBi = NaN;
  let itsFineOs = false;

  let prevLastLowestRsi = NaN;
  let prevLastLowestPrice = NaN;
  let prevLastLowestBi = NaN;
  let prevItsFineOs = false;

  // --- Overbought (top) divergence detection ---
  let aboveOb = false;
  let obCount = 0;
  let lastHighestRsi = NaN;
  let lastHighestPrice = NaN;
  let lastHighestBi = NaN;
  let itsFineOb = false;

  let prevLastHighestRsi = NaN;
  let prevLastHighestPrice = NaN;
  let prevLastHighestBi = NaN;
  let prevItsFineOb = false;

  const mayGoUp: boolean[] = new Array(n).fill(false);
  const mayGoDown: boolean[] = new Array(n).fill(false);

  const markers: MarkerData[] = [];

  for (let i = 1; i < n; i++) {
    const rsi = rsiArr[i] ?? 50;
    const rsiPrev = rsiArr[i - 1] ?? 50;

    // --- Bottom (oversold) tracking ---
    const prevBelowOs = belowOs;
    const prevOsCount = osCount;

    if (rsiPrev >= os && rsi < os) belowOs = true;
    else if (rsi > os) belowOs = false;

    osCount = belowOs ? osCount + 1 : !belowOs ? 0 : osCount;

    // When we exit oversold zone
    if (prevBelowOs && !belowOs && prevOsCount > 0) {
      prevLastLowestRsi = lastLowestRsi;
      prevLastLowestPrice = lastLowestPrice;
      prevLastLowestBi = lastLowestBi;
      prevItsFineOs = itsFineOs;

      lastLowestRsi = 101;
      lastLowestBi = i;
      itsFineOs = true;

      for (let x = 1; x <= prevOsCount; x++) {
        if (x > prd) itsFineOs = false;
        const idx = i - x;
        if (idx >= 0 && (rsiArr[idx] ?? 50) < lastLowestRsi) {
          lastLowestRsi = rsiArr[idx] ?? 50;
          lastLowestBi = idx;
          lastLowestPrice = lowArr[idx];
        }
      }
    }

    // Bullish divergence: RSI higher low but price lower low
    if (!isNaN(lastLowestRsi) && !isNaN(prevLastLowestRsi) &&
        lastLowestRsi !== prevLastLowestRsi &&
        lastLowestRsi > prevLastLowestRsi &&
        lastLowestPrice < prevLastLowestPrice &&
        i - prevLastLowestBi < cfg.maxDist &&
        itsFineOs && prevItsFineOs &&
        i - prevLastLowestBi > cfg.minDist) {
      mayGoUp[i] = true;
    }

    // --- Top (overbought) tracking ---
    const prevAboveOb = aboveOb;
    const prevObCount = obCount;

    if (rsiPrev <= ob && rsi > ob) aboveOb = true;
    else if (rsi < ob) aboveOb = false;

    obCount = aboveOb ? obCount + 1 : !aboveOb ? 0 : obCount;

    // When we exit overbought zone
    if (prevAboveOb && !aboveOb && prevObCount > 0) {
      prevLastHighestRsi = lastHighestRsi;
      prevLastHighestPrice = lastHighestPrice;
      prevLastHighestBi = lastHighestBi;
      prevItsFineOb = itsFineOb;

      lastHighestRsi = -1;
      lastHighestBi = i;
      itsFineOb = true;

      for (let x = 1; x <= prevObCount; x++) {
        if (x > prd) itsFineOb = false;
        const idx = i - x;
        if (idx >= 0 && (rsiArr[idx] ?? 50) > lastHighestRsi) {
          lastHighestRsi = rsiArr[idx] ?? 50;
          lastHighestBi = idx;
          lastHighestPrice = highArr[idx];
        }
      }
    }

    // Bearish divergence: RSI lower high but price higher high
    if (!isNaN(lastHighestRsi) && !isNaN(prevLastHighestRsi) &&
        lastHighestRsi !== prevLastHighestRsi &&
        lastHighestRsi < prevLastHighestRsi &&
        lastHighestPrice > prevLastHighestPrice &&
        i - prevLastHighestBi < cfg.maxDist &&
        itsFineOb && prevItsFineOb &&
        i - prevLastHighestBi > cfg.minDist) {
      mayGoDown[i] = true;
    }
  }

  const warmup = cfg.rsiLength;
  const rsiPlot = rsiArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));
  const upperPlot = bars.map((b) => ({ time: b.time, value: ob }));
  const lowerPlot = bars.map((b) => ({ time: b.time, value: os }));

  // Bar colors on divergence
  const barColors: BarColorData[] = [];
  if (cfg.changeBarColor) {
    for (let i = 0; i < n; i++) {
      if (mayGoUp[i]) {
        barColors.push({ time: bars[i].time, color: '#0000FF' }); // blue
      } else if (mayGoDown[i]) {
        barColors.push({ time: bars[i].time, color: '#000000' }); // black
      }
    }
  }

  // Markers for divergence signals
  for (let i = 0; i < n; i++) {
    if (mayGoUp[i]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'Div' });
    }
    if (mayGoDown[i]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'Div' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'rsi': rsiPlot, 'upper': upperPlot, 'lower': lowerPlot },
    fills: [{ plot1: 'lower', plot2: 'upper', options: { color: 'rgba(153,21,255,0.10)' } }],
    markers,
    barColors,
  };
}

export const RsiTopsBottoms = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
