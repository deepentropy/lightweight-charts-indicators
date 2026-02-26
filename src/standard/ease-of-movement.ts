/**
 * Ease of Movement Indicator
 *
 * Relates price change to volume, showing how easily price moves.
 * EOM = SMA((high + low)/2 - (prev_high + prev_low)/2) * (high - low) / volume, length)
 * The divisor is used to normalize the volume.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface EaseOfMovementInputs {
  /** Period length */
  length: number;
  /** Volume divisor for normalization */
  divisor: number;
}

export const defaultInputs: EaseOfMovementInputs = {
  length: 14,
  divisor: 10000,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'divisor', type: 'int', title: 'Divisor', defval: 10000, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EOM', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Ease of Movement',
  shortTitle: 'EOM',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<EaseOfMovementInputs> = {}): IndicatorResult {
  const { length, divisor } = { ...defaultInputs, ...inputs };

  const hl2 = new Series(bars, b => (b.high + b.low) / 2);
  const hl2Change = ta.change(hl2, 1);
  const boxRatio = new Series(bars, b => (b.high - b.low) / ((b.volume ?? 0) / divisor));

  const hl2ChangeArr = hl2Change.toArray();
  const boxRatioArr = boxRatio.toArray();

  // EOM raw = change(hl2) * boxRatio
  const eomRaw: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const change = hl2ChangeArr[i];
    const ratio = boxRatioArr[i];

    if (change == null || ratio == null || !isFinite(ratio)) {
      eomRaw.push(NaN);
    } else {
      eomRaw.push(change * ratio);
    }
  }

  // Smooth with SMA
  const eomRawSeries = new Series(bars, (_, i) => eomRaw[i]);
  const eom = ta.sma(eomRawSeries, length);

  const plotData = eom.toArray().map((value, i) => ({
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

export const EaseOfMovement = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
