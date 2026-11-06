/**
 * OBV + Custom MA Strategy
 *
 * On Balance Volume computed by hand: it starts at 0 on the first bar, adds the volume when the close is above the
 * previous close, subtracts it when the close is below, and stays the same otherwise. A short-term and a long-term
 * moving average (SMA, EMA or WMA) of the OBV are plotted with it.
 *
 * Alerts (alertcondition, `alerts` of the result): the short-term MA crossing over / under the long-term MA and the
 * OBV crossing over / under the short-term MA.
 *
 * Reference: "OBV + Custom MA Strategy" by Rafiki-is-Trading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { alertStates, crossedOver, crossedUnder, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal (MA Crossover)', message: 'Bullish signal: Short-term MA crosses above long-term MA' },
  { id: 'alert1', title: 'Bearish Signal (MA Crossover)', message: 'Bearish signal: Short-term MA crosses below long-term MA' },
  { id: 'alert2', title: 'Bullish Signal (OBV Crossover)', message: 'Bullish signal: OBV crosses above short-term MA' },
  { id: 'alert3', title: 'Bearish Signal (OBV Crossover)', message: 'Bearish signal: OBV crosses below short-term MA' },
];

export type ObvCustomMaType = 'SMA' | 'EMA' | 'WMA';

export interface ObvCustomMaStrategyInputs {
  /** Moving average type */
  maType: ObvCustomMaType;
  /** Short-term MA length */
  maLength1: number;
  /** Long-term MA length */
  maLength2: number;
}

export const defaultInputs: ObvCustomMaStrategyInputs = {
  maType: 'EMA',
  maLength1: 20,
  maLength2: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA'] },
  { id: 'maLength1', type: 'int', title: 'Short-term MA Length', defval: 20, min: 1 },
  { id: 'maLength2', type: 'int', title: 'Long-term MA Length', defval: 100, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Short-term MA', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Long-term MA', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'OBV + Custom MA Strategy',
  shortTitle: 'OBV + Custom MA Strategy',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface ObvVars {
  /** var float obv */
  obv: number;
}

interface ObvRun extends BarRunState<ObvVars> {
  maShort: Ma;
  maLong: Ma;
  obvArr: number[];
  shortArr: number[];
  longArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<ObvCustomMaStrategyInputs>): BarStudy<ObvRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // f_ma(src, length, ma_type): ma_type is an input, so the same branch runs on every bar
  const ma = (len: number): Ma => {
    switch (cfg.maType) {
      case 'SMA': return new WindowSma(len);
      case 'EMA': return taStep.ema(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      default: return { step: () => NaN, commit: () => {} };
    }
  };
  return {
    init() {
      const maShort = ma(cfg.maLength1);
      const maLong = ma(cfg.maLength2);
      const s: ObvRun = {
        maShort, maLong, obvArr: [], shortArr: [], longArr: [], plot0: [], plot1: [], plot2: [],
        steps: [maShort, maLong], vars: { obv: NaN }, lists: [], series: [],
      };
      s.series = [s.obvArr, s.shortArr, s.longArr, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // var float obv = na; if na(obv): obv := 0, else +volume / -volume / unchanged
      let v = s.vars.obv;
      if (isNaN(v)) v = 0;
      else if (i > 0 && gt(b.close, bars[i - 1].close)) v = v + (b.volume ?? NaN);
      else if (i > 0 && lt(b.close, bars[i - 1].close)) v = v - (b.volume ?? NaN);
      s.vars.obv = v;
      s.obvArr[i] = v;
      const short = s.maShort.step(v) ?? NaN;
      const long = s.maLong.step(v) ?? NaN;
      s.shortArr[i] = short;
      s.longArr[i] = long;
      const time = b.time;
      s.plot0[i] = { time, value: v, color: color.blue };
      s.plot1[i] = { time, value: short, color: color.red };
      s.plot2[i] = { time, value: long, color: color.green };
    },
    result(s, bars) {
      const { obvArr: obv, shortArr: maShort, longArr: maLong } = s;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        alerts: alertStates(alertConditions, bars, [
          crossedOver(maShort, maLong), crossedUnder(maShort, maLong), crossedOver(obv, maShort), crossedUnder(obv, maShort),
        ]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ObvCustomMaStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ObvCustomMaStrategyInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ObvCustomMaStrategy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
