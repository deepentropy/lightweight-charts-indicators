/**
 * Eagles Compass
 *
 * Fixed rules (no inputs). The body is |close - open| (0.00001 when it is 0). A bullish signal is a green candle whose
 * low reaches the lowest low of the 20 previous bars, with a lower wick >= body * -8.25 and an upper wick <= body * 20.
 * A bearish signal is a red candle whose high reaches the highest high of the 20 previous bars, with an upper wick
 * >= body * -4 and a lower wick <= body * 0.5. A green triangle below the bar marks the first bar of a bullish signal,
 * a red triangle above the bar the first bar of a bearish signal.
 *
 * Reference: "Eagles Compass" by zenmarkets
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs: the parameters are constants
export interface EaglesCompassInputs {}

export const defaultInputs: EaglesCompassInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the only outputs are two plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Eagles Compass',
  shortTitle: 'Eagles Compass',
  overlay: true,
};

const LOOKBACK_PERIOD = 20;
const WICK_TO_BODY_RATIO_BULLISH = -8.25;
const MAX_UPPER_WICK_BULLISH = 20.0;
const WICK_TO_BODY_RATIO_BEARISH = -4.0;
const MAX_LOWER_WICK_BEARISH = 0.5;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface EaglesVars {
  /** bullishSignal[1] / bearishSignal[1] */
  prevBull: boolean;
  prevBear: boolean;
}

interface EaglesRun extends BarRunState<EaglesVars> {
  lowest: WindowExtreme;
  highest: WindowExtreme;
  lowestLow: number[];
  highestHigh: number[];
  markers: MarkerData[];
}

function study(): BarStudy<EaglesRun, Result> {
  const bullColor = String(color.new('#4dff00', 0));
  const bearColor = String(color.new('#ff0000', 0));
  return {
    init() {
      const lowest = new WindowExtreme(true, LOOKBACK_PERIOD);
      const highest = new WindowExtreme(false, LOOKBACK_PERIOD);
      const s: EaglesRun = {
        lowest, highest, lowestLow: [], highestHigh: [], markers: [],
        steps: [lowest, highest], vars: { prevBull: false, prevBear: false }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.lowestLow, s.highestHigh];
      return s;
    },
    bar(s, i, bars) {
      const { open, high, low, close, time } = bars[i];
      s.lowestLow[i] = s.lowest.step(low);
      s.highestHigh[i] = s.highest.step(high);
      let bodySize = Math.abs(close - open);
      bodySize = eq(bodySize, 0) ? 0.00001 : bodySize;
      const upperWick = high - Math.max(open, close);
      const lowerWick = Math.min(open, close) - low;
      // ta.lowest(low, 20)[1] / ta.highest(high, 20)[1]: na on bar 0
      const supportZone = i > 0 ? s.lowestLow[i - 1] : NaN;
      const resistanceZone = i > 0 ? s.highestHigh[i - 1] : NaN;
      const isGreenCandle = gt(close, open);
      const isRedCandle = gt(open, close);
      const isDecentBounce = ge(lowerWick, bodySize * WICK_TO_BODY_RATIO_BULLISH);
      const hasControlledUpperWick = le(upperWick, bodySize * MAX_UPPER_WICK_BULLISH);
      const inSupportZone = le(low, supportZone);
      const bullishSignal = isGreenCandle && isDecentBounce && hasControlledUpperWick && inSupportZone;
      const isPressureCooker = ge(upperWick, bodySize * WICK_TO_BODY_RATIO_BEARISH)
        && le(lowerWick, bodySize * MAX_LOWER_WICK_BEARISH);
      const inResistanceZone = ge(high, resistanceZone);
      const bearishSignal = isPressureCooker && inResistanceZone && isRedCandle;
      const v = s.vars;
      // plotchar(bullishSignal and not bullishSignal[1], char = '▲', location.belowbar, size.small)
      if (bullishSignal && !v.prevBull) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '▲',
          textColor: bullColor, size: 'small' });
      }
      // plotchar(bearishSignal and not bearishSignal[1], char = '▼', location.abovebar, size.small)
      if (bearishSignal && !v.prevBear) {
        s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '▼',
          textColor: bearColor, size: 'small' });
      }
      v.prevBull = bullishSignal;
      v.prevBear = bearishSignal;
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
export function createRun(_inputs: Partial<EaglesCompassInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<EaglesCompassInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const EaglesCompass = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
