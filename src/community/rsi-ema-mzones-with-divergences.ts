/**
 * RSI + EMA + MZONES with Divergences
 *
 * RSI from RMAs of the up and down changes of the source (100 when the down RMA is 0, 0 when the up RMA is 0), an
 * EMA of the RSI (light blue when rising or flat, orange when falling), zone lines at 80 / 65 / 50 / 35 / 20 with two
 * fills, and regular / hidden divergences between RSI pivots and price (the classic pivot divergence logic: a pivot
 * of the RSI compared with the previous pivot, 5 to 60 bars after it). Pivot lines and labels are drawn on the
 * pivot bar (offset -lbR).
 * Alerts (alertcondition, `alerts` of the result): the four divergences, true on the bar that confirms the pivot
 * (lbR bars after it), whether or not their "Plot ..." option is on.
 *
 * Reference: "RSI+EMA+MZONES with Divergences" by lordoflolz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © lordoflolz
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiEmaMzonesWithDivergencesInputs {
  /** RSI period */
  len: number;
  /** RSI source */
  src: SourceType;
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
  showLabels: boolean;
  /** EMA length of the RSI */
  lenema: number;
}

export const defaultInputs: RsiEmaMzonesWithDivergencesInputs = {
  len: 14,
  src: 'close',
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
  showLabels: true,
  lenema: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
  { id: 'showLabels', type: 'bool', title: 'Show Divergence Labels', defval: true },
  { id: 'lenema', type: 'int', title: 'EMA Length', defval: 21, min: 1 },
];

const BULL = color.green;
const BEAR = color.red;
const HIDDEN_BULL = String(color.new(color.green, 80));
const HIDDEN_BEAR = String(color.new(color.red, 80));
const TEXT = color.white;
const NONE = String(color.new(color.white, 100));
const RSI_COL = '#fff59d';
const EMA_UP = '#95effb';
const EMA_DOWN = color.orange;
const ZONE_FILL_UP = String(color.new('#434651', 75));
const ZONE_FILL_DOWN = String(color.new('#613f0e', 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COL, lineWidth: 1 },
  { id: 'plot1', title: 'RSI EMA', color: EMA_UP, lineWidth: 2 },
  { id: 'plot2', title: 'Regular Bullish', color: BULL, lineWidth: 2 },
  { id: 'plot3', title: 'Hidden Bullish', color: HIDDEN_BULL, lineWidth: 2 },
  { id: 'plot4', title: 'Regular Bearish', color: BEAR, lineWidth: 2 },
  { id: 'plot5', title: 'Hidden Bearish', color: HIDDEN_BEAR, lineWidth: 2 },
];

/** hline(65 / 80 / 50 / 35 / 20) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_bull', price: 65, title: 'Bull Line', color: '#5e5b3e', linestyle: 'dashed' },
  { id: 'hline_upper', price: 80, title: 'Upper Band', color: '#5e5b3e', linestyle: 'dashed' },
  { id: 'hline_middle', price: 50, title: 'Middle Line', color: '#d1d4dc', linestyle: 'dotted' },
  { id: 'hline_bear', price: 35, title: 'Bear Line', color: '#a46b18', linestyle: 'dashed' },
  { id: 'hline_lower', price: 20, title: 'Lower Band', color: '#a46b18', linestyle: 'dashed' },
];

/** fill(band1, band0, color.new(#434651, 75)); fill(band3, band2, color.new(#613f0e, 85)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_upper', plot1: 'hline_bull', plot2: 'hline_upper', color: ZONE_FILL_UP, title: 'Hlines Background' },
  { id: 'fill_lower', plot1: 'hline_bear', plot2: 'hline_lower', color: ZONE_FILL_DOWN, title: 'Hlines Background' },
];

export const metadata = {
  title: 'RSI+EMA+MZONES with Divergences',
  shortTitle: 'RSI+EMA+Div',
  overlay: false,
};

/** Pine float comparisons: 1e-10 tolerance, na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface RsiMzVars {
  /** _inRange(found[1]): ta.barssince(found[1] == true), on every bar */
  plBars: number;
  phBars: number;
  /** ta.valuewhen(found, x[lbR], 1): the last two values of x at the found bars (older first) */
  plRsi: readonly number[];
  plLow: readonly number[];
  phRsi: readonly number[];
  phHigh: readonly number[];
}

