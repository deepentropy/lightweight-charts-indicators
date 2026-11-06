/**
 * Gradient Trend Filter [ChartPrime]
 *
 * A three-stage EMA noise filter of the source gives the trend line; the same filter of (high - low) gives the band
 * width, with three band pairs at 0.236 * 1.5, 0.382 * 2 and 0.618 * 2.5 of it. The bands are filled with a colour
 * from a gradient of diff = filter - filter[2] between its lowest and highest value of the last 100 bars. Orange
 * diamonds mark the crossings of diff over / under 0, drawn on the previous bar.
 * The Pine 'Line Width' input is not ported: plot widths are fixed by plotConfig (the Pine default, 2).
 *
 * Reference: "Gradient Trend Filter [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GradientTrendFilterInputs {
  src: SourceType;
  length: number;
  /** Up colour */
  color1: string;
  /** Down colour */
  color2: string;
  /** Transparency of the band fills (0..100) */
  transp: number;
}

export const defaultInputs: GradientTrendFilterInputs = {
  src: 'close',
  length: 25,
  color1: '#22c878',
  color2: '#c8224e',
  transp: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Length', defval: 25 },
  { id: 'color1', type: 'color', title: 'Up Color', defval: '#22c878' },
  { id: 'color2', type: 'color', title: 'Down Color', defval: '#c8224e' },
  { id: 'transp', type: 'int', title: 'Transparency', defval: 80 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#22c878', lineWidth: 2 },
  { id: 'plot1', title: 'Upper 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Lower 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Lower 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Lower 3', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Gradient Trend Filter [ChartPrime]',
  shortTitle: 'Gradient Trend Filter',
  overlay: true,
};

/** noise_filter(src, length): three chained EMAs with alpha = 2 / (length + 1), each started from 0 (nz) */
interface NoiseFilter {
  nf1: number;
  nf2: number;
  nf3: number;
}

const nz = (v: number) => (isNaN(v) ? 0 : v);

/** One bar of noise_filter: the state changed in place, the filter value returned */
function noiseFilterStep(f: NoiseFilter, value: number, alpha: number): number {
  f.nf1 = alpha * value + (1 - alpha) * nz(f.nf1);
  f.nf2 = alpha * f.nf1 + (1 - alpha) * nz(f.nf2);
  f.nf3 = alpha * f.nf2 + (1 - alpha) * nz(f.nf3);
  return f.nf3;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface GtfVars {
  base: NoiseFilter;
  val: NoiseFilter;
}

interface GtfRun extends BarRunState<GtfVars> {
  lo: WindowExtreme;
  hi: WindowExtreme;
  base: number[];
  diff: number[];
  filter: Point[];
  bands: Point[][];
  trendColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<GradientTrendFilterInputs>): BarStudy<GtfRun, Result> {
  const { src, length, color1, color2, transp } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const alpha = 2 / (length + 1);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const lo = new WindowExtreme(true, 100);
      const hi = new WindowExtreme(false, 100);
      const s: GtfRun = {
        lo, hi, base: [], diff: [], filter: [], bands: [[], [], [], [], [], []], trendColors: [], markers: [],
        steps: [lo, hi],
        vars: { base: { nf1: NaN, nf2: NaN, nf3: NaN }, val: { nf1: NaN, nf2: NaN, nf3: NaN } },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.base, s.diff, s.filter, ...s.bands, s.trendColors];
      return s;
    },
    copyVars: (v) => ({ base: { ...v.base }, val: { ...v.val } }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const base = noiseFilterStep(s.vars.base, value(b), alpha);
      const val = noiseFilterStep(s.vars.val, b.high - b.low, alpha);
      s.base[i] = base;
      const bd = s.bands;
      bd[0][i] = { time, value: base + val * (0.618 * 2.5) };
      bd[1][i] = { time, value: base + val * (0.382 * 2) };
      bd[2][i] = { time, value: base + val * (0.236 * 1.5) };
      bd[3][i] = { time, value: base - val * 0.236 * 1.5 };
      bd[4][i] = { time, value: base - val * 0.382 * 2 };
      bd[5][i] = { time, value: base - val * 0.618 * 2.5 };

      // diff = base - base[2]
      const diff = i >= 2 ? base - s.base[i - 2] : NaN;
      s.diff[i] = diff;
      const lo = s.lo.step(diff);
      const hi = s.hi.step(diff);
      // color gradient_col = color.from_gradient(diff, lowest(diff, 100), highest(diff, 100), color2, color1)
      // trend_color = color.new(gradient_col, transp)
      const grad = color.from_gradient(diff, lo, hi, color2, color1);
      s.trendColors[i] = String(color.new(grad, transp));
      // plot(base, "Filter", color = diff >= 0 ? color1 : color2)
      s.filter[i] = { time, value: base, color: diff >= 0 ? color1 : color2 };
      // plotshape(signal_up / signal_dn ? base[1] : na, shape.diamond, location.absolute, offset = -1, color.orange)
      // signal: ta.crossover / ta.crossunder(diff, 0) (every historical bar is confirmed)
      const prev = i > 0 ? s.diff[i - 1] : NaN;
      if (i > 0 && !isNaN(prev)) {
        const up = diff > 0 && prev <= 0;
        const dn = diff < 0 && prev >= 0;
        // shape0: the signal_up diamond, shape1: the signal_dn diamond
        if (up || dn) {
          s.markers.push({ id: up ? 'shape0' : 'shape1', time: bars[i - 1].time, position: 'atPriceMiddle', price: s.base[i - 1],
            shape: 'diamond', color: color.orange, size: 'tiny' });
        }
      }
    },
    result(s) {
      const trendColors = s.trendColors.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.filter.slice(),
          plot1: s.bands[0].slice(),
          plot2: s.bands[1].slice(),
          plot3: s.bands[2].slice(),
          plot4: s.bands[3].slice(),
          plot5: s.bands[4].slice(),
          plot6: s.bands[5].slice(),
        },
        // fill(up3, lw3, trend_color); fill(up2, lw2, trend_color); fill(up1, lw1, trend_color)
        fills: [
          { plot1: 'plot1', plot2: 'plot6', colors: trendColors },
          { plot1: 'plot2', plot2: 'plot5', colors: trendColors },
          { plot1: 'plot3', plot2: 'plot4', colors: trendColors },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GradientTrendFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GradientTrendFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const GradientTrendFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
