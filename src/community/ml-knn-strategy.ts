/**
 * Machine Learning: kNN-based Strategy
 *
 * Two features per bar, from the selected indicator pair (long / short period): RSI, CCI or ROC of the close, the
 * volume scaled to 0..99 over the period (minimax), or the average of the four ('All'). On each bar inside the
 * training window (Start Date .. Stop Date) the two features and the class label sign(close[1] - close) are stored.
 * Then all stored points are scanned in order: each point farther from the current features than every point before
 * it pushes its label into a running list of the last k = floor(sqrt(Base K)) labels (the list is kept across bars).
 * The prediction is the sum of that list. Long when it is > 0, short when < 0 (with the optional volatility filter
 * ATR(10) > ATR(40)), else clear. Buy / Sell labels below / above the bar when the signal turns long / short (colour
 * intensity from the prediction), a yellow cross at the close when it turns clear.
 * The 'Bar Threshold' input has no effect on the outputs (the original resets the signal and assigns it again on the
 * same bar).
 *
 * Alerts (alertcondition, `alerts` of the result): Buy ('Go long!') and Sell ('Go short!') on the bars of the labels.
 *
 * Reference: "Machine Learning: kNN-based Strategy" by capissimo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © capissimo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MlKnnIndicator = 'RSI' | 'ROC' | 'CCI' | 'Volume' | 'All';

export interface MlKnnStrategyInputs {
  /** Start of the training window (UNIX ms) */
  startDate: number;
  /** End of the training window (UNIX ms) */
  stopDate: number;
  /** Predictor indicator */
  indicator: MlKnnIndicator;
  /** Short period of the predictors */
  shortWindow: number;
  /** Long period of the predictors */
  longWindow: number;
  /** Base number of neighbours: k = floor(sqrt(k)) */
  k: number;
  /** Volatility filter: ATR(10) > ATR(40) */
  filter: boolean;
  /** No effect on the outputs (see the header) */
  barsThreshold: number;
}

/** timestamp('01 Jan 2000 00:00:00 GMT+10') */
const START_DATE = Date.UTC(2000, 0, 1, 0, 0, 0) - 10 * 3600 * 1000;
/** timestamp('31 Dec 2025 23:45:00 GMT+10') */
const STOP_DATE = Date.UTC(2025, 11, 31, 23, 45, 0) - 10 * 3600 * 1000;

export const defaultInputs: MlKnnStrategyInputs = {
  startDate: START_DATE,
  stopDate: STOP_DATE,
  indicator: 'All',
  shortWindow: 14,
  longWindow: 28,
  k: 252,
  filter: false,
  barsThreshold: 300,
};

export const inputConfig: InputConfig[] = [
  { id: 'startDate', type: 'time', title: 'Start Date', defval: START_DATE },
  { id: 'stopDate', type: 'time', title: 'Stop Date', defval: STOP_DATE },
  { id: 'indicator', type: 'string', title: 'Indicator', defval: 'All', options: ['RSI', 'ROC', 'CCI', 'Volume', 'All'] },
  { id: 'shortWindow', type: 'int', title: 'Short Period [1..n]', defval: 14, min: 1 },
  { id: 'longWindow', type: 'int', title: 'Long Period [2..n]', defval: 28, min: 2 },
  { id: 'k', type: 'int', title: 'Base No. of Neighbours (K) [5..n]', defval: 252, min: 5 },
  { id: 'filter', type: 'bool', title: 'Volatility Filter', defval: false },
  { id: 'barsThreshold', type: 'int', title: 'Bar Threshold [2..5000]', defval: 300, min: 2, max: 5000 },
];

/** Pine color.yellow */
const YELLOW = '#FFEB3B';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ClearPos', color: YELLOW, lineWidth: 4, style: 'cross' },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy', message: 'Go long!' },
  { id: 'alert1', title: 'Sell', message: 'Go short!' },
];

