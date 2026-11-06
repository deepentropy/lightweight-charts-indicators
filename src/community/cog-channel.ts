/**
 * Custom Center of Gravity Double Channel [LazyBear]
 *
 * COG (linreg) base line with inner BB channel (stdev-based) and outer STARC channel (ATR-based).
 * Squeeze markers plotted when ATR channel is inside BB channel.
 *
 * Reference: "COG Double Channel [LazyBear]" community indicator
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface COGChannelInputs {
  length: number;
  numDevs: number;
  src: SourceType;
}

export const defaultInputs: COGChannelInputs = {
  length: 34,
  numDevs: 2.5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 34, min: 1 },
  { id: 'numDevs', type: 'float', title: 'Num Deviations', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'COG', color: '#000080', lineWidth: 2 },
  { id: 'plot1', title: 'BB+', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'BB-', color: '#008000', lineWidth: 1 },
  { id: 'plot3', title: 'Starc+', color: '#FF0000', lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Starc-', color: '#008000', lineWidth: 1, style: 'circles' },
  { id: 'sqzHi', title: 'Squeeze Hi', color: '#008080', lineWidth: 2, style: 'cross' },
  { id: 'sqzLo', title: 'Squeeze Lo', color: '#008080', lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Center of Gravity Channel',
  shortTitle: 'COGCh',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/**
 * `ta.linreg(source, length, 0)` one bar at a time with the sums of the taStep machine (the same doubles, na when one
 * value of the window is na), without its per-bar closure: the sums of x are summed once.
 */
class LinregStep implements Committable {
  private values: number[] = [];
  /** Position of the last na value committed */
  private lastNa = -1;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  private readonly sumX: number;
  private readonly sumX2: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    let sumX = 0;
    let sumX2 = 0;
    for (let j = 0; j < this.len; j++) {
      const x = j + 1;
      sumX += x;
      sumX2 += x * x;
    }
    this.sumX = sumX;
    this.sumX2 = sumX2;
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const n = this.values.length;
    if (n < len - 1 || isNaN(value) || this.lastNa >= n - (len - 1)) return NaN;
    const first = n - len + 1;
    let sumY = 0;
    let sumXY = 0;
    for (let j = 0; j < len; j++) {
      const y = j === len - 1 ? value : this.values[first + j]!;
      sumY += y;
      sumXY += (j + 1) * y;
    }
    const sumX = this.sumX;
    const slope = (len * sumXY - sumX * sumY) / (len * this.sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (isNaN(this.pending)) this.lastNa = this.values.length;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) {
      const drop = this.values.length - this.len;
      this.values = this.values.slice(drop);
      this.lastNa -= drop;
    }
  }
}

interface CogRun extends BarRunState<Record<string, never>> {
  cog: LinregStep;
  dev: WindowStdev;
  atr: WindowSma;
  plots: Point[][];
  sqzHi: Point[];
  sqzLo: Point[];
  fillBB: string[];
  fillGreen: string[];
  fillRed: string[];
}

function study(inputs: Partial<COGChannelInputs>): BarStudy<CogRun, Result> {
  const { length, numDevs, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = length;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: CogRun = {
        cog: new LinregStep(length), dev: new WindowStdev(length), atr: new WindowSma(length),
        plots: [[], [], [], [], []], sqzHi: [], sqzLo: [], fillBB: [], fillGreen: [], fillRed: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.cog, s.dev, s.atr];
      s.series = [...s.plots, s.sqzHi, s.sqzLo, s.fillBB, s.fillGreen, s.fillRed];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = value(b);
      // COG basis = linreg(src, length, 0)
      const cog = s.cog.step(v);
      const dev = s.dev.step(v) * numDevs;
      const ul = cog + dev;
      const ll = cog - dev;
      // ATR-based outer channel: Pine uses sma(tr, length) * 2
      // tr_custom = max(high-low, abs(high-close[1]), abs(low-close[1]))
      const hl = b.high - b.low;
      let tr = hl;
      if (i > 0) {
        const prevClose = bars[i - 1].close;
        tr = Math.max(hl, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
      }
      const atrMult = s.atr.step(tr) * 2;
      const uls = cog + atrMult;
      const lls = cog - atrMult;
      const vals = [cog, ul, ll, uls, lls];
      for (let k = 0; k < 5; k++) s.plots[k][i] = { time: t, value: i < warmup ? NaN : vals[k] };

      // Squeeze: ATR channel inside BB channel => uls > ul and lls < ll
      const sqz = i >= warmup && !isNaN(uls) && !isNaN(ul) && !isNaN(lls) && !isNaN(ll) && uls > ul && lls < ll;
      // Pine: plot cross markers at uls+offset and lls-offset
      s.sqzHi[i] = { time: t, value: sqz ? uls + 2 : NaN };
      s.sqzLo[i] = { time: t, value: sqz ? lls - 2 : NaN };

      // Fills: inner BB fill (silver), outer ATR-to-BB fills (green lower, red upper)
      s.fillBB[i] = i < warmup ? 'transparent' : '#C0C0C020';
      s.fillGreen[i] = i < warmup ? 'transparent' : '#00800020';
      s.fillRed[i] = i < warmup ? 'transparent' : '#FF000020';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plots[0].slice(),
          'plot1': s.plots[1].slice(),
          'plot2': s.plots[2].slice(),
          'plot3': s.plots[3].slice(),
          'plot4': s.plots[4].slice(),
          'sqzHi': s.sqzHi.slice(),
          'sqzLo': s.sqzLo.slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', colors: s.fillBB.slice() },
          { plot1: 'plot4', plot2: 'plot2', colors: s.fillGreen.slice() },
          { plot1: 'plot3', plot2: 'plot1', colors: s.fillRed.slice() },
        ],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<COGChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<COGChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const COGChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
