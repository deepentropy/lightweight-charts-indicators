/**
 * Volume SuperTrend AI (Expo)
 *
 * A SuperTrend built on a volume-weighted average of the close (`Moving Average Source`: SMA / EMA / WMA / RMA /
 * VWMA of close * volume over the same average of the volume) -/+ factor * ATR(len), with the usual band trailing:
 * the lower band only rises and the upper band only falls while the previous close stays on their side. A weighted
 * k-nearest-neighbours vote classifies the current SuperTrend value: the last `Data` SuperTrend values are the
 * points, each labelled 1 when WMA(close, `Price Trend`) was above WMA(SuperTrend, `Prediction Trend`) on that bar,
 * else 0; the `Neighbors` nearest points (bubble sort of |distance|) vote with a weight of 1 / (distance + 1e-6).
 * A vote of exactly 1 colours the line bullish, exactly 0 bearish, anything else neutral. The SuperTrend is drawn
 * with its up / down halves (line breaks) and a fill between each half and the candle body midpoint (hidden plot)
 * at 90 % transparency of the line colour. Circles mark the start of a bullish / bearish colour, triangles a
 * direction change confirmed by the vote.
 * Alerts (alertcondition, `alerts` of the result): bullish / bearish / any trend start and trend signal.
 *
 * Reference: "Volume SuperTrend AI (Expo)" by Zeiierman
 * Licence: Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0), as the original
 * (https://creativecommons.org/licenses/by-nc-sa/4.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VolumeSuperTrendAiMaSource = 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'VWMA';

export interface VolumeSuperTrendAiInputs {
  /** Number of nearest neighbours (k) */
  k: number;
  /** Number of data points (n = max(k, n)) */
  n: number;
  /** WMA length of the close (labels of the points) */
  knnPriceLen: number;
  /** WMA length of the SuperTrend (labels of the points) */
  knnSTLen: number;
  /** Show the trend start / signal shapes */
  aiSignals: boolean;
  bullishCol: string;
  bearishCol: string;
  /** SuperTrend length (average and ATR) */
  atrLen: number;
  /** ATR multiplier */
  factor: number;
  /** Average of close * volume / volume */
  maSrc: VolumeSuperTrendAiMaSource;
  upCol: string;
  dnCol: string;
  neCol: string;
}

export const defaultInputs: VolumeSuperTrendAiInputs = {
  k: 3,
  n: 10,
  knnPriceLen: 20,
  knnSTLen: 100,
  aiSignals: true,
  bullishCol: color.lime,
  bearishCol: color.red,
  atrLen: 10,
  factor: 3.0,
  maSrc: 'WMA',
  upCol: color.lime,
  dnCol: color.red,
  neCol: color.blue,
};

const T1 = 'Number of nearest neighbors in KNN algorithm (k): Increase to consider more neighbors, providing a more balanced view but possibly smoothing out local patterns. Decrease for fewer neighbors to make the algorithm more responsive to recent changes. \n\nNumber of data points to consider (n): Increase for more historical data, providing a broader context but possibly diluting recent trends. Decrease for less historical data to focus more on recent behavior.';
const T2 = 'Length of weighted moving average for price (KNN_PriceLen): Higher values create a smoother price line, influencing the KNN algorithm to be more stable but less sensitive to short-term price movements. Lower values enhance responsiveness in KNN predictions to recent price changes but may lead to more noise. \n\nLength of weighted moving average for SuperTrend (KNN_STLen): Higher values lead to a smoother SuperTrend line, affecting the KNN algorithm to emphasize long-term trends. Lower values make KNN predictions more sensitive to recent SuperTrend changes but may result in more volatility.';
const T3 = 'Length of the SuperTrend (len): Increase for a smoother trend line, ideal for identifying long-term trends but possibly ignoring short-term fluctuations. Decrease for more responsiveness to recent changes but risk of more false signals. \n\nMultiplier for ATR in SuperTrend calculation (factor): Increase for wider bands, capturing larger price movements but possibly missing subtle changes. Decrease for narrower bands, more sensitive to small shifts but risk of more noise.';
const T4 = 'Type of moving average for SuperTrend calculation (maSrc): Choose based on desired characteristics. SMA is simple and clear, EMA emphasizes recent prices, WMA gives more weight to recent data, RMA is less sensitive to recent changes, and VWMA considers volume.';
const T5 = 'Color for bullish trend (upCol): Select to visually identify upward trends. \n\nColor for bearish trend (dnCol): Select to visually identify downward trends.\n\nColor for neutral trend (neCol): Select to visually identify neutral trends.';

