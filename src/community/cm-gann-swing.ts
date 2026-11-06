/**
 * CM Gann Swing High Low V2
 *
 * Swing direction from the close against the moving averages of the highs and lows of the previous bar: +1 when the
 * close is above the SMA of the highs, -1 when it is below the SMA of the lows, 0 otherwise. The direction used is
 * the one of the non-zero bar before the last one (valuewhen(hld != 0, hld, 1)). In a down swing (-1) the SMA of the
 * highs is the swing high, in an up swing (+1) the SMA of the lows is the swing low.
 *
 * Draws the swing high (fuchsia) and the swing low (lime) as broken lines ("circles" plots, on by default), optional
 * triangles above / below the bars on them (off by default), triangles at the top / bottom of the pane on each bar of
 * a swing high / low (on by default), a green / red background on the bars closing across the swing high / low (on by
 * default) and yellow bars on these crosses (off by default).
 *
 * Reference: "CM_Gann Swing HighLow V2" by ChrisMoody (created with Glaz)
 */

import { color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMGannSwingInputs {
  /** Moving Average Period */
  length: number;
  /** Plot Up/Down Triangles at Top and Bottom of Candles/Bars? */
  pt: boolean;
  /** Plot Circles at Top and Bottom of Candles/Bars? */
  pc: boolean;
  /** Plot Triangles at Top and Bottom of Screen? */
  pttb: boolean;
  /** Show Highlight Bars on Cross Up or Cross Down? */
  shb: boolean;
  /** Show Background Highlights at Cross Up or Cross Down? */
  sbh: boolean;
}

export const defaultInputs: CMGannSwingInputs = {
  length: 3,
  pt: false,
  pc: true,
  pttb: true,
  shb: false,
  sbh: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Moving Average Period', defval: 3, min: 1 },
  { id: 'pt', type: 'bool', title: 'Plot Up/Down Triangles at Top and Bottom of Candles/Bars?', defval: false },
  { id: 'pc', type: 'bool', title: 'Plot Circles at Top and Bottom of Candles/Bars?', defval: true },
  { id: 'pttb', type: 'bool', title: 'Plot Triangles at Top and Bottom of Screen?', defval: true },
  { id: 'shb', type: 'bool', title: 'Show Highlight Bars on Cross Up or Cross Down?', defval: false },
  { id: 'sbh', type: 'bool', title: 'Show Background Highlights at Cross Up or Cross Down?', defval: true },
];

// Colour constants of the original's Pine version (1 / 2)
const FUCHSIA = '#FF00FF';
const LIME = '#00FF00';
const RED = '#FF0000';
const GREEN = '#008000';
const YELLOW = '#FFFF00';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Gann Swing High Plots-Circles', color: FUCHSIA, lineWidth: 4, style: 'linebr' },
  { id: 'plot1', title: 'Gann Swing Low Plots-Circles', color: LIME, lineWidth: 4, style: 'linebr' },
];

export const metadata = {
  title: 'CM_Gann Swing HighLow V2',
  shortTitle: 'CM_Gann_Swing_HL_V2',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };

interface GannVars {
  /** valuewhen(hld != 0, hld, 1): the hld of the last two non-zero bars */
  lastHld: number;
  prevHld: number;
}

interface GannRun extends BarRunState<GannVars> {
  smaH: WindowSma;
  smaL: WindowSma;
  smaHigh: number[];
  smaLow: number[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<CMGannSwingInputs>): BarStudy<GannRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgUp = String(color.new(GREEN, 60));
  const bgDown = String(color.new(RED, 60));
  return {
    init() {
      const smaH = new WindowSma(cfg.length);
      const smaL = new WindowSma(cfg.length);
      const s: GannRun = {
        smaH, smaL, smaHigh: [], smaLow: [], plot0: [], plot1: [], markers: [], barColors: [], bgColors: [],
        steps: [smaH, smaL], vars: { lastHld: NaN, prevHld: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.bgColors];
      s.series = [s.smaHigh, s.smaLow, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const t = b.time as number;
      const v = s.vars;
      const smaHigh = s.smaH.step(b.high) ?? NaN;
      const smaLow = s.smaL.step(b.low) ?? NaN;
      s.smaHigh[i] = smaHigh;
      s.smaLow[i] = smaLow;
      // hld = iff(close > sma(high, periods)[1], 1, iff(close < sma(low, periods)[1], -1, 0))
      const hld = i > 0 && compare.gt(b.close, s.smaHigh[i - 1]!) ? 1 : i > 0 && compare.lt(b.close, s.smaLow[i - 1]!) ? -1 : 0;
      if (hld !== 0) {
        v.prevHld = v.lastHld;
        v.lastHld = hld;
      }
      const hlv = v.prevHld;
      // hi = hlv == -1 ? sma(high, periods) : na; lo = hlv == 1 ? sma(low, periods) : na
      const hi = hlv === -1 ? smaHigh : NaN;
      const lo = hlv === 1 ? smaLow : NaN;
      // A float as a condition: true when not na and not 0
      const hiOn = !Number.isNaN(hi) && hi !== 0;
      const loOn = !Number.isNaN(lo) && lo !== 0;

      // close > hi and close[1] < hi (hi of this bar) / close < lo and close[1] > lo
      const close1 = i > 0 ? bars[i - 1]!.close : NaN;
      const crossAbove = compare.gt(b.close, hi) && compare.lt(close1, hi);
      const crossBelow = compare.lt(b.close, lo) && compare.gt(close1, lo);

      // barcolor(closeAbove() ? yellow : na) / barcolor(closeBelow() ? yellow : na)
      if (cfg.shb && crossAbove) s.barColors.push({ id: 'barcolor0', time: t, color: YELLOW });
      if (cfg.shb && crossBelow) s.barColors.push({ id: 'barcolor1', time: t, color: YELLOW });
      // bgcolor(BHcloseAbove ? green : na, transp=60) / bgcolor(BHcloseBelow ? red : na, transp=60)
      if (cfg.sbh && crossAbove) s.bgColors.push({ id: 'bgcolor0', time: t, color: bgUp });
      if (cfg.sbh && crossBelow) s.bgColors.push({ id: 'bgcolor1', time: t, color: bgDown });

      // plot(pc and hi ? hi : na, style=linebr, linewidth=4) / the same with lo
      s.plot0[i] = { time: t, value: cfg.pc && hiOn ? hi : NaN };
      s.plot1[i] = { time: t, value: cfg.pc && loOn ? lo : NaN };

      // plotshape(pt and hi ? hi : na, location.abovebar, triangledown, fuchsia) / (pt and lo, belowbar, triangleup, lime)
      if (cfg.pt && hiOn) s.markers.push({ id: 'shape0', time: t, position: 'aboveBar', shape: 'triangleDown', color: FUCHSIA });
      if (cfg.pt && loOn) s.markers.push({ id: 'shape1', time: t, position: 'belowBar', shape: 'triangleUp', color: LIME });
      // plotshape(pttb and hi ? hi : na, location.top, triangledown, red) / (pttb and lo, bottom, triangleup, lime)
      if (cfg.pttb && hiOn) s.markers.push({ id: 'shape2', time: t, position: 'top', shape: 'triangleDown', color: RED });
      if (cfg.pttb && loOn) s.markers.push({ id: 'shape3', time: t, position: 'bottom', shape: 'triangleUp', color: LIME });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMGannSwingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMGannSwingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CMGannSwing = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
