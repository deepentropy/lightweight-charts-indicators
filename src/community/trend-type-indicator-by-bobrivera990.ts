/**
 * Trend Type Indicator by BobRivera990
 *
 * Classifies each bar as uptrend (2), sideways (0) or downtrend (-2). The market is sideways when the ATR is at or
 * below its moving average, or when the ADX is at or below a limit (each test can be switched off); else the trend
 * is up when +DI is above -DI and down otherwise. The class is smoothed with an SMA rounded to the nearest of the
 * three levels, and drawn as a step line shifted back by `lag` bars over three coloured zones. Labels on the last
 * bar name the zones and mark the current state.
 *
 * Reference: "Trend Type Indicator by BobRivera990" by BobRivera990
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) BobRivera990
 */

import { taStep, math, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendTypeIndicatorInputs {
  /** Use ATR to detect Sideways Movements */
  useAtr: boolean;
  /** ATR Length */
  atrLen: number;
  /** ATR Moving Average Type */
  atrMaType: 'SMA' | 'EMA';
  /** ATR MA Length */
  atrMaLen: number;
  /** Use ADX to detect Sideways Movements */
  useAdx: boolean;
  /** ADX Smoothing */
  adxLen: number;
  /** DI Length */
  diLen: number;
  /** ADX Limit */
  adxLim: number;
  /** Smoothing Factor */
  smooth: number;
  /** Lag: the oscillator is drawn this number of bars back */
  lag: number;
}

export const defaultInputs: TrendTypeIndicatorInputs = {
  useAtr: true,
  atrLen: 14,
  atrMaType: 'SMA',
  atrMaLen: 20,
  useAdx: true,
  adxLen: 14,
  diLen: 14,
  adxLim: 25,
  smooth: 3,
  lag: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'useAtr', type: 'bool', title: 'Use ATR to detect Sideways Movements', defval: true },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMaType', type: 'string', title: 'ATR Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA'] },
  { id: 'atrMaLen', type: 'int', title: 'ATR MA Length', defval: 20, min: 1 },
  { id: 'useAdx', type: 'bool', title: 'Use ADX to detect Sideways Movements', defval: true },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1, max: 50 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14, min: 1 },
  { id: 'adxLim', type: 'int', title: 'ADX Limit', defval: 25, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smoothing Factor', defval: 3, min: 1, max: 5 },
  { id: 'lag', type: 'int', title: 'Lag', defval: 8, min: 0, max: 15 },
];

