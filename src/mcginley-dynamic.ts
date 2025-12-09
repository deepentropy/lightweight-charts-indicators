/**
 * McGinley Dynamic Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * An adaptive moving average that adjusts to market speed.
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface McGinleyDynamicInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: McGinleyDynamicInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MD', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'McGinley Dynamic',
  shortTitle: 'MD',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<McGinleyDynamicInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const sourceArr = source.toArray();

  // McGinley Dynamic formula: MD = MD[1] + (src - MD[1]) / (length * (src / MD[1])^4)
  const mdArr: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const srcVal = sourceArr[i] ?? 0;

    if (i === 0 || mdArr[i - 1] === undefined || mdArr[i - 1] === 0) {
      mdArr.push(srcVal);
    } else {
      const prevMD = mdArr[i - 1];
      const ratio = srcVal / prevMD;
      const k = length * Math.pow(ratio, 4);
      const md = prevMD + (srcVal - prevMD) / k;
      mdArr.push(md);
    }
  }

  const plotData = mdArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const McGinleyDynamic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
