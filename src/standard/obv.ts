/**
 * On Balance Volume (OBV) Indicator
 *
 * Cumulative volume indicator that adds volume on up bars and subtracts it on down bars:
 * obv = ta.cum(math.sign(ta.change(close)) * volume). The first bar has no change, so it is na.
 * Optional smoothing MA of the OBV (None by default), with Bollinger Bands for 'SMA + Bollinger Bands'.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OBVInputs {
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: OBVInputs = {
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OnBalanceVolume', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'OBV-based MA', color: '#FDD835', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'On Balance Volume',
  shortTitle: 'OBV',
  overlay: false,
};

type Point = { time: any; value: number };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface ObvRun extends BarRunState<Record<string, never>> {
  change: ReturnType<typeof taStep.change>;
  cum: ReturnType<typeof taStep.cum>;
  ma: Ma | null;
  dev: WindowStdev | null;
  plotData: Point[];
  maData: Point[];
  bbUpperData: Point[];
  bbLowerData: Point[];
}

function study(inputs: Partial<OBVInputs>): BarStudy<ObvRun, IndicatorResult> {
  const { maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  const maStep = (): Ma | null => {
    if (!enableMA) return null;
    switch (maType) {
      case 'EMA': { const m = taStep.ema(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    init() {
      const change = taStep.change();
      const cum = taStep.cum();
      const ma = maStep();
      const dev = enableMA && isBB ? new WindowStdev(maLength) : null;
      const s: ObvRun = {
        change, cum, ma, dev, plotData: [], maData: [], bbUpperData: [], bbLowerData: [],
        steps: [change, cum, ...(ma ? [ma] : []), ...(dev ? [dev] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData, s.maData, s.bbUpperData, s.bbLowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const vol = b.volume ?? NaN;
      // obv = ta.cum(math.sign(ta.change(src)) * volume)
      const obv = s.cum.step(Math.sign(s.change.step(b.close)) * vol);
      s.plotData[i] = { time, value: obv };
      const ma = s.ma ? s.ma.step(obv, vol) : NaN;
      s.maData[i] = { time, value: ma };
      if (s.dev) {
        // smoothingStDev = ta.stdev(obv, maLengthInput) * bbMultInput
        const sd = s.dev.step(obv);
        s.bbUpperData[i] = { time, value: ma + sd * bbMult };
        s.bbLowerData[i] = { time, value: ma - sd * bbMult };
      } else {
        s.bbUpperData[i] = { time, value: NaN };
        s.bbLowerData[i] = { time, value: NaN };
      }
    },
    result(s) {
      const fills: FillData[] = [];
      // color.new(color.green, 90)
      if (enableMA && isBB) fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#4CAF501A', title: 'Bollinger Bands Background Fill' } });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice(), 'plot1': s.maData.slice(), 'plot2': s.bbUpperData.slice(), 'plot3': s.bbLowerData.slice() },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OBVInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OBVInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const OBV = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
