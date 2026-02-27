/**
 * IDEAL BB with MA (With Alerts) by Adarsh
 *
 * Pine: overlay=true, multiple visual elements:
 *   1) NMA (3rd-gen Moving Average) as stepline in black
 *   2) VWAP in pink
 *   3) BB basis (SMA 20) in red, BB upper in blue, BB lower in dark purple
 *   4) Fill between BB upper and lower (blue)
 *   5) Hull trend line A (HMA with Kahlman)
 *   6) Hull trend line B (HMA3 with Kahlman)
 *   7) Fill between Hull lines (lime when bullish, red when bearish)
 *   8) Buy/Sell markers from Hull crossovers
 *
 * Reference: TradingView "IDEAL BB with MA (With Alerts) by Adarsh" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IdealBbMaInputs {
  length1: number;
  length2: number;
  maType: string;
  src: SourceType;
  hullLength: number;
  hullGain: number;
  useKahlman: boolean;
}

export const defaultInputs: IdealBbMaInputs = {
  length1: 120,
  length2: 12,
  maType: 'EMA',
  src: 'hl2',
  hullLength: 24,
  hullGain: 10000,
  useKahlman: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: '1st Length (NMA)', defval: 120, min: 1 },
  { id: 'length2', type: 'int', title: '2nd Length (NMA)', defval: 12, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'hullLength', type: 'int', title: 'Hull Lookback', defval: 24, min: 2 },
  { id: 'hullGain', type: 'int', title: 'Kahlman Gain', defval: 10000, min: 1 },
  { id: 'useKahlman', type: 'bool', title: 'Use Kahlman', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'nma', title: 'NMA Black Line', color: '#000000', lineWidth: 2, style: 'stepline' },
  { id: 'vwap', title: 'VWAP', color: '#e91e63', lineWidth: 2 },
  { id: 'bbBasis', title: 'BB Basis', color: '#EF5350' },
  { id: 'bbUpper', title: 'BB Upper', color: '#2962FF' },
  { id: 'bbLower', title: 'BB Lower', color: '#311b92' },
  { id: 'hullA', title: 'Hull Long', color: '#26A69A', lineWidth: 1 },
  { id: 'hullB', title: 'Hull Short', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'IDEAL BB with MA',
  shortTitle: 'IBBMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IdealBbMaInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length1, length2, maType, src, hullLength, hullGain, useKahlman } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  // --- NMA (3rd generation MA) ---
  // getMA based on maType
  function getMA(srcArr: number[], length: number): number[] {
    const s = Series.fromArray(bars, srcArr);
    switch (maType) {
      case 'SMA': return ta.sma(s, length).toArray();
      case 'WMA': return ta.wma(s, length).toArray();
      default: return ta.ema(s, length).toArray();
    }
  }

  const srcArr = source.toArray ? source.toArray() : source as unknown as number[];
  const ma1 = getMA(srcArr, length1);
  const ma2 = getMA(ma1, length2);
  const lambda = length1 / length2;
  const alpha = lambda * (length1 - 1) / (length1 - lambda);
  const nmaArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    nmaArr[i] = (1 + alpha) * (ma1[i] ?? NaN) - alpha * (ma2[i] ?? NaN);
  }

  // --- VWAP ---
  const hlc3Series = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const vwapArr = ta.vwap(hlc3Series, volSeries).toArray();

  // --- Bollinger Bands (SMA 20, mult 2) ---
  const closeSeries = new Series(bars, (b) => b.close);
  const bbLen = 20;
  const bbMult = 2;
  const [bbMiddle, bbUpper, bbLower] = ta.bb(closeSeries, bbLen, bbMult);
  const bbMidArr = bbMiddle.toArray();
  const bbUpArr = bbUpper.toArray();
  const bbLoArr = bbLower.toArray();

  // --- Hull MA Trend with Kahlman filter ---
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const hmaRaw = ta.hma(hl2Series, hullLength).toArray();

  // HMA3: wma(wma(close,p/3)*3 - wma(close,p/2) - wma(close,p), p)
  const p = Math.floor(hullLength / 2);
  const wmaP3 = ta.wma(closeSeries, Math.max(Math.floor(p / 3), 1)).toArray();
  const wmaP2 = ta.wma(closeSeries, Math.max(Math.floor(p / 2), 1)).toArray();
  const wmaP1 = ta.wma(closeSeries, Math.max(p, 1)).toArray();
  const hma3Src: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hma3Src[i] = (wmaP3[i] ?? 0) * 3 - (wmaP2[i] ?? 0) - (wmaP1[i] ?? 0);
  }
  const hma3Raw = ta.wma(Series.fromArray(bars, hma3Src), Math.max(p, 1)).toArray();

  // Kahlman filter
  function applyKahlman(rawArr: (number | null)[], gain: number): number[] {
    const result: number[] = new Array(n);
    let kf = NaN;
    let velo = 0;
    for (let i = 0; i < n; i++) {
      const x = rawArr[i] ?? NaN;
      if (isNaN(x)) { result[i] = NaN; continue; }
      if (isNaN(kf)) { kf = x; velo = 0; }
      const dk = x - kf;
      const smooth = kf + dk * Math.sqrt((gain / 10000) * 2);
      velo = velo + (gain / 10000) * dk;
      kf = smooth + velo;
      result[i] = kf;
    }
    return result;
  }

  const hullA = useKahlman ? applyKahlman(hmaRaw, hullGain) : hmaRaw.map(v => v ?? NaN);
  const hullB = useKahlman ? applyKahlman(hma3Raw, hullGain) : hma3Raw.map(v => v ?? NaN);

  const warmup = Math.max(length1, length2, bbLen, hullLength + p);

  // Hull coloring: lime when b > a, red otherwise
  const LIME = '#00E676';
  const RED_HULL = '#EF5350';

  const nmaPlot = nmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < Math.max(length1, length2) ? NaN : (isNaN(v) ? NaN : v),
  }));

  const vwapPlot = vwapArr.map((v, i) => ({
    time: bars[i].time,
    value: v ?? NaN,
  }));

  const bbBasisPlot = bbMidArr.map((v, i) => ({
    time: bars[i].time,
    value: i < bbLen ? NaN : (v ?? NaN),
  }));

  const bbUpperPlot = bbUpArr.map((v, i) => ({
    time: bars[i].time,
    value: i < bbLen ? NaN : (v ?? NaN),
  }));

  const bbLowerPlot = bbLoArr.map((v, i) => ({
    time: bars[i].time,
    value: i < bbLen ? NaN : (v ?? NaN),
  }));

  const hullAPlot = hullA.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: (!isNaN(hullB[i]) && hullB[i] > v) ? LIME : RED_HULL,
  }));

  const hullBPlot = hullB.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: (v > (hullA[i] ?? 0)) ? LIME : RED_HULL,
  }));

  // Buy/Sell markers from Hull crossover
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const a = hullA[i];
    const b = hullB[i];
    const prevA = hullA[i - 1];
    const prevB = hullB[i - 1];
    if (isNaN(a) || isNaN(b) || isNaN(prevA) || isNaN(prevB)) continue;

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
    plots: {
      nma: nmaPlot,
      vwap: vwapPlot,
      bbBasis: bbBasisPlot,
      bbUpper: bbUpperPlot,
      bbLower: bbLowerPlot,
      hullA: hullAPlot,
      hullB: hullBPlot,
    },
    fills: [
      { plot1: 'bbUpper', plot2: 'bbLower', options: { color: '#2962FF20' } },
      { plot1: 'hullA', plot2: 'hullB', options: { color: '#26A69A40' } },
    ],
    markers,
  };
}

export const IdealBbMa = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
