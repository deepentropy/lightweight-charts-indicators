/**
 * Volume-Weighted Price Z-Score
 *
 * Log deviation of the source from its volume-weighted moving average: d = log(src / vwma(src, lookback)). The raw
 * z-score is d / stdev(d, lookback), smoothed by an EMA. The line and the bars take a gradient colour: grey at 0 to
 * the positive colour at +threshold, the negative colour at -threshold to grey at 0. A gradient fill joins the line
 * to zero; levels at +/- threshold (dashed in Pine), +/- 1 and +/- 2 (dotted in Pine, +/- 2 hidden).
 * Presets replace the lookback and the smoothing (Fast Response 50 / 3, Smooth Trend 200 / 8).
 *
 * Alerts (alertcondition, `alerts` of the result): the z-score crossing into (over +threshold, under -threshold) and
 * out of the extreme zones, crossing over / under zero, and entering either extreme zone.
 *
 * Reference: "Volume-Weighted Price Z-Score [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VWPZPreset = 'Default' | 'Fast Response' | 'Smooth Trend';
export type VWPZColorPreset = 'Classic' | 'Aqua' | 'Cosmic' | 'Ember' | 'Neon' | 'Custom';

export interface VolumeWeightedPriceZScoreInputs {
  /** Price source */
  priceSource: SourceType;
  /** VWMA and volatility length */
  lookbackPeriod: number;
  /** EMA length of the z-score */
  smoothingPeriod: number;
  /** Preset: replaces the lookback and the smoothing */
  presetConfig: VWPZPreset;
  /** Extreme level */
  extremeThreshold: number;
  colorPreset: VWPZColorPreset;
  positiveColor: string;
  negativeColor: string;
  /** Transparency of the fill on the z-score side */
  fillTransparency: number;
  enableBarColoring: boolean;
}

export const defaultInputs: VolumeWeightedPriceZScoreInputs = {
  priceSource: 'close',
  lookbackPeriod: 100,
  smoothingPeriod: 5,
  presetConfig: 'Default',
  extremeThreshold: 2.5,
  colorPreset: 'Custom',
  positiveColor: '#ff0000',
  negativeColor: '#00ffaa',
  fillTransparency: 70,
  enableBarColoring: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'priceSource', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'lookbackPeriod', type: 'int', title: 'Lookback Period', defval: 100 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'extremeThreshold', type: 'float', title: 'Extreme Threshold', defval: 2.5, min: 1.0, max: 4.0, step: 0.5 },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Ember', 'Neon', 'Custom'] },
  { id: 'positiveColor', type: 'color', title: 'Positive Deviation Color', defval: '#ff0000' },
  { id: 'negativeColor', type: 'color', title: 'Negative Deviation Color', defval: '#00ffaa' },
  { id: 'fillTransparency', type: 'int', title: 'Fill Transparency', defval: 70, min: 0, max: 100 },
  { id: 'enableBarColoring', type: 'bool', title: 'Enable Bar Coloring', defval: true },
];

