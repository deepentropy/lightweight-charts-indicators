/**
 * RedK Momentum Bars (Mo_Bars v3.0)
 *
 * Trading system of 2 short MAs and a long filter MA.
 * Displays momentum as plotcandle bars relative to filter.
 * Custom LazyLine (triple WMA) smoothing function.
 * Alerts (alertcondition, `alerts` of the result): the bar high crosses over 0, the bar low crosses under 0, and
 * either of them.
 *
 * Reference: "[dev]RedK Momentum Bars" by RedKTrader
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RedKMomentumBarsInputs {
  fastLength: number;
  fastType: string;
  slowLength: number;
  slowType: string;
  slowDelay: number;
  filterLength: number;
  filterType: string;
}

export const defaultInputs: RedKMomentumBarsInputs = {
  fastLength: 10,
  fastType: 'SMA',
  slowLength: 20,
  slowType: 'SMA',
  slowDelay: 3,
  filterLength: 50,
  filterType: 'SMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 10, min: 1 },
  { id: 'fastType', type: 'string', title: 'Fast MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 20, min: 1 },
  { id: 'slowType', type: 'string', title: 'Slow MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
  { id: 'slowDelay', type: 'int', title: 'Delay (1 = None)', defval: 3, min: 1 },
  { id: 'filterLength', type: 'int', title: 'Filter MA Length', defval: 50, min: 1 },
  { id: 'filterType', type: 'string', title: 'Filter MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'mobars', title: 'MoBars' },
];

export const metadata = {
  title: 'RedK Momentum Bars',
  shortTitle: 'MoBars',
  overlay: false,
};

interface MaStep { step(v: number): number; commit(): void }

function wmaStep(length: number): MaStep {
  const m = taStep.wma();
  return { step: (v) => m.step(v, length), commit: () => m.commit() };
}

/** lazyLine(data, length): three WMAs (the data itself for a length up to 2) */
function lazyLine(length: number): MaStep {
  if (length <= 2) return { step: (v) => v, commit: () => {} };
  const w2 = Math.round(length / 3);
  const w1 = Math.round((length - w2) / 2);
  const w3 = Math.floor((length - w2) / 2);
  const L1 = wmaStep(Math.max(1, w1));
  const L2 = wmaStep(Math.max(1, w2));
  const L3 = wmaStep(Math.max(1, w3));
  return {
    step: (v) => L3.step(L2.step(L1.step(v))),
    commit: () => { L1.commit(); L2.commit(); L3.commit(); },
  };
}

function getMA(length: number, type: string): MaStep {
  switch (type) {
    case 'SMA': return new WindowSma(length);
    case 'EMA': return taStep.ema(length);
    case 'WMA': return wmaStep(length);
    case 'HMA': return taStep.hma(length);
    default: return lazyLine(length); // RSS_WMA
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

/** The values of the bar before (na before the first bar) and the alert flags of the last bar */
interface MoVars {
  fastM: number;
  h: number;
  l: number;
  up: boolean;
  dn: boolean;
  swing: boolean;
}

interface MoRun extends BarRunState<MoVars> {
  fast: MaStep;
  slow: MaStep;
  filter: MaStep;
  relM: MaStep;
  candles: PlotCandleData[];
  times: number[][];
}

function study(inputs: Partial<RedKMomentumBarsInputs>): BarStudy<MoRun, Result> {
  const { fastLength, fastType, slowLength, slowType, slowDelay, filterLength, filterType } = { ...defaultInputs, ...inputs };
  // Prep momentum bars
  const warmup = filterLength;
  return {
    init() {
      // Calculate MAs
      const fast = getMA(fastLength, fastType);
      const slow = getMA(slowLength, slowType);
      const filter = getMA(filterLength, filterType);
      // Relative momentum = WMA of slowM with slowDelay
      const relM = wmaStep(slowDelay);
      const s: MoRun = {
        fast, slow, filter, relM, candles: [], times: [[], [], []],
        steps: [fast, slow, filter, relM], vars: { fastM: NaN, h: NaN, l: NaN, up: false, dn: false, swing: false }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const fastV = s.fast.step(b.close);
      const slowV = s.slow.step(b.close);
      const filterV = s.filter.step(b.close);
      // Momentum relative to filter
      const fastM = fastV - filterV;
      const slowM = slowV - filterV;
      const relM = s.relM.step(slowM);
      const v = s.vars;

      if (i < warmup || relM == null || isNaN(relM) || isNaN(fastM)) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        const o = relM;
        const c = fastM;
        const h = Math.max(o, c);
        const l = Math.min(o, c);

        const prevC = i > 0 ? v.fastM : c;
        const rising = c - prevC > 0;

        let barColor: string;
        let borderColor: string;
        if (c > o && rising) {
          barColor = '#11ff20'; borderColor = '#1b5e20';
        } else if (c < o && !rising) {
          barColor = '#ff1111'; borderColor = '#981919';
        } else {
          barColor = '#ffffff'; borderColor = '#9598a1';
        }

        s.candles[i] = {
          time,
          open: o, high: h, low: l, close: c,
          color: barColor, borderColor, wickColor: barColor,
        };
      }

      // Alert_up = ta.crossover(h, 0), Alert_dn = ta.crossunder(l, 0), Alert_swing = Alert_up or Alert_dn
      // (h = math.max(o, c), l = math.min(o, c): na when o or c is na)
      const hV = isNaN(fastM) || isNaN(relM) ? NaN : Math.max(relM, fastM);
      const lV = isNaN(fastM) || isNaN(relM) ? NaN : Math.min(relM, fastM);
      const ph = v.h;
      const pl = v.l;
      v.fastM = fastM;
      v.h = hV;
      v.l = lV;
      const up = hV > 0 && ph <= 0;
      const dn = lV < 0 && pl >= 0;
      const swing = up || dn;
      v.up = up;
      v.dn = dn;
      v.swing = swing;
      if (up) s.times[0].push(time);
      if (dn) s.times[1].push(time);
      if (swing) s.times[2].push(time);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { mobars: s.candles.slice() },
        hlines: [
          { value: 0, options: { color: '#2962FF', linestyle: 'solid', title: 'Zero Line' } },
        ],
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.vars.up, n > 0 && s.vars.dn, n > 0 && s.vars.swing]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RedKMomentumBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RedKMomentumBarsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '.   MoBars Crossing 0 Up', message: 'MoBars Up - Bullish Mode Detected!' },
  { id: 'alert1', title: '..  MoBars Crossing 0 Down', message: 'MoBars Down - Bearish Mode Detected!' },
  { id: 'alert2', title: '... MoBars Crossing 0', message: 'Mobars Swing - Possible Reversal Detected!' },
];

export const RedKMomentumBars = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, alertConditions };
