/**
 * SCE Topological Persistent Entropy
 *
 * On each bar the last `lgrLkb` log returns log(close[i] / close[i + 1]) (i = 1..lgrLkb) are cut into pairs of
 * consecutive segments of `windowSize` returns. For each segment a simplified persistence diagram is built: the
 * absolute differences between a return (birth) and each later return (death) of the segment. The lifetimes of the
 * two segments are put into `bins` equal bins between their min and max, and the Shannon entropy of the bin
 * frequencies is computed. The persistent entropy is the mean of these entropies over all segment pairs, with an
 * SMA. The SMA line and the fill between the two lines are red when the entropy is above its SMA, teal otherwise;
 * BULL / BEAR labels on the price chart when the SMA crosses over / under the entropy.
 *
 * Last bar: a BULL / BEAR label needs a closed bar. The port reads the state of the last bar from the optional third
 * argument (see src/chart-context.ts); without it every bar is taken as closed.
 *
 * Reference: "Prometheus Topological Persistent Entropy" by ScorsoneEnterprises
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ScorsoneEnterprises
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface PrometheusTopologicalPersistentEntropyInputs {
  /** Number of closes in each segment */
  windowSize: number;
  /** Number of bins of the entropy */
  bins: number;
  /** Number of log returns */
  lgrLkb: number;
  /** SMA length */
  smaLkb: number;
  /** Plot the BULL / BEAR labels */
  plotBullBear: boolean;
  /** Colour of the persistent entropy line */
  indicColor: string;
  bullColor: string;
  bearColor: string;
  /** Colour transparency (not used by any output of the Pine script) */
  ct: number;
}

export const defaultInputs: PrometheusTopologicalPersistentEntropyInputs = {
  windowSize: 15,
  bins: 20,
  lgrLkb: 50,
  smaLkb: 50,
  plotBullBear: true,
  indicColor: color.white,
  bullColor: color.teal,
  bearColor: color.red,
  ct: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'windowSize', type: 'int', title: 'Window Size', defval: 15 },
  { id: 'bins', type: 'int', title: 'Bins', defval: 20 },
  { id: 'lgrLkb', type: 'int', title: 'How long do you want the log returns to be?', defval: 50 },
  { id: 'smaLkb', type: 'int', title: 'SMA Look Back', defval: 50 },
  { id: 'plotBullBear', type: 'bool', title: 'Would you like the Bull and Bear labels to be plotted?', defval: true },
  { id: 'indicColor', type: 'color', title: 'Persistent Entropy Color ', defval: color.white },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: color.teal },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: color.red },
  { id: 'ct', type: 'int', title: 'Color Transparency', defval: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Persistent Entropy', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Persistent Entropy SMA', color: color.teal, lineWidth: 1 },
];

