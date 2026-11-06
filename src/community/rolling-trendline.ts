/**
 * Rolling Trendline
 *
 * A straight trendline that rolls forward with a fixed slope: slope = (linreg(src, len, 0) - linreg(src, len, len - 1))
 * / (len - 1) / slope divisor. Each bar the line moves by the slope; when the source is further than stdev(src, len)
 * * multiplier from the projected value, the line resets to the source with the current slope and ATR. Bands at
 * trendline +- reset ATR * multiplier, gradient fills from the bands to the line, and circles at the reset points.
 * The colours follow the sign of the active slope.
 *
 * Reference: "Rolling Trendline [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RollingTrendlineInputs {
  /** Slope lookback: period of the linear regression slope */
  lengthInput: number;
  /** Deviation multiplier: distance (in stdev) before the trendline resets */
  multInput: number;
  /** Slope divisor: higher values give flatter lines */
  slopeDivInput: number;
  /** Source */
  sourceInput: SourceType;
  /** ATR length of the zones */
  atrLengthInput: number;
  /** ATR multiplier of the zone width */
  atrMultInput: number;
  bullColorInput: string;
  bearColorInput: string;
  /** Zone colour (not used by the Pine script) */
  zoneColorInput: string;
  /** Line width of the trendline */
  widthInput: number;
}

