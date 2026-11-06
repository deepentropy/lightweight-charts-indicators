/**
 * Ehlers Adaptive Trend Indicator [Alpha Extract]
 *
 * Ehlers-style adaptive filter: the basis is the average of the last p1 source values weighted by
 * |src[i] - src[i + p2]| (the source itself when all weights are 0). Bands are the basis +- the EMA of the source
 * standard deviation times the sensitivity. A trend state flips down when the close falls below the lower band and up
 * when it rises above the upper band; the trend level trails the lower band in an up trend (highest value) and the
 * upper band in a down trend (lowest value). A fill between the basis and the trend level and the bar colours follow
 * the trend.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' / 'Sell Signal', true on every bar of an up / down
 * trend.
 *
 * Reference: "Ehlers Adaptive Trend Indicator [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlphaExtract
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EhlersAdaptiveTrendIndicatorInputs {
  src: SourceType;
  /** Ehlers length: number of weighted source values, also the standard deviation length */
  p1: number;
  /** Momentum length: the weight of src[i] is |src[i] - src[i + p2]| */
  p2: number;
  /** EMA length of the standard deviation */
  smoothingLen: number;
  /** Band width in smoothed standard deviations */
  sensitivity: number;
  colorBull: string;
  colorBear: string;
  colorBasis: string;
  /** Colour the price bars by the trend */
  colorBarTrend: boolean;
}

export const defaultInputs: EhlersAdaptiveTrendIndicatorInputs = {
  src: 'hlc3',
  p1: 30,
  p2: 25,
  smoothingLen: 10,
  sensitivity: 1.0,
  colorBull: color.green,
  colorBear: color.red,
  colorBasis: color.yellow,
  colorBarTrend: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'p1', type: 'int', title: 'Ehlers Length (p1)', defval: 30 },
  { id: 'p2', type: 'int', title: 'Momentum Length (p2)', defval: 25 },
  { id: 'smoothingLen', type: 'int', title: 'Smoothing Length', defval: 10 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 1.0, step: 0.1 },
  { id: 'colorBull', type: 'color', title: 'Bullish Color', defval: color.green },
  { id: 'colorBear', type: 'color', title: 'Bearish Color', defval: color.red },
  { id: 'colorBasis', type: 'color', title: 'Basis Line Color', defval: color.yellow },
  { id: 'colorBarTrend', type: 'bool', title: 'Color Bars by Trend', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ehlers Basis', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: 'Trend Level', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Ehlers Adaptive Trend Indicator [Alpha Extract]',
  shortTitle: 'Ehlers Adaptive Trend Indicator [Alpha Extract]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine a != b: false when a or b is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface EhlersVars {
  trend: number;
  prevLevel: number;
}

interface EhlersRun extends BarRunState<EhlersVars> {
  vol: WindowStdev;
  smooth: ReturnType<typeof taStep.ema>;
  src: number[];
  plot0: Point[];
  plot1: Point[];
  fill: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EhlersAdaptiveTrendIndicatorInputs>): BarStudy<EhlersRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { p1, p2 } = cfg;
  const value = barSource(cfg.src);
  const coef: number[] = new Array(p1).fill(0.0); // var coefArray = array.new_float(p1, 0.0)
  const bullFill = String(color.new(cfg.colorBull, 80));
  const bearFill = String(color.new(cfg.colorBear, 80));
  const bullBar = String(color.new(cfg.colorBull, 50));
  const bearBar = String(color.new(cfg.colorBear, 50));
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: EhlersRun = {
        vol: new WindowStdev(p1), smooth: taStep.ema(cfg.smoothingLen),
        src: [], plot0: [], plot1: [], fill: [], barColors: [],
        flags: [[], []], times: [[], []],
        steps: [], vars: { trend: 0, prevLevel: NaN }, lists: [], series: [],
      };
      s.steps = [s.vol, s.smooth];
      s.lists = [...s.times];
      s.series = [s.src, s.plot0, s.plot1, s.fill, s.barColors, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const time = bars[b].time;
      const src = s.src;
      src[b] = value(bars[b]);

      // Ehlers filter: computed from bar_index >= p1 - 1 + p2, na before
      let basis = NaN;
      if (b >= p1 - 1 + p2) {
        let num = 0.0;
        let sumCoef = 0.0;
        for (let i = 0; i <= p1 - 1; i++) coef[i] = Math.abs(src[b - i] - src[b - i - p2]);
        for (let i = 0; i <= p1 - 1; i++) {
          num += coef[i] * src[b - i];
          sumCoef += coef[i];
        }
        basis = ne(sumCoef, 0) ? num / sumCoef : src[b];
      }

      // Volatility and dynamic bands
      const smoothedVol = s.smooth.step(s.vol.step(src[b]));
      const upperBand = basis + smoothedVol * cfg.sensitivity;
      const lowerBand = basis - smoothedVol * cfg.sensitivity;

      // Trend state and reference level
      const v = s.vars;
      const close = bars[b].close;
      if (isNaN(v.prevLevel)) {
        v.trend = ge(close, basis) ? 1 : -1;
        v.prevLevel = basis;
      } else if (v.trend === 1 && lt(close, lowerBand)) {
        v.trend = -1;
        v.prevLevel = lowerBand;
      } else if (v.trend === -1 && gt(close, upperBand)) {
        v.trend = 1;
        v.prevLevel = upperBand;
      } else {
        // math.max / math.min give na when an argument is na
        v.prevLevel = v.trend === 1 ? Math.max(v.prevLevel, lowerBand) : Math.min(v.prevLevel, upperBand);
      }
      const trend = v.trend;

      s.plot0[b] = { time, value: fin(basis), color: cfg.colorBasis };
      s.plot1[b] = { time, value: fin(v.prevLevel), color: trend === 1 ? cfg.colorBull : cfg.colorBear };
      // fill(pBasis, pTrend, color = trend == 1 ? color.new(colorBull, 80) : color.new(colorBear, 80))
      s.fill[b] = trend === 1 ? bullFill : bearFill;
      if (cfg.colorBarTrend) s.barColors[b] = { time, color: trend === 1 ? bullBar : bearBar };
      // buySignal = trend == 1, sellSignal = trend == -1
      s.flags[0]![b] = trend === 1;
      s.flags[1]![b] = trend === -1;
      if (trend === 1) s.times[0]!.push(time as number);
      if (trend === -1) s.times[1]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fill.slice() }],
        barColors: cfg.colorBarTrend ? s.barColors.slice() : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersAdaptiveTrendIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EhlersAdaptiveTrendIndicatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal triggered' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal triggered' },
];

export const EhlersAdaptiveTrendIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
