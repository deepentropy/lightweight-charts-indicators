/**
 * Smart MCDX FINAL PRO
 *
 * Volume flow = (close - close[1]) * volume. Three EMAs of the flow (banker, hot, retail lengths) are each divided by
 * the EMA of their absolute value over the same length, smoothed by an EMA and scaled by 20: the Retail, Hot and
 * Banker columns. The Banker MA is an EMA of the Banker value. A band between 2 and -2 is filled green when the
 * Banker value is above 0 and its absolute value above the minimum strength, red when it is below 0 with that
 * strength. Dots on the Banker MA mark the crosses of the Banker value and its MA when the trend is strong. A slower
 * "HTF" Banker line uses the banker length and the smoothing multiplied by the HTF multiplier (same timeframe).
 *
 * Reference: "Smart MCDX FINAL PRO" by Sachse-1980
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { HLineConfig } from 'oakscriptjs';

export interface SmartMcdxFinalProInputs {
  bankerLen: number;
  hotLen: number;
  retailLen: number;
  /** EMA length of the smoothing */
  smooth: number;
  /** Show the dots of the Banker / Banker MA crosses */
  showDots: boolean;
  dotUpCol: string;
  dotDnCol: string;
  /** Minimum absolute Banker value of a trend */
  minStrength: number;
  showTrendBand: boolean;
  /** Show the slower Banker line and its MA */
  showHTF: boolean;
  /** Multiplier of the banker length and the smoothing of the slower Banker line */
  htfMult: number;
}

export const defaultInputs: SmartMcdxFinalProInputs = {
  bankerLen: 50,
  hotLen: 40,
  retailLen: 30,
  smooth: 6,
  showDots: true,
  dotUpCol: '#39FF14',
  dotDnCol: '#FF073A',
  minStrength: 5.0,
  showTrendBand: true,
  showHTF: true,
  htfMult: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bankerLen', type: 'int', title: 'Banker Length', defval: 50 },
  { id: 'hotLen', type: 'int', title: 'Hot Length', defval: 40 },
  { id: 'retailLen', type: 'int', title: 'Retail Length', defval: 30 },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 6 },
  { id: 'showDots', type: 'bool', title: 'Show MA Cross Dots', defval: true },
  { id: 'dotUpCol', type: 'color', title: 'Bull Dot (Neon Green)', defval: '#39FF14' },
  { id: 'dotDnCol', type: 'color', title: 'Bear Dot (Neon Red)', defval: '#FF073A' },
  { id: 'minStrength', type: 'float', title: 'Min Strength Filter', defval: 5.0 },
  { id: 'showTrendBand', type: 'bool', title: 'Show Trend Band', defval: true },
  { id: 'showHTF', type: 'bool', title: 'Show HTF Banker (x5)', defval: true },
  { id: 'htfMult', type: 'int', title: 'HTF Multiplier', defval: 5 },
];

const RETAIL_COL = String(color.new(color.green, 20));
const HOT_COL = String(color.new(color.yellow, 40));
const BANKER_COL = String(color.new(color.red, 0));
const BAND_BULL = String(color.new('#39FF14', 85));
const BAND_BEAR = String(color.new('#FF073A', 85));
const HTF_BULL = String(color.new('#39FF14', 80));
const HTF_BEAR = String(color.new('#FF073A', 80));
const HTF_MA_COL = String(color.new(color.white, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Retail', color: RETAIL_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Hot', color: HOT_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Banker', color: BANKER_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Banker MA', color: color.white, lineWidth: 2 },
  { id: 'plot4', title: 'Trend Band Upper', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Trend Band Lower', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Bull Dot', color: '#39FF14', lineWidth: 3, style: 'circles' },
  { id: 'plot7', title: 'Bear Dot', color: '#FF073A', lineWidth: 3, style: 'circles' },
  { id: 'plot8', title: 'HTF Banker x5', color: HTF_BULL, lineWidth: 2 },
  { id: 'plot9', title: 'HTF Banker MA x5', color: HTF_MA_COL, lineWidth: 1 },
];

/** hline(40 / 20 / 10 / 0 / -10 / -20 / -40): Pine default style (dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper_extreme_plus', price: 40, title: 'Upper Extreme+', color: String(color.new(color.red, 60)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_upper_extreme', price: 20, title: 'Upper Extreme', color: String(color.new(color.red, 40)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_upper_mid', price: 10, title: 'Upper Mid', color: String(color.new(color.orange, 40)), linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.white, linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_lower_mid', price: -10, title: 'Lower Mid', color: String(color.new(color.teal, 40)), linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_lower_extreme', price: -20, title: 'Lower Extreme', color: String(color.new(color.green, 40)), linestyle: 'dashed', linewidth: 2 },
  { id: 'hline_lower_extreme_plus', price: -40, title: 'Lower Extreme+', color: String(color.new(color.green, 60)), linestyle: 'dashed', linewidth: 2 },
];

export const metadata = {
  title: 'Smart MCDX FINAL PRO',
  shortTitle: 'Smart MCDX FINAL PRO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

/** line(len): ema(normalize(ema(flow, len), len), smooth) * scale, with normalize(src, len) = src / ema(abs(src), len) */
interface Line {
  raw: Ema;
  den: Ema;
  smooth: Ema;
}

