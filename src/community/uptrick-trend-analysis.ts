/**
 * Uptrick: Trend Analysis
 *
 * MACD (EMA(fast) - EMA(slow)) with an EMA signal line; the MACD line is cyan above the signal and purple below, with
 * a wide circle "shadow" plot. Regular divergences: a MACD pivot low (5 / 5 bars) with a higher MACD value but a
 * lower price low than the previous pivot low, 5 to 60 bars after it, is bullish; the mirror case with pivot highs is
 * bearish. Pivots are drawn 5 bars back with Bull / Bear labels in the pane and on the price bars. Bars are coloured
 * by the most recent divergence, fading out over 1000 bars. Levels at -1, 1 and 0.
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish Divergence' / 'Regular Bearish Divergence' on the
 * bar where the divergence is found (5 bars after its pivot).
 *
 * Reference: "Uptrick: Trend Analysis" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uptrick
 */

import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { barTime } from '../bar-time';

export interface UptrickTrendAnalysisInputs {
  /** Fast EMA period of the MACD */
  fastInput: number;
  /** Slow EMA period of the MACD */
  slowInput: number;
  /** EMA period of the signal line */
  signalInput: number;
  /** Not used by the Pine script */
  emaPeriod: number;
  /** Not used by the Pine script (MACD slope, not plotted) */
  slopeLookback: number;
  /** Line width of the MACD and signal lines (the plot widths stay at the default 2 / 4) */
  lineWidth: number;
  /** Transparency of the MACD shadow colours */
  shadowTransparency: number;
  /** Detect the regular divergences */
  calculateDivergence: boolean;
}

export const defaultInputs: UptrickTrendAnalysisInputs = {
  fastInput: 12,
  slowInput: 26,
  signalInput: 9,
  emaPeriod: 20,
  slopeLookback: 5,
  lineWidth: 2,
  shadowTransparency: 80,
  calculateDivergence: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastInput', type: 'int', title: 'Fast EMA Period', defval: 12, min: 1 },
  { id: 'slowInput', type: 'int', title: 'Slow EMA Period', defval: 26, min: 1 },
  { id: 'signalInput', type: 'int', title: 'Signal Line Period', defval: 9, min: 1 },
  { id: 'emaPeriod', type: 'int', title: 'EMA Period for Trend', defval: 20, min: 1 },
  { id: 'slopeLookback', type: 'int', title: 'Slope Lookback Period', defval: 5, min: 1 },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 5 },
  { id: 'shadowTransparency', type: 'int', title: 'Shadow Transparency (%)', defval: 80, min: 0, max: 100 },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: true },
];

