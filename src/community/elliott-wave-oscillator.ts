/**
 * Elliott Wave Oscillator (EWO)
 *
 * Difference between fast and slow EMA. Color-coded histogram.
 * EWO = EMA(close, 5) - EMA(close, 35)
 *
 * Reference: TradingView "Elliot Wave Oscillator [LazyBear]"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ElliottWaveOscInputs {
  fastLength: number;
  slowLength: number;
}

export const defaultInputs: ElliottWaveOscInputs = {
  fastLength: 5,
  slowLength: 35,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 35, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EWO', color: '#26A69A', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Elliott Wave Oscillator',
  shortTitle: 'EWO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ElliottWaveOscInputs> = {}): IndicatorResult {
  const { fastLength, slowLength } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'close');
  const fastEma = ta.ema(src, fastLength);
  const slowEma = ta.ema(src, slowLength);
  const ewo = fastEma.sub(slowEma);
  const ewoArr = ewo.toArray();

  const warmup = slowLength;
  const plot = ewoArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const color = v > 0 ? '#00E676' : '#FF5252';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const ElliottWaveOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