export const metadata = {
  title: 'Machine Learning: kNN-based Strategy',
  shortTitle: 'ML-kNN',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** cAqua(g) / cPink(g) of the original */
export function cAqua(g: number): string {
  return g > 9 ? '#0080FFff' : g > 8 ? '#0080FFe5' : g > 7 ? '#0080FFcc' : g > 6 ? '#0080FFb2' : g > 5 ? '#0080FF99'
    : g > 4 ? '#0080FF7f' : g > 3 ? '#0080FF66' : g > 2 ? '#0080FF4c' : g > 1 ? '#0080FF33' : '#00C0FF19';
}
export function cPink(g: number): string {
  return g > 9 ? '#FF0080ff' : g > 8 ? '#FF0080e5' : g > 7 ? '#FF0080cc' : g > 6 ? '#FF0080b2' : g > 5 ? '#FF008099'
    : g > 4 ? '#FF00807f' : g > 3 ? '#FF008066' : g > 2 ? '#FF00804c' : g > 1 ? '#FF008033' : '#FF008019';
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };

interface KnnVars {
  /** var array<int> predictions: the last k labels pushed, kept across bars (changed in place, copied by copyVars) */
  predictions: number[];
  /** signal of the bar before (ta.change(signal)) */
  prevSignal: number;
}

interface KnnRun extends BarRunState<KnnVars> {
  rs: ReturnType<typeof taStep.rsi>;
  rf: ReturnType<typeof taStep.rsi>;
  cs: ReturnType<typeof taStep.cci>;
  cf: ReturnType<typeof taStep.cci>;
  os: ReturnType<typeof taStep.roc>;
  of: ReturnType<typeof taStep.roc>;
  vsHi: ReturnType<typeof taStep.highest>;
  vsLo: ReturnType<typeof taStep.lowest>;
  vfHi: ReturnType<typeof taStep.highest>;
  vfLo: ReturnType<typeof taStep.lowest>;
  atr10: ReturnType<typeof taStep.atr>;
  atr40: ReturnType<typeof taStep.atr>;
  maxpos: ReturnType<typeof taStep.highest>;
  minpos: ReturnType<typeof taStep.lowest>;
  /** The stored training points (grow by bar) */
  feature1: number[];
  feature2: number[];
  directions: number[];
  markers: MarkerData[];
  clearPos: { time: number; value: number }[];
  flags: boolean[][];
}

function study(inputs: Partial<MlKnnStrategyInputs>): BarStudy<KnnRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.longWindow;
  const Sh = cfg.shortWindow;
  const k = Math.floor(Math.sqrt(cfg.k));
  return {
    init() {
      const s: KnnRun = {
        rs: taStep.rsi(L), rf: taStep.rsi(Sh), cs: taStep.cci(L), cf: taStep.cci(Sh), os: taStep.roc(L), of: taStep.roc(Sh),
        vsHi: taStep.highest(), vsLo: taStep.lowest(), vfHi: taStep.highest(), vfLo: taStep.lowest(),
        atr10: taStep.atr(10), atr40: taStep.atr(40), maxpos: taStep.highest(), minpos: taStep.lowest(),
        feature1: [], feature2: [], directions: [], markers: [], clearPos: [], flags: alertConditions.map(() => []),
        steps: [], vars: { predictions: [], prevSignal: NaN }, lists: [], series: [],
      };
      s.steps = [s.rs, s.rf, s.cs, s.cf, s.os, s.of, s.vsHi, s.vsLo, s.vfHi, s.vfLo, s.atr10, s.atr40, s.maxpos, s.minpos];
      s.lists = [s.feature1, s.feature2, s.directions, s.markers];
      s.series = [s.clearPos, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ predictions: v.predictions.slice(), prevSignal: v.prevSignal }),
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const t = bar.time;
      const close = bar.close;
      const volume = bar.volume ?? NaN;

      // minimax(x, p, min, max) = (max - min) * (x - lo) / (hi - lo) + min, hi / lo = highest / lowest(x, p)
      const minimax = (x: number, hiStep: KnnRun['vsHi'], loStep: KnnRun['vsLo'], p: number, min: number, max: number) => {
        const hi = hiStep.step(x, p);
        const lo = loStep.step(x, p);
        return ((max - min) * (x - lo)) / (hi - lo) + min;
      };

      // 3 pairs of predictor indicators (+ volume), long and short each
      const rs = s.rs.step(close);
      const rf = s.rf.step(close);
      const cs = s.cs.step(close);
      const cf = s.cf.step(close);
      const os = s.os.step(close);
      const of = s.of.step(close);
      const vs = minimax(volume, s.vsHi, s.vsLo, L, 0, 99);
      const vf = minimax(volume, s.vfHi, s.vfLo, Sh, 0, 99);
      const pick = (long: boolean): number => {
        switch (cfg.indicator) {
          case 'RSI': return long ? rs : rf;
          case 'CCI': return long ? cs : cf;
          case 'ROC': return long ? os : of;
          case 'Volume': return long ? vs : vf;
          default: return long ? (rs + cs + os + vs) / 4 : (rf + cf + of + vf) / 4;
        }
      };

      const atr10 = s.atr10.step(bar.high, bar.low, close);
      const atr40 = s.atr40.step(bar.high, bar.low, close);
      const maxpos = s.maxpos.step(bar.high, 10);
      const minpos = s.minpos.step(bar.low, 10);

      const { feature1, feature2, directions } = s;
      const predictions = v.predictions;
      const f1 = pick(true);
      const f2 = pick(false);
      // class_label = int(math.sign(close[1] - close[0])) (na on the first bar)
      const classLabel = i > 0 ? Math.sign(bars[i - 1].close - close) : NaN;
      // if window: store the features and the label
      const tm = t * 1000;
      if (tm >= cfg.startDate && tm <= cfg.stopDate) {
        feature1.push(f1);
        feature2.push(f2);
        directions.push(classLabel);
      }

      // Core logic: points farther than all the points before them (an na distance compares false). With no stored
      // point the original fails (array index out of bounds); here nothing is pushed.
      if (!isNaN(f1) && !isNaN(f2)) {
        let maxdist = -999.0;
        for (let j = 0; j < directions.length; j++) {
          const d = Math.sqrt(Math.pow(f1 - feature1[j], 2) + Math.pow(f2 - feature2[j], 2));
          if (gt(d, maxdist)) {
            maxdist = d;
            if (predictions.length >= k) predictions.shift();
            predictions.push(directions[j]);
          }
        }
      }

      // prediction := array.sum(predictions) (na values skipped; na for no value)
      let sum = 0;
      let count = 0;
      for (const p of predictions) {
        if (isNaN(p)) continue;
        sum += p;
        count++;
      }
      const prediction = count ? sum : NaN;

      const filter = cfg.filter ? gt(atr10, atr40) : true;
      const long = gt(prediction, 0) && filter;
      const short = lt(prediction, 0) && filter;
      // clear = not(long and short) is always true: signal := long ? BUY : short ? SELL : CLEAR
      const signal = long ? 1 : short ? -1 : 0;
      // changed = ta.change(signal) (na on the first bar)
      const changed = !isNaN(v.prevSignal) && signal !== v.prevSignal;
      v.prevSignal = signal;
      const startLongTrade = changed && signal === 1;
      const startShortTrade = changed && signal === -1;
      const clearCondition = changed && signal === 0;

      // plotshape(startLongTrade ? minpos : na, 'Buy', shape.labelup, location.belowbar, cAqua(int(prediction*5)), size.small)
      if (startLongTrade && !isNaN(minpos)) {
        s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'labelUp', color: cAqua(Math.trunc(prediction * 5)), size: 'small' });
      }
      // plotshape(startShortTrade ? maxpos : na, 'Sell', shape.labeldown, location.abovebar, cPink(int(-prediction*5)), size.small)
      if (startShortTrade && !isNaN(maxpos)) {
        s.markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'labelDown', color: cPink(Math.trunc(-prediction * 5)), size: 'small' });
      }
      // plot(clear_condition ? close : na, 'ClearPos', color.yellow, 4, plot.style_cross)
      s.clearPos[i] = { time: t, value: clearCondition ? close : NaN };
      // alertcondition(startLongTrade, 'Buy', 'Go long!') / alertcondition(startShortTrade, 'Sell', 'Go short!')
      s.flags[0][i] = startLongTrade;
      s.flags[1][i] = startShortTrade;
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.clearPos.slice() },
        markers: s.markers.slice(),
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MlKnnStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MlKnnStrategyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MlKnnStrategy = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
