/**
 * Nova Flow Lite
 *
 * Flow line: EMA(close, 34), teal when it is above EMA(close, 55) and red otherwise, drawn twice (a wide glow at 80 %
 * transparency and the line) with a fill between them. Equilibrium zone: SMA(close, 34) +- one standard deviation
 * of 34 bars, drawn as two light grey lines with a grey fill.
 *
 * Reference: "Nova Flow Lite (Free)" by NovaQuantX
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NovaQuantX
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export type NovaFlowLiteInputs = Record<string, never>;

export const defaultInputs: NovaFlowLiteInputs = {};

export const inputConfig: InputConfig[] = [];

const COL_UP = String(color.new(color.teal, 0));
const COL_DOWN = String(color.new(color.red, 0));
const ZONE_LINE = String(color.new(color.gray, 90));
const ZONE_FILL = String(color.new(color.gray, 94));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Flow Glow', color: String(color.new(COL_UP, 80)), lineWidth: 8 },
  { id: 'plot1', title: 'Flow Line', color: COL_UP, lineWidth: 3 },
  // Untitled in Pine (title "")
  { id: 'plot2', title: 'Upper Band', color: ZONE_LINE, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Band', color: ZONE_LINE, lineWidth: 1 },
];

export const metadata = {
  title: 'Nova Flow Free v2.1',
  shortTitle: 'Nova Flow Free',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface NovaRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  dev: WindowStdev;
  flowColor: string[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(): BarStudy<NovaRun, IndicatorResult> {
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const fast = taStep.ema(34);
      const slow = taStep.ema(55);
      const basis = new WindowSma(34);
      const dev = new WindowStdev(34);
      const s: NovaRun = {
        fast, slow, basis, dev, flowColor: [], plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [fast, slow, basis, dev], vars: {}, lists: [], series: [],
      };
      s.series = [s.flowColor, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const close = b.close;
      const fast = s.fast.step(close);
      const slow = s.slow.step(close);
      const basis = s.basis.step(close);
      const dev = s.dev.step(close);
      // trendUp = fast > slow; flowColor = trendUp ? colUp : colDown
      const flowColor = gt(fast, slow) ? COL_UP : COL_DOWN;
      s.flowColor[i] = flowColor;
      s.plot0[i] = { time: b.time, value: val(fast), color: String(color.new(flowColor, 80)) };
      s.plot1[i] = { time: b.time, value: val(fast), color: flowColor };
      s.plot2[i] = { time: b.time, value: val(basis + dev), color: ZONE_LINE };
      s.plot3[i] = { time: b.time, value: val(basis - dev), color: ZONE_LINE };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.flowColor.map((c) => String(color.new(c, 90))) },
          { plot1: 'plot2', plot2: 'plot3', options: { color: ZONE_FILL } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<NovaFlowLiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<NovaFlowLiteInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const NovaFlowLite = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
