/**
 * BBTrend Indicator
 *
 * Uses the difference between short and long Bollinger Bands
 * to identify trend direction and strength.
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface BBTrendInputs {
  /** Short Bollinger Band length */
  shortLength: number;
  /** Long Bollinger Band length */
  longLength: number;
  /** Standard deviation multiplier */
  stdDev: number;
}

export const defaultInputs: BBTrendInputs = {
  shortLength: 20,
  longLength: 50,
  stdDev: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short BB Length', defval: 20, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long BB Length', defval: 50, min: 1 },
  { id: 'stdDev', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BBTrend', color: '#089981', lineWidth: 1, style: 'columns' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
];

export const metadata = {
  title: 'BBTrend',
  shortTitle: 'BBTrend',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

// Pine: color.new(#089981, 25) = 75% opacity, color.new(#089981, 50) = 50% opacity
const POS_STRONG = '#089981BF';
const POS_WEAK   = '#08998180';
const NEG_WEAK   = '#F2364580';
const NEG_STRONG = '#F23645BF';

// switch as in Pine: operators with the 1e-10 tolerance, a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a - b) && !lt(a, b);
const le = (a: number, b: number) => !Number.isNaN(a - b) && !gt(a, b);

/**
 * ta.sma(close, length) and ta.stdev(close, length) (biased) with a constant length from one pair of exact window
 * sums ({@link WindowSum}) of the values and of their squares: the operations of WindowSma / WindowStdev (the same
 * doubles), the sum of the values shared by the mean and the deviation.
 */
class SmaStdevStep {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;
  /** ta.sma of the last step */
  mean = NaN;

  constructor(length: number) {
    // the length checks of ta.sma then ta.stdev (the same runtime errors)
    taCore.sma([], length);
    taCore.stdev([], length);
    this.len = Math.floor(length);
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
  }

  /** Steps the bar's value: the stdev (the sma in `mean`) */
  step(value: number): number {
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    const mean = sum / this.len;
    this.mean = mean;
    const v = sq / this.len - mean * mean;
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

interface BBTrendVars {
  prevBBTrend: number;
}

interface BBTrendRun extends BarRunState<BBTrendVars> {
  short: SmaStdevStep;
  long: SmaStdevStep;
  data: Point[];
}

function study(inputs: Partial<BBTrendInputs>): BarStudy<BBTrendRun, IndicatorResult> {
  const { shortLength, longLength, stdDev } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const short = new SmaStdevStep(shortLength);
      const long = new SmaStdevStep(longLength);
      const s: BBTrendRun = {
        short, long, data: [],
        steps: [short, long], vars: { prevBBTrend: NaN }, lists: [], series: [],
      };
      s.series = [s.data];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const close = bar.close;
      // Calculate short BB
      const shortStdev = s.short.step(close);
      const sM = s.short.mean;
      const sU = sM + shortStdev * stdDev;
      const sL = sM - shortStdev * stdDev;
      // Calculate long BB
      const longStdev = s.long.step(close);
      const longMiddle = s.long.mean;
      const lU = longMiddle + longStdev * stdDev;
      const lL = longMiddle - longStdev * stdDev;

      if (sM === 0) {
        s.data[i] = { time: bar.time, value: NaN };
        return;
      }

      // BBTrend = (|shortLower - longLower| - |shortUpper - longUpper|) / shortMiddle * 100
      const bbTrend = (Math.abs(sL - lL) - Math.abs(sU - lU)) / sM * 100;
      const prevBBTrend = s.vars.prevBBTrend;
      let color: string;
      if (gt(bbTrend, 0) && ge(bbTrend, prevBBTrend)) color = POS_STRONG;
      else if (gt(bbTrend, 0) && lt(bbTrend, prevBBTrend)) color = POS_WEAK;
      else if (lt(bbTrend, 0) && gt(bbTrend, prevBBTrend)) color = NEG_WEAK;
      else if (lt(bbTrend, 0) && le(bbTrend, prevBBTrend)) color = NEG_STRONG;
      else color = POS_WEAK;
      s.vars.prevBBTrend = bbTrend;
      s.data[i] = { time: bar.time, value: bbTrend, color };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.data.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BBTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
