/**
 * Laguerre Filter
 *
 * A Laguerre filter of `order` elements with damping `gamma`: L0 = (1 - g) * src + g * L0[1],
 * Li = -g * L(i-1) + L(i-1)[1] + g * Li[1], all elements start at the first source value. The output is the
 * weighted mean of the elements, with triangular weights (1, 2, ..., 2, 1: distance to the nearer edge + 1).
 * The trend turns long when the output rises and short when it falls. The line and the candles take the trend
 * colour; gradient fills join the line and the close, and thin fills (6 % of ATR 14) mark the close edge.
 * Alerts (alertcondition, `alerts` of the result): the trend turning long / short, the close crossing the filter.
 * The Pine 'Line Width' input is not ported: the plot width is fixed by plotConfig (the Pine default, 3).
 *
 * Reference: "Laguerre Filter [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LaguerreFilterInputs {
  /** Laguerre price source */
  pricesource: SourceType;
  /** Gamma (damping): higher = smoother, more lag */
  gamma: number;
  /** Filter order: number of Laguerre elements */
  order: number;
  showLaguerre: boolean;
  showFill: boolean;
  paintCandles: boolean;
  longCol: string;
  shortCol: string;
}

export const defaultInputs: LaguerreFilterInputs = {
  pricesource: 'close',
  gamma: 0.8,
  order: 4,
  showLaguerre: true,
  showFill: true,
  paintCandles: true,
  longCol: '#00ff00',
  shortCol: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'pricesource', type: 'source', title: 'Laguerre Price Source', defval: 'close' },
  { id: 'gamma', type: 'float', title: 'Gamma (Damping)', defval: 0.8, min: 0.0, max: 0.99, step: 0.01 },
  { id: 'order', type: 'int', title: 'Filter Order', defval: 4, min: 2, max: 10 },
  { id: 'showLaguerre', type: 'bool', title: 'Show Filtered Price on chart?', defval: true },
  { id: 'showFill', type: 'bool', title: 'Show Gradient Fill?', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles according to Trend?', defval: true },
  { id: 'longCol', type: 'color', title: 'Long Color', defval: '#00ff00' },
  { id: 'shortCol', type: 'color', title: 'Short Color', defval: '#ff0000' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre', color: '#00ff00', lineWidth: 3 },
  { id: 'plot1', title: 'Price', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Edge Lower', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Edge Upper', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Laguerre Filter [BackQuant]',
  shortTitle: 'Laguerre Filter [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface LaguerreVars {
  /** var LaguerreFilter filter: its elements (changed in place, copied by copyVars) and value; the trend */
  L: number[];
  val: number;
  trend: number;
}

interface LaguerreRun extends BarRunState<LaguerreVars> {
  atr: ReturnType<typeof taStep.atr>;
  close: number[];
  value: number[];
  trendArr: number[];
  plots: Point[][];
  grad: (number | string | null)[][];
  bullEdge: string[];
  bearEdge: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LaguerreFilterInputs>): BarStudy<LaguerreRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf = barSource(cfg.pricesource);
  const g = cfg.gamma;
  const order = cfg.order;
  const bullTop = String(color.new(cfg.longCol, 15));
  const bullBottom = String(color.new(cfg.longCol, 90));
  const bearTop = String(color.new(cfg.shortCol, 15));
  const bearBottom = String(color.new(cfg.shortCol, 90));
  const bullEdgeCol = String(color.new(cfg.longCol, 45));
  const bearEdgeCol = String(color.new(cfg.shortCol, 45));
  return {
    fullRunReason: () => (isBarSource(cfg.pricesource) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(14);
      const s: LaguerreRun = {
        atr, close: [], value: [], trendArr: [], plots: [[], [], [], []], grad: Array.from({ length: 8 }, () => []),
        bullEdge: [], bearEdge: [], barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [atr], vars: { L: [], val: NaN, trend: 0 }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.close, s.value, s.trendArr, ...s.plots, ...s.grad, s.bullEdge, s.bearEdge, s.barColors, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, L: v.L.slice() }),
    bar(s, b, bars) {
      const bar = bars[b];
      const v = s.vars;
      const x = srcOf(bar);
      // var LaguerreFilter filter; init on the first bar (all elements = src), then update on every bar
      if (b === 0) {
        v.L = new Array(order).fill(x);
        v.val = x;
      }
      // L0 = (1 - g) * src + g * L0[1]; Li = -g * L(i-1) + L(i-1)[1] + g * Li[1] (in place: the old L(i-1) kept)
      const L = v.L;
      let prevOld = L[0];
      L[0] = (1 - g) * x + g * L[0];
      for (let i = 1; i <= order - 1; i++) {
        const old = L[i];
        L[i] = -g * L[i - 1] + prevOld + g * old;
        prevOld = old;
      }
      let sumWeights = 0.0;
      let sumValues = 0.0;
      for (let i = 0; i <= order - 1; i++) {
        const weight = Math.min(i, order - 1 - i) + 1.0;
        sumWeights += weight;
        sumValues += weight * L[i];
      }
      const prev = v.val;
      const val = sumValues / sumWeights;
      v.val = val;
      if (gt(val, prev)) v.trend = 1;
      else if (lt(val, prev)) v.trend = -1;
      const trend = v.trend;
      s.value[b] = val;
      s.trendArr[b] = trend;

      const col = trend === 1 ? cfg.longCol : trend === -1 ? cfg.shortCol : color.white;
      const close = bar.close;
      s.close[b] = close;
      const atr = s.atr.step(bar.high, bar.low, bar.close);
      const t = bar.time;
      const above = gt(close, val);
      const below = lt(close, val);

      // fill(pPrice, pLag, close > v ? close : v, close > v ? v : close,
      //      close > v ? color.new(longCol, 15) : na, close > v ? color.new(longCol, 90) : na, title = "Bullish Fill")
      s.grad[0][b] = above ? close : val;
      s.grad[1][b] = above ? val : close;
      s.grad[2][b] = above ? bullTop : null;
      s.grad[3][b] = above ? bullBottom : null;
      // fill(pPrice, pLag, close < v ? v : close, close < v ? close : v,
      //      close < v ? color.new(shortCol, 15) : na, close < v ? color.new(shortCol, 90) : na, title = "Bearish Fill")
      s.grad[4][b] = below ? val : close;
      s.grad[5][b] = below ? close : val;
      s.grad[6][b] = below ? bearTop : null;
      s.grad[7][b] = below ? bearBottom : null;
      // fill(pPrice, pEdgeUp, close > v ? color.new(longCol, 45) : na); fill(pPrice, pEdgeDn, close < v ? color.new(shortCol, 45) : na)
      s.bullEdge[b] = above ? bullEdgeCol : 'transparent';
      s.bearEdge[b] = below ? bearEdgeCol : 'transparent';

      // barcolor(paintCandles ? col : na)
      s.barColors[b] = { time: t, color: col };

      s.plots[0][b] = { time: t, value: cfg.showLaguerre ? val : NaN, color: col };
      s.plots[1][b] = { time: t, value: cfg.showFill ? close : NaN };
      // edgeOffset = ta.atr(14) * 0.06
      s.plots[2][b] = { time: t, value: close - atr * 0.06 };
      s.plots[3][b] = { time: t, value: close + atr * 0.06 };

      // filter.isLong() and not filter.isLong()[1] (false before the first bar); ta.cross(close, filter.value)
      const pt = b > 0 ? s.trendArr[b - 1] : NaN;
      const pc = b > 0 ? s.close[b - 1] : NaN;
      const pv = b > 0 ? s.value[b - 1] : NaN;
      const f0 = trend === 1 && !(b > 0 && pt === 1);
      const f1 = trend === -1 && !(b > 0 && pt === -1);
      const f2 = (close > val && pc <= pv) || (close < val && pc >= pv);
      s.flags[0][b] = f0;
      s.flags[1][b] = f1;
      s.flags[2][b] = f2;
      if (f0) s.times[0].push(t as number);
      if (f1) s.times[1].push(t as number);
      if (f2) s.times[2].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const gr = s.grad;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        fills: [
          {
            plot1: 'plot1', plot2: 'plot0', options: { title: 'Bullish Fill' },
            gradient: {
              topValue: gr[0].slice() as number[], bottomValue: gr[1].slice() as number[],
              topColor: gr[2].slice() as (string | null)[], bottomColor: gr[3].slice() as (string | null)[],
            },
          },
          {
            plot1: 'plot1', plot2: 'plot0', options: { title: 'Bearish Fill' },
            gradient: {
              topValue: gr[4].slice() as number[], bottomValue: gr[5].slice() as number[],
              topColor: gr[6].slice() as (string | null)[], bottomColor: gr[7].slice() as (string | null)[],
            },
          },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Bull Edge' }, colors: s.bullEdge.slice() },
          { plot1: 'plot1', plot2: 'plot3', options: { title: 'Bear Edge' }, colors: s.bearEdge.slice() },
        ],
        barColors: cfg.paintCandles ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LaguerreFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LaguerreFilterInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Laguerre Long', message: 'Laguerre Filter turned bullish {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Laguerre Short', message: 'Laguerre Filter turned bearish {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Price Cross', message: 'Price crossed Laguerre Filter {{exchange}}:{{ticker}}' },
];

export const LaguerreFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
