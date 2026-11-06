/**
 * Profit Nomad Testing 2 - with Buy and Sell (WaveTrend)
 *
 * WaveTrend of hlc3: esa = EMA(ap, n1), d = EMA(|ap - esa|, n1), ci = (ap - esa) / (0.015 * d),
 * WT1 = EMA(ci, n2), WT2 = SMA(WT1, 4). WT1, WT2 and WT1 - WT2 are drawn as areas with a zero line and two
 * overbought / oversold levels. Crosses of WT1 and WT2 are marked at WT2 by a thick line point and a circle, red when
 * WT2 is above WT1, lime otherwise.
 *
 * Reference: "Profit Nomad Testing 2 - with Buy and Sell" by ProfitNomad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicTestingInputs {
  /** Channel length (EMA of hlc3 and of the distance) */
  n1: number;
  /** Average length (EMA of the CI) */
  n2: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: DynamicTestingInputs = {
  n1: 10,
  n2: 21,
  obLevel1: 60.0,
  obLevel2: 53.0,
  osLevel1: -60.0,
  osLevel2: -53.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'n1', type: 'int', title: 'Channel Length', defval: 10 },
  { id: 'n2', type: 'int', title: 'Average Length', defval: 21 },
  { id: 'obLevel1', type: 'float', title: 'Over Bought Level 1', defval: 60.0 },
  { id: 'obLevel2', type: 'float', title: 'Over Bought Level 2', defval: 53.0 },
  { id: 'osLevel1', type: 'float', title: 'Over Sold Level 1', defval: -60.0 },
  { id: 'osLevel2', type: 'float', title: 'Over Sold Level 2', defval: -53.0 },
];

const WT_COL = String(color.new(color.blue, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Overbought Level 1', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Oversold Level 1', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Overbought Level 2', color: color.red, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold Level 2', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'WT1', color: WT_COL, lineWidth: 1, style: 'area' },
  { id: 'plot6', title: 'WT2', color: WT_COL, lineWidth: 1, style: 'area' },
  { id: 'plot7', title: 'WT1 - WT2', color: color.yellow, lineWidth: 1, style: 'area' },
  { id: 'plot8', title: 'Cross Line', color: color.black, lineWidth: 5 },
  { id: 'plot9', title: 'Cross Circles', color: color.lime, lineWidth: 6, style: 'circles' },
];

export const metadata = {
  title: 'Profit Nomad Testing 2 - with Buy and Sell',
  shortTitle: 'Profit Nomad Buy and Sell',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Non-finite values (na, +-infinity) are na for the averages and the plots */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: number; value: number; color?: string };

interface DtVars {
  /** The last wt1 / wt2 where both were not na (ta.cross) */
  p1: number;
  p2: number;
}

interface DtRun extends BarRunState<DtVars> {
  esa: ReturnType<typeof taStep.ema>;
  d: ReturnType<typeof taStep.ema>;
  wt1: ReturnType<typeof taStep.ema>;
  wt2: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<DynamicTestingInputs>): BarStudy<DtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: DtRun = {
        esa: taStep.ema(cfg.n1), d: taStep.ema(cfg.n1), wt1: taStep.ema(cfg.n2), wt2: new WindowSma(4),
        plots: Array.from({ length: 10 }, () => []),
        steps: [], vars: { p1: NaN, p2: NaN }, lists: [], series: [],
      };
      s.steps = [s.esa, s.d, s.wt1, s.wt2];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ap = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(ap);
      const d = s.d.step(Math.abs(ap - esa));
      // ci = (ap - esa) / (0.015 * d): x / 0 is +-infinity, 0 / 0 na; ta.ema skips both
      const ci = (ap - esa) / (0.015 * d);
      const wt1 = s.wt1.step(fin(ci));
      const wt2 = s.wt2.step(wt1);

      // ta.cross(wt1, wt2): compared with the last bar where both values were not na; a tie there counts; exact
      // comparisons (no tolerance)
      const v = s.vars;
      const cross = (wt1 > wt2 && v.p1 <= v.p2) || (wt1 < wt2 && v.p1 >= v.p2);
      if (!isNaN(wt1) && !isNaN(wt2)) {
        v.p1 = wt1;
        v.p2 = wt2;
      }

      const time = b.time as number;
      const p = s.plots;
      p[0][i] = { time, value: 0 };
      p[1][i] = { time, value: cfg.obLevel1 };
      p[2][i] = { time, value: cfg.osLevel1 };
      p[3][i] = { time, value: cfg.obLevel2 };
      p[4][i] = { time, value: cfg.osLevel2 };
      p[5][i] = { time, value: wt1 };
      p[6][i] = { time, value: wt2 };
      p[7][i] = { time, value: wt1 - wt2 };
      p[8][i] = { time, value: cross ? wt2 : NaN };
      // color = wt2 - wt1 > 0 ? color.red : color.lime
      p[9][i] = { time, value: cross ? wt2 : NaN, color: gt(wt2 - wt1, 0) ? color.red : color.lime };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicTestingInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicTestingInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicTesting = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
