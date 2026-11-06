/**
 * Mid-term Ribbon
 *
 * Two averages of the weighted price (3 * close + 2 * open + high + low) / 7: an EMA of 14 bars (fast) and an SMA
 * of 26 bars (slow). The ribbon between them is red when the fast line is below the slow line, else green.
 *
 * Reference: "Mid-term Ribbon" by Gartav388637
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface MidTermRibbonInputs {}

export const defaultInputs: MidTermRibbonInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Slow SMA', color: color.yellow, lineWidth: 1 },
];

export const metadata = {
  title: 'Mid-term Ribbon',
  shortTitle: 'Mid-term Ribbon',
  overlay: true,
};

/** Pine a < b: b - a > 1e-10 (false with na) */
const lt = (a: number, b: number) => b - a > 1e-10;

type Point = { time: number; value: number; color?: string };

interface RibbonRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(): BarStudy<RibbonRun, IndicatorResult> {
  return {
    init() {
      const ema = taStep.ema(14);
      const sma = new WindowSma(26);
      const s: RibbonRun = { ema, sma, plot0: [], plot1: [], fillColors: [], steps: [ema, sma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const price = (3 * b.close + 2 * b.open + b.high + b.low) / 7;
      // outf = ta.ema((3*close + 2*open + high + low)/7, 14); outs = ta.sma(..., 26)
      const outf = s.ema.step(price);
      const outs = s.sma.step(price);
      s.plot0[i] = { time: b.time, value: outf, color: color.white };
      s.plot1[i] = { time: b.time, value: outs, color: color.yellow };
      // fill(a, b, outf < outs ? color.red : color.green)
      s.fillColors[i] = lt(outf, outs) ? color.red : color.green;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<MidTermRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<MidTermRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const MidTermRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
