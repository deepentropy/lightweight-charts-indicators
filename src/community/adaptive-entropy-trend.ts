/**
 * Adaptive Entropy Trend
 *
 * Shannon entropy of the log returns of the last `Entropy Lookback` bars (10-bin histogram between the lowest and
 * the highest return of the window), normalised by log2(10). An adaptive EMA of the close uses
 * alpha = 2 / (lookback * (0.3 + 1.4 * entropy) + 1): it is faster when the returns are concentrated (trend) and
 * slower when they are spread (noise). Bands around it: ATR(lookback) * multiplier * (0.5 + 1 - entropy), inner
 * (fast multiplier) and outer (slow multiplier). The trend turns up when the close is above the inner upper band and
 * down when it is below the inner lower band; the bands, fills and candles take the trend colour.
 * Presets replace the lookback and the multipliers (Fast Response 12 / 1.4 / 2.8, Smooth Trend 40 / 2.2 / 4.5).
 * Alerts (alertcondition, `alerts` of the result): the trend turns bullish, bearish, or either.
 *
 * Reference: "Adaptive Entropy Trend [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export type AdaptiveEntropyTrendPreset = 'Default' | 'Fast Response' | 'Smooth Trend';
export type AdaptiveEntropyTrendColorPreset = 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';

export interface AdaptiveEntropyTrendInputs {
  /** Entropy and ATR lookback */
  lookbackLen: number;
  /** Inner band multiplier */
  fastMultiplier: number;
  /** Outer band multiplier */
  slowMultiplier: number;
  /** Preset: replaces the lookback and the multipliers */
  presetConfig: AdaptiveEntropyTrendPreset;
  colorPreset: AdaptiveEntropyTrendColorPreset;
  bullColor: string;
  bearColor: string;
  /** Transparency of the outer fills (inner fill: + 6) */
  fillTransparency: number;
  enableBarcolor: boolean;
}

export const defaultInputs: AdaptiveEntropyTrendInputs = {
  lookbackLen: 25,
  fastMultiplier: 1.8,
  slowMultiplier: 3.5,
  presetConfig: 'Default',
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  fillTransparency: 88,
  enableBarcolor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackLen', type: 'int', title: 'Entropy Lookback', defval: 25, min: 5 },
  { id: 'fastMultiplier', type: 'float', title: 'Fast Band Multiplier', defval: 1.8, step: 0.1 },
  { id: 'slowMultiplier', type: 'float', title: 'Slow Band Multiplier', defval: 3.5, step: 0.1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: '#00ffaa' },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: '#ff0000' },
  { id: 'fillTransparency', type: 'int', title: 'Fill Transparency', defval: 88, min: 0, max: 100 },
  { id: 'enableBarcolor', type: 'bool', title: 'Enable Bar Coloring', defval: true },
];

const NEUTRAL = '#787b86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Outer Upper', color: String(color.new(NEUTRAL, 90)), lineWidth: 1 },
  { id: 'plot1', title: 'Inner Upper', color: String(color.new(NEUTRAL, 70)), lineWidth: 1 },
  { id: 'plot2', title: 'Adaptive EMA', color: NEUTRAL, lineWidth: 3 },
  { id: 'plot3', title: 'Inner Lower', color: String(color.new(NEUTRAL, 70)), lineWidth: 1 },
  { id: 'plot4', title: 'Outer Lower', color: String(color.new(NEUTRAL, 90)), lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive Entropy Trend [QuantAlgo]',
  shortTitle: 'Adaptive Entropy Trend [QuantAlgo]',
  overlay: true,
};

/** [bull, bear] colours of the presets */
const PRESETS: Record<Exclude<AdaptiveEntropyTrendColorPreset, 'Custom'>, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface AetVars {
  /** var float adaptiveEma = na */
  adaptiveEma: number;
  /** var int trendDirection = 0 */
  trendDirection: number;
}

