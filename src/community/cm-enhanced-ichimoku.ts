/**
 * CM Enhanced Ichimoku Cloud V5
 *
 * Enhanced Ichimoku Cloud with Tenkan-Sen, Kijun-Sen, Chikou Span,
 * Senkou Span A/B cloud with dynamic trend coloring, and cross arrows.
 * The cloud is the original's two 'Kumo (Cloud)' fills between Span A and Span B: lime where Span A >= Span B, red
 * where Span A <= Span B. The Tenkan/Kijun crosses are the original's two plotarrow outputs (`arrows` of the result).
 *
 * Reference: "CM_Enhanced Ichimoku Cloud V5" by ChrisMoody (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMEnhancedIchimokuInputs {
  conversionLen: number;
  baseLen: number;
  spanBLen: number;
  displacement: number;
  showCrosses: boolean;
}

export const defaultInputs: CMEnhancedIchimokuInputs = {
  conversionLen: 9,
  baseLen: 26,
  spanBLen: 52,
  displacement: 26,
  showCrosses: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionLen', type: 'int', title: 'Tenkan-Sen', defval: 9, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Kijun-Sen', defval: 26, min: 1 },
  { id: 'spanBLen', type: 'int', title: 'Senkou Span B', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
  { id: 'showCrosses', type: 'bool', title: 'Show Tenkan/Kijun Crosses', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan-Sen', color: '#00FF00', lineWidth: 4 },
  { id: 'plot1', title: 'Kijun-Sen', color: '#FF00FF', lineWidth: 4 },
  { id: 'plot2', title: 'Senkou Span A', color: '#26A69A', lineWidth: 5 },
  { id: 'plot3', title: 'Senkou Span B', color: '#FF6D00', lineWidth: 5 },
  { id: 'plot4', title: 'Chikou Span', color: '#00FFFF', lineWidth: 4 },
];

export const metadata = {
  title: 'CM Enhanced Ichimoku Cloud V5',
  shortTitle: 'CM Ichimoku',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { arrows: ArrowData[] };

const LIME_FILL = 'rgba(0, 255, 0, 0.30)';
const RED_FILL = 'rgba(255, 0, 0, 0.30)';

interface CMIchimokuRun extends BarRunState<Record<string, never>> {
  extremes: WindowExtreme[];
  tenkanArr: number[];
  kijunArr: number[];
  spanAValues: number[];
  spanBValues: number[];
  tenkanPlot: Point[];
  kijunPlot: Point[];
  spanAPlot: Point[];
  spanBPlot: Point[];
  chikouPlot: Point[];
  upColors: string[];
  downColors: string[];
  arrows: ArrowData[];
}

function study(inputs: Partial<CMEnhancedIchimokuInputs>): BarStudy<CMIchimokuRun, Result> {
  const { conversionLen, baseLen, spanBLen, displacement, showCrosses } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(conversionLen, baseLen, spanBLen);
  return {
    init() {
      const s: CMIchimokuRun = {
        extremes: [
          new WindowExtreme(false, conversionLen), new WindowExtreme(true, conversionLen),
          new WindowExtreme(false, baseLen), new WindowExtreme(true, baseLen),
          new WindowExtreme(false, spanBLen), new WindowExtreme(true, spanBLen),
        ],
        tenkanArr: [], kijunArr: [], spanAValues: [], spanBValues: [], tenkanPlot: [], kijunPlot: [], spanAPlot: [],
        spanBPlot: [], chikouPlot: [], upColors: [], downColors: [], arrows: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.extremes;
      s.lists = [s.arrows];
      s.series = [
        s.tenkanArr, s.kijunArr, s.spanAValues, s.spanBValues, s.tenkanPlot, s.kijunPlot, s.spanAPlot, s.spanBPlot,
        s.chikouPlot, s.upColors, s.downColors,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const x = s.extremes;
      // Pre-calculate Tenkan, Kijun, Span A and Span B values
      const tenkan = (x[0].step(b.high) + x[1].step(b.low)) / 2;
      const kijun = (x[2].step(b.high) + x[3].step(b.low)) / 2;
      s.tenkanArr[i] = tenkan;
      s.kijunArr[i] = kijun;
      s.spanAValues[i] = (tenkan + kijun) / 2;
      s.spanBValues[i] = (x[4].step(b.high) + x[5].step(b.low)) / 2;

      // Pine: plot(turning, color=lime, linewidth=4)
      s.tenkanPlot[i] = { time, value: i < warmup ? NaN : tenkan, color: '#00FF00' };
      // Pine: plot(standard, color=fuchsia, linewidth=4)
      s.kijunPlot[i] = { time, value: i < warmup ? NaN : kijun, color: '#FF00FF' };

      // Chikou Span: close plotted offset by -displacement (shifted backwards)
      // Pine: plot(close, offset=-displacement, color=aqua)
      // At output position i, display close from bar i+displacement (shifted back to here): na until that bar, which
      // writes it on every run
      s.chikouPlot[i] = { time, value: NaN };
      if (i - displacement >= 0) s.chikouPlot[i - displacement] = { time: bars[i - displacement].time, value: b.close };

      // Span A/B displaced forward; dynamic color based on Span A vs B
      // Pine: col = leadingSpan1 >= leadingSpan2 ? lime : red
      const srcIdx = i - displacement;
      const shown = !(srcIdx < 0 || srcIdx < warmup);
      if (!shown) {
        s.spanAPlot[i] = { time, value: NaN };
        s.spanBPlot[i] = { time, value: NaN };
      } else {
        const sA = s.spanAValues[srcIdx];
        const sB = s.spanBValues[srcIdx];
        const col = sA >= sB ? '#00FF00' : '#FF0000';
        s.spanAPlot[i] = { time, value: sA, color: col };
        s.spanBPlot[i] = { time, value: sB, color: col };
      }

      // Cloud fills (the original fills its linebr plots of Span A / B above and below, here the Span A / B plots):
      // fill(p1, p2, color=lime, transp=70, title='Kumo (Cloud)'): p1 / p2 have values where leadingSpan1 >= leadingSpan2
      // fill(p3, p4, color=red, transp=70, title='Kumo (Cloud)'): p3 / p4 have values where leadingSpan1 <= leadingSpan2
      s.upColors[i] = shown && s.spanAValues[srcIdx] >= s.spanBValues[srcIdx] ? LIME_FILL : 'transparent';
      s.downColors[i] = shown && s.spanAValues[srcIdx] <= s.spanBValues[srcIdx] ? RED_FILL : 'transparent';

      // plotarrow(cr1 and cupA ? cupA : na, "CrossUp Tenkan Kinjun Entry Arrow", colorup=yellow) and
      // plotarrow(cr1 and cdnB*-1 ? cdnB*-1 : na, "CrossDn Tenkan Kinjun Entry Arrow", colordown=yellow)
      if (showCrosses && i >= warmup + 1) {
        const tenkan1 = s.tenkanArr[i - 1];
        const kijun1 = s.kijunArr[i - 1];
        // crossUpTenkanKinjun = turning[1] < standard[1] and turning > standard
        if (tenkan1 < kijun1 && tenkan > kijun) {
          s.arrows.push({ time, id: 'arrow0', value: 1, color: '#FFFF00' });
        }
        // crossDnTenkanKinjun = turning[1] > standard[1] and turning < standard
        if (tenkan1 > kijun1 && tenkan < kijun) {
          s.arrows.push({ time, id: 'arrow1', value: -1, color: '#FFFF00' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.tenkanPlot.slice(), 'plot1': s.kijunPlot.slice(), 'plot2': s.spanAPlot.slice(),
          'plot3': s.spanBPlot.slice(), 'plot4': s.chikouPlot.slice(),
        },
        fills: [
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Kumo (Cloud)', color: LIME_FILL }, colors: s.upColors.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Kumo (Cloud)', color: RED_FILL }, colors: s.downColors.slice() },
        ],
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMEnhancedIchimokuInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CMEnhancedIchimokuInputs> = {},
): Omit<IndicatorResult, 'markers'> & { arrows: ArrowData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CMEnhancedIchimoku = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
