/**
 * Dynamic Volatility Filter
 *
 * A filter line that only moves when the source is further from it than a noise threshold (ATR * noise multiplier).
 * Then the line moves toward the source by (source - line) * catch-up speed; else it stays flat. The trend is up
 * while the line rises, down while it falls; on a flat line it keeps the last direction, or turns neutral with
 * "Show Neutral". Four fills of fading transparency go from the line to the source, and optional bands at the line
 * +/- the threshold have a fill between them. Optional bar and background colours by trend. Presets override the
 * noise multiplier, the ATR period and the catch-up speed.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Signal' / 'Bearish Trend Signal' (the trend turns
 * up / down) and 'Any Trend Change' (either).
 *
 * Reference: "Dynamic Volatility Filter [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicVolatilityFilterInputs {
  /** 'Default' | 'Fast Response' | 'Smooth Trend' (the presets override noiseMult, lookback and snapSpeed) */
  preset: string;
  /** Price source */
  src: SourceType;
  /** ATR multiplier of the noise threshold */
  noiseMult: number;
  /** ATR period */
  lookback: number;
  /** Catch-up speed: fraction of the distance to the source the line moves when the threshold is broken */
  snapSpeed: number;
  showBands: boolean;
  /** Neutral colour while the line is flat */
  showNeutral: boolean;
  /** 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom' (Custom uses bullishColor / bearishColor) */
  colorPreset: string;
  bullishColor: string;
  bearishColor: string;
  neutralColor: string;
  /** Bar colours by trend */
  showCandles: boolean;
  barTransparency: number;
  /** Background colours by trend */
  showBgColor: boolean;
  bgTransparency: number;
}

export const defaultInputs: DynamicVolatilityFilterInputs = {
  preset: 'Default',
  src: 'close',
  noiseMult: 2.0,
  lookback: 20,
  snapSpeed: 0.3,
  showBands: true,
  showNeutral: false,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  neutralColor: '#808080',
  showCandles: false,
  barTransparency: 0,
  showBgColor: false,
  bgTransparency: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'noiseMult', type: 'float', title: 'Noise Filter', defval: 2.0, min: 0.5, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Volatility Period', defval: 20, min: 1 },
  { id: 'snapSpeed', type: 'float', title: 'Catch-up Speed', defval: 0.3, min: 0.05, max: 1.0, step: 0.05 },
  { id: 'showBands', type: 'bool', title: 'Show Volatility Bands', defval: true },
  { id: 'showNeutral', type: 'bool', title: 'Show Neutral', defval: false },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: '#808080' },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Coloring', defval: false },
  { id: 'barTransparency', type: 'int', title: 'Bar Color Transparency', defval: 0, min: 0, max: 100 },
  { id: 'showBgColor', type: 'bool', title: 'Enable Background Coloring', defval: false },
  { id: 'bgTransparency', type: 'int', title: 'Background Color Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dynamic Volatility Filter Line', color: '#00ffaa', lineWidth: 4, style: 'linebr' },
  { id: 'plot1', title: 'Filter Line (fill)', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Mid 1', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Mid 2', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Mid 3', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Source', color: '#2962ff', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Upper Band', color: String(color.new('#00ffaa', 60)), lineWidth: 2 },
  { id: 'plot7', title: 'Lower Band', color: String(color.new('#00ffaa', 60)), lineWidth: 2 },
];

