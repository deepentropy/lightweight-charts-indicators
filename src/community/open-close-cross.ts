/**
 * Open Close Cross Alerts (NoRepaint)
 *
 * Applies a selectable MA to both close and open series, then plots
 * a normalized percentage difference as an oscillator. Crossovers
 * generate long/short signals. Optional fractal-based divergence detection.
 *
 * Alerts (alertcondition, `alerts` of the result): "OCC BothCond" (either cross), "OCC LongCond" (close MA crossing
 * over the open MA) and "OCC ShortCond" (crossing under it), on the bars of the Long / Short circles.
 *
 * Reference: "Open Close Cross Strategy R5.1" by JustUncleL
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'OCC BothCond', message: 'OCC BothCond' },
  { id: 'alert1', title: 'OCC LongCond', message: 'OCC LongCond' },
  { id: 'alert2', title: 'OCC ShortCond', message: 'OCC ShortCond' },
];

export interface OpenCloseCrossInputs {
  maType: string;
  maPeriod: number;
  resMultiplier: number;
  useResMultiplier: boolean;
  showDivergence: boolean;
}

export const defaultInputs: OpenCloseCrossInputs = {
  maType: 'ZEMA',
  maPeriod: 8,
  resMultiplier: 6,
  useResMultiplier: true,
  showDivergence: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ZEMA', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'SMMA', 'SSMA', 'TMA'] },
  { id: 'maPeriod', type: 'int', title: 'MA Period', defval: 8, min: 1 },
  { id: 'resMultiplier', type: 'int', title: 'Resolution Multiplier', defval: 6, min: 1 },
  { id: 'useResMultiplier', type: 'bool', title: 'Use Res Multiplier', defval: true },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'pcd', title: 'PCD Area', color: '#26A69A', lineWidth: 1, style: 'histogram' },
  { id: 'pcdLine', title: 'PCD Line', color: '#26A69A', lineWidth: 2 },
  { id: 'zero', title: 'Zero', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Open Close Cross',
  shortTitle: 'OCC',
  overlay: false,
};

/** One selectable MA variant of one bar field, stepped bar by bar */
type Ma = { step(i: number, bars: Bar[]): number; commit(): void };
type Pick = (b: Bar) => number;

/** A taStep-like machine of one value per bar */
type ValueStep = { step(v: number): number; commit(): void };

const lengthStep = (m: { step(v: number, length: number): number; commit(): void }, length: number): ValueStep =>
  ({ step: (v) => m.step(v, length), commit: () => m.commit() });

/** A chain of value machines as one MA of a bar field (`f` combines the outputs) */
function chain(pick: Pick, steps: ValueStep[], f: (out: number[]) => number): Ma {
  const out: number[] = new Array(steps.length);
  return {
    step(i, bars) {
      let v = pick(bars[i]);
      for (let k = 0; k < steps.length; k++) {
        v = steps[k].step(v);
        out[k] = v;
      }
      return f(out);
    },
    commit() {
      for (const m of steps) m.commit();
    },
  };
}

/** Smoothed MA: smma[length - 1] = sum / length (bars from the first), smma[i] = (smma[i-1]*(len-1) + src[i]) / len */
class SmmaStep implements Ma {
  private sum = 0;
  private prev = NaN;
  private nextSum = 0;
  private next = NaN;
  private stepped = false;

  constructor(private readonly pick: Pick, private readonly length: number) {}

  step(i: number, bars: Bar[]): number {
    this.stepped = true;
    const v = this.pick(bars[i]);
    this.nextSum = this.sum;
    let out = NaN;
    if (!isNaN(v)) {
      if (i < this.length) {
        this.nextSum = this.sum + v;
        if (i === this.length - 1) out = this.nextSum / this.length;
      } else {
        out = (this.prev * (this.length - 1) + v) / this.length;
      }
    }
    this.next = out;
    return out;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.sum = this.nextSum;
    this.prev = this.next;
  }
}

/**
 * SuperSmoother: a1 = exp(-1.414*PI/len), b1 = 2*a1*cos(1.414*PI/len)
 * c1 = 1 - b1 + a1^2, v9 = c1*(src+src[1])/2 + b1*v9[1] - a1^2*v9[2]
 */
class SsmaStep implements Ma {
  private o1 = NaN;
  private o2 = NaN;
  private next = NaN;
  private stepped = false;
  private readonly a1: number;
  private readonly b1: number;
  private readonly c1: number;

