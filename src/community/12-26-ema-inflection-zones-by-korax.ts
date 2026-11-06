/**
 * 12/26 EMA Inflection Zones
 *
 * EMA 12 and EMA 26 of the close. The background is green while EMA 12 is above EMA 26 and red while it is below.
 * A green circle below the bar marks a crossover of EMA 12 above EMA 26, a red circle above the bar a crossunder.
 *
 * Reference: "12/26 EMA Inflection Zones by Korax" by Korax
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface EmaInflectionZonesKoraxInputs {}

export const defaultInputs: EmaInflectionZonesKoraxInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 12', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 26', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: '12/26 EMA Inflection Zones',
  shortTitle: '12/26 EMA Inflection Zones',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Point = { time: number; value: number };

interface KoraxRun extends BarRunState<{ prevA: number; prevB: number }> {
  ema12: ReturnType<typeof taStep.ema>;
  ema26: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

const bullBg = String(color.new(color.green, 85));
const bearBg = String(color.new(color.red, 85));

function study(): BarStudy<KoraxRun, Result> {
  return {
    init() {
      const s: KoraxRun = {
        ema12: taStep.ema(12), ema26: taStep.ema(26), plot0: [], plot1: [], bgColors: [], markers: [],
        // ta.crossover / ta.crossunder compare exactly, with the last bar where both values were not na
        steps: [], vars: { prevA: NaN, prevB: NaN }, lists: [], series: [],
      };
      s.steps = [s.ema12, s.ema26];
      s.lists = [s.bgColors, s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const a = s.ema12.step(bars[i].close);
      const b = s.ema26.step(bars[i].close);
      const valid = !isNaN(a) && !isNaN(b);
      const bullCross = valid && !isNaN(v.prevA) && a > b && v.prevA <= v.prevB;
      const bearCross = valid && !isNaN(v.prevA) && a < b && v.prevA >= v.prevB;
      if (valid) {
        v.prevA = a;
        v.prevB = b;
      }
      // bgcolor(bullishArea ? color.new(color.green, 85) : na); bgcolor(bearishArea ? color.new(color.red, 85) : na)
      if (gt(a, b)) s.bgColors.push({ time, color: bullBg });
      else if (gt(b, a)) s.bgColors.push({ time, color: bearBg });
      if (bullCross) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: color.green, size: 'small' });
      }
      if (bearCross) {
        s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: color.red, size: 'small' });
      }
      s.plot0[i] = { time, value: a };
      s.plot1[i] = { time, value: b };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<EmaInflectionZonesKoraxInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<EmaInflectionZonesKoraxInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(_inputs).update(bars));
}

export const EmaInflectionZonesKorax = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
