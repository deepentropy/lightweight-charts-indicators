/**
 * Bjorgum Triple EMA Strategy
 *
 * Three EMAs (fast, medium, slow) for trend detection and crossover signals.
 * Trend is bullish when all three are aligned (fast > med > slow).
 * Buy signal: fast crosses above med while above slow.
 * Sell signal: fast crosses below med while below slow.
 *
 * Reference: TradingView "Bjorgum Triple EMA" (TV#84)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface BjorgumTripleEmaInputs {
  fastLen: number;
  medLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: BjorgumTripleEmaInputs = {
  fastLen: 8,
  medLen: 21,
  slowLen: 55,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 8, min: 1 },
  { id: 'medLen', type: 'int', title: 'Medium Length', defval: 21, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 55, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Medium EMA', color: '#FF9800', lineWidth: 2 },
  { id: 'plot2', title: 'Slow EMA', color: '#EF5350', lineWidth: 2 },
  { id: 'plot3', title: 'Hidden Fast EMA (hl2)', color: '#000000', lineWidth: 0 },
];

export const metadata = {
  title: 'Bjorgum Triple EMA',
  shortTitle: 'BTEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BjorgumTripleEmaInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { fastLen, medLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const fastArr = ta.ema(source, fastLen).toArray();
  const medArr = ta.ema(source, medLen).toArray();
  const slowArr = ta.ema(source, slowLen).toArray();

  // Hidden fast EMA: ema(hl2, 1) - Pine: bjemafast = ema(hl2, 1), plotted with transp=100
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const hiddenFastArr = ta.ema(hl2Series, 1).toArray();

  const warmup = slowLen;
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    const s = slowArr[i] ?? NaN;
    const pf = fastArr[i - 1] ?? NaN;
    const pm = medArr[i - 1] ?? NaN;

    // Buy: fast crosses above med while both above slow
    if (pf <= pm && f > m && f > s) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    }
    // Sell: fast crosses below med while both below slow
    if (pf >= pm && f < m && f < s) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = medArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  // Hidden fast EMA plot (invisible, used for fill) - Pine: plot(bjemafast, color=#000000, transp=100)
  const plot3 = hiddenFastArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  // Fill colors: Pine uses directional coloring for all 3 fills
  // fill1: fast EMA vs hidden fast EMA (Pine: fillCol1 = bjemaslow > bjemafast ? red : blue)
  const fillCol1: string[] = new Array(n);
  // fill2: med EMA vs fast EMA (Pine: fillCol2 = bjemaslow2 > bjemaslow ? red : blue)
  const fillCol2: string[] = new Array(n);
  // fill3: slow EMA vs med EMA (Pine: fillCol3 = bjemaslow3 > bjemaslow2 ? red : blue)
  const fillCol3: string[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillCol1[i] = 'transparent';
      fillCol2[i] = 'transparent';
      fillCol3[i] = 'transparent';
      continue;
    }
    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    const s = slowArr[i] ?? NaN;
    const hf = hiddenFastArr[i] ?? NaN;

    // Pine: fillCol1 = bjemaslow > bjemafast ? #ef5350 : fillData2 ? #64b5f6 : na (transp=85)
    fillCol1[i] = f > hf ? 'rgba(239, 83, 80, 0.15)' : f < hf ? 'rgba(100, 181, 246, 0.15)' : 'transparent';
    // Pine: fillCol2 (transp=80)
    fillCol2[i] = m > f ? 'rgba(239, 83, 80, 0.20)' : m < f ? 'rgba(100, 181, 246, 0.20)' : 'transparent';
    // Pine: fillCol3 (transp=75)
    fillCol3[i] = s > m ? 'rgba(239, 83, 80, 0.25)' : s < m ? 'rgba(100, 181, 246, 0.25)' : 'transparent';
  }

  // barcolor: Pine barColor = uc ? #64b5f6 : dc ? #e91e63 : #b2b5be
  // uc = close > fast AND close > med; dc = close < fast AND close < med
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    if (isNaN(f) || isNaN(m)) continue;
    const c = bars[i].close;
    const color = (c > f && c > m) ? '#64B5F6' : (c < f && c < m) ? '#E91E63' : '#B2B5BE';
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    fills: [
      { plot1: 'plot0', plot2: 'plot3', options: { color: 'rgba(100, 181, 246, 0.15)' }, colors: fillCol1 },
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(100, 181, 246, 0.20)' }, colors: fillCol2 },
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(100, 181, 246, 0.25)' }, colors: fillCol3 },
    ],
    markers,
    barColors,
  };
}

export const BjorgumTripleEma = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
