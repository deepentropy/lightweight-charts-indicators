/**
 * TASC 2025.09 The Continuation Index (John F. Ehlers)
 *
 * us = UltimateSmoother(source, int(length / 2)); lg = an N-order Laguerre filter whose first term is
 * UltimateSmoother(source, length) (the mean of the `order` terms). ref = nz(2 * (us - lg) / sma(|us - lg|, length));
 * the index is the inverse Fisher transform (e^(2 ref) - 1) / (e^(2 ref) + 1). Above 0.5 the line and the bars go
 * from gray to the uptrend colour, below -0.5 they take the downtrend colour, gray otherwise.
 *
 * Reference: "TASC 2025.09 The Continuation Index" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Tasc202509TheContinuationIndexInputs {
  /** Source */
  source: SourceType;
  /** Phase response of the Laguerre terms (0..1) */
  gamma: number;
  /** Order of the Laguerre filter (1..10) */
  order: number;
  /** Calculation length */
  length: number;
  /** Uptrend colour */
  upColor: string;
  /** Downtrend colour */
  downColor: string;
}

export const defaultInputs: Tasc202509TheContinuationIndexInputs = {
  source: 'close',
  gamma: 0.8,
  order: 8,
  length: 40,
  upColor: color.green,
  downColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'close' },
  { id: 'gamma', type: 'float', title: 'Gamma:', defval: 0.8, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'order', type: 'int', title: 'Order:', defval: 8, min: 1, max: 10 },
  { id: 'length', type: 'int', title: 'Length:', defval: 40, min: 3 },
  { id: 'upColor', type: 'color', title: 'Uptrend color:', defval: color.green },
  { id: 'downColor', type: 'color', title: 'Downtrend color:', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Continuation Index', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2025.09 The Continuation Index',
  shortTitle: 'CI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/** UltimateSmoother of the TASC 2024.04 article (one bar at a time): the source itself on the first 4 bars */
class UltimateSmoother {
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;

  constructor(period: number) {
    const a1 = Math.exp((-1.414 * Math.PI) / period);
    this.c2 = 2.0 * a1 * Math.cos((1.414 * Math.PI) / period);
    this.c3 = -a1 * a1;
    this.c1 = (1.0 + this.c2 - this.c3) / 4.0;
  }

  /** The value of bar `i` from the source values `src` and the values `us` of the earlier bars */
  value(src: number[], us: number[], i: number): number {
    const { c1, c2, c3 } = this;
    if (i < 4) return src[i];
    return (1.0 - c1) * src[i] + (2.0 * c1 - c2) * src[i - 1] - (c1 + c3) * src[i - 2]
      + c2 * nz(us[i - 1]) + c3 * nz(us[i - 2]);
  }
}

interface CiVars {
  /** var matrix lg (order x 2, 0.0): column 0 = current, 1 = previous */
  cur: number[];
  prev: number[];
}

interface CiRun extends BarRunState<CiVars> {
  sma: WindowSma;
  src: number[];
  us: number[];
  first: number[];
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
}

type Result = IndicatorResult & { barColors: BarColorData[] };

function study(inputs: Partial<Tasc202509TheContinuationIndexInputs>): BarStudy<CiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { gamma, order, length } = cfg;
  const source = barSource(cfg.source);
  // us = ultimateSmoother(src, int(length / 2)); the first Laguerre term: ultimateSmoother(src, length)
  const usSmoother = new UltimateSmoother(Math.trunc(length / 2));
  const firstSmoother = new UltimateSmoother(length);
  const gray = color.gray;
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(length);
      const s: CiRun = {
        sma, src: [], us: [], first: [], plot0: [], barColors: [],
        steps: [sma], vars: { cur: new Array(order).fill(0.0), prev: new Array(order).fill(0.0) }, lists: [], series: [],
      };
      s.series = [s.src, s.us, s.first, s.plot0, s.barColors];
      return s;
    },
    copyVars: (v) => ({ cur: v.cur.slice(), prev: v.prev.slice() }),
    bar(s, i, bars) {
      const time = bars[i].time;
      s.src[i] = source(bars[i]);
      const us = usSmoother.value(s.src, s.us, i);
      s.us[i] = us;
      const first = firstSmoother.value(s.src, s.first, i);
      s.first[i] = first;
      // laguerreFilter(src, gamma, order, length): changed in place (copied by copyVars)
      const { cur, prev } = s.vars;
      prev[0] = cur[0];
      cur[0] = first;
      let fir = cur[0];
      for (let k = 1; k < order; k++) {
        prev[k] = cur[k];
        cur[k] = gamma * (prev[k] - prev[k - 1]) + prev[k - 1];
        fir += cur[k];
      }
      const lg = fir / order;
      const diff = us - lg;
      const avgAbs = s.sma.step(Math.abs(diff));
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); nz() makes both 0
      const ref = nz((2.0 * diff) / avgAbs);
      const ci = (Math.exp(2.0 * ref) - 1.0) / (Math.exp(2.0 * ref) + 1.0);
      const c = gt(ci, 0.5)
        ? color.from_gradient(ci, 0.5, 1.0, gray, cfg.upColor)
        : lt(ci, -0.5)
          ? color.from_gradient(ci, -0.5, -1.0, cfg.downColor, gray)
          : gray;
      s.plot0[i] = { time, value: Number.isFinite(ci) ? ci : NaN, color: c };
      s.barColors[i] = { time, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Tasc202509TheContinuationIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Tasc202509TheContinuationIndexInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Tasc202509TheContinuationIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