const AI_GROUP = 'AI Settings';
const TREND_GROUP = 'AI Trend';
const ST_GROUP = 'Super Trend Settings';
const COL_GROUP = 'Super Trend Coloring';

export const inputConfig: InputConfig[] = [
  { id: 'k', type: 'int', title: 'Neighbors', defval: 3, min: 1, max: 100, inline: 'AI', group: AI_GROUP },
  { id: 'n', type: 'int', title: 'Data', defval: 10, min: 1, max: 100, inline: 'AI', group: AI_GROUP, tooltip: T1 },
  { id: 'knnPriceLen', type: 'int', title: 'Price Trend', defval: 20, min: 2, max: 500, step: 10, inline: 'AITrend', group: TREND_GROUP },
  { id: 'knnSTLen', type: 'int', title: 'Prediction Trend', defval: 100, min: 2, max: 500, step: 10, inline: 'AITrend', group: TREND_GROUP, tooltip: T2 },
  { id: 'aiSignals', type: 'bool', title: 'AI Trend Signals', defval: true, inline: 'signal', group: TREND_GROUP },
  { id: 'bullishCol', type: 'color', title: '', defval: color.lime, inline: 'signal', group: TREND_GROUP },
  { id: 'bearishCol', type: 'color', title: '', defval: color.red, inline: 'signal', group: TREND_GROUP },
  { id: 'atrLen', type: 'int', title: 'Length', defval: 10, min: 1, inline: 'SuperTrend', group: ST_GROUP },
  { id: 'factor', type: 'float', title: '', defval: 3.0, step: 0.1, inline: 'SuperTrend', group: ST_GROUP, tooltip: T3 },
  { id: 'maSrc', type: 'string', title: 'Moving Average Source', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'VWMA'], group: ST_GROUP, tooltip: T4 },
  { id: 'upCol', type: 'color', title: 'Bullish Color', defval: color.lime, inline: 'col', group: COL_GROUP },
  { id: 'dnCol', type: 'color', title: 'Bearish Color', defval: color.red, inline: 'col', group: COL_GROUP },
  { id: 'neCol', type: 'color', title: 'Neutral Color', defval: color.blue, inline: 'col', group: COL_GROUP, tooltip: T5 },
];

// The plot colours are the per-bar trend colour (col): the Style rows show the default series colour
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Super Trend AI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Up Volume Super Trend AI', color: '#2962FF', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Plot', color: '#2962FF', lineWidth: 1, display: 'none', editable: false },
  { id: 'plot3', title: 'Down Volume Super Trend AI', color: '#2962FF', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Volume SuperTrend AI (Expo)',
  shortTitle: 'Volume SuperTrend AI (Expo)',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '1 Bullish Trend Start', message: 'AI Bullish Trend Start' },
  { id: 'alert1', title: '2 Bearish Trend Start', message: 'AI Bearish Trend Start' },
  { id: 'alert2', title: '3 Any Trend Start', message: 'Any AI Trend Start' },
  { id: 'alert3', title: '4 Bullish Trend Signal', message: 'AI Bullish Trend Signal' },
  { id: 'alert4', title: '5 Bearish Trend Signal', message: 'AI Bearish Trend Signal' },
  { id: 'alert5', title: '6 Any Trend Signal', message: 'Any AI Trend Signal' },
];

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Avg = { step(v: number, volume: number): number; commit(): void };

