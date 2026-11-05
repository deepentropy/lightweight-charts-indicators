/**
 * Renko Chart
 *
 * Renko bricks of the original over the chart bars: brick size from the ATR ('ATR' method: the ATR rounded to the
 * symbol tick precision as the original's conv_atr, one tick while the ATR is na, so the bricks start on the first bar)
 * or fixed ('Traditional'); the brick size is taken again each time the brick close changes. A new column needs a
 * reversal of 2 bricks. Chart style: 'Area' (Renko Open / Renko Close lines in gray and their fill in the trend colour,
 * 70% transparent), 'Candle' (the bricks as candles, `plotCandles`) or 'Dont Show'; bar colours in the trend colour
 * (barcolor0). Colours from 'Color Theme' (Pine version 4 colours).
 * Breakout (the original's f_Brickhigh / f_Bricklow): bricks counted back over the earlier columns until 'Length for
 * Breakout' is reached; the breakout line is lime after an up breakout, red after a down breakout.
 * Main trend: an EMA over the bricks (the original's myema: mean of the first distinct brick closes, then one EMA step
 * per brick), rounded to the brick grid, with TrendUp / TrendDown thresholds and a whipsaw wait before a reversal. The
 * trend line (green / red, silver while waiting), its threshold line Tsl2 (circles, no colour) with the fill between
 * them ('Show Threshold': lime / red, yellow while waiting, 80% transparent), the reversal threshold circles (maroon,
 * while waiting longer than 'Wait # Bars for Reversal') and, where the main trend turns, a circle-style plot
 * (linewidth 6) at the trend line, green up / red down.
 * The plots carry the original's values where it gives them a colour na (drawn transparent).
 * Chart context: the symbol tick (`syminfo.mintick`, 0.01 without a chart context).
 * Alerts (alertcondition, `alerts` of the result): breakout uptrend / downtrend started, main trend turns up / down,
 * Renko trend turns up / down.
 *
 * Reference: "Renko Chart" by LonesomeTheBlue
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type RenkoColorTheme = 'Green/Red' | 'Yellow/Blue' | 'White/Yellow' | 'Orange/Blue' | 'Lime/Red' | 'Blue/Red';

export interface RenkoChartInputs {
  mode: 'ATR' | 'Traditional';
  atrPeriod: number;
  boxSize: number;
  source: 'close' | 'hl';
  /** Chart Style As */
  showStyle: 'Candle' | 'Area' | 'Dont Show';
  /** Color Theme */
  colorTheme: RenkoColorTheme;
  changeBarCol: boolean;
  breakoutLength: number;
  showBreakout: boolean;
  showTrend: boolean;
  /** Show Threshold */
  showThreshold: boolean;
  trendEmaLength: number;
  barcountWhip: number;
  trendThreshold: number;
  trendThresholdReversal: number;
}

export const defaultInputs: RenkoChartInputs = {
  mode: 'ATR',
  atrPeriod: 14,
  boxSize: 10.0,
  source: 'hl',
  showStyle: 'Area',
  colorTheme: 'Blue/Red',
  changeBarCol: true,
  breakoutLength: 1,
  showBreakout: true,
  showTrend: true,
  showThreshold: true,
  trendEmaLength: 34,
  barcountWhip: 3,
  trendThreshold: 3.0,
  trendThresholdReversal: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Method', defval: 'ATR', options: ['Traditional', 'ATR'] },
  { id: 'atrPeriod', type: 'int', title: '[ATR] Atr Period', defval: 14, min: 1 },
  { id: 'boxSize', type: 'float', title: '[Traditional] Brick Size', defval: 10.0, min: 0.000000000000001 },
  { id: 'source', type: 'string', title: 'Source', defval: 'hl', options: ['close', 'hl'] },
  { id: 'showStyle', type: 'string', title: 'Chart Style As', defval: 'Area', options: ['Candle', 'Area', 'Dont Show'] },
  {
    id: 'colorTheme', type: 'string', title: 'Color Theme', defval: 'Blue/Red',
    options: ['Green/Red', 'Yellow/Blue', 'White/Yellow', 'Orange/Blue', 'Lime/Red', 'Blue/Red'],
  },
  { id: 'changeBarCol', type: 'bool', title: 'Change Bar Colors', defval: true },
  { id: 'breakoutLength', type: 'int', title: 'Length for Breakout', defval: 1, min: 1 },
  { id: 'showBreakout', type: 'bool', title: 'Show Breakout Trend', defval: true },
  { id: 'showTrend', type: 'bool', title: 'Show Trend', defval: true },
  { id: 'showThreshold', type: 'bool', title: 'Show Threshold', defval: true },
  { id: 'trendEmaLength', type: 'int', title: 'Trend EMA Length', defval: 34, min: 1 },
  { id: 'barcountWhip', type: 'int', title: 'Wait # Bars for Reversal', defval: 3, min: 0 },
  { id: 'trendThreshold', type: 'float', title: 'Trend Threshold', defval: 3.0, min: 0, step: 0.1 },
  { id: 'trendThresholdReversal', type: 'float', title: 'Trend Threshold for Reversal', defval: 1.5, min: 0, step: 0.1 },
];

