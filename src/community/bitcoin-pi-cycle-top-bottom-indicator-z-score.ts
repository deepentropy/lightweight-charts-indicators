/**
 * Bitcoin: Pi Cycle Top & Bottom Indicator Z Score
 *
 * Pi cycle = 2 - (2 * SMA(close, 350)) / SMA(close, 111). The z-score maps it on fixed thresholds (top 1.05,
 * bottom -1.10): mean = (top + bottom) / 2, deviation = (top - bottom) / 6, z = (pi - mean) / deviation. The two
 * moving averages are drawn on the price pane; the bars are coloured with a green to red gradient of the z-score
 * between -3 and 3. Dashed horizontal lines at 0, +-1, +-2 and +-3.
 *
 * Reference: "Bitcoin: Pi Cycle Top & Bottom Indicator Z Score" by Commandoum
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © commandoum; original code by: © Rocheur
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BitcoinPiCycleTopBottomIndicatorZScoreInputs {}

export const defaultInputs: BitcoinPiCycleTopBottomIndicatorZScoreInputs = {};

export const inputConfig: InputConfig[] = [];

const RED_66 = String(color.rgb(255, 0, 0, 66));
const RED_33 = String(color.rgb(255, 0, 0, 33));
const RED_0 = String(color.rgb(255, 0, 0, 0));
const GREEN_66 = String(color.rgb(0, 255, 0, 66));
const GREEN_33 = String(color.rgb(0, 255, 0, 33));
const GREEN_0 = String(color.rgb(0, 255, 0, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '111 SMA', color: color.yellow, lineWidth: 2, forceOverlay: true },
  { id: 'plot1', title: '111 SMA', color: color.green, lineWidth: 2, forceOverlay: true },
  { id: 'plot2', title: 'Z-Score', color: color.white, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, title: '0 line', color: color.gray, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_1', price: 1, title: '1 line', color: RED_66, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_2', price: 2, title: '2 line', color: RED_33, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_3', price: 3, title: '3 line', color: RED_0, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_m1', price: -1, title: '-1 line', color: GREEN_66, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_m2', price: -2, title: '-2 line', color: GREEN_33, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_m3', price: -3, title: '-3 line', color: GREEN_0, linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'Bitcoin: Pi Cycle Top & Bottom Indicator Z Score',
  shortTitle: 'Pi Z-Score',
  overlay: false,
};

type Result = IndicatorResult & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };

interface PiRun extends BarRunState<Record<string, never>> {
  sma111: WindowSma;
  sma350: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
}

function study(): BarStudy<PiRun, Result> {
  const thresholdTop = 1.05;
  const thresholdBottom = -1.1;
  const mean = (thresholdTop + thresholdBottom) / 2;
  const bandsRange = thresholdTop - thresholdBottom;
  // stdDev = bands_range != 0 ? bands_range / 6 : 0 (constants: never 0)
  const stdDev = bandsRange !== 0 ? bandsRange / 6 : 0;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const startColor = String(color.rgb(0, 255, 0));
  const endColor = String(color.rgb(255, 0, 0));
  return {
    init() {
      const sma111 = new WindowSma(111);
      const sma350 = new WindowSma(350);
      const s: PiRun = {
        sma111, sma350, plot0: [], plot1: [], plot2: [], barColors: [],
        steps: [sma111, sma350], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const ma111 = s.sma111.step(b.close);
      const ma350 = 2 * s.sma350.step(b.close);
      // Pi_cycle = 2 - ma_350 / ma_111: a plain division (x / 0 is +-infinity, 0 / 0 na)
      const pi = 2 - ma350 / ma111;
      const zScore = stdDev !== 0 ? (pi - mean) / stdDev : 0;
      // barcolor(color.from_gradient(zScore, -3, 3, green, red)): na z-score gives na (default bar colour)
      if (!isNaN(zScore)) s.barColors.push({ time, color: color.from_gradient(zScore, -3, 3, startColor, endColor) });
      s.plot0[i] = { time, value: ma111, color: color.yellow };
      s.plot1[i] = { time, value: ma350, color: color.green };
      s.plot2[i] = { time, value: fin(zScore), color: color.white };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: hlineConfig.map((h) => ({
          value: h.price,
          options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth },
        })),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<BitcoinPiCycleTopBottomIndicatorZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<BitcoinPiCycleTopBottomIndicatorZScoreInputs> = {}): Result {
  return fullResult(createRun().update(bars));
}

export const BitcoinPiCycleTopBottomIndicatorZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
