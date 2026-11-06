/**
 * CM_Donchian Channels Modified
 *
 * Donchian channel with separate lengths for its two sides: the upper line is the highest high of the last
 * `Upper Channel` bars (lime), the lower line the lowest low of the last `Lower Channel` bars (red), the mid line their
 * average (yellow); the channel between the upper and lower lines is filled (white, 75 % transparent).
 *
 * Reference: "CM_Donchian Channels Modified" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DonchianCustomInputs {
  /** Upper Channel */
  upperLen: number;
  /** Lower Channel */
  lowerLen: number;
}

export const defaultInputs: DonchianCustomInputs = {
  upperLen: 4,
  lowerLen: 60,
};

export const inputConfig: InputConfig[] = [
  { id: 'upperLen', type: 'int', title: 'Upper Channel', defval: 4, min: 1 },
  { id: 'lowerLen', type: 'int', title: 'Lower Channel', defval: 60, min: 1 },
];

/** Pine version 1 colours: red, lime, yellow */
const RED = '#FF0000';
const LIME = '#00FF00';
const YELLOW = '#FFFF00';
/** fill(u, l, color = white, transp = 75) */
const FILL = 'rgba(255, 255, 255, 0.25)';

// l = plot(lower), u = plot(upper) (both untitled), plot(basis, title = "Mid-Line Average")
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: RED, lineWidth: 4 },
  { id: 'plot1', title: 'Plot', color: LIME, lineWidth: 4 },
  { id: 'plot2', title: 'Mid-Line Average', color: YELLOW, lineWidth: 1 },
];

export const metadata = {
  title: 'CM_Donchian Channels Modified',
  shortTitle: 'CM_DC Modified',
  overlay: true,
};

type Point = { time: number; value: number };

interface DonchianCustomRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  plots: Point[][];
}

function study(inputs: Partial<DonchianCustomInputs>): BarStudy<DonchianCustomRun, IndicatorResult> {
  const { upperLen, lowerLen } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const upper = new WindowExtreme(false, upperLen);
      const lower = new WindowExtreme(true, lowerLen);
      const plots: Point[][] = [[], [], []];
      return { upper, lower, plots, steps: [upper, lower], vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const u = s.upper.step(b.high);
      const l = s.lower.step(b.low);
      // avg(upper, lower): na when one of them is na
      const basis = (u + l) / 2;
      s.plots[0]![i] = { time: b.time, value: l };
      s.plots[1]![i] = { time: b.time, value: u };
      s.plots[2]![i] = { time: b.time, value: basis };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0]!.slice(), plot1: s.plots[1]!.slice(), plot2: s.plots[2]!.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot0', options: { title: 'Fill', color: FILL } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DonchianCustomInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DonchianCustomInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DonchianCustom = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
