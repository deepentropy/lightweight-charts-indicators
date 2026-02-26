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
}

export const defaultInputs: TillsonT3Inputs = {
  length: 8,
  volumeFactor: 0.7,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'T3 Length', defval: 8, min: 1 },
  { id: 'volumeFactor', type: 'float', title: 'Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3', color: '#26A69A', lineWidth: 3 },
];

export const metadata = {
  title: 'Tillson T3',
  shortTitle: 'T3',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TillsonT3Inputs> = {}): IndicatorResult {
  const { length, volumeFactor } = { ...defaultInputs, ...inputs };
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
  const plot0 = t3Arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const TillsonT3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
