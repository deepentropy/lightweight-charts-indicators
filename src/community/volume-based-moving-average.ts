/**
 * Volume-Based Moving Average
 *
 * A moving average whose length follows the volume: from the current bar back, bars are added until their volume sum
 * reaches the target volume (or the first bar is reached); the average is the mean of the source over these bars.
 * The 'High & Low' source draws two lines (the average of the highs and of the lows), the other sources one line.
 * A line turns green after the given number of rising bars in a row, red after the same number of falling bars in a
 * row, and keeps its colour otherwise (gray at the start).
 *
 * Reference: "Volume-Based Moving Average" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Forex_Steward
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeBasedMovingAverageInputs {
  /** Volume sum that sets the averaging window */
  targetVolume: number;
  /** Source of the average */
  sourceOpt: 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'High & Low';
  /** Rising / falling bars in a row that change the line colour */
  slopeConfirmBars: number;
}

export const defaultInputs: VolumeBasedMovingAverageInputs = {
  targetVolume: 250000,
  sourceOpt: 'High & Low',
  slopeConfirmBars: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'targetVolume', type: 'float', title: 'Target Volume', defval: 250000 },
  { id: 'sourceOpt', type: 'string', title: 'Source', defval: 'High & Low', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'High & Low'] },
  { id: 'slopeConfirmBars', type: 'int', title: 'Slope Confirmation Bars', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'Volume MA High', color: color.gray, lineWidth: 2 },
  { id: 'plot2', title: 'Volume MA Low', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume-Based Moving Average',
  shortTitle: 'Volume-Based Moving Average',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };

/** f_slopeColor(_vma): one set of var counters per call */
interface Slope {
  upCount: number;
  downCount: number;
  curColor: string;
}

interface VbmaVars {
  slopes: Slope[];
}

interface VbmaRun extends BarRunState<VbmaVars> {
  /** volume and the sources of the lines, by bar */
  vol: number[];
  src: number[][];
  vma: number[][];
  plots: Point[][];
}

function study(inputs: Partial<VolumeBasedMovingAverageInputs>): BarStudy<VbmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf: Record<string, (b: Bar) => number> = {
    Close: (b) => b.close,
    HL2: (b) => (b.high + b.low) / 2,
    HLC3: (b) => (b.high + b.low + b.close) / 3,
    OHLC4: (b) => (b.open + b.high + b.low + b.close) / 4,
  };
  const hl = cfg.sourceOpt === 'High & Low';
  const singleSrc = srcOf[cfg.sourceOpt];
  const sources: Array<((b: Bar) => number) | null> = [singleSrc ?? null, hl ? (b) => b.high : null, hl ? (b) => b.low : null];

  // f_volumeMA(_src): sum volume[k] and _src[k] from k = 0 while volSum < targetVolume and k < bar_index + 1
  const volumeMA = (vol: number[], src: number[], i: number): number => {
    let volSum = 0;
    let priceSum = 0;
    let barsUsed = 0;
    const totalBars = i + 1;
    while (gt(cfg.targetVolume, volSum) && barsUsed < totalBars) {
      volSum += vol[i - barsUsed];
      priceSum += src[i - barsUsed];
      barsUsed += 1;
    }
    return barsUsed > 0 ? priceSum / barsUsed : NaN;
  };

  return {
    init() {
      const s: VbmaRun = {
        vol: [], src: [[], [], []], vma: [[], [], []], plots: [[], [], []], steps: [], lists: [],
        vars: { slopes: [0, 1, 2].map(() => ({ upCount: 0, downCount: 0, curColor: color.gray as string })) },
        series: [],
      };
      s.series = [s.vol, ...s.src, ...s.vma, ...s.plots];
      return s;
    },
    copyVars: (v) => ({ slopes: v.slopes.map((sl) => ({ ...sl })) }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      s.vol[i] = b.volume ?? NaN;
      for (let k = 0; k < 3; k++) {
        const src = sources[k];
        const vma = s.vma[k];
        let v = NaN;
        if (src) {
          s.src[k][i] = src(b);
          v = volumeMA(s.vol, s.src[k], i);
        }
        vma[i] = v;
        const sl = s.vars.slopes[k];
        const prev = i > 0 ? vma[i - 1] : NaN;
        if (!isNaN(v) && !isNaN(prev)) {
          if (gt(v, prev)) {
            sl.upCount += 1;
            sl.downCount = 0;
          } else if (gt(prev, v)) {
            sl.downCount += 1;
            sl.upCount = 0;
          }
          if (sl.upCount >= cfg.slopeConfirmBars) sl.curColor = color.green;
          else if (sl.downCount >= cfg.slopeConfirmBars) sl.curColor = color.red;
        }
        s.plots[k][i] = { time, value: Number.isFinite(v) ? v : NaN, color: sl.curColor };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBasedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeBasedMovingAverageInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeBasedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
