/**
 * Super Guppy R1.0
 *
 * Multi-EMA trend alignment indicator.
 * 11 Fast EMAs (3-23) and 16 Slow EMAs (25-70) detect trend strength and alignment.
 * Fast/slow bands are filled with alignment-dependent colors.
 * Swing and Break buy / sell arrows (the original's plotarrow outputs, `arrows` of the result): swing arrows on the
 * first bar of a fast + slow alignment, break arrows on the first bar of the fast average beyond the slow one, each
 * only when the previous one of that kind is more than `lookback` bars back.
 *
 * Reference: "Super Guppy R1.0" by JustUncleL
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export interface SuperGuppyInputs {
  showBreak: boolean;
  showSwing: boolean;
  lookback: number;
}

export const defaultInputs: SuperGuppyInputs = {
  showBreak: true,
  showSwing: true,
  lookback: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBreak', type: 'bool', title: 'Show Break Signals', defval: true },
  { id: 'showSwing', type: 'bool', title: 'Show Swing Signals', defval: true },
  { id: 'lookback', type: 'int', title: 'Signal Lookback', defval: 6, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast Upper (EMA 3)', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot1', title: 'Fast Lower (EMA 23)', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot2', title: 'Slow Upper (EMA 25)', color: '#00FF00', lineWidth: 1 },
  { id: 'plot3', title: 'Slow Lower (EMA 70)', color: '#00FF00', lineWidth: 1 },
  { id: 'plot4', title: 'EMA Fast Avg', color: '#FFD700', lineWidth: 2 },
  { id: 'plot5', title: 'EMA Slow Avg', color: '#FF00FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Super Guppy',
  shortTitle: 'SGuppy',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { arrows: ArrowData[]; barColors: BarColorData[] };

interface GuppyVars {
  /** barssince(nz(x[1], 1) == 1) of buy, sell, buybreak, sellbreak */
  since: number[];
}

interface GuppyRun extends BarRunState<GuppyVars> {
  fast: ReturnType<typeof taStep.ema>[];
  slow: ReturnType<typeof taStep.ema>[];
  buy: number[];
  sell: number[];
  buyBreak: number[];
  sellBreak: number[];
  plots: Point[][];
  fastFill: string[];
  slowFill: string[];
  arrows: ArrowData[];
  barColors: BarColorData[];
}

// Fast EMAs: periods 3,5,7,9,11,13,15,17,19,21,23
const fastPeriods = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
// Slow EMAs: periods 25,28,31,34,37,40,43,46,49,52,55,58,61,64,67,70
const slowPeriods = [25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70];
const warmup = 70; // longest EMA period

