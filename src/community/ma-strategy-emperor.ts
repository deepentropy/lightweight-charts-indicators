/**
 * MA Strategy Emperor
 *
 * Multi-MA overlay with selectable MA type and crossover buy/sell signals.
 * Supports EMA, SMA, WMA, DEMA, Smoothed MA, Zero-Lag, Wilders,
 * Super Smoother, and McGuinley dynamic moving average types.
 *
 * Reference: "MA Strategy Emperor" by insiliconot
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAStrategyEmperorInputs {
  maType: string;
  len1: number;
  len2: number;
  len3: number;
  len4: number;
  len5: number;
  enable1: boolean;
  enable2: boolean;
  enable3: boolean;
  enable4: boolean;
  enable5: boolean;
}

export const defaultInputs: MAStrategyEmperorInputs = {
  maType: 'EMA',
  len1: 8,
  len2: 13,
  len3: 21,
  len4: 55,
  len5: 89,
  enable1: true,
  enable2: true,
  enable3: true,
  enable4: false,
  enable5: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'DEMA', 'Smoothed_MA', 'Zero_Lag', 'Wilders', 'Super_Smoother', 'McGuinley'] },
  { id: 'len1', type: 'int', title: 'MA 1 Length', defval: 8, min: 1 },
  { id: 'len2', type: 'int', title: 'MA 2 Length', defval: 13, min: 1 },
  { id: 'len3', type: 'int', title: 'MA 3 Length', defval: 21, min: 1 },
  { id: 'len4', type: 'int', title: 'MA 4 Length', defval: 55, min: 1 },
  { id: 'len5', type: 'int', title: 'MA 5 Length', defval: 89, min: 1 },
  { id: 'enable1', type: 'bool', title: 'Enable MA 1', defval: true },
  { id: 'enable2', type: 'bool', title: 'Enable MA 2', defval: true },
  { id: 'enable3', type: 'bool', title: 'Enable MA 3', defval: true },
  { id: 'enable4', type: 'bool', title: 'Enable MA 4', defval: false },
  { id: 'enable5', type: 'bool', title: 'Enable MA 5', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: '#44E2D6', lineWidth: 2 },
  { id: 'plot1', title: 'MA 2', color: '#DDD10D', lineWidth: 2 },
  { id: 'plot2', title: 'MA 3', color: '#0AA368', lineWidth: 2 },
  { id: 'plot3', title: 'MA 4', color: '#E0670E', lineWidth: 2 },
  { id: 'plot4', title: 'MA 5', color: '#AB40B2', lineWidth: 2 },
];

export const metadata = {
  title: 'MA Strategy Emperor',
  shortTitle: 'MAEmperor',
  overlay: true,
};

/** One moving average of the given type on the close, one bar at a time */
interface MaStep {
  step(src: number, i: number, bars: Bar[]): number;
  commit(): void;
}

/** A moving average whose value depends on its own value of the previous bar (and on the bar before for one type) */
abstract class RecursiveMa implements MaStep {
  /** The result of the previous bar and of the bar before it (NaN before the first bars) */
  protected r1 = NaN;
  protected r2 = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(protected readonly len: number, private readonly inner: Array<{ commit(): void }> = []) {}

  protected abstract value(src: number, i: number, bars: Bar[]): number;

  step(src: number, i: number, bars: Bar[]): number {
    this.stepped = true;
    this.pending = this.value(src, i, bars);
    return this.pending;
  }

  commit(): void {
    for (const m of this.inner) m.commit();
    if (!this.stepped) return;
    this.stepped = false;
    this.r2 = this.r1;
    this.r1 = this.pending;
  }
}

/** sm = na(sm[1]) ? sma(src,len) : (sm[1]*(len-1)+src)/len */
class SmoothedMa extends RecursiveMa {
  private readonly sma: WindowSma;

  constructor(len: number) {
    const sma = new WindowSma(len);
    super(len, [sma]);
    this.sma = sma;
  }

  protected value(src: number): number {
    const sma = this.sma.step(src);
    if (isNaN(this.r1 ?? NaN)) return sma ?? NaN;
    return (this.r1 * (this.len - 1) + src) / this.len;
  }
}

/** WiMA = (src + WiMA[1]*(len-1))/len */
class WildersMa extends RecursiveMa {
  protected value(src: number, i: number, bars: Bar[]): number {
    const len = this.len;
    if (isNaN(src)) return NaN;
    if (isNaN(this.r1 ?? NaN)) {
      // Seed with SMA
      if (i >= len - 1) {
        let sum = 0;
        for (let j = i - len + 1; j <= i; j++) sum += bars[j].close;
        return sum / len;
      }
      return NaN;
    }
    return (src + this.r1 * (len - 1)) / len;
  }
}

