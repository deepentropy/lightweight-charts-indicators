/**
 * Cumulative Volume Delta (CVD) Indicator
 *
 * Tracks cumulative volume delta within anchor periods (daily, weekly, etc.).
 * Approximates up/down volume by comparing close to open price.
 * Resets at each anchor period boundary.
 *
 * Note: TradingView's version uses intrabar data for more precise calculation.
 * This implementation uses close vs open as an approximation.
 *
 * Based on TradingView's Cumulative Volume Delta indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CumulativeVolumeDeltaInputs {
  /** Anchor timeframe for period boundaries */
  anchorTimeframe: string;
}

export const defaultInputs: CumulativeVolumeDeltaInputs = {
  anchorTimeframe: '1D',
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorTimeframe', type: 'string', title: 'Anchor Period', defval: '1D', options: ['1D', '1W', '1M'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Open Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Max Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Min Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Close Volume', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Cumulative Volume Delta',
  shortTitle: 'CVD',
  overlay: false,
};

/**
 * Get the start of the period for a given timestamp based on the anchor timeframe
 */
function getStartOfPeriod(timestamp: number, timeframe: string): number {
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);
  const tf = timeframe.toUpperCase();

  if (tf === '1W' || tf === 'W') {
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    date.setUTCHours(0, 0, 0, 0);
  } else if (tf === '1M' || tf === 'M') {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return timestamp < 1e12 ? Math.floor(date.getTime() / 1000) : date.getTime();
}

/**
 * Check if a new period has started
 */
function isNewPeriod(currentTime: number, previousTime: number | null, timeframe: string): boolean {
  if (previousTime === null) return true;
  return getStartOfPeriod(currentTime, timeframe) !== getStartOfPeriod(previousTime, timeframe);
}

export function calculate(bars: Bar[], inputs: Partial<CumulativeVolumeDeltaInputs> = {}): IndicatorResult {
  const { anchorTimeframe } = { ...defaultInputs, ...inputs };

  const openValues: number[] = [];
  const maxValues: number[] = [];
  const minValues: number[] = [];
  const closeValues: number[] = [];

  let prevTime: number | null = null;
  let cumDelta = 0;
  let periodOpenDelta = 0;
  let periodMaxDelta = 0;
  let periodMinDelta = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barTime = typeof bar.time === 'number' ? bar.time : new Date(bar.time as string).getTime() / 1000;
    const volume = bar.volume ?? 0;

    // Check for new anchor period
    const isAnchor = isNewPeriod(barTime, prevTime, anchorTimeframe);

    if (isAnchor) {
      // Reset cumulative values at period start
      cumDelta = 0;
      periodOpenDelta = 0;
      periodMaxDelta = 0;
      periodMinDelta = 0;
    }

    // Calculate delta for this bar
    let delta: number;
    if (bar.close > bar.open) {
      delta = volume;
    } else if (bar.close < bar.open) {
      delta = -volume;
    } else {
      delta = 0;
    }

    // Track period open (at start of period)
    if (isAnchor) {
      periodOpenDelta = cumDelta;
    }

    // Accumulate delta
    cumDelta += delta;

    // Track max and min within period
    periodMaxDelta = Math.max(periodMaxDelta, cumDelta);
    periodMinDelta = Math.min(periodMinDelta, cumDelta);

    openValues.push(periodOpenDelta);
    maxValues.push(periodMaxDelta);
    minValues.push(periodMinDelta);
    closeValues.push(cumDelta);

    prevTime = barTime;
  }

  const openData = openValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const maxData = maxValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const minData = minValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const closeData = closeValues.map((value, i) => ({
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
      'plot0': openData,
      'plot1': maxData,
      'plot2': minData,
      'plot3': closeData,
    },
  };
}

export const CumulativeVolumeDelta = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
