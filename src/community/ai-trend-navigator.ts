/**
 * AI Trend Navigator [K-Neighbor]
 *
 * kNN moving average: on each bar, of the last `windowSize` = max(k, 30) values of the price value (SMA of hl2, VWAP
 * of the close `maLen` bars back, or an SMA / WMA / EMA / HMA of the close), the k closest to the target value (RMA
 * of the close, VWAP of the close `maLen_` bars back, ATR(14), or an SMA / WMA / EMA / HMA of the close) are kept
 * and the line is their sum divided by k (slots not filled count as 0). The Knn Classifier Line is the WMA(5) of it,
 * lime when rising, red when falling, orange otherwise; the Average Knn Classifier Line is its RMA over the smoothing
 * period. kNN classifier: among the last 10 values of avg(kNN MA, close), each new nearest one votes up when the RMA of
 * the kNN MA one bar back is below the RMA of the kNN MA on that bar, down when above; the prediction is the WMA(3) of
 * +1 (more up votes) / -1. An optional background follows the prediction.
 *
 * Alerts (alertcondition, `alerts` of the result): the classifier line crossing over / under its average and the
 * close, switching up / down, turning neutral, and the positive / negative prediction starting.
 *
 * VWAP choices: ta.vwap restarts on each new day; on intraday bars the port reads the exchange time zone and the
 * session from the optional third argument (see src/chart-context.ts), else the day starts at 00:00 UTC.
 *
 * Reference: "AI Trend Navigator" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AiTrendNavigatorPriceValue = 'hl2' | 'VWAP' | 'sma' | 'wma' | 'ema' | 'hma';
export type AiTrendNavigatorTargetValue = 'Price Action' | 'VWAP' | 'Volatility' | 'sma' | 'wma' | 'ema' | 'hma';

export interface AiTrendNavigatorInputs {
  /** Price value fed to the kNN */
  priceValue: AiTrendNavigatorPriceValue;
  /** Length of the price value */
  maLen: number;
  /** Target value of the kNN */
  targetValue: AiTrendNavigatorTargetValue;
  /** Length of the target value */
  targetLen: number;
  /** Number of closest values (k) */
  numberOfClosestValues: number;
  /** Smoothing period of the average line and of the classifier */
  smoothingPeriod: number;
  upKnnColor: string;
  downKnnColor: string;
  neutralKnnColor: string;
  maKnnColor: string;
  /** Trend Prediction Color (background) */
  showBackground: boolean;
  upBgColor: string;
  downBgColor: string;
}

export const defaultInputs: AiTrendNavigatorInputs = {
  priceValue: 'hl2',
  maLen: 5,
  targetValue: 'Price Action',
  targetLen: 5,
  numberOfClosestValues: 3,
  smoothingPeriod: 50,
  upKnnColor: color.lime,
  downKnnColor: color.red,
  neutralKnnColor: color.orange,
  maKnnColor: color.teal,
  showBackground: false,
  upBgColor: color.lime,
  downBgColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'priceValue', type: 'string', title: 'Price Value', defval: 'hl2', options: ['hl2', 'VWAP', 'sma', 'wma', 'ema', 'hma'] },
  { id: 'maLen', type: 'int', title: 'Price Value Length', defval: 5, min: 2, max: 200 },
  { id: 'targetValue', type: 'string', title: 'Target Value', defval: 'Price Action', options: ['Price Action', 'VWAP', 'Volatility', 'sma', 'wma', 'ema', 'hma'] },
  { id: 'targetLen', type: 'int', title: 'Target Value Length', defval: 5, min: 2, max: 200 },
  { id: 'numberOfClosestValues', type: 'int', title: 'Number of Closest Values', defval: 3, min: 2, max: 200 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 50, min: 2, max: 500 },
  { id: 'upKnnColor', type: 'color', title: 'KNN Up Color', defval: color.lime, group: 'KNN Color' },
  { id: 'downKnnColor', type: 'color', title: 'KNN Down Color', defval: color.red, group: 'KNN Color' },
  { id: 'neutralKnnColor', type: 'color', title: 'KNN Neutral Color', defval: color.orange, group: 'KNN Color' },
  { id: 'maKnnColor', type: 'color', title: 'MA KNN Color', defval: color.teal, group: 'MA KNN Color' },
  { id: 'showBackground', type: 'bool', title: 'Trend Prediction Color', defval: false, group: 'BG Color' },
  { id: 'upBgColor', type: 'color', title: 'Up Background Color', defval: color.lime, group: 'BG Color' },
  { id: 'downBgColor', type: 'color', title: 'Down Background Color', defval: color.red, group: 'BG Color' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Knn Classifier Line', color: color.lime, lineWidth: 1 },
  { id: 'plot1', title: 'Average Knn Classifier Line', color: color.teal, lineWidth: 1 },
];

