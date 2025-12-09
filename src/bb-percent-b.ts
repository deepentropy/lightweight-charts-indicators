/**
 * Bollinger Bands %B Indicator
 *
 * Shows where price is relative to the Bollinger Bands.
 * %B = (Price - Lower Band) / (Upper Band - Lower Band)
 * Values above 1 = price above upper band, below 0 = price below lower band
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface BBPercentBInputs {
  /** Period length */
  length: number;
  /** Price source */
  src: SourceType;
  /** Standard deviation multiplier */
  mult: number;
}

export const defaultInputs: BBPercentBInputs = {
  length: 20,
  src: 'close',
  mult: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger Bands %b', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger Bands %b',
  shortTitle: 'BB %b',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BBPercentBInputs> = {}): IndicatorResult {
  const { length, src, mult } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const basis = ta.sma(source, length);
  const dev = ta.stdev(source, length).mul(mult);
  const upper = basis.add(dev);
  const lower = basis.sub(dev);

  // %B = (src - lower) / (upper - lower)
  const basisArr = basis.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();
  const sourceArr = source.toArray();

  const bbr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const u = upperArr[i];
    const l = lowerArr[i];
    const s = sourceArr[i];

    if (u == null || l == null || s == null || u === l) {
      bbr.push(NaN);
    } else {
      bbr.push((s - l) / (u - l));
    }
  }

  const plotData = bbr.map((value, i) => ({
    time: bars[i].time,
    value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const BBPercentB = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
