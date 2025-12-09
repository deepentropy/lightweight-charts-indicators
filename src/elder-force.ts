/**
 * Elder Force Index (EFI) Indicator
 *
 * Measures the power behind price movements using
 * price change and volume.
 * EFI = EMA(change(close) * volume, length)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ElderForceInputs {
  /** EMA period length */
  length: number;
}

export const defaultInputs: ElderForceInputs = {
  length: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Elder Force Index', color: '#F44336', lineWidth: 1 },
];

export const metadata = {
  title: 'Elder Force Index',
  shortTitle: 'EFI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ElderForceInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Calculate change(close) * volume
  const force: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    force.push(change * (bars[i].volume ?? 0));
  }

  // EMA of force
  const forceSeries = new Series(bars, (_, i) => force[i]);
  const efi = ta.ema(forceSeries, length);
  const efiArr = efi.toArray();

  const efiData = efiArr.map((value: number | null, i: number) => ({
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
      'plot0': efiData,
    },
  };
}

export const ElderForceIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
