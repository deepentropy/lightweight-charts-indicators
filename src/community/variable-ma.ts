/**
 * Variable Moving Average (VMA) [LazyBear] / Chande VMA
 *
 * Adaptive moving average that adjusts its smoothing based on directional
 * movement index. Faster when trending, slower when ranging.
 *
 * Reference: "Variable Moving Average" by LazyBear
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VariableMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: VariableMAInputs = {
  length: 6,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 6, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Variable Moving Average',
  shortTitle: 'VMA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color?: string };

interface VmaVars {
  pdmS: number;
  mdmS: number;
  prevVMA: number;
}

interface VmaRun extends BarRunState<VmaVars> {
  srcArr: number[];
  vmaArr: number[];
  plot0: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VariableMAInputs>): BarStudy<VmaRun, Result> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const k = 2 / (length + 1);
  const invLen = 1 / length;
  const warmup = length * 3;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: VmaRun = {
        srcArr: [], vmaArr: [], plot0: [], barColors: [],
        steps: [], vars: { pdmS: 0, mdmS: 0, prevVMA: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.srcArr, s.vmaArr, s.plot0];
      return s;
    },
    bar(st, i, bars) {
      const v = st.vars;
      const srcV = value(bars[i]);
      st.srcArr[i] = srcV;
      const sv = srcV ?? 0;
      const sPrev = i > 0 ? (st.srcArr[i - 1] ?? 0) : sv;

      const pdm = Math.max(sv - sPrev, 0);
      const mdm = Math.max(sPrev - sv, 0);

      let vmaV: number;
      if (i === 0) {
        v.pdmS = pdm;
        v.mdmS = mdm;
        v.prevVMA = sv;
        vmaV = sv;
      } else {
        v.pdmS = v.pdmS * (1 - invLen) + pdm * invLen;
        v.mdmS = v.mdmS * (1 - invLen) + mdm * invLen;

        const sumDM = v.pdmS + v.mdmS;
        const pdi = sumDM !== 0 ? v.pdmS / sumDM : 0;
        const mdi = sumDM !== 0 ? v.mdmS / sumDM : 0;
        const sumDI = pdi + mdi;
        const vI = sumDI !== 0 ? Math.abs(pdi - mdi) / sumDI : 0;

        vmaV = k * vI * sv + (1 - k * vI) * v.prevVMA;
        v.prevVMA = vmaV;
      }
      st.vmaArr[i] = vmaV;

      const time = bars[i].time;
      if (i < warmup) {
        st.plot0[i] = { time, value: NaN };
        return;
      }
      const prev = st.vmaArr[i - 1];
      let color: string;
      if (vmaV > prev) color = '#26A69A';
      else if (vmaV < prev) color = '#EF5350';
      else color = '#9C27B0';
      st.plot0[i] = { time, value: vmaV, color };

      // barcolor: matches VMA line color - green when rising, red when falling, blue when flat
      if (vmaV > prev) st.barColors.push({ time, color: '#26A69A' });
      else if (vmaV < prev) st.barColors.push({ time, color: '#EF5350' });
      else st.barColors.push({ time, color: '#2196F3' });
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': st.plot0.slice() },
        barColors: st.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VariableMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VariableMAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VariableMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
