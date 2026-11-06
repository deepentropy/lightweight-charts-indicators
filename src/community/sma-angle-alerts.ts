/**
 * MA Angle Alerts (SMA, EMA, VWMA, WMA)
 *
 * A moving average of the close (SMA, EMA, WMA or VWMA). Its slope over `barsToCheck` bars,
 * (ma - ma[barsToCheck]) / barsToCheck, is turned into an angle in degrees with atan. An "UP" signal (and a green
 * background) is drawn on the first bar where the angle is above the threshold, a "DOWN" signal (and a red
 * background) on the first bar where it is below minus the threshold. The angle is also plotted, with horizontal
 * lines at +- the threshold.
 * Alerts (alertcondition, `alerts` of the result): 'MA Angling Up' / 'MA Angling Down' on the bars of an UP / DOWN
 * signal.
 *
 * Reference: "MA Angle Alerts (SMA, EMA, VWMA, WMA)" by readysetfire
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, taStep, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type SmaAngleAlertsMAType = 'SMA' | 'EMA' | 'WMA' | 'VWMA';

export interface SmaAngleAlertsInputs {
  /** Moving average type */
  maType: SmaAngleAlertsMAType;
  /** Moving average length */
  maLength: number;
  /** Angle threshold (degrees) */
  angleThreshold: number;
  /** Bars to check for the slope */
  barsToCheck: number;
}

export const defaultInputs: SmaAngleAlertsInputs = {
  maType: 'SMA',
  maLength: 9,
  angleThreshold: 35,
  barsToCheck: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 9 },
  { id: 'angleThreshold', type: 'float', title: 'Angle Threshold (Degrees)', defval: 35 },
  { id: 'barsToCheck', type: 'int', title: 'Bars to Check for Slope', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Selected MA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Slope Angle (°)', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'MA Angle Alerts (SMA, EMA, VWMA, WMA)',
  shortTitle: 'MA Angle Alerts (SMA, EMA, VWMA, WMA)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface SaVars {
  /** var bool lastAngleUp / lastAngleDown: updated on every confirmed (historical) bar */
  lastAngleUp: boolean;
  lastAngleDown: boolean;
}

interface SaRun extends BarRunState<SaVars> {
  /** A negative slope length reads later bars: the MA of the whole bar set (null: bar by bar) */
  pre: number[] | null;
  maStep: Ma | null;
  ma: number[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

const upBg = String(color.new(color.green, 85));
const downBg = String(color.new(color.red, 85));

function study(inputs: Partial<SmaAngleAlertsInputs>): BarStudy<SaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { maType, maLength, angleThreshold, barsToCheck } = cfg;
  /** ma[barsToCheck] with a negative length is the value of a later bar */
  const future = barsToCheck < 0;
  // getMA(close, maLength, maType): the type is an input, so the same branch runs on every bar
  const maOf = (): Ma => {
    if (maType === 'EMA') return taStep.ema(maLength);
    if (maType === 'WMA') {
      const m = taStep.wma();
      return { step: (v) => m.step(v, maLength), commit: () => m.commit() };
    }
    if (maType === 'VWMA') return new WindowVwma(maLength);
    return new WindowSma(maLength);
  };
  const maArray = (bars: Bar[]): number[] => {
    const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
    const close = Series.fromArray(bars, bars.map((b) => b.close));
    if (maType === 'EMA') return A(ta.ema(close, maLength));
    if (maType === 'WMA') return A(ta.wma(close, maLength));
    if (maType === 'VWMA') return A(ta.vwma(close, maLength, Series.fromArray(bars, bars.map((b) => b.volume ?? NaN))));
    return A(ta.sma(close, maLength));
  };
  return {
    fullRunReason: () => (future ? 'negative slope length (values of later bars)' : null),
    init(bars) {
      const pre = future ? maArray(bars) : null;
      const maStep = pre ? null : maOf();
      const s: SaRun = {
        pre, maStep, ma: [], plot0: [], plot1: [], bgColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: maStep ? [maStep] : [], vars: { lastAngleUp: false, lastAngleDown: false }, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.ma, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const ma = s.pre ?? s.ma;
      if (!s.pre) s.ma[i] = s.maStep!.step(b.close, b.volume ?? NaN);
      const prev = i - barsToCheck >= 0 ? ma[i - barsToCheck] : NaN;
      // maSlope = (ma - ma[barsToCheck]) / barsToCheck: plain division (0 / 0 is na)
      const maSlope = (ma[i] - prev) / barsToCheck;
      const slopeAngle = Math.atan(maSlope) * (180 / Math.PI);
      const angleUp = gt(slopeAngle, angleThreshold);
      const angleDown = lt(slopeAngle, -angleThreshold);
      const angleUpAlert = angleUp && !s.vars.lastAngleUp;
      const angleDownAlert = angleDown && !s.vars.lastAngleDown;
      // alertcondition(angleUpAlert, "MA Angling Up") / alertcondition(angleDownAlert, "MA Angling Down")
      s.flags[0][i] = angleUpAlert;
      s.flags[1][i] = angleDownAlert;
      if (angleUpAlert) s.times[0].push(t as number);
      if (angleDownAlert) s.times[1].push(t as number);
      s.vars.lastAngleUp = angleUp;
      s.vars.lastAngleDown = angleDown;

      s.plot0[i] = { time: t, value: ma[i] };
      s.plot1[i] = { time: t, value: Number.isFinite(slopeAngle) ? slopeAngle : NaN };
      // bgcolor(angleUpAlert ? green 85 : na), then bgcolor(angleDownAlert ? red 85 : na) (drawn on top)
      if (angleDownAlert) s.bgColors.push({ time: t, color: downBg });
      else if (angleUpAlert) s.bgColors.push({ time: t, color: upBg });
      // plotshape(..., style = shape.labelup / labeldown, text = "UP" / "DOWN"), default text colour
      if (angleUpAlert) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'UP', textColor: color.blue });
      }
      if (angleDownAlert) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'DOWN', textColor: color.blue });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: angleThreshold, options: { title: 'Upper Threshold', color: color.green, linestyle: 'dotted' } },
          { value: -angleThreshold, options: { title: 'Lower Threshold', color: color.red, linestyle: 'dotted' } },
        ],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmaAngleAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmaAngleAlertsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MA Angling Up', message: 'MA is angling up beyond threshold.' },
  { id: 'alert1', title: 'MA Angling Down', message: 'MA is angling down beyond threshold.' },
];

export const SmaAngleAlerts = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
