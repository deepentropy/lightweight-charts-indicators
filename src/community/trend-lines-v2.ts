/**
 * Trend Lines v2
 *
 * Pivot-based trend lines connecting consecutive pivot points.
 * Validates that no close falls through the line between pivots.
 * Draws up to 3 uptrend lines (ascending pivot lows) and
 * 3 downtrend lines (descending pivot highs).
 *
 * Reference: TradingView "Trend Lines v2" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';

export interface TrendLinesV2Inputs {
  prd: number;
  ppNum: number;
}

export const defaultInputs: TrendLinesV2Inputs = {
  prd: 20,
  ppNum: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Pivot Period', defval: 20, min: 10 },
  { id: 'ppNum', type: 'int', title: 'Number of Pivot Points to check', defval: 3, min: 2 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Trend Lines v2',
  shortTitle: 'TLv2',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendLinesV2Inputs> = {}): IndicatorResult & { lines: LineDrawingData[] } {
  const { prd, ppNum } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Detect pivots - oakscriptjs places value at actual pivot bar (not confirmation bar)
  const phArr = ta.pivothigh(highSeries, prd, prd).toArray();
  const plArr = ta.pivotlow(lowSeries, prd, prd).toArray();

  const closeArr = bars.map(b => b.close);

  // Track last N pivot highs/lows with their bar indices
  // Pine uses arrays that unshift new values and pop old ones
  const tval: number[] = []; // pivot high values
  const tpos: number[] = []; // pivot high bar indices
  const bval: number[] = []; // pivot low values
  const bpos: number[] = []; // pivot low bar indices

  const lines: LineDrawingData[] = [];
  const maxline = 3;

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];

    // Add new pivots to front of arrays, keep max ppNum
    if (ph != null && !isNaN(ph)) {
      tval.unshift(ph);
      tpos.unshift(i);
      if (tval.length > ppNum) {
        tval.pop();
        tpos.pop();
      }
    }
    if (pl != null && !isNaN(pl)) {
      bval.unshift(pl);
      bpos.unshift(i);
      if (bval.length > ppNum) {
        bval.pop();
        bpos.pop();
      }
    }
  }

  // Now process all pivot pairs to find valid trend lines
  // Pine recalculates on every bar; we compute at end of data (last bar = bar_index)
  const lastBar = n - 1;
  let countlinelo = 0;
  let countlinehi = 0;

  for (let p1 = 0; p1 <= ppNum - 2; p1++) {
    // --- Uptrend lines from pivot lows ---
    let uv1 = 0, uv2 = 0, up1 = 0, up2 = 0;
    if (countlinelo < maxline && bval.length > p1) {
      for (let p2 = ppNum - 1; p2 >= p1 + 1; p2--) {
        if (p2 >= bval.length) continue;
        const val1 = bval[p1];
        const val2 = bval[p2];
        const pos1 = bpos[p1];
        const pos2 = bpos[p2];
        // Ascending: most recent pivot low (p1) is higher than older one (p2)
        if (val1 > val2 && pos1 !== pos2) {
          const diff = (val1 - val2) / (pos1 - pos2);
          let hline = val2 + diff;
          let lloc = lastBar;
          let valid = true;
          const startCheck = Math.max(0, pos2 + 1 - prd);
          for (let x = startCheck; x <= lastBar; x++) {
            if (closeArr[x] < hline) {
              valid = false;
              break;
            }
            lloc = x;
            hline = hline + diff;
          }
          if (valid) {
            uv1 = hline - diff;
            uv2 = val2;
            up1 = lloc;
            up2 = pos2;
            break;
          }
        }
      }
    }

    // --- Downtrend lines from pivot highs ---
    let dv1 = 0, dv2 = 0, dp1 = 0, dp2 = 0;
    if (countlinehi < maxline && tval.length > p1) {
      for (let p2 = ppNum - 1; p2 >= p1 + 1; p2--) {
        if (p2 >= tval.length) continue;
        const val1 = tval[p1];
        const val2 = tval[p2];
        const pos1 = tpos[p1];
        const pos2 = tpos[p2];
        // Descending: most recent pivot high (p1) is lower than older one (p2)
        if (val1 < val2 && pos1 !== pos2) {
          const diff = (val2 - val1) / (pos1 - pos2);
          let hline = val2 - diff;
          let lloc = lastBar;
          let valid = true;
          const startCheck = Math.max(0, pos2 + 1 - prd);
          for (let x = startCheck; x <= lastBar; x++) {
            if (closeArr[x] > hline) {
              valid = false;
              break;
            }
            lloc = x;
            hline = hline - diff;
          }
          if (valid) {
            dv1 = hline + diff;
            dv2 = val2;
            dp1 = lloc;
            dp2 = pos2;
            break;
          }
        }
      }
    }

    // Draw uptrend line
    if (up1 !== 0 && up2 !== 0 && countlinelo < maxline) {
      countlinelo++;
      const startIdx = Math.max(0, up2 - prd);
      lines.push({
        time1: bars[startIdx].time,
        price1: uv2,
        time2: bars[up1].time,
        price2: uv1,
        color: '#00FF00',
        width: 2,
        style: 'solid',
      });
    }

    // Draw downtrend line
    if (dp1 !== 0 && dp2 !== 0 && countlinehi < maxline) {
      countlinehi++;
      const startIdx = Math.max(0, dp2 - prd);
      lines.push({
        time1: bars[startIdx].time,
        price1: dv2,
        time2: bars[dp1].time,
        price2: dv1,
        color: '#FF0000',
        width: 2,
        style: 'solid',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
  };
}

export const TrendLinesV2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
