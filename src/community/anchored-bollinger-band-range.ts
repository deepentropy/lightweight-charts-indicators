/**
 * Anchored Bollinger Band Range [SS]
 *
 * On each bar, the bars of the last 1001 bars (the current bar and 1000 before it) whose open time is between the
 * start and the end time are collected. The high targets are the high of the most recent of these bars plus 1, 2,
 * 3 and 4 population standard deviations of their highs; the low targets are the low of the most recent of these bars
 * minus 1, 2, 3 and 4 standard deviations of their lows. Each target is drawn as four glow lines (widths 1, 3, 6,
 * 10) with fills between the targets. The breakout range average is the mean of the average high and the average
 * low of the collected bars. With no collected bar, the targets are na.
 *
 * Reference: "Anchored Bollinger Band Range [SS]" by Steversteves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Steversteves
 */

import { array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AnchoredBollingerBandRangeInputs {
  /** Start of the range (UNIX ms, Pine input.time) */
  startTime: number;
  /** End of the range (UNIX ms, Pine input.time) */
  endTime: number;
  /** Draw the fills between the targets */
  fills: boolean;
  /** Draw the breakout range average */
  ma: boolean;
}

/** timestamp("20 Jul 2025 00:00 +000") */
const DEFAULT_TIME = 1752969600000;

export const defaultInputs: AnchoredBollingerBandRangeInputs = {
  startTime: DEFAULT_TIME,
  endTime: DEFAULT_TIME,
  fills: true,
  ma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'startTime', type: 'time', title: 'Start Period', defval: DEFAULT_TIME },
  { id: 'endTime', type: 'time', title: 'End Period', defval: DEFAULT_TIME },
  { id: 'fills', type: 'bool', title: 'Plot Fills', defval: true },
  { id: 'ma', type: 'bool', title: 'Plot Breakout Range Moving Average', defval: true },
];

const HI_COLORS = ['#02ed12', '#05a30f', '#04750b', '#025404'];
const LO_COLORS = ['#ff005d', '#f70707', '#e83333', '#ba3c3c'];
/** Glow layers: transparency and width */
const LAYERS: Array<[number, number]> = [[0, 1], [75, 3], [85, 6], [95, 10]];
const OBR_COLOR = '#009bf5';
const OBR_LAYERS: Array<[number, number]> = [[0, 1], [75, 3], [85, 7], [95, 10]];

/** Plot list in the Pine order: for each target k and layer, the high plot then the low plot; then the OBR layers */
const PLOT_SPECS: Array<{ title: string; color: string; width: number; level: number; side: 'hi' | 'lo' | 'obr' }> = [];
for (let k = 0; k < 4; k++) {
  for (const [tr, w] of LAYERS) {
    PLOT_SPECS.push({ title: `High Tgt ${k + 1}`, color: String(color.new(HI_COLORS[k], tr)), width: w, level: k + 1, side: 'hi' });
    PLOT_SPECS.push({ title: `Low Tgt ${k + 1}`, color: String(color.new(LO_COLORS[k], tr)), width: w, level: k + 1, side: 'lo' });
  }
}
for (const [tr, w] of OBR_LAYERS) {
  PLOT_SPECS.push({ title: 'OBR High', color: String(color.new(OBR_COLOR, tr)), width: w, level: 0, side: 'obr' });
}

export const plotConfig: PlotConfig[] = PLOT_SPECS.map((p, i) => ({
  id: `plot${i}`, title: p.title, color: p.color, lineWidth: p.width,
}));

export const metadata = {
  title: 'Anchored Bollinger Band Range [SS]',
  shortTitle: 'Anchored Bollinger Band Range [SS]',
  overlay: true,
};

/** Number of bars before the current bar scanned by `for i = 0 to 1000` */
const LOOKBACK = 1000;

type Point = { time: number; value: number; color: string };

interface AnchoredRun extends BarRunState<Record<string, never>> {
  /** One list of points per plot of PLOT_SPECS */
  plots: Point[][];
}

function study(inputs: Partial<AnchoredBollingerBandRangeInputs>): BarStudy<AnchoredRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const hi = new Array<number>(4);
  const lo = new Array<number>(4);
  return {
    init() {
      const plots: Point[][] = PLOT_SPECS.map(() => []);
      return { plots, steps: [], vars: {}, lists: [], series: plots };
    },
    bar(s, b, bars) {
      const hiAr = array.new_float(0);
      const loAr = array.new_float(0);
      // for i = 0 to 1000: time[i] >= start_time and time[i] <= end_time (time[i] is na before the first bar)
      for (let i = 0; i <= LOOKBACK && b - i >= 0; i++) {
        const t = bars[b - i].time * 1000;
        if (t >= cfg.startTime && t <= cfg.endTime) {
          array.push(hiAr, bars[b - i].high);
          array.push(loAr, bars[b - i].low);
        }
      }
      const lastHigh = array.size(hiAr) > 0 ? array.get(hiAr, 0) : 0;
      const lastLow = array.size(loAr) > 0 ? array.get(loAr, 0) : 0;
      const hiSd = array.stdev(hiAr);
      const loSd = array.stdev(loAr);
      for (let k = 0; k < 4; k++) {
        hi[k] = lastHigh + hiSd * (k + 1);
        lo[k] = lastLow - loSd * (k + 1);
      }
      const obr = (array.avg(hiAr) + array.avg(loAr)) / 2;
      const time = bars[b].time;
      for (let idx = 0; idx < PLOT_SPECS.length; idx++) {
        const p = PLOT_SPECS[idx];
        const v = p.side === 'hi' ? hi[p.level - 1] : p.side === 'lo' ? lo[p.level - 1] : obr;
        const shown = p.side !== 'obr' || cfg.ma;
        s.plots[idx][b] = { time, value: shown ? fin(v) : NaN, color: p.color };
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: IndicatorResult['plots'] = {};
      PLOT_SPECS.forEach((_p, idx) => { plots[`plot${idx}`] = s.plots[idx].slice(); });

      // Fills between the widest glow plots (plot index = 8 * (k - 1) + 6 for High Tgt k, + 7 for Low Tgt k)
      const hiPlot = (k: number) => `plot${8 * (k - 1) + 6}`;
      const loPlot = (k: number) => `plot${8 * (k - 1) + 7}`;
      const fillColors = (c: string, tr: number) =>
        new Array<string>(n).fill(cfg.fills ? String(color.new(c, tr)) : 'transparent');
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: hiPlot(1), plot2: hiPlot(2), colors: fillColors('#02ed12', 85) },
          { plot1: loPlot(1), plot2: loPlot(2), colors: fillColors('#ff005d', 85) },
          { plot1: hiPlot(2), plot2: hiPlot(3), colors: fillColors('#02ed12', 90) },
          { plot1: loPlot(3), plot2: loPlot(2), colors: fillColors('#ff005d', 90) },
          { plot1: hiPlot(3), plot2: hiPlot(4), colors: fillColors('#02ed12', 95) },
          { plot1: loPlot(3), plot2: loPlot(4), colors: fillColors('#ff005d', 92) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AnchoredBollingerBandRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AnchoredBollingerBandRangeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AnchoredBollingerBandRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
