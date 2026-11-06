/**
 * CM RSI-2 Strategy Upper
 *
 * The price pane of Larry Connors' RSI-2 strategy: the 5-bar and 200-bar SMAs of the close (lime while the 5 SMA is at
 * or above the 200 SMA, red below it) and bar colours from the 2-bar RSI (rma averages of the gains and losses):
 * - lime: long entry, close above the 200 SMA, under the 5 SMA and RSI below 10;
 * - red: short entry, close under the 200 SMA, above the 5 SMA and RSI above 90;
 * - yellow: long exit (close above the 200 SMA, previous close under the previous 5 SMA, high above the 5 SMA and a
 *   long entry on one of the 4 previous bars) or short exit (the mirror rule).
 *
 * Reference: "_CM_RSI_2_HB_MA" by ChrisMoody
 */

import { taStep, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData } from '../types';

/** The original has no inputs */
export type CMRSI2UpperInputs = Record<string, never>;

export const defaultInputs: CMRSI2UpperInputs = {};

export const inputConfig: InputConfig[] = [];

// Colour constants of the original's Pine version (1 / 2)
const LIME = '#00FF00';
const RED = '#FF0000';
const YELLOW = '#FFFF00';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '5 SMA', color: LIME, lineWidth: 3, palette: [LIME, RED] },
  { id: 'plot1', title: '200 SMA', color: LIME, lineWidth: 3, style: 'circles', palette: [LIME, RED] },
];

export const metadata = {
  title: '_CM_RSI_2_HB_MA',
  shortTitle: '_CM_RSI_2_HB_MA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };

interface CmRun extends BarRunState<Record<string, never>> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  sma5: WindowSma;
  sma200: WindowSma;
  close: number[];
  ma5: number[];
  longSet: boolean[];
  shortSet: boolean[];
  barColors: BarColorData[];
  plot0: Point[];
  plot1: Point[];
}

function study(): BarStudy<CmRun, Result> {
  return {
    init() {
      const s: CmRun = {
        up: taStep.rma(2), down: taStep.rma(2), sma5: new WindowSma(5), sma200: new WindowSma(200), close: [], ma5: [],
        longSet: [], shortSet: [], barColors: [], plot0: [], plot1: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.up, s.down, s.sma5, s.sma200];
      s.lists = [s.barColors];
      s.series = [s.close, s.ma5, s.longSet, s.shortSet, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const t = b.time as number;
      const c = b.close;
      /**
       * up = rma(max(change(src), 0), 2); down = rma(-min(change(src), 0), 2);
       * rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
       */
      const change = i > 0 ? c - s.close[i - 1]! : NaN;
      // max(na, 0) / min(na, 0) are na
      const u = s.up.step(Number.isNaN(change) ? NaN : Math.max(change, 0));
      const d = s.down.step(Number.isNaN(change) ? NaN : -Math.min(change, 0));
      const rsi = compare.eq(d, 0) ? 100 : compare.eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
      const ma5 = s.sma5.step(c);
      const ma200 = s.sma200.step(c);
      s.close[i] = c;
      s.ma5[i] = ma5;
      s.longSet[i] = compare.gt(c, ma200) && compare.lt(c, ma5) && compare.lt(rsi, 10);
      s.shortSet[i] = compare.lt(c, ma200) && compare.gt(c, ma5) && compare.gt(rsi, 90);
      // x[k]: na before the first bar
      const at = (a: number[], k: number) => (k >= 0 ? a[k]! : NaN);
      const was = (a: boolean[], k: number) => k >= 0 && a[k]!;
      const isLongEntry = s.longSet[i]!;
      // close > ma200 and close[1] < ma5[1] and high > ma5 and (a long setup 1, 2, 3 or 4 bars back)
      const isLongExit = compare.gt(c, ma200) && compare.lt(at(s.close, i - 1), at(s.ma5, i - 1))
        && compare.gt(b.high, ma5)
        && (was(s.longSet, i - 1) || was(s.longSet, i - 2) || was(s.longSet, i - 3) || was(s.longSet, i - 4));
      const isShortEntry = s.shortSet[i]!;
      const isShortExit = compare.lt(c, ma200) && compare.gt(at(s.close, i - 1), at(s.ma5, i - 1))
        && compare.lt(b.low, ma5)
        && (was(s.shortSet, i - 1) || was(s.shortSet, i - 2) || was(s.shortSet, i - 3) || was(s.shortSet, i - 4));

      // barcolor(isLongEntry() ? lime : na), (isLongExit() ? yellow), (isShortEntry() ? red), (isShortExit() ? yellow)
      if (isLongEntry) s.barColors.push({ id: 'barcolor0', time: t, color: LIME });
      if (isLongExit) s.barColors.push({ id: 'barcolor1', time: t, color: YELLOW });
      if (isShortEntry) s.barColors.push({ id: 'barcolor2', time: t, color: RED });
      if (isShortExit) s.barColors.push({ id: 'barcolor3', time: t, color: YELLOW });

      // col = ma5 >= ma200 ? lime : ma5 < ma200 ? red : na
      const col = compare.ge(ma5, ma200) ? LIME : compare.lt(ma5, ma200) ? RED : 'transparent';
      s.plot0[i] = { time: t, value: ma5, color: col };
      s.plot1[i] = { time: t, value: ma200, color: col };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<CMRSI2UpperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<CMRSI2UpperInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const CMRSI2Upper = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
