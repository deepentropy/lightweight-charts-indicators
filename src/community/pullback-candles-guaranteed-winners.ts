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
  taStep,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Result = IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; alerts: AlertConditionState[] };

interface PullbackRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  lowest: WindowExtreme;
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<PullbackCandlesInputs>): BarStudy<PullbackRun, Result> {
  const { emaLength, useEmaFilter } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(emaLength);
      const lowest = new WindowExtreme(true, 6);
      const s: PullbackRun = {
        ema, lowest, markers: [], barColors: [], flags: [], times: [], steps: [ema, lowest], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.times];
      s.series = [s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const e = s.ema.step(b.close);
      const ll = s.lowest.step(b.low) ?? NaN;
      const swingLow = eq(b.low, ll) || (i >= 1 && eq(bars[i - 1].low, ll));
      const emaFilterLong = !useEmaFilter || gt(b.close, e ?? NaN);
      const pullBack = i >= 3 && lt(bars[i - 2].close, bars[i - 3].close) && lt(bars[i - 1].close, bars[i - 2].close)
        && gt(b.close, bars[i - 1].close) && emaFilterLong && swingLow;
      s.flags[i] = pullBack;
      if (pullBack) {
        const time = b.time as number;
        s.markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'xcross', color: GREEN, text: 'PB', textColor: TEXT, size: 'tiny' });
        s.barColors.push({ id: 'barcolor0', time, color: GREEN });
        s.times.push(time);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PullbackCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PullbackCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PullbackCandlesGuaranteedWinners = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, barColorConfig, alertConditions,
};
