/**
 * Aroon Oscillator
 *
 * The difference between Aroon Up and Aroon Down. Oscillates between -100 and
 * +100; positive values indicate an uptrend, negative a downtrend. The line and its fill to zero are green
 * at or above zero, red below.
 *
 * Based on the standard "Aroon Oscillator" indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AroonOscillatorInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: AroonOscillatorInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: '', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Center' },
  { id: 'hline_upper', price: 90, color: '#787B86', linestyle: 'dashed', title: 'Upper level' },
  { id: 'hline_lower', price: -90, color: '#787B86', linestyle: 'dashed', title: 'Lower level' },
];

export const metadata = {
  title: 'Aroon Oscillator',
  shortTitle: 'Aroon Osc',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface AroonRun extends BarRunState<Record<string, never>> {
  plotData: Point[];
  zeroData: Point[];
  fillColors: string[];
}

function study(inputs: Partial<AroonOscillatorInputs>): BarStudy<AroonRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: AroonRun = { plotData: [], zeroData: [], fillColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plotData, s.zeroData, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      let value = NaN;
      if (i >= length) {
        let highestIdx = i;
        let lowestIdx = i;
        let highestVal = -Infinity;
        let lowestVal = Infinity;

        for (let j = i - length; j <= i; j++) {
          if (bars[j].high > highestVal) { highestVal = bars[j].high; highestIdx = j; }
          if (bars[j].low < lowestVal) { lowestVal = bars[j].low; lowestIdx = j; }
        }

        const aroonUp = (100 * (length - (i - highestIdx))) / length;
        const aroonDown = (100 * (length - (i - lowestIdx))) / length;
        value = aroonUp - aroonDown;
      }
      const time = bars[i].time;
      // plot(osc, "Oscillator", osc >= 0 ? #4caf50 : #ff5252)
      s.plotData[i] = { time, value, color: ge(value, 0) ? '#4CAF50' : '#FF5252' };
      // zeroPlot = plot(0, "", na, display = display.none, editable = false)
      s.zeroData[i] = { time, value: 0 };
      // fill(oscPlot, zeroPlot, osc >= 0 ? #4caf501a : #ff52521a, "Oscillator fill")
      s.fillColors[i] = ge(value, 0) ? '#4CAF501A' : '#FF52521A';
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData.slice(),
          'plot1': s.zeroData.slice(),
        },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Oscillator fill' }, colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AroonOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AroonOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AroonOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
