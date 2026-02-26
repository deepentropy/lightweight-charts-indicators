/**
 * Schaff Trend Cycle (STC)
 *
 * Double stochastic smoothing of MACD.
 * 1. Compute MACD (fast EMA - slow EMA)
 * 2. Stochastic normalize MACD to 0-100, smooth with factor
 * 3. Stochastic normalize result again, smooth with factor
 *
 * Reference: TradingView "Schaff Trend Cycle" by LazyBear
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SchaffTrendCycleInputs {
  length: number;
  fastLength: number;
  slowLength: number;
  factor: number;
  src: SourceType;
}

export const defaultInputs: SchaffTrendCycleInputs = {
  length: 10,
  fastLength: 23,
  slowLength: 50,
  factor: 0.5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 23, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 50, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 0.5, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STC', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Schaff Trend Cycle',
  shortTitle: 'STC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SchaffTrendCycleInputs> = {}): IndicatorResult {
  const { length, fastLength, slowLength, factor, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // MACD line
  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdArr = fastEMA.sub(slowEMA).toArray();

  const stcArr: number[] = [];
  const pfHistory: number[] = [];
  let f1 = 0;
  let pf = NaN;
  let f2 = 0;
  let pff = NaN;

  for (let i = 0; i < bars.length; i++) {
    const m = macdArr[i] ?? NaN;

    if (isNaN(m) || i < length - 1) {
      stcArr.push(NaN);
      continue;
    }

    // First stochastic: normalize MACD over 'length' period
    let v1 = m;
    let v1Max = m;
    const lookback1 = Math.min(i + 1, length);
    for (let j = 0; j < lookback1; j++) {
      const val = macdArr[i - j] ?? NaN;
      if (!isNaN(val)) {
        if (val < v1) v1 = val;
        if (val > v1Max) v1Max = val;
      }
    }
    const v2 = v1Max - v1;
    f1 = v2 > 0 ? ((m - v1) / v2) * 100 : f1;

    // Smooth first stochastic
    pf = isNaN(pf) ? f1 : pf + factor * (f1 - pf);

    // Second stochastic: normalize pf over 'length' period
    pfHistory.push(pf);
    if (pfHistory.length > length) pfHistory.shift();

    let v3 = pf;
    let v3Max = pf;
    for (let j = 0; j < pfHistory.length; j++) {
      if (pfHistory[j] < v3) v3 = pfHistory[j];
      if (pfHistory[j] > v3Max) v3Max = pfHistory[j];
    }
    const v4 = v3Max - v3;
    f2 = v4 > 0 ? ((pf - v3) / v4) * 100 : f2;

    // Smooth second stochastic
    pff = isNaN(pff) ? f2 : pff + factor * (f2 - pff);

    stcArr.push(pff);
  }

  const warmup = slowLength;
  const data = stcArr.map((value, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(value) ? NaN : value,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
  };
}

export const SchaffTrendCycle = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
