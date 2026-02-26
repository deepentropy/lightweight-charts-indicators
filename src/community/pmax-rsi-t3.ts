/**
 * PMax on RSI with T3
 *
 * Tillson T3 smoothing applied to RSI, then PMax trailing stop.
 * T3 is a triple-smoothed EMA with a volume factor for reduced lag.
 *
 * Reference: TradingView "PMax on RSI with T3" (TV#527)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PMaxRSIT3Inputs {
  rsiLen: number;
  t3Len: number;
  t3Factor: number;
  atrMult: number;
}

export const defaultInputs: PMaxRSIT3Inputs = {
  rsiLen: 14,
  t3Len: 5,
  t3Factor: 0.7,
  atrMult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 't3Len', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Factor', defval: 0.7, min: 0, max: 1, step: 0.1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3 RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'PMax', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'PMax on RSI with T3',
  shortTitle: 'PMaxRSIT3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PMaxRSIT3Inputs> = {}): IndicatorResult {
  const { rsiLen, t3Len, t3Factor, atrMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src = getSourceSeries(bars, 'close');
  const rsiArr = ta.rsi(src, rsiLen).toArray();

  // Tillson T3: six cascaded EMAs with volume factor coefficients
  const b = t3Factor;
  const c1 = -(b * b * b);
  const c2 = 3 * b * b + 3 * b * b * b;
  const c3 = -6 * b * b - 3 * b - 3 * b * b * b;
  const c4 = 1 + 3 * b + b * b * b + 3 * b * b;

  // EMA helper for arrays
  const emaArray = (data: number[], len: number): number[] => {
    const alpha = 2 / (len + 1);
    const result: number[] = new Array(data.length);
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = alpha * data[i] + (1 - alpha) * result[i - 1];
    }
    return result;
  };

  // Fill NaN RSI values with 50 for smoothing
  const rsiClean = rsiArr.map((v) => (v == null || isNaN(v)) ? 50 : v);

  const e1 = emaArray(rsiClean, t3Len);
  const e2 = emaArray(e1, t3Len);
  const e3 = emaArray(e2, t3Len);
  const e4 = emaArray(e3, t3Len);
  const e5 = emaArray(e4, t3Len);
  const e6 = emaArray(e5, t3Len);

  const t3: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    t3[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
  }

  // ATR for PMax calculation (on the RSI scale, use absolute changes)
  const rsiAtr: number[] = new Array(n);
  rsiAtr[0] = 0;
  for (let i = 1; i < n; i++) {
    const trVal = Math.abs(t3[i] - t3[i - 1]);
    if (i < rsiLen) {
      rsiAtr[i] = trVal;
    } else if (i === rsiLen) {
      let sum = 0;
      for (let j = 1; j <= rsiLen; j++) sum += Math.abs(t3[j] - t3[j - 1]);
      rsiAtr[i] = sum / rsiLen;
    } else {
      rsiAtr[i] = (rsiAtr[i - 1] * (rsiLen - 1) + trVal) / rsiLen;
    }
  }

  // PMax trailing stop on T3 RSI
  const pmaxArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const val = t3[i];
    const atr = rsiAtr[i] * atrMult;
    const up = val - atr;
    const dn = val + atr;

    if (i === 0) {
      pmaxArr[i] = up;
      dirArr[i] = 1;
      continue;
    }

    const prevDir = dirArr[i - 1];
    const prevPmax = pmaxArr[i - 1];
    const prevVal = t3[i - 1];

    const trailUp = prevVal > prevPmax && prevDir === 1 ? Math.max(up, prevPmax) : up;
    const trailDn = prevVal < prevPmax && prevDir === -1 ? Math.min(dn, prevPmax) : dn;

    if (prevDir === 1) {
      if (val < trailUp) {
        dirArr[i] = -1;
        pmaxArr[i] = trailDn;
      } else {
        dirArr[i] = 1;
        pmaxArr[i] = trailUp;
      }
    } else {
      if (val > trailDn) {
        dirArr[i] = 1;
        pmaxArr[i] = trailUp;
      } else {
        dirArr[i] = -1;
        pmaxArr[i] = trailDn;
      }
    }
  }

  const warmup = rsiLen + t3Len * 6;

  const plot0 = t3.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = pmaxArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const PMaxRSIT3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
