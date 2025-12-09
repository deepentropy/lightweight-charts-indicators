/**
 * Chande Momentum Oscillator (CMO) Indicator
 *
 * Measures momentum on both up and down days.
 * Range: -100 to +100
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChandeMOInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: ChandeMOInputs = {
  length: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chande MO', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Chande Momentum Oscillator',
  shortTitle: 'ChandeMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ChandeMOInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const close = bars.map(b => b.close);

  // Calculate momentum (change)
  const mom: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    mom.push(close[i] - close[i - 1]);
  }

  // Separate positive and negative momentum
  const m1 = mom.map(m => (m >= 0 ? m : 0)); // positive
  const m2 = mom.map(m => (m >= 0 ? 0 : -m)); // negative (absolute)

  // Calculate sums over length period
  const chandeMO: (number | null)[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length) {
      chandeMO.push(NaN);
      continue;
    }

    let sm1 = 0;
    let sm2 = 0;
    for (let j = i - length + 1; j <= i; j++) {
      if (!isNaN(m1[j])) sm1 += m1[j];
      if (!isNaN(m2[j])) sm2 += m2[j];
    }

    const sum = sm1 + sm2;
    if (sum === 0) {
      chandeMO.push(0);
    } else {
      chandeMO.push(100 * (sm1 - sm2) / sum);
    }
  }

  const cmoData = chandeMO.map((value, i) => ({
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
      'plot0': cmoData,
    },
  };
}

export const ChandeMO = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
