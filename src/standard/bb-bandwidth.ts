/**
 * Bollinger BandWidth Indicator
 *
 * Measures the width of Bollinger Bands as a percentage of the basis.
 * BBW = ((Upper - Lower) / Basis) * 100
 * Useful for identifying squeezes (low values) and expansions (high values).
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface BBBandWidthInputs {
  /** Period length */
  length: number;
  /** Price source */
  src: SourceType;
  /** Standard deviation multiplier */
  mult: number;
  /** Highest expansion lookback length */
  expansionLength: number;
  /** Lowest contraction lookback length */
  contractionLength: number;
}

export const defaultInputs: BBBandWidthInputs = {
  length: 20,
  src: 'close',
  mult: 2,
  expansionLength: 125,
  contractionLength: 125,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50 },
  { id: 'expansionLength', type: 'int', title: 'Highest Expansion Length', defval: 125, min: 1 },
  { id: 'contractionLength', type: 'int', title: 'Lowest Contraction Length', defval: 125, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger BandWidth', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Highest Expansion', color: '#F23645', lineWidth: 1 },
  { id: 'plot2', title: 'Lowest Contraction', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger BandWidth',
  shortTitle: 'BBW',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BBBandWidthInputs> = {}): IndicatorResult {
  const { length, src, mult, expansionLength, contractionLength } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const basis = ta.sma(source, length);
  const dev = ta.stdev(source, length).mul(mult);
  const upper = basis.add(dev);
  const lower = basis.sub(dev);

  // BBW = ((upper - lower) / basis) * 100
  const basisArr = basis.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();

  const bbw: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const u = upperArr[i];
    const l = lowerArr[i];
    const b = basisArr[i];

    if (u == null || l == null || b == null || b === 0) {
      bbw.push(NaN);
    } else {
      bbw.push(((u - l) / b) * 100);
    }
  }

  // Calculate highest and lowest BBW
  const highestExpansion: number[] = [];
  const lowestContraction: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    // Highest expansion
    let highest = -Infinity;
    for (let j = Math.max(0, i - expansionLength + 1); j <= i; j++) {
      if (!isNaN(bbw[j]) && bbw[j] > highest) highest = bbw[j];
    }
    highestExpansion.push(highest === -Infinity ? NaN : highest);

    // Lowest contraction
    let lowest = Infinity;
    for (let j = Math.max(0, i - contractionLength + 1); j <= i; j++) {
      if (!isNaN(bbw[j]) && bbw[j] < lowest) lowest = bbw[j];
    }
    lowestContraction.push(lowest === Infinity ? NaN : lowest);
  }

  const bbwData = bbw.map((value, i) => ({ time: bars[i].time, value }));
  const highData = highestExpansion.map((value, i) => ({ time: bars[i].time, value }));
  const lowData = lowestContraction.map((value, i) => ({ time: bars[i].time, value }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': bbwData,
      'plot1': highData,
      'plot2': lowData,
    },
  };
}

export const BBBandWidth = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
