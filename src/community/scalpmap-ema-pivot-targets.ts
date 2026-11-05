/**
 * ScalpMap - EMA Pivot Targets
 *
 * EMA 34 of the close, and the 5 nearest pivot levels above the close (H1..H5) and below it (L1..L5).
 * On each bar the previous completed bar is processed: its true range goes into a history (last 50), whose last 14
 * values give a simple average (the extension step, at least 5). Each live level counts a strike when the completed
 * close crosses it; a level with 2 strikes is retired. Pivots are found on the completed bars with a close layer
 * (tight lookback, closes) and a wick layer (wide lookback, highs / lows); a new pivot must be at least the minimum
 * swing distance away from every live level. When a side has fewer than 5 live levels, extension levels are added
 * every step beyond the furthest real pivot of that side (or beyond the close when there is none). Each side keeps
 * the 50 newest levels. The targets are the nearest live levels on each side of the current close, padded with
 * display-only levels every step beyond the furthest one. A target line breaks for one bar when its level changes.
 *
 * Reference: "ScalpMap - EMA Pivot Targets" by blockybears
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © godzcopilot
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ScalpmapEmaPivotTargetsInputs {
  /** Version label of the script (not used in the computation) */
  version: number;
  /** Close-layer pivot lookback (left and right) */
  pivotLookback: number;
  /** Wick-layer pivot lookback (left and right) */
  pivotWideLookback: number;
  /** Minimum distance between a new level and every live level */
  pivotMinSwing: number;
}

export const defaultInputs: ScalpmapEmaPivotTargetsInputs = {
  version: 0.5,
  pivotLookback: 5,
  pivotWideLookback: 20,
  pivotMinSwing: 10.0,
};

const GROUP_PIVOTS = 'Pivot Targets';

export const inputConfig: InputConfig[] = [
  { id: 'version', type: 'float', title: 'Version', defval: 0.5 },
  { id: 'pivotLookback', type: 'int', title: 'Tight Close Lookback', defval: 5, min: 1, group: GROUP_PIVOTS },
  { id: 'pivotWideLookback', type: 'int', title: 'Wide Wick Lookback', defval: 20, min: 1, group: GROUP_PIVOTS },
  { id: 'pivotMinSwing', type: 'float', title: 'Minimum Swing Distance', defval: 10.0, min: 0.0, step: 0.25, group: GROUP_PIVOTS },
];

const COLOR_EMA = '#ffb000';
const COLOR_RESISTANCE = '#5ab8ff';
const COLOR_SUPPORT = '#ff8b73';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA34', color: COLOR_EMA, lineWidth: 2 },
  ...[1, 2, 3, 4, 5].map((k) => ({
    id: `plot${k}`, title: `Pivot H${k}`, color: COLOR_RESISTANCE, lineWidth: 1, style: 'linebr' as const,
  })),
  ...[1, 2, 3, 4, 5].map((k) => ({
    id: `plot${k + 5}`, title: `Pivot L${k}`, color: COLOR_SUPPORT, lineWidth: 1, style: 'linebr' as const,
  })),
];

export const metadata = {
  title: 'ScalpMap - EMA Pivot Targets',
  shortTitle: 'ScalpMap',
  overlay: true,
};

const TARGET_COUNT = 5;
const MAX_KEEP = 50;
const EXT_STEP_FLOOR_PTS = 5.0;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

/** Completed bar of the pivot scanner (c = close, h = high, l = low) */
interface ProcBar { c: number; h: number; l: number }

/** Pivot or extension level */
interface Pivot {
  id: number;
  price: number;
  /** Confirmed close-crosses through the level */
  strikes: number;
  /** The last processed close was above the level */
  lastAbove: boolean;
  /** Synthetic (projected) level */
  isExtension: boolean;
}

type Point = { time: number; value: number; color: string };

/** Persistent state (var): arrays and pivots changed in place, copied by copyVars */
interface ScalpVars {
  procBars: ProcBar[];
  highPivots: Pivot[];
  lowPivots: Pivot[];
  trHistory: number[];
  pid: number;
  lastStep: number;
  /** The targets of the bar before (the line breaks when a target changes) */
  prevTargets: number[];
}

interface ScalpRun extends BarRunState<ScalpVars> {
  ema34: ReturnType<typeof taStep.ema>;
  plots: Point[][];
}

