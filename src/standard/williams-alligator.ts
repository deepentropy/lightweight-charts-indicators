/**
 * Williams Alligator Indicator
 *
 * A trend-following indicator consisting of three smoothed moving averages:
 * - Jaw (Blue): 13-period SMMA, shifted 8 bars
 * - Teeth (Red): 8-period SMMA, shifted 5 bars
 * - Lips (Green): 5-period SMMA, shifted 3 bars
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WilliamsAlligatorInputs {
  /** Jaw period */
  jawLength: number;
  /** Jaw offset */
  jawOffset: number;
  /** Teeth period */
  teethLength: number;
  /** Teeth offset */
  teethOffset: number;
  /** Lips period */
  lipsLength: number;
  /** Lips offset */
  lipsOffset: number;
}

export const defaultInputs: WilliamsAlligatorInputs = {
  jawLength: 13,
  jawOffset: 8,
  teethLength: 8,
  teethOffset: 5,
  lipsLength: 5,
  lipsOffset: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'jawLength', type: 'int', title: 'Jaw Length', defval: 13, min: 1 },
  { id: 'jawOffset', type: 'int', title: 'Jaw Offset', defval: 8, min: 0 },
  { id: 'teethLength', type: 'int', title: 'Teeth Length', defval: 8, min: 1 },
  { id: 'teethOffset', type: 'int', title: 'Teeth Offset', defval: 5, min: 0 },
  { id: 'lipsLength', type: 'int', title: 'Lips Length', defval: 5, min: 1 },
  { id: 'lipsOffset', type: 'int', title: 'Lips Offset', defval: 3, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Jaw', color: '#2962FF', lineWidth: 1, offset: 8 },
  { id: 'plot1', title: 'Teeth', color: '#E91E63', lineWidth: 1, offset: 5 },
  { id: 'plot2', title: 'Lips', color: '#66BB6A', lineWidth: 1, offset: 3 },
];

export const metadata = {
  title: 'Williams Alligator',
  shortTitle: 'Alligator',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsAlligatorInputs> = {}): IndicatorResult {
  const { jawLength, jawOffset, teethLength, teethOffset, lipsLength, lipsOffset } = { ...defaultInputs, ...inputs };

  const hl2 = new Series(bars, b => (b.high + b.low) / 2);

  const jawSMMA = ta.rma(hl2, jawLength).toArray();
  const teethSMMA = ta.rma(hl2, teethLength).toArray();
  const lipsSMMA = ta.rma(hl2, lipsLength).toArray();

  // Apply offsets by shifting values backward in the array
  // TradingView's offset shifts values forward on the chart (right)
  // In the exported CSV, this means values appear at later bar indices
  // To match, we shift values forward: value[i+offset] = calculated[i]
  const applyOffset = (values: number[], offset: number): number[] => {
    const result: number[] = new Array(values.length).fill(NaN);
    for (let i = 0; i < values.length - offset; i++) {
      result[i + offset] = values[i];
    }
    return result;
  };

  const jawShifted = applyOffset(jawSMMA, jawOffset);
  const teethShifted = applyOffset(teethSMMA, teethOffset);
  const lipsShifted = applyOffset(lipsSMMA, lipsOffset);

  const jawData = jawShifted.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const teethData = teethShifted.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const lipsData = lipsShifted.map((value, i) => ({
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
      'plot0': jawData,
      'plot1': teethData,
      'plot2': lipsData,
    },
  };
}

export const WilliamsAlligator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
