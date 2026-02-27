/**
 * Optimized Trend Tracker Oscillator (OTTO)
 *
 * Plots HOTT (High OTT) and LOTT (Low OTT) as non-overlay lines with fill.
 * HOTT = adjusted OTT trailing stop (lagged 2 bars), LOTT = VIDYA-ratio source.
 * Buy signal when LOTT crosses above HOTT, Sell when LOTT crosses below HOTT.
 *
 * Pine: overlay=false, two line plots + fill + buy/sell markers.
 * Supports 10 MA types: SMA, EMA, WMA, DEMA, TMA, VAR, WWMA, ZLEMA, TSF, HULL.
 *
 * Reference: TradingView "Optimized Trend Tracker Oscillator OTTO" by KivancOzbilgic
 */

import { getSourceSeries, ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface OTTOInputs {
  period: number;
  percent: number;
  fastVidyaLen: number;
  slowVidyaLen: number;
  correctingConst: number;
  src: SourceType;
  showSignals: boolean;
  highlighting: boolean;
  mav: string;
}

export const defaultInputs: OTTOInputs = {
  period: 2,
  percent: 0.6,
  fastVidyaLen: 10,
  slowVidyaLen: 25,
  correctingConst: 100000,
  src: 'close',
  showSignals: true,
  highlighting: true,
  mav: 'VAR',
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Optimization Coeff', defval: 0.6, min: 0, step: 0.1 },
  { id: 'fastVidyaLen', type: 'int', title: 'Fast VIDYA Length', defval: 10, min: 1 },
  { id: 'slowVidyaLen', type: 'int', title: 'Slow VIDYA Length', defval: 25, min: 1 },
  { id: 'correctingConst', type: 'int', title: 'Correcting Constant', defval: 100000, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'OTTO Crossing Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off?', defval: true },
  { id: 'mav', type: 'string', title: 'Moving Average Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF', 'HULL'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'hott', title: 'HOTT', color: '#FF0000', lineWidth: 2 },
  { id: 'lott', title: 'LOTT', color: '#0000FF', lineWidth: 2 },
];

export const metadata = {
  title: 'OTT Oscillator',
  shortTitle: 'OTTO',
  overlay: false,
};

// VAR (Variable Index Dynamic Average) calculation
function varFunc(srcArr: number[], length: number): number[] {
  const n = srcArr.length;
  const out: number[] = new Array(n);
  const valpha = 2 / (length + 1);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i];
    let vUD = 0;
    let vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      const cur = srcArr[j];
      const prev = j > 0 ? srcArr[j - 1] : cur;
      if (cur > prev) vUD += cur - prev;
      if (cur < prev) vDD += prev - cur;
    }
    const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
    out[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * out[i - 1];
  }
  return out;
}

