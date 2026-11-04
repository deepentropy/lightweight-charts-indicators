/**
 * Footprint IQ Pro
 *
 * Footprint boxes from the lower timeframe bars ("Granularity": 1-minute or 1-second bars of the chart symbol) of
 * each chart bar. Price levels start at the open, one "tick amount" apart; the tick amount is fixed on the first bar
 * of each day ("Use CVD Levels": of each "CVD Reset TF" period): ATR(14) / 4 by default ("Use ATR Levels"; the
 * original's switch gives ATR(14) times the price tick when the ATR mode and "Tick Level Distance = 0" disagree).
 * Levels are added up and down as the price moves. The volume of each lower bar is spread evenly on the levels from
 * its low to its high, as buy volume (close >= open) or sell volume (close < open). On each chart bar the levels from
 * its low to its high are drawn as boxes (bar to bar + 1) with a colour gradient of the delta, the level with the
 * largest |delta| in the POC colour, and a text with the delta, delta %, total, buy and sell volume. A level whose
 * |delta %| is at least "Imbalance Percentage" gets an imbalance label (𝅉 / 𝅏); from "Stacked Imbalance Count" levels
 * in a row they turn yellow and an alert() is sent. Without CVD the deltas restart on each bar, a 🞂 label marks the
 * bottom of the value area ("Value Area %" of the bar volume around the level with the largest volume) and a box above
 * the top level shows the totals of the bar. On the last bar, "Highest +Delta / -Delta Levels To Show" draw the
 * levels with the largest cumulative delta of the whole history as 20-line gradients with a label. "Show Focus Mode"
 * replaces all of this by a footprint of the last bar to its right: a candle, "Rows" volume boxes and the sell / buy
 * volume of each row.
 *
 * Lower timeframe bars: the chart symbol on "1" (1-Minute) or "1S" (1-Second) from the chart context
 * (`requiredSymbols`, `bars` accessor); without them the port throws a MissingSymbolDataError. The original's
 * platform gives at most the last 100,000 lower timeframe bars; the port uses the bars it receives. A granularity
 * equal to the chart timeframe uses the chart bars. The "1-Tick" granularity needs tick data with bid / ask prices:
 * the port throws an Error when it is selected. `chart.bg_color` / `chart.fg_color` (box borders, imbalance labels,
 * delta line gradients) and the price tick come from the context. The warning table of the original on a 1-minute
 * chart is kept; its text names a "Premium plan" without the platform name.
 *
 * Reference: "Footprint IQ Pro [TradingIQ]" by Trading-IQ
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradingIQ
 */

