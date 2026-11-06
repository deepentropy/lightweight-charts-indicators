/**
 * VuManChu Swing Free
 *
 * Range filter-based momentum indicator with buy/sell signals.
 * Uses EMA-based smoothing for range size calculation and a
 * ratcheting filter that tracks price movement.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the bars of the original's
 * longCondition / shortCondition (first long / short condition after the opposite one, from the first bar on).
 * As the original, the range size is na until both EMAs have their window (avrng from bar n, AC from bar 3n - 2):
 * while it is na the filter keeps the first source value and the bands are na. The filter is drawn from the first
 * bar (#05ff9b up / #ff0583 down / #cccccc flat at transparency 67), the BUY / SELL labels and the bar colours on
 * every bar where the original's conditions are true.
 *
 * Reference: "Range Filter - B&S Signals" (VuManChu Swing Free)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VuManChuSwingInputs {
  swingPeriod: number;
  swingMultiplier: number;
  useBarColor: boolean;
}

export const defaultInputs: VuManChuSwingInputs = {
  swingPeriod: 20,
  swingMultiplier: 3.5,
  useBarColor: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'swingPeriod', type: 'int', title: 'Swing Period', defval: 20, min: 1 },
  { id: 'swingMultiplier', type: 'float', title: 'Swing Multiplier', defval: 3.5, min: 0.0000001, step: 0.5 },
  { id: 'useBarColor', type: 'bool', title: 'Bar Colors On/Off', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#2962FF', lineWidth: 3 },
  { id: 'plot1', title: 'High Band', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Low Band', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'VuManChu Swing Free',
  shortTitle: 'VMC Swing',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface SwingVars {
  rf: number;
  fdir: number;
  condIni: number;
}

interface SwingRun extends BarRunState<SwingVars> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VuManChuSwingInputs>): BarStudy<SwingRun, Result> {
  const { swingPeriod, swingMultiplier, useBarColor } = { ...defaultInputs, ...inputs };
  const wper = swingPeriod * 2 - 1;
  return {
    init() {
      const ema1 = taStep.ema(swingPeriod);
      const ema2 = taStep.ema(wper);
      const s: SwingRun = {
        ema1, ema2, plot0: [], plot1: [], plot2: [], flags: [[], []], times: [[], []], markers: [], barColors: [],
        steps: [ema1, ema2], vars: { rf: NaN, fdir: 0, condIni: 0 }, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.barColors];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const src = bars[i].close ?? NaN;
      const src1 = i > 0 ? (bars[i - 1].close ?? NaN) : NaN;

      // Range Size: avrng = ema(abs(x - x[1]), n), AC = ema(avrng, wper) * qty, wper = n * 2 - 1 (x[1] is na on bar 0)
      const absChange = i === 0 ? NaN : Math.abs(src - src1);
      const avrng = s.ema1.step(absChange);
      const ac = s.ema2.step(avrng);
      const r = ac == null ? NaN : ac * swingMultiplier;

      // Range Filter: var rfilt = array.new_float(2, x) (the first bar's source); if x - r > rfilt[1] -> x - r;
      // if x + r < rfilt[1] -> x + r (both tests are false while r is na)
      if (i === 0) v.rf = src;
      const prevFilt = v.rf;
      if (src - r > prevFilt) v.rf = src - r;
      if (src + r < prevFilt) v.rf = src + r;
      const filt = v.rf;

      // var fdir = 0.0; fdir := filt > filt[1] ? 1 : filt < filt[1] ? -1 : fdir
      const f1 = i > 0 ? prevFilt : NaN;
      v.fdir = filt > f1 ? 1 : filt < f1 ? -1 : v.fdir;
      const fdir = v.fdir;

      // longCond = rng_src > filt and rng_src > rng_src[1] and upward > 0 or rng_src > filt and rng_src < rng_src[1] and upward > 0
      // shortCond = rng_src < filt and rng_src < rng_src[1] and downward > 0 or rng_src < filt and rng_src > rng_src[1] and downward > 0
      // CondIni := longCond ? 1 : shortCond ? -1 : CondIni[1]; longCondition = longCond and CondIni[1] == -1 (shortCondition
      // mirrored); rng_src[1] is na on bar 0, an unchanged source matches neither side
      const upward = fdir === 1;
      const downward = fdir === -1;

      const longCond = src > filt && src > src1 && upward || src > filt && src < src1 && upward;
      const shortCond = src < filt && src < src1 && downward || src < filt && src > src1 && downward;
      const prev = v.condIni;
      v.condIni = longCond ? 1 : shortCond ? -1 : v.condIni;
      const longCondition = longCond && prev === -1;
      const shortCondition = shortCond && prev === 1;
      s.flags[0][i] = longCondition;
      s.flags[1][i] = shortCondition;
      if (longCondition) s.times[0].push(time as number);
      if (shortCondition) s.times[1].push(time as number);

      if (longCondition) {
        s.markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'BUY', textColor: '#FFFFFF', size: 'normal' });
      }
      if (shortCondition) {
        s.markers.push({ id: 'shape1', time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'SELL', textColor: '#FFFFFF', size: 'normal' });
      }

      // barcolor(use_barcolor ? bar_color : na)
      if (useBarColor) {
        let color: string;
        if (upward && src > filt) {
          color = src > src1 ? '#05ff9b' : '#00b36b';
        } else if (downward && src < filt) {
          color = src < src1 ? '#ff0583' : '#b8005d';
        } else {
          color = '#cccccc';
        }
        s.barColors.push({ id: 'barcolor0', time, color });
      }

      // plot(filt, color = filt_color, transp = 67, linewidth = 3): filt_color = upward ? #05ff9b : downward ? #ff0583 :
      // #cccccc, at 33 % opacity
      const color = fdir === 1 ? 'rgba(5,255,155,0.33)' : fdir === -1 ? 'rgba(255,5,131,0.33)' : 'rgba(204,204,204,0.33)';
      s.plot0[i] = { time, value: filt, color };
      s.plot1[i] = { time, value: filt + r };
      s.plot2[i] = { time, value: filt - r };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(0,179,107,0.08)' } },
          { plot1: 'plot2', plot2: 'plot0', options: { color: 'rgba(184,0,93,0.08)' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(longCondition, "Buy Alert") / alertcondition(shortCondition, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VuManChuSwingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VuManChuSwingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'BUY' },
  { id: 'alert1', title: 'Sell Alert', message: 'SELL' },
];

export const VuManChuSwing = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
