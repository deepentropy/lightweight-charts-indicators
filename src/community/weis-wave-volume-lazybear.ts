/**
 * Weis Wave Volume [LazyBear]
 *
 * The close direction (up / down, unchanged bars keep the last one) gives the trend. The wave follows the trend
 * once the close has been rising or falling over the detection length. The volume is summed while the wave keeps
 * its direction and starts again when the wave turns. Up waves are drawn as a green histogram, the other waves as a
 * red histogram (below zero for down waves when the option is on).
 *
 * Reference: "Weis Wave Volume [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WeisWaveVolumeLazybearInputs {
  /** Number of bars the close must rise / fall to turn the wave */
  trendDetectionLength: number;
  /** Draw the volume of down waves below zero */
  showDistributionBelowZero: boolean;
}

export const defaultInputs: WeisWaveVolumeLazybearInputs = {
  trendDetectionLength: 2,
  showDistributionBelowZero: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'trendDetectionLength', type: 'int', title: 'trendDetectionLength', defval: 2 },
  { id: 'showDistributionBelowZero', type: 'bool', title: 'showDistributionBelowZero', defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up', color: V1('#008000'), lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Down', color: V1('#FF0000'), lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Weis Wave Volume [LazyBear]',
  shortTitle: 'WWV_LB',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };

interface WwvVars {
  /** Rises / falls of the close in a row (the counters of ta.rising / ta.falling) */
  upCount: number;
  dnCount: number;
  prevMov: number; // mov[1]
  trend: number; // nz(trend[1])
  prevWave: number; // wave[1]
  prevVol: number; // vol[1]
}

interface WwvRun extends BarRunState<WwvVars> {
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<WeisWaveVolumeLazybearInputs>): BarStudy<WwvRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.trendDetectionLength;
  return {
    init() {
      // the length checks of ta.rising / ta.falling (the same runtime error)
      taCore.rising([], len);
      taCore.falling([], len);
      const s: WwvRun = {
        plot0: [], plot1: [], steps: [], lists: [], series: [],
        vars: { upCount: 0, dnCount: 0, prevMov: NaN, trend: 0, prevWave: NaN, prevVol: NaN },
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const c = bars[i].close;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      // ta.rising(close, len) / ta.falling(close, len): counters of rises / falls (a step from or to na keeps them)
      if (Number.isFinite(c) && Number.isFinite(c1)) {
        v.upCount = gt(c, c1) ? v.upCount + 1 : 0;
        v.dnCount = lt(c, c1) ? v.dnCount + 1 : 0;
      }
      const mov = gt(c, c1) ? 1 : lt(c, c1) ? -1 : 0;
      // trend = (mov != 0) and (mov != mov[1]) ? mov : nz(trend[1])
      if (mov !== 0 && !isNaN(v.prevMov) && mov !== v.prevMov) v.trend = mov;
      const trend = v.trend;
      const isTrending = v.upCount >= len || v.dnCount >= len;
      // wave = (trend != nz(wave[1])) and isTrending ? trend : nz(wave[1])
      const wave1 = isNaN(v.prevWave) ? 0 : v.prevWave;
      const wave = trend !== wave1 && isTrending ? trend : wave1;
      // vol = wave == wave[1] ? (nz(vol[1]) + volume) : volume
      const volume = bars[i].volume ?? NaN;
      const vol = wave === v.prevWave ? (isNaN(v.prevVol) ? 0 : v.prevVol) + volume : volume;
      const up = wave === 1 ? vol : 0;
      const dn = cfg.showDistributionBelowZero ? (wave === 1 ? 0 : wave === -1 ? -vol : vol) : wave === 1 ? 0 : vol;
      s.plot0[i] = { time: bars[i].time, value: up };
      s.plot1[i] = { time: bars[i].time, value: dn };
      v.prevMov = mov;
      v.prevWave = wave;
      v.prevVol = vol;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WeisWaveVolumeLazybearInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WeisWaveVolumeLazybearInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WeisWaveVolumeLazybear = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
