/**
 * Early MACD Reversal Indicator
 *
 * MACD histogram (fast EMA - slow EMA, minus its signal EMA), coloured by sign and direction: rising above zero,
 * falling above zero, rising below zero, falling below zero. A buy signal is a negative histogram that turns up after
 * five falling negative bars; a sell signal is a positive histogram that turns down after five rising positive bars.
 * Signals colour the background and draw a triangle at the top (buy) or bottom (sell) of the pane.
 *
 * Reference: "Early MACD Reversal Indicator" by StockSignaler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by Chris Guthrie © January 24, 2025
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EarlyMacdReversalIndicatorInputs {
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Value source */
  src: SourceType;
  /** Signal EMA length */
  signalLength: number;
}

export const defaultInputs: EarlyMacdReversalIndicatorInputs = {
  fastLength: 12,
  slowLength: 26,
  src: 'close',
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Value Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9 },
];

const GROW_ZONE = '#0096c4d0';
const BUY_ZONE = '#4cff16e1';
const SELL_ZONE = '#ff1010c2';
const FALL_ZONE = '#e220b2c4';
const BUY_BG = '#02b61d94';
const SELL_BG = '#f4000083';
const SHAPE_COL = String(color.rgb(255, 255, 255));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: GROW_ZONE, lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Early MACD Reversal Indicator',
  shortTitle: 'MACD Reversal',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface EmrRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  hist: number[];
  plot0: Array<{ time: number; value: number; color: string }>;
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<EarlyMacdReversalIndicatorInputs>): BarStudy<EmrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: EmrRun = {
        fast: taStep.ema(cfg.fastLength), slow: taStep.ema(cfg.slowLength), sig: taStep.ema(cfg.signalLength),
        hist: [], plot0: [], markers: [], bgColors: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.sig];
      s.lists = [s.markers, s.bgColors];
      s.series = [s.hist, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const v = value(bars[i]);
      const macd = s.fast.step(v) - s.slow.step(v);
      const cur = macd - s.sig.step(macd);
      s.hist[i] = cur;
      const hist = s.hist;
      const h = (k: number) => (i - k >= 0 ? hist[i - k] : NaN);
      const rising = lt(h(1), cur); // hist[1] < hist
      const col = ge(cur, 0) ? (rising ? GROW_ZONE : SELL_ZONE) : (rising ? BUY_ZONE : FALL_ZONE);
      s.plot0[i] = { time: t, value: Number.isFinite(cur) ? cur : NaN, color: col };

      const buySig = lt(cur, 0) && lt(h(1), cur) && lt(h(1), 0) && lt(h(2), 0) && lt(h(3), 0)
        && lt(h(4), 0) && lt(h(5), 0) && lt(h(1), h(2)) && lt(h(2), h(3))
        && lt(h(3), h(4)) && lt(h(4), h(5));
      const sellSig = gt(cur, 0) && gt(h(1), cur) && gt(h(1), 0) && gt(h(2), 0) && gt(h(3), 0)
        && gt(h(4), 0) && gt(h(5), 0) && gt(h(1), h(2)) && gt(h(2), h(3))
        && gt(h(3), h(4)) && gt(h(4), h(5));

      // bgcolor(buySig ? #02b61d94 : na); bgcolor(sellSig ? #f4000083 : na): the later call is drawn on top
      if (sellSig) s.bgColors.push({ time: t, color: SELL_BG });
      else if (buySig) s.bgColors.push({ time: t, color: BUY_BG });

      // plotshape(buySig ? 0.01 : na, "Buy Entry", shape.triangleup, location.top, size.small, white)
      if (buySig) s.markers.push({ time: t, position: 'top', shape: 'triangleUp', color: SHAPE_COL, size: 'small' });
      // plotshape(sellSig ? 0.01 : na, "Short Entry", shape.triangledown, location.bottom, size.small, white)
      if (sellSig) s.markers.push({ time: t, position: 'bottom', shape: 'triangleDown', color: SHAPE_COL, size: 'small' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EarlyMacdReversalIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EarlyMacdReversalIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EarlyMacdReversalIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
