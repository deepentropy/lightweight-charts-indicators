/**
 * Auto Fib (FibFib)
 *
 * Fibonacci levels of the range between the highest and the lowest close of the last `fiblength` bars: 1 (highest
 * close), 0.764, 0.618, 0.5, 0.382, 0.236 and 0 (lowest close), with a coloured fill between each pair of levels.
 *
 * Reference: "FibFib" (Auto Fib) by TheYangGuizi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface AutoFibTheyangguiziInputs {
  /** Number of bars of the range */
  fiblength: number;
}

export const defaultInputs: AutoFibTheyangguiziInputs = {
  fiblength: 265,
};

export const inputConfig: InputConfig[] = [
  { id: 'fiblength', type: 'int', title: 'fiblength', defval: 265 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35); fills: 90
const V1 = (hex: string) => String(color.new(hex, 35));
const fillOf = (hex: string) => String(color.new(hex, 90));
const RED = '#FF0000';
const LIGHT_BLUE = '#3399FF';
const LIME = '#00FF00';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '1', color: V1('#000000'), lineWidth: 1 },
  { id: 'plot1', title: '0.764', color: V1(LIGHT_BLUE), lineWidth: 1 },
  { id: 'plot2', title: '0.618', color: V1('#0000FF'), lineWidth: 1 },
  { id: 'plot3', title: '0.5', color: V1(LIME), lineWidth: 1 },
  { id: 'plot4', title: '0.382', color: V1('#008000'), lineWidth: 1 },
  { id: 'plot5', title: '0.236', color: V1(RED), lineWidth: 1 },
  { id: 'plot6', title: '0', color: V1('#000000'), lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', color: fillOf(RED), title: 'Plots Background' },
  { id: 'fill1', plot1: 'plot1', plot2: 'plot2', color: fillOf(LIGHT_BLUE), title: 'Plots Background' },
  { id: 'fill2', plot1: 'plot2', plot2: 'plot3', color: fillOf(LIME), title: 'Plots Background' },
  { id: 'fill3', plot1: 'plot3', plot2: 'plot4', color: fillOf(LIME), title: 'Plots Background' },
  { id: 'fill4', plot1: 'plot4', plot2: 'plot5', color: fillOf(LIGHT_BLUE), title: 'Plots Background' },
  { id: 'fill5', plot1: 'plot5', plot2: 'plot6', color: fillOf(RED), title: 'Plots Background' },
];

export const metadata = {
  title: 'FibFib',
  shortTitle: 'AutoFib',
  overlay: true,
};

type Point = { time: number; value: number };

interface AutoFibRun extends BarRunState<Record<string, never>> {
  maxr: WindowExtreme;
  minr: WindowExtreme;
  plots: Point[][];
}

function study(inputs: Partial<AutoFibTheyangguiziInputs>): BarStudy<AutoFibRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // ta.highest(close, fiblength) / ta.lowest(close, fiblength)
      const maxr = new WindowExtreme(false, cfg.fiblength);
      const minr = new WindowExtreme(true, cfg.fiblength);
      const plots: Point[][] = [[], [], [], [], [], [], []];
      return { maxr, minr, plots, steps: [maxr, minr], vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hi = s.maxr.step(b.close);
      const lo = s.minr.step(b.close);
      const ranr = hi - lo;
      const p = s.plots;
      p[0][i] = { time: b.time, value: hi };
      p[1][i] = { time: b.time, value: hi - 0.236 * ranr };
      p[2][i] = { time: b.time, value: hi - 0.382 * ranr };
      p[3][i] = { time: b.time, value: hi - 0.5 * ranr };
      p[4][i] = { time: b.time, value: lo + 0.382 * ranr };
      p[5][i] = { time: b.time, value: lo + 0.236 * ranr };
      p[6][i] = { time: b.time, value: lo };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: fillConfig.map((f) => ({ plot1: f.plot1, plot2: f.plot2, options: { color: f.color, title: f.title } })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoFibTheyangguiziInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoFibTheyangguiziInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoFibTheyangguizi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
