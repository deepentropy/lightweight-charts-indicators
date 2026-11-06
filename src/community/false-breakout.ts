/**
 * False Breakout (Expo)
 *
 * Detects false breakouts by identifying new highs/lows followed by
 * price reversal (crossing back through the breakout level).
 * A false breakout up occurs when price makes consecutive new highs
 * then crosses below the breakout level. Vice versa for down.
 * Draws horizontal lines from breakout bar to current bar at breakout price level.
 * Alerts (alertcondition, `alerts` of the result): 'False Breakout Up' and 'False Breakout Down', true on the bars of
 * these signals.
 *
 * Reference: "False Breakout (Expo)" by Zeiierman
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FalseBreakoutInputs {
  period: number;
  minPeriod: number;
  maxPeriod: number;
  maType: 'none' | 'WMA' | 'HMA';
  smoothLength: number;
  aggressive: boolean;
}

export const defaultInputs: FalseBreakoutInputs = {
  period: 20,
  minPeriod: 5,
  maxPeriod: 5,
  maType: 'none',
  smoothLength: 10,
  aggressive: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'False Breakout Period', defval: 20, min: 2 },
  { id: 'minPeriod', type: 'int', title: 'New Breakout within min X bars', defval: 5, min: 0 },
  { id: 'maxPeriod', type: 'int', title: 'Signal valid for X bars', defval: 5, min: 1 },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'none', options: ['none', 'WMA', 'HMA'] },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Length', defval: 10, min: 1 },
  { id: 'aggressive', type: 'bool', title: 'Aggressive', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'False Breakout (Expo)',
  shortTitle: 'FalseBrk',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; lines: LineDrawingData[] } & { alerts: AlertConditionState[] };
type Smooth = { step(v: number): number; commit(): void };

interface FbVars {
  val: number;
  /** val[1] in Pine: previous bar's final val for crossunder/crossover */
  prevVal: number;
  count: number;
  /** most recent breakout bar */
  indx0: number;
  /** previous breakout bar */
  indx1: number;
}

