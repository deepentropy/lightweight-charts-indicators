/**
 * Next Pivot Projection
 *
 * A zigzag of `Length` bars (a new high is the highest high of the last `Length` bars, a new low the lowest low)
 * records, for each pivot, its price, the value of an oscillator (rsi, cci, cmo, cog, mfi or roc of the high for a
 * pivot high, of the low for a pivot low, rounded to 2 decimals), the direction of the price and of the oscillator
 * (higher high / lower high, lower low / higher low), the retracement ratio and the direction of a supertrend built
 * on the last 11 zigzag pivots (`History` * 2 + 1). Each pivot state (trend up or down, price and oscillator
 * direction) is a number 0..7; the states of the two pivots before a pivot make an index 0..63.
 *
 * When a pivot is confirmed by the next one, the statistics of its index count the outcome (higher high or lower
 * high for a pivot high, lower low or higher low for a pivot low), the sum of the ratios and of the bars. The next
 * pivot high and pivot low are projected from the current states: for the index of the last two pivots, three
 * arrows (higher high, lower high, average) with labels show the average ratio and bar count, and the price ranges
 * of the higher / lower high and lower / higher low are filled (green when the probability of a higher high is above
 * 50 %, red below, silver at 50 %; the reverse for lows). Optional: the zigzag lines (on by default), a label per
 * pivot, the zigzag supertrend line and a table of the statistics.
 *
 * Library functions of the original, ported here: `mZigzag.calculate` (zigzag core, with `_matrix.push` / `pop`
 * and `arrays.push` / `pop`), `supertrend.zsupertrend`, `enhanced_ta.oscillator` (by HeWhoMustNotBeNamed, MPL 2.0).
 * The price tick comes from the chart context (projected prices rounded with round_to_mintick).
 *
 * Reference: "Next Pivot Projection [Trendoscope]" by Trendoscope
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HeWhoMustNotBeNamed
 */

import {
  ta, math as pmath, array, str, color, callsite, Series, line, label, table, resetDrawings, setDrawingBar, varDrawing,
  drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Label, type Table,
} from 'oakscriptjs';
import { mintickOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

type OscillatorType = 'cci' | 'cmo' | 'cog' | 'mfi' | 'roc' | 'rsi';
type TextSize = 'tiny' | 'small' | 'normal' | 'large' | 'huge';

export interface NextPivotProjectionInputs {
  /** Zigzag length */
  length: number;
  oscillatorType: OscillatorType;
  oscLength: number;
  /** Pivots of the zigzag supertrend: history * 2 + 1 */
  supertrendLength: number;
  drawSupertrend: boolean;
  /** Detailed statistics table */
  showTable: boolean;
  txtSize: TextSize;
  txtColor: string;
  showPivotLines: boolean;
  showPivotLabel: boolean;
  fillAreas: boolean;
}

export const defaultInputs: NextPivotProjectionInputs = {
  length: 8,
  oscillatorType: 'rsi',
  oscLength: 14,
  supertrendLength: 5,
  drawSupertrend: false,
  showTable: false,
  txtSize: 'tiny',
  txtColor: '#FFFFFF',
  showPivotLines: true,
  showPivotLabel: false,
  fillAreas: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 8, group: 'Zigzag', display: 'none' },
  {
    id: 'oscillatorType', type: 'string', title: 'Oscillator', defval: 'rsi', options: ['cci', 'cmo', 'cog', 'mfi', 'roc', 'rsi'],
    inline: 'osc', group: 'Oscillator', display: 'none',
  },
  { id: 'oscLength', type: 'int', title: '', defval: 14, inline: 'osc', group: 'Oscillator', display: 'none' },
  { id: 'supertrendLength', type: 'int', title: 'History', defval: 5, inline: 'st', group: 'Supertrend', display: 'none' },
  { id: 'drawSupertrend', type: 'bool', title: 'Draw Zigzag Supertrend', defval: false, inline: 'st2', group: 'Supertrend', display: 'none' },
  { id: 'showTable', type: 'bool', title: 'Detailed Stats', defval: false, inline: 'txt', group: 'Stats and Display', display: 'none' },
  {
    id: 'txtSize', type: 'string', title: '', defval: 'tiny', options: ['tiny', 'small', 'normal', 'large', 'huge'],
    inline: 'txt', group: 'Stats and Display', display: 'none',
  },
  { id: 'txtColor', type: 'color', title: '', defval: '#FFFFFF', inline: 'txt', group: 'Stats and Display', display: 'none' },
  { id: 'showPivotLines', type: 'bool', title: 'Pivot Lines', defval: true, inline: 'pli', group: 'Stats and Display', display: 'none' },
  { id: 'showPivotLabel', type: 'bool', title: 'Pivot Label', defval: false, inline: 'pla', group: 'Stats and Display', display: 'none' },
  {
    id: 'fillAreas', type: 'bool', title: 'Fill Bullish/Bearish Sentiments', defval: true, inline: 'fil',
    group: 'Stats and Display', display: 'none',
  },
];

