/**
 * Kalman VWAP Filter
 *
 * A Kalman filter of a measurement that blends the price with a VWAP baseline:
 * meas = (1 - vwapWeight) * price + vwapWeight * VWAP. The VWAP is the session VWAP (anchored on each new day;
 * the rolling VWAP when the session VWAP is na) or a rolling VWAP = SMA(price * volume, n) / SMA(volume, n).
 * Filter per bar: p = P + processNoise, K = p / (p + measurementNoise), x = x + K * (meas - x), P = (1 - K) * p,
 * started at the first measurement with P = 1 (started again after an na measurement). The line and the price bars
 * are green while the filter rises and red otherwise.
 * The VWAP day: on intraday bars the port reads the exchange time zone and the session of the symbol from the
 * optional third argument (see src/chart-context.ts) and starts the VWAP with the trading day of the exchange, as
 * the original. Without them the day starts at 00:00 UTC.
 * Alerts (alertcondition, `alerts` of the result): the filter crossing over / under its value of the bar before
 * (slope up / down), the price crossing over / under the filter, and the filter crossing over / under the VWAP base.
 *
 * Reference: "Kalman VWAP Filter [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KalmanVwapFilterInputs {
  /** Price the filter observes */
  pricesource: SourceType;
  /** Process noise: higher = faster response */
  processNoise: number;
  /** Measurement noise: higher = smoother output */
  measurementNoise: number;
  /** Filter order: number of parallel states (they all get the same update, so the output does not depend on it) */
  filterOrder: number;
  /** 'Session' (daily anchored VWAP) or 'Rolling' (VWAP over vwapLen bars) */
  vwapMode: 'Session' | 'Rolling';
  /** Bars of the rolling VWAP */
  vwapLen: number;
  /** Price of the VWAP */
  vwapPriceSrc: SourceType;
  /** 0 = price only, 1 = VWAP only */
  vwapWeight: number;
  showkalman: boolean;
  paintCandles: boolean;
  longColor: string;
  shortColor: string;
  lineW: number;
  /** Line transparency (0..100) */
  transp: number;
}

