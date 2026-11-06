/**
 * RSI Trend Navigator
 *
 * An adaptive average of the source (alpha 2 / (trendPeriod * 0.5 + 1) while the EMA-smoothed RSI is above 50, else
 * 2 / (trendPeriod * 1.5 + 1)) is moved by the normalised smoothed RSI ((RSI - 50) / 50) times ATR(14) times the
 * sensitivity. ATR bands around this value push a trailing trend line: it falls to the upper band when the band is
 * below it and rises to the lower band when the band is above it. The trend is bullish after a rise of the line and
 * bearish after a fall; it colours the line, a gradient fill between the line and hl2, and optionally the bars.
 * Alerts (alertcondition, `alerts` of the result): 'RSI Trend Bullish' / 'RSI Trend Bearish', true on the bar where
 * the trend turns bullish / bearish (both are off until the line first rises or falls).
 *
 * Reference: "RSI Trend Navigator [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export type RSITrendNavigatorPreset = 'Classic' | 'Aqua' | 'Cosmic' | 'Custom';

export interface RSITrendNavigatorInputs {
  /** RSI period */
  rsiPeriod: number;
  /** EMA length of the RSI */
  rsiSmoothing: number;
  /** Base trend period (sets the adaptive alpha) */
  trendPeriod: number;
  /** RSI sensitivity */
  rsiSensitivity: number;
  /** ATR period of the bands */
  atrPeriod: number;
  /** ATR multiplier of the bands */
  atrMultiplier: number;
  /** Price source */
  priceSource: SourceType;
  /** Colour preset */
  colorPreset: RSITrendNavigatorPreset;
  /** Bullish colour of the 'Custom' preset */
  bullColor: string;
  /** Bearish colour of the 'Custom' preset */
  bearColor: string;
  /** Colour the candles */
  paintBars: boolean;
}

export const defaultInputs: RSITrendNavigatorInputs = {
  rsiPeriod: 14,
  rsiSmoothing: 5,
  trendPeriod: 21,
  rsiSensitivity: 0.5,
  atrPeriod: 14,
  atrMultiplier: 1.5,
  priceSource: 'close',
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  paintBars: false,
};

const TREND = '════════ Trend Settings ════════';
const VISUAL = '════════ Visualization Settings ════════';

export const inputConfig: InputConfig[] = [
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14, min: 2, group: TREND },
  { id: 'rsiSmoothing', type: 'int', title: 'RSI Smoothing', defval: 5, min: 1, group: TREND },
  { id: 'trendPeriod', type: 'int', title: 'Base Trend Period', defval: 21, min: 2, group: TREND },
  { id: 'rsiSensitivity', type: 'float', title: 'RSI Sensitivity', defval: 0.5, min: 0.1, max: 2.0, step: 0.1, group: TREND },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 14, min: 1, group: TREND },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 1.5, min: 0.1, step: 0.1, group: TREND },
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'close', group: TREND },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Custom'], group: VISUAL },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa', group: VISUAL },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#ff0000', group: VISUAL },
  { id: 'paintBars', type: 'bool', title: 'Color Candles', defval: false, group: VISUAL },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Trend Line', color: '#00ffaa', lineWidth: 4 },
  { id: 'plot1', title: 'Price', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'RSI Trend Navigator [QuantAlgo]',
  shortTitle: 'RSI Trend Navigator [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface NavigatorVars {
  /** var float adaptiveTrend, var float trendLine */
  adaptiveTrend: number;
  line: number;
  isBullish: boolean;
  isBearish: boolean;
}

