/**
 * Negative Volume Index (NVI)
 *
 * Cumulative index that changes only on days when volume DECREASES versus the
 * prior bar, by the bar's percentage price change. Tracks "smart money" that is
 * presumed to trade on quiet days. Seeded at 1000; an EMA(255) acts as signal.
 *
 * Based on TradingView's built-in "Negative Volume Index" (STD;Negative_Volume_Index).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface NVIInputs {
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: NVIInputs = {
  signalLength: 255,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'Signal EMA Length', defval: 255, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NVI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Negative Volume Index',
  shortTitle: 'NVI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<NVIInputs> = {}): IndicatorResult {
  const { signalLength } = { ...defaultInputs, ...inputs };

  const nvi: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { nvi.push(1000); continue; }
    const prevClose = bars[i - 1].close;
    const roc = prevClose !== 0 ? ((bars[i].close - prevClose) / prevClose) * 100 : 0;
    const vol = bars[i].volume ?? 0;
    const prevVol = bars[i - 1].volume ?? 0;
    nvi.push(vol < prevVol ? nvi[i - 1] + roc : nvi[i - 1]);
  }

  const nviSeries = new Series(bars, (_, i) => nvi[i]);
  const emaArr = ta.ema(nviSeries, signalLength).toArray();

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': nvi.map((value, i) => ({ time: bars[i].time, value })),
      'plot1': emaArr.map((value, i) => ({ time: bars[i].time, value: value ?? NaN })),
    },
  };
}

export const NegativeVolumeIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
