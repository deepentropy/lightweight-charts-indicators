/**
 * Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon
 *
 * Two trend regularity adaptive moving averages (TRAMA) of the high and of the low: the factor tc is the square of
 * the SMA (over `length` bars) of a flag that is 1 when the `length`-bar highest high rises or the lowest low falls;
 * ama := ama[1] + tc * (price - ama[1]). The midline is their average and the half range dist = (ama high - ama
 * low) / 2. Six levels above and six below the midline at dist times 1.618, 2.618, 3.618, 5.618, 8.618 and 13.618,
 * with fills of decreasing strength toward the midline. The midline is lime when above its value 5 bars ago, red
 * otherwise.
 *
 * Reference: "Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon" by FibonacciFlux
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiFibonacciHhLlSupportResistanceInputs {
  /** Length of the highest / lowest window and of the SMA of the regularity flag */
  length: number;
}

export const defaultInputs: RsiFibonacciHhLlSupportResistanceInputs = {
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 55 },
];

/** Level multiples of the half range: h1..h6 above the midline, l1..l6 below */
const LEVELS = [1.618, 2.618, 3.618, 5.618, 8.618, 13.618];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.lime, lineWidth: 3 },
  // ph6 .. ph1, then pl6 .. pl1 (Pine plot order)
  ...[6, 5, 4, 3, 2, 1].map((k, j) => ({ id: `plot${1 + j}`, title: `Upper ${k}`, color: color.lime, lineWidth: 1 })),
  ...[6, 5, 4, 3, 2, 1].map((k, j) => ({ id: `plot${7 + j}`, title: `Lower ${k}`, color: color.red, lineWidth: 1 })),
];

export const metadata = {
  title: 'Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon',
  shortTitle: 'Fibonacci TRAMA Band',
  overlay: true,
};

/** Pine float comparison a > b: a - b > 1e-10; na operands give false */
const gt = (a: number, b: number): boolean => a - b > 1e-10;

type Point = { time: number; value: number; color?: string };

interface TramaVars {
  /** The previous highest / lowest */
  prevHighest: number;
  prevLowest: number;
  /** ama of the high and of the low (na before bar 0) */
  ama1: number;
  ama2: number;
}

interface TramaRun extends BarRunState<TramaVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  regularity: WindowSma;
  m: number[];
  /** plot0, then the upper levels plot1..plot6 and the lower levels plot7..plot12 */
  plots: Point[][];
}

function study(inputs: Partial<RsiFibonacciHhLlSupportResistanceInputs>): BarStudy<TramaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  return {
    init() {
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const regularity = new WindowSma(length);
      const plots: Point[][] = Array.from({ length: 13 }, () => []);
      const s: TramaRun = {
        highest, lowest, regularity, m: [], plots, steps: [highest, lowest, regularity],
        vars: { prevHighest: NaN, prevLowest: NaN, ama1: NaN, ama2: NaN }, lists: [], series: [],
      };
      s.series = [s.m, ...plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low, time } = bars[i];
      // hh = math.max(math.sign(ta.change(ta.highest(length))), 0); ll = math.max(math.sign(ta.change(ta.lowest(length)) * -1), 0)
      const highest = s.highest.step(high);
      const lowest = s.lowest.step(low);
      const hh = i > 0 ? Math.max(Math.sign(highest - v.prevHighest), 0) : NaN;
      const ll = i > 0 ? Math.max(Math.sign((lowest - v.prevLowest) * -1), 0) : NaN;
      v.prevHighest = highest;
      v.prevLowest = lowest;
      // bool(x): true when x is not na and not 0
      const flag = (!isNaN(hh) && hh !== 0) || (!isNaN(ll) && ll !== 0) ? 1 : 0;
      const regularity = s.regularity.step(flag);

      const tc = Math.pow(regularity, 2);
      // ama := nz(ama[1] + tc * (price - ama[1]), price)
      const a1 = v.ama1 + tc * (high - v.ama1);
      const a2 = v.ama2 + tc * (low - v.ama2);
      v.ama1 = isNaN(a1) ? high : a1;
      v.ama2 = isNaN(a2) ? low : a2;
      const m = (v.ama1 + v.ama2) / 2;
      const dist = (v.ama1 - v.ama2) / 2;
      s.m[i] = m;

      // plot(m, linewidth = 3, color = m > m[5] ? color.lime : color.red)
      s.plots[0][i] = { time, value: m, color: i >= 5 && gt(m, s.m[i - 5]) ? color.lime : color.red };
      for (let j = 0; j < 6; j++) {
        const k = 5 - j;
        s.plots[1 + j][i] = { time, value: m + dist * LEVELS[k], color: color.lime };
        s.plots[7 + j][i] = { time, value: m - dist * LEVELS[k], color: color.red };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      plots.plot0 = s.plots[0].slice();
      for (let j = 0; j < 6; j++) {
        plots[`plot${1 + j}`] = s.plots[1 + j].slice();
        plots[`plot${7 + j}`] = s.plots[7 + j].slice();
      }

      // fill(ph6, ph5, color.new(color.lime, 70)), fill(pl6, pl5, color.new(color.red, 70)), ... down to ph2 / ph1 (99)
      const transp = [70, 90, 93, 96, 99];
      const fills = transp.flatMap((tr, j) => [
        { plot1: `plot${1 + j}`, plot2: `plot${2 + j}`, options: { title: 'Plots Background', color: String(color.new(color.lime, tr)) } },
        { plot1: `plot${7 + j}`, plot2: `plot${8 + j}`, options: { title: 'Plots Background', color: String(color.new(color.red, tr)) } },
      ]);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiFibonacciHhLlSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiFibonacciHhLlSupportResistanceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiFibonacciHhLlSupportResistance = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
