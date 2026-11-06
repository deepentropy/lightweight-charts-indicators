/**
 * Waddah Attar Explosion V2
 *
 * MACD derivative scaled by sensitivity + Bollinger Band width as explosion threshold.
 * trendUp/trendDown = delta of MACD * sensitivity (positive/negative).
 * Explosion line = BB upper - BB lower.
 * Dead zone = RMA(TR, 100) * 3.7.
 *
 * Reference: "Waddah Attar Explosion V2 [SHK]" by LazyBear/ShayanKM
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WaddahAttarExplosionInputs {
  sensitivity: number;
  fastLength: number;
  slowLength: number;
  channelLength: number;
  bbMult: number;
}

export const defaultInputs: WaddahAttarExplosionInputs = {
  sensitivity: 150,
  fastLength: 20,
  slowLength: 40,
  channelLength: 20,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 150, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 20, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 40, min: 1 },
  { id: 'channelLength', type: 'int', title: 'BB Channel Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Stdev Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Trend', color: '#EF5350', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Explosion Line', color: '#A0522D', lineWidth: 2 },
  { id: 'plot3', title: 'Dead Zone', color: '#2962FF', lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Waddah Attar Explosion',
  shortTitle: 'WAE',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface WaeVars {
  /** t1 of the previous bar */
  prevT1: number;
  /** MACD of the previous bar (0 before the first bar) */
  prevMacd: number;
}

interface WaeRun extends BarRunState<WaeVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  dev: WindowStdev;
  dead: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<WaddahAttarExplosionInputs>): BarStudy<WaeRun, IndicatorResult> {
  const { sensitivity, fastLength, slowLength, channelLength, bbMult } = { ...defaultInputs, ...inputs };
  // Dead zone = nz(rma(tr(true), 100)) * 3.7 (tr(true): high - low on the first bar)
  const deadZonePeriod = 100;
  const warmup = Math.max(slowLength, channelLength, deadZonePeriod);
  return {
    init() {
      // MACD = fastEMA - slowEMA
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      // BB width
      // ta.bb(close, channelLength, bbMult): sma +- mult * stdev (the length check of ta.bb, then the faster window steps)
      taStep.bb(channelLength, bbMult);
      const basis = new WindowSma(channelLength);
      const dev = new WindowStdev(channelLength);
      const dead = taStep.atr(deadZonePeriod);
      const s: WaeRun = {
        fast, slow, basis, dev, dead, plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [fast, slow, basis, dev, dead], vars: { prevT1: 0, prevMacd: 0 }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const w = i < warmup;
      const v = s.vars;

      const macd = (s.fast.step(b.close) ?? 0) - (s.slow.step(b.close) ?? 0);
      const prevMacd = i > 0 ? v.prevMacd : 0;
      const t1 = (macd - prevMacd) * sensitivity;
      const bbBasis = s.basis.step(b.close);
      const bbDev = s.dev.step(b.close);
      const bbUpper = bbBasis + bbMult * bbDev;
      const bbLower = bbBasis - bbMult * bbDev;
      const e1 = (bbUpper ?? 0) - (bbLower ?? 0);
      const dz = (s.dead.step(b.high, b.low, b.close) ?? 0) * 3.7;

      const upVal = w ? NaN : (t1 >= 0 ? t1 : 0);
      const dnVal = w ? NaN : (t1 < 0 ? -t1 : 0);

      // Dynamic colors: lime/green for up, orange/red for down (fading = decreasing)
      const prevT1 = v.prevT1;
      const upColor = t1 < prevT1 ? '#00FF00' : '#008000';
      const dnColor = -t1 < -prevT1 ? '#FFA500' : '#FF0000';

      s.plot0[i] = { time: t, value: upVal, color: w ? undefined : upColor };
      s.plot1[i] = { time: t, value: dnVal, color: w ? undefined : dnColor };
      s.plot2[i] = { time: t, value: w ? NaN : e1 };
      s.plot3[i] = { time: t, value: w ? NaN : dz };
      v.prevT1 = t1;
      v.prevMacd = macd;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaddahAttarExplosionInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaddahAttarExplosionInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WaddahAttarExplosion = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
