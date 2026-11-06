/**
 * Triple MA For Loop
 *
 * Triple moving average of the source: TMA = 3 * (ma1 - ma2) + ma3, with ma2 the MA of ma1 and ma3 the MA of ma2
 * (one MA type and length). The score sums +1 / -1 for i = Loop Start to Loop End: +1 when the source is above the
 * TMA i bars ago, else -1. The trend colour turns bull when the score is above the uptrend threshold and bear when it
 * is below the downtrend threshold (it keeps its last value in between). The score line, an SMA(14) of the close
 * and its value 2 bars ago (with a fill between them, on the price pane) and optionally the candles take the trend
 * colour. Labels on the price pane mark the changes to the up / down state of the score (7.5 % below / above the
 * SMA).
 *
 * Reference: "Triple MA For Loop [SeerQuant]" by SeerQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SeerQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { AlmaStep, barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type TripleMaForLoopMaType = 'SMA' | 'EMA' | 'SMMA' | 'WMA' | 'VWMA' | 'LSMA' | 'HMA' | 'ALMA';
export type TripleMaForLoopColorScheme = 'Default' | 'Modern' | 'Cool' | 'Alternate' | 'Bright';

export interface TripleMaForLoopInputs {
  /** MA length */
  maLen: number;
  /** MA source */
  src: SourceType;
  /** MA type */
  maType: TripleMaForLoopMaType;
  /** Loop start */
  sl: number;
  /** Loop end */
  el: number;
  /** Threshold uptrend */
  thrUp: number;
  /** Threshold downtrend */
  thrDown: number;
  /** Colour the candles */
  paint: boolean;
  colScheme: TripleMaForLoopColorScheme;
}

export const defaultInputs: TripleMaForLoopInputs = {
  maLen: 45,
  src: 'close',
  maType: 'EMA',
  sl: 5,
  el: 55,
  thrUp: 45,
  thrDown: 0,
  paint: false,
  colScheme: 'Default',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 45 },
  { id: 'src', type: 'source', title: 'MA Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'SMMA', 'WMA', 'VWMA', 'LSMA', 'HMA', 'ALMA'] },
  { id: 'sl', type: 'int', title: 'Loop Start', defval: 5 },
  { id: 'el', type: 'int', title: 'Loop End', defval: 55 },
  { id: 'thrUp', type: 'float', title: 'Threshold Uptrend', defval: 45 },
  { id: 'thrDown', type: 'float', title: 'Threshold Downtrend', defval: 0 },
  { id: 'paint', type: 'bool', title: 'Colour Candles?', defval: false },
  { id: 'colScheme', type: 'string', title: 'Color Scheme', defval: 'Default', options: ['Default', 'Modern', 'Cool', 'Alternate', 'Bright'] },
];

/** [bull, bear] per colour scheme (the Pine neutral colour is not used) */
const SCHEMES: Record<TripleMaForLoopColorScheme, [string, string]> = {
  Default: ['#00ff73', '#ff0040'],
  Modern: ['#23d7e4', '#e11179'],
  Cool: ['#00ffcc', '#1600db'],
  Alternate: ['#00ff80', '#ff6600'],
  Bright: ['#e8ec00', '#f200fa'],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FL Histogram', color: '#00ff73', lineWidth: 3 },
  { id: 'plot1', title: 'Threshold Uptrend', color: String(color.new('#00ff73', 50)), lineWidth: 2 },
  { id: 'plot2', title: 'Threshold Downtrend', color: String(color.new('#ff0040', 50)), lineWidth: 2 },
  // Pine force_overlay = true: the two SMA plots (and so their fill) are drawn on the price pane
  { id: 'plot3', title: 'SMA', color: '#00ff73', lineWidth: 2, forceOverlay: true },
  { id: 'plot4', title: 'SMA [2]', color: '#00ff73', lineWidth: 2, forceOverlay: true },
];

