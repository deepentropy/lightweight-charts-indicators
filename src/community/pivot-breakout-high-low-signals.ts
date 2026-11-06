/**
 * Pivot Breakout High&Low Signals [JPT]
 *
 * The last pivot high and pivot low (pivot length bars on each side) are kept as levels. A close crossing above the
 * last pivot high stores it as the bullish breakout level and waits for a retest; a close crossing below the last
 * pivot low stores the bearish level. A retest is a bar whose low (bullish) or high (bearish) is within the retest
 * tolerance of the level while the close stays beyond it. With the EMA trend filter, a BUY also needs a close above
 * the EMA and a SELL a close below it. BUY / SELL triangles and a background tint mark the signals; a signal ends the
 * wait for a retest until the next breakout.
 * Alerts (alertcondition, `alerts` of the result): the BUY / SELL signals, and with 'Enable Alerts' the breakouts,
 * retests, signals, closes crossing the EMA (with the EMA filter) and new pivots.
 *
 * Reference: "Pivot Breakout High&Low Signals [JPT]" by Jos-ProTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PivotBreakoutHighLowSignalsInputs {
  /** Pivot length (bars on each side of the pivot) */
  pivotLen: number;
  /** Retest tolerance in percent of the breakout level */
  retestTolerance: number;
  /** Use the EMA trend filter (also shows the EMA) */
  emaFilter: boolean;
  /** EMA length */
  emaLength: number;
  /** Enable Alerts: the advanced alertconditions (all but 'Buy Alert' / 'Sell Alert') */
  enableAlerts: boolean;
}

export const defaultInputs: PivotBreakoutHighLowSignalsInputs = {
  pivotLen: 5,
  retestTolerance: 0.3,
  emaFilter: true,
  emaLength: 200,
  enableAlerts: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 5, min: 2 },
  { id: 'retestTolerance', type: 'float', title: 'Retest Tolerance (%)', defval: 0.3, step: 0.1 },
  { id: 'emaFilter', type: 'bool', title: 'Use EMA Trend Filter', defval: true },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 200 },
  { id: 'enableAlerts', type: 'bool', title: 'Enable Alerts', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'Last Pivot High', color: color.red, lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Last Pivot Low', color: color.lime, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Pivot Breakout High&Low Signals [JPT]',
  shortTitle: 'PBHL [JPT]',
  overlay: true,
};

// Pine operators compare floats with a tolerance of 1e-10; a comparison with na is false.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface PivotVars {
  lastPivotHigh: number; // var float lastPivotHigh
  lastPivotLow: number; // var float lastPivotLow
  bullLevel: number; // var float bullLevel
  bearLevel: number; // var float bearLevel
  waitingBullRetest: boolean;
  waitingBearRetest: boolean;
  /** close, lastPivotHigh, lastPivotLow and the EMA of the bar before (the crosses) */
  pClose: number;
  pHigh: number;
  pLow: number;
  pEma: number;
}

