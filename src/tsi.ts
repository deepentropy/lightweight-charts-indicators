/**
 * True Strength Index (TSI) Indicator
 *
 * A momentum oscillator that uses double-smoothed price changes.
 * TSI = 100 * (double_smooth(pc) / double_smooth(|pc|))
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TSIInputs {
  /** Long EMA period */
  longLength: number;
  /** Short EMA period */
  shortLength: number;
  /** Signal line period */
  signalLength: number;
}

export const defaultInputs: TSIInputs = {
  longLength: 25,
  shortLength: 13,
  signalLength: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 25, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 13, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'True Strength Index', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'True Strength Index',
  shortTitle: 'TSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TSIInputs> = {}): IndicatorResult {
  const { longLength, shortLength, signalLength } = { ...defaultInputs, ...inputs };

  // Price change
  const pc: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    pc.push(bars[i].close - bars[i - 1].close);
  }

  // Absolute price change
  const absPC = pc.map(v => isNaN(v) ? NaN : Math.abs(v));

  // Double smooth function: EMA(EMA(src, long), short)
  const pcSeries = new Series(bars, (_, i) => pc[i]);
  const firstSmoothPC = ta.ema(pcSeries, longLength);
  const doubleSmoothPC = ta.ema(firstSmoothPC, shortLength);
  const doubleSmoothPCArr = doubleSmoothPC.toArray();

  const absPCSeries = new Series(bars, (_, i) => absPC[i]);
  const firstSmoothAbsPC = ta.ema(absPCSeries, longLength);
  const doubleSmoothAbsPC = ta.ema(firstSmoothAbsPC, shortLength);
  const doubleSmoothAbsPCArr = doubleSmoothAbsPC.toArray();

  // TSI = 100 * (double_smooth_pc / double_smooth_abs_pc)
  const tsiValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const dsPC = doubleSmoothPCArr[i];
    const dsAbsPC = doubleSmoothAbsPCArr[i];

    if (dsPC == null || dsAbsPC == null || dsAbsPC === 0) {
      tsiValues.push(NaN);
    } else {
      tsiValues.push(100 * dsPC / dsAbsPC);
    }
  }

  // Signal = EMA(TSI, signalLength)
  const tsiSeries = new Series(bars, (_, i) => tsiValues[i]);
  const signalValues = ta.ema(tsiSeries, signalLength);
  const signalArr = signalValues.toArray();

  const tsiData = tsiValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const signalData = signalArr.map((value: number | null, i: number) => ({
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
      'plot0': tsiData,
      'plot1': signalData,
    },
  };
}

export const TSI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
