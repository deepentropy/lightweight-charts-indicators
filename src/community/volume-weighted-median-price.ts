/**
 * Volume Weighted Median Price (VWMP)
 *
 * The (price, volume) pairs of the last `Lookback Period` bars with a valid price and a positive volume are sorted by
 * price (bubble sort, ascending). The VWMP is the first price where the cumulative volume reaches half of the total
 * volume of the window.
 *
 * Reference: "Volume Weighted Median Price (VWMP)" by vsov
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © vsov
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWeightedMedianPriceInputs {
  /** Lookback period in bars */
  length: number;
  /** Price source */
  priceSource: SourceType;
}

export const defaultInputs: VolumeWeightedMedianPriceInputs = {
  length: 20,
  priceSource: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 20, min: 1 },
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'hlc3' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMP', color: String(color.new(color.orange, 0)), lineWidth: 2 },
];

export const metadata = {
  title: 'Volume Weighted Median Price (VWMP)',
  shortTitle: 'VWMP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };

interface VwmpRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
}

function study(inputs: Partial<VolumeWeightedMedianPriceInputs>): BarStudy<VwmpRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const value = barSource(cfg.priceSource);
  const lineColor = String(color.new(color.orange, 0));
  return {
    // a length below 1 reads the next bar (x[-1])
    fullRunReason: () => (!isBarSource(cfg.priceSource) ? 'source of another study' : len - 1 < 0 ? 'a length below 1 reads the next bar' : null),
    init() {
      const s: VwmpRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      // Populate the pairs of the window: for i = 0 to len - 1 (x[i] is na before the first bar)
      const pairs: { price: number; volume: number }[] = [];
      let totalVolume = 0.0;
      const step = len - 1 >= 0 ? 1 : -1;
      for (let i = 0; step > 0 ? i <= len - 1 : i >= len - 1; i += step) {
        const price = b - i >= 0 && b - i < bars.length ? value(bars[b - i]) : NaN;
        const volume = b - i >= 0 && b - i < bars.length ? bars[b - i].volume ?? NaN : NaN;
        if (!isNaN(price) && !isNaN(volume) && gt(volume, 0)) {
          pairs.push({ price, volume });
          totalVolume += volume;
        }
      }
      const size = pairs.length;
      // Bubble sort by price (swap when pair1.price > pair2.price, Pine comparison)
      if (size > 1) {
        for (let i = 0; i <= size - 2; i++) {
          for (let j = 0; j <= size - i - 2; j++) {
            if (gt(pairs[j].price, pairs[j + 1].price)) {
              const tmp = pairs[j];
              pairs[j] = pairs[j + 1];
              pairs[j + 1] = tmp;
            }
          }
        }
      }
      // `if arraySize == 0 or totalVolume <= 0 => na` returns nothing in Pine: with no pair, the loop
      // `for idx = 0 to -1` runs idx = 0 and array.get fails (Pine runtime error)
      if (size === 0) {
        throw new Error(`Error on bar ${b}: In 'array.get()' function. Index 0 is out of bounds, array size is 0.`);
      }
      const target = totalVolume * 0.5;
      let cumulativeVolume = 0.0;
      let vwmp = NaN;
      for (let idx = 0; idx <= size - 1; idx++) {
        cumulativeVolume += pairs[idx].volume;
        if (ge(cumulativeVolume, target)) {
          vwmp = pairs[idx].price;
          break;
        }
      }
      s.plot0[b] = { time: bar.time, value: vwmp, color: lineColor };
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
export function createRun(inputs: Partial<VolumeWeightedMedianPriceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedMedianPriceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeWeightedMedianPrice = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
