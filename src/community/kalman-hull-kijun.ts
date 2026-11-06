/**
 * Kalman Hull Kijun
 *
 * A one-state Kalman filter (state x, error covariance P; prediction P + processNoise, gain
 * K = P / (P + measurementNoise), x += K * (price - x), P = (1 - K) * P) shared by all its calls: every call in a bar
 * updates the same state. Per bar the filter runs on the source with the measurement noise, then a Hull-like
 * combination: 2 * filter(source, noise / 2) - filter(source, noise), filtered again with round(sqrt(noise)). The base
 * line is the Donchian midpoint (average of the lowest and highest value) of that result over the Kijun period.
 * Long when the source is above the base, short when below. Gradient fills between the close and the base, a thin
 * "rim" fill of 0.08 * ATR(14) on the close, and optional candle colouring.
 * Alerts (alertcondition, `alerts` of the result): 'Kalman Hull Kijun Long' / 'Kalman Hull Kijun Short' on the bars
 * where the source is above / below the base.
 *
 * Reference: "Kalman Hull Kijun [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KalmanHullKijunInputs {
  /** Kijun base period (Donchian length) */
  basePeriod: number;
  /** Kalman price source */
  src: SourceType;
  measurementNoise: number;
  processNoise: number;
  showKijun: boolean;
  showFill: boolean;
  /** Line width of the Kijun line (the port keeps the default width 3) */
  lineWidth: number;
  paintCandles: boolean;
  longColor: string;
  shortColor: string;
}

export const defaultInputs: KalmanHullKijunInputs = {
  basePeriod: 26,
  src: 'close',
  measurementNoise: 3.0,
  processNoise: 0.01,
  showKijun: true,
  showFill: true,
  lineWidth: 3,
  paintCandles: true,
  longColor: '#00ff00',
  shortColor: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'basePeriod', type: 'int', title: 'Kijun Base Period', defval: 26, group: 'Kijun Sen Base Settings' },
  { id: 'src', type: 'source', title: 'Kalman Price Source', defval: 'close', group: 'Kalman Hull Settings' },
  { id: 'measurementNoise', type: 'float', title: 'Measurement Noise', defval: 3.0, step: 1.0, group: 'Kalman Hull Settings',
    tooltip: 'Lookback Period/ Calculation Length' },
  { id: 'processNoise', type: 'float', title: 'Process Noise', defval: 0.01, step: 0.01, group: 'Kalman Hull Settings' },
  { id: 'showKijun', type: 'bool', title: 'Show Kijun on Chart?', defval: true, group: 'Plotting and UI Settings' },
  { id: 'showFill', type: 'bool', title: 'Show Gradient Fill', defval: true, group: 'Plotting and UI Settings' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 3, group: 'Plotting and UI Settings' },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles according to Trend?', defval: true, group: 'Plotting and UI Settings' },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#00ff00', group: 'Plotting and UI Settings', inline: 'Col' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff0000', group: 'Plotting and UI Settings', inline: 'Col' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Kalman Hull Kijun', color: '#00ff00', lineWidth: 3, visible: 'showKijun' },
  { id: 'plot1', title: 'Price (hidden)', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Rim Lower', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Rim Upper', color: '#2962ff', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Kalman Hull Kijun [BackQuant]',
  shortTitle: 'Kalman Hull Kijun [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface KalmanVars {
  /** The shared Kalman state and error covariance */
  state: number;
  cov: number;
}

