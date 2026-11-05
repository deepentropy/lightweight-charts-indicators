/**
 * Historical Liquidity Proximity Heatmap
 *
 * Pivot highs and pivot lows are stored with the volume of their pivot bar (a buffer of the last `bufferSize` of
 * each). On every bar, the stored pivot highs above the bar high and the stored pivot lows below the bar low are
 * sorted by distance; the nearest `numPoints` of each side are drawn as dots coloured by their volume on a
 * colour theme (Viridis, Inferno, Magma, Plasma, Cividis, Turbo) between the smallest and the largest pivot volume
 * found. A volume-weighted average price of the drawn dots of each side is drawn as a dotted line.
 * As the original script (calc_bars_count = 2000), only the last `calcBarsCount` bars are calculated.
 *
 * Reference: "Historical Liquidity Proximity Heatmap [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type HLPHTheme = 'Viridis' | 'Inferno' | 'Magma' | 'Plasma' | 'Cividis' | 'Turbo';

export interface LiquidityProximityHeatmapInputs {
  /** Pivot left length */
  leftLen: number;
  /** Pivot right length */
  rightLen: number;
  /** Number of pivots kept on each side */
  bufferSize: number;
  /** Number of dots on each side (1..10) */
  numPoints: number;
  /** Dot transparency (0..100) */
  transInput: number;
  /** Colour theme */
  themeName: HLPHTheme;
  /** Calculated bars (Pine calc_bars_count): only the last bars are calculated */
  calcBarsCount: number;
}

export const defaultInputs: LiquidityProximityHeatmapInputs = {
  leftLen: 20,
  rightLen: 20,
  bufferSize: 200,
  numPoints: 10,
  transInput: 30,
  themeName: 'Viridis',
  calcBarsCount: 2000,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftLen', type: 'int', title: 'Pivot Left Length', defval: 20 },
  { id: 'rightLen', type: 'int', title: 'Pivot Right Length', defval: 20 },
  { id: 'bufferSize', type: 'int', title: 'Historical Buffer Size', defval: 200, min: 10 },
  { id: 'numPoints', type: 'int', title: 'Number of Points (P)', defval: 10, min: 1, max: 10 },
  { id: 'transInput', type: 'int', title: 'Dot Transparency', defval: 30, min: 0, max: 100 },
  { id: 'themeName', type: 'string', title: 'Color Theme', defval: 'Viridis',
    options: ['Viridis', 'Inferno', 'Magma', 'Plasma', 'Cividis', 'Turbo'] },
  { id: 'calcBarsCount', type: 'int', title: 'Calculated bars', defval: 2000, min: 1 },
];

const MAX_P = 10;

