/**
 * Ultimate RSI [LuxAlgo]
 *
 * Augmented RSI using highest/lowest range normalization.
 * diff = highest expanding ? +range : lowest expanding ? -range : close change.
 * arsi = ma(diff) / ma(abs(diff)) * 50 + 50.
 * Signal line is a smoothed MA of the arsi.
 *
 * Reference: "Ultimate RSI [LuxAlgo]" by LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface UltimateRSIInputs {
  length: number;
  smoType1: 'EMA' | 'SMA' | 'RMA' | 'TMA';
  src: SourceType;
  smooth: number;
  smoType2: 'EMA' | 'SMA' | 'RMA' | 'TMA';
  obValue: number;
  osValue: number;
}

export const defaultInputs: UltimateRSIInputs = {
  length: 14,
  smoType1: 'RMA',
  src: 'close',
  smooth: 14,
  smoType2: 'EMA',
  obValue: 80,
  osValue: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'smoType1', type: 'string', title: 'Method', defval: 'RMA', options: ['EMA', 'SMA', 'RMA', 'TMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'smooth', type: 'int', title: 'Signal Length', defval: 14, min: 1 },
  { id: 'smoType2', type: 'string', title: 'Signal Method', defval: 'EMA', options: ['EMA', 'SMA', 'RMA', 'TMA'] },
  { id: 'obValue', type: 'float', title: 'Overbought', defval: 80, min: 50, max: 100 },
  { id: 'osValue', type: 'float', title: 'Oversold', defval: 20, min: 0, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ultimate RSI', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: '#ff5d00', lineWidth: 1 },
  { id: 'plot_up', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot_avg', title: 'Midline', color: 'transparent', lineWidth: 0 },
  { id: 'plot_dn', title: 'OS Level', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Ultimate RSI [LuxAlgo]',
  shortTitle: 'URSI',
  overlay: false,
};

type Ma = { step(v: number): number; commit(): void };

/** One moving average of applyMA stepped bar by bar (TMA: the SMA of the SMA) */
function maStep(length: number, maType: string): Ma[] {
  switch (maType) {
    case 'EMA': return [taStep.ema(length)];
    case 'SMA': return [new WindowSma(length)];
    case 'RMA': return [taStep.rma(length)];
    case 'TMA': return [new WindowSma(length), new WindowSma(length)];
    default: return [taStep.rma(length)];
  }
}

