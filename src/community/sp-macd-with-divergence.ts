/**
 * SP - MACD with Divergence
 *
 * MACD line (EMA(fast) - EMA(slow) of the source), its EMA signal line and the histogram (teal at or above 0, red
 * below). Regular divergences on MACD pivots (5 bars left / right): a bullish divergence is a MACD pivot low higher
 * than the previous one (5 to 60 bars after the previous pivot low) with a lower price low; a bearish divergence is
 * a MACD pivot high lower than the previous one with a higher price high. The divergence lines join the pivots on
 * the pivot bars (offset -5) and Bull / Bear labels mark them.
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish Divergence' and 'Regular Bearish Divergence', true
 * on the bar that confirms the divergence (5 bars after the pivot that the label marks).
 *
 * Reference: "SP - MACD with Divergence" by ca_sidnayak
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © disizsid
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SpMacdWithDivergenceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
  /** Detect regular bullish and bearish divergences on MACD */
  enableDivergence: boolean;
}

export const defaultInputs: SpMacdWithDivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
  enableDivergence: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: 'MACD Settings' },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1, group: 'MACD Settings' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, group: 'MACD Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'MACD Settings' },
  { id: 'enableDivergence', type: 'bool', title: 'Enable Divergence Detection', defval: true, group: 'Divergence Settings',
    tooltip: 'Detects regular bullish and bearish divergences on MACD' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Line', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: color.teal, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot4', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
];

export const metadata = {
  title: 'SP - MACD with Divergence',
  shortTitle: 'SP - MACD+',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SpVars {
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plMacd: readonly number[];
  plLow: readonly number[];
  phMacd: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine `and` is lazy) */
  plCalls: number;
  phCalls: number;
}

interface SpRun extends BarRunState<SpVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  pl: PivotStep;
  ph: PivotStep;
  macd: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  /** The divergence line points, slot i - lookbackRight written by bar i */
  plot3: Point[];
  plot4: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen(cond, source, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<SpMacdWithDivergenceInputs>): BarStudy<SpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const lookbackLeft = 5;
  const lookbackRight = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const bullColor = String(color.new(color.green, 0));
  const bearColor = String(color.new(color.red, 0));
  const textColor = color.white;
  const noneColor = String(color.new(color.white, 100));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const teal = String(color.new(color.teal, 0));
  const red = String(color.new(color.red, 0));
  const orange = String(color.new(color.orange, 0));

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const sig = taStep.ema(cfg.signalLength);
      const pl = new PivotStep(lookbackLeft, lookbackRight, false);
      const ph = new PivotStep(lookbackLeft, lookbackRight, true);
      const s: SpRun = {
        fast, slow, sig, pl, ph, macd: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [], plot3: [],
        plot4: [], markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, sig, ...(cfg.enableDivergence ? [pl, ph] : [])],
        vars: { plMacd: [], plLow: [], phMacd: [], phHigh: [], plCalls: NaN, phCalls: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.macd, s.plFound, s.phFound, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // MACD
      const v = value(b);
      const macd = s.fast.step(v) - s.slow.step(v);
      s.macd[i] = macd;
      const signal = s.sig.step(macd);
      const hist = macd - signal;
      s.plot0[i] = { time, value: fin(macd), color: teal };
      s.plot1[i] = { time, value: fin(signal), color: orange };
      s.plot2[i] = { time, value: fin(hist), color: ge(hist, 0) ? teal : red };

      // Divergences (the `if enableDivergence` block runs on every bar when enabled)
      const m = i - lookbackRight >= 0 ? s.macd[i - lookbackRight]! : NaN;
      let bull = false;
      let bear = false;
      s.plFound[i] = false;
      s.phFound[i] = false;
      if (cfg.enableDivergence) {
        const st = s.vars;
        const lowLbr = i - lookbackRight >= 0 ? bars[i - lookbackRight].low : NaN;
        const highLbr = i - lookbackRight >= 0 ? bars[i - lookbackRight].high : NaN;
        const prevPl = i > 0 && s.plFound[i - 1]; // plFound[1]
        const prevPh = i > 0 && s.phFound[i - 1]; // phFound[1]

        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        // Pine `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
        // (macdLBR > / < ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
        const plFound = !isNaN(s.pl.step(i, macd));
        s.plFound[i] = plFound;
        if (plFound) {
          st.plMacd = pushed(st.plMacd, m);
          st.plLow = pushed(st.plLow, lowLbr);
        }
        let macdHL = false;
        if (gt(m, second(st.plMacd))) {
          if (prevPl) st.plCalls = 0;
          else if (!isNaN(st.plCalls)) st.plCalls++;
          macdHL = rangeLower <= st.plCalls && st.plCalls <= rangeUpper;
        }
        const priceLL = lt(lowLbr, second(st.plLow));
        bull = priceLL && macdHL && plFound;

        const phFound = !isNaN(s.ph.step(i, macd));
        s.phFound[i] = phFound;
        if (phFound) {
          st.phMacd = pushed(st.phMacd, m);
          st.phHigh = pushed(st.phHigh, highLbr);
        }
        let macdLH = false;
        if (lt(m, second(st.phMacd))) {
          if (prevPh) st.phCalls = 0;
          else if (!isNaN(st.phCalls)) st.phCalls++;
          macdLH = rangeLower <= st.phCalls && st.phCalls <= rangeUpper;
        }
        const priceHH = gt(highLbr, second(st.phHigh));
        bear = priceHH && macdLH && phFound;
      }

      if (i >= lookbackRight) {
        // plot(found ? macdLBR : na, offset = -lookbackRight): the value of bar i is drawn on bar i - 5
        const backTime = bars[i - lookbackRight].time;
        s.plot3[i - lookbackRight] = { time: backTime, value: s.plFound[i] ? fin(m) : NaN, color: bull ? bullColor : noneColor };
        s.plot4[i - lookbackRight] = { time: backTime, value: s.phFound[i] ? fin(m) : NaN, color: bear ? bearColor : noneColor };
        if (Number.isFinite(m)) {
          // plotshape(bullCond ? macdLBR : na, offset = -5, " Bull ", shape.labelup, location.absolute, bullColor, white)
          if (bull) {
            s.markers.push({ time: backTime, position: 'atPriceBottom', price: m, shape: 'labelUp',
              color: bullColor, text: ' Bull ', textColor });
          }
          if (bear) {
            s.markers.push({ time: backTime, position: 'atPriceTop', price: m, shape: 'labelDown',
              color: bearColor, text: ' Bear ', textColor });
          }
        }
      }
      s.flags[0]![i] = bull;
      s.flags[1]![i] = bear;
      if (bull) s.times[0]!.push(time as number);
      if (bear) s.times[1]!.push(time as number);
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const lines = Math.max(0, n - lookbackRight);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plot2.slice(),
          plot3: s.plot3.slice(0, lines),
          plot4: s.plot4.slice(0, lines),
        },
        markers: s.markers.slice(),
        // alertcondition(bullCond, ...) / alertcondition(bearCond, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SpMacdWithDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SpMacdWithDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'MACD: Regular Bullish Divergence detected.' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'MACD: Regular Bearish Divergence detected.' },
];

export const SpMacdWithDivergence = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
