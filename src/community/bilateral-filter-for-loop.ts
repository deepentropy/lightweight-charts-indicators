/**
 * Bilateral Filter For Loop
 *
 * A bilateral filter of the source over `Window Period` bars: each past value src[i] has the weight
 * exp(-i^2 / (2 * spatialSigma^2)) * exp(-(src - src[i])^2 / (2 * rangeSigma^2)); the filter is the weighted mean.
 * The score adds +1 for each bar offset from `Calculation Start` to `Calculation End` where the filter is above its
 * value at that offset, and -1 otherwise. A score above the long threshold sets the trend long, a cross under the
 * short threshold sets it short. The score line, the optional bar colours and background follow the trend.
 * Alerts (alertcondition, `alerts` of the result): 'Bilateral Filter FL Long' (score above the long threshold and no
 * cross under the short one) and 'Bilateral Filter FL Short' (score crossing under the short threshold).
 *
 * Reference: "Bilateral Filter For Loop [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bilateral Filter FL Long', message: 'Bilateral Filter FL Long - {{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bilateral Filter FL Short', message: 'Bilateral Filter FL Short - {{ticker}} - {{interval}}' },
];

export interface BilateralFilterForLoopInputs {
  /** Price source */
  src: SourceType;
  /** Window period of the bilateral filter */
  p: number;
  /** Spatial sigma */
  sigmaD: number;
  /** Range sigma */
  sigmaR: number;
  /** First bar offset of the score loop */
  start: number;
  /** Last bar offset of the score loop */
  end: number;
  /** Long threshold */
  upper: number;
  /** Short threshold */
  lower: number;
  /** Show the threshold lines */
  showthres: boolean;
  /** Colour the bars by trend */
  paintCandles: boolean;
  /** Colour the background by trend */
  bgcol: boolean;
  /** Signal line width (the plot width stays 3 in plotConfig) */
  linew: number;
  longcol: string;
  shortcol: string;
}

export const defaultInputs: BilateralFilterForLoopInputs = {
  src: 'close',
  p: 14,
  sigmaD: 1.0,
  sigmaR: 1.0,
  start: 1,
  end: 45,
  upper: 40,
  lower: -10,
  showthres: true,
  paintCandles: false,
  bgcol: false,
  linew: 3,
  longcol: '#00ff00',
  shortcol: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'p', type: 'int', title: 'Window Period (Bilateral Filter)', defval: 14 },
  { id: 'sigmaD', type: 'float', title: 'Spatial Sigma', defval: 1.0 },
  { id: 'sigmaR', type: 'float', title: 'Range Sigma', defval: 1.0 },
  { id: 'start', type: 'int', title: 'Calculation Start', defval: 1 },
  { id: 'end', type: 'int', title: 'Calculation End', defval: 45, max: 50 },
  { id: 'upper', type: 'int', title: 'Long Threshold', defval: 40 },
  { id: 'lower', type: 'int', title: 'Short Threshold', defval: -10 },
  { id: 'showthres', type: 'bool', title: 'Show Threshold Lines?', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Color Bars According to Trend?', defval: false },
  { id: 'bgcol', type: 'bool', title: 'Background Colour', defval: false },
  { id: 'linew', type: 'int', title: 'Signal Line Width', defval: 3, min: 1, max: 4, step: 1 },
  { id: 'longcol', type: 'color', title: 'Long Colour', defval: '#00ff00' },
  { id: 'shortcol', type: 'color', title: 'Short Colour', defval: '#ff0000' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'For Loop', color: color.gray, lineWidth: 3 },
  { id: 'plot1', title: 'Long Threshold', color: '#00ff00', lineWidth: 1 },
  { id: 'plot2', title: 'Short Threshold', color: '#ff0000', lineWidth: 1 },
];

export const metadata = {
  title: 'Bilateral Filter For Loop [BackQuant]',
  shortTitle: 'BF FL [BackQuant]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

/** var out = 0 */
interface BfVars {
  out: number;
}

interface BfRun extends BarRunState<BfVars> {
  src: number[];
  sub: number[];
  score: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

// bilateral_filter(src, p, sigma_d, sigma_r): for i = 0 to p - 1 (a Pine loop runs downwards when p - 1 < 0)
const loopRange = (from: number, to: number): number[] => {
  const r: number[] = [];
  if (from <= to) for (let k = from; k <= to; k++) r.push(k);
  else for (let k = from; k >= to; k--) r.push(k);
  return r;
};

function study(inputs: Partial<BilateralFilterForLoopInputs>): BarStudy<BfRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // x[k] on bar b: na before the first bar
  const at = (a: number[], b: number, k: number) => (b - k >= 0 && k >= 0 ? a[b - k] : NaN);
  const filterOffsets = loopRange(0, cfg.p - 1);
  // forloop(start, end): for i = start to end by 1: return_val += sub > sub[i] ? 1 : -1
  const scoreOffsets = loopRange(cfg.start, cfg.end);
  const trendColor = (o: number) => (o === 1 ? cfg.longcol : o === -1 ? cfg.shortcol : color.gray);
  const longBg = String(color.new(cfg.longcol, 90));
  const shortBg = String(color.new(cfg.shortcol, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: BfRun = {
        src: [], sub: [], score: [], plot0: [], plot1: [], plot2: [], barColors: [], bgColors: [], flags: [[], []],
        times: [[], []], steps: [], vars: { out: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [s.src, s.sub, s.score, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const time = bar.time;
      const src = s.src;
      src[b] = value(bar);
      let result = 0.0;
      let totalWeight = 0.0;
      for (const i of filterOffsets) {
        const x = at(src, b, i);
        const spatialWeight = Math.exp(-Math.pow(i, 2) / (2 * Math.pow(cfg.sigmaD, 2)));
        const rangeWeight = Math.exp(-Math.pow(src[b] - x, 2) / (2 * Math.pow(cfg.sigmaR, 2)));
        const weight = spatialWeight * rangeWeight;
        result = result + x * weight;
        totalWeight = totalWeight + weight;
      }
      const sub = result / totalWeight;
      s.sub[b] = sub;

      let score = 0.0;
      for (const i of scoreOffsets) score += gt(sub, at(s.sub, b, i)) ? 1 : -1;
      s.score[b] = score;

      // L = score > upper; S = ta.crossunder(score, lower) (exact comparison); var out = 0
      const L = gt(score, cfg.upper);
      const S = b > 0 && score < cfg.lower && s.score[b - 1] >= cfg.lower;
      const long = L && !S;
      s.flags[0][b] = long;
      s.flags[1][b] = S;
      // alertcondition(L and not S, "Bilateral Filter FL Long") / alertcondition(S, "Bilateral Filter FL Short")
      if (long) s.times[0].push(time as number);
      if (S) s.times[1].push(time as number);
      if (long) s.vars.out = 1;
      if (S) s.vars.out = -1;
      const out = s.vars.out;

      s.plot0[b] = { time, value: score, color: trendColor(out) };
      s.plot1[b] = { time, value: cfg.showthres ? cfg.upper : NaN, color: cfg.longcol };
      s.plot2[b] = { time, value: cfg.showthres ? cfg.lower : NaN, color: cfg.shortcol };
      if (cfg.paintCandles) s.barColors.push({ time, color: trendColor(out) });
      if (cfg.bgcol) s.bgColors.push({ time, color: out === 1 ? longBg : out === -1 ? shortBg : color.gray });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BilateralFilterForLoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BilateralFilterForLoopInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BilateralFilterForLoop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
