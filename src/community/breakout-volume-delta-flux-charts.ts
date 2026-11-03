/**
 * Breakout Volume Delta | Flux Charts
 *
 * Swing levels and the buy / sell volume of the candle that breaks them.
 * - Swings: the bars of "Swing Timeframe" (the chart timeframe when empty or lower) are built from the chart bars
 *   (highest high and lowest low with the time of the chart bar where each was made). When a period is complete,
 *   the period "Right" periods back is a swing high when its high is strictly above the highs of the "Right"
 *   periods after it and of the "Left" periods before it (same rule for a swing low). Each new swing draws a dotted
 *   level line from the bar of the swing to "Extend Levels" bars after the current bar (or extended to the right),
 *   and only the "Show Nearest" newest levels of each side are kept.
 * - Breakout: a close (or a wick) beyond a level mitigates it: the line stops at that bar and turns solid. With the
 *   "Breakout Volume Filter", a breakout whose buy (sell) share of the volume is not above the threshold deletes the
 *   level instead.
 * - Breakout candle: an outline in the volume delta colour of the direction, its body split into the buy share
 *   (green) and the sell share (red), and a label with the buy and sell volume and their shares.
 *
 * Limit, lower-timeframe volume: the original sums the volume of the bullish (close > open) and of the bearish
 * (close < open) bars of "Volume Delta LTF" (default 1 minute) inside each chart bar with request.security_lower_tf.
 * The bars passed to a port are the chart bars only, so the port ESTIMATES these two sums with the chart bar itself
 * as its only intrabar: all its volume is buy volume when close > open, sell volume when close < open, else none
 * (the expression of the original applied to the chart bar). This is the value of the original when "Volume Delta
 * LTF" is the chart timeframe; below the chart timeframe the label texts, the split of the candle bodies and the
 * "Breakout Volume Filter" are NOT those of the original (which also has no intrabars on old bars: there it shows
 * 0 volumes and 50 % shares). A timeframe above the chart timeframe throws the error of the original. Everything
 * else (levels, breakouts without the filter, outline candles, label places and colours) does not use these sums.
 *
 * Chart values (optional third argument of calculate): the chart timeframe (bar duration of the level ends, swing
 * timeframe), the exchange calendar for the swing periods (time zone, session) and the symbol tick (flat candle
 * bodies, label offsets).
 *
 * Reference: "Breakout Volume Delta | Flux Charts" by fluxchart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©fluxchart
 */

import {
  str, color, timeframe, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line,
} from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { chartTimeframe, periodChanges } from '../anchor-period';
import { lowerTimeframe } from '../lower-tf-volume';
import type { StudyDrawingKind } from '../style-outputs';

type LineStyleName = 'Solid' | 'Dashed' | 'Dotted';

export interface BreakoutVolumeDeltaFluxChartsInputs {
  /** Swing Left */
  swLenL: number;
  /** Swing Right */
  swLenR: number;
  /** Swing Timeframe ("" = chart) */
  swTfIn: string;
  /** Volume Delta LTF */
  vdLtf: string;
  /** Breakout by */
  brMode: 'Close' | 'Wick';
  /** Show Nearest */
  maxLvls: number;
  /** Breakout Volume Filter */
  brVolFiltOn: boolean;
  /** Breakout Volume Filter threshold (%) */
  brVolFiltPctIn: number;
  unmitStyleIn: LineStyleName;
  unmitW: number;
  unmitHiCol: string;
  unmitLoCol: string;
  brkStyleIn: LineStyleName;
  brkW: number;
  brkHiCol: string;
  brkLoCol: string;
  /** Volume Delta bullish colour */
  bullBase: string;
  /** Volume Delta bearish colour */
  bearBase: string;
  /** Extend Levels (bars) */
  extendBars: number;
  extendRight: boolean;
  /** Volume Delta Labels */
  dbgShow: boolean;
}

