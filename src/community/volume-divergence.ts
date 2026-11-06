/**
 * VolumeDivergence
 *
 * Detects 4 divergence types between price and a custom weighted-MA volume oscillator.
 * Custom WMA weights by candle direction, pivot detection on volume to find divergences.
 *
 * Reference: "Volume Divergence by MM" by baymucuk
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeDivergenceInputs {
  vl1: number;
  vl2: number;
  pivotLookbackRight: number;
  pivotLookbackLeft: number;
  maxLookbackRange: number;
  minLookbackRange: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: VolumeDivergenceInputs = {
  vl1: 5,
  vl2: 8,
  pivotLookbackRight: 5,
  pivotLookbackLeft: 5,
  maxLookbackRange: 60,
  minLookbackRange: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'vl1', type: 'int', title: 'First Moving Average length', defval: 5, min: 1 },
  { id: 'vl2', type: 'int', title: 'Second Moving Average length', defval: 8, min: 1 },
  { id: 'pivotLookbackRight', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1 },
  { id: 'pivotLookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5, min: 1 },
  { id: 'maxLookbackRange', type: 'int', title: 'Max of Lookback Range', defval: 60, min: 1 },
  { id: 'minLookbackRange', type: 'int', title: 'Min of Lookback Range', defval: 5, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

// Pine v4 colours: color.green #4CAF50, color.red #FF5252; hidden colours color.new(.., 25)
const BULL_COLOR = '#4CAF50';
const BEAR_COLOR = '#FF5252';
const HIDDEN_BULL_COLOR = 'rgba(76,175,80,0.75)';
const HIDDEN_BEAR_COLOR = 'rgba(255,82,82,0.75)';
// Pine noneColor = color.new(color.white, 100)
const NONE_COLOR = 'rgba(255,255,255,0)';
// Pine: textColor = color.white (text of the divergence labels, plotshape location.absolute at the plotted value)
const TEXT_COLOR = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'vol', title: 'Volume', color: BULL_COLOR, lineWidth: 2 },
  { id: 'regBull', title: 'Regular Bullish', color: BULL_COLOR, lineWidth: 2 },
  { id: 'hidBull', title: 'Hidden Bullish', color: HIDDEN_BULL_COLOR, lineWidth: 2 },
  { id: 'regBear', title: 'Regular Bearish', color: BEAR_COLOR, lineWidth: 2 },
  { id: 'hidBear', title: 'Hidden Bearish', color: HIDDEN_BEAR_COLOR, lineWidth: 2 },
];

type PlotPoint = { time: number; value: number; color?: string };

export const metadata = {
  title: 'Volume Divergence',
  shortTitle: 'VolDiv',
  overlay: false,
};

/**
 * Custom WMA from Pine: weights volume by candle direction (positive for bullish, negative for bearish).
 * pine_wma(x, y) =>
 *   for i = 0 to y - 1
 *     weight = (y - i) * y
 *     factor = close[i] < open[i] ? -1 : 1
 *     sum += x[i] * weight * factor
 *   sum / norm
 */
