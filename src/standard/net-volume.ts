/**
 * Net Volume Indicator
 *
 * Displays the net volume (upVolume - downVolume) for each bar, as one blue line, with a zero line.
 * Positive values indicate buying pressure, negative indicates selling pressure.
 *
 * The standard indicator splits the volume of each bar into up and down volume from lower-timeframe (intrabar)
 * volume: 'Use custom timeframe' / 'Timeframe', else automatic ("1S" on seconds charts, "1" intraday, "5" daily,
 * "60" above). See src/lower-tf-volume.ts:
 * - lower timeframe = chart timeframe (e.g. 'Timeframe' "1D" on a daily chart, automatic on a 1-minute chart): the
 *   chart bars are the intrabars and the values are the original ones (library rule: up when close > open, down
 *   when close < open, else by close vs previous close, else as the previous bar)
 * - lower timeframe below the chart timeframe: the chart bars do not have the intrabar volume; the values are an
 *   estimate that gives all the volume of a bar to up or down volume by close vs open (0 when close equals open)
 * - lower timeframe above the chart timeframe: error, as the original
 * The design (plot colour, zero line) is the one of the standard indicator.
 *
 * Based on the standard Net Volume indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import { lowerTimeframe, upDownVolumeOfChartBars } from '../lower-tf-volume';

export interface NetVolumeInputs {
  /** Use the custom lower timeframe instead of the automatic one */
  useCustomTimeframe: boolean;
  /** Custom lower timeframe of the intrabar volume */
  lowerTimeframe: string;
}

export const defaultInputs: NetVolumeInputs = {
  useCustomTimeframe: false,
  lowerTimeframe: '1',
};

const LOWER_TF_TOOLTIP = 'The indicator scans lower timeframe data to approximate Net volume. By default, the timeframe is chosen automatically. These inputs override this with a custom timeframe. \n\nHigher timeframes provide more historical data, but the data will be less precise.';

export const inputConfig: InputConfig[] = [
  { id: 'useCustomTimeframe', type: 'bool', title: 'Use custom timeframe', defval: false, tooltip: LOWER_TF_TOOLTIP, display: 'none' },
  { id: 'lowerTimeframe', type: 'timeframe', title: 'Timeframe', defval: '1', active: 'useCustomTimeframe' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Net Volume', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Net Volume',
  shortTitle: 'Net Vol',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<NetVolumeInputs> = {}): IndicatorResult {
  const { useCustomTimeframe, lowerTimeframe: customTimeframe } = { ...defaultInputs, ...inputs };
  const { exact } = lowerTimeframe(bars, useCustomTimeframe, customTimeframe);
  const exactDelta = exact ? upDownVolumeOfChartBars(bars).delta : [];
  const deltaValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volume = bar.volume ?? 0;

    // Original delta (lower timeframe = chart timeframe), else estimate from close vs open
    let delta: number;
    if (exact) {
      delta = exactDelta[i];
    } else if (bar.close > bar.open) {
      // Bullish bar - all volume is "up volume"
      delta = volume;
    } else if (bar.close < bar.open) {
      // Bearish bar - all volume is "down volume"
      delta = -volume;
    } else {
      // Neutral bar - no clear direction
      delta = 0;
    }

    deltaValues.push(delta);
  }

  const plotData = deltaValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const NetVolume = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
