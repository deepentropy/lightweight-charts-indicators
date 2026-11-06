/**
 * PolyFilter [BackQuant]
 *
 * One of three filters of the source:
 * - Fractional MA: weights (k + 1)^-adaptationSpeed for k = 0..length - 1, normalised to a sum of 1; the sum runs on
 *   the bars that exist (min(length - 1, bar_index)).
 * - Ehlers 2-Pole super smoother: filt = c1 * (src + src[1]) / 2 + c2 * filt[1] + c3 * filt[2] with
 *   a1 = exp(-1.414 * 3.14159 / length), c2 = 2 * a1 * cos(1.414 * 3.14159 / length), c3 = -a1², c1 = 1 - c2 - c3.
 * - Multi-Kernel: 0.7 * Gaussian weighted average (sigma = length / 3) + 0.3 * exponential weighted average
 *   (alpha = 2 / (length + 1)) over `length` bars.
 * The line, the bars and the optional background are green when the filter rises (or the source is above the
 * filter), red otherwise. Triangles mark the filter turning up / down (or crossing the source).
 * Alerts (alertcondition, `alerts` of the result): trend up / down (the filter crossing its value of the bar before)
 * and the filter crossing above / below the source.
 *
 * Reference: "PolyFilter [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type PolyFilterType = 'Fractional MA' | 'Ehlers 2-Pole' | 'Multi-Kernel';

export interface PolyFilterInputs {
  /** Price source for the calculation */
  src: SourceType;
  /** Filter length */
  filterLength: number;
  /** Adaptation speed (exponent of the Fractional MA weights) */
  adaptationSpeed: number;
  /** Filter type */
  filterType: PolyFilterType;
  /** Colour from the trend (true) or from the source above / below the filter (false) */
  col1or2: boolean;
  longColor: string;
  shortColor: string;
  /** Show the filter line */
  showLine: boolean;
  /** Paint the candles */
  paintCandles: boolean;
  /** Colour the background */
  bgCol: boolean;
  /** Line width of the filter line (the plot width stays 2) */
  lineW: number;
}

