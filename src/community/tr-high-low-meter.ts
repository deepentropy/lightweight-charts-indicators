/**
 * TR High/Low meter
 *
 * On a bar where the highest source of the look-back window rises, the true range is added to a list; on a bar
 * where the lowest source falls, minus the true range is added. The list keeps the last `lookBack` entries and the
 * meter is their sum (optionally smoothed by an EMA), drawn as an area. Its colour is green above zero and red below,
 * with a transparency from the count of advances (declines below zero) since the zero cross relative to the highest
 * count so far. Optional no-trade-zone lines and a circle on 0 inside the zone; a +1 / -1 line gives the sign.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' when the meter crosses up through 0 (through the high
 * threshold with the no-trade zone), 'Sell Signal' the mirror, 'Neutral Signal' when it falls back below the high
 * threshold (always, as the original) or rises back above the low threshold (with the no-trade zone).
 *
 * Reference: "TR High/Low meter" by dman103
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dman103
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrHighLowMeterInputs {
  /** Look-back of the highest / lowest source and length of the true range list */
  lookBack: number;
  src: SourceType;
  /** EMA smoothing of the meter */
  emaSmooth: boolean;
  emaLength: number;
  /** Colour the bars with the meter colour */
  colorBars: boolean;
  /** Use the no-trade zone (alerts and the zone circle) */
  useThreshold: boolean;
  /** Draw the no-trade zone lines */
  displayTradeZoneLines: boolean;
  longThreshold: number;
  shortThreshold: number;
}

export const defaultInputs: TrHighLowMeterInputs = {
  lookBack: 7,
  src: 'close',
  emaSmooth: false,
  emaLength: 7,
  colorBars: false,
  useThreshold: false,
  displayTradeZoneLines: false,
  longThreshold: 10,
  shortThreshold: -10,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookBack', type: 'int', title: 'Look back', defval: 7 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'emaSmooth', type: 'bool', title: 'EMA smoothing', defval: false },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 7 },
  { id: 'colorBars', type: 'bool', title: 'Color bars', defval: false },
  { id: 'useThreshold', type: 'bool', title: 'Use no trade zone', defval: false, group: 'No trade zone' },
  { id: 'displayTradeZoneLines', type: 'bool', title: 'Display trade zones lines', defval: false, group: 'No trade zone' },
  { id: 'longThreshold', type: 'float', title: 'High Threshold', defval: 10, step: 0.5, min: 0, group: 'No trade zone' },
  { id: 'shortThreshold', type: 'float', title: 'Low Threshold', defval: -10, step: 0.5, max: 0, group: 'No trade zone' },
];