// WWMA (Welles Wilder Moving Average)
function wwmaFunc(srcArr: number[], length: number): number[] {
  const n = srcArr.length;
  const out: number[] = new Array(n);
  const wwalpha = 1 / length;
  for (let i = 0; i < n; i++) {
    out[i] = i === 0 ? srcArr[i] : wwalpha * srcArr[i] + (1 - wwalpha) * out[i - 1];
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<OTTOInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { period, percent, fastVidyaLen, slowVidyaLen, correctingConst, src, showSignals, highlighting, mav } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray().map(v => v ?? 0);

  // Pine: mov1 = Var_Func1(src1, slength/2)  -- Pine float division: 25/2 = 12.5
  // Pine: mov2 = Var_Func1(src1, slength)
  // Pine: mov3 = Var_Func1(src1, slength*flength)
  const mov1 = varFunc(srcArr, slowVidyaLen / 2);
  const mov2 = varFunc(srcArr, slowVidyaLen);
  const mov3 = varFunc(srcArr, slowVidyaLen * fastVidyaLen);

  // Pine: src = mov1 / (mov2 - mov3 + coco)
  const normalizedSrc: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    normalizedSrc[i] = mov1[i] / (mov2[i] - mov3[i] + correctingConst);
  }

  // Compute selected MA on normalizedSrc
  const nSeries = Series.fromArray(bars, normalizedSrc);
  let mavg: number[];

  if (mav === 'SMA') {
    mavg = ta.sma(nSeries, period).toArray();
  } else if (mav === 'EMA') {
    mavg = ta.ema(nSeries, period).toArray();
  } else if (mav === 'WMA') {
    mavg = ta.wma(nSeries, period).toArray();
  } else if (mav === 'DEMA') {
    // Pine: DEMA = 2 * ta.ema(src, length) - ta.ema(ta.ema(src, length), length)
    const ema1 = ta.ema(nSeries, period);
    const ema2 = ta.ema(ema1, period);
    mavg = ema1.mul(2).sub(ema2).toArray();
  } else if (mav === 'TMA') {
    // Pine: ta.sma(ta.sma(src, ceil(length/2)), floor(length/2) + 1)
    const sma1 = ta.sma(nSeries, Math.max(1, Math.ceil(period / 2)));
    mavg = ta.sma(sma1, Math.floor(period / 2) + 1).toArray();
  } else if (mav === 'WWMA') {
    mavg = wwmaFunc(normalizedSrc, period);
  } else if (mav === 'ZLEMA') {
    // Pine: zxLag = length/2 == round(length/2) ? length/2 : (length-1)/2
    // Pine: zxEMAData = src + src - src[zxLag]
    // Pine: ZLEMA = ema(zxEMAData, length)
    const zxLag = (period / 2) === Math.round(period / 2) ? Math.floor(period / 2) : Math.floor((period - 1) / 2);
    const zxData: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const lagged = i >= zxLag ? normalizedSrc[i - zxLag] : normalizedSrc[0];
      zxData[i] = normalizedSrc[i] + normalizedSrc[i] - lagged;
    }
    mavg = ta.ema(Series.fromArray(bars, zxData), period).toArray();
  } else if (mav === 'TSF') {
    // Pine: lrc = linreg(src,length,0), lrc1 = linreg(src,length,1), lrs = lrc-lrc1, TSF = linreg(src,length,0)+lrs
    const lrc = ta.linreg(nSeries, period, 0).toArray();
    const lrc1 = ta.linreg(nSeries, period, 1).toArray();
    mavg = lrc.map((v, i) => (v ?? 0) + ((v ?? 0) - (lrc1[i] ?? 0)));
  } else if (mav === 'HULL') {
    mavg = ta.hma(nSeries, period).toArray();
  } else {
    // Default: VAR
    mavg = varFunc(normalizedSrc, period);
  }

  // Replace NaN/undefined with 0 for downstream computation
  for (let i = 0; i < n; i++) {
    if (mavg[i] == null || isNaN(mavg[i])) mavg[i] = 0;
  }

  // OTT trailing stop logic
  const fark = mavg.map(v => v * percent * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mavg[i] - fark[i];
    shortStop[i] = mavg[i] + fark[i];

    if (i > 0) {
      if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = period + 9;

  // Pine: HOTTLine = plot(nz(HOTT[2]), title='HOTT', color=red, linewidth=2)
  const hottPlot = ott.map((_, i) => ({
    time: bars[i].time,
    value: (i < warmup + 2) ? NaN : ott[i - 2],
  }));

  // Pine: LOTTLine = plot(nz(LOTT), title='LOTT', color=blue, linewidth=2)  where LOTT = src (normalizedSrc)
  const lottPlot = normalizedSrc.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine: FillColor = highlighting and LOTT < HOTT[2] ? color.new(red, 20) : color.new(green, 20)
  // Pine transparency 20 = CSS opacity 0.80
  const fillColors = normalizedSrc.map((v, i) => {
    if (i < warmup + 2) return 'transparent';
    if (!highlighting) return 'transparent';
    return v < ott[i - 2] ? 'rgba(255,0,0,0.80)' : 'rgba(0,128,0,0.80)';
  });

  // Pine: buySignalc = crossunder(HOTT[2], LOTT)  -- HOTT was >= LOTT, now < LOTT => Buy
  // Pine: sellSignallc = crossover(HOTT[2], LOTT) -- HOTT was <= LOTT, now > LOTT => Sell
  const markers: MarkerData[] = [];
  if (showSignals) {
    for (let i = warmup + 3; i < n; i++) {
      const curHOTT = ott[i - 2];
      const prevHOTT = ott[i - 3];
      const curLOTT = normalizedSrc[i];
      const prevLOTT = normalizedSrc[i - 1];

      if (prevHOTT >= prevLOTT && curHOTT < curLOTT) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
      }
      if (prevHOTT <= prevLOTT && curHOTT > curLOTT) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'hott': hottPlot, 'lott': lottPlot },
    fills: [{ plot1: 'hott', plot2: 'lott', options: { color: '#008000' }, colors: fillColors }],
    markers,
  };
}

export const OTTO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
