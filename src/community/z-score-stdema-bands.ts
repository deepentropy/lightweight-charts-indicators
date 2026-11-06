/**
 * Z-Score STDEMA Bands
 *
 * Z-score of the source: (source - sma(source, length)) / stdev(source, length). Bands around the z-score:
 * ema(z, stdEmaLength) +- stdev(z, stdEmaLength). Horizontal lines at 0 and +-1, +-2, +-3. The bars turn blue when
 * the z-score is above 0 and above the upper band, and yellow when it is below 0 and below the lower band; the colour
 * stays until the other condition comes.
 *
 * Reference: "Z-Score STDEMA Bands" by TiagoTF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
  type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZScoreStdemaBandsInputs {
  source: SourceType;
  /** Z-score length */
  length: number;
  /** EMA / stdev length of the bands */
  stdEmaLength: number;
  /** Not used by the computation (Pine input "STD length") */
  stdLengh: number;
}

export const defaultInputs: ZScoreStdemaBandsInputs = {
  source: 'close',
  length: 50,
  stdEmaLength: 28,
  stdLengh: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Z-Score Length', defval: 50 },
  { id: 'stdEmaLength', type: 'int', title: 'STDEMA Length', defval: 28 },
  { id: 'stdLengh', type: 'float', title: 'STD length', defval: 1.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'STDEMA Upper Band', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'STDEMA Lower Band', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Z-Score STDEMA Bands',
  shortTitle: 'Z-Score STDEMA Bands',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface ZScoreVars {
  /** var color color = na (null) */
  col: string | null;
}

interface ZScoreRun extends BarRunState<ZScoreVars> {
  mean: WindowSma;
  std: WindowStdev;
  zEma: ReturnType<typeof taStep.ema>;
  zStd: WindowStdev;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<ZScoreStdemaBandsInputs>): BarStudy<ZScoreRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const mean = new WindowSma(cfg.length);
      const std = new WindowStdev(cfg.length);
      const zEma = taStep.ema(cfg.stdEmaLength);
      const zStd = new WindowStdev(cfg.stdEmaLength);
      const s: ZScoreRun = {
        mean, std, zEma, zStd, plots: [[], [], []], barColors: [], steps: [mean, std, zEma, zStd], vars: { col: null },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = value(b);
      const mean = s.mean.step(src);
      const std = s.std.step(src);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema / ta.stdev skip the infinite value like na, the
      // comparisons use it, the plot shows na
      const z = (src - mean) / std;
      const zEma = s.zEma.step(z);
      const zStd = s.zStd.step(z);
      const up = zEma + zStd;
      const down = zEma - zStd;

      if (gt(z, 0) && gt(z, up)) v.col = color.blue;
      if (lt(z, 0) && lt(z, down)) v.col = color.yellow;
      if (v.col !== null) s.barColors.push({ time: b.time as number, color: v.col });

      s.plots[0][i] = { time: b.time, value: fin(z), color: color.orange };
      s.plots[1][i] = { time: b.time, value: fin(up), color: color.green };
      s.plots[2][i] = { time: b.time, value: fin(down), color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
          { value: 1, options: { title: '+1 SD', color: color.gray, linestyle: 'dotted' } },
          { value: 2, options: { title: '+2 SD', color: color.gray, linestyle: 'dotted' } },
          { value: 3, options: { title: '+3 SD', color: color.gray, linestyle: 'dotted' } },
          { value: -1, options: { title: '-1 SD', color: color.gray, linestyle: 'dotted' } },
          { value: -2, options: { title: '-2 SD', color: color.gray, linestyle: 'dotted' } },
          { value: -3, options: { title: '-3 SD', color: color.gray, linestyle: 'dotted' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZScoreStdemaBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZScoreStdemaBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ZScoreStdemaBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