/** 2-pole Super Smoother filter */
class SuperSmootherMa extends RecursiveMa {
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;

  constructor(len: number) {
    super(len);
    const pi = Math.PI;
    const a1 = Math.exp(-1.414 * pi / len);
    const b1 = 2 * a1 * Math.cos(1.414 * pi / len);
    this.c2 = b1;
    this.c3 = -(a1 * a1);
    this.c1 = 1 - this.c2 - this.c3;
  }

  protected value(src: number, i: number, bars: Bar[]): number {
    if (isNaN(src)) return NaN;
    if (i < 2 || isNaN(this.r1) || isNaN(this.r2)) return src;
    return this.c1 * (src + bars[i - 1].close) / 2 + this.c2 * this.r1 + this.c3 * this.r2;
  }
}

/** mg = mg[1] + (src - mg[1]) / (len * pow(src/mg[1], 4)) */
class McGinleyMa extends RecursiveMa {
  protected value(src: number): number {
    if (isNaN(src)) return NaN;
    if (isNaN(this.r1 ?? NaN)) return src;
    const prev = this.r1;
    const ratio = src / prev;
    return prev + (src - prev) / (this.len * Math.pow(ratio, 4));
  }
}

/** A moving average of the given type on the close (the source of the original) */
function maStep(len: number, type: string): MaStep {
  switch (type) {
    case 'SMA': {
      const m = new WindowSma(len);
      return { step: (v) => m.step(v) ?? NaN, commit: () => m.commit() };
    }
    case 'WMA': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, len) ?? NaN, commit: () => m.commit() };
    }
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return {
        step: (v) => {
          const v1 = e1.step(v) ?? NaN;
          const v2 = e2.step(v1) ?? NaN;
          return 2 * v1 - v2;
        },
        commit: () => { e1.commit(); e2.commit(); },
      };
    }
    case 'Smoothed_MA': return new SmoothedMa(len);
    case 'Zero_Lag': {
      // d = src + (src - src[floor((len-1)/2)]), ema(d, len)
      const lag = Math.floor((len - 1) / 2);
      const m = taStep.ema(len);
      return {
        step: (v, i, bars) => {
          const prev = i >= lag ? bars[i - lag].close : NaN;
          return m.step(v + (v - prev)) ?? NaN;
        },
        commit: () => m.commit(),
      };
    }
    case 'Wilders': return new WildersMa(len);
    case 'Super_Smoother': return new SuperSmootherMa(len);
    case 'McGuinley': return new McGinleyMa(len);
    default: {
      const m = taStep.ema(len);
      return { step: (v) => m.step(v) ?? NaN, commit: () => m.commit() };
    }
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface EmperorRun extends BarRunState<Record<string, never>> {
  mas: MaStep[];
  ma2: number[];
  ma3: number[];
  lines: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<MAStrategyEmperorInputs>): BarStudy<EmperorRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.len1, cfg.len2, cfg.len3, cfg.len4, cfg.len5];
  const enables = [cfg.enable1, cfg.enable2, cfg.enable3, cfg.enable4, cfg.enable5];
  return {
    init() {
      // Compute all MAs
      const mas = lengths.map((len) => maStep(len, cfg.maType));
      const s: EmperorRun = {
        mas, ma2: [], ma3: [], lines: mas.map(() => []), markers: [],
        steps: mas, vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.ma2, s.ma3, ...s.lines];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      let v2 = NaN;
      let v3 = NaN;
      for (let p = 0; p < 5; p++) {
        const v = s.mas[p].step(close, i, bars);
        if (p === 1) v2 = v;
        else if (p === 2) v3 = v;
        s.lines[p][i] = { time: b.time as number, value: enables[p] ? v : NaN };
      }
      s.ma2[i] = v2;
      s.ma3[i] = v3;

      // Buy/Sell signals: crossover/crossunder of MA2 and MA3
      if (i < 1) return;
      const ma2 = s.ma2; // MA2
      const ma3 = s.ma3; // MA3
      if (isNaN(ma2[i]) || isNaN(ma3[i]) || isNaN(ma2[i - 1]) || isNaN(ma3[i - 1])) return;

      // Buy: crossover(MA2, MA3)
      if (ma2[i - 1] <= ma3[i - 1] && ma2[i] > ma3[i]) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: 'P' });
      }
      // Sell: crossunder(MA2, MA3)
      if (ma2[i - 1] >= ma3[i - 1] && ma2[i] < ma3[i]) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'N' });
      }
    },
    result(s) {
      // Build plots
      const plots: Record<string, { time: number; value: number }[]> = {};
      for (let p = 0; p < 5; p++) plots[`plot${p}`] = s.lines[p].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAStrategyEmperorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAStrategyEmperorInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MAStrategyEmperor = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
