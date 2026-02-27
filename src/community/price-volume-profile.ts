/**
 * Price & Volume Profile (Expo)
 *
 * Displays a horizontal volume/counter profile as boxes. Divides the price range
 * of the last N bars into rows, accumulates volume or bar count per row, and
 * draws proportionally-sized boxes. Includes optional Point of Control (POC).
 *
 * Reference: TradingView "Price & Volume Profile (Expo)" by Zeiierman (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData } from '../types';

export interface PriceVolumeProfileInputs {
  rows: number;
  display: string;
  lookback: number;
  poc: boolean;
}

export const defaultInputs: PriceVolumeProfileInputs = {
  rows: 20,
  display: 'Counter',
  lookback: 200,
  poc: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rows', type: 'int', title: 'Row Size', defval: 20, min: 5 },
  { id: 'display', type: 'string', title: 'Display', defval: 'Counter', options: ['Counter', 'Volume'] },
  { id: 'lookback', type: 'int', title: 'Lookback Bars', defval: 200, min: 10 },
  { id: 'poc', type: 'bool', title: 'Point of Control', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Price & Volume Profile (Expo)',
  shortTitle: 'PVP',
  overlay: true,
};

/**
 * Compute a gradient color from red (lowest) to green (highest) based on
 * sorted rank of the value within the array.
 */
function gradientColor(values: number[], index: number): string {
  const sorted = [...values].sort((a, b) => a - b);
  const val = values[index];
  const rank = sorted.indexOf(val);
  const maxRank = values.length - 1;
  const t = maxRank > 0 ? rank / maxRank : 0.5;
  // Interpolate from red (255,0,0) to green (0,200,0)
  const r = Math.round(255 * (1 - t));
  const g = Math.round(200 * t);
  return `rgb(${r},${g},0)`;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceVolumeProfileInputs> = {},
): IndicatorResult & { boxes: BoxData[] } {
  const { rows, display, lookback, poc } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  if (n === 0) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      boxes: [],
    };
  }

  // Determine the range from the last 'lookback' bars
  const startIdx = Math.max(0, n - lookback);
  let top = bars[startIdx].high;
  let bot = bars[startIdx].low;
  for (let i = startIdx; i < n; i++) {
    if (bars[i].high > top) top = bars[i].high;
    if (bars[i].low < bot) bot = bars[i].low;
  }

  if (top <= bot) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      boxes: [],
    };
  }

  const step = (top - bot) / rows;

  // Build level boundaries
  const levels: number[] = [];
  for (let i = 0; i <= rows; i++) {
    levels.push(bot + step * i);
  }

  // Accumulate counts and volumes per row
  const sum: number[] = new Array(rows).fill(0);
  const vol: number[] = new Array(rows).fill(0);

  for (let i = startIdx; i < n; i++) {
    const price = bars[i].close;
    for (let x = 0; x < rows; x++) {
      if (price > levels[x] && price <= levels[x + 1]) {
        sum[x]++;
        vol[x] += bars[i].volume ?? 0;
        break;
      }
    }
    // Edge case: price exactly at bot
    if (price <= levels[0] + step && price >= levels[0]) {
      // Already handled by the loop above when x=0 uses price > levels[0]
      // If price === levels[0], assign to row 0
      if (price === levels[0]) {
        sum[0]++;
        vol[0] += bars[i].volume ?? 0;
      }
    }
  }

  const boxes: BoxData[] = [];
  const lastBarTime = bars[n - 1].time;

  // The values used for display and gradient
  const displayValues = display === 'Volume' ? vol : sum;

  // Find maxValue for proportional box widths
  const maxVal = Math.max(...displayValues, 1);

  // We represent boxes by reusing the last bar's time and "shifting right"
  // Since we can't truly offset into the future, we use the last bar's time for time2
  // and set time1 back proportionally. The chart renderer will place these at the right edge.
  // Use the lookback start bar's time for time1 references.
  const profileStartTime = bars[startIdx].time;

  for (let i = 0; i < rows; i++) {
    const val = displayValues[i];
    if (val <= 0) continue;

    // Box width proportional to value
    // time1 = right edge minus proportional width in bar-time units
    // We position the profile boxes using the actual bar times
    const widthFraction = val / maxVal;
    // Place boxes at the right side: time2 = last bar, time1 = proportional offset from end
    const totalBars = n - startIdx;
    const boxWidthBars = Math.max(1, Math.round(widthFraction * totalBars * 0.3));
    const boxStartIdx = Math.max(0, n - 1 - boxWidthBars);

    const col = gradientColor(displayValues, i);
    const textVal =
      display === 'Volume'
        ? formatVolume(vol[i])
        : String(sum[i]);

    boxes.push({
      time1: bars[boxStartIdx].time,
      price1: levels[i + 1],
      time2: lastBarTime,
      price2: levels[i],
      bgColor: col.replace('rgb', 'rgba').replace(')', ',0.5)'),
      borderColor: col,
      borderWidth: 1,
      borderStyle: 'dotted',
      text: textVal,
      textColor: '#FFFFFF',
    });
  }

  // Point of Control
  if (poc) {
    const maxIdx = display === 'Volume'
      ? vol.indexOf(Math.max(...vol))
      : sum.indexOf(Math.max(...sum));

    if (maxIdx >= 0) {
      const pocVal = displayValues[maxIdx];
      const widthFraction = pocVal / maxVal;
      const totalBars = n - startIdx;
      const boxWidthBars = Math.max(1, Math.round(widthFraction * totalBars * 0.3));
      const boxStartIdx = Math.max(0, n - 1 - boxWidthBars);

      boxes.push({
        time1: profileStartTime,
        price1: levels[maxIdx + 1],
        time2: bars[boxStartIdx].time,
        price2: levels[maxIdx],
        bgColor: 'rgba(91,123,122,0.25)',
        borderColor: '#E0F2E9',
        borderWidth: 1,
        borderStyle: 'dashed',
        text: 'POC',
        textColor: '#FFFFFF',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

export const PriceVolumeProfile = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