/** Colours of Pine version 4 (the original's version) */
const GRAY = '#787B86';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const LIME = '#00E676';
const BLUE = '#2196F3';
const YELLOW = '#FFEB3B';
const ORANGE = '#FF9800';
const WHITE = '#FFFFFF';
const SILVER = '#B2B5BE';
const MAROON = '#880E4F';
const TRANSPARENT = 'rgba(0,0,0,0)';

export const plotConfig: PlotConfig[] = [
  { id: 'renkoOpen', title: 'Renko Open', color: GRAY, lineWidth: 1, editable: false },
  { id: 'renkoClose', title: 'Renko Close', color: GRAY, lineWidth: 1, editable: false },
  { id: 'breakoutLine', title: 'Renko breakout', color: LIME, lineWidth: 3, editable: false },
  // trendline = plot(Tsl, linewidth = 3)
  { id: 'trendLine', title: 'Plot', color: GREEN, lineWidth: 3, editable: false },
  // trline = plot(Tsl2, linewidth = 1, style = plot.style_circles, color = na)
  { id: 'tsl2', title: 'Plot', color: TRANSPARENT, lineWidth: 1, style: 'circles', editable: false },
  // the trend reversal threshold (maroon circles)
  { id: 'threshold', title: 'Plot', color: MAROON, lineWidth: 1, style: 'circles', editable: false },
  // the dots where the main trend turns (style circles, linewidth 6)
  { id: 'trendChange', title: 'Plot', color: GREEN, lineWidth: 6, style: 'circles', editable: false },
];

/** plotcandle(showstyle == 'Candle' ? oprice : na, ..., title = 'Renko Candles', color = trend == 1 ? upcolor : downcolor) */
export const plotCandleConfig = [{ id: 'renkoCandles', title: 'Renko Candles' }];

export const metadata = {
  title: 'Renko Chart',
  shortTitle: 'Renko',
  overlay: true,
};

type RenkoChartResult = IndicatorResult & {
  barColors: BarColorData[];
  plotCandles: Record<string, PlotCandleData[]>;
  alerts: AlertConditionState[];
};

/** Iterations of a PineScript `for i = from to to` loop (it counts down when `to` < `from`) */
const pineCount = (from: number, to: number) => Math.abs(to - from) + 1;

/**
 * The original's conv_atr: the ATR (one tick when na) rounded to the decimals of the symbol tick, at least one tick.
 * `for x = 1 to a` runs twice when a = 0 (tick of 1 or more).
 */
export function convAtr(valu: number, mintick: number): number {
  let a = 0;
  let num = mintick;
  let s = Number.isNaN(valu) ? mintick : valu;
  if (num < 1) {
    for (let i = 1; i <= 20; i++) {
      num = num * 10;
      if (num > 1) break;
      a = a + 1;
    }
  }
  const steps = pineCount(1, a);
  for (let k = 0; k < steps; k++) s = s * 10;
  s = Math.round(s);
  for (let k = 0; k < steps; k++) s = s / 10;
  return s < mintick ? mintick : s;
}

