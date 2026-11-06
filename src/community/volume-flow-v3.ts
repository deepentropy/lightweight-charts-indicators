/**
 * Volume Flow v3
 *
 * Bull/bear volume analysis with moving averages, spike detection, and difference area.
 * Plots: Volume (columns), Bull MA, Bear MA, Bull Vol Spike, Bear Vol Spike, Difference Value.
 * MA type selectable: Simple, Exponential, Double Exponential.
 *
 * Reference: "Volume Flow v3" by DepthHouse / oh92 (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeFlowV3Inputs {
  maType: string;
  length: number;
  factor: number;
}

export const defaultInputs: VolumeFlowV3Inputs = {
  maType: 'Simple',
  length: 14,
  factor: 3.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'Simple', options: ['Simple', 'Exponential', 'Double Exponential'] },
  { id: 'length', type: 'int', title: 'MA Length', defval: 14, min: 1 },
  { id: 'factor', type: 'float', title: 'Spike Factor', defval: 3.1, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'bullMa', title: 'Bull MA', color: '#5AA650', lineWidth: 1 },
  { id: 'bearMa', title: 'Bear MA', color: '#FF510D', lineWidth: 1 },
  { id: 'bullSpike', title: 'Bull Vol Spike', color: '#5AA650', lineWidth: 1, style: 'columns' },
  { id: 'bearSpike', title: 'Bear Vol Spike', color: '#FF510D', lineWidth: 1, style: 'columns' },
  { id: 'diffValue', title: 'Difference Value', color: '#787B86', lineWidth: 1 },
  { id: 'diffZero', title: 'Zero', color: '#00000000', lineWidth: 0 },
];

export const metadata = {
  title: 'Volume Flow v3',
  shortTitle: 'VFv3',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number): number; commit(): void };

interface Vf3Run extends BarRunState<Record<string, never>> {
  bullMa: Ma;
  bearMa: Ma;
  bullma: number[];
  bearma: number[];
  volumePlot: Point[];
  bullMaPlot: Point[];
  bearMaPlot: Point[];
  bullSpikePlot: Point[];
  bearSpikePlot: Point[];
  diffPlot: Point[];
  diffZero: Point[];
  diffFillColors: string[];
}

/** One bull / bear average: SMA, EMA or DEMA = 2 * EMA - EMA(EMA) */
function maStep(maType: string, length: number): Ma {
  if (maType === 'Exponential') return taStep.ema(length);
  if (maType === 'Double Exponential') {
    const e1 = taStep.ema(length);
    const e2 = taStep.ema(length);
    return {
      step: (v) => {
        const a = e1.step(v);
        // the warm-up of the first EMA is na: the second EMA skips it
        return 2 * a - e2.step(a);
      },
      commit: () => { e1.commit(); e2.commit(); },
    };
  }
  const m = new WindowSma(length);
  return { step: (v) => m.step(v), commit: () => m.commit() };
}

function study(inputs: Partial<VolumeFlowV3Inputs>): BarStudy<Vf3Run, IndicatorResult> {
  const { maType, length, factor } = { ...defaultInputs, ...inputs };
  const warmup = maType === 'Double Exponential' ? length * 2 : length;
  return {
    init() {
      const bullMa = maStep(maType, length);
      const bearMa = maStep(maType, length);
      const s: Vf3Run = {
        bullMa, bearMa, bullma: [], bearma: [], volumePlot: [], bullMaPlot: [], bearMaPlot: [], bullSpikePlot: [],
        bearSpikePlot: [], diffPlot: [], diffZero: [], diffFillColors: [],
        steps: [bullMa, bearMa], vars: {}, lists: [], series: [],
      };
      s.series = [
        s.bullma, s.bearma, s.volumePlot, s.bullMaPlot, s.bearMaPlot, s.bullSpikePlot, s.bearSpikePlot, s.diffPlot,
        s.diffZero, s.diffFillColors,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // Basic volume split: bull = close > open ? vol : 0, bear = open > close ? vol : 0
      const vol = b.volume ?? 0;
      const bull = b.close > b.open ? vol : 0;
      const bear = b.open > b.close ? vol : 0;
      const bma = s.bullMa.step(bull);
      const bema = s.bearMa.step(bear);
      s.bullma[i] = bma;
      s.bearma[i] = bema;
      // Zero line for fill-to-zero (approximates area style)
      s.diffZero[i] = { time: t, value: i < warmup ? NaN : 0 };
      if (i < warmup) {
        s.volumePlot[i] = { time: t, value: NaN };
        s.bullMaPlot[i] = { time: t, value: NaN };
        s.bearMaPlot[i] = { time: t, value: NaN };
        s.bullSpikePlot[i] = { time: t, value: NaN };
        s.bearSpikePlot[i] = { time: t, value: NaN };
        s.diffPlot[i] = { time: t, value: NaN };
        s.diffFillColors[i] = 'rgba(0,0,0,0)';
        return;
      }

      // Volume colored by direction
      const vClr = b.close > b.open ? '#5AA650' : '#FF510D';
      s.volumePlot[i] = { time: t, value: vol, color: vClr };

      // Bull/Bear MA * 2 (Pine plots bullma*2 and bearma*2)
      s.bullMaPlot[i] = { time: t, value: bma * 2 };
      s.bearMaPlot[i] = { time: t, value: bema * 2 };

      // Volume spikes: crossover(bull, bullma * factor) ? vol : na
      const pb = i > 0 ? bars[i - 1] : null;
      const pvol = pb ? pb.volume ?? 0 : 0;
      const prevBull = pb ? (pb.close > pb.open ? pvol : 0) : 0;
      const prevBullThresh = i > 0 ? s.bullma[i - 1] * factor : 0;
      const gsig = prevBull <= prevBullThresh && bull > bma * factor;
      s.bullSpikePlot[i] = { time: t, value: gsig ? vol : NaN };

      const prevBear = pb ? (pb.open > pb.close ? pvol : 0) : 0;
      const prevBearThresh = i > 0 ? s.bearma[i - 1] * factor : 0;
      const rsig = prevBear <= prevBearThresh && bear > bema * factor;
      s.bearSpikePlot[i] = { time: t, value: rsig ? vol : NaN };

      // Difference: |bullma - bearma| / 2.5, colored by direction
      const vfDif = bma - bema;
      const vfAbsolute = Math.abs(vfDif);
      const dClr = vfDif > 0 ? '#5AA650' : '#FF510D';
      s.diffPlot[i] = { time: t, value: vfAbsolute / 2.5, color: dClr };
      // Dynamic fill colors matching diffValue direction
      s.diffFillColors[i] = bma - bema > 0 ? 'rgba(90,166,80,0.3)' : 'rgba(255,81,13,0.3)';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          volume: s.volumePlot.slice(),
          bullMa: s.bullMaPlot.slice(),
          bearMa: s.bearMaPlot.slice(),
          bullSpike: s.bullSpikePlot.slice(),
          bearSpike: s.bearSpikePlot.slice(),
          diffValue: s.diffPlot.slice(),
          diffZero: s.diffZero.slice(),
        },
        fills: [
          { plot1: 'diffValue', plot2: 'diffZero', options: { color: 'rgba(90,166,80,0.3)' }, colors: s.diffFillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeFlowV3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeFlowV3Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeFlowV3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
