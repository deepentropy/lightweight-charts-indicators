/**
 * Stochastic RSI Indicator
 *
 * Applies the Stochastic formula to RSI values.
 * More sensitive than standard RSI.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochRSIInputs {
  /** K smoothing period */
  smoothK: number;
  /** D smoothing period */
  smoothD: number;
  /** RSI period */
  lengthRSI: number;
  /** Stochastic period */
  lengthStoch: number;
  /** RSI source */
  src: SourceType;
}

export const defaultInputs: StochRSIInputs = {
  smoothK: 3,
  smoothD: 3,
  lengthRSI: 14,
  lengthStoch: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothK', type: 'int', title: 'K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'D', defval: 3, min: 1 },
  { id: 'lengthRSI', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'lengthStoch', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'D', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 20, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Stochastic RSI',
  shortTitle: 'Stoch RSI',
  overlay: false,
};

type Point = { time: number; value: number };

interface StochRSIRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  k: WindowSma;
  d: WindowSma;
  kData: Point[];
  dData: Point[];
}

function study(inputs: Partial<StochRSIInputs>): BarStudy<StochRSIRun, IndicatorResult> {
  const { smoothK, smoothD, lengthRSI, lengthStoch, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: StochRSIRun = {
        rsi: taStep.rsi(lengthRSI), stoch: taStep.stoch(lengthStoch), k: new WindowSma(smoothK), d: new WindowSma(smoothD),
        kData: [], dData: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.stoch, s.k, s.d];
      s.series = [s.kData, s.dData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Calculate RSI
      const rsi = s.rsi.step(value(b));
      // Apply Stochastic to RSI: stoch(rsi, rsi, rsi, lengthStoch)
      // stoch = 100 * (src - lowest(low, len)) / (highest(high, len) - lowest(low, len))
      // Here src = high = low = rsi
      const stochRsi = s.stoch.step(rsi, rsi, rsi);
      // K = SMA(stoch, smoothK)
      const k = s.k.step(stochRsi);
      // D = SMA(K, smoothD)
      const d = s.d.step(k);
      s.kData[i] = { time: b.time, value: k };
      s.dData[i] = { time: b.time, value: d };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.kData.slice(),
          'plot1': s.dData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochRSIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const StochRSI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
