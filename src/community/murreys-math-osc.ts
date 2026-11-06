/**
 * UCS Murrey's Math Oscillator V2
 *
 * Murrey Math Lines as oscillator. Normalizes price position within
 * highest high / lowest low range to 0-100 scale.
 * Key levels at 0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100.
 *
 * Reference: "UCS_Murrey's Math Oscillator V2" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData } from '../types';

export interface MurreysOscillatorInputs {
  length: number;
}

export const defaultInputs: MurreysOscillatorInputs = {
  length: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#2962FF', lineWidth: 2 },
  { id: 'negLo', title: '-8 Quadrant', color: 'transparent', lineWidth: 0 },
  { id: 'negHi', title: '-6 Quadrant', color: 'transparent', lineWidth: 0 },
  { id: 'posLo', title: '+6 Quadrant', color: 'transparent', lineWidth: 0 },
  { id: 'posHi', title: '+8 Quadrant', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: "Murrey's Math Oscillator",
  shortTitle: 'MMO',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };

interface MmoRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  plot0: Point[];
  negLo: Point[];
  negHi: Point[];
  posLo: Point[];
  posHi: Point[];
  barColors: BarColorData[];
}

// Murrey Math color zones based on oscillator position (0-100 mapped from Pine's -1 to +1)
const getOscColor = (osc: number): string => {
  if (osc > 50) {
    if (osc < 62.5) return '#ADFF2F';       // yellow-green
    if (osc < 75) return '#32CD32';          // lime green
    if (osc < 87.5) return '#3CB371';        // medium sea green
    return '#008000';                         // green
  } else {
    if (osc > 37.5) return '#CD5C5C';        // indian red
    if (osc > 25) return '#FA8072';           // salmon
    if (osc > 12.5) return '#FFA07A';         // light salmon
    return '#FF0000';                         // red
  }
};

function study(inputs: Partial<MurreysOscillatorInputs>): BarStudy<MmoRun, Result> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hh = new WindowExtreme(false, length);
      const ll = new WindowExtreme(true, length);
      const s: MmoRun = {
        hh, ll, plot0: [], negLo: [], negHi: [], posLo: [], posHi: [], barColors: [],
        steps: [hh, ll], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.negLo, s.negHi, s.posLo, s.posHi];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const top = s.hh.step(b.high);
      const bottom = s.ll.step(b.low);
      // Boundary plots for fills (constant lines at quadrant levels in 0-100 scale)
      s.negLo[i] = { time, value: 0 };     // -8 quadrant = 0
      s.negHi[i] = { time, value: 12.5 };  // -6 quadrant = 12.5
      s.posLo[i] = { time, value: 87.5 };  // +6 quadrant = 87.5
      s.posHi[i] = { time, value: 100 };   // +8 quadrant = 100
      if (i < length || isNaN(top) || isNaN(bottom)) {
        s.plot0[i] = { time, value: NaN };
        return;
      }
      const range = top - bottom;
      const osc = range === 0 ? 50 : ((b.close - bottom) / range) * 100;
      const color = getOscColor(osc);
      s.plot0[i] = { time, value: osc, color };
      s.barColors.push({ time, color });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'negLo': s.negLo.slice(), 'negHi': s.negHi.slice(), 'posLo': s.posLo.slice(), 'posHi': s.posHi.slice() },
        fills: [
          { plot1: 'negLo', plot2: 'negHi', options: { color: 'rgba(255,165,0,0.4)' } },  // orange fill
          { plot1: 'posLo', plot2: 'posHi', options: { color: 'rgba(0,255,0,0.4)' } },     // lime fill
        ],
        hlines: [
          { value: 100, options: { color: '#787B86', linestyle: 'dashed' as const, title: '8/8' } },
          { value: 87.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '7/8' } },
          { value: 75, options: { color: '#787B86', linestyle: 'dashed' as const, title: '6/8' } },
          { value: 62.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '5/8' } },
          { value: 50, options: { color: '#787B86', linestyle: 'solid' as const, title: '4/8 Zero' } },
          { value: 37.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '3/8' } },
          { value: 25, options: { color: '#787B86', linestyle: 'dashed' as const, title: '2/8' } },
          { value: 12.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '1/8' } },
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: '0/8' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MurreysOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MurreysOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MurreysOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
