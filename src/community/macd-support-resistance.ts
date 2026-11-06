/**
 * MACD Support and Resistance [ChartPrime]
 *
 * Standard MACD (fast=12, slow=26, signal=9) with dynamic support/resistance levels.
 * On MACD crossunder signal: highest high in last 6 bars becomes a RESISTANCE level.
 * On MACD crossover signal: lowest low in last 6 bars becomes a SUPPORT level.
 * Levels are removed when price crosses through them. Max 20 levels.
 *
 * Sub-panel indicator (overlay: false): the signal line, the hidden MACD line, the fill between them in the colour of
 * MACD vs signal, a diamond on the signal line at each cross ("Macd UP" / "Macd DN"), the 100-bar MACD high / low and
 * the dashed Zero Line.
 * S/R lines are output as overlay drawing primitives.
 *
 * Reference: "MACD Support and Resistance [ChartPrime]" by ChartPrime
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdSupportResistanceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  oscMaType: 'EMA' | 'SMA';
  sigMaType: 'EMA' | 'SMA';
}

export const defaultInputs: MacdSupportResistanceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  sigMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'sigMaType', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
];

export const plotConfig: PlotConfig[] = [
  // pm = plot(macd, title = "MACD", color = macd_col, display = display.none): hidden, one side of the fill
  { id: 'macd', title: 'MACD', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'signal', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
  { id: 'localHigh', title: 'Local High', color: '#787B86', lineWidth: 1 },
  { id: 'localLow', title: 'Local Low', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'MACD Support and Resistance [ChartPrime]',
  shortTitle: 'MACD S/R',
  overlay: false,
};

interface Level {
  isSupport: boolean;
  price: number;
  startIdx: number;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; labels: LabelData[]; markers: MarkerData[] };
type Ma = { step(v: number): number; commit(): void };

/** ta.sma / ta.ema of one MA type with a constant length */
const maStep = (type: 'EMA' | 'SMA', length: number): Ma => (type === 'SMA' ? new WindowSma(length) : taStep.ema(length));

interface MacdSrVars {
  /** Tracked S/R levels (the array is changed in place, its items are never changed) */
  levels: Level[];
}

