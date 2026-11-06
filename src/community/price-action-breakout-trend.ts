/**
 * Price Action Breakout Trend
 *
 * The breakout range is the highest high and the lowest low of the `lookback` bars before the current bar. The
 * trend starts long with the trailing stop at the prior low. In a long trend the stop ratchets up to the prior low;
 * the trend turns short when the test price (close, or low with the 'Wick' confirmation) goes below the stop, and
 * the stop resets to the prior high. The short side is the mirror. Presets set the lookback and the confirmation.
 * The stop is drawn as a step line with a six-layer fill fading from the stop to the close; triangles mark the
 * trend flips; optional breakout level lines, bar colours and background colours.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Breakout Signal', 'Bearish Breakout Signal' and 'Any
 * Breakout Signal', true on the bars where the trend turns long, short, or either.
 *
 * Reference: "Price Action Breakout Trend [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceActionBreakoutTrendInputs {
  /** Preset: 'Fast Response' (5, Wick) and 'Smooth Trend' (25, Close) override the lookback and confirmation */
  preset: 'Default' | 'Fast Response' | 'Smooth Trend';
  /** Number of prior bars of the breakout range */
  lookback: number;
  /** Price that triggers a flip: 'Close' or 'Wick' (low / high) */
  confirmation: 'Close' | 'Wick';
  showTrail: boolean;
  showFill: boolean;
  showMarkers: boolean;
  showLevels: boolean;
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';
  bullishColor: string;
  bearishColor: string;
  showCandles: boolean;
  barTransparency: number;
  showBgColor: boolean;
  bgTransparency: number;
}

export const defaultInputs: PriceActionBreakoutTrendInputs = {
  preset: 'Default',
  lookback: 10,
  confirmation: 'Close',
  showTrail: true,
  showFill: true,
  showMarkers: true,
  showLevels: false,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  showCandles: false,
  barTransparency: 0,
  showBgColor: false,
  bgTransparency: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'lookback', type: 'int', title: 'Breakout Lookback', defval: 10, min: 1 },
  { id: 'confirmation', type: 'string', title: 'Breakout Confirmation', defval: 'Close', options: ['Close', 'Wick'] },
  { id: 'showTrail', type: 'bool', title: 'Show Trailing Stop', defval: true },
  { id: 'showFill', type: 'bool', title: 'Show Gradient Fill', defval: true },
  { id: 'showMarkers', type: 'bool', title: 'Show Markers', defval: true },
  { id: 'showLevels', type: 'bool', title: 'Show Breakout Levels', defval: false },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Coloring', defval: false },
  { id: 'barTransparency', type: 'int', title: 'Bar Color Transparency', defval: 0, min: 0, max: 100 },
  { id: 'showBgColor', type: 'bool', title: 'Enable Background Coloring', defval: false },
  { id: 'bgTransparency', type: 'int', title: 'Background Color Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#00ffaa', lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Price Anchor', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Gradient Level 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Gradient Level 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Gradient Level 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Gradient Level 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Gradient Level 5', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Breakout High', color: String(color.new('#00ffaa', 50)), lineWidth: 3, style: 'linebr' },
  { id: 'plot8', title: 'Breakout Low', color: String(color.new('#00ffaa', 50)), lineWidth: 3, style: 'linebr' },
];

export const metadata = {
  title: 'Price Action Breakout Trend [QuantAlgo]',
  shortTitle: 'Price Action Breakout Trend [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const PRESET_COLORS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface PabtVars {
  /** var float trail = na */
  trail: number;
  /** var int trend = 0 */
  trend: number;
}

