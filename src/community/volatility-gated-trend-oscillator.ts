/**
 * Volatility-Gated Trend Oscillator
 *
 * raw = source - MA(source, length) (SMA, EMA, WMA, HMA or RMA); the noise floor is SMA(|raw|, length) * threshold.
 * When raw is above the noise floor the trend is up and the locked value is raw; below -noise floor the trend is
 * down and the locked value is raw; otherwise the locked value decays by 0.9 per bar. The oscillator is
 * WMA(locked / ATR(length), 5), coloured by the trend, with four fills of decreasing opacity between the oscillator,
 * its 80 %, 55 % and 30 % layers and zero. Optional trend bar colours. Presets override the length, the MA type and
 * the threshold; colour presets override the trend colours.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Signal' / 'Bearish Trend Signal' on the bar the trend
 * state turns to 1 / -1, 'Trend Direction Changed' on either.
 *
 * Reference: "Volatility-Gated Trend Oscillator [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityGatedTrendOscillatorInputs {
  /** Price source */
  src: SourceType;
  /** Filter strength: length of the baseline MA, of the noise floor SMA and of the ATR */
  sensitivity: number;
  /** Baseline MA type */
  maType: 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RMA';
  /** Noise threshold (multiple of the average absolute deviation) */
  noiseMult: number;
  /** Preset: 'Fast Response' (EMA, 12, 1.1) and 'Smooth Trend' (HMA, 34, 2.0) override the three settings above */
  presetConfig: 'Default' | 'Fast Response' | 'Smooth Trend';
  /** Colour preset ('Custom' uses the two colours below) */
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';
  bullColor: string;
  bearColor: string;
  /** Colour the price bars by the trend */
  enableBarcolor: boolean;
}

