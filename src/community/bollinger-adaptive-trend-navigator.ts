/**
 * Bollinger Adaptive Trend Navigator
 *
 * An adaptive average of the source whose smoothing factor grows with the distance of the source from the middle of
 * its Bollinger Bands, scaled by the band width relative to its average: alpha = clamp(2 / (period + 1) *
 * (1 + |adaptive factor|), 0.01, 0.5). The trend value is 0.7 * the adaptive average + 0.3 * an EMA of the band
 * middle. A trailing line follows it inside an ATR band (trend value +- ATR * multiplier): it only moves when the band
 * pushes it. The line is bullish while it last rose, bearish while it last fell; a gradient fill runs from the line
 * to hl2, and the candles can be coloured. Presets override the lengths and multipliers.
 * Alerts (alertcondition, `alerts` of the result): 'Bollinger Adaptive Trend Bullish' / 'Bearish' on the bar where
 * the line turns bullish / bearish.
 *
 * Reference: "Bollinger Adaptive Trend Navigator [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bollinger Adaptive Trend Bullish', message: 'Bollinger Adaptive Trend Bullish Signal {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Bollinger Adaptive Trend Bearish', message: 'Bollinger Adaptive Trend Bearish Signal {{exchange}}:{{ticker}}' },
];

export interface BollingerAdaptiveTrendNavigatorInputs {
  bbPeriod: number;
  bbStdDev: number;
  centerSmoothing: number;
  adaptiveMultiplier: number;
  volatilityPeriod: number;
  volatilityMultiplier: number;
  priceSource: SourceType;
  inputPreset: 'Default' | 'Scalping' | 'Swing Trading';
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Custom';
  bullColor: string;
  bearColor: string;
  paintBars: boolean;
}

export const defaultInputs: BollingerAdaptiveTrendNavigatorInputs = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  centerSmoothing: 5,
  adaptiveMultiplier: 1.0,
  volatilityPeriod: 14,
  volatilityMultiplier: 1.5,
  priceSource: 'close',
  inputPreset: 'Default',
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  paintBars: false,
};

const G_TREND = '════════ Trend Settings ════════';
const G_VIS = '════════ Visualization Settings ════════';

export const inputConfig: InputConfig[] = [
  { id: 'bbPeriod', type: 'int', title: 'Bollinger Band Period', defval: 20, min: 2, group: G_TREND },
  { id: 'bbStdDev', type: 'float', title: 'BB Standard Deviation', defval: 2.0, min: 0.1, step: 0.1, group: G_TREND },
  { id: 'centerSmoothing', type: 'int', title: 'Center Line Smoothing', defval: 5, min: 1, group: G_TREND },
  { id: 'adaptiveMultiplier', type: 'float', title: 'Adaptive Multiplier', defval: 1.0, min: 0.1, step: 0.1, group: G_TREND },
  { id: 'volatilityPeriod', type: 'int', title: 'Volatility Period', defval: 14, min: 1, group: G_TREND },
  { id: 'volatilityMultiplier', type: 'float', title: 'Volatility Multiplier', defval: 1.5, min: 0.1, step: 0.1, group: G_TREND },
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'close', group: G_TREND },
  { id: 'inputPreset', type: 'string', title: 'Preconfigured Input Preset', defval: 'Default', options: ['Default', 'Scalping', 'Swing Trading'], group: G_TREND },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Custom'], group: G_VIS },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa', group: G_VIS },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#ff0000', group: G_VIS },
  { id: 'paintBars', type: 'bool', title: 'Color Candles', defval: false, group: G_VIS },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger Adaptive Trend Line', color: '#ff0000', lineWidth: 4 },
  { id: 'plot1', title: 'Price', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Bollinger Adaptive Trend Navigator [QuantAlgo]',
  shortTitle: 'Bollinger Adaptive Trend Navigator [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface BatnVars {
  /** var float adaptiveTrend = source (first bar), then set on every bar */
  adaptiveTrend: number;
  /** var float trendLine = bollingerTrendValue (first bar) */
  tl: number;
  bull: boolean;
  /** var bool isBearish = false: false until the line first falls (isBullish is false before it first rises) */
  bear: boolean;
}