interface RsiMzRun extends BarRunState<RsiMzVars> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  ema: ReturnType<typeof taStep.ema>;
  pl: PivotStep;
  ph: PivotStep;
  src: number[];
  rsi: number[];
  out: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plotRegBull: Point[];
  plotHidBull: Point[];
  plotRegBear: Point[];
  plotHidBear: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** The history of a ta.valuewhen with one more value (the last two kept) */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
const prev = (a: readonly number[]) => (a.length >= 2 ? a[a.length - 2]! : NaN);

function study(inputs: Partial<RsiEmaMzonesWithDivergencesInputs>): BarStudy<RsiMzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  const value = barSource(cfg.src);
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const up = taStep.rma(cfg.len);
      const down = taStep.rma(cfg.len);
      const ema = taStep.ema(cfg.lenema);
      const pl = new PivotStep(lbL, lbR, false);
      const ph = new PivotStep(lbL, lbR, true);
      const s: RsiMzRun = {
        up, down, ema, pl, ph, src: [], rsi: [], out: [], plFound: [], phFound: [], plot0: [], plot1: [],
        plotRegBull: [], plotHidBull: [], plotRegBear: [], plotHidBear: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [up, down, ema, pl, ph],
        vars: { plBars: NaN, phBars: NaN, plRsi: [], plLow: [], phRsi: [], phHigh: [] },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.src, s.rsi, s.out, s.plFound, s.phFound, s.plot0, s.plot1, s.plotRegBull, s.plotHidBull, s.plotRegBear,
        s.plotHidBear, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // up = ta.rma(math.max(ta.change(src), 0), len); down = ta.rma(-math.min(ta.change(src), 0), len)
      const src = value(b);
      s.src[i] = src;
      const c = i > 0 ? src - s.src[i - 1] : NaN;
      const up = s.up.step(isNaN(c) ? NaN : Math.max(c, 0));
      const down = s.down.step(isNaN(c) ? NaN : -Math.min(c, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      s.rsi[i] = rsi;
      const out = s.ema.step(rsi);
      s.out[i] = out;
      const plFound = !isNaN(s.pl.step(i, rsi));
      const phFound = !isNaN(s.ph.step(i, rsi));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      s.plot0[i] = { time: b.time, value: val(rsi), color: RSI_COL };
      // col = out >= out[1] ? #95effb : color.orange
      s.plot1[i] = { time: b.time, value: val(out), color: i > 0 && ge(out, s.out[i - 1]) ? EMA_UP : EMA_DOWN };

      if (i > 0 && s.plFound[i - 1]) v.plBars = 0;
      else if (!isNaN(v.plBars)) v.plBars++;
      if (i > 0 && s.phFound[i - 1]) v.phBars = 0;
      else if (!isNaN(v.phBars)) v.phBars++;
      const inRangePl = rangeLower <= v.plBars && v.plBars <= rangeUpper;
      const inRangePh = rangeLower <= v.phBars && v.phBars <= rangeUpper;

      const r = i - lbR >= 0 ? s.rsi[i - lbR] : NaN; // rsi[lbR]
      const lowR = i - lbR >= 0 ? bars[i - lbR].low : NaN;
      const highR = i - lbR >= 0 ? bars[i - lbR].high : NaN;
      if (plFound) {
        v.plRsi = pushed(v.plRsi, r);
        v.plLow = pushed(v.plLow, lowR);
      }
      if (phFound) {
        v.phRsi = pushed(v.phRsi, r);
        v.phHigh = pushed(v.phHigh, highR);
      }
      const vwPlRsi = prev(v.plRsi);
      const vwPlLow = prev(v.plLow);
      const vwPhRsi = prev(v.phRsi);
      const vwPhHigh = prev(v.phHigh);

      // bullCondAlert, hiddenBullCondAlert, bearCondAlert, hiddenBearCondAlert (without the "Plot ..." options)
      const bullCondAlert = lt(lowR, vwPlLow) && gt(r, vwPlRsi) && inRangePl && plFound;
      const hiddenBullCondAlert = gt(lowR, vwPlLow) && lt(r, vwPlRsi) && inRangePl && plFound;
      const bearCondAlert = gt(highR, vwPhHigh) && lt(r, vwPhRsi) && inRangePh && phFound;
      const hiddenBearCondAlert = lt(highR, vwPhHigh) && gt(r, vwPhRsi) && inRangePh && phFound;
      s.flags[0][i] = bullCondAlert;
      s.flags[1][i] = hiddenBullCondAlert;
      s.flags[2][i] = bearCondAlert;
      s.flags[3][i] = hiddenBearCondAlert;
      if (bullCondAlert) s.times[0].push(b.time as number);
      if (hiddenBullCondAlert) s.times[1].push(b.time as number);
      if (bearCondAlert) s.times[2].push(b.time as number);
      if (hiddenBearCondAlert) s.times[3].push(b.time as number);
      const bullCond = cfg.plotBull && bullCondAlert;
      const hiddenBullCond = cfg.plotHiddenBull && hiddenBullCondAlert;
      const bearCond = cfg.plotBear && bearCondAlert;
      const hiddenBearCond = cfg.plotHiddenBear && hiddenBearCondAlert;

      // plot(..., offset = -lbR): the value of bar i is drawn on bar i - lbR (bar i is the only writer of that slot)
      if (i - lbR < 0) return;
      const at = i - lbR;
      const t = bars[at].time;
      const plV = plFound ? r : NaN;
      const phV = phFound ? r : NaN;
      s.plotRegBull[at] = { time: t, value: plV, color: bullCond ? BULL : NONE };
      s.plotHidBull[at] = { time: t, value: plV, color: hiddenBullCond ? HIDDEN_BULL : NONE };
      s.plotRegBear[at] = { time: t, value: phV, color: bearCond ? BEAR : NONE };
      s.plotHidBear[at] = { time: t, value: phV, color: hiddenBearCond ? HIDDEN_BEAR : NONE };

      // plotshape(cond and showLabels ? rsi[lbR] : na, offset = -lbR, location.absolute, textcolor = color.white)
      if (cfg.showLabels && !isNaN(r)) {
        if (bullCond) s.markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: r, shape: 'labelUp', color: BULL, text: 'Bull', textColor: TEXT });
        if (hiddenBullCond) s.markers.push({ id: 'shape1', time: t, position: 'atPriceBottom', price: r, shape: 'labelUp', color: HIDDEN_BULL, text: 'H Bull', textColor: TEXT });
        if (bearCond) s.markers.push({ id: 'shape2', time: t, position: 'atPriceTop', price: r, shape: 'labelDown', color: BEAR, text: 'Bear', textColor: TEXT });
        if (hiddenBearCond) s.markers.push({ id: 'shape3', time: t, position: 'atPriceTop', price: r, shape: 'labelDown', color: HIDDEN_BEAR, text: 'H Bear', textColor: TEXT });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = Math.max(0, n - lbR);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plotRegBull.slice(0, shifted),
          plot3: s.plotHidBull.slice(0, shifted),
          plot4: s.plotRegBear.slice(0, shifted),
          plot5: s.plotHidBear.slice(0, shifted),
        },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        fills: fillConfig.map((f) => ({ plot1: f.plot1, plot2: f.plot2, options: { title: f.title, color: f.color } })),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiEmaMzonesWithDivergencesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiEmaMzonesWithDivergencesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence!' },
  { id: 'alert1', title: 'Hidden Bullish Divergence', message: 'Found a new Hidden Bullish Divergence!' },
  { id: 'alert2', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence!' },
  { id: 'alert3', title: 'Hidden Bearish Divergence', message: 'Found a new Hidden Bearish Divergence!' },
];

export const RsiEmaMzonesWithDivergences = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
