/**
 * Money Flow Index (MFI) Indicator
 *
 * Volume-weighted RSI that measures buying and selling pressure.
 * Range: 0 to 100
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MFIInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: MFIInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1, max: 2000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MF', color: '#7E57C2', lineWidth: 1 },
];

export const metadata = {
  title: 'Money Flow Index',
  shortTitle: 'MFI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MFIInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Typical price = hlc3 = (high + low + close) / 3
  const typicalPrice = bars.map(b => (b.high + b.low + b.close) / 3);

  // Raw money flow = typical price * volume
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * (bars[i].volume ?? 0));

  // Determine if price went up or down
  const mfiValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length) {
      mfiValues.push(NaN);
      continue;
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - length + 1; j <= i; j++) {
      if (j === 0) continue;

      if (typicalPrice[j] > typicalPrice[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrice[j] < typicalPrice[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }

    if (negativeFlow === 0) {
      mfiValues.push(100);
    } else {
      const moneyFlowRatio = positiveFlow / negativeFlow;
      const mfi = 100 - (100 / (1 + moneyFlowRatio));
      mfiValues.push(mfi);
    }
  }

  const mfiData = mfiValues.map((value, i) => ({
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
      'plot0': mfiData,
    },
  };
}

export const MFI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
