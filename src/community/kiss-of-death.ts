/**
 * Kiss Of Death
 *
 * A 21-bar EMA of the close and a sell signal: the close is below the EMA, the previous close is at or above the
 * current EMA, and the low is below the lowest low of the two previous bars. The signal is a red triangle above the
 * bar with the text "kiss_of_death".
 *
 * Reference: "Kiss Of Death" by thanos300693
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © thanos300693
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KissOfDeathInputs {}

export const defaultInputs: KissOfDeathInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '21 EMA', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Kiss Of Death',
  shortTitle: 'Kiss Of Death',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface KissRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  low2: WindowExtreme;
  lowest2: number[];
  emaData: { time: number; value: number; color: string }[];
  markers: MarkerData[];
}

function study(_inputs: Partial<KissOfDeathInputs>): BarStudy<KissRun, Result> {
  return {
    init() {
      const ema = taStep.ema(21);
      const low2 = new WindowExtreme(true, 2);
      const s: KissRun = { ema, low2, lowest2: [], emaData: [], markers: [], steps: [ema, low2], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.lowest2, s.emaData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ema21 = s.ema.step(b.close);
      s.lowest2[i] = s.low2.step(b.low);
      s.emaData[i] = { time: b.time, value: ema21, color: color.blue };
      if (i < 1) return;
      const prevLow = s.lowest2[i - 1]; // ta.lowest(low, 2)[1]
      // close < ema21 and close[1] >= ema21 and low < prev_low
      if (lt(b.close, ema21) && ge(bars[i - 1].close, ema21) && lt(b.low, prevLow)) {
        s.markers.push({
          time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'auto',
          text: 'kiss_of_death', textColor: color.white,
        });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.emaData.slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KissOfDeathInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KissOfDeathInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const KissOfDeath = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