interface FbRun extends BarRunState<FbVars> {
  hiRaw: WindowExtreme;
  loRaw: WindowExtreme;
  hiSmooth: Smooth | null;
  loSmooth: Smooth | null;
  hiArr: number[];
  loArr: number[];
  markers: MarkerData[];
  lines: LineDrawingData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FalseBreakoutInputs>): BarStudy<FbRun, Result> {
  const { period, minPeriod, maxPeriod, maType, smoothLength, aggressive } = { ...defaultInputs, ...inputs };
  const warmup = period + 2;
  // Apply optional smoothing
  const smooth = (): Smooth | null => {
    if (maType === 'WMA') {
      const m = taStep.wma();
      return { step: (v) => m.step(v, smoothLength), commit: () => m.commit() };
    }
    if (maType === 'HMA') return taStep.hma(smoothLength);
    return null;
  };
  return {
    init() {
      // ta.highest / ta.lowest over period
      const hiRaw = new WindowExtreme(false, period);
      const loRaw = new WindowExtreme(true, period);
      const hiSmooth = smooth();
      const loSmooth = smooth();
      const s: FbRun = {
        hiRaw, loRaw, hiSmooth, loSmooth, hiArr: [], loArr: [], markers: [], lines: [], flags: [[], []], times: [[], []],
        steps: [hiRaw, loRaw, ...(hiSmooth && loSmooth ? [hiSmooth, loSmooth] : [])],
        vars: { val: NaN, prevVal: NaN, count: 0, indx0: 0, indx1: 0 },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.lines, ...s.times];
      s.series = [s.hiArr, s.loArr, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // Build source series for highest/lowest
      // aggressive: highest uses low, lowest uses high (tighter detection)
      const hiRaw = s.hiRaw.step(aggressive ? b.low : b.high);
      const loRaw = s.loRaw.step(aggressive ? b.high : b.low);
      const hi = s.hiSmooth ? s.hiSmooth.step(hiRaw) : hiRaw;
      const lo = s.loSmooth ? s.loSmooth.step(loRaw) : loRaw;
      s.hiArr[i] = hi;
      s.loArr[i] = lo;

      // Detect new high/low conditions:
      // condHi = hi > hi[1] and hi[1] <= hi[2]  (transition to new high)
      // condLo = lo < lo[1] and lo[1] >= lo[2]  (transition to new low)
      let condHi = false;
      let condLo = false;
      if (i >= 2) {
        const h1 = s.hiArr[i - 1], h2 = s.hiArr[i - 2];
        const l1 = s.loArr[i - 1], l2 = s.loArr[i - 2];
        if (!isNaN(hi) && !isNaN(h1) && !isNaN(h2)) condHi = hi > h1 && h1 <= h2;
        if (!isNaN(lo) && !isNaN(l1) && !isNaN(l2)) condLo = lo < l1 && l1 >= l2;
      }

      s.flags[0][i] = false;
      s.flags[1][i] = false;

      // Track new highs (count goes negative)
      if (condHi) {
        if (v.count > 0) v.count = 0;
        v.count = v.count - 1;
        v.val = b.low;
        v.indx1 = v.indx0;
        v.indx0 = i;
      }

      // Track new lows (count goes positive)
      if (condLo) {
        if (v.count < 0) v.count = 0;
        v.count = v.count + 1;
        v.val = b.high;
        v.indx1 = v.indx0;
        v.indx0 = i;
      }

      const val = v.val;
      if (i < warmup || isNaN(val)) {
        v.prevVal = val;
        return;
      }

      const c = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const prevVal = v.prevVal;

      // Crossunder: close crosses below val (Pine: ta.crossunder(c, val))
      // Uses current val for current bar, prevVal for previous bar comparison
      const breakdown = !isNaN(prevClose) && !isNaN(prevVal) && prevClose >= prevVal && c < val;
      // Crossover: close crosses above val (Pine: ta.crossover(c, val))
      const breakup = !isNaN(prevClose) && !isNaN(prevVal) && prevClose <= prevVal && c > val;

      // Min bars between breakouts
      const minbars = v.indx1 + minPeriod < v.indx0;
      // Signal still valid (within maxPeriod bars of last breakout)
      const maxvalid = i - maxPeriod <= v.indx0;

      // False breakout up: multiple new highs (count < -1), then price breaks down
      const falsebreakoutup = v.count < -1 && breakdown && maxvalid && minbars;
      // False breakout down: multiple new lows (count > 1), then price breaks up
      const falsebreakoutdown = v.count > 1 && breakup && maxvalid && minbars;
      // alertcondition(falsebreakoutup) / alertcondition(falsebreakoutdown)
      s.flags[0][i] = falsebreakoutup;
      s.flags[1][i] = falsebreakoutdown;
      if (falsebreakoutup) s.times[0].push(b.time as number);
      if (falsebreakoutdown) s.times[1].push(b.time as number);

      if (falsebreakoutup) {
        v.count = 0;
        s.markers.push({
          time: b.time as number,
          position: 'aboveBar',
          shape: 'triangleDown',
          color: '#f23645',
          text: 'False Up',
        });
        s.lines.push({
          time1: bars[v.indx0].time,
          price1: val,
          time2: b.time,
          price2: val,
          color: '#f23645',
          width: 2,
          style: 'solid',
        });
      }

      if (falsebreakoutdown) {
        v.count = 0;
        s.markers.push({
          time: b.time as number,
          position: 'belowBar',
          shape: 'triangleUp',
          color: '#6ce5a0',
          text: 'False Down',
        });
        s.lines.push({
          time1: bars[v.indx0].time,
          price1: val,
          time2: b.time,
          price2: val,
          color: '#6ce5a0',
          width: 2,
          style: 'solid',
        });
      }

      v.prevVal = val;
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        lines: s.lines.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FalseBreakoutInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FalseBreakoutInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'False Breakout Up', message: 'False Breakout Up' },
  { id: 'alert1', title: 'False Breakout Down', message: 'False Breakout Down' },
];

export const FalseBreakout = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
