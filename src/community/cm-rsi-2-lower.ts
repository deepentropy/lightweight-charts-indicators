/**
 * CM RSI-2 Strategy Lower
 *
 * The 2-bar RSI of the close (Larry Connors' RSI-2 strategy), the lower pane of the strategy: averages of the gains
 * and the losses by rma over 2 bars. The line is lime when the close is above its 200-bar SMA, under its 5-bar SMA and
 * the RSI below 10 (buy setup), red when the close is under the 200 SMA, above the 5 SMA and the RSI above 90 (sell
 * setup), silver otherwise. Level lines at 100, 0, 90 and 10, the zone between 90 and 10 filled silver.
 *
 * Reference: "_CM_RSI_2_Strat_Low" by ChrisMoody
 */

import { taStep, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original has no inputs */
export type CMRSI2LowerInputs = Record<string, never>;

export const defaultInputs: CMRSI2LowerInputs = {};

export const inputConfig: InputConfig[] = [];

// Colour constants of the original's Pine version (1 / 2)
const LIME = '#00FF00';
const RED = '#FF0000';
const SILVER = '#C0C0C0';
const AQUA = '#00FFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: SILVER, lineWidth: 4, palette: [LIME, RED, SILVER] },
  { id: 'plot1', title: 'Upper Line 100', color: AQUA, lineWidth: 3 },
  { id: 'plot2', title: 'Lower Line 0', color: AQUA, lineWidth: 3 },
  { id: 'plot3', title: 'Upper Line 90', color: AQUA, lineWidth: 3 },
  { id: 'plot4', title: 'Lower Line 10', color: AQUA, lineWidth: 3 },
];

export const metadata = {
  title: '_CM_RSI_2_Strat_Low',
  shortTitle: '_CM_RSI_2_Strategy_Lower',
  overlay: false,
};

interface Point { time: number; value: number; color?: string }

interface Rsi2Run extends BarRunState<Record<string, never>> {
  change: ReturnType<typeof taStep.change>;
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  ma5: WindowSma;
  ma200: WindowSma;
  plot0: Point[];
  levels: Point[][];
}

function study(): BarStudy<Rsi2Run, IndicatorResult> {
  return {
    init() {
      const s: Rsi2Run = {
        change: taStep.change(), up: taStep.rma(2), down: taStep.rma(2), ma5: new WindowSma(5), ma200: new WindowSma(200),
        plot0: [], levels: [[], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.change, s.up, s.down, s.ma5, s.ma200];
      s.series = [s.plot0, ...s.levels];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      /**
       * up = rma(max(change(src), 0), 2); down = rma(-min(change(src), 0), 2);
       * rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
       */
      const ch = s.change.step(c);
      // max(na, 0) / min(na, 0) are na
      const u = s.up.step(Number.isNaN(ch) ? NaN : Math.max(ch, 0));
      const d = s.down.step(Number.isNaN(ch) ? NaN : -Math.min(ch, 0));
      const rsi = compare.eq(d, 0) ? 100 : compare.eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
      const ma5 = s.ma5.step(c);
      const ma200 = s.ma200.step(c);
      // col = close > ma200 and close < ma5 and rsi < 10 ? lime : close < ma200 and close > ma5 and rsi > 90 ? red : silver
      const col = compare.gt(c, ma200) && compare.lt(c, ma5) && compare.lt(rsi, 10) ? LIME
        : compare.lt(c, ma200) && compare.gt(c, ma5) && compare.gt(rsi, 90) ? RED : SILVER;
      s.plot0[i] = { time: b.time as number, value: rsi, color: col };
      [100, 0, 90, 10].forEach((v, k) => { s.levels[k][i] = { time: b.time as number, value: v }; });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.levels[0].slice(), plot2: s.levels[1].slice(), plot3: s.levels[2].slice(), plot4: s.levels[3].slice() },
        // fill(band1, band0, color=silver, transp=90)
        fills: [
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background', color: String(color.new(SILVER, 90)) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<CMRSI2LowerInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMRSI2LowerInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CMRSI2Lower = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
