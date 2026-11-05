/**
 * Smart Money Flow Signals [QuantAlgo]
 *
 * Composite wave = 0.5 * momentum wave + 0.3 * Chaikin flow wave + 0.2 * money flow wave:
 * - momentum wave: EMA(trend period) of a volume-weighted channel index, (source - EMA) / (0.015 * EMA of the absolute
 *   deviation) * (1 + 0.5 * log(volume / SMA(volume) + 1)), with EMAs over the momentum channel period;
 * - Chaikin flow wave: 100 * Chaikin Money Flow over the trend period;
 * - money flow wave: (Money Flow Index over the MFI period - 50) * 1.2.
 * The wave is filled to zero with a gradient whose opacity follows the wave, volume and flow alignment strength;
 * an SMA of the wave is the smoothed trend line, and bars take a bearish-to-bullish gradient of the wave.
 * The presets replace the four periods, as in Pine.
 * Alerts (alertcondition, `alerts` of the result): wave crossing above / below zero, either, reversals from the
 * overbought / oversold levels (as the original writes them: at or beyond the level and crossing back on the same
 * bar, so they never fire), and the wave at or beyond the overbought / oversold level.
 *
 * Reference: "Smart Money Flow Signals [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type SmartMoneyPreset = 'Default' | 'Fast Response' | 'Smooth Trend';
export type SmartMoneyColorPreset = 'Classic' | 'Aqua' | 'Cosmic' | 'Ember' | 'Neon' | 'Custom';

export interface SmartMoneyFlowSignalsInputs {
  /** Price source */
  source: SourceType;
  /** Momentum channel period (EMA length of the channel index) */
  momentumChannelPeriod: number;
  /** Trend period: momentum wave EMA, Chaikin money flow and volume average */
  trendPeriod: number;
  /** Money Flow Index period */
  mfiPeriod: number;
  /** SMA length of the smoothed trend line */
  signalSmoothing: number;
  /** Preset; other than Default it replaces the four periods above */
  presetConfig: SmartMoneyPreset;
  /** Overbought level (scale of the fill strength) */
  overboughtLevel: number;
  /** Oversold level */
  oversoldLevel: number;
  /** Colour preset; Custom uses bullColor / bearColor */
  colorPreset: SmartMoneyColorPreset;
  bullColor: string;
  bearColor: string;
  /** Colour the price bars with the wave gradient */
  enableBarColoring: boolean;
  /** Show the smoothed trend line */
  showSmoothedLine: boolean;
}

export const defaultInputs: SmartMoneyFlowSignalsInputs = {
  source: 'hlc3',
  momentumChannelPeriod: 10,
  trendPeriod: 21,
  mfiPeriod: 14,
  signalSmoothing: 4,
  presetConfig: 'Default',
  overboughtLevel: 60,
  oversoldLevel: -60,
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  enableBarColoring: true,
  showSmoothedLine: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'momentumChannelPeriod', type: 'int', title: 'Momentum Channel Period', defval: 10, min: 1 },
  { id: 'trendPeriod', type: 'int', title: 'Trend Period', defval: 21, min: 1 },
  { id: 'mfiPeriod', type: 'int', title: 'Money Flow Index Period', defval: 14, min: 1 },
  { id: 'signalSmoothing', type: 'int', title: 'Signal Smoothing', defval: 4, min: 1 },
  { id: 'presetConfig', type: 'string', title: 'Preconfigured Preset', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'overboughtLevel', type: 'float', title: 'Overbought Level', defval: 60, min: 20, max: 100, step: 5 },
  { id: 'oversoldLevel', type: 'float', title: 'Oversold Level', defval: -60, min: -100, max: -20, step: 5 },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Ember', 'Neon', 'Custom'] },
  { id: 'bullColor', type: 'color', title: 'Bullish Flow Color', defval: '#00ffaa' },
  { id: 'bearColor', type: 'color', title: 'Bearish Flow Color', defval: '#ff0000' },
  { id: 'enableBarColoring', type: 'bool', title: 'Enable Bar Coloring', defval: true },
  { id: 'showSmoothedLine', type: 'bool', title: 'Show Smoothed Trend Line', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Smart Money Flow', color: '#00ffaa', lineWidth: 3 },
  { id: 'plot2', title: 'Smoothed Trend', color: color.white, lineWidth: 1 },
  { id: 'plot3', title: 'Overbought', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Smart Money Flow Signals [QuantAlgo]',
  shortTitle: 'Smart Money Flow Signals',
  overlay: false,
};

const COLOR_PRESETS: Record<Exclude<SmartMoneyColorPreset, 'Custom'>, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00bfff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Ember: ['#ff6600', '#00cccc'],
  Neon: ['#ffff00', '#ff00ff'],
};

