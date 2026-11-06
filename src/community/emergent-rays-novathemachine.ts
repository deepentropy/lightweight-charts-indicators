/**
 * Emergent Rays - NovaTheMachine
 *
 * Ten bands between the EMA of the high and the EMA of the low, with the lengths 21, 25, 30, 35, 40, 45, 50, 55, 60
 * and 65. The EMA lines are hidden; each band is filled with a colour of the colour scheme (Rainbow, Gainbow
 * (greens) or Painbow (reds)), with the transparency input (Rainbow: + 0 to + 9 from the inner to the outer band).
 * With Auto Trend Colors every band is green when the close is above its EMA of the high, red when the close is
 * below its EMA of the low, and red (Rainbow first colour) otherwise.
 *
 * Reference: "Emergent Rays - NovaTheMachine" by NovaTheMachine
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NovaTheMachine
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type EmergentRaysColorScheme = 'Rainbow' | 'Gainbow' | 'Painbow';

export interface EmergentRaysNovathemachineInputs {
  /** Transparency of the bands (higher is less visible) */
  opacity: number;
  /** Colour scheme */
  trendcolor: EmergentRaysColorScheme;
  /** Colours from the close position against each band */
  autoTrend: boolean;
}

export const defaultInputs: EmergentRaysNovathemachineInputs = {
  opacity: 75,
  trendcolor: 'Rainbow',
  autoTrend: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'opacity', type: 'int', title: 'Transparency', defval: 75, min: 5, max: 95, step: 10 },
  { id: 'trendcolor', type: 'string', title: 'Color Scheme', defval: 'Rainbow', options: ['Rainbow', 'Gainbow', 'Painbow'] },
  { id: 'autoTrend', type: 'bool', title: 'Auto Trend Colors', defval: false },
];

const LENGTHS = [21, 25, 30, 35, 40, 45, 50, 55, 60, 65];
/** Pine plot titles (the last pair repeats "EMA 60", as the Pine script) */
const TITLES = [21, 25, 30, 35, 40, 45, 50, 55, 60, 60];
/** Pine fill titles (the last fill repeats "Range 9", as the Pine script) */
const FILL_TITLES = ['Range 1', 'Range 2', 'Range 3', 'Range 4', 'Range 5', 'Range 6', 'Range 7', 'Range 8', 'Range 9', 'Range 9'];

const RAINBOW = ['#ff0000', '#ff1e00', '#FF4500', '#ffd900', '#a6ff00', '#12d612', '#36cfb6', '#1E90FF', '#4169E1', '#8A2BE2'];
const GAINBOW = ['#80ff80', '#40ff40', '#00f000', '#00e000', '#00c000', '#00a000', '#008000', '#006000', '#004000', '#002e1c'];
const PAINBOW = ['#ff8080', '#ff4040', '#FF0000', '#e00000', '#c00000', '#a00000', '#800000', '#7c0000', '#6b0000', '#570000'];

// plot(ema, title, color = na, editable = false, display = display.none)
export const plotConfig: PlotConfig[] = TITLES.flatMap((t, k) => [
  { id: `plot${2 * k}`, title: `EMA ${t} High`, color: 'transparent', lineWidth: 1, display: 'none' as const },
  { id: `plot${2 * k + 1}`, title: `EMA ${t} Low`, color: 'transparent', lineWidth: 1, display: 'none' as const },
]);

export const metadata = {
  title: 'Emergent Rays - NovaTheMachine',
  shortTitle: 'Emergent Rays',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };

interface RaysRun extends BarRunState<Record<string, never>> {
  /** ta.ema(high, len) and ta.ema(low, len) of each length */
  emas: ReturnType<typeof taStep.ema>[];
  plots: Point[][];
  colors: string[][];
}

function study(inputs: Partial<EmergentRaysNovathemachineInputs>): BarStudy<RaysRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const op = cfg.opacity;
  // r1..r10 = color.new(rainbow[k], opacity + k); g1..g10 and p1..p10 = color.new(c, opacity)
  const r = RAINBOW.map((c, k) => String(color.new(c, op + k)));
  const g = GAINBOW.map((c) => String(color.new(c, op)));
  const p = PAINBOW.map((c) => String(color.new(c, op)));
  const scheme = cfg.trendcolor === 'Rainbow' ? r : cfg.trendcolor === 'Gainbow' ? g : p;
  return {
    init() {
      const s: RaysRun = {
        emas: LENGTHS.flatMap((len) => [taStep.ema(len), taStep.ema(len)]),
        plots: LENGTHS.flatMap(() => [[], []]), colors: LENGTHS.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.emas;
      s.series = [...s.plots, ...s.colors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      for (let k = 0; k < LENGTHS.length; k++) {
        const eHigh = s.emas[2 * k].step(b.high);
        const eLow = s.emas[2 * k + 1].step(b.low);
        s.plots[2 * k][i] = { time, value: eHigh };
        s.plots[2 * k + 1][i] = { time, value: eLow };
        // fill(h, l, getColor(k + 1, emaHigh, emaLow), "Range ...")
        s.colors[k][i] = cfg.autoTrend
          ? gt(b.close, eHigh) ? g[0] : lt(b.close, eLow) ? p[0] : r[0]
          : scheme[k];
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      const fills: NonNullable<IndicatorResult['fills']> = [];
      LENGTHS.forEach((_len, k) => {
        plots[`plot${2 * k}`] = s.plots[2 * k].slice();
        plots[`plot${2 * k + 1}`] = s.plots[2 * k + 1].slice();
        fills.push({ plot1: `plot${2 * k}`, plot2: `plot${2 * k + 1}`, options: { title: FILL_TITLES[k] }, colors: s.colors[k].slice() });
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmergentRaysNovathemachineInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EmergentRaysNovathemachineInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EmergentRaysNovathemachine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