// Pine v5 colour constants
const GREEN = '#4CAF50';
const LIME = '#00E676';
const RED = '#FF5252';
const ORANGE = '#FF9800';
const SILVER = '#B2B5BE';
const YELLOW = '#FFEB3B';
const MAROON = '#880E4F';
const BLUE = '#2962FF';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Higher High Range', color: String(color.new(GREEN, 100)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower High Range', color: String(color.new(LIME, 100)), lineWidth: 1 },
  { id: 'plot3', title: 'Lower Low Range', color: String(color.new(RED, 100)), lineWidth: 1 },
  { id: 'plot4', title: 'Higher Low Range', color: String(color.new(ORANGE, 100)), lineWidth: 1 },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const metadata = {
  title: 'Next Pivot Projection [Trendoscope]',
  shortTitle: 'NPP[Trendoscope]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
/** mZigzag.calculate(numberOfPivots = 20) */
const NUMBER_OF_PIVOTS = 20;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const nz = (x: number, y = 0) => (Number.isNaN(x) ? y : x);
const sign = (x: number) => (Number.isNaN(x) ? NaN : Math.sign(x));

/** gettrendindex(price, osc, trend): trend up / down * 4 + price higher high or lower low * 2 + osc */
function trendIndexOf(price: number, osc: number, trend: number): number {
  const trendFactor = gt(trend, 0) ? 0 : 1;
  const priceFactor = Math.abs(price) > 1 ? 1 : 0;
  const oscFactor = Math.abs(osc) > 1 ? 1 : 0;
  return trendFactor * 4 + priceFactor * 2 + oscFactor;
}

/** getStatus(trendIndex, pivotDir) */
function statusOf(trendIndex: number, pivotDir: number): string {
  const trendFactor = Math.trunc(trendIndex / 4);
  const remainder = trendIndex % 4;
  const priceFactor = Math.trunc(remainder / 2) + 1;
  const oscFactor = (remainder % 2) + 1;
  const trendChar = trendFactor === 0 ? 'U' : 'D';
  const priceChar = pivotDir > 0 ? (priceFactor === 2 ? 'HH' : 'LH') : (priceFactor === 2 ? 'LL' : 'HL');
  const oscChar = pivotDir > 0 ? (oscFactor === 2 ? 'HH' : 'LH') : (oscFactor === 2 ? 'LL' : 'HL');
  return `${trendChar} - ${priceChar}/${oscChar}`;
}

/** getSentimentDetails(pDir, oDir, sDir): [symbol, label, colour] (an na supertrend direction gives na) */
function sentimentOf(pDir: number, oDir: number, sDir: number): [string, string, string] {
  let sentiment: number;
  if (pDir === oDir) sentiment = sDir === pDir || sDir * 2 === -pDir ? -sDir : sDir * 4;
  else if (sDir === pDir || sDir === -oDir) sentiment = 0;
  else sentiment = (Math.abs(oDir) > Math.abs(pDir) ? sDir : -sDir) * (sDir === oDir ? 2 : 3);
  const symbol = sentiment === 4 ? '⬆' : sentiment === -4 ? '⬇' : sentiment === 3 ? '↗' : sentiment === -3 ? '↘'
    : sentiment === 2 ? '⤴' : sentiment === -2 ? '⤵' : sentiment === 1 ? '⤒' : sentiment === -1 ? '⤓' : '▣';
  const colour = sentiment === 4 ? GREEN : sentiment === -4 ? RED : sentiment === 3 ? LIME : sentiment === -3 ? ORANGE
    : sentiment === 2 ? String(color.rgb(202, 224, 13, 0)) : sentiment === -2 ? String(color.rgb(250, 128, 114, 0)) : SILVER;
  const abs = Math.abs(sentiment);
  const lbl = abs === 4 ? 'C' : abs === 3 ? 'H' : abs === 2 ? 'D' : 'I';
  return [symbol, lbl, colour];
}

/** enhanced_ta.oscillator(type, length, ...): the oscillator of the source (the ranges of the library are not used) */
function oscillatorOf(type: OscillatorType, length: number, src: Series, volume: Series): number[] {
  switch (type) {
    case 'cci': return ta.cci(src, length).toArray();
    case 'cmo': return ta.cmo(src, length).toArray();
    case 'cog': return ta.cog(src, length).toArray();
    case 'mfi': return ta.mfi(src, length, volume).toArray();
    case 'roc': return ta.roc(src, length).toArray();
    default: return ta.rsi(src, length).toArray();
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<NextPivotProjectionInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = Math.trunc(cfg.length);
  const oscLength = Math.trunc(cfg.oscLength);
  const stLength = Math.trunc(cfg.supertrendLength);
  const mintick = mintickOf(chart);
  const roundToMintick = (x: number) => pmath.round_to_mintick(x as never, mintick) as unknown as number;

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const volS = new Series(bars, (b) => b.volume ?? NaN);
  const oscHigh = oscillatorOf(cfg.oscillatorType, oscLength, highS, volS).map((v) => pmath.round(v, 2));
  const oscLow = oscillatorOf(cfg.oscillatorType, oscLength, lowS, volS).map((v) => pmath.round(v, 2));
  // mZigzag.pivots(length, array.from(high, low))
  const hiSrc = new Series(bars, (b) => Math.max(b.high, b.low));
  const loSrc = new Series(bars, (b) => Math.min(b.high, b.low));
  const phighbar = ta.highestbars(hiSrc, length).toArray();
  const plowbar = ta.lowestbars(loSrc, length).toArray();
  const phighArr = ta.highest(hiSrc, length).toArray();
  const plowArr = ta.lowest(loSrc, length).toArray();
  const trArr = ta.tr(bars).toArray();

  // ---- mZigzag.zigzagcore state (`var` matrices and arrays; one row per pivot, oldest first)
  const valueRows: number[][] = []; // [price, oscillator]
  const dirRows: number[][] = []; // [price direction, oscillator direction]: +-1, +-2
  const ratioRows: number[][] = [];
  const barArray: number[] = [];
  const trendArray: number[] = [];
  const pushCapped = <T>(arr: T[], v: T) => {
    arr.push(v);
    while (arr.length > NUMBER_OF_PIVOTS) arr.shift();
  };

  // History of the indicatorHigh / indicatorLow arguments of the addnewpivot call of the inverse pivot (the only call
  // that reads them on an earlier bar): a function keeps the arguments of its own calls only.
  const inverseCalls: { bar: number; high: number; low: number }[] = [];

  /** addnewpivot(): `offsetOsc` = the oscillator array of the pivot bar (na array when there is none) */
  const addNewPivot = (value: number, bar: number, dir: number, osc: number, supertrendDir: number) => {
    const newValues = [value, osc];
    const newRatios = [1.0, 1.0];
    const newDirs = [Math.trunc(dir), Math.trunc(dir)];
    const rows = valueRows.length;
    if (rows >= 2) {
      const last = valueRows[rows - 1];
      const llast = valueRows[rows - 2];
      for (let k = 0; k < 2; k++) {
        const c = newValues[k];
        const newDir = gt(dir * c, dir * llast[k]) ? dir * 2 : dir;
        newDirs[k] = Math.trunc(newDir);
        newRatios[k] = pmath.round(Math.abs(c - last[k]) / Math.abs(llast[k] - last[k]), 2);
      }
    }
    pushCapped(valueRows, newValues);
    pushCapped(dirRows, newDirs);
    pushCapped(ratioRows, newRatios);
    pushCapped(barArray, bar);
    pushCapped(trendArray, supertrendDir);
  };
  const popPivot = () => {
    valueRows.pop();
    dirRows.pop();
    ratioRows.pop();
    barArray.pop();
    trendArray.pop();
  };

  // supertrend.zsupertrend (called from the bar where the zigzag has more than history * 2 + 1 pivots, on every bar)
  const stHistory = stLength * 2 + 1;
  const atrSite = callsite.sma();
  let stStarted = false;
  let buyStop = NaN;
  let sellStop = NaN;
  let stDir = 1;
  let prevLow = NaN;
  let prevHigh = NaN;

  // ---- statistics (64 indexes x [outcome 0, outcome 1, total])
  const newStats = () => Array.from({ length: 64 }, () => [0, 0, 0]);
  const pivotHighStats = newStats();
  const pivotLowStats = newStats();
  const pivotHighRatios = newStats();
  const pivotLowRatios = newStats();
  const pivotHighBars = newStats();
  const pivotLowBars = newStats();
  let prevSignPDir = NaN;

  let hhValue = NaN;
  let lhValue = NaN;
  let llValue = NaN;
  let hlValue = NaN;
  let hhProbability = NaN;
  let llProbability = NaN;

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS });
  const hhLine = varDrawing<Line>();
  const lhLine = varDrawing<Line>();
  const htLine = varDrawing<Line>();
  const hhLabel = varDrawing<Label>();
  const lhLabel = varDrawing<Label>();
  const htLabel = varDrawing<Label>();
  const llLine = varDrawing<Line>();
  const hlLine = varDrawing<Line>();
  const ltLine = varDrawing<Line>();
  const llLabel = varDrawing<Label>();
  const hlLabel = varDrawing<Label>();
  const ltLabel = varDrawing<Label>();
  let statsTable: Table | null = null;
  let tableMade = false;
  const zigzagLines: (Line | null)[] = [];
  const zigzagLabels: (Label | null)[] = [];

  const stPlot: number[] = new Array(n).fill(NaN);
  const stDirPlot: number[] = new Array(n).fill(NaN);
  const hh: number[] = new Array(n).fill(NaN);
  const lh: number[] = new Array(n).fill(NaN);
  const ll: number[] = new Array(n).fill(NaN);
  const hl: number[] = new Array(n).fill(NaN);
  const hhProb: number[] = new Array(n).fill(NaN);
  const llProb: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    setDrawingBar(i, isLast, n - 1);
    const b = bars[i];

    // ---------------- mZigzag.zigzagcore
    const phigh = phighArr[i];
    const plow = plowArr[i];
    const hb = phighbar[i];
    const lb = plowbar[i];
    let pDir = 1;
    const newPivot = hb === 0 || lb === 0;
    let doublePivot = hb === 0 && lb === 0;

    let supertrendDir = NaN;
    let supertrend = NaN;
    if (valueRows.length > stHistory) {
      // zsupertrend(reverse(col 0), history)
      const pivotsNewestFirst = valueRows.map((r) => r[0]).reverse();
      const shortArray = pivotsNewestFirst.length > stHistory ? pivotsNewestFirst.slice(0, stHistory) : pivotsNewestFirst;
      const sma = atrSite(i, trArr[i], 22);
      const atrDiff = nz(sma, trArr[i]) * 1;
      const mn = Math.min(...shortArray);
      const mx = Math.max(...shortArray);
      const lastBuyStop = stStarted ? buyStop : NaN;
      const lastSellStop = stStarted ? sellStop : NaN;
      if (!stStarted) {
        buyStop = mn - atrDiff;
        sellStop = mx + atrDiff;
        stDir = 1;
      }
      const buyStopCurrent = mn - atrDiff;
      const sellStopCurrent = mx + atrDiff;
      const lowConf1 = stStarted ? prevLow : NaN;
      const highConf1 = stStarted ? prevHigh : NaN;
      stDir = stDir === 1 && lt(lowConf1, lastBuyStop) ? -1 : stDir === -1 && gt(highConf1, lastSellStop) ? 1 : stDir;
      buyStop = stDir === 1 ? Math.max(nz(buyStop, buyStopCurrent), buyStopCurrent) : buyStopCurrent;
      sellStop = stDir === -1 ? Math.min(nz(sellStop, sellStopCurrent), sellStopCurrent) : sellStopCurrent;
      stStarted = true;
      prevLow = b.low;
      prevHigh = b.high;
      supertrendDir = stDir;
      supertrend = stDir > 0 ? buyStop : sellStop;
    }

    if (dirRows.length >= 1) pDir = Math.sign(dirRows[dirRows.length - 1][0]);

    const newBar = i;
    if (((pDir === 1 && hb === 0) || (pDir === -1 && lb === 0)) && valueRows.length >= 1) {
      const value = pDir === 1 ? phigh : plow;
      const ipivot = pDir === 1 ? plow : phigh;
      const pivot = valueRows[valueRows.length - 1][0];
      const pivotdir = dirRows[dirRows.length - 1][0];
      const removeOld = gt(value * pivotdir, pivot * pivotdir);
      if (removeOld) {
        popPivot();
        addNewPivot(value, newBar, pDir, pDir > 0 ? oscHigh[i] : oscLow[i], supertrendDir);
        // (addInverse is set here but only read in the else branch: no effect)
      } else if (!doublePivot) {
        const ipivotbar = pDir === 1 ? newBar + lb : newBar + hb;
        const k = newBar - ipivotbar;
        const dir = -pDir;
        let osc: number;
        if (k === 0) {
          osc = dir > 0 ? oscHigh[i] : oscLow[i];
        } else {
          let rec: { bar: number; high: number; low: number } | undefined;
          for (let j = inverseCalls.length - 1; j >= 0; j--) {
            if (inverseCalls[j].bar <= i - k) {
              rec = inverseCalls[j];
              break;
            }
          }
          osc = rec ? (dir > 0 ? rec.high : rec.low) : NaN;
        }
        inverseCalls.push({ bar: i, high: oscHigh[i], low: oscLow[i] });
        addNewPivot(ipivot, ipivotbar, dir, osc, supertrendDir);
        doublePivot = true;
      }
    }
    if ((pDir === 1 && lb === 0) || (pDir === -1 && hb === 0)) {
      const value = pDir === 1 ? plow : phigh;
      addNewPivot(value, newBar, -pDir, -pDir > 0 ? oscHigh[i] : oscLow[i], supertrendDir);
    }
    const newZG = newPivot;
    const doubleZG = doublePivot;

    // ---------------- statistics
    const rows = dirRows.length;
    const nextDirection = rows > 0 ? dirRows[rows - 1] : [];
    const lastDirection = rows > 1 ? dirRows[rows - 2] : [];
    const llastDirection = rows > 2 ? dirRows[rows - 3] : [];
    const lllastDirection = rows > 3 ? dirRows[rows - 4] : [];
    const currentDir = rows > 0 ? dirRows[rows - 1][0] : 0;
    const currentPDir = lastDirection.length > 0 ? lastDirection[0] : NaN;
    const signPDir = sign(currentPDir);
    const changePriceDirection = signPDir - prevSignPDir;
    prevSignPDir = signPDir;
    let currentTotalTrendIndex = 0;
    let nextTotalTrendIndex = 0;
    if (lllastDirection.length > 0) {
      const ta_ = trendArray.length;
      const priceDirection = lastDirection[0];
      const priceRatio = ratioRows[rows - 2][0];
      const numberOfBars = barArray[barArray.length - 2] - barArray[barArray.length - 3];
      const colLast = Math.abs(priceDirection) % 2;
      const nextTrendIndex = trendIndexOf(nextDirection[0], nextDirection[1], trendArray[ta_ - 1]);
      const currentTrendIndex = trendIndexOf(lastDirection[0], lastDirection[1], trendArray[ta_ - 2]);
      const lastTrendIndex = trendIndexOf(llastDirection[0], llastDirection[1], trendArray[ta_ - 3]);
      const llastTrendIndex = trendIndexOf(lllastDirection[0], lllastDirection[1], trendArray[ta_ - 4]);
      const totalIndex = lastTrendIndex * 8 + llastTrendIndex;
      currentTotalTrendIndex = currentTrendIndex * 8 + lastTrendIndex;
      nextTotalTrendIndex = nextTrendIndex * 8 + currentTrendIndex;
      const up = Math.sign(priceDirection) > 0;
      const stats = up ? pivotHighStats : pivotLowStats;
      const ratios = up ? pivotHighRatios : pivotLowRatios;
      const barsM = up ? pivotHighBars : pivotLowBars;
      if (!Number.isNaN(currentPDir) && !Number.isNaN(changePriceDirection) && !eq(changePriceDirection, 0)) {
        stats[totalIndex][colLast] += 1;
        ratios[totalIndex][colLast] += priceRatio;
        barsM[totalIndex][colLast] += numberOfBars;
        stats[totalIndex][2] += 1;
        ratios[totalIndex][2] += priceRatio;
        barsM[totalIndex][2] += numberOfBars;
      }
    }

    // ---------------- projections (and the table)
    if (barArray.length > 10) {
      const currentBar = barArray[barArray.length - 1];
      const lastBar = barArray[barArray.length - 2];
      const currentPrice = valueRows[valueRows.length - 1][0];
      const lastPrice = valueRows[valueRows.length - 2][0];
      const llastPrice = valueRows[valueRows.length - 3][0];
      const startRow = 2;
      if (!tableMade) {
        tableMade = true;
        statsTable = cfg.showTable ? table.new('top_right', 10, 64 + startRow, undefined, undefined, undefined, BLACK, 2) : null;
      }
      const fillTable = cfg.showTable && statsTable !== null && isLast;
      const txt = cfg.txtColor;
      const sz = cfg.txtSize;
      const cell = (c: number, r: number, text: string, bg: string, tooltip?: string) =>
        table.cell(statsTable!, c, r, text, undefined, undefined, txt, undefined, undefined, sz, bg, tooltip);

      // Pivot high projection
      const phColStart = currentDir > 0 ? 0 : 5;
      if (fillTable) {
        table.clear(statsTable!, 0, 0, 9, 64 + startRow - 1);
        cell(phColStart, 0, 'Pivot High Projection', MAROON);
        cell(phColStart, 1, 'Last Two Pivots', MAROON);
        cell(phColStart + 2, 1, 'HH', MAROON);
        cell(phColStart + 3, 1, 'LH', MAROON);
        cell(phColStart + 4, 1, 'T', MAROON);
        table.merge_cells(statsTable!, phColStart, 0, phColStart + 4, 0);
        table.merge_cells(statsTable!, phColStart, 1, phColStart + 1, 1);
      }
      const hiSi = Math.sign(currentDir) < 0 ? nextTotalTrendIndex : currentTotalTrendIndex;
      const highOrder = fillTable ? sortIndicesDesc(pivotHighStats.map((r) => r[2])) : [hiSi];
      let hlr = startRow;
      for (const si of highOrder) {
        const hhStats = pivotHighStats[si][0];
        const lhStats = pivotHighStats[si][1];
        const tStats = pivotHighStats[si][2];
        const hhRatio = pmath.round(pivotHighRatios[si][0] / hhStats, 3);
        const lhRatio = pmath.round(pivotHighRatios[si][1] / lhStats, 3);
        const tRatio = pmath.round(pivotHighRatios[si][2] / tStats, 3);
        const hhBars = pmath.round(pivotHighBars[si][0] / hhStats);
        const lhBars = pmath.round(pivotHighBars[si][1] / lhStats);
        const tBars = pmath.round(pivotHighBars[si][2] / tStats);
        const highlight = si === hiSi;
        if (highlight) {
          for (const v of [hhLine, lhLine, htLine]) if (v.value) line.delete(v.value);
          for (const v of [hhLabel, lhLabel, htLabel]) if (v.value) label.delete(v.value);
          const x1 = Math.sign(currentDir) < 0 ? currentBar : lastBar;
          const hhX2 = x1 + hhBars;
          const lhX2 = x1 + lhBars;
          const tX2 = x1 + tBars;
          const y1 = Math.sign(currentDir) < 0 ? currentPrice : lastPrice;
          const prev = Math.sign(currentDir) < 0 ? lastPrice : llastPrice;
          const hhY2 = roundToMintick(y1 + Math.abs(y1 - prev) * hhRatio);
          const lhY2 = roundToMintick(y1 + Math.abs(y1 - prev) * lhRatio);
          const tY2 = roundToMintick(y1 + Math.abs(y1 - prev) * tRatio);
          hhLine.value = line.new(x1, y1, hhX2, hhY2, 'bar_index', undefined, GREEN, 'arrow_right');
          lhLine.value = line.new(x1, y1, lhX2, lhY2, 'bar_index', undefined, LIME, 'arrow_right');
          htLine.value = line.new(x1, y1, tX2, tY2, 'bar_index', undefined, YELLOW, 'arrow_right');
          const hhPercent = str.tostring((hhStats * 100) / tStats, 'percent');
          const lhPercent = str.tostring((lhStats * 100) / tStats, 'percent');
          const hhText = `Number of Historical References :${str.tostring(hhStats)}/${str.tostring(tStats)}`
            + `\nProbability of Higher High :${hhPercent}\nAverage Higher High Ratio :${str.tostring(hhRatio)}`
            + `\nAverage Higher High Bars :${str.tostring(hhBars)}`;
          const lhText = `Number of Historical References :${str.tostring(lhStats)}/${str.tostring(tStats)}`
            + `\nProbability of Lower High :${lhPercent}\nAverage Lower High Ratio :${str.tostring(lhRatio)}`
            + `\nAverage Lower High Bars :${str.tostring(lhBars)}`;
          const tText = `Number of Historical References :${str.tostring(tStats)}\nAverage Fib Ratio :${str.tostring(tRatio)}`
            + `\nAverage Bars :${str.tostring(tBars)}`;
          hhLabel.value = label.new(hhX2, hhY2, `${str.tostring(hhY2)} - ${hhPercent}`, 'bar_index', 'price',
            String(color.new(GREEN, 70)), 'label_lower_left', WHITE, 'small', undefined, hhText);
          lhLabel.value = label.new(lhX2, lhY2, `${str.tostring(lhY2)} - ${lhPercent}`, 'bar_index', 'price',
            String(color.new(LIME, 70)), 'label_upper_left', WHITE, 'small', undefined, lhText);
          htLabel.value = label.new(tX2, tY2, `${str.tostring(tY2)}@${str.tostring(tRatio)}`, 'bar_index', 'price',
            String(color.new(YELLOW, 70)), 'label_left', WHITE, 'small', undefined, tText);
          hhValue = hhY2;
          lhValue = lhY2;
          hhProbability = (hhStats * 100) / tStats;
        }
        if (fillTable && hhStats !== 0 && lhStats !== 0) {
          const lastTrendIndex = Math.trunc(si / 8);
          const llastTrendIndex = si % 8;
          cell(phColStart, hlr, statusOf(llastTrendIndex, 1), String(color.new(LIME, 60)));
          cell(phColStart + 1, hlr, statusOf(lastTrendIndex, -1), String(color.new(ORANGE, 60)));
          cell(phColStart + 2, hlr, `${str.tostring(hhStats)} - ${str.tostring(hhRatio)}`,
            String(color.new(GREEN, highlight ? 50 : 90)), `Average Ratio - ${str.tostring(hhRatio)}\nAverage Bars - ${str.tostring(hhBars)}`);
          cell(phColStart + 3, hlr, `${str.tostring(lhStats)} - ${str.tostring(lhRatio)}`,
            String(color.new(RED, highlight ? 50 : 90)), `Average Ratio - ${str.tostring(lhRatio)}\nAverage Bars - ${str.tostring(lhBars)}`);
          cell(phColStart + 4, hlr, `${str.tostring(tStats)} - ${str.tostring(tRatio)}`,
            String(color.from_gradient(hhStats / tStats, 0, 1, RED, GREEN)), `Average Ratio - ${str.tostring(tRatio)}\nAverage Bars - ${str.tostring(tBars)}`);
          hlr += 1;
        }
      }

      // Pivot low projection
      const plColStart = currentDir < 0 ? 0 : 5;
      if (fillTable) {
        cell(plColStart, 0, 'Pivot Low Projection', MAROON);
        cell(plColStart, 1, 'Last Two Pivots', MAROON);
        cell(plColStart + 2, 1, 'LL', MAROON);
        cell(plColStart + 3, 1, 'HL', MAROON);
        cell(plColStart + 4, 1, 'T', MAROON);
        table.merge_cells(statsTable!, plColStart, 0, plColStart + 4, 0);
        table.merge_cells(statsTable!, plColStart, 1, plColStart + 1, 1);
      }
      const loSi = Math.sign(currentDir) > 0 ? nextTotalTrendIndex : currentTotalTrendIndex;
      const lowOrder = fillTable ? sortIndicesDesc(pivotLowStats.map((r) => r[2])) : [loSi];
      let llr = startRow;
      for (const si of lowOrder) {
        const llStats = pivotLowStats[si][0];
        const hlStats = pivotLowStats[si][1];
        const tStats = pivotLowStats[si][2];
        const llRatio = pmath.round(pivotLowRatios[si][0] / llStats, 3);
        const hlRatio = pmath.round(pivotLowRatios[si][1] / hlStats, 3);
        const tRatio = pmath.round(pivotLowRatios[si][2] / tStats, 3);
        const llBars = pmath.round(pivotLowBars[si][0] / llStats);
        const hlBars = pmath.round(pivotLowBars[si][1] / hlStats);
        const tBars = pmath.round(pivotLowBars[si][2] / tStats);
        const highlight = si === loSi;
        if (highlight) {
          for (const v of [llLine, hlLine, ltLine]) if (v.value) line.delete(v.value);
          for (const v of [llLabel, hlLabel, ltLabel]) if (v.value) label.delete(v.value);
          const x1 = Math.sign(currentDir) > 0 ? currentBar : lastBar;
          const llX2 = x1 + llBars;
          const hlX2 = x1 + hlBars;
          const tX2 = x1 + tBars;
          const y1 = Math.sign(currentDir) > 0 ? currentPrice : lastPrice;
          const prev = Math.sign(currentDir) > 0 ? lastPrice : llastPrice;
          const llY2 = roundToMintick(y1 - Math.abs(y1 - prev) * llRatio);
          const hlY2 = roundToMintick(y1 - Math.abs(y1 - prev) * hlRatio);
          const tY2 = roundToMintick(y1 - Math.abs(y1 - prev) * tRatio);
          llLine.value = line.new(x1, y1, llX2, llY2, 'bar_index', undefined, RED, 'arrow_right');
          hlLine.value = line.new(x1, y1, hlX2, hlY2, 'bar_index', undefined, ORANGE, 'arrow_right');
          ltLine.value = line.new(x1, y1, tX2, tY2, 'bar_index', undefined, YELLOW, 'arrow_right');
          const llPercent = str.tostring((llStats * 100) / tStats, 'percent');
          const hlPercent = str.tostring((hlStats * 100) / tStats, 'percent');
          const llText = `Number of Historical References :${str.tostring(llStats)}/${str.tostring(tStats)}`
            + `\nProbability of Lower Low :${llPercent}\nAverage Lower Low Ratio :${str.tostring(llRatio)}`
            + `\nAverage Lower Low Bars :${str.tostring(llBars)}`;
          const hlText = `Number of Historical References :${str.tostring(hlStats)}/${str.tostring(tStats)}`
            + `\nProbability of Higher Low :${hlPercent}\nAverage Higher Low Ratio :${str.tostring(hlRatio)}`
            + `\nAverage Higher Low Bars :${str.tostring(hlBars)}`;
          const tText = `Number of Historical References :${str.tostring(tStats)}\nAverage Fib Ratio :${str.tostring(tRatio)}`
            + `\nAverage Bars :${str.tostring(tBars)}`;
          llLabel.value = label.new(llX2, llY2, `${str.tostring(llY2)} - ${llPercent}`, 'bar_index', 'price',
            String(color.new(RED, 70)), 'label_upper_left', WHITE, 'small', undefined, llText);
          hlLabel.value = label.new(hlX2, hlY2, `${str.tostring(hlY2)} - ${hlPercent}`, 'bar_index', 'price',
            String(color.new(ORANGE, 70)), 'label_lower_left', WHITE, 'small', undefined, hlText);
          ltLabel.value = label.new(tX2, tY2, `${str.tostring(tY2)}@${str.tostring(tRatio)}`, 'bar_index', 'price',
            String(color.new(YELLOW, 70)), 'label_left', WHITE, 'small', undefined, tText);
          llValue = llY2;
          hlValue = hlY2;
          llProbability = (llStats * 100) / tStats;
        }
        if (fillTable && llStats !== 0 && hlStats !== 0) {
          const lastTrendIndex = Math.trunc(si / 8);
          const llastTrendIndex = si % 8;
          cell(plColStart, llr, statusOf(llastTrendIndex, -1), String(color.new(ORANGE, 60)));
          cell(plColStart + 1, llr, statusOf(lastTrendIndex, 1), String(color.new(LIME, 60)));
          cell(plColStart + 2, llr, `${str.tostring(llStats)} - ${str.tostring(llRatio)}`,
            String(color.new(RED, highlight ? 50 : 90)), `Average Ratio - ${str.tostring(llRatio)}\nAverage Bars - ${str.tostring(llBars)}`);
          cell(plColStart + 3, llr, `${str.tostring(hlStats)} - ${str.tostring(hlRatio)}`,
            String(color.new(GREEN, highlight ? 50 : 90)), `Average Ratio - ${str.tostring(hlRatio)}\nAverage Bars - ${str.tostring(hlBars)}`);
          cell(plColStart + 4, llr, `${str.tostring(tStats)} - ${str.tostring(tRatio)}`,
            String(color.from_gradient(llStats / tStats, 0, 1, GREEN, RED)), `Average Ratio - ${str.tostring(tRatio)}\nAverage Bars - ${str.tostring(tBars)}`);
          llr += 1;
        }
      }
    }

    // ---------------- mZigzag draw (zigzag lines and pivot labels)
    if (cfg.showPivotLines && newZG) {
      const drawLine = (idx1: number, idx2: number) => {
        const rowsNow = valueRows.length;
        if (rowsNow <= 2) return;
        const a = rowsNow - idx1;
        const c = rowsNow - idx2;
        const y1 = valueRows[a][0];
        const y2 = valueRows[c][0];
        const x1 = barArray[a];
        const x2 = barArray[c];
        const zline = line.new(x1, y1, x2, y2, 'bar_index', undefined, BLUE, 'solid', 1);
        const dirNow = gt(y1, y2) ? 1 : -1;
        let zlabel: Label | null = null;
        if (cfg.showPivotLabel) {
          const priceDir = dirRows[a][0];
          const oscDir = dirRows[a][1];
          const trendDir = trendArray[a];
          const trendLabel = statusOf(trendIndexOf(priceDir, oscDir, trendDir), dirNow);
          const [symbol, sLabel, sColor] = sentimentOf(priceDir, oscDir, trendDir);
          zlabel = label.new(x1, y1, `${symbol} ${trendLabel}`, 'bar_index', 'price', sColor,
            dirNow > 0 ? 'label_down' : 'label_up', BLACK, 'small', undefined, sLabel);
        }
        if (zigzagLines.length > 0) {
          const lastLine = zigzagLines[zigzagLines.length - 1];
          if (lastLine && line.get_x2(lastLine) === x2 && line.get_x1(lastLine) <= x1) {
            zigzagLines.pop();
            line.delete(lastLine);
            const lastLabel = zigzagLabels.pop();
            if (lastLabel) label.delete(lastLabel);
          }
        }
        zigzagLines.push(zline);
        while (zigzagLines.length > MAX_OBJECTS) {
          const old = zigzagLines.shift();
          if (old) line.delete(old);
        }
        zigzagLabels.push(zlabel);
        while (zigzagLabels.length > MAX_OBJECTS) {
          const old = zigzagLabels.shift();
          if (old) label.delete(old);
        }
      };
      if (doubleZG) drawLine(2, 3);
      if (valueRows.length >= 2) drawLine(1, 2);
    }

    stPlot[i] = supertrend;
    stDirPlot[i] = supertrendDir;
    hh[i] = hhValue;
    lh[i] = lhValue;
    ll[i] = llValue;
    hl[i] = hlValue;
    hhProb[i] = hhProbability;
    llProb[i] = llProbability;
  }
  setDrawingBar(null);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const P = (vals: number[], show: boolean, colorOf?: (i: number) => string) =>
    bars.map((bar, i) => ({ time: bar.time, value: show ? fin(vals[i]) : NaN, ...(colorOf ? { color: colorOf(i) } : {}) }));
  const probColour = (p: number, above: string, below: string) =>
    String(color.new(gt(p, 50) ? above : lt(p, 50) ? below : SILVER, 90));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(stPlot, cfg.drawSupertrend, (i) => (gt(stDirPlot[i], 0) ? GREEN : RED)),
      plot1: P(hh, cfg.fillAreas),
      plot2: P(lh, cfg.fillAreas),
      plot3: P(ll, cfg.fillAreas),
      plot4: P(hl, cfg.fillAreas),
    },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', colors: hhProb.map((p) => probColour(p, GREEN, RED)) },
      { plot1: 'plot3', plot2: 'plot4', colors: llProb.map((p) => probColour(p, RED, GREEN)) },
    ],
    ...drawingOutputs(bars, n > 0 && bars[0].time >= 1e12 ? 'ms' : 's'),
  };
}

/** array.sort_indices(values, order.descending) */
function sortIndicesDesc(values: number[]): number[] {
  return Array.from(array.sort_indices(values as never, 'descending') as unknown as ArrayLike<number>);
}

export const NextPivotProjection = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
