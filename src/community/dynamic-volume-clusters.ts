/**
 * Dynamic Volume Clusters with Retest Signals
 *
 * The highest high and lowest low over the range lookback give an upper and a lower zone (zone width = a percentage
 * of the range). Each close inside the upper zone restarts the upper line at that close; after two more bars the
 * line becomes the running average of the following closes. The lower line works the same way from the lower zone.
 * The line colours are gradients set by the number of bars (range lookback) whose high-low range contains the line.
 * Retest triangles: close crossing up the upper line while the 5-bar SMA rises (or down the lower line while it
 * falls), within a bar window after the last restart. The candles are coloured by a dynamic price cluster: an
 * adaptive EMA of close (length from the normalised distance between the two lines, faster when that distance
 * changes quickly) smoothed by a simple Kalman-style filter. The volume power values of the Pine script are not
 * used by any Pine output and are not computed.
 *
 * Reference: "Dynamic Volume Clusters with Retest Signals (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicVolumeClustersInputs {
  /** Range lookback period (also the bar count window of the line colours) */
  len: number;
  /** Zone width, % of the range */
  zoneP: number;
  /** Upper line colours (gradient bottom / top) */
  red1: string;
  red2: string;
  /** Lower line colours (gradient bottom / top) */
  green1: string;
  green2: string;
  /** Line width */
  width: number;
  retestSignals: boolean;
  /** Minimum bars after a restart for a retest */
  minBarsBetweenSignals: number;
  /** Maximum bars after a restart for a retest */
  maxBarsBetweenSignals: number;
  /** Lower retest (triangle up) colour */
  retestCol1: string;
  /** Upper retest (triangle down) colour */
  retestCol2: string;
  /** Maximum length of the dynamic price cluster */
  maxLength: number;
  /** Kalman-style filter strength of the price cluster */
  filterStrength: number;
  /** Bar count at the bottom of the cluster colour gradient */
  priceClusterStart: number;
  /** Bar count at the top of the cluster colour gradient */
  priceClusterPeak: number;
  bullishCluster1: string;
  bullishCluster2: string;
  bearishCluster1: string;
  bearishCluster2: string;
}

export const defaultInputs: DynamicVolumeClustersInputs = {
  len: 500,
  zoneP: 1.5,
  red1: color.maroon,
  red2: '#FF0000',
  green1: color.green,
  green2: '#09ff00',
  width: 2,
  retestSignals: true,
  minBarsBetweenSignals: 10,
  maxBarsBetweenSignals: 200,
  retestCol1: color.lime,
  retestCol2: color.red,
  maxLength: 500,
  filterStrength: 0.01,
  priceClusterStart: 2,
  priceClusterPeak: 100,
  bullishCluster1: color.lime,
  bullishCluster2: '#14e4ff',
  bearishCluster1: color.red,
  bearishCluster2: '#14e4ff',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Range Lookback Period', defval: 500, min: 2 },
  { id: 'zoneP', type: 'float', title: 'Zone Width (% of Range)', defval: 1.5, min: 1, max: 50, step: 0.5 },
  { id: 'red1', type: 'color', title: 'Upper Line Color 1', defval: color.maroon },
  { id: 'red2', type: 'color', title: 'Upper Line Color 2', defval: '#FF0000' },
  { id: 'green1', type: 'color', title: 'Lower Line Color 1', defval: color.green },
  { id: 'green2', type: 'color', title: 'Lower Line Color 2', defval: '#09ff00' },
  { id: 'width', type: 'int', title: 'Width', defval: 2, min: 1, max: 10 },
  { id: 'retestSignals', type: 'bool', title: 'Retest Signals', defval: true },
  { id: 'minBarsBetweenSignals', type: 'int', title: 'Minimum Bars to initite a Retest', defval: 10, min: 1 },
  { id: 'maxBarsBetweenSignals', type: 'int', title: 'Maximum Bars Between Retests', defval: 200, min: 1 },
  { id: 'retestCol1', type: 'color', title: 'Retest Color 1', defval: color.lime },
  { id: 'retestCol2', type: 'color', title: 'Retest Color 2', defval: color.red },
  { id: 'maxLength', type: 'int', title: 'Price Cluster Period', defval: 500, min: 1 },
  { id: 'filterStrength', type: 'float', title: 'Cluster Confirmation', defval: 0.01, min: 0.005, max: 1, step: 0.005 },
  { id: 'priceClusterStart', type: 'int', title: 'Price Cluster Start', defval: 2, min: 1 },
  { id: 'priceClusterPeak', type: 'int', title: 'Price Cluster Peak', defval: 100, min: 1 },
  { id: 'bullishCluster1', type: 'color', title: 'Bullish Cluster Color 1', defval: color.lime },
  { id: 'bullishCluster2', type: 'color', title: 'Bullish Cluster Color 2', defval: '#14e4ff' },
  { id: 'bearishCluster1', type: 'color', title: 'Bearish Cluster Color 1', defval: color.red },
  { id: 'bearishCluster2', type: 'color', title: 'Bearish Cluster Color 2', defval: '#14e4ff' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VPMA Upper', color: '#FF0000', lineWidth: 2 },
  { id: 'plot1', title: 'VPMA Lower', color: '#09ff00', lineWidth: 2 },
];

export const metadata = {
  title: 'Dynamic Volume Clusters with Retest Signals (Zeiierman)',
  shortTitle: 'Dynamic Volume Clusters',
  overlay: true,
};

/** Pine a > b: true only when a - b > 1e-10 (float comparison tolerance); false when a value is na */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => gt(b, a);
/** Pine a >= b: not (a < b), false when a value is na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !lt(a, b);
/** Pine a <= b */
const le = (a: number, b: number) => ge(b, a);
/** Pine a == b */
const eq = (a: number, b: number) => ge(a, b) && le(a, b);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };
type Step2 = { step(value: number, length: number): number; commit(): void };