export const defaultInputs: PolyFilterInputs = {
  src: 'hlc3',
  filterLength: 83,
  adaptationSpeed: 0.618,
  filterType: 'Ehlers 2-Pole',
  col1or2: true,
  longColor: '#00ff00',
  shortColor: '#ff0000',
  showLine: true,
  paintCandles: true,
  bgCol: false,
  lineW: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Price Source for Calculation', defval: 'hlc3' },
  { id: 'filterLength', type: 'int', title: 'Filter Length', defval: 83 },
  { id: 'adaptationSpeed', type: 'float', title: 'Adaptation Speed', defval: 0.618, step: 0.01 },
  { id: 'filterType', type: 'string', title: 'Filter Type', defval: 'Ehlers 2-Pole', options: ['Fractional MA', 'Ehlers 2-Pole', 'Multi-Kernel'] },
  { id: 'col1or2', type: 'bool', title: 'Color based off Trend (true) or > or < close (false)', defval: true },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#00ff00' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff0000' },
  { id: 'showLine', type: 'bool', title: 'Show Filter Line', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles', defval: true, tooltip: 'Color candles using color method defined above.' },
  { id: 'bgCol', type: 'bool', title: 'Color Background?', defval: false },
  { id: 'lineW', type: 'int', title: 'Line Width', defval: 2, tooltip: 'This is for the filter line' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#00ff00', lineWidth: 2 },
];

export const metadata = {
  title: 'PolyFilter [BackQuant]',
  shortTitle: 'PolyFilter [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface PolyRun extends BarRunState<Record<string, never>> {
  src: number[];
  signal: number[];
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PolyFilterInputs>): BarStudy<PolyRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const length = cfg.filterLength;

  // Fractional MA weights
  const weights: number[] = [];
  if (cfg.filterType === 'Fractional MA') {
    let sumWeights = 0.0;
    for (let k = 0; k < length; k++) {
      const w = Math.pow(k + 1, -cfg.adaptationSpeed);
      weights.push(w);
      sumWeights += w;
    }
    for (let k = 0; k < weights.length; k++) weights[k] = weights[k] / sumWeights;
  }
  const fractionalMa = (src: number[], i: number): number => {
    let weightedSum = 0.0;
    for (let k = 0; k <= Math.min(length - 1, i); k++) {
      if (k < weights.length) weightedSum += src[i - k] * weights[k];
    }
    return weightedSum;
  };

  // Ehlers 2-pole coefficients
  const arg = (1.414 * 3.14159) / length;
  const a1 = Math.exp(-arg);
  const b1 = 2 * a1 * Math.cos(arg);
  const c2 = b1;
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;
  const ehlers2Pole = (src: number[], filt: number[], i: number): number => {
    const s1 = i > 0 ? src[i - 1] : NaN;
    const f1 = i > 0 ? filt[i - 1] : NaN;
    const f2 = i > 1 ? filt[i - 2] : NaN;
    return (c1 * (src[i] + nz(s1))) / 2 + c2 * nz(f1) + c3 * nz(f2);
  };

  const sigma = length / 3.0;
  const alpha = 2.0 / (length + 1);
  const multiKernel = (src: number[], i: number): number => {
    const at = (k: number) => (i - k >= 0 ? src[i - k] : NaN);
    let gaussianSum = 0.0;
    let gaussianWeightSum = 0.0;
    for (let k = 0; k <= length - 1; k++) {
      const w = Math.exp(-Math.pow(k, 2) / (2 * Math.pow(sigma, 2)));
      gaussianSum += at(k) * w;
      gaussianWeightSum += w;
    }
    const gaussianMa = gaussianSum / gaussianWeightSum;
    let expSum = 0.0;
    let expWeightSum = 0.0;
    for (let k = 0; k <= length - 1; k++) {
      const w = Math.pow(1 - alpha, k);
      expSum += at(k) * w;
      expWeightSum += w;
    }
    const expMa = expSum / expWeightSum;
    return 0.7 * gaussianMa + 0.3 * expMa;
  };

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: PolyRun = {
        src: [], signal: [], plot0: [], barColors: [], bgColors: [], markers: [], flags: [[], [], [], []],
        times: [[], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, s.markers, ...s.times];
      s.series = [s.src, s.signal, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const src = s.src;
      const signal = s.signal;
      src[i] = value(bars[i]);
      signal[i] = cfg.filterType === 'Fractional MA'
        ? fractionalMa(src, i)
        : cfg.filterType === 'Multi-Kernel'
          ? multiKernel(src, i)
          : ehlers2Pole(src, signal, i);

      const t = bars[i].time;
      const s1 = i > 0 ? signal[i - 1] : NaN;
      const s2 = i > 1 ? signal[i - 2] : NaN;
      const up = gt(signal[i], s1);
      const aboveFilter = gt(src[i], signal[i]);
      const trendCol = up ? cfg.longColor : cfg.shortColor;
      const filtCol = aboveFilter ? cfg.longColor : cfg.shortColor;
      const col = cfg.col1or2 ? trendCol : filtCol;
      s.plot0[i] = { time: t, value: cfg.showLine ? signal[i] : NaN, color: col };
      if (cfg.paintCandles) s.barColors.push({ time: t, color: col });
      if (cfg.bgCol) s.bgColors.push({ time: t, color: col });

      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1] (exact, no 1e-10 tolerance)
      const src1 = i > 0 ? src[i - 1] : NaN;
      const alertUp = signal[i] > s1 && s1 <= s2;
      const alertDown = signal[i] < s1 && s1 >= s2;
      const alertAbove = signal[i] > src[i] && s1 <= src1;
      const alertBelow = signal[i] < src[i] && s1 >= src1;
      const f = [alertUp, alertDown, alertAbove, alertBelow];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(t as number);
      }
      if (cfg.col1or2 ? alertUp : alertAbove) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.longColor, text: 'L',
          textColor: cfg.longColor, size: 'tiny' });
      }
      if (cfg.col1or2 ? alertDown : alertBelow) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.shortColor, text: 'S',
          textColor: cfg.shortColor, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PolyFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PolyFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'PolyFilter Trend Up', message: 'PolyFilter Trend Up - {{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'PolyFilter Trend Down', message: 'PolyFilter Trend Down - {{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'PolyFilter Above Price', message: 'PolyFilter Above Price - {{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'PolyFilter Below Price', message: 'PolyFilter Below Price - {{ticker}} - {{interval}}' },
];

export const PolyFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
