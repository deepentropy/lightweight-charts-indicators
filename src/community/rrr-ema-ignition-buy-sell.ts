/**
 * RRR EMA Ignition BUY & SELL (Sideways-Proof)
 *
 * Three EMAs of the source (9, 21, 55). The EMA 55 slope is up when it is above its value 2 bars ago, down when it
 * is below it. A bull trend starts when the EMA 21 crosses over the EMA 55 with an up slope and ADX above the minimum
 * (a bear trend: cross under, down slope); it is also re-armed when the close is above the EMA 55, EMA 9 > EMA 21,
 * slope up and ADX above the minimum (bear: the opposite). A BUY label marks the first bar of a bull trend with a
 * close above the EMA 55, EMA 9 > EMA 21, a green candle, an up slope, ADX above the minimum and the close at least
 * ATR * multiplier away from the EMA 55; SELL is the opposite. A BUY allows the next SELL and the reverse.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Alert' and 'SELL Alert', true on the BUY / SELL bars.
 *
 * Reference: "RRR EMA Ignition BUY & SELL (Sideways-Proof)" by RAGSTER123
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface RrrEmaIgnitionBuySellInputs {
  len9: number;
  len21: number;
  len55: number;
  /** ADX length (DI length and ADX smoothing) */
  adxLen: number;
  /** Minimum ADX */
  adxMin: number;
  atrLen: number;
  /** ATR distance multiplier of the sideways filter */
  atrMul: number;
  src: SourceType;
}

export const defaultInputs: RrrEmaIgnitionBuySellInputs = {
  len9: 9,
  len21: 21,
  len55: 55,
  adxLen: 14,
  adxMin: 20,
  atrLen: 14,
  atrMul: 0.6,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len9', type: 'int', title: 'EMA 9', defval: 9 },
  { id: 'len21', type: 'int', title: 'EMA 21', defval: 21 },
  { id: 'len55', type: 'int', title: 'EMA 55', defval: 55 },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxMin', type: 'float', title: 'Min ADX', defval: 20 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMul', type: 'float', title: 'ATR Distance Multiplier', defval: 0.6 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 21', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'EMA 55', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'RRR EMA Ignition BUY & SELL (Sideways-Proof)',
  shortTitle: 'RRR_EMA_IGNITION',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface RrrVars {
  bullTrend: boolean;
  bearTrend: boolean;
  buyDone: boolean;
  sellDone: boolean;
}

interface RrrRun extends BarRunState<RrrVars> {
  e9: ReturnType<typeof taStep.ema>;
  e21: ReturnType<typeof taStep.ema>;
  e55: ReturnType<typeof taStep.ema>;
  dmi: ReturnType<typeof taStep.dmi>;
  atr: ReturnType<typeof taStep.atr>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  ema55: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RrrEmaIgnitionBuySellInputs>): BarStudy<RrrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: RrrRun = {
        e9: taStep.ema(cfg.len9), e21: taStep.ema(cfg.len21), e55: taStep.ema(cfg.len55),
        dmi: taStep.dmi(cfg.adxLen, cfg.adxLen), atr: taStep.atr(cfg.atrLen), up: taStep.crossover(),
        down: taStep.crossunder(), ema55: [], plot0: [], plot1: [], plot2: [], markers: [], flags: [[], []],
        times: [[], []], steps: [], lists: [], series: [],
        vars: { bullTrend: false, bearTrend: false, buyDone: false, sellDone: false },
      };
      s.steps = [s.e9, s.e21, s.e55, s.dmi, s.atr, s.up, s.down];
      s.lists = [s.markers, ...s.times];
      s.series = [s.ema55, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v = s.vars;
      const x = value(b);
      const ema9 = s.e9.step(x);
      const ema21 = s.e21.step(x);
      const ema55 = s.e55.step(x);
      s.ema55[i] = ema55;
      const adx = s.dmi.step(b.high, b.low, b.close)[2];
      const atr = s.atr.step(b.high, b.low, b.close);
      // ta.crossover / ta.crossunder (exact comparisons, last bar where both values were not na)
      const crossUp = s.up.step(ema21, ema55);
      const crossDown = s.down.step(ema21, ema55);

      const e55prev2 = i >= 2 ? s.ema55[i - 2]! : NaN;
      const ema55Up = gt(ema55, e55prev2);
      const ema55Down = lt(ema55, e55prev2);
      // farFromEMA55 = math.abs(close - ema55) >= atr * atrMul
      const farFromEMA55 = ge(Math.abs(b.close - ema55), atr * cfg.atrMul);
      const adxOk = gt(adx, cfg.adxMin);

      if (crossUp && ema55Up && adxOk) {
        v.bullTrend = true;
        v.bearTrend = false;
        v.buyDone = false;
      }
      if (crossDown && ema55Down && adxOk) {
        v.bearTrend = true;
        v.bullTrend = false;
        v.sellDone = false;
      }
      // Re-arm
      if (gt(b.close, ema55) && gt(ema9, ema21) && ema55Up && adxOk) {
        v.bullTrend = true;
        v.sellDone = false;
      }
      if (lt(b.close, ema55) && lt(ema9, ema21) && ema55Down && adxOk) {
        v.bearTrend = true;
        v.buyDone = false;
      }

      const buySignal = v.bullTrend && !v.buyDone && gt(b.close, ema55) && gt(ema9, ema21)
        && gt(b.close, b.open) && ema55Up && adxOk && farFromEMA55;
      if (buySignal) {
        v.buyDone = true;
        v.sellDone = false;
      }
      const sellSignal = v.bearTrend && !v.sellDone && lt(b.close, ema55) && lt(ema9, ema21)
        && lt(b.close, b.open) && ema55Down && adxOk && farFromEMA55;
      if (sellSignal) {
        v.sellDone = true;
        v.buyDone = false;
      }

      // alertcondition(buySignal, "BUY Alert") / alertcondition(sellSignal, "SELL Alert")
      s.flags[0]![i] = buySignal;
      s.flags[1]![i] = sellSignal;
      if (buySignal) s.times[0]!.push(time);
      if (sellSignal) s.times[1]!.push(time);
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      s.plot0[i] = { time, value: ema9, color: color.red };
      s.plot1[i] = { time, value: ema21, color: color.green };
      s.plot2[i] = { time, value: ema55, color: color.blue };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RrrEmaIgnitionBuySellInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RrrEmaIgnitionBuySellInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Alert', message: 'RRR EMA Ignition BUY' },
  { id: 'alert1', title: 'SELL Alert', message: 'RRR EMA Ignition SELL' },
];

export const RrrEmaIgnitionBuySell = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
