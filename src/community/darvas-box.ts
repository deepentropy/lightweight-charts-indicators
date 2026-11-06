/**
 * DARVAS BOX
 *
 * Darvas Box trading method. Tracks N-bar highs to define box tops,
 * with box bottom as the lowest low during the lookback.
 * Box persists until price breaks above top or below bottom.
 *
 * Reference: "DARVAS BOX" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DarvasBoxInputs {
  boxLength: number;
}

export const defaultInputs: DarvasBoxInputs = {
  boxLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'boxLength', type: 'int', title: 'Box Length', defval: 5, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Box Top', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Box Bottom', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Darvas Box',
  shortTitle: 'Darvas',
  overlay: true,
};

type Point = { time: number; value: number };

interface DarvasVars {
  boxTop: number;
  boxBot: number;
}

interface DarvasRun extends BarRunState<DarvasVars> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<DarvasBoxInputs>): BarStudy<DarvasRun, IndicatorResult> {
  const { boxLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hh = new WindowExtreme(false, boxLength);
      const ll = new WindowExtreme(true, boxLength);
      const s: DarvasRun = {
        hh, ll, plot0: [], plot1: [], steps: [hh, ll], vars: { boxTop: NaN, boxBot: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const hhv = s.hh.step(bar.high);
      const llv = s.ll.step(bar.low);
      const v = s.vars;
      if (i >= boxLength) {
        const hh = hhv ?? bar.high;
        const ll = llv ?? bar.low;

        // Detect new high (potential new box)
        if (bar.high >= hh) {
          // New box: top = current high, bottom = lowest of lookback
          v.boxTop = bar.high;
          v.boxBot = ll;
        } else if (!isNaN(v.boxTop)) {
          // Check for breakout
          if (bar.close > v.boxTop) {
            // Upside breakout: start new box search
            v.boxTop = bar.high;
            v.boxBot = ll;
          } else if (bar.close < v.boxBot) {
            // Downside breakout: invalidate box
            v.boxTop = hh;
            v.boxBot = ll;
          }
        }
      }
      s.plot0[i] = { time: bar.time, value: i < boxLength ? NaN : v.boxTop };
      s.plot1[i] = { time: bar.time, value: i < boxLength ? NaN : v.boxBot };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DarvasBoxInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DarvasBoxInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}


export const DarvasBox = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
