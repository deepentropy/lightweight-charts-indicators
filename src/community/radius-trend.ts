/**
 * Radius Trend [ChartPrime]
 *
 * ATR-based trailing band with step-based radius adjustment.
 * Uses SMA of bar range as distance measure. Every n bars, the band
 * is adjusted by a stepped radius (increasing multiplier * distance1).
 * Trend flips when price crosses the band.
 *
 * Reference: "Radius Trend [ChartPrime]" by ChartPrime
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RadiusTrendInputs {
  step: number;
  multi: number;
}

export const defaultInputs: RadiusTrendInputs = {
  step: 0.15,
  multi: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'step', type: 'float', title: 'Radius Step', defval: 0.15, min: 0.001, step: 0.001 },
  { id: 'multi', type: 'float', title: 'Start Points Distance', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Radius Trend Band', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Outer Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'HL2 SMA', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Radius Trend [ChartPrime]',
  shortTitle: 'RadTrend',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface RadiusVars {
  // State variables (var in PineScript = persistent)
  multi1: number;
  multi2: number;
  band: number;
  /** true = bullish */
  trend: boolean;
}

interface RadiusRun extends BarRunState<RadiusVars> {
  smaRange: WindowSma;
  sband: WindowSma;
  smoothUpper: WindowSma;
  smoothLower: WindowSma;
  hl2Sma: WindowSma;
  bandArr: number[];
  trendArr: boolean[];
  hl2SmaArr: number[];
  topColor: string[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<RadiusTrendInputs>): BarStudy<RadiusRun, IndicatorResult> {
  const { step, multi } = { ...defaultInputs, ...inputs };
  const n = 3; // step interval (hardcoded in PineScript)
  const warmup = 101; // PineScript initializes on bar_index == 101

  return {
    init() {
      // distance = sma(abs(high - low), 100) * multi
      const smaRange = new WindowSma(100);
      // Smooth the band: Sband = sma(band, n), and the outer bands
      const sband = new WindowSma(n);
      const smoothUpper = new WindowSma(n);
      const smoothLower = new WindowSma(n);
      // Hidden SMA of hl2 for fill reference (Pine: ta.sma(hl2, 20))
      const hl2Sma = new WindowSma(20);
      const s: RadiusRun = {
        smaRange, sband, smoothUpper, smoothLower, hl2Sma, bandArr: [], trendArr: [], hl2SmaArr: [], topColor: [],
        plot0: [], plot1: [], plot2: [],
        steps: [smaRange, sband, smoothUpper, smoothLower, hl2Sma],
        vars: { multi1: 0, multi2: 0, band: 0, trend: true },
        lists: [], series: [],
      };
      s.series = [s.bandArr, s.trendArr, s.hl2SmaArr, s.topColor, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const smaRange = s.smaRange.step(Math.abs(b.high - b.low));
      let bandValue: number;
      if (isNaN(smaRange) || i < warmup) {
        // Before warmup, set initial state on bar 101
        if (i === warmup) {
          v.trend = true;
          v.band = b.low * 0.8;
        }
        bandValue = NaN;
      } else {
        const distance = smaRange * multi;
        const distance1 = smaRange * 0.2;
        const close = b.close;

        // Update trend based on price relation to band
        if (close < v.band) v.trend = false;
        if (close > v.band) v.trend = true;

        // Detect trend change (ta.change(trend) = trend != trend[1])
        const prevTrend: boolean = i > 0 ? s.trendArr[i - 1] : v.trend;
        if (!prevTrend && prevTrend !== v.trend) {
          // Was bearish, now bullish
          v.band = b.low - distance;
        }
        if (prevTrend && prevTrend !== v.trend) {
          // Was bullish, now bearish
          v.band = b.high + distance;
        }

        // Apply step angle every n bars
        if (i % n === 0 && v.trend) {
          v.multi1 = 0;
          v.multi2 += step;
          v.band += distance1 * v.multi2;
        }
        if (i % n === 0 && !v.trend) {
          v.multi1 += step;
          v.multi2 = 0;
          v.band -= distance1 * v.multi1;
        }
        bandValue = v.band;
      }
      const trend = v.trend;
      s.bandArr[i] = bandValue;
      s.trendArr[i] = trend;

      const sband = s.sband.step(bandValue);
      // Upper and lower bands for outer display
      let bandUpper = NaN;
      let bandLower = NaN;
      if (!(isNaN(smaRange) || isNaN(bandValue))) {
        const distance = smaRange * multi;
        bandUpper = bandValue + distance * 0.5;
        bandLower = bandValue - distance * 0.5;
      }
      const smoothUpper = s.smoothUpper.step(bandUpper);
      const smoothLower = s.smoothLower.step(bandLower);
      const time = b.time;

      // plot0: smoothed band (Sband) with linebr on trend change
      if (i < warmup + n || isNaN(sband)) s.plot0[i] = { time, value: NaN };
      // linebr: NaN on trend change
      else if (i > 0 && trend !== s.trendArr[i - 1]) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: sband, color: trend ? '#54b6d4' : '#cf2b2b' };

      // plot1: outer band (band1 = trend ? band_upper : band_lower), every other bar
      const val = trend ? smoothUpper : smoothLower;
      if (i < warmup + n || isNaN(val)) s.plot1[i] = { time, value: NaN };
      // PineScript plots every other bar (bar_index % 2 == 0)
      else if (i % 2 !== 0) s.plot1[i] = { time, value: NaN };
      else s.plot1[i] = { time, value: val, color: trend ? '#54b6d4' : '#cf2b2b' };

      const hl2Sma = s.hl2Sma.step((b.high + b.low) / 2);
      s.hl2SmaArr[i] = hl2Sma;
      s.plot2[i] = { time, value: (i < warmup + n || isNaN(hl2Sma)) ? NaN : hl2Sma };
      s.topColor[i] = trend ? 'rgba(84,182,212,0.4)' : 'rgba(207,43,43,0.4)';
    },
    result(s, bars) {
      // Pine: color = trend ? #54b6d4 : #cf2b2b
      //   fill(p1, p2, band, ta.sma(hl2, 20), color.new(color, 60), na)
      const gradient = {
        topValue: s.bandArr.slice(),
        bottomValue: s.hl2SmaArr.slice(),
        topColor: s.topColor.slice(),
        bottomColor: new Array<string | null>(bars.length).fill(null),
      };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot2', gradient },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RadiusTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RadiusTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RadiusTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