/** upcolor / downcolor of the 'Color Theme' input */
function themeColors(theme: RenkoColorTheme): [string, string] {
  const up = theme === 'Green/Red' ? GREEN : theme === 'White/Yellow' ? WHITE : theme === 'Lime/Red' ? LIME
    : theme === 'Blue/Red' ? BLUE : theme === 'Yellow/Blue' ? YELLOW : ORANGE;
  const down = theme === 'Yellow/Blue' || theme === 'Orange/Blue' ? BLUE
    : theme === 'Green/Red' || theme === 'Lime/Red' || theme === 'Blue/Red' ? RED : YELLOW;
  return [up, down];
}

type Point = { time: number; value: number; color?: string };

interface RenkoRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  // Renko brick state (values at the end of each bar)
  trend: number[];
  iopenprice: number[];
  icloseprice: number[];
  beginprice: number[];
  boxArr: number[];
  oprice: number[];
  // breakout
  botrend: number[];
  switchArr: number[];
  // main trend
  trcnt1: number[];
  countch: number[];
  obox: number[];
  em: number[];
  mtrend: number[];
  trendUp: number[];
  trendDown: number[];
  waitit: number[];
  tsl: number[];
  // outputs
  openPlot: Point[];
  closePlot: Point[];
  fillColors: string[];
  breakoutPlot: Point[];
  trendPlot: Point[];
  tsl2Plot: Point[];
  thresholdFillColors: string[];
  thresholdPlot: Point[];
  trendChangePlot: Point[];
  renkoCandles: PlotCandleData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RenkoChartInputs>): BarStudy<RenkoRun, RenkoChartResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const reversal = 2;
  const atrMode = cfg.mode === 'ATR';
  let mintick = 0.01;
  const L = cfg.breakoutLength;
  const temaLen = cfg.trendEmaLength;
  const thsreversal = cfg.trendThreshold;
  const thsreversal2 = cfg.trendThresholdReversal;
  const [upColor, downColor] = themeColors(cfg.colorTheme);
  const areaOn = (cfg.showStyle ?? 'Area') === 'Area';
  const candleOn = cfg.showStyle === 'Candle';
  // Main trend (the original's "Trend" block): na is NaN; a series used as a condition is true when it is not na and
  // not 0.
  const nz = (v: number, d = 0) => (Number.isNaN(v) ? d : v);
  const truthy = (v: number) => !Number.isNaN(v) && v !== 0;
  const pmax = (x: number, y: number) => (Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.max(x, y));
  const pmin = (x: number, y: number) => (Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.min(x, y));
  /** Pine `a != b`: false when either is na */
  const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a !== b;

  // Breakout (the original's f_Brickhigh / f_Bricklow): from an up (down) column whose bricks are fewer than Length,
  // count back the bricks of the earlier columns (history [x + 1]) until Length is reached; false at the start of the
  // history or when an earlier column of the same trend closed beyond the current close.
  const brickHigh = (s: RenkoRun, i: number): boolean => {
    const { trend, icloseprice, iopenprice, boxArr } = s;
    if (trend[i] !== 1) return false;
    const box = boxArr[i];
    const icp = icloseprice[i];
    let l = Math.floor((icp - iopenprice[i]) / box) - 1;
    let ret = true;
    if (l < L) {
      for (let x = 0; x <= 3000; x++) {
        const j = i - x - 1;
        if (j < 0) { ret = false; break; }
        if (trend[i - x] !== trend[j]) {
          if (trend[j] === 1) {
            if (icloseprice[j] >= icp) { ret = false; break; }
            l = l + Math.floor((icloseprice[j] - iopenprice[j]) / boxArr[j]);
          }
          if (trend[j] === -1) {
            let start = icloseprice[j] + boxArr[j];
            const forlen = Math.floor((iopenprice[j] - icloseprice[j]) / box) - 1;
            for (let k = pineCount(0, forlen); k > 0; k--) {
              if (start < icp) l = l + 1;
              start = start + boxArr[j];
            }
          }
          if (l >= L) { ret = true; break; }
        }
      }
    }
    return ret;
  };
  const brickLow = (s: RenkoRun, i: number): boolean => {
    const { trend, icloseprice, iopenprice, boxArr } = s;
    if (trend[i] !== -1) return false;
    const box = boxArr[i];
    const icp = icloseprice[i];
    let l = Math.floor((iopenprice[i] - icp) / box) - 1;
    let ret = true;
    if (l < L) {
      for (let x = 0; x <= 3000; x++) {
        const j = i - x - 1;
        if (j < 0) { ret = false; break; }
        if (trend[i - x] !== trend[j]) {
          if (trend[j] === -1) {
            if (icloseprice[j] <= icp) { ret = false; break; }
            l = l + Math.floor((iopenprice[j] - icloseprice[j]) / boxArr[j]);
          }
          if (trend[j] === 1) {
            let start = icloseprice[j] - boxArr[j];
            const forlen = Math.floor((icloseprice[j] - iopenprice[j]) / box) - 1;
            for (let k = pineCount(0, forlen); k > 0; k--) {
              if (start > icp) l = l + 1;
              start = start - boxArr[j];
            }
          }
          if (l >= L) { ret = true; break; }
        }
      }
    }
    return ret;
  };

  // mysma(ser, len): the mean of the last `len` distinct consecutive brick closes (na when fewer)
  const mysma = (icloseprice: number[], i: number, len: number): number => {
    let sum = icloseprice[i];
    let nn = 1;
    if (len > 1) {
      for (let k = 0; k <= 4000; k++) {
        const a0 = i - k >= 0 ? nz(icloseprice[i - k]) : 0;
        const a1 = i - k - 1 >= 0 ? nz(icloseprice[i - k - 1]) : 0;
        if (a0 === 0 || a1 === 0) break;
        if (icloseprice[i - k] !== a1) {
          nn++;
          sum += a1;
          if (nn === len) break;
        }
      }
    }
    return nn === len ? sum / len : NaN;
  };

  return {
    init(_bars, chart) {
      mintick = mintickOf(chart);
      const atr = taStep.atr(cfg.atrPeriod);
      const s: RenkoRun = {
        atr,
        trend: [], iopenprice: [], icloseprice: [], beginprice: [], boxArr: [], oprice: [], botrend: [], switchArr: [],
        trcnt1: [], countch: [], obox: [], em: [], mtrend: [], trendUp: [], trendDown: [], waitit: [], tsl: [],
        openPlot: [], closePlot: [], fillColors: [], breakoutPlot: [], trendPlot: [], tsl2Plot: [],
        thresholdFillColors: [], thresholdPlot: [], trendChangePlot: [], renkoCandles: [], barColors: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [
        s.trend, s.iopenprice, s.icloseprice, s.beginprice, s.boxArr, s.oprice, s.botrend, s.switchArr, s.trcnt1,
        s.countch, s.obox, s.em, s.mtrend, s.trendUp, s.trendDown, s.waitit, s.tsl, s.openPlot, s.closePlot,
        s.fillColors, s.breakoutPlot, s.trendPlot, s.tsl2Plot, s.thresholdFillColors, s.thresholdPlot,
        s.trendChangePlot, s.renkoCandles, s.barColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const { trend, iopenprice, icloseprice, beginprice, boxArr } = s;
      const bar = bars[i];
      // atrboxsize = conv_atr(atr(modevalue))
      const atrBoxSize = convAtr(s.atr.step(bar.high, bar.low, bar.close), mintick);
      // box := na(box[1]) ? (mode == 'ATR' ? atrboxsize : boxsize) : box[1]
      let box = i === 0 ? (atrMode ? atrBoxSize : cfg.boxSize) : boxArr[i - 1];
      // trend := barstate.isfirst ? 0 : nz(trend[1]); beginprice := barstate.isfirst ? floor(open / box) * box : ...
      let tr = i === 0 ? 0 : trend[i - 1];
      let bp = i === 0 ? Math.floor(bar.open / box) * box : beginprice[i - 1];
      const prevIopen = i > 0 ? iopenprice[i - 1] : 0;
      const prevIclose = i > 0 ? icloseprice[i - 1] : 0;
      let iop = 0;
      let icp = 0;

      const currentprice = cfg.source === 'close' ? bar.close : (tr === 1 ? bar.high : bar.low);
      if (tr === 0 && box * reversal <= Math.abs(bp - currentprice)) {
        if (bp > currentprice) {
          const numcell = Math.floor(Math.abs(bp - currentprice) / box);
          iop = bp;
          icp = bp - numcell * box;
          tr = -1;
        }
        if (bp < currentprice) {
          const numcell = Math.floor(Math.abs(bp - currentprice) / box);
          iop = bp;
          icp = bp + numcell * box;
          tr = 1;
        }
      }

      if (tr === -1) {
        let nok = true;
        if (bp > currentprice && box <= Math.abs(bp - currentprice)) {
          const numcell = Math.floor(Math.abs(bp - currentprice) / box);
          icp = bp - numcell * box;
          tr = -1;
          bp = icp;
          nok = false;
        } else {
          iop = iop === 0 ? prevIopen : iop;
          icp = icp === 0 ? prevIclose : icp;
        }

        const tempcurrentprice = cfg.source === 'close' ? bar.close : bar.high;
        if (bp < tempcurrentprice && box * reversal <= Math.abs(bp - tempcurrentprice) && nok) {
          const numcell = Math.floor(Math.abs(bp - tempcurrentprice) / box);
          iop = bp + box;
          icp = bp + numcell * box;
          tr = 1;
          bp = icp;
        } else {
          iop = iop === 0 ? prevIopen : iop;
          icp = icp === 0 ? prevIclose : icp;
        }
      } else if (tr === 1) {
        let nok = true;
        if (bp < currentprice && box <= Math.abs(bp - currentprice)) {
          const numcell = Math.floor(Math.abs(bp - currentprice) / box);
          icp = bp + numcell * box;
          tr = 1;
          bp = icp;
          nok = false;
        } else {
          iop = iop === 0 ? prevIopen : iop;
          icp = icp === 0 ? prevIclose : icp;
        }

        const tempcurrentprice = cfg.source === 'close' ? bar.close : bar.low;
        if (bp > tempcurrentprice && box * reversal <= Math.abs(bp - tempcurrentprice) && nok) {
          const numcell = Math.floor(Math.abs(bp - tempcurrentprice) / box);
          iop = bp - box;
          icp = bp - numcell * box;
          tr = -1;
          bp = icp;
        } else {
          iop = iop === 0 ? prevIopen : iop;
          icp = icp === 0 ? prevIclose : icp;
        }
      }

      // Recalculate box size if icloseprice changed
      // box := change(icloseprice) ? (mode == 'ATR' ? atrboxsize : boxsize) : box
      if (i > 0 && icp !== prevIclose) {
        box = atrMode ? atrBoxSize : cfg.boxSize;
      }

      trend[i] = tr;
      iopenprice[i] = iop;
      icloseprice[i] = icp;
      beginprice[i] = bp;
      boxArr[i] = box;

      // oprice (open price for area display)
      const prevTrend = i > 0 ? trend[i - 1] : 0;
      const prevBox = i > 0 ? boxArr[i - 1] : 0; // nz(box[1])
      let op: number;
      if (tr === 1) {
        op = prevTrend === 1 ? prevIclose - prevBox : prevIclose + prevBox;
      } else if (tr === -1) {
        op = prevTrend === -1 ? prevIclose + prevBox : prevIclose - prevBox;
      } else {
        op = prevIclose;
      }
      const oprice = Math.max(op, 0);
      s.oprice[i] = oprice;

      // switch / setA / setB / botrend (switch[1] na on the first bar: neither start)
      const bh = brickHigh(s, i);
      const bl = brickLow(s, i);
      const prevSw = i > 0 ? s.switchArr[i - 1] : NaN;
      let setA = 0, setB = 0;
      if (bh && prevSw === 0) {
        s.switchArr[i] = 1;
        setA = 1;
      } else if (bl && prevSw === 1) {
        s.switchArr[i] = 0;
        setB = 1;
      } else {
        s.switchArr[i] = Number.isNaN(prevSw) ? 0 : prevSw;
      }
      const botrend = setA === 1 ? 1 : setB === 1 ? -1 : (i > 0 ? s.botrend[i - 1] : 0);
      s.botrend[i] = botrend;

      // Main trend: brick EMA (myema) rounded to the brick grid, TrendUp / TrendDown ratchets, whipsaw wait
      const { trcnt1, countch, obox, em, mtrend, trendUp, trendDown, waitit } = s;
      const cIcp = truthy(i > 0 ? icp - prevIclose : NaN);
      trcnt1[i] = Math.min(cIcp ? 1 : nz(i > 0 ? trcnt1[i - 1] : NaN) + 1, 4000);
      countch[i] = cIcp ? nz(i > 0 ? countch[i - 1] : NaN) + 1 : nz(i > 0 ? countch[i - 1] : NaN);
      // trch = false; trch := change(trend) and change(icloseprice) ? true : ... : nz(trch, false) (the fresh false)
      const trch = truthy(i > 0 ? tr - prevTrend : NaN) && cIcp;
      // obox := change(icloseprice) != 0 ? nz(box[1]) : nz(obox[1])
      obox[i] = cIcp ? nz(boxArr[i - 1]) : nz(i > 0 ? obox[i - 1] : NaN);

      // myema(icloseprice, tremalen, trcnt1, obox)
      let e = NaN;
      if (countch[i] <= temaLen) e = mysma(icloseprice, i, temaLen);
      const tc = trcnt1[i];
      const serBack = i - tc >= 0 ? icloseprice[i - tc] : NaN;
      if (countch[i] > temaLen && !Number.isNaN(serBack) && icp !== nz(serBack)) {
        const alpha = 2 / (temaLen + 1);
        const bb = icp > nz(serBack) ? 1 : -1;
        const kats = trch ? reversal : 1;
        let st = nz(serBack) + bb * obox[i] * kats;
        e = alpha * st + (1 - alpha) * nz(i - tc >= 0 ? em[i - tc] : NaN);
        st += bb * obox[i];
        for (let x = 0; x <= 4000; x++) {
          if ((st > icp && bb > 0) || (st < icp && bb < 0)) break;
          e = alpha * st + (1 - alpha) * nz(e);
          st += bb * obox[i];
        }
      }
      if (Number.isNaN(e)) e = i > 0 ? em[i - 1] : NaN;
      em[i] = e;
      // tema := icloseprice - floor((icloseprice - tmp) / obox) * obox (a division by 0 is na)
      const tema = obox[i] === 0 ? NaN : icp - Math.floor((icp - e) / obox[i]) * obox[i];

      let upt = tema - thsreversal * box;
      if (upt > icp - reversal * box) upt = icp - reversal * box;
      let dnt = tema + thsreversal * box;
      if (dnt < icp + reversal * box) dnt = icp + reversal * box;

      const prevUp = i > 0 ? trendUp[i - 1] : NaN;
      const prevDn = i > 0 ? trendDown[i - 1] : NaN;
      const prevIcp = i > 0 ? icloseprice[i - 1] : NaN;
      const prevMt = i > 0 ? mtrend[i - 1] : NaN;

      // waitit := nz(waitit[1]); mtrend := nz(mtrend[1], 1)
      let wi = nz(i > 0 ? waitit[i - 1] : NaN);
      let mt = nz(prevMt, 1);
      let up = cIcp && wi === 0 ? (prevIcp > prevUp ? pmax(upt, prevUp) : upt) : nz(prevUp);
      if (mt === 1 && up - prevUp < 0) up = nz(prevUp);
      let dn = cIcp && wi === 0 ? (prevIcp < prevDn ? pmin(dnt, prevDn) : dnt) : prevDn;
      if (mt === -1 && dn - prevDn > 0) dn = nz(prevDn);

      mt = wi === 0 ? (icp > prevDn ? 1 : icp < prevUp ? -1 : mt) : mt;

      const chM = mt - prevMt;
      if (!Number.isNaN(chM) && chM !== 0 && wi === 0 && nz(i >= 2 ? waitit[i - 2] : NaN) === 0) wi = 1;
      else wi = wi !== 0 ? wi + 1 : wi;

      if (wi > 0) mt = nz(prevMt);

      if (wi > cfg.barcountWhip) {
        if (mt === 1) {
          if (icp >= up + thsreversal2 * box) wi = 0;
          if (icp <= up - thsreversal2 * box) {
            wi = 0;
            mt = -1;
            dn = prevIcp < prevDn ? pmin(dnt, prevDn) : dnt;
          }
        } else {
          if (icp <= dn - thsreversal2 * box) wi = 0;
          if (icp >= dn + thsreversal2 * box) {
            wi = 0;
            mt = 1;
            up = prevIcp > prevUp ? pmax(upt, prevUp) : upt;
          }
        }
      }

      trendUp[i] = up;
      trendDown[i] = dn;
      mtrend[i] = mt;
      waitit[i] = wi;

      // ---- Output ----
      const time = bar.time;
      const trendColor = tr === 1 ? upColor : downColor;
      // openline = plot(showstyle == 'Area' and oprice > 0 ? oprice : na, color = oprice < 0 or oprice[1] < 0 ? na : gray)
      // (oprice is never below 0)
      s.openPlot[i] = { time, value: areaOn && oprice > 0 ? oprice : NaN, color: GRAY };
      // closeline = plot(showstyle == 'Area' and icloseprice > 0 ? icloseprice : na,
      //   color = icloseprice <= 0 or icloseprice[1] <= 0 ? na : gray)
      s.closePlot[i] = {
        time,
        value: areaOn && icp > 0 ? icp : NaN,
        color: icp <= 0 || (i > 0 && prevIclose <= 0) ? TRANSPARENT : GRAY,
      };
      // fill(openline, closeline, color = oprice <= 0 and icloseprice <= 0 ? na : trend == 1 ? upcolor : downcolor, transp = 70)
      s.fillColors[i] = oprice <= 0 && icp <= 0 ? TRANSPARENT : String(color.new(trendColor, 70));

      // boline = showbreakout ? botrend == 1 ? (trend == 1 ? icloseprice : oprice) : (trend == 1 ? oprice : icloseprice) : na,
      // color = showbreakout ? botrend == 1 ? lime : botrend == -1 ? red : na : na
      if (!cfg.showBreakout) s.breakoutPlot[i] = { time, value: NaN };
      else {
        const val = botrend === 1 ? (tr === 1 ? icp : oprice) : (tr === 1 ? oprice : icp);
        s.breakoutPlot[i] = { time, value: val, color: botrend === 1 ? LIME : botrend === -1 ? RED : TRANSPARENT };
      }

      // Tsl = mtrend == 1 ? TrendUp : TrendDown; trendline = plot(Tsl, linewidth = 3,
      //   color = showtrend and Tsl != 0 and nz(Tsl[1]) != 0 ? trendcol : na)
      const tsl = mt === 1 ? up : dn;
      s.tsl[i] = tsl;
      const tslOn = ne(tsl, 0) && nz(i > 0 ? s.tsl[i - 1] : NaN) !== 0;
      const pm = nz(prevMt);
      // trendcol = mtrend == 1 and nz(mtrend[1]) == 1 ? (waitit == 0 ? green : silver)
      //   : mtrend == -1 and nz(mtrend[1]) == -1 ? (waitit == 0 ? red : silver) : na
      const trendcol = mt === 1 && pm === 1 ? (wi === 0 ? GREEN : SILVER)
        : mt === -1 && pm === -1 ? (wi === 0 ? RED : SILVER) : TRANSPARENT;
      s.trendPlot[i] = { time, value: tsl, color: cfg.showTrend && tslOn ? trendcol : TRANSPARENT };

      // Tsl2 = mtrend == 1 ? TrendUp + thsreversal * box : TrendDown - thsreversal * box, at most / least the brick close,
      // at least 0; trline = plot(Tsl2, style = circles, color = na)
      let t2 = mt === 1 ? up + thsreversal * box : dn - thsreversal * box;
      if ((mt === 1 && t2 > icp) || (mt === -1 && t2 < icp)) t2 = icp;
      if (t2 < 0) t2 = 0;
      s.tsl2Plot[i] = { time, value: t2, color: TRANSPARENT };

      // fill(trendline, trline, color = trcol): trcol = showtrend and showtrhold and mtrend == nz(mtrend[1]) and Tsl != 0
      //   and nz(Tsl[1]) != 0 ? (waitit == 0 ? (mtrend == 1 ? lime 80 : red 80) : yellow 80) : white 100
      s.thresholdFillColors[i] = !(cfg.showTrend && cfg.showThreshold && mt === pm && tslOn)
        ? String(color.new(WHITE, 100))
        : String(color.new(wi === 0 ? (mt === 1 ? LIME : RED) : YELLOW, 80));

      // plot(waitit > barcountwhip ? (mtrend == 1 ? TrendUp - thsreversal2 * box : TrendDown + thsreversal2 * box) : na,
      //   color = maroon, style = circles)
      s.thresholdPlot[i] = {
        time,
        value: wi > cfg.barcountWhip ? (mt === 1 ? up - thsreversal2 * box : dn + thsreversal2 * box) : NaN,
        color: MAROON,
      };

      // plotcandle(showstyle == 'Candle' ? oprice : na, max(oprice, icloseprice), min(oprice, icloseprice), icloseprice,
      //   title = 'Renko Candles', color = trend == 1 ? upcolor : downcolor)
      s.renkoCandles[i] = {
        time: time as number,
        open: candleOn ? oprice : NaN,
        high: candleOn ? Math.max(oprice, icp) : NaN,
        low: candleOn ? Math.min(oprice, icp) : NaN,
        close: candleOn ? icp : NaN,
        color: trendColor,
      };

      // barcolor(changebarcol ? trend == 1 ? upcolor : downcolor : na)
      s.barColors[i] = { id: 'barcolor0', time, color: trendColor };

      // plot(change(mtrend) > 0 and showtrend or change(mtrend) < 0 and showtrend ? Tsl : na, linewidth = 6,
      //   color = change(mtrend) > 0 and showtrend ? color.green : color.red, style = plot.style_circles)
      const ch = i > 0 ? mt - prevMt : NaN;
      const on = cfg.showTrend && (ch > 0 || ch < 0);
      s.trendChangePlot[i] = { time, value: on ? tsl : NaN, color: ch > 0 && cfg.showTrend ? GREEN : RED };

      // alertcondition(setA == 1), (setB == 1), (change(mtrend) > 0), (change(mtrend) < 0), (change(trend) > 0),
      // (change(trend) < 0)
      const chT = tr - prevTrend;
      const flags = [setA === 1, setB === 1, i > 0 && ch > 0, i > 0 && ch < 0, i > 0 && chT > 0, i > 0 && chT < 0];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'renkoOpen': s.openPlot.slice(),
          'renkoClose': s.closePlot.slice(),
          'breakoutLine': s.breakoutPlot.slice(),
          'trendLine': s.trendPlot.slice(),
          'tsl2': s.tsl2Plot.slice(),
          'threshold': s.thresholdPlot.slice(),
          'trendChange': s.trendChangePlot.slice(),
        },
        fills: [
          { plot1: 'renkoOpen', plot2: 'renkoClose', options: { color: String(color.new(upColor, 70)) }, colors: s.fillColors.slice() },
          { plot1: 'trendLine', plot2: 'tsl2', options: { color: String(color.new(LIME, 80)) }, colors: s.thresholdFillColors.slice() },
        ],
        barColors: cfg.changeBarCol ? s.barColors.slice() : [],
        plotCandles: { renkoCandles: s.renkoCandles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      } as RenkoChartResult;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoChartInputs> = {}, chart: ChartContext = {}): IndicatorRun<RenkoChartResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoChartInputs> = {}, chart?: ChartContext): RenkoChartResult {
  return fullResult(createRun(inputs, chart).update(bars)) as RenkoChartResult;
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Breakout Uptrend started', message: 'Breakout Uptrend started' },
  { id: 'alert1', title: 'Breakout Downtrend started', message: 'Breakout Downtrend started' },
  { id: 'alert2', title: 'Main Trend is Up', message: 'Main Trend is Up' },
  { id: 'alert3', title: 'Main Trend is Down', message: 'Main Trend is Down' },
  { id: 'alert4', title: 'Renko Trend is Up', message: 'Renko Trend is Up' },
  { id: 'alert5', title: 'Renko Trend is Down', message: 'Renko Trend is Down' },
];

export const RenkoChart = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig, plotCandleConfig, alertConditions };
