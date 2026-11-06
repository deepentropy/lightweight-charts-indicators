/**
 * CM_Parabolic SAR
 *
 * Parabolic SAR with two colours: the dots are lime while the close is at or above the SAR (up trend) and red while
 * the close is at or below it (down trend). Each side can be switched off. The start and step inputs are multiplied
 * by 0.01 and the maximum step by 0.10.
 *
 * Reference: "CM_Parabolic SAR" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created By ChrisMoody on 7/25/2014
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface CmParabolicSarInputs {
  /** Start, multiplied by 0.01 */
  start: number;
  /** Step, multiplied by 0.01 */
  increment: number;
  /** Maximum step, multiplied by 0.10 */
  maximum: number;
  /** Show the SAR of up trends */
  sus: boolean;
  /** Show the SAR of down trends */
  sds: boolean;
  /** Note of the original about the multipliers (no effect) */
  disc: boolean;
}

export const defaultInputs: CmParabolicSarInputs = {
  start: 2,
  increment: 2,
  maximum: 2,
  sus: true,
  sds: true,
  disc: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'int', title: 'Start - Default = 2 - Multiplied by .01', defval: 2, min: 0, max: 10 },
  { id: 'increment', type: 'int', title: 'Step Setting (Sensitivity) - Default = 2 - Multiplied by .01', defval: 2, min: 0, max: 10 },
  { id: 'maximum', type: 'int', title: 'Maximum Step (Sensitivity) - Default = 2 - Multiplied by .10', defval: 2, min: 1, max: 10 },
  { id: 'sus', type: 'bool', title: 'Show Up Trending Parabolic Sar', defval: true },
  { id: 'sds', type: 'bool', title: 'Show Down Trending Parabolic Sar', defval: true },
  { id: 'disc', type: 'bool', title: 'Start and Step settings are *.01 so 2 = .02 etc, Maximum Step is *.10 so 2 = .2', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1('#00FF00');
const RED = V1('#FF0000');

// Both plots have the title "Up Trending SAR" in the original
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trending SAR', color: LIME, lineWidth: 4, style: 'circles' },
  { id: 'plot1', title: 'Up Trending SAR', color: RED, lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'CM_Parabolic SAR',
  shortTitle: 'CM_P-SAR',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * `ta.sar(start, inc, max)` one bar at a time (no taStep machine): the state of the oakscriptjs array function kept
 * between bars (the same doubles).
 */
class SarStep implements Committable {
  private sarValue = NaN;
  private extremePoint = NaN;
  private acceleration: number;
  private isUpTrend = false;
  private nSar = NaN;
  private nExtreme = NaN;
  private nAcceleration: number;
  private nUpTrend = false;
  private stepped = false;

  constructor(private readonly start: number, private readonly inc: number, private readonly max: number) {
    this.acceleration = start;
    this.nAcceleration = start;
  }

  step(bars: Bar[], i: number): number {
    this.stepped = false;
    if (i === 0) return NaN;
    const { start, inc, max } = this;
    const high = bars[i].high;
    const low = bars[i].low;
    let { sarValue, extremePoint, acceleration, isUpTrend } = this;
    let isFirstTrendBar = false;

    if (i === 1) {
      if (bars[i].close > bars[i - 1].close) {
        isUpTrend = true;
        extremePoint = high;
        sarValue = bars[i - 1].low;
      } else {
        isUpTrend = false;
        extremePoint = low;
        sarValue = bars[i - 1].high;
      }
      isFirstTrendBar = true;
      acceleration = start;
    }

    sarValue = sarValue + acceleration * (extremePoint - sarValue);

    if (isUpTrend) {
      if (sarValue > low) {
        isFirstTrendBar = true;
        isUpTrend = false;
        sarValue = Math.max(high, extremePoint);
        extremePoint = low;
        acceleration = start;
      }
    } else {
      if (sarValue < high) {
        isFirstTrendBar = true;
        isUpTrend = true;
        sarValue = Math.min(low, extremePoint);
        extremePoint = high;
        acceleration = start;
      }
    }

    if (!isFirstTrendBar) {
      if (isUpTrend) {
        if (high > extremePoint) {
          extremePoint = high;
          acceleration = Math.min(acceleration + inc, max);
        }
      } else {
        if (low < extremePoint) {
          extremePoint = low;
          acceleration = Math.min(acceleration + inc, max);
        }
      }
    }

    if (isUpTrend) {
      sarValue = Math.min(sarValue, bars[i - 1].low);
      if (i > 1) {
        sarValue = Math.min(sarValue, bars[i - 2].low);
      }
    } else {
      sarValue = Math.max(sarValue, bars[i - 1].high);
      if (i > 1) {
        sarValue = Math.max(sarValue, bars[i - 2].high);
      }
    }

    this.nSar = sarValue;
    this.nExtreme = extremePoint;
    this.nAcceleration = acceleration;
    this.nUpTrend = isUpTrend;
    this.stepped = true;
    return sarValue;
  }

  commit(): void {
    if (this.stepped) {
      this.sarValue = this.nSar;
      this.extremePoint = this.nExtreme;
      this.acceleration = this.nAcceleration;
      this.isUpTrend = this.nUpTrend;
    }
    this.stepped = false;
  }
}

type Point = { time: number; value: number; color: string };

interface CmSarRun extends BarRunState<Record<string, never>> {
  sar: SarStep;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<CmParabolicSarInputs>): BarStudy<CmSarRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // sarUp and sarDown are the same series: sar(start * .01, increment * .01, maximum * .10)
      const sar = new SarStep(cfg.start * 0.01, cfg.increment * 0.01, cfg.maximum * 0.1);
      const s: CmSarRun = { sar, plot0: [], plot1: [], steps: [sar], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const sar = s.sar.step(bars, i);
      // colUp = close >= sarDown ? lime : na; colDown = close <= sarUp ? red : na
      const colUp = ge(b.close, sar) ? LIME : 'transparent';
      const colDown = le(b.close, sar) ? RED : 'transparent';
      // plot(sus and sarUp ? sarUp : na): a value of 0 or na is not drawn
      s.plot0[i] = { time: b.time, value: cfg.sus && truthy(sar) ? sar : NaN, color: colUp };
      s.plot1[i] = { time: b.time, value: cfg.sds && truthy(sar) ? sar : NaN, color: colDown };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmParabolicSarInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmParabolicSarInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CmParabolicSar = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
