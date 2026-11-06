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
 * Reference: "Liquidity Levels [LuxAlgo]" by LuxAlgo
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, BoxData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquidityLevelsInputs {
  length: number;
  show: number;
  lineCol: 'Relative' | 'Random' | 'Fixed';
  lvlStyle: 'solid' | 'dashed' | 'dotted';
  relativeColUp: string;
  relativeColDn: string;
  fixedCol: string;
  showHist: boolean;
  distWin: number;
  upCol: string;
  dnCol: string;
}

export const defaultInputs: LiquidityLevelsInputs = {
  length: 20,
  show: 5,
  lineCol: 'Fixed',
  lvlStyle: 'solid',
  relativeColUp: '#2157f3',
  relativeColDn: '#ff5d00',
  fixedCol: '#2157f3',
  showHist: true,
  distWin: 200,
  upCol: 'rgba(33,87,243,0.5)',
  dnCol: 'rgba(255,93,0,0.5)',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
  { id: 'show', type: 'int', title: 'Number Of Levels', defval: 5, min: 1 },
  { id: 'lineCol', type: 'string', title: 'Levels Color Mode', defval: 'Fixed', options: ['Relative', 'Random', 'Fixed'] },
  // Pine options '──' / '- - -' / '· · ·'
  { id: 'lvlStyle', type: 'string', title: 'Levels Style', defval: 'solid', options: ['solid', 'dashed', 'dotted'] },
  { id: 'relativeColUp', type: 'color', title: '', defval: '#2157f3' },
  { id: 'relativeColDn', type: 'color', title: '', defval: '#ff5d00' },
  { id: 'fixedCol', type: 'color', title: 'Fixed Color', defval: '#2157f3' },
  { id: 'showHist', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'distWin', type: 'int', title: 'Histogram Window', defval: 200, max: 500 },
  { id: 'upCol', type: 'color', title: 'Bins Colors', defval: 'rgba(33,87,243,0.5)' },
  { id: 'dnCol', type: 'color', title: '', defval: 'rgba(255,93,0,0.5)' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Levels [LuxAlgo]',
  shortTitle: 'LiqLevels',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; boxes: BoxData[] };

interface LiquidityVars {
  /** Liquidity levels, newest first (changed in place: copied by copyVars) */
  pals: number[];
}

interface LiquidityRun extends BarRunState<LiquidityVars> {
  phv: PivotStep;
}

function study(inputs: Partial<LiquidityLevelsInputs>): BarStudy<LiquidityRun, Result> {
  const { length, show, lineCol, lvlStyle, relativeColUp, relativeColDn, fixedCol, showHist, distWin, upCol, dnCol } =
    { ...defaultInputs, ...inputs };
  // barstate.isfirst: one line per level, colour fixed_col or a random colour ('Random' mode)
  let lineColors: string[] = [];
  return {
    init() {
      lineColors = [];
      for (let i = 0; i < show; i++) {
        if (lineCol === 'Random') {
          const r = () => Math.round(Math.random() * 255);
          lineColors.push(`rgb(${r()},${r()},${r()})`);
        } else {
          lineColors.push(fixedCol);
        }
      }
      // Compute pivot highs on volume
      const phv = new PivotStep(length, length, true);
      return { phv, steps: [phv], vars: { pals: [] }, lists: [], series: [] };
    },
    bar(s, i, bars) {
      const phv = s.phv.step(i, bars[i].volume ?? 0);
      // Collect liquidity levels: on volume pivot (`if phv`: not na and not 0), record close[length]
      if (!isNaN(phv) && phv !== 0 && i >= length) {
        const pals = s.vars.pals;
        // Pine: close[length] on the confirmation bar = close of the pivot bar
        pals.unshift(bars[i - length].close);
        if (pals.length > show) {
          pals.pop();
        }
      }
    },
    copyVars: (v) => ({ pals: v.pals.slice() }),
    result(s, bars) {
      const n = bars.length;
      // Sort levels (required for histogram binary search)
      const pals = s.vars.pals.slice().sort((a, b) => a - b);

      const lines: LineDrawingData[] = [];
      const boxes: BoxData[] = [];

      if (n === 0) {
        return {
          metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
          plots: {},
          lines,
          boxes,
        };
      }

      const lastBar = bars[n - 1];

      // Levels: line from n-1 to n, extend.left, width 1; 'Relative' mode colours by close > level
      pals.forEach((lvl, index) => {
        const col = lineCol === 'Relative' ? (lastBar.close > lvl ? relativeColUp : relativeColDn) : lineColors[index];
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
      });

      // Histogram (Pine, barstate.islast): over the last distwin bars, idx = pals.binary_search_rightmost(close[i]);
      // when 1 <= idx < show the bar counts as bullish (close > open) or bearish in bin idx - 1. Box per bin:
      // bull from n to n + bull, bear from n + bull to n + bull + bear (n = bar_index of the last bar), between
      // pals[index] and pals[index + 1]. The right edges are on bars after the last bar (time of that future bar).
      if (showHist && show >= 2 && pals.length >= 2) {
        const bull = new Array<number>(show - 1).fill(0);
        const bear = new Array<number>(show - 1).fill(0);
        for (let i = 0; i <= distWin - 1 && i < n; i++) {
          const b = bars[n - 1 - i];
          const idx = binarySearchRightmost(pals, b.close);
          if (idx >= 1 && idx < show) {
            if (b.close > b.open) bull[idx - 1]++;
            else bear[idx - 1]++;
          }
        }
        const interval = barInterval(bars);
        const at = (k: number) => barTime(bars, n - 1 + k, interval);
        for (let index = 0; index < Math.min(show - 1, pals.length - 1); index++) {
          boxes.push({ time1: at(0), price1: pals[index], time2: at(bull[index]), price2: pals[index + 1], bgColor: upCol, borderColor: 'transparent' });
          boxes.push({
            time1: at(bull[index]), price1: pals[index], time2: at(bull[index] + bear[index]), price2: pals[index + 1],
            bgColor: dnCol, borderColor: 'transparent',
          });
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines,
        boxes,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LiquidityLevelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const LiquidityLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };

/**
 * Pine array.binary_search_rightmost on an ascending array: the index of the last element equal to `value`, else
 * the index of the element to the right of where `value` would lie (number of elements below it).
 */
function binarySearchRightmost(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  // lo = number of elements <= value
  return lo > 0 && sorted[lo - 1] === value ? lo - 1 : lo;
}
