/**
 * KDJ Indicator - @iamaltcoin
 *
 * RSV = 100 * (close - lowest low) / (highest high - lowest low) over "period" bars. K is a running average of RSV
 * and D a running average of K: avg = (RSV + (signal - 1) * previous avg) / signal, the previous value taken as 0 when
 * it is na. J = 3 * K - 2 * D. The background is green while J is above D, red otherwise. The original is a Pine v1
 * study: the plot colours carry the default plot transparency 35 of that version.
 *
 * Reference: "KDJ Indicator - @iamaltcoin" by iamaltcoin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This script is released free of charge with no warranty. Please leave a not to the author of this
 * script if it is used whole or in part.
 */

import {
  color,
  type Bar, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KdjIndicatorIamaltcoinInputs {
  /** Bars of the highest high / lowest low */
  ilong: number;
  /** Length of the K and D averages */
  isig: number;
}

export const defaultInputs: KdjIndicatorIamaltcoinInputs = {
  ilong: 9,
  isig: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'ilong', type: 'int', title: 'period', defval: 9 },
  { id: 'isig', type: 'int', title: 'signal', defval: 3 },
];

/** Pine v1 orange / lime / fuchsia with the default plot transparency 35 */
const ORANGE = String(color.new('#FF7F00', 35));
const LIME = String(color.new('#00FF00', 35));
const FUCHSIA = String(color.new('#FF00FF', 35));
/** Pine v1 green / red with transp = 70 */
const BG_GREEN = String(color.new('#008000', 70));
const BG_RED = String(color.new('#FF0000', 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: ORANGE, lineWidth: 1 },
  { id: 'plot1', title: 'D', color: LIME, lineWidth: 1 },
  { id: 'plot2', title: 'J', color: FUCHSIA, lineWidth: 1 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const metadata = {
  title: 'KDJ Indicator - @iamaltcoin',
  shortTitle: 'GM_V2_KDJ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: Bar['time']; value: number; color: string };
type Result = Omit<IndicatorResult, 'bgColors'> & { bgColors: BgColorData[] };

interface KdjVars {
  /** bcwsma(s, l, m) of K and D: the previous value */
  prevK: number;
  prevD: number;
}

interface KdjRun extends BarRunState<KdjVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  plots: Point[][];
  bgColors: BgColorData[];
}

/** bcwsma(s, l, m): (m * s + (l - m) * nz(prev)) / l */
function bcwsma(src: number, l: number, m: number, prev: number): number {
  const v = (m * src + (l - m) * (Number.isNaN(prev) ? 0 : prev)) / l;
  return Number.isFinite(v) ? v : NaN;
}

function study(inputs: Partial<KdjIndicatorIamaltcoinInputs>): BarStudy<KdjRun, Result> {
  const { ilong, isig } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hi = new WindowExtreme(false, ilong);
      const lo = new WindowExtreme(true, ilong);
      const s: KdjRun = {
        hi, lo, plots: [[], [], []], bgColors: [], steps: [hi, lo], vars: { prevK: NaN, prevD: NaN }, lists: [], series: [],
      };
      s.series = [...s.plots, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const h = s.hi.step(b.high);
      const l = s.lo.step(b.low);
      // 0 / 0 is na; x / 0 cannot happen (a zero range means close = low)
      const rsv = 100 * ((b.close - l) / (h - l));
      const pK = bcwsma(rsv, isig, 1, v.prevK);
      const pD = bcwsma(pK, isig, 1, v.prevD);
      v.prevK = pK;
      v.prevD = pD;
      const pJ = 3 * pK - 2 * pD;
      s.plots[0][i] = { time: b.time, value: pK, color: ORANGE };
      s.plots[1][i] = { time: b.time, value: pD, color: LIME };
      s.plots[2][i] = { time: b.time, value: pJ, color: FUCHSIA };
      s.bgColors[i] = { id: 'bgcolor0', time: b.time, color: gt(pJ, pD) ? BG_GREEN : BG_RED };
    },
    result(s) {
      const [plot0, plot1, plot2] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2 },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KdjIndicatorIamaltcoinInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KdjIndicatorIamaltcoinInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const KdjIndicatorIamaltcoin = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
};
