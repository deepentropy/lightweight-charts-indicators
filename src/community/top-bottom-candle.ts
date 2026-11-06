/**
 * UCS Top & Bottom Candle
 *
 * Panel indicator (overlay=false) with:
 * - Momentum histogram (plot.style_columns, yellow)
 * - SMI line (blue): na until the nested emas of the range exist (smi = 0 only on a zero range)
 * - SMI Signal line (red)
 * - 3 hlines: 40 (overbought/red), -40 (oversold/green), 0 (zero/blue)
 * - Fills between hlines: H0-H2 green (oversold zone), H0-H1 red (overbought zone)
 * - barcolor: lime when SMI < -35 and mom crosses above 0, red when SMI > 35 and mom crosses below 0
 *   (no markers: the original only colours the bars)
 *
 * Reference: "UCS_Top & Bottom Candle" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TopBottomCandleInputs {
  percentKLength: number;
  percentDLength: number;
}

export const defaultInputs: TopBottomCandleInputs = {
  percentKLength: 5,
  percentDLength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'percentKLength', type: 'int', title: 'Percent K Length', defval: 5, min: 1 },
  { id: 'percentDLength', type: 'int', title: 'Percent D Length', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'momentum', title: 'Momentum', color: '#FFEB3B', lineWidth: 1, style: 'histogram' },
  { id: 'smi', title: 'Stochastic Momentum Index', color: '#2196F3', lineWidth: 1 },
  { id: 'smiSignal', title: 'SMI Signal Line', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Top & Bottom Candle',
  shortTitle: 'UCS_T&B',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Ema = ReturnType<typeof taStep.ema>;

interface TbcRun extends BarRunState<Record<string, never>> {
  ll: WindowExtreme;
  hh: WindowExtreme;
  emas: [Ema, Ema, Ema, Ema, Ema];
  mom: number[];
  momentumPlot: Point[];
  smiPlot: Point[];
  smiSignalPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<TopBottomCandleInputs>): BarStudy<TbcRun, Result> {
  const { percentKLength: a, percentDLength: b } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ll = new WindowExtreme(true, a);
      const hh = new WindowExtreme(false, a);
      const emas: TbcRun['emas'] = [taStep.ema(b), taStep.ema(b), taStep.ema(b), taStep.ema(b), taStep.ema(b)];
      const s: TbcRun = {
        ll, hh, emas, mom: [], momentumPlot: [], smiPlot: [], smiSignalPlot: [], barColors: [],
        steps: [ll, hh, ...emas], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.mom, s.momentumPlot, s.smiPlot, s.smiSignalPlot];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time;
      const close = bar.close;
      const ll = s.ll.step(bar.low);
      const hh = s.hh.step(bar.high);

      // diff = hh - ll, rdiff = close - (hh+ll)/2
      const diff = (hh ?? 0) - (ll ?? 0);
      const rdiff = (close ?? 0) - ((hh ?? 0) + (ll ?? 0)) / 2;

      // avgrel = ema(ema(rdiff, b), b), avgdiff = ema(ema(diff, b), b)
      const e = s.emas;
      const avgrel = e[1].step(e[0].step(rdiff));
      const avgdiff = e[3].step(e[2].step(diff));

      // Momentum = (close - close[b]) / close[b] * 1000
      let mom = NaN;
      if (i >= b) {
        const back = bars[i - b].close;
        if (back !== 0 && back != null) mom = ((close - back) / back) * 1000;
      }
      s.mom[i] = mom;

      // SMI = avgdiff != 0 ? (avgrel / (avgdiff / 2) * 100) : 0
      const ad = avgdiff ?? 0;
      const smi = ad !== 0 ? ((avgrel ?? 0) / (ad / 2)) * 100 : 0;

      // SMIsignal = ema(SMI, b)
      const smiSignal = e[4].step(smi);

      // Each plot exists from its first computable bar: Momentum from bar b, SMI from bar a + 2 (b - 1) - 1 (the two
      // nested emas over the a-bar range), the signal b - 1 bars later.
      // Momentum plot (histogram, yellow)
      s.momentumPlot[i] = { time, value: isNaN(mom) ? NaN : mom, color: '#FFEB3B' };
      // SMI plot (blue line)
      s.smiPlot[i] = { time, value: isNaN(smi) ? NaN : smi };
      // SMI Signal plot (red line)
      s.smiSignalPlot[i] = { time, value: (smiSignal == null || isNaN(smiSignal)) ? NaN : smiSignal };

      // barcolor(long): SMI < -35 and mom > 0 and mom[1] < 0 -> lime (barcolor0)
      // barcolor(short): SMI > 35 and mom < 0 and mom[1] > 0 -> red (barcolor1)
      // No markers: the original only colours the bars. na comparisons are false, so the colours start
      // on the first bar where SMI and mom[1] exist.
      if (i >= 1) {
        const prevMom = s.mom[i - 1];
        if (smi < -35 && mom > 0 && prevMom < 0) {
          s.barColors.push({ time, color: '#00E676', id: 'barcolor0' }); // lime
        }
        if (smi > 35 && mom < 0 && prevMom > 0) {
          s.barColors.push({ time, color: '#EF5350', id: 'barcolor1' }); // red
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'momentum': s.momentumPlot.slice(),
          'smi': s.smiPlot.slice(),
          'smiSignal': s.smiSignalPlot.slice(),
        },
        hlines: [
          { value: 40, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Over Bought' } },
          { value: -40, options: { color: '#26A69A', linestyle: 'solid' as const, title: 'Over Sold' } },
          { value: 0, options: { color: '#2196F3', linestyle: 'solid' as const, title: 'Zero Line' } },
        ],
        fills: [
          { plot1: 'hline_2', plot2: 'hline_1', options: { color: 'rgba(38, 166, 154, 0.15)', title: 'Oversold' } },
          { plot1: 'hline_2', plot2: 'hline_0', options: { color: 'rgba(239, 83, 80, 0.15)', title: 'Overbought' } },
        ],
        barColors: s.barColors.slice(),
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TopBottomCandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TopBottomCandleInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TopBottomCandle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