export const defaultInputs: RollingTrendlineInputs = {
  lengthInput: 100,
  multInput: 2.0,
  slopeDivInput: 1.5,
  sourceInput: 'close',
  atrLengthInput: 200,
  atrMultInput: 3.0,
  bullColorInput: '#089981',
  bearColorInput: '#f23645',
  zoneColorInput: String(color.new('#787b86', 80)),
  widthInput: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthInput', type: 'int', title: 'Slope Lookback', defval: 100, min: 2 },
  { id: 'multInput', type: 'float', title: 'Deviation Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'slopeDivInput', type: 'float', title: 'Slope Divisor', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'sourceInput', type: 'source', title: 'Source', defval: 'close' },
  { id: 'atrLengthInput', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMultInput', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.0, step: 0.1 },
  { id: 'bullColorInput', type: 'color', title: 'Bullish Trend', defval: '#089981' },
  { id: 'bearColorInput', type: 'color', title: 'Bearish Trend', defval: '#f23645' },
  { id: 'zoneColorInput', type: 'color', title: 'Zone Color', defval: String(color.new('#787b86', 80)) },
  { id: 'widthInput', type: 'int', title: 'Line Width', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rolling Trendline', color: '#089981', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: String(color.new('#089981', 80)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: String(color.new('#089981', 80)), lineWidth: 1 },
  { id: 'plot3', title: 'Reset Point', color: '#089981', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Rolling Trendline [LuxAlgo]',
  shortTitle: 'LuxAlgo - Rolling Trendline',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };

interface RtVars {
  /** var float trendValue = na */
  trendValue: number;
  /** var float activeSlope = na */
  activeSlope: number;
  /** var float resetAtr = na */
  resetAtr: number;
}

interface RtRun extends BarRunState<RtVars> {
  /** The source of each bar (the window of ta.linreg) */
  src: number[];
  dev: WindowStdev;
  atr: ReturnType<typeof taStep.atr>;
  trend: number[];
  upper: number[];
  lower: number[];
  zoneTop: string[];
  zoneBottom: string[];
  plots: Point[][];
}

function study(inputs: Partial<RollingTrendlineInputs>): BarStudy<RtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.lengthInput;
  const L = Math.floor(len);
  const value = barSource(cfg.sourceInput);
  return {
    fullRunReason: () => (isBarSource(cfg.sourceInput) ? null : 'source of another study'),
    init() {
      const s: RtRun = {
        src: [], dev: new WindowStdev(len),
        atr: taStep.atr(cfg.atrLengthInput), trend: [], upper: [], lower: [], zoneTop: [], zoneBottom: [],
        plots: [[], [], [], []], steps: [], vars: { trendValue: NaN, activeSlope: NaN, resetAtr: NaN },
        lists: [], series: [],
      };
      s.steps = [s.dev, s.atr];
      s.series = [s.src, s.trend, s.upper, s.lower, s.zoneTop, s.zoneBottom, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      s.src[i] = src;
      // ta.linreg(src, len, 0) and ta.linreg(src, len, len - 1): one least squares line of the last len bars (the
      // operations of taStep.linreg), na when one of them is NaN
      let lrCurrent = NaN;
      let lrPast = NaN;
      if (i >= L - 1) {
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let ok = true;
        for (let j = 0; j < L; j++) {
          const y = s.src[i - L + 1 + j];
          if (isNaN(y)) { ok = false; break; }
          const x = j + 1;
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
        }
        if (ok) {
          const slope = (L * sumXY - sumX * sumY) / (L * sumX2 - sumX * sumX);
          const intercept = sumY / L - (slope * sumX) / L + slope;
          lrCurrent = intercept + slope * (L - 1 - 0);
          lrPast = intercept + slope * (L - 1 - (len - 1));
        }
      }
      const dev = s.dev.step(src);
      const atrVal = s.atr.step(b.high, b.low, b.close);

      const lrSlope = (lrCurrent - lrPast) / (len - 1) / cfg.slopeDivInput;
      const threshold = dev * cfg.multInput;
      // projectedValue = trendValue[1] + activeSlope (trendValue still holds the previous bar value here)
      const projectedValue = v.trendValue + v.activeSlope;
      const isDeviating = gt(Math.abs(src - projectedValue), threshold);
      // bar_index == lengthInput (bar_index counts from the first bar of the history)
      const isFirstBar = i === len;
      if (isFirstBar || isDeviating) {
        v.trendValue = src;
        v.activeSlope = lrSlope;
        v.resetAtr = atrVal;
      } else {
        v.trendValue = projectedValue;
      }
      const trendValue = v.trendValue;
      const upper = trendValue + v.resetAtr * cfg.atrMultInput;
      const lower = trendValue - v.resetAtr * cfg.atrMultInput;
      s.trend[i] = trendValue;
      s.upper[i] = upper;
      s.lower[i] = lower;
      const reset = isDeviating ? src : NaN;

      const c = ge(v.activeSlope, 0) ? cfg.bullColorInput : cfg.bearColorInput;
      // color = isDeviating ? na : ...: no line segment into the reset bar
      const lineCol = isDeviating ? 'transparent' : c;
      const bandCol = isDeviating ? 'transparent' : String(color.new(c, 80));
      s.zoneTop[i] = String(color.new(c, 80));
      s.zoneBottom[i] = String(color.new(c, 100));
      const time = b.time;
      const p = s.plots;
      p[0][i] = { time, value: trendValue, color: lineCol };
      p[1][i] = { time, value: upper, color: bandCol };
      p[2][i] = { time, value: lower, color: bandCol };
      p[3][i] = { time, value: reset, color: c };
    },
    result(s) {
      const p = s.plots;
      const trend = s.trend.slice();
      const zoneTop = s.zoneTop.slice();
      const zoneBottom = s.zoneBottom.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        fills: [
          // fill(plotUpper, plotTrend, upperBand, trendValue, color.new(zone, 80), color.new(zone, 100), 'Upper Zone Fill')
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Upper Zone Fill' },
            gradient: { topValue: s.upper.slice(), bottomValue: trend, topColor: zoneTop, bottomColor: zoneBottom } },
          // fill(plotLower, plotTrend, lowerBand, trendValue, color.new(zone, 80), color.new(zone, 100), 'Lower Zone Fill')
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Lower Zone Fill' },
            gradient: { topValue: s.lower.slice(), bottomValue: trend, topColor: zoneTop, bottomColor: zoneBottom } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RollingTrendlineInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RollingTrendlineInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RollingTrendline = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
