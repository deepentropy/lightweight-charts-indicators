/**
 * CVD Divergence Background
 *
 * Bar delta from the position of the close in the bar range: buy volume = (close - low) / range x volume, sell volume
 * = (high - close) / range x volume (both 0 on a bar with a zero range), delta = buy - sell. A green bar (close > open)
 * with a negative delta colours the background with the bearish colour; a red bar (close < open) with a positive
 * delta colours it with the bullish colour.
 *
 * Reference: "CVD Divergence Background By HK" by colacorn
 * Original notice: © HK
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CvdDivergenceBackgroundInputs {
  /** Bearish Div Background (Green Candle / Red CVD) */
  bearColor: string;
  /** Bullish Div Background (Red Candle / Green CVD) */
  bullColor: string;
}

// Input defaults color.new(color.red, 85) / color.new(color.lime, 85): alpha 0.15 as an input default
export const defaultInputs: CvdDivergenceBackgroundInputs = {
  bearColor: 'rgba(242, 54, 69, 0.15)',
  bullColor: 'rgba(0, 230, 118, 0.15)',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'bearColor', type: 'color', title: 'Bearish Div Background (Green Candle / Red CVD)',
    defval: 'rgba(242, 54, 69, 0.15)', group: 'Divergence Settings',
  },
  {
    id: 'bullColor', type: 'color', title: 'Bullish Div Background (Red Candle / Green CVD)',
    defval: 'rgba(0, 230, 118, 0.15)', group: 'Divergence Settings',
  },
];

/** No plot(): the outputs are the two bgcolor layers */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CVD Divergence Background',
  shortTitle: 'IOM CVD Div BG',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = IndicatorResult & { bgColors: BgColorData[] };

interface CvdDivRun extends BarRunState<Record<string, never>> {
  bgColors: BgColorData[];
}

function study(inputs: Partial<CvdDivergenceBackgroundInputs>): BarStudy<CvdDivRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CvdDivRun = { bgColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const rangeSize = b.high - b.low;
      const rawBuyVol = eq(rangeSize, 0) ? 0 : ((b.close - b.low) / rangeSize) * volume;
      const rawSellVol = eq(rangeSize, 0) ? 0 : ((b.high - b.close) / rangeSize) * volume;
      const delta = rawBuyVol - rawSellVol;

      const isGreenCandle = gt(b.close, b.open);
      const isRedCandle = lt(b.close, b.open);
      const isBearDiv = isGreenCandle && lt(delta, 0);
      const isBullDiv = isRedCandle && gt(delta, 0);

      // bgcolor(is_bear_div ? c_div_bear : na, "Bearish Divergence BG") then
      // bgcolor(is_bull_div ? c_div_bull : na, "Bullish Divergence BG"): the second layer is drawn over the first
      // (the two conditions never hold on the same bar: green and red candles exclude each other)
      if (isBullDiv) s.bgColors.push({ time: b.time, color: cfg.bullColor });
      else if (isBearDiv) s.bgColors.push({ time: b.time, color: cfg.bearColor });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CvdDivergenceBackgroundInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CvdDivergenceBackgroundInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CvdDivergenceBackground = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