interface AetRun extends BarRunState<AetVars> {
  lowest: WindowExtreme;
  highest: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  logReturn: number[];
  direction: number[];
  plots: Point[][];
  outerFill: string[];
  innerFill: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveEntropyTrendInputs>): BarStudy<AetRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let len = cfg.lookbackLen;
  let fastMult = cfg.fastMultiplier;
  let slowMult = cfg.slowMultiplier;
  if (cfg.presetConfig === 'Fast Response') {
    len = 12;
    fastMult = 1.4;
    slowMult = 2.8;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    len = 40;
    fastMult = 2.2;
    slowMult = 4.5;
  }
  const [bullColor, bearColor] = cfg.colorPreset === 'Custom' ? [cfg.bullColor, cfg.bearColor] : PRESETS[cfg.colorPreset];

  const histBins = 10;
  const maxEntropy = Math.log(histBins) / Math.log(2);
  const outerT = cfg.fillTransparency;
  const innerT = Math.min(cfg.fillTransparency + 6, 100);
  /** The histogram of one bar (scratch, cleared on each bar) */
  const binCounts = new Array<number>(histBins).fill(0);
  return {
    init() {
      const s: AetRun = {
        lowest: new WindowExtreme(true, len), highest: new WindowExtreme(false, len), atr: taStep.atr(len),
        logReturn: [], direction: [], plots: Array.from({ length: 5 }, () => []), outerFill: [], innerFill: [],
        barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { adaptiveEma: NaN, trendDirection: 0 }, lists: [], series: [],
      };
      s.steps = [s.lowest, s.highest, s.atr];
      s.lists = s.times;
      s.series = [s.logReturn, s.direction, ...s.plots, s.outerFill, s.innerFill, s.barColors, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const time = bar.time as number;
      const v = s.vars;
      const logReturn = s.logReturn;
      // logReturn = math.log(close / close[1])
      logReturn[b] = b > 0 ? Math.log(bar.close / bars[b - 1].close) : NaN;
      const minReturn = s.lowest.step(logReturn[b]);
      const maxReturn = s.highest.step(logReturn[b]);
      const atr = s.atr.step(bar.high, bar.low, bar.close);

      const returnRange = maxReturn - minReturn;
      let entropy = 0.0;
      if (gt(returnRange, 0)) {
        binCounts.fill(0);
        for (let i = 0; i < len; i++) {
          const lr = b - i >= 0 ? logReturn[b - i] : NaN;
          // binIndex = math.floor((logReturn[i] - minReturn) / returnRange * (histBins - 1)), clamped to 0..histBins - 1
          const binIndex = Math.min(Math.max(Math.floor(((lr - minReturn) / returnRange) * (histBins - 1)), 0), histBins - 1);
          if (isNaN(binIndex)) continue;
          binCounts[binIndex] += 1.0;
        }
        for (let i = 0; i < histBins; i++) {
          const probability = binCounts[i] / len;
          if (gt(probability, 0)) entropy = entropy - (probability * Math.log(probability)) / Math.log(2);
        }
      }
      const normalizedEntropy = gt(maxEntropy, 0) ? entropy / maxEntropy : 0.5;
      const adaptiveAlpha = 2.0 / (len * (0.3 + normalizedEntropy * 1.4) + 1.0);
      const close = bar.close;
      const ema = isNaN(v.adaptiveEma) ? close : v.adaptiveEma + adaptiveAlpha * (close - v.adaptiveEma);
      v.adaptiveEma = ema;
      const trendStrength = 1.0 - normalizedEntropy;
      const fastBandWidth = atr * fastMult * (0.5 + trendStrength);
      const slowBandWidth = atr * slowMult * (0.5 + trendStrength);
      const innerUpper = ema + fastBandWidth;
      const innerLower = ema - fastBandWidth;
      const outerUpper = ema + slowBandWidth;
      const outerLower = ema - slowBandWidth;

      if (gt(close, innerUpper)) v.trendDirection = 1;
      else if (lt(close, innerLower)) v.trendDirection = -1;
      const d = v.trendDirection;
      s.direction[b] = d;
      const trendColor = d === 1 ? bullColor : d === -1 ? bearColor : NEUTRAL;

      const p = s.plots;
      const c70 = String(color.new(trendColor, 70));
      const c90 = String(color.new(trendColor, 90));
      p[0][b] = { time, value: outerUpper, color: c90 };
      p[1][b] = { time, value: innerUpper, color: c70 };
      p[2][b] = { time, value: ema, color: trendColor };
      p[3][b] = { time, value: innerLower, color: c70 };
      p[4][b] = { time, value: outerLower, color: c90 };
      s.outerFill[b] = String(color.new(trendColor, outerT));
      s.innerFill[b] = String(color.new(trendColor, innerT));
      // barcolor(enableBarcolor ? color.new(trendColor, 20) : na, title = 'Trend Bar Color')
      if (cfg.enableBarcolor) s.barColors[b] = { time, color: String(color.new(trendColor, 20)) };

      // trendTurnedBullish = trendDirection == 1 and trendDirection[1] != 1 (na on the first bar: false), bearish alike
      const turnedBull = d === 1 && b > 0 && s.direction[b - 1] !== 1;
      const turnedBear = d === -1 && b > 0 && s.direction[b - 1] !== -1;
      const flags = [turnedBull, turnedBear, turnedBull || turnedBear];
      for (let k = 0; k < 3; k++) {
        s.flags[k][b] = flags[k];
        if (flags[k]) s.times[k].push(time);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [
          // fill(plotOuterUpper, plotInnerUpper, color = color.new(trendColor, outerFillTransparency))
          { plot1: 'plot0', plot2: 'plot1', colors: s.outerFill.slice() },
          // fill(plotInnerUpper, plotInnerLower, color = color.new(trendColor, innerFillTransparency))
          { plot1: 'plot1', plot2: 'plot3', colors: s.innerFill.slice() },
          // fill(plotInnerLower, plotOuterLower, color = color.new(trendColor, outerFillTransparency))
          { plot1: 'plot3', plot2: 'plot4', colors: s.outerFill.slice() },
        ],
        barColors: cfg.enableBarcolor ? s.barColors.slice() : [],
        // alertcondition(trendTurnedBullish / trendTurnedBearish / trendChanged, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveEntropyTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveEntropyTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Adaptive Entropy Trend: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Adaptive Entropy Trend: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Trend Direction Changed', message: 'Adaptive Entropy Trend: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const AdaptiveEntropyTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
