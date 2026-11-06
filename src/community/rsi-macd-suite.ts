/**
 * RSI & MACD Suite
 *
 * RSI and MACD in one pane. RSI: the RMA of the up and down changes of the source, rsi = 100 - 100 / (1 + up / down)
 * (100 when down is 0, 0 when up is 0), with bands at 70 / 50 / 30, a band fill and gradient fills above 70 and
 * below 30. MACD: fast MA - slow MA (EMA or SMA) of a second source, a signal MA (EMA or SMA) of the MACD and the
 * histogram MACD - signal (teal at or above 0, red below), with a zero line.
 * Alerts (alertcondition, `alerts` of the result): the RSI crossing over 70, under 30 and across 50, the MACD
 * crossing over / under its signal and the histogram crossing over / under 0.
 *
 * Reference: "RSI & MACD Suite" by aaboomar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © aaboomar
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig,
  type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

type MaType = 'EMA' | 'SMA';

export interface RsiMacdSuiteInputs {
  /** RSI length */
  rsiLength: number;
  /** RSI source */
  rsiSource: SourceType;
  /** MACD source */
  macdSource: SourceType;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  /** Oscillator MA type (fast and slow MAs) */
  oscType: MaType;
  /** Signal MA type */
  sigType: MaType;
}

export const defaultInputs: RsiMacdSuiteInputs = {
  rsiLength: 14,
  rsiSource: 'close',
  macdSource: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscType: 'EMA',
  sigType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'Length', defval: 14, min: 1, group: 'RSI Settings' },
  { id: 'rsiSource', type: 'source', title: 'Source', defval: 'close', group: 'RSI Settings' },
  { id: 'macdSource', type: 'source', title: 'Source', defval: 'close', group: 'MACD Settings' },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: 'MACD Settings' },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1, group: 'MACD Settings' },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1, group: 'MACD Settings' },
  { id: 'oscType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['EMA', 'SMA'], group: 'MACD Settings' },
  { id: 'sigType', type: 'string', title: 'Signal MA Type', defval: 'EMA', options: ['EMA', 'SMA'], group: 'MACD Settings' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI - Line', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: 'RSI Midline', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'MACD - Histogram', color: '#26a69a', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'MACD - Line', color: color.blue, lineWidth: 2 },
  { id: 'plot4', title: 'MACD - Signal Line', color: '#ff6d00', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'RSI - Upper Band (70)', color: color.white, linestyle: 'solid' },
  { id: 'hline_mid', price: 50, title: 'RSI - Middle Band (50)', color: String(color.new(color.white, 50)), linestyle: 'solid' },
  { id: 'hline_lower', price: 30, title: 'RSI - Lower Band (30)', color: color.white, linestyle: 'solid' },
  { id: 'hline_zero', price: 0, title: 'MACD - Zero Line', color: '#787b8680', linestyle: 'solid' },
];

/** fill(rsiUpperBand, rsiLowerBand, color.rgb(126, 87, 194, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: String(color.rgb(126, 87, 194, 90)), title: 'RSI - Background Fill' },
];

export const metadata = {
  title: 'RSI & MACD Suite',
  shortTitle: 'RSI+MACD',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface SuiteRun extends BarRunState<Record<string, never>> {
  change: ReturnType<typeof taStep.change>;
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  maFast: Ma;
  maSlow: Ma;
  maSignal: Ma;
  rsi: number[];
  macd: number[];
  signal: number[];
  hist: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RsiMacdSuiteInputs>): BarStudy<SuiteRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  if (cfg.fastLength >= cfg.slowLength) throw new Error('MACD Fast length must be less than Slow length');
  const rsiValue = barSource(cfg.rsiSource);
  const macdValue = barSource(cfg.macdSource);
  const ma = (len: number, type: MaType): Ma => (type === 'EMA' ? taStep.ema(len) : new WindowSma(len));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) && isBarSource(cfg.macdSource) ? null : 'source of another study'),
    init() {
      const s: SuiteRun = {
        change: taStep.change(), up: taStep.rma(cfg.rsiLength), down: taStep.rma(cfg.rsiLength),
        maFast: ma(cfg.fastLength, cfg.oscType), maSlow: ma(cfg.slowLength, cfg.oscType),
        maSignal: ma(cfg.signalLength, cfg.sigType), rsi: [], macd: [], signal: [], hist: [],
        plots: Array.from({ length: 5 }, () => []), flags: Array.from({ length: 7 }, () => []),
        times: Array.from({ length: 7 }, () => []), steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.change, s.up, s.down, s.maFast, s.maSlow, s.maSignal];
      s.lists = s.times;
      s.series = [s.rsi, s.macd, s.signal, s.hist, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // RSI: change = ta.change(src); up = ta.rma(math.max(change, 0)); down = ta.rma(-math.min(change, 0))
      const c = s.change.step(rsiValue(b));
      const up = s.up.step(isNaN(c) ? NaN : Math.max(c, 0));
      const down = s.down.step(isNaN(c) ? NaN : -Math.min(c, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);

      // MACD
      const src = macdValue(b);
      const macd = s.maFast.step(src) - s.maSlow.step(src);
      const signal = s.maSignal.step(macd);
      const hist = macd - signal;
      s.rsi[i] = rsi;
      s.macd[i] = macd;
      s.signal[i] = signal;
      s.hist[i] = hist;

      const p = s.plots;
      p[0][i] = { time: t, value: fin(rsi), color: color.yellow };
      // midLinePlot = plot(50, color = na, editable = false, display = display.none)
      p[1][i] = { time: t, value: 50 };
      // hColor = hist >= 0 ? #26a69a : #ff5252
      p[2][i] = { time: t, value: fin(hist), color: ge(hist, 0) ? '#26a69a' : '#ff5252' };
      p[3][i] = { time: t, value: fin(macd), color: color.blue };
      p[4][i] = { time: t, value: fin(signal), color: '#ff6d00' };

      // ta.crossover / ta.crossunder against the values of the bar before (na compares false)
      const pr = i > 0 ? s.rsi[i - 1] : NaN;
      const pm = i > 0 ? s.macd[i - 1] : NaN;
      const ps = i > 0 ? s.signal[i - 1] : NaN;
      const ph = i > 0 ? s.hist[i - 1] : NaN;
      const over = (v: number, w: number, pv: number, pw: number) => v > w && pv <= pw;
      const under = (v: number, w: number, pv: number, pw: number) => v < w && pv >= pw;
      const flags = [
        over(rsi, 70, pr, 70),
        under(rsi, 30, pr, 30),
        // ta.cross(rsi, 50) = crossover or crossunder
        over(rsi, 50, pr, 50) || under(rsi, 50, pr, 50),
        over(macd, signal, pm, ps),
        under(macd, signal, pm, ps),
        over(hist, 0, ph, 0),
        under(hist, 0, ph, 0),
      ];
      for (let k = 0; k < 7; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      // fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
      // fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      const fillArr = <T>(v: T) => new Array<T>(n).fill(v);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'RSI - Background Fill' },
            colors: fillArr(String(color.rgb(126, 87, 194, 90))) },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'RSI - Overbought Gradient' },
            gradient: { topValue: fillArr(100), bottomValue: fillArr(70),
              topColor: fillArr<string | null>(String(color.new(color.green, 0))),
              bottomColor: fillArr<string | null>(String(color.new(color.green, 100))) } },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'RSI - Oversold Gradient' },
            gradient: { topValue: fillArr(30), bottomValue: fillArr(0),
              topColor: fillArr<string | null>(String(color.new(color.red, 100))),
              bottomColor: fillArr<string | null>(String(color.new(color.red, 0))) } },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiMacdSuiteInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiMacdSuiteInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSI Overbought', message: 'RSI crossed above 70 (Overbought)' },
  { id: 'alert1', title: 'RSI Oversold', message: 'RSI crossed below 30 (Oversold)' },
  { id: 'alert2', title: 'RSI Midline Cross', message: 'RSI crossed the 50 midline' },
  { id: 'alert3', title: 'MACD Bullish Cross', message: 'MACD line crossed above Signal line (Bullish)' },
  { id: 'alert4', title: 'MACD Bearish Cross', message: 'MACD line crossed below Signal line (Bearish)' },
  { id: 'alert5', title: 'MACD Histogram Bullish', message: 'MACD Histogram crossed above zero (Bullish momentum)' },
  { id: 'alert6', title: 'MACD Histogram Bearish', message: 'MACD Histogram crossed below zero (Bearish momentum)' },
];

export const RsiMacdSuite = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
