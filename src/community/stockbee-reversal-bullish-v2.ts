/**
 * Stockbee Reversal Bullish v2
 *
 * A bullish reversal screen on the previous bar: close >= 20, 20-bar average volume >= 200,000, close above the
 * 150-bar SMA of the close, 5-bar ATR >= 1, a down bar (close < open), close more than 6 % under the highest close
 * of the 6 bars before, and 2-bar RSI <= 30 (all values taken one bar ago). The histogram is 1 when all conditions
 * are true, else 0.
 *
 * Reference: "Stockbee Reversal Bullish v2" by traderabhi81
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderabhi81
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StockbeeReversalBullishV2Inputs {}

export const defaultInputs: StockbeeReversalBullishV2Inputs = {};

export const inputConfig: InputConfig[] = [];

const PLOT_COL = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: PLOT_COL, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Reversal Bullish v2',
  shortTitle: 'Reversal Bullish v2',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

type Point = { time: number; value: number; color: string };

interface StockbeeRun extends BarRunState<Record<string, never>> {
  avgv20: WindowSma;
  avgc150: WindowSma;
  atr5: ReturnType<typeof taStep.atr>;
  maxc6: WindowExtreme;
  wrsi2: ReturnType<typeof taStep.rsi>;
  avgv: number[];
  avgc: number[];
  atr: number[];
  maxc: number[];
  rsi: number[];
  plot0: Point[];
}

function study(): BarStudy<StockbeeRun, IndicatorResult> {
  return {
    init() {
      const s: StockbeeRun = {
        avgv20: new WindowSma(20), avgc150: new WindowSma(150), atr5: taStep.atr(5), maxc6: new WindowExtreme(false, 6),
        wrsi2: taStep.rsi(2), avgv: [], avgc: [], atr: [], maxc: [], rsi: [], plot0: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.avgv20, s.avgc150, s.atr5, s.maxc6, s.wrsi2];
      s.series = [s.avgv, s.avgc, s.atr, s.maxc, s.rsi, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.avgv[i] = s.avgv20.step(b.volume ?? NaN);
      s.avgc[i] = s.avgc150.step(b.close);
      s.atr[i] = s.atr5.step(b.high, b.low, b.close);
      s.maxc[i] = s.maxc6.step(b.close);
      s.rsi[i] = s.wrsi2.step(b.close);
      // All values one bar ago ([1]); na on bar 0 makes the condition false
      const p = i - 1;
      const c1 = p >= 0 ? bars[p].close : NaN;
      const o1 = p >= 0 ? bars[p].open : NaN;
      const at = (a: number[]) => (p >= 0 ? a[p] : NaN);
      const cond = ge(c1, 20)
        && ge(at(s.avgv), 200000)
        && gt(c1, at(s.avgc))
        && ge(at(s.atr), 1)
        && lt(c1, o1)
        && lt(c1, 0.94 * at(s.maxc))
        && le(at(s.rsi), 30);
      s.plot0[i] = { time: b.time as number, value: cond ? 1 : 0, color: PLOT_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<StockbeeReversalBullishV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<StockbeeReversalBullishV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const StockbeeReversalBullishV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
