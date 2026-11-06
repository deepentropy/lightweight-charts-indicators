/**
 * Pay Attention Candle
 *
 * A candle whose body |close - open| is larger than ATR(length) * multiplier is a "pay attention" candle. Bullish
 * ones (close >= open) get the up colour and a triangle below the bar, bearish ones the down colour and a triangle
 * above the bar.
 *
 * Reference: "Pay Attention Candle" by asenski (inspired by the RexDog Trading System)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This Pine Script code is subject to the terms of the Mozilla Public License 2.0 at
 * https://mozilla.org/MPL/2.0/ (c) asenski
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PayAttentionCandleInputs {
  /** ATR Length */
  atrLength: number;
  /** ATR Multiplier */
  atrMult: number;
  /** Up Bar Color */
  upColor: string;
  /** Down Bar Color */
  downColor: string;
}

export const defaultInputs: PayAttentionCandleInputs = {
  atrLength: 9,
  atrMult: 1.5,
  upColor: color.lime,
  downColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 9 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.5 },
  { id: 'upColor', type: 'color', title: 'Up Bar Color', defval: color.lime },
  { id: 'downColor', type: 'color', title: 'Down Bar Color', defval: color.red },
];

// No plot(): the outputs are bar colours and plotshape triangles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Pay Attention Candle',
  shortTitle: 'PAC',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface PacRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PayAttentionCandleInputs>): BarStudy<PacRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const s: PacRun = { atr, markers: [], barColors: [], steps: [atr], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const atrValue = s.atr.step(b.high, b.low, b.close);
      const bodySize = Math.abs(b.close - b.open);
      const isBigBody = gt(bodySize, atrValue * cfg.atrMult);
      const isBullish = ge(b.close, b.open);

      // barcolor(isBigBody ? (isBullish ? upColor : downColor) : na)
      if (isBigBody) s.barColors.push({ time: b.time, color: isBullish ? cfg.upColor : cfg.downColor });

      // plotshape(isBigBody and isBullish, style = shape.triangleup, location = location.belowbar, size = size.tiny)
      if (isBigBody && isBullish) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: cfg.upColor, size: 'tiny' });
      }
      // plotshape(isBigBody and not isBullish, style = shape.triangledown, location = location.abovebar, size = size.tiny)
      if (isBigBody && !isBullish) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: cfg.downColor, size: 'tiny' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PayAttentionCandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PayAttentionCandleInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}


export const PayAttentionCandle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
