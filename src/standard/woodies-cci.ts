/**
 * Woodies CCI Indicator
 *
 * Two CCIs of the close: CCI Turbo (length 6) and CCI 14 (length 14).
 * CCI 14 is also drawn as a histogram: teal when the last 5 CCI 14 values (bars 1 to 5 back) are all above 0,
 * red when they are all below 0, otherwise teal when CCI 14 is below 0 and red when not.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type Committable, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WoodiesCCIInputs {
  /** Turbo CCI period */
  turboLength: number;
  /** Standard CCI period */
  cciLength: number;
}

export const defaultInputs: WoodiesCCIInputs = {
  turboLength: 6,
  cciLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'turboLength', type: 'int', title: 'CCI Turbo Length', defval: 6, min: 3, max: 14 },
  { id: 'cciLength', type: 'int', title: 'CCI 14 Length', defval: 14, min: 7, max: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI Turbo Histogram', color: '#2962FF', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'CCI Turbo', color: '#009688', lineWidth: 1 },
  { id: 'plot2', title: 'CCI 14', color: '#F44336', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid',   price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'dotted', title: 'Hundred Line' },
  { id: 'hline_lower', price: -100, color: '#787B86', linestyle: 'dotted', title: 'Minus Line' },
];

export const fillConfig: FillConfig[] = [];

export const metadata = {
  title: 'Woodies CCI',
  shortTitle: 'Woodies CCI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.cci(source, length)` one bar at a time with a constant length: (source - sma) / (0.015 * dev), a zero dev keeps
 * the previous value (0 at the start); the sma of the dev is the same window sma (the doubles of taStep.cci).
 */
class CciWindow implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  private history: number[] = [];
  private pending = NaN;
  private last = 0;
  private next = 0;
  private stepped = false;

  constructor(length: number) {
    if (!(length > 0)) throw new Error(`cci: length must be greater than 0, ${length} given`);
    this.len = Math.floor(length);
    this.mean = new WindowSma(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.next = this.last;
    const mean = this.mean.step(value);
    const h = this.history;
    const n = h.length;
    if (Number.isNaN(mean) || n < this.len - 1) return NaN;
    // ta.dev: the mean of |source - sma| over the last length bars
    let sum = 0;
    for (let k = 0; k < this.len; k++) sum += Math.abs((k === 0 ? value : n - k >= 0 ? h[n - k] : NaN) - mean);
    const d = sum / this.len;
    if (Number.isNaN(d)) return NaN;
    if (!(Math.abs(d) <= EPS)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.history.push(this.pending);
    if (this.history.length > this.len * 2 + 1024) this.history = this.history.slice(-this.len);
  }
}

type Point = { time: number; value: number; color?: string };

interface WoodiesRun extends BarRunState<Record<string, never>> {
  turbo: CciWindow;
  cci: CciWindow;
  cci14: number[];
  histogramData: Point[];
  turboData: Point[];
  cci14Data: Point[];
}

function study(inputs: Partial<WoodiesCCIInputs>): BarStudy<WoodiesRun, IndicatorResult> {
  const { turboLength, cciLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const turbo = new CciWindow(turboLength);
      const cci = new CciWindow(cciLength);
      const s: WoodiesRun = {
        turbo, cci, cci14: [], histogramData: [], turboData: [], cci14Data: [],
        steps: [turbo, cci], vars: {}, lists: [], series: [],
      };
      s.series = [s.cci14, s.histogramData, s.turboData, s.cci14Data];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // source = close; cciTurbo = ta.cci(source, cciTurboLength); cci14 = ta.cci(source, cci14Length)
      const t = s.turbo.step(b.close);
      const v = s.cci.step(b.close);
      s.cci14[i] = v;
      const back = (k: number) => (i - k >= 0 ? s.cci14[i - k] : NaN);
      let last5IsDown = true;
      let last5IsUp = true;
      for (let k = 5; k >= 1; k--) {
        last5IsDown = last5IsDown && lt(back(k), 0);
        last5IsUp = last5IsUp && gt(back(k), 0);
      }
      const color = last5IsUp ? '#009688' : last5IsDown ? '#F44336' : lt(v, 0) ? '#009688' : '#F44336';
      s.histogramData[i] = { time: b.time, value: v, color };
      s.turboData[i] = { time: b.time, value: t };
      s.cci14Data[i] = { time: b.time, value: v };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.histogramData.slice(),
          'plot1': s.turboData.slice(),
          'plot2': s.cci14Data.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WoodiesCCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WoodiesCCIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WoodiesCCI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