// Colours of the original Pine version
const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';
const WHITE = '#FFFFFF';
const BLUE = '#2196F3';
const BLACK = '#363A45';
const COL_GREEN30 = String(color.new(GREEN, 30));
const COL_GREEN90 = String(color.new(GREEN, 90));
const COL_GRAY = String(color.new(GRAY, 20));
const COL_WHITE90 = String(color.new(WHITE, 90));
const COL_RED30 = String(color.new(RED, 30));
const COL_RED90 = String(color.new(RED, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Band_3', color: BLACK, lineWidth: 1 },
  { id: 'plot1', title: 'Band_2', color: BLACK, lineWidth: 1 },
  { id: 'plot2', title: 'Band_1', color: BLACK, lineWidth: 1 },
  { id: 'plot3', title: 'Band_0', color: BLACK, lineWidth: 1 },
  { id: 'plot4', title: 'Trend Type Oscillator', color: BLUE, lineWidth: 3, style: 'stepline', offset: -8 },
];

export const metadata = {
  title: 'Trend Type Indicator by BobRivera990',
  shortTitle: 'Trend Type Indicator by BobRivera990',
  overlay: false,
};

type Point = { time: number; value: number };
type OscPoint = { time: number; value: number; color: string };
type Result = IndicatorResult & { labels: LabelData[] };

interface TrendTypeVars {
  /** fixnan of the DI values */
  lastPlus: number;
  lastMinus: number;
}

interface TrendTypeRun extends BarRunState<TrendTypeVars> {
  atr: ReturnType<typeof taStep.atr>;
  atrMa: { step(v: number): number; commit(): void };
  up: ReturnType<typeof taStep.change>;
  down: ReturnType<typeof taStep.change>;
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  sma: ReturnType<typeof taStep.sma>;
  smoothType: number[];
  osc: OscPoint[];
  constants: Point[][];
}

function study(inputs: Partial<TrendTypeIndicatorInputs>): BarStudy<TrendTypeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // plot(smoothType, offset = -lag): the value of bar i is drawn on bar i - lag (a point of bar i, from bar lag on)
  const lagged = Number.isInteger(cfg.lag) && cfg.lag >= 0;
  // Pine na(): na or an infinite value
  const na = (v: number) => !Number.isFinite(v);
  const trendCol = (v: number) => (compare.eq(v, 2) ? COL_GREEN30 : compare.eq(v, 0) ? COL_GRAY : COL_RED30);
  return {
    init() {
      const ma = cfg.atrMaType === 'EMA'
        ? taStep.ema(cfg.atrMaLen)
        : (() => { const m = taStep.sma(); return { step: (v: number) => m.step(v, cfg.atrMaLen), commit: () => m.commit() }; })();
      const s: TrendTypeRun = {
        atr: taStep.atr(cfg.atrLen), atrMa: ma, up: taStep.change(), down: taStep.change(), tr: taStep.tr(false),
        trur: taStep.rma(cfg.diLen), plusRma: taStep.rma(cfg.diLen), minusRma: taStep.rma(cfg.diLen),
        adx: taStep.rma(cfg.adxLen), sma: taStep.sma(), smoothType: [], osc: [], constants: [[], [], [], []],
        steps: [], vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.steps = [s.atr, s.atrMa, s.up, s.down, s.tr, s.trur, s.plusRma, s.minusRma, s.adx, s.sma];
      s.series = [s.smoothType, s.osc, ...s.constants];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const atr = s.atr.step(b.high, b.low, b.close);
      const atrMa = s.atrMa.step(atr);
      const up = s.up.step(b.high);
      const down = -s.down.step(b.low);
      const plusDM = isNaN(up) ? NaN : compare.gt(up, down) && compare.gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : compare.gt(down, up) && compare.gt(down, 0) ? down : 0;
      const trur = s.trur.step(s.tr.step(b.high, b.low, b.close));
      // fixnan: the last value that is not na
      const p = (100 * s.plusRma.step(plusDM)) / trur;
      const m = (100 * s.minusRma.step(minusDM)) / trur;
      if (!Number.isNaN(p)) v.lastPlus = p;
      if (!Number.isNaN(m)) v.lastMinus = m;
      const plus = v.lastPlus;
      const minus = v.lastMinus;
      const sum = plus + minus;
      const adx = 100 * s.adx.step(Math.abs(plus - minus) / (compare.eq(sum, 0) ? 1 : sum));

      // cndNa: the original tests na(atrMaLen) (the input), not the moving average
      const cndNa = na(atr) || na(adx) || na(plus) || na(minus);
      const sideways1 = cfg.useAtr && compare.le(atr, atrMa);
      const sideways2 = cfg.useAdx && compare.le(adx, cfg.adxLim);
      const cndUp = compare.gt(plus, minus);
      const trendType = cndNa ? NaN : sideways1 || sideways2 ? 0 : cndUp ? 2 : -2;
      const sma = s.sma.step(trendType, cfg.smooth);
      // smoothType = na(trendType) ? na : round(sma(trendType, smooth) / 2) * 2
      const smoothType = isNaN(trendType) || isNaN(sma) ? NaN : math.round(sma / 2) * 2;
      s.smoothType[i] = smoothType;
      if (lagged && i >= cfg.lag) {
        s.osc[i] = { time: barTime(bars, i - cfg.lag), value: smoothType, color: trendCol(smoothType) };
      }
      const time = b.time;
      s.constants[0][i] = { time, value: 3 };
      s.constants[1][i] = { time, value: 1 };
      s.constants[2][i] = { time, value: -1 };
      s.constants[3][i] = { time, value: -3 };
    },
    result(s, bars) {
      const n = bars.length;
      let oscillator: OscPoint[];
      if (lagged) {
        oscillator = s.osc.slice(cfg.lag);
      } else {
        const interval = barInterval(bars);
        oscillator = [];
        for (let i = cfg.lag; i < n; i++) {
          oscillator.push({ time: barTime(bars, i - cfg.lag, interval), value: s.smoothType[i], color: trendCol(s.smoothType[i]) });
        }
      }

      // Labels of the last bar (each bar deletes the labels of the bar before)
      const labels: LabelData[] = [];
      if (n > 0) {
        const time = bars[n - 1].time;
        const hidden = String(color.new(GREEN, 100));
        const zone = (price: number, text: string): LabelData => (
          { time, price, text, color: hidden, textColor: BLACK, style: 'label_left', size: 'normal', textAlign: 'left' }
        );
        labels.push(zone(2, 'UP'), zone(0, 'SIDEWAYS'), zone(-2, 'DOWN'));
        if (!isNaN(s.smoothType[n - 1])) {
          labels.push({ time, price: s.smoothType[n - 1], text: '', color: String(color.new(BLUE, 30)), style: 'label_right', size: 'small' });
        }
      }

      const c = s.constants;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: c[0].slice(),
          plot1: c[1].slice(),
          plot2: c[2].slice(),
          plot3: c[3].slice(),
          plot4: oscillator,
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: COL_GREEN90, title: 'Uptrend area' } },
          { plot1: 'plot2', plot2: 'plot1', options: { color: COL_WHITE90, title: 'Sideways area' } },
          { plot1: 'plot3', plot2: 'plot2', options: { color: COL_RED90, title: 'Downtrend area' } },
        ],
        labels,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendTypeIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendTypeIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendTypeIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