export const defaultInputs: VolatilityGatedTrendOscillatorInputs = {
  src: 'hlc3',
  sensitivity: 20,
  maType: 'SMA',
  noiseMult: 1.5,
  presetConfig: 'Default',
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  enableBarcolor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'sensitivity', type: 'int', title: 'Filter Strength', defval: 20 },
  { id: 'maType', type: 'string', title: 'Baseline MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'RMA'] },
  { id: 'noiseMult', type: 'float', title: 'Noise Threshold', defval: 1.5, step: 0.1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'enableBarcolor', type: 'bool', title: 'Enable Bar Coloring', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Main', color: '#00ffaa', lineWidth: 2 },
  { id: 'plot1', title: 'Inner Layer', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Mid Layer', color: 'transparent', lineWidth: 1 },
  { id: 'plot3', title: 'Outer Layer', color: 'transparent', lineWidth: 1 },
  { id: 'plot4', title: 'Zero', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility-Gated Trend Oscillator [QuantAlgo]',
  shortTitle: 'Volatility-Gated Trend Oscillator [QuantAlgo]',
  overlay: false,
};

const COLOR_PRESETS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface VgtoVars {
  /** var int trend_state = 0 / var float locked_val = 0.0 */
  trendState: number;
  locked: number;
}

interface VgtoRun extends BarRunState<VgtoVars> {
  baseline: Ma;
  noise: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  wma: ReturnType<typeof taStep.wma>;
  trend: number[];
  plots: Point[][];
  fillCols: string[][];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolatilityGatedTrendOscillatorInputs>): BarStudy<VgtoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { sensitivity, maType, noiseMult } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    sensitivity = 12;
    maType = 'EMA';
    noiseMult = 1.1;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    sensitivity = 34;
    maType = 'HMA';
    noiseMult = 2.0;
  }
  const [bullCol, bearCol] = COLOR_PRESETS[cfg.colorPreset] ?? [cfg.bullColor, cfg.bearColor];
  const value = barSource(cfg.src);
  // sig_color = trend_state == 1 ? bull : trend_state == -1 ? bear : color.gray, and its shades of transparency
  // 0 / 100 (hidden) / 55 / 72 / 84 / 93 (fills) / 20 (bar colour)
  const shades = [bullCol, bearCol, color.gray].map((c) => [0, 100, 55, 72, 84, 93, 20].map((t) => String(color.new(c, t))));
  const maStep = (): Ma => {
    switch (maType) {
      case 'EMA': return taStep.ema(sensitivity);
      case 'RMA': return taStep.rma(sensitivity);
      case 'HMA': return taStep.hma(sensitivity);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, sensitivity), commit: () => m.commit() }; }
      default: return new WindowSma(sensitivity);
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: VgtoRun = {
        baseline: maStep(), noise: new WindowSma(sensitivity), atr: taStep.atr(sensitivity), wma: taStep.wma(), trend: [],
        plots: [[], [], [], [], []], fillCols: [[], [], [], []], barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { trendState: 0, locked: 0.0 }, lists: [], series: [],
      };
      s.steps = [s.baseline, s.noise, s.atr, s.wma];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.trend, ...s.plots, ...s.fillCols, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const src = value(b);
      const rawDiff = src - s.baseline.step(src);
      const noiseFloor = s.noise.step(Math.abs(rawDiff)) * noiseMult;
      const atr = s.atr.step(b.high, b.low, b.close);
      if (gt(rawDiff, noiseFloor)) {
        v.trendState = 1;
        v.locked = rawDiff;
      } else if (lt(rawDiff, -noiseFloor)) {
        v.trendState = -1;
        v.locked = rawDiff;
      } else {
        v.locked = v.locked * 0.9;
      }
      const trend = v.trendState;
      s.trend[i] = trend;
      // locked_val / ta.atr(...): a plain division (x / 0 is +-infinity, which ta.wma skips like na)
      const nv = v.locked / atr;
      const f = s.wma.step(Number.isFinite(nv) ? nv : NaN, 5);

      const k = trend === 1 ? 0 : trend === -1 ? 1 : 2;
      const hidden = shades[k][1];
      const p = s.plots;
      p[0][i] = { time: t, value: f, color: shades[k][0] };
      p[1][i] = { time: t, value: f * 0.8, color: hidden };
      p[2][i] = { time: t, value: f * 0.55, color: hidden };
      p[3][i] = { time: t, value: f * 0.3, color: hidden };
      p[4][i] = { time: t, value: 0, color: hidden };
      s.fillCols[0][i] = shades[k][2];
      s.fillCols[1][i] = shades[k][3];
      s.fillCols[2][i] = shades[k][4];
      s.fillCols[3][i] = shades[k][5];
      // barcolor(enable_barcolor ? (trend_state != 0 ? color.new(sig_color, 20) : na) : na)
      if (cfg.enableBarcolor && trend !== 0) s.barColors.push({ time: t, color: shades[k][6] });

      // trend_turned_bullish = trend_state == 1 and trend_state[1] != 1 (bearish: -1); trend_changed = either
      const turnedBull = trend === 1 && i > 0 && s.trend[i - 1] !== 1;
      const turnedBear = trend === -1 && i > 0 && s.trend[i - 1] !== -1;
      const flags = s.flags;
      flags[0][i] = turnedBull;
      flags[1][i] = turnedBear;
      flags[2][i] = turnedBull || turnedBear;
      for (let k = 0; k < 3; k++) if (flags[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const fc = s.fillCols;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new(color.white, 75)), linestyle: 'solid', linewidth: 1 } }],
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Luminance Layer 1' }, colors: fc[0].slice() },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Luminance Layer 2' }, colors: fc[1].slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Luminance Layer 3' }, colors: fc[2].slice() },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Luminance Layer 4' }, colors: fc[3].slice() },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityGatedTrendOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolatilityGatedTrendOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Volatility-Gated Trend Oscillator: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Volatility-Gated Trend Oscillator: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Trend Direction Changed', message: 'Volatility-Gated Trend Oscillator: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const VolatilityGatedTrendOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
