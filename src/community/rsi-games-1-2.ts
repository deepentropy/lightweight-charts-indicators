/**
 * RSI Games 1.2
 *
 * RSI (RMA of the up / down changes) with a smoothing moving average (SMA, SMA + Bollinger Bands, EMA, RMA, WMA or
 * VWMA). The RSI line is green above its MA, red below (fuchsia without MA); a fill between the RSI and its MA takes
 * the same colours. With "SMA + Bollinger Bands" the bands are drawn with a fill, and arrows mark the RSI crossing
 * back above the lower band (buy, pane bottom) or below the upper band (sell, pane top). The background is green
 * below 30 and red above 70. Pivot divergences (5 / 5 bars) between the RSI and the price give regular and
 * "hidden" bullish / bearish labels, drawn on the pivot bar.
 * Alerts (alertcondition, `alerts` of the result): the regular and hidden bullish / bearish divergences, true on the
 * bar that confirms the pivot (5 bars after it).
 *
 * Reference: "RSI Games 1.2" by petejfjohnson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © petejfjohnson
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface RsiGames12Inputs {
  rsiLength: number;
  rsiSource: SourceType;
  calculateDivergence: boolean;
  /** Smoothing type */
  maType: MaType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: RsiGames12Inputs = {
  rsiLength: 14,
  rsiSource: 'close',
  calculateDivergence: true,
  maType: 'SMA + Bollinger Bands',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'Source', defval: 'close' },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: true },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA + Bollinger Bands',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.green, lineWidth: 1 },
  // display = enableMA ? display.all : display.none (result.visibility.enableMA)
  { id: 'plot1', title: 'RSI-based MA', color: color.green, lineWidth: 1, visible: 'enableMA' },
  // display = isBB ? display.all : display.none (result.visibility.isBB)
  { id: 'plot2', title: 'Upper Bollinger Band', color: color.red, lineWidth: 1, visible: 'isBB' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: 'rgb(41, 230, 20)', lineWidth: 1, visible: 'isBB' },
  { id: 'plot4', title: 'RSI MA for Fill (Hidden)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Regular Bullish', color: color.green, lineWidth: 2 },
  { id: 'plot6', title: 'Regular Bearish', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Games 1.2',
  shortTitle: 'RSI Games 1.2',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; visibility: Record<string, boolean> }
  & { alerts: AlertConditionState[] };

interface RsiGamesVars {
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plRsi: readonly number[];
  plLow: readonly number[];
  phRsi: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
}