  constructor(private readonly pick: Pick, length: number) {
    const PI = Math.PI;
    this.a1 = Math.exp(-1.414 * PI / length);
    this.b1 = 2 * this.a1 * Math.cos(1.414 * PI / length);
    this.c1 = 1 - this.b1 + this.a1 * this.a1;
  }

  step(i: number, bars: Bar[]): number {
    this.stepped = true;
    const v = this.pick(bars[i]);
    let out = NaN;
    if (!isNaN(v)) {
      if (i < 2) {
        out = v;
      } else {
        const prev1 = isNaN(this.o1) ? v : this.o1;
        const prev2 = isNaN(this.o2) ? v : this.o2;
        const p = this.pick(bars[i - 1]);
        const srcPrev = isNaN(p) ? v : p;
        out = this.c1 * (v + srcPrev) / 2 + this.b1 * prev1 - this.a1 * this.a1 * prev2;
      }
    }
    this.next = out;
    return out;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.o2 = this.o1;
    this.o1 = this.next;
  }
}

/** A selectable MA variant of a bar field */
function variant(pick: Pick, length: number, maType: string): Ma {
  const one = (out: number[]) => out[out.length - 1];
  switch (maType) {
    case 'SMA': return chain(pick, [new WindowSma(length)], one);
    case 'EMA': return chain(pick, [taStep.ema(length)], one);
    case 'WMA': return chain(pick, [lengthStep(taStep.wma(), length)], one);
    case 'HullMA': return chain(pick, [taStep.hma(length)], one);
    // TMA = SMA(SMA(src, len), len)
    case 'TMA': return chain(pick, [new WindowSma(length), new WindowSma(length)], one);
    case 'DEMA': return chain(pick, [taStep.ema(length), taStep.ema(length)], (o) => 2 * o[0] - (o[1] ?? NaN));
    case 'TEMA': {
      return chain(pick, [taStep.ema(length), taStep.ema(length), taStep.ema(length)], (o) => 3 * (o[0] - o[1]) + o[2]);
    }
    case 'ZEMA': {
      // ZEMA: lag = (len-1)/2, ema(src + src - src[lag], len)
      const lag = Math.floor((length - 1) / 2);
      const ema = taStep.ema(length);
      return {
        step(i, bars) {
          const v = pick(bars[i]);
          return ema.step(i < lag ? v : v + (v - pick(bars[i - lag])));
        },
        commit: () => ema.commit(),
      };
    }
    case 'SMMA': return new SmmaStep(pick, length);
    case 'SSMA': return new SsmaStep(pick, length);
    default: return chain(pick, [taStep.ema(length)], one);
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface OccVars {
  prevTopPcd: number;
  prevTopPrice: number;
  prevBotPcd: number;
  prevBotPrice: number;
}

interface OccRun extends BarRunState<OccVars> {
  closeMa: Ma;
  openMa: Ma;
  closeMA: number[];
  openMA: number[];
  pcd: number[];
  areaData: Point[];
  lineData: Point[];
  zeroData: Point[];
  /** Markers of the crosses, then of the divergences (the order of the original's two passes) */
  crossMarkers: MarkerData[];
  divMarkers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<OpenCloseCrossInputs>): BarStudy<OccRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const effectiveLen = cfg.useResMultiplier ? cfg.maPeriod * cfg.resMultiplier : cfg.maPeriod;
  const warmup = effectiveLen;
  return {
    init() {
      // Apply MA to close and open
      const closeMa = variant((b) => b.close, effectiveLen, cfg.maType);
      const openMa = variant((b) => b.open, effectiveLen, cfg.maType);
      const s: OccRun = {
        closeMa, openMa, closeMA: [], openMA: [], pcd: [], areaData: [], lineData: [], zeroData: [],
        crossMarkers: [], divMarkers: [], flags: [[], [], []], times: [[], [], []],
        steps: [closeMa, openMa],
        vars: { prevTopPcd: NaN, prevTopPrice: NaN, prevBotPcd: NaN, prevBotPrice: NaN },
        lists: [], series: [],
      };
      s.lists = [s.crossMarkers, s.divMarkers, ...s.times];
      s.series = [s.closeMA, s.openMA, s.pcd, s.areaData, s.lineData, s.zeroData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const closeMA = s.closeMa.step(i, bars);
      const openMA = s.openMa.step(i, bars);
      s.closeMA[i] = closeMA;
      s.openMA[i] = openMA;

      // diff = closeMA - openMA
      // pcd = 50000 * diff / ((closeMA + openMA) / 2)
      const diff = closeMA - openMA;
      const avg = (closeMA + openMA) / 2;
      const pcdV = avg !== 0 ? 50000 * diff / avg : 0;
      s.pcd[i] = pcdV;

      // Cross signals
      let xlong = false;
      let xshort = false;
      if (i >= 1 && !(i < warmup || isNaN(closeMA) || isNaN(openMA))) {
        xlong = s.closeMA[i - 1] <= s.openMA[i - 1] && closeMA > openMA;
        xshort = s.closeMA[i - 1] >= s.openMA[i - 1] && closeMA < openMA;
        if (xlong) {
          s.crossMarkers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: '#26A69A', text: 'Long', id: 'shape0' });
        }
        if (xshort) {
          s.crossMarkers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: '#EF5350', text: 'Short', id: 'shape0' });
        }
      }
      const both = xlong || xshort;
      s.flags[0][i] = both;
      s.flags[1][i] = xlong;
      s.flags[2][i] = xshort;
      if (both) s.times[0].push(b.time as number);
      if (xlong) s.times[1].push(b.time as number);
      if (xshort) s.times[2].push(b.time as number);

      // --- Fractal-based divergences on pcd oscillator ---
      if (cfg.showDivergence && i >= 4 && !(i - 2 < warmup)) {
        const v = s.vars;
        const pcd = s.pcd;
        // Top fractal at i-2
        const isTopFractal = pcd[i - 4] < pcd[i - 2] && pcd[i - 3] < pcd[i - 2] &&
                             pcd[i - 2] > pcd[i - 1] && pcd[i - 2] > pcd[i];

        // Bottom fractal at i-2
        const isBotFractal = pcd[i - 4] > pcd[i - 2] && pcd[i - 3] > pcd[i - 2] &&
                             pcd[i - 2] < pcd[i - 1] && pcd[i - 2] < pcd[i];
        const back = bars[i - 2];

        if (isTopFractal && !isNaN(v.prevTopPcd)) {
          const curPcd = pcd[i - 2];
          const curPrice = back.high;
          // Regular bearish: price higher high but pcd lower high
          if (curPrice > v.prevTopPrice && curPcd < v.prevTopPcd) {
            s.divMarkers.push({ time: back.time, position: 'aboveBar', shape: 'diamond', color: '#EF5350', text: 'Bear Div', id: 'shape1' });
          }
          // Hidden bearish: price lower high but pcd higher high
          if (curPrice < v.prevTopPrice && curPcd > v.prevTopPcd) {
            s.divMarkers.push({ time: back.time, position: 'aboveBar', shape: 'diamond', color: '#FF9800', text: 'H.Bear', id: 'shape2' });
          }
        }

        if (isBotFractal && !isNaN(v.prevBotPcd)) {
          const curPcd = pcd[i - 2];
          const curPrice = back.low;
          // Regular bullish: price lower low but pcd higher low
          if (curPrice < v.prevBotPrice && curPcd > v.prevBotPcd) {
            s.divMarkers.push({ time: back.time, position: 'belowBar', shape: 'diamond', color: '#26A69A', text: 'Bull Div', id: 'shape3' });
          }
          // Hidden bullish: price higher low but pcd lower low
          if (curPrice > v.prevBotPrice && curPcd < v.prevBotPcd) {
            s.divMarkers.push({ time: back.time, position: 'belowBar', shape: 'diamond', color: '#FF9800', text: 'H.Bull', id: 'shape4' });
          }
        }

        if (isTopFractal) {
          v.prevTopPcd = pcd[i - 2];
          v.prevTopPrice = back.high;
        }
        if (isBotFractal) {
          v.prevBotPcd = pcd[i - 2];
          v.prevBotPrice = back.low;
        }
      }

      // --- Plot points ---
      const bullish = closeMA > openMA;
      const shown = i < warmup || isNaN(pcdV) ? NaN : pcdV;
      s.areaData[i] = { time: b.time, value: shown, color: bullish ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' };
      s.lineData[i] = { time: b.time, value: shown, color: bullish ? '#26A69A' : '#EF5350' };
      s.zeroData[i] = { time: b.time, value: 0 };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          pcd: s.areaData.slice(),
          pcdLine: s.lineData.slice(),
          zero: s.zeroData.slice(),
        },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
        markers: [...s.crossMarkers, ...s.divMarkers],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OpenCloseCrossInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OpenCloseCrossInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const OpenCloseCross = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
