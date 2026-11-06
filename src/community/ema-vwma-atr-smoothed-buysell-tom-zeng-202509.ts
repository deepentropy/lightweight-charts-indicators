/**
 * EMA + VWMA + ATR Smoothed BuySell (merged)
 *
 * Four EMAs of the close (8, 21, 50, 200) and an ATR trailing stop: the stop follows the close at
 * `ATR multiplier * ATR` and flips side when the close crosses it. The position turns long when the close crosses
 * above the stop and short when it crosses below; Buy / Sell labels mark the first bar of each new position and the
 * bars are coloured by the position. A VWMA of the source and the average of the VWMA and the trailing stop are also
 * drawn.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the Buy / Sell label bars.
 *
 * Reference: "EMA + ATR Smoothed BuySell (merged) - Modified" by zengtom
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EmaVwmaAtrSmoothedBuysellTomZeng202509Inputs {
  ema1Len: number;
  ema2Len: number;
  ema3Len: number;
  ema5Len: number;
  /** ATR length of the trailing stop */
  atrPeriod: number;
  /** Trailing stop distance in ATRs */
  atrMultip: number;
  /** VWMA length */
  vwmaLen: number;
  vwmaSrc: SourceType;
}

export const defaultInputs: EmaVwmaAtrSmoothedBuysellTomZeng202509Inputs = {
  ema1Len: 8,
  ema2Len: 21,
  ema3Len: 50,
  ema5Len: 200,
  atrPeriod: 21,
  atrMultip: 6.3,
  vwmaLen: 100,
  vwmaSrc: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 8 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 21 },
  { id: 'ema3Len', type: 'int', title: 'EMA 3', defval: 50 },
  { id: 'ema5Len', type: 'int', title: 'EMA 5', defval: 200 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 21 },
  { id: 'atrMultip', type: 'float', title: 'ATR Multiplier', defval: 6.3, min: 0.5, max: 1000, step: 0.1 },
  { id: 'vwmaLen', type: 'int', title: 'VWMA Smooth', defval: 100, min: 1 },
  { id: 'vwmaSrc', type: 'source', title: 'VWMA Source', defval: 'close' },
];

const VWMA_COLOR = String(color.new(color.blue, 60));
const LIME = String(color.new(color.lime, 0));
const RED = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 2', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 3', color: color.yellow, lineWidth: 1 },
  { id: 'plot3', title: 'EMA 5', color: color.blue, lineWidth: 1 },
  { id: 'plot4', title: 'ATR Trailing Stop', color: color.gray, lineWidth: 2 },
  { id: 'plot5', title: 'VWMA', color: VWMA_COLOR, lineWidth: 1 },
  { id: 'plot6', title: 'ATR-VWMA Avg', color: color.aqua, lineWidth: 2 },
];

export const metadata = {
  title: 'EMA + ATR Smoothed BuySell (merged) - Modified',
  shortTitle: 'EMA_ATR_Combo_mod',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** nz(x, y) */
const nz = (x: number, y: number) => (isNaN(x) ? y : x);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface EmaAtrVars {
  /** var int pos = 0, var bool isLong = false, var bool isShort = false */
  pos: number;
  isLong: boolean;
  isShort: boolean;
}

interface EmaAtrRun extends BarRunState<EmaAtrVars> {
  emas: Array<ReturnType<typeof taStep.ema>>;
  atr: ReturnType<typeof taStep.atr>;
  vwma: WindowVwma;
  stop: number[];
  plots: Point[][];
  flags: boolean[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EmaVwmaAtrSmoothedBuysellTomZeng202509Inputs>): BarStudy<EmaAtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const vwmaSrc = barSource(cfg.vwmaSrc);
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const EMA_COLORS = [color.red, color.orange, color.yellow, color.blue];
  return {
    fullRunReason: () => (isBarSource(cfg.vwmaSrc) ? null : 'source of another study'),
    init() {
      const emas = [cfg.ema1Len, cfg.ema2Len, cfg.ema3Len, cfg.ema5Len].map((len) => taStep.ema(len));
      const atr = taStep.atr(cfg.atrPeriod);
      const vwma = new WindowVwma(cfg.vwmaLen);
      const s: EmaAtrRun = {
        emas, atr, vwma, stop: [], plots: Array.from({ length: 7 }, () => []), flags: [[], []], markers: [], barColors: [],
        steps: [...emas, atr, vwma], vars: { pos: 0, isLong: false, isShort: false }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors];
      s.series = [s.stop, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const p = s.plots;
      for (let k = 0; k < 4; k++) p[k][i] = { time, value: fin(s.emas[k].step(b.close)), color: EMA_COLORS[k] };

      // ATR trailing stop
      const xATR = s.atr.step(b.high, b.low, b.close);
      const nLoss = cfg.atrMultip * xATR;
      const c = b.close;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      // prevStop = nz(xATRTrailingStop[1], close[1])
      const prevStop = nz(i > 0 ? s.stop[i - 1] : NaN, c1);
      let st: number;
      if (gt(c, prevStop) && gt(c1, prevStop)) st = Math.max(prevStop, c - nLoss);
      else if (lt(c, prevStop) && lt(c1, prevStop)) st = Math.min(prevStop, c + nLoss);
      else st = gt(c, prevStop) ? c - nLoss : c + nLoss;
      s.stop[i] = st;

      // prevStopForPos = nz(xATRTrailingStop[1], close[1]) (same value as prevStop)
      if (lt(c1, prevStop) && gt(c, st)) v.pos = 1;
      else if (gt(c1, prevStop) && lt(c, st)) v.pos = -1;
      // else pos := nz(pos[1], 0): unchanged
      const pos = v.pos;

      const LONG = !v.isLong && pos === 1;
      const SHORT = !v.isShort && pos === -1;
      s.flags[0][i] = LONG;
      s.flags[1][i] = SHORT;
      if (LONG) {
        v.isLong = true;
        v.isShort = false;
      }
      if (SHORT) {
        v.isLong = false;
        v.isShort = true;
      }
      // barcolor(isLong ? color.new(color.lime, 0) : isShort ? color.new(color.red, 0) : na)
      if (v.isLong) s.barColors.push({ time, color: LIME });
      else if (v.isShort) s.barColors.push({ time, color: RED });
      // plotshape(LONG, 'Buy', shape.labelup, location.belowbar, text 'Buy', white text, color.green, size.normal)
      if (LONG) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Buy', textColor: color.white, size: 'normal' });
      }
      // plotshape(SHORT, 'Sell', shape.labeldown, location.abovebar, text 'Sell', white text, color.red, size.normal)
      if (SHORT) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Sell', textColor: color.white, size: 'normal' });
      }

      // VWMA and the average of the VWMA and the trailing stop
      const vwma = s.vwma.step(vwmaSrc(b), b.volume ?? NaN);
      const avg1 = isNaN(vwma) || isNaN(st) ? NaN : (vwma + st) / 2.0;
      // color = pos == 1 ? color.green : pos == -1 ? color.red : color.gray
      p[4][i] = { time, value: fin(st), color: pos === 1 ? color.green : pos === -1 ? color.red : color.gray };
      p[5][i] = { time, value: fin(vwma), color: VWMA_COLOR };
      p[6][i] = { time, value: fin(avg1), color: color.aqua };
    },
    result(s, bars) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(LONG, "Buy Signal") / alertcondition(SHORT, "Sell Signal")
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmaVwmaAtrSmoothedBuysellTomZeng202509Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EmaVwmaAtrSmoothedBuysellTomZeng202509Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell' },
];

export const EmaVwmaAtrSmoothedBuysellTomZeng202509 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
