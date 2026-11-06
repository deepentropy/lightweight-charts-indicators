/**
 * Madrid Trend Squeeze
 *
 * Three EMA-based histograms showing trend direction and squeeze.
 * CMA = close - EMA(close, length)
 * RMA = EMA(close, ref) - EMA(close, length)
 * SMA = EMA(close, sqzLen) - EMA(close, length)
 *
 * Reference: "Madrid Trend Squeeze"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MadridTrendSqueezeInputs {
  length: number;
  ref: number;
  sqzLen: number;
}

export const defaultInputs: MadridTrendSqueezeInputs = {
  length: 34,
  ref: 13,
  sqzLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 34, min: 1 },
  { id: 'ref', type: 'int', title: 'Reference Length', defval: 13, min: 1 },
  { id: 'sqzLen', type: 'int', title: 'Squeeze Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CMA', color: '#00BCD4', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'RMA', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot2', title: 'SMA', color: '#00E676', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Madrid Trend Squeeze',
  shortTitle: 'MTS',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface MadridRun extends BarRunState<Record<string, never>> {
  maMain: ReturnType<typeof taStep.ema>;
  maRef: ReturnType<typeof taStep.ema>;
  maSqz: ReturnType<typeof taStep.ema>;
  cmaPlot: Point[];
  rmaPlot: Point[];
  smaPlot: Point[];
  cmaCandles: PlotCandleData[];
  rmaCandles: PlotCandleData[];
  sqzCandles: PlotCandleData[];
}

function study(inputs: Partial<MadridTrendSqueezeInputs>): BarStudy<MadridRun, Result> {
  const { length, ref, sqzLen } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const maMain = taStep.ema(length);
      const maRef = taStep.ema(ref);
      const maSqz = taStep.ema(sqzLen);
      const s: MadridRun = {
        maMain, maRef, maSqz, cmaPlot: [], rmaPlot: [], smaPlot: [], cmaCandles: [], rmaCandles: [], sqzCandles: [],
        steps: [maMain, maRef, maSqz], vars: {}, lists: [], series: [],
      };
      s.lists = [s.cmaCandles, s.rmaCandles, s.sqzCandles];
      s.series = [s.cmaPlot, s.rmaPlot, s.smaPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const src = b.close;
      const main = s.maMain.step(src);
      const refMa = s.maRef.step(src);
      const sqz = s.maSqz.step(src);

      const cmaV: number | null = b.close - main;
      const rmaV: number | null = refMa - main;
      const smaV: number | null = sqz - main;

      if (i < warmup || cmaV == null) s.cmaPlot[i] = { time, value: NaN };
      else s.cmaPlot[i] = { time, value: cmaV, color: cmaV > 0 ? '#00BCD4' : '#FF00FF' };

      if (i < warmup || rmaV == null) {
        s.rmaPlot[i] = { time, value: NaN };
      } else {
        // Pine: yellow when (refma >= 0 AND closema < refma) OR (refma < 0 AND closema > refma)
        const c = cmaV ?? 0;
        const yellow = (rmaV >= 0 && c < rmaV) || (rmaV < 0 && c > rmaV);
        const color = yellow ? '#FFEB3B' : rmaV > 0 ? '#26A69A' : '#800000';
        s.rmaPlot[i] = { time, value: rmaV, color };
      }

      if (i < warmup || smaV == null) s.smaPlot[i] = { time, value: NaN };
      else s.smaPlot[i] = { time, value: smaV, color: smaV > 0 ? '#00E676' : '#FF5252' };

      // Pine uses plotcandle(0, value, 0, value) for each component
      // CMA candle: aqua if >= 0, fuchsia if < 0
      if (i < warmup) return;
      if (cmaV != null) {
        s.cmaCandles.push({
          time,
          open: 0, high: Math.max(0, cmaV), low: Math.min(0, cmaV), close: cmaV,
          color: cmaV >= 0 ? '#00BCD4' : '#E040FB',
        });
      }
      if (rmaV != null) {
        const cmaV2 = cmaV ?? 0;
        const yellow = (rmaV >= 0 && cmaV2 < rmaV) || (rmaV < 0 && cmaV2 > rmaV);
        const rmaColor = yellow ? '#FFEB3B' : rmaV >= 0 ? '#26A69A' : '#880E4F';
        s.rmaCandles.push({
          time,
          open: 0, high: Math.max(0, rmaV), low: Math.min(0, rmaV), close: rmaV,
          color: rmaColor,
        });
      }
      if (smaV != null) {
        s.sqzCandles.push({
          time,
          open: 0, high: Math.max(0, smaV), low: Math.min(0, smaV), close: smaV,
          color: smaV >= 0 ? '#00E676' : '#EF5350',
        });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.cmaPlot.slice(), 'plot1': s.rmaPlot.slice(), 'plot2': s.smaPlot.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
        ],
        plotCandles: { candle0: s.cmaCandles.slice(), candle1: s.rmaCandles.slice(), candle2: s.sqzCandles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MadridTrendSqueezeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MadridTrendSqueezeInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const MadridTrendSqueeze = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
