/**
 * Reversal
 *
 * A bar whose close is below the low of each of the previous Lookback - 1 bars becomes the active bull candle (its
 * high and low are kept); a close below the high of each of them makes the active bear candle. A close above the
 * high of the active bull candle within Confirm Within + 1 bars (its own bar counts as 1) gives a "V Up" triangle
 * below the bar, once per active candle; a close below the low of the active bear candle gives a "V Dn" triangle above
 * the bar. A close under the low of the active bull candle (above the high of the active bear candle) ends it.
 * Non-Repainting Mode tests the previous bar instead, so the signal comes one bar later.
 *
 * Alerts (alertcondition, `alerts` of the result): "Bullish Revarsal" and "Bearish Revarsal" (spelling of the
 * original), true on the bars of each signal.
 *
 * Reference: "Reversal" by HasanRifat
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HasanRifat
 */

import type { Bar, IndicatorResult, InputConfig, PlotConfig, ShapeConfig } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface ReversalInputs {
  /** Candle Lookback */
  lookback: number;
  /** Confirm Within (bars) */
  confirmation: number;
  /** Non-Repainting Mode: test the previous bar */
  nonRepaint: boolean;
}

export const defaultInputs: ReversalInputs = {
  lookback: 20,
  confirmation: 3,
  nonRepaint: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Candle Lookback', defval: 20 },
  { id: 'confirmation', type: 'int', title: 'Confirm Within', defval: 3 },
  { id: 'nonRepaint', type: 'bool', title: 'Non-Repainting Mode', defval: false },
];

export const plotConfig: PlotConfig[] = [];

const LIME = '#00E676';
const RED = '#FF5252';

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'V Up', style: 'triangleup', location: 'belowbar', color: LIME, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'V Dn', style: 'triangledown', location: 'abovebar', color: RED, size: 'small' },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Revarsal', message: 'Bullish Revarsal' },
  { id: 'alert1', title: 'Bearish Revarsal', message: 'Bearish Revarsal' },
];

export const metadata = {
  title: 'Reversal',
  shortTitle: 'Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ReversalInputs> = {},
): IndicatorResult & { markers: MarkerData[]; alerts: AlertConditionState[] } {
  const { lookback, confirmation, nonRepaint } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  let bullActive = false;
  let bullLow = 0;
  let bullHigh = 0;
  let bullSignal = false;
  let bullCount = 0;
  let bearActive = false;
  let bearLow = 0;
  let bearHigh = 0;
  let bearSignal = false;
  let bearCount = 0;
  // values of the previous bar (history references [1])
  let pBullActive = false;
  let pBullHigh = 0;
  let pBullSignal = false;
  let pBullCount = 0;
  let pBearActive = false;
  let pBearLow = 0;
  let pBearSignal = false;
  let pBearCount = 0;

  const vupFlags = new Array<boolean>(n).fill(false);
  const vdnFlags = new Array<boolean>(n).fill(false);
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    let bullCandle = 0;
    let bearCandle = 0;
    // for i = 0 to (lookback - 1): na history (before bar 0) compares false
    const last = lookback - 1;
    const step = last >= 0 ? 1 : -1;
    for (let k = 0; step > 0 ? k <= last : k >= last; k += step) {
      if (i - k < 0 || i - k >= n) continue;
      if (lt(close, bars[i - k].low)) bullCandle += 1;
      if (gt(close, bars[i - k].high)) bearCandle += 1;
    }

    if (bullCandle === lookback - 1) {
      bullActive = true;
      bullLow = bars[i].low;
      bullHigh = bars[i].high;
      bullSignal = false;
      bullCount = 0;
    }
    if (bullActive) bullCount += 1;

    if (bearCandle === lookback - 1) {
      bearActive = true;
      bearLow = bars[i].low;
      bearHigh = bars[i].high;
      bearSignal = false;
      bearCount = 0;
    }
    if (bearActive) bearCount += 1;

    if (lt(close, bullLow)) bullActive = false;
    if (gt(close, bearHigh)) bearActive = false;

    let vup = false;
    let vdn = false;
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    if (nonRepaint) {
      if (i > 0 && pBullActive && gt(prevClose, pBullHigh) && !pBullSignal && pBullCount <= confirmation + 1) {
        bullSignal = true;
        vup = true;
      }
    } else if (bullActive && gt(close, bullHigh) && !bullSignal && bullCount <= confirmation + 1) {
      bullSignal = true;
      vup = true;
    }

    if (nonRepaint) {
      if (i > 0 && pBearActive && lt(prevClose, pBearLow) && !pBearSignal && pBearCount <= confirmation + 1) {
        bearSignal = true;
        vdn = true;
      }
    } else if (bearActive && lt(close, bearLow) && !bearSignal && bearCount <= confirmation + 1) {
      bearSignal = true;
      vdn = true;
    }

    vupFlags[i] = vup;
    vdnFlags[i] = vdn;
    if (vup) markers.push({ id: 'shape0', time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: LIME, size: 'small' });
    if (vdn) markers.push({ id: 'shape1', time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small' });

    pBullActive = bullActive;
    pBullHigh = bullHigh;
    pBullSignal = bullSignal;
    pBullCount = bullCount;
    pBearActive = bearActive;
    pBearLow = bearLow;
    pBearSignal = bearSignal;
    pBearCount = bearCount;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    alerts: alertStates(alertConditions, bars, [vupFlags, vdnFlags]),
  };
}

export const Reversal = { calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, alertConditions };
