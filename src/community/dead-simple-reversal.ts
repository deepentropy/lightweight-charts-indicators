/**
 * Dead Simple Reversal
 *
 * Buy: the prior bar is bearish, the current bar is bullish and closes above the prior open, and one of the last 4
 * long-term lows (lowest low of the long period, 1 to 4 bars back) is above the near-term low (lowest low of the near
 * period). Sell: the mirror rule with highs. A buy draws a triangle below the bar, a sell a triangle above the bar.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of each signal.
 *
 * Reference: "Dead Simple Reversal" by B3AR_Trades (converted from "p2f - Dead Simple Reversal" by paidtofade;
 * original concept "Dead Simple Reversal Points" by BenTen)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DeadSimpleReversalInputs {
  /** Near Term Period */
  nearTerm: number;
  /** Long Term Period */
  longTerm: number;
  /** Up Color */
  upColor: string;
  /** Down Color */
  downColor: string;
  /** Opacity (0-100) */
  opacity: number;
}

export const defaultInputs: DeadSimpleReversalInputs = {
  nearTerm: 3,
  longTerm: 50,
  upColor: '#00BCD4',
  downColor: '#00BCD4',
  opacity: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'nearTerm', type: 'int', title: 'Near Term Period', defval: 3, min: 1 },
  { id: 'longTerm', type: 'int', title: 'Long Term Period', defval: 50, min: 1 },
  { id: 'upColor', type: 'color', title: 'Up Color', defval: '#00BCD4' },
  { id: 'downColor', type: 'color', title: 'Down Color', defval: '#00BCD4' },
  { id: 'opacity', type: 'int', title: 'Opacity', defval: 100, min: 0, max: 100 },
];

// No plot(): the outputs are plotshape triangles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Dead Simple Reversal',
  shortTitle: 'Dead Simple Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface DsrRun extends BarRunState<Record<string, never>> {
  nearHighStep: WindowExtreme;
  nearLowStep: WindowExtreme;
  longHighStep: WindowExtreme;
  longLowStep: WindowExtreme;
  longHigh: number[];
  longLow: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DeadSimpleReversalInputs>): BarStudy<DsrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(cfg.upColor, 100 - cfg.opacity));
  const sellColor = String(color.new(cfg.downColor, 100 - cfg.opacity));
  return {
    init() {
      const s: DsrRun = {
        nearHighStep: new WindowExtreme(false, cfg.nearTerm), nearLowStep: new WindowExtreme(true, cfg.nearTerm),
        longHighStep: new WindowExtreme(false, cfg.longTerm), longLowStep: new WindowExtreme(true, cfg.longTerm),
        longHigh: [], longLow: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.nearHighStep, s.nearLowStep, s.longHighStep, s.longLowStep];
      s.lists = [s.markers, ...s.times];
      s.series = [s.longHigh, s.longLow, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // atr = ta.rma(ta.tr(true), 100): computed in the Pine script but used by no output, so not ported
      const nearHigh = s.nearHighStep.step(b.high);
      const nearLow = s.nearLowStep.step(b.low);
      s.longHigh[i] = s.longHighStep.step(b.high);
      s.longLow[i] = s.longLowStep.step(b.low);
      const { longHigh, longLow } = s;
      const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);

      const p = i > 0 ? bars[i - 1] : undefined;
      const close1 = p ? p.close : NaN;
      const open1 = p ? p.open : NaN;

      // Buy conditions
      const c1 = lt(close1, open1) && gt(b.close, b.open);
      const c2 = gt(b.close, open1);
      const c3 = gt(at(longLow, i - 1), nearLow) || gt(at(longLow, i - 2), nearLow)
        || gt(at(longLow, i - 3), nearLow) || gt(at(longLow, i - 4), nearLow);
      const buy = c1 && c2 && c3;

      // Sell conditions
      const c4 = gt(close1, open1) && lt(b.close, b.open);
      const c5 = lt(b.close, open1);
      const c6 = lt(at(longHigh, i - 1), nearHigh) || lt(at(longHigh, i - 2), nearHigh)
        || lt(at(longHigh, i - 3), nearHigh) || lt(at(longHigh, i - 4), nearHigh);
      const sell = c4 && c5 && c6;
      // alertcondition(buy, "Buy Signal") / alertcondition(sell, "Sell Signal")
      [buy, sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });

      // plotshape(buy ? low : na, "Buy Signal", location.belowbar, shape.triangleup, size.small): a value draws it
      if (buy) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: buyColor, size: 'small' });
      }
      // plotshape(sell ? high : na, "Sell Signal", location.abovebar, shape.triangledown, size.small)
      if (sell) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: sellColor, size: 'small' });
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
export function createRun(inputs: Partial<DeadSimpleReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeadSimpleReversalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Dead Simple Reversal — Buy' },
  { id: 'alert1', title: 'Sell Signal', message: 'Dead Simple Reversal — Sell' },
];

export const DeadSimpleReversal = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