interface MacdSrRun extends BarRunState<MacdSrVars> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  hi: WindowExtreme;
  lo: WindowExtreme;
  macdArr: number[];
  signalArr: number[];
  macdPlot: Point[];
  signalPlot: Point[];
  fillColors: string[];
  localHighPlot: Point[];
  localLowPlot: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<MacdSupportResistanceInputs>): BarStudy<MacdSrRun, Result> {
  const { fastLength, slowLength, signalLength, oscMaType, sigMaType } = { ...defaultInputs, ...inputs };
  const warmup = slowLength;
  const colUp = '#2962FF';
  const colDn = '#FF6D00';
  const fillUp = String(color.new(colUp, 70));
  const fillDn = String(color.new(colDn, 70));
  return {
    init() {
      const s: MacdSrRun = {
        fast: maStep(oscMaType, fastLength), slow: maStep(oscMaType, slowLength), sig: maStep(sigMaType, signalLength),
        // Highest MACD and lowest MACD over 100 bars for local high/low dashed lines
        hi: new WindowExtreme(false, 100), lo: new WindowExtreme(true, 100),
        macdArr: [], signalArr: [], macdPlot: [], signalPlot: [], fillColors: [], localHighPlot: [], localLowPlot: [],
        markers: [], steps: [], vars: { levels: [] }, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.sig, s.hi, s.lo];
      s.lists = [s.markers];
      s.series = [s.macdArr, s.signalArr, s.macdPlot, s.signalPlot, s.fillColors, s.localHighPlot, s.localLowPlot];
      return s;
    },
    copyVars: (v) => ({ levels: v.levels.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // MACD calculation
      const f = s.fast.step(b.close);
      const sl = s.slow.step(b.close);
      const macd = (f != null && sl != null) ? f - sl : NaN;
      s.macdArr[i] = macd;
      const sg = s.sig.step(macd);
      const signal = sg != null ? sg : NaN;
      s.signalArr[i] = signal;
      const macdHigh = s.hi.step(macd);
      const macdLow = s.lo.step(macd);

      // Track S/R levels
      const levels = s.vars.levels;
      if (i >= 1 && !(isNaN(macd) || isNaN(signal) || isNaN(s.macdArr[i - 1]) || isNaN(s.signalArr[i - 1]))) {
        const prevMacd = s.macdArr[i - 1];
        const prevSignal = s.signalArr[i - 1];
        const curMacd = macd;
        const curSignal = signal;

        // Crossunder: MACD crosses below signal → RESISTANCE (highest high in last 6 bars)
        if (prevMacd >= prevSignal && curMacd < curSignal) {
          let maxHigh = -Infinity;
          let maxIdx = i;
          for (let j = 0; j <= 5 && i - j >= 0; j++) {
            if (bars[i - j].high > maxHigh) {
              maxHigh = bars[i - j].high;
              maxIdx = i - j;
            }
          }
          levels.push({ isSupport: false, price: maxHigh, startIdx: maxIdx });

          // plotshape(ta.crossunder(macd, signal) ? signal : na, "Macd DN", shape.diamond, location.absolute, size.tiny,
          //   color = macd_col)
          s.markers.push({
            time,
            position: 'atPriceMiddle',
            price: curSignal,
            shape: 'diamond',
            color: curMacd > curSignal ? colUp : colDn,
            size: 'tiny',
            id: 'shape1',
          });
        }

        // Crossover: MACD crosses above signal → SUPPORT (lowest low in last 6 bars)
        if (prevMacd <= prevSignal && curMacd > curSignal) {
          let minLow = Infinity;
          let minIdx = i;
          for (let j = 0; j <= 5 && i - j >= 0; j++) {
            if (bars[i - j].low < minLow) {
              minLow = bars[i - j].low;
              minIdx = i - j;
            }
          }
          levels.push({ isSupport: true, price: minLow, startIdx: minIdx });

          // plotshape(ta.crossover(macd, signal) ? signal : na, "Macd UP", shape.diamond, location.absolute, size.tiny,
          //   color = macd_col)
          s.markers.push({
            time,
            position: 'atPriceMiddle',
            price: curSignal,
            shape: 'diamond',
            color: curMacd > curSignal ? colUp : colDn,
            size: 'tiny',
            id: 'shape0',
          });
        }

        // Trim to max 20 levels
        while (levels.length > 20) {
          levels.shift();
        }

        // Remove crossed levels (iterate backward so removal doesn't skip entries)
        for (let k = levels.length - 1; k >= 0; k--) {
          const lv = levels[k];
          if (i <= lv.startIdx) continue;
          if (lv.isSupport && b.low < lv.price) {
            levels.splice(k, 1);
          } else if (!lv.isSupport && b.high > lv.price) {
            levels.splice(k, 1);
          }
        }
      }

      // Build plots
      s.signalPlot[i] = { time, value: i < warmup ? NaN : signal, color: macd > signal ? colUp : colDn };
      s.macdPlot[i] = { time, value: i < warmup ? NaN : macd, color: macd > signal ? colUp : colDn };
      // fill(pm, ps, color.new(macd_col, 70))
      s.fillColors[i] = macd > signal ? fillUp : fillDn;
      // Local high/low as dashed lines (skip every bar where i%5==0 || i%4==0 || i%3==0 to create dashes)
      const skip = i % 5 === 0 || i % 4 === 0 || i % 3 === 0;
      s.localHighPlot[i] = { time, value: (i < warmup || skip || macdHigh == null) ? NaN : macdHigh };
      s.localLowPlot[i] = { time, value: (i < warmup || skip || macdLow == null) ? NaN : macdLow };
    },
    result(s, bars) {
      const n = bars.length;
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      // Draw remaining levels as lines from their start bar to last bar
      for (const lv of s.vars.levels) {
        const col = lv.isSupport ? colUp : colDn;
        lines.push({
          time1: bars[lv.startIdx].time,
          price1: lv.price,
          time2: bars[n - 1].time,
          price2: lv.price,
          color: col,
          width: 1,
          style: 'solid',
        });
        // Diamond label at start
        labels.push({
          time: bars[lv.startIdx].time,
          price: lv.price,
          text: '',
          color: col,
          style: 'label_center',
          size: 'tiny',
        });
        // Price label at end
        labels.push({
          time: bars[n - 1].time,
          price: lv.price,
          text: lv.price.toFixed(2),
          color: col,
          textColor: '#FFFFFF',
          style: 'label_left',
          size: 'small',
        });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          macd: s.macdPlot.slice(),
          signal: s.signalPlot.slice(),
          localHigh: s.localHighPlot.slice(),
          localLow: s.localLowPlot.slice(),
        },
        // hline(0, "Zero Line", color = color.new(#787B86, 30)): default style dashed, width 1
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 30)), linestyle: 'dashed', linewidth: 1 } },
        ],
        fills: [{ plot1: 'macd', plot2: 'signal', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        lines,
        labels,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdSupportResistanceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MacdSupportResistance = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