const GRAY50 = String(color.new(color.gray, 50));
const NEUTRAL = '#808080';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: NEUTRAL, lineWidth: 3 },
  // Pine linestyle = plot.linestyle_dotted (dashed for the extreme levels): PlotConfig has no line style, drawn solid
  { id: 'plot1', title: 'Zero Line', color: GRAY50, lineWidth: 1 },
  { id: 'plot2', title: 'Extreme Positive Level', color: '#ff0000', lineWidth: 1 },
  { id: 'plot3', title: 'Extreme Negative Level', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot4', title: '+2σ', color: GRAY50, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: '-2σ', color: GRAY50, lineWidth: 1, display: 'none' },
  { id: 'plot6', title: '+1σ', color: GRAY50, lineWidth: 1 },
  { id: 'plot7', title: '-1σ', color: GRAY50, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume-Weighted Price Z-Score [QuantAlgo]',
  shortTitle: 'Volume-Weighted Price Z-Score [QuantAlgo]',
  overlay: false,
};

/** [positive, negative] colours of the presets */
const PRESETS: Record<Exclude<VWPZColorPreset, 'Custom'>, [string, string]> = {
  Classic: ['#ff0000', '#00ff00'],
  Aqua: ['#ff8c00', '#00bfff'],
  Cosmic: ['#9932cc', '#49ffce'],
  Ember: ['#00cccc', '#ff6600'],
  Neon: ['#ff00ff', '#ffff00'],
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface VwpzRun extends BarRunState<Record<string, never>> {
  /** ta.vwma(src, lookback, volume): sma(src * volume) / sma(volume) */
  num: WindowSma;
  den: WindowSma;
  vol: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  z: number[];
  plots: Point[][];
  topValue: number[];
  bottomValue: number[];
  topColor: string[];
  bottomColor: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeWeightedPriceZScoreInputs>): BarStudy<VwpzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let lookback = cfg.lookbackPeriod;
  let smoothing = cfg.smoothingPeriod;
  if (cfg.presetConfig === 'Fast Response') {
    lookback = 50;
    smoothing = 3;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    lookback = 200;
    smoothing = 8;
  }
  const [positiveColor, negativeColor] = cfg.colorPreset === 'Custom'
    ? [cfg.positiveColor, cfg.negativeColor] : PRESETS[cfg.colorPreset];
  const thr = cfg.extremeThreshold;
  const value = barSource(cfg.priceSource);
  const topT = cfg.fillTransparency;
  const bottomT = Math.min(cfg.fillTransparency + 20, 100);
  const lines: [number, string][] = [[0, GRAY50], [thr, positiveColor], [-thr, negativeColor], [2, GRAY50], [-2, GRAY50], [1, GRAY50], [-1, GRAY50]];
  return {
    fullRunReason: () => (isBarSource(cfg.priceSource) ? null : 'source of another study'),
    init() {
      const s: VwpzRun = {
        num: new WindowSma(lookback), den: new WindowSma(lookback), vol: new WindowStdev(lookback), ema: taStep.ema(smoothing), z: [],
        plots: Array.from({ length: 8 }, () => []), topValue: [], bottomValue: [], topColor: [], bottomColor: [],
        barColors: [], flags: Array.from({ length: 7 }, () => []), times: Array.from({ length: 7 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      // the length checks of ta.vwma (its sma) and ta.stdev
      taStep.vwma(lookback);
      taStep.sma().step(0, lookback);
      taStep.stdev().step(0, lookback);
      s.steps = [s.num, s.den, s.vol, s.ema];
      s.lists = s.times;
      s.series = [s.z, ...s.plots, s.topValue, s.bottomValue, s.topColor, s.bottomColor, ...s.flags];
      if (cfg.enableBarColoring) s.series.push(s.barColors);
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = value(b);
      const volume = b.volume ?? NaN;
      const num = s.num.step(src * volume);
      const den = s.den.step(volume);
      const vwma = den === 0 || Number.isNaN(den) ? NaN : num / den;
      // logDeviation = math.log(priceSource / volumeWeightedAverage)
      const logDev = vwma === 0 ? NaN : Math.log(src / vwma);
      const vol = s.vol.step(logDev);
      // rawZScore = logDeviation / volatilityMeasure (x / 0 = na)
      const raw = vol === 0 ? NaN : logDev / vol;
      const z = s.ema.step(raw);
      s.z[i] = z;

      // gradientColor = zScore > 0 ? from_gradient(z, 0, thr, neutral, positive) : from_gradient(z, -thr, 0, negative, neutral)
      const grad = gt(z, 0)
        ? color.from_gradient(z, 0, thr, NEUTRAL, positiveColor)
        : color.from_gradient(z, -thr, 0, negativeColor, NEUTRAL);

      s.plots[0][i] = { time, value: z, color: grad };
      for (let k = 0; k < 7; k++) s.plots[k + 1][i] = { time, value: lines[k][0], color: lines[k][1] };
      // fill(zScorePlot, zeroLinePlot, zScore, 0, color.new(gradientColor, fillTransparency),
      //      color.new(gradientColor, math.min(fillTransparency + 20, 100)), title = 'Z-Score Fill')
      s.topValue[i] = z;
      s.bottomValue[i] = 0;
      s.topColor[i] = String(color.new(grad, topT));
      s.bottomColor[i] = String(color.new(grad, bottomT));
      // barcolor(enableBarColoring ? gradientColor : na, title = 'Z-Score Bar Color')
      if (cfg.enableBarColoring) s.barColors[i] = { time, color: grad };

      // Signals of the alertconditions: ta.crossover / ta.crossunder with a level
      const pz = i > 0 ? s.z[i - 1] : NaN;
      const f = s.flags;
      const enterExtremePositive = z > thr && pz <= thr;
      const enterExtremeNegative = z < -thr && pz >= -thr;
      f[0][i] = enterExtremePositive;
      f[1][i] = enterExtremeNegative;
      f[2][i] = z < thr && pz >= thr;
      f[3][i] = z > -thr && pz <= -thr;
      f[4][i] = z > 0 && pz <= 0;
      f[5][i] = z < 0 && pz >= 0;
      f[6][i] = enterExtremePositive || enterExtremeNegative;
      for (let k = 0; k < 7; k++) if (f[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3, plot4, plot5, plot6, plot7] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5, plot6, plot7 },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Z-Score Fill' },
            gradient: {
              topValue: s.topValue.slice(),
              bottomValue: s.bottomValue.slice(),
              topColor: s.topColor.slice(),
              bottomColor: s.bottomColor.slice(),
            } },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedPriceZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeWeightedPriceZScoreInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Extreme Overbought', message: 'VWPZ: Extreme OVERBOUGHT condition detected! {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Extreme Oversold', message: 'VWPZ: Extreme OVERSOLD condition detected! {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Exit Extreme Overbought', message: 'VWPZ: Exiting extreme overbought zone {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'Exit Extreme Oversold', message: 'VWPZ: Exiting extreme oversold zone {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert4', title: 'Bullish Mean Reversion', message: 'VWPZ: Crossed above zero - Bullish momentum {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert5', title: 'Bearish Mean Reversion', message: 'VWPZ: Crossed below zero - Bearish momentum {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert6', title: 'Any Extreme Level', message: 'VWPZ: Extreme deviation detected! Check chart {{exchange}}:{{ticker}} - {{interval}}' },
];

export const VolumeWeightedPriceZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
