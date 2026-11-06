/**
 * Customizable RSI/StochRSI Double Confirmation
 *
 * RSI of the source and a Stochastic RSI (K = SMA of 100 * (rsi - lowest rsi) / (highest rsi - lowest rsi)). Labels
 * mark the RSI crossing above the buy threshold or below the sell threshold, the StochRSI K crossing above its buy
 * threshold or below its sell threshold, and the bars where both RSI and StochRSI give the same signal (double buy /
 * double sell). Horizontal lines at 80 and 20 on the price pane.
 *
 * Reference: "Customizable RSI/StochRSI Double Confirmation" by smile_bad_day
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface CustomizableRsiStochRsiDoubleConfirmationInputs {
  rsiLength: number;
  rsiSource: SourceType;
  stochLength: number;
  smoothK: number;
  /** StochRSI Smooth D (stochD is computed but not drawn) */
  smoothD: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
  stochRsiBuyThreshold: number;
  stochRsiSellThreshold: number;
}

export const defaultInputs: CustomizableRsiStochRsiDoubleConfirmationInputs = {
  rsiLength: 7,
  rsiSource: 'close',
  stochLength: 5,
  smoothK: 3,
  smoothD: 3,
  rsiBuyThreshold: 20,
  rsiSellThreshold: 80,
  stochRsiBuyThreshold: 20,
  stochRsiSellThreshold: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 7, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'stochLength', type: 'int', title: 'StochRSI Length', defval: 5, min: 1 },
  { id: 'smoothK', type: 'int', title: 'StochRSI Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'StochRSI Smooth D', defval: 3, min: 1 },
  { id: 'rsiBuyThreshold', type: 'float', title: 'RSI Buy Threshold', defval: 20, min: 0, max: 100 },
  { id: 'rsiSellThreshold', type: 'float', title: 'RSI Sell Threshold', defval: 80, min: 0, max: 100 },
  { id: 'stochRsiBuyThreshold', type: 'float', title: 'StochRSI Buy Threshold', defval: 20, min: 0, max: 100 },
  { id: 'stochRsiSellThreshold', type: 'float', title: 'StochRSI Sell Threshold', defval: 80, min: 0, max: 100 },
];

// No plot(): the outputs are six plotshape labels and two hlines
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Customizable RSI/StochRSI Double Confirmation',
  shortTitle: 'Customizable RSI/StochRSI Double Confirmation',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface DoubleConfirmationRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  hi: WindowExtreme;
  lo: WindowExtreme;
  k: WindowSma;
  rsiBuy: ReturnType<typeof taStep.crossover>;
  rsiSell: ReturnType<typeof taStep.crossunder>;
  stochBuy: ReturnType<typeof taStep.crossover>;
  stochSell: ReturnType<typeof taStep.crossunder>;
  markers: MarkerData[];
}

function study(inputs: Partial<CustomizableRsiStochRsiDoubleConfirmationInputs>): BarStudy<DoubleConfirmationRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { rsiLength, stochLength, smoothK, smoothD } = cfg;
  const { rsiBuyThreshold, rsiSellThreshold, stochRsiBuyThreshold, stochRsiSellThreshold } = cfg;
  const value = barSource(cfg.rsiSource);
  const blue = color.blue; // Pine default plotshape text colour
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLength);
      const hi = new WindowExtreme(false, stochLength);
      const lo = new WindowExtreme(true, stochLength);
      const k = new WindowSma(smoothK);
      // stochD = ta.sma(stochK, smoothD): computed in Pine, not used by any output (its length check only)
      new WindowSma(smoothD);
      const s: DoubleConfirmationRun = {
        rsi, hi, lo, k,
        rsiBuy: taStep.crossover(), rsiSell: taStep.crossunder(), stochBuy: taStep.crossover(), stochSell: taStep.crossunder(),
        markers: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [rsi, hi, lo, k, s.rsiBuy, s.rsiSell, s.stochBuy, s.stochSell];
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const r = s.rsi.step(value(bars[i]));
      const rsiHighest = s.hi.step(r);
      const rsiLowest = s.lo.step(r);
      // A plain division: x / 0 is +-infinity, 0 / 0 NaN; ta.sma skips the infinite values as Pine
      const stochK = s.k.step((100 * (r - rsiLowest)) / (rsiHighest - rsiLowest));

      const rsiBuy = s.rsiBuy.step(r, rsiBuyThreshold);
      const rsiSell = s.rsiSell.step(r, rsiSellThreshold);
      const stochBuy = s.stochBuy.step(stochK, stochRsiBuyThreshold);
      const stochSell = s.stochSell.step(stochK, stochRsiSellThreshold);
      const buyBoth = rsiBuy && stochBuy;
      const sellBoth = rsiSell && stochSell;

      const markers = s.markers;
      if (rsiBuy) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'RSI Buy', textColor: blue });
      if (rsiSell) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'RSI Sell', textColor: blue });
      if (stochBuy) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.yellow, text: 'StochRSI Buy', textColor: blue });
      if (stochSell) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.fuchsia, text: 'StochRSI Sell', textColor: blue });
      if (buyBoth) markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Double Buy', textColor: blue });
      if (sellBoth) markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Double Sell', textColor: blue });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        hlines: [
          { value: 80, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
          { value: 20, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<CustomizableRsiStochRsiDoubleConfirmationInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CustomizableRsiStochRsiDoubleConfirmationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CustomizableRsiStochRsiDoubleConfirmation = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