const ZONE_COL = String(color.new(color.blue, 44));
const NEUTRAL_COL = String(color.new(color.white, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TR High/Low Meter', color: color.green, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'High Threshold', color: ZONE_COL, lineWidth: 2 },
  { id: 'plot2', title: 'Low Threshold', color: ZONE_COL, lineWidth: 2 },
  { id: 'plot3', title: 'External Indicator 1 or -1]', color: color.blue, lineWidth: 1 },
  { id: 'plot4', title: 'Neutral Zone', color: NEUTRAL_COL, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'TR High/Low meter',
  shortTitle: 'TR HL meter',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface TrVars {
  /** var float[] arr: +TR on a new highest, -TR on a new lowest, the last lookBack entries kept (changed in place) */
  arr: number[];
  /** var float _maxAdvDec = 0. */
  maxAdvDec: number;
  /** var float _qtyAdvDec = 0. */
  qtyAdvDec: number;
  /** var color _return = na */
  ret: string | null;
  /** ta.crossover / crossunder: the last bar where the source was not na */
  last: number;
}

interface TrRun extends BarRunState<TrVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  tr: ReturnType<typeof taStep.tr>;
  ema: ReturnType<typeof taStep.ema> | null;
  hi: number[];
  lo: number[];
  result: number[];
  plots: Point[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrHighLowMeterInputs>): BarStudy<TrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  const zoneLines = cfg.useThreshold && cfg.displayTradeZoneLines;
  // long_Condition / short_Condition / neutral_Condition of the original
  const L = cfg.longThreshold;
  const S = cfg.shortThreshold;
  const useT = cfg.useThreshold;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: TrRun = {
        highest: new WindowExtreme(false, cfg.lookBack), lowest: new WindowExtreme(true, cfg.lookBack),
        tr: taStep.tr(false), ema: cfg.emaSmooth ? taStep.ema(cfg.emaLength) : null,
        hi: [], lo: [], result: [], plots: Array.from({ length: 5 }, () => []), barColors: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { arr: [], maxAdvDec: 0, qtyAdvDec: 0, ret: null, last: NaN }, lists: [], series: [],
      };
      s.steps = [s.highest, s.lowest, s.tr, ...(s.ema ? [s.ema] : [])];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.hi, s.lo, s.result, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = source(b);
      const hi = s.hi;
      const lo = s.lo;
      hi[i] = s.highest.step(src);
      lo[i] = s.lowest.step(src);
      const tr = s.tr.step(b.high, b.low, b.close);

      const arr = v.arr;
      if (i > 0 && gt(hi[i], hi[i - 1])) {
        arr.push(tr);
        while (arr.length > cfg.lookBack) arr.shift();
      }
      if (i > 0 && lt(lo[i], lo[i - 1])) {
        arr.push(-tr);
        while (arr.length > cfg.lookBack) arr.shift();
      }
      // array.sum: na for an empty array, na values skipped
      let sum = NaN;
      for (const a of arr) if (!isNaN(a)) sum = isNaN(sum) ? a : sum + a;
      const x = s.ema ? s.ema.step(sum) : sum;
      s.result[i] = x;

      // f_c_gradientAdvDec(plot_result, 0, color.red, color.green)
      // ta.crossover(_source, 0) / ta.crossunder(_source, 0) compare exactly (no 1e-10 tolerance)
      const xUp = !isNaN(x) && !isNaN(v.last) && x > 0 && v.last <= 0;
      const xDn = !isNaN(x) && !isNaN(v.last) && x < 0 && v.last >= 0;
      if (!isNaN(x)) v.last = x;
      const x1 = i > 0 ? s.result[i - 1] : NaN;
      const chg = i > 0 ? x - x1 : NaN;
      const up = gt(chg, 0);
      const dn = lt(chg, 0);
      const srcBull = gt(x, 0);
      const srcBear = lt(x, 0);
      const qty = v.qtyAdvDec;
      v.qtyAdvDec = srcBull
        ? (xUp ? 1 : up ? qty + 1 : dn ? Math.max(1, qty - 1) : qty)
        : srcBear
          ? (xDn ? 1 : dn ? qty + 1 : up ? Math.max(1, qty - 1) : qty)
          : qty;
      v.maxAdvDec = Math.max(v.maxAdvDec, v.qtyAdvDec);
      // 0 / 0 (no advance yet) gives na: color.new(c, na) is transparent
      const transp = 100 - (v.qtyAdvDec * 100) / v.maxAdvDec - 50;
      const withT = (c: string) => (isNaN(transp) ? 'transparent' : String(color.new(c, transp)));
      v.ret = srcBull ? withT(color.green) : srcBear ? withT(color.red) : v.ret;
      const plotColor = v.ret;

      const t = b.time;
      const p = s.plots;
      p[0][i] = { time: t, value: x, color: plotColor ?? 'transparent' };
      if (cfg.colorBars && plotColor !== null) s.barColors.push({ time: t, color: plotColor });
      p[1][i] = { time: t, value: zoneLines ? cfg.longThreshold : NaN, color: ZONE_COL };
      p[2][i] = { time: t, value: zoneLines ? cfg.shortThreshold : NaN, color: ZONE_COL };
      // plot(plot_result > 0 ? 1 : -1, "External Indicator 1 or -1]", editable = false)
      p[3][i] = { time: t, value: gt(x, 0) ? 1 : -1, color: color.blue };
      // neutral_plot = plot_result < LongThreshold and plot_result > ShortThreshold
      const neutral = lt(x, cfg.longThreshold) && gt(x, cfg.shortThreshold);
      p[4][i] = { time: t, value: cfg.useThreshold && neutral ? 0 : NaN, color: NEUTRAL_COL };

      const flags = [
        (ge(x, 0) && gt(x, L) && lt(x1, L) && useT) || (ge(x, 0) && lt(x1, 0) && !useT),
        (le(x, 0) && lt(x, S) && gt(x1, S) && useT) || (le(x, 0) && gt(x1, 0) && !useT),
        (lt(x, L) && gt(x1, L)) || (gt(x, S) && lt(x1, S) && useT),
      ];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    copyVars: (v) => ({ ...v, arr: v.arr.slice() }),
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrHighLowMeterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrHighLowMeterInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal' },
  { id: 'alert2', title: 'Neutral Signal', message: 'Neutral Signal' },
];

export const TrHighLowMeter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