export const metadata = {
  title: 'AI Trend Navigator [K-Neighbor]',
  shortTitle: 'AI-TN',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

const DAY_MS = 86400000;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

/** One value fed to the kNN, one bar at a time */
type Source = { step(b: Bar, i: number, bars: Bar[], v: AiVars, newDay: boolean): number; commit(): void };

interface AiVars {
  /** ta.vwap(close[len]) sums of the price value and of the target value (na until the first anchor) */
  priceSumPV: number;
  priceSumV: number;
  targetSumPV: number;
  targetSumV: number;
}

interface AiRun extends BarRunState<AiVars> {
  valueSrc: Source;
  targetSrc: Source;
  cRma: ReturnType<typeof taStep.rma>;
  oRma: ReturnType<typeof taStep.rma>;
  predWma: ReturnType<typeof taStep.wma>;
  lineWma: ReturnType<typeof taStep.wma>;
  valueIn: number[];
  knn: number[];
  price: number[];
  c: number[];
  o: number[];
  knnLine: number[];
  lineCol: string[];
  green: boolean[];
  red: boolean[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AiTrendNavigatorInputs>): BarStudy<AiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const k = cfg.numberOfClosestValues;
  const windowSize = Math.max(k, 30);
  const usesVwap = cfg.priceValue === 'VWAP' || cfg.targetValue === 'VWAP';
  const dn80 = String(color.new(cfg.downBgColor, 80));
  const up80 = String(color.new(cfg.upBgColor, 80));
  /** Chart context of the day changes (with the chart timeframe) and the time unit, set by init */
  let calChart: ChartContext = {};
  let ms = false;

  /**
   * timeframe.change("1D") of bar i (periodChanges(bars, "1D", chart)[i]): with the exchange calendar, the one of bars
   * i - 1 and i (the calendar reads the chart timeframe of the whole set); else a new UTC day (the rule of periodStarts)
   */
  const dayChange = (bars: Bar[], i: number): boolean => {
    if (i === 0) return false;
    if (hasCalendar(calChart)) return periodChanges([bars[i - 1], bars[i]], '1D', calChart)[1];
    const day = (t: number) => Math.floor((ms ? t : t * 1000) / DAY_MS);
    return day(bars[i].time) !== day(bars[i - 1].time);
  };

  // ta.vwap(close[len]): anchor timeframe.change("1D") (true on the first bar)
  const vwapOfCloseBack = (len: number, target: boolean): Source => ({
    step(_b, i, bars, v, newDay) {
      const s = i - len >= 0 ? bars[i - len].close : NaN;
      const vol = bars[i].volume ?? NaN;
      let sumPV = target ? v.targetSumPV : v.priceSumPV;
      let sumV = target ? v.targetSumV : v.priceSumV;
      if (i === 0 || newDay) {
        sumPV = s * vol;
        sumV = vol;
      } else {
        // An na source or volume makes the sums na until the next anchor
        sumPV += s * vol;
        sumV += vol;
      }
      if (target) {
        v.targetSumPV = sumPV;
        v.targetSumV = sumV;
      } else {
        v.priceSumPV = sumPV;
        v.priceSumV = sumV;
      }
      return sumV === 0 ? NaN : sumPV / sumV;
    },
    commit() {},
  });
  const closeMa = (typ: string, len: number): Source => {
    if (typ === 'sma') { const m = taStep.sma(); return { step: (b) => m.step(b.close, len), commit: () => m.commit() }; }
    if (typ === 'wma') { const m = taStep.wma(); return { step: (b) => m.step(b.close, len), commit: () => m.commit() }; }
    if (typ === 'ema') { const m = taStep.ema(len); return { step: (b) => m.step(b.close), commit: () => m.commit() }; }
    const m = taStep.hma(len);
    return { step: (b) => m.step(b.close), commit: () => m.commit() };
  };
  const valueSource = (): Source => {
    if (cfg.priceValue === 'hl2') {
      const m = taStep.sma();
      return { step: (b) => m.step((b.high + b.low) / 2, cfg.maLen), commit: () => m.commit() };
    }
    if (cfg.priceValue === 'VWAP') return vwapOfCloseBack(cfg.maLen, false);
    return closeMa(cfg.priceValue, cfg.maLen);
  };
  const targetSource = (): Source => {
    if (cfg.targetValue === 'Price Action') {
      const m = taStep.rma(cfg.targetLen);
      return { step: (b) => m.step(b.close), commit: () => m.commit() };
    }
    if (cfg.targetValue === 'VWAP') return vwapOfCloseBack(cfg.targetLen, true);
    if (cfg.targetValue === 'Volatility') {
      const m = taStep.atr(14);
      return { step: (b) => m.step(b.high, b.low, b.close), commit: () => m.commit() };
    }
    return closeMa(cfg.targetValue, cfg.targetLen);
  };

  return {
    // the day changes read the chart timeframe (from the bar gaps or the context) and the time unit of the first bar
    key: (bars, chart) => (usesVwap ? `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}` : ''),
    init(bars, chart) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      const tfName = chartTimeframe(bars, chart);
      calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      const valueSrc = valueSource();
      const targetSrc = targetSource();
      const cRma = taStep.rma(cfg.smoothingPeriod);
      const oRma = taStep.rma(cfg.smoothingPeriod);
      const predWma = taStep.wma();
      const lineWma = taStep.wma();
      const s: AiRun = {
        valueSrc, targetSrc, cRma, oRma, predWma, lineWma,
        valueIn: [], knn: [], price: [], c: [], o: [], knnLine: [], lineCol: [], green: [], red: [], plot0: [], plot1: [],
        bgColors: [], flags: Array.from({ length: 9 }, () => []), times: Array.from({ length: 9 }, () => []),
        steps: [valueSrc, targetSrc, cRma, oRma, predWma, lineWma],
        vars: { priceSumPV: NaN, priceSumV: NaN, targetSumPV: NaN, targetSumV: NaN },
        lists: [], series: [],
      };
      s.lists = [s.bgColors, ...s.times];
      s.series = [
        s.valueIn, s.knn, s.price, s.c, s.o, s.knnLine, s.lineCol, s.green, s.red, s.plot0, s.plot1, ...s.flags,
      ];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const time = bar.time;
      const close = bar.close;
      const newDay = usesVwap && dayChange(bars, b);
      const valueIn = s.valueIn;
      valueIn[b] = s.valueSrc.step(bar, b, bars, s.vars, newDay);
      const target = s.targetSrc.step(bar, b, bars, s.vars, newDay);

      // meanOfKClosest(value_in, target_in)
      const dists = new Array<number>(k).fill(1e10);
      const vals = new Array<number>(k).fill(0.0);
      for (let i = 1; i <= windowSize; i++) {
        const value = b - i >= 0 ? valueIn[b - i] : NaN;
        const distance = Math.abs(target - value);
        let maxDistIndex = 0;
        let maxDistValue = dists[0];
        for (let j = 1; j <= k - 1; j++) {
          if (gt(dists[j], maxDistValue)) {
            maxDistIndex = j;
            maxDistValue = dists[j];
          }
        }
        if (lt(distance, maxDistValue)) {
          dists[maxDistIndex] = distance;
          vals[maxDistIndex] = value;
        }
      }
      const knnMA = vals.reduce((sum, v) => sum + v, 0) / k;

      // price = math.avg(knnMA, close); c = ta.rma(knnMA[1], smoothingPeriod); o = ta.rma(knnMA, smoothingPeriod)
      const price = s.price;
      const c = s.c;
      const o = s.o;
      price[b] = (knnMA + close) / 2;
      // knnMA[1]: the knnMA of the bar before (the mean of the line value pushed on that bar)
      c[b] = s.cRma.step(b > 0 ? s.knn[b - 1] : NaN);
      s.knn[b] = knnMA;
      o[b] = s.oRma.step(knnMA);

      // knn(price): each new nearest of the last 10 values votes with c > o (down) / c < o (up) on its bar
      let pos = 0;
      let neg = 0;
      let minDistance = 10e10;
      for (let j = 1; j <= 10; j++) {
        const pj = b - j >= 0 ? price[b - j] : NaN;
        const distance = Math.sqrt(Math.pow(pj - price[b], 2));
        if (lt(distance, minDistance)) {
          minDistance = distance;
          const cj = b - j >= 0 ? c[b - j] : NaN;
          const oj = b - j >= 0 ? o[b - j] : NaN;
          if (lt(cj, oj)) pos += 1;
          if (gt(cj, oj)) neg += 1;
        }
      }
      const raw = pos > neg ? 1 : -1;
      const knnPrediction = s.predWma.step(raw, 3);

      const knnLine = s.knnLine;
      const v = s.lineWma.step(knnMA, 5);
      knnLine[b] = v;
      const maKnn = o[b]; // MAknn_ = ta.rma(knnMA, smoothingPeriod)
      const at = (i: number) => (i >= 0 ? knnLine[i] : NaN);
      const p = at(b - 1);
      const col = gt(v, p) ? cfg.upKnnColor : lt(v, p) ? cfg.downKnnColor : cfg.neutralKnnColor;
      s.lineCol[b] = col;

      // green = knn_prediction < 0.5, red = knn_prediction > -0.5
      const green = lt(knnPrediction, 0.5);
      const red = gt(knnPrediction, -0.5);
      s.green[b] = green;
      s.red[b] = red;
      if (cfg.showBackground) {
        // bgcolor(green and bgcolor ? color.new(Dn_col, 80) : red and bgcolor ? color.new(Up_col, 80) : na)
        if (green) s.bgColors.push({ id: 'bgcolor0', time, color: dn80 });
        else if (red) s.bgColors.push({ id: 'bgcolor0', time, color: up80 });
      }

      // plot(knnMA_, "Knn Classifier Line", knnMA_col); plot(MAknn_, "Average Knn Classifier Line", Maknn_col)
      s.plot0[b] = { time, value: v, color: col };
      s.plot1[b] = { time, value: maKnn, color: cfg.maKnnColor };

      // alertconditions: crosses with the bar before (a > b now, a <= b before), switches, neutral, predictions
      const pMa = b > 0 ? o[b - 1] : NaN;
      const pClose = b > 0 ? bars[b - 1].close : NaN;
      const flags = s.flags;
      flags[0][b] = v > maKnn && p <= pMa;
      flags[1][b] = v < maKnn && p >= pMa;
      flags[2][b] = v > close && p <= pClose;
      flags[3][b] = v < close && p >= pClose;
      flags[4][b] = lt(p, v) && le(p, at(b - 2));
      flags[5][b] = gt(p, v) && ge(p, at(b - 2));
      flags[6][b] = b > 0 && col === cfg.neutralKnnColor && s.lineCol[b - 1] !== cfg.neutralKnnColor;
      flags[7][b] = green && !(b > 0 && s.green[b - 1]);
      flags[8][b] = red && !(b > 0 && s.red[b - 1]);
      for (let q = 0; q < 9; q++) if (flags[q][b]) s.times[q].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AiTrendNavigatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AiTrendNavigatorInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Knn Crossover Average Knn', message: 'Knn Crossover Average Knn' },
  { id: 'alert1', title: 'Knn Crossunder Average Knn', message: 'Knn Crossunder Average Knn' },
  { id: 'alert2', title: 'Knn Crossover Close', message: 'Knn Crossover Close' },
  { id: 'alert3', title: 'Knn Crossunder Close', message: 'Knn Crossunder Close' },
  { id: 'alert4', title: 'Knn Switch Up', message: 'Knn Switch Up' },
  { id: 'alert5', title: 'Knn Switch Dn', message: 'Knn Switch Dn' },
  { id: 'alert6', title: 'Knn is Neutral', message: 'Knn is Neutral' },
  { id: 'alert7', title: 'Positive Prediction', message: 'Positive Prediction' },
  { id: 'alert8', title: 'Negative Prediction', message: 'Negative Prediction' },
];

export const AiTrendNavigator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
