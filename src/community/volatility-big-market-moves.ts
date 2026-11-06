/**
 * Volatility & Big Market Moves
 *
 * The largest move of the bar from the previous close, in percent: climb = 100 / close[1] * (high - close[1]) when
 * the high is above the previous close (else 0), drop = 100 / close[1] * (close[1] - low) when the low is below it
 * (else 0, drawn negative). Both are histograms. A bar whose climb (green) or drop (red) reaches the minimum move
 * gets a background colour, in the price pane and in the indicator pane.
 *
 * Reference: "Volatility & Big Market Moves" by nilstrades_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nilstrades_
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityBigMarketMovesInputs {
  /** Highlight moves exceeding this % from the previous close */
  minMove: number;
}

export const defaultInputs: VolatilityBigMarketMovesInputs = {
  minMove: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'minMove', type: 'float', title: 'Highlight Moves Exceeding % from Previous Candle Close', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Max Market Climb', color: color.lime, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Max Market Drop', color: color.red, lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Volatility & Big Market Moves',
  shortTitle: 'Volatility & Big Market Moves',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface VbmRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
  plot1: Point[];
  chartBg: BgColorData[];
  paneBg: BgColorData[];
}

function study(inputs: Partial<VolatilityBigMarketMovesInputs>): BarStudy<VbmRun, Result> {
  const { minMove } = { ...defaultInputs, ...inputs };
  const up = String(color.new(color.green, 80));
  const down = String(color.new(color.red, 80));
  return {
    init() {
      const s: VbmRun = { plot0: [], plot1: [], chartBg: [], paneBg: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.chartBg, s.paneBg];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const prev = i > 0 ? bars[i - 1].close : NaN;
      const maxClimb = gt(b.high, prev) ? (100 / prev) * (b.high - prev) : 0;
      const maxDrop = lt(b.low, prev) ? (100 / prev) * (prev - b.low) : 0;
      const maxDropNeg = maxDrop * -1;
      const bigClimb = ge(maxClimb, minMove);
      const bigDrop = ge(maxDrop, minMove);
      const bg = bigClimb ? up : bigDrop ? down : null;
      if (bg) {
        // bgcolor(..., force_overlay = true): price pane (Style id bgcolor0); bgcolor(...): indicator pane (bgcolor1)
        s.chartBg.push({ time: b.time, color: bg, forceOverlay: true, id: 'bgcolor0' });
        s.paneBg.push({ time: b.time, color: bg, id: 'bgcolor1' });
      }
      s.plot0[i] = { time: b.time, value: Number.isFinite(maxClimb) ? maxClimb : NaN };
      s.plot1[i] = { time: b.time, value: Number.isFinite(maxDropNeg) ? maxDropNeg : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        bgColors: [...s.chartBg, ...s.paneBg],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityBigMarketMovesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityBigMarketMovesInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}


export const VolatilityBigMarketMoves = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
