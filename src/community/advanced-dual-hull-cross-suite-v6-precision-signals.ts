/**
 * Advanced Dual Hull Cross Suite v6 - Precision Signals
 *
 * Two Hull moving averages, each of a selectable variant: HMA = WMA(2 * WMA(src, len / 2) - WMA(src, len),
 * round(sqrt(len))), EHMA = the same with EMAs, THMA = WMA(3 * WMA(src, l / 3) - WMA(src, l / 2) - WMA(src, l), l)
 * with l = len / 2. Fractional lengths are truncated by the moving averages. Each line is coloured up when it rises,
 * down otherwise. BUY / SELL labels are drawn at the line of suite 2 when it crosses over / under the line of
 * suite 1. Alerts (alert() calls, `alertCalls` of the result, once per bar close): "Bullish Cross at <suite 2 line>"
 * and "Bearish Cross at <suite 2 line>" on the crosses.
 *
 * Reference: "Advanced Dual Hull Cross Suite v6 - Precision Signals" by NitMan279
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

type HullMode = 'Hma' | 'Thma' | 'Ehma';

export interface AdvancedDualHullCrossSuiteInputs {
  src1: SourceType;
  mode1: HullMode;
  len1: number;
  vis1: boolean;
  colorUp1: string;
  colorDown1: string;
  /** Line width of suite 1 (the plot width of the config stays at the default 2) */
  thick1: number;
  src2: SourceType;
  mode2: HullMode;
  len2: number;
  vis2: boolean;
  colorUp2: string;
  colorDown2: string;
  /** Line width of suite 2 (the plot width of the config stays at the default 2) */
  thick2: number;
}

export const defaultInputs: AdvancedDualHullCrossSuiteInputs = {
  src1: 'close',
  mode1: 'Hma',
  len1: 14,
  vis1: true,
  colorUp1: '#00ff00',
  colorDown1: '#ff0000',
  thick1: 2,
  src2: 'close',
  mode2: 'Thma',
  len2: 16,
  vis2: true,
  colorUp2: '#00bcd4',
  colorDown2: '#e91e63',
  thick2: 2,
};

const MODES = ['Hma', 'Thma', 'Ehma'];

export const inputConfig: InputConfig[] = [
  { id: 'src1', type: 'source', title: 'Source', defval: 'close', group: 'Suite 1 (Slow/Base)' },
  { id: 'mode1', type: 'string', title: 'Variation', defval: 'Hma', options: MODES, group: 'Suite 1 (Slow/Base)' },
  { id: 'len1', type: 'int', title: 'Length', defval: 14, group: 'Suite 1 (Slow/Base)' },
  { id: 'vis1', type: 'bool', title: 'Show Suite 1?', defval: true, group: 'Suite 1 (Slow/Base)' },
  { id: 'colorUp1', type: 'color', title: 'Color Up', defval: '#00ff00', group: 'Suite 1 (Slow/Base)' },
  { id: 'colorDown1', type: 'color', title: 'Color Down', defval: '#ff0000', group: 'Suite 1 (Slow/Base)' },
  { id: 'thick1', type: 'int', title: 'Thickness', defval: 2, min: 1, max: 5, group: 'Suite 1 (Slow/Base)' },
  { id: 'src2', type: 'source', title: 'Source', defval: 'close', group: 'Suite 2 (Fast/Cross)' },
  { id: 'mode2', type: 'string', title: 'Variation', defval: 'Thma', options: MODES, group: 'Suite 2 (Fast/Cross)' },
  { id: 'len2', type: 'int', title: 'Length', defval: 16, group: 'Suite 2 (Fast/Cross)' },
  { id: 'vis2', type: 'bool', title: 'Show Suite 2?', defval: true, group: 'Suite 2 (Fast/Cross)' },
  { id: 'colorUp2', type: 'color', title: 'Color Up', defval: '#00bcd4', group: 'Suite 2 (Fast/Cross)' },
  { id: 'colorDown2', type: 'color', title: 'Color Down', defval: '#e91e63', group: 'Suite 2 (Fast/Cross)' },
  { id: 'thick2', type: 'int', title: 'Thickness', defval: 2, min: 1, max: 5, group: 'Suite 2 (Fast/Cross)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Suite 1 Line', color: '#00ff00', lineWidth: 2 },
  { id: 'plot1', title: 'Suite 2 Line', color: '#00bcd4', lineWidth: 2 },
];

