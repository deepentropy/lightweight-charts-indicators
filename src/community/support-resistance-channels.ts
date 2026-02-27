/**
 * Support Resistance Channels
 *
 * Pivot-based S/R channel detection. Collects pivot highs/lows,
 * groups nearby pivots into channels based on max width.
 * Each channel is scored by pivot count + price touches.
 * Top N strongest channels are displayed as boxes.
 * Color: red (resistance), green (support), gray (inside).
 *
 * Reference: TradingView "Support Resistance Channels" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BoxData } from '../types';

export interface SupportResistanceChannelsInputs {
  prd: number;
  ppsrc: 'High/Low' | 'Close/Open';
  channelW: number;
  minStrength: number;
  maxNumSR: number;
  loopback: number;
}

export const defaultInputs: SupportResistanceChannelsInputs = {
  prd: 10,
  ppsrc: 'High/Low',
  channelW: 5,
  minStrength: 1,
  maxNumSR: 6,
  loopback: 290,
};

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Pivot Period', defval: 10, min: 4 },
  { id: 'ppsrc', type: 'string', title: 'Source', defval: 'High/Low', options: ['High/Low', 'Close/Open'] },
  { id: 'channelW', type: 'int', title: 'Maximum Channel Width %', defval: 5, min: 1 },
  { id: 'minStrength', type: 'int', title: 'Minimum Strength', defval: 1, min: 1 },
  { id: 'maxNumSR', type: 'int', title: 'Maximum Number of S/R', defval: 6, min: 1 },
  { id: 'loopback', type: 'int', title: 'Loopback Period', defval: 290, min: 100 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support Resistance Channels',
  shortTitle: 'SRChannel',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SupportResistanceChannelsInputs> = {}): IndicatorResult & { boxes: BoxData[]; markers: MarkerData[] } {
  const { prd, ppsrc, channelW, minStrength, maxNumSR, loopback } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const maxnumsr = maxNumSR - 1;

  // Pivot source
  const src1Series = ppsrc === 'High/Low'
    ? new Series(bars, (b) => b.high)
    : new Series(bars, (_b) => Math.max(_b.close, _b.open));
  const src2Series = ppsrc === 'High/Low'
    ? new Series(bars, (b) => b.low)
    : new Series(bars, (_b) => Math.min(_b.close, _b.open));

  // Detect pivots
  const phArr = ta.pivothigh(src1Series, prd, prd).toArray();
  const plArr = ta.pivotlow(src2Series, prd, prd).toArray();

  // Highest/lowest over 300 bars for channel width calculation
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const highestArr = ta.highest(highSeries, 300).toArray();
  const lowestArr = ta.lowest(lowSeries, 300).toArray();

  // Collect pivot values and locations, pruning old ones beyond loopback
  const pivotVals: number[] = [];
  const pivotLocs: number[] = [];

  // S/R state: 10 channels * 2 (hi, lo)
  const srLevels: number[] = new Array(20).fill(0);

  const boxes: BoxData[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const hasPivot = (ph != null && !isNaN(ph)) || (pl != null && !isNaN(pl));

    if (hasPivot) {
      const pivVal = (ph != null && !isNaN(ph)) ? ph : pl as number;
      pivotVals.unshift(pivVal);
      pivotLocs.unshift(i);

      // Remove old pivots beyond loopback
      while (pivotVals.length > 0) {
        const lastIdx = pivotVals.length - 1;
        if (i - pivotLocs[lastIdx] > loopback) {
          pivotVals.pop();
          pivotLocs.pop();
        } else {
          break;
        }
      }

      // Calculate channel width
      const prdhighest = (highestArr[i] != null && !isNaN(highestArr[i] as number)) ? highestArr[i] as number : 0;
      const prdlowest = (lowestArr[i] != null && !isNaN(lowestArr[i] as number)) ? lowestArr[i] as number : 0;
      const cwidth = (prdhighest - prdlowest) * channelW / 100;

      // Build S/R channels from current pivots
      // For each pivot, find a channel (hi, lo) that groups nearby pivots
      const supres: number[] = []; // [strength, hi, lo] per pivot

      for (let x = 0; x < pivotVals.length; x++) {
        let lo = pivotVals[x];
        let hi = lo;
        let numpp = 0;
        for (let y = 0; y < pivotVals.length; y++) {
          const cpp = pivotVals[y];
          const wdth = cpp <= hi ? hi - cpp : cpp - lo;
          if (wdth <= cwidth) {
            if (cpp <= hi) {
              lo = Math.min(lo, cpp);
            } else {
              hi = Math.max(hi, cpp);
            }
            numpp += 20;
          }
        }
        supres.push(numpp, hi, lo);
      }

      // Add bar-touch strength
      for (let x = 0; x < pivotVals.length; x++) {
        const h = supres[x * 3 + 1];
        const l = supres[x * 3 + 2];
        let s = 0;
        for (let y = 0; y <= Math.min(i, loopback); y++) {
          const barIdx = i - y;
          if (barIdx < 0) break;
          if ((bars[barIdx].high <= h && bars[barIdx].high >= l) ||
              (bars[barIdx].low <= h && bars[barIdx].low >= l)) {
            s++;
          }
        }
        supres[x * 3] += s;
      }

      // Reset SR levels
      srLevels.fill(0);
      const stren: number[] = new Array(10).fill(0);

      // Get strongest SRs
      let src = 0;
      for (let x = 0; x < pivotVals.length; x++) {
        let stv = -1;
        let stl = -1;
        for (let y = 0; y < pivotVals.length; y++) {
          if (supres[y * 3] > stv && supres[y * 3] >= minStrength * 20) {
            stv = supres[y * 3];
            stl = y;
          }
        }
        if (stl >= 0) {
          const hh = supres[stl * 3 + 1];
          const ll = supres[stl * 3 + 2];
          srLevels[src * 2] = hh;
          srLevels[src * 2 + 1] = ll;
          stren[src] = supres[stl * 3];

          // Zero out overlapping channels
          for (let y = 0; y < pivotVals.length; y++) {
            if ((supres[y * 3 + 1] <= hh && supres[y * 3 + 1] >= ll) ||
                (supres[y * 3 + 2] <= hh && supres[y * 3 + 2] >= ll)) {
              supres[y * 3] = -1;
            }
          }

          src++;
          if (src >= 10) break;
        }
      }

      // Sort by strength (bubble sort)
      for (let x = 0; x <= 8; x++) {
        for (let y = x + 1; y <= 9; y++) {
          if (stren[y] > stren[x]) {
            // Swap strengths
            const tmp = stren[y];
            stren[y] = stren[x];
            stren[x] = tmp;
            // Swap SR levels
            const tmpHi = srLevels[y * 2];
            srLevels[y * 2] = srLevels[x * 2];
            srLevels[x * 2] = tmpHi;
            const tmpLo = srLevels[y * 2 + 1];
            srLevels[y * 2 + 1] = srLevels[x * 2 + 1];
            srLevels[x * 2 + 1] = tmpLo;
          }
        }
      }
    }

    // Check for break signals (only when not inside any channel)
    if (i > 0 && srLevels.some(v => v !== 0)) {
      const close = bars[i].close;
      const prevClose = bars[i - 1].close;

      let notInChannel = true;
      for (let x = 0; x <= Math.min(9, maxnumsr); x++) {
        if (srLevels[x * 2] !== 0 && close <= srLevels[x * 2] && close >= srLevels[x * 2 + 1]) {
          notInChannel = false;
          break;
        }
      }

      if (notInChannel) {
        let resistanceBroken = false;
        let supportBroken = false;
        for (let x = 0; x <= Math.min(9, maxnumsr); x++) {
          if (srLevels[x * 2] === 0) continue;
          if (prevClose <= srLevels[x * 2] && close > srLevels[x * 2]) {
            resistanceBroken = true;
          }
          if (prevClose >= srLevels[x * 2 + 1] && close < srLevels[x * 2 + 1]) {
            supportBroken = true;
          }
        }
        if (resistanceBroken) {
          markers.push({
            time: bars[i].time,
            position: 'belowBar',
            shape: 'triangleUp',
            color: '#00FF00',
            text: 'R Break',
          });
        }
        if (supportBroken) {
          markers.push({
            time: bars[i].time,
            position: 'aboveBar',
            shape: 'triangleDown',
            color: '#FF0000',
            text: 'S Break',
          });
        }
      }
    }
  }

  // Draw final S/R channel boxes at the end of data
  const lastClose = n > 0 ? bars[n - 1].close : 0;
  for (let x = 0; x <= Math.min(9, maxnumsr); x++) {
    const hi = srLevels[x * 2];
    const lo = srLevels[x * 2 + 1];
    if (hi === 0 && lo === 0) continue;

    // Color based on price position
    let bgColor: string;
    let borderColor: string;
    if (hi > lastClose && lo > lastClose) {
      // Resistance (price below)
      bgColor = 'rgba(255,0,0,0.25)';
      borderColor = '#FF0000';
    } else if (hi < lastClose && lo < lastClose) {
      // Support (price above)
      bgColor = 'rgba(0,255,0,0.25)';
      borderColor = '#00FF00';
    } else {
      // Inside channel
      bgColor = 'rgba(128,128,128,0.25)';
      borderColor = '#808080';
    }

    // Box spans the visible area (last ~50 bars to end)
    const startIdx = Math.max(0, n - 50);
    boxes.push({
      time1: bars[startIdx].time,
      price1: hi,
      time2: bars[n - 1].time,
      price2: lo,
      bgColor,
      borderColor,
      borderWidth: 1,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    markers,
  };
}

export const SupportResistanceChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
