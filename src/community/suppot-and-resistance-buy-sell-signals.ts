/**
 * Suppot and resistance & BUY SELL SIGNALS
 *
 * A channel of the highest high / lowest low over `length` bars and a second one of the highest / lowest close
 * (YPSAR / DPSAR), with the middle of each. A BUY label is drawn on a green candle that dips below DPSAR and closes
 * above it, with RSI oversold, ADX above the trend threshold and a liquidity trap (volume above the multiplier times
 * the `length`-bar average volume and a wick longer than the threshold share of the bar range). A SELL label is the
 * mirror case at YPSAR with RSI overbought on a red candle.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Signal' and 'SELL Signal', true on the bars of each label.
 *
 * Reference: "Suppot and resistance & BUY SELL SIGNALS" by doganayy2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © doganayy2
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Signal', message: 'BUY signal detected!' },
  { id: 'alert1', title: 'SELL Signal', message: 'SELL signal detected!' },
];

export interface SuppotAndResistanceBuySellSignalsInputs {
  /** Channel / volume average period */
  length: number;
  /** Minimum wick share of the bar range */
  wickThreshold: number;
  /** Volume SMA period (not used by the Pine script outputs) */
  volumeSmaPeriod: number;
  /** Volume spike multiplier */
  volumeMultiplier: number;
  rsiPeriod: number;
  rsiOversoldLevel: number;
  rsiOverboughtLevel: number;
  /** ADX smoothing */
  adxLen: number;
  /** DI length */
  diLen: number;
  /** Trend strength threshold (ADX) */
  adxTrendThreshold: number;
}

export const defaultInputs: SuppotAndResistanceBuySellSignalsInputs = {
  length: 200,
  wickThreshold: 0.6,
  volumeSmaPeriod: 20,
  volumeMultiplier: 1.5,
  rsiPeriod: 14,
  rsiOversoldLevel: 30,
  rsiOverboughtLevel: 70,
  adxLen: 14,
  diLen: 14,
  adxTrendThreshold: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Period', defval: 200, group: 'General Settings' },
  { id: 'wickThreshold', type: 'float', title: 'Wick Threshold', defval: 0.6, group: 'Wick Analysis' },
  { id: 'volumeSmaPeriod', type: 'int', title: 'Volume SMA Period', defval: 20, group: 'Volume Analysis' },
  { id: 'volumeMultiplier', type: 'float', title: 'Volume Multiplier', defval: 1.5, group: 'Volume Analysis' },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14, group: 'RSI Settings' },
  { id: 'rsiOversoldLevel', type: 'int', title: 'RSI Oversold Level', defval: 30, group: 'RSI Settings' },
  { id: 'rsiOverboughtLevel', type: 'int', title: 'RSI Overbought Level', defval: 70, group: 'RSI Settings' },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14, group: 'ADX Settings' },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14, group: 'ADX Settings' },
  { id: 'adxTrendThreshold', type: 'int', title: 'Trend Strength Threshold', defval: 30, group: 'ADX Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mid Level', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Mid Level 2', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'YPSAR', color: color.green, lineWidth: 2 },
  { id: 'plot3', title: 'DPSAR', color: color.orange, lineWidth: 2 },
  { id: 'plot4', title: 'Upper Channel', color: color.purple, lineWidth: 3 },
  { id: 'plot5', title: 'Lower Channel', color: color.red, lineWidth: 3 },
];

export const metadata = {
  title: 'Suppot and resistance & BUY SELL SIGNALS',
  shortTitle: 'Suppot and resistance & BUY SELL SIGNALS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SrVars {
  /** fixnan of the DI values */
  lastPlus: number;
  lastMinus: number;
}

