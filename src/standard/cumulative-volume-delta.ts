/**
 * Cumulative Volume Delta (CVD) Indicator
 *
 * Tracks cumulative volume delta within anchor periods (daily, weekly, etc.).
 * Each candle starts at the CVD of the previous bar (0 on the first bar of a new anchor period) and closes at
 * open + the volume delta of the bar; high / low are open + the highest / lowest running delta inside the bar.
 *
 * PineScript display:
 *   col = lastVolume >= openVolume ? color.teal : color.red
 *   hline(0)
 *   plotcandle(openVolume, maxVolume, minVolume, lastVolume, "CVD", color=col, bordercolor=col, wickcolor=col)
 *
 * The standard indicator splits the volume of each bar into up and down volume from lower-timeframe (intrabar)
 * volume: 'Use custom timeframe' / 'Timeframe', else automatic ("1S" on seconds charts, "1" intraday, "5" daily,
 * "60" above). See src/lower-tf-volume.ts:
 * - lower timeframe = chart timeframe (e.g. 'Timeframe' "1D" on a daily chart, automatic on a 1-minute chart): the
 *   chart bars are the intrabars and the values are the original ones (library rule: up when close > open, down
 *   when close < open, else by close vs previous close, else as the previous bar)
 * - lower timeframe below the chart timeframe: the chart bars do not have the intrabar volume; the values are an
 *   estimate that gives all the volume of a bar to up or down volume by close vs open (0 when equal), with the bar
 *   as the only intrabar (high / low = open + max / min of 0 and the delta)
 * - lower timeframe above the chart timeframe: error, as the original
 * 'Anchor period' accepts any timeframe ("" = the chart timeframe: the CVD restarts on every bar); the periods are
 * taken from the UTC calendar and the bars, as the bars carry no exchange time zone or session (see
 * src/anchor-period.ts). The design (colours, zero line) is the one of the
 * standard indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { periodStarts } from '../anchor-period';
import { lowerTimeframe, upDownVolumeOfChartBars } from '../lower-tf-volume';

export interface CumulativeVolumeDeltaInputs {
  /** Anchor period: any timeframe string ("1D", "1W", "240", ...; "" = chart timeframe) */
  anchorTimeframe: string;
  /** Use the custom lower timeframe instead of the automatic one */
  useCustomTimeframe: boolean;
  /** Custom lower timeframe of the intrabar volume */
  lowerTimeframe: string;
}

export const defaultInputs: CumulativeVolumeDeltaInputs = {
  anchorTimeframe: '1D',
  useCustomTimeframe: false,
  lowerTimeframe: '1',
};

const LOWER_TF_TOOLTIP = 'The indicator scans lower timeframe data to approximate up and down volume used in the delta calculation. By default, the timeframe is chosen automatically. These inputs override this with a custom timeframe. \n\nHigher timeframes provide more historical data, but the data will be less precise.';

export const inputConfig: InputConfig[] = [
  { id: 'anchorTimeframe', type: 'timeframe', title: 'Anchor period', defval: '1D' },
  { id: 'useCustomTimeframe', type: 'bool', title: 'Use custom timeframe', defval: false, tooltip: LOWER_TF_TOOLTIP, display: 'none' },
  { id: 'lowerTimeframe', type: 'timeframe', title: 'Timeframe', defval: '1', active: 'useCustomTimeframe' },
];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'cvd', title: 'CVD' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export const metadata = {
  title: 'Cumulative Volume Delta',
  shortTitle: 'CVD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CumulativeVolumeDeltaInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const { anchorTimeframe, useCustomTimeframe, lowerTimeframe: customTimeframe } = { ...defaultInputs, ...inputs };
  const { exact } = lowerTimeframe(bars, useCustomTimeframe, customTimeframe);
  const exactDelta = exact ? upDownVolumeOfChartBars(bars).delta : [];
  // timeframe.change(anchorTimeframe); "" restarts on every bar
  const starts = periodStarts(bars, anchorTimeframe);

  const candles: PlotCandleData[] = [];
  let lastVolume = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volume = bar.volume ?? 0;

    // Volume delta of the bar: original (lower timeframe = chart timeframe), else estimate from close vs open
    let delta: number;
    if (exact) {
      delta = exactDelta[i];
    } else if (bar.close > bar.open) {
      delta = volume;
    } else if (bar.close < bar.open) {
      delta = -volume;
    } else {
      delta = 0;
    }

    // ta.requestVolumeDelta: anchorChange on the first bar and on each new anchor period
    const anchorChange = i === 0 || starts[i] !== starts[i - 1];
    const openVolume = anchorChange ? 0 : lastVolume;
    // highest / lowest running delta inside the bar (from 0): the bar is the only intrabar
    const hiVolume = openVolume + Math.max(delta, 0);
    const loVolume = openVolume + Math.min(delta, 0);
    lastVolume = openVolume + delta;

    // col = lastVolume >= openVolume ? color.teal : color.red
    const col = ge(lastVolume, openVolume) ? '#089981' : '#F23645';
    candles.push({
      time: bar.time as number,
      open: openVolume,
      high: hiVolume,
      low: loVolume,
      close: lastVolume,
      color: col,
      borderColor: col,
      wickColor: col,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { cvd: candles },
  };
}

export const CumulativeVolumeDelta = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  hlineConfig,
};
