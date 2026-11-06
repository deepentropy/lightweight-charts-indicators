/**
 * Liquidity Sweep Confirmation
 *
 * Keeps the last swing high and swing low (pivots with `pivotLen` bars on each side). A high above the last swing
 * high marks a high sweep; a low below the last swing low marks a low sweep. After a high sweep, a close below the
 * 3-bar lowest low of the previous bar gives a SELL label; after a low sweep, a close above the 3-bar highest high of
 * the previous bar gives a BUY label (the sweep is then reset). A signal opens a long (BUY) or short (SELL) position
 * state; a long that saw RSI >= 70 on the previous bar and now has RSI < 70 gives a TP label (short: RSI <= 30, then
 * RSI > 30), which closes the position state.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Alert' / 'SELL Alert' on the signals, 'RSI LONG TP' /
 * 'RSI SHORT TP' on the TP labels.
 *
 * Reference: "Liquidity Sweep Confirmation" by filipiti
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquiditySweepConfirmationInputs {
  /** Pivot bars on each side of a swing */
  pivotLen: number;
  rsiLen: number;
}

export const defaultInputs: LiquiditySweepConfirmationInputs = {
  pivotLen: 3,
  rsiLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Swing Length', defval: 3, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Sweep Confirmation',
  shortTitle: 'Liquidity Sweep Confirmation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine default plotshape text colour */
const PINE_TEXT = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SweepVars {
  /** var float lastHigh = na, var float lastLow = na */
  lastHigh: number;
  lastLow: number;
  /** var bool */
  sweptHigh: boolean;
  sweptLow: boolean;
  inLong: boolean;
  inShort: boolean;
  /** rsiLongExtreme[1], rsiShortExtreme[1] (false on bar 0) */
  prevLongExtreme: boolean;
  prevShortExtreme: boolean;
  /** rejectionLow[1], rejectionHigh[1] */
  prevRejLow: number;
  prevRejHigh: number;
}

interface SweepRun extends BarRunState<SweepVars> {
  ph: PivotStep;
  pl: PivotStep;
  rejLow: WindowExtreme;
  rejHigh: WindowExtreme;
  rsi: ReturnType<typeof taStep.rsi>;
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LiquiditySweepConfirmationInputs>): BarStudy<SweepRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ph = new PivotStep(cfg.pivotLen, cfg.pivotLen, true);
      const pl = new PivotStep(cfg.pivotLen, cfg.pivotLen, false);
      const rejLow = new WindowExtreme(true, 3);
      const rejHigh = new WindowExtreme(false, 3);
      const rsi = taStep.rsi(cfg.rsiLen);
      const s: SweepRun = {
        ph, pl, rejLow, rejHigh, rsi, markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [ph, pl, rejLow, rejHigh, rsi],
        vars: {
          lastHigh: NaN, lastLow: NaN, sweptHigh: false, sweptLow: false, inLong: false, inShort: false,
          prevLongExtreme: false, prevShortExtreme: false, prevRejLow: NaN, prevRejHigh: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const rejectionLow = s.rejLow.step(b.low);
      const rejectionHigh = s.rejHigh.step(b.high);
      const rsi = s.rsi.step(b.close);
      if (!isNaN(ph)) v.lastHigh = ph;
      if (!isNaN(pl)) v.lastLow = pl;
      if (!isNaN(v.lastHigh) && gt(b.high, v.lastHigh)) v.sweptHigh = true;
      if (!isNaN(v.lastLow) && lt(b.low, v.lastLow)) v.sweptLow = true;

      const sellSignal = v.sweptHigh && i > 0 && lt(b.close, v.prevRejLow);
      const buySignal = v.sweptLow && i > 0 && gt(b.close, v.prevRejHigh);
      v.prevRejLow = rejectionLow;
      v.prevRejHigh = rejectionHigh;
      if (buySignal) v.sweptLow = false;
      if (sellSignal) v.sweptHigh = false;

      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: PINE_TEXT });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: PINE_TEXT });
      }

      if (buySignal) {
        v.inLong = true;
        v.inShort = false;
      }
      if (sellSignal) {
        v.inShort = true;
        v.inLong = false;
      }
      const rsiLongExtreme = v.inLong && ge(rsi, 70);
      const rsiShortExtreme = v.inShort && le(rsi, 30);
      const longTP = v.inLong && v.prevLongExtreme && lt(rsi, 70);
      const shortTP = v.inShort && v.prevShortExtreme && gt(rsi, 30);
      v.prevLongExtreme = rsiLongExtreme;
      v.prevShortExtreme = rsiShortExtreme;
      if (longTP) v.inLong = false;
      if (shortTP) v.inShort = false;
      const flags = [buySignal, sellSignal, longTP, shortTP];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }

      if (longTP) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.blue, text: 'TP',
          textColor: PINE_TEXT });
      }
      if (shortTP) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.orange, text: 'TP',
          textColor: PINE_TEXT });
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
export function createRun(inputs: Partial<LiquiditySweepConfirmationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LiquiditySweepConfirmationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Alert', message: 'Liquidity Sweep BUY' },
  { id: 'alert1', title: 'SELL Alert', message: 'Liquidity Sweep SELL' },
  { id: 'alert2', title: 'RSI LONG TP', message: 'RSI TP LONG' },
  { id: 'alert3', title: 'RSI SHORT TP', message: 'RSI TP SHORT' },
];

export const LiquiditySweepConfirmation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
