/**
 * BuySell Volume Bar Chart
 *
 * Splits the bar volume by the close position in the bar range: buy volume = volume * (close - low) / (high - low),
 * sell volume = volume * (high - close) / (high - low) (na on a flat bar, high == low). Buy volume is drawn as
 * columns above zero and sell volume as columns below zero; the larger side has the full colour and the smaller
 * side a transparent colour. The difference (buy - sell) is shown in the data window only.
 *
 * Reference: "BuySell Volume Bar Chart" by roshbiz1408
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©roshbiz1408
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type BuysellVolumeBarChartInputs = Record<string, never>;

export const defaultInputs: BuysellVolumeBarChartInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Sell', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Δ Volume', color: color.green, lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'BuySell Volume Bar Chart',
  shortTitle: 'BuySell Volume Bar Chart',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };

interface BuysellRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(_inputs: Partial<BuysellVolumeBarChartInputs>): BarStudy<BuysellRun, IndicatorResult> {
  const buyWeak = String(color.new('#4caf4f', 48));
  const sellWeak = String(color.new('#ff5252', 58));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: BuysellRun = { plot0: [], plot1: [], plot2: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // flat = high == low: no buy / sell split on a flat bar
      const flat = eq(b.high, b.low);
      const bv = flat ? NaN : (volume * (b.close - b.low)) / (b.high - b.low);
      const sv = flat ? NaN : (volume * (b.high - b.close)) / (b.high - b.low);
      const diff = bv - sv;
      const buyHigher = gt(diff, 0);
      s.plot0[i] = { time: b.time, value: fin(bv), color: buyHigher ? color.green : buyWeak };
      s.plot1[i] = { time: b.time, value: fin(-sv), color: buyHigher ? sellWeak : color.red };
      s.plot2[i] = { time: b.time, value: fin(diff), color: buyHigher ? color.green : color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuysellVolumeBarChartInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuysellVolumeBarChartInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BuysellVolumeBarChart = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
