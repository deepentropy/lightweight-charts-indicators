/**
 * Simplified Percentile Clustering (SPC)
 *
 * Six features: RSI, CCI, Fisher transform of hl2, DMI difference (+DI - -DI), z-score of the close and close / MA
 * (SMA or EMA); RSI, CCI, Fisher, DMI and MAR can be standardised with a z-score over `lookback` bars. For each
 * feature the last `lookback` values are sorted; the centers are the averages of the SMA(lookback) with the lower
 * and with the upper percentile value (index floor((size - 1) * pct / 100) of the sorted values, na values last),
 * plus the SMA itself as the middle center when K = 3. Each bar goes to the nearest center: in "Clusters" mode the
 * distance is the average of the absolute feature distances of the enabled features, else the distance of the
 * chosen feature. The "Clusters" line interpolates between the nearest and the second nearest cluster index by
 * min / (min + second) distance; histograms show the cluster, step lines the centers, and the bars take the
 * cluster colour (gray when the plotted value is na).
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "SPC: Market regime shifted → Now in
 * cluster k<n>" on each bar whose cluster differs from the cluster of the bar before (and on bar 0, where the cluster
 * of the bar before is na: the comparison is false).
 *
 * Reference: "Simplified Percentile Clustering" by InvestorUnknown
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © InvestorUnknown
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

type MainPlot = 'Clusters' | 'RSI' | 'CCI' | 'Fisher' | 'DMI' | 'Z-Score' | 'MAR';

export interface SimplifiedPercentileClusteringInputs {
  useRsi: boolean;
  rsiLength: number;
  rsiStandardize: boolean;
  useCci: boolean;
  cciLength: number;
  cciStandardize: boolean;
  useFisher: boolean;
  fisherLength: number;
  fisherStandardize: boolean;
  useDmi: boolean;
  dmiLength: number;
  dmiStandardize: boolean;
  useZscore: boolean;
  zscoreLength: number;
  useMar: boolean;
  marLength: number;
  /** Moving average of the close / MA feature */
  maType: 'SMA' | 'EMA';
  marStandardize: boolean;
  /** Number of cluster centers (2 or 3) */
  k: number;
  /** Bars of the percentile, SMA and standardisation windows */
  lookback: number;
  pLow: number;
  pHigh: number;
  mainPlot: MainPlot;
  /** Plot the cluster line in "Clusters" mode */
  plotClusterLine: boolean;
}

export const defaultInputs: SimplifiedPercentileClusteringInputs = {
  useRsi: true,
  rsiLength: 14,
  rsiStandardize: true,
  useCci: true,
  cciLength: 20,
  cciStandardize: true,
  useFisher: true,
  fisherLength: 9,
  fisherStandardize: true,
  useDmi: true,
  dmiLength: 9,
  dmiStandardize: true,
  useZscore: true,
  zscoreLength: 20,
  useMar: true,
  marLength: 14,
  maType: 'SMA',
  marStandardize: true,
  k: 2,
  lookback: 1000,
  pLow: 5.0,
  pHigh: 95.0,
  mainPlot: 'Clusters',
  plotClusterLine: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'useRsi', type: 'bool', title: 'Use RSI', defval: true },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiStandardize', type: 'bool', title: 'Standardize RSI', defval: true },
  { id: 'useCci', type: 'bool', title: 'Use CCI', defval: true },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'cciStandardize', type: 'bool', title: 'Standardize CCI', defval: true },
  { id: 'useFisher', type: 'bool', title: 'Use Fisher', defval: true },
  { id: 'fisherLength', type: 'int', title: 'Fisher Length', defval: 9 },
  { id: 'fisherStandardize', type: 'bool', title: 'Standardize Fisher', defval: true },
  { id: 'useDmi', type: 'bool', title: 'Use DMI', defval: true },
  { id: 'dmiLength', type: 'int', title: 'DMI Length', defval: 9 },
  { id: 'dmiStandardize', type: 'bool', title: 'Standardize DMI', defval: true },
  { id: 'useZscore', type: 'bool', title: 'Use Z-Score', defval: true },
  { id: 'zscoreLength', type: 'int', title: 'Z-Score Length', defval: 20 },
  { id: 'useMar', type: 'bool', title: 'Use MAR', defval: true },
  { id: 'marLength', type: 'int', title: 'MA Length', defval: 14 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA'] },
  { id: 'marStandardize', type: 'bool', title: 'Standardize MAR', defval: true },
  { id: 'k', type: 'int', title: 'K Clusters', defval: 2, min: 2, max: 3 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 1000 },
  { id: 'pLow', type: 'float', title: 'Lower Percentile', defval: 5.0 },
  { id: 'pHigh', type: 'float', title: 'Upper Percentile', defval: 95.0 },
  { id: 'mainPlot', type: 'string', title: 'Main Plot', defval: 'Clusters', options: ['Clusters', 'RSI', 'CCI', 'Fisher', 'DMI', 'Z-Score', 'MAR'] },
  { id: 'plotClusterLine', type: 'bool', title: 'Plot Cluster Line', defval: false },
];

