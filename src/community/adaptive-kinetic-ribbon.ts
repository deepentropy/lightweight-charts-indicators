/**
 * Adaptive Kinetic Ribbon
 *
 * A kinetic line follows the source with an adaptive factor alpha = |velocity| / (|velocity| + volatility), where
 * velocity = source - source[length] and volatility = stdev(source - source[1], length) * sensitivity; the line
 * restarts at the source after a bar where it is na. A fast and a slow moving average of the kinetic line form a
 * ribbon. Its colour shows the trend (fast above slow) and the acceleration (fast rising): bullish / bearish
 * acceleration or deceleration. The ribbon fill and the price bars use the same colour. Presets replace the
 * calculation inputs.
 * Alerts (alertcondition, `alerts` of the result): ribbon crosses (bullish, bearish, any) and the first bar of each
 * acceleration / deceleration state (and of any acceleration, any deceleration).
 *
 * Reference: "Adaptive Kinetic Ribbon [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev, WindowVwma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export type KineticMaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'VWMA' | 'RMA';

export interface AdaptiveKineticRibbonInputs {
  src: SourceType;
  /** Lookback of the velocity and the volatility */
  length: number;
  /** Volatility sensitivity */
  mult: number;
  /** Ribbon moving average type */
  maType: KineticMaType;
  ribbonFastLength: number;
  ribbonSlowLength: number;
  /** 'Default' keeps the inputs above; the other presets replace them */
  presetConfig: 'Default' | 'Fast Response' | 'Smooth Trend';
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';
  bullAccel: string;
  bullDecel: string;
  bearAccel: string;
  bearDecel: string;
  cloudTransparency: number;
  enableBarColoring: boolean;
  barTransparency: number;
}

export const defaultInputs: AdaptiveKineticRibbonInputs = {
  src: 'close',
  length: 20,
  mult: 1.5,
  maType: 'EMA',
  ribbonFastLength: 3,
  ribbonSlowLength: 8,
  presetConfig: 'Default',
  colorPreset: 'Custom',
  bullAccel: '#00ffaa',
  bullDecel: '#006400',
  bearAccel: '#ff0000',
  bearDecel: '#8b0000',
  cloudTransparency: 30,
  enableBarColoring: true,
  barTransparency: 30,
};

const CALC = '════════ Calculation Parameters ════════';
const VISUAL = '════════ Visualization Settings ════════';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close', group: CALC },
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 20, min: 5, group: CALC },
  { id: 'mult', type: 'float', title: 'Volatility Sensitivity', defval: 1.5, min: 0.1, step: 0.1, group: CALC },
  { id: 'maType', type: 'string', title: 'Ribbon MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'VWMA', 'RMA'], group: CALC },
  { id: 'ribbonFastLength', type: 'int', title: 'Fast Ribbon Period', defval: 3, min: 1, group: CALC },
  { id: 'ribbonSlowLength', type: 'int', title: 'Slow Ribbon Period', defval: 8, min: 1, group: CALC },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'], group: CALC },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'], group: VISUAL },
  { id: 'bullAccel', type: 'color', title: 'Bullish Acceleration', defval: '#00ffaa', group: VISUAL },
  { id: 'bullDecel', type: 'color', title: 'Bullish Deceleration', defval: '#006400', group: VISUAL },
  { id: 'bearAccel', type: 'color', title: 'Bearish Acceleration', defval: '#ff0000', group: VISUAL },
  { id: 'bearDecel', type: 'color', title: 'Bearish Deceleration', defval: '#8b0000', group: VISUAL },
  { id: 'cloudTransparency', type: 'int', title: 'Cloud Transparency', defval: 30, min: 0, max: 100, group: VISUAL },
  { id: 'enableBarColoring', type: 'bool', title: 'Enable Bar Coloring', defval: true, group: VISUAL },
  { id: 'barTransparency', type: 'int', title: 'Bar Color Transparency', defval: 30, min: 0, max: 100, group: VISUAL },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast Kinetic Ribbon', color: String(color.new('#00ffaa', 30)), lineWidth: 4 },
  { id: 'plot1', title: 'Slow Kinetic Ribbon', color: String(color.new('#00ffaa', 30)), lineWidth: 4 },
];

