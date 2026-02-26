/**
 * HawkEye Volume Indicator
 *
 * Volume colored by price action analysis. Compares close position relative
 * to midPrice and current range vs previous range.
 *
 * Reference: TradingView "HawkEye Volume Indicator" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface HawkEyeVolumeInputs {
  length: number;
}

export const defaultInputs: HawkEyeVolumeInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 4, style: 'columns' },
];

export const metadata = {
  title: 'HawkEye Volume',
  shortTitle: 'HEVol',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<HawkEyeVolumeInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const plot0 = bars.map((bar, i) => {
    const vol = bar.volume ?? 0;
    const midPrice = (bar.high + bar.low) / 2;
    const range = bar.high - bar.low;
    const prevRange = i > 0 ? bars[i - 1].high - bars[i - 1].low : range;

    let color: string;
    if (bar.close > midPrice && range < prevRange) {
      color = '#26A69A'; // green: bullish
    } else if (bar.close < midPrice && range < prevRange) {
      color = '#EF5350'; // red: bearish
    } else {
      color = '#787B86'; // gray: neutral
    }

    return { time: bar.time, value: vol, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const HawkEyeVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
