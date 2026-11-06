/**
 * WaveTrend Oscillator
 *
 * LazyBear's WaveTrend: ap = hlc3, esa = ema(ap, n1), d = ema(abs(ap - esa), n1), ci = (ap - esa) / (0.015 * d),
 * wt1 = ema(ci, n2), wt2 = sma(wt1, 4) (each na until its inputs exist and its window is full). The original's eight
 * plots, in its order: 0 (gray), Over Bought Level 1 (red), Over Sold Level 1 (green), Over Bought Level 2 (red,
 * cross), Over Sold Level 2 (green, cross), wt1 (green), wt2 (red, cross), wt1 - wt2 (blue area, 80% transparent).
 * No markers, bar colours, horizontal lines or fills: the original draws plots only.
 *
 * Reference: "WaveTrend Oscillator" by LazyBear
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WavetrendOscillatorInputs {
  channelLength: number;
  avgLength: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: WavetrendOscillatorInputs = {
  channelLength: 10,
  avgLength: 21,
  obLevel1: 60,
  obLevel2: 53,
  osLevel1: -60,
  osLevel2: -53,
};

export const inputConfig: InputConfig[] = [
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 10, min: 1 },
  { id: 'avgLength', type: 'int', title: 'Average Length', defval: 21, min: 1 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level 1', defval: 60 },
  { id: 'obLevel2', type: 'int', title: 'Over Bought Level 2', defval: 53 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level 1', defval: -60 },
  { id: 'osLevel2', type: 'int', title: 'Over Sold Level 2', defval: -53 },
];

/** Colours of Pine versions 1-3 (the original's version) */
const GRAY = '#808080';
const RED = '#FF0000';
const GREEN = '#008000';
const BLUE = '#0000FF';
const DIFF_COLOR = String(color.new(BLUE, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'zero', title: 'Plot', color: GRAY, lineWidth: 1 },
  { id: 'ob1', title: 'Plot', color: RED, lineWidth: 1 },
  { id: 'os1', title: 'Plot', color: GREEN, lineWidth: 1 },
  { id: 'ob2', title: 'Plot', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'os2', title: 'Plot', color: GREEN, lineWidth: 1, style: 'cross' },
  { id: 'wt1', title: 'Plot', color: GREEN, lineWidth: 1 },
  { id: 'wt2', title: 'Plot', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'diff', title: 'Plot', color: DIFF_COLOR, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'WaveTrend Oscillator',
  shortTitle: 'WT',
  overlay: false,
};

type Point = { time: number; value: number };

interface WtRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  d: ReturnType<typeof taStep.ema>;
  tci: ReturnType<typeof taStep.ema>;
  wt2: WindowSma;
  plots: Point[][];
}

const PLOT_IDS = ['zero', 'ob1', 'os1', 'ob2', 'os2', 'wt1', 'wt2', 'diff'] as const;

function study(inputs: Partial<WavetrendOscillatorInputs>): BarStudy<WtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const esa = taStep.ema(cfg.channelLength);
      const d = taStep.ema(cfg.channelLength);
      const tci = taStep.ema(cfg.avgLength);
      const wt2 = new WindowSma(4);
      const s: WtRun = {
        esa, d, tci, wt2, plots: PLOT_IDS.map(() => []), steps: [esa, d, tci, wt2], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // ap = hlc3; esa = ema(ap, n1); d = ema(abs(ap - esa), n1); ci = (ap - esa) / (0.015 * d)
      const ap = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(ap);
      const d = s.d.step(Math.abs(ap - esa));
      // a division by 0 is na
      const ci = d === 0 ? NaN : (ap - esa) / (0.015 * d);
      // wt1 = tci = ema(ci, n2); wt2 = sma(wt1, 4)
      const wt1 = s.tci.step(ci);
      const wt2 = s.wt2.step(wt1);
      const p = s.plots;
      p[0][i] = { time, value: 0 };
      p[1][i] = { time, value: cfg.obLevel1 };
      p[2][i] = { time, value: cfg.osLevel1 };
      p[3][i] = { time, value: cfg.obLevel2 };
      p[4][i] = { time, value: cfg.osLevel2 };
      p[5][i] = { time, value: wt1 };
      p[6][i] = { time, value: wt2 };
      p[7][i] = { time, value: wt1 - wt2 };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      PLOT_IDS.forEach((id, k) => { plots[id] = s.plots[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WavetrendOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WavetrendOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WavetrendOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
