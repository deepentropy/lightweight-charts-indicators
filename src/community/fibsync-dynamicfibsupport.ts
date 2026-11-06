/**
 * FibSync - DynamicFibSupport
 *
 * Static Fibonacci levels (0.236, 0.382, 0.5, 0.618, 0.786) between the lowest low and the highest high of the last
 * `n` bars, and dynamic Fibonacci levels between the last confirmed swing low and swing high. A swing high (low) is a
 * bar whose high (low) is the highest (lowest) of the `swing_len` bars on each side; it is confirmed `swing_len`
 * bars later and its price is kept until the next swing. The dynamic levels are drawn once both swings exist.
 *
 * Reference: "FibSync - DynamicFibSupport" by mr_uponly
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © der chartmeister, © bakeTheCrypto, © mr_uponly
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibsyncDynamicfibsupportInputs {
  /** Window of the static levels (highest high / lowest low) */
  n: number;
  /** Show the dynamic levels */
  showDynamic: boolean;
  /** Search window of the most recent swing high / low */
  dynLookback: number;
  /** Swing strength: bars on each side of a swing */
  swingLen: number;
}

export const defaultInputs: FibsyncDynamicfibsupportInputs = {
  n: 250,
  showDynamic: true,
  dynLookback: 200,
  swingLen: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Static Fib Period', defval: 250 },
  { id: 'showDynamic', type: 'bool', title: 'Show Dynamic Fibonacci Levels', defval: true },
  { id: 'dynLookback', type: 'int', title: 'Dynamic Fib Swing Search Window', defval: 200 },
  { id: 'swingLen', type: 'int', title: 'Swing Strength (bars left/right)', defval: 10 },
];

const YELLOW = String(color.new(color.yellow, 0));
const RED = String(color.new(color.red, 0));
const BLUE = String(color.new(color.blue, 0));
const GREEN = String(color.new(color.green, 0));
const GRAY = String(color.new(color.gray, 0));
const WHITE = String(color.new(color.white, 0));
const YELLOW50 = String(color.new(color.yellow, 50));
const RED50 = String(color.new(color.red, 50));
const BLUE50 = String(color.new(color.blue, 50));
const GRAY50 = String(color.new(color.gray, 50));
const GREEN50 = String(color.new(color.green, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'p1 0.236', color: YELLOW, lineWidth: 1 },
  { id: 'plot1', title: 'p2 0.382', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'p4 0.618', color: BLUE, lineWidth: 1 },
  { id: 'plot3', title: 'p5 0.786', color: GREEN, lineWidth: 1 },
  { id: 'plot4', title: 'p3 0.5', color: GRAY, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Lowest', color: GREEN, lineWidth: 2, display: 'none' },
  { id: 'plot6', title: 'Highest', color: RED, lineWidth: 2, display: 'none' },
  { id: 'plot7', title: 'Close', color: WHITE, lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Dynamic 0.236', color: YELLOW50, lineWidth: 1, style: 'linebr' },
  { id: 'plot9', title: 'Dynamic 0.382', color: RED50, lineWidth: 1, style: 'linebr' },
  { id: 'plot10', title: 'Dynamic 0.618', color: BLUE50, lineWidth: 1, style: 'linebr' },
  { id: 'plot11', title: 'Dynamic 0.5', color: GRAY50, lineWidth: 1, style: 'linebr', display: 'none' },
  { id: 'plot12', title: 'Dynamic 0.786', color: GREEN50, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'FibSync - DynamicFibSupport',
  shortTitle: 'FibSync - DynamicFibSupport',
  overlay: true,
};

/** Pine `==` on floats: equal within 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type Point = { time: number; value: number; color: string };

interface FibVars {
  /** The last swing high / low price */
  sh: number;
  slo: number;
}

interface FibRun extends BarRunState<FibVars> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  winHigh: WindowExtreme;
  winLow: WindowExtreme;
  plots: Point[][];
}

const COLOURS = [YELLOW, RED, BLUE, GREEN, GRAY, GREEN, RED, WHITE, YELLOW50, RED50, BLUE50, GRAY50, GREEN50];

function study(inputs: Partial<FibsyncDynamicfibsupportInputs>): BarStudy<FibRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const sl = cfg.swingLen;
  return {
    init() {
      // Static levels: ta.highest(high, n) / ta.lowest(low, n); swings: ta.highest(high, swing_len * 2 + 1)
      const hh = new WindowExtreme(false, cfg.n);
      const ll = new WindowExtreme(true, cfg.n);
      const winHigh = new WindowExtreme(false, sl * 2 + 1);
      const winLow = new WindowExtreme(true, sl * 2 + 1);
      const s: FibRun = {
        hh, ll, winHigh, winLow, plots: COLOURS.map(() => []),
        steps: [hh, ll, winHigh, winLow], vars: { sh: NaN, slo: NaN }, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const wh = s.winHigh.step(b.high);
      const wl = s.winLow.step(b.low);
      // Swings: high[swing_len] == ta.highest(high, swing_len * 2 + 1)
      const hBack = i - sl >= 0 ? bars[i - sl].high : NaN;
      const lBack = i - sl >= 0 ? bars[i - sl].low : NaN;
      v.sh = eq(hBack, wh) ? hBack : v.sh;
      v.slo = eq(lBack, wl) ? lBack : v.slo;

      const range = hh - ll;
      const p1 = ll + range * 0.236;
      const p2 = ll + range * 0.382;
      const p3 = ll + range * 0.5;
      const p4 = ll + range * 0.618;
      const p5 = ll + range * 0.786;

      // for i = 0 to dyn_lookback: the first non-na swing_high_price[i] (the kept swing is never na again once set,
      // so it is the one of this bar)
      const rsh = 0 <= cfg.dynLookback ? v.sh : NaN;
      const rsl = 0 <= cfg.dynLookback ? v.slo : NaN;
      let d236 = NaN;
      let d382 = NaN;
      let d500 = NaN;
      let d618 = NaN;
      let d786 = NaN;
      if (!isNaN(rsh) && !isNaN(rsl)) {
        const fibRange = rsh - rsl;
        d236 = rsl + fibRange * 0.236;
        d382 = rsl + fibRange * 0.382;
        d500 = rsl + fibRange * 0.5;
        d618 = rsl + fibRange * 0.618;
        d786 = rsl + fibRange * 0.786;
      }
      const dyn = (x: number) => (cfg.showDynamic ? x : NaN);
      const P = s.plots;
      P[0][i] = { time: t, value: p1, color: COLOURS[0] };
      P[1][i] = { time: t, value: p2, color: COLOURS[1] };
      P[2][i] = { time: t, value: p4, color: COLOURS[2] };
      P[3][i] = { time: t, value: p5, color: COLOURS[3] };
      P[4][i] = { time: t, value: p3, color: COLOURS[4] };
      P[5][i] = { time: t, value: ll, color: COLOURS[5] };
      P[6][i] = { time: t, value: hh, color: COLOURS[6] };
      P[7][i] = { time: t, value: b.close, color: COLOURS[7] };
      P[8][i] = { time: t, value: dyn(d236), color: COLOURS[8] };
      P[9][i] = { time: t, value: dyn(d382), color: COLOURS[9] };
      P[10][i] = { time: t, value: dyn(d618), color: COLOURS[10] };
      P[11][i] = { time: t, value: dyn(d500), color: COLOURS[11] };
      P[12][i] = { time: t, value: dyn(d786), color: COLOURS[12] };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibsyncDynamicfibsupportInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibsyncDynamicfibsupportInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FibsyncDynamicfibsupport = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
