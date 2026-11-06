/**
 * CM Stochastic Highlight Bars
 *
 * Overlay indicator that uses Stochastic K/D values to color price bars
 * and highlight backgrounds. No K/D lines plotted on chart.
 *
 * - barcolor: orange when overbought (K > upLine), fuchsia when oversold (K < lowLine)
 * - bgcolor: red when overbought, lime when oversold (sbh mode)
 * - bgcolor: lime on strict crossUp, red on strict crossDn (sch mode)
 * - bgcolor: lime on any crossUp, red on any crossDown (sac mode)
 * - plotchar 'B'/'S' on strict crosses (sl mode)
 * - plotchar 'B'/'S' on any crosses (sacl mode)
 *
 * Reference: "CM_Stochastic Highlight Bars" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;


export interface CMStochHighlightInputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
  upLine: number;
  lowLine: number;
  sbc: boolean;
  sbh: boolean;
  sch: boolean;
  sl: boolean;
  sac: boolean;
  sacl: boolean;
}

export const defaultInputs: CMStochHighlightInputs = {
  kLen: 14,
  kSmooth: 3,
  dSmooth: 3,
  upLine: 80,
  lowLine: 20,
  sbc: true,
  sbh: false,
  sch: false,
  sl: true,
  sac: false,
  sacl: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Length for Stochastic', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'SmoothK for Stochastic', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: 'SmoothD for Stochastic', defval: 3, min: 1 },
  { id: 'upLine', type: 'int', title: 'Upper Line Value', defval: 80, min: 50 },
  { id: 'lowLine', type: 'int', title: 'Lower Line Value', defval: 20, min: 10 },
  { id: 'sbc', type: 'bool', title: 'Show Price Bar Highlight', defval: true },
  { id: 'sbh', type: 'bool', title: 'Show Background Highlight Above/Below', defval: false },
  { id: 'sch', type: 'bool', title: 'Show Background Highlight Strict Cross', defval: false },
  { id: 'sl', type: 'bool', title: 'Show B/S Letters Strict Cross', defval: true },
  { id: 'sac', type: 'bool', title: 'Show Background Highlight Any Cross', defval: false },
  { id: 'sacl', type: 'bool', title: 'Show B/S Letters Any Cross', defval: false },
];

// No visible plots on chart - this is overlay=true with barcolor/bgcolor/markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CM Stochastic Highlight Bars',
  shortTitle: 'CMStochHL',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };

interface CmStochRun extends BarRunState<{ rawK: number; k1: number; d1: number }> {
  /** ta.stoch: the lowest low and highest high of kLen bars */
  lowest: WindowExtreme;
  highest: WindowExtreme;
  kSma: WindowSma;
  dSma: WindowSma;
  barColors: BarColorData[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<CMStochHighlightInputs>): BarStudy<CmStochRun, Result> {
  const { kLen, kSmooth, dSmooth, upLine, lowLine, sbc, sbh, sch, sl, sac, sacl } = { ...defaultInputs, ...inputs };
  const warmup = kLen + kSmooth + dSmooth;
  return {
    init() {
      // the length check of ta.stoch, then its windows
      taStep.stoch(kLen);
      const lowest = new WindowExtreme(true, kLen);
      const highest = new WindowExtreme(false, kLen);
      const kSma = new WindowSma(kSmooth);
      const dSma = new WindowSma(dSmooth);
      const s: CmStochRun = {
        lowest, highest, kSma, dSma, barColors: [], bgColors: [], markers: [],
        steps: [lowest, highest, kSma, dSma], vars: { rawK: NaN, k1: NaN, d1: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // k = ta.sma(ta.stoch(close, high, low, kLen), kSmooth); d = ta.sma(k, dSmooth)
      // ta.stoch = 100 * (close - lowest(low)) / (highest(high) - lowest(low)); an na result keeps the previous one
      const lo = s.lowest.step(b.low);
      const stoch = (100 * (b.close - lo)) / (s.highest.step(b.high) - lo);
      if (!Number.isNaN(stoch)) s.vars.rawK = stoch;
      const kVal = s.kSma.step(s.vars.rawK);
      const dVal = s.dSma.step(kVal);
      // K[1] / D[1]
      const v = s.vars;
      const k1 = v.k1;
      const d1 = v.d1;
      v.k1 = kVal;
      v.d1 = dVal;
      if (i < warmup) return;

      const aboveLine = gt(kVal, upLine);
      const belowLine = lt(kVal, lowLine);

      // barcolor: orange when overbought, fuchsia when oversold
      if (sbc) {
        if (aboveLine) {
          s.barColors.push({ id: 'barcolor0', time, color: '#FF9800' }); // orange
        } else if (belowLine) {
          s.barColors.push({ id: 'barcolor0', time, color: '#FF00FF' }); // fuchsia
        }
      }

      // bgcolor: above/below line highlights
      if (sbh) {
        if (aboveLine) {
          s.bgColors.push({ id: 'bgcolor0', time, color: 'rgba(255, 0, 0, 0.30)' }); // red transp=70
        }
        if (belowLine) {
          s.bgColors.push({ id: 'bgcolor1', time, color: 'rgba(0, 255, 0, 0.30)' }); // lime transp=70
        }
      }

      if (i < warmup + 1) return;

      if (isNaN(k1) || isNaN(d1)) return;

      // Strict cross definitions: K[1] was below lowLine and below D[1], now K > D
      const crossUp = (lt(k1, d1) && lt(k1, lowLine)) && gt(kVal, dVal);
      // K[1] was above upLine and above D[1], now K < D
      const crossDn = (gt(k1, d1) && gt(k1, upLine)) && lt(kVal, dVal);

      // Any cross definitions
      const crossUpAll = lt(k1, d1) && gt(kVal, dVal);
      const crossDownAll = gt(k1, d1) && lt(kVal, dVal);

      // bgcolor: strict cross highlights
      if (sch) {
        if (crossUp) {
          s.bgColors.push({ id: 'bgcolor2', time, color: 'rgba(0, 255, 0, 0.60)' }); // lime transp=40
        }
        if (crossDn) {
          s.bgColors.push({ id: 'bgcolor3', time, color: 'rgba(255, 0, 0, 0.60)' }); // red transp=40
        }
      }

      // bgcolor: any cross highlights
      if (sac) {
        if (crossUpAll) {
          s.bgColors.push({ id: 'bgcolor4', time, color: 'rgba(0, 255, 0, 0.60)' }); // lime transp=40
        }
        if (crossDownAll) {
          s.bgColors.push({ id: 'bgcolor5', time, color: 'rgba(255, 0, 0, 0.60)' }); // red transp=40
        }
      }

      // markers: strict cross B/S
      if (sl) {
        if (crossUp) {
          s.markers.push({ id: 'char0', time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'B' });
        }
        if (crossDn) {
          s.markers.push({ id: 'char1', time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'S' });
        }
      }

      // markers: any cross B/S
      if (sacl) {
        if (crossUpAll) {
          s.markers.push({ id: 'char2', time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'B' });
        }
        if (crossDownAll) {
          s.markers.push({ id: 'char3', time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'S' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMStochHighlightInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMStochHighlightInputs> = {}): Omit<IndicatorResult, 'markers'> {
  return fullResult(createRun(inputs).update(bars));
}

export const CMStochHighlight = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
