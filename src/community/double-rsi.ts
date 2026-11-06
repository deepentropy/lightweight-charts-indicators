/**
 * Double RSI
 *
 * DRSI = 2 * RSI(close, length) - RSI(RSI, length), a double-RSI line in the style of a DEMA. The trend state turns
 * long when DRSI is above the long threshold and short when it is below the short threshold; otherwise it keeps its
 * last state. The DRSI line is drawn four times (glow) in the state colour, the price candles take the state colour,
 * and triangles mark the changes from short to long and back.
 * Alerts (alertcondition, `alerts` of the result): 'DRSI: Buy' / 'DRSI: Sell' on the bars of those triangles
 * (ta.crossover / ta.crossunder of the state with 0).
 *
 * Reference: "Double RSI" by Clokivez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Clokivez
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DoubleRsiInputs {
  /** Colour the price candles with the state colour */
  barColor: boolean;
  /** Draw the DRSI line (glow); off: the line colour is na */
  glow: boolean;
  /** RSI length */
  length: number;
  longThreshold: number;
  shortThreshold: number;
}

export const defaultInputs: DoubleRsiInputs = {
  barColor: true,
  glow: true,
  length: 13,
  longThreshold: 59,
  shortThreshold: 52,
};

export const inputConfig: InputConfig[] = [
  { id: 'barColor', type: 'bool', title: 'Bar Color', defval: true },
  { id: 'glow', type: 'bool', title: 'Make it Glow?', defval: true },
  { id: 'length', type: 'int', title: 'DRSI Length', defval: 13 },
  { id: 'longThreshold', type: 'int', title: 'Long Threshold', defval: 59 },
  { id: 'shortThreshold', type: 'int', title: 'Short Threshold', defval: 52 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DRSI', color: String(color.new(color.lime, 30)), lineWidth: 1 },
  { id: 'plot1', title: 'DRSI', color: String(color.new(color.lime, 30)), lineWidth: 2 },
  { id: 'plot2', title: 'DRSI', color: String(color.new(color.lime, 80)), lineWidth: 10 },
  { id: 'plot3', title: 'DRSI', color: String(color.new(color.lime, 85)), lineWidth: 16 },
];

export const metadata = {
  title: 'Double RSI',
  shortTitle: 'DRSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface DrsiVars {
  /** T[1] and col[1] */
  T: number;
  col: string | null;
  /** The last T that was not na (ta.crossover(T, 0) / ta.crossunder(T, 0)) */
  lastT: number;
}

interface DrsiRun extends BarRunState<DrsiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsi2: ReturnType<typeof taStep.rsi>;
  plots: Point[][];
  candles: PlotCandleData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DoubleRsiInputs>): BarStudy<DrsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const TRANSP = [30, 30, 80, 85];
  return {
    init() {
      const rsi = taStep.rsi(cfg.length);
      const rsi2 = taStep.rsi(cfg.length);
      const s: DrsiRun = {
        rsi, rsi2, plots: TRANSP.map(() => []), candles: [], markers: [], flags: [[], []], times: [[], []],
        steps: [rsi, rsi2], vars: { T: NaN, col: null, lastT: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // rsi = ta.rsi(close, rl); drsi = 2 * rsi - ta.rsi(rsi, rl)
      const rsi = s.rsi.step(b.close);
      const drsi = 2 * rsi - s.rsi2.step(rsi);

      // T := drsi > lt ? 1 : drsi < st ? -1 : T[1] (T[1] is na on the first bar, so T stays na until a signal)
      // col := T > 0 ? color.lime : T < 0 ? color.red : col[1] (na until the first signal)
      const T = gt(drsi, cfg.longThreshold) ? 1 : lt(drsi, cfg.shortThreshold) ? -1 : v.T;
      const col = gt(T, 0) ? color.lime : lt(T, 0) ? color.red : v.col;
      v.T = T;
      v.col = col;

      // color.new(na, t) is black with transparency t
      const value = Number.isFinite(drsi) ? drsi : NaN;
      TRANSP.forEach((t, k) => {
        s.plots[k][i] = { time: b.time, value, color: cfg.glow ? String(color.new(col as string, t)) : 'transparent' };
      });

      // plotcandle(open, high, low, close, "Bar Color", bc ? col : na, bc ? col : na, bordercolor = bc ? col : na,
      //   force_overlay = true)
      const c = cfg.barColor && col !== null ? (col as string) : 'transparent';
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
        borderColor: c, forceOverlay: true };
      // ta.crossover(T, 0) / ta.crossunder(T, 0): compared with the last bar where T was not na
      let buy = false;
      let sell = false;
      if (!isNaN(T)) {
        if (!isNaN(v.lastT)) {
          // plotshape(L, "Buy", shape.triangleup, location.belowbar, #00ffbf, size = size.tiny, force_overlay = true)
          if (T > 0 && v.lastT <= 0) {
            buy = true;
            s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: '#00ffbf', size: 'tiny',
              forceOverlay: true });
          }
          // plotshape(S, "Sell", shape.triangledown, location.abovebar, #ff0040, size = size.tiny, force_overlay = true)
          if (T < 0 && v.lastT >= 0) {
            sell = true;
            s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: '#ff0040', size: 'tiny',
              forceOverlay: true });
          }
        }
        v.lastT = T;
      }
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(b.time as number);
      if (sell) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        hlines: [
          { value: cfg.longThreshold, options: { title: 'Long Threshold', color: color.lime, linestyle: 'dashed' } },
          { value: cfg.shortThreshold, options: { title: 'Short Threshold', color: color.red, linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
        plotCandles: { barColor: s.candles.slice() },
        // alertcondition(ta.crossover(T, 0), "DRSI: Buy") / alertcondition(ta.crossunder(T, 0), "DRSI: Sell")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DoubleRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DoubleRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'DRSI: Buy', message: 'DRSI Buy Signal' },
  { id: 'alert1', title: 'DRSI: Sell', message: 'DRSI Sell Signal' },
];

export const DoubleRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
