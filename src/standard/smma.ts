/**
 * Smoothed Moving Average (SMMA)
 *
 * Also known as RMA or Wilder's Smoothing.
 * SMMA = (prev_smma * (length - 1) + src) / length
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SMMAInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: SMMAInputs = {
  length: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Smoothed Moving Average',
  shortTitle: 'SMMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SMMAInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // SMMA is the same as RMA (Wilder's smoothing)
  const smmaValues = ta.rma(close, length);
  const smmaArr = smmaValues.toArray();

  const smmaData = smmaArr.map((value: number | null, i: number) => ({
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
      'plot0': smmaData,
    },
  };
}

export const SMMA = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