function pineWmaAt(xArr: number[], bars: Bar[], period: number, i: number): number {
  if (i < period - 1) return NaN;
  let norm = 0;
  let sum = 0;
  for (let j = 0; j < period; j++) {
    const weight = (period - j) * period;
    norm += weight;
    const factor = bars[i - j].close < bars[i - j].open ? -1 : 1;
    sum += xArr[i - j] * weight * factor;
  }
  return norm === 0 ? 0 : sum / norm;
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface VdVars {
  plBars: number;
  phBars: number;
  lastPlVol: number;
  lastPlLow: number;
  lastPhVol: number;
  lastPhHigh: number;
}

interface VdRun extends BarRunState<VdVars> {
  pl: PivotStep;
  ph: PivotStep;
  /** The volume, then the chain of custom WMAs (the last one is the plotted vol) */
  chain: number[][];
  plFound: boolean[];
  phFound: boolean[];
  /** vol, regBull, hidBull, regBear, hidBear */
  plots: PlotPoint[][];
  markers: MarkerData[];
}

function study(inputs: Partial<VolumeDivergenceInputs>): BarStudy<VdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lbR = cfg.pivotLookbackRight;
  const lbL = cfg.pivotLookbackLeft;
  // Chain of custom WMAs
  const vl3 = cfg.vl1 + cfg.vl2;
  const vl4 = cfg.vl2 + vl3;
  const vl5 = vl3 + vl4;
  const periods = [cfg.vl1, cfg.vl2, vl3, vl4, vl5];
  return {
    init() {
      const pl = new PivotStep(lbL, lbR, false);
      const ph = new PivotStep(lbL, lbR, true);
      const s: VdRun = {
        pl, ph, chain: [[], [], [], [], [], []], plFound: [], phFound: [], plots: [[], [], [], [], []], markers: [], steps: [pl, ph],
        vars: { plBars: NaN, phBars: NaN, lastPlVol: NaN, lastPlLow: NaN, lastPhVol: NaN, lastPhHigh: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [...s.chain, s.plFound, s.phFound, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = s.chain;
      c[0][i] = b.volume ?? 0;
      for (let k = 0; k < 5; k++) c[k + 1][i] = pineWmaAt(c[k], bars, periods[k], i);
      const vol = c[5];
      const v = vol[i];
      const p = s.plots;
      // Volume plot colored green/red based on sign
      // Pine: vol_color = vol > 0 ? color.green : color.red
      p[0][i] = { time: b.time, value: v, color: v > 0 ? BULL_COLOR : BEAR_COLOR };

      // Pivot detection on vol: plFound / phFound are true on the confirmation bar, lbR bars after the pivot bar
      const plFound = !Number.isNaN(s.pl.step(i, v));
      const phFound = !Number.isNaN(s.ph.step(i, v));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const vr = s.vars;

      // Pine plots every pivot (value vol[lbR], offset=-lbR) and hides it with noneColor when there is no divergence:
      // bar i sets its own points to na, and the points of bar i - lbR (their only other writer) on every run
      for (let k = 1; k <= 4; k++) p[k][i] = { time: b.time, value: NaN };
      const q = i - lbR;
      if (q >= 0 && q < i) {
        const na = { time: bars[q].time, value: NaN };
        for (let k = 1; k <= 4; k++) p[k][q] = na;
      }

      // Pine: _inRange(cond) => bars = barssince(cond == true); rangeLower <= bars and bars <= rangeUpper,
      // called with plFound[1] / phFound[1]. Pine v4 `and` evaluates both sides, so barssince runs on every bar.
      if (i > 0 && s.plFound[i - 1]) vr.plBars = 0;
      else if (!Number.isNaN(vr.plBars)) vr.plBars++;
      if (i > 0 && s.phFound[i - 1]) vr.phBars = 0;
      else if (!Number.isNaN(vr.phBars)) vr.phBars++;
      const plInRange = cfg.minLookbackRange <= vr.plBars && vr.plBars <= cfg.maxLookbackRange;
      const phInRange = cfg.minLookbackRange <= vr.phBars && vr.phBars <= cfg.maxLookbackRange;

      // Pine: valuewhen(plFound, vol[lbR], 1) and valuewhen(plFound, low[lbR], 1): on a pivot bar, the previous pivot
      if (plFound) {
        const curVol = vol[q];
        const curLow = bars[q].low;
        const t = bars[q].time;
        // Regular Bullish: vol higher low, price lower low
        const bullCond = cfg.plotBull && curLow < vr.lastPlLow && curVol > vr.lastPlVol && plInRange;
        // Hidden Bullish: vol lower low, price higher low
        const hiddenBullCond = cfg.plotHiddenBull && curLow > vr.lastPlLow && curVol < vr.lastPlVol && plInRange;
        p[1][q] = { time: t, value: curVol, color: bullCond ? BULL_COLOR : NONE_COLOR };
        p[2][q] = { time: t, value: curVol, color: hiddenBullCond ? HIDDEN_BULL_COLOR : NONE_COLOR };
        if (bullCond) s.markers.push({ time: t, position: 'atPriceBottom', price: curVol, shape: 'labelUp', color: BULL_COLOR, text: ' Bull ', textColor: TEXT_COLOR, id: 'shape0' });
        if (hiddenBullCond) s.markers.push({ time: t, position: 'atPriceBottom', price: curVol, shape: 'labelUp', color: BULL_COLOR, text: ' H Bull ', textColor: TEXT_COLOR, id: 'shape1' });
        vr.lastPlVol = curVol;
        vr.lastPlLow = curLow;
      }

      if (phFound) {
        const curVol = vol[q];
        const curHigh = bars[q].high;
        const t = bars[q].time;
        // Regular Bearish: vol lower high, price higher high
        const bearCond = cfg.plotBear && curHigh > vr.lastPhHigh && curVol < vr.lastPhVol && phInRange;
        // Hidden Bearish: vol higher high, price lower high
        const hiddenBearCond = cfg.plotHiddenBear && curHigh < vr.lastPhHigh && curVol > vr.lastPhVol && phInRange;
        p[3][q] = { time: t, value: curVol, color: bearCond ? BEAR_COLOR : NONE_COLOR };
        p[4][q] = { time: t, value: curVol, color: hiddenBearCond ? HIDDEN_BEAR_COLOR : NONE_COLOR };
        if (bearCond) s.markers.push({ time: t, position: 'atPriceTop', price: curVol, shape: 'labelDown', color: BEAR_COLOR, text: ' Bear ', textColor: TEXT_COLOR, id: 'shape2' });
        if (hiddenBearCond) s.markers.push({ time: t, position: 'atPriceTop', price: curVol, shape: 'labelDown', color: BEAR_COLOR, text: ' H Bear ', textColor: TEXT_COLOR, id: 'shape3' });
        vr.lastPhVol = curVol;
        vr.lastPhHigh = curHigh;
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { vol: p[0].slice(), regBull: p[1].slice(), hidBull: p[2].slice(), regBear: p[3].slice(), hidBear: p[4].slice() },
        hlines: [
          { value: 0, options: { color: '#B2B5BE', linestyle: 'solid' as const, title: 'Baseline' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeDivergenceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeDivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
