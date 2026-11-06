/**
 * Volumetric Compressed MA
 *
 * The log of the volume is compressed between bands around its weighted moving average (WMA over
 * `Compression Lookback` bars, plus / minus the weighted standard deviation times the thresholds): the compressed
 * volume is exp(clamped log volume) - exp(lower band). The Compressed MA is ma(close * compressed volume) /
 * ma(compressed volume) over `Comperative Lookback` bars; the second line is ma(close) over the compression
 * lookback (the selected MA type for both). The area between the two lines is teal when the Compressed MA is above,
 * maroon otherwise; circles mark their crossings.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Cross' and 'Bearish Cross' on the bars of the circles.
 *
 * Reference: "Volumetric Compressed MA" by serkany88
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VolumetricCompressedMAType = 'RMA' | 'SMA' | 'EMA' | 'WMA';

export interface VolumetricCompressedMAInputs {
  /** Moving average type */
  maType: VolumetricCompressedMAType;
  /** Upward threshold (multiplier of the upper compression band) */
  upThresh: number;
  /** Downward threshold (multiplier of the lower compression band) */
  downThresh: number;
  /** Compression lookback, also the length of the second line */
  lenWindow: number;
  /** Comparative lookback of the Compressed MA */
  lenMl: number;
}

export const defaultInputs: VolumetricCompressedMAInputs = {
  maType: 'RMA',
  upThresh: 2,
  downThresh: -2,
  lenWindow: 81,
  lenMl: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'RMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
  { id: 'upThresh', type: 'int', title: 'Upward threshold', defval: 2, min: 1 },
  { id: 'downThresh', type: 'int', title: 'Downward threshold', defval: -2, max: -1 },
  { id: 'lenWindow', type: 'int', title: 'Compression Lookback', defval: 81, min: 2 },
  { id: 'lenMl', type: 'int', title: 'Comperative Lookback', defval: 21, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Compressed MA', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'VWMA', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Volumetric Compressed MA',
  shortTitle: 'VCMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface VcmaVars {
  /** ta.crossover / ta.crossunder: the last values where both were not na */
  pa: number;
  pb: number;
}

interface VcmaRun extends BarRunState<VcmaVars> {
  loc: ReturnType<typeof taStep.wma>;
  num: Ma;
  den: Ma;
  vw: Ma;
  data: number[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumetricCompressedMAInputs>): BarStudy<VcmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const ma = (len: number): Ma => {
    switch (cfg.maType) {
      case 'RMA': return taStep.rma(len);
      case 'SMA': return new WindowSma(len);
      case 'EMA': return taStep.ema(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      default: return { step: () => NaN, commit: () => {} };
    }
  };
  // compressor(volume, len_window, up_thresh, down_thresh): thresh_dn_m = up_thresh, thresh_up_m = down_thresh
  const len = cfg.lenWindow;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  // fill(cma, vma, comp_ma > vwma ? color.rgb(0, 137, 123, 70) : color.rgb(136, 14, 79, 70))
  const upFill = String(color.rgb(0, 137, 123, 70));
  const downFill = String(color.rgb(136, 14, 79, 70));
  const overColor = 'rgb(2, 145, 14)';
  return {
    init() {
      const s: VcmaRun = {
        loc: taStep.wma(), num: ma(cfg.lenMl), den: ma(cfg.lenMl), vw: ma(len), data: [], plot0: [], plot1: [],
        fillColors: [], markers: [], flags: [[], []], times: [[], []],
        vars: { pa: NaN, pb: NaN }, steps: [], lists: [], series: [],
      };
      s.steps = [s.loc, s.num, s.den, s.vw];
      s.lists = [s.markers, ...s.times];
      s.series = [s.data, s.plot0, s.plot1, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const v = s.vars;
      const bar = bars[b];
      const time = bar.time;
      const data = s.data;
      data[b] = Math.log(Math.abs(bar.volume ?? NaN));
      const loc = s.loc.step(data[b], len) ?? NaN;
      // wstdev(data, len): wm = ta.wma(data, len) (its own call, the same values as loc)
      const wm = loc;
      let sum = 0.0;
      let sumW = 0.0;
      for (let i = 0; i <= len - 1; i++) {
        const w = len - i;
        const x = b - i >= 0 ? data[b - i] : NaN;
        sum = sum + Math.pow(x - wm, 2) * w;
        sumW = sumW + w;
      }
      const dev = Math.sqrt(sum / sumW);
      const threshDn = loc + dev * cfg.upThresh;
      const threshUp = loc + dev * cfg.downThresh;
      const compressed = Math.exp(Math.min(Math.max(data[b], threshUp), threshDn)) - Math.exp(threshUp);

      // comp_ma = ma(close * compressed_out) / ma(compressed_out); vwma = ma(close, len_window)
      const num = s.num.step(bar.close * compressed) ?? NaN;
      const den = s.den.step(compressed) ?? NaN;
      const compMa = num / den;
      const vwma = s.vw.step(bar.close) ?? NaN;
      s.plot0[b] = { time, value: fin(compMa), color: color.white };
      s.plot1[b] = { time, value: fin(vwma), color: color.blue };
      s.fillColors[b] = gt(compMa, vwma) ? upFill : downFill;

      // ta.crossover / ta.crossunder(comp_ma, vwma): exact comparisons with the last bar where both values were not na
      let crossOver = false;
      let crossUnder = false;
      if (!(isNaN(compMa) || isNaN(vwma))) {
        crossOver = compMa > vwma && v.pa <= v.pb;
        crossUnder = compMa < vwma && v.pa >= v.pb;
        v.pa = compMa;
        v.pb = vwma;
        // plotshape(rule ? vwma : na, style = shape.circle, location = location.absolute, size = size.small)
        if (Number.isFinite(vwma)) {
          if (crossOver) {
            s.markers.push({
              id: 'shape0', time, position: 'atPriceMiddle', price: vwma, shape: 'circle', color: overColor, size: 'small',
            });
          }
          if (crossUnder) {
            s.markers.push({
              id: 'shape1', time, position: 'atPriceMiddle', price: vwma, shape: 'circle', color: color.maroon, size: 'small',
            });
          }
        }
      }
      [crossOver, crossUnder].forEach((f, k) => {
        s.flags[k][b] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        // alertcondition(crossover_rule, "Bullish Cross") / alertcondition(crossunder_rule, "Bearish Cross")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumetricCompressedMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumetricCompressedMAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Cross', message: 'Bullish Crossover Happened' },
  { id: 'alert1', title: 'Bearish Cross', message: 'Bearish Crossunder Happened' },
];

export const VolumetricCompressedMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