interface KalmanRun extends BarRunState<KalmanVars> {
  lo: WindowExtreme;
  hi: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  upTop: number[];
  upBottom: number[];
  upTopColor: Array<string | null>;
  upBottomColor: Array<string | null>;
  dnTop: number[];
  dnBottom: number[];
  dnTopColor: Array<string | null>;
  dnBottomColor: Array<string | null>;
  upRim: string[];
  dnRim: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<KalmanHullKijunInputs>): BarStudy<KalmanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const longStrong = String(color.new(cfg.longColor, 10));
  const longWeak = String(color.new(cfg.longColor, 85));
  const shortStrong = String(color.new(cfg.shortColor, 10));
  const shortWeak = String(color.new(cfg.shortColor, 85));
  const longRim = String(color.new(cfg.longColor, 35));
  const shortRim = String(color.new(cfg.shortColor, 35));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: KalmanRun = {
        lo: new WindowExtreme(true, cfg.basePeriod), hi: new WindowExtreme(false, cfg.basePeriod), atr: taStep.atr(14),
        plot0: [], plot1: [], plot2: [], plot3: [], upTop: [], upBottom: [], upTopColor: [], upBottomColor: [],
        dnTop: [], dnBottom: [], dnTopColor: [], dnBottomColor: [], upRim: [], dnRim: [], barColors: [],
        flags: [[], []], times: [[], []],
        // var float[] stateEstimate = array.new_float(5, na); var float[] errorCovariance = array.new_float(5, 100.0).
        // The 5 elements always hold the same value (same start, same update), so one state is kept.
        vars: { state: NaN, cov: 100.0 },
        steps: [], lists: [], series: [],
      };
      s.steps = [s.lo, s.hi, s.atr];
      s.lists = [s.barColors, ...s.times];
      s.series = [
        s.plot0, s.plot1, s.plot2, s.plot3, s.upTop, s.upBottom, s.upTopColor, s.upBottomColor, s.dnTop, s.dnBottom,
        s.dnTopColor, s.dnBottomColor, s.upRim, s.dnRim, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const kalman = (src: number, noise: number): number => {
        const predState = v.state; // simplified prediction
        const predCov = v.cov + cfg.processNoise;
        const kg = predCov / (predCov + noise);
        v.state = predState + kg * (src - predState);
        v.cov = (1 - kg) * predCov;
        return v.state;
      };
      const p = value(b);
      // f_init: if na(stateEstimate[0]) => state = source, covariance = 1.0
      if (isNaN(v.state)) {
        v.state = p;
        v.cov = 1.0;
      }
      // kalmanFilteredPrice = f_kalman(pricesource, measurementNoise): not plotted, but it updates the shared state
      kalman(p, cfg.measurementNoise);
      // KHMA(src, len) = f_kalman(2 * f_kalman(src, len / 2) - f_kalman(src, len), math.round(math.sqrt(len)))
      const half = kalman(p, cfg.measurementNoise / 2);
      const full = kalman(p, cfg.measurementNoise);
      const hma = kalman(2 * half - full, Math.round(Math.sqrt(cfg.measurementNoise)));

      // donchian(kalmanHMA, basePeriod) = math.avg(ta.lowest(src, len), ta.highest(src, len))
      const base = (s.lo.step(hma) + s.hi.step(hma)) / 2;
      const atr = s.atr.step(b.high, b.low, b.close);

      const time = b.time;
      const c = b.close;
      const col = gt(p, base) ? cfg.longColor : lt(p, base) ? cfg.shortColor : color.white;
      const above = gt(c, base);
      const below = lt(c, base);
      // fill(pPx, pBase, close > base ? close : base, close > base ? base : close,
      //      close > base ? color.new(longColor, 10) : na, close > base ? color.new(longColor, 85) : na, "Up Energy")
      s.upTop[i] = above ? c : base;
      s.upBottom[i] = above ? base : c;
      s.upTopColor[i] = above ? longStrong : null;
      s.upBottomColor[i] = above ? longWeak : null;
      // fill(pPx, pBase, close < base ? base : close, close < base ? close : base,
      //      close < base ? color.new(shortColor, 10) : na, close < base ? color.new(shortColor, 85) : na, "Down Energy")
      s.dnTop[i] = below ? base : c;
      s.dnBottom[i] = below ? c : base;
      s.dnTopColor[i] = below ? shortStrong : null;
      s.dnBottomColor[i] = below ? shortWeak : null;
      // fill(pPx, pRimUp, close > base ? color.new(longColor, 35) : na); fill(pPx, pRimDn, close < base ? ... : na)
      s.upRim[i] = above ? longRim : 'transparent';
      s.dnRim[i] = below ? shortRim : 'transparent';
      // barcolor(paintCandles ? col : na, title = "Trend Candles")
      if (cfg.paintCandles) s.barColors.push({ time, color: col });

      // plot(base, color = col, title = "Kalman Hull Kijun", linewidth = lineW, display = showKijun ? all : none)
      s.plot0[i] = { time, value: base, color: col };
      // pPx = plot(showFill ? close : na, title = "Price (hidden)", display = display.none)
      s.plot1[i] = { time, value: cfg.showFill ? c : NaN };
      // rim = ta.atr(14) * 0.08; pRimUp = plot(close - rim, display = display.none); pRimDn = plot(close + rim, ...)
      s.plot2[i] = { time, value: c - atr * 0.08 };
      s.plot3[i] = { time, value: c + atr * 0.08 };

      // long = pricesource > base; short = pricesource < base
      const long = gt(p, base);
      const short = lt(p, base);
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          // Up Energy
          { plot1: 'plot1', plot2: 'plot0',
            gradient: { topValue: s.upTop.slice(), bottomValue: s.upBottom.slice(), topColor: s.upTopColor.slice(), bottomColor: s.upBottomColor.slice() } },
          // Down Energy
          { plot1: 'plot1', plot2: 'plot0',
            gradient: { topValue: s.dnTop.slice(), bottomValue: s.dnBottom.slice(), topColor: s.dnTopColor.slice(), bottomColor: s.dnBottomColor.slice() } },
          // Up Rim
          { plot1: 'plot1', plot2: 'plot2', colors: s.upRim.slice() },
          // Down Rim
          { plot1: 'plot1', plot2: 'plot3', colors: s.dnRim.slice() },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KalmanHullKijunInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KalmanHullKijunInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Kalman Hull Kijun Long', message: 'Kalman Hull Kijun Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Kalman Hull Kijun Short', message: 'Kalman Hull Kijun Short {{exchange}}:{{ticker}}' },
];

export const KalmanHullKijun = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
