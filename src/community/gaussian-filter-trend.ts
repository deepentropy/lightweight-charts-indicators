/**
 * Gaussian Filter Trend
 *
 * The source passes through a Gaussian filter of 1 to 4 cascaded one-pole EMA stages (alpha from the length and
 * the pole count). An ATR deadband around the filter output (width = ATR * multiplier; with Adaptive Width the
 * multiplier moves from the chop multiplier to the trend multiplier with the EMA-smoothed efficiency ratio of the
 * source) moves a trend line: the line only steps when a band crosses it. The trend is up after a step up and down
 * after a step down. The line takes the trend colour, four "star" circle plots orbit around it (sine / cosine of
 * bar_index * 0.52 times the 14-bar SMA of the bar range), with optional bar and background colours. The presets
 * replace the filter and width inputs, the colour presets replace the bullish / bearish colours, as in Pine.
 * Alerts (alertcondition, `alerts` of the result): the trend turning bullish, turning bearish, and either.
 *
 * Reference: "Gaussian Filter Trend [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowSum,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export type GaussianFilterTrendPreset = 'Default' | 'Fast Response' | 'Smooth Trend';
export type GaussianFilterTrendColorPreset = 'Custom' | 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon';

export interface GaussianFilterTrendInputs {
  /** Preset configuration; other than Default it replaces every Gaussian Filter and Trend Width input */
  preset: GaussianFilterTrendPreset;
  /** Price source of the Gaussian filter and of the efficiency ratio */
  gaussianSource: SourceType;
  /** Gaussian filter length */
  gaussianLength: number;
  /** Number of cascaded one-pole stages (1..4) */
  gaussianPoles: number;
  atrLength: number;
  /** ATR multiplier when Adaptive Width is off */
  fixedMultiplier: number;
  /** Efficiency ratio scaling of the ATR multiplier */
  adaptiveWidth: boolean;
  efficiencyLength: number;
  /** ATR multiplier at efficiency 1 (Adaptive Width) */
  trendMultiplier: number;
  /** ATR multiplier at efficiency 0 (Adaptive Width) */
  chopMultiplier: number;
  /** EMA length of the efficiency ratio */
  efficiencySmooth: number;
  /** Colour preset; Custom uses bullishColor / bearishColor */
  colorPreset: GaussianFilterTrendColorPreset;
  bullishColor: string;
  bearishColor: string;
  /** Colour before the first trend step */
  neutralColor: string;
  lineWidth: number;
  showTrend: boolean;
  showStars: boolean;
  /** Colour the bars with the trend colour */
  showCandles: boolean;
  barTransparency: number;
  /** Colour the background with the trend colour */
  showBg: boolean;
  bgTransparency: number;
}

export const defaultInputs: GaussianFilterTrendInputs = {
  preset: 'Default',
  gaussianSource: 'close',
  gaussianLength: 14,
  gaussianPoles: 4,
  atrLength: 14,
  fixedMultiplier: 1.5,
  adaptiveWidth: true,
  efficiencyLength: 10,
  trendMultiplier: 0.8,
  chopMultiplier: 2.5,
  efficiencySmooth: 5,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  neutralColor: color.gray,
  lineWidth: 4,
  showTrend: true,
  showStars: true,
  showCandles: false,
  barTransparency: 0,
  showBg: false,
  bgTransparency: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'gaussianSource', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'gaussianLength', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'gaussianPoles', type: 'int', title: 'Poles', defval: 4, min: 1, max: 4 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'fixedMultiplier', type: 'float', title: 'Fixed Width Multiplier', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'adaptiveWidth', type: 'bool', title: 'Adaptive Width', defval: true },
  { id: 'efficiencyLength', type: 'int', title: 'Efficiency Length', defval: 10, min: 2 },
  { id: 'trendMultiplier', type: 'float', title: 'Adaptive Trend Multiplier', defval: 0.8, min: 0.1, step: 0.1 },
  { id: 'chopMultiplier', type: 'float', title: 'Adaptive Chop Multiplier', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'efficiencySmooth', type: 'int', title: 'Efficiency Smoothing', defval: 5, min: 1 },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Custom', 'Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: color.gray },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 4, min: 1, max: 8 },
  { id: 'showTrend', type: 'bool', title: 'Show Trend Line', defval: true },
  { id: 'showStars', type: 'bool', title: 'Show Stars', defval: true },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Coloring', defval: false },
  { id: 'barTransparency', type: 'int', title: 'Bar Color Transparency', defval: 0, min: 0, max: 100 },
  { id: 'showBg', type: 'bool', title: 'Enable Background Coloring', defval: false },
  { id: 'bgTransparency', type: 'int', title: 'Background Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Gaussian Filter Trend', color: '#00ffaa', lineWidth: 4 },
  { id: 'plot1', title: 'Inner Star A', color: '#00ffaa', lineWidth: 2, style: 'circles', display: 'pane' },
  { id: 'plot2', title: 'Inner Star B', color: '#00ffaa', lineWidth: 2, style: 'circles', display: 'pane' },
  { id: 'plot3', title: 'Outer Star A', color: '#00ffaa', lineWidth: 1, style: 'circles', display: 'pane' },
  { id: 'plot4', title: 'Outer Star B', color: '#00ffaa', lineWidth: 1, style: 'circles', display: 'pane' },
];

