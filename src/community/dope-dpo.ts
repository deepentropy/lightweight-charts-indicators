/**
 * Dope DPO
 *
 * Two ribbons of detrended price oscillators: close - WMA(close, p)[barsback] for p = 5, 10, ..., 50 (barsback 3) and
 * for p = 10, 20, ..., 100 (barsback 6), averaged per ribbon and smoothed with a moving average (the type of the long
 * DPO setting is used for both lines, as in the original). The short line is drawn as columns, green when its WMA
 * smoothing is above the value `Bars back for short DPO` bars ago, else red; the long line lime / light red with
 * `Bars back for long DPO`. Regular divergences between the long line pivots and the price, and background colours
 * when the two colours flip (low confidence) or agree after a change (high confidence), in the pane and / or on the
 * price chart.
 *
 * Reference: "Dope DPO" by Sherlock_MacGyver
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type DopeDpoMaType = 'SMA' | 'EMA' | 'WMA' | 'RMA';

export interface DopeDpoInputs {
  enableSmoothing: boolean;
  smoothDpoLength: number;
  /** Bars back for the colour of the short DPO */
  checkPeriod: number;
  /** Bars back for the colour of the long DPO */
  checkPeriod2: number;
  /** Short DPO moving average type (not used by the original script) */
  maType1: DopeDpoMaType;
  /** Long DPO moving average type (smoothing of both lines) */
  maType2: DopeDpoMaType;
  showDivergence: boolean;
  lookbackRight: number;
  lookbackLeft: number;
  rangeUpper: number;
  rangeLower: number;
  bearColor: string;
  bullColor: string;
  enableBGFills: boolean;
  showPaneFills: boolean;
  showOverlayFills: boolean;
  transpFlipBG: number;
  transpSyncBG: number;
  showLowConfidenceFills: boolean;
  showHighConfidenceFills: boolean;
}

export const defaultInputs: DopeDpoInputs = {
  enableSmoothing: true,
  smoothDpoLength: 5,
  checkPeriod: 5,
  checkPeriod2: 15,
  maType1: 'WMA',
  maType2: 'WMA',
  showDivergence: true,
  lookbackRight: 5,
  lookbackLeft: 5,
  rangeUpper: 60,
  rangeLower: 5,
  bearColor: color.red,
  bullColor: color.green,
  enableBGFills: true,
  showPaneFills: true,
  showOverlayFills: false,
  transpFlipBG: 75,
  transpSyncBG: 50,
  showLowConfidenceFills: true,
  showHighConfidenceFills: true,
};

const MA_OPTIONS = ['SMA', 'EMA', 'WMA', 'RMA'];

export const inputConfig: InputConfig[] = [
  { id: 'enableSmoothing', type: 'bool', title: 'Enable smoothing', defval: true },
  { id: 'smoothDpoLength', type: 'int', title: 'Smoothing length', defval: 5 },
  { id: 'checkPeriod', type: 'int', title: 'Bars back for short DPO', defval: 5 },
  { id: 'checkPeriod2', type: 'int', title: 'Bars back for long DPO', defval: 15 },
  { id: 'maType1', type: 'string', title: 'Short DPO moving average type', defval: 'WMA', options: MA_OPTIONS },
  { id: 'maType2', type: 'string', title: 'Long DPO moving average type', defval: 'WMA', options: MA_OPTIONS },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence', defval: true },
  { id: 'lookbackRight', type: 'int', title: 'Lookback Right', defval: 5, min: 1 },
  { id: 'lookbackLeft', type: 'int', title: 'Lookback Left', defval: 5, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Range Upper', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Range Lower', defval: 5, min: 1 },
  { id: 'bearColor', type: 'color', title: 'Bearish Price/Rsi Divergence', defval: color.red },
  { id: 'bullColor', type: 'color', title: 'Bullish Price/Rsi Divergence', defval: color.green },
  { id: 'enableBGFills', type: 'bool', title: 'Enable Background Fills', defval: true },
  { id: 'showPaneFills', type: 'bool', title: 'Show in Subpane (Oscillator)', defval: true },
  { id: 'showOverlayFills', type: 'bool', title: 'Show on Price Chart (force_overlay)', defval: false },
  { id: 'transpFlipBG', type: 'int', title: 'Flip BG Transparency', defval: 75, min: 0, max: 100, step: 5 },
  { id: 'transpSyncBG', type: 'int', title: 'Sync BG Transparency', defval: 50, min: 0, max: 100, step: 5 },
  { id: 'showLowConfidenceFills', type: 'bool', title: 'Show Low-Confidence (Flip) BG', defval: true },
  { id: 'showHighConfidenceFills', type: 'bool', title: 'Show High-Confidence (Sync) BG', defval: true },
];

