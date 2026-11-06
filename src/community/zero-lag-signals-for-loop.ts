/**
 * Zero Lag Signals For Loop
 *
 * Zero lag basis: EMA of close + (close - close[lag]), lag = floor((length - 1) / 2). A for loop scores the basis
 * against its own past values (+1 when the basis is above basis[i], -1 otherwise, i = loop start to loop end).
 * The trend turns up when the score is above the up threshold and close is above basis + volatility
 * (volatility = highest ATR(length) over length * 3 bars times the multiplier); it turns down on the mirror
 * condition. The basis, a gradient fill from the basis to hl2, trend change labels and bar colours follow the trend.
 * The presets replace length, volatility multiplier, loop end and thresholds, as in Pine. The Pine input
 * "Show Signal Markers" is not used by the Pine plots: the labels are always drawn, as in Pine.
 * Alerts (alertcondition, `alerts` of the result): 'Zero Lag Signals Long' / 'Zero Lag Signals Short' when the trend
 * crosses over / under 0.
 *
 * Reference: "Zero Lag Signals For Loop [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type ZeroLagPreset = 'Default' | 'Fast Response' | 'Smooth Trend';
export type ZeroLagColorPreset = 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';

export interface ZeroLagSignalsForLoopInputs {
  /** Preset configuration; other than Default it replaces length, volatility multiplier, loop end and thresholds */
  presetConfig: ZeroLagPreset;
  /** Zero lag length */
  length: number;
  /** Volatility multiplier */
  volatilityMult: number;
  /** Loop start */
  loopStart: number;
  /** Loop end */
  loopEnd: number;
  /** Score above this value is needed for an uptrend */
  thresholdUp: number;
  /** Score below this value is needed for a downtrend */
  thresholdDown: number;
  /** Colour preset; Custom uses bullColor / bearColor */
  colorPreset: ZeroLagColorPreset;
  bullColor: string;
  bearColor: string;
  /** Pine input "Show Signal Markers": not used by any Pine output */
  showSignals: boolean;
  /** Colour the candles with the trend colour */
  paintCandles: boolean;
  /** Background colour on the bars where the trend crosses up / down through 0 */
  showBgLines: boolean;
}

