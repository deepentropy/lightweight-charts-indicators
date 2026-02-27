/**
 * Bjorgum Triple EMA Strategy
 *
 * Three EMAs (5, 9, 21) computed on Heiken Ashi open for trend detection.
 * A hidden fast EMA (ema(hl2, 1)) is used for the first area fill.
 * EMA line colors change directionally: blue when rising, red when falling.
 * Bar color: blue when close > EMA-5 and close > EMA-9; pink when below both; gray otherwise.
 *
 * Pine fills:
 *   fill(emaslowplot, emafastplot, fillCol1, transp=85)  -- EMA-5 vs hidden fast
 *   fill(emaslowplot, emaslowplot2, fillCol2, transp=80) -- EMA-5 vs EMA-9
 *   fill(emaslowplot2, emaslowplot3, fillCol3, transp=75) -- EMA-9 vs EMA-21
 *
 * Reference: TradingView "Bjorgum Triple EMA Strategy" (TV#84)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface BjorgumTripleEmaInputs {
  fastLen: number;
  medLen: number;
  slowLen: number;
}

export const defaultInputs: BjorgumTripleEmaInputs = {
  fastLen: 5,
  medLen: 9,
  slowLen: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'EMA-Fast', defval: 5, min: 1 },
  { id: 'medLen', type: 'int', title: 'EMA-Medium', defval: 9, min: 1 },
  { id: 'slowLen', type: 'int', title: 'EMA-Slow', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA-5', color: '#64b5f6', lineWidth: 2 },
  { id: 'plot1', title: 'EMA fast', color: '#000000', lineWidth: 0 },
  { id: 'plot2', title: 'EMA-9', color: '#64b5f6', lineWidth: 2 },
  { id: 'plot3', title: 'EMA-21', color: '#64b5f6', lineWidth: 2 },
];

export const metadata = {
  title: 'Bjorgum Triple EMA Strategy',
  shortTitle: 'BJ HEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BjorgumTripleEmaInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { fastLen, medLen, slowLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Heiken Ashi values
  const haClose = new Array<number>(n);
  const haOpen = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    haClose[i] = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;
    if (i === 0) {
      haOpen[i] = (bars[i].open + bars[i].close) / 2;
    } else {
      haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
    }
  }

  const haOpenSeries = new Series(bars, (_b, i) => haOpen[i]);

  // Three EMAs on haOpen
  const fastArr = ta.ema(haOpenSeries, fastLen).toArray();
  const medArr = ta.ema(haOpenSeries, medLen).toArray();
  const slowArr = ta.ema(haOpenSeries, slowLen).toArray();

  // Hidden fast EMA: ema(hl2, 1) -- plotted with transp=100 (invisible line)
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const hiddenFastArr = ta.ema(hl2Series, 1).toArray();

  const warmup = slowLen;

  // Build plot data with directional colors
  // Pine: mycolor = up ? #64b5f6 : down ? #d32f2f : na
  // up = ema > ema[1], down = ema < ema[1]
  const plot0: Array<{ time: number; value: number; color?: string }> = new Array(n);
  const plot1: Array<{ time: number; value: number }> = new Array(n);
  const plot2: Array<{ time: number; value: number; color?: string }> = new Array(n);
  const plot3: Array<{ time: number; value: number; color?: string }> = new Array(n);

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      plot0[i] = { time: t, value: NaN };
      plot1[i] = { time: t, value: NaN };
      plot2[i] = { time: t, value: NaN };
      plot3[i] = { time: t, value: NaN };
      continue;
    }

    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    const s = slowArr[i] ?? NaN;
    const hf = hiddenFastArr[i] ?? NaN;

    // EMA-5 directional color (transp=55 -> alpha ~0.45)
    const fPrev = fastArr[i - 1] ?? NaN;
    const fColor = f > fPrev ? 'rgba(100, 181, 246, 0.45)' : f < fPrev ? 'rgba(211, 47, 47, 0.45)' : undefined;
    plot0[i] = { time: t, value: f, color: fColor };

    // Hidden fast EMA (transp=100 -> invisible)
    plot1[i] = { time: t, value: hf };

    // EMA-9 directional color (transp=45 -> alpha ~0.55)
    const mPrev = medArr[i - 1] ?? NaN;
    const mColor = m > mPrev ? 'rgba(100, 181, 246, 0.55)' : m < mPrev ? 'rgba(211, 47, 47, 0.55)' : undefined;
    plot2[i] = { time: t, value: m, color: mColor };

    // EMA-21 directional color (transp=35 -> alpha ~0.65)
    const sPrev = slowArr[i - 1] ?? NaN;
    const sColor = s > sPrev ? 'rgba(100, 181, 246, 0.65)' : s < sPrev ? 'rgba(211, 47, 47, 0.65)' : undefined;
    plot3[i] = { time: t, value: s, color: sColor };
  }

  // Fill colors
  // fill1: EMA-5 vs hidden fast EMA (Pine transp=85 -> alpha ~0.15)
  // fillCol1 = bjemaslow > bjemafast ? #ef5350 : bjemaslow < bjemafast ? #64b5f6 : na
  const fillCol1: string[] = new Array(n);
  // fill2: EMA-5 vs EMA-9 (Pine transp=80 -> alpha ~0.20)
  // fillCol2 = bjemaslow2 > bjemaslow ? #ef5350 : bjemaslow2 < bjemaslow ? #64b5f6 : na
  const fillCol2: string[] = new Array(n);
  // fill3: EMA-9 vs EMA-21 (Pine transp=75 -> alpha ~0.25)
  // fillCol3 = bjemaslow3 > bjemaslow2 ? #ef5350 : bjemaslow3 < bjemaslow2 ? #64b5f6 : na
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

    fillCol1[i] = f > hf ? 'rgba(239, 83, 80, 0.15)' : f < hf ? 'rgba(100, 181, 246, 0.15)' : 'transparent';
    fillCol2[i] = m > f ? 'rgba(239, 83, 80, 0.20)' : m < f ? 'rgba(100, 181, 246, 0.20)' : 'transparent';
    fillCol3[i] = s > m ? 'rgba(239, 83, 80, 0.25)' : s < m ? 'rgba(100, 181, 246, 0.25)' : 'transparent';
  }

  // barcolor: uc = close > fast AND close > med -> #64b5f6
  //           dc = close < fast AND close < med -> #e91e63
  //           else -> #b2b5be
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
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(100, 181, 246, 0.15)' }, colors: fillCol1 },
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(100, 181, 246, 0.20)' }, colors: fillCol2 },
      { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(100, 181, 246, 0.25)' }, colors: fillCol3 },
    ],
    barColors,
  };
}

export const BjorgumTripleEma = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