interface BatnRun extends BarRunState<BatnVars> {
  mid: WindowSma;
  std: WindowStdev;
  center: ReturnType<typeof taStep.ema>;
  avgWidth: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  trendLine: number[];
  hl2: number[];
  plot0: Point[];
  plot1: Point[];
  topColor: (string | null)[];
  bottomColor: (string | null)[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BollingerAdaptiveTrendNavigatorInputs>): BarStudy<BatnRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { bbPeriod, bbStdDev, centerSmoothing, adaptiveMultiplier, volatilityPeriod, volatilityMultiplier } = cfg;
  if (cfg.inputPreset === 'Scalping') {
    [bbPeriod, bbStdDev, centerSmoothing, adaptiveMultiplier, volatilityPeriod, volatilityMultiplier] = [12, 1.8, 3, 1.5, 10, 1.0];
  } else if (cfg.inputPreset === 'Swing Trading') {
    [bbPeriod, bbStdDev, centerSmoothing, adaptiveMultiplier, volatilityPeriod, volatilityMultiplier] = [30, 2.2, 8, 0.8, 20, 2.2];
  }
  const presets: Record<string, [string, string]> = {
    Classic: ['#00ff00', '#ff0000'],
    Aqua: ['#00bfff', '#ff8c00'],
    Cosmic: ['#ff1493', '#9932cc'],
    Custom: [cfg.bullColor, cfg.bearColor],
  };
  const [bullish, bearish] = presets[cfg.colorPreset] ?? presets.Custom;
  const value = barSource(cfg.priceSource);
  return {
    fullRunReason: () => (isBarSource(cfg.priceSource) ? null : 'source of another study'),
    init() {
      const s: BatnRun = {
        mid: new WindowSma(bbPeriod), std: new WindowStdev(bbPeriod), center: taStep.ema(centerSmoothing),
        avgWidth: new WindowSma(bbPeriod), atr: taStep.atr(volatilityPeriod),
        trendLine: [], hl2: [], plot0: [], plot1: [], topColor: [], bottomColor: [], barColors: [],
        flags: [[], []], times: [[], []],
        steps: [], vars: { adaptiveTrend: NaN, tl: NaN, bull: false, bear: false }, lists: [], series: [],
      };
      s.steps = [s.mid, s.std, s.center, s.avgWidth, s.atr];
      s.lists = s.times;
      s.series = [s.trendLine, s.hl2, s.plot0, s.plot1, s.topColor, s.bottomColor, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const v = s.vars;
      // bollingerAdaptiveTrend(source, ...)
      const src = value(b);
      const bbMiddle = s.mid.step(src);
      const bbStd = s.std.step(src);
      const bbUpper = bbMiddle + bbStdDev * bbStd;
      const bbLower = bbMiddle - bbStdDev * bbStd;
      const smoothedCenter = s.center.step(bbMiddle);
      const bandWidth = bbUpper - bbLower;
      const avgBandWidth = s.avgWidth.step(bandWidth);
      // na != na is false: 0.5 while the bands are na
      const bbPosition = ne(bbUpper, bbLower) ? (src - bbLower) / (bbUpper - bbLower) : 0.5;
      const bandWidthRatio = ne(avgBandWidth, 0) ? bandWidth / avgBandWidth : 1;
      const adaptiveFactor = (bbPosition - 0.5) * 2 * adaptiveMultiplier * bandWidthRatio;
      const alpha = Math.max(0.01, Math.min(0.5, (2.0 / (bbPeriod + 1)) * (1 + Math.abs(adaptiveFactor))));
      const prevAt = i === 0 ? src : v.adaptiveTrend; // var initial value on bar 0
      v.adaptiveTrend = alpha * src + (1 - alpha) * (isNaN(prevAt) ? src : prevAt);
      const trendValue = 0.7 * v.adaptiveTrend + 0.3 * smoothedCenter;

      const atr = s.atr.step(b.high, b.low, b.close);
      const deviation = atr * volatilityMultiplier;
      const upperBound = trendValue + deviation;
      const lowerBound = trendValue - deviation;
      // on bar 0 the var initial value is bollingerTrendValue of bar 0
      const prev = i === 0 ? trendValue : v.tl;
      let tl = isNaN(prev) ? trendValue : prev;
      if (lt(upperBound, tl)) tl = upperBound;
      if (gt(lowerBound, tl)) tl = lowerBound;
      v.tl = tl;
      s.trendLine[i] = tl;
      const prevTl = i > 0 ? s.trendLine[i - 1] : NaN;
      const wasBull = v.bull;
      const wasBear = v.bear;
      if (gt(tl, prevTl)) {
        v.bull = true;
        v.bear = false;
      } else if (lt(tl, prevTl)) {
        v.bull = false;
        v.bear = true;
      }
      // alertcondition(isBullish and not isBullish[1]) / alertcondition(isBearish and not isBearish[1])
      const bullFlag = v.bull && !wasBull;
      const bearFlag = v.bear && !wasBear;
      s.flags[0][i] = bullFlag;
      s.flags[1][i] = bearFlag;
      if (bullFlag) s.times[0].push(time);
      if (bearFlag) s.times[1].push(time);

      const current = v.bull ? bullish : bearish;
      const hl2 = (b.high + b.low) / 2;
      s.hl2[i] = hl2;
      if (cfg.paintBars) s.barColors[i] = { time, color: current };
      s.plot0[i] = { time, value: tl, color: current };
      s.plot1[i] = { time, value: hl2 };
      s.topColor[i] = null;
      s.bottomColor[i] = String(color.new(current, 20));
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(p_trend, p_price, hl2, trendLine, na, color.new(currentTrend, 20))
        fills: [{
          plot1: 'plot0',
          plot2: 'plot1',
          gradient: {
            topValue: s.hl2.slice(),
            bottomValue: s.trendLine.slice(),
            topColor: s.topColor.slice(),
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
export function createRun(inputs: Partial<BollingerAdaptiveTrendNavigatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BollingerAdaptiveTrendNavigatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BollingerAdaptiveTrendNavigator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