export const metadata = {
  title: 'Advanced Dual Hull Cross Suite v6 - Precision Signals',
  shortTitle: 'Advanced Dual Hull Cross Suite v6 - Precision Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Ma = { step(v: number): number; commit(): void };

/** ta.wma(src, length) with a constant length */
function wmaStep(length: number): Ma {
  const m = taStep.wma();
  return { step: (v) => m.step(v, length), commit: () => m.commit() };
}

/** One Hull line: the inner averages and the outer one, stepped bar by bar */
function hullStep(mode: string, length: number): { step(v: number): number; steps: Committable[] } {
  // Pine v6: int / int keeps the fractional quotient; ta.wma / ta.ema truncate the length
  switch (mode) {
    case 'Hma': {
      const a = wmaStep(length / 2), b = wmaStep(length), c = wmaStep(Math.round(Math.sqrt(length)));
      return { step: (v) => { const x = a.step(v); const y = b.step(v); return c.step(2 * x - y); }, steps: [a, b, c] };
    }
    case 'Ehma': {
      const a = taStep.ema(length / 2), b = taStep.ema(length), c = taStep.ema(Math.round(Math.sqrt(length)));
      return { step: (v) => { const x = a.step(v); const y = b.step(v); return c.step(2 * x - y); }, steps: [a, b, c] };
    }
    case 'Thma': {
      const l = length / 2;
      const a = wmaStep(l / 3), b = wmaStep(l / 2), c = wmaStep(l), d = wmaStep(l);
      return {
        step: (v) => { const x = a.step(v); const y = b.step(v); const z = c.step(v); return d.step(x * 3 - y - z); },
        steps: [a, b, c, d],
      };
    }
    default: return { step: () => NaN, steps: [] };
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface HullRun extends BarRunState<Record<string, never>> {
  hull1: ReturnType<typeof hullStep>;
  hull2: ReturnType<typeof hullStep>;
  buy: ReturnType<typeof taStep.crossover>;
  sell: ReturnType<typeof taStep.crossunder>;
  m1: number[];
  m2: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<AdvancedDualHullCrossSuiteInputs>): BarStudy<HullRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value1 = barSource(cfg.src1);
  const value2 = barSource(cfg.src2);
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src1) && isBarSource(cfg.src2) ? null : 'source of another study'),
    init() {
      const hull1 = hullStep(cfg.mode1, cfg.len1);
      const hull2 = hullStep(cfg.mode2, cfg.len2);
      const buy = taStep.crossover();
      const sell = taStep.crossunder();
      const s: HullRun = {
        hull1, hull2, buy, sell, m1: [], m2: [], plot0: [], plot1: [], markers: [], alertCalls: [],
        steps: [...hull1.steps, ...hull2.steps, buy, sell], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.m1, s.m2, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const h1 = s.hull1.step(value1(b));
      const h2 = s.hull2.step(value2(b));
      s.m1[i] = h1;
      s.m2[i] = h2;
      const isBuy = s.buy.step(h2, h1);
      const isSell = s.sell.step(h2, h1);
      const up1 = i > 0 && gt(h1, s.m1[i - 1]);
      const up2 = i > 0 && gt(h2, s.m2[i - 1]);
      s.plot0[i] = { time: b.time, value: cfg.vis1 ? val(h1) : NaN, color: up1 ? cfg.colorUp1 : cfg.colorDown1 };
      s.plot1[i] = { time: b.time, value: cfg.vis2 ? val(h2) : NaN, color: up2 ? cfg.colorUp2 : cfg.colorDown2 };

      // plotshape(buySignal ? mhull2 : na, "Buy", shape.labelup, location.absolute, color.green, 0, "BUY", color.white,
      // size = size.small); plotshape(sellSignal ? mhull2 : na, "Sell", shape.labeldown, ...)
      // if buySignal: alert("Bullish Cross at " + str.tostring(mhull2), alert.freq_once_per_bar_close); sell alike
      if (isBuy) s.alertCalls.push({ time: b.time, message: 'Bullish Cross at ' + str.tostring(h2), freq: 'once_per_bar_close' });
      if (isSell) s.alertCalls.push({ time: b.time, message: 'Bearish Cross at ' + str.tostring(h2), freq: 'once_per_bar_close' });
      const price = val(h2);
      if (Number.isNaN(price)) return;
      if (isBuy) {
        s.markers.push({ time: b.time, position: 'atPriceBottom', price, shape: 'labelUp', color: color.green,
          text: 'BUY', textColor: color.white, size: 'small' });
      }
      if (isSell) {
        s.markers.push({ time: b.time, position: 'atPriceTop', price, shape: 'labelDown', color: color.red,
          text: 'SELL', textColor: color.white, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdvancedDualHullCrossSuiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdvancedDualHullCrossSuiteInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdvancedDualHullCrossSuite = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
