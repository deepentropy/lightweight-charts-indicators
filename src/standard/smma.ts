/**
 * Smoothed Moving Average (SMMA)
 *
 * Also known as RMA or Wilder's Smoothing.
 * SMMA = (prev_smma * (length - 1) + src) / length
 */

import { getSourceSeries, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface SMMAInputs {
  /** Period length */
  length: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: SMMAInputs = {
  length: 7,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMMA', color: '#673AB7', lineWidth: 1 },
];

export const metadata = {
  title: 'Smoothed Moving Average',
  shortTitle: 'SMMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SMMAInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);

  // SMMA is the same as RMA (Wilder's smoothing)
  const smmaValues = ta.rma(source, length);
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