interface SrRun extends BarRunState<SrVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  volAvg: ReturnType<typeof taStep.sma>;
  tr: ReturnType<typeof taStep.tr>;
  trRma: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adxRma: ReturnType<typeof taStep.rma>;
  hiCh: WindowExtreme;
  loCh: WindowExtreme;
  hiClose: WindowExtreme;
  loClose: WindowExtreme;
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<SuppotAndResistanceBuySellSignalsInputs>): BarStudy<SrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: SrRun = {
        rsi: taStep.rsi(cfg.rsiPeriod), volAvg: taStep.sma(), tr: taStep.tr(false), trRma: taStep.rma(cfg.diLen),
        plusRma: taStep.rma(cfg.diLen), minusRma: taStep.rma(cfg.diLen), adxRma: taStep.rma(cfg.adxLen),
        hiCh: new WindowExtreme(false, cfg.length), loCh: new WindowExtreme(true, cfg.length),
        hiClose: new WindowExtreme(false, cfg.length), loClose: new WindowExtreme(true, cfg.length),
        plots: [[], [], [], [], [], []], flags: [[], []], times: [[], []], markers: [],
        steps: [], vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.volAvg, s.tr, s.trRma, s.plusRma, s.minusRma, s.adxRma, s.hiCh, s.loCh, s.hiClose, s.loClose];
      s.lists = [...s.times, s.markers];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      const rsi = s.rsi.step(b.close);
      const volumeAvg = s.volAvg.step(volume, cfg.length);

      // dirmov(dilen): +DM / -DM, RMA of ta.tr (na on bar 0), fixnan of the DI values
      let plusDM = NaN;
      let minusDM = NaN;
      if (i > 0) {
        const up = b.high - bars[i - 1].high;
        const down = -(b.low - bars[i - 1].low);
        plusDM = gt(up, down) && gt(up, 0) ? up : 0;
        minusDM = gt(down, up) && gt(down, 0) ? down : 0;
      }
      const trueRange = s.trRma.step(s.tr.step(b.high, b.low, b.close));
      // fixnan(100 * ta.rma(plusDM, len) / truerange): plain division (x / 0 is infinite and kept by fixnan)
      const p = (100 * s.plusRma.step(plusDM)) / trueRange;
      const m = (100 * s.minusRma.step(minusDM)) / trueRange;
      if (!isNaN(p)) v.lastPlus = p;
      if (!isNaN(m)) v.lastMinus = m;
      const plus = v.lastPlus;
      const minus = v.lastMinus;
      // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
      const sum = plus + minus;
      const adxValue = 100 * s.adxRma.step(Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum));

      const highChannel = s.hiCh.step(b.high);
      const lowChannel = s.loCh.step(b.low);
      const ypsar = s.hiClose.step(b.close);
      const dpsar = s.loClose.step(b.close);

      const strongTrend = gt(adxValue, cfg.adxTrendThreshold);
      const volumeSpike = gt(volume, cfg.volumeMultiplier * volumeAvg);
      const touchYpsar = gt(b.high, ypsar) && lt(b.close, ypsar);
      const touchDpsar = lt(b.low, dpsar) && gt(b.close, dpsar);
      // wick_anomaly = upper_wick / (high - low) > wick_threshold or lower_wick / (high - low) > wick_threshold
      const range = b.high - b.low;
      const upperWick = b.high - Math.max(b.open, b.close);
      const lowerWick = Math.min(b.open, b.close) - b.low;
      const wickAnomaly = gt(upperWick / range, cfg.wickThreshold) || gt(lowerWick / range, cfg.wickThreshold);
      const liquidityTrap = volumeSpike && wickAnomaly;
      const buySignal = liquidityTrap && lt(rsi, cfg.rsiOversoldLevel) && strongTrend && touchDpsar && gt(b.close, b.open);
      const sellSignal = liquidityTrap && gt(rsi, cfg.rsiOverboughtLevel) && strongTrend && touchYpsar && lt(b.close, b.open);
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(t);
      if (sellSignal) s.times[1].push(t);
      if (buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue, size: 'small' });
      }
      if (sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue, size: 'small' });
      }
      const pl = s.plots;
      pl[0][i] = { time: t, value: (highChannel + lowChannel) / 2 };
      pl[1][i] = { time: t, value: (ypsar + dpsar) / 2 };
      pl[2][i] = { time: t, value: ypsar };
      pl[3][i] = { time: t, value: dpsar };
      pl[4][i] = { time: t, value: highChannel };
      pl[5][i] = { time: t, value: lowChannel };
    },
    result(s, bars) {
      const n = bars.length;
      const pl = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: pl[0].slice(), plot1: pl[1].slice(), plot2: pl[2].slice(), plot3: pl[3].slice(), plot4: pl[4].slice(), plot5: pl[5].slice() },
        markers: s.markers.slice(),
        // alertcondition(buySignal, 'BUY Signal') / alertcondition(sellSignal, 'SELL Signal')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuppotAndResistanceBuySellSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuppotAndResistanceBuySellSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SuppotAndResistanceBuySellSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
