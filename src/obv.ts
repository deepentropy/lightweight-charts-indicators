/**
 * On Balance Volume (OBV) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Cumulative volume indicator that adds volume on up days and subtracts on down days.
 */

import { Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface OBVInputs {
  // OBV has no configurable inputs
}

export const defaultInputs: OBVInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'On Balance Volume',
  shortTitle: 'OBV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVInputs> = {}): IndicatorResult {
  const close = new Series(bars, (bar) => bar.close);
  const volume = new Series(bars, (bar) => bar.volume ?? 0);

  // OBV = cumulative sum of: volume if close > close[1], -volume if close < close[1], 0 otherwise
  // Using Series.map with index access
  const closeArr = close.toArray();
  const volumeArr = volume.toArray();

  const obvArr: number[] = [];
  let cumOBV = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      obvArr.push(0);
    } else {
      const currClose = closeArr[i] ?? 0;
      const prevClose = closeArr[i - 1] ?? 0;
      const vol = volumeArr[i] ?? 0;

      if (currClose > prevClose) {
        cumOBV += vol;
      } else if (currClose < prevClose) {
        cumOBV -= vol;
      }
      obvArr.push(cumOBV);
    }
  }

  const plotData = obvArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const OBV = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
