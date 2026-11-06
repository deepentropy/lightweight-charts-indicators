/**
 * HyperTrend [LuxAlgo]
 *
 * ATR-based adaptive trend following indicator with upper/lower bands.
 * Uses a multiplicative factor to detect trend changes, then builds
 * an average line that drifts in trend direction. Bands are drawn
 * around the average at a configurable width percentage.
 *
 * Reference: "HyperTrend [LuxAlgo]" by LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HyperTrendInputs {
  mult: number;
  slope: number;
  widthPct: number;
}

export const defaultInputs: HyperTrendInputs = {
  mult: 5,
  slope: 14,
  widthPct: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'mult', type: 'float', title: 'Multiplicative Factor', defval: 5, min: 0, step: 0.5 },
  { id: 'slope', type: 'float', title: 'Slope', defval: 14, min: 0, step: 1 },
  { id: 'widthPct', type: 'float', title: 'Width %', defval: 80, min: 0, max: 100, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upper', title: 'Upper', color: 'transparent', lineWidth: 1 },
  { id: 'avg', title: 'Average', color: '#26A69A', lineWidth: 2 },
  { id: 'lower', title: 'Lower', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'HyperTrend [LuxAlgo]',
  shortTitle: 'HyperTrend',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface HyperVars {
  avg: number;
  os: number;
  hold: number;
}

interface HyperRun extends BarRunState<HyperVars> {
  atr: ReturnType<typeof taStep.atr>;
  upper: number[];
  avg: number[];
  lower: number[];
  /** Direction changed from the previous bar (os != os[1]) */
  flip: boolean[];
  plotUpper: Point[];
  plotAvg: Point[];
  plotLower: Point[];
}

function study(inputs: Partial<HyperTrendInputs>): BarStudy<HyperRun, IndicatorResult> {
  const { mult, slope, widthPct } = { ...defaultInputs, ...inputs };
  const width = widthPct / 100;
  const warmup = 200;
  const bullCss = '#26A69A';
  const bearCss = '#EF5350';
  return {
    init() {
      const atr = taStep.atr(200);
      const s: HyperRun = {
        atr, upper: [], avg: [], lower: [], flip: [], plotUpper: [], plotAvg: [], plotLower: [],
        steps: [atr], vars: { avg: NaN, os: 1, hold: 0 }, lists: [], series: [],
      };
      s.series = [s.upper, s.avg, s.lower, s.flip, s.plotUpper, s.plotAvg, s.plotLower];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const close = b.close;
      const atr = (s.atr.step(b.high, b.low, b.close) ?? 0) * mult;
      const prevAvg = i > 0 ? v.avg : close;
      const prevOs = i > 0 ? v.os : 1;
      const prevHold = i > 0 ? v.hold : 0;

      // Average: if price moved beyond ATR band, snap to midpoint; else drift
      let avg: number;
      if (Math.abs(close - prevAvg) > atr) {
        avg = (close + prevAvg) / 2;
      } else {
        avg = prevAvg + prevOs * (prevHold / mult / slope);
      }

      // Direction
      const os = avg > prevAvg ? 1 : avg < prevAvg ? -1 : prevOs;

      // Hold: reset on direction change, otherwise carry forward
      const hold = os !== prevOs ? atr : prevHold;
      v.avg = avg;
      v.os = os;
      v.hold = hold;

      // Bands
      const upper = avg + width * hold;
      const lower = avg - width * hold;
      const flip = i > 0 && os !== prevOs;
      s.upper[i] = upper;
      s.avg[i] = avg;
      s.lower[i] = lower;
      s.flip[i] = flip;
      const time = b.time;
      s.plotUpper[i] = { time, value: i < warmup ? NaN : upper };
      s.plotAvg[i] = { time, value: i < warmup ? NaN : flip ? NaN : avg, color: os === 1 ? bullCss : bearCss };
      s.plotLower[i] = { time, value: i < warmup ? NaN : lower };
    },
    result(s) {
      // Pine (area = 'Gradient'): upper_topcol := upperCss, upper_btmcol := color.new(chart.bg_color, 100),
      //   lower_topcol := color.new(chart.bg_color, 100), lower_btmcol := lowerCss
      const upperCss = '#FF52524C'; // color.new(color.red, 70), v5 palette
      const lowerCss = '#00897B4C'; // color.new(color.teal, 70), v5 palette
      const bgTransparent = '#00000000'; // color.new(chart.bg_color, 100)
      // top_color = os != os[1] ? na : ..., bottom_color = os != os[1] ? na : ...
      const colorWhen = (c: string) => s.flip.map((f) => (f ? null : c));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'upper': s.plotUpper.slice(), 'avg': s.plotAvg.slice(), 'lower': s.plotLower.slice() },
        fills: [
          // fill(plot_upper, plot_avg, top_color, bottom_color, top_value = upper, bottom_value = avg)
          {
            plot1: 'upper', plot2: 'avg',
            gradient: { topValue: s.upper.slice(), bottomValue: s.avg.slice(), topColor: colorWhen(upperCss), bottomColor: colorWhen(bgTransparent) },
          },
          // fill(plot_avg, plot_lower, top_color, bottom_color, top_value = avg, bottom_value = lower)
          {
            plot1: 'avg', plot2: 'lower',
            gradient: { topValue: s.avg.slice(), bottomValue: s.lower.slice(), topColor: colorWhen(bgTransparent), bottomColor: colorWhen(lowerCss) },
          },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HyperTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HyperTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HyperTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