export const metadata = {
  title: 'Triple MA For Loop [SeerQuant]',
  shortTitle: 'TMA FL',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

/** One moving average of the TMA stepped bar by bar */
interface MaStep {
  step(value: number, volume: number): number;
  commit(): void;
}

/** ma(source, length, type) */
function maStep(maType: TripleMaForLoopMaType, length: number): MaStep {
  switch (maType) {
    case 'SMA': {
      const m = new WindowSma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'SMMA': {
      const m = taStep.rma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'WMA': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, length), commit: () => m.commit() };
    }
    case 'VWMA': return new WindowVwma(length);
    case 'LSMA': {
      const m = taStep.linreg(length, 0);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'HMA': {
      // ta.wma(2 * ta.wma(src, length / 2) - ta.wma(src, length), math.floor(math.sqrt(length)))
      const w1 = taStep.wma();
      const w2 = taStep.wma();
      const w3 = taStep.wma();
      const half = Math.floor(length / 2);
      const root = Math.floor(Math.sqrt(length));
      return {
        step: (v) => {
          const a = w1.step(v, half);
          const b = w2.step(v, length);
          return w3.step(2 * a - b, root);
        },
        commit: () => { w1.commit(); w2.commit(); w3.commit(); },
      };
    }
    case 'ALMA': {
      const m = new AlmaStep(length, 0.85, 6);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'EMA':
    default: {
      const m = taStep.ema(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
  }
}

/** tma = 3 * (ma1 - ma2) + ma3 with ma2 = ma(ma1), ma3 = ma(ma2) */
function tmaStep(maType: TripleMaForLoopMaType, length: number): MaStep {
  const m1 = maStep(maType, length);
  const m2 = maStep(maType, length);
  const m3 = maStep(maType, length);
  return {
    step: (v, vol) => {
      const a = m1.step(v, vol);
      const b = m2.step(a, vol);
      const c = m3.step(b, vol);
      return 3 * (a - b) + c;
    },
    commit: () => { m1.commit(); m2.commit(); m3.commit(); },
  };
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface TripleMaVars {
  /** var color col = na */
  c: string | null;
  /** var int prevTrendState = 0 */
  prevTrendState: number;
}

interface TripleMaRun extends BarRunState<TripleMaVars> {
  tmaStep: MaStep;
  smaStep: WindowSma;
  tma: number[];
  sma: number[];
  plots: Point[][];
  fill: string[];
  bar: (BarColorData | null)[];
  markers: MarkerData[];
}

function study(inputs: Partial<TripleMaForLoopInputs>): BarStudy<TripleMaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const [bull, bear] = SCHEMES[cfg.colScheme] ?? SCHEMES.Default;
  const value = barSource(cfg.src);
  const upCol = String(color.new(bull, 50));
  const downCol = String(color.new(bear, 50));
  const step = cfg.sl <= cfg.el ? 1 : -1;
  // a negative loop index reads the TMA of the next bars
  const future = Math.min(cfg.sl, cfg.el) < 0;
  return {
    fullRunReason: () => (!isBarSource(cfg.src) ? 'source of another study' : future ? 'negative loop index reads the next bars' : null),
    init(bars) {
      const tma = tmaStep(cfg.maType, cfg.maLen);
      const smaStep = new WindowSma(14);
      const s: TripleMaRun = {
        tmaStep: tma, smaStep, tma: [], sma: [], plots: [[], [], [], [], []], fill: [], bar: [], markers: [],
        steps: [tma, smaStep], vars: { c: null, prevTrendState: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.tma, s.sma, ...s.plots, s.fill, s.bar];
      if (future) {
        // the TMA of every bar before the first one is calculated (every update is a full run)
        const all = tmaStep(cfg.maType, cfg.maLen);
        for (let j = 0; j < bars.length; j++) {
          s.tma[j] = all.step(value(bars[j]), bars[j].volume ?? NaN);
          all.commit();
        }
      }
      return s;
    },
    copyVars: (v) => ({ ...v }),
    bar(s, b, bars) {
      const bar = bars[b];
      const n = bars.length;
      const src = value(bar);
      const tma = s.tma;
      tma[b] = s.tmaStep.step(src, bar.volume ?? NaN);
      const sma = s.smaStep.step(bar.close);
      s.sma[b] = sma;
      const v = s.vars;

      // fl(s, e, val): sum of (src > val[i] ? 1 : -1) for i = s to e (val[i] before bar 0 is na: -1)
      let sum = 0;
      for (let i = cfg.sl; step > 0 ? i <= cfg.el : i >= cfg.el; i += step) {
        const past = b - i >= 0 && b - i < n ? tma[b - i] : NaN;
        sum += gt(src, past) ? 1 : -1;
      }

      if (gt(sum, cfg.thrUp)) v.c = bull;
      if (lt(sum, cfg.thrDown)) v.c = bear;
      const c = v.c;

      const current = gt(sum, cfg.thrUp) ? 1 : lt(sum, cfg.thrDown) ? -1 : 0;
      const bullishTransition = v.prevTrendState !== 1 && current === 1;
      const bearishTransition = v.prevTrendState !== -1 && current === -1;
      if (bullishTransition || bearishTransition) v.prevTrendState = current;

      const t = bar.time;
      // plotshape(bullishTransition ? sma - sma * 0.075 : na, shape.labelup, location.absolute, color = bull,
      //   text = "▲", textcolor = #000000, size.small, force_overlay = true)
      const lo = sma - sma * 0.075;
      if (bullishTransition && !isNaN(lo)) {
        s.markers.push({ time: t, position: 'atPriceBottom', price: lo, shape: 'labelUp', color: bull, text: '▲',
          textColor: '#000000', size: 'small', forceOverlay: true });
      }
      // plotshape(bearishTransition ? sma + sma * 0.075 : na, shape.labeldown, ..., color = bear, text = "▼")
      const hi = sma + sma * 0.075;
      if (bearishTransition && !isNaN(hi)) {
        s.markers.push({ time: t, position: 'atPriceTop', price: hi, shape: 'labelDown', color: bear, text: '▼',
          textColor: '#000000', size: 'small', forceOverlay: true });
      }

      const lineCol = c ?? 'transparent';
      // plot(fl, color = col, linewidth = 3, title = "FL Histogram")
      s.plots[0][b] = { time: t, value: sum, color: lineCol };
      s.plots[1][b] = { time: t, value: cfg.thrUp, color: upCol };
      s.plots[2][b] = { time: t, value: cfg.thrDown, color: downCol };
      // a = plot(sma, color = col, linewidth = 2, force_overlay = true)
      s.plots[3][b] = { time: t, value: sma, color: lineCol };
      // b = plot(sma[2], color = col, linewidth = 2, force_overlay = true)
      s.plots[4][b] = { time: t, value: b >= 2 ? s.sma[b - 2] : NaN, color: lineCol };
      // fill(a, b, color.new(col, 70)): color.new(na, 70) is black with transparency 70
      s.fill[b] = String(color.new(c as string, 70));
      // barcolor(paint ? col : na): no bar colour while col is na
      s.bar[b] = c === null ? null : { time: t, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        fills: [{ plot1: 'plot3', plot2: 'plot4', colors: s.fill.slice() }],
        markers: s.markers.slice(),
        barColors: cfg.paint ? s.bar.filter((x): x is BarColorData => x !== null) : [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TripleMaForLoopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TripleMaForLoopInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TripleMaForLoop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
