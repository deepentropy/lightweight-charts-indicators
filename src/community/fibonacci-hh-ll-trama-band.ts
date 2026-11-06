/**
 * Fibonacci HH LL TRAMA Band
 *
 * Trend Regularity Adaptive Moving Average (TRAMA) of the high and of the low: the speed tc is the squared SMA of the
 * bars where the highest high or the lowest low of `length` bars made a new extreme; ama = ama[1] + tc * (src - ama[1]).
 * The midline m is the mean of the two averages (lime when above its value 5 bars ago, else red), and the half
 * distance between them is scaled by Fibonacci ratios (0.618, 1.618, 2.618, 4.235, 6.857, 11.089) for six levels
 * above and six below, with fills of decreasing opacity between the levels.
 *
 * Reference: "Fibonacci HH LL TRAMA Band" by FibonacciFlux
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciHhLlTramaBandInputs {
  /** Highest / lowest window and SMA length of the TRAMA speed */
  length: number;
}

export const defaultInputs: FibonacciHhLlTramaBandInputs = {
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 55 },
];

const RATIOS = [11.089, 6.857, 4.235, 2.618, 1.618, 0.618];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.lime, lineWidth: 3 },
  ...RATIOS.map((_r, k) => ({ id: `plot${k + 1}`, title: `H${6 - k}`, color: color.lime, lineWidth: 1 })),
  ...RATIOS.map((_r, k) => ({ id: `plot${k + 7}`, title: `L${6 - k}`, color: color.red, lineWidth: 1 })),
];

export const metadata = {
  title: 'Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon',
  shortTitle: 'FIB HHLL TRAMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface TramaVars {
  /** ama of the high and of the low (var through ama[1]) */
  ama1: number;
  ama2: number;
}

interface TramaRun extends BarRunState<TramaVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  hiChange: ReturnType<typeof taStep.change>;
  loChange: ReturnType<typeof taStep.change>;
  tc: WindowSma;
  m: number[];
  plots: Point[][];
}

function study(inputs: Partial<FibonacciHhLlTramaBandInputs>): BarStudy<TramaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  return {
    init() {
      const hi = new WindowExtreme(false, length);
      const lo = new WindowExtreme(true, length);
      const hiChange = taStep.change();
      const loChange = taStep.change();
      const tc = new WindowSma(length);
      const s: TramaRun = {
        hi, lo, hiChange, loChange, tc, m: [], plots: Array.from({ length: 13 }, () => []),
        steps: [hi, lo, hiChange, loChange, tc], vars: { ama1: NaN, ama2: NaN }, lists: [], series: [],
      };
      s.series = [s.m, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low, time } = bars[i];
      // hh = math.max(math.sign(ta.change(ta.highest(length))), 0); ll = math.max(math.sign(ta.change(ta.lowest(length)) * -1), 0)
      const hiChange = s.hiChange.step(s.hi.step(high));
      const loChange = s.loChange.step(s.lo.step(low));
      // bool(hh) or bool(ll) ? 1 : 0 (bool(na) and bool(0) are false)
      const newExtreme = Math.max(Math.sign(hiChange), 0) > 0 || Math.max(Math.sign(-loChange), 0) > 0 ? 1 : 0;
      const tc = s.tc.step(newExtreme) ** 2;
      // ama := nz(ama[1] + tc * (src - ama[1]), src)
      const a1 = v.ama1 + tc * (high - v.ama1);
      const a2 = v.ama2 + tc * (low - v.ama2);
      v.ama1 = Number.isFinite(a1) ? a1 : high;
      v.ama2 = Number.isFinite(a2) ? a2 : low;
      const m = (v.ama1 + v.ama2) / 2;
      const dist = (v.ama1 - v.ama2) / 2;
      s.m[i] = m;
      const p = s.plots;
      // plot(m, linewidth = 3, color = m > m[5] ? color.lime : color.red)
      p[0][i] = { time, value: m, color: i >= 5 && gt(m, s.m[i - 5]) ? color.lime : color.red };
      RATIOS.forEach((r, k) => {
        p[k + 1][i] = { time, value: m + dist * r, color: color.lime };
        p[k + 7][i] = { time, value: m - dist * r, color: color.red };
      });
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });

      // fill(ph6, ph5, color.new(color.lime, 70)), fill(pl6, pl5, color.new(color.red, 70)), ... 90, 93, 96, 99
      const transp = [70, 90, 93, 96, 99];
      const fills: NonNullable<IndicatorResult['fills']> = [];
      transp.forEach((tr, k) => {
        fills.push({ plot1: `plot${k + 1}`, plot2: `plot${k + 2}`, options: { color: String(color.new(color.lime, tr)) } });
        fills.push({ plot1: `plot${k + 7}`, plot2: `plot${k + 8}`, options: { color: String(color.new(color.red, tr)) } });
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
export function createRun(inputs: Partial<FibonacciHhLlTramaBandInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciHhLlTramaBandInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciHhLlTramaBand = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
