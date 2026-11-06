/**
 * Price Advance & Decline Range Analysis
 *
 * The bar range d = seriesB - seriesA (close - open by default) is split into an advance part (d >= 0, else 0) and a
 * decline part (d <= 0, else 0), drawn as columns. The largest advance and the largest decline so far (running
 * extremes from 0) are drawn as circles. The average of each part (cumulative average, SMA, EMA or double EMA) is
 * drawn in grey, and the mean of the average and the running extreme in red / lime, with a fill between the extreme
 * and that mean.
 *
 * Reference: "[RS]Price Advance & Decline Range Analysis" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type PriceAdvanceDeclineAverageType =
  | 'Cumulative Average'
  | 'Simple Average'
  | 'Exponential Average'
  | 'Double Exponentional Average';

export interface PriceAdvanceDeclineRangeAnalysisInputs {
  /** Series A (the range is seriesB - seriesA) */
  seriesA: SourceType;
  /** Series B */
  seriesB: SourceType;
  averageType: PriceAdvanceDeclineAverageType;
  /** Length of the simple / exponential averages */
  length: number;
}

export const defaultInputs: PriceAdvanceDeclineRangeAnalysisInputs = {
  seriesA: 'open',
  seriesB: 'close',
  averageType: 'Cumulative Average',
  length: 24,
};

export const inputConfig: InputConfig[] = [
  { id: 'seriesA', type: 'source', title: 'Series A:', defval: 'open' },
  { id: 'seriesB', type: 'source', title: 'Series B:', defval: 'close' },
  {
    id: 'averageType', type: 'string', title: 'Average Type:', defval: 'Cumulative Average',
    options: ['Cumulative Average', 'Simple Average', 'Exponential Average', 'Double Exponentional Average'],
  },
  { id: 'length', type: 'int', title: 'Length:', defval: 24 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PD', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'PN', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'PA', color: color.maroon, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'PA', color: color.green, lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'A', color: color.gray, lineWidth: 2 },
  { id: 'plot5', title: 'A', color: color.gray, lineWidth: 2 },
  { id: 'plot6', title: 'A', color: color.red, lineWidth: 1 },
  { id: 'plot7', title: 'A', color: color.lime, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Advance & Decline Range Analysis',
  shortTitle: 'PA&DRA',
  overlay: false,
  precision: 5,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

type Point = { time: number; value: number; color: string };
type Avg = { step(v: number, barIndex: number): number; commit(): void };

interface PadrVars {
  prevP: number;
  prevN: number;
}

interface PadrRun extends BarRunState<PadrVars> {
  avgPos: Avg;
  avgNeg: Avg;
  plots: Point[][];
}

function study(inputs: Partial<PriceAdvanceDeclineRangeAnalysisInputs>): BarStudy<PadrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcA = barSource(cfg.seriesA);
  const srcB = barSource(cfg.seriesB);
  const average = (): Avg => {
    switch (cfg.averageType) {
      case 'Cumulative Average': {
        // ta.cum(x) / (1 + bar_index)
        const cum = taStep.cum();
        return { step: (x, barIndex) => cum.step(x) / (1 + barIndex), commit: () => cum.commit() };
      }
      case 'Simple Average':
        return new WindowSma(cfg.length);
      case 'Exponential Average':
        { const e = taStep.ema(cfg.length); return { step: (x) => e.step(x), commit: () => e.commit() }; }
      case 'Double Exponentional Average': {
        const e1 = taStep.ema(cfg.length);
        const e2 = taStep.ema(cfg.length);
        return { step: (x) => e2.step(e1.step(x)), commit: () => { e1.commit(); e2.commit(); } };
      }
      default:
        return { step: () => NaN, commit: () => {} };
    }
  };
  const colors = [color.green, color.red, color.maroon, color.green, color.gray, color.gray, color.red, color.lime];
  return {
    fullRunReason: () => (isBarSource(cfg.seriesA) && isBarSource(cfg.seriesB) ? null : 'source of another study'),
    init() {
      const avgPos = average();
      const avgNeg = average();
      const s: PadrRun = {
        avgPos, avgNeg, plots: colors.map(() => []),
        steps: [avgPos, avgNeg], vars: { prevP: NaN, prevN: NaN }, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const d = srcB(b) - srcA(b);
      const pos = ge(d, 0) ? d : 0;
      const neg = le(d, 0) ? d : 0;
      // pdfappex := nz(pdfappex[1]) <= posdifrange ? posdifrange : nz(pdfappex[1])
      const pApex = le(nz(v.prevP), pos) ? pos : nz(v.prevP);
      const nApex = ge(nz(v.prevN), neg) ? neg : nz(v.prevN);
      v.prevP = pApex;
      v.prevN = nApex;
      const avgPos = s.avgPos.step(pos, i);
      const avgNeg = s.avgNeg.step(neg, i);
      // math.avg(avgposrange, pdfappex)
      const avgMaxPos = (avgPos + pApex) / 2;
      const avgMaxNeg = (avgNeg + nApex) / 2;
      const p = s.plots;
      const time = b.time;
      p[0][i] = { time, value: pos, color: colors[0] };
      p[1][i] = { time, value: neg, color: colors[1] };
      p[2][i] = { time, value: pApex, color: colors[2] };
      p[3][i] = { time, value: nApex, color: colors[3] };
      p[4][i] = { time, value: avgPos, color: colors[4] };
      p[5][i] = { time, value: avgNeg, color: colors[5] };
      p[6][i] = { time, value: avgMaxPos, color: colors[6] };
      p[7][i] = { time, value: avgMaxNeg, color: colors[7] };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots,
        // hline(0, '', color.black): default dashed style
        hlines: [{ value: 0, options: { title: '', color: color.black, linestyle: 'dashed' } }],
        // fill(ta0, ta1, #ff52523f); fill(ba0, ba1, #00e6773f)
        fills: [
          { plot1: 'plot2', plot2: 'plot6', options: { color: '#ff52523f' } },
          { plot1: 'plot3', plot2: 'plot7', options: { color: '#00e6773f' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceAdvanceDeclineRangeAnalysisInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceAdvanceDeclineRangeAnalysisInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceAdvanceDeclineRangeAnalysis = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