export const metadata = {
  title: 'Gaussian Filter Trend [QuantAlgo]',
  shortTitle: 'Gaussian Filter Trend [QuantAlgo]',
  overlay: true,
};

const COLOR_PRESETS: Record<Exclude<GaussianFilterTrendColorPreset, 'Custom'>, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

/** Pine float comparison a > b: true only when a - b > 1e-10; na operands give false */
const gt = (a: number, b: number): boolean => a - b > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface GaussianVars {
  stage1: number;
  stage2: number;
  stage3: number;
  stage4: number;
  /** trend direction (0 before the first step) */
  dir: number;
}

interface GaussianRun extends BarRunState<GaussianVars> {
  pathSum: WindowSum;
  effEma: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  span: WindowSma;
  src: number[];
  trendLine: number[];
  trendDir: number[];
  plots: Point[][];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<GaussianFilterTrendInputs>): BarStudy<GaussianRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { gaussianLength, gaussianPoles, atrLength, fixedMultiplier, efficiencyLength, trendMultiplier, chopMultiplier,
    efficiencySmooth } = cfg;
  if (cfg.preset === 'Fast Response') {
    gaussianLength = 8;
    gaussianPoles = 2;
    atrLength = 10;
    fixedMultiplier = 1.2;
    efficiencyLength = 7;
    trendMultiplier = 0.6;
    chopMultiplier = 1.8;
    efficiencySmooth = 3;
  } else if (cfg.preset === 'Smooth Trend') {
    gaussianLength = 21;
    gaussianPoles = 4;
    atrLength = 21;
    fixedMultiplier = 2.0;
    efficiencyLength = 18;
    trendMultiplier = 1.0;
    chopMultiplier = 3.2;
    efficiencySmooth = 8;
  }
  const [bullishColor, bearishColor] = cfg.colorPreset === 'Custom'
    ? [cfg.bullishColor, cfg.bearishColor] : COLOR_PRESETS[cfg.colorPreset];
  const nz = (v: number, r: number) => (isNaN(v) ? r : v);
  const value = barSource(cfg.gaussianSource);
  // gaussianFilter(src, length, poleCount): 4 cascaded one-pole stages, each seeded with src (nz(stageK, src))
  const beta = (1 - Math.cos((2 * Math.PI) / gaussianLength)) / (Math.pow(1.414, 2.0 / gaussianPoles) - 1);
  const alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
  return {
    fullRunReason: () => (isBarSource(cfg.gaussianSource) ? null : 'source of another study'),
    init() {
      const s: GaussianRun = {
        pathSum: new WindowSum(efficiencyLength), effEma: taStep.ema(efficiencySmooth), atr: taStep.atr(atrLength),
        span: new WindowSma(14), src: [], trendLine: [], trendDir: [], plots: Array.from({ length: 5 }, () => []),
        barColors: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { stage1: NaN, stage2: NaN, stage3: NaN, stage4: NaN, dir: 0 }, lists: [], series: [],
      };
      s.steps = [s.pathSum, s.effEma, s.atr, s.span];
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [s.src, s.trendLine, s.trendDir, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const sv = value(b);
      s.src[i] = sv;
      v.stage1 = alpha * sv + (1 - alpha) * nz(v.stage1, sv);
      v.stage2 = alpha * v.stage1 + (1 - alpha) * nz(v.stage2, sv);
      v.stage3 = alpha * v.stage2 + (1 - alpha) * nz(v.stage3, sv);
      v.stage4 = alpha * v.stage3 + (1 - alpha) * nz(v.stage4, sv);
      const filtered = gaussianPoles <= 1 ? v.stage1 : gaussianPoles === 2 ? v.stage2 : gaussianPoles === 3 ? v.stage3 : v.stage4;

      // efficiency_ratio = path_length == 0 ? 0 : |src - src[efficiency_length]| / math.sum(|ta.change(src)|, efficiency_length)
      const absChange = i > 0 ? Math.abs(sv - s.src[i - 1]) : NaN;
      const pathLength = s.pathSum.step(absChange);
      const netMove = i >= efficiencyLength ? Math.abs(sv - s.src[i - efficiencyLength]) : NaN;
      const efficiencyRatio = pathLength === 0 ? 0.0 : netMove / pathLength;
      const smoothedEfficiency = s.effEma.step(efficiencyRatio);
      const atr = s.atr.step(b.high, b.low, b.close);

      const widthMultiplier = cfg.adaptiveWidth
        ? chopMultiplier + (trendMultiplier - chopMultiplier) * smoothedEfficiency : fixedMultiplier;
      const trendWidth = atr * widthMultiplier;
      const upper = filtered + trendWidth;
      const lower = filtered - trendWidth;
      // var float trend_line = filtered_price; trend_line := nz(trend_line[1], filtered_price)
      let tl = i > 0 ? nz(s.trendLine[i - 1], filtered) : filtered;
      if (gt(tl, upper)) tl = upper; // upper_band < trend_line
      if (gt(lower, tl)) tl = lower; // lower_band > trend_line
      s.trendLine[i] = tl;
      const prev = i > 0 ? s.trendLine[i - 1] : NaN;
      if (gt(tl, prev)) v.dir = 1; // stepped_up
      else if (gt(prev, tl)) v.dir = -1; // stepped_down
      const dir = v.dir;
      s.trendDir[i] = dir;
      const c = dir === 1 ? bullishColor : dir === -1 ? bearishColor : cfg.neutralColor;

      // visual_span = ta.sma(high - low, 14); theta = bar_index * 0.52
      const visualSpan = s.span.step(b.high - b.low);
      const t = b.time;
      const theta = i * 0.52;
      const innerOrbit = visualSpan * 0.85;
      const outerOrbit = visualSpan * 1.75;
      const inner = String(color.new(c, 30));
      const outer = String(color.new(c, 70));
      const p = s.plots;
      p[0][i] = { time: t, value: cfg.showTrend ? tl : NaN, color: c };
      p[1][i] = { time: t, value: cfg.showStars ? tl + Math.sin(theta) * innerOrbit : NaN, color: inner };
      p[2][i] = { time: t, value: cfg.showStars ? tl + Math.sin(theta + Math.PI) * innerOrbit : NaN, color: inner };
      p[3][i] = { time: t, value: cfg.showStars ? tl + Math.cos(theta * 0.71 + 1.1) * outerOrbit : NaN, color: outer };
      p[4][i] = { time: t, value: cfg.showStars ? tl + Math.cos(theta * 0.71 + 1.1 + Math.PI) * outerOrbit : NaN, color: outer };
      // barcolor(show_candles and trend_dir != 0 ? color.new(trend_color, bar_trans) : na)
      if (cfg.showCandles && dir !== 0) s.barColors.push({ time: t, color: String(color.new(c, cfg.barTransparency)) });
      // bgcolor(show_bg and trend_dir != 0 ? color.new(trend_color, bg_trans) : na)
      if (cfg.showBg && dir !== 0) s.bgColors.push({ time: t, color: String(color.new(c, cfg.bgTransparency)) });

      // turned_bull = trend_dir == 1 and trend_dir[1] != 1 (na != 1 is false on the first bar), turned_bear the mirror
      const turnedBull = dir === 1 && i > 0 && s.trendDir[i - 1] !== 1;
      const turnedBear = dir === -1 && i > 0 && s.trendDir[i - 1] !== -1;
      const flags = [turnedBull, turnedBear, turnedBull || turnedBear];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        markers: [],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GaussianFilterTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GaussianFilterTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'Bullish Trend Signal',
    message: 'Gaussian Filter Trend: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}',
  },
  {
    id: 'alert1',
    title: 'Bearish Trend Signal',
    message: 'Gaussian Filter Trend: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}',
  },
  {
    id: 'alert2',
    title: 'Any Trend Change',
    message: 'Gaussian Filter Trend: Trend state changed on {{exchange}}:{{ticker}} - {{interval}}',
  },
];

export const GaussianFilterTrend = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
