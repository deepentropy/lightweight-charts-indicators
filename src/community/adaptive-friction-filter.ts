/**
 * Adaptive Friction Filter (AFF)
 *
 * The friction is the SMA of the absolute bar-to-bar change of the source over the friction window, times the
 * friction coefficient. The filter line starts at the source and stays flat while |source - line| is not above the
 * friction; above it, the line moves by catch-up sensitivity * (source - line). The trend is up when the line rises,
 * down when it falls, else unchanged. The line colour goes from the trend colour at transparency 50 to the full
 * trend colour with the slope relative to the highest slope of the last 100 bars (optional neutral colour on flat
 * bars). Bars and the background can take the line colour.
 * Alerts (alertcondition, `alerts` of the result): the trend turns from down to up, from up to down, or either.
 *
 * Reference: "Adaptive Friction Filter (AFF) [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveFrictionFilterInputs {
  /** Preset: 'Default' uses the three inputs below; the others replace them */
  preset: 'Default' | 'Fast Response' | 'Smooth Trend';
  /** Price source */
  src: SourceType;
  /** Friction coefficient (multiplier of the average absolute change) */
  frictionMult: number;
  /** Catch-up sensitivity (part of the gap closed per bar) */
  catchupScalar: number;
  /** Friction window (SMA length) */
  lookback: number;
  /** Colour preset; 'Custom' uses the colour inputs */
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';
  bullishColor: string;
  bearishColor: string;
  /** Flat filter bars take the neutral colour */
  enableNeutral: boolean;
  neutralColor: string;
  /** Bar colouring */
  showCandles: boolean;
  barTransparency: number;
  /** Background colouring */
  showBgcolor: boolean;
  bgTransparency: number;
}

export const defaultInputs: AdaptiveFrictionFilterInputs = {
  preset: 'Default',
  src: 'close',
  frictionMult: 1.5,
  catchupScalar: 0.5,
  lookback: 20,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  enableNeutral: false,
  neutralColor: '#787b86',
  showCandles: true,
  barTransparency: 50,
  showBgcolor: false,
  bgTransparency: 90,
};

