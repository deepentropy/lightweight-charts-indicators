/**
 * Directional Movement Index (DMI) Indicator
 *
 * Shows trend direction and strength using +DI, -DI, and ADX lines.
 *
 * Based on the standard DMI indicator.
 */

import { taStep, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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
type Point = { time: number; value: number };

interface DmiRun extends BarRunState<Record<string, never>> {
  dmi: ReturnType<typeof taStep.dmi>;
  adx: Point[];
  plus: Point[];
  minus: Point[];
}

function study(inputs: Partial<DMIInputs>): BarStudy<DmiRun, IndicatorResult> {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // ta.dmi follows the algorithm above (1e-10 comparisons, ta.tr without handle_na, x / 0 is na for fixnan)
      const dmi = taStep.dmi(diLength, adxSmoothing);
      const s: DmiRun = { dmi, adx: [], plus: [], minus: [], steps: [dmi], vars: {}, lists: [], series: [] };
      s.series = [s.adx, s.plus, s.minus];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const [plus, minus, adx] = s.dmi.step(b.high, b.low, b.close);
      s.adx[i] = { time: b.time as number, value: adx ?? NaN };
      s.plus[i] = { time: b.time as number, value: plus ?? NaN };
      s.minus[i] = { time: b.time as number, value: minus ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.adx.slice(),
          'plot1': s.plus.slice(),
          'plot2': s.minus.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DMIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DMIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DMI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
