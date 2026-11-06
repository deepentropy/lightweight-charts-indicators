/**
 * Fibonacci Levels
 *
 * EMA-based midline with 6 symmetric Fibonacci deviation bands above and below.
 * Uses standard deviation of effective close (max/min of open,close) multiplied
 * by Fibonacci-derived factors (lm, lm2, lm3, lm4, lm5, lm6).
 * Total: 13 plots (midline + 6 up + 6 down).
 *
 * Reference: "Fibonacci levels" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciLevelsInputs {
  fastPeriod: number;
  emaPeriod: number;
}

export const defaultInputs: FibonacciLevelsInputs = {
  fastPeriod: 50,
  emaPeriod: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: '50 MA', defval: 50, min: 1 },
  { id: 'emaPeriod', type: 'int', title: '100 MA', defval: 100, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'midline', title: 'Mid Line', color: '#FF0000', lineWidth: 2 },
  { id: 'up1', title: '1 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up2', title: '2 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up3', title: '3 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up4', title: '4 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up5', title: '5 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up6', title: '6 Up', color: '#787B86', lineWidth: 1 },
  { id: 'down1', title: '1 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down2', title: '2 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down3', title: '3 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down4', title: '4 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down5', title: '5 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down6', title: '6 Down', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Fibonacci Levels',
  shortTitle: 'FibLvl',
  overlay: true,
};

type Point = { time: number; value: number };

const PLOT_IDS = ['midline', 'up1', 'up2', 'up3', 'up4', 'up5', 'up6', 'down1', 'down2', 'down3', 'down4', 'down5', 'down6'];

interface FibLevelsRun extends BarRunState<Record<string, never>> {
  mid: ReturnType<typeof taStep.ema>;
  dev: WindowStdev;
  lm: ReturnType<typeof taStep.ema>;
  plots: Point[][];
}

function study(inputs: Partial<FibonacciLevelsInputs>): BarStudy<FibLevelsRun, IndicatorResult> {
  const { emaPeriod } = { ...defaultInputs, ...inputs };
  const warmup = emaPeriod;
  return {
    init() {
      const mid = taStep.ema(emaPeriod);
      const dev = new WindowStdev(emaPeriod);
      const lm = taStep.ema(emaPeriod);
      const s: FibLevelsRun = { mid, dev, lm, plots: PLOT_IDS.map(() => []), steps: [mid, dev, lm], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // effclose = max(open,close) if close>=open, else min(open,close)
      const effClose = b.close >= b.open ? Math.max(b.open, b.close) : Math.min(b.open, b.close);
      const mid = s.mid.step(effClose);
      const dev = s.dev.step(effClose);

      // max deviation multiplier of the bar, then its EMA
      const toc = Math.max(b.open, b.close);
      const boc = Math.min(b.open, b.close);
      let maxMult: number;
      if (dev === 0 || isNaN(mid) || isNaN(dev)) {
        maxMult = 0;
      } else {
        const plusDevMult = toc > mid ? (toc - mid) / dev : 0;
        const minusDevMult = boc < mid ? (mid - boc) / dev : 0;
        maxMult = Math.max(plusDevMult, minusDevMult);
      }
      const lm = s.lm.step(maxMult);

      // Pine Fibonacci multipliers:
      // lm, lm2=lm/2, lm3=lm2*0.38196601, lm4=lm*1.38196601, lm5=lm*1.61803399, lm6=(lm+lm2)/2
      const p = s.plots;
      const time = b.time;
      if (i < warmup || isNaN(mid) || isNaN(dev) || isNaN(lm)) {
        for (let k = 0; k < p.length; k++) p[k][i] = { time, value: NaN };
      } else {
        const lm2 = lm / 2;
        const lm3 = lm2 * 0.38196601;
        const lm4 = lm * 1.38196601;
        const lm5 = lm * 1.61803399;
        const lm6 = (lm + lm2) / 2;

        p[0][i] = { time, value: mid };
        // Up levels: 1=lm3, 2=lm2, 3=lm6, 4=lm, 5=lm4, 6=lm5 (per Pine plot order)
        p[1][i] = { time, value: mid + dev * lm3 };
        p[2][i] = { time, value: mid + dev * lm2 };
        p[3][i] = { time, value: mid + dev * lm6 };
        p[4][i] = { time, value: mid + dev * lm };
        p[5][i] = { time, value: mid + dev * lm4 };
        p[6][i] = { time, value: mid + dev * lm5 };
        // Down levels: same multipliers, subtracted
        p[7][i] = { time, value: mid - dev * lm3 };
        p[8][i] = { time, value: mid - dev * lm2 };
        p[9][i] = { time, value: mid - dev * lm6 };
        p[10][i] = { time, value: mid - dev * lm };
        p[11][i] = { time, value: mid - dev * lm4 };
        p[12][i] = { time, value: mid - dev * lm5 };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      PLOT_IDS.forEach((id, k) => { plots[id] = s.plots[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciLevelsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
