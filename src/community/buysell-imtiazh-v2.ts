/**
 * BuySell% ImtiazH v2
 *
 * Splits the bar volume into a buying part, volume * (close - low) / (high - low), and a selling part (0 on a bar
 * with high == low). Plots the total volume (red columns), the buying volume (teal columns), the buying share in
 * percent, the 30-bar SMA of the volume and a breakout level = SMA * (1 + threshold / 100).
 *
 * Reference: "BuySell%_ImtiazH_v2" by a272a59956
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuySellImtiazhV2Inputs {
  /** Breakout threshold above the 30-bar average volume (%) */
  breakoutThreshold: number;
}

export const defaultInputs: BuySellImtiazhV2Inputs = {
  breakoutThreshold: 40.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'breakoutThreshold', type: 'float', title: 'Breakout Threshold (%)', defval: 40.0, min: 0.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SELL V', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'BUY V', color: color.teal, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Buy %', color: String(color.new(color.yellow, 0)), lineWidth: 1 },
  { id: 'plot3', title: '30-Day Avg Vol Line', color: color.blue, lineWidth: 2 },
  { id: 'plot4', title: 'Breakout Vol Line', color: color.white, lineWidth: 2 },
];

export const metadata = {
  title: 'BuySell%_ImtiazH',
  shortTitle: 'BuySell%_ImtiazH',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: any; value: number };

interface BuySellRun extends BarRunState<Record<string, never>> {
  avg: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<BuySellImtiazhV2Inputs>): BarStudy<BuySellRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const threshold = cfg.breakoutThreshold / 100.0;
  return {
    init() {
      const avg = new WindowSma(30);
      const s: BuySellRun = { avg, plots: [[], [], [], [], []], steps: [avg], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // buyVolume = (high == low) ? 0 : volume * (close - low) / (high - low)
      const buyVolume = eq(b.high, b.low) ? 0 : (volume * (b.close - b.low)) / (b.high - b.low);
      // buyPercent = buyVolume / volume * 100 (plain division: 0 / 0 is na)
      const buyPercent = (buyVolume / volume) * 100;
      const avgVolume30 = s.avg.step(volume) ?? NaN;
      const breakoutVolume = avgVolume30 * (1 + threshold);
      const time = b.time;
      const [p0, p1, p2, p3, p4] = s.plots;
      p0[i] = { time, value: fin(volume) };
      p1[i] = { time, value: fin(buyVolume) };
      p2[i] = { time, value: fin(buyPercent) };
      p3[i] = { time, value: fin(avgVolume30) };
      p4[i] = { time, value: fin(breakoutVolume) };
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuySellImtiazhV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuySellImtiazhV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BuySellImtiazhV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
