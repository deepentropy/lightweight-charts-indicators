/**
 * OBVX Conviction Bias
 *
 * On Balance Volume (cumulative sum of sign(change(close)) * volume) with a short and a long moving average of the
 * OBV (Length and round(Length * 2.718)), with a selectable average type (SMA, EMA, SMMA (RMA), WMA, VWMA). The long
 * average is green when the short average is above it, red otherwise. The area between the OBV and the short
 * average is lime when the OBV is above it, maroon otherwise; the area between the two averages is green or red.
 * A runtime error is raised when the data has no volume.
 *
 * Reference: "OBVX Conviction Bias" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ObvxConvictionBiasInputs {
  /** Smoothing Method */
  typeMA: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** Length of the short average (the long average uses round(len * 2.718)) */
  len: number;
}

export const defaultInputs: ObvxConvictionBiasInputs = {
  typeMA: 'VWMA',
  len: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeMA', type: 'string', title: 'Smoothing Method', defval: 'VWMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'len', type: 'int', title: 'Length', defval: 34, min: 1, max: 100 },
];

const OBV_COLOR = String(color.rgb(174, 243, 230));
const SHORT_COLOR = String(color.new('#f2e782', 0));
const LONG_BULL = String(color.rgb(101, 221, 105, 33));
const LONG_BEAR = String(color.rgb(223, 117, 117, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'On Balance Volume', color: OBV_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Short MA', color: SHORT_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Long MA', color: LONG_BULL, lineWidth: 1 },
];

export const metadata = {
  title: 'OBVX Conviction Bias',
  shortTitle: 'OBVX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

function maStep(typeMA: string, len: number): Ma {
  switch (typeMA) {
    case 'VWMA': { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    default: { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  }
}

interface ObvxVars {
  /** var cumVol = 0.0; cumVol += nz(volume) */
  cumVol: number;
}

interface ObvxRun extends BarRunState<ObvxVars> {
  cum: ReturnType<typeof taStep.cum>;
  short: Ma;
  long: Ma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillShort: string[];
  fillLong: string[];
}

const fillShortUp = String(color.new(color.lime, 70));
const fillShortDown = String(color.new(color.maroon, 70));
const fillLongUp = String(color.new(color.green, 40));
const fillLongDown = String(color.new('#ec1d1d', 18));

function study(inputs: Partial<ObvxConvictionBiasInputs>): BarStudy<ObvxRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const mult = 2.718;
  // obv = ta.cum(math.sign(ta.change(close)) * volume)
  const sign = (x: number) => (isNaN(x) ? NaN : x > 0 ? 1 : x < 0 ? -1 : 0);
  return {
    init() {
      const cum = taStep.cum();
      const short = maStep(cfg.typeMA, cfg.len);
      const long = maStep(cfg.typeMA, Math.round(cfg.len * mult));
      const s: ObvxRun = {
        cum, short, long, plot0: [], plot1: [], plot2: [], fillShort: [], fillLong: [],
        steps: [cum, short, long], vars: { cumVol: 0 }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.fillShort, s.fillLong];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      const obvIn = i > 0 ? sign(b.close - bars[i - 1].close) * volume : NaN;
      const obv = s.cum.step(obvIn);
      s.vars.cumVol += isNaN(volume) ? 0 : volume;
      const smoothShort = s.short.step(obv, volume);
      const smoothLong = s.long.step(obv, volume);
      s.plot0[i] = { time: t, value: obv, color: OBV_COLOR };
      s.plot1[i] = { time: t, value: smoothShort, color: SHORT_COLOR };
      // colorLong = smoothShort > smoothLong ? color.rgb(101, 221, 105, 33) : color.rgb(223, 117, 117, 33)
      s.plot2[i] = { time: t, value: smoothLong, color: gt(smoothShort, smoothLong) ? LONG_BULL : LONG_BEAR };
      // fill(plotShort, plotOBV, obv > smoothShort ? color.new(color.lime, 70) : color.new(color.maroon, 70))
      s.fillShort[i] = gt(obv, smoothShort) ? fillShortUp : fillShortDown;
      // fill(plotLong, plotShort, smoothShort > smoothLong ? color.new(color.green, 40) : color.new(#ec1d1d, 18))
      s.fillLong[i] = gt(smoothShort, smoothLong) ? fillLongUp : fillLongDown;
    },
    result(s, bars) {
      // if barstate.islast and cumVol == 0: runtime.error(...)
      if (bars.length > 0 && Math.abs(s.vars.cumVol) <= EPS) throw new Error('No volume is provided by the data vendor.');
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Short OBV Fill' }, colors: s.fillShort.slice() },
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'Long OBV Fill' }, colors: s.fillLong.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ObvxConvictionBiasInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ObvxConvictionBiasInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ObvxConvictionBias = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