interface PivotRun extends BarRunState<PivotVars> {
  ema: ReturnType<typeof taStep.ema>;
  ph: PivotStep;
  pl: PivotStep;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

const buyBg = String(color.new(color.green, 85));
const sellBg = String(color.new(color.red, 85));

function study(inputs: Partial<PivotBreakoutHighLowSignalsInputs>): BarStudy<PivotRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { pivotLen, emaFilter, emaLength } = cfg;
  const retestTolerance = cfg.retestTolerance / 100;
  const on = cfg.enableAlerts;
  return {
    init() {
      const s: PivotRun = {
        // ema = ta.ema(close, emaLength)
        ema: taStep.ema(emaLength),
        // pivotHigh = ta.pivothigh(high, pivotLen, pivotLen); pivotLow = ta.pivotlow(low, pivotLen, pivotLen)
        ph: new PivotStep(pivotLen, pivotLen, true),
        pl: new PivotStep(pivotLen, pivotLen, false),
        plot0: [], plot1: [], plot2: [], markers: [], bgColors: [],
        flags: Array.from({ length: 12 }, () => []), times: Array.from({ length: 12 }, () => []),
        steps: [],
        vars: {
          lastPivotHigh: NaN, lastPivotLow: NaN, bullLevel: NaN, bearLevel: NaN,
          waitingBullRetest: false, waitingBearRetest: false, pClose: NaN, pHigh: NaN, pLow: NaN, pEma: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.ema, s.ph, s.pl];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const ema = s.ema.step(close);
      const pivotHigh = s.ph.step(i, b.high);
      const pivotLow = s.pl.step(i, b.low);
      if (!isNaN(pivotHigh)) v.lastPivotHigh = pivotHigh;
      if (!isNaN(pivotLow)) v.lastPivotLow = pivotLow;
      const lastHigh = v.lastPivotHigh;
      const lastLow = v.lastPivotLow;

      // bullBreakout = ta.crossover(close, lastPivotHigh); bearBreakout = ta.crossunder(close, lastPivotLow)
      // (exact comparisons, no 1e-10 tolerance; a tie on the previous bar counts: close[1] <= level[1]; na gives false)
      const bullBreakout = i > 0 && close > lastHigh && v.pClose <= v.pHigh;
      const bearBreakout = i > 0 && close < lastLow && v.pClose >= v.pLow;
      if (bullBreakout) {
        v.bullLevel = lastHigh;
        v.waitingBullRetest = true;
      }
      if (bearBreakout) {
        v.bearLevel = lastLow;
        v.waitingBearRetest = true;
      }

      // bullRetest = waiting and low <= level * (1 + tol) and low >= level * (1 - tol) and close > level
      const bullRetest = v.waitingBullRetest && le(b.low, v.bullLevel * (1 + retestTolerance))
        && ge(b.low, v.bullLevel * (1 - retestTolerance)) && gt(b.close, v.bullLevel);
      // bearRetest = waiting and high >= level * (1 - tol) and high <= level * (1 + tol) and close < level
      const bearRetest = v.waitingBearRetest && ge(b.high, v.bearLevel * (1 - retestTolerance))
        && le(b.high, v.bearLevel * (1 + retestTolerance)) && gt(v.bearLevel, b.close);

      // buySignal = bullRetest and (not emaFilter or close > ema); sellSignal = bearRetest and (not emaFilter or close < ema)
      const buySignal = bullRetest && (!emaFilter || gt(b.close, ema));
      const sellSignal = bearRetest && (!emaFilter || gt(ema, b.close));
      if (buySignal) v.waitingBullRetest = false;
      if (sellSignal) v.waitingBearRetest = false;

      // plotshape(buySignal, 'BUY', location.belowbar, shape.triangleup, color.lime, size.large, text 'BUY')
      // plotshape(sellSignal, 'SELL', location.abovebar, shape.triangledown, color.red, size.large, text 'SELL')
      // (Pine default text colour: color.blue)
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'BUY',
          textColor: color.blue, size: 'large' });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'SELL',
          textColor: color.blue, size: 'large' });
      }
      // bgcolor(buySignal ? color.new(color.green, 85) : na); bgcolor(sellSignal ? color.new(color.red, 85) : na)
      if (buySignal) s.bgColors.push({ time: b.time, color: buyBg });
      if (sellSignal) s.bgColors.push({ time: b.time, color: sellBg });

      // bullTrendChange = ta.crossover(close, ema); bearTrendChange = ta.crossunder(close, ema)
      const bullTrend = close > ema && v.pClose <= v.pEma;
      const bearTrend = close < ema && v.pClose >= v.pEma;
      v.pClose = close;
      v.pHigh = lastHigh;
      v.pLow = lastLow;
      v.pEma = ema;

      const fl = s.flags;
      fl[0]![i] = buySignal;
      fl[1]![i] = sellSignal;
      fl[2]![i] = on && bullBreakout;
      fl[3]![i] = on && bearBreakout;
      fl[4]![i] = on && bullRetest;
      fl[5]![i] = on && bearRetest;
      fl[6]![i] = on && buySignal;
      fl[7]![i] = on && sellSignal;
      fl[8]![i] = on && emaFilter && bullTrend;
      fl[9]![i] = on && emaFilter && bearTrend;
      fl[10]![i] = on && !isNaN(pivotHigh);
      fl[11]![i] = on && !isNaN(pivotLow);
      for (let k = 0; k < 12; k++) if (fl[k]![i]) s.times[k]!.push(b.time as number);

      // plot(emaFilter ? ema : na, color = color.orange, linewidth = 2)
      s.plot0[i] = { time: b.time, value: emaFilter ? ema : NaN };
      // plot(lastPivotHigh, color = color.red, linewidth = 2, style = plot.style_linebr)
      s.plot1[i] = { time: b.time, value: lastHigh };
      // plot(lastPivotLow, color = color.lime, linewidth = 2, style = plot.style_linebr)
      s.plot2[i] = { time: b.time, value: lastLow };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotBreakoutHighLowSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotBreakoutHighLowSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Pivot Breakout Retest BUY' },
  { id: 'alert1', title: 'Sell Alert', message: 'Pivot Breakout Retest SELL' },
  { id: 'alert2', title: 'Bullish Pivot Breakout', message: '🟢 [JPT] Bullish Pivot Breakout detected.\nPrice has broken above the previous Pivot High.' },
  { id: 'alert3', title: 'Bearish Pivot Breakout', message: '🔴 [JPT] Bearish Pivot Breakout detected.\nPrice has broken below the previous Pivot Low.' },
  { id: 'alert4', title: 'Bullish Retest Confirmed', message: '🟢 [JPT] Bullish Retest confirmed.\nPrice successfully retested the breakout level.' },
  { id: 'alert5', title: 'Bearish Retest Confirmed', message: '🔴 [JPT] Bearish Retest confirmed.\nPrice successfully retested the breakout level.' },
  { id: 'alert6', title: 'BUY Signal', message: '🚀 [JPT] BUY Signal\nPivot Breakout + Retest + EMA confirmation.' },
  { id: 'alert7', title: 'SELL Signal', message: '📉 [JPT] SELL Signal\nPivot Breakdown + Retest + EMA confirmation.' },
  { id: 'alert8', title: 'Bullish Trend Change', message: '📈 [JPT] Price crossed ABOVE the EMA.\nBullish trend bias detected.' },
  { id: 'alert9', title: 'Bearish Trend Change', message: '📉 [JPT] Price crossed BELOW the EMA.\nBearish trend bias detected.' },
  { id: 'alert10', title: 'New Pivot High', message: '🔺 [JPT] New Pivot High confirmed.' },
  { id: 'alert11', title: 'New Pivot Low', message: '🔻 [JPT] New Pivot Low confirmed.' },
];

export const PivotBreakoutHighLowSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
