/**
 * Liquidity Levels [LuxAlgo]
 *
 * Detects pivot highs in volume to identify liquidity levels.
 * On a volume pivot, records close[length] as a liquidity level.
 * Keeps the N most recent levels (sorted), draws horizontal lines,
 * and optionally shows a histogram (boxes) between level pairs
 * indicating bullish/bearish bar distribution.
 *
 * Overlay indicator.
 *
 * Reference: TradingView "Liquidity Levels [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, BoxData } from '../types';

export interface LiquidityLevelsInputs {
  length: number;
  show: number;
  showHist: boolean;
  distWin: number;
  lvlStyle: 'solid' | 'dashed' | 'dotted';
}

export const defaultInputs: LiquidityLevelsInputs = {
  length: 20,
  show: 5,
  showHist: true,
  distWin: 200,
  lvlStyle: 'solid',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'show', type: 'int', title: 'Number Of Levels', defval: 5, min: 1 },
  { id: 'showHist', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'distWin', type: 'int', title: 'Histogram Window', defval: 200, max: 500 },
  { id: 'lvlStyle', type: 'string', title: 'Levels Style', defval: 'solid', options: ['solid', 'dashed', 'dotted'] },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Levels [LuxAlgo]',
  shortTitle: 'LiqLevels',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityLevelsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const { length, show, showHist, distWin, lvlStyle } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute pivot highs on volume
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const phvArr = ta.pivothigh(volSeries, length, length).toArray();

  // Collect liquidity levels: on volume pivot, record close[length]
  const pals: number[] = [];

  for (let i = 0; i < n; i++) {
    const phv = phvArr[i];
    if (phv != null && !isNaN(phv as number) && i >= length) {
      // Pine: close[length] at the pivot bar means the close `length` bars ago
      // But pivothigh already places the value at bar_index - length internally,
      // so `i` here is the actual pivot bar position. We want close at that bar.
      pals.unshift(bars[i].close);
      if (pals.length > show) {
        pals.pop();
      }
    }
  }

  // Sort levels (required for histogram binary search)
  pals.sort((a, b) => a - b);

  const lines: LineDrawingData[] = [];
  const boxes: BoxData[] = [];
  const fixedCol = '#2157f3';

  if (n === 0) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      lines,
      boxes,
    };
  }

  const lastBar = bars[n - 1];

  // Draw horizontal lines at each level
  for (const lvl of pals) {
    const col = lastBar.close > lvl ? '#2157f3' : '#ff5d00';
    lines.push({
      time1: bars[Math.max(0, n - 2)].time,
      price1: lvl,
      time2: lastBar.time,
      price2: lvl,
      color: col,
      width: 1,
      style: lvlStyle,
      extend: 'left',
    });
  }

  // Histogram: count bullish/bearish bars between adjacent level pairs
  if (showHist && pals.length >= 2) {
    const numBins = pals.length - 1;
    const bull = new Array(numBins).fill(0);
    const bear = new Array(numBins).fill(0);

    const window = Math.min(distWin, n);
    for (let i = 0; i < window; i++) {
      const idx = n - 1 - i;
      if (idx < 0) break;
      const c = bars[idx].close;

      // Binary search rightmost: find which bin this close falls into
      let binIdx = upperBound(pals, c);
      if (binIdx >= 1 && binIdx < pals.length) {
        if (bars[idx].close > bars[idx].open) {
          bull[binIdx - 1]++;
        } else {
          bear[binIdx - 1]++;
        }
      }
    }

    // Create histogram boxes
    for (let i = 0; i < numBins; i++) {
      const bottom = pals[i];
      const top = pals[i + 1];

      if (bull[i] > 0) {
        boxes.push({
          time1: lastBar.time,
          price1: top,
          time2: lastBar.time, // will be offset by bull count conceptually
          price2: bottom,
          bgColor: 'rgba(33,87,243,0.50)',
          borderColor: 'rgba(33,87,243,0.50)',
          borderWidth: 0,
          text: String(bull[i]),
          textColor: '#FFFFFF',
        });
      }

      if (bear[i] > 0) {
        boxes.push({
          time1: lastBar.time,
          price1: top,
          time2: lastBar.time,
          price2: bottom,
          bgColor: 'rgba(255,93,0,0.50)',
          borderColor: 'rgba(255,93,0,0.50)',
          borderWidth: 0,
          text: String(bear[i]),
          textColor: '#FFFFFF',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    boxes,
  };
}

/** Binary search: returns index of first element > value (upper bound). */
function upperBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export const LiquidityLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
