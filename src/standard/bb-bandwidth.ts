/**
 * Bollinger BandWidth Indicator
 *
 * Measures the width of Bollinger Bands as a percentage of the basis.
 * BBW = ((Upper - Lower) / Basis) * 100
 * Useful for identifying squeezes (low values) and expansions (high values).
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

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
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1, tooltip: 'The time period to be used in calculating the SMA which creates the base for the Upper and Lower Bands' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', tooltip: 'Determines what data from each bar will be used in calculations.' },
  { id: 'mult', type: 'float', title: 'StdDev', defval: 2, min: 0.001, max: 50, tooltip: 'The number of Standard Deviations away from the SMA that the Upper and Lower Bands should be.' },
  { id: 'expansionLength', type: 'int', title: 'Highest Expansion Length', defval: 125, min: 1, tooltip: 'The Highest Expansion plot displays the highest value that BBW had in the last N bars, where N is the length specified by this input.', display: 'none' },
  { id: 'contractionLength', type: 'int', title: 'Lowest Contraction Length', defval: 125, min: 1, tooltip: 'The Lowest Contraction plot displays the lowest value that BBW had in the last N bars, where N is the length specified by this input.', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bollinger BandWidth', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Highest Expansion', color: '#F2364580', lineWidth: 1 },
  { id: 'plot2', title: 'Lowest Contraction', color: '#08998180', lineWidth: 1 },
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

  // Pine division: non-zero / 0 is +-infinity, 0 / 0 is na
  const bbw: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const u = upperArr[i];
    const l = lowerArr[i];
    const b = basisArr[i];
    if (u == null || l == null || b == null || isNaN(u) || isNaN(l) || isNaN(b)) {
      bbw.push(NaN);
    } else {
      const w = u - l;
      bbw.push(b === 0 ? (w === 0 ? NaN : (w > 0 ? Infinity : -Infinity)) : (w / b) * 100);
    }
  }

  // ta.highest / ta.lowest: na on the first length - 1 bars
  const bbwSeries = Series.fromArray(bars, bbw);
  const highestExpansion = ta.highest(bbwSeries, expansionLength).toArray();
  const lowestContraction = ta.lowest(bbwSeries, contractionLength).toArray();

  // Plots treat infinity as na
  const plotValue = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? NaN : v);

  const bbwData = bbw.map((value, i) => ({ time: bars[i].time, value: plotValue(value) }));
  const highData = highestExpansion.map((value, i) => ({ time: bars[i].time, value: plotValue(value) }));
  const lowData = lowestContraction.map((value, i) => ({ time: bars[i].time, value: plotValue(value) }));

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
