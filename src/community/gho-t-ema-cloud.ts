/**
 * Ghost EMA Cloud
 *
 * EMAs of the close with lengths 9, 14, 12 and 5 (the 12 and 5 EMAs are hidden by default). The area between the
 * 9 EMA and the 14 EMA is green when the 9 EMA is above the 14 EMA, red otherwise.
 *
 * Reference: "Gho$t EMA Cloud" by Ghostmlt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface GhostEmaCloudInputs {}

export const defaultInputs: GhostEmaCloudInputs = {};

export const inputConfig: InputConfig[] = [];

const C9 = String(color.new('#9c9c9c', 0));
const C14 = String(color.new('#ffffff', 0));
const C12 = String(color.new('#d1d417', 0));
const C5 = String(color.new('#e4a42d', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '9 EMA', color: C9, lineWidth: 1 },
  { id: 'plot1', title: '14 EMA', color: C14, lineWidth: 1 },
  { id: 'plot2', title: '12 EMA', color: C12, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: '5 EMA', color: C5, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Ghost EMA Cloud',
  shortTitle: 'Ghost EMA Cloud',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: any; value: number; color: string };

interface GhostRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  plots: Point[][];
  fillColors: string[];
}

// bullishColor = color.new(#66bb6a, 55), bearishColor = color.new(#f23645, 55)
const bullish = String(color.new('#66bb6a', 55));
const bearish = String(color.new('#f23645', 55));

function study(_inputs: Partial<GhostEmaCloudInputs>): BarStudy<GhostRun, IndicatorResult> {
  return {
    init() {
      const emas = [taStep.ema(9), taStep.ema(14), taStep.ema(12), taStep.ema(5)];
      const s: GhostRun = { emas, plots: [[], [], [], []], fillColors: [], steps: emas, vars: {}, lists: [], series: [] };
      s.series = [...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const e9 = s.emas[0].step(b.close) ?? NaN;
      const e14 = s.emas[1].step(b.close) ?? NaN;
      const e12 = s.emas[2].step(b.close) ?? NaN;
      const e5 = s.emas[3].step(b.close) ?? NaN;
      s.plots[0][i] = { time: b.time, value: e9, color: C9 };
      s.plots[1][i] = { time: b.time, value: e14, color: C14 };
      s.plots[2][i] = { time: b.time, value: e12, color: C12 };
      s.plots[3][i] = { time: b.time, value: e5, color: C5 };
      s.fillColors[i] = gt(e9, e14) ? bullish : bearish;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
        },
        fills: [
          // fill(plot9, plot14, color = e9 > e14 ? bullishColor : bearishColor)
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GhostEmaCloudInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GhostEmaCloudInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GhostEmaCloud = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
