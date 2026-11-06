/**
 * Asymmetric Volatility Trend Line
 *
 * A trend line with a volatility threshold: stdev(source, lookback) * multiplier. In an up trend (or no trend yet)
 * the line ratchets up to source - threshold / 4 when the source is above the line + threshold / 2, and flips down
 * to source + threshold / 4 when the source falls below the line - threshold. In a down trend it is the mirror:
 * ratchets down with half the threshold, flips up with the full threshold. The line is bullish or bearish coloured
 * by trend; four fills of fading transparency go from the line to the source; a "⦿" marks the line value on the bar
 * before each direction change. Optional bar and background colours by trend. Presets override the multiplier and
 * the lookback.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Signal' / 'Bearish Trend Signal' on the bars where
 * the direction turns to 1 from -1 / to -1 from 1, 'Any Trend Change' on both.
 *
 * Reference: "Asymmetric Volatility Trend Line [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AsymmetricVolatilityTrendLineInputs {
  /** 'Default' | 'Fast Response' | 'Smooth Trend' (the presets override thresholdMult and lookback) */
  preset: string;
  /** Price source */
  src: SourceType;
  /** Multiplier of the standard deviation threshold */
  thresholdMult: number;
  /** Standard deviation lookback */
  lookback: number;
  /** 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom' (Custom uses bullishColor / bearishColor) */
  colorPreset: string;
  bullishColor: string;
  bearishColor: string;
  /** Bar colours by trend */
  showCandles: boolean;
  barTransparency: number;
  /** Background colours by trend */
  showBgColor: boolean;
  bgTransparency: number;
}