interface McdxRun extends BarRunState<Record<string, never>> {
  retail: Line;
  hot: Line;
  banker: Line;
  htf: Line;
  bankerMA: Ema;
  htfMa: Ema;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  bandColors: string[];
}

function study(inputs: Partial<SmartMcdxFinalProInputs>): BarStudy<McdxRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const scale = 20.0;
  const htfLen = cfg.bankerLen * cfg.htfMult;
  const makeLine = (len: number, smooth: number): Line => ({ raw: taStep.ema(len), den: taStep.ema(len), smooth: taStep.ema(smooth) });
  // normalize(src, len) = src / ta.ema(math.abs(src), len): a plain division (x / 0 is +-infinity, 0 / 0 na;
  // ta.ema skips the infinite values as Pine)
  const lineStep = (l: Line, flow: number) => {
    const raw = l.raw.step(flow) ?? NaN;
    const den = l.den.step(Math.abs(raw)) ?? NaN;
    return (l.smooth.step(raw / den) ?? NaN) * scale;
  };
  const lineSteps = (l: Line) => [l.raw, l.den, l.smooth];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: McdxRun = {
        retail: makeLine(cfg.retailLen, cfg.smooth), hot: makeLine(cfg.hotLen, cfg.smooth),
        banker: makeLine(cfg.bankerLen, cfg.smooth),
        // HTF Banker: the same steps with bankerLen * htfMult and smooth * htfMult
        htf: makeLine(htfLen, cfg.smooth * cfg.htfMult),
        bankerMA: taStep.ema(cfg.smooth), htfMa: taStep.ema(cfg.smooth),
        crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        plots: Array.from({ length: 10 }, () => []), bandColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        ...lineSteps(s.retail), ...lineSteps(s.hot), ...lineSteps(s.banker), ...lineSteps(s.htf), s.bankerMA, s.htfMa,
        s.crossUp, s.crossDown,
      ];
      s.series = [...s.plots, s.bandColors];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time;
      // flow = (close - close[1]) * volume
      const flow = i > 0 ? (bar.close - bars[i - 1].close) * (bar.volume ?? NaN) : NaN;
      const r = lineStep(s.retail, flow);
      const h = lineStep(s.hot, flow);
      const b = lineStep(s.banker, flow);
      const bankerMA = s.bankerMA.step(b) ?? NaN;

      // Trend: trendActive = math.abs(b) > minStrength
      const trendActive = gt(Math.abs(b), cfg.minStrength);
      const bullTrend = gt(b, 0) && trendActive;
      const bearTrend = lt(b, 0) && trendActive;

      // ta.crossover(b, bankerMA) / ta.crossunder(b, bankerMA)
      const crossUp = s.crossUp.step(b, bankerMA);
      const crossDown = s.crossDown.step(b, bankerMA);

      const bHtf = lineStep(s.htf, flow);
      const bHtfMa = s.htfMa.step(bHtf) ?? NaN;

      const p = s.plots;
      p[0][i] = { time, value: fin(r), color: RETAIL_COL };
      p[1][i] = { time, value: fin(h), color: HOT_COL };
      p[2][i] = { time, value: fin(b), color: BANKER_COL };
      p[3][i] = { time, value: fin(bankerMA), color: color.white };
      // p1 = plot(showTrendBand ? 2 : na, display = display.none); p2 = plot(showTrendBand ? -2 : na, ...)
      p[4][i] = { time, value: cfg.showTrendBand ? 2 : NaN };
      p[5][i] = { time, value: cfg.showTrendBand ? -2 : NaN };
      // fill(p1, p2, color = bullTrend ? color.new(#39FF14, 85) : bearTrend ? color.new(#FF073A, 85) : na)
      s.bandColors[i] = bullTrend ? BAND_BULL : bearTrend ? BAND_BEAR : 'transparent';
      // bullDot = crossUp and trendActive ? bankerMA : na; plot(showDots ? bullDot : na, style = circles)
      const validBull = !!crossUp && trendActive;
      const validBear = !!crossDown && trendActive;
      p[6][i] = { time, value: cfg.showDots && validBull ? fin(bankerMA) : NaN, color: cfg.dotUpCol };
      p[7][i] = { time, value: cfg.showDots && validBear ? fin(bankerMA) : NaN, color: cfg.dotDnCol };
      // htfCol = b_htf > b_htf_ma ? htfBullCol : htfBearCol
      p[8][i] = { time, value: cfg.showHTF ? fin(bHtf) : NaN, color: gt(bHtf, bHtfMa) ? HTF_BULL : HTF_BEAR };
      p[9][i] = { time, value: cfg.showHTF ? fin(bHtfMa) : NaN, color: HTF_MA_COL };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: hlineConfig.map((hl) => ({
          value: hl.price,
          options: { title: hl.title, color: hl.color, linestyle: hl.linestyle, linewidth: hl.linewidth },
        })),
        fills: [{ plot1: 'plot4', plot2: 'plot5', colors: s.bandColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmartMcdxFinalProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmartMcdxFinalProInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SmartMcdxFinalPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
