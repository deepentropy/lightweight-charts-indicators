/**
 * vdubus BinaryPro Indicators 1 & 2
 *
 * Overlay indicator (overlay=true) with:
 * - Upper channel: highest(length) plotted as circles (fuchsia)
 * - Lower channel: lowest(length) plotted as circles (fuchsia)
 * - SMA 50 (red, linewidth 2)
 * - Bollinger Bands (upper/lower, blue) based on avg(upper,lower) basis + 1.5*stdev
 * - Fill between BB upper and lower bands
 *
 * Reference: "vdubus BinaryPro - Indicators 1 & 2" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VdubusBinaryProInputs {
  upperChannelLen: number;
  lowerChannelLen: number;
  maPeriod: number;
  bbLength: number;
  bbMult: number;
}

export const defaultInputs: VdubusBinaryProInputs = {
  upperChannelLen: 20,
  lowerChannelLen: 20,
  maPeriod: 50,
  bbLength: 20,
  bbMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'upperChannelLen', type: 'int', title: 'Upper Channel', defval: 20, min: 1 },
  { id: 'lowerChannelLen', type: 'int', title: 'Lower Channel', defval: 20, min: 1 },
  { id: 'maPeriod', type: 'int', title: 'MA1 Period', defval: 50, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 1.5, min: 0.001, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upper', title: 'Upper Channel', color: '#FF00FF', lineWidth: 2, style: 'circles' as any },
  { id: 'lower', title: 'Lower Channel', color: '#FF00FF', lineWidth: 2, style: 'circles' as any },
  { id: 'ma50', title: 'MA 50', color: '#EF5350', lineWidth: 2 },
  { id: 'bbUpper', title: 'BB Upper', color: '#2196F3', lineWidth: 1 },
  { id: 'bbLower', title: 'BB Lower', color: '#2196F3', lineWidth: 1 },
];

export const metadata = {
  title: 'vdubus BinaryPro',
  shortTitle: 'VBP',
  overlay: true,
};

type Point = { time: number; value: number };

interface VdubusRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  sma50: WindowSma;
  stdev: WindowStdev;
  upperPlot: Point[];
  lowerPlot: Point[];
  ma50Plot: Point[];
  bbUpperPlot: Point[];
  bbLowerPlot: Point[];
}

function study(inputs: Partial<VdubusBinaryProInputs>): BarStudy<VdubusRun, IndicatorResult> {
  const { upperChannelLen, lowerChannelLen, maPeriod, bbLength, bbMult } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(upperChannelLen, lowerChannelLen, bbLength);
  return {
    init() {
      // Pine: upper = highest(length1), lower = lowest(length2)
      const upper = new WindowExtreme(false, upperChannelLen);
      const lower = new WindowExtreme(true, lowerChannelLen);
      // Pine: SMA 50
      const sma50 = new WindowSma(maPeriod);
      // Pine: bb1_dev = bb1_mult * stdev(close, bb1_l)
      const stdev = new WindowStdev(bbLength);
      const s: VdubusRun = {
        upper, lower, sma50, stdev, upperPlot: [], lowerPlot: [], ma50Plot: [], bbUpperPlot: [], bbLowerPlot: [],
        steps: [upper, lower, sma50, stdev], vars: {}, lists: [], series: [],
      };
      s.series = [s.upperPlot, s.lowerPlot, s.ma50Plot, s.bbUpperPlot, s.bbLowerPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const upper = s.upper.step(b.high);
      const lower = s.lower.step(b.low);
      const sma50 = s.sma50.step(b.close);
      const sd = s.stdev.step(b.close);

      // Pine: BB based on basis = avg(upper, lower), dev = mult * stdev(close, bbLength)
      // basis for BB = avg(upper, lower)
      const basis = (upper + lower) / 2;
      const dev = bbMult * sd;
      const bbUpper = basis + dev;
      const bbLower = basis - dev;

      s.upperPlot[i] = { time, value: i < warmup ? NaN : upper };
      s.lowerPlot[i] = { time, value: i < warmup ? NaN : lower };
      s.ma50Plot[i] = { time, value: i < maPeriod ? NaN : sma50 };
      s.bbUpperPlot[i] = { time, value: (i < warmup || isNaN(bbUpper)) ? NaN : bbUpper };
      s.bbLowerPlot[i] = { time, value: (i < warmup || isNaN(bbLower)) ? NaN : bbLower };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'upper': s.upperPlot.slice(),
          'lower': s.lowerPlot.slice(),
          'ma50': s.ma50Plot.slice(),
          'bbUpper': s.bbUpperPlot.slice(),
          'bbLower': s.bbLowerPlot.slice(),
        },
        fills: [
          { plot1: 'bbUpper', plot2: 'bbLower', options: { color: 'rgba(33,150,243,0.10)', title: 'BB Fill' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VdubusBinaryProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VdubusBinaryProInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VdubusBinaryPro = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
