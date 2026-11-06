/**
 * Auto Key Levels
 *
 * Automatically marks recent horizontal support/resistance levels from confirmed
 * pivot highs and lows. Each retained level is drawn as a horizontal ray that
 * extends to the right from the pivot that formed it.
 *
 * Approximation of the standard "Auto Key Levels" indicator,
 * which uses a proprietary level-selection/merging scheme. Here we keep the most
 * recent `maxLevels` confirmed pivots (pivot highs = resistance, lows = support).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, LabelData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AutoKeyLevelsInputs {
  /** Bars on each side required to confirm a pivot */
  pivotLength: number;
  /** Max number of levels to keep */
  maxLevels: number;
}

export const defaultInputs: AutoKeyLevelsInputs = {
  pivotLength: 20,
  maxLevels: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 20, min: 1 },
  { id: 'maxLevels', type: 'int', title: 'Max Levels', defval: 6, min: 1, max: 50 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Key Levels',
  shortTitle: 'Key Levels',
  overlay: true,
};

const RESISTANCE = '#F23645';
const SUPPORT = '#089981';

type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; labels: LabelData[] };

interface Pivot { barIndex: number; price: number; kind: 'high' | 'low'; }

interface KeyLevelsRun extends BarRunState<Record<string, never>> {
  pivots: Pivot[];
}

function study(inputs: Partial<AutoKeyLevelsInputs>): BarStudy<KeyLevelsRun, Result> {
  const { pivotLength: p, maxLevels } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: KeyLevelsRun = { pivots: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.pivots];
      return s;
    },
    bar(s, k, bars) {
      // the pivot of bar i = k - p: confirmed by the p bars after it, the last one being bar k
      const i = k - p;
      if (i < p) return;
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= p; j++) {
        if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
        if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
        if (!isHigh && !isLow) break;
      }
      if (isHigh) s.pivots.push({ barIndex: i, price: bars[i].high, kind: 'high' });
      if (isLow) s.pivots.push({ barIndex: i, price: bars[i].low, kind: 'low' });
    },
    result(s, bars) {
      const n = bars.length;
      // Keep the most recent `maxLevels` pivots.
      const kept = s.pivots.slice(-maxLevels);
      const lastTime = n > 0 ? bars[n - 1].time : 0;

      const lines: LineDrawingData[] = kept.map((pv) => ({
        time1: bars[pv.barIndex].time,
        price1: pv.price,
        time2: lastTime,
        price2: pv.price,
        color: pv.kind === 'high' ? RESISTANCE : SUPPORT,
        width: 1,
        style: 'dashed',
        extend: 'right',
      }));

      const labels: LabelData[] = kept.map((pv) => ({
        time: lastTime,
        price: pv.price,
        text: pv.price.toFixed(2),
        textColor: pv.kind === 'high' ? RESISTANCE : SUPPORT,
        color: 'transparent',
        style: 'label_left',
        size: 'small',
      }));

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {},
        lines,
        labels,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoKeyLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoKeyLevelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoKeyLevels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
