/**
 * Profit Maximizer (PMax)
 *
 * ATR-based trailing stop applied to a moving average (not raw close).
 * SuperTrend-style logic on the MA value determines trend direction.
 *
 * Reference: TradingView "Profit Maximizer PMax" (TV#548)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ProfitMaximizerInputs {
  atrPeriod: number;
  atrMult: number;
  maLength: number;
  maType: string;
}

export const defaultInputs: ProfitMaximizerInputs = {
  atrPeriod: 10,
  atrMult: 3.0,
  maLength: 10,
  maType: 'ema',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 10, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 10, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['sma', 'ema', 'wma', 'hma'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PMax', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MA', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Profit Maximizer',
  shortTitle: 'PMax',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ProfitMaximizerInputs> = {}): IndicatorResult {
  const { atrPeriod, atrMult, maLength, maType } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src = getSourceSeries(bars, 'close');

  // Calculate MA based on type
  let maSeries;
  switch (maType) {
    case 'sma': maSeries = ta.sma(src, maLength); break;
    case 'wma': maSeries = ta.wma(src, maLength); break;
    case 'hma': maSeries = ta.hma(src, maLength); break;
    default: maSeries = ta.ema(src, maLength); break;
  }
  const maArr = maSeries.toArray();

  const atrArr = ta.atr(bars, atrPeriod).toArray();

  // SuperTrend-style trailing stop on MA
  const pmaxArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const ma = maArr[i] ?? 0;
    const atr = (atrArr[i] ?? 0) * atrMult;
    const up = ma - atr;
    const dn = ma + atr;

    if (i === 0) {
      pmaxArr[i] = up;
      dirArr[i] = 1;
      continue;
    }

    const prevDir = dirArr[i - 1];
    const prevPmax = pmaxArr[i - 1];
    const prevMa = maArr[i - 1] ?? 0;

    const trailUp = prevMa > prevPmax && prevDir === 1 ? Math.max(up, prevPmax) : up;
    const trailDn = prevMa < prevPmax && prevDir === -1 ? Math.min(dn, prevPmax) : dn;

    if (prevDir === 1) {
      if (ma < trailUp) {
        dirArr[i] = -1;
        pmaxArr[i] = trailDn;
      } else {
        dirArr[i] = 1;
        pmaxArr[i] = trailUp;
      }
    } else {
      if (ma > trailDn) {
        dirArr[i] = 1;
        pmaxArr[i] = trailUp;
      } else {
        dirArr[i] = -1;
        pmaxArr[i] = trailDn;
      }
    }
  }

  const warmup = Math.max(atrPeriod, maLength);

  const plot0 = pmaxArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = maArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const ProfitMaximizer = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
