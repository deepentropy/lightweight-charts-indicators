/**
 * DecisionPoint Price Momentum Oscillator (PMO)
 *
 * Double-smoothed ROC oscillator.
 * ROC_MA = custom EMA of 1-bar ROC (period = firstLength)
 * PMO = custom EMA of 10 * ROC_MA (period = secondLength)
 * Signal = custom EMA of PMO (period = signalLength)
 *
 * Reference: "DecisionPoint Price Momentum Oscillator [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceMomentumOscInputs {
  firstLength: number;
  secondLength: number;
  signalLength: number;
}

export const defaultInputs: PriceMomentumOscInputs = {
  firstLength: 35,
  secondLength: 20,
  signalLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'firstLength', type: 'int', title: '1st Smoothing', defval: 35, min: 1 },
  { id: 'secondLength', type: 'int', title: '2nd Smoothing', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PMO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#787B86', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Price Momentum Oscillator',
  shortTitle: 'PMO',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface PmoRun extends BarRunState<Record<string, never>> {
  rocMA: number[];
  pmo: number[];
  signal: number[];
  pmoData: Point[];
  signalData: Point[];
  histo: Point[];
  fillColors: string[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PriceMomentumOscInputs>): BarStudy<PmoRun, Result> {
  const { firstLength, secondLength, signalLength } = { ...defaultInputs, ...inputs };

  // Custom EMA: val = prev + (src - prev) * (2 / period)
  const alpha1 = 2 / firstLength;
  const alpha2 = 2 / secondLength;
  const alpha3 = 2 / signalLength;
  const warmup = firstLength;
  return {
    init() {
      const s: PmoRun = {
        rocMA: [], pmo: [], signal: [], pmoData: [], signalData: [], histo: [], fillColors: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.rocMA, s.pmo, s.signal, s.pmoData, s.signalData, s.histo, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      // 1-bar ROC
      const roc = i > 0 && bars[i - 1].close !== 0
        ? ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100
        : 0;

      // 1st smoothing
      const rocMA = i === 0 ? roc : s.rocMA[i - 1] + (roc - s.rocMA[i - 1]) * alpha1;
      s.rocMA[i] = rocMA;

      // 2nd smoothing (multiply by 10)
      const rocMA10 = 10 * rocMA;
      const pmo = i === 0 ? rocMA10 : s.pmo[i - 1] + (rocMA10 - s.pmo[i - 1]) * alpha2;
      s.pmo[i] = pmo;

      // Signal
      const signal = i === 0 ? pmo : s.signal[i - 1] + (pmo - s.signal[i - 1]) * alpha3;
      s.signal[i] = signal;

      s.pmoData[i] = { time, value: i < warmup ? NaN : pmo };
      s.signalData[i] = { time, value: i < warmup ? NaN : signal };

      if (i < warmup) {
        s.histo[i] = { time, value: NaN };
        // Fill between PMO and Signal: green when PMO > signal, red when PMO < signal
        // Pine: fill(duml, sigl, green, transp=70) and fill(duml, mdl, red, transp=70)
        s.fillColors[i] = 'rgba(0,0,0,0)';
        return;
      }
      // Pine: plot(d, style=columns, color=ehc?hc:gray, transp=80, title="Histo")
      // hc = d>0 ? (d>d[1] ? lime : green) : (d<d[1] ? red : orange)
      const d = pmo - signal;
      const dPrev = i > 0 ? s.pmo[i - 1] - s.signal[i - 1] : 0;
      let color: string;
      if (d > 0) {
        color = d > dPrev ? '#00E676' : '#26A69A';
      } else {
        color = d < dPrev ? '#EF5350' : '#FF9800';
      }
      s.histo[i] = { time, value: d, color };
      s.fillColors[i] = pmo > signal ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)';
      // Bar colors: histogram direction
      s.barColors.push({ time, color });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.pmoData.slice(), 'plot1': s.signalData.slice(), 'plot2': s.histo.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(38,166,154,0.2)' }, colors: s.fillColors.slice() }],
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
          { value: 2.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OB Level' } },
          { value: -2.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OS Level' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceMomentumOscInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceMomentumOscInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceMomentumOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
