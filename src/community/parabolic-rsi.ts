/**
 * Parabolic RSI
 *
 * Parabolic SAR logic applied to RSI values instead of price.
 * Compute RSI, then run SAR-style trailing stop on the RSI series.
 *
 * Reference: "Parabolic RSI"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ParabolicRSIInputs {
  rsiLen: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  upperThreshold: number;
  lowerThreshold: number;
}

export const defaultInputs: ParabolicRSIInputs = {
  rsiLen: 14,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  upperThreshold: 70,
  lowerThreshold: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'upperThreshold', type: 'int', title: 'Threshold Upper', defval: 70, min: 1, max: 100 },
  { id: 'lowerThreshold', type: 'int', title: 'Threshold Lower', defval: 30, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'PSAR', color: '#FF6D00', lineWidth: 1, style: 'cross' },
  { id: 'midLine', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Parabolic RSI',
  shortTitle: 'PRSI',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: any; value: number };

interface PrsiVars {
  /** The SAR state started (the first valid RSI pair from the warm-up on) */
  started: boolean;
  isLong: boolean;
  af: number;
  ep: number;
  sar: number;
}

interface PrsiRun extends BarRunState<PrsiVars> {
  rsiStep: ReturnType<typeof taStep.rsi>;
  rsiArr: number[];
  psarArr: number[];
  isLongArr: boolean[];
  plot0: Point[];
  plot1: Point[];
  midLine: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<ParabolicRSIInputs>): BarStudy<PrsiRun, Result> {
  const { rsiLen, sarStart, sarInc, sarMax, upperThreshold, lowerThreshold } = { ...defaultInputs, ...inputs };
  const warmup = rsiLen + 1;
  return {
    init() {
      const rsiStep = taStep.rsi(rsiLen);
      const s: PrsiRun = {
        rsiStep, rsiArr: [], psarArr: [], isLongArr: [], plot0: [], plot1: [], midLine: [], markers: [],
        steps: [rsiStep], vars: { started: false, isLong: true, af: sarStart, ep: NaN, sar: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.rsiArr, s.psarArr, s.isLongArr, s.plot0, s.plot1, s.midLine];
      return s;
    },
    bar(s, i, bars) {
      const rsiArr = s.rsiArr;
      const psarArr = s.psarArr;
      const isLongArr = s.isLongArr;
      rsiArr[i] = s.rsiStep.step(bars[i].close);
      const v = s.vars;

      // SAR applied to RSI values
      psarArr[i] = NaN;
      isLongArr[i] = true;
      // Find first valid RSI pair to initialize
      if (!v.started && i >= warmup && rsiArr[i] != null && !isNaN(rsiArr[i]!) && rsiArr[i - 1] != null && !isNaN(rsiArr[i - 1]!)) {
        // Initialize SAR state
        v.started = true;
        v.isLong = rsiArr[i]! >= rsiArr[i - 1]!;
        v.af = sarStart;
        v.ep = v.isLong ? rsiArr[i]! : rsiArr[i]!;
        v.sar = v.isLong ? 0 : 100; // start at extremes for RSI
      }
      if (v.started) {
        const rsi = rsiArr[i];
        if (rsi == null || isNaN(rsi)) {
          psarArr[i] = NaN;
          isLongArr[i] = v.isLong;
        } else {
          // Check for reversal
          if (v.isLong) {
            if (rsi < v.sar) {
              // Reverse to short
              v.isLong = false;
              v.sar = v.ep;
              v.ep = rsi;
              v.af = sarStart;
            }
          } else {
            if (rsi > v.sar) {
              // Reverse to long
              v.isLong = true;
              v.sar = v.ep;
              v.ep = rsi;
              v.af = sarStart;
            }
          }

          psarArr[i] = v.sar;
          isLongArr[i] = v.isLong;

          // Update EP and AF
          if (v.isLong) {
            if (rsi > v.ep) {
              v.ep = rsi;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          } else {
            if (rsi < v.ep) {
              v.ep = rsi;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          }

          // Advance SAR
          v.sar = v.sar + v.af * (v.ep - v.sar);

          // Clamp SAR for long: must be below recent lows (RSI values)
          if (v.isLong) {
            const prev1 = i > 0 && rsiArr[i - 1] != null ? rsiArr[i - 1]! : rsi;
            const prev2 = i > 1 && rsiArr[i - 2] != null ? rsiArr[i - 2]! : prev1;
            v.sar = Math.min(v.sar, prev1, prev2);
          } else {
            const prev1 = i > 0 && rsiArr[i - 1] != null ? rsiArr[i - 1]! : rsi;
            const prev2 = i > 1 && rsiArr[i - 2] != null ? rsiArr[i - 2]! : prev1;
            v.sar = Math.max(v.sar, prev1, prev2);
          }
        }
      }

      // Markers: diamond at SAR reversal points
      // sig_up: isBelow flips to true (bullish reversal), sig_dn: flips to false (bearish reversal)
      // Normal signals: sig_up when sar >= lowerThreshold, sig_dn when sar <= upperThreshold
      // Strong signals: s_sig_up when sar <= lowerThreshold, s_sig_dn when sar >= upperThreshold
      if (i >= 1 && !(isNaN(psarArr[i]) || isNaN(psarArr[i - 1]))) {
        const sigUp = isLongArr[i] && !isLongArr[i - 1];
        const sigDn = !isLongArr[i] && isLongArr[i - 1];
        const sarVal = psarArr[i];
        const sarColor = isLongArr[i] ? '#EEA47F' : '#00539C';
        const markers = s.markers;

        if (sigUp) {
          // Pine: plotshape(sig_up and sar_rsi >= lower_ ? sar_rsi : na) - normal signal diamond
          if (sarVal >= lowerThreshold) {
            markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: sarColor, text: 'Up' });
          }
          // Pine: s_sig_up = isBelow flips true AND sar_rsi <= lower_ - strong signal
          if (sarVal <= lowerThreshold) {
            markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: sarColor, text: 'Strong Up', size: 2 });
          }
        } else if (sigDn) {
          // Pine: plotshape(sig_dn and sar_rsi <= upper_ ? sar_rsi : na) - normal signal diamond
          if (sarVal <= upperThreshold) {
            markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: sarColor, text: 'Dn' });
          }
          // Pine: s_sig_dn = isBelow flips false AND sar_rsi >= upper_ - strong signal
          if (sarVal >= upperThreshold) {
            markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: sarColor, text: 'Strong Dn', size: 2 });
          }
        }
      }

      const r = rsiArr[i];
      s.plot0[i] = { time: bars[i].time, value: (r == null || i < warmup) ? NaN : r };
      s.plot1[i] = { time: bars[i].time, value: isNaN(psarArr[i]) ? NaN : psarArr[i] };
      s.midLine[i] = { time: bars[i].time, value: 50 };
    },
    result(s, bars) {
      const n = bars.length;
      // Pine: midLinePlot = plot(50, color = na, display = display.none)
      //   fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.red, 0), bottom_color = color.new(color.orange, 100))
      //   fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.orange, 0))
      const constant = <T>(v: T): T[] => new Array(n).fill(v);

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'midLine': s.midLine.slice() },
        fills: [
          {
            plot1: 'plot0', plot2: 'midLine', options: { title: 'Overbought Gradient Fill' },
            gradient: { topValue: constant(100), bottomValue: constant(70), topColor: constant('#F23645'), bottomColor: constant('#FF980000') },
          },
          {
            plot1: 'plot0', plot2: 'midLine', options: { title: 'Oversold Gradient Fill' },
            gradient: { topValue: constant(30), bottomValue: constant(0), topColor: constant('#F2364500'), bottomColor: constant('#FF9800') },
          },
        ],
        hlines: [
          { value: upperThreshold, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: lowerThreshold, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
          { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Middle' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ParabolicRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ParabolicRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ParabolicRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