import {
  ta, array, str, color, line, label, linefill, box, timeframe, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Linefill, type Label,
  type TableData,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import {
  backgroundColorOf, foregroundColorOf, mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { chartTimeframe, periodStarts } from '../anchor-period';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';

export type FootprintGranularity = '1-Minute' | '1-Second' | '1-Tick';

export interface FootprintIqProInputs {
  /** Granularity */
  gran: FootprintGranularity;
  /** Use ATR Levels (Not Recommended) */
  atrMode: boolean;
  /** Tick Level Distance (0 = Auto) */
  ticks: number;
  /** Use CVD Levels */
  useCVD: boolean;
  /** CVD Reset TF */
  cvdRes: string;
  showDeltaP: boolean;
  showTotalVolume: boolean;
  showBuyVol: boolean;
  showSellVol: boolean;
  /** Footprint IQ Delta Symbols */
  useSymbols: boolean;
  /** Value Area % */
  vaCumu: number;
  /** Highest +Delta Levels To Show */
  highestBuying: number;
  /** Highest -Delta To Show */
  highestSelling: number;
  /** Show +Delta Levels Below Price And -Delta Levels Above Price */
  belowAbove: boolean;
  /** Imbalance Percentage */
  imbalanceP: number;
  /** Stacked Imbalance Count */
  stacked: number;
  upCol: string;
  dnCol: string;
  showPOC: boolean;
  pocCol: string;
  /** Show Focus Mode */
  showadvancedMode: boolean;
  rows: number;
  upColAdv2: string;
  upColAdv: string;
  dnColAdv2: string;
  dnColAdv: string;
  advCol: string;
}

export const defaultInputs: FootprintIqProInputs = {
  gran: '1-Minute',
  atrMode: true,
  ticks: 0,
  useCVD: false,
  cvdRes: '1D',
  showDeltaP: true,
  showTotalVolume: true,
  showBuyVol: true,
  showSellVol: true,
  useSymbols: true,
  vaCumu: 70,
  highestBuying: 0,
  highestSelling: 0,
  belowAbove: true,
  imbalanceP: 70,
  stacked: 3,
  upCol: 'rgb(128, 116, 255)',
  dnCol: 'rgb(255, 116, 116)',
  showPOC: true,
  pocCol: 'rgb(255, 243, 116)',
  showadvancedMode: false,
  rows: 20,
  upColAdv2: '#96d3c8',
  upColAdv: '#00ffff',
  dnColAdv2: '#d39696',
  dnColAdv: '#8f1b1b',
  advCol: '#FFFFFF',
};

const CVD = 'CVD';
const DB = 'Delta Boxes';
const DL = 'Delta Lines';
const IMB = 'Imbalances';
const COL = 'Colors';
const FM = 'Focus Mode';
export const inputConfig: InputConfig[] = [
  { id: 'gran', type: 'string', title: 'Granularity', defval: '1-Minute', options: ['1-Minute', '1-Second', '1-Tick'] },
  { id: 'atrMode', type: 'bool', title: 'Use ATR Levels (Not Recommended)', defval: true },
  { id: 'ticks', type: 'float', title: 'Tick Level Distance (0 = Auto)', defval: 0, active: { not: 'atrMode' } },
  { id: 'useCVD', type: 'bool', title: 'Use CVD Levels', defval: false, group: CVD },
  { id: 'cvdRes', type: 'timeframe', title: 'CVD Reset TF', defval: '1D', group: CVD },
  { id: 'showDeltaP', type: 'bool', title: 'Show Delta Percentage', defval: true, group: DB },
  { id: 'showTotalVolume', type: 'bool', title: 'Show Total Volume Per Level', defval: true, group: DB },
  { id: 'showBuyVol', type: 'bool', title: 'Show Buy Volume Per Level', defval: true, group: DB },
  { id: 'showSellVol', type: 'bool', title: 'Show Sell Volume Per Level', defval: true, group: DB },
  { id: 'useSymbols', type: 'bool', title: 'Footprint IQ Delta Symbols', defval: true, group: DB },
  { id: 'vaCumu', type: 'float', title: 'Value Area %', defval: 70, min: 0, max: 100 },
  { id: 'highestBuying', type: 'int', title: 'Highest +Delta Levels To Show', defval: 0, min: 0, group: DL },
  { id: 'highestSelling', type: 'int', title: 'Highest -Delta To Show', defval: 0, min: 0, group: DL },
  { id: 'belowAbove', type: 'bool', title: 'Show +Delta Levels Below Price And -Delta Levels Above Price', defval: true, group: DL },
  { id: 'imbalanceP', type: 'float', title: 'Imbalance Percentage', defval: 70, min: 0, max: 100, group: IMB },
  { id: 'stacked', type: 'int', title: 'Stacked Imbalance Count', defval: 3, min: 2, group: IMB },
  { id: 'upCol', type: 'color', title: '+ Color', defval: 'rgb(128, 116, 255)', group: COL },
  { id: 'dnCol', type: 'color', title: '+ Color', defval: 'rgb(255, 116, 116)', group: COL },
  { id: 'showPOC', type: 'bool', title: '', defval: true, inline: 'POC', group: COL },
  { id: 'pocCol', type: 'color', title: 'POC Color', defval: 'rgb(255, 243, 116)', inline: 'POC', group: COL },
  { id: 'showadvancedMode', type: 'bool', title: 'Show Focus Mode', defval: false, group: FM },
  { id: 'rows', type: 'int', title: 'Rows', defval: 20, min: 5, max: 150, group: FM },
  { id: 'upColAdv2', type: 'color', title: 'Up Color', defval: '#96d3c8', inline: 'ADV UP', group: FM },
  { id: 'upColAdv', type: 'color', title: '', defval: '#00ffff', inline: 'ADV UP', group: FM },
  { id: 'dnColAdv2', type: 'color', title: 'Down Color', defval: '#d39696', inline: 'ADV DN', group: FM },
  { id: 'dnColAdv', type: 'color', title: '', defval: '#8f1b1b', inline: 'ADV DN', group: FM },
  { id: 'advCol', type: 'color', title: 'Text Color', defval: '#FFFFFF', group: FM },
];

/** No plot(): boxes, labels, lines, linefills, a table and an alert() */
export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'line', 'linefill', 'table'];

export const hasAlertFunction = true;

export const metadata = {
  title: 'Footprint IQ Pro [TradingIQ]',
  shortTitle: 'Footprint IQ Pro [TradingIQ]',
  overlay: true,
};

const CLEAR = '#00000000';
const WHITE = '#FFFFFF';
const YELLOW = 'rgb(255, 243, 116)';
const WARNING = "You're on the 1-minute chart and Granularity is also set to 1-minute.\n"
  + 'Set Granularity to 1-second or 1-tick for Footprint IQ Pro to work properly.\n'
  + 'If you receive an error, a Premium plan or higher is required for this feature.\n\n'
  + 'The Granularity setting is the first setting in the indicator options!';

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const nz = (v: number) => (Number.isFinite(v) ? v : 0);
/** math.sign(): exact, na for na */
const sign = (v: number) => (isNaN(v) ? NaN : v > 0 ? 1 : v < 0 ? -1 : 0);
const vol = (v: number) => str.tostring(v, 'volume');
const pct = (v: number) => str.tostring(v, 'percent');

/** The lower timeframe of "Granularity" */
function granularityTimeframe(gran: FootprintGranularity): string {
  return gran === '1-Second' ? '1S' : gran === '1-Tick' ? '1T' : '1';
}

/** The chart symbol on the granularity timeframe, when it differs from the chart timeframe */
export function requiredSymbols(inputs: Partial<FootprintIqProInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = granularityTimeframe(cfg.gran);
  const chartTf = chart?.timeframe ?? '';
  if (tf === '1T' || chartTf === '' || timeframe.in_seconds(tf) >= timeframe.in_seconds(chartTf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: tf }];
}

/** The footprintData type of the original (totalVol is na until the first reset: the original gives 4 arrays for 5 fields) */
interface FootprintData {
  tickLevels: number[];
  deltaArr: number[];
  upVol: number[];
  dnVol: number[];
  totalVol: number[] | null;
}

/** One gradientDrawings object of the delta lines */
interface GradientDrawings {
  gradientLine: Array<Line | null>;
  gradientLineFill: Array<Linefill | null>;
  deltaLabel: Label | null;
}

/** timeframe.change(tf) at one call site: the period of this call against the period of the call before (false first) */
function changeSite(starts: number[]): (i: number) => boolean {
  let prev: number | undefined;
  return (i) => {
    const cur = starts[i];
    const changed = prev !== undefined && cur !== prev;
    prev = cur;
    return changed;
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FootprintIqProInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  if (cfg.gran === '1-Tick') {
    throw new Error('The "1-Tick" granularity needs tick data with bid / ask prices, which the bars do not carry.');
  }
  const vaCumu = cfg.vaCumu / 100;
  const bg = backgroundColorOf(chart);
  const fg = foregroundColorOf(chart);
  const mintick = mintickOf(chart);
  const chartTf = chartTimeframe(bars, chart);
  const tf = granularityTimeframe(cfg.gran);
  const alertCalls: AlertCall[] = [];
  const tables: TableData[] = [];

  // request.security_lower_tf(syminfo.tickerid, tf, ...): the lower bars of each chart bar
  let ltfBars: Bar[] = bars;
  let ranges: Array<[number, number]> = bars.map((_b, i) => [i, i + 1]);
  if (n > 0 && chartTf !== '' && timeframe.in_seconds(tf) > timeframe.in_seconds(chartTf)) {
    throw new Error(`The granularity timeframe "${tf}" is above the chart timeframe "${chartTf}"`);
  }
  if (n > 0 && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
    const req = { symbol: tickeridOf(chart), timeframe: tf };
    [ltfBars] = symbolBarsOf([req], chart);
    ranges = securityLowerTf(bars, ltfBars, tf, otherSymbolChart(bars, chart), { other: { timezone: chart?.timezone, session: chart?.session } });
  }

  // atr = ta.atr(14), atrN = ta.atr(14) / 4
  const atr = ta.atr(bars, 14).toArray().map((v) => v ?? NaN);

  resetDrawings({ box: 500, line: 500, label: 500, polyline: 100 });

  if (!cfg.showadvancedMode) {
    const changeChart = changeSite(bars.map((b) => b.time as number));
    const changeDay = changeSite(periodStarts(bars, '1D', chart));
    const cvdStarts = cfg.useCVD ? periodStarts(bars, cfg.cvdRes, chart) : [];
    const changeCvd = changeSite(cvdStarts);
    const FD: FootprintData = { tickLevels: [], deltaArr: [], upVol: [], dnVol: [], totalVol: null };
    const HD = { price: [] as number[], delta: [] as number[] };
    let tickAmount = 0;
    let freezeATR = 0;
    let finalLevel = NaN;
    const textArr = cfg.useSymbols ? ['δ: ', '\nδ%: ', '\n⧎: ', '\n◭: ', '\n⧩: ']
      : ['Delta: ', '\nDelta Percentage: ', '\nTotal Vol.: ', '\nBuy Vol.: ', '\nSell Vol.: '];
    const addArr = [true, cfg.showDeltaP, cfg.showTotalVolume, cfg.showBuyVol, cfg.showSellVol];
    const textOf = (values: number[], formats: Array<(v: number) => string>) => values
      .map((v, x) => (addArr[x] ? textArr[x] + formats[x](v) : '')).join('');
    const formats = [vol, pct, vol, vol, vol];
    const tooLong = () => new Error('Loop takes too long to execute (the tick amount is not positive)');
    let deltaPlus: Array<GradientDrawings | null> | null = null;
    let deltaNeg: Array<GradientDrawings | null> | null = null;

    for (let i = 0; i < n; i++) {
      const [from, to] = ranges[i];
      if (to - from <= 0) continue;
      setDrawingBar(i, i === n - 1);
      const b = bars[i];
      const high = b.high;
      const low = b.low;
      const open = b.open;

      // FD.deltaArr.fillAll(...): new bar without CVD
      if (changeChart(i) && !cfg.useCVD && FD.deltaArr.length > 0) {
        FD.deltaArr.fill(0);
        FD.upVol.fill(0);
        FD.dnVol.fill(0);
        FD.totalVol!.fill(0);
      }
      const cond = (changeDay(i) && !cfg.useCVD) || (cfg.useCVD && changeCvd(i));
      if (cond) {
        freezeATR = atr[i] / 4;
        // switch ticks == 0: atrMode => freezeATR, ticks == 0 => atr * mintick (always matches)
        tickAmount = eq(cfg.ticks, 0) === cfg.atrMode ? freezeATR : atr[i] * mintick;
        FD.tickLevels = [open - tickAmount, open, open + tickAmount];
        FD.deltaArr = [0, 0, 0];
        FD.upVol = [0, 0, 0];
        FD.dnVol = [0, 0, 0];
        FD.totalVol = [0, 0, 0];
      }
      if (FD.tickLevels.length === 0) continue;
      const totalVol = FD.totalVol!;

      if (HD.delta.length === 0) {
        HD.price = [open - tickAmount, open, open + tickAmount];
        HD.delta = [0, 0, 0];
      }
      let last = FD.tickLevels[FD.tickLevels.length - 1];
      let first = FD.tickLevels[0];
      while (ge(high, last)) {
        if (!(tickAmount > 0)) throw tooLong();
        last += tickAmount;
        FD.tickLevels.push(last);
        FD.deltaArr.push(0);
        FD.upVol.push(0);
        FD.dnVol.push(0);
        totalVol.push(0);
        if (FD.tickLevels.length > 90000) {
          FD.tickLevels.shift();
          FD.deltaArr.shift();
          FD.upVol.shift();
          FD.dnVol.shift();
          totalVol.shift();
        }
      }
      while (le(low, first)) {
        if (!(tickAmount > 0)) throw tooLong();
        first -= tickAmount;
        FD.tickLevels.unshift(first);
        FD.deltaArr.unshift(0);
        FD.upVol.unshift(0);
        FD.dnVol.unshift(0);
        totalVol.unshift(0);
        if (FD.tickLevels.length > 90000) {
          FD.tickLevels.pop();
          FD.deltaArr.pop();
          FD.upVol.pop();
          FD.dnVol.pop();
          totalVol.pop();
        }
      }
      last = HD.price[HD.price.length - 1];
      first = HD.price[0];
      while (ge(high, last)) {
        last += tickAmount;
        HD.price.push(last);
        HD.delta.push(0);
        if (HD.price.length > 90000) {
          HD.price.shift();
          HD.delta.shift();
        }
      }
      while (le(low, first)) {
        first -= tickAmount;
        HD.price.unshift(first);
        HD.delta.unshift(0);
        if (HD.price.length > 90000) {
          HD.price.pop();
          HD.delta.pop();
        }
      }

      // the volume of each lower bar on the levels from its low to its high
      for (let k = from; k < to; k++) {
        const lb = ltfBars[k];
        let getVol = lb.volume ?? NaN;
        let getTop = array.binary_search_leftmost(FD.tickLevels, lb.high);
        let getBot = array.binary_search_leftmost(FD.tickLevels, lb.low);
        if (sign(lb.close - lb.open) === -1) getVol *= -1;
        const div = getVol / (getTop - getBot + 1);
        const s = sign(getVol);
        for (let x = getBot; getBot <= getTop ? x <= getTop : x >= getTop; x += getBot <= getTop ? 1 : -1) {
          FD.deltaArr[x] += div;
          if (s === 1) FD.upVol[x] += div;
          else if (s === -1) FD.dnVol[x] += div;
          totalVol[x] += Math.abs(div);
        }
        getTop = array.binary_search_leftmost(HD.price, lb.high);
        getBot = array.binary_search_leftmost(HD.price, lb.low);
        for (let x = getBot; getBot <= getTop ? x <= getTop : x >= getTop; x += getBot <= getTop ? 1 : -1) {
          HD.delta[x] += div;
        }
      }

      const getStart = array.binary_search_leftmost(FD.tickLevels, low);
      const getEnd = array.binary_search_leftmost(FD.tickLevels, high);
      const getLevelsSize = FD.tickLevels.length;
      const posVals = FD.deltaArr.filter((d) => gt(d, 0));
      const negVals = FD.deltaArr.filter((d) => lt(d, 0));
      const minGrad = Math.min(nz(array.min(posVals)), nz(Math.abs(array.max(negVals))));
      const maxGrad = Math.max(nz(array.max(posVals)), nz(Math.abs(array.min(negVals))));
      let stackCount = 0;
      let imbalanceLab: Label[] = [];
      const upFaint = String(color.new(cfg.upCol, 70));
      const upStrong = String(color.new(cfg.upCol, 10));
      const dnStrong = String(color.new(cfg.dnCol, 10));
      const dnFaint = String(color.new(cfg.dnCol, 70));
      const poc = String(color.new(cfg.pocCol, 40));
      const step = getStart <= getEnd ? 1 : -1;
      for (let x = getStart; step > 0 ? x <= getEnd : x >= getEnd; x += step) {
        const getLevel = FD.tickLevels[x];
        const getLevelNext = x + 1 === getLevelsSize ? getLevel + tickAmount : FD.tickLevels[x + 1];
        const getDelta = FD.deltaArr[x];
        finalLevel = getLevelNext;
        let gradient = sign(getDelta) === 1
          ? String(color.from_gradient(getDelta, minGrad, maxGrad, upFaint, upStrong))
          : String(color.from_gradient(getDelta, -maxGrad, -minGrad, dnStrong, dnFaint));
        const getTotalVol = totalVol[x];
        const getDeltaP = (getDelta / getTotalVol) * 100;
        if (cfg.showPOC && (eq(getDelta, maxGrad) || eq(getDelta, -maxGrad))) gradient = poc;
        const txt = textOf([getDelta, getDeltaP, totalVol[x], FD.upVol[x], FD.dnVol[x]], formats);
        box.new(i, getLevel, i + 1, getLevelNext, bg, 4, undefined, undefined, undefined, gradient, txt, undefined, WHITE);

        if (ge(Math.abs(getDeltaP), cfg.imbalanceP)) {
          stackCount += 1;
          const txtImb = sign(getDeltaP) === 1 ? '𝅉' : '𝅏';
          imbalanceLab.push(label.new(i + 1, (getLevel + getLevelNext) / 2, txtImb, 'bar_index', 'price', CLEAR,
            'label_center', fg, 'normal', undefined, `${pct(getDeltaP)} Imbalance`));
          if (stackCount === cfg.stacked) {
            alertCalls.push({ time: b.time as number, message: 'Stacked Imbalance', freq: 'once_per_bar_close' });
            for (const lab of imbalanceLab) label.set_textcolor(lab, YELLOW);
          } else if (stackCount > cfg.stacked) {
            label.set_textcolor(imbalanceLab[imbalanceLab.length - 1], YELLOW);
          }
        } else {
          stackCount = 0;
          imbalanceLab = [];
        }
      }

      if (!cfg.useCVD) {
        // value area around the level with the largest volume
        const sliceVol = array.slice(totalVol, getStart, getEnd + 1);
        const newPoc = array.indexof(sliceVol, array.max(sliceVol));
        const sliceLevels = array.slice(FD.tickLevels, getStart, getEnd + 1);
        const sumVol = array.sum(sliceVol);
        const arrSize = sliceVol.length;
        for (let x = 0; x <= arrSize - 1; x++) {
          const part = array.slice(sliceVol, Math.max(newPoc - x, 0), Math.min(newPoc + x + 1, arrSize));
          if (ge(array.sum(part) / sumVol, vaCumu)) {
            const bottom = Math.max(newPoc - x, 0);
            label.new(i, sliceLevels[bottom], '🞂', 'bar_index', 'price', CLEAR, 'label_center', WHITE, 'small');
            break;
          }
        }
        // totals of the bar above the top level
        const getDelta = array.sum(FD.deltaArr);
        const volume = b.volume ?? NaN;
        const getDeltaP = (getDelta / volume) * 100;
        const txt = textOf([getDelta, getDeltaP, volume, array.sum(FD.upVol), array.sum(FD.dnVol)], formats);
        box.new(i, finalLevel, i + 1, finalLevel + tickAmount, CLEAR, undefined, undefined, undefined, undefined, CLEAR,
          txt, undefined, WHITE);
      }

      if (i === n - 1) {
        // var arrays of the delta lines: made on the first last-bar run
        if (deltaPlus === null) deltaPlus = new Array<GradientDrawings | null>(cfg.highestBuying).fill(null);
        if (deltaNeg === null) deltaNeg = new Array<GradientDrawings | null>(cfg.highestSelling).fill(null);
        const fresh = (): GradientDrawings => ({ gradientLine: new Array(20).fill(null), gradientLineFill: new Array(20).fill(null), deltaLabel: null });
        if (cfg.highestBuying > 0 && !deltaPlus[0]) for (let k = 0; k < deltaPlus.length; k++) deltaPlus[k] = fresh();
        if (cfg.highestSelling > 0 && !deltaNeg[0]) for (let k = 0; k < deltaNeg.length; k++) deltaNeg[k] = fresh();
        const copyGradient = [...HD.delta];
        array.sort(copyGradient, 'asc');
        let upCount = 0;
        let dnCount = 0;
        const highestPlus = new Map<number, number>();
        const highestNeg = new Map<number, number>();
        if (cfg.highestBuying !== 0) {
          for (let k = copyGradient.length - 1; k >= 0; k--) {
            const getDelta = copyGradient[k];
            if (sign(getDelta) !== 1 || upCount >= cfg.highestBuying) break;
            const getPrice = HD.price[array.indexof(HD.delta, getDelta)];
            if (!cfg.belowAbove || le(getPrice, open)) {
              highestPlus.set(getPrice, getDelta);
              upCount += 1;
            }
          }
        }
        if (cfg.highestSelling !== 0) {
          for (let k = 0; k <= copyGradient.length - 1; k++) {
            const getDelta = copyGradient[k];
            if (sign(getDelta) !== -1 || dnCount >= cfg.highestSelling) break;
            const getPrice = HD.price[array.indexof(HD.delta, getDelta)];
            if (!cfg.belowAbove || ge(getPrice, open)) {
              highestNeg.set(getPrice, getDelta);
              dnCount += 1;
            }
          }
        }
        const gradientLines = (g: GradientDrawings, top: number, bot: number, col: string, onLine?: () => void) => {
          const range = (top - bot) / 20;
          for (let x = 0; x <= g.gradientLine.length - 1; x++) {
            const old = g.gradientLine[x];
            if (old) line.delete(old);
            g.gradientLine[x] = line.new(i - 1, bot + range * x, i + 1, bot + range * x, 'bar_index', 'both', CLEAR);
            const getLine = g.gradientLine[x]!;
            const getLineP = g.gradientLine[Math.max(0, x - 1)]!;
            onLine?.();
            if (x > 0) {
              const oldFill = g.gradientLineFill[x];
              if (oldFill) linefill.delete(oldFill);
              const c = x < 10 ? color.from_gradient(x, 0, 10, bg, col) : color.from_gradient(x, 11, 20, col, bg);
              g.gradientLineFill[x] = linefill.new(getLineP, getLine, String(color.new(c, 80)));
            }
          }
          const getLevelNow = g.gradientLine[Math.floor(g.gradientLine.length / 2)]!;
          line.set_color(getLevelNow, col);
          line.set_width(getLevelNow, 2);
        };
        [...highestPlus.keys()].forEach((getLevel, k) => {
          const g = deltaPlus![k]!;
          const top = getLevel * 1.0008;
          const bot = getLevel * 0.9998;
          if (g.deltaLabel) label.delete(g.deltaLabel);
          g.deltaLabel = label.new(i + 20, (top + bot + top) / 3, `+${vol(highestPlus.get(getLevel)!)}`, 'bar_index', 'price',
            CLEAR, 'label_left', cfg.upCol, 'small');
          gradientLines(g, top, bot, cfg.upCol);
        });
        [...highestNeg.keys()].forEach((getLevel, k) => {
          const g = deltaNeg![k]!;
          const top = getLevel * 1.0008;
          const bot = getLevel * 0.9998;
          gradientLines(g, top, bot, cfg.dnCol, () => {
            if (g.deltaLabel) label.delete(g.deltaLabel);
            g.deltaLabel = label.new(i + 20, (top + bot + bot) / 3, vol(highestNeg.get(getLevel)!), 'bar_index', 'price',
              CLEAR, 'label_left', cfg.dnCol, 'small');
          });
        });
      }
    }
  } else if (n > 0) {
    // advancedView(): the footprint of the last bar, to its right
    const i = n - 1;
    setDrawingBar(i, true);
    const b = bars[i];
    const rows = cfg.rows;
    const range = (b.high - b.low) / rows;
    const levels = new Array<number>(rows).fill(0);
    const delta = new Array<number>(rows).fill(0);
    const buyVol = new Array<number>(rows).fill(0);
    const sellVol = new Array<number>(rows).fill(0);
    const totalVol = new Array<number>(rows).fill(0);
    const [from, to] = ranges[i];
    if (to - from > 0) {
      for (let r = 0; r < rows; r++) levels[r] = b.low + range * r;
      for (let k = from; k < to; k++) {
        const lb = ltfBars[k];
        // volume * direction(): math.sign(close - close[1]) of the lower bars
        const data = (lb.volume ?? NaN) * sign(lb.close - (k > 0 ? ltfBars[k - 1].close : NaN));
        const top = array.binary_search_leftmost(levels, lb.high);
        const bot = array.binary_search_leftmost(levels, lb.low);
        const div = data / (Math.abs(top - bot) + 1);
        for (let x = bot; bot <= top ? x <= top : x >= top; x += bot <= top ? 1 : -1) {
          const absDiv = Math.abs(div);
          delta[x] += div;
          totalVol[x] += absDiv;
          const s = sign(div);
          if (s === 1) buyVol[x] += div;
          else if (s === -1) sellVol[x] += absDiv;
        }
      }
      const col = ge(b.close, b.open) ? cfg.upColAdv : cfg.dnColAdv;
      const bodyTop = Math.max(b.open, b.close);
      const bodyBot = Math.min(b.open, b.close);
      box.new(i + 5, bodyTop, i + 15, bodyBot, bg, undefined, undefined, undefined, undefined, col);
      line.new(i + 10, bodyTop, i + 10, b.high, 'bar_index', 'none', col);
      line.new(i + 10, bodyBot, i + 10, b.low, 'bar_index', 'none', col);
      const absDelta = delta.map((d) => Math.abs(d));
      const minDelta = array.min(absDelta);
      const maxDelta = array.max(absDelta);
      const maxVol = array.max(totalVol);
      const minVol = array.min(totalVol);
      for (let r = 0; r < rows; r++) {
        const level = levels[r];
        const deltaAdv = delta[r];
        const norm = Math.round(1 + ((totalVol[r] - minVol) / (maxVol - minVol)) * 15);
        const bgcol = sign(deltaAdv) === 1
          ? color.from_gradient(Math.abs(deltaAdv), minDelta, maxDelta, cfg.upColAdv2, cfg.upColAdv)
          : color.from_gradient(Math.abs(deltaAdv), minDelta, maxDelta, cfg.dnColAdv2, cfg.dnColAdv);
        box.new(i + 15, level + range, i + 15 + norm, level, bg, undefined, undefined, undefined, undefined, String(color.new(bgcol, 0)));
        box.new(i + 30, level + range, i + 35, level, CLEAR, undefined, undefined, undefined, undefined, CLEAR,
          vol(sellVol[r]), undefined, cfg.advCol);
        box.new(i + 35, level + range, i + 40, level, CLEAR, undefined, undefined, undefined, undefined, CLEAR,
          vol(buyVol[r]), undefined, cfg.advCol);
      }
    }
  }

  // barstate.islastconfirmedhistory and timeframe.in_seconds("") == 60 and gran == 1-Minute: the warning table
  if (n > 0 && chartTf !== '' && timeframe.in_seconds(chartTf) === 60 && cfg.gran === '1-Minute') {
    tables.push({
      position: 'top_right', columns: 99, rows: 99, bgColor: '#20222C', borderColor: '#363843', frameColor: '#363843',
      borderWidth: 1, frameWidth: 1, cells: [{ column: 0, row: 0, text: WARNING, textColor: fg, textSize: 'auto' }],
    });
  }

  setDrawingBar(null);
  const drawn = drawingOutputs(bars);
  resetDrawings();
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawn,
    tables,
    alertCalls,
  };
}

export const FootprintIqPro = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, hasAlertFunction, requiredSymbols,
};
