/**
 * Anti-Volume Stop Loss
 *
 * Volume-based stop loss. Uses ATR scaled by the ratio of current volume
 * to average volume. Trails the stop in the direction of the trend.
 *
 * Reference: "Anti-Volume Stop Loss" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AntiVolumeStopInputs {
  length: number;
}

export const defaultInputs: AntiVolumeStopInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  // Pine uses plot.style_cross; closest available is line with per-bar color
  { id: 'plot0', title: 'Stop Level', color: '#FFFFFF', lineWidth: 2 },
];

export const metadata = {
  title: 'Anti-Volume Stop Loss',
  shortTitle: 'AVStop',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface AvsRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  avgVol: WindowSma;
  stopArr: number[];
  dirArr: number[];
  plot0: Point[];
}

function study(inputs: Partial<AntiVolumeStopInputs>): BarStudy<AvsRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const atr = taStep.atr(length);
      const avgVol = new WindowSma(length);
      const s: AvsRun = { atr, avgVol, stopArr: [], dirArr: [], plot0: [], steps: [atr, avgVol], vars: {}, lists: [], series: [] };
      s.series = [s.stopArr, s.dirArr, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const atrVal = s.atr.step(b.high, b.low, b.close);
      const avgVol = s.avgVol.step(b.volume ?? 0);
      const vol = b.volume ?? 0;
      const volRatio = avgVol > 0 ? vol / avgVol : 1;
      const stopDist = atrVal * volRatio;
      const close = b.close;

      if (i === 0) {
        s.stopArr[i] = close - stopDist;
        s.dirArr[i] = 1;
      } else {
        const prevStop = s.stopArr[i - 1]!;
        const prevDir = s.dirArr[i - 1]!;
        if (prevDir === 1) {
          const newStop = close - stopDist;
          if (close > prevStop) {
            s.stopArr[i] = Math.max(newStop, prevStop);
            s.dirArr[i] = 1;
          } else {
            s.stopArr[i] = close + stopDist;
            s.dirArr[i] = -1;
          }
        } else {
          const newStop = close + stopDist;
          if (close < prevStop) {
            s.stopArr[i] = Math.min(newStop, prevStop);
            s.dirArr[i] = -1;
          } else {
            s.stopArr[i] = close - stopDist;
            s.dirArr[i] = 1;
          }
        }
      }

      if (i < warmup) s.plot0[i] = { time: b.time as number, value: NaN };
      else s.plot0[i] = { time: b.time as number, value: s.stopArr[i]!, color: s.dirArr[i] === 1 ? '#26A69A' : '#EF5350' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AntiVolumeStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AntiVolumeStopInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AntiVolumeStop = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
