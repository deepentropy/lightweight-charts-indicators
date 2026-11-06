/**
 * Unicorn Setup Detector
 *
 * Breaker levels from the 3-bar highest high / lowest low and a "fair value gap" from the 2-bar high - low range.
 * Bullish zone = lowest low (3) + gap / 2, bearish zone = highest high (3) - gap / 2. A buy triangle marks a close
 * crossing above the bullish zone, a sell triangle a close crossing below the bearish zone; both are drawn one bar
 * back (Pine offset = -1).
 *
 * Reference: "Unicorn Setup Detector" by mohammedazizabid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no input
export interface UnicornSetupDetectorInputs {}

export const defaultInputs: UnicornSetupDetectorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are plotshape triangles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Unicorn Setup Detector',
  shortTitle: 'Unicorn Setup Detector',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface UnicornRun extends BarRunState<Record<string, never>> {
  hh3: WindowExtreme;
  ll3: WindowExtreme;
  hh2: WindowExtreme;
  ll2: WindowExtreme;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  markers: MarkerData[];
}

function study(): BarStudy<UnicornRun, Result> {
  return {
    init() {
      const hh3 = new WindowExtreme(false, 3);
      const ll3 = new WindowExtreme(true, 3);
      const hh2 = new WindowExtreme(false, 2);
      const ll2 = new WindowExtreme(true, 2);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: UnicornRun = {
        hh3, ll3, hh2, ll2, over, under, markers: [],
        steps: [hh3, ll3, hh2, ll2, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // hhll(high, low): ta.highest(high, 3), ta.lowest(low, 3)
      const highestHigh = s.hh3.step(b.high);
      const lowestLow = s.ll3.step(b.low);
      // prevHigh / prevLow (ta.valuewhen) are not used by any output
      // fvgBullish = fvgBearish = ta.highest(high, 2) - ta.lowest(low, 2)
      const low2 = s.ll2.step(b.low);
      const range2 = s.hh2.step(b.high) - low2;
      const unicornZoneBullish = lowestLow + range2 / 2;
      const unicornZoneBearish = highestHigh - range2 / 2;

      // ta.crossover / ta.crossunder: exact comparisons (library functions)
      const bullishRetest = s.over.step(b.close, unicornZoneBullish);
      const bearishRetest = s.under.step(b.close, unicornZoneBearish);
      if (i < 1) return;
      const t = bars[i - 1].time;
      // plotshape(bullishRetest, "Buy Signal", shape.triangleup, location.belowbar, color.blue, size.tiny, offset = -1)
      if (bullishRetest) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.blue, size: 'tiny' });
      }
      // plotshape(bearishRetest, "Sell Signal", shape.triangledown, location.abovebar, color.red, size.tiny, offset = -1)
      if (bearishRetest) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<UnicornSetupDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<UnicornSetupDetectorInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const UnicornSetupDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
