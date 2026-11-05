/**
 * SwingArm ATR Trend Indicator (Blackflag FTS)
 *
 * An ATR trailing stop: the true range ("modified": the bar range capped at 1.5 times its average, with half of a
 * gap added to the distances to the previous close; or the usual true range) is smoothed with a Wilder average, and
 * the stop is the close minus (uptrend) or plus (downtrend) "ATR Factor" times that average, moved only in the
 * direction of the trend. The trend turns up when the close goes above the previous down stop and down when it goes
 * below the previous up stop. The extremum is the highest high of the uptrend (lowest low of the downtrend). Three
 * Fibonacci levels (61.8 %, 78.6 %, 88.6 %) between the extremum and the stop are filled in the trend colour.
 * Triangles mark a close that crosses back over a level of the bar before, in the direction against the trend
 * ("Show Fib Entries?"); the triangles of the three levels are spaced by 1, 1.5 and 2 times the 14-bar average of the
 * true range.
 * Alerts (alertcondition, `alerts` of the result): the six level crosses of the triangles (whatever "Show Fib
 * Entries?") and 'Stop Line Change' (the Fib 1 level, na bars skipped, differs from the bar before).
 *
 * Reference: "SwingArm ATR Trend Indicator" by vsnfnd (script title "Blackflag FTS")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Duyck
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'cross over Fib1', message: 'Price crossed below Fib1 level in long trend' },
  { id: 'alert1', title: 'cross over Fib2', message: 'Price crossed below Fib2 level in long trend' },
  { id: 'alert2', title: 'cross over Fib3', message: 'Price crossed below Fib3 level in long trend' },
  { id: 'alert3', title: 'cross under Fib1', message: 'Price crossed above Fib1 level in short trend' },
  { id: 'alert4', title: 'cross under Fib2', message: 'Price crossed above Fib2 level in short trend' },
  { id: 'alert5', title: 'cross under Fib3', message: 'Price crossed above Fib3 level in short trend' },
  { id: 'alert6', title: 'Stop Line Change', message: 'Stop Line Change' },
];

export interface SwingarmAtrTrendIndicatorInputs {
  trailType: 'modified' | 'unmodified';
  atrPeriod: number;
  atrFactor: number;
  showFibEntries: boolean;
}

export const defaultInputs: SwingarmAtrTrendIndicatorInputs = {
  trailType: 'modified',
  atrPeriod: 28,
  atrFactor: 5,
  showFibEntries: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'trailType', type: 'string', title: 'Trailtype', defval: 'modified', options: ['modified', 'unmodified'] },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 28 },
  { id: 'atrFactor', type: 'int', title: 'ATR Factor', defval: 5 },
  { id: 'showFibEntries', type: 'bool', title: 'Show Fib Entries?', defval: true },
];

/** Colour constants of this version of the language */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const LIME = '#00E676';
const FUCHSIA = '#E040FB';
const BLACK = '#363A45';
const YELLOW = '#FFEB3B';
const PURPLE = '#9C27B0';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailingstop', color: GREEN, lineWidth: 1 },
  { id: 'plot1', title: 'Extremum', color: LIME, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Fib 1', color: BLACK, lineWidth: 1 },
  { id: 'plot3', title: 'Fib 2', color: BLACK, lineWidth: 1 },
  { id: 'plot4', title: 'Fib 3', color: BLACK, lineWidth: 1 },
  { id: 'plot5', title: 'l100', color: BLACK, lineWidth: 1 },
];

