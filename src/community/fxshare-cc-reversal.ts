/**
 * FxShare - CC Reversal
 *
 * Counts consecutive candles in the same direction whose body (|close - open|) is at least the minimum body. A BUY
 * label is drawn when at least `minCount` such bearish candles are followed by a bullish candle that closes above
 * the EMA of the close; a SELL label when at least `minCount` such bullish candles are followed by a bearish candle
 * that closes below the EMA. The EMA is plotted.
 *
 * Reference: "FxShare - CC Reversal" by FxShareRobots
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FxShareCcReversalInputs {
  /** Minimum number of consecutive candles */
  minCount: number;
  /** Minimum candle body (price points) */
  minBody: number;
  /** EMA length */
  emaLen: number;
}

export const defaultInputs: FxShareCcReversalInputs = {
  minCount: 4,
  minBody: 20,
  emaLen: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'minCount', type: 'int', title: 'Min consecutive candles', defval: 4, min: 2 },
  { id: 'minBody', type: 'float', title: 'Min candle body (points)', defval: 20, step: 0.1 },
  { id: 'emaLen', type: 'int', title: 'EMA length', defval: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'FxShare - CC Reversal',
  shortTitle: 'FxShare - CC Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color?: string };

interface FxRun extends BarRunState<{ bullCount: number; bearCount: number }> {
  ema: ReturnType<typeof taStep.ema>;
  markers: MarkerData[];
  plot0: Point[];
}

function study(inputs: Partial<FxShareCcReversalInputs>): BarStudy<FxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(color.green, 0));
  const sellColor = String(color.new(color.red, 0));
  return {
    init() {
      const ema = taStep.ema(cfg.emaLen);
      // var int bullCount = 0
      const s: FxRun = { ema, markers: [], plot0: [], steps: [ema], vars: { bullCount: 0, bearCount: 0 }, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const ema = s.ema.step(b.close) ?? NaN;
      const valid = ge(Math.abs(b.close - b.open), cfg.minBody);
      const isBull = gt(b.close, b.open);
      const isBear = lt(b.close, b.open);
      // bullCount[1] / bearCount[1]: na on bar 0 (compares false)
      const prevBull = i > 0 ? v.bullCount : NaN;
      const prevBear = i > 0 ? v.bearCount : NaN;
      v.bullCount = valid && isBull ? v.bullCount + 1 : 0;
      v.bearCount = valid && isBear ? v.bearCount + 1 : 0;
      const sellCond = ge(prevBull, cfg.minCount) && isBear && lt(b.close, ema);
      const buyCond = ge(prevBear, cfg.minCount) && isBull && gt(b.close, ema);
      // plotshape(buyCond, "BUY", shape.labelup, location.belowbar, text = "BUY", size.small, textcolor = color.white)
      if (buyCond) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (sellCond) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: sellColor, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      s.plot0[i] = { time: b.time, value: ema, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FxShareCcReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FxShareCcReversalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FxShareCcReversal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