export const defaultInputs: KalmanVwapFilterInputs = {
  pricesource: 'close',
  processNoise: 0.01,
  measurementNoise: 3.0,
  filterOrder: 5,
  vwapMode: 'Session',
  vwapLen: 50,
  vwapPriceSrc: 'hlc3',
  vwapWeight: 0.35,
  showkalman: true,
  paintCandles: true,
  longColor: '#33ff00',
  shortColor: '#ff0000',
  lineW: 4,
  transp: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'pricesource', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'processNoise', type: 'float', title: 'Process Noise', defval: 0.01, step: 0.01 },
  { id: 'measurementNoise', type: 'float', title: 'Measurement Noise', defval: 3.0 },
  { id: 'filterOrder', type: 'int', title: 'Filter Order', defval: 5, min: 1 },
  { id: 'vwapMode', type: 'string', title: 'VWAP Mode', defval: 'Session', options: ['Session', 'Rolling'] },
  { id: 'vwapLen', type: 'int', title: 'Rolling VWAP Length', defval: 50, min: 2 },
  { id: 'vwapPriceSrc', type: 'source', title: 'VWAP Price', defval: 'hlc3' },
  { id: 'vwapWeight', type: 'float', title: 'VWAP Weight (0..1)', defval: 0.35, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'showkalman', type: 'bool', title: 'Show Filtered Price on chart?', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles by trend?', defval: true },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#33ff00' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff0000' },
  { id: 'lineW', type: 'int', title: 'Line Width', defval: 4 },
  { id: 'transp', type: 'int', title: 'Line Transparency', defval: 40 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kalman VWAP', color: String(color.new('#33ff00', 40)), lineWidth: 4 },
];

export const metadata = {
  title: 'Kalman VWAP Filter [BackQuant]',
  shortTitle: 'Kalman VWAP Filter [BackQuant]',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

const DAY_MS = 86400000;

interface KalmanVars {
  /** ta.vwap sums */
  sumPV: number;
  sumV: number;
  /** Kalman state and error covariance */
  x: number;
  P: number;
}

interface KalmanRun extends BarRunState<KalmanVars> {
  vwN: WindowSma;
  vwD: WindowSma;
  price: number[];
  kalman: number[];
  vwapBase: number[];
  plot0: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<KalmanVwapFilterInputs>): BarStudy<KalmanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const priceOf = barSource(cfg.pricesource);
  const vwapPriceOf = barSource(cfg.vwapPriceSrc);
  /** Chart context of the day changes (with the chart timeframe) and the time unit, set by init */
  let calChart: ChartContext = {};
  let ms = false;

  /**
   * Start of a new day (Pine ta.vwap anchor: timeframe.change("1D")) of bar i; true on the first bar. With the time
   * zone and the session of the chart context: the trading days of the exchange (the change of bars i - 1 and i, the
   * calendar reads the chart timeframe of the whole set). Else: UTC days.
   */
  const newDay = (bars: Bar[], i: number): boolean => {
    if (i === 0) return true;
    if (hasCalendar(calChart)) return periodChanges([bars[i - 1]!, bars[i]!], '1D', calChart)[1]!;
    const day = (t: number) => Math.floor((ms ? t : t * 1000) / DAY_MS);
    return day(bars[i]!.time) !== day(bars[i - 1]!.time);
  };

  return {
    fullRunReason: () => (isBarSource(cfg.pricesource) && isBarSource(cfg.vwapPriceSrc) ? null : 'source of another study'),
    // the day changes read the chart timeframe of the bar gaps (or the context) and the time unit of the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    init(bars, chart) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      const tfName = chartTimeframe(bars, chart);
      calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      const s: KalmanRun = {
        vwN: new WindowSma(cfg.vwapLen), vwD: new WindowSma(cfg.vwapLen),
        price: [], kalman: [], vwapBase: [], plot0: [], barColors: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [],
        // var stateEstimate = na, errorCovariance = 100
        vars: { sumPV: NaN, sumV: NaN, x: NaN, P: 100.0 },
        lists: [], series: [],
      };
      s.steps = [s.vwN, s.vwD];
      s.lists = [...s.times];
      s.series = [s.price, s.kalman, s.vwapBase, s.plot0, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      const price = priceOf(b);
      const volume = b.volume ?? NaN;
      s.price[i] = price;

      // sessionVWAP = ta.vwap(hlc3); rollingVWAP = sma(price * volume, len) / sma(volume, len) (x / 0 is +-infinity)
      const hlc3 = (b.high + b.low + b.close) / 3;
      if (newDay(bars, i)) {
        v.sumPV = hlc3 * volume;
        v.sumV = volume;
      } else {
        // An na source or volume makes the sums na until the next anchor
        v.sumPV += hlc3 * volume;
        v.sumV += volume;
      }
      const sessionVwap = v.sumV === 0 ? NaN : v.sumPV / v.sumV;
      const vwN = s.vwN.step(vwapPriceOf(b) * volume);
      const vwD = s.vwD.step(volume);
      const rollingVwap = vwN / vwD;
      // vwapBase = useSession ? nz(sessionVWAP, rollingVWAP) : rollingVWAP (nz replaces na and +-infinity)
      const vwapBase = cfg.vwapMode === 'Session'
        ? (Number.isFinite(sessionVwap) ? sessionVwap : rollingVwap) : rollingVwap;
      s.vwapBase[i] = vwapBase;
      const z = (1.0 - cfg.vwapWeight) * price + cfg.vwapWeight * vwapBase;

      // Kalman filter: the N states of the Pine script start and update the same way, so one state is kept.
      // f_init: when the state is na (na() is also true for +-infinity), state = meas and covariance = 1.
      if (!Number.isFinite(v.x)) {
        v.x = z;
        v.P = 1.0;
      }
      const p = v.P + cfg.processNoise;
      const kg = p / (p + cfg.measurementNoise);
      v.x = v.x + kg * (z - v.x);
      v.P = (1 - kg) * p;
      const k = v.x;
      s.kalman[i] = k;

      // up = kalmanVW > nz(kalmanVW[1], kalmanVW) (nz replaces na and +-infinity; > uses an infinite value)
      const k1 = i > 0 ? s.kalman[i - 1]! : NaN;
      const prev = i > 0 && Number.isFinite(k1) ? k1 : k;
      const barCol = gt(k, prev) ? cfg.longColor : cfg.shortColor;
      s.barColors[i] = { time: b.time, color: barCol };

      s.plot0[i] = {
        // a plot draws nothing for +-infinity
        time: b.time, value: cfg.showkalman && Number.isFinite(k) ? k : NaN,
        color: String(color.new(barCol, cfg.transp)),
      };

      // slopeUp / slopeDown = ta.crossover / crossunder(kalmanVW, kalmanVW[1]); priceAbove / priceBelow =
      // ta.crossover / crossunder(pricesource, kalmanVW); baseUp / baseDown = ta.crossover / crossunder(kalmanVW, vwapBase)
      const k2 = i > 1 ? s.kalman[i - 2]! : NaN;
      const pp = i > 0 ? s.price[i - 1]! : NaN;
      const pb = i > 0 ? s.vwapBase[i - 1]! : NaN;
      const f0 = k > k1 && k1 <= k2;
      const f1 = k < k1 && k1 >= k2;
      const f2 = price > k && pp <= k1;
      const f3 = price < k && pp >= k1;
      const f4 = k > vwapBase && k1 <= pb;
      const f5 = k < vwapBase && k1 >= pb;
      const fl = s.flags;
      fl[0]![i] = f0; fl[1]![i] = f1; fl[2]![i] = f2; fl[3]![i] = f3; fl[4]![i] = f4; fl[5]![i] = f5;
      if (f0) s.times[0]!.push(b.time as number);
      if (f1) s.times[1]!.push(b.time as number);
      if (f2) s.times[2]!.push(b.time as number);
      if (f3) s.times[3]!.push(b.time as number);
      if (f4) s.times[4]!.push(b.time as number);
      if (f5) s.times[5]!.push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice() },
        barColors: cfg.paintCandles ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KalmanVwapFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KalmanVwapFilterInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Kalman VWAP Slope Up', message: 'Kalman VWAP Slope Up {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Kalman VWAP Slope Down', message: 'Kalman VWAP Slope Down {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Price Crosses Above Kalman VWAP', message: 'Price > Kalman VWAP {{exchange}}:{{ticker}}' },
  { id: 'alert3', title: 'Price Crosses Below Kalman VWAP', message: 'Price < Kalman VWAP {{exchange}}:{{ticker}}' },
  { id: 'alert4', title: 'Kalman VWAP Crosses Above VWAP Base', message: 'Kalman VWAP > VWAP Base {{exchange}}:{{ticker}}' },
  { id: 'alert5', title: 'Kalman VWAP Crosses Below VWAP Base', message: 'Kalman VWAP < VWAP Base {{exchange}}:{{ticker}}' },
];

export const KalmanVwapFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