function study(inputs: Partial<ScalpmapEmaPivotTargetsInputs>): BarStudy<ScalpRun, IndicatorResult> {
  const { pivotLookback, pivotWideLookback, pivotMinSwing } = { ...defaultInputs, ...inputs };

  const isRetired = (p: Pivot) => p.strikes >= 2;
  // f_currentSideOf: lastAbove ? "LOW" : "HIGH"
  const isHighSide = (p: Pivot) => !p.lastAbove;
  const trimPivots = (pivots: Pivot[]) => {
    while (pivots.length > MAX_KEEP) pivots.pop();
  };

  return {
    init() {
      const s: ScalpRun = {
        ema34: taStep.ema(34),
        plots: Array.from({ length: 11 }, () => []),
        steps: [],
        vars: {
          procBars: [], highPivots: [], lowPivots: [], trHistory: [], pid: 0, lastStep: EXT_STEP_FLOOR_PTS,
          prevTargets: new Array(10).fill(NaN),
        },
        lists: [], series: [],
      };
      s.steps = [s.ema34];
      s.series = s.plots;
      return s;
    },
    bar(s, bi, bars) {
      const v = s.vars;
      const { procBars, highPivots, lowPivots, trHistory, prevTargets } = v;
      let relAboveIds: number[] = [];
      let relAbovePrices: number[] = [];
      let relAboveDists: number[] = [];
      let relBelowIds: number[] = [];
      let relBelowPrices: number[] = [];
      let relBelowDists: number[] = [];

      const passInArray = (price: number, pivots: Pivot[]) => {
        for (const p of pivots) {
          if (!isRetired(p) && lt(Math.abs(p.price - price), pivotMinSwing)) return false;
        }
        return true;
      };
      // f_pass: both arrays (the `and` is lazy: the low array is not scanned when the high array fails; no side effect)
      const pass = (price: number) => passInArray(price, highPivots) && passInArray(price, lowPivots);

      const processStrikes = (pivots: Pivot[], closeValue: number) => {
        for (const p of pivots) {
          if (!isRetired(p)) {
            const aboveNow = gt(closeValue, p.price);
            const belowNow = lt(closeValue, p.price);
            if ((aboveNow || belowNow) && aboveNow !== p.lastAbove) p.strikes += 1;
            if (aboveNow) p.lastAbove = true;
            else if (belowNow) p.lastAbove = false;
          }
        }
      };

      const processLayer = (lookback: number, useWick: boolean, closeValue: number) => {
        const i = procBars.length - lookback - 1;
        if (i >= lookback) {
          const cand = procBars[i];
          const candHigh = useWick ? cand.h : cand.c;
          const candLow = useWick ? cand.l : cand.c;
          let isHigh = true;
          let isLow = true;
          for (let k = 1; k <= lookback; k++) {
            const leftBar = procBars[i - k];
            const rightBar = procBars[i + k];
            const leftHigh = useWick ? leftBar.h : leftBar.c;
            const rightHigh = useWick ? rightBar.h : rightBar.c;
            const leftLow = useWick ? leftBar.l : leftBar.c;
            const rightLow = useWick ? rightBar.l : rightBar.c;
            if (ge(leftHigh, candHigh) || ge(rightHigh, candHigh)) isHigh = false;
            if (le(leftLow, candLow) || le(rightLow, candLow)) isLow = false;
          }
          const passHigh = pass(candHigh);
          const passLow = pass(candLow);
          if (isHigh && passHigh) {
            v.pid += 1;
            highPivots.unshift({ id: v.pid, price: candHigh, strikes: 0, lastAbove: gt(closeValue, candHigh), isExtension: false });
            trimPivots(highPivots);
          }
          if (isLow && passLow) {
            v.pid += 1;
            lowPivots.unshift({ id: v.pid, price: candLow, strikes: 0, lastAbove: gt(closeValue, candLow), isExtension: false });
            trimPivots(lowPivots);
          }
        }
      };

      const processExtensionSide = (highSide: boolean, closeValue: number, atrValue: number) => {
        const sign = highSide ? 1 : -1;
        let anchor = NaN;
        let count = 0;
        // f_scanExtensionAnchor on the high pivots, then on the low pivots
        for (const pivots of [highPivots, lowPivots]) {
          for (const p of pivots) {
            if (!isRetired(p) && isHighSide(p) === highSide) {
              count += 1;
              if (!p.isExtension) {
                if (Number.isNaN(anchor) || gt(sign * p.price, sign * anchor)) anchor = p.price;
              }
            }
          }
        }
        // ATH / ATL fallback: seed the extensions from the close
        if (Number.isNaN(anchor)) {
          anchor = closeValue;
          count = 0;
        }
        const step = Math.max(nz(atrValue), EXT_STEP_FLOOR_PTS);
        for (let k = 1; k <= 60; k++) {
          if (count >= TARGET_COUNT) break;
          const extensionPrice = anchor + sign * step * k;
          if (pass(extensionPrice)) {
            v.pid += 1;
            const entry: Pivot = { id: v.pid, price: extensionPrice, strikes: 0, lastAbove: gt(closeValue, extensionPrice), isExtension: true };
            if (highSide) {
              highPivots.unshift(entry);
              trimPivots(highPivots);
            } else {
              lowPivots.unshift(entry);
              trimPivots(lowPivots);
            }
            count += 1;
          }
        }
      };

      const insertSorted = (id: number, price: number, dist: number, ids: number[], prices: number[], dists: number[]) => {
        let inserted = false;
        const m = dists.length;
        for (let i = 0; i < m; i++) {
          if (!inserted && lt(dist, dists[i])) {
            ids.splice(i, 0, id);
            prices.splice(i, 0, price);
            dists.splice(i, 0, dist);
            inserted = true;
          }
        }
        if (!inserted) {
          ids.push(id);
          prices.push(price);
          dists.push(dist);
        }
        while (dists.length > TARGET_COUNT) {
          ids.pop();
          prices.pop();
          dists.pop();
        }
      };

      const fillSide = (prices: number[], refPrice: number, sign: number, step: number) => {
        const have = prices.length;
        if (have < TARGET_COUNT) {
          const base = have > 0 ? prices[have - 1] : refPrice;
          const st = Math.max(nz(step), EXT_STEP_FLOOR_PTS);
          for (let k = 1; k <= TARGET_COUNT - have; k++) prices.push(base + sign * st * k);
        }
      };

      const routeRelevant = (p: Pivot, refPrice: number) => {
        if (!isRetired(p)) {
          const dist = Math.abs(p.price - refPrice);
          if (gt(p.price, refPrice)) insertSorted(p.id, p.price, dist, relAboveIds, relAbovePrices, relAboveDists);
          else insertSorted(p.id, p.price, dist, relBelowIds, relBelowPrices, relBelowDists);
        }
      };

      const buildRelevantBothSides = (refPrice: number) => {
        relAboveIds = [];
        relAbovePrices = [];
        relAboveDists = [];
        relBelowIds = [];
        relBelowPrices = [];
        relBelowDists = [];
        for (const p of highPivots) routeRelevant(p, refPrice);
        for (const p of lowPivots) routeRelevant(p, refPrice);
        fillSide(relAbovePrices, refPrice, 1, v.lastStep);
        fillSide(relBelowPrices, refPrice, -1, v.lastStep);
      };

      const targetPrice = (prices: number[], index: number) => (prices.length > index ? prices[index] : NaN);

      const bar = bars[bi];
      // Bar-finalized processing (barstate.isnew is true on every historical bar)
      if (bi > 0) {
        const h1 = bars[bi - 1].high;
        const l1 = bars[bi - 1].low;
        const previousTr = bi > 1
          ? Math.max(h1 - l1, Math.max(Math.abs(h1 - bars[bi - 2].close), Math.abs(l1 - bars[bi - 2].close)))
          : h1 - l1;
        trHistory.push(previousTr);
        if (trHistory.length > 50) trHistory.shift();

        // f_avgTr: simple average of the last 14 true ranges
        const m = trHistory.length;
        const kk = Math.min(14, m);
        let total = 0.0;
        if (kk > 0) for (let i = m - kk; i <= m - 1; i++) total = total + trHistory[i];
        const atr14 = kk > 0 ? total / kk : 0.0;

        v.lastStep = Math.max(nz(atr14), EXT_STEP_FLOOR_PTS);

        const close1 = bars[bi - 1].close;
        processStrikes(highPivots, close1);
        processStrikes(lowPivots, close1);

        procBars.push({ c: close1, h: h1, l: l1 });
        const maxLookback = Math.max(pivotLookback, pivotWideLookback);
        while (procBars.length > maxLookback * 2 + 60) procBars.shift();

        processLayer(pivotLookback, false, close1);
        processLayer(pivotWideLookback, true, close1);

        processExtensionSide(true, close1, atr14);
        processExtensionSide(false, close1, atr14);
      }

      // Live target selection around the current close
      buildRelevantBothSides(bar.close);
      const targets = [
        ...[0, 1, 2, 3, 4].map((k) => targetPrice(relAbovePrices, k)),
        ...[0, 1, 2, 3, 4].map((k) => targetPrice(relBelowPrices, k)),
      ];

      s.plots[0][bi] = { time: bar.time, value: s.ema34.step(bar.close) ?? NaN, color: COLOR_EMA };
      for (let k = 0; k < 10; k++) {
        const cur = targets[k];
        const prev = prevTargets[k];
        // Break the line for one bar when the target level changes
        const value = !Number.isNaN(cur) && !Number.isNaN(prev) && ne(cur, prev) ? NaN : cur;
        s.plots[k + 1][bi] = { time: bar.time, value, color: k < 5 ? COLOR_RESISTANCE : COLOR_SUPPORT };
        prevTargets[k] = cur;
      }
    },
    copyVars: (v) => ({
      procBars: v.procBars.slice(),
      highPivots: v.highPivots.map((p) => ({ ...p })),
      lowPivots: v.lowPivots.map((p) => ({ ...p })),
      trHistory: v.trHistory.slice(),
      pid: v.pid,
      lastStep: v.lastStep,
      prevTargets: v.prevTargets.slice(),
    }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpmapEmaPivotTargetsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ScalpmapEmaPivotTargetsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ScalpmapEmaPivotTargets = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
