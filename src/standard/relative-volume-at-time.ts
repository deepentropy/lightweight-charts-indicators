/**
 * Relative Volume at Time Indicator
 *
 * Compares current volume to historical average volume at the same time offset
 * within anchor periods (e.g., daily, weekly). This helps identify unusual volume
 * relative to typical volume at that time of day/week.
 *
 * Based on TradingView's Relative Volume at Time indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface RelativeVolumeAtTimeInputs {
  /** Anchor timeframe for period boundaries (e.g., "1D", "1W", "1M") */
  anchorTimeframe: string;
  /** Number of periods to use for the historical average calculation */
  length: number;
  /** Calculation mode: 'Cumulative' or 'Regular' */
  calculationMode: 'Cumulative' | 'Regular';
  /** Adjust unclosed bars by extrapolating volume to end of period */
  adjustRealtime: boolean;
}

export const defaultInputs: RelativeVolumeAtTimeInputs = {
  anchorTimeframe: '1D',
  length: 10,
  calculationMode: 'Cumulative',
  adjustRealtime: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorTimeframe', type: 'string', title: 'Anchor Timeframe', defval: '1D', options: ['1D', '1W', '1M'] },
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'calculationMode', type: 'string', title: 'Calculation Mode', defval: 'Cumulative', options: ['Cumulative', 'Regular'] },
  { id: 'adjustRealtime', type: 'bool', title: 'Adjust Unconfirmed', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relative Volume Ratio', color: '#4CAF504D', lineWidth: 1, style: 'columns' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_one', price: 1, color: '#78787880', linestyle: 'solid', title: 'Baseline' },
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
 * Parse timeframe string to get period duration in milliseconds
 */
function parseTimeframe(tf: string): number {
  const match = tf.match(/^(\d+)?([SMHDWM])$/i);
  if (!match) {
    // Default to daily
    return 24 * 60 * 60 * 1000;
  }

  const value = match[1] ? parseInt(match[1], 10) : 1;
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'S': return value * 1000;
    case 'M': return value * 60 * 1000;
    case 'H': return value * 60 * 60 * 1000;
    case 'D': return value * 24 * 60 * 60 * 1000;
    case 'W': return value * 7 * 24 * 60 * 60 * 1000;
    default: return value * 30 * 24 * 60 * 60 * 1000; // Monthly approximation
  }
}

/**
 * Get the start of the period for a given timestamp based on the anchor timeframe
 */
function getStartOfPeriod(timestamp: number, timeframe: string): number {
  // Convert to milliseconds if needed (detect if seconds or ms)
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);

  const tf = timeframe.toUpperCase();

  if (tf === '1W' || tf === 'W') {
    // Start of week (Sunday or Monday depending on locale, using Monday)
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // Adjust to make Monday = 0
    date.setUTCDate(date.getUTCDate() - diff);
    date.setUTCHours(0, 0, 0, 0);
  } else if (tf === '1M' || tf === 'M') {
    // Start of month
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else {
    // Default to daily
    date.setUTCHours(0, 0, 0, 0);
  }

  // Return in same format as input
  return timestamp < 1e12 ? Math.floor(date.getTime() / 1000) : date.getTime();
}

/**
 * Check if a new period has started compared to the previous bar
 */
function isNewPeriod(currentTime: number, previousTime: number | null, timeframe: string): boolean {
  if (previousTime === null) return true;
  return getStartOfPeriod(currentTime, timeframe) !== getStartOfPeriod(previousTime, timeframe);
}

/**
 * Binary search to find the leftmost index where times[index] >= target
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

  return left;
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

    // Get the value at the found index, or the last value if index is out of bounds
    let value: number;
    if (index >= period.data.length) {
      value = period.data[period.data.length - 1];
    } else {
      value = period.data[index];
    }

    sum += value;
  }

  return sum / historicalData.length;
}

export function calculate(bars: Bar[], inputs: Partial<RelativeVolumeAtTimeInputs> = {}): IndicatorResult {
  const { anchorTimeframe, length, calculationMode, adjustRealtime } = { ...defaultInputs, ...inputs };
  const isCumulative = calculationMode === 'Cumulative';

  // Historical periods storage (FIFO queue)
  const historicalData: CollectedData[] = [];

  // Current period data
  let currentPeriod: CollectedData = {
    data: [],
    times: [],
    startTime: 0,
  };

  // Cumulative sum for current period
  let cumulativeSum = 0;

  // Previous bar time for detecting period changes
  let prevTime: number | null = null;

  // Track anchor start time for realtime adjustment
  let lastAnchorTime = 0;

  // Output arrays
  const ratioValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barTime = typeof bar.time === 'number' ? bar.time : new Date(bar.time).getTime() / 1000;
    const volume = bar.volume ?? 0;

    // Check for new anchor period
    const isAnchor = isNewPeriod(barTime, prevTime, anchorTimeframe);

    if (isAnchor) {
      // Save the previous period to historical data if it has data
      if (currentPeriod.data.length > 0) {
        historicalData.push(currentPeriod);

        // Maintain maximum size
        if (historicalData.length > length) {
          historicalData.shift();
        }
      }

      // Start a new period
      const periodStart = getStartOfPeriod(barTime, anchorTimeframe);
      currentPeriod = {
        data: [],
        times: [],
        startTime: periodStart,
      };

      // Reset cumulative sum and anchor time
      cumulativeSum = 0;
      lastAnchorTime = barTime;
    }

    // Calculate current value based on mode
    let currentValue: number;
    if (isCumulative) {
      cumulativeSum += volume;
      currentValue = cumulativeSum;

      // Apply realtime adjustment for unclosed bars (last bar in the dataset)
      // This extrapolates the cumulative volume based on time elapsed
      if (adjustRealtime && i === bars.length - 1 && lastAnchorTime > 0) {
        const timePassed = barTime - lastAnchorTime;
        if (timePassed > 0) {
          // Estimate the bar's close time (next bar time or end of period)
          const periodDuration = parseTimeframe(anchorTimeframe);
          const periodEnd = currentPeriod.startTime + periodDuration / 1000; // Convert to seconds
          const timeTotal = periodEnd - lastAnchorTime;

          if (timeTotal > 0 && timePassed < timeTotal) {
            const currentRatio = cumulativeSum / timePassed;
            currentValue = currentRatio * timeTotal;
          }
        }
      }
    } else {
      currentValue = volume;
    }

    // Add to current period
    currentPeriod.times.push(barTime);
    currentPeriod.data.push(currentValue);

    // Calculate time offset from start of current period
    const timeOffset = barTime - currentPeriod.startTime;

    // Calculate historical average at this time offset
    const pastVolume = calcAverageByTime(historicalData, timeOffset);

    // Calculate ratio
    let ratio: number;
    if (Number.isNaN(pastVolume) || pastVolume === 0) {
      ratio = NaN;
    } else {
      ratio = currentValue / pastVolume;
    }

    ratioValues.push(ratio);
    prevTime = barTime;
  }

  // Create plot data with conditional green/red coloring at 70% transparency
  const plotData = ratioValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
    color: value > 1 ? '#4CAF504D' : '#FF52524D',
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
