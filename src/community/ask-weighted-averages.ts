/**
 * Ask-Weighted Averages
 *
 * The ask volume of a bar is its volume on an up close, 0 on a down close and half the volume otherwise. The
 * ask-weighted average price is sum(askVol * hl2) / sum(askVol) over the last `length` bars (sums taken as the
 * difference of two cumulative sums; hl2 when the volume sum is 0 or na). The continuous line is drawn on every bar;
 * the conditional line only on the bars where the rounded dollar volume (hl2 * volume / 10000) is above the
 * threshold.
 *
 * Reference: "Ask-Weighted Averages (No Labels)" by DinoTradez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DinoTradez
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AskWeightedAveragesInputs {
  /** Length of the conditional line */
  lengthConditional: number;
  /** Width of the conditional line (the port keeps the default width) */
  lineWeightConditional: number;
  /** The conditional line is drawn when round(hl2 * volume / 10000) is above this threshold */
  dollarVolumeThreshold: number;
  /** Length of the continuous line */
  lengthContinuous: number;
  /** Width of the continuous line (the port keeps the default width) */
  lineWeightContinuous: number;
}

export const defaultInputs: AskWeightedAveragesInputs = {
  lengthConditional: 20,
  lineWeightConditional: 2,
  dollarVolumeThreshold: 1.0,
  lengthContinuous: 20,
  lineWeightContinuous: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthConditional', type: 'int', title: 'Conditional Length', defval: 20 },
  { id: 'lineWeightConditional', type: 'int', title: 'Conditional Line Weight', defval: 2 },
  { id: 'dollarVolumeThreshold', type: 'float', title: 'Dollar Volume Threshold', defval: 1.0 },
  { id: 'lengthContinuous', type: 'int', title: 'Continuous Length', defval: 20 },
  { id: 'lineWeightContinuous', type: 'int', title: 'Continuous Line Weight', defval: 2 },
];

const CYAN = String(color.new(color.rgb(0, 255, 255), 0));
const GREEN = String(color.new(color.rgb(0, 255, 0), 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conditional Weighted Avg', color: CYAN, lineWidth: 2 },
  { id: 'plot1', title: 'Continuous Weighted Avg', color: GREEN, lineWidth: 2 },
];

export const metadata = {
  title: 'Ask-Weighted Averages (No Labels)',
  shortTitle: 'Ask-Weighted Averages (No Labels)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine `!=`: false when a value is na */
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

type Point = { time: any; value: number; color: string };

interface AwaRun extends BarRunState<{ sumAsk: number; sumAskHl2: number }> {
  cumAsk: number[];
  cumAskHl2: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<AskWeightedAveragesInputs>): BarStudy<AwaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // f_sum(src, length) = cum - cum[length] (na before bar `length`); a negative length reads later bars: the points
  // are built again in result() from the cumulative sums of every bar
  const fSum = (c: number[], length: number, i: number) => (i - length >= 0 ? c[i] - c[i - length] : NaN);
  const avg = (s: AwaRun, length: number, i: number, hl2: number) => {
    const sAsk = fSum(s.cumAsk, length, i);
    return ne(sAsk, 0) ? fSum(s.cumAskHl2, length, i) / sAsk : hl2;
  };
  const point0 = (s: AwaRun, i: number, b: Bar): Point => {
    const hl2 = (b.high + b.low) / 2.0;
    const dollarVolume = Math.round((hl2 * (b.volume ?? NaN)) / 10000.0);
    const condition = gt(dollarVolume, cfg.dollarVolumeThreshold);
    const v = condition ? avg(s, cfg.lengthConditional, i, hl2) : NaN;
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: CYAN };
  };
  const point1 = (s: AwaRun, i: number, b: Bar): Point => {
    const v = avg(s, cfg.lengthContinuous, i, (b.high + b.low) / 2.0);
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: GREEN };
  };
  return {
    init() {
      const s: AwaRun = {
        cumAsk: [], cumAskHl2: [], plot0: [], plot1: [], steps: [], vars: { sumAsk: 0, sumAskHl2: 0 }, lists: [], series: [],
      };
      s.series = [s.cumAsk, s.cumAskHl2, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2.0;
      const vol = b.volume ?? NaN;
      // askVol = priceChange > 0 ? volume : priceChange < 0 ? 0 : volume / 2 (priceChange na on bar 0: volume / 2)
      const pc = i > 0 ? b.close - bars[i - 1].close : NaN;
      const askVol = gt(pc, 0) ? vol : gt(0, pc) ? 0 : vol / 2;
      const askVolHl2 = askVol * hl2;
      // ta.cum(src): running sum (na adds nothing)
      const v = s.vars;
      if (!isNaN(askVol)) v.sumAsk += askVol;
      if (!isNaN(askVolHl2)) v.sumAskHl2 += askVolHl2;
      s.cumAsk[i] = v.sumAsk;
      s.cumAskHl2[i] = v.sumAskHl2;
      s.plot0[i] = point0(s, i, b);
      s.plot1[i] = point1(s, i, b);
    },
    result(s, bars) {
      const plot0 = s.plot0.slice();
      const plot1 = s.plot1.slice();
      if (cfg.lengthConditional < 0) for (let i = 0; i < bars.length; i++) plot0[i] = point0(s, i, bars[i]);
      if (cfg.lengthContinuous < 0) for (let i = 0; i < bars.length; i++) plot1[i] = point1(s, i, bars[i]);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1 },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AskWeightedAveragesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AskWeightedAveragesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AskWeightedAverages = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