export const metadata = {
  title: 'SCE Topological Persistent Entropy',
  shortTitle: 'SCE PE',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(Math.abs(a - b) > EPS);

/** Pine `for i = a to b`: counts down when a > b */
function pineFor(a: number, b: number, body: (i: number) => void): void {
  if (a <= b) for (let i = a; i <= b; i++) body(i);
  else for (let i = a; i >= b; i--) body(i);
}

/** Pine array.get: a negative index counts from the end; out of range is a runtime error */
function get(arr: number[], index: number): number {
  return arr[pos(arr, index)];
}

/** Position of a Pine array index (negative: from the end); out of range or na is a runtime error */
function pos(arr: number[], index: number): number {
  const size = arr.length;
  if (!(index >= -size && index < size)) throw new Error(`Index ${index} is out of bounds, array size is ${size}`);
  return index < 0 ? size + index : index;
}

/** array.min / array.max: na values are skipped; an array of only na gives na */
function arrMin(arr: number[]): number {
  let m = NaN;
  for (const v of arr) if (!isNaN(v) && (isNaN(m) || v < m)) m = v;
  return m;
}
function arrMax(arr: number[]): number {
  let m = NaN;
  for (const v of arr) if (!isNaN(v) && (isNaN(m) || v > m)) m = v;
  return m;
}

/** compute_persistence_diagram(segment) */
function persistenceDiagram(segment: number[]): number[] {
  const n = segment.length;
  const lifetimes: number[] = [];
  pineFor(0, n - 1, (i) => {
    // for j = i + 1 to n - 1: on i = n - 1 it counts down (j = n, then n - 1)
    pineFor(i + 1, n - 1, (j) => {
      const birth = get(segment, i);
      const death = get(segment, j - 1);
      if (ne(birth, death)) lifetimes.push(Math.abs(death - birth));
    });
  });
  return lifetimes;
}

/** compute_entropy(values) */
function entropyOf(values: number[], bins: number): number {
  const n = values.length;
  if (n === 0) return 0.0;
  const minVal = arrMin(values);
  const maxVal = arrMax(values);
  if (eq(minVal, maxVal)) return 0.0;
  const binWidth = (maxVal - minVal) / bins;
  const freq: number[] = new Array(Math.max(bins, 0)).fill(0);
  let totalCount = 0;
  pineFor(0, n - 1, (i) => {
    const val = get(values, i);
    if (!isNaN(val)) {
      const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((val - minVal) / binWidth)));
      freq[pos(freq, binIdx)] = get(freq, binIdx) + 1;
      totalCount += 1;
    }
  });
  let entropy = 0.0;
  pineFor(0, bins - 1, (i) => {
    const count = get(freq, i);
    if (count > 0) {
      const p = count / totalCount;
      entropy = entropy - p * Math.log(p);
    }
  });
  return entropy;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PrometheusTopologicalPersistentEntropyInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  // barstate.isconfirmed: every bar is closed, except the last one when the chart context says that it is still open
  const lastBarOpen = !lastBarConfirmedOf(chart);
  const barIsConfirmed = (index: number) => !(lastBarOpen && index === bars.length - 1);
  const cfg = { ...defaultInputs, ...inputs };
  const nBars = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = bars.map((b) => b.close);
  const hist = (b: number, k: number) => (b - k >= 0 ? close[b - k] : NaN);
  const { windowSize, bins, lgrLkb } = cfg;

  /** Entropy of the two segments starting at log return i */
  const pairEntropy = (logReturns: number[], i: number): number => {
    const segment1: number[] = [];
    const segment2: number[] = [];
    pineFor(0, windowSize - 1, (j) => {
      segment1.push(get(logReturns, i + j));
      segment2.push(get(logReturns, i + windowSize + j));
    });
    const combined = persistenceDiagram(segment1).concat(persistenceDiagram(segment2));
    return entropyOf(combined, bins);
  };
  // Return i of a bar is return i + 1 of the next bar, so the pair of segments starting at return i of bar b is the one
  // starting at return i + 1 of bar b + 1: its entropy is computed once, on its first bar, keyed by b - i. This holds
  // when the loops run forward; with other lengths the reversed Pine loops read other indices and nothing is shared.
  const n = lgrLkb - 2 * windowSize + 1;
  const forward = windowSize >= 1 && n >= 1;
  const pairEntropies = new Map<number, number>();

  const smoothPe: number[] = new Array(nBars);
  for (let b = 0; b < nBars; b++) {
    // log_returns: for i = 1 to lgr_lkb: math.log(close[i] / close[i + 1])
    const logReturns: number[] = [];
    pineFor(1, lgrLkb, (i) => {
      logReturns.push(Math.log(hist(b, i) / hist(b, i + 1)));
    });
    // compute_persistent_entropy(log_returns, window_size)
    const entropies: number[] = [];
    pineFor(0, n - 1, (i) => {
      if (!forward) {
        entropies.push(pairEntropy(logReturns, i));
        return;
      }
      let entropy = pairEntropies.get(b - i);
      if (entropy === undefined) {
        entropy = pairEntropy(logReturns, i);
        pairEntropies.set(b - i, entropy);
      }
      entropies.push(entropy);
    });
    // smooth_pe = array.sum(entropies) / array.size(entropies)
    let sum = 0;
    for (const e of entropies) sum += e;
    smoothPe[b] = sum / entropies.length;
  }

  const smaVal = A(ta.sma(S(smoothPe), cfg.smaLkb));
  // pe_color = sma_val < smooth_pe ? bear_color : bull_color
  const peColor = smaVal.map((s, i) => (lt(s, smoothPe[i]) ? cfg.bearColor : cfg.bullColor));

  const t = (i: number) => bars[i].time;
  const plot0 = bars.map((_b, i) => ({ time: t(i), value: Number.isFinite(smoothPe[i]) ? smoothPe[i] : NaN, color: cfg.indicColor }));
  const plot1 = bars.map((_b, i) => ({ time: t(i), value: Number.isFinite(smaVal[i]) ? smaVal[i] : NaN, color: peColor[i] }));

  // bull = plot_bull_bear ? ta.crossover(sma_val, smooth_pe) and barstate.isconfirmed : false; the crossings run on
  // every bar (plot_bull_bear is an input)
  const markers: MarkerData[] = [];
  if (cfg.plotBullBear) {
    const up = ta.crossover(S(smaVal), S(smoothPe)).toArray();
    const down = ta.crossunder(S(smaVal), S(smoothPe)).toArray();
    const white = String(color.rgb(255, 255, 255));
    for (let i = 0; i < nBars; i++) {
      if (up[i] && barIsConfirmed(i)) {
        markers.push({ time: t(i), position: 'belowBar', shape: 'labelUp', color: color.teal, text: 'BULL',
          textColor: white, forceOverlay: true });
      }
      if (down[i] && barIsConfirmed(i)) {
        markers.push({ time: t(i), position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'BEAR',
          textColor: white, forceOverlay: true });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Color Fill' }, colors: peColor }],
    markers,
  };
}

export const PrometheusTopologicalPersistentEntropy = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