export const metadata = {
  title: 'Adaptive Kinetic Ribbon [QuantAlgo]',
  shortTitle: 'Adaptive Kinetic Ribbon [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

const PRESET_COLORS: Record<string, [string, string, string, string]> = {
  Classic: ['#00ff00', '#006400', '#ff0000', '#8b0000'],
  Aqua: ['#00d4ff', '#006680', '#ff8c00', '#804600'],
  Cosmic: ['#49ffce', '#247f67', '#9932cc', '#4d1966'],
  Cyber: ['#ff6600', '#803300', '#00cccc', '#006666'],
  Neon: ['#ffff00', '#808000', '#ff00ff', '#800080'],
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

/** One ribbon moving average of the kinetic line stepped bar by bar */
function maStep(maType: KineticMaType, len: number): Ma {
  switch (maType) {
    case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'VWMA': { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    default: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  }
}

interface RibbonVars {
  /** var float kinetic_line = na */
  kinetic: number;
}

interface RibbonRun extends BarRunState<RibbonVars> {
  stdev: WindowStdev;
  fastMa: Ma;
  slowMa: Ma;
  src: number[];
  fast: number[];
  slow: number[];
  /** trend_up (1) and acceleration (2) states per bar */
  states: number[];
  fastData: Point[];
  slowData: Point[];
  css: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveKineticRibbonInputs>): BarStudy<RibbonRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  let { length, mult, maType, ribbonFastLength, ribbonSlowLength } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    [length, mult, maType, ribbonFastLength, ribbonSlowLength] = [12, 1.0, 'EMA', 2, 5];
  } else if (cfg.presetConfig === 'Smooth Trend') {
    [length, mult, maType, ribbonFastLength, ribbonSlowLength] = [30, 2.0, 'EMA', 5, 13];
  }
  const [bullAccel, bullDecel, bearAccel, bearDecel] = PRESET_COLORS[cfg.colorPreset]
    ?? [cfg.bullAccel, cfg.bullDecel, cfg.bearAccel, cfg.bearDecel];
  const value = barSource(cfg.src);

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: RibbonRun = {
        stdev: new WindowStdev(length), fastMa: maStep(maType, ribbonFastLength), slowMa: maStep(maType, ribbonSlowLength),
        src: [], fast: [], slow: [], states: [], fastData: [], slowData: [], css: [], barColors: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: { kinetic: NaN }, lists: [], series: [],
      };
      s.steps = [s.stdev, s.fastMa, s.slowMa];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.src, s.fast, s.slow, s.states, s.fastData, s.slowData, s.css, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = s.src;
      const x = value(b);
      src[i] = x;
      const diff1 = i > 0 ? x - src[i - 1] : NaN;
      const volatility = s.stdev.step(diff1) * mult;

      // var float kinetic_line = na
      // kinetic_line := na(kinetic_line[1]) ? source : kinetic_line[1] + adaptive_alpha * (source - kinetic_line[1])
      const velocity = i - length >= 0 ? x - src[i - length] : NaN;
      // a plain division: 0 / 0 is na (velocity 0 and volatility 0)
      const alpha = Math.abs(velocity) / (Math.abs(velocity) + volatility);
      const prev = s.vars.kinetic;
      const k = isNaN(prev) ? x : prev + alpha * (x - prev);
      const kinetic = Number.isFinite(k) ? k : NaN;
      s.vars.kinetic = kinetic;

      const vol = b.volume ?? NaN;
      const f = s.fastMa.step(kinetic, vol);
      const sl = s.slowMa.step(kinetic, vol);
      s.fast[i] = f;
      s.slow[i] = sl;
      const pf = i > 0 ? s.fast[i - 1] : NaN;
      const ps = i > 0 ? s.slow[i - 1] : NaN;

      const trendUp = gt(f, sl);
      const acceleration = i > 0 && gt(f, pf);
      const rc = trendUp ? (acceleration ? bullAccel : bullDecel) : !acceleration ? bearAccel : bearDecel;
      const css = String(color.new(rc, cfg.cloudTransparency));
      s.css[i] = css;
      // barcolor(enableBarColoring ? color.new(ribbonColor, barTransparency) : na)
      if (cfg.enableBarColoring) s.barColors.push({ time: b.time, color: String(color.new(rc, cfg.barTransparency)) });
      s.fastData[i] = { time: b.time, value: f, color: css };
      s.slowData[i] = { time: b.time, value: sl, color: css };

      // bullCross = ta.crossover(ribbon_fast, ribbon_slow); bearCross = ta.crossunder(ribbon_fast, ribbon_slow)
      const bullCross = f > sl && pf <= ps;
      const bearCross = f < sl && pf >= ps;
      // states (trend_up = fast > slow, acceleration = fast > fast[1]); trigger = state and not state[1] (false before bar 0)
      const state = (trendUp ? 1 : 0) | (acceleration ? 2 : 0);
      s.states[i] = state;
      const prevState = i > 0 ? s.states[i - 1] : -1;
      const bullAccelT = state === 3 && prevState !== 3;
      const bullDecelT = state === 1 && prevState !== 1;
      const bearAccelT = state === 0 && prevState !== 0;
      const bearDecelT = state === 2 && prevState !== 2;
      const flags = [
        bullCross, bearCross, bullCross || bearCross,
        bullAccelT, bullDecelT, bearAccelT, bearDecelT, bullAccelT || bearAccelT, bullDecelT || bearDecelT,
      ];
      for (let a = 0; a < flags.length; a++) {
        s.flags[a][i] = flags[a];
        if (flags[a]) s.times[a].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.fastData.slice(), plot1: s.slowData.slice() },
        // fill(p1, p2, color = css, title = 'Ribbon Fill')
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Ribbon Fill' }, colors: s.css.slice() }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveKineticRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveKineticRibbonInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Crossover', message: 'Adaptive Kinetic Ribbon: BULLISH crossover on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Crossover', message: 'Adaptive Kinetic Ribbon: BEARISH crossover on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Ribbon Crossover', message: 'Adaptive Kinetic Ribbon: Crossover detected! Check chart {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'Bullish Acceleration', message: 'Adaptive Kinetic Ribbon: BULLISH ACCELERATION on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert4', title: 'Bullish Deceleration', message: 'Adaptive Kinetic Ribbon: BULLISH DECELERATION on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert5', title: 'Bearish Acceleration', message: 'Adaptive Kinetic Ribbon: BEARISH ACCELERATION on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert6', title: 'Bearish Deceleration', message: 'Adaptive Kinetic Ribbon: BEARISH DECELERATION on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert7', title: 'Any Acceleration', message: 'Adaptive Kinetic Ribbon: ACCELERATION state entered on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert8', title: 'Any Deceleration', message: 'Adaptive Kinetic Ribbon: DECELERATION state entered on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const AdaptiveKineticRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
