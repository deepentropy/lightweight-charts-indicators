/**
 * Bitcoin Logarithmic Growth Curves
 *
 * Logarithmic growth curves with Fibonacci levels for BTC long-term modeling.
 * Uses log/pow calculations based on days since Bitcoin genesis (~2010-07-21).
 *
 * Reference: TradingView "Bitcoin Logarithmic Growth Curves" by Quantadelic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';

export interface BitcoinLogCurvesInputs {
  showFibs: boolean;
  showExtensions: boolean;
  highIntercept: number;
  highSlope: number;
  lowIntercept: number;
  lowSlope: number;
}

export const defaultInputs: BitcoinLogCurvesInputs = {
  showFibs: true,
  showExtensions: true,
  highIntercept: 1.06930947,
  highSlope: 0.00076,
  lowIntercept: -3.0269716,
  lowSlope: 0.001329,
};

export const inputConfig: InputConfig[] = [
  { id: 'showFibs', type: 'bool', title: 'Show Fibonacci Levels', defval: true },
  { id: 'showExtensions', type: 'bool', title: 'Show Curve Projections', defval: true },
  { id: 'highIntercept', type: 'float', title: 'Top Curve Intercept', defval: 1.06930947, step: 0.001 },
  { id: 'highSlope', type: 'float', title: 'Top Curve Slope', defval: 0.00076, step: 0.00001 },
  { id: 'lowIntercept', type: 'float', title: 'Bottom Curve Intercept', defval: -3.0269716, step: 0.001 },
  { id: 'lowSlope', type: 'float', title: 'Bottom Curve Slope', defval: 0.001329, step: 0.00001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '100% - Top', color: '#808080', lineWidth: 2 },
  { id: 'plot1', title: '90.98% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot2', title: '85.41% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot3', title: '76.39% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot4', title: '61.80% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot5', title: '50% - Mid', color: '#808080', lineWidth: 2 },
  { id: 'plot6', title: '38.20% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot7', title: '23.61% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot8', title: '14.59% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot9', title: '9.02% Fib', color: 'rgba(128,128,128,0.5)', lineWidth: 1 },
  { id: 'plot10', title: '0% - Bottom', color: '#808080', lineWidth: 2 },
];

export const metadata = {
  title: 'Bitcoin Log Growth Curves',
  shortTitle: 'BTC Log',
  overlay: true,
};

// Bitcoin genesis reference: 2010-07-21 00:00:00 UTC = 1279670400000ms
const GENESIS_MS = 1279670400000;
const E = 2.718281828459;

export function calculate(bars: Bar[], inputs: Partial<BitcoinLogCurvesInputs> = {}): IndicatorResult & { lines: LineDrawingData[] } {
  const { showFibs, showExtensions, highIntercept, highSlope, lowIntercept, lowSlope } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const fibLevels = [0.9098, 0.8541, 0.7639, 0.618, 0.5, 0.382, 0.2361, 0.1459, 0.0902];

  // Pre-allocate plot arrays
  const plotTop: { time: number; value: number }[] = new Array(n);
  const plotBottom: { time: number; value: number }[] = new Array(n);
  const plotFibs: { time: number; value: number }[][] = fibLevels.map(() => new Array(n));

  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    // time is in seconds for lightweight-charts, convert to ms
    const timeMs = t > 1e12 ? t : t * 1000;

    const timeIndex = timeMs < GENESIS_MS ? 3.0 : (timeMs - GENESIS_MS) / 86400000;
    const weight = (Math.log10(timeIndex + 10) * timeIndex * timeIndex - timeIndex) / 30000;

    if (timeIndex <= 2 || weight <= 0) {
      plotTop[i] = { time: t, value: NaN };
      plotBottom[i] = { time: t, value: NaN };
      for (let f = 0; f < fibLevels.length; f++) {
        plotFibs[f][i] = { time: t, value: NaN };
      }
      continue;
    }

    const logWeight = Math.log(weight);

    const highLogDev = logWeight + highIntercept + highSlope * timeIndex;
    const lowLogDev = logWeight + lowIntercept + lowSlope * timeIndex;
    const logRange = highLogDev - lowLogDev;

    plotTop[i] = { time: t, value: Math.pow(E, highLogDev) };
    plotBottom[i] = { time: t, value: Math.pow(E, lowLogDev) };

    for (let f = 0; f < fibLevels.length; f++) {
      const fibCalc = logRange * fibLevels[f] + lowLogDev;
      plotFibs[f][i] = { time: t, value: showFibs ? Math.pow(E, fibCalc) : NaN };
    }
  }

  // Build fills between adjacent fib levels (gradient coloring)
  const plotIds = ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7', 'plot8', 'plot9', 'plot10'];
  const fillColors = [
    'rgba(255,0,0,0.05)',      // top to 90.98
    'rgba(255,80,0,0.05)',     // 90.98 to 85.41
    'rgba(255,160,0,0.05)',    // 85.41 to 76.39
    'rgba(255,220,0,0.05)',    // 76.39 to 61.80
    'rgba(200,255,0,0.05)',    // 61.80 to 50
    'rgba(100,255,0,0.05)',    // 50 to 38.20
    'rgba(0,255,80,0.05)',     // 38.20 to 23.61
    'rgba(0,255,180,0.05)',    // 23.61 to 14.59
    'rgba(0,200,255,0.05)',    // 14.59 to 9.02
    'rgba(0,100,255,0.05)',    // 9.02 to bottom
  ];

  const fills = showFibs
    ? fillColors.map((color, idx) => ({
        plot1: plotIds[idx],
        plot2: plotIds[idx + 1],
        options: { color },
      }))
    : [];

  const plots: Record<string, { time: number; value: number }[]> = {
    'plot0': plotTop,
    'plot1': plotFibs[0],   // 90.98
    'plot2': plotFibs[1],   // 85.41
    'plot3': plotFibs[2],   // 76.39
    'plot4': plotFibs[3],   // 61.80
    'plot5': plotFibs[4],   // 50.00 (Mid)
    'plot6': plotFibs[5],   // 38.20
    'plot7': plotFibs[6],   // 23.61
    'plot8': plotFibs[7],   // 14.59
    'plot9': plotFibs[8],   // 9.02
    'plot10': plotBottom,
  };

  // Forward curve projection lines (Pine's ExtenZe function + for loop)
  const lines: LineDrawingData[] = [];
  if (showExtensions && n >= 2) {
    const lastT = bars[n - 1].time as number;
    const lastTMs = lastT > 1e12 ? lastT : lastT * 1000;
    const timeDeltaMs = n >= 2
      ? ((bars[n - 1].time as number) - (bars[n - 2].time as number)) * (lastT > 1e12 ? 1 : 1000)
      : 86400000;
    // Pine: ForLoopStep ~91 for daily, ForLoopMax = ForLoopStep * 13
    // We use a default daily-like step of 91 bars, 13 segments
    const forLoopStep = 91;
    const forLoopMax = forLoopStep * 13;

    // ExtenZe: compute curve value at future offset i bars from last bar
    function extenZe(offsetBars: number, slope: number, intercept: number): number {
      const futMs = lastTMs + timeDeltaMs * offsetBars;
      const ti = (futMs - GENESIS_MS) / 86400000;
      const w = (Math.log10(ti + 10) * ti * ti - ti) / 30000;
      if (w <= 0) return NaN;
      const hld = Math.log(w) + intercept + slope * ti;
      return Math.pow(E, hld);
    }

    const midSlope = (highSlope + lowSlope) * 0.5;
    const midIntercept = (highIntercept + lowIntercept) * 0.5;

    const curveParams = [
      { slope: highSlope, intercept: highIntercept },
      { slope: lowSlope, intercept: lowIntercept },
      { slope: midSlope, intercept: midIntercept },
    ];

    for (const { slope, intercept } of curveParams) {
      for (let i = 0; i < forLoopMax; i += forLoopStep) {
        const t1Offset = i;
        const t2Offset = i + forLoopStep;
        const v1 = extenZe(t1Offset, slope, intercept);
        const v2 = extenZe(t2Offset, slope, intercept);
        if (isNaN(v1) || isNaN(v2)) continue;
        // Convert back to time units matching bar time format
        const time1 = lastT > 1e12
          ? lastT + timeDeltaMs * t1Offset
          : lastT + (timeDeltaMs * t1Offset) / 1000;
        const time2 = lastT > 1e12
          ? lastT + timeDeltaMs * t2Offset
          : lastT + (timeDeltaMs * t2Offset) / 1000;
        lines.push({
          time1, price1: v1,
          time2, price2: v2,
          color: '#808080', width: 1,
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
    lines,
  };
}

export const BitcoinLogCurves = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