interface NavigatorRun extends BarRunState<NavigatorVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  atr14: ReturnType<typeof taStep.atr>;
  atr: ReturnType<typeof taStep.atr>;
  trendLine: number[];
  hl2: number[];
  bottomColor: string[];
  lineData: Point[];
  priceData: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RSITrendNavigatorInputs>): BarStudy<NavigatorRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.priceSource);

  const [bullCol, bearCol] = cfg.colorPreset === 'Classic' ? ['#00ff00', '#ff0000']
    : cfg.colorPreset === 'Aqua' ? ['#00bfff', '#ff8c00']
      : cfg.colorPreset === 'Cosmic' ? ['#ff1493', '#9932cc']
        : [cfg.bullColor, cfg.bearColor];
  const fastAlpha = 2.0 / (cfg.trendPeriod * 0.5 + 1);
  const slowAlpha = 2.0 / (cfg.trendPeriod * 1.5 + 1);

  return {
    fullRunReason: () => (isBarSource(cfg.priceSource) ? null : 'source of another study'),
    init() {
      // rsiSmoothedTrend(priceSource, rsiPeriod, rsiSmoothing, trendPeriod, rsiSensitivity)
      const rsi = taStep.rsi(cfg.rsiPeriod);
      const ema = taStep.ema(cfg.rsiSmoothing);
      const atr14 = taStep.atr(14);
      const atr = taStep.atr(cfg.atrPeriod);
      const s: NavigatorRun = {
        rsi, ema, atr14, atr, trendLine: [], hl2: [], bottomColor: [], lineData: [], priceData: [], barColors: [],
        flags: [[], []], times: [[], []],
        steps: [rsi, ema, atr14, atr],
        vars: { adaptiveTrend: NaN, line: NaN, isBullish: false, isBearish: false },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.trendLine, s.hl2, s.bottomColor, s.lineData, s.priceData, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      const smoothedRSI = s.ema.step(s.rsi.step(src));
      const atr14 = s.atr14.step(b.high, b.low, b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const normalizedRSI = (smoothedRSI - 50) / 50;
      const rsiAdjustment = normalizedRSI * atr14 * cfg.rsiSensitivity;
      const adaptiveAlpha = gt(smoothedRSI, 50) ? fastAlpha : slowAlpha;
      // adaptiveTrend := adaptiveAlpha * source + (1 - adaptiveAlpha) * nz(adaptiveTrend[1], source)
      const prev = i === 0 || isNaN(v.adaptiveTrend) ? src : v.adaptiveTrend;
      v.adaptiveTrend = adaptiveAlpha * src + (1 - adaptiveAlpha) * prev;
      const rsiTrendValue = v.adaptiveTrend + rsiAdjustment;

      const deviation = atr * cfg.atrMultiplier;
      const upperBound = rsiTrendValue + deviation;
      const lowerBound = rsiTrendValue - deviation;
      // trendLine := nz(trendLine[1], rsiTrendValue)
      let line = v.line;
      if (isNaN(line)) line = rsiTrendValue;
      if (lt(upperBound, line)) line = upperBound;
      if (gt(lowerBound, line)) line = lowerBound;
      v.line = line;
      s.trendLine[i] = line;

      const prevLine = i > 0 ? s.trendLine[i - 1] : NaN;
      const wasBullish = v.isBullish;
      const wasBearish = v.isBearish;
      if (gt(line, prevLine)) { v.isBullish = true; v.isBearish = false; }
      else if (lt(line, prevLine)) { v.isBullish = false; v.isBearish = true; }
      // alertcondition(isBullish and not isBullish[1]) / alertcondition(isBearish and not isBearish[1])
      const bullTurn = v.isBullish && !wasBullish;
      const bearTurn = v.isBearish && !wasBearish;
      const currentTrend = v.isBullish ? bullCol : bearCol;

      const hl2 = (b.high + b.low) / 2;
      s.hl2[i] = hl2;
      s.bottomColor[i] = String(color.new(currentTrend, 20));
      // plot(trendLine, 'RSI Trend Line', color = currentTrend, linewidth = 4)
      s.lineData[i] = { time: b.time, value: line, color: currentTrend };
      // plot(hl2, 'Price', display = display.none, editable = false)
      s.priceData[i] = { time: b.time, value: hl2 };
      // barcolor(paintBars ? currentTrend : na)
      s.barColors[i] = { time: b.time, color: currentTrend };
      s.flags[0][i] = bullTurn;
      s.flags[1][i] = bearTurn;
      if (bullTurn) s.times[0].push(b.time as number);
      if (bearTurn) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lineData.slice(),
          plot1: s.priceData.slice(),
        },
        fills: [{
          // fill(p_trend, p_price, hl2, trendLine, na, color.new(currentTrend, 20))
          plot1: 'plot0', plot2: 'plot1',
          gradient: {
            topValue: s.hl2.slice(),
            bottomValue: s.trendLine.slice(),
            topColor: new Array<string | null>(n).fill(null),
            bottomColor: s.bottomColor.slice(),
          },
        }],
        barColors: cfg.paintBars ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSITrendNavigatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSITrendNavigatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSI Trend Bullish', message: 'RSI Trend Bullish Signal {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'RSI Trend Bearish', message: 'RSI Trend Bearish Signal {{exchange}}:{{ticker}}' },
];

export const RSITrendNavigator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