export const defaultInputs: AsymmetricVolatilityTrendLineInputs = {
  preset: 'Default',
  src: 'close',
  thresholdMult: 1.5,
  lookback: 20,
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
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'thresholdMult', type: 'float', title: 'Threshold Multiplier', defval: 1.5, min: 0.1, step: 0.05 },
  { id: 'lookback', type: 'int', title: 'Volatility Lookback', defval: 20, min: 1 },
  { id: 'colorPreset', type: 'string', title: 'Colour Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Colour', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Colour', defval: '#ff0000' },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Colouring', defval: false },
  { id: 'barTransparency', type: 'int', title: 'Bar Colour Transparency', defval: 0, min: 0, max: 100 },
  { id: 'showBgColor', type: 'bool', title: 'Enable Background Colouring', defval: false },
  { id: 'bgTransparency', type: 'int', title: 'Background Colour Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: '#00ffaa', lineWidth: 4, style: 'linebr' },
  { id: 'plot1', title: 'Trend Line (fill)', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Mid 1', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Mid 2', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Mid 3', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Source', color: '#2962ff', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Asymmetric Volatility Trend Line [QuantAlgo]',
  shortTitle: 'Asymmetric Volatility Trend Line [QuantAlgo]',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

const COLOR_PRESETS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface AvtlVars {
  /** var float trend_line = na, var int trend_dir = 0, var int prev_dir = 0 */
  tl: number;
  dir: number;
  prevDir: number;
}

interface AvtlRun extends BarRunState<AvtlVars> {
  sd: WindowStdev;
  line: number[];
  dirs: number[];
  plots: Point[][];
  layers: string[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

const LAYER_TRANSP = [55, 70, 82, 92];

function study(inputs: Partial<AsymmetricVolatilityTrendLineInputs>): BarStudy<AvtlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { thresholdMult, lookback } = cfg;
  if (cfg.preset === 'Fast Response') {
    thresholdMult = 1.0;
    lookback = 12;
  } else if (cfg.preset === 'Smooth Trend') {
    thresholdMult = 2.5;
    lookback = 35;
  }
  const [bullish, bearish] = COLOR_PRESETS[cfg.colorPreset] ?? [cfg.bullishColor, cfg.bearishColor];
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AvtlRun = {
        sd: new WindowStdev(lookback), line: [], dirs: [], plots: Array.from({ length: 6 }, () => []),
        layers: LAYER_TRANSP.map(() => []), markers: [], barColors: [], bgColors: [], flags: [[], [], []],
        times: [[], [], []], steps: [], vars: { tl: NaN, dir: 0, prevDir: 0 }, lists: [], series: [],
      };
      s.steps = [s.sd];
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.line, s.dirs, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = value(b);
      const vt = s.sd.step(src) * thresholdMult;
      if (isNaN(v.tl)) {
        v.tl = src;
      } else {
        v.prevDir = v.dir;
        if (v.dir >= 0) {
          if (gt(src, v.tl + vt * 0.5)) {
            v.tl = Math.max(v.tl, src - vt * 0.25);
            v.dir = 1;
          } else if (gt(v.tl - vt, src)) {
            v.tl = src + vt * 0.25;
            v.dir = -1;
          }
        } else if (gt(v.tl - vt * 0.5, src)) {
          v.tl = Math.min(v.tl, src + vt * 0.25);
          v.dir = -1;
        } else if (gt(src, v.tl + vt)) {
          v.tl = src - vt * 0.25;
          v.dir = 1;
        }
      }
      const tl = v.tl;
      const dir = v.dir;
      s.line[i] = tl;
      s.dirs[i] = dir;
      // is_reversal = trend_dir != prev_dir and bar_index > 0 (prev_dir is 0 on the first bar, as trend_dir)
      const reversal = dir !== v.prevDir && i > 0;
      const lineColor = dir === 1 ? bullish : bearish;

      // turned_bullish = trend_dir == 1 and trend_dir[1] == -1; turned_bearish the mirror; trend_changed = either
      const prev = i > 0 ? s.dirs[i - 1] : NaN;
      const turnedBullish = i > 0 && dir === 1 && prev === -1;
      const turnedBearish = i > 0 && dir === -1 && prev === 1;
      const trendChanged = turnedBullish || turnedBearish;
      const t = b.time;
      s.flags[0][i] = turnedBullish;
      s.flags[1][i] = turnedBearish;
      s.flags[2][i] = trendChanged;
      if (turnedBullish) s.times[0].push(t as number);
      if (turnedBearish) s.times[1].push(t as number);
      if (trendChanged) s.times[2].push(t as number);

      // plot(trend_line, 'Trend Line', line_color, linewidth = 4, style = plot.style_linebr)
      s.plots[0][i] = { time: t, value: tl, color: lineColor };
      // fill anchors (display.none): trend_line, mid1, mid2, mid3, src
      s.plots[1][i] = { time: t, value: tl };
      s.plots[2][i] = { time: t, value: tl + (src - tl) * 0.25 };
      s.plots[3][i] = { time: t, value: tl + (src - tl) * 0.5 };
      s.plots[4][i] = { time: t, value: tl + (src - tl) * 0.75 };
      s.plots[5][i] = { time: t, value: src };
      for (let k = 0; k < LAYER_TRANSP.length; k++) s.layers[k][i] = String(color.new(lineColor, LAYER_TRANSP[k]));

      // plotchar(is_reversal ? trend_line[1] : na, 'Reversal', '⦿', location.absolute, color = line_color,
      //          size = size.small, offset = -1): the value of bar i is drawn on bar i - 1
      if (reversal && i > 0 && !isNaN(s.line[i - 1])) {
        s.markers.push({ time: bars[i - 1].time, position: 'atPriceMiddle', price: s.line[i - 1], shape: 'circle',
          color: 'transparent', text: '⦿', textColor: lineColor, size: 'small' });
      }
      // barcolor(show_candles ? color.new(line_color, bar_trans) : na); bgcolor(show_bgcolor ? color.new(line_color, bg_trans) : na)
      if (cfg.showCandles) s.barColors.push({ time: t, color: String(color.new(lineColor, cfg.barTransparency)) });
      if (cfg.showBgColor) s.bgColors.push({ time: t, color: String(color.new(lineColor, cfg.bgTransparency)) });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          { plot1: 'plot1', plot2: 'plot2', colors: s.layers[0].slice() },
          { plot1: 'plot2', plot2: 'plot3', colors: s.layers[1].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.layers[2].slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.layers[3].slice() },
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
export function createRun(inputs: Partial<AsymmetricVolatilityTrendLineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AsymmetricVolatilityTrendLineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'Bullish Trend Signal',
    message: 'Asymmetric Volatility Trend Line: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}',
  },
  {
    id: 'alert1', title: 'Bearish Trend Signal',
    message: 'Asymmetric Volatility Trend Line: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}',
  },
  {
    id: 'alert2', title: 'Any Trend Change',
    message: 'Asymmetric Volatility Trend Line: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}',
  },
];

export const AsymmetricVolatilityTrendLine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
