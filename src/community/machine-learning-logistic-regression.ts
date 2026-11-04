/**
 * Machine Learning: Logistic Regression
 *
 * A logistic regression is trained again on every bar over the last "Lookback Window Size" bars. With "Optional
 * Calculation?" (the default) the feature is the bar time and the target the price ("Price Type", from the
 * "Resolution" timeframe); without it the feature is the price and the target a synthetic series
 * log(|price^2 - 1| + 0.5). The training loop runs "Training Iterations" gradient steps from a weight of 0: the
 * hypothesis is sigmoid(sum(X * 0)) = 0.5 on every step (the original multiplies by 0.0, not by the weight), so the
 * loss and the gradient are the same on every step and the weight moves by the same learning-rate step each time.
 * The loss and the prediction (sigmoid of sum(X * w)) are rescaled to the price range of the last "Normalization
 * Lookback" bars. Signal: with "Use Price Data for Signal Generation?" the price below the scaled loss is a sell and
 * above it a buy; otherwise a cross of the scaled loss under / over the scaled prediction. An optional filter
 * (ATR(1) > ATR(10), and / or the 10-bar HMA of the 14-bar RSI of the volume above 49) gates the signals.
 * A change of the signal draws a Buy / Sell label; a cross marks the end of a trade (the opposite signal or
 * "Holding Period" bars after the entry). The last bar shows an info label: a running sum of trade results
 * (cumulative sums of the last result of each side, as the original computes them), the trade count, the win / loss
 * ratio, the win rate and the elapsed share of the current bar.
 * The `math.sum` calls inside the training loop keep one value per bar (their last call) and each call starts from
 * the earlier bars: the port calls each of them once per bar (the same value on every step gives the same sum) and
 * runs the weight steps as the original.
 * Chart values (optional third argument of calculate): on a last bar that is still open the price is the one of the
 * bar before (`ds[barstate.ishistory ? 0 : 1]`); the info label reads the current time (timenow) and the close time
 * of the bar before (exchange calendar); "Resolution" periods follow the exchange calendar (see
 * src/anchor-period.ts). Without a context the last bar is closed, the clock of the computer is the current time
 * and the bar before closes one bar interval after it opens.
 *
 * Reference: "Machine Learning: Logistic Regression" by capissimo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © capissimo
 */

import {
  ta, str, color, timeframe, callsite, Series, periodClose,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { LabelData, MarkerData } from '../types';
import { lastBarConfirmedOf, nowOf, type ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, higherTimeframeBars } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

type PriceType = 'Open' | 'High' | 'Low' | 'Close' | 'HL2' | 'OC2' | 'OHL3' | 'HLC3' | 'OHLC4';
type FilterType = 'Volatility' | 'Volume' | 'Both' | 'None';

export interface MachineLearningLogisticRegressionInputs {
  /** Price Type */
  ptype: PriceType;
  /** Resolution ('' = chart timeframe) */
  reso: string;
  /** Lookback Window Size */
  lookback: number;
  /** Normalization Lookback */
  nlbk: number;
  /** Learning Rate */
  lrate: number;
  /** Training Iterations */
  iterations: number;
  /** Filter Signals by */
  ftype: FilterType;
  /** Show Loss & Prediction Curves? */
  curves: boolean;
  /** Optional Calculation? */
  easteregg: boolean;
  /** Use Price Data for Signal Generation? */
  useprice: boolean;
  /** Holding Period */
  holdingP: number;
  /** Lot Size */
  lotSize: number;
  /** Show Info? */
  showInfo: boolean;
}

export const defaultInputs: MachineLearningLogisticRegressionInputs = {
  ptype: 'Close',
  reso: '',
  lookback: 3,
  nlbk: 2,
  lrate: 0.0009,
  iterations: 1000,
  ftype: 'None',
  curves: false,
  easteregg: true,
  useprice: true,
  holdingP: 5,
  lotSize: 0.01,
  showInfo: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'ptype', type: 'string', title: 'Price Type', defval: 'Close', options: ['Open', 'High', 'Low', 'Close', 'HL2', 'OC2', 'OHL3', 'HLC3', 'OHLC4'] },
  { id: 'reso', type: 'timeframe', title: 'Resolution', defval: '' },
  { id: 'lookback', type: 'int', title: 'Lookback Window Size |2..n| (2)', defval: 3, min: 2 },
  { id: 'nlbk', type: 'int', title: 'Normalization Lookback |2..240| (120)', defval: 2, min: 2, max: 240 },
  { id: 'lrate', type: 'float', title: 'Learning Rate |0.0001..0.01|', defval: 0.0009, min: 0.0001, max: 0.01, step: 0.0001 },
  { id: 'iterations', type: 'int', title: 'Training Iterations |50..20000|', defval: 1000, min: 50 },
  { id: 'ftype', type: 'string', title: 'Filter Signals by', defval: 'None', options: ['Volatility', 'Volume', 'Both', 'None'] },
  { id: 'curves', type: 'bool', title: 'Show Loss & Prediction Curves?', defval: false },
  { id: 'easteregg', type: 'bool', title: 'Optional Calculation?', defval: true },
  { id: 'useprice', type: 'bool', title: 'Use Price Data for Signal Generation?', defval: true },
  { id: 'holdingP', type: 'int', title: 'Holding Period |1..n|', defval: 5, min: 1 },
  { id: 'lotSize', type: 'float', title: 'Lot Size', defval: 0.01, options: ['0.01', '0.1', '0.2', '0.3', '0.5', '1', '2', '3', '5', '10', '20', '30', '50', '100', '1000'] },
  { id: 'showInfo', type: 'bool', title: 'Show Info?', defval: true },
];

