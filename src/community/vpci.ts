/**
 * Volume Price Confirmation Indicator (VPCI)
 *
 * Combines VWMA, SMA, and volume ratios to confirm price-volume trends.
 * VPCI = VPC * VPR * VM
 * where VPC = VWMA(long) - SMA(long), VPR = VWMA(short) / SMA(short),
 * VM = SMA(vol, short) / SMA(vol, long)
 *
 * Reference: TradingView "Volume Price Confirmation Indicator [LazyBear]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VPCIInputs {
  longLength: number;
  shortLength: number;
  signalLength: number;
  bbLength: number;
  bbMult: number;
}

export const defaultInputs: VPCIInputs = {
  longLength: 30,
  shortLength: 5,
  signalLength: 9,
  bbLength: 20,
  bbMult: 2.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 30, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Mult', defval: 2.5, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VPCI', color: '#FF9800', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#008080', lineWidth: 1 },
  { id: 'plot2', title: 'BB Upper', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'BB Lower', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Breach', color: '#EF5350', lineWidth: 3, style: 'cross' },
];

export const metadata = {
  title: 'Volume Price Confirmation Indicator',
  shortTitle: 'VPCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VPCIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { longLength, shortLength, signalLength, bbLength, bbMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = getSourceSeries(bars, 'close');
  const volSeries = new Series(bars, (b) => b.volume ?? 0);

  const vwmaLongArr = ta.vwma(closeSeries, longLength, volSeries).toArray();
  const smaLongArr = ta.sma(closeSeries, longLength).toArray();
  const vwmaShortArr = ta.vwma(closeSeries, shortLength, volSeries).toArray();
  const smaShortArr = ta.sma(closeSeries, shortLength).toArray();
  const smaVolShortArr = ta.sma(volSeries, shortLength).toArray();
  const smaVolLongArr = ta.sma(volSeries, longLength).toArray();

  const vpciArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vwmaL = vwmaLongArr[i];
    const smaL = smaLongArr[i];
    const vwmaS = vwmaShortArr[i];
    const smaS = smaShortArr[i];
    const volS = smaVolShortArr[i];
    const volL = smaVolLongArr[i];

    if (isNaN(vwmaL) || isNaN(smaL) || isNaN(vwmaS) || isNaN(smaS) || isNaN(volS) || isNaN(volL) || smaS === 0 || volL === 0) {
      vpciArr[i] = 0;
    } else {
      const vpc = vwmaL - smaL;
      const vpr = vwmaS / smaS;
      const vm = volS / volL;
      vpciArr[i] = vpc * vpr * vm;
    }
  }

  const vpciSeries = new Series(bars, (_b, i) => vpciArr[i]);
  const signalArr = ta.ema(vpciSeries, signalLength).toArray();

  const warmup = longLength;

  // BB bands on VPCI
  const bbBasis = ta.sma(vpciSeries, bbLength).toArray();
  const bbDev = ta.stdev(vpciSeries, bbLength).toArray();

  const plot0 = vpciArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  const upperArr: number[] = new Array(n);
  const lowerArr: number[] = new Array(n);
  const plot2 = bbBasis.map((v, i) => {
    const val = (i < warmup || isNaN(v) || isNaN(bbDev[i])) ? NaN : v + bbMult * bbDev[i];
    upperArr[i] = val;
    return { time: bars[i].time, value: val };
  });

  const plot3 = bbBasis.map((v, i) => {
    const val = (i < warmup || isNaN(v) || isNaN(bbDev[i])) ? NaN : v - bbMult * bbDev[i];
    lowerArr[i] = val;
    return { time: bars[i].time, value: val };
  });

  // Pine: plot(DrawBands?basis:na, color=gray, style=line)
  const plot4 = bbBasis.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // Pine: breach_pos = (bb_s >= upper) ? (bb_s+offs_v) : (bb_s <= lower ? (bb_s - offs_v) : 0)
  // Pine: b_color = (bb_s > upper) ? red : (bb_s < lower) ? green : na
  // Pine: plot(HighlightBreaches and Breached ? breach_pos : na, style=cross, color=b_color, linewidth=3)
  const offs_v = 0.3;
  const plot5 = bars.map((b, i) => {
    if (i < warmup) return { time: b.time, value: NaN };
    const v = vpciArr[i];
    const upper = upperArr[i];
    const lower = lowerArr[i];
    if (isNaN(upper) || isNaN(lower)) return { time: b.time, value: NaN };
    const breachedUp = v >= upper;
    const breachedDn = v <= lower;
    if (!breachedUp && !breachedDn) return { time: b.time, value: NaN };
    const pos = breachedUp ? v + offs_v : v - offs_v;
    const color = breachedUp ? '#EF5350' : '#26A69A';
    return { time: b.time, value: pos, color };
  });

  // Also generate markers for breach points (for better visibility)
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmup) continue;
    const v = vpciArr[i];
    const upper = upperArr[i];
    const lower = lowerArr[i];
    if (isNaN(upper) || isNaN(lower)) continue;
    if (v >= upper) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'cross', color: '#EF5350', text: 'B' });
    } else if (v <= lower) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'cross', color: '#26A69A', text: 'B' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
    fills: [
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(33, 150, 243, 0.15)' } },
    ],
    markers,
  };
}

export const VPCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
