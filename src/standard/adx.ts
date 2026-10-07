/**
 * Average Directional Index (ADX) Indicator
 *
 * Measures trend strength regardless of direction.
 * ADX of the Directional Movement Index (ta.dmi): RMA of |+DI - -DI| / (+DI + -DI) * 100.
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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

export function calculate(bars: Bar[], inputs: Partial<ADXInputs> = {}): IndicatorResult {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };

  // dirmov(len): up = ta.change(high), down = -ta.change(low)
  //   plusDM = na(up) ? na : (up > down and up > 0 ? up : 0), minusDM likewise
  //   plus = fixnan(100 * ta.rma(plusDM, len) / ta.rma(ta.tr, len)), minus likewise
  // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen): the ADX of ta.dmi
  const [, , adx] = ta.dmi(bars, diLength, adxSmoothing);
  const adxArr = adx.toArray();

  const adxData = bars.map((bar, i) => ({
    time: bar.time,
    value: adxArr[i] ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': adxData,
    },
  };
}

export const ADX = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
