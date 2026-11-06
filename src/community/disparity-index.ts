/**
 * Disparity Index
 *
 * Percent distance of the close from three EMAs (200, 50 and 20 bars by default):
 * DIX = 100 * (close - ema(close, len)) / ema(close, len). Each line can be hidden. A dotted line at 0.
 *
 * Reference: "Disparity Index" by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by HPotter v1.0 12/09/2014. The related article is copyrighted material from Stocks &
 * Commodities Dec 2009.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DisparityIndexInputs {
  /** EMA length of the first line */
  lengthFirst: number;
  /** EMA length of the second line */
  lengthSecond: number;
  /** EMA length of the third line */
  lengthThird: number;
  showFirst: boolean;
  showSecond: boolean;
  showThird: boolean;
}

export const defaultInputs: DisparityIndexInputs = {
  lengthFirst: 200,
  lengthSecond: 50,
  lengthThird: 20,
  showFirst: true,
  showSecond: true,
  showThird: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthFirst', type: 'int', title: 'LengthFirst', defval: 200, min: 1 },
  { id: 'lengthSecond', type: 'int', title: 'LengthSecond', defval: 50, min: 1 },
  { id: 'lengthThird', type: 'int', title: 'LengthThird', defval: 20, min: 1 },
  { id: 'showFirst', type: 'bool', title: 'ShowFirst', defval: true },
  { id: 'showSecond', type: 'bool', title: 'ShowSecond', defval: true },
  { id: 'showThird', type: 'bool', title: 'ShowThird', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DIX 1', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'DIX 2', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'DIX 3', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'CMOaDisparity Index',
  shortTitle: 'CMOaDisparity Index',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface DixRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  plots: Point[][];
}

function study(inputs: Partial<DisparityIndexInputs>): BarStudy<DixRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const lines = [
    { len: cfg.lengthFirst, show: cfg.showFirst, col: color.red },
    { len: cfg.lengthSecond, show: cfg.showSecond, col: color.blue },
    { len: cfg.lengthThird, show: cfg.showThird, col: color.green },
  ];
  return {
    init() {
      const emas = lines.map((l) => taStep.ema(l.len));
      const plots: Point[][] = [[], [], []];
      return { emas, plots, steps: emas, vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      // xRes = 100 * (close - ema) / ema: a plain division (x / 0 is +-infinity, shown as na)
      for (let k = 0; k < 3; k++) {
        const l = lines[k];
        const ema = s.emas[k].step(b.close);
        const v = (100 * (b.close - ema)) / ema;
        s.plots[k][i] = { time: b.time, value: l.show && Number.isFinite(v) ? v : NaN, color: l.col };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [{ value: 0, options: { title: '0', color: String(color.new(color.yellow, 0)), linestyle: 'dotted' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DisparityIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DisparityIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DisparityIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
