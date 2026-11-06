/**
 * WaveTrend Oscillator [WT]
 *
 * ap = hlc3, esa = ema(ap, n1), d = ema(|ap - esa|, n1), ci = (ap - esa) / (0.015 * d), wt1 = ema(ci, n2),
 * wt2 = sma(wt1, 4). Plots: the zero line, two overbought and two oversold levels, wt1, wt2 (crosses) and the
 * difference wt1 - wt2 as an area.
 *
 * Reference: "WaveTrend [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear. If you use this code in its original/modified form, do drop me a note.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WavetrendOscillatorWtInputs {
  /** Channel length (EMA of the price and of the absolute deviation) */
  n1: number;
  /** Average length (EMA of the channel index) */
  n2: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: WavetrendOscillatorWtInputs = {
  n1: 10,
  n2: 21,
  obLevel1: 60,
  obLevel2: 53,
  osLevel1: -60,
  osLevel2: -53,
};

export const inputConfig: InputConfig[] = [
  { id: 'n1', type: 'int', title: 'Channel Length', defval: 10 },
  { id: 'n2', type: 'int', title: 'Average Length', defval: 21 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level 1', defval: 60 },
  { id: 'obLevel2', type: 'int', title: 'Over Bought Level 2', defval: 53 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level 1', defval: -60 },
  { id: 'osLevel2', type: 'int', title: 'Over Sold Level 2', defval: -53 },
];

// Pine v1 colours (gray #808080, red #FF0000, green #008000, blue #0000FF) with the v1 default plot transparency
// of 35; the area has transp = 80
const GRAY = String(color.new('#808080', 35));
const RED = String(color.new('#FF0000', 35));
const GREEN = String(color.new('#008000', 35));
const BLUE = String(color.new('#0000FF', 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: GRAY, lineWidth: 1 },
  { id: 'plot1', title: 'Over Bought Level 1', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'Over Sold Level 1', color: GREEN, lineWidth: 1 },
  { id: 'plot3', title: 'Over Bought Level 2', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'plot4', title: 'Over Sold Level 2', color: GREEN, lineWidth: 1, style: 'cross' },
  { id: 'plot5', title: 'WT1', color: GREEN, lineWidth: 1 },
  { id: 'plot6', title: 'WT2', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'plot7', title: 'WT1 - WT2', color: BLUE, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'WaveTrend [LazyBear]',
  shortTitle: 'WT_LB',
  overlay: false,
};

type Point = { time: number; value: number };

interface WtRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  d: ReturnType<typeof taStep.ema>;
  wt1: ReturnType<typeof taStep.ema>;
  wt2: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<WavetrendOscillatorWtInputs>): BarStudy<WtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { n1, n2, obLevel1, obLevel2, osLevel1, osLevel2 } = cfg;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const esa = taStep.ema(n1);
      const d = taStep.ema(n1);
      const wt1 = taStep.ema(n2);
      const wt2 = new WindowSma(4);
      const s: WtRun = {
        esa, d, wt1, wt2, plots: [[], [], [], [], [], [], [], []],
        steps: [esa, d, wt1, wt2], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      const ap = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(ap) ?? NaN;
      const d = s.d.step(Math.abs(ap - esa)) ?? NaN;
      // A plain division, as Pine: x / 0 is +-infinity, 0 / 0 is na (the EMA skips both)
      const ci = (ap - esa) / (0.015 * d);
      const wt1 = s.wt1.step(ci) ?? NaN;
      const wt2 = s.wt2.step(wt1) ?? NaN;
      const values = [0, obLevel1, osLevel1, obLevel2, osLevel2, wt1, wt2, wt1 - wt2];
      for (let k = 0; k < 8; k++) s.plots[k]![i] = { time, value: fin(values[k]!) };
    },
    result(s) {
      const p = s.plots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0]!, plot1: p[1]!, plot2: p[2]!, plot3: p[3]!, plot4: p[4]!, plot5: p[5]!, plot6: p[6]!, plot7: p[7]! },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WavetrendOscillatorWtInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WavetrendOscillatorWtInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WavetrendOscillatorWt = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
