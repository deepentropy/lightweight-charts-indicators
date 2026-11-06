/**
 * Renko Mod
 *
 * A renko brick line on the price bars. The brick open starts at 0 and moves by one brick size per bar: up when the
 * close or the high is more than one brick above the previous brick open, down when the close or the low is more
 * than one brick below it, else it stays. The brick close is one brick behind the open after a move and keeps its
 * value otherwise. The open is drawn as crosses (green after an up move, maroon after a down move), the close as
 * gray circles.
 *
 * Reference: "Renko Mod" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RenkoModInputs {
  /** Brick size */
  bricksize: number;
}

export const defaultInputs: RenkoModInputs = {
  bricksize: 0.0005,
};

export const inputConfig: InputConfig[] = [
  { id: 'bricksize', type: 'float', title: 'Brick Size:', defval: 0.0005 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Renko Open', color: color.green, lineWidth: 3, style: 'cross' },
  { id: 'plot1', title: 'Renko Close', color: color.gray, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Renko Mod',
  shortTitle: 'Rm',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color: string };

interface RenkoVars {
  /** ropen, rclose and direction of the bar before (na on the first bar) */
  ropen: number;
  rclose: number;
  direction: number;
}

interface RenkoRun extends BarRunState<RenkoVars> {
  plot0: Point[];
  plot1: Point[];
}

// rc = direction == 1 ? color.green : direction == -1 ? color.maroon : na
const rc = (d: number) => (d === 1 ? color.green : d === -1 ? color.maroon : 'transparent');

function study(inputs: Partial<RenkoModInputs>): BarStudy<RenkoRun, IndicatorResult> {
  const { bricksize } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: RenkoRun = {
        plot0: [], plot1: [], steps: [], vars: { ropen: NaN, rclose: NaN, direction: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const { close, high, low, time } = bars[i];
      const v = s.vars;
      const propen = nz(v.ropen);
      const up = propen + bricksize;
      const down = propen - bricksize;
      const ropen = gt(close, up) || gt(high, up) ? up : lt(close, down) || lt(low, down) ? down : propen;
      const prevClose = nz(v.rclose);
      const prevDir = nz(v.direction);
      const rclose = gt(ropen, propen) ? ropen - bricksize : lt(ropen, propen) ? ropen + bricksize : prevClose;
      const direction = gt(ropen, propen) ? 1 : lt(ropen, propen) ? -1 : prevDir;
      v.ropen = ropen;
      v.rclose = rclose;
      v.direction = direction;
      // plot(ropen, '', rc, 3, plot.style_cross)
      s.plot0[i] = { time, value: ropen, color: rc(direction) };
      // plot(rclose, '', color.gray, 2, plot.style_circles)
      s.plot1[i] = { time, value: rclose, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoModInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoModInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}


export const RenkoMod = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