export const metadata = {
  title: 'Blackflag FTS',
  shortTitle: 'Blackflag FTS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine max / min: na when an argument is na */
const max = (...v: number[]) => (v.some((x) => isNaN(x)) ? NaN : Math.max(...v));
const min = (...v: number[]) => (v.some((x) => isNaN(x)) ? NaN : Math.min(...v));
const nz = (x: number, r = 0) => (isNaN(x) ? r : x);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface SwingVars {
  /** Wild_ma history (_wild[1]) */
  wild: number;
  trendUpPrev: number;
  trendDownPrev: number;
  trendPrev: number;
  exPrev: number;
  /** fixnan(f1) */
  lastF1: number;
}

interface SwingRun extends BarRunState<SwingVars> {
  rangeSma: ReturnType<typeof taStep.sma>;
  atrSma: ReturnType<typeof taStep.sma>;
  under: ReturnType<typeof taStep.crossunder>[];
  over: ReturnType<typeof taStep.crossover>[];
  fibs: number[][];
  long: boolean[];
  fixed: number[];
  plots: Point[][];
  fillColors: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SwingarmAtrTrendIndicatorInputs>): BarStudy<SwingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const k = [1, 1.5, 2];
  const fibLevels = [61.8, 78.6, 88.6];
  return {
    init() {
      const rangeSma = taStep.sma();
      const atrSma = taStep.sma();
      const under = [0, 1, 2].map(() => taStep.crossunder());
      const over = [0, 1, 2].map(() => taStep.crossover());
      const s: SwingRun = {
        rangeSma, atrSma, under, over, fibs: [[], [], []], long: [], fixed: [],
        plots: [[], [], [], [], [], []], fillColors: [[], [], []], markers: [],
        flags: Array.from({ length: 7 }, () => []), times: Array.from({ length: 7 }, () => []),
        steps: [rangeSma, atrSma, ...under, ...over],
        vars: { wild: NaN, trendUpPrev: NaN, trendDownPrev: NaN, trendPrev: NaN, exPrev: NaN, lastF1: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.fibs, s.long, s.fixed, ...s.plots, ...s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // security(tickerid(syminfo.prefix, syminfo.ticker), timeframe.period, x): the chart series
      const h = b.high;
      const l = b.low;
      const c = b.close;
      const hPrev = i > 0 ? bars[i - 1].high : NaN;
      const lPrev = i > 0 ? bars[i - 1].low : NaN;
      const cPrev = i > 0 ? bars[i - 1].close : NaN;

      // HiLo = min(h - l, 1.5 * nz(sma(h - l, ATRPeriod)))
      const rangeSma = s.rangeSma.step(h - l, cfg.atrPeriod);
      let trueRange: number;
      if (cfg.trailType === 'modified') {
        const hiLo = min(h - l, 1.5 * nz(rangeSma));
        const hRef = le(l, hPrev) ? h - cPrev : h - cPrev - 0.5 * (l - hPrev);
        const lRef = ge(h, lPrev) ? cPrev - l : cPrev - l - 0.5 * (lPrev - h);
        trueRange = max(hiLo, hRef, lRef);
      } else {
        trueRange = max(h - l, Math.abs(h - cPrev), Math.abs(l - cPrev));
      }

      // Wild_ma(_src, _malength): _wild := nz(_wild[1]) + (_src - nz(_wild[1])) / _malength
      v.wild = nz(v.wild) + (trueRange - nz(v.wild)) / cfg.atrPeriod;
      const loss = cfg.atrFactor * v.wild;
      const up = c - loss;
      const dn = c + loss;
      const trendUp = gt(cPrev, v.trendUpPrev) ? max(up, v.trendUpPrev) : up;
      const trendDown = lt(cPrev, v.trendDownPrev) ? min(dn, v.trendDownPrev) : dn;
      const t = gt(c, v.trendDownPrev) ? 1 : lt(c, v.trendUpPrev) ? -1 : nz(v.trendPrev, 1);
      const trail = t === 1 ? trendUp : trendDown;
      // crossover(Trend, 0) / crossunder(Trend, 0): Trend is never na
      const crossUp = t > 0 && v.trendPrev <= 0;
      const crossDown = t < 0 && v.trendPrev >= 0;
      const ex = crossUp ? h : crossDown ? l : t === 1 ? max(v.exPrev, h) : t === -1 ? min(v.exPrev, l) : v.exPrev;
      v.trendUpPrev = trendUp;
      v.trendDownPrev = trendDown;
      v.trendPrev = t;
      v.exPrev = ex;

      const f = fibLevels.map((p) => ex + ((trail - ex) * p) / 100);
      const l100 = trail + 0;
      // state = Trend == 1 ? "long" : "short"
      const long = t === 1;
      s.long[i] = long;
      const p = s.plots;
      p[0][i] = { time, value: fin(trail), color: long ? GREEN : RED };
      p[1][i] = { time, value: fin(ex), color: long ? LIME : FUCHSIA };
      for (let j = 0; j < 3; j++) p[2 + j][i] = { time, value: fin(f[j]) };
      p[5][i] = { time, value: fin(l100) };
      s.fillColors[0][i] = long ? GREEN : RED;
      s.fillColors[1][i] = long ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 82, 82, 0.3)';
      s.fillColors[2][i] = long ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 82, 82, 0.4)';

      // l1 = state[1] == "long" and crossunder(norm_c, f1[1]) ...: both sides run on every bar (Pine v4)
      const under: boolean[] = [];
      const over: boolean[] = [];
      for (let j = 0; j < 3; j++) {
        const fPrev = i > 0 ? s.fibs[j][i - 1] : NaN;
        under.push(s.under[j].step(c, fPrev));
        over.push(s.over[j].step(c, fPrev));
        s.fibs[j][i] = f[j];
      }
      // atr = sma(trueRange, 14)
      const atr = s.atrSma.step(trueRange, 14);
      const longPrev = i > 0 && s.long[i - 1];
      if (i >= 1 && cfg.showFibEntries) {
        // plotshape(cond ? low - k * atr : na, location.belowbar): an na or 0 value draws no shape
        for (let j = 0; j < 3; j++) {
          const y = l - k[j] * atr;
          if (longPrev && under[j] && !isNaN(y) && y !== 0) {
            // plotshape LS1 / LS2 / LS3: ids shape0..shape2
            s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: YELLOW, size: 'tiny', id: `shape${j}` });
          }
        }
        for (let j = 0; j < 3; j++) {
          const y = h + k[j] * atr;
          if (!longPrev && over[j] && !isNaN(y) && y !== 0) {
            // plotshape SS1 / SS2 / SS3: ids shape3..shape5
            s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: PURPLE, size: 'tiny', id: `shape${j + 3}` });
          }
        }
      }

      // alertcondition(l1..l3, s1..s3): state[1] == "long" / "short" (na on the first bar) and the cross
      const flags: boolean[] = [];
      for (let j = 0; j < 3; j++) flags.push(i > 0 && longPrev && under[j]);
      for (let j = 0; j < 3; j++) flags.push(i > 0 && !longPrev && over[j]);
      // alertcondition(fixnan(f1) != fixnan(f1[1])): na (before the first value) compares false
      if (!isNaN(f[0])) v.lastF1 = f[0];
      const fixed = v.lastF1;
      s.fixed[i] = fixed;
      const fixedPrev = i > 0 ? s.fixed[i - 1] : NaN;
      flags.push(i > 0 && !isNaN(fixed) && !isNaN(fixedPrev) && !(Math.abs(fixed - fixedPrev) <= EPS));
      for (let j = 0; j < 7; j++) {
        s.flags[j][i] = flags[j];
        if (flags[j]) s.times[j].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, j) => { plots[`plot${j}`] = pl.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot2', plot2: 'plot3', colors: s.fillColors[0].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.fillColors[1].slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.fillColors[2].slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SwingarmAtrTrendIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SwingarmAtrTrendIndicatorInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const SwingarmAtrTrendIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  createRun,
};