export const defaultInputs: BreakoutVolumeDeltaFluxChartsInputs = {
  swLenL: 10,
  swLenR: 10,
  swTfIn: '',
  vdLtf: '1',
  brMode: 'Close',
  maxLvls: 5,
  brVolFiltOn: false,
  brVolFiltPctIn: 60,
  unmitStyleIn: 'Dotted',
  unmitW: 1,
  unmitHiCol: '#00E676',
  unmitLoCol: '#F23645',
  brkStyleIn: 'Solid',
  brkW: 1,
  brkHiCol: '#00E676',
  brkLoCol: '#F23645',
  bullBase: '#00FF6A',
  bearBase: '#FF2D55',
  extendBars: 5,
  extendRight: false,
  dbgShow: true,
};

const GRP_SW = 'GENERAL CONFIGURATION';
const GRP_LN = 'Styling';
const STYLES = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'swLenL', type: 'int', title: 'Swing Left', defval: 10, min: 1, group: GRP_SW, inline: 'sw' },
  { id: 'swLenR', type: 'int', title: 'Right', defval: 10, min: 1, group: GRP_SW, inline: 'sw' },
  { id: 'swTfIn', type: 'timeframe', title: 'Swing Timeframe', defval: '', group: GRP_SW,
    tooltip: 'Timeframe used to detect swing highs/lows.' },
  { id: 'vdLtf', type: 'timeframe', title: 'Volume Delta LTF', defval: '1', group: GRP_SW,
    tooltip: 'Lower timeframe used to estimate buy vs sell volume for the breakout candle.' },
  { id: 'brMode', type: 'string', title: 'Breakout by', defval: 'Close', options: ['Close', 'Wick'], group: GRP_SW,
    tooltip: 'Choose whether a level is considered broken by candle wicks or by candle close.' },
  { id: 'maxLvls', type: 'int', title: 'Show Nearest', defval: 5, min: 1, group: GRP_SW,
    tooltip: 'Limits how many most recent swing high/low levels shown on the chart.' },
  { id: 'brVolFiltOn', type: 'bool', title: 'Breakout Volume Filter', defval: false, group: GRP_SW, inline: 'bv',
    tooltip: 'Only count breakouts when the breakout candle has enough bull/bear volume dominance.' },
  { id: 'brVolFiltPctIn', type: 'float', title: '', defval: 60, min: 0, max: 100, step: 0.5, group: GRP_SW, inline: 'bv' },
  { id: 'unmitStyleIn', type: 'string', title: 'Unmitigated Levels', defval: 'Dotted', options: STYLES, group: GRP_LN, inline: 'unm' },
  { id: 'unmitW', type: 'int', title: '', defval: 1, min: 1, max: 4, group: GRP_LN, inline: 'unm' },
  { id: 'unmitHiCol', type: 'color', title: '', defval: '#00E676', group: GRP_LN, inline: 'unm' },
  { id: 'unmitLoCol', type: 'color', title: '', defval: '#F23645', group: GRP_LN, inline: 'unm' },
  { id: 'brkStyleIn', type: 'string', title: 'Broken Levels', defval: 'Solid', options: STYLES, group: GRP_LN, inline: 'brk' },
  { id: 'brkW', type: 'int', title: '', defval: 1, min: 1, max: 4, group: GRP_LN, inline: 'brk' },
  { id: 'brkHiCol', type: 'color', title: '', defval: '#00E676', group: GRP_LN, inline: 'brk' },
  { id: 'brkLoCol', type: 'color', title: '', defval: '#F23645', group: GRP_LN, inline: 'brk' },
  { id: 'bullBase', type: 'color', title: 'Volume Delta', defval: '#00FF6A', group: GRP_LN, inline: 'vd' },
  { id: 'bearBase', type: 'color', title: '', defval: '#FF2D55', group: GRP_LN, inline: 'vd' },
  { id: 'extendBars', type: 'int', title: 'Extend Levels', defval: 5, min: 1, group: GRP_LN, inline: 'ext11' },
  { id: 'extendRight', type: 'bool', title: 'Extend Right', defval: false, group: GRP_LN, inline: 'ext' },
  { id: 'dbgShow', type: 'bool', title: 'Volume Delta Labels', defval: true, group: GRP_LN, inline: 'ext' },
];

export const plotConfig: PlotConfig[] = [];

