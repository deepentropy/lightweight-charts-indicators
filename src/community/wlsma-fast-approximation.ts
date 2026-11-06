/**
 * WLSMA: fast approximation
 *
 * Fast approximation of a weighted least squares moving average over n bars (n = length, or bar_index + 1 when
 * length < 1). With the weights d = n - i (i = 0 for the current bar): f1 = sum(src[i] * d^2) / sum(d^2),
 * f2 = sum(src[i] * d) / sum(d); WLSMA = 4 * f1 - 3 * f2 (na until n bars exist). The line is blue when it rises,
 * red when it falls and purple otherwise.
 *
 * Reference: "WLSMA: fast approximation" by gorx1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WlsmaFastApproximationInputs {
  /** Source */
  src: SourceType;
  /** Window length; below 1 the window is the full history (bar_index + 1) */
  length: number;
}

export const defaultInputs: WlsmaFastApproximationInputs = {
  src: 'close',
  length: 256,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'length', defval: 256 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WLSMAfa', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'WLSMA: fast approximation',
  shortTitle: 'WLSMAfa',
  overlay: true,
  precision: 4,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface WlsmaRun extends BarRunState<Record<string, never>> {
  src: number[];
  f: number[];
  plot0: Point[];
}

function study(inputs: Partial<WlsmaFastApproximationInputs>): BarStudy<WlsmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: WlsmaRun = { src: [], f: [], plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.src, s.f, s.plot0];
      return s;
    },
    bar(st, bi, bars) {
      const src = st.src;
      const f = st.f;
      src[bi] = value(bars[bi]) ?? NaN;
      // wlsma_fast(src, n)
      // len = length < 1 ? bar_index + 1 : length
      const len = cfg.length < 1 ? bi + 1 : cfg.length;
      let f1Sum = 0.0;
      let f2Sum = 0.0;
      const f1SumW = (len * (len + 1) * (2 * len + 1)) / 6;
      const f2SumW = (len * (len + 1)) / 2;
      for (let i = 0; i <= len - 1; i++) {
        const d = len - i;
        // src[i] before the first bar is na: the sums become na
        const s = bi - i >= 0 ? src[bi - i] : NaN;
        f1Sum += s * d * d;
        f2Sum += s * d;
      }
      const f1 = f1Sum / f1SumW;
      const f2 = f2Sum / f2SumW;
      f[bi] = 4 * f1 - 3 * f2;

      // color_f = f > f[1] ? color.blue : f < f[1] ? color.red : color.purple
      const prev = bi > 0 ? f[bi - 1] : NaN;
      const c = gt(f[bi], prev) ? color.blue : lt(f[bi], prev) ? color.red : color.purple;
      st.plot0[bi] = { time: bars[bi].time, value: Number.isFinite(f[bi]) ? f[bi] : NaN, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WlsmaFastApproximationInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WlsmaFastApproximationInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WlsmaFastApproximation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
