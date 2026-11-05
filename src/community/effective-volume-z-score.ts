/**
 * Effective Volume Z-Score
 *
 * Effective volume = volume * (close - open) / (high - low) (0 on a bar with no range), smoothed by an EMA. The
 * z-score of this EMA over `length` bars (at most bar_index + 1 bars): (x - sma(x)) / stdev(x). A moving average
 * of the z-score (hidden by default), horizontal lines at 0 and at the upper / lower thresholds with a fill between
 * them, and optional regular divergences of the z-score pivots against the close (Bull / Bear labels).
 *
 * Reference: "Effective Volume Z-Score" by eugencovaci
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © eugencovaci
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EffectiveVolumeZScoreInputs {
  /** EMA length of the effective volume */
  evSmoothing: number;
  /** Z-score length */
  length: number;
  upper: number;
  lower: number;
  /** Length of the moving average of the z-score */
  smoothing: number;
  maTypeInput: 'SMA' | 'EMA' | 'SMMA (RMA)';
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotBear: boolean;
}

export const defaultInputs: EffectiveVolumeZScoreInputs = {
  evSmoothing: 14,
  length: 300,
  upper: 2,
  lower: -2,
  smoothing: 14,
  maTypeInput: 'SMA',
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: false,
  plotBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'evSmoothing', type: 'int', title: 'Effective Volume Smoothing Period', defval: 14, min: 1 },
  { id: 'length', type: 'int', title: 'Z-Score Length', defval: 300, min: 2 },
  { id: 'upper', type: 'float', title: 'Upper threshold', defval: 2 },
  { id: 'lower', type: 'float', title: 'Lower threshold', defval: -2 },
  { id: 'smoothing', type: 'int', title: 'Average Effective Volume Z-Score Period', defval: 14 },
  { id: 'maTypeInput', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)'] },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: false },
];

