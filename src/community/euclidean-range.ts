/**
 * Euclidean Range
 *
 * A moving average (SMA, EMA or HMA) of the source is the reference. The Euclidean distance between the source and
 * the reference over the last `length` bars is dist = sqrt(sum((src[i] - ref[i])^2)). The bands are reference +- dist
 * (drawn on the price pane). The pane shows the z-scores over `zLength` bars of dist / src (high volatility) and of
 * src / dist (low volatility). The price pane background takes a red gradient of the low-volatility z-score when it is
 * above the high-volatility z-score and above 0.5.
 *
 * Reference: "Euclidean Range [InvestorUnknown]" by InvestorUnknown
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © InvestorUnknown
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData } from '../types';

export interface EuclideanRangeInputs {
  /** Window length of the average and of the distance */
  length: number;
  /** Z-score lookback */
  zLength: number;
  source: SourceType;
  avgType: 'SMA' | 'EMA' | 'HMA';
  /** Allow intra-bar updating (false: the outputs of the previous bar) */
  intrabar: boolean;
  /** Plot the moving average */
  plotMa: boolean;
  colorBg: boolean;
}

export const defaultInputs: EuclideanRangeInputs = {
  length: 14,
  zLength: 100,
  source: 'close',
  avgType: 'HMA',
  intrabar: true,
  plotMa: false,
  colorBg: true,
};

const G1 = 'Indicator Settings';
const G2 = 'Plot Settings';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Window Length', defval: 14, min: 1, group: G1 },
  { id: 'zLength', type: 'int', title: 'Z-Score Length', defval: 100, group: G1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: G1 },
  { id: 'avgType', type: 'string', title: 'Average Type', defval: 'HMA', options: ['SMA', 'EMA', 'HMA'], group: G1 },
  { id: 'intrabar', type: 'bool', title: 'Allow Intra-bar Updating', defval: true, group: G2 },
  { id: 'plotMa', type: 'bool', title: 'Plot moving average', defval: false, group: G2 },
  { id: 'colorBg', type: 'bool', title: 'Color Background', defval: true, group: G2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot1', title: 'Upper bound', color: color.purple, lineWidth: 2, forceOverlay: true },
  { id: 'plot2', title: 'Lower bound', color: color.yellow, lineWidth: 2, forceOverlay: true },
  { id: 'plot3', title: 'High-volatility Z-Score', color: color.white, lineWidth: 3 },
  { id: 'plot4', title: 'Low-volatility Z-Score', color: color.red, lineWidth: 3 },
];

export const metadata = {
  title: 'Euclidean Range [InvestorUnknown]',
  shortTitle: 'Euclidean Range',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface EuclideanRun extends BarRunState<Record<string, never>> {
  ref: { step(v: number): number; commit(): void };
  avgR: WindowSma;
  sdR: WindowStdev;
  avgV: WindowSma;
  sdV: WindowStdev;
  src: number[];
  reference: number[];
  upper: number[];
  lower: number[];
  zR: number[];
  zV: number[];
  bgCol: Array<string | null>;
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<EuclideanRangeInputs>): BarStudy<EuclideanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, zLength } = cfg;
  const value = barSource(cfg.source);
  const red90 = String(color.new(color.red, 90));
  const red50 = String(color.new(color.red, 50));
  // i = intrabar ? 0 : 1: the plots show x[i]
  const lag = cfg.intrabar ? 0 : 1;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      let ref: EuclideanRun['ref'];
      if (cfg.avgType === 'SMA') ref = new WindowSma(length);
      else if (cfg.avgType === 'EMA') ref = taStep.ema(length);
      else ref = taStep.hma(length);
      const avgR = new WindowSma(zLength);
      const sdR = new WindowStdev(zLength);
      const avgV = new WindowSma(zLength);
      const sdV = new WindowStdev(zLength);
      const s: EuclideanRun = {
        ref, avgR, sdR, avgV, sdV, src: [], reference: [], upper: [], lower: [], zR: [], zV: [], bgCol: [],
        plots: [[], [], [], [], []], bgColors: [],
        steps: [ref, avgR, sdR, avgV, sdV], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.src, s.reference, s.upper, s.lower, s.zR, s.zV, s.bgCol, ...s.plots];
      return s;
    },
    bar(s, t, bars) {
      const b = bars[t];
      const src = s.src;
      const reference = s.reference;
      const x = value(b);
      src[t] = x;
      const r = s.ref.step(x);
      reference[t] = r;
      // euclidean_distance(source, reference, length): sqrt(sum of (src[i] - ref[i])^2, i = 0 .. length - 1); a missing
      // bar (na) gives na
      let sum = 0;
      for (let i = 0; i <= length - 1; i++) {
        const diff = t - i >= 0 ? src[t - i] - reference[t - i] : NaN;
        sum += diff * diff;
      }
      const dist = Math.sqrt(sum);
      s.upper[t] = r + dist;
      s.lower[t] = r - dist;
      // Plain divisions: x / 0 is +-infinity (0 / 0 na), as Pine
      const distR = dist / x;
      const distV = x / dist;

      // z_score(x, lookback) = (x - sma(x, lookback)) / stdev(x, lookback)
      const zR = (distR - s.avgR.step(distR)) / s.sdR.step(distR);
      const zV = (distV - s.avgV.step(distV)) / s.sdV.step(distV);
      s.zR[t] = zR;
      s.zV[t] = zV;

      // bg_col = (z_v > z_r and z_v > 0.5) ? color.from_gradient(z_v, 0, 10, color.new(color.red, 90), color.new(color.red, 50)) : na
      s.bgCol[t] = gt(zV, zR) && gt(zV, 0.5) ? String(color.from_gradient(zV, 0, 10, red90, red50)) : null;

      const j = t - lag;
      const at = (arr: number[]) => (j >= 0 ? fin(arr[j]) : NaN);
      const time = b.time;
      s.plots[0][t] = { time, value: cfg.plotMa ? at(reference) : NaN };
      s.plots[1][t] = { time, value: at(s.upper) };
      s.plots[2][t] = { time, value: at(s.lower) };
      s.plots[3][t] = { time, value: at(s.zR) };
      s.plots[4][t] = { time, value: at(s.zV) };
      if (cfg.colorBg) {
        const c = j >= 0 ? s.bgCol[j] : null;
        if (c !== null) s.bgColors.push({ time, color: c, forceOverlay: true });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [{ value: 0, options: { title: 'Mid line', color: color.gray, linestyle: 'dashed', linewidth: 2 } }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EuclideanRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EuclideanRangeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EuclideanRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
