/**
 * Positive Volume Index (PVI)
 *
 * Cumulative index that changes only on days when volume INCREASES versus the
 * prior bar, by the bar's percentage price change. Tracks the "crowd" that is
 * presumed to trade on active days. Seeded at 1000; an EMA(255) acts as signal.
 *
 * Based on TradingView's built-in "Positive Volume Index" (STD;Positive_Volume_Index).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PVIInputs {
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: PVIInputs = {
  signalLength: 255,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'Signal EMA Length', defval: 255, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PVI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Positive Volume Index',
  shortTitle: 'PVI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PVIInputs> = {}): IndicatorResult {
  const { signalLength } = { ...defaultInputs, ...inputs };

  const pvi: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { pvi.push(1000); continue; }
    const prevClose = bars[i - 1].close;
    const roc = prevClose !== 0 ? ((bars[i].close - prevClose) / prevClose) * 100 : 0;
    const vol = bars[i].volume ?? 0;
    const prevVol = bars[i - 1].volume ?? 0;
    pvi.push(vol > prevVol ? pvi[i - 1] + roc : pvi[i - 1]);
  }

  const pviSeries = new Series(bars, (_, i) => pvi[i]);
  const emaArr = ta.ema(pviSeries, signalLength).toArray();

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': pvi.map((value, i) => ({ time: bars[i].time, value })),
      'plot1': emaArr.map((value, i) => ({ time: bars[i].time, value: value ?? NaN })),
    },
  };
}

export const PositiveVolumeIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
