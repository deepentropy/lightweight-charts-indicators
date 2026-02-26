/**
 * PPO Divergence Alerts
 *
 * Percentage Price Oscillator with signal line and cross alerts.
 * PPO = (EMA_fast - EMA_slow) / EMA_slow * 100.
 *
 * Reference: TradingView "PPO Divergence Alerts" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PPOAlertsInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: PPOAlertsInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PPO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'PPO Alerts',
  shortTitle: 'PPOAlerts',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PPOAlertsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const emaFast = ta.ema(source, fastLength);
  const emaSlow = ta.ema(source, slowLength);

  const emaFastArr = emaFast.toArray();
  const emaSlowArr = emaSlow.toArray();

  // PPO = (EMA_fast - EMA_slow) / EMA_slow * 100
  const ppoArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const f = emaFastArr[i];
    const s = emaSlowArr[i];
    if (f == null || s == null || s === 0) {
      ppoArr[i] = NaN;
    } else {
      ppoArr[i] = ((f - s) / s) * 100;
    }
  }

  const ppoSeries = new Series(bars, (_b, i) => ppoArr[i]);
  const signalLine = ta.ema(ppoSeries, signalLength);
  const sigArr = signalLine.toArray();

  const warmup = slowLength;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => {
      const val = typeof v === 'number' ? v : NaN;
      return { time: bars[i].time, value: (i < warmup || isNaN(val)) ? NaN : val };
    });

  // Cross alert markers
  const markers: MarkerData[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (i < warmup) continue;
    const curPPO = ppoArr[i];
    const prevPPO = ppoArr[i - 1];
    const curSig = sigArr[i] ?? NaN;
    const prevSig = sigArr[i - 1] ?? NaN;
    if (isNaN(curPPO) || isNaN(prevPPO) || isNaN(curSig) || isNaN(prevSig)) continue;
    if (prevPPO <= prevSig && curPPO > curSig) {
      markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (prevPPO >= prevSig && curPPO < curSig) {
      markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(ppoArr), 'plot1': toPlot(sigArr) },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const PPOAlerts = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
