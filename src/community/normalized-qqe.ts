/**
 * Normalized QQE (nQQE)
 *
 * QQE normalized to 0-100 range.
 * nqqe = (rsi - trailingStop) / band * 50 + 50, clamped to 0-100.
 *
 * Reference: TradingView "Normalized QQE"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface NormalizedQQEInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
  showSignals: boolean;
}

export const defaultInputs: NormalizedQQEInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.236,
  src: 'close',
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'Smooth Factor', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.236, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'SLOW', color: '#0007E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Normalized QQE',
  shortTitle: 'nQQE',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<NormalizedQQEInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, smoothFactor, qqeFactor, src, showSignals } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const wildersLen = rsiLen * 2 - 1;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const smoothedRsi = ta.ema(rsi, smoothFactor);
  const srArr = smoothedRsi.toArray();

  // ATR of RSI
  const atrRsiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const cur = srArr[i] ?? 0;
    atrRsiRaw[i] = Math.abs(cur - prev);
  }
  const atrRsiSeries = Series.fromArray(bars, atrRsiRaw);
  const smoothedAtr = ta.ema(atrRsiSeries, wildersLen);
  const atrArr = smoothedAtr.toArray();

  // Trailing stop
  const longBand: number[] = new Array(n);
  const shortBand: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  const trailing: number[] = new Array(n);
  const bandArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const sr = srArr[i] ?? 0;
    const prevSr = i > 0 ? (srArr[i - 1] ?? 0) : 0;
    const dar = (atrArr[i] ?? 0) * qqeFactor;
    bandArr[i] = dar;
    const newLong = sr - dar;
    const newShort = sr + dar;

    if (i === 0) {
      longBand[i] = newLong;
      shortBand[i] = newShort;
      trendDir[i] = 1;
    } else {
      longBand[i] = (prevSr > longBand[i - 1] && sr > longBand[i - 1])
        ? Math.max(longBand[i - 1], newLong)
        : newLong;
      shortBand[i] = (prevSr < shortBand[i - 1] && sr < shortBand[i - 1])
        ? Math.min(shortBand[i - 1], newShort)
        : newShort;

      if (prevSr <= longBand[i - 1] && sr > longBand[i - 1]) {
        trendDir[i] = 1;
      } else if (prevSr >= shortBand[i - 1] && sr < shortBand[i - 1]) {
        trendDir[i] = -1;
      } else {
        trendDir[i] = trendDir[i - 1];
      }
    }
    trailing[i] = trendDir[i] === 1 ? longBand[i] : shortBand[i];
  }

  const warmup = rsiLen * 2 + smoothFactor;

  // Pine: QQF=plot(QQEF-50,"FAST",color=color.maroon,linewidth=2)
  // Pine: plot(QQEF-50,color=Colorh,linewidth=2,style=5) -- colored version
  // Pine: QQS=plot(QQES-50,"SLOW",color=#0007E1, linewidth=2)
  const plot0 = srArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const val = v - 50;
    // Pine: Colorh = QQEF-50>10 ? #007002 : QQEF-50<-10 ? color.red : #E8E81A
    const color = val > 10 ? '#007002' : val < -10 ? '#FF0000' : '#E8E81A';
    return { time: bars[i].time, value: val, color };
  });

  // Slow QQE line: QQES-50
  const plot1 = trailing.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v - 50 };
  });

  // Pine: buySignalr = crossover(QQEF, QQES), sellSignallr = crossunder(QQEF, QQES)
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    const curFast = srArr[i] ?? 0;
    const prevFast = srArr[i - 1] ?? 0;
    const curSlow = trailing[i];
    const prevSlow = trailing[i - 1];
    if (prevFast <= prevSlow && curFast > curSlow) {
      if (showSignals) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      }
    } else if (prevFast >= prevSlow && curFast < curSlow) {
      if (showSignals) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: -10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
    markers,
  };
}

export const NormalizedQQE = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
