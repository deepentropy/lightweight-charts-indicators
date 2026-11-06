/**
 * Volume-Weighted Pivot Bands
 *
 * A rolling volume-weighted average of hlc3 over `length` bars (running sums of volume and hlc3 * volume, the value
 * of `length` bars back removed), optionally smoothed by an SMA, is the pivot. Five resistance and five support bands
 * are spaced by (highest high - lowest low over `length` bars) * multiplier above and below the pivot. All lines can
 * be shifted by a plot offset.
 *
 * Alerts (alertcondition, `alerts` of the result): the close crossing over R1 .. R5 and under S1 .. S5 (the bands
 * without the plot offset).
 *
 * Reference: "Volume-Weighted Pivot Bands" by LeafAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWeightedPivotBandsInputs {
  /** Rolling length of the volume-weighted price and of the range */
  length: number;
  /** Multiplier of the R levels */
  multR: number;
  /** Multiplier of the S levels */
  multS: number;
  /** Smooth the pivot with an SMA */
  smoothPivot: boolean;
  /** SMA length of the pivot smoothing */
  pivotSmoothLength: number;
  /** Plot offset of all lines (bars) */
  offsetPivots: number;
}

export const defaultInputs: VolumeWeightedPivotBandsInputs = {
  length: 20,
  multR: 0.25,
  multS: 0.25,
  smoothPivot: true,
  pivotSmoothLength: 20,
  offsetPivots: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Rolling Length', defval: 20 },
  { id: 'multR', type: 'float', title: 'Multiplier for R Levels', defval: 0.25 },
  { id: 'multS', type: 'float', title: 'Multiplier for S Levels', defval: 0.25 },
  { id: 'smoothPivot', type: 'bool', title: 'Smooth Pivot?', defval: true },
  { id: 'pivotSmoothLength', type: 'int', title: 'Pivot Smooth Length (SMA)', defval: 20 },
  { id: 'offsetPivots', type: 'int', title: 'Pivot Plot Offset', defval: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'R1', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot1', title: 'R2', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot2', title: 'R3', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot3', title: 'R4', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot4', title: 'R5', color: color.fuchsia, lineWidth: 2 },
  { id: 'plot5', title: 'S1', color: color.lime, lineWidth: 2 },
  { id: 'plot6', title: 'S2', color: color.lime, lineWidth: 2 },
  { id: 'plot7', title: 'S3', color: color.lime, lineWidth: 2 },
  { id: 'plot8', title: 'S4', color: color.lime, lineWidth: 2 },
  { id: 'plot9', title: 'S5', color: color.lime, lineWidth: 2 },
  { id: 'plot10', title: 'VWAP Pivot', color: color.gray, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Volume-Weighted Pivot Bands',
  shortTitle: 'Volume-Weighted Pivot Bands',
  overlay: true,
};

/** Pine float `!=`: false within 1e-10 and when a value is na */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface VwpbVars {
  volSum: number;
  volPriceSum: number;
}

interface VwpbRun extends BarRunState<VwpbVars> {
  sma: WindowSma | null;
  hh: WindowExtreme;
  ll: WindowExtreme;
  /** r1..r5 then s1..s5, then the pivot */
  lines: number[][];
  /** the points of each line (plot offset 0) */
  points: Point[][];
  flags: boolean[][];
  times: number[][];
}

const LINE_COLORS = [...new Array(5).fill(color.fuchsia), ...new Array(5).fill(color.lime), color.gray] as string[];

function study(inputs: Partial<VolumeWeightedPivotBandsInputs>): BarStudy<VwpbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const off = cfg.offsetPivots;
  const vol = (b: Bar) => {
    const v = b.volume;
    return v === undefined || v === null ? NaN : v;
  };
  // price = (high + low + close) / 3
  const price = (b: Bar) => (b.high + b.low + b.close) / 3;
  return {
    init() {
      const s: VwpbRun = {
        sma: cfg.smoothPivot ? new WindowSma(cfg.pivotSmoothLength) : null, hh: new WindowExtreme(false, length), ll: new WindowExtreme(true, length),
        lines: Array.from({ length: 11 }, () => []), points: Array.from({ length: 11 }, () => []),
        flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []),
        steps: [], vars: { volSum: NaN, volPriceSum: NaN }, lists: [], series: [],
      };
      s.steps = [...(s.sma ? [s.sma] : []), s.hh, s.ll];
      s.lists = s.times;
      s.series = [...s.lines, ...s.points, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const j = i - length;
      const volJ = j >= 0 ? vol(bars[j]) : NaN;
      const priceJ = j >= 0 ? price(bars[j]) : NaN;
      const oldVolume = isNaN(volJ) ? 0 : volJ;
      const oldVolprice = isNaN(volJ) || isNaN(priceJ) ? 0 : volJ * priceJ;
      // vol_sum := nz(vol_sum[1]) + volume - old_volume
      v.volSum = nz(v.volSum) + vol(b) - oldVolume;
      v.volPriceSum = nz(v.volPriceSum) + price(b) * vol(b) - oldVolprice;
      const vwapPrice = ne(v.volSum, 0) ? v.volPriceSum / v.volSum : NaN;
      const pivot = s.sma ? s.sma.step(vwapPrice) : vwapPrice;
      const range = s.hh.step(b.high) - s.ll.step(b.low);
      let rv = pivot;
      let sv = pivot;
      for (let k = 0; k < 5; k++) {
        rv = rv + range * cfg.multR;
        sv = sv - range * cfg.multS;
        s.lines[k][i] = rv;
        s.lines[k + 5][i] = sv;
      }
      s.lines[10][i] = pivot;
      const c = b.close;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      for (let k = 0; k < 11; k++) {
        const val = s.lines[k][i];
        if (off === 0) s.points[k][i] = { time: b.time, value: Number.isFinite(val) ? val : NaN, color: LINE_COLORS[k] };
        if (k === 10) break;
        // alertcondition(ta.crossover(close, r1..r5), ...) / alertcondition(ta.crossunder(close, s1..s5), ...)
        const pv = i > 0 ? s.lines[k][i - 1] : NaN;
        const f = k < 5 ? c > val && pc <= pv : c < val && pc >= pv;
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      if (off === 0) {
        for (let k = 0; k < 11; k++) plots[`plot${k}`] = s.points[k].slice();
      } else {
        // plot(..., offset = offset_pivots): the value of bar i is drawn on bar i + offset
        const interval = barInterval(bars);
        for (let k = 0; k < 11; k++) {
          const vals = s.lines[k];
          const out: Point[] = [];
          for (let i = 0; i < n; i++) {
            if (i + off < 0) continue;
            const val = vals[i];
            out.push({ time: barTime(bars, i + off, interval), value: Number.isFinite(val) ? val : NaN, color: LINE_COLORS[k] });
          }
          plots[`plot${k}`] = out;
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedPivotBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedPivotBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  ...[1, 2, 3, 4, 5].map((k) => ({ id: `alert${k - 1}`, title: `Cross Above R${k}`, message: `Price crossed above R${k}` })),
  ...[1, 2, 3, 4, 5].map((k) => ({ id: `alert${k + 4}`, title: `Cross Below S${k}`, message: `Price crossed below S${k}` })),
];

export const VolumeWeightedPivotBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
