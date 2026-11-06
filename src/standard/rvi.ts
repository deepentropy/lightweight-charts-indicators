/**
 * Relative Vigor Index (RVI/RVGI) Indicator
 *
 * Measures the conviction of a recent price action.
 * Based on the relationship between close-open and high-low.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RVIInputs {
  /** Period length */
  length: number;
  /** Plot offset */
  offset: number;
}

export const defaultInputs: RVIInputs = {
  length: 10,
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVGI', color: '#008000', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF0000', lineWidth: 1 },
];


export const metadata = {
  title: 'Relative Vigor Index',
  shortTitle: 'RVGI',
  overlay: false,
};

interface RVIRun extends BarRunState<Record<string, never>> {
  numSum: WindowSum;
  denSum: WindowSum;
  co: number[];
  hl: number[];
  rviRaw: number[];
  sigRaw: number[];
}

/** ta.swma(x) on bar i: (x + 2 * x[1] + 2 * x[2] + x[3]) / 6, na on the first 3 bars */
const swma = (x: number[], i: number) => (i < 3 ? NaN : (x[i]! + 2 * x[i - 1]! + 2 * x[i - 2]! + x[i - 3]!) / 6);

function study(inputs: Partial<RVIInputs>): BarStudy<RVIRun, IndicatorResult> {
  const { length, offset } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: RVIRun = {
        numSum: new WindowSum(length), denSum: new WindowSum(length), co: [], hl: [], rviRaw: [], sigRaw: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.numSum, s.denSum];
      s.series = [s.co, s.hl, s.rviRaw, s.sigRaw];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // rvi = math.sum(ta.swma(close - open), len) / math.sum(ta.swma(high - low), len)
      s.co[i] = b.close - b.open;
      s.hl[i] = b.high - b.low;
      const num = s.numSum.step(swma(s.co, i));
      const den = s.denSum.step(swma(s.hl, i));
      // A plain division: x / 0 is +-infinity, 0 / 0 is NaN (na); the plots show both as na
      s.rviRaw[i] = num / den;
      // sig = ta.swma(rvi)
      s.sigRaw[i] = swma(s.rviRaw, i);
    },
    result(s, bars) {
      const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
      // plot(..., offset = offset): the value of bar i is drawn on bar i + offset (future bars after the last bar)
      const interval = barInterval(bars);
      const applyOffset = (arr: number[]) => {
        const out: { time: number; value: number }[] = [];
        for (let i = 0; i < bars.length; i++) {
          if (i + offset < 0) continue;
          out.push({ time: barTime(bars, i + offset, interval), value: finite(arr[i]!) });
        }
        return out;
      };

      const rviData = applyOffset(s.rviRaw);
      const signalData = applyOffset(s.sigRaw);

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': rviData,
          'plot1': signalData,
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RVIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RVIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RVI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
