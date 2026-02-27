/**
 * Pure Price Action Liquidity Sweeps [LuxAlgo]
 *
 * Multi-depth swing detection that tracks bearish (pivot high) and bullish (pivot low)
 * levels. When price wicks beyond a level but closes back inside, a sweep line and
 * highlight box are drawn. Levels are mitigated (removed) when price fully breaks through.
 *
 * Reference: TradingView "Pure Price Action Liquidity Sweeps [LuxAlgo]" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, BoxData } from '../types';

export interface LiquiditySweepsInputs {
  term: string;
}

export const defaultInputs: LiquiditySweepsInputs = {
  term: 'Long Term',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'term',
    type: 'string',
    title: 'Detection',
    defval: 'Long Term',
    options: ['Short Term', 'Intermediate Term', 'Long Term'],
  },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Sweeps [LuxAlgo]',
  shortTitle: 'LiqSweeps',
  overlay: true,
};

interface Swing {
  y: number;
  x: number; // bar index
}

interface PivLevel {
  prc: number;
  bix: number; // bar index where the pivot originated
  mit: boolean; // mitigated
  wic: boolean; // already swept (wicked)
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquiditySweepsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const { term } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const depth =
    term === 'Short Term' ? 1 : term === 'Intermediate Term' ? 2 : 3;

  const colBl = '#089981'; // bullish level
  const colBlS = 'rgba(8,153,129,0.5)'; // bullish sweep
  const colBr = '#f23645'; // bearish level
  const colBrS = 'rgba(242,54,69,0.5)'; // bearish sweep

  const lines: LineDrawingData[] = [];
  const boxes: BoxData[] = [];

  // Multi-depth swing detection arrays (depth levels)
  // fh = fractal highs, fl = fractal lows
  // Each depth level holds up to 3 most recent swings
  const fh: Swing[][] = [];
  const fl: Swing[][] = [];
  for (let d = 0; d < depth; d++) {
    fh.push([]);
    fl.push([]);
  }

  // Active pivot levels
  const pivH: PivLevel[] = [];
  const pivL: PivLevel[] = [];

  // Helper: detect swing at given depth for bear/bull mode
  // Returns a Swing if a pivot was confirmed at the deepest level, else null
  function detect(id: Swing[][], mode: 'bull' | 'bear'): Swing | null {
    let swingLevel: Swing | null = null;

    for (let i = 0; i < depth; i++) {
      const v = id[i];
      if (v.length === 3) {
        let pivot: number;
        if (mode === 'bull') {
          pivot = Math.max(v[0].y, v[1].y, v[2].y);
        } else {
          pivot = Math.min(v[0].y, v[1].y, v[2].y);
        }

        if (pivot === v[1].y) {
          if (i < depth - 1) {
            // Propagate to next depth level
            id[i + 1].unshift({ y: v[1].y, x: v[1].x });
            if (id[i + 1].length > 3) {
              id[i + 1].pop();
            }
          } else {
            swingLevel = { y: v[1].y, x: v[1].x };
          }
          // Remove last 2 elements (pop twice)
          v.pop();
          v.pop();
        }
      }
    }
    return swingLevel;
  }

  for (let i = 0; i < n; i++) {
    const bar = bars[i];

    // Push current bar's high/low to depth-0
    fh[0].unshift({ y: bar.high, x: i });
    fl[0].unshift({ y: bar.low, x: i });

    if (fh[0].length > 3) fh[0].pop();
    if (fl[0].length > 3) fl[0].pop();

    const top = detect(fh, 'bull');
    const btm = detect(fl, 'bear');

    // Register new pivot levels
    if (top !== null && top.y > 0) {
      // Check it's a new level (not duplicate of last)
      if (pivH.length === 0 || pivH[0].prc !== top.y || pivH[0].bix !== top.x) {
        pivH.unshift({ prc: top.y, bix: top.x, mit: false, wic: false });
      }
    }
    if (btm !== null && btm.y > 0) {
      if (pivL.length === 0 || pivL[0].prc !== btm.y || pivL[0].bix !== btm.x) {
        pivL.unshift({ prc: btm.y, bix: btm.x, mit: false, wic: false });
      }
    }

    // Test bearish sweeps (pivot highs)
    for (let j = pivH.length - 1; j >= 0; j--) {
      const lev = pivH[j];
      if (!lev.mit) {
        // Mitigation: close fully breaks above the level
        if (bar.close > lev.prc) {
          lev.mit = true;
        }
        // Sweep: wick above but close below
        if (!lev.wic) {
          if (bar.high > lev.prc && bar.close < lev.prc) {
            // Draw sweep line from origin to current bar
            lines.push({
              time1: bars[lev.bix].time,
              price1: lev.prc,
              time2: bar.time,
              price2: lev.prc,
              color: colBr,
              width: 1,
              style: 'solid',
            });
            // Draw sweep highlight box
            boxes.push({
              time1: bars[Math.max(0, i - 1)].time,
              price1: bar.high,
              time2: bars[Math.min(n - 1, i + 1)].time,
              price2: lev.prc,
              bgColor: colBrS,
              borderColor: 'transparent',
            });
            lev.wic = true;
          }
        }
      }
      // Remove old or mitigated levels
      if (i - lev.bix > 2000 || lev.mit) {
        pivH.splice(j, 1);
      }
    }

    // Test bullish sweeps (pivot lows)
    for (let j = pivL.length - 1; j >= 0; j--) {
      const lev = pivL[j];
      if (!lev.mit) {
        // Mitigation: close fully breaks below the level
        if (bar.close < lev.prc) {
          lev.mit = true;
        }
        // Sweep: wick below but close above
        if (!lev.wic) {
          if (bar.low < lev.prc && bar.close > lev.prc) {
            lines.push({
              time1: bars[lev.bix].time,
              price1: lev.prc,
              time2: bar.time,
              price2: lev.prc,
              color: colBl,
              width: 1,
              style: 'solid',
            });
            boxes.push({
              time1: bars[Math.max(0, i - 1)].time,
              price1: lev.prc,
              time2: bars[Math.min(n - 1, i + 1)].time,
              price2: bar.low,
              bgColor: colBlS,
              borderColor: 'transparent',
            });
            lev.wic = true;
          }
        }
      }
      if (i - lev.bix > 2000 || lev.mit) {
        pivL.splice(j, 1);
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

export const LiquiditySweeps = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
