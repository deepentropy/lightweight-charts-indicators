/**
 * TASC 2026.05 The AutoTune Filter
 *
 * John F. Ehlers' AutoTune filter. A high-pass filter (cutoff period `window`, from bar_index 4) is correlated with
 * itself for the lags 1..window over `window` bars: corr = (w * sxy - sx * sy) / sqrt((w * sxx - sx^2) *
 * (w * syy - sy^2)), with sx / sxx the sums of the series and of its squares, sy / syy these sums lag bars ago and
 * sxy the sum of the products of the current window with the window lag bars ago (1 when the correlation is na).
 * The dominant cycle is twice the lag of the lowest correlation, limited to +/- 2 from its previous value. A band-pass
 * filter (bandwidth 0.25, from bar_index 3) centred on the dominant cycle gives the tuned output. The output can be
 * the high-pass filter, the lowest correlation, the dominant cycle or the tuned band-pass filter.
 *
 * Reference: "TASC 2026.05 The AutoTune Filter" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AutoTuneOutput = 'High-pass filter' | 'Min. correlation' | 'Dominant cycle' | 'Tuned band-pass filter';

export interface TascAutoTuneFilterInputs {
  /** Source series */
  source: SourceType;
  /** Window length (high-pass period and autocorrelation window) */
  window: number;
  /** Series shown */
  output: AutoTuneOutput;
}

export const defaultInputs: TascAutoTuneFilterInputs = {
  source: 'close',
  window: 20,
  output: 'Tuned band-pass filter',
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'close' },
  { id: 'window', type: 'int', title: 'Window:', defval: 20, min: 3 },
  {
    id: 'output', type: 'string', title: 'Output:', defval: 'Tuned band-pass filter',
    options: ['High-pass filter', 'Min. correlation', 'Dominant cycle', 'Tuned band-pass filter'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Series', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2026.05 The AutoTune Filter',
  shortTitle: 'AutoTune',
  overlay: false,
};

const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

/** math.sum(x, len) on bar i: sum of the last len values, na until len bars */
function rollingSumAt(x: number[], i: number, len: number): number {
  if (i < len - 1) return NaN;
  let s = 0;
  for (let j = i - len + 1; j <= i; j++) s += x[j];
  return s;
}

interface AutoTuneRun extends BarRunState<Record<string, never>> {
  src: number[];
  hp: number[];
  hp2: number[];
  sx: number[];
  sxx: number[];
  minCorr: number[];
  dc: number[];
  bp: number[];
  plot: { time: number; value: number }[];
}

function study(inputs: Partial<TascAutoTuneFilterInputs>): BarStudy<AutoTuneRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const w = cfg.window;
  const value = barSource(cfg.source);
  // hpf(src, window) constants
  const wc = (1.414 * Math.PI) / w;
  const q = Math.exp(-wc);
  const c1 = 2.0 * q * Math.cos(wc);
  const c2 = q * q;
  const a0 = 0.25 * (1.0 + c1 + c2);
  const bw = 0.25;
  /** the autocorrelation of each lag on the current bar (written again in full on each bar) */
  const acf: number[] = new Array(w).fill(NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: AutoTuneRun = {
        src: [], hp: [], hp2: [], sx: [], sxx: [], minCorr: [], dc: [], bp: [], plot: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.series = [s.src, s.hp, s.hp2, s.sx, s.sxx, s.minCorr, s.dc, s.bp, s.plot];
      return s;
    },
    bar(st, b, bars) {
      const { src, hp, sx, sxx, minCorr, dc, bp } = st;
      src[b] = value(bars[b]);
      const sAt = (i: number) => (i >= 0 ? src[i] : NaN);

      // hpf(src, window); bar_index counts from the first bar of the data
      let res = 0.0;
      if (b >= 4) {
        res = a0 * (src[b] - 2.0 * src[b - 1] + src[b - 2]) + c1 * nz(hp[b - 1]) - c2 * nz(hp[b - 2]);
      }
      hp[b] = res;
      st.hp2[b] = res * res;
      sx[b] = rollingSumAt(hp, b, w);
      sxx[b] = rollingSumAt(st.hp2, b, w);
      // data (var array, unshift / pop): data[j] = hp[j bars ago], na before the first bar
      const h = (j: number) => (j >= 0 ? hp[j] : NaN);

      for (let i = 0; i < w; i++) {
        const lag = i + 1;
        // lData = data[lag]: the array as it was lag bars ago (na before the first bar)
        // sxy = mat.mult(lData).first(): sum of data[j] * lData[j]
        let sxy = NaN;
        if (b - lag >= 0) {
          sxy = 0;
          for (let j = 0; j < w; j++) sxy += h(b - j) * h(b - lag - j);
        }
        const sy = b - lag >= 0 ? sx[b - lag] : NaN;
        const syy = b - lag >= 0 ? sxx[b - lag] : NaN;
        const cov = w * sxy - sx[b] * sy;
        const vx = w * sxx[b] - sx[b] * sx[b];
        const vy = w * syy - sy * sy;
        const den = Math.sqrt(vx * vy);
        // Pine x / 0 is +-Infinity (0 / 0: NaN); nz(corr, 1) replaces both, so NaN gives the same value
        const corr = den === 0 ? NaN : cov / den;
        acf[i] = nz(corr, 1);
      }
      let mc = acf[0];
      for (let i = 1; i < w; i++) if (acf[i] < mc) mc = acf[i];
      minCorr[b] = mc;
      let d = (acf.indexOf(mc) + 1) * 2;
      // dc := nz(math.min(math.max(dc, dc[1] - 2), dc[1] + 2), dc)
      const prev = b > 0 ? dc[b - 1] : NaN;
      if (!isNaN(prev)) d = Math.min(Math.max(d, prev - 2), prev + 2);
      dc[b] = d;

      // bpf(src, dc, 0.25)
      const w0 = (2.0 * Math.PI) / dc[b];
      const l1 = Math.cos(w0);
      const g1 = Math.cos(w0 * bw);
      const s1 = 1.0 / g1 - Math.sqrt(1.0 / (g1 * g1) - 1.0);
      let r = 0.0;
      if (b >= 3) {
        r = 0.5 * (1.0 - s1) * (sAt(b) - sAt(b - 2)) + l1 * (1.0 + s1) * nz(bp[b - 1]) - s1 * nz(bp[b - 2]);
      }
      bp[b] = r;

      const out = cfg.output === 'High-pass filter' ? hp
        : cfg.output === 'Min. correlation' ? minCorr
          : cfg.output === 'Dominant cycle' ? dc
            : bp;
      st.plot[b] = { time: bars[b].time, value: out[b] };
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: st.plot.slice() },
        // hline(0, title = "Zero line"): Pine default colour, dashed, width 1
        hlines: [{ value: 0, options: { title: 'Zero line', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TascAutoTuneFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TascAutoTuneFilterInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TascAutoTuneFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
