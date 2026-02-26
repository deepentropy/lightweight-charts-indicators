/**
 * TKP T3 Trend with PSAR
 *
 * Tillson T3 moving average combined with Parabolic SAR for trend confirmation.
 * T3 uses a 6-stage EMA cascade with volume factor coefficients.
 * PSAR provides additional trend direction via manual computation.
 *
 * Reference: TradingView "TKP T3 Trend with PSAR" (TV#737)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface T3PsarInputs {
  t3Len: number;
  t3Factor: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  src: SourceType;
}

export const defaultInputs: T3PsarInputs = {
  t3Len: 5,
  t3Factor: 0.7,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 't3Len', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'PSAR', color: '#787B86', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'TKP T3 Trend with PSAR',
  shortTitle: 'T3+SAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<T3PsarInputs> = {}): IndicatorResult {
  const { t3Len, t3Factor, sarStart, sarInc, sarMax, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  // T3 calculation: 6-stage EMA cascade
  const a = t3Factor;
  const e1 = ta.ema(source, t3Len);
  const e2 = ta.ema(e1, t3Len);
  const e3 = ta.ema(e2, t3Len);
  const e4 = ta.ema(e3, t3Len);
  const e5 = ta.ema(e4, t3Len);
  const e6 = ta.ema(e5, t3Len);

  const c1 = -a * a * a;
  const c2 = 3 * a * a + 3 * a * a * a;
  const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
  const c4 = 1 + 3 * a + a * a * a + 3 * a * a;

  const t3 = e6.mul(c1).add(e5.mul(c2)).add(e4.mul(c3)).add(e3.mul(c4));
  const t3Arr = t3.toArray();

  // Manual SAR computation
  const sarArr: number[] = new Array(n);
  const sarDirArr: number[] = new Array(n);
  let af = sarStart;
  let ep = bars[0].high;
  sarArr[0] = bars[0].low;
  sarDirArr[0] = 1;

  for (let i = 1; i < n; i++) {
    const prevDir = sarDirArr[i - 1];
    let sar = sarArr[i - 1] + af * (ep - sarArr[i - 1]);

    if (prevDir === 1) {
      sar = Math.min(sar, bars[i - 1].low);
      if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
      if (bars[i].low < sar) {
        sarDirArr[i] = -1;
        sar = ep;
        ep = bars[i].low;
        af = sarStart;
      } else {
        sarDirArr[i] = 1;
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + sarInc, sarMax);
        }
      }
    } else {
      sar = Math.max(sar, bars[i - 1].high);
      if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
      if (bars[i].high > sar) {
        sarDirArr[i] = 1;
        sar = ep;
        ep = bars[i].high;
        af = sarStart;
      } else {
        sarDirArr[i] = -1;
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + sarInc, sarMax);
        }
      }
    }
    sarArr[i] = sar;
  }

  const warmup = t3Len * 6;

  const plot0 = t3Arr.map((v, i) => {
    const val = i < warmup ? NaN : (v ?? NaN);
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (t3Arr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: val, color };
  });

  const plot1 = sarArr.map((v, i) => ({
    time: bars[i].time,
    value: i < 1 ? NaN : v,
    color: sarDirArr[i] === 1 ? '#26A69A' : '#EF5350',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const T3Psar = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
