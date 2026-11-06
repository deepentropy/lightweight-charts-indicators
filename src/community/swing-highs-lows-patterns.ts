/**
 * Swing Highs/Lows & Candle Patterns
 *
 * Identifies swing highs/lows using ta.pivothigh/ta.pivotlow, classifies them as
 * HH/LH or HL/LL, and detects candle patterns (hammer, inverted hammer,
 * bullish engulfing, hanging man, shooting star, bearish engulfing) at pivot points.
 *
 * Reference: "Swing Highs/Lows & Candle Patterns [LuxAlgo]" by LuxAlgo (Pine v5)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SwingHighsLowsPatternsInputs {
  length: number;
  /** Swing High label text colour */
  swinghCss: string;
  /** Swing Low label text colour */
  swinglCss: string;
}

// Pine v5 colours: color.red #FF5252, color.teal #00897B
export const defaultInputs: SwingHighsLowsPatternsInputs = {
  length: 21,
  swinghCss: '#FF5252',
  swinglCss: '#00897B',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'swinghCss', type: 'color', title: 'Swing High', defval: '#FF5252' },
  { id: 'swinglCss', type: 'color', title: 'Swing Low', defval: '#00897B' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchor', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Swing Highs/Lows & Candle Patterns',
  shortTitle: 'SwingPat',
  overlay: true,
};

/** Pine max_labels_count */
const MAX_LABELS = 500;

/**
 * Pine compares floats with an absolute tolerance: a == b when |a - b| <= 1e-10.
 * So a < b only when b - a > 1e-10.
 */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; labels: LabelData[] };

interface SwingVars {
  /** Pine: var float phy = na, var float ply = na */
  phy: number;
  ply: number;
}

interface SwingRun extends BarRunState<SwingVars> {
  ph: PivotStep;
  pl: PivotStep;
  closePlot: { time: number; value: number }[];
  labels: LabelData[];
}

function study(inputs: Partial<SwingHighsLowsPatternsInputs>): BarStudy<SwingRun, Result> {
  const { length, swinghCss, swinglCss } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ph = new PivotStep(length, length, true);
      const pl = new PivotStep(length, length, false);
      const s: SwingRun = {
        ph, pl, closePlot: [], labels: [],
        steps: [ph, pl], vars: { phy: NaN, ply: NaN }, lists: [], series: [],
      };
      s.lists = [s.labels];
      s.series = [s.closePlot];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const ph = s.ph.step(i, bars[i]!.high);
      const pl = s.pl.step(i, bars[i]!.low);
      s.closePlot[i] = { time: bars[i]!.time as number, value: NaN };
      // Pine v5 `if ph` / `pl and ...`: a float is true when it is not na and not 0
      const hasPh = !Number.isNaN(ph) && ph !== 0;
      const hasPl = !Number.isNaN(pl) && pl !== 0;

      // Candle data at the pivot bar: o = open[length], ...
      const pivotIdx = i - length;
      if (pivotIdx < 0) return;

      const o = bars[pivotIdx]!.open;
      const h = bars[pivotIdx]!.high;
      const l = bars[pivotIdx]!.low;
      const c = bars[pivotIdx]!.close;
      const d = Math.abs(c - o);
      // c[1], o[1] (na before the first bar: conditions false)
      const c1 = pivotIdx >= 1 ? bars[pivotIdx - 1]!.close : NaN;
      const o1 = pivotIdx >= 1 ? bars[pivotIdx - 1]!.open : NaN;

      const isHammer = hasPl && gt(Math.min(o, c) - l, d) && lt(h - Math.max(c, o), d);
      const isInvHammer = hasPl && gt(h - Math.max(c, o), d) && lt(Math.min(c, o) - l, d);
      const isBullEng = gt(c, o) && lt(c1, o1) && gt(c, o1) && lt(o, c1);
      const isHanging = hasPh && gt(Math.min(c, o) - l, d) && lt(h - Math.max(o, c), d);
      const isShooting = hasPh && gt(h - Math.max(o, c), d) && lt(Math.min(c, o) - l, d);
      // Pine source: same condition as bullish engulfing
      const isBearEng = gt(c, o) && lt(c1, o1) && gt(c, o1) && lt(o, c1);

      let patternName = 'None';
      if (isHammer) patternName = 'Hammer';
      else if (isInvHammer) patternName = 'Inverted Hammer';
      else if (isBullEng) patternName = 'Bullish Engulfing';
      else if (isHanging) patternName = 'Hanging Man';
      else if (isShooting) patternName = 'Shooting Star';
      else if (isBearEng) patternName = 'Bearish Engulfing';

      // Pine: if ph ... else if pl (one label per bar at most)
      if (hasPh) {
        // ph > phy is false when phy is na: the first swing high is 'LH'
        const label = gt(ph, v.phy) ? 'HH' : 'LH';
        s.labels.push({
          time: bars[pivotIdx]!.time,
          price: ph,
          text: label + '\n' + patternName,
          textColor: swinghCss,
          color: 'transparent',
          style: 'label_down',
          size: 'normal',
        });
        v.phy = ph;
      } else if (hasPl) {
        // pl < ply is false when ply is na: the first swing low is 'HL'
        const label = lt(pl, v.ply) ? 'LL' : 'HL';
        s.labels.push({
          time: bars[pivotIdx]!.time,
          price: pl,
          text: label + '\n' + patternName,
          textColor: swinglCss,
          color: 'transparent',
          style: 'label_up',
          size: 'normal',
        });
        v.ply = pl;
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.closePlot.slice() },
        // Pine draws labels only (no plotshape)
        markers: [],
        labels: s.labels.slice(-MAX_LABELS),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SwingHighsLowsPatternsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SwingHighsLowsPatternsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SwingHighsLowsPatterns = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
