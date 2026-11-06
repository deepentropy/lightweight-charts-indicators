/**
 * Candle Range Theory (CRT) Setup (Refined)
 *
 * The previous candle sets a range (its high and low). A bullish manipulation is a candle whose low breaks below the
 * previous low while its open and close stay inside the previous range and its body is smaller than the previous
 * body (Buy triangle below the bar). A bearish manipulation is the mirror: the high breaks above the previous high
 * with the body inside the range and smaller than the previous body (Sell triangle above the bar). A candle that is
 * both gives no signal. The previous high and low are drawn as lines.
 *
 * Reference: "Candle Range Theory (CRT) by Lucas" by lucasfff
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CandleRangeTheoryByLucasInputs {}

export const defaultInputs: CandleRangeTheoryByLucasInputs = {};

export const inputConfig: InputConfig[] = [];

const PREV_HIGH_COL = String(color.new(color.blue, 70));
const PREV_LOW_COL = String(color.new(color.orange, 70));
const BUY_COL = String(color.new(color.green, 0));
const SELL_COL = String(color.new(color.red, 0));
/** Pine plotshape default text colour */
const PINE_TEXT = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Prev High', color: PREV_HIGH_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Prev Low', color: PREV_LOW_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Candle Range Theory (CRT) Setup (Refined)',
  shortTitle: 'Candle Range Theory (CRT) Setup (Refined)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CrtRun extends BarRunState<Record<string, never>> {
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number; color: string }[];
  markers: MarkerData[];
}

function study(_inputs: Partial<CandleRangeTheoryByLucasInputs>): BarStudy<CrtRun, Result> {
  return {
    init() {
      const s: CrtRun = { plot0: [], plot1: [], markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const p = i > 0 ? bars[i - 1] : undefined;
      // prevHigh = high[1], prevLow = low[1]
      const pH = p ? p.high : NaN;
      const pL = p ? p.low : NaN;
      s.plot0[i] = { time: b.time, value: pH, color: PREV_HIGH_COL };
      s.plot1[i] = { time: b.time, value: pL, color: PREV_LOW_COL };
      // prevBody = math.abs(close[1] - open[1]), currBody = math.abs(close - open)
      const prevBody = p ? Math.abs(p.close - p.open) : NaN;
      const currBody = Math.abs(b.close - b.open);

      // bullCRT = low < prevLow and open / close inside (prevLow, prevHigh) and prevBody > currBody
      const bullBodyInside = gt(b.open, pL) && gt(b.close, pL) && lt(b.open, pH) && lt(b.close, pH);
      const bullCRT = lt(b.low, pL) && bullBodyInside && gt(prevBody, currBody);
      // bearCRT = high > prevHigh and open / close inside (prevLow, prevHigh) and prevBody > currBody
      const bearBodyInside = lt(b.open, pH) && lt(b.close, pH) && gt(b.open, pL) && gt(b.close, pL);
      const bearCRT = gt(b.high, pH) && bearBodyInside && gt(prevBody, currBody);

      // plotshape(finalBullCRT, 'Bullish Manipulation (Buy)', shape.triangleup, location.belowbar, green, size.small, text = 'Buy')
      if (bullCRT && !bearCRT) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: BUY_COL, text: 'Buy',
          textColor: PINE_TEXT, size: 'small' });
      }
      // plotshape(finalBearCRT, 'Bearish Manipulation (Sell)', shape.triangledown, location.abovebar, red, size.small, text = 'Sell')
      if (bearCRT && !bullCRT) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: SELL_COL, text: 'Sell',
          textColor: PINE_TEXT, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleRangeTheoryByLucasInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CandleRangeTheoryByLucasInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CandleRangeTheoryByLucas = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
