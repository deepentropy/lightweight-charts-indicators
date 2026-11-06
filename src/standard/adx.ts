/**
 * Average Directional Index (ADX) Indicator
 *
 * Measures trend strength regardless of direction.
 * ADX of the Directional Movement Index (ta.dmi): RMA of |+DI - -DI| / (+DI + -DI) * 100.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ADXInputs {
  /** ADX smoothing period */
  adxSmoothing: number;
  /** DI period length */
  diLength: number;
}

export const defaultInputs: ADXInputs = {
  adxSmoothing: 14,
  diLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14, tooltip: 'The time period to be used in calculating the ADX which has a smoothing component.' },
  { id: 'diLength', type: 'int', title: 'DI Length', defval: 14, tooltip: 'The time period to be used in calculating the DI (Directional Indicator).' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#F23645', lineWidth: 1 },
];

export const metadata = {
  title: 'Average Directional Index',
  shortTitle: 'ADX',
  overlay: false,
};

interface AdxRun extends BarRunState<Record<string, never>> {
  dmi: ReturnType<typeof taStep.dmi>;
  adxData: { time: Bar['time']; value: number }[];
}

function study(inputs: Partial<ADXInputs>): BarStudy<AdxRun, IndicatorResult> {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // dirmov(len): up = ta.change(high), down = -ta.change(low)
      //   plusDM = na(up) ? na : (up > down and up > 0 ? up : 0), minusDM likewise
      //   plus = fixnan(100 * ta.rma(plusDM, len) / ta.rma(ta.tr, len)), minus likewise
      // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen): the ADX of ta.dmi
      const dmi = taStep.dmi(diLength, adxSmoothing);
      const s: AdxRun = { dmi, adxData: [], steps: [dmi], vars: {}, lists: [], series: [] };
      s.series = [s.adxData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const [, , adx] = s.dmi.step(bar.high, bar.low, bar.close);
      s.adxData[i] = { time: bar.time, value: adx ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.adxData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ADXInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ADXInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ADX = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
