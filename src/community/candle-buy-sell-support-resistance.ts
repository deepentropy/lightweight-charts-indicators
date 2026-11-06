/**
 * Candle BUY SELL + Support Resistance [v6]
 *
 * Support is the last pivot low and resistance the last pivot high (pivot length bars on each side), drawn as
 * step lines. BUY labels below the bar on a bullish engulfing candle or a hammer (lower wick at least 2 bodies,
 * upper wick at most 1 body); SELL labels above the bar on a bearish engulfing candle or a shooting star (upper
 * wick at least 2 bodies, lower wick at most 1 body).
 * Alerts (alertcondition, `alerts` of the result): 'Candle BUY' and 'Candle SELL', true on the bars of each signal
 * (also when the labels are hidden).
 *
 * Reference: "Candle BUY SELL + Support Resistance [v6]" by JohnsonForexTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JohnsonForexTrader
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CandleBuySellSupportResistanceInputs {
  /** Pivot length (left and right bars) */
  pivotLength: number;
  showSupport: boolean;
  showResistance: boolean;
  /** Show the BUY / SELL labels */
  showSignals: boolean;
}

export const defaultInputs: CandleBuySellSupportResistanceInputs = {
  pivotLength: 5,
  showSupport: true,
  showResistance: true,
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 5, min: 2, group: 'Support & Resistance' },
  { id: 'showSupport', type: 'bool', title: 'Show Support', defval: true, group: 'Support & Resistance' },
  { id: 'showResistance', type: 'bool', title: 'Show Resistance', defval: true, group: 'Support & Resistance' },
  { id: 'showSignals', type: 'bool', title: 'Show BUY / SELL', defval: true, group: 'Candle Signals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Support', color: color.green, lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Resistance', color: color.red, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Candle BUY SELL + Support Resistance [v6]',
  shortTitle: 'Candle S/R',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CandleVars {
  /** var float support = na, var float resistance = na */
  support: number;
  resistance: number;
}

interface CandleRun extends BarRunState<CandleVars> {
  pl: PivotStep;
  ph: PivotStep;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CandleBuySellSupportResistanceInputs>): BarStudy<CandleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.pivotLength;
  return {
    init() {
      const s: CandleRun = {
        pl: new PivotStep(len, len, false), ph: new PivotStep(len, len, true), plot0: [], plot1: [], markers: [],
        flags: [[], []], times: [[], []], steps: [], vars: { support: NaN, resistance: NaN }, lists: [], series: [],
      };
      s.steps = [s.pl, s.ph];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const pivotLow = s.pl.step(i, b.low);
      const pivotHigh = s.ph.step(i, b.high);
      const bullish = gt(b.close, b.open);
      const bearish = lt(b.close, b.open);
      const body = Math.abs(b.close - b.open);
      const candleRange = b.high - b.low;
      const upperWick = b.high - Math.max(b.open, b.close);
      const lowerWick = Math.min(b.open, b.close) - b.low;
      const p = i > 0 ? bars[i - 1] : null;

      // bearish[1] / bullish[1] are na (false) on bar 0
      const bullishEngulfing = bullish && i > 0 && lt(p!.close, p!.open) && le(b.open, p!.close) && ge(b.close, p!.open);
      const bearishEngulfing = bearish && i > 0 && gt(p!.close, p!.open) && ge(b.open, p!.close) && le(b.close, p!.open);
      const hammer = gt(candleRange, 0) && ge(lowerWick, body * 2) && le(upperWick, body);
      const shootingStar = gt(candleRange, 0) && ge(upperWick, body * 2) && le(lowerWick, body);

      if (!isNaN(pivotLow)) v.support = pivotLow;
      if (!isNaN(pivotHigh)) v.resistance = pivotHigh;

      const buySignal = bullishEngulfing || hammer;
      const sellSignal = bearishEngulfing || shootingStar;
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);

      s.plot0[i] = { time: b.time, value: cfg.showSupport ? v.support : NaN, color: color.green };
      s.plot1[i] = { time: b.time, value: cfg.showResistance ? v.resistance : NaN, color: color.red };

      // plotshape(showSignals and buySignal, "BUY", shape.labelup, location.belowbar, color.lime, text "BUY",
      //   textcolor color.black, size.tiny)
      if (cfg.showSignals && buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: color.black, size: 'tiny' });
      }
      // plotshape(showSignals and sellSignal, "SELL", shape.labeldown, location.abovebar, color.red, text "SELL",
      //   textcolor color.white, size.tiny)
      if (cfg.showSignals && sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(buySignal, "Candle BUY") / alertcondition(sellSignal, "Candle SELL")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleBuySellSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandleBuySellSupportResistanceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Candle BUY', message: 'Candle BUY signal detected.' },
  { id: 'alert1', title: 'Candle SELL', message: 'Candle SELL signal detected.' },
];

export const CandleBuySellSupportResistance = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
