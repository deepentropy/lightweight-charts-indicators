/**
 * Williams Fractals Indicator
 *
 * Identifies fractal highs and lows - local peaks and troughs in price action.
 * Handles equal-value ties (up to 4 consecutive) on the historical side.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, OutputDecl, OutputValues } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WilliamsFractalsInputs {
  n: number;
}

export const defaultInputs: WilliamsFractalsInputs = {
  n: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Periods', defval: 2, min: 2 },
];

// No line plots — rendered via extended markers (triangleUp/triangleDown)
export const plotConfig: PlotConfig[] = [];

/** Reference outputs: plotshape(downFractal) (triangle down, below bar), then plotshape(upFractal) (above bar). */
export const outputs: OutputDecl[] = [
  { kind: 'shape', id: 'downFractal', title: 'Shapes' },
  { kind: 'shape', id: 'upFractal', title: 'Shapes' },
];

export const metadata = {
  title: 'Williams Fractals',
  shortTitle: 'Fractals',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; outputValues: OutputValues };
type Value = { time: number; value: number };

interface FractalsRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  downCond: Value[];
  upCond: Value[];
}

function study(inputs: Partial<WilliamsFractalsInputs>): BarStudy<FractalsRun, Result> {
  const { n } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: FractalsRun = { markers: [], downCond: [], upCond: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.downCond, s.upCond];
      return s;
    },
    bar(s, t, bars) {
      // Bar t (current bar in PineScript terms) checks if bar c = t - n is a fractal: the fractal is detected at bar
      // t and placed at bar c via offset=-n.
      // Down frontier: bars c+1..c+n must have strictly lower/higher values.
      // Up frontiers (with tie handling): bars before center.
      let up = false;
      let down = false;
      if (t >= n) {
        const c = t - n; // center bar

        // === UP FRACTAL (local high) ===
        {
          // Down frontier: bars after center must have strictly lower highs
          let downFrontier = true;
          for (let i = 1; i <= n; i++) {
            if (c + i > t || bars[c + i].high >= bars[c].high) {
              downFrontier = false;
              break;
            }
          }

          if (downFrontier) {
            // Up frontier 0: strict (no ties)
            let frontier0 = true;
            for (let i = 1; i <= n; i++) {
              if (c - i < 0 || bars[c - i].high >= bars[c].high) { frontier0 = false; break; }
            }

            // Up frontier 1: 1 tie allowed
            let frontier1 = c - 1 >= 0 && bars[c - 1].high <= bars[c].high;
            if (frontier1) {
              for (let i = 1; i <= n; i++) {
                if (c - 1 - i < 0 || bars[c - 1 - i].high >= bars[c].high) { frontier1 = false; break; }
              }
            }

            // Up frontier 2: 2 ties allowed
            let frontier2 = c - 1 >= 0 && bars[c - 1].high <= bars[c].high &&
                            c - 2 >= 0 && bars[c - 2].high <= bars[c].high;
            if (frontier2) {
              for (let i = 1; i <= n; i++) {
                if (c - 2 - i < 0 || bars[c - 2 - i].high >= bars[c].high) { frontier2 = false; break; }
              }
            }

            // Up frontier 3: 3 ties allowed
            let frontier3 = c - 1 >= 0 && bars[c - 1].high <= bars[c].high &&
                            c - 2 >= 0 && bars[c - 2].high <= bars[c].high &&
                            c - 3 >= 0 && bars[c - 3].high <= bars[c].high;
            if (frontier3) {
              for (let i = 1; i <= n; i++) {
                if (c - 3 - i < 0 || bars[c - 3 - i].high >= bars[c].high) { frontier3 = false; break; }
              }
            }

            // Up frontier 4: 4 ties allowed
            let frontier4 = c - 1 >= 0 && bars[c - 1].high <= bars[c].high &&
                            c - 2 >= 0 && bars[c - 2].high <= bars[c].high &&
                            c - 3 >= 0 && bars[c - 3].high <= bars[c].high &&
                            c - 4 >= 0 && bars[c - 4].high <= bars[c].high;
            if (frontier4) {
              for (let i = 1; i <= n; i++) {
                if (c - 4 - i < 0 || bars[c - 4 - i].high >= bars[c].high) { frontier4 = false; break; }
              }
            }

            if (frontier0 || frontier1 || frontier2 || frontier3 || frontier4) {
              up = true;
            }
          }
        }

        // === DOWN FRACTAL (local low) ===
        {
          // Down frontier: bars after center must have strictly higher lows
          let downFrontier = true;
          for (let i = 1; i <= n; i++) {
            if (c + i > t || bars[c + i].low <= bars[c].low) {
              downFrontier = false;
              break;
            }
          }

          if (downFrontier) {
            // Up frontier 0: strict (no ties)
            let frontier0 = true;
            for (let i = 1; i <= n; i++) {
              if (c - i < 0 || bars[c - i].low <= bars[c].low) { frontier0 = false; break; }
            }

            // Up frontier 1: 1 tie allowed
            let frontier1 = c - 1 >= 0 && bars[c - 1].low >= bars[c].low;
            if (frontier1) {
              for (let i = 1; i <= n; i++) {
                if (c - 1 - i < 0 || bars[c - 1 - i].low <= bars[c].low) { frontier1 = false; break; }
              }
            }

            // Up frontier 2: 2 ties allowed
            let frontier2 = c - 1 >= 0 && bars[c - 1].low >= bars[c].low &&
                            c - 2 >= 0 && bars[c - 2].low >= bars[c].low;
            if (frontier2) {
              for (let i = 1; i <= n; i++) {
                if (c - 2 - i < 0 || bars[c - 2 - i].low <= bars[c].low) { frontier2 = false; break; }
              }
            }

            // Up frontier 3: 3 ties allowed
            let frontier3 = c - 1 >= 0 && bars[c - 1].low >= bars[c].low &&
                            c - 2 >= 0 && bars[c - 2].low >= bars[c].low &&
                            c - 3 >= 0 && bars[c - 3].low >= bars[c].low;
            if (frontier3) {
              for (let i = 1; i <= n; i++) {
                if (c - 3 - i < 0 || bars[c - 3 - i].low <= bars[c].low) { frontier3 = false; break; }
              }
            }

            // Up frontier 4: 4 ties allowed
            let frontier4 = c - 1 >= 0 && bars[c - 1].low >= bars[c].low &&
                            c - 2 >= 0 && bars[c - 2].low >= bars[c].low &&
                            c - 3 >= 0 && bars[c - 3].low >= bars[c].low &&
                            c - 4 >= 0 && bars[c - 4].low >= bars[c].low;
            if (frontier4) {
              for (let i = 1; i <= n; i++) {
                if (c - 4 - i < 0 || bars[c - 4 - i].low <= bars[c].low) { frontier4 = false; break; }
              }
            }

            if (frontier0 || frontier1 || frontier2 || frontier3 || frontier4) {
              down = true;
            }
          }
        }

        // Fractal points as extended markers
        if (up) {
          markers(s, bars[c].time as number, 'aboveBar', 'triangleUp', '#009688', 'upFractal');
        }
        if (down) {
          markers(s, bars[c].time as number, 'belowBar', 'triangleDown', '#F44336', 'downFractal');
        }
      }
      // The conditions on the bar they are found on (n bars after the fractal, offset = -n): 1 or 0.
      const time = bars[t].time as number;
      s.downCond[t] = { time, value: down ? 1 : 0 };
      s.upCond[t] = { time, value: up ? 1 : 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        outputValues: { downFractal: s.downCond.slice(), upFractal: s.upCond.slice() },
      };
    },
  };
}

function markers(s: FractalsRun, time: number, position: MarkerData['position'], shape: MarkerData['shape'], color: string, id: string): void {
  s.markers.push({ time, position, shape, color, id, size: 1 });
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsFractalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsFractalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsFractals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, outputs };
