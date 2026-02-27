/**
 * IDEAL BB with MA
 *
 * Bollinger Bands with a configurable moving average type overlay.
 * Combines BB upper/basis/lower with an independent MA line.
 *
 * Reference: TradingView "IDEAL Bollinger Bands with MA" (TV#322)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IdealBbMaInputs {
  bbLen: number;
  bbMult: number;
  maLen: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: IdealBbMaInputs = {
  bbLen: 20,
  bbMult: 2.0,
  maLen: 50,
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['sma', 'ema', 'wma', 'hma', 'rma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'MA', color: '#E040FB', lineWidth: 2 },
];

export const metadata = {
  title: 'IDEAL BB with MA',
  shortTitle: 'IBBMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IdealBbMaInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { bbLen, bbMult, maLen, maType, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const [bbMiddle, bbUpper, bbLower] = ta.bb(source, bbLen, bbMult);
  const bbMidArr = bbMiddle.toArray();
  const bbUpArr = bbUpper.toArray();
  const bbLoArr = bbLower.toArray();

  let maArr: (number | null)[];
  switch (maType) {
    case 'ema': maArr = ta.ema(source, maLen).toArray(); break;
    case 'wma': maArr = ta.wma(source, maLen).toArray(); break;
    case 'hma': maArr = ta.hma(source, maLen).toArray(); break;
    case 'rma': maArr = ta.rma(source, maLen).toArray(); break;
    default: maArr = ta.sma(source, maLen).toArray(); break;
  }

  // Hull trend with Kahlman filter (from Pine source)
  const hullLen = 24;
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const hmaArr = ta.hma(hl2Series, hullLen).toArray();
  // HMA3: wma(wma(close,p/3)*3 - wma(close,p/2) - wma(close,p), p)
  const closeSeries = new Series(bars, (b) => b.close);
  const p = Math.floor(hullLen / 2);
  const wmaP3 = ta.wma(closeSeries, Math.max(Math.floor(p / 3), 1)).toArray();
  const wmaP2 = ta.wma(closeSeries, Math.max(Math.floor(p / 2), 1)).toArray();
  const wmaP = ta.wma(closeSeries, Math.max(p, 1)).toArray();
  const hma3Src: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hma3Src[i] = (wmaP3[i] ?? 0) * 3 - (wmaP2[i] ?? 0) - (wmaP[i] ?? 0);
  }
  const hma3Arr = ta.wma(Series.fromArray(bars, hma3Src), Math.max(p, 1)).toArray();

  const warmup = Math.max(bbLen, maLen);
  const hullWarmup = hullLen + p;

  const plot0 = bbUpArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = bbMidArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = bbLoArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot3 = maArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  // Markers: Buy/Sell from Hull MA crossover (plotshape in Pine)
  const markers: MarkerData[] = [];
  for (let i = hullWarmup + 1; i < n; i++) {
    const a = hmaArr[i] ?? 0;
    const b = hma3Arr[i] ?? 0;
    const prevA = hmaArr[i - 1] ?? 0;
    const prevB = hma3Arr[i - 1] ?? 0;
    // crossup: b > a and b[1] < a[1]
    if (b > a && prevB < prevA) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'Buy' });
    }
    // crossdn: a > b and a[1] < b[1]
    if (a > b && prevA < prevB) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#F44336', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    fills: [{ plot1: 'plot0', plot2: 'plot2', options: { color: '#2962FF20' } }],
    markers,
  };
}

export const IdealBbMa = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
