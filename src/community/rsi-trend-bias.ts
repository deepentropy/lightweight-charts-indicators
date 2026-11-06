/**
 * RSI Trend Bias
 *
 * RSI of the close. A trend state starts bearish; it turns bullish when the RSI crosses over the upper threshold and
 * bearish when it crosses under the lower threshold. The RSI line has the bullish or bearish colour of the state,
 * with flat lines at the two thresholds. An optional background on the price pane shows the state.
 *
 * Reference: "RSI Trend Bias" by Botnet101
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Botnet101
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiTrendBiasInputs {
  /** RSI length */
  rsiLength: number;
  /** Upper threshold */
  upperThreshold: number;
  /** Lower threshold */
  lowerThreshold: number;
  /** Colour the price pane background with the trend state */
  changeBackgroundColor: boolean;
  bullishColor: string;
  bearishColor: string;
  threshholdColor: string;
}

export const defaultInputs: RsiTrendBiasInputs = {
  rsiLength: 14,
  upperThreshold: 70,
  lowerThreshold: 30,
  changeBackgroundColor: false,
  bullishColor: color.green,
  bearishColor: color.red,
  threshholdColor: color.gray,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'Length', defval: 14 },
  { id: 'upperThreshold', type: 'int', title: 'Upper', defval: 70 },
  { id: 'lowerThreshold', type: 'int', title: 'Lower', defval: 30 },
  { id: 'changeBackgroundColor', type: 'bool', title: 'Change Background Color?', defval: false },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: color.green },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: color.red },
  { id: 'threshholdColor', type: 'color', title: 'Threshold Color', defval: color.gray },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Threshold', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Threshold', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Trend Bias',
  shortTitle: 'RSI Trend Bias',
  overlay: false,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface RsiTrendBiasRun extends BarRunState<{ trend: number }> {
  rsi: ReturnType<typeof taStep.rsi>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RsiTrendBiasInputs>): BarStudy<RsiTrendBiasRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const up = taStep.crossover();
      const down = taStep.crossunder();
      const s: RsiTrendBiasRun = {
        rsi, up, down, plot0: [], plot1: [], plot2: [], bgColors: [],
        steps: [rsi, up, down], vars: { trend: -1 }, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rsi = s.rsi.step(b.close) ?? NaN;
      // ta.crossover / ta.crossunder: exact comparisons with the last bar where both values were not na (oakscriptjs)
      const up = s.up.step(rsi, cfg.upperThreshold);
      const down = s.down.step(rsi, cfg.lowerThreshold);
      // var trend = -1
      if (up) s.vars.trend = 1;
      if (down) s.vars.trend = -1;
      const col = s.vars.trend === 1 ? cfg.bullishColor : cfg.bearishColor;
      const t = b.time as number;
      s.plot0[i] = { time: t, value: rsi, color: col };
      s.plot1[i] = { time: b.time, value: cfg.upperThreshold, color: cfg.threshholdColor };
      s.plot2[i] = { time: b.time, value: cfg.lowerThreshold, color: cfg.threshholdColor };
      // bgcolor(changeBackgroundColor ? color.new(col, 90) : na, force_overlay = true)
      if (cfg.changeBackgroundColor) s.bgColors.push({ time: t, color: String(color.new(col, 90)), forceOverlay: true });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiTrendBiasInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiTrendBiasInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiTrendBias = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