interface RsiGamesRun extends BarRunState<RsiGamesVars> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  ma: { step(v: number, volume: number): number; commit(): void } | null;
  dev: ReturnType<typeof taStep.stdev> | null;
  pl: PivotStep;
  ph: PivotStep;
  srcArr: number[];
  rsi: number[];
  bbUpper: number[];
  bbLower: number[];
  plFound: boolean[];
  phFound: boolean[];
  plots: Point[][];
  /** plot5 / plot6 (offset = -lookbackRight): slot i - 5 written by bar i (outside `series`: n - 5 points) */
  bullLine: Point[];
  bearLine: Point[];
  maFill: string[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<RsiGames12Inputs>): BarStudy<RsiGamesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);
  // Smoothing MA and Bollinger Bands
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  // Divergence
  const lbR = 5;
  const lbL = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  // Colours
  const fillGreen = String(color.new(color.green, 80));
  const fillRed = String(color.new(color.red, 80));
  const bbFill = String(color.new(color.white, 90));
  const noneColor = String(color.new(color.white, 100));
  const bgGreen = String(color.new(color.green, 90));
  const bgRed = String(color.new(color.red, 90));
  const maStep = (): RsiGamesRun['ma'] => {
    if (!enableMA) return null;
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(cfg.maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const up = taStep.rma(cfg.rsiLength);
      const down = taStep.rma(cfg.rsiLength);
      const ma = maStep();
      const dev = isBB ? taStep.stdev() : null;
      const pl = new PivotStep(lbL, lbR, false);
      const ph = new PivotStep(lbL, lbR, true);
      const s: RsiGamesRun = {
        up, down, ma, dev, pl, ph, srcArr: [], rsi: [], bbUpper: [], bbLower: [], plFound: [], phFound: [],
        plots: Array.from({ length: 5 }, () => []), bullLine: [], bearLine: [], maFill: [], markers: [], bgColors: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [up, down, ...(ma ? [ma] : []), ...(dev ? [dev] : []), ...(cfg.calculateDivergence ? [pl, ph] : [])],
        vars: { plRsi: [], plLow: [], phRsi: [], phHigh: [], plCalls: NaN, phCalls: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.srcArr, s.rsi, s.bbUpper, s.bbLower, s.plFound, s.phFound, ...s.plots, s.maFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // RSI: rma of max(change, 0) and -min(change, 0)
      const src = value(b);
      s.srcArr[i] = src;
      const change = i > 0 ? src - s.srcArr[i - 1] : NaN;
      const up = s.up.step(isNaN(change) ? NaN : Math.max(change, 0));
      const down = s.down.step(isNaN(change) ? NaN : -Math.min(change, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      s.rsi[i] = rsi;
      const ma = s.ma ? s.ma.step(rsi, b.volume ?? NaN) : NaN;
      const sd = s.dev ? s.dev.step(rsi, cfg.maLength) * cfg.bbMult : NaN;
      const bbUpper = ma + sd;
      const bbLower = ma - sd;
      s.bbUpper[i] = bbUpper;
      s.bbLower[i] = bbLower;

      // Divergence
      const r = i - lbR >= 0 ? s.rsi[i - lbR] : NaN;
      let bullCond = false;
      let bearCond = false;
      let hiddenBullCond = false;
      let hiddenBearCond = false;
      let plFound = false;
      let phFound = false;
      if (cfg.calculateDivergence) {
        const v = s.vars;
        const pl = s.pl.step(i, rsi);
        const ph = s.ph.step(i, rsi);
        const lowLbr = i - lbR >= 0 ? bars[i - lbR].low : NaN;
        const highLbr = i - lbR >= 0 ? bars[i - lbR].high : NaN;
        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        // Pine v6 `and` is lazy: the ta.barssince inside _inRange(found[1]) only runs on the bars where the left side
        // (rsiLBR > / < ta.valuewhen(...)) is true, so it counts those calls. The regular and hidden call sites have the
        // same left side, so they give the same counts.
        plFound = !isNaN(pl);
        if (plFound) {
          v.plRsi = pushed(v.plRsi, r);
          v.plLow = pushed(v.plLow, lowLbr);
        }
        let rsiHL = false;
        if (gt(r, second(v.plRsi))) {
          if (i > 0 && s.plFound[i - 1]) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          rsiHL = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const vwLow = second(v.plLow);
        bullCond = lt(lowLbr, vwLow) && rsiHL && plFound;
        hiddenBullCond = gt(lowLbr, vwLow) && rsiHL && plFound;

        phFound = !isNaN(ph);
        if (phFound) {
          v.phRsi = pushed(v.phRsi, r);
          v.phHigh = pushed(v.phHigh, highLbr);
        }
        let rsiLH = false;
        if (lt(r, second(v.phRsi))) {
          if (i > 0 && s.phFound[i - 1]) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          rsiLH = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        const vwHigh = second(v.phHigh);
        bearCond = gt(highLbr, vwHigh) && rsiLH && phFound;
        hiddenBearCond = lt(highLbr, vwHigh) && rsiLH && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      // Colours
      const above = gt(rsi, ma);
      const rsiColor = enableMA && !isNaN(ma) ? (above ? color.green : color.red) : color.fuchsia;
      const maColor = above ? color.green : color.red;
      const p = s.plots;
      p[0][i] = { time: t, value: rsi, color: rsiColor };
      p[1][i] = { time: t, value: ma, color: maColor };
      p[2][i] = { time: t, value: bbUpper, color: color.red };
      p[3][i] = { time: t, value: bbLower, color: 'rgb(41, 230, 20)' };
      p[4][i] = { time: t, value: ma, color: 'transparent' };
      // fill(rsiPlot, maPlot, color = enableMA and not na(ma) ? (rsi > ma ? green 80 : red 80) : na,
      //   title = "RSI & RSI MA Fill", display = enableMA ? display.all : display.none)
      s.maFill[i] = enableMA && !isNaN(ma) ? (above ? fillGreen : fillRed) : 'transparent';
      // plot(..., offset = -lookbackRight): the value of bar i is drawn on bar i - 5 (only writer of that slot)
      if (i >= lbR) {
        const time = bars[i - lbR].time;
        s.bullLine[i - lbR] = { time, value: plFound ? r : NaN, color: bullCond ? color.green : noneColor };
        s.bearLine[i - lbR] = { time, value: phFound ? r : NaN, color: bearCond ? color.red : noneColor };
      }

      // crossAboveLowerBB = rsi[1] <= bbLower[1] and rsi > bbLower; crossBelowUpperBB = rsi[1] >= bbUpper[1] and rsi < bbUpper
      if (isBB && i > 0 && le(s.rsi[i - 1], s.bbLower[i - 1]) && gt(rsi, bbLower)) {
        s.markers.push({ time: t, position: 'bottom', shape: 'arrowUp', color: color.green, size: 'small' });
      }
      if (isBB && i > 0 && ge(s.rsi[i - 1], s.bbUpper[i - 1]) && lt(rsi, bbUpper)) {
        s.markers.push({ time: t, position: 'top', shape: 'arrowDown', color: color.red, size: 'small' });
      }
      // bgcolor(rsi < 30 ? color.new(color.green, 90) : rsi > 70 ? color.new(color.red, 90) : na)
      if (lt(rsi, 30)) s.bgColors.push({ time: t, color: bgGreen });
      else if (gt(rsi, 70)) s.bgColors.push({ time: t, color: bgRed });

      // Divergence labels (offset = -lookbackRight, location.absolute at rsiLBR)
      if (i - lbR >= 0 && !isNaN(r)) {
        const time = bars[i - lbR].time;
        if (bullCond) {
          s.markers.push({ time, position: 'atPriceBottom', price: r, shape: 'labelUp', color: color.green, text: ' Bull ',
            textColor: color.white });
        }
        if (bearCond) {
          s.markers.push({ time, position: 'atPriceTop', price: r, shape: 'labelDown', color: color.red, text: ' Bear ',
            textColor: color.white });
        }
        if (hiddenBullCond) {
          s.markers.push({ time, position: 'atPriceBottom', price: r, shape: 'labelUp', color: color.teal, text: ' H-Bull ',
            textColor: color.white });
        }
        if (hiddenBearCond) {
          s.markers.push({ time, position: 'atPriceTop', price: r, shape: 'labelDown', color: color.orange, text: ' H-Bear ',
            textColor: color.white });
        }
      }

      const f = s.flags;
      f[0][i] = bullCond;
      f[1][i] = bearCond;
      f[2][i] = hiddenBullCond;
      f[3][i] = hiddenBearCond;
      if (bullCond) s.times[0].push(t as number);
      if (bearCond) s.times[1].push(t as number);
      if (hiddenBullCond) s.times[2].push(t as number);
      if (hiddenBearCond) s.times[3].push(t as number);
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const backCount = Math.max(0, n - lbR);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
          plot5: s.bullLine.slice(0, backCount),
          plot6: s.bearLine.slice(0, backCount),
        },
        hlines: [
          { value: 70, options: { title: 'RSI Upper Band', color: color.red, linestyle: 'dashed' } },
          { value: 50, options: { title: 'RSI Middle Band', color: '#f4fc0980', linestyle: 'dashed' } },
          { value: 30, options: { title: 'RSI Lower Band', color: color.green, linestyle: 'dashed' } },
        ],
        fills: [
          // fill(bbUpper, bbLower, color = isBB ? color.new(color.white, 90) : na, title = "Bollinger Bands Background Fill")
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(isBB ? bbFill : 'transparent') },
          { plot1: 'plot0', plot2: 'plot4', options: { title: 'RSI & RSI MA Fill' }, colors: s.maFill.slice() },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        visibility: { enableMA, isBB },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiGames12Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiGames12Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; visibility: Record<string, boolean> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Regular Bullish Divergence' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Regular Bearish Divergence' },
  { id: 'alert2', title: 'Hidden Bullish Divergence', message: 'Hidden Bullish Divergence' },
  { id: 'alert3', title: 'Hidden Bearish Divergence', message: 'Hidden Bearish Divergence' },
];

export const RsiGames12 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
