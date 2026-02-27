/**
 * Tillson T3 Moving Average
 *
 * Six-stage EMA cascade with volume factor coefficients.
 * Source = (high + low + 2*close) / 4
 * e1..e6 = cascaded EMA(prev, length)
 * T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 * where c1=-a^3, c2=3a^2+3a^3, c3=-6a^2-3a-3a^3, c4=1+3a+a^3+3a^2
 *
 * Reference: TradingView "Tillson T3" by KivancOzbilgic (fr3762)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TillsonT3Inputs {
  length: number;
  volumeFactor: number;
  lengthFibo: number;
  volumeFactorFibo: number;
  showFibo: boolean;
}

export const defaultInputs: TillsonT3Inputs = {
  length: 8,
  volumeFactor: 0.7,
  lengthFibo: 5,
  volumeFactorFibo: 0.618,
  showFibo: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'T3 Length', defval: 8, min: 1 },
  { id: 'volumeFactor', type: 'float', title: 'Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
  { id: 'lengthFibo', type: 'int', title: 'T3 Length fibo', defval: 5, min: 1 },
  { id: 'volumeFactorFibo', type: 'float', title: 'Volume Factor fibo', defval: 0.618, min: 0, max: 1, step: 0.001 },
  { id: 'showFibo', type: 'bool', title: 'Show T3 Fibonacci Ratio Line?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3', color: '#26A69A', lineWidth: 3 },
  { id: 'plot1', title: 'T3fibo', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Tillson T3',
  shortTitle: 'T3',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TillsonT3Inputs> = {}): IndicatorResult {
  const { length, volumeFactor, lengthFibo, volumeFactorFibo, showFibo } = { ...defaultInputs, ...inputs };
  const a = volumeFactor;

  const src = new Series(bars, (b) => (b.high + b.low + 2 * b.close) / 4);
  const e1 = ta.ema(src, length);
  const e2 = ta.ema(e1, length);
  const e3 = ta.ema(e2, length);
  const e4 = ta.ema(e3, length);
  const e5 = ta.ema(e4, length);
  const e6 = ta.ema(e5, length);

  const c1 = -a * a * a;
  const c2 = 3 * a * a + 3 * a * a * a;
  const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
  const c4 = 1 + 3 * a + a * a * a + 3 * a * a;

  const t3 = e6.mul(c1).add(e5.mul(c2)).add(e4.mul(c3)).add(e3.mul(c4));

  const warmup = length * 6;
  const t3Arr = t3.toArray();
  const plot0 = t3Arr.map((v, i) => {
    const val = i < warmup ? NaN : (v ?? NaN);
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (t3Arr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: val, color };
  });

  // Second T3 with Fibonacci factor (Pine: T3 Length fibo=5, Volume Factor fibo=0.618)
  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = { 'plot0': plot0 };

  if (showFibo) {
    const a2 = volumeFactorFibo;
    const ef1 = ta.ema(src, lengthFibo);
    const ef2 = ta.ema(ef1, lengthFibo);
    const ef3 = ta.ema(ef2, lengthFibo);
    const ef4 = ta.ema(ef3, lengthFibo);
    const ef5 = ta.ema(ef4, lengthFibo);
    const ef6 = ta.ema(ef5, lengthFibo);

    const cf1 = -a2 * a2 * a2;
    const cf2 = 3 * a2 * a2 + 3 * a2 * a2 * a2;
    const cf3 = -6 * a2 * a2 - 3 * a2 - 3 * a2 * a2 * a2;
    const cf4 = 1 + 3 * a2 + a2 * a2 * a2 + 3 * a2 * a2;

    const t3f = ef6.mul(cf1).add(ef5.mul(cf2)).add(ef4.mul(cf3)).add(ef3.mul(cf4));
    const warmupF = lengthFibo * 6;
    const t3fArr = t3f.toArray();

    plots['plot1'] = t3fArr.map((v, i) => {
      const val = i < warmupF ? NaN : (v ?? NaN);
      if (isNaN(val)) return { time: bars[i].time, value: NaN };
      const prev = i > 0 ? (t3fArr[i - 1] ?? NaN) : NaN;
      // Pine: blue if rising, purple if falling, yellow if flat
      const color = val > prev ? '#2196F3' : val < prev ? '#9C27B0' : '#FFEB3B';
      return { time: bars[i].time, value: val, color };
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const TillsonT3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