/** The three plotcandle() of the original (keys of the result's plotCandles) */
export const plotCandleConfig = [
  { id: 'candle0', title: 'Breakout Delta Top/Bottom (Opp Segment)' },
  { id: 'candle1', title: 'Breakout Delta Top/Bottom (Main Segment)' },
  { id: 'candle2', title: 'Breakout Outline' },
];

/** Drawings of the script */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Breakout Volume Delta | Flux Charts',
  shortTitle: 'Breakout Volume Delta | Flux Charts',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const NA = 'transparent';

const lineStyle = (s: string) => (s === 'Solid' ? 'solid' : s === 'Dashed' ? 'dashed' : 'dotted') as 'solid' | 'dashed' | 'dotted';

/** fFmt(): K / M / B suffix, two decimals from 1,000 on */
function fFmt(v: number): string {
  const av = Math.abs(v);
  const suf = av >= 1e9 ? 'B' : av >= 1e6 ? 'M' : av >= 1e3 ? 'K' : '';
  const div = av >= 1e9 ? 1e9 : av >= 1e6 ? 1e6 : av >= 1e3 ? 1e3 : 1;
  return str.tostring(v / div, av >= 1e3 ? '#.##' : '#') + suf;
}

/** fPctStr(): share in percent with one decimal */
function fPctStr(pct01: number): string {
  const p = Math.max(0, Math.min(1, pct01)) * 100;
  return `${str.tostring(p, '#.#')}%`;
}

interface SwBar {
  hp: number;
  ht: number;
  lp: number;
  lt: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BreakoutVolumeDeltaFluxChartsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const swLenL = Math.trunc(cfg.swLenL);
  const swLenR = Math.trunc(cfg.swLenR);
  const maxLvls = Math.trunc(cfg.maxLvls);
  const mintick = mintickOf(chart);
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;

  // request.security_lower_tf: a timeframe above the chart timeframe is an error (the sums are the estimate)
  if (n > 0) lowerTimeframe(bars, true, cfg.vdLtf, chart);

  // chartSec = timeframe.in_seconds(timeframe.period); barMs = chartSec * 1000
  const chartTf = chartTimeframe(bars, chart);
  const chartSec = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
  const barMs = isNaN(chartSec) ? 60000 : chartSec * 1000;

  // tfResolve(): "" or a timeframe below the chart timeframe is the chart timeframe (every bar is a period)
  let swTf = cfg.swTfIn.trim();
  if (swTf !== '' && !isNaN(chartSec) && timeframe.in_seconds(swTf) < chartSec) swTf = '';
  const swNewTfs = periodChanges(bars, swTf, chart);

  const unmitStyle = lineStyle(cfg.unmitStyleIn);
  const brkStyle = lineStyle(cfg.brkStyleIn);
  const useWick = cfg.brMode === 'Wick';
  const brVolThr = Math.max(0, Math.min(1, cfg.brVolFiltPctIn / 100));
  const { unmitW, brkW, unmitHiCol, unmitLoCol, brkHiCol, brkLoCol, bullBase, bearBase, extendRight } = cfg;
  const labelColor = String(color.new('#000000', 100));

  resetDrawings({ line: 500, label: 500 });

  const linesHi: Line[] = [];
  const pricesHi: number[] = [];
  const mitigHi: boolean[] = [];
  const linesLo: Line[] = [];
  const pricesLo: number[] = [];
  const mitigLo: boolean[] = [];
  const swHist: SwBar[] = [];
  let swInited = false;
  let swCur: SwBar = { hp: NaN, ht: NaN, lp: NaN, lt: NaN };
  let lastPhT = NaN;
  let lastPlT = NaN;

  const fTrim = () => {
    while (linesHi.length > maxLvls) {
      line.delete(linesHi.shift()!);
      pricesHi.shift();
      mitigHi.shift();
    }
    while (linesLo.length > maxLvls) {
      line.delete(linesLo.shift()!);
      pricesLo.shift();
      mitigLo.shift();
    }
  };