export const defaultInputs: ZeroLagSignalsForLoopInputs = {
  presetConfig: 'Default',
  length: 50,
  volatilityMult: 1.5,
  loopStart: 1,
  loopEnd: 70,
  thresholdUp: 5,
  thresholdDown: -5,
  colorPreset: 'Custom',
  bullColor: '#00ffaa',
  bearColor: '#ff0000',
  showSignals: true,
  paintCandles: true,
  showBgLines: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'length', type: 'int', title: 'Zero Lag Length', defval: 50, min: 1 },
  { id: 'volatilityMult', type: 'float', title: 'Volatility Multiplier', defval: 1.5, min: 0.1 },
  { id: 'loopStart', type: 'int', title: 'Loop Start', defval: 1, min: 1 },
  { id: 'loopEnd', type: 'int', title: 'Loop End', defval: 70, min: 1 },
  { id: 'thresholdUp', type: 'int', title: 'Threshold Uptrend', defval: 5 },
  { id: 'thresholdDown', type: 'int', title: 'Threshold Downtrend', defval: -5 },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'showSignals', type: 'bool', title: 'Show Signal Markers', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Color Candles', defval: true },
  { id: 'showBgLines', type: 'bool', title: 'Signal Change Lines', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Lag Basis', color: '#00ffaa', lineWidth: 3 },
  { id: 'plot1', title: 'Price', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Zero Lag Signals For Loop',
  shortTitle: 'ZL Signals Loop',
  overlay: true,
};

const COLOR_PRESETS: Record<Exclude<ZeroLagColorPreset, 'Custom'>, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface ZlRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  hi: WindowExtreme;
  zlBasis: number[];
  trend: number[];
  hl2: number[];
  bottomColor: (string | null)[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ZeroLagSignalsForLoopInputs>): BarStudy<ZlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { length, volatilityMult, loopEnd, thresholdUp, thresholdDown } = cfg;
  const { presetConfig, loopStart, colorPreset, paintCandles, showBgLines } = cfg;
  if (presetConfig === 'Fast Response') {
    length = 30;
    volatilityMult = 1.2;
    loopEnd = 45;
    thresholdUp = 3;
    thresholdDown = -3;
  } else if (presetConfig === 'Smooth Trend') {
    length = 70;
    volatilityMult = 2.0;
    loopEnd = 100;
    thresholdUp = 8;
    thresholdDown = -8;
  }
  const [bullColor, bearColor] = colorPreset === 'Custom' ? [cfg.bullColor, cfg.bearColor] : COLOR_PRESETS[colorPreset];

  // lag = math.floor((length - 1) / 2); zl_basis = ta.ema(close + (close - close[lag]), length)
  const lag = Math.floor((length - 1) / 2);
  return {
    init() {
      // volatility = ta.highest(ta.atr(length), length * 3) * volatility_mult
      const ema = taStep.ema(length);
      const atr = taStep.atr(length);
      const hi = new WindowExtreme(false, length * 3);
      const s: ZlRun = {
        ema, atr, hi, zlBasis: [], trend: [], hl2: [], bottomColor: [], plot0: [], plot1: [], markers: [],
        barColors: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [ema, atr, hi], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.zlBasis, s.trend, s.hl2, s.bottomColor, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const zlSrc = i >= lag ? close + (close - bars[i - lag].close) : NaN;
      const basis = s.ema.step(zlSrc) ?? NaN;
      s.zlBasis[i] = basis;
      const volatility = (s.hi.step(s.atr.step(b.high, b.low, close)) ?? NaN) * volatilityMult;

      // forloop_analysis: sum += basis > basis[i] ? 1 : -1 for i = loop_start to loop_end (na comparison: -1)
      let score = 0;
      for (let k = loopStart; k <= loopEnd; k++) {
        const past = i - k >= 0 ? s.zlBasis[i - k] : NaN;
        score += basis > past ? 1 : -1;
      }
      const longSignal = score > thresholdUp && close > basis + volatility;
      const shortSignal = score < thresholdDown && close < basis - volatility;
      const prevTrend = i > 0 ? s.trend[i - 1] : 0;
      let trend = prevTrend;
      if (longSignal) trend = 1;
      else if (shortSignal) trend = -1;
      s.trend[i] = trend;
      const trendChanged = trend !== prevTrend;

      // trend_col = trend == 1 ? bull_color : trend == -1 ? bear_color : na
      const c = trend === 1 ? bullColor : trend === -1 ? bearColor : null;
      // plot(zl_basis, "Zero Lag Basis", color = trend_col, linewidth = 3)
      s.plot0[i] = { time: t, value: basis, color: c ?? 'transparent' };
      // plot(hl2, "Price", display = display.none)
      const hl2 = (b.high + b.low) / 2;
      s.hl2[i] = hl2;
      s.plot1[i] = { time: t, value: hl2 };
      // fill(p_basis, p_price, hl2, zl_basis, na, color.new(trend_col, 20)): top_value hl2 (na colour),
      // bottom_value zl_basis (trend colour, transparency 20). Pine color.new(na, 20) is black with transparency 20
      // (0xCC000000), so the fill is drawn in black before the first trend.
      s.bottomColor[i] = c === null ? '#000000CC' : String(color.new(c, 20));

      // plotshape(trend_changed and trend == 1 ? zl_basis : na, "Bullish Trend", shape.labelup, location.absolute,
      //   bull_color, text = "𝑳", textcolor = #000000, size = size.small)
      if (trendChanged && trend === 1 && !isNaN(basis)) {
        s.markers.push({
          time: t, position: 'atPriceBottom', price: basis, shape: 'labelUp', color: bullColor,
          text: '𝑳', textColor: '#000000', size: 'small', forceOverlay: true,
        });
      }
      // plotshape(trend_changed and trend == -1 ? zl_basis : na, "Bearish Trend", shape.labeldown, location.absolute,
      //   bear_color, text = "𝑺", textcolor = #ffffff, size = size.small)
      if (trendChanged && trend === -1 && !isNaN(basis)) {
        s.markers.push({
          time: t, position: 'atPriceTop', price: basis, shape: 'labelDown', color: bearColor,
          text: '𝑺', textColor: '#ffffff', size: 'small', forceOverlay: true,
        });
      }
      // bgcolor(show_bg_lines ? (ta.crossover(trend, 0) ? bull_color : ta.crossunder(trend, 0) ? bear_color : na) : na)
      const up = i > 0 && trend > 0 && prevTrend <= 0;
      const down = i > 0 && trend < 0 && prevTrend >= 0;
      if (showBgLines && i > 0) {
        if (up) s.bgColors.push({ time: t, color: bullColor });
        else if (down) s.bgColors.push({ time: t, color: bearColor });
      }
      // barcolor(paint_candles ? trend_col : na)
      if (paintCandles && c !== null) s.barColors.push({ time: t, color: c });
      // alertcondition(ta.crossover(trend, 0)) / alertcondition(ta.crossunder(trend, 0))
      s.flags[0][i] = up;
      if (up) s.times[0].push(t as number);
      s.flags[1][i] = down;
      if (down) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [
          {
            plot1: 'plot0', plot2: 'plot1',
            gradient: { topValue: s.hl2.slice(), bottomValue: s.zlBasis.slice(), topColor: new Array<string | null>(n).fill(null), bottomColor: s.bottomColor.slice() },
          },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZeroLagSignalsForLoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ZeroLagSignalsForLoopInputs> = {}
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** alertcondition() calls of the original ({{exchange}} / {{ticker}} placeholders kept) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Zero Lag Signals Long', message: 'Zero Lag Signals Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Zero Lag Signals Short', message: 'Zero Lag Signals Short {{exchange}}:{{ticker}}' },
];

export const ZeroLagSignalsForLoop = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
