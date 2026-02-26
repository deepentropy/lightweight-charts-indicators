/**
 * Know Sure Thing (KST) Indicator
 *
 * Momentum oscillator based on rate of change for four different timeframes,
 * smoothed by SMAs. Signal line is SMA of KST.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface KSTInputs {
  roclen1: number;
  roclen2: number;
  roclen3: number;
  roclen4: number;
  smalen1: number;
  smalen2: number;
  smalen3: number;
  smalen4: number;
  siglen: number;
}

export const defaultInputs: KSTInputs = {
  roclen1: 10,
  roclen2: 15,
  roclen3: 20,
  roclen4: 30,
  smalen1: 10,
  smalen2: 10,
  smalen3: 10,
  smalen4: 15,
  siglen: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'roclen1', type: 'int', title: 'ROC Length #1', defval: 10, min: 1 },
  { id: 'roclen2', type: 'int', title: 'ROC Length #2', defval: 15, min: 1 },
  { id: 'roclen3', type: 'int', title: 'ROC Length #3', defval: 20, min: 1 },
  { id: 'roclen4', type: 'int', title: 'ROC Length #4', defval: 30, min: 1 },
  { id: 'smalen1', type: 'int', title: 'SMA Length #1', defval: 10, min: 1 },
  { id: 'smalen2', type: 'int', title: 'SMA Length #2', defval: 10, min: 1 },
  { id: 'smalen3', type: 'int', title: 'SMA Length #3', defval: 10, min: 1 },
  { id: 'smalen4', type: 'int', title: 'SMA Length #4', defval: 15, min: 1 },
  { id: 'siglen', type: 'int', title: 'Signal Line Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'KST', color: '#009688', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'Know Sure Thing',
  shortTitle: 'KST',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<KSTInputs> = {}): IndicatorResult {
  const { roclen1, roclen2, roclen3, roclen4, smalen1, smalen2, smalen3, smalen4, siglen } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // smaroc(roclen, smalen) => ta.sma(ta.roc(close, roclen), smalen)
  const smaroc1 = ta.sma(ta.roc(close, roclen1), smalen1);
  const smaroc2 = ta.sma(ta.roc(close, roclen2), smalen2);
  const smaroc3 = ta.sma(ta.roc(close, roclen3), smalen3);
  const smaroc4 = ta.sma(ta.roc(close, roclen4), smalen4);

  const arr1 = smaroc1.toArray();
  const arr2 = smaroc2.toArray();
  const arr3 = smaroc3.toArray();
  const arr4 = smaroc4.toArray();

  // KST = smaroc1 + 2*smaroc2 + 3*smaroc3 + 4*smaroc4
  const kstArr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v1 = arr1[i], v2 = arr2[i], v3 = arr3[i], v4 = arr4[i];
    if (v1 == null || v2 == null || v3 == null || v4 == null) {
      kstArr.push(NaN);
    } else {
      kstArr.push(v1 + 2 * v2 + 3 * v3 + 4 * v4);
    }
  }

  const kstSeries = new Series(bars, (_, i) => kstArr[i]);
  const signal = ta.sma(kstSeries, siglen);
  const sigArr = signal.toArray();

  const kstData = kstArr.map((value, i) => ({
    time: bars[i].time,
    value: isNaN(value) ? NaN : value,
  }));

  const sigData = sigArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': kstData, 'plot1': sigData },
  };
}

export const KnowSureThing = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