const BEAR_COL = String(color.new(color.red, 0));
const BULL_COL = String(color.new(color.green, 0));
const NONE_COL = String(color.new(color.white, 100));
const FILL_COL = String(color.new(color.gray, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Effective Volume Z-Score', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Average Effective Volume Z-Score', color: color.lime, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Regular Bullish', color: BULL_COL, lineWidth: 2 },
  { id: 'plot3', title: 'Regular Bearish', color: BEAR_COL, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero line', color: color.red, linestyle: 'dashed' },
  { id: 'hline_upper', price: 2, title: 'Upper threshold', color: color.gray, linestyle: 'solid' },
  { id: 'hline_lower', price: -2, title: 'Lower threshold', color: color.gray, linestyle: 'solid' },
];

/** fill(hl, hu, color = color.new(color.gray, 80)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_thresholds', plot1: 'hline_lower', plot2: 'hline_upper', color: FILL_COL, title: 'Hlines Background' },
];

export const metadata = {
  title: 'Effective Volume Z-Score',
  shortTitle: 'EVZS',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Ma = { step(v: number): number; commit(): void };

interface EvzsVars {
  /** ta.valuewhen(found, x, 1): the latest two values of each (older first) and their count (at most 2) */
  plO0: number; plO1: number; plC0: number; plC1: number; plN: number;
  phO0: number; phO1: number; phC0: number; phC1: number; phN: number;
  /** _inRange(found[1]): ta.barssince(found[1] == true), na before the first true */
  plSince: number;
  phSince: number;
}

interface EvzsRun extends BarRunState<EvzsVars> {
  ema: ReturnType<typeof taStep.ema>;
  sma: ReturnType<typeof taStep.sma>;
  std: ReturnType<typeof taStep.stdev>;
  avg: Ma;
  pl: PivotStep;
  ph: PivotStep;
  score: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<EffectiveVolumeZScoreInputs>): BarStudy<EvzsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const avgStep = (): Ma => {
    if (cfg.maTypeInput === 'EMA') return taStep.ema(cfg.smoothing);
    if (cfg.maTypeInput === 'SMMA (RMA)') return taStep.rma(cfg.smoothing);
    const m = taStep.sma();
    return { step: (v) => m.step(v, cfg.smoothing), commit: () => m.commit() };
  };
  return {
    init() {
      const s: EvzsRun = {
        ema: taStep.ema(cfg.evSmoothing), sma: taStep.sma(), std: taStep.stdev(), avg: avgStep(),
        pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        score: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [], plot3: [], markers: [],
        steps: [],
        vars: {
          plO0: NaN, plO1: NaN, plC0: NaN, plC1: NaN, plN: 0, phO0: NaN, phO1: NaN, phC0: NaN, phC1: NaN, phN: 0,
          plSince: NaN, phSince: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.ema, s.sma, s.std, s.avg, s.pl, s.ph];
      // plot2 / plot3 start lbR bars after the first bar: one point per bar from there
      s.lists = [s.plot2, s.plot3, s.markers];
      s.series = [s.score, s.plFound, s.phFound, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // effectiveVolume(): spread == 0 ? 0 : volume * (close - open) / spread
      const spread = b.high - b.low;
      const ev = eq(spread, 0) ? 0 : ((b.volume ?? NaN) * (b.close - b.open)) / spread;
      const maEv = s.ema.step(ev);
      // length := length > bar_index + 1 ? bar_index + 1 : length (one length per bar)
      const len = cfg.length > i + 1 ? i + 1 : cfg.length;
      const mean = s.sma.step(maEv, len);
      const std = s.std.step(maEv, len);
      // (src - mean) / std: a plain division (x / 0 is +-infinity, 0 / 0 na)
      const score = (maEv - mean) / std;
      s.score[i] = score;
      const avgScore = s.avg.step(score);
      s.plot0[i] = { time: b.time, value: fin(score), color: color.orange };
      s.plot1[i] = { time: b.time, value: fin(avgScore), color: color.lime };

      // Divergences
      const plFound = !isNaN(s.pl.step(i, score));
      const phFound = !isNaN(s.ph.step(i, score));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const o = i - lbR >= 0 ? s.score[i - lbR] : NaN;
      const c = i - lbR >= 0 ? bars[i - lbR].close : NaN;
      // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
      const plPrev = i > 0 && s.plFound[i - 1];
      v.plSince = plPrev ? 0 : isNaN(v.plSince) ? NaN : v.plSince + 1;
      const inRangePl = rangeLower <= v.plSince && v.plSince <= rangeUpper;
      if (plFound) {
        v.plO0 = v.plO1; v.plO1 = o; v.plC0 = v.plC1; v.plC1 = c;
        if (v.plN < 2) v.plN++;
      }
      const vwPlOsc = v.plN >= 2 ? v.plO0 : NaN;
      const vwPlClose = v.plN >= 2 ? v.plC0 : NaN;
      const oscHL = gt(o, vwPlOsc) && inRangePl;
      const priceLL = lt(c, vwPlClose);
      const bullCond = cfg.plotBull && priceLL && oscHL && plFound;

      const phPrev = i > 0 && s.phFound[i - 1];
      v.phSince = phPrev ? 0 : isNaN(v.phSince) ? NaN : v.phSince + 1;
      const inRangePh = rangeLower <= v.phSince && v.phSince <= rangeUpper;
      if (phFound) {
        v.phO0 = v.phO1; v.phO1 = o; v.phC0 = v.phC1; v.phC1 = c;
        if (v.phN < 2) v.phN++;
      }
      const vwPhOsc = v.phN >= 2 ? v.phO0 : NaN;
      const vwPhClose = v.phN >= 2 ? v.phC0 : NaN;
      const oscLH = lt(o, vwPhOsc) && inRangePh;
      const priceHH = gt(c, vwPhClose);
      const bearCond = cfg.plotBear && priceHH && oscLH && phFound;

      // plot(found ? oscLbr : na, offset = -lbR, color = cond ? col : noneColor): the value of bar i is drawn on bar i - lbR
      if (i - lbR < 0) return;
      const time = barTime(bars, i - lbR);
      const fo = fin(o);
      s.plot2.push({ time, value: plFound ? fo : NaN, color: bullCond ? BULL_COL : NONE_COL });
      s.plot3.push({ time, value: phFound ? fo : NaN, color: bearCond ? BEAR_COL : NONE_COL });
      // plotshape(cond ? oscLbr : na, offset = -lbR, shape.labelup / labeldown, location.absolute)
      if (bullCond && !isNaN(fo)) {
        s.markers.push({ time, position: 'atPriceBottom', price: fo, shape: 'labelUp', color: BULL_COL, text: ' Bull ',
          textColor: color.white });
      }
      if (bearCond && !isNaN(fo)) {
        s.markers.push({ time, position: 'atPriceTop', price: fo, shape: 'labelDown', color: BEAR_COL, text: ' Bear ',
          textColor: color.white });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero line', color: color.red, linestyle: 'dashed' } },
          { value: cfg.upper, options: { title: 'Upper threshold', color: color.gray, linestyle: 'solid' } },
          { value: cfg.lower, options: { title: 'Lower threshold', color: color.gray, linestyle: 'solid' } },
        ],
        fills: [
          { plot1: 'hline_lower', plot2: 'hline_upper', options: { title: 'Hlines Background' },
            colors: new Array<string>(n).fill(FILL_COL) },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EffectiveVolumeZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EffectiveVolumeZScoreInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EffectiveVolumeZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
