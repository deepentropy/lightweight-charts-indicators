/**
 * Volume Variation Index
 *
 * vol_var = volume[1] - volume. Positive values are drawn as green columns (Volume Increase), negative values as red
 * columns (Volume Decrease). An optional SMA of vol_var (Average Variation) is filled to a zero baseline with a green
 * and a red gradient.
 *
 * Reference: "Volume Variation Index [The Quant Science]" by thequantscience
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeVariationIndexIndicatorInputs {
  /** Show the average variation line */
  activeAvg: 'NO' | 'YES';
  /** SMA length of the variation */
  avgPeriod: number;
}

export const defaultInputs: VolumeVariationIndexIndicatorInputs = {
  activeAvg: 'YES',
  avgPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'activeAvg', type: 'string', title: 'Show Average Variation', defval: 'YES', options: ['NO', 'YES'] },
  { id: 'avgPeriod', type: 'int', title: 'Avarage Period', defval: 10 },
];

const GREEN = String(color.rgb(0, 255, 8));
const RED = String(color.rgb(255, 0, 0));
const ZERO_COLOR = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Increase', color: GREEN, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume Decrease', color: RED, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Average Variation', color: '#ffffff', lineWidth: 1 },
  { id: 'plot3', title: 'Baseline Zero', color: ZERO_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Variation Index [The Quant Science]',
  shortTitle: 'Volume Variation Index [The Quant Science]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };

interface VviRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  top: number[];
  bottom: number[];
}

function study(inputs: Partial<VolumeVariationIndexIndicatorInputs>): BarStudy<VviRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const active = cfg.activeAvg === 'YES';
  return {
    init() {
      const sma = new WindowSma(cfg.avgPeriod);
      const s: VviRun = {
        sma, plot0: [], plot1: [], plot2: [], plot3: [], top: [], bottom: [], steps: [sma], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.top, s.bottom];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // vol_var = volume[1] - volume
      const v = i > 0 ? (bars[i - 1].volume ?? NaN) - (b.volume ?? NaN) : NaN;
      const avg = s.sma.step(v);
      const average = active ? fin(avg) : NaN;
      s.plot0[i] = { time: t, value: gt(v, 0) ? v : 0, color: GREEN };
      s.plot1[i] = { time: t, value: lt(v, 0) ? v : 0, color: RED };
      s.plot2[i] = { time: t, value: average, color: '#ffffff' };
      s.plot3[i] = { time: t, value: 0, color: ZERO_COLOR };
      s.top[i] = isNaN(average) ? NaN : Math.max(average, 0);
      s.bottom[i] = isNaN(average) ? NaN : Math.min(average, 0);
    },
    result(s, bars) {
      const n = bars.length;
      // fill(pLine, pZero, top_color, bottom_color) without top_value / bottom_value: the gradient goes from the upper
      // plot (top_color) to the lower plot (bottom_color)
      const same = (c: string) => new Array<string | null>(n).fill(c);
      const fills = [
        { plot1: 'plot2', plot2: 'plot3', options: { title: 'Gradient +' }, gradient: {
          topValue: s.top.slice(), bottomValue: s.bottom.slice(),
          topColor: same(String(color.new(color.green, 50))), bottomColor: same(String(color.new(color.green, 90))) } },
        { plot1: 'plot2', plot2: 'plot3', options: { title: 'Gradient -' }, gradient: {
          topValue: s.top.slice(), bottomValue: s.bottom.slice(),
          topColor: same(String(color.new(color.red, 90))), bottomColor: same(String(color.new(color.red, 50))) } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeVariationIndexIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeVariationIndexIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeVariationIndexIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
