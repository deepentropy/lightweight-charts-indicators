/**
 * BBTrend Indicator
 *
 * Uses the difference between short and long Bollinger Bands
 * to identify trend direction and strength.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BBTrendInputs {
  /** Short Bollinger Band length */
  shortLength: number;
  /** Long Bollinger Band length */
  longLength: number;
  /** Standard deviation multiplier */
  stdDev: number;
}

export const defaultInputs: BBTrendInputs = {
  shortLength: 20,
  longLength: 50,
  stdDev: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short BB Length', defval: 20, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long BB Length', defval: 50, min: 1 },
  { id: 'stdDev', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BBTrend', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'BBTrend',
  shortTitle: 'BBTrend',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BBTrendInputs> = {}): IndicatorResult {
  const { shortLength, longLength, stdDev } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // Calculate short BB
  const shortMiddle = ta.sma(close, shortLength);
  const shortStdev = ta.stdev(close, shortLength);
  const shortUpper = shortMiddle.add(shortStdev.mul(stdDev));
  const shortLower = shortMiddle.sub(shortStdev.mul(stdDev));

  // Calculate long BB
  const longMiddle = ta.sma(close, longLength);
  const longStdev = ta.stdev(close, longLength);
  const longUpper = longMiddle.add(longStdev.mul(stdDev));
  const longLower = longMiddle.sub(longStdev.mul(stdDev));

  // BBTrend = (|shortLower - longLower| - |shortUpper - longUpper|) / shortMiddle * 100
  const shortLowerArr = shortLower.toArray();
  const shortUpperArr = shortUpper.toArray();
  const longLowerArr = longLower.toArray();
  const longUpperArr = longUpper.toArray();
  const shortMiddleArr = shortMiddle.toArray();

  const bbTrendData = bars.map((bar, i) => {
    const sL = shortLowerArr[i];
    const sU = shortUpperArr[i];
    const lL = longLowerArr[i];
    const lU = longUpperArr[i];
    const sM = shortMiddleArr[i];

    if (sL == null || sU == null || lL == null || lU == null || sM == null || sM === 0) {
      return { time: bar.time, value: NaN };
    }

    const bbTrend = (Math.abs(sL - lL) - Math.abs(sU - lU)) / sM * 100;
    return { time: bar.time, value: bbTrend };
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': bbTrendData,
    },
  };
}

export const BBTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