interface DvcVars {
  maU: number;
  lenU: number;
  countU: number;
  maL: number;
  lenL: number;
  countL: number;
  lastU: number;
  lastL: number;
  /** ta.rising(sma, 5) / ta.falling(sma, 5): the counters of rises / falls */
  upCount: number;
  dnCount: number;
  /** dyn_cluster and the kf state */
  dyn: number;
  kf: number;
}

interface DvcRun extends BarRunState<DvcVars> {
  hh: Step2;
  ll: Step2;
  sma: Step2;
  maxAbs: Step2;
  maxDelta: Step2;
  hi5: Step2;
  lo5: Step2;
  tr: ReturnType<typeof taStep.tr>;
  trEma: ReturnType<typeof taStep.ema>;
  vpmU: number[];
  vpmL: number[];
  smaArr: number[];
  countsDiff: number[];
  upperPlot: Point[];
  lowerPlot: Point[];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<DynamicVolumeClustersInputs>): BarStudy<DvcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const gradient = (count: number, bottom: number, top: number, c1: string, c2: string) =>
    String(color.from_gradient(count, bottom, top, color.new(c1, 20 - count), c2));
  return {
    init() {
      const s: DvcRun = {
        hh: taStep.highest(), ll: taStep.lowest(), sma: taStep.sma(), maxAbs: taStep.highest(), maxDelta: taStep.highest(),
        hi5: taStep.highest(), lo5: taStep.lowest(), tr: taStep.tr(false), trEma: taStep.ema(20),
        vpmU: [], vpmL: [], smaArr: [], countsDiff: [], upperPlot: [], lowerPlot: [], candles: [], markers: [],
        steps: [],
        vars: {
          maU: NaN, lenU: 0, countU: 0, maL: NaN, lenL: 0, countL: 0, lastU: 0, lastL: 0, upCount: 0, dnCount: 0,
          dyn: NaN, kf: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.hh, s.ll, s.sma, s.maxAbs, s.maxDelta, s.hi5, s.lo5, s.tr, s.trEma];
      s.lists = [s.markers];
      s.series = [s.vpmU, s.vpmL, s.smaArr, s.countsDiff, s.upperPlot, s.lowerPlot, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const c = b.close;
      const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);

      // Range boundaries: hh = ta.highest(high, len); ll = ta.lowest(low, len)
      const hh = s.hh.step(b.high, cfg.len) ?? NaN;
      const ll = s.ll.step(b.low, cfg.len) ?? NaN;
      const rangee = hh - ll;
      const upperZoneTop = hh;
      const upperZoneBottom = hh - (rangee * cfg.zoneP) / 100;
      const lowerZoneTop = ll + (rangee * cfg.zoneP) / 100;
      const lowerZoneBottom = ll;
      // Restart logic for the upper zone
      if (gt(c, upperZoneBottom) && le(c, upperZoneTop)) {
        v.maU = c;
        v.lenU = 1;
        v.countU = 0;
        v.lastU = i;
      } else if (v.lenU > 0) {
        if (v.countU >= 2) {
          v.maU = (v.maU * v.lenU + c) / (v.lenU + 1);
          v.lenU = v.lenU + 1;
        }
        v.countU = v.countU + 1;
      }
      // Restart logic for the lower zone
      if (ge(c, lowerZoneBottom) && lt(c, lowerZoneTop)) {
        v.maL = c;
        v.lenL = 1;
        v.countL = 0;
        v.lastL = i;
      } else if (v.lenL > 0) {
        if (v.countL >= 2) {
          v.maL = (v.maL * v.lenL + c) / (v.lenL + 1);
          v.lenL = v.lenL + 1;
        }
        v.countL = v.countL + 1;
      }
      const vpmU = s.vpmU;
      const vpmL = s.vpmL;
      vpmU[i] = v.maU;
      vpmL[i] = v.maL;

      // Retest signal logic: sma = ta.sma(close, 5); up = ta.rising(sma, 5); dn = ta.falling(sma, 5)
      const sma = s.sma.step(c, 5) ?? NaN;
      s.smaArr[i] = sma;
      // a step from or to an na (or +/-Infinity) bar leaves the counters unchanged
      const prevSma = i > 0 ? s.smaArr[i - 1] : NaN;
      if (Number.isFinite(sma) && Number.isFinite(prevSma)) {
        v.upCount = sma - prevSma > 1e-10 ? v.upCount + 1 : 0;
        v.dnCount = prevSma - sma > 1e-10 ? v.dnCount + 1 : 0;
      }
      const up = v.upCount >= 5;
      const dn = v.dnCount >= 5;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      // ta.crossover(close, VPMavg_U): close > VPMavg_U and close[1] <= VPMavg_U[1], compared exactly (no 1e-10
      // tolerance; na compares false)
      const crossover = i > 0 && c > vpmU[i] && prevClose <= vpmU[i - 1];
      // ta.crossunder(close, VPMavg_L): close < VPMavg_L and close[1] >= VPMavg_L[1], compared exactly
      const crossunder = i > 0 && c < vpmL[i] && prevClose >= vpmL[i - 1];
      const sinceU = i - v.lastU;
      const sinceL = i - v.lastL;
      const upperRetest = cfg.retestSignals && crossover && up && sinceU >= cfg.minBarsBetweenSignals
        && sinceU <= cfg.maxBarsBetweenSignals && le(at(vpmU, i - 1), vpmU[i]);
      const lowerRetest = cfg.retestSignals && crossunder && dn && sinceL >= cfg.minBarsBetweenSignals
        && sinceL <= cfg.maxBarsBetweenSignals && le(vpmL[i], at(vpmL, i - 1));

      // Dynamic price cluster
      // counts_diff = VPMavg_U - VPMavg_L; max_abs_counts_diff = ta.highest(math.abs(counts_diff), 200)
      const d = vpmU[i] - vpmL[i];
      s.countsDiff[i] = d;
      const maxAbs = s.maxAbs.step(Math.abs(d), 200) ?? NaN;
      // counts_diff_norm = (counts_diff + max_abs) / (2 * max_abs), a plain division; dyn_length = 5 + norm * (max_length - 5)
      const norm = (d + maxAbs) / (2 * maxAbs);
      const dynLength = 5 + norm * (cfg.maxLength - 5);
      // calc_accel_factor(counts_diff, nz(counts_diff[1])): delta = abs(counts_diff - prev);
      // max_delta = ta.highest(delta, 20); max_delta := max_delta == 0 ? 1 : max_delta; delta / max_delta
      const prevD = at(s.countsDiff, i - 1);
      const delta = Math.abs(d - (isNaN(prevD) ? 0 : prevD));
      const m = s.maxDelta.step(delta, 20) ?? NaN;
      const maxDelta = m === 0 ? 1 : m;
      const accel = delta / maxDelta;
      // adjust_alpha(dyn_length, accel_factor, 5.0): alpha = 2 / (dyn_length + 1) * (1 + accel * 5); math.min(1, alpha)
      const a = (2 / (dynLength + 1)) * (1 + accel * 5.0);
      const alpha = isNaN(a) ? NaN : Math.min(1, a);
      // dyn_cluster := na(dyn_cluster[1]) ? close : alpha * close + (1 - alpha) * dyn_cluster[1]
      // kf(src): kfRSI := na(kfRSI) ? src : kfRSI + filterStrength * (src - kfRSI)
      v.dyn = isNaN(v.dyn) ? c : alpha * c + (1 - alpha) * v.dyn;
      v.kf = isNaN(v.kf) ? v.dyn : v.kf + cfg.filterStrength * (v.dyn - v.kf);
      const cluster = v.kf;

      // cluster_color(avg_val, ...): count of the bars i = 0 .. len - 1 with high[i] >= avg_val and low[i] <= avg_val
      const clusterCount = (avg: number) => {
        let count = 0;
        for (let k = 0; k <= cfg.len - 1; k++) {
          const j = i - k;
          if (ge(j >= 0 ? bars[j].high : NaN, avg) && le(j >= 0 ? bars[j].low : NaN, avg)) count += 1;
        }
        return count;
      };

      // U_col = VPMavg_U == close ? na : cluster_color(VPMavg_U, true, false, false)
      const uCol = eq(vpmU[i], c) ? 'transparent' : gradient(clusterCount(vpmU[i]), 5, 15, cfg.red1, cfg.red2);
      const lCol = eq(vpmL[i], c) ? 'transparent' : gradient(clusterCount(vpmL[i]), 5, 15, cfg.green1, cfg.green2);
      // trend_col = dynamic_price_cluster == close ? na : cluster_color(dynamic_price_cluster, false, false, true)
      let trendCol = 'transparent';
      if (!eq(cluster, c)) {
        const count = clusterCount(cluster);
        trendCol = gt(c, cluster)
          ? gradient(count, cfg.priceClusterStart, cfg.priceClusterPeak, cfg.bullishCluster1, cfg.bullishCluster2)
          : gradient(count, cfg.priceClusterStart, cfg.priceClusterPeak, cfg.bearishCluster1, cfg.bearishCluster2);
      }
      s.upperPlot[i] = { time: t, value: vpmU[i], color: uCol };
      s.lowerPlot[i] = { time: t, value: vpmL[i], color: lCol };
      // plotcandle(open, high, low, close, color = trend_col, wickcolor = trend_col, bordercolor = trend_col)
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: c,
        color: trendCol, wickColor: trendCol, borderColor: trendCol };

      // placesell = ta.highest(high, 5) + ta.ema(ta.tr, 20); placebuy = ta.lowest(low, 5) - ta.ema(ta.tr, 20)
      // plotshape(upper_retest ? placesell : na, 'Triangle Dn', shape.triangledown, location.absolute, retest_col_2, size.tiny)
      // plotshape(lower_retest ? placebuy : na, 'Triangle Up', shape.triangleup, location.absolute, retest_col_1, size.tiny)
      // and the 'UI Only' copies: color.new(retest_col, 50), size.normal (ids shape0..shape3 in declaration order)
      const hi5 = s.hi5.step(b.high, 5) ?? NaN;
      const lo5 = s.lo5.step(b.low, 5) ?? NaN;
      const trEma = s.trEma.step(s.tr.step(b.high, b.low, c)) ?? NaN;
      const placeSell = hi5 + trEma;
      const placeBuy = lo5 - trEma;
      const markers = s.markers;
      if (upperRetest && !isNaN(placeSell)) {
        markers.push({ time: t, position: 'atPriceMiddle', price: placeSell, shape: 'triangleDown', color: cfg.retestCol2, size: 'tiny',
          id: 'shape0' });
        markers.push({ time: t, position: 'atPriceMiddle', price: placeSell, shape: 'triangleDown',
          color: String(color.new(cfg.retestCol2, 50)), size: 'normal', id: 'shape2' });
      }
      if (lowerRetest && !isNaN(placeBuy)) {
        markers.push({ time: t, position: 'atPriceMiddle', price: placeBuy, shape: 'triangleUp', color: cfg.retestCol1, size: 'tiny',
          id: 'shape1' });
        markers.push({ time: t, position: 'atPriceMiddle', price: placeBuy, shape: 'triangleUp',
          color: String(color.new(cfg.retestCol1, 50)), size: 'normal', id: 'shape3' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.upperPlot.slice(), plot1: s.lowerPlot.slice() },
        markers: s.markers.slice(),
        plotCandles: { clusterCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicVolumeClustersInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicVolumeClustersInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicVolumeClusters = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