/** average(source, len) of the `Moving Average Source` input */
function avgStep(maSrc: VolumeSuperTrendAiMaSource, len: number): Avg {
  switch (maSrc) {
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'VWMA': { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 'WMA':
    default: { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
  }
}

interface VstRun extends BarRunState<Record<string, never>> {
  num: Avg;
  den: Avg;
  atr: ReturnType<typeof taStep.atr>;
  price: ReturnType<typeof taStep.wma>;
  sT: ReturnType<typeof taStep.wma>;
  atrArr: number[];
  lowerBand: number[];
  upperBand: number[];
  direction: number[];
  superTrend: number[];
  labelOf: number[];
  col: string[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  fillCol: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeSuperTrendAiInputs>): BarStudy<VstRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.atrLen;
  const k = cfg.k;
  const n = Math.max(k, cfg.n);
  const at = (a: number[], i: number) => (i >= 0 && i < a.length ? a[i] : NaN);
  // scratch arrays of the KNN vote, written in full on each bar
  const distances: number[] = new Array(n);
  const indices: number[] = new Array(n);
  return {
    init() {
      const num = avgStep(cfg.maSrc, len);
      const den = avgStep(cfg.maSrc, len);
      const atr = taStep.atr(len);
      const price = taStep.wma();
      const sT = taStep.wma();
      const s: VstRun = {
        num, den, atr, price, sT, atrArr: [], lowerBand: [], upperBand: [], direction: [], superTrend: [], labelOf: [],
        col: [], plot0: [], plot1: [], plot2: [], plot3: [], fillCol: [], markers: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [num, den, atr, price, sT], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.atrArr, s.lowerBand, s.upperBand, s.direction, s.superTrend, s.labelOf, s.col, s.plot0, s.plot1, s.plot2,
        s.plot3, s.fillCol, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const volume = b.volume ?? NaN;
      // vwma = average(close * volume, len) / average(volume, len)
      const num = s.num.step(close * volume, volume);
      const den = s.den.step(volume, volume);
      // division by zero gives na
      const vwma = den === 0 ? NaN : num / den;
      const atr = s.atr.step(b.high, b.low, b.close);
      s.atrArr[i] = atr;

      const ub = vwma + cfg.factor * atr;
      const lb = vwma - cfg.factor * atr;
      const prevLower = i > 0 && !isNaN(s.lowerBand[i - 1]) ? s.lowerBand[i - 1] : 0; // nz(lowerBand[1])
      const prevUpper = i > 0 && !isNaN(s.upperBand[i - 1]) ? s.upperBand[i - 1] : 0; // nz(upperBand[1])
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const lowerBand = lb > prevLower || close1 < prevLower ? lb : prevLower;
      const upperBand = ub < prevUpper || close1 > prevUpper ? ub : prevUpper;
      s.lowerBand[i] = lowerBand;
      s.upperBand[i] = upperBand;
      const prevSuperTrend = i > 0 ? s.superTrend[i - 1] : NaN;
      let dir: number;
      if (isNaN(i > 0 ? s.atrArr[i - 1] : NaN)) dir = 1;
      else if (prevSuperTrend === prevUpper) dir = close > upperBand ? -1 : 1;
      else dir = close < lowerBand ? 1 : -1;
      s.direction[i] = dir;
      const superTrend = dir === -1 ? lowerBand : upperBand;
      s.superTrend[i] = superTrend;

      // KNN points: superTrend[i] labelled price[i] > sT[i] ? 1 : 0, i = 0 .. n - 1 bars back
      const price = s.price.step(close, cfg.knnPriceLen);
      const sT = s.sT.step(superTrend, cfg.knnSTLen);
      s.labelOf[i] = price > sT ? 1 : 0;
      const st = s.superTrend;
      for (let j = 0; j < n; j++) {
        distances[j] = Math.abs(superTrend - at(st, i - j));
        indices[j] = j;
      }
      // bubble sort, ascending (a comparison with na is false: no swap)
      for (let a = 0; a <= n - 2; a++) {
        for (let j = 0; j <= n - a - 2; j++) {
          if (distances[j] > distances[j + 1]) {
            const td = distances[j]; distances[j] = distances[j + 1]; distances[j + 1] = td;
            const ti = indices[j]; indices[j] = indices[j + 1]; indices[j + 1] = ti;
          }
        }
      }
      let weightedSum = 0;
      let totalWeight = 0;
      for (let j = 0; j < k; j++) {
        const back = indices[j];
        const lbl = i - back >= 0 ? s.labelOf[i - back] : 0; // price[i] > sT[i] with na is false
        const w = 1 / (distances[j] + 1e-6);
        weightedSum += w * lbl;
        totalWeight += w;
      }
      const label_ = weightedSum / totalWeight;

      const col = label_ === 1 ? cfg.upCol : label_ === 0 ? cfg.dnCol : cfg.neCol;
      s.col[i] = col;
      s.fillCol[i] = String(color.new(col, 90));

      // Signals
      const c1 = i > 0 ? s.col[i - 1] : undefined; // col[1] na on the first bar: != is true, == is false
      const su = col === cfg.upCol && (c1 !== cfg.upCol || c1 === cfg.neCol) && cfg.aiSignals;
      const sd = col === cfg.dnCol && (c1 !== cfg.dnCol || c1 === cfg.neCol) && cfg.aiSignals;
      const d1 = i > 0 ? s.direction[i - 1] : NaN;
      const tu = dir === -1 && d1 === 1 && label_ === 1 && cfg.aiSignals;
      const td = dir === 1 && d1 === -1 && label_ === 0 && cfg.aiSignals;
      const t = b.time;
      const flags = [su, sd, su || sd, tu, td, tu || td];
      for (let f = 0; f < 6; f++) {
        s.flags[f][i] = flags[f];
        if (flags[f]) s.times[f].push(t as number);
      }
      if (!isNaN(superTrend)) {
        if (su) s.markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: superTrend, shape: 'circle', color: cfg.bullishCol, size: 'tiny' });
        if (sd) s.markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: superTrend, shape: 'circle', color: cfg.bearishCol, size: 'tiny' });
        if (tu) s.markers.push({ id: 'shape2', time: t, position: 'atPriceMiddle', price: superTrend, shape: 'triangleUp', color: cfg.bullishCol, size: 'small' });
        if (td) s.markers.push({ id: 'shape3', time: t, position: 'atPriceMiddle', price: superTrend, shape: 'triangleDown', color: cfg.bearishCol, size: 'small' });
      }

      // plot(current_superTrend, color = col, title = "Volume Super Trend AI")
      s.plot0[i] = { time: t, value: superTrend, color: col };
      // plot(superTrend == lowerBand ? current_superTrend : na, "Up Volume Super Trend AI", col, linebr)
      s.plot1[i] = { time: t, value: superTrend === lowerBand ? superTrend : NaN, color: col };
      // Middle = plot((open + close) / 2, display = display.none, editable = false)
      s.plot2[i] = { time: t, value: (b.open + b.close) / 2 };
      // plot(superTrend == upperBand ? current_superTrend : na, "Down Volume Super Trend AI", col, linebr)
      s.plot3[i] = { time: t, value: superTrend === upperBand ? superTrend : NaN, color: col };
    },
    result(s, bars) {
      const nb = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        // fill(Middle, upTrend / downTrend, color.new(col, 90), fillgaps = false)
        fills: [
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'Up Volume Super Trend AI' }, colors: s.fillCol.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Down Volume Super Trend AI' }, colors: s.fillCol.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => nb > 0 && f[nb - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeSuperTrendAiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeSuperTrendAiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
export const VolumeSuperTrendAi = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, alertConditions };