const FILTER = 'AFF Settings';
const VISUAL = 'Visual Settings';

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'], group: FILTER },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close', group: FILTER },
  { id: 'frictionMult', type: 'float', title: 'Friction Coefficient', defval: 1.5, min: 0.1, step: 0.05, group: FILTER },
  { id: 'catchupScalar', type: 'float', title: 'Catch-Up Sensitivity', defval: 0.5, min: 0.1, max: 1.0, step: 0.05, group: FILTER },
  { id: 'lookback', type: 'int', title: 'Friction Window', defval: 20, min: 1, group: FILTER },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'], group: VISUAL },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa', group: VISUAL },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000', group: VISUAL },
  { id: 'enableNeutral', type: 'bool', title: 'Enable Neutral State', defval: false, group: VISUAL },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: '#787b86', group: VISUAL },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Colouring', defval: true, group: VISUAL },
  { id: 'barTransparency', type: 'int', title: 'Bar Colour Transparency', defval: 50, min: 0, max: 100, group: VISUAL },
  { id: 'showBgcolor', type: 'bool', title: 'Enable Background Colouring', defval: false, group: VISUAL },
  { id: 'bgTransparency', type: 'int', title: 'Background Colour Transparency', defval: 90, min: 0, max: 100, group: VISUAL },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AFF Step', color: String(color.new('#00ffaa', 20)), lineWidth: 4, style: 'stepline' },
  { id: 'plot1', title: 'AFF Dots', color: '#00ffaa', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Adaptive Friction Filter (AFF) [QuantAlgo]',
  shortTitle: 'Adaptive Friction Filter (AFF) [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

const PRESET_COLORS: Record<string, [string, string, string]> = {
  Classic: ['#00ff00', '#ff0000', '#808080'],
  Aqua: ['#00d4ff', '#ff8c00', '#78909c'],
  Cosmic: ['#49ffce', '#9932cc', '#8e8e9e'],
  Cyber: ['#00cccc', '#ff6600', '#8a8a8a'],
  Neon: ['#ffff00', '#ff00ff', '#aaaaaa'],
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface AffVars {
  /** var float aff_line = na */
  line: number;
  /** var int trend_dir = 0 */
  dir: number;
}

interface AffRun extends BarRunState<AffVars> {
  sma: ReturnType<typeof taStep.sma>;
  highest: ReturnType<typeof taStep.highest>;
  srcArr: number[];
  aff: number[];
  trendDir: number[];
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveFrictionFilterInputs>): BarStudy<AffRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  let { frictionMult, catchupScalar, lookback } = cfg;
  if (cfg.preset === 'Fast Response') {
    frictionMult = 1.0;
    catchupScalar = 0.7;
    lookback = 14;
  } else if (cfg.preset === 'Smooth Trend') {
    frictionMult = 2.2;
    catchupScalar = 0.35;
    lookback = 30;
  }
  const [bullishColor, bearishColor, neutralColor] = PRESET_COLORS[cfg.colorPreset]
    ?? [cfg.bullishColor, cfg.bearishColor, cfg.neutralColor];
  const bullDim = String(color.new(bullishColor, 50));
  const bearDim = String(color.new(bearishColor, 50));

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const sma = taStep.sma();
      const highest = taStep.highest();
      const s: AffRun = {
        sma, highest, srcArr: [], aff: [], trendDir: [], plot0: [], plot1: [], barColors: [], bgColors: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [sma, highest], vars: { line: NaN, dir: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [s.srcArr, s.aff, s.trendDir, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const v = s.vars;
      const src = value(bars[i]);
      s.srcArr[i] = src;
      // friction = ta.sma(math.abs(src - src[1]), lookback) * friction_mult
      const absChange = i > 0 ? Math.abs(src - s.srcArr[i - 1]) : NaN;
      const friction = s.sma.step(absChange, lookback) * frictionMult;

      if (isNaN(v.line)) {
        v.line = src;
      } else {
        const force = src - v.line;
        v.line = gt(Math.abs(force), friction) ? v.line + force * catchupScalar : v.line;
      }
      const line = v.line;
      s.aff[i] = line;
      const prev = i > 0 ? s.aff[i - 1] : NaN;
      v.dir = gt(line, prev) ? 1 : lt(line, prev) ? -1 : v.dir;
      const dir = v.dir;
      s.trendDir[i] = dir;

      // slope_norm = ta.highest(slope, 100); intensity = math.min(slope / math.max(slope_norm, 0.0001), 1.0)
      const slope = i > 0 ? Math.abs(line - prev) : NaN;
      const slopeNorm = s.highest.step(slope, 100);
      // turned_bullish = trend_dir == 1 and trend_dir[1] == -1; turned_bearish = trend_dir == -1 and trend_dir[1] == 1
      const turnedBull = dir === 1 && i > 0 && s.trendDir[i - 1] === -1;
      const turnedBear = dir === -1 && i > 0 && s.trendDir[i - 1] === 1;

      const isNeutral = cfg.enableNeutral && i > 0 && eq(line, prev);
      // math.max / math.min with na give na; color.from_gradient(na, ...) is na
      const intensity = Math.min(slope / Math.max(slopeNorm, 0.0001), 1.0);
      const grad = (dim: string, full: string) => (isNaN(intensity) || isNaN(slopeNorm) || isNaN(slope)
        ? null : String(color.from_gradient(intensity, 0, 1, dim, full)));
      const lineCol: string | null = isNeutral ? neutralColor
        : dir === 1 ? grad(bullDim, bullishColor) : grad(bearDim, bearishColor);
      // color.new(na, t) is black with transparency t
      const withT = (tr: number) => String(color.new(lineCol ?? (null as unknown as string), tr));
      s.plot0[i] = { time: t, value: line, color: withT(20) };
      s.plot1[i] = { time: t, value: line, color: lineCol ?? 'transparent' };
      if (cfg.showCandles) s.barColors.push({ time: t, color: withT(cfg.barTransparency) });
      if (cfg.showBgcolor) s.bgColors.push({ time: t, color: withT(cfg.bgTransparency) });

      // alertcondition(turned_bullish / turned_bearish / trend_changed, ...)
      const any = turnedBull || turnedBear;
      s.flags[0][i] = turnedBull;
      s.flags[1][i] = turnedBear;
      s.flags[2][i] = any;
      if (turnedBull) s.times[0].push(t as number);
      if (turnedBear) s.times[1].push(t as number);
      if (any) s.times[2].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveFrictionFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveFrictionFilterInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Adaptive Friction Filter: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Adaptive Friction Filter: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Trend Change', message: 'Adaptive Friction Filter: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const AdaptiveFrictionFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
