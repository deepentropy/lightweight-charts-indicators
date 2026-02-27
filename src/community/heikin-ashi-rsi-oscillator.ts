/**
 * Heikin Ashi RSI Oscillator
 *
 * Zero-centered RSI displayed as Heikin Ashi candles.
 * Includes smoothed RSI overlay line and optional Stochastic RSI.
 * OB/OS bands at configurable levels.
 *
 * Reference: TradingView "Heikin Ashi RSI Oscillator" by JayRogers
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface HeikinAshiRsiOscillatorInputs {
  lenHARSI: number;
  openSmoothing: number;
  lenRSI: number;
  smoothedMode: boolean;
  showPlot: boolean;
  showHist: boolean;
  showStoch: boolean;
  smoothK: number;
  smoothD: number;
  stochLen: number;
  stochFit: number;
  upper: number;
  upperExtreme: number;
  lower: number;
  lowerExtreme: number;
}

export const defaultInputs: HeikinAshiRsiOscillatorInputs = {
  lenHARSI: 14,
  openSmoothing: 1,
  lenRSI: 7,
  smoothedMode: true,
  showPlot: true,
  showHist: true,
  showStoch: false,
  smoothK: 3,
  smoothD: 3,
  stochLen: 14,
  stochFit: 80,
  upper: 20,
  upperExtreme: 30,
  lower: -20,
  lowerExtreme: -30,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenHARSI', type: 'int', title: 'HA RSI Length', defval: 14, min: 1 },
  { id: 'openSmoothing', type: 'int', title: 'Open Smoothing', defval: 1, min: 1 },
  { id: 'lenRSI', type: 'int', title: 'RSI Overlay Length', defval: 7, min: 1 },
  { id: 'smoothedMode', type: 'bool', title: 'Smoothed RSI', defval: true },
  { id: 'showPlot', type: 'bool', title: 'Show RSI Line', defval: true },
  { id: 'showHist', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'showStoch', type: 'bool', title: 'Show Stoch RSI', defval: false },
  { id: 'smoothK', type: 'int', title: 'Stoch Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Stoch Smooth D', defval: 3, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'stochFit', type: 'int', title: 'Stoch Scale %', defval: 80, min: 1 },
  { id: 'upper', type: 'int', title: 'Upper Band', defval: 20 },
  { id: 'upperExtreme', type: 'int', title: 'Upper Extreme', defval: 30 },
  { id: 'lower', type: 'int', title: 'Lower Band', defval: -20 },
  { id: 'lowerExtreme', type: 'int', title: 'Lower Extreme', defval: -30 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Line', color: '#FAC832', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Extreme', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Extreme', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Histogram', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const plotCandleConfig = [
  { id: 'harsi', title: 'HA RSI Candles' },
];

export const metadata = {
  title: 'Heikin Ashi RSI Oscillator',
  shortTitle: 'HA-RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<HeikinAshiRsiOscillatorInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  // Zero-median RSI: RSI - 50
  const rsiCloseArr = ta.rsi(close, cfg.lenHARSI).toArray();
  const rsiHighArr = ta.rsi(high, cfg.lenHARSI).toArray();
  const rsiLowArr = ta.rsi(low, cfg.lenHARSI).toArray();

  const zrsiClose: number[] = rsiCloseArr.map(v => v != null ? v - 50 : NaN);
  const zrsiHigh: number[] = rsiHighArr.map(v => v != null ? v - 50 : NaN);
  const zrsiLow: number[] = rsiLowArr.map(v => v != null ? v - 50 : NaN);

  // HA RSI candle components
  // openRSI = nz(closeRSI[1], closeRSI)
  const openRSI: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    openRSI[i] = i > 0 && !isNaN(zrsiClose[i - 1]) ? zrsiClose[i - 1] : zrsiClose[i];
  }

  // highRSI = max of zrsi(high) and zrsi(low), lowRSI = min
  const highRSI: number[] = new Array(n);
  const lowRSI: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    highRSI[i] = Math.max(zrsiHigh[i], zrsiLow[i]);
    lowRSI[i] = Math.min(zrsiHigh[i], zrsiLow[i]);
  }

  // HA close = (openRSI + highRSI + lowRSI + closeRSI) / 4
  const haClose: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    haClose[i] = (openRSI[i] + highRSI[i] + lowRSI[i] + zrsiClose[i]) / 4;
  }

  // HA open with smoothing: open[i] = na(open[s]) ? (openRSI + closeRSI)/2 : (open[i-1]*s + close[i-1])/(s+1)
  const s = cfg.openSmoothing;
  const haOpen: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < s || isNaN(haOpen[i - 1])) {
      haOpen[i] = (openRSI[i] + zrsiClose[i]) / 2;
    } else {
      haOpen[i] = (haOpen[i - 1] * s + haClose[i - 1]) / (s + 1);
    }
  }

  // HA high = max(highRSI, haOpen, haClose), HA low = min(lowRSI, haOpen, haClose)
  const haHigh: number[] = new Array(n);
  const haLow: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    haHigh[i] = Math.max(highRSI[i], haOpen[i], haClose[i]);
    haLow[i] = Math.min(lowRSI[i], haOpen[i], haClose[i]);
  }

  const warmup = cfg.lenHARSI;

  // Plot candles
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmup || isNaN(haClose[i])) {
      candles.push({ time: bars[i].time as number, open: NaN, high: NaN, low: NaN, close: NaN });
      continue;
    }
    const bullish = haClose[i] > haOpen[i];
    const color = bullish ? '#26A69A' : '#EF5350';
    candles.push({
      time: bars[i].time as number,
      open: haOpen[i],
      high: haHigh[i],
      low: haLow[i],
      close: haClose[i],
      color,
      borderColor: color,
      wickColor: color,
    });
  }

  // RSI overlay line
  const rsiOverlayRaw = ta.rsi(close, cfg.lenRSI).toArray();
  const zrsiOverlay: number[] = rsiOverlayRaw.map(v => v != null ? v - 50 : NaN);

  // Smoothed mode: smoothed = (smoothed[1] + zrsi) / 2
  const rsiLine: number[] = new Array(n);
  if (cfg.smoothedMode) {
    for (let i = 0; i < n; i++) {
      if (isNaN(zrsiOverlay[i])) {
        rsiLine[i] = NaN;
      } else if (i === 0 || isNaN(rsiLine[i - 1])) {
        rsiLine[i] = zrsiOverlay[i];
      } else {
        rsiLine[i] = (rsiLine[i - 1] + zrsiOverlay[i]) / 2;
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      rsiLine[i] = zrsiOverlay[i];
    }
  }

  // Build plot arrays
  const plot0 = rsiLine.map((v, i) => ({
    time: bars[i].time,
    value: cfg.showPlot && i >= warmup ? v : NaN,
  }));

  // Band lines (constant)
  const plot1 = bars.map(b => ({ time: b.time, value: cfg.upper }));
  const plot2 = bars.map(b => ({ time: b.time, value: cfg.lower }));
  const plot3 = bars.map(b => ({ time: b.time, value: cfg.upperExtreme }));
  const plot4 = bars.map(b => ({ time: b.time, value: cfg.lowerExtreme }));

  // Histogram: RSI value as histogram bars
  const plot5 = rsiLine.map((v, i) => ({
    time: bars[i].time,
    value: cfg.showHist && i >= warmup ? v : NaN,
    color: v > 0 ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
  }));

  // Fills: upper to upperExtreme (red), upper to lower (blue), lower to lowerExtreme (green)
  const fillUpperExtreme = bars.map(() => 'rgba(255,0,0,0.1)');
  const fillMid = bars.map(() => 'rgba(33,150,243,0.05)');
  const fillLowerExtreme = bars.map(() => 'rgba(0,255,0,0.1)');

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    plotCandles: { harsi: candles },
    fills: [
      { plot1: 'plot1', plot2: 'plot3', colors: fillUpperExtreme },
      { plot1: 'plot1', plot2: 'plot2', colors: fillMid },
      { plot1: 'plot2', plot2: 'plot4', colors: fillLowerExtreme },
    ],
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const HeikinAshiRsiOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
