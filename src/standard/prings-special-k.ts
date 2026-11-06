/**
 * Pring's Special K
 *
 * Martin Pring's "Special K" combines short-, intermediate- and long-term
 * smoothed Rate-of-Change values into a single momentum curve, summing twelve
 * SMA-of-ROC terms with ascending weights (1,2,3,4 within each band).
 *
 * Canonical daily parameters (Pring):
 *   ROC:    10  15  20  30 | 40  65  75 100 | 195 265 390 530
 *   SMA:    10  10  10  15 | 50  65  75 100 | 130 130 130 195
 *   weight:  1   2   3   4 |  1   2   3   4 |   1   2   3   4
 *
 * Based on the standard "Pring's Special K" indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PringsSpecialKInputs {
  // Canonical fixed parameters; no user inputs.
}

export const defaultInputs: PringsSpecialKInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Special K', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: "Pring's Special K",
  shortTitle: 'Special K',
  overlay: false,
};

const ROC_LEN = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
const SMA_LEN = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
const WEIGHT = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];

type Point = { time: number; value: number };

interface SpecialKRun extends BarRunState<Record<string, never>> {
  smas: WindowSma[];
  plotData: Point[];
}

function study(): BarStudy<SpecialKRun, IndicatorResult> {
  return {
    init() {
      const smas = SMA_LEN.map((len) => new WindowSma(len));
      const s: SpecialKRun = { smas, plotData: [], steps: [...smas], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Each term = weight * sma(roc(close, rocLen), smaLen)
      let sum = 0;
      const c = b.close;
      for (let k = 0; k < ROC_LEN.length; k++) {
        // ta.roc(close, len): 100 * (close - close[len]) / close[len], na for the first len bars or an na close
        const len = ROC_LEN[k];
        const old = i < len ? NaN : bars[i - len].close;
        const roc = Number.isNaN(old) || Number.isNaN(c) ? NaN : (100 * (c - old)) / old;
        const v = s.smas[k].step(roc);
        if (v == null || isNaN(v)) sum = NaN;
        else sum += WEIGHT[k] * v;
      }
      s.plotData[i] = { time: b.time, value: sum };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<PringsSpecialKInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<PringsSpecialKInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const PringsSpecialK = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
