/**
 * SMI Ergodic Oscillator
 *
 * The difference between SMI Ergodic and its signal line, displayed as a histogram.
 * Oscillator = SMI - Signal
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SMIErgodicOscInputs {
  /** Long period */
  longLength: number;
  /** Short period */
  shortLength: number;
  /** Signal period */
  signalLength: number;
}

export const defaultInputs: SMIErgodicOscInputs = {
  longLength: 20,
  shortLength: 5,
  signalLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 20, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'SMI Ergodic Oscillator',
  shortTitle: 'SMIO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SMIErgodicOscInputs> = {}): IndicatorResult {
  const { longLength, shortLength, signalLength } = { ...defaultInputs, ...inputs };

  // Price change
  const pc: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    pc.push(bars[i].close - bars[i - 1].close);
  }

  // Absolute price change
  const absPC = pc.map(v => isNaN(v) ? NaN : Math.abs(v));

  // Double smooth
  const pcSeries = new Series(bars, (_, i) => pc[i]);
  const firstSmoothPC = ta.ema(pcSeries, shortLength);
  const doubleSmoothPC = ta.ema(firstSmoothPC, longLength);
  const doubleSmoothPCArr = doubleSmoothPC.toArray();

  const absPCSeries = new Series(bars, (_, i) => absPC[i]);
  const firstSmoothAbsPC = ta.ema(absPCSeries, shortLength);
  const doubleSmoothAbsPC = ta.ema(firstSmoothAbsPC, longLength);
  const doubleSmoothAbsPCArr = doubleSmoothAbsPC.toArray();

  // SMI = 100 * doubleSmoothPC / doubleSmoothAbsPC
  const smiValues: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const dsPC = doubleSmoothPCArr[i];
    const dsAbsPC = doubleSmoothAbsPCArr[i];

    if (dsPC == null || dsAbsPC == null || dsAbsPC === 0) {
      smiValues.push(NaN);
    } else {
      smiValues.push(100 * dsPC / dsAbsPC);
    }
  }

  // Signal = EMA(SMI, signalLength)
  const smiSeries = new Series(bars, (_, i) => smiValues[i]);
  const signalValues = ta.ema(smiSeries, signalLength);
  const signalArr = signalValues.toArray();

  // Oscillator = SMI - Signal
  const oscValues = smiValues.map((smi, i) => {
    const signal = signalArr[i];
    if (isNaN(smi) || signal == null || isNaN(signal)) {
      return NaN;
    }
    return smi - signal;
  });

  const oscData = oscValues.map((value, i) => ({
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
      'plot0': oscData,
    },
  };
}

export const SMIErgodicOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