  const opp: PlotCandleData[] = [];
  const main: PlotCandleData[] = [];
  const outline: PlotCandleData[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const time = b.time * ms;
    const extX2 = time + cfg.extendBars * barMs;

    // swing engine
    if (i === 0) {
      swInited = false;
      swCur = { hp: NaN, ht: NaN, lp: NaN, lt: NaN };
      swHist.length = 0;
    }
    const swNewTf = swNewTfs[i];
    if (swNewTf && swInited) {
      swHist.unshift(swCur);
      const keepN = Math.max(50, swLenL + swLenR + 10);
      while (swHist.length > keepN) swHist.pop();
      swInited = false;
      swCur = { hp: NaN, ht: NaN, lp: NaN, lt: NaN };
    }
    if (!swInited) {
      swCur.hp = b.high;
      swCur.ht = time;
      swCur.lp = b.low;
      swCur.lt = time;
      swInited = true;
    } else {
      if (isNaN(swCur.hp) || gt(b.high, swCur.hp)) {
        swCur.hp = b.high;
        swCur.ht = time;
      }
      if (isNaN(swCur.lp) || lt(b.low, swCur.lp)) {
        swCur.lp = b.low;
        swCur.lt = time;
      }
    }

    if (swNewTf && swHist.length >= swLenL + swLenR + 1) {
      const cand = swHist[swLenR];
      const candH = cand.hp;
      const candL = cand.lp;
      let isPh = !isNaN(candH);
      let isPl = !isNaN(candL);
      const test = (j: number) => {
        const s = swHist[j];
        // candH <= b.h.p (Pine: not above by more than 1e-10)
        if (isPh && !isNaN(s.hp) && !gt(candH, s.hp)) isPh = false;
        if (isPl && !isNaN(s.lp) && !lt(candL, s.lp)) isPl = false;
      };
      for (let j = 0; j <= swLenR - 1; j++) test(j);
      for (let j = swLenR + 1; j <= swLenR + swLenL; j++) test(j);

      if (isPh && (isNaN(lastPhT) || cand.ht !== lastPhT)) {
        const ln = line.new(cand.ht, candH, extendRight ? time : extX2, candH, 'bar_time',
          extendRight ? 'right' : 'none', unmitHiCol, unmitStyle, unmitW);
        linesHi.push(ln);
        pricesHi.push(candH);
        mitigHi.push(false);
        fTrim();
        lastPhT = cand.ht;
      }
      if (isPl && (isNaN(lastPlT) || cand.lt !== lastPlT)) {
        const ln = line.new(cand.lt, candL, extendRight ? time : extX2, candL, 'bar_time',
          extendRight ? 'right' : 'none', unmitLoCol, unmitStyle, unmitW);
        linesLo.push(ln);
        pricesLo.push(candL);
        mitigLo.push(false);
        fTrim();
        lastPlT = cand.lt;
      }
    }

    // lower-timeframe bull / bear volume: estimate with the chart bar as its only intrabar (see the header)
    const vol = b.volume ?? NaN;
    const bullVol = gt(b.close, b.open) ? vol : 0;
    const bearVol = lt(b.close, b.open) ? vol : 0;
    const totalVol = bullVol + bearVol;
    let bullPct = gt(totalVol, 0) ? bullVol / totalVol : 0.5;
    bullPct = Math.max(0, Math.min(1, bullPct));
    let bearPct = gt(totalVol, 0) ? 1 - bullPct : 0.5;
    bearPct = Math.max(0, Math.min(1, bearPct));

    // breakouts
    let didHighBreak = false;
    let didLowBreak = false;
    for (let k = linesHi.length - 1; k >= 0; k--) {
      if (mitigHi[k]) continue;
      const lvl = pricesHi[k];
      if (!(useWick ? gt(b.high, lvl) : gt(b.close, lvl))) continue;
      const volOk = !cfg.brVolFiltOn || gt(bullPct, brVolThr);
      if (cfg.brVolFiltOn && !volOk) {
        line.delete(linesHi[k]);
        linesHi.splice(k, 1);
        pricesHi.splice(k, 1);
        mitigHi.splice(k, 1);
      } else {
        mitigHi[k] = true;
        const ln = linesHi[k];
        line.set_style(ln, brkStyle);
        line.set_width(ln, brkW);
        line.set_color(ln, brkHiCol);
        line.set_extend(ln, 'none');
        line.set_x2(ln, time);
        line.set_y2(ln, lvl);
        didHighBreak = true;
      }
    }
    for (let k = linesLo.length - 1; k >= 0; k--) {
      if (mitigLo[k]) continue;
      const lvl = pricesLo[k];
      if (!(useWick ? lt(b.low, lvl) : lt(b.close, lvl))) continue;
      const volOk = !cfg.brVolFiltOn || gt(bearPct, brVolThr);
      if (cfg.brVolFiltOn && !volOk) {
        line.delete(linesLo[k]);
        linesLo.splice(k, 1);
        pricesLo.splice(k, 1);
        mitigLo.splice(k, 1);
      } else {
        mitigLo[k] = true;
        const ln = linesLo[k];
        line.set_style(ln, brkStyle);
        line.set_width(ln, brkW);
        line.set_color(ln, brkLoCol);
        line.set_extend(ln, 'none');
        line.set_x2(ln, time);
        line.set_y2(ln, lvl);
        didLowBreak = true;
      }
    }

    // unmitigated levels follow the current bar
    const follow = (lines: Line[], prices: number[], mitig: boolean[], col: string) => {
      for (let k = 0; k < lines.length; k++) {
        if (mitig[k]) continue;
        const ln = lines[k];
        line.set_color(ln, col);
        line.set_width(ln, unmitW);
        line.set_style(ln, unmitStyle);
        line.set_y2(ln, prices[k]);
        if (extendRight) {
          line.set_extend(ln, 'right');
          line.set_x2(ln, time);
        } else {
          line.set_extend(ln, 'none');
          line.set_x2(ln, extX2);
        }
      }
    };
    follow(linesHi, pricesHi, mitigHi, unmitHiCol);
    follow(linesLo, pricesLo, mitigLo, unmitLoCol);

    // breakout candle
    const breakBar = didHighBreak || didLowBreak;
    const outlineCol = breakBar ? (didHighBreak ? bullBase : bearBase) : NA;
    outline.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: NA,
      wickColor: outlineCol, borderColor: outlineCol });
    if (breakBar) {
      const isBullBreak = didHighBreak;
      let bodyTop = Math.max(b.open, b.close);
      let bodyBtm = Math.min(b.open, b.close);
      let bodyRng = bodyTop - bodyBtm;
      if (bodyRng - 0 <= EPS) {
        const pad0 = Math.max(b.high - b.low, mintick) * 0.35;
        bodyTop = b.close + pad0;
        bodyBtm = b.close - pad0;
        bodyRng = bodyTop - bodyBtm;
      }
      let fillOpen: number;
      let fillClose: number;
      let oppOpen: number;
      let oppClose: number;
      if (isBullBreak) {
        const cut = bodyBtm + bodyRng * bullPct;
        fillOpen = bodyBtm;
        fillClose = cut;
        oppOpen = cut;
        oppClose = bodyTop;
      } else {
        const cut = bodyTop - bodyRng * bearPct;
        fillOpen = cut;
        fillClose = bodyTop;
        oppOpen = bodyBtm;
        oppClose = cut;
      }
      main.push({ time: b.time, open: fillOpen, high: Math.max(fillOpen, fillClose), low: Math.min(fillOpen, fillClose),
        close: fillClose, color: isBullBreak ? bullBase : bearBase, wickColor: NA, borderColor: NA });
      opp.push({ time: b.time, open: oppOpen, high: Math.max(oppOpen, oppClose), low: Math.min(oppOpen, oppClose),
        close: oppClose, color: isBullBreak ? bearBase : bullBase, wickColor: NA, borderColor: NA });

      if (cfg.dbgShow) {
        const text = `${fFmt(bullVol)} (${fPctStr(bullPct)}) | ${fFmt(bearVol)} (${fPctStr(bearPct)})`;
        const pad = Math.max(b.high - b.low, mintick) * 0.25;
        label.new(i, isBullBreak ? b.high + pad : b.low - pad, text, undefined, undefined, labelColor,
          isBullBreak ? 'label_down' : 'label_up', isBullBreak ? bullBase : bearBase, 'small', undefined, undefined,
          undefined, true);
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candle0: opp, candle1: main, candle2: outline },
    ...drawingOutputs(bars),
  };
}

export const BreakoutVolumeDeltaFluxCharts = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, drawingKinds,
};
