/**
 * Tops/Bottoms
 *
 * CVI-based overbought/oversold detection.
 * Plots constant bull/bear threshold lines and star markers
 * when price exits the bull or bear zone.
 *
 * CVI = (close - SMA(hl2, length)) / (SMA(ATR(length), length) * sqrt(length))
 *
 * Reference: "Tops/Bottoms" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TopsBottomsInputs {
  length: number;
  bull: number;
  bear: number;
}

export const defaultInputs: TopsBottomsInputs = {
  length: 3,
  bull: -0.51,
  bear: 0.43,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 3, min: 1 },
  { id: 'bull', type: 'float', title: 'Bullish', defval: -0.51, step: 0.01 },
  { id: 'bear', type: 'float', title: 'Bearish', defval: 0.43, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: 'Bearish', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Tops/Bottoms',
  shortTitle: 'TB',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TbVars {
  prevBull1: boolean;
  prevBear1: boolean;
}

interface TbRun extends BarRunState<TbVars> {
  valC: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  vol: WindowSma;
  bullLine: Point[];
  bearLine: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<TopsBottomsInputs>): BarStudy<TbRun, Result> {
  const { length, bull, bear } = { ...defaultInputs, ...inputs };
  const sqrtLen = Math.sqrt(length);
  return {
    init() {
      // Pine: ValC = sma(hl2, length)
      const valC = new WindowSma(length);
      // Pine: vol = sma(atr(length), length)
      const atr = taStep.atr(length);
      const vol = new WindowSma(length);
      const s: TbRun = {
        valC, atr, vol, bullLine: [], bearLine: [], markers: [],
        steps: [valC, atr, vol], vars: { prevBull1: false, prevBear1: false }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.bullLine, s.bearLine];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vc = s.valC.step((b.high + b.low) / 2);
      const v = s.vol.step(s.atr.step(b.high, b.low, b.close));
      // Pine: plot(bull, color=green) and plot(bear, color=red) -- constant threshold lines
      s.bullLine[i] = { time: b.time, value: bull };
      s.bearLine[i] = { time: b.time, value: bear };

      if (v == null || isNaN(v) || v === 0) return;
      if (vc == null || isNaN(vc)) return;

      // Pine: cvi = (close - ValC) / (vol * sqrt(length))
      const cvi = (b.close - vc) / (v * sqrtLen);
      const bull1 = cvi <= bull;
      const bear1 = cvi >= bear;

      // Pine: bull2 = bull1[1] and not bull1 (exited bullish zone)
      if (s.vars.prevBull1 && !bull1) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: '#00E676', text: '*' });
      }
      // Pine: bear2 = bear1[1] and not bear1 (exited bearish zone)
      if (s.vars.prevBear1 && !bear1) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: '#EF5350', text: '*' });
      }

      s.vars.prevBull1 = bull1;
      s.vars.prevBear1 = bear1;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.bullLine.slice(), 'plot1': s.bearLine.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TopsBottomsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TopsBottomsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TopsBottoms = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
