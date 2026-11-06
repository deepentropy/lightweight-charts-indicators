/**
 * Pullback SAR
 *
 * Parabolic SAR with a slow acceleration (start 0.01, increment 0.01, max 0.1). The trend is bullish when the close
 * is above the SAR and bearish when it is below. A pullback in an uptrend is a bar after a bullish bar with a lower
 * close and a lower low; a long re-entry is the next bar when it is bullish and closes higher. A pullback in a
 * downtrend is a bar after a bearish bar with a higher close and a higher high; a short re-entry is the next bar when
 * it is bearish and closes lower. Re-entries are drawn as triangles, the SAR as crosses.
 * Alerts (alertcondition, `alerts` of the result): 'Alert Long' and 'Alert Short', true on the re-entry bars.
 *
 * Reference: "Pullback SAR" by szymonsobkowiak
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface PullbackSarInputs {
  /** SAR start (acceleration factor) */
  start: number;
  /** SAR increment */
  increment: number;
  /** SAR maximum */
  maximum: number;
}

export const defaultInputs: PullbackSarInputs = {
  start: 0.01,
  increment: 0.01,
  maximum: 0.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'float', title: 'Start', defval: 0.01 },
  { id: 'increment', type: 'float', title: 'Increment', defval: 0.01 },
  { id: 'maximum', type: 'float', title: 'Max Value', defval: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SAR', color: color.gray, lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Pullback SAR',
  shortTitle: 'Pullback SAR',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

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
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PsRun extends BarRunState<Record<string, never>> {
  sar: SarStep;
  isBull: boolean[];
  isBear: boolean[];
  pbUp: boolean[];
  pbDown: boolean[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PullbackSarInputs>): BarStudy<PsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sar = new SarStep(cfg.start, cfg.increment, cfg.maximum);
      const s: PsRun = {
        sar, isBull: [], isBear: [], pbUp: [], pbDown: [], plot0: [], markers: [], flags: [[], []], times: [[], []],
        steps: [sar], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.isBull, s.isBear, s.pbUp, s.pbDown, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const p = i > 0 ? bars[i - 1] : undefined;
      const pClose = p ? p.close : NaN;
      const sar = s.sar.step(bars, i);
      s.isBull[i] = gt(b.close, sar);
      s.isBear[i] = lt(b.close, sar);
      // pullbackInUptrend = isBull[1] and close < close[1] and low < low[1]
      s.pbUp[i] = i > 0 && s.isBull[i - 1] && lt(b.close, pClose) && lt(b.low, p!.low);
      // pullbackInDowntrend = isBear[1] and close > close[1] and high > high[1]
      s.pbDown[i] = i > 0 && s.isBear[i - 1] && gt(b.close, pClose) && gt(b.high, p!.high);
      // reentryLong = pullbackInUptrend[1] and isBull and close > close[1]
      const reentryLong = i > 0 && s.pbUp[i - 1] && s.isBull[i] && gt(b.close, pClose);
      // reentryShort = pullbackInDowntrend[1] and isBear and close < close[1]
      const reentryShort = i > 0 && s.pbDown[i - 1] && s.isBear[i] && lt(b.close, pClose);
      // alertcondition(reentryLong, "Alert Long") / alertcondition(reentryShort, "Alert Short")
      [reentryLong, reentryShort].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
      // plotshape(reentryLong, location.belowbar, color.green, shape.triangleup, size.small)
      if (reentryLong) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      // plotshape(reentryShort, location.abovebar, color.red, shape.triangledown, size.small)
      if (reentryShort) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
      // plot(sar, "SAR", style = plot.style_cross, color = color.gray)
      s.plot0[i] = { time: b.time, value: sar, color: color.gray };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PullbackSarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PullbackSarInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert Long', message: 'Pullback SAR: LONG signal' },
  { id: 'alert1', title: 'Alert Short', message: 'Pullback SAR: SHORT signal' },
];

export const PullbackSar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