function study(inputs: Partial<SuperGuppyInputs>): BarStudy<GuppyRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { showBreak, showSwing } = cfg;
  const lookback = cfg.lookback;
  const arrowColor = (c: string) => String(color.new(c, 20));
  // the EMA values of the bar (written in full on each bar)
  const fastE = new Array<number>(fastPeriods.length);
  const slowE = new Array<number>(slowPeriods.length);
  const ordered = (list: number[], cmp: (a: number, b: number) => boolean) => {
    for (let k = 1; k < list.length; k++) if (!cmp(list[k - 1], list[k])) return false;
    return true;
  };
  return {
    init() {
      const s: GuppyRun = {
        fast: fastPeriods.map((p) => taStep.ema(p)),
        slow: slowPeriods.map((p) => taStep.ema(p)),
        buy: [], sell: [], buyBreak: [], sellBreak: [],
        plots: Array.from({ length: 6 }, () => []), fastFill: [], slowFill: [], arrows: [], barColors: [],
        steps: [], vars: { since: [NaN, NaN, NaN, NaN] }, lists: [], series: [],
      };
      s.steps = [...s.fast, ...s.slow];
      s.lists = [s.arrows, s.barColors];
      s.series = [s.buy, s.sell, s.buyBreak, s.sellBreak, ...s.plots, s.fastFill, s.slowFill];
      return s;
    },
    copyVars: (v) => ({ since: v.since.slice() }),
    bar(s, i, bars) {
      const close = bars[i].close;
      for (let j = 0; j < fastE.length; j++) fastE[j] = s.fast[j].step(close);
      for (let j = 0; j < slowE.length; j++) slowE[j] = s.slow[j].step(close);

      // Compute averages
      let fSum = 0;
      for (let j = 0; j < fastE.length; j++) fSum += fastE[j];
      const emaFastAvg = fSum / fastE.length;
      let sSum = 0;
      for (let j = 0; j < slowE.length; j++) sSum += slowE[j];
      const emaSlowAvg = sSum / slowE.length;

      // Alignment checks. Fast aligned long: F1>F2>F3>...>F11 AND S1>S16
      let fLong = true;
      let fShort = true;
      for (let j = 0; j < fastE.length - 1; j++) {
        if (fastE[j] <= fastE[j + 1]) fLong = false;
        if (fastE[j] >= fastE[j + 1]) fShort = false;
      }
      const s1v = slowE[0];
      const s16v = slowE[slowE.length - 1];
      const fastAlignedLong = fLong && s1v > s16v;
      const fastAlignedShort = fShort && s1v < s16v;
      // Slow aligned long: S1>S2>...>S16
      let sLong = true;
      let sShort = true;
      for (let j = 0; j < slowE.length - 1; j++) {
        if (slowE[j] <= slowE[j + 1]) sLong = false;
        if (slowE[j] >= slowE[j + 1]) sShort = false;
      }

      // Plots
      const time = bars[i].time;
      const warm = i < warmup;
      // Fast band coloring: Aqua / Blue / Gray
      const fastColor = warm ? 'transparent' : fastAlignedLong ? '#00FFFF' : fastAlignedShort ? '#0000FF' : '#808080';
      // Slow band coloring: Lime / Red / Gray
      const slowColor = warm ? 'transparent' : sLong ? '#00FF00' : sShort ? '#FF0000' : '#808080';
      const p = s.plots;
      p[0][i] = { time, value: warm ? NaN : fastE[0], color: fastColor }; // EMA 3 (fastest of fast)
      p[1][i] = { time, value: warm ? NaN : fastE[fastE.length - 1], color: fastColor }; // EMA 23 (slowest of fast)
      p[2][i] = { time, value: warm ? NaN : s1v, color: slowColor }; // EMA 25 (fastest of slow)
      p[3][i] = { time, value: warm ? NaN : s16v, color: slowColor }; // EMA 70 (slowest of slow)
      p[4][i] = { time, value: warm ? NaN : emaFastAvg };
      p[5][i] = { time, value: warm ? NaN : emaSlowAvg };

      // Fill colors
      s.fastFill[i] = warm ? 'transparent' : fastAlignedLong ? 'rgba(0,255,255,0.15)' : fastAlignedShort ? 'rgba(0,0,255,0.15)' : 'rgba(128,128,128,0.08)';
      s.slowFill[i] = warm ? 'transparent' : sLong ? 'rgba(0,255,0,0.15)' : sShort ? 'rgba(255,0,0,0.15)' : 'rgba(128,128,128,0.08)';

      // Alert arrows (plotarrow outputs of the original, `arrows` of the result), with the original's rules (no
      // confluence-only, bar-colour-change or 200 EMA filter: those inputs are off by default and not given here):
      // buy := emafast > emaslow and emaS1 > emaS16 and not colslowS and colfastL ? nz(buy[1]) > 0 ? buy[1] + 1 : 1 : 0
      // sell := emafast < emaslow and emaS1 < emaS16 and not colslowL and colfastS ? ... : 0
      // buybreak := emafast > emaslow and not colslowS ? ... : 0; sellbreak := emafast < emaslow and not colslowL ? ... : 0
      const emafast = emaFastAvg;
      const emaslow = emaSlowAvg;
      const colfastL = ordered(fastE, gt);
      const colfastS = ordered(fastE, lt);
      const colslowL = ordered(slowE, gt);
      const colslowS = ordered(slowE, lt);
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);
      const next = (a: number[]) => ((isNaN(prev(a)) ? 0 : prev(a)) > 0 ? prev(a) + 1 : 1);
      const b = gt(emafast, emaslow) && gt(s1v, s16v) && !colslowS && colfastL ? next(s.buy) : 0;
      const sl = lt(emafast, emaslow) && lt(s1v, s16v) && !colslowL && colfastS ? next(s.sell) : 0;
      const bb = gt(emafast, emaslow) && !colslowS ? next(s.buyBreak) : 0;
      const sb = lt(emafast, emaslow) && !colslowL ? next(s.sellBreak) : 0;
      // barssince(nz(x[1], 1) == 1): bars since the last bar on which the previous value was 1
      const since = s.vars.since;
      const sinceStep = (k: number, pv: number) => {
        since[k] = (isNaN(pv) ? 1 : pv) === 1 ? 0 : since[k] + 1;
        return since[k];
      };
      const sinceBuy = sinceStep(0, prev(s.buy));
      const sinceSell = sinceStep(1, prev(s.sell));
      const sinceBuyBreak = sinceStep(2, prev(s.buyBreak));
      const sinceSellBreak = sinceStep(3, prev(s.sellBreak));
      s.buy[i] = b;
      s.sell[i] = sl;
      s.buyBreak[i] = bb;
      s.sellBreak[i] = sb;
      // plotarrow(ShowSwing and buy == 1 and barssince(nz(buy[1], 1) == 1) > Lookback ? 1 : na, "BUY Swing Arrow", colorup = lime, transp = 20)
      if (showSwing && b === 1 && sinceBuy > lookback) s.arrows.push({ time, id: 'arrow0', value: 1, color: arrowColor('#00FF00') });
      // plotarrow(ShowSwing and sell == 1 and ... ? -1 : na, "SELL Swing Arrow", colordown = red)
      if (showSwing && sl === 1 && sinceSell > lookback) s.arrows.push({ time, id: 'arrow1', value: -1, color: arrowColor('#FF0000') });
      // plotarrow(ShowBreak and buybreak == 1 and barssince(sellbreak) > Lookback and barssince(buybreak) > Lookback ? 1 : na, colorup = aqua)
      if (showBreak && bb === 1 && sinceSellBreak > lookback && sinceBuyBreak > lookback) {
        s.arrows.push({ time, id: 'arrow2', value: 1, color: arrowColor('#00FFFF') });
      }
      // plotarrow(ShowBreak and sellbreak == 1 and ... ? -1 : na, "SELL Break Arrow", colordown = blue)
      if (showBreak && sb === 1 && sinceBuyBreak > lookback && sinceSellBreak > lookback) {
        s.arrows.push({ time, id: 'arrow3', value: -1, color: arrowColor('#0000FF') });
      }

      // Bar colors: fast alignment color
      if (!warm) s.barColors.push({ time, color: fastAlignedLong ? '#00FFFF' : fastAlignedShort ? '#0000FF' : '#808080' });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice(), 'plot5': p[5].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: '#00FFFF' }, colors: s.fastFill.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { color: '#00FF00' }, colors: s.slowFill.slice() },
        ],
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperGuppyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperGuppyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SuperGuppy = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
