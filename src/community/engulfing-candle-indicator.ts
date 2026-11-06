/**
 * Engulfing Candle Indicator
 *
 * Keeps the open and bar of the last bullish candle and of the last bearish candle. A bullish engulfing: the close
 * is above the open of the last bearish candle (an earlier bar) and above the previous low. A bearish engulfing: the
 * close is below the open of the last bullish candle (an earlier bar) and below the previous high. A signal is not
 * repeated: a bullish signal needs the last signal to be other than bullish, and the same for bearish.
 *
 * Reference: "Engulfing Candle Indicator" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by D'Andre B
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no input
export interface EngulfingCandleIndicatorInputs {}

export const defaultInputs: EngulfingCandleIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Engulfing Candle Indicator',
  shortTitle: 'Engulfing Candle Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface EngulfingVars {
  lastBullishOpen: number;
  lastBearishOpen: number;
  lastBullishIndex: number;
  lastBearishIndex: number;
  lastSignal: string;
}

interface EngulfingRun extends BarRunState<EngulfingVars> {
  markers: MarkerData[];
}

function study(): BarStudy<EngulfingRun, Result> {
  return {
    init() {
      const s: EngulfingRun = {
        markers: [], steps: [],
        vars: { lastBullishOpen: NaN, lastBearishOpen: NaN, lastBullishIndex: NaN, lastBearishIndex: NaN, lastSignal: '' },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const low1 = i > 0 ? bars[i - 1].low : NaN;
      const high1 = i > 0 ? bars[i - 1].high : NaN;

      const isBullish = gt(b.close, b.open);
      const isBearish = lt(b.close, b.open);

      if (isBullish) {
        v.lastBullishOpen = b.open;
        v.lastBullishIndex = i;
      } else if (isBearish) {
        v.lastBearishOpen = b.open;
        v.lastBearishIndex = i;
      }

      // bar_index > lastIndex: na compares false (the index counts from the first bar; only the order matters)
      const bullishEngulfing = !isNaN(v.lastBearishOpen) && gt(b.close, v.lastBearishOpen) && gt(b.close, low1)
        && i > v.lastBearishIndex;
      const bearishEngulfing = !isNaN(v.lastBullishOpen) && lt(b.close, v.lastBullishOpen) && lt(b.close, high1)
        && i > v.lastBullishIndex;

      const bullishEngulfingSignal = bullishEngulfing && v.lastSignal !== 'bullish';
      const bearishEngulfingSignal = bearishEngulfing && v.lastSignal !== 'bearish';

      if (bullishEngulfingSignal) v.lastSignal = 'bullish';
      if (bearishEngulfingSignal) v.lastSignal = 'bearish';

      if (bullishEngulfingSignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
      }
      if (bearishEngulfingSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<EngulfingCandleIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<EngulfingCandleIndicatorInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const EngulfingCandleIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
