/**
 * Williams Fractals Indicator
 *
 * Identifies fractal highs and lows - local peaks and troughs in price action.
 * Handles equal-value ties (up to 4 consecutive) on the historical side.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WilliamsFractalsInputs {
  n: number;
}

export const defaultInputs: WilliamsFractalsInputs = {
  n: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Periods', defval: 2, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Down Fractals', color: '#F44336', lineWidth: 1 },
  { id: 'plot1', title: 'Up Fractals', color: '#009688', lineWidth: 1 },
];

export const metadata = {
  title: 'Williams Fractals',
  shortTitle: 'Fractals',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsFractalsInputs> = {}): IndicatorResult {
  const { n } = { ...defaultInputs, ...inputs };

  const upFractalValues: number[] = new Array(bars.length).fill(NaN);
  const downFractalValues: number[] = new Array(bars.length).fill(NaN);

  // For each bar t (current bar in PineScript terms), check if bar t-n is a fractal.
  // The fractal is detected at bar t and placed at bar c = t - n via offset=-n.
  // So we iterate t from n to bars.length-1, checking center c = t - n.
  // Down frontier: bars c+1..c+n must have strictly lower/higher values.
  // Up frontiers (with tie handling): bars before center.

  for (let t = n; t < bars.length; t++) {
    const c = t - n; // center bar

    // === UP FRACTAL (local high) ===
    {
      // Down frontier: bars after center must have strictly lower highs
      let downFrontier = true;
      for (let i = 1; i <= n; i++) {
        if (c + i >= bars.length || bars[c + i].high >= bars[c].high) {
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
          upFractalValues[c] = bars[c].high;
        }
      }
    }

    // === DOWN FRACTAL (local low) ===
    {
      // Down frontier: bars after center must have strictly higher lows
      let downFrontier = true;
      for (let i = 1; i <= n; i++) {
        if (c + i >= bars.length || bars[c + i].low <= bars[c].low) {
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
          downFractalValues[c] = bars[c].low;
        }
      }
    }
  }

  const downData = downFractalValues.map((v, i) => ({ time: bars[i].time, value: v }));
  const upData = upFractalValues.map((v, i) => ({ time: bars[i].time, value: v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': downData, 'plot1': upData },
  };
}

export const WilliamsFractals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
