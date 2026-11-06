/**
 * Volume Buy/Sell Split
 *
 * The bar volume is split by the close position in the bar range: buying = volume * (close - low) / range,
 * selling = volume * (high - close) / range (range 0.0001 when high equals low). Columns show the total volume
 * (half transparent), the larger part and the smaller part, each in the buying or selling colour. A line shows the
 * SMA of the volume on the bars where the volume is above it.
 *
 * Reference: "[Top] Volume Buy/Sell Split" by LHAMA-Trading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeBuySellSplitInputs {
  buyingColor: string;
  sellingColor: string;
  totalVolColor: string;
  avgLineColor: string;
  /** SMA length of the volume */
  maLength: number;
}

export const defaultInputs: VolumeBuySellSplitInputs = {
  buyingColor: 'rgb(91, 156, 246)',
  sellingColor: 'rgb(255, 255, 51)',
  totalVolColor: color.gray,
  avgLineColor: 'rgb(153, 0, 153)',
  maLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'buyingColor', type: 'color', title: 'Buying Volume Color', defval: 'rgb(91, 156, 246)', group: 'Color Settings' },
  { id: 'sellingColor', type: 'color', title: 'Selling Volume Color', defval: 'rgb(255, 255, 51)', group: 'Color Settings' },
  { id: 'totalVolColor', type: 'color', title: 'Total Volume Color', defval: color.gray, group: 'Color Settings' },
  { id: 'avgLineColor', type: 'color', title: 'Volume MA Line Color', defval: 'rgb(153, 0, 153)', group: 'Color Settings' },
  { id: 'maLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 1, group: 'Moving Average Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Total Volume', color: String(color.new(color.gray, 50)), lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Majority Volume', color: 'rgb(91, 156, 246)', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Minority Volume', color: 'rgb(255, 255, 51)', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Above Avg Marker', color: 'rgb(153, 0, 153)', lineWidth: 1 },
];

export const metadata = {
  title: '[Top] Volume Buy/Sell Split',
  shortTitle: '[Top] Volume Split',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

interface SplitRun extends BarRunState<Record<string, never>> {
  avg: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<VolumeBuySellSplitInputs>): BarStudy<SplitRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const totalCol = String(color.new(cfg.totalVolColor, 50));
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    init() {
      const avg = new WindowSma(cfg.maLength);
      const s: SplitRun = { avg, plots: [[], [], [], []], steps: [avg], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const { time, high, low, close } = bars[i];
      const vol = bars[i].volume ?? NaN;
      const avgVol = s.avg.step(vol) ?? NaN;
      // pr = high != low ? high - low : 0.0001
      const pr = ne(high, low) ? high - low : 0.0001;
      const buyingVol = (vol * (close - low)) / pr;
      const sellingVol = (vol * (high - close)) / pr;
      // math.max / math.min: na when an argument is na
      const majorityVol = Math.max(buyingVol, sellingVol);
      const minorityVol = Math.min(buyingVol, sellingVol);
      const majorityColor = ge(buyingVol, sellingVol) ? cfg.buyingColor : cfg.sellingColor;
      const minorityColor = lt(buyingVol, sellingVol) ? cfg.buyingColor : cfg.sellingColor;
      const p = s.plots;
      p[0][i] = { time, value: v(vol), color: totalCol };
      p[1][i] = { time, value: v(majorityVol), color: majorityColor };
      p[2][i] = { time, value: v(minorityVol), color: minorityColor };
      // aboveAvgLine = volume > avgVol ? avgVol : na
      p[3][i] = { time, value: gt(vol, avgVol) ? avgVol : NaN, color: cfg.avgLineColor };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBuySellSplitInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeBuySellSplitInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeBuySellSplit = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