interface PabtRun extends BarRunState<PabtVars> {
  hhStep: WindowExtreme;
  llStep: WindowExtreme;
  hh: number[];
  ll: number[];
  trendArr: number[];
  plots: Point[][];
  layers: string[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

const LAYERS = [60, 68, 76, 84, 92, 96];

function study(inputs: Partial<PriceActionBreakoutTrendInputs>): BarStudy<PabtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  const lookback = cfg.preset === 'Fast Response' ? 5 : cfg.preset === 'Smooth Trend' ? 25 : cfg.lookback;
  const confirmation = cfg.preset === 'Fast Response' ? 'Wick' : cfg.preset === 'Smooth Trend' ? 'Close' : cfg.confirmation;
  const [bullishColor, bearishColor] = PRESET_COLORS[cfg.colorPreset] ?? [cfg.bullishColor, cfg.bearishColor];
  const bullMarker = String(color.new(bullishColor, 0));
  const bearMarker = String(color.new(bearishColor, 0));

  return {
    init() {
      const hhStep = new WindowExtreme(false, lookback);
      const llStep = new WindowExtreme(true, lookback);
      const s: PabtRun = {
        hhStep, llStep, hh: [], ll: [], trendArr: [], plots: Array.from({ length: 9 }, () => []),
        layers: LAYERS.map(() => []), markers: [], barColors: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [hhStep, llStep], vars: { trail: NaN, trend: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.hh, s.ll, s.trendArr, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      // prior_high = ta.highest(high, lookback)[1]; prior_low = ta.lowest(low, lookback)[1]
      s.hh[i] = s.hhStep.step(b.high);
      s.ll[i] = s.llStep.step(b.low);
      const priorHigh = i > 0 ? s.hh[i - 1] : NaN;
      const priorLow = i > 0 ? s.ll[i - 1] : NaN;

      if (isNaN(v.trail) && !isNaN(priorLow)) {
        v.trail = priorLow;
        v.trend = 1;
      }
      const testDown = confirmation === 'Close' ? b.close : b.low;
      const testUp = confirmation === 'Close' ? b.close : b.high;
      if (v.trend === 1) {
        v.trail = Math.max(v.trail, priorLow);
        if (lt(testDown, v.trail)) {
          v.trend = -1;
          v.trail = priorHigh;
        }
      } else if (v.trend === -1) {
        v.trail = Math.min(v.trail, priorHigh);
        if (gt(testUp, v.trail)) {
          v.trend = 1;
          v.trail = priorLow;
        }
      }
      const trail = v.trail;
      const trend = v.trend;
      s.trendArr[i] = trend;

      const trendColor = trend === 1 ? bullishColor : bearishColor;
      const close = b.close;
      const p = s.plots;
      // plot(trend == 0 ? na : trail, color = show_trail ? color.new(trend_color, 0) : na, style = plot.style_stepline)
      p[0]![i] = {
        time, value: trend === 0 ? NaN : trail,
        color: cfg.showTrail ? String(color.new(trendColor, 0)) : 'transparent',
      };
      p[1]![i] = { time, value: close };
      // step = (close - trail) / 6; grad_k = trail + step * k
      for (let k = 1; k <= 5; k++) p[k + 1]![i] = { time, value: trail + ((close - trail) / 6) * k };
      p[7]![i] = { time, value: cfg.showLevels ? priorHigh : NaN, color: String(color.new(trendColor, 50)) };
      p[8]![i] = { time, value: cfg.showLevels ? priorLow : NaN, color: String(color.new(trendColor, 50)) };

      // fill(..., color = show_fill ? color.new(trend_color, tr) : na)
      for (let k = 0; k < LAYERS.length; k++) {
        s.layers[k]![i] = cfg.showFill ? String(color.new(trendColor, LAYERS[k]!)) : 'transparent';
      }

      const prev = i > 0 ? s.trendArr[i - 1] : NaN;
      const turnedBullish = trend === 1 && prev === -1;
      const turnedBearish = trend === -1 && prev === 1;
      if (cfg.showMarkers && turnedBullish) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: bullMarker, size: 'small' });
      }
      if (cfg.showMarkers && turnedBearish) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: bearMarker, size: 'small' });
      }
      // barcolor / bgcolor(show and trend != 0 ? color.new(trend_color, transparency) : na)
      if (cfg.showCandles && trend !== 0) {
        s.barColors.push({ time, color: String(color.new(trendColor, cfg.barTransparency)) });
      }
      if (cfg.showBgColor && trend !== 0) {
        s.bgColors.push({ time, color: String(color.new(trendColor, cfg.bgTransparency)) });
      }
      const flags = [turnedBullish, turnedBearish, turnedBullish || turnedBearish];
      for (let k = 0; k < 3; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const pairs = [['plot0', 'plot2'], ['plot2', 'plot3'], ['plot3', 'plot4'], ['plot4', 'plot5'], ['plot5', 'plot6'], ['plot6', 'plot1']];
      const fills = pairs.map(([plot1, plot2], k) => ({ plot1: plot1!, plot2: plot2!, colors: s.layers[k]!.slice() }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(turned_bullish / turned_bearish / trend_changed)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceActionBreakoutTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceActionBreakoutTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Breakout Signal', message: 'Price Action Breakout Trend: BULLISH breakout confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Breakout Signal', message: 'Price Action Breakout Trend: BEARISH breakout confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Breakout Signal', message: 'Price Action Breakout Trend: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const PriceActionBreakoutTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
