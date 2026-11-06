/**
 * Trend Lines v2
 *
 * Pivot-based trend lines connecting consecutive pivot points.
 * Validates that no close falls through the line between pivots.
 * Draws up to 3 uptrend lines (ascending pivot lows) and
 * 3 downtrend lines (descending pivot highs).
 *
 * The start date (year, month, day inputs) is a date of the exchange time zone, as in the original. The port reads
 * the time zone from the optional third argument (see src/chart-context.ts); without it the date is a UTC date.
 *
 * Reference: "Trend Lines v2" by LonesomeTheBlue (Pine v4)
 */

import { time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendLinesV2Inputs {
  startYear: number;
  startMonth: number;
  startDay: number;
  prd: number;
  ppNum: number;
  /** Uptrend line colour */
  utcol: string;
  /** Downtrend line colour */
  dtcol: string;
}

// Pine v4 colours: color.lime #00E676, color.red #FF5252
export const defaultInputs: TrendLinesV2Inputs = {
  startYear: 2020,
  startMonth: 1,
  startDay: 1,
  prd: 20,
  ppNum: 3,
  utcol: '#00E676',
  dtcol: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'startYear', type: 'int', title: 'Start Year', defval: 2020 },
  { id: 'startMonth', type: 'int', title: 'Start Month', defval: 1 },
  { id: 'startDay', type: 'int', title: 'Start day', defval: 1 },
  { id: 'prd', type: 'int', title: 'Pivot Period', defval: 20, min: 10, max: 50 },
  { id: 'ppNum', type: 'int', title: 'Number of Pivot Points to check', defval: 3, min: 2, max: 6 },
  { id: 'utcol', type: 'color', title: 'Colors', defval: '#00E676' },
  // Pine title is '' (same inline row as 'Colors')
  { id: 'dtcol', type: 'color', title: 'Colors (down)', defval: '#FF5252' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Trend Lines v2',
  shortTitle: 'TLv2',
  overlay: true,
};

/** Pine float comparison: a == b when |a - b| <= 1e-10 */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[] };

interface TrendLinesVars {
  // Track last N pivot highs/lows with their bar indices
  // Pine uses arrays that unshift new values and pop old ones
  tval: number[]; // pivot high values
  tpos: number[]; // pivot high bar indices
  bval: number[]; // pivot low values
  bpos: number[]; // pivot low bar indices
}

interface TrendLinesRun extends BarRunState<TrendLinesVars> {
  ph: PivotStep;
  pl: PivotStep;
}

function study(inputs: Partial<TrendLinesV2Inputs>): BarStudy<TrendLinesRun, Result> {
  const { startYear, startMonth, startDay, prd, ppNum, utcol, dtcol } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Detect pivots - the value appears on the confirmation bar (pivot bar + prd), as in Pine
      const ph = new PivotStep(prd, prd, true);
      const pl = new PivotStep(prd, prd, false);
      return { ph, pl, steps: [ph, pl], vars: { tval: [], tpos: [], bval: [], bpos: [] }, lists: [], series: [] };
    },
    copyVars: (v) => ({ tval: v.tval.slice(), tpos: v.tpos.slice(), bval: v.bval.slice(), bpos: v.bpos.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const { tval, tpos, bval, bpos } = s.vars;

      // Add new pivots to front of arrays, keep max ppNum
      if (ph != null && !isNaN(ph) && ph !== 0) { // Pine v4 `if ph`: not na and not 0
        tval.unshift(ph);
        tpos.unshift(i);
        if (tval.length > ppNum) {
          tval.pop();
          tpos.pop();
        }
      }
      if (pl != null && !isNaN(pl) && pl !== 0) {
        bval.unshift(pl);
        bpos.unshift(i);
        if (bval.length > ppNum) {
          bval.pop();
          bpos.pop();
        }
      }
    },
    result(s, bars, chart) {
      const n = bars.length;
      const { tval, tpos, bval, bpos } = s.vars;
      const lines: LineDrawingData[] = [];
      const maxline = 3;

      // Now process all pivot pairs to find valid trend lines
      // Pine deletes and redraws the lines on every bar with time >= starttime; the lines left are the ones of the
      // last bar. Before starttime nothing is drawn.
      // Pine timestamp() uses the exchange time zone: the one of the chart context, UTC without it.
      const lastBar = n - 1;
      const startTime = (chart?.timezone === undefined
        ? Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0)
        : pineTime.timestamp(chart.timezone, startYear, startMonth, startDay, 0, 0, 0)) / 1000;
      if (n === 0 || bars[lastBar].time < startTime) {
        return {
          metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
          plots: {},
          lines: [],
        };
      }
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
            if (gt(val1, val2) && pos1 !== pos2) {
              const diff = (val1 - val2) / (pos1 - pos2);
              let hline = val2 + diff;
              let lloc = lastBar;
              let valid = true;
              const startCheck = Math.max(0, pos2 + 1 - prd);
              for (let x = startCheck; x <= lastBar; x++) {
                if (lt(bars[x].close, hline)) {
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
            if (lt(val1, val2) && pos1 !== pos2) {
              const diff = (val2 - val1) / (pos1 - pos2);
              let hline = val2 - diff;
              let lloc = lastBar;
              let valid = true;
              const startCheck = Math.max(0, pos2 + 1 - prd);
              for (let x = startCheck; x <= lastBar; x++) {
                if (gt(bars[x].close, hline)) {
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
            color: utcol,
            width: 1,
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
            color: dtcol,
            width: 1,
            style: 'solid',
          });
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendLinesV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendLinesV2Inputs> = {}, chart?: ChartContext): Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const TrendLinesV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