// Pine compares floats with a tolerance of 1e-10. A comparison with na is false, `na != 0` too (Pine:
// channel_index is 0 while the deviation is na, the money flow index 100 while the sums are na).
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** Division whose denominator is guarded by the Pine code (or is |overbought level| >= 20): never 0 here */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface SmfRun extends BarRunState<Record<string, never>> {
  posSum: ReturnType<typeof taStep.sum>;
  negSum: ReturnType<typeof taStep.sum>;
  volumeSma: ReturnType<typeof taStep.sma>;
  /** ta.sma(money_flow_volume, trend_period) of the ternary branch: stepped on the bars where it runs */
  mfvSum: ReturnType<typeof taStep.sum>;
  esa: ReturnType<typeof taStep.ema>;
  deviation: ReturnType<typeof taStep.ema>;
  momentum: ReturnType<typeof taStep.ema>;
  smoothed: ReturnType<typeof taStep.sma>;
  src: number[];
  wave: number[];
  zeroPlot: Point[];
  wavePlot: Point[];
  smoothPlot: Point[];
  obPlot: Point[];
  osPlot: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SmartMoneyFlowSignalsInputs>): BarStudy<SmfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { momentumChannelPeriod, trendPeriod, mfiPeriod, signalSmoothing } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    momentumChannelPeriod = 7;
    trendPeriod = 14;
    mfiPeriod = 10;
    signalSmoothing = 2;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    momentumChannelPeriod = 14;
    trendPeriod = 30;
    mfiPeriod = 21;
    signalSmoothing = 7;
  }
  const { overboughtLevel, oversoldLevel } = cfg;
  const [bullishColor, bearishColor] = cfg.colorPreset === 'Custom'
    ? [cfg.bullColor, cfg.bearColor] : COLOR_PRESETS[cfg.colorPreset];
  const source = barSource(cfg.source);
  const trendLen = Math.floor(trendPeriod);
  const bullLow = String(color.new(bullishColor, 85));
  const bullHigh = String(color.new(bullishColor, 20));
  const bearLow = String(color.new(bearishColor, 85));
  const bearHigh = String(color.new(bearishColor, 20));
  const bullLine = String(color.new(bullishColor, 0));
  const bearLine = String(color.new(bearishColor, 0));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: SmfRun = {
        posSum: taStep.sum(), negSum: taStep.sum(), volumeSma: taStep.sma(), mfvSum: taStep.sum(),
        esa: taStep.ema(momentumChannelPeriod), deviation: taStep.ema(momentumChannelPeriod),
        momentum: taStep.ema(trendPeriod), smoothed: taStep.sma(),
        src: [], wave: [], zeroPlot: [], wavePlot: [], smoothPlot: [], obPlot: [], osPlot: [], fillColors: [],
        barColors: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.posSum, s.negSum, s.volumeSma, s.mfvSum, s.esa, s.deviation, s.momentum, s.smoothed];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.src, s.wave, s.zeroPlot, s.wavePlot, s.smoothPlot, s.obPlot, s.osPlot, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = source(b) ?? NaN;
      s.src[i] = src;
      const volume = b.volume ?? NaN;
      const prevSrc = i > 0 ? s.src[i - 1] : NaN;

      // Money Flow Index
      // raw_money_flow = source * volume; positive_flow = source >= source[1] ? raw : 0; negative_flow = source < source[1] ? raw : 0
      const rawMoneyFlow = src * volume;
      const positiveFlow = i > 0 && ge(src, prevSrc) ? rawMoneyFlow : 0;
      const negativeFlow = i > 0 && lt(src, prevSrc) ? rawMoneyFlow : 0;
      const positiveMoneyFlow = s.posSum.step(positiveFlow, mfiPeriod) ?? NaN;
      const negativeMoneyFlow = s.negSum.step(negativeFlow, mfiPeriod) ?? NaN;
      // money_flow_index = negative_money_flow != 0 ? 100 - 100 / (1 + positive / negative) : 100
      const moneyFlowIndex = ne(negativeMoneyFlow, 0)
        ? 100 - div(100, 1 + div(positiveMoneyFlow, negativeMoneyFlow)) : 100;

      // Chaikin Money Flow
      // money_flow_multiplier = high != low ? (close - low - (high - close)) / (high - low) : 0
      const moneyFlowVolume = (ne(b.high, b.low) ? div(b.close - b.low - (b.high - b.close), b.high - b.low) : 0) * volume;
      const volumeSma = s.volumeSma.step(volume, trendPeriod) ?? NaN;
      // chaikin_money_flow = volume_sma != 0 ? ta.sma(money_flow_volume, trend_period) / volume_sma : 0
      // Pine runs ta.sma of the ternary branch only on the bars where volume_sma != 0: its window holds the last
      // trend_period values of those bars. With the na volume_sma of the first bars, the CMF is 0 on bars
      // 0 .. trend_period - 2, then na until the call has trend_period values.
      let chaikinMoneyFlow: number;
      if (ne(volumeSma, 0)) {
        const mfvSma = (s.mfvSum.step(moneyFlowVolume, trendPeriod) ?? NaN) / trendLen;
        chaikinMoneyFlow = div(mfvSma, volumeSma);
      } else {
        s.mfvSum.discard();
        chaikinMoneyFlow = 0;
      }

      // Volume analysis: volume_strength = volume_average != 0 ? volume / volume_average : 1 (volume_average = volume_sma)
      const volumeStrength = ne(volumeSma, 0) ? div(volume, volumeSma) : 1;
      const volumeWeight = Math.log(volumeStrength + 1);

      // Not computed: pressure_ratio (buy / sell pressure, used by no output of the original).

      // Volume-weighted momentum
      const esa = s.esa.step(src) ?? NaN;
      const deviation = s.deviation.step(Math.abs(src - esa)) ?? NaN;
      // channel_index = deviation != 0 ? (source - esa) / (0.015 * deviation) * (1 + volume_weight * 0.5) : 0
      const channelIndex = ne(deviation, 0) ? div(src - esa, 0.015 * deviation) * (1 + volumeWeight * 0.5) : 0;

      // Composite wave
      const momentumWave = s.momentum.step(channelIndex) ?? NaN;
      const w = momentumWave * 0.5 + chaikinMoneyFlow * 100 * 0.3 + (moneyFlowIndex - 50) * 1.2 * 0.2;
      s.wave[i] = w;
      const smoothedWave = s.smoothed.step(w, signalSmoothing) ?? NaN;

      // wave_strength_percent = |composite_wave| / |overbought_level| * 100
      const waveStrength = div(Math.abs(w), Math.abs(overboughtLevel)) * 100;
      // volume_intensity_percent = math.min(volume_strength, 2.5) / 2.5 * 100
      const volumeIntensity = (Math.min(volumeStrength, 2.5) / 2.5) * 100;
      // flow_alignment_percent = cmf > 0 and wave > 0 or cmf < 0 and wave < 0 ? 100 : 50
      const flowAlignment = (gt(chaikinMoneyFlow, 0) && gt(w, 0)) || (lt(chaikinMoneyFlow, 0) && lt(w, 0)) ? 100 : 50;
      const totalStrength = waveStrength * 0.4 + volumeIntensity * 0.4 + flowAlignment * 0.2;
      // wave_fill_color = composite_wave > 0 ? gradient_bullish_color : gradient_bearish_color
      const up = gt(w, 0);
      s.fillColors[i] = String(up
        ? color.from_gradient(totalStrength, 0, 100, bullLow, bullHigh)
        : color.from_gradient(totalStrength, 0, 100, bearLow, bearHigh));
      // plot(composite_wave, 'Smart Money Flow', color = composite_wave > 0 ? bullish : bearish, linewidth = 3)
      s.wavePlot[i] = { time: t, value: w, color: up ? bullLine : bearLine };
      // barcolor(enable_bar_coloring ? color.from_gradient(composite_wave, -70, 70, bearish_color, bullish_color) : na)
      if (cfg.enableBarColoring) {
        s.barColors.push({ time: t, color: String(color.from_gradient(w, -70, 70, bearishColor, bullishColor)) });
      }
      s.zeroPlot[i] = { time: t, value: 0 };
      s.smoothPlot[i] = { time: t, value: cfg.showSmoothedLine ? smoothedWave : NaN };
      s.obPlot[i] = { time: t, value: overboughtLevel };
      s.osPlot[i] = { time: t, value: oversoldLevel };

      // Signals of the alertconditions (crosses of the wave over / under a level)
      const pw = i > 0 ? s.wave[i - 1] ?? NaN : NaN;
      const over = (level: number) => w > level && pw <= level;
      const under = (level: number) => w < level && pw >= level;
      const bullishSignal = over(0);
      const bearishSignal = under(0);
      const extremeOverbought = ge(w, overboughtLevel);
      const extremeOversold = le(w, oversoldLevel);
      const overboughtReversal = extremeOverbought && under(overboughtLevel);
      const oversoldReversal = extremeOversold && over(oversoldLevel);
      const anyChange = bullishSignal || bearishSignal;
      const flags = [
        bullishSignal, bearishSignal, anyChange, overboughtReversal, oversoldReversal, extremeOverbought, extremeOversold,
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.zeroPlot.slice(),
          plot1: s.wavePlot.slice(),
          plot2: s.smoothPlot.slice(),
          plot3: s.obPlot.slice(),
          plot4: s.osPlot.slice(),
        },
        // fill(wave_plot, zero_line_plot, color = wave_fill_color, title = 'Flow Gradient')
        fills: [{ plot1: 'plot1', plot2: 'plot0', options: { title: 'Flow Gradient' }, colors: s.fillColors.slice() }],
        markers: [],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmartMoneyFlowSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmartMoneyFlowSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Flow', message: 'Smart Money Flow: BULLISH crossover detected! Money flowing INTO {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Flow', message: 'Smart Money Flow: BEARISH crossover detected! Money flowing OUT of {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Flow Direction Change', message: 'Smart Money Flow: Direction change detected! Check chart {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'Overbought Reversal', message: 'Smart Money Flow: OVERBOUGHT reversal signal! Potential bearish reversal {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert4', title: 'Oversold Reversal', message: 'Smart Money Flow: OVERSOLD reversal signal! Potential bullish reversal {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert5', title: 'Extreme Overbought', message: 'Smart Money Flow: EXTREME overbought conditions! {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert6', title: 'Extreme Oversold', message: 'Smart Money Flow: EXTREME oversold conditions! {{exchange}}:{{ticker}} - {{interval}}' },
];

export const SmartMoneyFlowSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