const RED20 = String(color.new(color.red, 20));
const GREEN20 = String(color.new(color.green, 20));
const ORANGE20 = String(color.new(color.orange, 20));
const GRAY80 = String(color.new(color.gray, 80));
const GUIDE = String(color.new(color.gray, 70));
const RED30 = String(color.new(color.red, 30));
const GREEN30 = String(color.new(color.green, 30));
const ORANGE30 = String(color.new(color.orange, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Guide Line 1', color: GUIDE, lineWidth: 1 },
  { id: 'plot1', title: 'Guide Line 2', color: GUIDE, lineWidth: 1 },
  { id: 'plot2', title: 'Clusers line', color: String(color.new(color.green, 50)), lineWidth: 1 },
  { id: 'plot3', title: 'Cluster Circles', color: GREEN20, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Cluster k0 Histogram', color: RED20, lineWidth: 1, style: 'histogram', histbase: 0 },
  { id: 'plot5', title: 'Cluster k1 Histogram', color: GREEN20, lineWidth: 1, style: 'histogram', histbase: 1 },
  { id: 'plot6', title: 'Cluster k2 Histogram', color: GREEN20, lineWidth: 1, style: 'histogram', histbase: 2 },
  { id: 'plot7', title: 'k0 Cluster Center', color: RED30, lineWidth: 2, style: 'stepline' },
  { id: 'plot8', title: 'k1 Cluster Center', color: GREEN30, lineWidth: 2, style: 'stepline' },
  { id: 'plot9', title: 'k2 Cluster Center', color: GREEN30, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Simplified Percentile Clustering',
  shortTitle: 'SPC',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/**
 * x / y with NaN when y is 0: only used where Pine can only get 0 / 0 (NaN) or where Pine itself guards y == 0.
 * A plain Pine division with a non-zero x / 0 gives +/-infinity (see zScore and mar).
 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
/** Pine na() is also true for +/-infinity, and a plot draws nothing for it */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

/** get_centers state: the last `lookback` values (insertion order, with na) and the non-na ones sorted ascending */
interface CentersState {
  window: number[];
  sorted: number[];
  naCount: number;
}

/** The first index of `sorted` whose value is not below `v` */
function findSorted(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (sorted[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * get_centers: the last `lookback` values in a var array, sorted ascending with the na values last (Pine
 * array.sort), lower / upper percentile = sorted[floor((size - 1) * pct / 100)], middle = SMA(x, lookback).
 * `out` receives the centers of the bar.
 */
function centersStep(st: CentersState, x: number, mid: number, lookback: number, pLow: number, pHigh: number, k: number, out: number[]): void {
  const { window, sorted } = st;
  const find = (v: number) => findSorted(sorted, v);
  // array.push(x_arr, x); if array.size(x_arr) > lookback: array.shift(x_arr)
  window.push(x);
  if (isNaN(x)) st.naCount++;
  else sorted.splice(find(x), 0, x);
  if (window.length > lookback) {
    const old = window.shift() as number;
    if (isNaN(old)) st.naCount--;
    else sorted.splice(find(old), 1);
  }
  const size = window.length;
  const pct = (p: number) => {
    const idx = Math.floor(((size - 1) * p) / 100);
    return idx >= 0 && idx < sorted.length ? sorted[idx] : NaN; // indexes >= sorted.length hold na
  };
  const xHigh = pct(pHigh);
  const xLow = pct(pLow);
  const c0 = (xLow + mid) / 2;
  const c1 = (xHigh + mid) / 2;
  if (k === 2) {
    out[0] = c0;
    out[1] = c1;
  } else {
    out[0] = c0;
    out[1] = mid;
    out[2] = c1;
  }
}

type Result = IndicatorResult & { barColors: BarColorData[]; alertCalls: AlertCall[] };

/** Adds `x` exactly to the `n` non-overlapping partials `p` (Shewchuk's algorithm); the new count */
function addExact(p: Float64Array, n: number, x: number): number {
  let i = 0;
  for (let j = 0; j < n; j++) {
    let y = p[j];
    if (Math.abs(x) < Math.abs(y)) {
      const t = x;
      x = y;
      y = t;
    }
    const hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) p[i++] = lo;
    x = hi;
  }
  p[i] = x;
  return i + 1;
}

/** The exact sum of the partials rounded once (round half to even), as Python `math.fsum` */
function roundExact(p: Float64Array, count: number): number {
  let n = count;
  if (n === 0) return 0;
  let hi = p[--n];
  while (n > 0) {
    const x = hi;
    const y = p[--n];
    hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) {
      // half-way case: the rest has the same sign, so round away from the tie
      if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) {
        const y2 = lo * 2;
        const x2 = hi + y2;
        if (y2 === x2 - hi) hi = x2;
      }
      break;
    }
  }
  return hi;
}

/** Exact window sum partials with a committed state and the state of the current step */
class Partials {
  p = new Float64Array(64);
  n = 0;
  q = new Float64Array(64);
  m = 0;

  /** The partials with `out` removed (unless NaN) and `x` added, from the committed state, rounded */
  step(out: number, x: number): number {
    if (this.q.length < this.n + 3) this.q = new Float64Array(this.q.length * 2);
    this.q.set(this.p.subarray(0, this.n));
    let m = this.n;
    if (!Number.isNaN(out)) m = addExact(this.q, m, -out);
    m = addExact(this.q, m, x);
    this.m = m;
    return roundExact(this.q, m);
  }

  commit(): void {
    const t = this.p;
    this.p = this.q;
    this.q = t;
    this.n = this.m;
  }
}

/**
 * `ta.sma(source, length)` and `ta.stdev(source, length)` of one source with a constant length, one bar at a time:
 * the correctly rounded window sums of the last `length` non-na values (and of their squares) of the library
 * functions (same doubles); a bar with an na value keeps the previous sums.
 */
class WindowSums implements Committable {
  private readonly values: number[] = [];
  private readonly sums = new Partials();
  private readonly squares: Partials | null;
  private lastSum = NaN;
  private lastSq = NaN;
  private pendingSum = NaN;
  private pendingSq = NaN;
  private pending = NaN;
  private stepped = false;
  sum = NaN;
  sq = NaN;

  constructor(private readonly len: number, withSquares: boolean) {
    this.squares = withSquares ? new Partials() : null;
  }

  step(x: number): void {
    this.stepped = true;
    this.pending = x;
    if (!Number.isFinite(x)) {
      this.sum = this.pendingSum = this.lastSum;
      this.sq = this.pendingSq = this.lastSq;
      return;
    }
    const count = this.values.length;
    const out = count >= this.len ? this.values[count - this.len] : NaN;
    const ready = count + 1 >= this.len;
    const sum = this.sums.step(out, x);
    this.sum = this.pendingSum = ready ? sum : NaN;
    if (this.squares) {
      const sq = this.squares.step(Number.isNaN(out) ? NaN : out * out, x * x);
      this.sq = this.pendingSq = ready ? sq : NaN;
    }
  }

  /** ta.sma: the sum divided by the length */
  get mean(): number {
    return this.sum / this.len;
  }

  /** ta.stdev (biased): the square root of sumSq / n - mean * mean (0 when it is not positive) */
  get stdev(): number {
    const mean = this.sum / this.len;
    const v = this.sq / this.len - mean * mean;
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.lastSum = this.pendingSum;
    this.lastSq = this.pendingSq;
    if (!Number.isFinite(this.pending)) return;
    this.values.push(this.pending);
    this.sums.commit();
    this.squares?.commit();
  }
}

/**
 * z_score(src, length) = (src - ta.sma(src, length)) / ta.stdev(src, length): a plain division (x / 0 is
 * +/-infinity). ta.sma / ta.stdev skip +/-infinity values like na, so they get the series with NaN there.
 */
function zScore(m: WindowSums, x: number): number {
  m.step(fin(x));
  return (x - m.mean) / m.stdev;
}

type Point = { time: number; value: number; color: string };

interface SpcVars {
  /** fisher(): var value / fish */
  value: number;
  fish: number;
  /** fixnan() of +DI / -DI */
  plus: number;
  minus: number;
  centers: CentersState[];
}

interface SpcRun extends BarRunState<SpcVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  cci: ReturnType<typeof taStep.cci>;
  hi: ReturnType<typeof taStep.highest>;
  lo: ReturnType<typeof taStep.lowest>;
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  plusR: ReturnType<typeof taStep.rma>;
  minusR: ReturnType<typeof taStep.rma>;
  ma: { step(v: number): number; commit(): void };
  /** z-scores of RSI, CCI, Fisher, DMI, the close and MAR (null: not standardised) */
  z: Array<WindowSums | null>;
  /** x_mid = ta.sma(x, lookback) of each feature */
  mids: WindowSums[];
  clusterVal: number[];
  plots: Point[][];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<SimplifiedPercentileClusteringInputs>): BarStudy<SpcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lookback, k, mainPlot } = cfg;
  const uses: number[] = [cfg.useRsi, cfg.useCci, cfg.useFisher, cfg.useDmi, cfg.useZscore, cfg.useMar].map((u) => (u ? 1 : 0));
  const useCount = uses.reduce((a, b) => a + b, 0);
  const single: Record<string, number> = { RSI: 0, CCI: 1, Fisher: 2, DMI: 3, 'Z-Score': 4, MAR: 5 };
  const f = mainPlot === 'Clusters' ? -1 : single[mainPlot];
  const clusters = mainPlot === 'Clusters';
  const colorOf = (cluster: number) => (k === 2
    ? (cluster === 0 ? RED20 : cluster === 1 ? GREEN20 : GRAY80)
    : (cluster === 0 ? RED20 : cluster === 1 ? ORANGE20 : cluster === 2 ? GREEN20 : GRAY80));
  const round = (v: number) => (gt(v, 0.99) ? 0.999 : lt(v, -0.99) ? -0.999 : v);
  const zLengths = [lookback, lookback, lookback, lookback, cfg.zscoreLength, lookback];
  const standardize = [cfg.rsiStandardize, cfg.cciStandardize, cfg.fisherStandardize, cfg.dmiStandardize, true, cfg.marStandardize];
  // values of the bar (reused)
  const feats: number[] = new Array(6).fill(NaN);
  const centers: number[][] = Array.from({ length: 6 }, () => [NaN, NaN, NaN]);
  return {
    init() {
      const ma = cfg.maType === 'EMA'
        ? (() => { const m = taStep.ema(cfg.marLength); return { step: (v: number) => m.step(v), commit: () => m.commit() }; })()
        : (() => { const m = taStep.sma(); return { step: (v: number) => m.step(v, cfg.marLength), commit: () => m.commit() }; })();
      const s: SpcRun = {
        rsi: taStep.rsi(cfg.rsiLength), cci: taStep.cci(cfg.cciLength), hi: taStep.highest(), lo: taStep.lowest(),
        tr: taStep.tr(false), trur: taStep.rma(cfg.dmiLength), plusR: taStep.rma(cfg.dmiLength), minusR: taStep.rma(cfg.dmiLength),
        ma,
        z: standardize.map((on, j) => (on ? new WindowSums(zLengths[j], true) : null)),
        mids: Array.from({ length: 6 }, () => new WindowSums(lookback, false)),
        clusterVal: [], plots: Array.from({ length: 10 }, () => []), barColors: [], alertCalls: [],
        steps: [],
        vars: {
          value: NaN, fish: NaN, plus: NaN, minus: NaN,
          centers: Array.from({ length: 6 }, () => ({ window: [], sorted: [], naCount: 0 })),
        },
        lists: [], series: [],
      };
      s.steps = [
        s.rsi, s.cci, s.hi, s.lo, s.tr, s.trur, s.plusR, s.minusR, s.ma,
        ...s.z.filter((m) => m !== null), ...s.mids,
      ];
      s.lists = [s.alertCalls];
      s.series = [s.clusterVal, ...s.plots, s.barColors];
      return s;
    },
    bar(s, t, bars) {
      const b = bars[t];
      const close = b.close;
      const v = s.vars;
      const feature = (j: number, x: number) => (s.z[j] ? zScore(s.z[j]!, x) : x);

      // RSI, CCI
      feats[0] = feature(0, s.rsi.step(close) ?? NaN);
      feats[1] = feature(1, s.cci.step(close) ?? NaN);

      // fisher(len): value := round_(.66 * ((hl2 - low_) / (high_ - low_) - .5) + .67 * nz(value[1]))
      const hl2 = (b.high + b.low) / 2;
      const hi = s.hi.step(hl2, cfg.fisherLength) ?? NaN;
      const lo = s.lo.step(hl2, cfg.fisherLength) ?? NaN;
      v.value = round(0.66 * (div(hl2 - lo, hi - lo) - 0.5) + 0.67 * (isNaN(v.value) ? 0 : v.value));
      v.fish = 0.5 * Math.log((1 + v.value) / (1 - v.value)) + 0.5 * (isNaN(v.fish) ? 0 : v.fish);
      feats[2] = feature(2, v.fish);

      // dmi_difference(len): fixnan(100 * rma(plusDM) / rma(tr)) - fixnan(100 * rma(minusDM) / rma(tr))
      const up = t > 0 ? b.high - bars[t - 1].high : NaN;
      const down = t > 0 ? -(b.low - bars[t - 1].low) : NaN;
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const trur = s.trur.step(s.tr.step(b.high, b.low, close) ?? NaN) ?? NaN;
      const plusR = s.plusR.step(plusDM) ?? NaN;
      const minusR = s.minusR.step(minusDM) ?? NaN;
      const p = div(100 * plusR, trur);
      const m = div(100 * minusR, trur);
      if (!isNaN(p)) v.plus = p; // fixnan
      if (!isNaN(m)) v.minus = m;
      feats[3] = feature(3, v.plus - v.minus);

      // z-score of the close
      feats[4] = zScore(s.z[4]!, close);

      // close / MA
      const ma = s.ma.step(close) ?? NaN;
      feats[5] = feature(5, close / ma); // plain division: x / 0 is +/-infinity

      // centers of each feature: x_mid = ta.sma(x, lookback) (skips +/-infinity like na); the sorted window keeps
      // +/-infinity in numeric order
      for (let j = 0; j < 6; j++) {
        s.mids[j].step(fin(feats[j]));
        const mid = s.mids[j].mean;
        centersStep(v.centers[j], feats[j], mid, lookback, cfg.pLow, cfg.pHigh, k, centers[j]);
      }

      let minDist = NaN;
      let secondMinDist = NaN;
      let curr = -1; // curr_cluster (index of "k0" / "k1" / "k2")
      let second = -1;
      for (let i = 0; i < k; i++) {
        let dist: number;
        if (f >= 0) {
          dist = Math.abs(feats[f] - centers[f][i]);
        } else {
          // average of the feature distances weighted by on_off(use_*) (na * 0 is na)
          let sum = 0;
          for (let j = 0; j < 6; j++) sum += Math.abs(feats[j] - centers[j][i]) * uses[j];
          dist = div(sum, useCount);
        }
        // na(min_dist) or dist < min_dist (na() is true for +/-infinity)
        if (!Number.isFinite(minDist) || lt(dist, minDist)) {
          secondMinDist = minDist;
          second = curr;
          minDist = dist;
          curr = i;
        } else if (!Number.isFinite(secondMinDist) || lt(dist, secondMinDist)) {
          secondMinDist = dist;
          second = i;
        }
      }
      const cluster = curr; // cluster_val (curr_cluster is never na: the loop runs k >= 2 times)
      // rel_pos = second_min_dist == 0 ? 0 : min_dist / (min_dist + second_min_dist)
      const relPos = !isNaN(secondMinDist) && Math.abs(secondMinDist) <= EPS ? 0 : div(minDist, minDist + secondMinDist);
      const secondVal = second === 0 ? 0 : second === 1 ? 1 : 2;
      const realClust = cluster + (secondVal - cluster) * relPos;
      const pv = f >= 0 ? feats[f] : realClust;
      s.clusterVal[t] = cluster;
      // if not (curr_cluster == curr_cluster[1]): alert("SPC: Market regime shifted → Now in cluster " +
      //   str.tostring(curr_cluster), freq = alert.freq_once_per_bar_close) (curr_cluster[1] is na on bar 0)
      if (t === 0 || s.clusterVal[t - 1] !== cluster) {
        s.alertCalls.push({ time: b.time as number, message: 'SPC: Market regime shifted → Now in cluster k' + cluster, freq: 'once_per_bar_close' });
      }
      const cur = !Number.isFinite(pv) ? GRAY80 : colorOf(cluster); // if na(plot_val): gray
      const kc0 = f >= 0 ? centers[f][0] : 0;
      const kc1 = f >= 0 ? centers[f][1] : 1;
      const kc2 = f >= 0 ? (k > 2 ? centers[f][2] : NaN) : k > 2 ? 2 : 0;

      const time = b.time;
      const has = Number.isFinite(pv);
      const P = s.plots;
      const put = (n: number, value: number, col: string) => { P[n][t] = { time, value: fin(value), color: col }; };
      put(0, has && clusters ? 0.5 : NaN, GUIDE);
      put(1, has && clusters && k === 3 ? 1.5 : NaN, GUIDE);
      // plot(main_plot == "Clusters" ? (plot_cl ? plot_val : na) : plot_val, color = color.new(curr_color, 50))
      put(2, clusters ? (cfg.plotClusterLine ? pv : NaN) : pv, String(color.new(cur, 50)));
      put(3, pv, cur);
      put(4, clusters && cluster === 0 ? pv : NaN, cur);
      put(5, clusters && cluster === 1 ? pv : NaN, cur);
      put(6, clusters && cluster === 2 ? pv : NaN, cur);
      put(7, has && k >= 1 ? kc0 : NaN, RED30);
      put(8, has && k >= 2 ? kc1 : NaN, k <= 2 ? GREEN30 : ORANGE30);
      put(9, has && k === 3 ? kc2 : NaN, GREEN30);
      // barcolor(curr_color)
      s.barColors[t] = { time: time as number, color: cur };
    },
    copyVars: (v) => ({
      ...v,
      centers: v.centers.map((c) => ({ window: c.window.slice(), sorted: c.sorted.slice(), naCount: c.naCount })),
    }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, n) => { plots[`plot${n}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        barColors: s.barColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SimplifiedPercentileClusteringInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SimplifiedPercentileClusteringInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SimplifiedPercentileClustering = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