const LINE2_DOWN = String(color.rgb(250, 123, 123));
const NONE_COLOR = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Final DPO 1', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Final DPO 2', color: color.lime, lineWidth: 4 },
  { id: 'plot2', title: 'Bullish', color: color.green, lineWidth: 4 },
  { id: 'plot3', title: 'Bearish', color: color.red, lineWidth: 4 },
];

export const metadata = {
  title: 'Dope DPO',
  shortTitle: 'DDPO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Ma = { step(v: number): number; commit(): void };

interface DpoVars {
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plDpo: readonly number[];
  plLow: readonly number[];
  phDpo: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine `and` is lazy) */
  plCalls: number;
  phCalls: number;
}

interface DpoRun extends BarRunState<DpoVars> {
  wmas1: ReturnType<typeof taStep.wma>[];
  wmas2: ReturnType<typeof taStep.wma>[];
  smooth1: ReturnType<typeof taStep.wma>;
  smooth2: ReturnType<typeof taStep.wma>;
  ma1: Ma | null;
  ma2: Ma | null;
  pl: PivotStep;
  ph: PivotStep;
  /** WMA values per period and bar */
  mas1: number[][];
  mas2: number[][];
  smoothed: number[];
  smoothed2: number[];
  finalDpo2: number[];
  histGreen: boolean[];
  lineGreen: boolean[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  /** Divergence points of bar i (drawn on bar i - lookbackRight), from bar lookbackRight */
  plot2: Point[];
  plot3: Point[];
  bgColors: BgColorData[];
}

/** ta.valuewhen(cond, source, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (NaN before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<DopeDpoInputs>): BarStudy<DpoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // barsback = period1 / 2 + 1 = 3.5 (Pine v6 int division keeps the fraction); a fractional history index is
  // truncated: ma[3.5] reads ma[3]. barsback2 = 10 / 2 + 1 = 6.
  const barsback = Math.trunc(5 / 2 + 1);
  const barsback2 = Math.trunc(10 / 2 + 1);
  const periods1 = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const periods2 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const len = cfg.smoothDpoLength;
  // getMovingAverage(series, length, maType2): the type is an input, so the same branch runs on every bar
  const getMa = (): Ma | null => {
    switch (cfg.maType2) {
      case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'EMA': return taStep.ema(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'RMA': return taStep.rma(len);
      default: return null;
    }
  };
  const lbR = cfg.lookbackRight;
  const inRange = (bars_: number) => cfg.rangeLower <= bars_ && bars_ <= cfg.rangeUpper;
  const flipGreenC = String(color.new(color.green, cfg.transpFlipBG));
  const flipRedC = String(color.new(color.red, cfg.transpFlipBG));
  const syncGreenC = String(color.new(color.green, cfg.transpSyncBG));
  const syncRedC = String(color.new(color.red, cfg.transpSyncBG));
  const low = cfg.enableBGFills && cfg.showLowConfidenceFills;
  const high = cfg.enableBGFills && cfg.showHighConfidenceFills;
  const layerOn = [low, low, high, high];
  const layerColor = [flipGreenC, flipRedC, syncGreenC, syncRedC];
  const layerCond = [false, false, false, false];
  return {
    init() {
      const s: DpoRun = {
        wmas1: periods1.map(() => taStep.wma()), wmas2: periods2.map(() => taStep.wma()),
        smooth1: taStep.wma(), smooth2: taStep.wma(),
        ma1: cfg.enableSmoothing ? getMa() : null, ma2: cfg.enableSmoothing ? getMa() : null,
        pl: new PivotStep(cfg.lookbackLeft, lbR, false), ph: new PivotStep(cfg.lookbackLeft, lbR, true),
        mas1: periods1.map(() => []), mas2: periods2.map(() => []), smoothed: [], smoothed2: [], finalDpo2: [],
        histGreen: [], lineGreen: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [], plot3: [], bgColors: [],
        steps: [], lists: [], series: [],
        vars: { plDpo: [], plLow: [], phDpo: [], phHigh: [], plCalls: NaN, phCalls: NaN },
      };
      s.steps = [...s.wmas1, ...s.wmas2, s.smooth1, s.smooth2, ...(s.ma1 ? [s.ma1] : []), ...(s.ma2 ? [s.ma2] : []), s.pl, s.ph];
      s.lists = [s.bgColors];
      s.series = [...s.mas1, ...s.mas2, s.smoothed, s.smoothed2, s.finalDpo2, s.histGreen, s.lineGreen, s.plFound,
        s.phFound, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const c = b.close;
      const t = b.time;
      // averageDpo = (dpo1 + ... + dpo10) / 10, dpo = close - ma[barsback]
      let sum = 0;
      for (let k = 0; k < 10; k++) {
        s.mas1[k][i] = s.wmas1[k].step(c, periods1[k]);
        sum += c - (i - barsback >= 0 ? s.mas1[k][i - barsback] : NaN);
      }
      const averageDpo = sum / 10;
      let sum2 = 0;
      for (let k = 0; k < 10; k++) {
        s.mas2[k][i] = s.wmas2[k].step(c, periods2[k]);
        sum2 += c - (i - barsback2 >= 0 ? s.mas2[k][i - barsback2] : NaN);
      }
      const averageDpo2 = sum2 / 10;

      const smoothed = s.smooth1.step(averageDpo, len);
      const smoothed2 = s.smooth2.step(averageDpo2, len);
      s.smoothed[i] = smoothed;
      s.smoothed2[i] = smoothed2;
      const finalDpo = cfg.enableSmoothing ? (s.ma1 ? s.ma1.step(averageDpo) : NaN) : averageDpo;
      const finalDpo2 = cfg.enableSmoothing ? (s.ma2 ? s.ma2.step(averageDpo2) : NaN) : averageDpo2;
      s.finalDpo2[i] = finalDpo2;

      // dpoColor = smoothedAverageDpo > smoothedAverageDpo[checkPeriod] ? green : red (lime / rgb(250, 123, 123)).
      // A negative "Bars back" (a runtime error in the original: x[-n] reads no future bar) gives na here.
      const back1 = i - cfg.checkPeriod;
      const back2 = i - cfg.checkPeriod2;
      const hG = gt(smoothed, back1 >= 0 && back1 < i ? s.smoothed[back1] : back1 === i ? smoothed : NaN);
      const lG = gt(smoothed2, back2 >= 0 && back2 < i ? s.smoothed2[back2] : back2 === i ? smoothed2 : NaN);
      s.histGreen[i] = hG;
      s.lineGreen[i] = lG;
      const dpoColor = hG ? color.green : color.red;
      const dpoColor2 = lG ? color.lime : LINE2_DOWN;
      s.plot0[i] = { time: t, value: finalDpo, color: dpoColor };
      s.plot1[i] = { time: t, value: finalDpo2, color: dpoColor2 };

      // Divergence
      const plFound = !isNaN(s.pl.step(i, finalDpo2));
      const phFound = !isNaN(s.ph.step(i, finalDpo2));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const dpoLbr = i - lbR >= 0 ? s.finalDpo2[i - lbR] : NaN;
      const lowLbr = i - lbR >= 0 ? bars[i - lbR].low : NaN;
      const highLbr = i - lbR >= 0 ? bars[i - lbR].high : NaN;
      const prevPl = i > 0 && s.plFound[i - 1]; // plFound[1] (false before the first bar)
      const prevPh = i > 0 && s.phFound[i - 1];

      // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
      if (plFound) {
        v.plDpo = pushed(v.plDpo, dpoLbr);
        v.plLow = pushed(v.plLow, lowLbr);
      }
      // rsiHL = finalDpo2[lookbackRight] > ta.valuewhen(plFound, finalDpo2[lookbackRight], 1) and _inRange(plFound[1])
      // Pine `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
      // (finalDpo2[lookbackRight] > / < ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
      let rsiHL = false;
      if (gt(dpoLbr, second(v.plDpo))) {
        if (prevPl) v.plCalls = 0;
        else if (!isNaN(v.plCalls)) v.plCalls++;
        rsiHL = inRange(v.plCalls);
      }
      // priceLL = low[lookbackRight] < ta.valuewhen(plFound, low[lookbackRight], 1)
      const priceLL = lt(lowLbr, second(v.plLow));
      const bullCond = cfg.showDivergence && priceLL && rsiHL && plFound;

      if (phFound) {
        v.phDpo = pushed(v.phDpo, dpoLbr);
        v.phHigh = pushed(v.phHigh, highLbr);
      }
      // rsiLH = finalDpo2[lookbackRight] < ta.valuewhen(phFound, finalDpo2[lookbackRight], 1) and _inRange(phFound[1])
      let rsiLH = false;
      if (lt(dpoLbr, second(v.phDpo))) {
        if (prevPh) v.phCalls = 0;
        else if (!isNaN(v.phCalls)) v.phCalls++;
        rsiLH = inRange(v.phCalls);
      }
      // priceHH = high[lookbackRight] > ta.valuewhen(phFound, high[lookbackRight], 1)
      const priceHH = gt(highLbr, second(v.phHigh));
      const bearCond = cfg.showDivergence && priceHH && rsiLH && phFound;

      // plot(plFound ? finalDpo2[lookbackRight] : na, offset = -lookbackRight, color = bullCond ? bullColor : noneColor):
      // the value of bar i is drawn on bar i - lookbackRight
      if (i >= lbR) {
        const tb = bars[i - lbR].time;
        s.plot2[i] = { time: tb, value: plFound ? dpoLbr : NaN, color: bullCond ? cfg.bullColor : NONE_COLOR };
        s.plot3[i] = { time: tb, value: phFound ? dpoLbr : NaN, color: bearCond ? cfg.bearColor : NONE_COLOR };
      }

      // Background: flip (histogram changes colour against the line) and sync (both agree after a change)
      // histRed = dpoColor == color.red (= not histGreen); lineRed = dpoColor2 == rgb(250, 123, 123) (= not lineGreen);
      // x[1] of a bool is false before the first bar
      const hR = dpoColor === color.red;
      const lR = dpoColor2 === LINE2_DOWN;
      const hG1 = i > 0 && s.histGreen[i - 1];
      const lG1 = i > 0 && s.lineGreen[i - 1];
      const hR1 = i > 0 && (s.histGreen[i - 1] ? color.green : color.red) === color.red;
      const lR1 = i > 0 && (s.lineGreen[i - 1] ? color.lime : LINE2_DOWN) === LINE2_DOWN;
      layerCond[0] = hG && !lG && !hG1; // flipToGreen
      layerCond[1] = hR && !lR && !hR1; // flipToRed
      layerCond[2] = hG && lG && !(hG1 && lG1); // syncGreen
      layerCond[3] = hR && lR && !(hR1 && lR1); // syncRed
      // bgcolor(pane...) x 4 (bgcolor0..3), then bgcolor(overlay..., force_overlay = true) x 4 (bgcolor4..7)
      if (cfg.showPaneFills) {
        for (let k = 0; k < 4; k++) {
          if (layerOn[k] && layerCond[k]) s.bgColors.push({ id: `bgcolor${k}`, time: t, color: layerColor[k] });
        }
      }
      if (cfg.showOverlayFills) {
        for (let k = 0; k < 4; k++) {
          if (layerOn[k] && layerCond[k]) s.bgColors.push({ id: `bgcolor${k + 4}`, time: t, color: layerColor[k], forceOverlay: true });
        }
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(lbR), plot3: s.plot3.slice(lbR) },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DopeDpoInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DopeDpoInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DopeDpo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
