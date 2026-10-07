/**
 * Relative Volume at Time Indicator
 *
 * Compares current volume to historical average volume at the same time offset
 * within anchor periods (e.g., daily, weekly). This helps identify unusual volume
 * relative to typical volume at that time of day/week.
 *
 * Based on the standard Relative Volume at Time indicator (ta.relativeVolume: timeframe.change / time of the anchor
 * timeframe, the average of the past `Length` periods at the same time offset).
 *
 * 'Anchor Timeframe' accepts any timeframe ("" = the chart timeframe: every bar is its own period). The original takes
 * the periods (timeframe.change, time) from the exchange time zone and sessions, which the bars do not carry: the
 * port takes them from the UTC calendar and the bars (see src/anchor-period.ts). Exact on UTC 24x7 symbols and on
 * symbols whose trading day is inside the UTC day (e.g. US stocks), after the first period of the bars; not on
 * sessions that cross 00:00 UTC (futures, forex).
 * Adjust Unconfirmed (last bar): the original extrapolates the cumulative volume to the close time of the bar; the
 * bars carry no close time, so it is estimated as the bar time plus the bar interval.
 */

import { barInterval, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import { periodStarts } from '../anchor-period';

export interface RelativeVolumeAtTimeInputs {
  /** Anchor timeframe for period boundaries: any timeframe string ("1D", "1W", "240", ...; "" = chart timeframe) */
  anchorTimeframe: string;
  /** Number of periods to use for the historical average calculation */
  length: number;
  /** Calculation mode: 'Cumulative' or 'Regular' */
  calculationMode: 'Cumulative' | 'Regular';
  /** Adjust the unconfirmed last bar: extrapolate its cumulative volume to the close of the bar */
  adjustRealtime: boolean;
}

export const defaultInputs: RelativeVolumeAtTimeInputs = {
  anchorTimeframe: '1D',
  length: 10,
  calculationMode: 'Cumulative',
  adjustRealtime: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorTimeframe', type: 'timeframe', title: 'Anchor Timeframe', defval: '1D', tooltip: 'When Chart Timeframe >= `Anchor Timeframe`, the indicator will use last `Length` bars in its calculations.' },
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'calculationMode', type: 'string', title: 'Calculation Mode', defval: 'Cumulative', options: ['Cumulative', 'Regular'] },
  { id: 'adjustRealtime', type: 'bool', title: 'Adjust Unconfirmed', defval: true, tooltip: 'If checked, the volume on bars that have not yet closed will be adjusted based on the previous volume data for the current session, extrapolating the volume at the end of the period.', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relative Volume Ratio', color: '#4CAF504D', lineWidth: 1, style: 'columns', histbase: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_one', price: 1, color: '#787B8680', linestyle: 'dashed', title: 'Baseline' },
];

export const metadata = {
  title: 'Relative Volume at Time',
  shortTitle: 'RelVol',
  overlay: false,
};

/**
 * Structure to hold collected data for a period
 */
interface CollectedData {
  data: number[];      // Values collected since startTime
  times: number[];     // Timestamps corresponding to each value
  startTime: number;   // Start time of the period
}

/**
 * Pine array.binary_search_leftmost: the index of the first element equal to `target`; when no element is equal,
 * the index of the last element below `target` (0 when every element is above it; checked on reference runs).
 */
function binarySearchLeftmost(times: number[], target: number): number {
  let left = 0;
  let right = times.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (times[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left < times.length && times[left] === target ? left : Math.max(left - 1, 0);
}

/**
 * Calculate average by time offset across historical periods
 * For each historical period, find the value at the closest time offset
 * and return the average of all those values
 */
function calcAverageByTime(
  historicalData: CollectedData[],
  timeOffset: number
): number {
  if (historicalData.length === 0) {
    return NaN;
  }

  let sum = 0;
  for (const period of historicalData) {
    const targetTime = period.startTime + timeOffset;
    const index = binarySearchLeftmost(period.times, targetTime);

    // data.size() - 1 >= index ? data.get(index) : data.last()
    const value = index < period.data.length ? period.data[index] : period.data[period.data.length - 1];

    sum += value;
  }

  return sum / historicalData.length;
}

export function calculate(bars: Bar[], inputs: Partial<RelativeVolumeAtTimeInputs> = {}): IndicatorResult {
  const { anchorTimeframe, length, calculationMode, adjustRealtime } = { ...defaultInputs, ...inputs };
  const isCumulative = calculationMode === 'Cumulative';

  // time(anchorTimeframe) of each bar; timeframe.change(anchorTimeframe) where it differs from the previous bar
  const starts = periodStarts(bars, anchorTimeframe);

  // Historical periods storage (FIFO queue)
  const historicalData: CollectedData[] = [];

  // Current period data (created on the first bar with time(anchorTimeframe))
  let currentPeriod: CollectedData = {
    data: [],
    times: [],
    startTime: starts[0],
  };

  // Cumulative sum for current period
  let cumulativeSum = 0;

  // Time of the last anchor bar (na until the first anchor), for the realtime adjustment
  let lastAnchorTime = NaN;

  // Output arrays
  const ratioValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barTime = bar.time;
    const volume = bar.volume ?? 0;

    // timeframe.change(anchorTimeframe): false on the first bar
    const isAnchor = i > 0 && starts[i] !== starts[i - 1];

    if (isAnchor) {
      // Save the previous period to historical data
      historicalData.push(currentPeriod);

      // Maintain maximum size
      if (historicalData.length > length) {
        historicalData.shift();
      }

      // Start a new period
      currentPeriod = {
        data: [],
        times: [],
        startTime: starts[i],
      };

      // Reset cumulative sum and anchor time
      cumulativeSum = 0;
      lastAnchorTime = barTime;
    }

    // Calculate current value based on mode
    let currentValue: number;
    let historyValue: number;
    if (isCumulative) {
      cumulativeSum += volume;
      currentValue = cumulativeSum;
      historyValue = cumulativeSum;

      // Adjust Unconfirmed: the last bar is not confirmed (as in the original, until the data feed closes it).
      // The original extrapolates the sum since the last anchor bar to the close of the bar:
      // sum / (min(timenow, time_close) - lastAnchor) * (time_close - lastAnchor). time_close is estimated as the
      // bar time plus the bar interval (the bars carry no close time); a bar whose close is past gives no change.
      if (adjustRealtime && i === bars.length - 1) {
        const timeClose = barTime + barInterval(bars);
        const now = barTime < 1e12 ? Date.now() / 1000 : Date.now();
        const timePassed = Math.min(now, timeClose) - lastAnchorTime;
        const timeTotal = timeClose - lastAnchorTime;
        currentValue = (cumulativeSum / timePassed) * timeTotal;
      }
    } else {
      currentValue = volume;
      historyValue = volume;
    }

    // Add to current period
    currentPeriod.times.push(barTime);
    currentPeriod.data.push(historyValue);

    // Calculate time offset from start of current period
    const timeOffset = barTime - currentPeriod.startTime;

    // Calculate historical average at this time offset
    const pastVolume = calcAverageByTime(historicalData, timeOffset);

    // Pine division (as JavaScript): non-zero / 0 is +-infinity, 0 / 0 is na
    ratioValues.push(currentValue / pastVolume);
  }

  // Colour: green when ratio > 1 (Pine float comparison: ratio - 1 > 1e-10; na compares false), else red;
  // 70% transparency. Plots treat infinity as na.
  const plotData = ratioValues.map((value, i) => ({
    time: bars[i].time,
    value: Number.isFinite(value) ? value : NaN,
    color: value - 1 > 1e-10 ? '#4CAF504D' : '#F236454D',
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

export const RelativeVolumeAtTime = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
