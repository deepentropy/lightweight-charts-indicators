/**
 * Volume Weighted Trend [QuantAlgo]
 *
 * VWMA of the close with bands at ATR(length) * multiplier. The trend turns up when close is above the upper band and
 * down when it is below the lower band. The VWMA (with a glow), the bands, their mid lines, four ribbons and the bars
 * take the trend colour.
 *
 * Alerts (alertcondition, `alerts` of the result): the trend turning up, turning down, and either.
 *
 * Reference: "Volume Weighted Trend [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

const PRESETS = ['Default', 'Fast Response', 'Smooth Trend'];
const COLOR_PRESETS = ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'];
const COLOR_PAIRS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

export interface VolumeWeightedTrendInputs {
  vwmaLength: number;
  atrMultiplier: number;
  /** Default uses vwmaLength / atrMultiplier; Fast Response 21 / 1.2; Smooth Trend 55 / 2.0 */
  presetConfig: string;
  /** Colour preset; Custom uses bullishColor / bearishColor */
  colorPreset: string;
  bullishColor: string;
  bearishColor: string;
  enableGlow: boolean;
  enableRibbons: boolean;
  /** Transparency of the band lines (0..100) */
  bandTransparency: number;
  enableBarcolor: boolean;
}

export const defaultInputs: VolumeWeightedTrendInputs = {
  vwmaLength: 34,
  atrMultiplier: 1.5,
  presetConfig: 'Default',
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  enableGlow: true,
  enableRibbons: true,
  bandTransparency: 90,
  enableBarcolor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'vwmaLength', type: 'int', title: 'VWMA Length', defval: 34, min: 5 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 1.5, min: 0.5, step: 0.1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: PRESETS },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: COLOR_PRESETS },
  { id: 'bullishColor', type: 'color', title: 'Bullish Trend Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Trend Color', defval: '#ff0000' },
  { id: 'enableGlow', type: 'bool', title: 'Enable Neon Glow Effect', defval: true },
  { id: 'enableRibbons', type: 'bool', title: 'Enable Volatility Ribbons', defval: true },
  { id: 'bandTransparency', type: 'int', title: 'Band Transparency', defval: 90, min: 0, max: 100 },
  { id: 'enableBarcolor', type: 'bool', title: 'Enable Bar Coloring', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA Glow Outer', color: '#00ffaa', lineWidth: 8 },
  { id: 'plot1', title: 'VWMA Glow Inner', color: '#00ffaa', lineWidth: 4 },
  { id: 'plot2', title: 'VWMA Line', color: '#00ffaa', lineWidth: 2 },
  { id: 'plot3', title: 'Upper Band', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot4', title: 'Upper Mid', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot5', title: 'Lower Band', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot6', title: 'Lower Mid', color: '#00ffaa', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Weighted Trend [QuantAlgo]',
  shortTitle: 'Volume Weighted Trend',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface TrendVars {
  /** var int trend_direction = 0 */
  dir: number;
}

interface TrendRun extends BarRunState<TrendVars> {
  num: WindowSum;
  den: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  plots: Point[][];
  ribbons: string[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeWeightedTrendInputs>): BarStudy<TrendRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { vwmaLength, atrMultiplier } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    vwmaLength = 21;
    atrMultiplier = 1.2;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    vwmaLength = 55;
    atrMultiplier = 2.0;
  }
  const [bullish, bearish] = COLOR_PAIRS[cfg.colorPreset] ?? [cfg.bullishColor, cfg.bearishColor];
  const len = Math.floor(vwmaLength);
  const c = (col: string, transp: number) => String(color.new(col, transp));
  return {
    init() {
      const s: TrendRun = {
        num: new WindowSum(vwmaLength), den: new WindowSum(vwmaLength), atr: taStep.atr(vwmaLength),
        plots: Array.from({ length: 7 }, () => []), ribbons: [[], [], [], []], barColors: [],
        flags: [[], [], []], times: [[], [], []], steps: [], vars: { dir: 0 }, lists: [], series: [],
      };
      s.steps = [s.num, s.den, s.atr];
      s.lists = [s.barColors, ...s.times];
      s.series = [...s.plots, ...s.ribbons, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      // ta.vwma(close, vwma_length): ta.sma(close * volume) / ta.sma(volume), na when the volume average is 0
      const num = s.num.step(b.close * volume) / len;
      const den = s.den.step(volume) / len;
      const vwma = den === 0 || Number.isNaN(den) ? NaN : num / den;
      const atr = s.atr.step(b.high, b.low, b.close);
      const upper = vwma + atr * atrMultiplier;
      const lower = vwma - atr * atrMultiplier;

      const prevDir = v.dir; // trend_direction[1] (na on the first bar: no turn there)
      if (b.close > upper) v.dir = 1;
      else if (b.close < lower) v.dir = -1;
      const dir = v.dir;
      // trend_turned_bullish = trend_direction == 1 and trend_direction[1] != 1 (bearish: the mirror)
      const up = i > 0 && dir === 1 && prevDir !== 1;
      const down = i > 0 && dir === -1 && prevDir !== -1;
      const flags = [up, down, up || down];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
      const trend = dir === 1 ? bullish : bearish;
      const upperMid = (upper + vwma) / 2;
      const lowerMid = (lower + vwma) / 2;
      const p = s.plots;
      p[0][i] = { time: t, value: cfg.enableGlow ? vwma : NaN, color: c(trend, 80) };
      p[1][i] = { time: t, value: cfg.enableGlow ? vwma : NaN, color: c(trend, 50) };
      p[2][i] = { time: t, value: vwma, color: c(trend, 0) };
      p[3][i] = { time: t, value: upper, color: c(trend, cfg.bandTransparency) };
      p[4][i] = { time: t, value: upperMid, color: c(trend, 95) };
      p[5][i] = { time: t, value: lower, color: c(trend, cfg.bandTransparency) };
      p[6][i] = { time: t, value: lowerMid, color: c(trend, 95) };
      // fills: outer ribbons transparency 85, inner ribbons 70; na colour when the ribbons are off
      const outer = cfg.enableRibbons ? c(trend, 85) : 'transparent';
      const inner = cfg.enableRibbons ? c(trend, 70) : 'transparent';
      s.ribbons[0][i] = outer;
      s.ribbons[1][i] = inner;
      s.ribbons[2][i] = outer;
      s.ribbons[3][i] = inner;
      // barcolor(enable_barcolor ? color.new(trend_direction == 1 ? bullish : bearish, 20) : na)
      if (cfg.enableBarcolor) s.barColors.push({ time: t, color: c(dir === 1 ? bullish : bearish, 20) });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        fills: [
          { plot1: 'plot3', plot2: 'plot4', colors: s.ribbons[0].slice() },
          { plot1: 'plot4', plot2: 'plot2', colors: s.ribbons[1].slice() },
          { plot1: 'plot5', plot2: 'plot6', colors: s.ribbons[2].slice() },
          { plot1: 'plot6', plot2: 'plot2', colors: s.ribbons[3].slice() },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Volume Weighted Trend: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Volume Weighted Trend: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Trend Direction Changed', message: 'Volume Weighted Trend: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const VolumeWeightedTrend = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