export const metadata = {
  title: 'Dynamic Volatility Filter [QuantAlgo]',
  shortTitle: 'Dynamic Volatility Filter [QuantAlgo]',
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

interface DvfVars {
  /** var float dvf_line = na */
  dvf: number;
  /** var int trend_dir = 0 */
  trendDir: number;
}

interface DvfRun extends BarRunState<DvfVars> {
  atr: ReturnType<typeof taStep.atr>;
  /** plot0..plot7 */
  plots: Point[][];
  /** The colours of the five fills */
  layers: string[][];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DynamicVolatilityFilterInputs>): BarStudy<DvfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { noiseMult, lookback, snapSpeed } = cfg;
  if (cfg.preset === 'Fast Response') {
    noiseMult = 1.2;
    lookback = 12;
    snapSpeed = 0.5;
  } else if (cfg.preset === 'Smooth Trend') {
    noiseMult = 2.8;
    lookback = 35;
    snapSpeed = 0.2;
  }
  const [bullish, bearish] = COLOR_PRESETS[cfg.colorPreset] ?? [cfg.bullishColor, cfg.bearishColor];
  const value = barSource(cfg.src);
  const layerTransp = [55, 70, 82, 92, cfg.showBands ? 92 : 100];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(lookback);
      const s: DvfRun = {
        atr, plots: Array.from({ length: 8 }, () => []), layers: Array.from({ length: 5 }, () => []), barColors: [],
        bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [atr], vars: { dvf: NaN, trendDir: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const src = value(b) ?? NaN;
      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      const prevDir = i > 0 ? v.trendDir : NaN; // trend_dir[1] (na on the first bar: != compares false)
      const threshold = atr * noiseMult;
      const prev = v.dvf;
      if (isNaN(v.dvf)) {
        v.dvf = src;
      } else {
        const diff = src - v.dvf;
        if (gt(Math.abs(diff), threshold)) v.dvf = v.dvf + diff * snapSpeed;
      }
      const line = v.dvf;
      // dvf_line > dvf_line[1] / dvf_line < dvf_line[1] (dvf_line[1] is na on bar 0)
      if (gt(line, prev)) v.trendDir = 1;
      else if (gt(prev, line)) v.trendDir = -1;
      else v.trendDir = cfg.showNeutral ? 0 : v.trendDir;
      const trendDir = v.trendDir;
      const lineColor = trendDir === 1 ? bullish : trendDir === -1 ? bearish : cfg.neutralColor;
      // turned_bullish = trend_dir == 1 and trend_dir[1] != 1; turned_bearish = trend_dir == -1 and trend_dir[1] != -1
      const turnedBull = trendDir === 1 && !isNaN(prevDir) && prevDir !== 1;
      const turnedBear = trendDir === -1 && !isNaN(prevDir) && prevDir !== -1;
      // trend_changed = turned_bullish or turned_bearish
      const changed = turnedBull || turnedBear;
      s.flags[0][i] = turnedBull;
      s.flags[1][i] = turnedBear;
      s.flags[2][i] = changed;
      if (turnedBull) s.times[0].push(time as number);
      if (turnedBear) s.times[1].push(time as number);
      if (changed) s.times[2].push(time as number);

      const mid = (k: number) => line + (src - line) * k;
      const band60 = String(color.new(lineColor, 60));
      const p = s.plots;
      // plot(dvf_line, 'Dynamic Volatility Filter Line', line_color, linewidth = 4, style = plot.style_linebr)
      p[0][i] = { time, value: line, color: lineColor };
      // fill anchors (display.none): dvf_line, mid1, mid2, mid3, src
      p[1][i] = { time, value: line };
      p[2][i] = { time, value: mid(0.25) };
      p[3][i] = { time, value: mid(0.5) };
      p[4][i] = { time, value: mid(0.75) };
      p[5][i] = { time, value: src };
      // plot(show_bands ? dvf_line +/- threshold : na, color.new(line_color, 60), linewidth = 2, linestyle dotted)
      p[6][i] = { time, value: cfg.showBands ? line + threshold : NaN, color: band60 };
      p[7][i] = { time, value: cfg.showBands ? line - threshold : NaN, color: band60 };
      // fill(p1, p2, color.new(line_color, show_bands ? 92 : 100)) and the four layers
      for (let k = 0; k < 5; k++) s.layers[k][i] = String(color.new(lineColor, layerTransp[k]));

      // barcolor(show_candles ? color.new(line_color, bar_trans) : na); bgcolor(show_bgcolor ? color.new(line_color, bg_trans) : na)
      if (cfg.showCandles) s.barColors.push({ time, color: String(color.new(lineColor, cfg.barTransparency)) });
      if (cfg.showBgColor) s.bgColors.push({ time, color: String(color.new(lineColor, cfg.bgTransparency)) });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 8; k++) plots[`plot${k}`] = p[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot1', plot2: 'plot2', colors: s.layers[0].slice() },
          { plot1: 'plot2', plot2: 'plot3', colors: s.layers[1].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.layers[2].slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.layers[3].slice() },
          { plot1: 'plot6', plot2: 'plot7', colors: s.layers[4].slice() },
        ],
        markers: [],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicVolatilityFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicVolatilityFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Dynamic Volatility Filter: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Dynamic Volatility Filter: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Trend Change', message: 'Dynamic Volatility Filter: Trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const DynamicVolatilityFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
