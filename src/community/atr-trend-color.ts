/**
 * ATR Trend Color
 *
 * An ATR trailing stop: with loss = atr(period) * multiplier, the stop rises to max(stop, close - loss) while the
 * close and the previous close stay above it, falls to min(stop, close + loss) while both stay below it, and flips
 * to close - loss / close + loss when the close crosses it. The line is lime when the close is above the stop, red
 * when it is below and gray otherwise.
 *
 * Reference: "ATR Trend Color" by Aleksin_Aleksandar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Aleksin_Aleksandar
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AtrTrendColorInputs {
  /** ATR period */
  nATRPeriod1: number;
  /** ATR multiplier */
  nATRMultip1: number;
}

export const defaultInputs: AtrTrendColorInputs = {
  nATRPeriod1: 7,
  nATRMultip1: 3.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'nATRPeriod1', type: 'int', title: 'ATR Period', defval: 7 },
  { id: 'nATRMultip1', type: 'float', title: 'ATR Multiplier', defval: 3.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Trail Stop', color: color.lime, lineWidth: 2 },
];

export const metadata = {
  title: 'ATR Trend Color',
  shortTitle: 'ATR Trend Color',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

type Point = { time: number; value: number; color: string };

interface AtcVars {
  /** trail1[1] */
  prevTrail: number;
}

interface AtcRun extends BarRunState<AtcVars> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
}

function study(inputs: Partial<AtrTrendColorInputs>): BarStudy<AtcRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(cfg.nATRPeriod1);
      const s: AtcRun = { atr, plot0: [], steps: [atr], vars: { prevTrail: NaN }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const nLoss = s.atr.step(b.high, b.low, close) * cfg.nATRMultip1;
      const p = nz(s.vars.prevTrail);
      // math.max / math.min with an na argument give na
      let t: number;
      if (gt(close, p) && gt(prevClose, p)) t = Math.max(p, close - nLoss);
      else if (lt(close, p) && lt(prevClose, p)) t = Math.min(p, close + nLoss);
      else if (gt(close, p)) t = close - nLoss;
      else t = close + nLoss;
      s.vars.prevTrail = t;
      const bullish = gt(close, t);
      const bearish = lt(close, t);
      const c = bullish ? color.lime : bearish ? color.red : color.gray;
      s.plot0[i] = { time: b.time, value: t, color: c };
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
export function createRun(inputs: Partial<AtrTrendColorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrTrendColorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AtrTrendColor = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
