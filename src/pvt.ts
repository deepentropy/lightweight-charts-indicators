/**
 * Price Volume Trend (PVT) Indicator
 *
 * Cumulative volume indicator that relates volume to price change.
 * PVT = cumulative(change(close) / close[1] * volume)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PVTInputs {
  // No inputs needed
}

export const defaultInputs: PVTInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PVT', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Volume Trend',
  shortTitle: 'PVT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PVTInputs> = {}): IndicatorResult {
  // PVT = cumulative(change(close) / close[1] * volume)
  const pvtValues: number[] = [];
  let cumulative = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      pvtValues.push(0);
      continue;
    }

    const prevClose = bars[i - 1].close;
    if (prevClose === 0) {
      pvtValues.push(cumulative);
      continue;
    }

    const change = bars[i].close - prevClose;
    const pvtChange = (change / prevClose) * (bars[i].volume ?? 0);
    cumulative += pvtChange;
    pvtValues.push(cumulative);
  }

  const pvtData = pvtValues.map((value, i) => ({
    time: bars[i].time,
    value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': pvtData,
    },
  };
}

export const PVT = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
