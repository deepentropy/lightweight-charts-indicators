/**
 * Coppock Curve Indicator
 *
 * Long-term momentum indicator calculated as a weighted moving average
 * of the sum of two rate of change periods.
 * Coppock = WMA(ROC(long) + ROC(short), wmaLength)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CoppockCurveInputs {
  /** WMA smoothing length */
  wmaLength: number;
  /** Long ROC period */
  longRocLength: number;
  /** Short ROC period */
  shortRocLength: number;
}

export const defaultInputs: CoppockCurveInputs = {
  wmaLength: 10,
  longRocLength: 14,
  shortRocLength: 11,
};

export const inputConfig: InputConfig[] = [
  { id: 'wmaLength', type: 'int', title: 'WMA Length', defval: 10, min: 1 },
  { id: 'longRocLength', type: 'int', title: 'Long RoC Length', defval: 14, min: 1 },
  { id: 'shortRocLength', type: 'int', title: 'Short RoC Length', defval: 11, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Coppock Curve', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Coppock Curve',
  shortTitle: 'Coppock',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CoppockCurveInputs> = {}): IndicatorResult {
  const { wmaLength, longRocLength, shortRocLength } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // Calculate ROC for both periods
  const longRoc = ta.roc(close, longRocLength);
  const shortRoc = ta.roc(close, shortRocLength);

  const longArr = longRoc.toArray();
  const shortArr = shortRoc.toArray();

  // Sum of ROCs
  const rocSum: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const l = longArr[i];
    const s = shortArr[i];

    if (l == null || s == null) {
      rocSum.push(NaN);
    } else {
      rocSum.push(l + s);
    }
  }

  // WMA of ROC sum
  const rocSumSeries = new Series(bars, (_, i) => rocSum[i]);
  const curve = ta.wma(rocSumSeries, wmaLength);

  const plotData = curve.toArray().map((value, i) => ({
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
      'plot0': plotData,
    },
  };
}

export const CoppockCurve = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
