/**
 * Pure UT Bot - Signals Only
 *
 * UT Bot trailing stop: nLoss = key value * ATR. While the close stays above the stop (this bar and the previous
 * bar) the stop rises to max(stop, close - nLoss); while it stays below, the stop falls to min(stop, close + nLoss);
 * on a flip the stop restarts at close - nLoss or close + nLoss. The stop is not drawn: BUY / SELL labels mark the
 * bars where the close crosses above / below it.
 * Alerts (alertcondition, `alerts` of the result): 'UT Buy Signal' / 'UT Sell Signal' on the bars of the BUY / SELL
 * labels.
 *
 * Reference: "Pure UT Bot - Signals Only" by BhargavMeghnathi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UtBotTrendVolumeInputs {
  /** Sensitivity (ATR multiplier) */
  keyValue: number;
  /** ATR period */
  atrPeriod: number;
}

export const defaultInputs: UtBotTrendVolumeInputs = {
  keyValue: 1.0,
  atrPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'keyValue', type: 'float', title: 'Sensitivity (Lower = More Signals)', defval: 1.0 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 10 },
];

// No plot(): the outputs are plotshape labels
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Pure UT Bot - Signals Only',
  shortTitle: 'Pure UT Bot - Signals Only',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine nz(x, 0) */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface UtVars {
  /** trailingStop of the previous bar (na before bar 0) */
  prevStop: number;
}

interface UtRun extends BarRunState<UtVars> {
  atr: ReturnType<typeof taStep.atr>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<UtBotTrendVolumeInputs>): BarStudy<UtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyCol = String(color.new('#26a69a', 0));
  const sellCol = String(color.new('#ef5350', 0));
  return {
    init() {
      const atr = taStep.atr(cfg.atrPeriod);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: UtRun = {
        atr, over, under, markers: [], flags: [[], []], times: [[], []],
        steps: [atr, over, under], vars: { prevStop: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const xATR = s.atr.step(b.high, b.low, b.close) ?? NaN;
      // var float trailingStop = 0.0; trailingStop[1] before bar 0 is na (nz gives 0)
      const c = b.close;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      const nLoss = cfg.keyValue * xATR;
      const p = nz(v.prevStop);
      let ts: number;
      if (gt(c, p) && gt(c1, p)) ts = max(p, c - nLoss);
      else if (lt(c, p) && lt(c1, p)) ts = min(p, c + nLoss);
      else ts = gt(c, p) ? c - nLoss : c + nLoss;
      v.prevStop = ts;

      // ta.crossover / ta.crossunder(close, trailingStop): exact comparisons (library functions)
      const buySignal = !!s.over.step(c, ts);
      const sellSignal = !!s.under.step(c, ts);
      // plotshape(buySignal, "BUY", shape.labelup, location.belowbar, text = "BUY", textcolor = color.white, size.small)
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyCol, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      // plotshape(sellSignal, "SELL", shape.labeldown, location.abovebar, text = "SELL", textcolor = color.white, size.small)
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: sellCol, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      // alertcondition(buySignal, "UT Buy Signal") / alertcondition(sellSignal, "UT Sell Signal")
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => !!f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UtBotTrendVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<UtBotTrendVolumeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'UT Buy Signal', message: 'UT Bot BUY' },
  { id: 'alert1', title: 'UT Sell Signal', message: 'UT Bot SELL' },
];

export const UtBotTrendVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
