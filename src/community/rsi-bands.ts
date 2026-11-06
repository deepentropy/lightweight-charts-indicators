/**
 * RSI Bands [LazyBear]
 *
 * Overlay price-level bands derived from RSI internals.
 * Computes price levels where RSI would equal overbought/oversold thresholds.
 * ub = price level where RSI = obLevel (Resistance)
 * lb = price level where RSI = osLevel (Support)
 * mid = average(ub, lb) (RSI Midline)
 *
 * Reference: "RSI Bands [LazyBear]"
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar, SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIBandsInputs {
  obLevel: number;
  osLevel: number;
  length: number;
  src: SourceType;
}

export const defaultInputs: RSIBandsInputs = {
  obLevel: 70,
  osLevel: 30,
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'obLevel', type: 'int', title: 'RSI Overbought', defval: 70, min: 50, max: 100 },
  { id: 'osLevel', type: 'int', title: 'RSI Oversold', defval: 30, min: 0, max: 50 },
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
  { id: 'plot2', title: 'RSI Midline', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Bands',
  shortTitle: 'RSIB',
  overlay: true,
};

type Point = { time: number; value: number };

interface RsiBandsVars {
  /** auc / adc of the previous bar, the source of the previous bar */
  auc: number;
  adc: number;
  prevSrc: number;
}

interface RsiBandsRun extends BarRunState<RsiBandsVars> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<RSIBandsInputs>): BarStudy<RsiBandsRun, IndicatorResult> {
  const { obLevel, osLevel, length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

  // Pine: ep = 2 * length - 1
  const ep = 2 * length - 1;
  // auc = ema(max(src - src[1], 0), ep) and adc = ema(max(src[1] - src, 0), ep)
  // Manual EMA since we need change(src) which is src - src[1]
  const mult = 2 / (ep + 1);
  const warmup = ep;

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: RsiBandsRun = {
        plot0: [], plot1: [], plot2: [], steps: [], vars: { auc: 0, adc: 0, prevSrc: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(st, i, bars) {
      const v = st.vars;
      const t = bars[i].time;
      const s = value(bars[i]) ?? 0;
      if (i >= 1) {
        const sp = v.prevSrc ?? 0;
        const up = Math.max(s - sp, 0);
        const dn = Math.max(sp - s, 0);

        if (i === 1) {
          v.auc = up;
          v.adc = dn;
        } else {
          v.auc = up * mult + v.auc * (1 - mult);
          v.adc = dn * mult + v.adc * (1 - mult);
        }
      }
      v.prevSrc = s;

      if (i < warmup) {
        st.plot0[i] = { time: t, value: NaN };
        st.plot1[i] = { time: t, value: NaN };
        st.plot2[i] = { time: t, value: NaN };
        return;
      }

      const auc = v.auc;
      const adc = v.adc;

      // Pine: x1 = (length - 1) * ( adc * obLevel / (100-obLevel) - auc)
      const x1 = (length - 1) * (adc * obLevel / (100 - obLevel) - auc);
      // Pine: ub = iff( x1 >= 0, src + x1, src + x1 * (100-obLevel)/obLevel )
      const ub = x1 >= 0 ? s + x1 : s + x1 * (100 - obLevel) / obLevel;

      // Pine: x2 = (length - 1) * ( adc * osLevel / (100-osLevel) - auc)
      const x2 = (length - 1) * (adc * osLevel / (100 - osLevel) - auc);
      // Pine: lb = iff( x2 >= 0, src + x2, src + x2 * (100-osLevel)/osLevel )
      const lb = x2 >= 0 ? s + x2 : s + x2 * (100 - osLevel) / osLevel;

      st.plot0[i] = { time: t, value: ub };
      st.plot1[i] = { time: t, value: lb };
      st.plot2[i] = { time: t, value: (ub + lb) / 2 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIBands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
