/**
 * Elliott Wave Oscillator (EWO)
 *
 * Difference between a fast SMA and a slow SMA, optionally expressed as a
 * percentage of the current price. Plotted as a two-color histogram (green
 * when positive, red when zero or negative).
 *
 * Reference: "Elliot Wave Oscillator" by Koryu
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const le = (a: number, b: number) => !Number.isNaN(a - b) && !(a - b > EPS);


export interface ElliottWaveOscInputs {
  src: SourceType;
  sma1Length: number;
  sma2Length: number;
  usePercent: boolean;
}

export const defaultInputs: ElliottWaveOscInputs = {
  src: 'close',
  sma1Length: 5,
  sma2Length: 35,
  usePercent: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'sma1Length', type: 'int', title: 'SMA 1 Length', defval: 5, min: 1 },
  { id: 'sma2Length', type: 'int', title: 'SMA 2 Length', defval: 35, min: 1 },
  { id: 'usePercent', type: 'bool', title: 'Show Dif as percent of current Candle', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EWO', color: '#26A69A', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Elliott Wave Oscillator',
  shortTitle: 'EWO',
  overlay: false,
};

type Point = { time: any; value: number; color: string };

interface EwoRun extends BarRunState<Record<string, never>> {
  sma1: WindowSma;
  sma2: WindowSma;
  ewoData: Point[];
}

function study(inputs: Partial<ElliottWaveOscInputs>): BarStudy<EwoRun, IndicatorResult> {
  const { src, sma1Length, sma2Length, usePercent } = { ...defaultInputs, ...inputs };
  const source = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma1 = new WindowSma(sma1Length);
      const sma2 = new WindowSma(sma2Length);
      const s: EwoRun = { sma1, sma2, ewoData: [], steps: [sma1, sma2], vars: {}, lists: [], series: [] };
      s.series = [s.ewoData];
      return s;
    },
    bar(s, i, bars) {
      const sv = source(bars[i]);
      const s1 = s.sma1.step(sv);
      const s2 = s.sma2.step(sv);
      if (s1 == null || s2 == null || sv == null || (usePercent && sv === 0)) {
        s.ewoData[i] = { time: bars[i].time, value: NaN, color: '#26A69A' };
        return;
      }
      const dif = s1 - s2;
      const value = usePercent ? (dif / sv) * 100 : dif;
      const color = le(value, 0) ? '#FF5252' : '#26A69A';
      s.ewoData[i] = { time: bars[i].time, value, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.ewoData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ElliottWaveOscInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ElliottWaveOscInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ElliottWaveOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
