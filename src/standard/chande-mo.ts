/**
 * Chande Momentum Oscillator (CMO) Indicator
 *
 * Measures momentum on both up and down days.
 * Range: -100 to +100
 */

import type { IndicatorResult, InputConfig, PlotConfig, HLineConfig, Bar, SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChandeMOInputs {
  /** Period length */
  length: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: ChandeMOInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chande MO', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero Line' },
];

export const metadata = {
  title: 'Chande Momentum Oscillator',
  shortTitle: 'ChandeMO',
  overlay: false,
};

type Point = { time: number; value: number };

interface ChandeRun extends BarRunState<Record<string, never>> {
  source: number[];
  m1: number[];
  m2: number[];
  cmoData: Point[];
}

function study(inputs: Partial<ChandeMOInputs>): BarStudy<ChandeRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: ChandeRun = { source: [], m1: [], m2: [], cmoData: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.source, s.m1, s.m2, s.cmoData];
      return s;
    },
    bar(s, i, bars) {
      const source = s.source;
      const m1 = s.m1;
      const m2 = s.m2;
      source[i] = value(bars[i]) ?? NaN;

      // Calculate momentum (change)
      const mom = i > 0 ? source[i] - source[i - 1] : NaN;

      // Separate positive and negative momentum
      m1[i] = mom >= 0 ? mom : 0; // positive
      m2[i] = mom >= 0 ? 0 : -mom; // negative (absolute)

      // Calculate sums over length period
      let chandeMO: number;
      if (i < length) {
        chandeMO = NaN;
      } else {
        let sm1 = 0;
        let sm2 = 0;
        for (let j = i - length + 1; j <= i; j++) {
          if (!isNaN(m1[j])) sm1 += m1[j];
          if (!isNaN(m2[j])) sm2 += m2[j];
        }

        const sum = sm1 + sm2;
        if (sum === 0) {
          chandeMO = 0;
        } else {
          chandeMO = 100 * (sm1 - sm2) / sum;
        }
      }

      s.cmoData[i] = { time: bars[i].time, value: chandeMO };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.cmoData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChandeMOInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChandeMOInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChandeMO = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
