/**
 * Perfect Hammer Pattern
 *
 * A perfect bullish candle opens at its low (low == open, |low - open| <= 0.03), closes above the open and below the
 * high. A perfect bearish candle opens at its high, closes below the open and above the low. A buy signal needs
 * `consecutivePatterns` perfect bullish candles in a row (the current bar and the bars before it) after a red candle
 * or a doji (|close - open| <= 0.001); a short signal needs perfect bearish candles after a green candle or a doji.
 * A green "H" label below the bar marks a buy signal, a red "H" label above the bar a short signal.
 *
 * Alert conditions (`alerts` of the result): "Bullish Pattern Alert" on each buy signal and "Bearish Pattern Alert"
 * on each short signal.
 *
 * Reference: "Perfect Hammer Pattern" by girishptryambakee
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PerfectHammerPatternInputs {
  /** Number of consecutive perfect candles */
  consecutivePatterns: number;
}

export const defaultInputs: PerfectHammerPatternInputs = {
  consecutivePatterns: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'consecutivePatterns', type: 'int', title: 'Consecutive Perfect Patterns', defval: 2, min: 1, max: 10 },
];

// No plot(): the only outputs are two plotshape markers (and 2 alertconditions)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Perfect Hammer Pattern',
  shortTitle: 'PerfectHammer',
  overlay: true,
};

const TOLERANCE = 0.03;
const DOJI_TOLERANCE = 0.001;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };

interface HammerRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PerfectHammerPatternInputs>): BarStudy<HammerRun, Result> {
  const { consecutivePatterns } = { ...defaultInputs, ...inputs };
  const NA_BAR = { open: NaN, high: NaN, low: NaN, close: NaN };

  const isDoji = (b: { open: number; close: number }) => le(Math.abs(b.close - b.open), DOJI_TOLERANCE);
  const isPerfectBullish = (b: { open: number; high: number; low: number; close: number }) =>
    eq(b.low, b.open) && gt(b.high, b.close) && gt(b.close, b.open) && le(Math.abs(b.low - b.open), TOLERANCE)
    && gt(b.high, b.close);
  const isPerfectBearish = (b: { open: number; high: number; low: number; close: number }) =>
    eq(b.high, b.open) && gt(b.close, b.low) && gt(b.open, b.close) && le(Math.abs(b.high - b.open), TOLERANCE)
    && gt(b.close, b.low);

  const white = String(color.white);
  const green = String(color.green);
  const red = String(color.red);
  return {
    init() {
      const s: HammerRun = { markers: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      // x[index] before the first bar is na: every comparison with it is false
      let bullishPattern = true;
      let bearishPattern = true;
      for (let k = 0; k <= consecutivePatterns - 1; k++) {
        const b = i - k >= 0 ? bars[i - k] : NA_BAR;
        bullishPattern = bullishPattern && isPerfectBullish(b);
        bearishPattern = bearishPattern && isPerfectBearish(b);
      }
      const prior = i - consecutivePatterns >= 0 ? bars[i - consecutivePatterns] : NA_BAR;
      bullishPattern = bullishPattern && (gt(prior.open, prior.close) || isDoji(prior));
      bearishPattern = bearishPattern && (gt(prior.close, prior.open) || isDoji(prior));

      // alertcondition(bullish_pattern, ...) / alertcondition(bearish_pattern, ...)
      s.flags[0][i] = bullishPattern;
      s.flags[1][i] = bearishPattern;
      const time = bars[i].time;
      if (bullishPattern) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: green, text: 'H', textColor: white,
          size: 'tiny' });
        s.times[0].push(time as number);
      }
      if (bearishPattern) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: red, text: 'H', textColor: white,
          size: 'tiny' });
        s.times[1].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PerfectHammerPatternInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PerfectHammerPatternInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Pattern Alert', message: 'Perfect Bullish Hammers Found!' },
  { id: 'alert1', title: 'Bearish Pattern Alert', message: 'Perfect Bearish Hammers Found!' },
];

export const PerfectHammerPattern = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