const stepAll = (ms: Ma[], v: number): number => (ms.length === 1 ? ms[0]!.step(v) : ms[1]!.step(ms[0]!.step(v)));

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface UltimateRsiRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  num: Ma[];
  den: Ma[];
  sig: Ma[];
  src: number[];
  upperArr: number[];
  lowerArr: number[];
  arsi: number[];
  plot0: Point[];
  plot1: Point[];
  plotUp: Point[];
  plotAvg: Point[];
  plotDn: Point[];
  fillOB: string[];
  fillOS: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<UltimateRSIInputs>): BarStudy<UltimateRsiRun, Result> {
  const { length, smoType1, src, smooth, smoType2, obValue, osValue } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = length + (smoType1 === 'TMA' ? length : 0);
  const signalWarmup = warmup + smooth + (smoType2 === 'TMA' ? smooth : 0);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // highest/lowest of source over length
      const upper = new WindowExtreme(false, length);
      const lower = new WindowExtreme(true, length);
      const num = maStep(length, smoType1);
      const den = maStep(length, smoType1);
      const sig = maStep(smooth, smoType2);
      const s: UltimateRsiRun = {
        upper, lower, num, den, sig, src: [], upperArr: [], lowerArr: [], arsi: [], plot0: [], plot1: [], plotUp: [],
        plotAvg: [], plotDn: [], fillOB: [], fillOS: [], bgColors: [],
        steps: [upper, lower, ...num, ...den, ...sig], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.src, s.upperArr, s.lowerArr, s.arsi, s.plot0, s.plot1, s.plotUp, s.plotAvg, s.plotDn, s.fillOB, s.fillOS];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const x = value(bars[i]);
      s.src[i] = x;
      const upper = s.upper.step(x);
      const lower = s.lower.step(x);
      s.upperArr[i] = upper;
      s.lowerArr[i] = lower;

      // diff bar by bar
      const r = upper - lower;
      const d = i > 0 ? x - s.src[i - 1] : 0;
      const prevUpper = i > 0 ? s.upperArr[i - 1] : NaN;
      const prevLower = i > 0 ? s.lowerArr[i - 1] : NaN;
      let diff: number;
      if (isNaN(upper) || isNaN(lower) || isNaN(prevUpper) || isNaN(prevLower)) {
        diff = d;
      } else if (upper > prevUpper) {
        diff = r;
      } else if (lower < prevLower) {
        diff = -r;
      } else {
        diff = d;
      }

      // ma(diff, length) and ma(abs(diff), length)
      const num = stepAll(s.num, diff);
      const den = stepAll(s.den, Math.abs(diff));

      // arsi = num / den * 50 + 50
      const arsi = isNaN(num) || isNaN(den) || den === 0 ? NaN : (num / den) * 50 + 50;
      s.arsi[i] = arsi;

      // Signal line
      const signal = stepAll(s.sig, arsi);

      if (i < warmup || isNaN(arsi)) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: arsi, color: arsi > obValue ? '#089981' : arsi < osValue ? '#f23645' : '#787B86' };
      s.plot1[i] = { time, value: (i < signalWarmup || isNaN(signal)) ? NaN : signal };

      // Hidden level plots for fill references
      s.plotUp[i] = { time, value: i < warmup ? NaN : obValue };
      s.plotAvg[i] = { time, value: i < warmup ? NaN : 50 };
      s.plotDn[i] = { time, value: i < warmup ? NaN : osValue };

      // Fill: RSI to OB line when RSI > OB (green OB area); OS line to RSI when RSI < OS (red OS area)
      const out = i < warmup || isNaN(arsi);
      s.fillOB[i] = out ? 'transparent' : arsi > obValue ? 'rgba(8,153,129,0.20)' : 'transparent';
      s.fillOS[i] = out ? 'transparent' : arsi < osValue ? 'rgba(242,54,69,0.20)' : 'transparent';

      // bgColors: highlight bars when RSI crosses into OB/OS zones
      if (i >= warmup + 1) {
        const v = arsi;
        const pv = s.arsi[i - 1];
        if (!isNaN(v) && !isNaN(pv)) {
          // Entering OB
          if (v > obValue && pv <= obValue) s.bgColors.push({ time, color: 'rgba(8,153,129,0.12)' });
          // Entering OS
          if (v < osValue && pv >= osValue) s.bgColors.push({ time, color: 'rgba(242,54,69,0.12)' });
          // Leaving OB
          if (v <= obValue && pv > obValue) s.bgColors.push({ time, color: 'rgba(8,153,129,0.06)' });
          // Leaving OS
          if (v >= osValue && pv < osValue) s.bgColors.push({ time, color: 'rgba(242,54,69,0.06)' });
        }
      }
    },
    result(s, bars) {
      const len = bars.length;
      // Pine: fill(plot_rsi, plot_avg, obValue, 50, obAreaCss, color.new(chart.bg_color, 100))
      //      fill(plot_avg, plot_rsi, 50, osValue, color.new(chart.bg_color, 100), osAreaCss)
      // Pine: obAreaCss = input(color.new(#089981, 80)), osAreaCss = input(color.new(#f23645, 80))
      const constant = <T>(v: T): T[] => new Array(len).fill(v);
      const obAreaCss = 'rgba(8,153,129,0.20)';
      const osAreaCss = 'rgba(242,54,69,0.20)';
      const bgTransparent = '#00000000'; // color.new(chart.bg_color, 100)
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot_up': s.plotUp.slice(), 'plot_avg': s.plotAvg.slice(), 'plot_dn': s.plotDn.slice() },
        hlines: [
          { value: obValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
          { value: osValue, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot_up', colors: s.fillOB.slice() },
          { plot1: 'plot_dn', plot2: 'plot0', colors: s.fillOS.slice() },
          {
            plot1: 'plot0', plot2: 'plot_avg',
            gradient: { topValue: constant(obValue), bottomValue: constant(50), topColor: constant(obAreaCss), bottomColor: constant(bgTransparent) },
          },
          {
            plot1: 'plot_avg', plot2: 'plot0',
            gradient: { topValue: constant(50), bottomValue: constant(osValue), topColor: constant(bgTransparent), bottomColor: constant(osAreaCss) },
          },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UltimateRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UltimateRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const UltimateRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
