/**
 * Up/Down Volume
 *
 * Splits each bar's volume into "up" and "down" components.
 *
 * NOTE: TradingView's built-in "Up/Down Volume" (STD;UP_DOWN_Volume) derives the
 * split from LOWER-TIMEFRAME intrabar data (the up/down volume of each contained
 * lower-timeframe bar). That intrabar data is not available here, so — like this
 * library's Volume Delta / CVD — we APPROXIMATE the split from bar direction:
 * a bar closing up contributes its volume to "up", a bar closing down to "down".
 * Values therefore differ from TradingView when intrabar data would split a bar.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface UpDownVolumeInputs {
  // No inputs.
}

export const defaultInputs: UpDownVolumeInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Volume', color: '#089981', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Volume', color: '#F23645', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Delta', color: '#2962FF', lineWidth: 2, style: 'line' },
];

export const metadata = {
  title: 'Up/Down Volume',
  shortTitle: 'U/D Vol',
  overlay: false,
};

export function calculate(bars: Bar[], _inputs: Partial<UpDownVolumeInputs> = {}): IndicatorResult {
  const up: { time: number; value: number }[] = [];
  const down: { time: number; value: number }[] = [];
  const delta: { time: number; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    // Direction from close vs previous close; first bar falls back to close vs open.
    const ref = i > 0 ? bars[i - 1].close : bars[i].open;
    const isUp = bars[i].close >= ref;
    const upVol = isUp ? vol : 0;
    const downVol = isUp ? 0 : vol;

    up.push({ time: bars[i].time, value: upVol });
    down.push({ time: bars[i].time, value: -downVol }); // plotted below zero
    delta.push({ time: bars[i].time, value: upVol - downVol });
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': up,
      'plot1': down,
      'plot2': delta,
    },
  };
}

export const UpDownVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
