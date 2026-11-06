/**
 * SuperTrend Channels
 *
 * Standard SuperTrend with channel bands derived from highest/lowest
 * of the SuperTrend line over a lookback period.
 *
 * Reference: "SuperTrend Channels" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupertrendChannelsInputs {
  atrLen: number;
  factor: number;
  channelLen: number;
}

export const defaultInputs: SupertrendChannelsInputs = {
  atrLen: 10,
  factor: 3.0,
  channelLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'channelLen', type: 'int', title: 'Channel Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Channel Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Channel Lower', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'Average', color: '#FF5D00', lineWidth: 1 },
];

export const metadata = {
  title: 'SuperTrend Channels',
  shortTitle: 'STCh',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface StChRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  upper: WindowExtreme;
  lower: WindowExtreme;
  stArr: number[];
  dirArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<SupertrendChannelsInputs>): BarStudy<StChRun, IndicatorResult> {
  const { atrLen, factor, channelLen } = { ...defaultInputs, ...inputs };
  const warmup = atrLen + channelLen;
  return {
    init() {
      const atr = taStep.atr(atrLen);
      // Channel = highest/lowest of SuperTrend over channelLen
      const upper = new WindowExtreme(false, channelLen);
      const lower = new WindowExtreme(true, channelLen);
      const s: StChRun = {
        atr, upper, lower, stArr: [], dirArr: [], plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [atr, upper, lower], vars: {}, lists: [], series: [],
      };
      s.series = [s.stArr, s.dirArr, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { stArr, dirArr } = s;
      // SuperTrend calculation
      const hl2 = (b.high + b.low) / 2;
      const atr = s.atr.step(b.high, b.low, b.close) * factor;
      const up = hl2 - atr;
      const dn = hl2 + atr;

      if (i === 0) {
        stArr[i] = up;
        dirArr[i] = 1;
      } else {
        const prevDir = dirArr[i - 1];
        const prevSt = stArr[i - 1];
        const close = b.close;
        const prevClose = bars[i - 1].close;

        const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
        const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

        if (prevDir === 1) {
          if (close < trailUp) {
            dirArr[i] = -1;
            stArr[i] = trailDn;
          } else {
            dirArr[i] = 1;
            stArr[i] = trailUp;
          }
        } else {
          if (close > trailDn) {
            dirArr[i] = 1;
            stArr[i] = trailUp;
          } else {
            dirArr[i] = -1;
            stArr[i] = trailDn;
          }
        }
      }
      const v = stArr[i];
      const upper = s.upper.step(v);
      const lower = s.lower.step(v);

      if (i < atrLen) s.plot0[i] = { time: b.time, value: NaN };
      else s.plot0[i] = { time: b.time, value: v, color: dirArr[i] === 1 ? '#26A69A' : '#EF5350' };
      s.plot1[i] = { time: b.time, value: i < warmup ? NaN : upper };
      s.plot2[i] = { time: b.time, value: i < warmup ? NaN : lower };
      const avg = (i < warmup || isNaN(upper) || isNaN(lower)) ? NaN : (upper + lower) / 2;
      s.plot3[i] = { time: b.time, value: avg };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(12,181,26,0.15)' } },
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(255,17,0,0.15)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupertrendChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendChannelsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SupertrendChannels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