export const plotConfig: PlotConfig[] = [
  ...Array.from({ length: MAX_P }, (_v, k) => ({ id: `h${k + 1}`, title: `H${k + 1}`, color: '#787B86', lineWidth: 1, style: 'circles' as const })),
  ...Array.from({ length: MAX_P }, (_v, k) => ({ id: `l${k + 1}`, title: `L${k + 1}`, color: '#787B86', lineWidth: 1, style: 'circles' as const })),
  { id: 'vwapH', title: 'VWAP Highs', color: '#f23645', lineWidth: 1, style: 'linebr' },
  { id: 'vwapL', title: 'VWAP Lows', color: '#089981', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Historical Liquidity Proximity Heatmap [LuxAlgo]',
  shortTitle: 'LuxAlgo - HLPH',
  overlay: true,
};

// Viridis, Inferno, Magma, Plasma, Cividis, Turbo (10 colours each)
const PALETTE = [
  '#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725',
  '#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4',
  '#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf',
  '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921',
  '#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838',
  '#30123b', '#4661d6', '#37a8fa', '#1ae4b6', '#71fe5f', '#c8ef34', '#faba39', '#f56918', '#ca2a04', '#7a0403',
];
const THEME_OFFSET: Record<HLPHTheme, number> = { Viridis: 0, Inferno: 10, Magma: 20, Plasma: 30, Cividis: 40, Turbo: 50 };

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** get_color(vol, mn, mx, pal, off, trans): linear interpolation between two theme colours, channels truncated */
function getColor(vol: number, mn: number, mx: number, off: number, trans: number): string {
  let nrm = mx === mn ? 0.5 : (vol - mn) / Math.max(1.0e-10, mx - mn);
  nrm = Math.max(0.0, Math.min(1.0, nrm));
  const pos = nrm * 9.0;
  const i1 = Math.max(0, Math.min(59, off + Math.floor(pos)));
  const i2 = Math.max(0, Math.min(59, off + Math.ceil(pos)));
  const c1 = PALETTE[i1];
  const c2 = PALETTE[i2];
  const w = pos - Math.floor(pos);
  const ch = (f: (c: string) => number) => Math.trunc(f(c1) + (f(c2) - f(c1)) * w);
  return String(color.rgb(ch(color.r), ch(color.g), ch(color.b), trans));
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface HlphVars {
  /** Stored pivot highs / lows and the volume of their pivot bar (changed in place, copied by copyVars) */
  hPrice: number[];
  hVol: number[];
  lPrice: number[];
  lVol: number[];
  maxVol: number;
  minVol: number;
  hasPoints: boolean;
}

interface HlphRun extends BarRunState<HlphVars> {
  ph: PivotStep;
  pl: PivotStep;
  hPlots: Point[][];
  lPlots: Point[][];
  vwapH: Point[];
  vwapL: Point[];
}

function study(inputs: Partial<LiquidityProximityHeatmapInputs>): BarStudy<HlphRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const offset = THEME_OFFSET[cfg.themeName] ?? 50;
  const numPoints = Math.min(cfg.numPoints, MAX_P);
  const hidden = String(color.new(color.gray, 100));
  // calc_bars_count: the script runs on the last calcBarsCount bars only; the bars before have no value
  const startOf = (bars: Bar[]) => Math.max(0, bars.length - cfg.calcBarsCount);
  let start = 0;

  /** Sorting of one side: stored prices beyond the bar, by distance (Pine exchange sort), nearest numPoints */
  const side = (v: HlphVars, prices: number[], vols: number[], beyond: (p: number) => boolean, dist: (p: number) => number) => {
    const tp: number[] = [];
    const tVol: number[] = [];
    const td: number[] = [];
    for (let k = 0; k < prices.length; k++) {
      if (beyond(prices[k])) {
        tp.push(prices[k]);
        tVol.push(vols[k]);
        td.push(dist(prices[k]));
      }
    }
    for (let a = 0; a < tp.length - 1; a++) {
      for (let b = a + 1; b < tp.length; b++) {
        if (gt(td[a], td[b])) {
          [tp[a], tp[b]] = [tp[b], tp[a]];
          [tVol[a], tVol[b]] = [tVol[b], tVol[a]];
          [td[a], td[b]] = [td[b], td[a]];
        }
      }
    }
    const resP: number[] = new Array(MAX_P).fill(NaN);
    const resC: string[] = new Array(MAX_P).fill(hidden);
    let vwap = NaN;
    const limit = Math.min(tp.length, numPoints);
    if (limit > 0) {
      let sumPV = 0.0;
      let sumV = 0.0;
      for (let k = 0; k < limit; k++) {
        resP[k] = tp[k];
        resC[k] = getColor(tVol[k], v.minVol, v.maxVol, offset, cfg.transInput);
        sumPV += tp[k] * tVol[k];
        sumV += tVol[k];
      }
      // vwap := sumV > 0 ? sumPV / sumV : na
      vwap = gt(sumV, 0) ? sumPV / sumV : NaN;
    }
    return { resP, resC, vwap };
  };

  return {
    // the first calculated bar follows the bar count
    key: (bars) => String(startOf(bars)),
    init(bars) {
      start = startOf(bars);
      const ph = new PivotStep(cfg.leftLen, cfg.rightLen, true);
      const pl = new PivotStep(cfg.leftLen, cfg.rightLen, false);
      const s: HlphRun = {
        ph, pl,
        hPlots: Array.from({ length: MAX_P }, () => []),
        lPlots: Array.from({ length: MAX_P }, () => []),
        vwapH: [], vwapL: [],
        steps: [ph, pl],
        vars: { hPrice: [], hVol: [], lPrice: [], lVol: [], maxVol: 0.0, minVol: 1.0e10, hasPoints: false },
        lists: [], series: [],
      };
      s.series = [...s.hPlots, ...s.lPlots, s.vwapH, s.vwapL];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      if (i < start) {
        for (let k = 0; k < MAX_P; k++) {
          s.hPlots[k][i] = { time: t, value: NaN, color: hidden };
          s.lPlots[k][i] = { time: t, value: NaN, color: hidden };
        }
        s.vwapH[i] = { time: t, value: NaN, color: '#f23645' };
        s.vwapL[i] = { time: t, value: NaN, color: '#089981' };
        return;
      }
      // bar j of the calculated bars
      const j = i - start;
      const v = s.vars;
      const high = bars[i].high;
      const low = bars[i].low;
      const phFound = s.ph.step(j, high);
      const plFound = s.pl.step(j, low);
      // if not na(ph_found): v = volume[rightLen]; push; shift beyond bufferSize; update the volume range
      if (!isNaN(phFound)) {
        const vol = j - cfg.rightLen >= 0 ? bars[i - cfg.rightLen].volume ?? NaN : NaN;
        v.hPrice.push(phFound);
        v.hVol.push(vol);
        if (v.hPrice.length > cfg.bufferSize) {
          v.hPrice.shift();
          v.hVol.shift();
        }
        v.maxVol = v.hasPoints ? Math.max(v.maxVol, vol) : vol;
        v.minVol = v.hasPoints ? Math.min(v.minVol, vol) : vol;
        v.hasPoints = true;
      }
      if (!isNaN(plFound)) {
        const vol = j - cfg.rightLen >= 0 ? bars[i - cfg.rightLen].volume ?? NaN : NaN;
        v.lPrice.push(plFound);
        v.lVol.push(vol);
        if (v.lPrice.length > cfg.bufferSize) {
          v.lPrice.shift();
          v.lVol.shift();
        }
        v.maxVol = v.hasPoints ? Math.max(v.maxVol, vol) : vol;
        v.minVol = v.hasPoints ? Math.min(v.minVol, vol) : vol;
        v.hasPoints = true;
      }

      // Highs: p > high, distance p - high; Lows: p < low, distance low - p
      const hs = side(v, v.hPrice, v.hVol, (p) => gt(p, high), (p) => p - high);
      const ls = side(v, v.lPrice, v.lVol, (p) => lt(p, low), (p) => low - p);
      for (let k = 0; k < MAX_P; k++) {
        s.hPlots[k][i] = { time: t, value: hs.resP[k], color: hs.resC[k] };
        s.lPlots[k][i] = { time: t, value: ls.resP[k], color: ls.resC[k] };
      }
      // plot(vwap_h, "VWAP Highs", #f23645, 1, plot.style_linebr, linestyle = plot.linestyle_dotted); vwap_l #089981
      s.vwapH[i] = { time: t, value: hs.vwap, color: '#f23645' };
      s.vwapL[i] = { time: t, value: ls.vwap, color: '#089981' };
    },
    copyVars: (v) => ({ ...v, hPrice: v.hPrice.slice(), hVol: v.hVol.slice(), lPrice: v.lPrice.slice(), lVol: v.lVol.slice() }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < MAX_P; k++) plots[`h${k + 1}`] = s.hPlots[k].slice();
      for (let k = 0; k < MAX_P; k++) plots[`l${k + 1}`] = s.lPlots[k].slice();
      plots.vwapH = s.vwapH.slice();
      plots.vwapL = s.vwapL.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityProximityHeatmapInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityProximityHeatmapInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const LiquidityProximityHeatmap = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
