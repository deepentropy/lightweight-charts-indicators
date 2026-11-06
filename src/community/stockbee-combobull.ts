/**
 * Stockbee ComboBull
 *
 * Histogram of 1 on the bars with a Stockbee "combo bull" breakout, 0 otherwise. Common condition: volume above
 * 100,000 and close[1] / close[2] <= 1.02. Dollar breakout: close - open >= 0.90 and a body larger than the
 * previous body. Four percent breakout: close / close[1] >= 1.04 and a volume above the previous volume. The bar
 * also needs a close above 3 and a close in the top 30 % of the bar range.
 *
 * Reference: "Stockbee ComboBull" by traderabhi81
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © traderabhi81
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface StockbeeComboBullInputs {}

export const defaultInputs: StockbeeComboBullInputs = {};

export const inputConfig: InputConfig[] = [];

/** Pine default plot colour */
const DEFAULT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ComboBull', color: DEFAULT_COLOR, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'ComboBull',
  shortTitle: 'ComboBull',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };

interface ComboBullRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
}

function study(): BarStudy<ComboBullRun, IndicatorResult> {
  return {
    init() {
      const s: ComboBullRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      s.plot0[i] = comboBull(bars, i);
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
export function createRun(_inputs: Partial<StockbeeComboBullInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<StockbeeComboBullInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

/** The plot point of bar `i` */
function comboBull(bars: Bar[], i: number): Point {
  const b = bars[i];
  const p1 = i >= 1 ? bars[i - 1] : undefined;
  const close1 = p1 ? p1.close : NaN;
  const open1 = p1 ? p1.open : NaN;
  const volume1 = p1 ? p1.volume ?? NaN : NaN;
  const close2 = i >= 2 ? bars[i - 2].close : NaN;
  const volume = b.volume ?? NaN;
  // comboCommonCond = (volume > 100000) and (close[1] / close[2] <= 1.02)
  const common = gt(volume, 100000) && le(close1 / close2, 1.02);
  // dollarBO = (close - open >= 0.90) and (close[1] - open[1] < close - open) and comboCommonCond
  const dollarBO = ge(b.close - b.open, 0.9) && lt(close1 - open1, b.close - b.open) && common;
  // fourPerBO = (close / close[1] >= 1.04) and volume > volume[1] and comboCommonCond
  const fourPerBO = ge(b.close / close1, 1.04) && gt(volume, volume1) && common;
  // comboBullCond = (dollarBO or fourPerBO) and close > 3 and ((close - low) / (high - low) >= 0.7)
  // (a plain division: x / 0 is +infinity, 0 / 0 is na)
  const cond = (dollarBO || fourPerBO) && gt(b.close, 3) && ge((b.close - b.low) / (b.high - b.low), 0.7);
  // plot(comboBullCond ? 1 : 0, style = plot.style_histogram)
  return { time: b.time, value: cond ? 1 : 0, color: DEFAULT_COLOR };
}

export const StockbeeComboBull = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