const BULLISH = '#5cf3da';
const BEARISH = '#b72cc7';
const SHADOW_BULL = color.rgb(90, 242, 217);
const SHADOW_BEAR = color.rgb(188, 44, 203);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Regular Bullish', color: BULLISH, lineWidth: 2 },
  { id: 'plot1', title: 'Regular Bearish', color: BEARISH, lineWidth: 2 },
  { id: 'plot2', title: 'MACD Line', color: BULLISH, lineWidth: 2 },
  { id: 'plot3', title: 'Signal Line', color: color.orange, lineWidth: 2 },
  { id: 'plot4', title: 'MACD Shadows', color: String(color.new(SHADOW_BULL, 80)), lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Uptrick: Trend Analysis',
  shortTitle: 'Uptrick: Trend Analysis',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface UptrickVars {
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plMacd: readonly number[];
  plLow: readonly number[];
  phMacd: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** ta.barssince(bullCond) / ta.barssince(bearCond) */
  sinceBull: number;
  sinceBear: number;
}

interface UptrickRun extends BarRunState<UptrickVars> {
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
  plot3: Point[];
  plot4: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<UptrickTrendAnalysisInputs>): BarStudy<UptrickRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lookbackRight = 5;
  const lookbackLeft = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const fadeSteps = 1000;
  const shadowBull = String(color.new(SHADOW_BULL, cfg.shadowTransparency));
  const shadowBear = String(color.new(SHADOW_BEAR, cfg.shadowTransparency));
  return {
    init() {
      const s: UptrickRun = {
        fast: taStep.ema(cfg.fastInput), slow: taStep.ema(cfg.slowInput), sig: taStep.ema(cfg.signalInput),
        pl: new PivotStep(lookbackLeft, lookbackRight, false), ph: new PivotStep(lookbackLeft, lookbackRight, true),
        macd: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], markers: [],
        barColors: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { plMacd: [], plLow: [], phMacd: [], phHigh: [], plCalls: NaN, phCalls: NaN, sinceBull: NaN, sinceBear: NaN },
        lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.sig, ...(cfg.calculateDivergence ? [s.pl, s.ph] : [])];
      // plot0 / plot1 have one point per bar from bar lookbackRight on (drawn lookbackRight bars back)
      s.lists = [s.plot0, s.plot1, s.markers, s.barColors, ...s.times];
      s.series = [s.macd, s.plFound, s.phFound, s.plot2, s.plot3, s.plot4, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const fastMA = s.fast.step(b.close);
      const slowMA = s.slow.step(b.close);
      const macd = fastMA - slowMA;
      s.macd[i] = macd;
      const signal = s.sig.step(macd);
      const m = i - lookbackRight >= 0 ? s.macd[i - lookbackRight] : NaN;

      // Divergences (the `if calculateDivergence` block runs on every bar or on none)
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.calculateDivergence) {
        const lowLbr = i - lookbackRight >= 0 ? bars[i - lookbackRight].low : NaN;
        const highLbr = i - lookbackRight >= 0 ? bars[i - lookbackRight].high : NaN;

        // Regular bullish
        plFound = !isNaN(s.pl.step(i, macd));
        if (plFound) {
          v.plMacd = pushed(v.plMacd, m);
          v.plLow = pushed(v.plLow, lowLbr);
        }
        let macdHL = false;
        // Pine `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
        // (macdLBR > ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
        if (gt(m, second(v.plMacd))) {
          // _inRange(plFound[1]): ta.barssince(plFound[1])
          if (i > 0 && s.plFound[i - 1]) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          macdHL = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const priceLL = lt(lowLbr, second(v.plLow));
        bullCond = priceLL && macdHL && plFound;

        // Regular bearish
        phFound = !isNaN(s.ph.step(i, macd));
        if (phFound) {
          v.phMacd = pushed(v.phMacd, m);
          v.phHigh = pushed(v.phHigh, highLbr);
        }
        let macdLH = false;
        if (lt(m, second(v.phMacd))) {
          if (i > 0 && s.phFound[i - 1]) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          macdLH = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        const priceHH = gt(highLbr, second(v.phHigh));
        bearCond = priceHH && macdLH && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      if (i - lookbackRight >= 0) {
        // plot(plFound ? macdLBR : na, offset = -lookbackRight, color = bullCond ? bullish_color : na)
        const tb = barTime(bars, i - lookbackRight);
        s.plot0.push({ time: tb, value: plFound ? m : NaN, color: bullCond ? BULLISH : 'transparent' });
        s.plot1.push({ time: tb, value: phFound ? m : NaN, color: bearCond ? BEARISH : 'transparent' });
        if (!isNaN(m)) {
          // plotshape(bullCond ? macdLBR : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, ...)
          if (bullCond) {
            s.markers.push({ time: tb, position: 'atPriceBottom', price: m, shape: 'labelUp', color: BULLISH, text: ' Bull ', textColor: color.white });
            s.markers.push({ time: tb, position: 'belowBar', shape: 'labelUp', color: BULLISH, text: ' Bull ', textColor: color.white, forceOverlay: true });
          }
          if (bearCond) {
            s.markers.push({ time: tb, position: 'atPriceTop', price: m, shape: 'labelDown', color: BEARISH, text: ' Bear ', textColor: color.white });
            s.markers.push({ time: tb, position: 'aboveBar', shape: 'labelDown', color: BEARISH, text: ' Bear ', textColor: color.white, forceOverlay: true });
          }
        }
      }

      const up = gt(macd, signal);
      s.plot2[i] = { time: t, value: macd, color: up ? BULLISH : BEARISH };
      s.plot3[i] = { time: t, value: signal, color: color.orange };
      s.plot4[i] = { time: t, value: macd, color: up ? shadowBull : shadowBear };

      // Bar colour of the most recent divergence, fading over fade_steps bars
      const sinceBull = bullCond ? 0 : isNaN(v.sinceBull) ? NaN : v.sinceBull + 1;
      const sinceBear = bearCond ? 0 : isNaN(v.sinceBear) ? NaN : v.sinceBear + 1;
      v.sinceBull = sinceBull;
      v.sinceBear = sinceBear;
      let c: string | null = null;
      if (!isNaN(sinceBull) && (isNaN(sinceBear) || sinceBull < sinceBear) && sinceBull < fadeSteps) {
        const intensity = (fadeSteps - sinceBull) / fadeSteps;
        c = String(color.new(BULLISH, 100 - Math.trunc(intensity * 100)));
      } else if (!isNaN(sinceBear) && (isNaN(sinceBull) || sinceBear < sinceBull) && sinceBear < fadeSteps) {
        const intensity = (fadeSteps - sinceBear) / fadeSteps;
        c = String(color.new(BEARISH, 100 - Math.trunc(intensity * 100)));
      }
      if (c !== null) s.barColors.push({ time: t, color: c });

      // alertcondition(bullCond) / alertcondition(bearCond)
      s.flags[0][i] = bullCond;
      s.flags[1][i] = bearCond;
      if (bullCond) s.times[0].push(t);
      if (bearCond) s.times[1].push(t);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        hlines: [
          { value: -1, options: { title: 'Oversold', color: BEARISH, linestyle: 'solid', linewidth: 1 } },
          { value: 1, options: { title: 'Overbought', color: BULLISH, linestyle: 'solid', linewidth: 1 } },
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dotted', linewidth: 1 } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UptrickTrendAnalysisInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UptrickTrendAnalysisInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'Regular Bullish Divergence',
    message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.',
  },
  {
    id: 'alert1', title: 'Regular Bearish Divergence',
    message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.',
  },
];

export const UptrickTrendAnalysis = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