const AQUA10 = '#0080FF';
const PINK10 = '#FF0080';
const AQUA6 = '#0080FF99';
const PINK6 = '#FF008099';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scaled Loss', color: '#2196F3', lineWidth: 3 },
  { id: 'plot1', title: 'Scaled Prediction', color: '#00E676', lineWidth: 3 },
  { id: 'plot2', title: 'StopBuy', color: AQUA6, lineWidth: 2, style: 'cross' },
  { id: 'plot3', title: 'StopSell', color: PINK6, lineWidth: 2, style: 'cross' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Buy', style: 'labelup', location: 'belowbar', color: AQUA10, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Sell', style: 'labeldown', location: 'abovebar', color: PINK10, size: 'small' },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy', message: 'Go long!' },
  { id: 'alert1', title: 'Sell', message: 'Go short!' },
  { id: 'alert2', title: 'Alert', message: 'Deal Time!' },
];

export const metadata = {
  title: 'Machine Learning: Logistic Regression (v.3)',
  shortTitle: 'Machine Learning: Logistic Regression (v.3)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const sigmoid = (z: number) => 1.0 / (1.0 + Math.exp(-z));

function priceOf(b: Bar, ptype: PriceType): number {
  switch (ptype) {
    case 'Open': return b.open;
    case 'High': return b.high;
    case 'Low': return b.low;
    case 'Close': return b.close;
    case 'HL2': return (b.high + b.low) / 2;
    case 'OC2': return (b.open + b.close) / 2;
    case 'OHL3': return (b.open + b.high + b.low) / 3;
    case 'HLC3': return (b.high + b.low + b.close) / 3;
    default: return (b.open + b.high + b.low + b.close) / 4;
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningLogisticRegressionInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; labels: LabelData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : (v as number)));
  const S = (a: number[]) => Series.fromArray(bars, a);
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;
  const p = Math.trunc(cfg.lookback);
  const nlbk = Math.trunc(cfg.nlbk);
  const liveLast = !lastBarConfirmedOf(chart);
  const isHistory = (i: number) => !(i === n - 1 && liveLast);

  // base_ds = security('', reso, ds[barstate.ishistory ? 0 : 1])
  const ds = bars.map((b) => priceOf(b, cfg.ptype));
  const chartTf = chartTimeframe(bars, chart);
  const sameTf = cfg.reso === '' || chartTf === '' || timeframe.in_seconds(cfg.reso) === timeframe.in_seconds(chartTf);
  let baseDs: number[];
  if (sameTf) {
    baseDs = ds.map((v, i) => (isHistory(i) ? v : i > 0 ? ds[i - 1] : NaN));
  } else {
    // no lookahead: the latest completed bar of the timeframe (its own price on its historical bars)
    const sec = higherTimeframeBars(bars, cfg.reso, chart);
    baseDs = sec.latest.map((g) => (g >= 0 ? priceOf(sec.htf[g], cfg.ptype) : NaN));
  }
  const synthDs = baseDs.map((v) => Math.log(Math.abs(Math.pow(v, 2) - 1) + 0.5));
  const base = cfg.easteregg ? bars.map((b) => b.time * ms) : baseDs;
  const synth = cfg.easteregg ? baseDs : synthDs;

  // logistic_regression(base, synth, lookback, lrate, iterations): one math.sum call site per dot() call
  const siteHyp = callsite.sum();
  const siteLossIn = callsite.sum();
  const siteLossOut = callsite.sum();
  const siteGrad = callsite.sum();
  const sitePred = callsite.sum();
  const loss: number[] = new Array(n);
  const prediction: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const X = base[i];
    const Y = synth[i];
    const hypothesis = sigmoid(siteHyp(i, X * 0.0, p));
    const inner = siteLossIn(i, Y * (Math.log(hypothesis) + (1.0 - Y)), p);
    loss[i] = (-1.0 / p) * siteLossOut(i, inner * Math.log(1.0 - hypothesis), p);
    const gradient = (1.0 / p) * siteGrad(i, X * (hypothesis - Y), p);
    let w = 0.0;
    for (let k = 1; k <= cfg.iterations; k++) w = w - cfg.lrate * gradient;
    prediction[i] = sigmoid(sitePred(i, X * w, p));
  }

  // minimax(ds, p, lowest(base_ds, nlbk), highest(base_ds, nlbk))
  const minP = A(ta.lowest(S(baseDs), nlbk));
  const maxP = A(ta.highest(S(baseDs), nlbk));
  const minimax = (v: number[]) => {
    const hi = A(ta.highest(S(v), nlbk));
    const lo = A(ta.lowest(S(v), nlbk));
    return v.map((x, i) => ((maxP[i] - minP[i]) * (x - lo[i])) / (hi[i] - lo[i]) + minP[i]);
  };
  const scaledLoss = minimax(loss);
  const scaledPrediction = minimax(prediction);

  // filters (constant ftype: the call of the chosen branch runs on every bar)
  let filter: boolean[] = new Array(n).fill(true);
  if (cfg.ftype !== 'None') {
    const atr1 = A(ta.atr(bars, 1));
    const atr10 = A(ta.atr(bars, 10));
    const volatility = atr1.map((v, i) => gt(v, atr10[i]));
    const osc = A(ta.hma(ta.rsi(new Series(bars, (b) => b.volume ?? NaN), 14), 10));
    const volumeOk = osc.map((v) => gt(v, 49));
    filter = cfg.ftype === 'Volatility' ? volatility : cfg.ftype === 'Volume' ? volumeOk
      : volatility.map((v, i) => v && volumeOk[i]);
  }

  const crossUnder = callsite.crossunder();
  const crossOver = callsite.crossover();
  const markers: MarkerData[] = [];
  const stopBuy: number[] = new Array(n).fill(NaN);
  const stopSell: number[] = new Array(n).fill(NaN);
  const flags: boolean[][] = [[], [], []];
  const longTrades: number[] = new Array(n);
  const shortTrades: number[] = new Array(n);
  const tradeCount: number[] = new Array(n);
  const winsArr: number[] = new Array(n);
  let signal = 0;
  let hpCounter = 0;
  let startLong = 0;
  let startShort = 0;
  let longT = 0;
  let shortT = 0;
  let wins = 0;
  let trades = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const prevSignal = i > 0 ? signal : NaN;
    if (cfg.useprice) {
      const sell = lt(baseDs[i], scaledLoss[i]) && filter[i];
      const buy = !sell && gt(baseDs[i], scaledLoss[i]) && filter[i];
      signal = sell ? -1 : buy ? 1 : signal;
    } else {
      // the crossover in the else branch of the ternary only runs when the crossunder test is false
      const sell = crossUnder(scaledLoss[i], scaledPrediction[i]) && filter[i];
      const buy = !sell && crossOver(scaledLoss[i], scaledPrediction[i]) && filter[i];
      signal = sell ? -1 : buy ? 1 : signal;
    }
    // changed = change(signal): na on the first bar (false)
    const changed = !isNaN(prevSignal) && signal - prevSignal !== 0;
    hpCounter = changed ? 0 : hpCounter + 1;
    const startLongTrade = changed && signal === 1;
    const startShortTrade = changed && signal === -1;
    const endLongTrade = (signal === 1 && hpCounter === cfg.holdingP && !changed) || (changed && signal === -1);
    const endShortTrade = (signal === -1 && hpCounter === cfg.holdingP && !changed) || (changed && signal === 1);

    if (startLongTrade && b.low !== 0) {
      markers.push({ id: 'shape0', time: b.time, position: 'belowBar', shape: 'labelUp', color: AQUA10, size: 'small' });
    }
    if (startShortTrade && b.high !== 0) {
      markers.push({ id: 'shape1', time: b.time, position: 'aboveBar', shape: 'labelDown', color: PINK10, size: 'small' });
    }
    if (endLongTrade) stopBuy[i] = b.high;
    if (endShortTrade) stopSell[i] = b.low;
    flags[0].push(startLongTrade);
    flags[1].push(startShortTrade);
    flags[2].push(startLongTrade || startShortTrade);

    // backtesting
    const ohl3 = (b.open + b.high + b.low) / 3;
    if (startLongTrade) startLong = ohl3;
    if (endLongTrade) {
      trades = 1;
      const ldiff = ohl3 - startLong;
      wins = gt(ldiff, 0) ? 1 : 0;
      longT = ldiff * Number(cfg.lotSize);
    }
    if (startShortTrade) startShort = ohl3;
    if (endShortTrade) {
      trades = 1;
      const sdiff = startShort - ohl3;
      wins = gt(sdiff, 0) ? 1 : 0;
      shortT = sdiff * Number(cfg.lotSize);
    }
    longTrades[i] = longT;
    shortTrades[i] = shortT;
    tradeCount[i] = trades;
    winsArr[i] = wins;
  }

  // info label on the last bar
  const labels: LabelData[] = [];
  if (cfg.showInfo && n > 0) {
    const last = n - 1;
    const cumAt = (v: number[]) => {
      const c = A(ta.cum(S(v)));
      return c[last];
    };
    const cumreturn = cumAt(longTrades) + cumAt(shortTrades);
    const totaltrades = cumAt(tradeCount);
    const totalwins = cumAt(winsArr);
    const totallosses = totaltrades - totalwins === 0 ? 1 : totaltrades - totalwins;
    const tbase = last > 0 ? ((bars[last].time - bars[last - 1].time) * ms) / 1000 : NaN;
    let prevClose = NaN;
    if (last > 0) {
      const interval = (bars[last].time - bars[last - 1].time) * ms;
      prevClose = bars[last - 1].time * ms + interval;
      if (chart && hasCalendar(chart) && chartTf !== '') {
        const context = {
          timeframe: chartTf, timezone: chart.timezone, session: chart.session, regularSession: chart.regularSession,
          timeUnit: 'ms' as const,
        };
        const v = periodClose(bars[last - 1].time * ms, chartTf, context);
        if (Number.isFinite(v)) prevClose = v;
      }
    }
    const tcurr = (nowOf(chart) - prevClose) / 1000;
    const info = 'CR=' + str.tostring(cumreturn, '#.#')
      + '\nTrades: ' + str.tostring(totaltrades, '#')
      + '\nWin/Loss: ' + str.tostring(totalwins / totallosses, '#.##')
      + '\nWinrate: ' + str.tostring(totalwins / totaltrades, '#.#%')
      + '\nBar Time: ' + str.tostring(tcurr / tbase, '#.#%');
    labels.push({
      time: bars[last].time, price: bars[last].close, text: info, color: String(color.new('#2196F3', 100)),
      textColor: '#363A45', style: 'label_left', size: 'small', textAlign: 'left',
    });
  }

  const line = (v: number[], col: string) => bars.map((b, i) => ({
    time: b.time, value: Number.isFinite(v[i]) ? v[i] : NaN, color: col,
  }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: line(cfg.curves ? scaledLoss : new Array(n).fill(NaN), '#2196F3'),
      plot1: line(cfg.curves ? scaledPrediction : new Array(n).fill(NaN), '#00E676'),
      plot2: line(stopBuy, AQUA6),
      plot3: line(stopSell, PINK6),
    },
    markers,
    labels,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const MachineLearningLogisticRegression = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
};
