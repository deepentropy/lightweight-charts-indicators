/**
 * PredictiveChannels
 *
 * Dynamic support/resistance channels that adapt based on ATR.
 * Maintains an adaptive average that resets when price deviates beyond ATR,
 * then creates R2/R1/avg/S1/S2 channel levels.
 *
 * Reference: "Predictive Channels [LuxAlgo]" by LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PredictiveChannelsInputs {
  factor: number;
  slope: number;
}

export const defaultInputs: PredictiveChannelsInputs = {
  factor: 5,
  slope: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'factor', type: 'float', title: 'Factor', defval: 5, min: 0, step: 0.1 },
  { id: 'slope', type: 'float', title: 'Slope', defval: 50, min: 0, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'close', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'r2', title: 'Upper Resistance', color: '#f23645', lineWidth: 1 },
  { id: 'r1', title: 'Lower Resistance', color: 'rgba(242,54,69,0.5)', lineWidth: 1 },
  { id: 'avg', title: 'Average', color: '#787B86', lineWidth: 1 },
  { id: 's1', title: 'Upper Support', color: 'rgba(8,153,129,0.5)', lineWidth: 1 },
  { id: 's2', title: 'Lower Support', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Predictive Channels',
  shortTitle: 'PC',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface PcVars {
  pcAvg: number;
  os: number;
  holdAtr: number;
}

interface PcRun extends BarRunState<PcVars> {
  atr: ReturnType<typeof taStep.atr>;
  closePlot: Point[];
  r2: Point[];
  r1: Point[];
  avg: Point[];
  s1: Point[];
  s2: Point[];
  r2Arr: number[];
  s2Arr: number[];
  topColor: string[];
  bottomColor: string[];
}

function study(inputs: Partial<PredictiveChannelsInputs>): BarStudy<PcRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const mult = cfg.factor;
  const slopeVal = cfg.slope * mult;
  // Pine: areaBull = color.new(#089981, 80), areaBear = color.new(#f23645, 80)
  //   topcss = close > pc_avg ? areaBull : color.new(chart.bg_color, 100)
  //   btmcss = close < pc_avg ? areaBear : color.new(chart.bg_color, 100)
  //   fill(plot_0, plot_avg, pc_R2, pc_S2, topcss, btmcss)
  const areaBull = 'rgba(8,153,129,0.2)';
  const areaBear = 'rgba(242,54,69,0.2)';
  const bgTransparent = '#00000000';
  return {
    init() {
      // ATR(200) * mult
      const atr = taStep.atr(200);
      const s: PcRun = {
        atr, closePlot: [], r2: [], r1: [], avg: [], s1: [], s2: [], r2Arr: [], s2Arr: [], topColor: [], bottomColor: [],
        steps: [atr],
        // State variables matching Pine's var declarations (pc_avg = the first close)
        vars: { pcAvg: NaN, os: 1, holdAtr: 0 },
        lists: [], series: [],
      };
      s.series = [s.closePlot, s.r2, s.r1, s.avg, s.s1, s.s2, s.r2Arr, s.s2Arr, s.topColor, s.bottomColor];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      if (i === 0) v.pcAvg = close;
      const prevAvg = v.pcAvg;
      // Pine: nz(ta.atr(200)) * mult (NaN during the ATR warm-up counts as 0)
      const atrRaw = s.atr.step(b.high, b.low, b.close);
      const atr = (atrRaw === undefined || Number.isNaN(atrRaw) ? 0 : atrRaw) * mult;

      // pc_avg := math.abs(close - pc_avg) > atr ? close : pc_avg + os * hold_atr / slope
      let pcAvg = v.pcAvg;
      if (Math.abs(close - pcAvg) > atr) {
        pcAvg = close;
      } else {
        pcAvg = pcAvg + v.os * v.holdAtr / (slopeVal === 0 ? 1 : slopeVal);
      }

      // hold_atr := pc_avg == close ? atr / 2 : hold_atr
      if (pcAvg === close) {
        v.holdAtr = atr / 2;
      }
      const holdAtr = v.holdAtr;

      // os := pc_avg > pc_avg[1] ? 1 : pc_avg < pc_avg[1] ? -1 : os
      if (i > 0) {
        if (pcAvg > prevAvg) v.os = 1;
        else if (pcAvg < prevAvg) v.os = -1;
      }
      v.pcAvg = pcAvg;

      // Pine: plot(value, color = close == pc_avg ? na : css): the value is kept, the colour is na on reset bars
      const reset = close === pcAvg;
      const point = (value: number): Point => (reset ? { time: b.time, value, color: 'transparent' } : { time: b.time, value });
      const r2 = pcAvg + holdAtr;
      const s2 = pcAvg - holdAtr;
      s.r2[i] = point(r2);
      s.r1[i] = point(pcAvg + holdAtr / 2);
      s.avg[i] = point(pcAvg);
      s.s1[i] = point(pcAvg - holdAtr / 2);
      s.s2[i] = point(s2);
      // Pine: plot_0 = plot(close, color = na, display = display.none, editable = false)
      s.closePlot[i] = { time: b.time, value: close };
      s.r2Arr[i] = r2;
      s.s2Arr[i] = s2;
      s.topColor[i] = close > pcAvg ? areaBull : bgTransparent;
      s.bottomColor[i] = close < pcAvg ? areaBear : bgTransparent;
    },
    result(s) {
      const gradient = {
        topValue: s.r2Arr.slice(),
        bottomValue: s.s2Arr.slice(),
        topColor: s.topColor.slice(),
        bottomColor: s.bottomColor.slice(),
      };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          close: s.closePlot.slice(),
          r2: s.r2.slice(),
          r1: s.r1.slice(),
          avg: s.avg.slice(),
          s1: s.s1.slice(),
          s2: s.s2.slice(),
        },
        fills: [
          { plot1: 'close', plot2: 'avg', gradient },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PredictiveChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PredictiveChannelsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PredictiveChannels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
