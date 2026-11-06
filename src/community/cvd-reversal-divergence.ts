/**
 * CVD Reversal Divergence
 *
 * Cumulative volume delta (CVD): the running sum of + volume on up candles and - volume on down candles. On each
 * confirmed pivot high (pivot low) of price, the high (low) and the CVD at the pivot are compared with the previous
 * pivot: a higher high with a lower CVD, or a lower high with a higher CVD, is a bearish exhaustion (red triangle
 * above the pivot bar); a lower low with a higher CVD, or a higher low with a lower CVD, is a bullish exhaustion
 * (green triangle below the pivot bar). Pre-alerts (faint crosses) mark a bar that makes the highest high (lowest
 * low) of the last lookback + 1 bars, optionally only with a reversal candle and an early CVD divergence against the
 * last pivot.
 *
 * Reference: "CVD Reversal Divergence (Clean & Optimized)" by somnacin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CvdReversalDivergenceInputs {
  /** Pivot left / right bars */
  lookback: number;
  /** Show the potential reversal pre-alerts (crosses) */
  showPreAlert: boolean;
  /** Filter 1: a bearish candle for a top pre-alert, a bullish candle for a bottom pre-alert */
  usePAFilter: boolean;
  /** Filter 2: the CVD diverges from the CVD at the last pivot */
  useEarlyDivFilter: boolean;
}

export const defaultInputs: CvdReversalDivergenceInputs = {
  lookback: 10,
  showPreAlert: true,
  usePAFilter: true,
  useEarlyDivFilter: true,
};

const GRP = 'Pre-Alert Noise Reduction Filters';

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Pivot Confirmation Period (Lookback)', defval: 10, min: 2 },
  { id: 'showPreAlert', type: 'bool', title: 'Show Potential Reversal Pre-Alerts (faint X marks)', defval: true, group: GRP },
  { id: 'usePAFilter', type: 'bool', title: 'Filter 1: Require candle reversal character (bearish close at highs / bullish close at lows)', defval: true, group: GRP },
  { id: 'useEarlyDivFilter', type: 'bool', title: "Filter 2: Require 'early divergence' character", defval: true, group: GRP },
];

/** No plot: the outputs are the shape markers */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CVD Reversal Divergence (Clean & Optimized)',
  shortTitle: 'CVD Reversal Divergence (Clean & Optimized)',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;
/** Pine a == b: within 1e-10, false with na */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CvdVars {
  /** Price and CVD of the last pivot high / low */
  lastPhPrice: number;
  lastPhCvd: number;
  lastPlPrice: number;
  lastPlCvd: number;
}

interface CvdRun extends BarRunState<CvdVars> {
  cum: ReturnType<typeof taStep.cum>;
  ph: PivotStep;
  pl: PivotStep;
  hh: WindowExtreme;
  ll: WindowExtreme;
  cvd: number[];
  markers: MarkerData[];
}

function study(inputs: Partial<CvdReversalDivergenceInputs>): BarStudy<CvdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = cfg.lookback;
  const preHighColor = String(color.new(color.red, 70));
  const preLowColor = String(color.new(color.green, 70));
  return {
    init() {
      const cum = taStep.cum();
      const ph = new PivotStep(lb, lb, true);
      const pl = new PivotStep(lb, lb, false);
      const hh = new WindowExtreme(false, lb + 1);
      const ll = new WindowExtreme(true, lb + 1);
      const s: CvdRun = {
        cum, ph, pl, hh, ll, cvd: [], markers: [],
        steps: [cum, ph, pl, hh, ll],
        vars: { lastPhPrice: NaN, lastPhCvd: NaN, lastPlPrice: NaN, lastPlCvd: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.cvd];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // delta = volume * (close > open ? 1 : close < open ? -1 : 0); cvd = ta.cum(delta)
      const delta = (b.volume ?? NaN) * (gt(b.close, b.open) ? 1 : lt(b.close, b.open) ? -1 : 0);
      const cvd = s.cum.step(delta);
      s.cvd[i] = cvd;
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);

      // Pre-alerts (read the pivot records before this bar updates them)
      const isPotentialPHRaw = eq(b.high, hh);
      const isPotentialPLRaw = eq(b.low, ll);
      const paPH = !cfg.usePAFilter || lt(b.close, b.open);
      const paPL = !cfg.usePAFilter || gt(b.close, b.open);
      const earlyBearDiv = !cfg.useEarlyDivFilter || isNaN(v.lastPhCvd) || lt(cvd, v.lastPhCvd);
      const earlyBullDiv = !cfg.useEarlyDivFilter || isNaN(v.lastPlCvd) || gt(cvd, v.lastPlCvd);
      // plotshape(showPreAlert and isPotentialPH, "Potential High", shape.xcross, location.abovebar, color.new(red, 70), size.tiny)
      if (cfg.showPreAlert && isPotentialPHRaw && paPH && earlyBearDiv) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: preHighColor, size: 'tiny' });
      }
      if (cfg.showPreAlert && isPotentialPLRaw && paPL && earlyBullDiv) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'xcross', color: preLowColor, size: 'tiny' });
      }

      // Confirmed divergences: high[lookback], low[lookback], cvd[lookback] are the values at the pivot bar
      let isBearExhaustion = false;
      let isBullExhaustion = false;
      if (!isNaN(ph)) {
        const hP = bars[i - lb].high;
        const cP = s.cvd[i - lb];
        const hasPrev = !isNaN(v.lastPhPrice) && !isNaN(v.lastPhCvd);
        const c1 = hasPrev && gt(hP, v.lastPhPrice) && lt(cP, v.lastPhCvd);
        const c2 = hasPrev && lt(hP, v.lastPhPrice) && gt(cP, v.lastPhCvd);
        if (c1 || c2) isBearExhaustion = true;
        v.lastPhPrice = hP;
        v.lastPhCvd = cP;
      }
      if (!isNaN(pl)) {
        const lP = bars[i - lb].low;
        const cP = s.cvd[i - lb];
        const hasPrev = !isNaN(v.lastPlPrice) && !isNaN(v.lastPlCvd);
        const c3 = hasPrev && lt(lP, v.lastPlPrice) && gt(cP, v.lastPlCvd);
        const c4 = hasPrev && gt(lP, v.lastPlPrice) && lt(cP, v.lastPlCvd);
        if (c3 || c4) isBullExhaustion = true;
        v.lastPlPrice = lP;
        v.lastPlCvd = cP;
      }
      // plotshape(..., offset = -lookback): drawn on the pivot bar i - lookback
      if (isBullExhaustion) {
        s.markers.push({ time: bars[i - lb].time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      if (isBearExhaustion) {
        s.markers.push({ time: bars[i - lb].time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CvdReversalDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CvdReversalDivergenceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CvdReversalDivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
