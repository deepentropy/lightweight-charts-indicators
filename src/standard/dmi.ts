/**
 * Directional Movement Index (DMI) Indicator
 *
 * Shows trend direction and strength using +DI, -DI, and ADX lines.
 *
 * Based on the standard DMI indicator.
 */

import { ta, type Series, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface DMIInputs {
  /** ADX Smoothing length */
  adxSmoothing: number;
  /** DI Length */
  diLength: number;
}

export const defaultInputs: DMIInputs = {
  adxSmoothing: 14,
  diLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1, tooltip: 'The time period to be used in calculating the ADX which has a smoothing component.' },
  { id: 'diLength', type: 'int', title: 'DI Length', defval: 14, min: 1, tooltip: 'The time period to be used in calculating the DI (Directional Indicator).' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#F50057', lineWidth: 1 },
  { id: 'plot1', title: '+DI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Directional Movement Index',
  shortTitle: 'DMI',
  overlay: false,
};

/**
 * Calculate DMI
 *
 * Algorithm from PineScript:
 * up = ta.change(high)
 * down = -ta.change(low)
 * plusDM = na(up) ? na : (up > down and up > 0 ? up : 0)
 * minusDM = na(down) ? na : (down > up and down > 0 ? down : 0)
 * trur = ta.rma(ta.tr, len)
 * plus = fixnan(100 * ta.rma(plusDM, len) / trur)
 * minus = fixnan(100 * ta.rma(minusDM, len) / trur)
 * sum = plus + minus
 * adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), lensig)
 */
export function calculate(bars: Bar[], inputs: Partial<DMIInputs> = {}): IndicatorResult {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };

  // ta.dmi follows the algorithm above (1e-10 comparisons, ta.tr without handle_na, x / 0 is na for fixnan)
  const [plus, minus, adx] = ta.dmi(bars, diLength, adxSmoothing);
  const toPlot = (s: Series) => {
    const arr = s.toArray();
    return bars.map((bar, i) => ({ time: bar.time, value: arr[i] ?? NaN }));
  };

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': toPlot(adx),
      'plot1': toPlot(plus),
      'plot2': toPlot(minus),
    },
  };
}

export const DMI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
