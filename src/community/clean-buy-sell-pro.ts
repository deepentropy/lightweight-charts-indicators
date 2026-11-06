/**
 * Clean Buy Sell Pro
 *
 * Trend from a fast and a slow EMA of the close. A buy condition is a bull trend (fast EMA > slow EMA) with the close
 * above the fast EMA; a sell condition is a bear trend with the close below the fast EMA. With the RSI confirmation,
 * the RSI must also be above 50 (buy) or below 50 (sell). A BUY / SELL label marks the first bar of each condition.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Signal' and 'SELL Signal', true on the first bar of each
 * condition (with the labels hidden too).
 *
 * Reference: "Clean Buy Sell Pro [v6]" by JohnsonForexTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CleanBuySellProInputs {
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Use the RSI confirmation */
  useRSI: boolean;
  /** RSI length */
  rsiLength: number;
  /** Show the BUY / SELL labels */
  showLabels: boolean;
}

export const defaultInputs: CleanBuySellProInputs = {
  fastLength: 20,
  slowLength: 50,
  useRSI: true,
  rsiLength: 14,
  showLabels: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA', defval: 20, min: 2, group: 'Trend Settings' },
  { id: 'slowLength', type: 'int', title: 'Slow EMA', defval: 50, min: 5, group: 'Trend Settings' },
  { id: 'useRSI', type: 'bool', title: 'Use RSI Confirmation', defval: true, group: 'Signal Settings' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 2, group: 'Signal Settings' },
  { id: 'showLabels', type: 'bool', title: 'Show BUY / SELL', defval: true, group: 'Signal Settings' },
];

// No plot(): the outputs are plotshape labels
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Clean Buy Sell Pro [v6]',
  shortTitle: 'CBSP v6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CbspVars {
  /** buyCondition[1] / sellCondition[1] */
  buyPrev: boolean;
  sellPrev: boolean;
}

interface CbspRun extends BarRunState<CbspVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CleanBuySellProInputs>): BarStudy<CbspRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: CbspRun = {
        fast, slow, rsi, markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, rsi], vars: { buyPrev: false, sellPrev: false }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      const c = b.close;
      const fastEMA = s.fast.step(c);
      const slowEMA = s.slow.step(c);
      const rsiValue = s.rsi.step(c);
      const bullTrend = gt(fastEMA, slowEMA);
      const bearTrend = lt(fastEMA, slowEMA);
      const bullMomentum = gt(rsiValue, 50);
      const bearMomentum = lt(rsiValue, 50);

      let buyCondition = bullTrend && gt(c, fastEMA);
      let sellCondition = bearTrend && lt(c, fastEMA);
      if (cfg.useRSI) {
        buyCondition = buyCondition && bullMomentum;
        sellCondition = sellCondition && bearMomentum;
      }

      // buySignal = buyCondition and not buyCondition[1] (a bool history before bar 0 is false)
      const buySignal = buyCondition && !v.buyPrev;
      const sellSignal = sellCondition && !v.sellPrev;
      v.buyPrev = buyCondition;
      v.sellPrev = sellCondition;
      s.flags[0]![i] = buySignal;
      s.flags[1]![i] = sellSignal;
      if (buySignal) s.times[0]!.push(b.time as number);
      if (sellSignal) s.times[1]!.push(b.time as number);

      // plotshape(showLabels and buySignal, "BUY", shape.labelup, location.belowbar, color.lime, text = "BUY",
      //   textcolor = color.black, size = size.tiny)
      if (cfg.showLabels && buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: color.black, size: 'tiny' });
      }
      // plotshape(showLabels and sellSignal, "SELL", shape.labeldown, location.abovebar, color.red, text = "SELL",
      //   textcolor = color.white, size = size.tiny)
      if (cfg.showLabels && sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(buySignal, "BUY Signal") / alertcondition(sellSignal, "SELL Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CleanBuySellProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CleanBuySellProInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Signal', message: 'Clean Buy Sell Pro: BUY signal detected.' },
  { id: 'alert1', title: 'SELL Signal', message: 'Clean Buy Sell Pro: SELL signal detected.' },
];

export const CleanBuySellPro = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
