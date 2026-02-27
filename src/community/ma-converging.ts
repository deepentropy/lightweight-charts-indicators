/**
 * Moving Average Converging [LuxAlgo]
 *
 * Adaptive MA using alpha adjustment based on crossovers and trend.
 * When price crosses the MA, alpha resets. When trending (new highs/lows),
 * alpha increases by k = 1/increment, making the MA converge faster.
 * A fast MA (fma) tracks extremes and smooths toward price.
 *
 * Reference: TradingView "Moving Average Converging [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MAConvergingInputs {
  length: number;
  increment: number;
  fast: number;
}

export const defaultInputs: MAConvergingInputs = {
  length: 100,
  increment: 10,
  fast: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 2 },
  { id: 'increment', type: 'int', title: 'Increment', defval: 10, min: 1 },
  { id: 'fast', type: 'int', title: 'Fast', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: '#ff5d00', lineWidth: 2 },
  { id: 'plot1', title: 'Converging MA', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Converging',
  shortTitle: 'MA Converging',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MAConvergingInputs> = {}): IndicatorResult {
  const { length, increment, fast } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  const upperArr = ta.highest(high, length).toArray();
  const lowerArr = ta.lowest(low, length).toArray();
  const initMaArr = ta.sma(close, length).toArray();

  const k = 1 / increment;

  const maArr: number[] = new Array(n);
  const fmaArr: number[] = new Array(n);
  const alphaArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const src = bars[i].close;

    if (i === 0) {
      const initMa = initMaArr[i];
      maArr[i] = (initMa != null && !isNaN(initMa)) ? initMa : src;
      fmaArr[i] = src;
      alphaArr[i] = 2 / (length + 1);
      continue;
    }

    const prevMa = maArr[i - 1];
    const prevFma = fmaArr[i - 1];
    const prevAlpha = alphaArr[i - 1];

    // Detect cross: src crosses prevMa (src and prevMa were on opposite sides)
    const prevSrc = bars[i - 1].close;
    const cross = (prevSrc <= prevMa && src > prevMa) || (prevSrc >= prevMa && src < prevMa);

    // Alpha update
    let alpha: number;
    if (cross) {
      alpha = 2 / (length + 1);
    } else if (src > prevMa && upperArr[i] > upperArr[i - 1]) {
      alpha = prevAlpha + k;
    } else if (src < prevMa && lowerArr[i] < lowerArr[i - 1]) {
      alpha = prevAlpha + k;
    } else {
      alpha = prevAlpha;
    }
    alphaArr[i] = alpha;

    // MA update: ma = nz(ma[1] + alpha[1] * (src - ma[1]), init_ma)
    // Uses previous alpha (alpha[1]) to update
    const rawMa = prevMa + prevAlpha * (src - prevMa);
    maArr[i] = isNaN(rawMa) ? ((initMaArr[i] != null && !isNaN(initMaArr[i])) ? initMaArr[i] : src) : rawMa;

    // FMA update
    let rawFma: number;
    if (cross) {
      rawFma = (src + prevFma) / 2;
    } else if (src > maArr[i]) {
      rawFma = Math.max(src, prevFma) + (src - prevFma) / fast;
    } else {
      rawFma = Math.min(src, prevFma) + (src - prevFma) / fast;
    }
    fmaArr[i] = isNaN(rawFma) ? src : rawFma;
  }

  const warmup = length;

  const plot0 = fmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = maArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: (i < warmup) ? undefined : (fmaArr[i] > maArr[i] ? '#008080' : '#FF0000'),
  }));

  const fillColors = bars.map((_, i) => {
    if (i < warmup) return 'transparent';
    return fmaArr[i] > maArr[i] ? 'rgba(0,150,136,0.15)' : 'rgba(239,83,80,0.15)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,150,136,0.15)' }, colors: fillColors },
    ],
  };
}

export const MAConverging = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
