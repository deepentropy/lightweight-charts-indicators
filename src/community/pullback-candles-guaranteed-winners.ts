/**
 * Pullback Candles (Candlestick Analysis)
 *
 * Marks a pullback candle: two closes in a row lower (close[2] < close[3] and close[1] < close[2]), then a close
 * above the close before it, on a swing low (the low or the low before it is the 6-bar lowest low). With "Use EMA
 * Filter?" the close must also be above the EMA of the close. A pullback bar gets a green x-cross below the bar with
 * the text "PB" (default text colour, blue) and a green bar colour. The original also computes a swing high and a
 * short EMA filter that it never uses: not ported.
 *
 * Reference: "Pullback Candles (Candlestick Analysis) Guaranteed Winners!!!!" by LuxTradeVenture
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MINTYFRESH97
 */

import {
  ta, Series,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface PullbackCandlesInputs {
  /** EMA Length */
  emaLength: number;
  /** Use EMA Filter? */
  useEmaFilter: boolean;
}

export const defaultInputs: PullbackCandlesInputs = {
  emaLength: 50,
  useEmaFilter: false,
};

const G_EMA = 'EMA Filter';
export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 50, group: G_EMA, tooltip: 'Length of the EMA filter' },
  { id: 'useEmaFilter', type: 'bool', title: 'Use EMA Filter?', defval: false, group: G_EMA, tooltip: 'Turns on/off the EMA filter' },
];

/** No plot(): a plotshape, a bar colour and an alertcondition */
export const plotConfig: PlotConfig[] = [];

/** Pine v5 color.green */
const GREEN = '#4CAF50';
/** Pine default shape text colour (color.blue) */
const TEXT = '#2962FF';

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'xcross', location: 'belowbar', color: GREEN, text: 'PB', textcolor: TEXT, size: 'tiny' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Pullback Candle ', message: 'Pullback Candle  detected for {{ticker}}' },
];

export const metadata = {
  title: 'Pullback Candle  ',
  shortTitle: 'Pullback Candle  ',
  overlay: true,
};

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<PullbackCandlesInputs> = {},
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const { emaLength, useEmaFilter } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const close = bars.map((b) => b.close);
  const low = bars.map((b) => b.low);
  const ema = ta.ema(new Series(bars, (b) => b.close), emaLength).toArray();
  const lowest = ta.lowest(new Series(bars, (b) => b.low), 6).toArray();

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const flags: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const ll = lowest[i] ?? NaN;
    const swingLow = eq(low[i], ll) || (i >= 1 && eq(low[i - 1], ll));
    const emaFilterLong = !useEmaFilter || gt(close[i], ema[i] ?? NaN);
    const pullBack = i >= 3 && lt(close[i - 2], close[i - 3]) && lt(close[i - 1], close[i - 2])
      && gt(close[i], close[i - 1]) && emaFilterLong && swingLow;
    flags[i] = pullBack;
    if (pullBack) {
      const time = bars[i].time as number;
      markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'xcross', color: GREEN, text: 'PB', textColor: TEXT, size: 'tiny' });
      barColors.push({ id: 'barcolor0', time, color: GREEN });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
    alerts: alertStates(alertConditions, bars, [flags]),
  };
}

export const PullbackCandlesGuaranteedWinners = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, barColorConfig, alertConditions,
};
