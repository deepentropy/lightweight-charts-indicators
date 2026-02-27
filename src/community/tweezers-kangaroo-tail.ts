/**
 * Tweezers and Kangaroo Tail
 *
 * Detects tweezer top/bottom and kangaroo tail candlestick patterns.
 * Tweezers compare wick sizes within a lookback window.
 * Kangaroo tails require room (zigzag distance) and wick/body ratio.
 *
 * Reference: TradingView "Tweezer and Kangaroo Tail" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TweezersKangarooTailInputs {
  enableTweezer: boolean;
  maxRate: number;
  levelDiff: number;
  tweezPrd: number;
  apartPrd: number;
  enableKangaroo: boolean;
  kangPrd: number;
  kangMinPrd: number;
  atrMult: number;
  wickMult: number;
  wickMultAvg: number;
}

export const defaultInputs: TweezersKangarooTailInputs = {
  enableTweezer: true,
  maxRate: 150,
  levelDiff: 20,
  tweezPrd: 5,
  apartPrd: 12,
  enableKangaroo: true,
  kangPrd: 20,
  kangMinPrd: 8,
  atrMult: 5,
  wickMult: 3,
  wickMultAvg: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'enableTweezer', type: 'bool', title: 'Enable Tweezer', defval: true },
  { id: 'maxRate', type: 'float', title: 'Max Rate % Between Wick Sizes', defval: 150, min: 1, step: 10 },
  { id: 'levelDiff', type: 'float', title: 'Max Difference in level %', defval: 20, min: 1, step: 5 },
  { id: 'tweezPrd', type: 'int', title: 'Highest/Lowest Period', defval: 5, min: 1 },
  { id: 'apartPrd', type: 'int', title: 'Max Distance between Tweezers', defval: 12, min: 1 },
  { id: 'enableKangaroo', type: 'bool', title: 'Enable Kangaroo Tail', defval: true },
  { id: 'kangPrd', type: 'int', title: 'Period for Room', defval: 20, min: 2, max: 50 },
  { id: 'kangMinPrd', type: 'int', title: 'Minimum Period for Room', defval: 8, min: 2, max: 50 },
  { id: 'atrMult', type: 'int', title: 'ATR Factor for Room Height', defval: 5, min: 2, max: 30 },
  { id: 'wickMult', type: 'float', title: 'Wick/Body Rate', defval: 3, min: 1, step: 0.5 },
  { id: 'wickMultAvg', type: 'float', title: 'Wick/Average_Wick Rate', defval: 2, min: 1, step: 0.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Placeholder', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Tweezers & Kangaroo Tail',
  shortTitle: 'Tweez/Kang',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TweezersKangarooTailInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    enableTweezer, maxRate: maxRatePct, levelDiff: levelDiffPct, tweezPrd, apartPrd,
    enableKangaroo, kangPrd, kangMinPrd, atrMult, wickMult, wickMultAvg,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const maxRate = maxRatePct / 100;
  const levelDiffRate = levelDiffPct / 100;

  // Pre-compute wick/body data
  const topWick: number[] = new Array(n);
  const bottomWick: number[] = new Array(n);
  const body: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const { open, high, low, close } = bars[i];
    topWick[i] = high - Math.max(close, open);
    bottomWick[i] = Math.min(close, open) - low;
    body[i] = Math.abs(close - open);
  }

  // Highest/lowest detection for tweezers
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const highestArr = ta.highest(highSeries, tweezPrd).toArray();
  const lowestArr = ta.lowest(lowSeries, tweezPrd).toArray();

  const isHighestBar = (i: number) => i >= tweezPrd - 1 && bars[i].high === highestArr[i];
  const isLowestBar = (i: number) => i >= tweezPrd - 1 && bars[i].low === lowestArr[i];

  // ATR for kangaroo tail
  const atrArr = ta.atr(bars, 50).toArray();

  // Average top wick size (SMA 50)
  const topWickSeries = Series.fromArray(bars, topWick);
  const avgTopWickArr = ta.sma(topWickSeries, 50).toArray();

  // Zigzag tracking for kangaroo tail
  // zigzag stores [value0, barIndex0, value1, barIndex1]
  let zigzag = [0, 0, 0, 0];
  let dir = 0;
  let prevDir = 0;

  // Highest/lowest for kangaroo prd
  const highestKangArr = ta.highest(highSeries, kangPrd).toArray();
  const lowestKangArr = ta.lowest(lowSeries, kangPrd).toArray();

  const markers: MarkerData[] = [];
  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 0; i < n; i++) {
    const { open, high, low, close, time } = bars[i];

    // --- TWEEZERS ---
    if (enableTweezer && i >= tweezPrd) {
      // Top tweezer
      if (topWick[i] > 0 && isHighestBar(i)) {
        for (let x = 1; x <= Math.min(apartPrd, i); x++) {
          if (topWick[i - x] === 0) break;
          const maxW = Math.max(topWick[i], topWick[i - x]);
          const minW = Math.min(topWick[i], topWick[i - x]);
          if (maxW / minW <= maxRate && Math.abs(high - bars[i - x].high) < maxW * levelDiffRate && isHighestBar(i - x)) {
            markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'T' });
            break;
          } else if (bars[i - x].high >= high) {
            break;
          }
        }
      }

      // Bottom tweezer
      if (bottomWick[i] > 0 && isLowestBar(i)) {
        for (let x = 1; x <= Math.min(apartPrd, i); x++) {
          if (bottomWick[i - x] === 0) break;
          const maxW = Math.max(bottomWick[i], bottomWick[i - x]);
          const minW = Math.min(bottomWick[i], bottomWick[i - x]);
          if (maxW / minW <= maxRate && Math.abs(low - bars[i - x].low) < maxW * levelDiffRate && isLowestBar(i - x)) {
            markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'T' });
            break;
          } else if (bars[i - x].low <= low) {
            break;
          }
        }
      }
    }

    // --- KANGAROO TAIL ---
    if (enableKangaroo && i >= kangPrd) {
      const ph = bars[i].high === highestKangArr[i] ? high : NaN;
      const pl = bars[i].low === lowestKangArr[i] ? low : NaN;

      prevDir = dir;
      if (!isNaN(ph) && isNaN(pl)) dir = 1;
      else if (!isNaN(pl) && isNaN(ph)) dir = -1;

      const dirChanged = dir !== prevDir;

      if (!isNaN(ph) || !isNaN(pl)) {
        const val = dir === 1 ? ph : pl;
        if (!isNaN(val)) {
          if (dirChanged) {
            // add_to_zigzag: unshift value, barIndex; pop last two
            zigzag = [val, i, zigzag[0], zigzag[1]];
          } else {
            // update_zigzag: if new extreme, update
            if ((dir === 1 && val > zigzag[0]) || (dir === -1 && val < zigzag[0])) {
              zigzag[0] = val;
              zigzag[1] = i;
            }
          }
        }
      }

      const atrVal = atrArr[i] ?? 0;
      const avgWick = avgTopWickArr[i] ?? 0;
      const prevHigh = i > 0 ? bars[i - 1].high : high;
      const prevLow = i > 0 ? bars[i - 1].low : low;

      // Top kangaroo (bearish)
      if (dir === 1 && topWick[i] >= body[i] * wickMult &&
        close <= low + (high - low) / 3 && open <= low + (high - low) / 3 &&
        open < prevHigh && open > prevLow && close < prevHigh && close > prevLow &&
        topWick[i] >= wickMultAvg * avgWick && body[i] > 0 &&
        !isNaN(ph) && zigzag[0] === high &&
        zigzag[0] - zigzag[2] > atrVal * atrMult &&
        zigzag[1] - zigzag[3] > kangMinPrd) {
        markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'K' });
      }

      // Bottom kangaroo (bullish)
      if (dir === -1 && bottomWick[i] >= body[i] * wickMult &&
        close >= high - (high - low) / 3 && open >= high - (high - low) / 3 &&
        open < prevHigh && open > prevLow && close < prevHigh && close > prevLow &&
        bottomWick[i] >= wickMultAvg * avgWick && body[i] > 0 &&
        !isNaN(pl) && zigzag[0] === low &&
        zigzag[2] - zigzag[0] > atrVal * atrMult &&
        zigzag[1] - zigzag[3] > kangMinPrd) {
        markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'K' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
  };
}

export const TweezersKangarooTail = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
