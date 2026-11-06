/**
 * Clean Volume Bars (Green/Red + Above Avg Highlight)
 *
 * Volume columns, green when close >= open and red otherwise, with the SMA of the volume as a yellow line. A second
 * column series repeats the volume on the bars where it is above its SMA: white on bullish bars, black on bearish
 * bars (no colour on the other bars).
 *
 * Reference: "Clean Volume Bars (Green/Red + Above Avg Highlight)" by melospoker80
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CleanVolumeBarsInputs {
  /** Volume SMA length */
  length: number;
}

export const defaultInputs: CleanVolumeBarsInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volume SMA Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Avg Volume', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Above Avg Highlight', color: color.white, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Clean Volume Bars (Green/Red + Above Avg Highlight)',
  shortTitle: 'Clean Volume Bars (Green/Red + Above Avg Highlight)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface CleanVolumeRun extends BarRunState<Record<string, never>> {
  ma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<CleanVolumeBarsInputs>): BarStudy<CleanVolumeRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ma = new WindowSma(cfg.length);
      const s: CleanVolumeRun = { ma, plot0: [], plot1: [], plot2: [], steps: [ma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const volMA = s.ma.step(volume) ?? NaN;
      const isBull = ge(b.close, b.open);
      // plot(volume, 'Volume', style = plot.style_columns, color = isBull ? color.green : color.red)
      s.plot0[i] = { time: b.time, value: volume, color: isBull ? color.green : color.red };
      s.plot1[i] = { time: b.time, value: volMA, color: color.yellow };
      // hiColor := volume > volMA ? (isBull ? color.white : color.black) : na
      s.plot2[i] = { time: b.time, value: volume, color: gt(volume, volMA) ? (isBull ? color.white : color.black) : 'transparent' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CleanVolumeBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CleanVolumeBarsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CleanVolumeBars = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
