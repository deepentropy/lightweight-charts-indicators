/**
 * Bull Bear Power Indicator
 *
 * Measures the strength of buyers (bulls) and sellers (bears)
 * relative to an exponential moving average.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BullBearPowerInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: BullBearPowerInputs = {
  length: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BBPower', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Bull Bear Power',
  shortTitle: 'BBP',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BullBearPowerInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, b => b.high);
  const low = new Series(bars, b => b.low);
  const close = new Series(bars, b => b.close);

  const ema = ta.ema(close, length);

  // Bull Power = High - EMA
  // Bear Power = Low - EMA
  // BBP = Bull Power + Bear Power = High - EMA + Low - EMA = High + Low - 2*EMA
  const bullPower = high.sub(ema);
  const bearPower = low.sub(ema);
  const bbp = bullPower.add(bearPower);

  const bbpArr = bbp.toArray();
  const bbpData = bbpArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': bbpData,
    },
  };
}

export const BullBearPower = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
