/**
 * EMA Enveloper
 *
 * EMA with high/low envelope bands.
 * upper = ema(high, length), lower = ema(low, length).
 *
 * Reference: "EMA Enveloper" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAEnveloperInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: EMAEnveloperInputs = {
  length: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Enveloper',
  shortTitle: 'EMAE',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface EmaEnvRun extends BarRunState<Record<string, never>> {
  e: ReturnType<typeof taStep.ema>;
  eu: ReturnType<typeof taStep.ema>;
  el: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<EMAEnveloperInputs>): BarStudy<EmaEnvRun, Result> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // Pine: e = ema(close, length), eu = ema(high, length), el = ema(low, length)
      const e = taStep.ema(length);
      const eu = taStep.ema(length);
      const el = taStep.ema(length);
      const s: EmaEnvRun = {
        e, eu, el, plot0: [], plot1: [], plot2: [], fillColors: [], bgColors: [],
        steps: [e, eu, el], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.e.step(value(b));
      const upper = s.eu.step(b.high);
      const lower = s.el.step(b.low);
      s.plot0[i] = { time, value: i < length ? NaN : (v ?? NaN) };
      s.plot1[i] = { time, value: i < length ? NaN : (upper ?? NaN) };
      s.plot2[i] = { time, value: i < length ? NaN : (lower ?? NaN) };
      s.fillColors[i] = i < length ? 'transparent' : '#2962FF20';

      // Background color: bull/bear/sidewise based on price vs envelope bands
      // Pine: bull_f = high > eu AND low > el, bear_f = high < eu AND low < el
      if (i < length) return;
      const up = upper ?? NaN;
      const lo = lower ?? NaN;
      if (isNaN(up) || isNaN(lo)) return;
      const h = b.high;
      const l = b.low;
      const bullF = h > up && l > lo;
      const bearF = h < up && l < lo;
      if (bullF) {
        // Strong bull if low > upper, else normal bull
        const color = l > up ? 'rgba(0,230,118,0.1)' : 'rgba(38,166,154,0.1)';
        s.bgColors.push({ time, color });
      } else if (bearF) {
        // Strong bear if high < lower, else normal bear
        const color = h < lo ? 'rgba(239,83,80,0.1)' : 'rgba(255,152,0,0.1)';
        s.bgColors.push({ time, color });
      } else {
        s.bgColors.push({ time, color: 'rgba(33,150,243,0.1)' }); // sidewise
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', colors: s.fillColors.slice() }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAEnveloperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAEnveloperInputs> = {}): Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const EMAEnveloper = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
