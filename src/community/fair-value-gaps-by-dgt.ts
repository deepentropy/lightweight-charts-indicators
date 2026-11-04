/**
 * Fair Value Gaps by DGT
 *
 * Fair value gaps (FVGs) of the chart timeframe or of a higher timeframe (sets #1 and #2), and of a lower timeframe
 * (set #3, off by default).
 *
 * Sets #1 / #2 run on the last "Max Bars Back" + 1 bars. They build the bars of their timeframe from the chart bars
 * (a new bar on each timeframe.change, its high / low with the bar index where they were reached) and keep the last
 * three completed bars. A bullish gap: the low of the latest bar is above the high of the bar two before, the close
 * of the middle bar is above that high, and neither pair of neighbours has a gap of its own. It draws a solid line at
 * the low of the latest bar, a dotted line at the middle, a wider line at the high of the bar two before, a fill
 * between the two outer lines and a label "Chart(tf) FVG" / "HTF(tf) FVG" (with a tooltip of the three prices); at
 * most one bullish and one bearish gap per bar of the timeframe. Bearish gaps mirror it. Each bar extends the open
 * gaps to the next bar and shows in the label the largest part of the gap filled so far ("(45.3%)"); a gap is deleted
 * when the price reaches its fill level ("Any Touch": the near edge, "Midpoint Reached": the average of the low of
 * the bar two before and the high of the latest bar for both sides, as the original, "Wick Sweep": the far edge
 * with the wick, "Body Beyond": the far edge with the close). A timeframe below the chart timeframe uses the chart
 * timeframe.
 *
 * Set #3 reads the lower-timeframe bars inside each chart bar (request.security_lower_tf with the ATR(13) of the
 * lower timeframe): a gap between lower bars larger than "FVG Filter Threshold" x ATR draws a box on the chart bar
 * and a label; the boxes shrink as later lower bars enter them and are deleted when a lower bar (or a later chart
 * bar) crosses them; at most 250 are kept. The lower-timeframe bars come from the chart context (`requiredSymbols`,
 * `bars` accessor); without them the port throws a MissingSymbolDataError when set #3 is on.
 *
 * A table in the bottom right corner shows the logo "☼☾". At most 500 lines, 500 labels and 500 boxes are kept.
 * The periods follow the exchange calendar of the chart context (time zone and session, see src/anchor-period.ts);
 * without it the UTC calendar of the bars.
 *
 * Reference: "Fair Value Gaps by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import {
  ta, str, color, timeframe, line, label, box, linefill, table, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, periodChanges } from '../anchor-period';
import { symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';

type HtfOption = 'Chart' | '5 Minutes' | '15 Minutes' | '1 Hour' | '4 Hours' | '1 Day' | '1 Week' | '1 Month';
type FillOption = 'Any Touch' | 'Midpoint Reached' | 'Wick Sweep' | 'Body Beyond';
type LtfOption = 'Auto' | '1S' | '5S' | '10S' | '15S' | '30S' | '1m' | '3m' | '5m' | '15m' | '30m' | '45m' | '1H' | '2H' | '3H' | '4H' | 'D';

export interface FairValueGapsByDgtInputs {
  fvgSH1: boolean;
  fvgTF1: HtfOption;
  fvgFill1: FillOption;
  fvgCb1: string;
  fvgCs1: string;
  fvgLB1: 'Show' | 'Hide';
  maxBars: number;
  fvgSH2: boolean;
  fvgTF2: HtfOption;
  fvgFill2: FillOption;
  fvgCb2: string;
  fvgCs2: string;
  fvgLB2: 'Show' | 'Hide';
  maxBars2: number;
  fvgSH3: boolean;
  fvgTF3: LtfOption;
  fvgTH3: number;
  fvgCb3: string;
  fvgCs3: string;
  fvgLB3: 'Show' | 'Hide';
}

export const defaultInputs: FairValueGapsByDgtInputs = {
  fvgSH1: true,
  fvgTF1: 'Chart',
  fvgFill1: 'Wick Sweep',
  fvgCb1: '#00B8D9',
  fvgCs1: '#FF8B00',
  fvgLB1: 'Show',
  maxBars: 360,
  fvgSH2: false,
  fvgTF2: '1 Hour',
  fvgFill2: 'Wick Sweep',
  fvgCb2: '#6EE7B7',
  fvgCs2: '#FF6B6B',
  fvgLB2: 'Hide',
  maxBars2: 360,
  fvgSH3: false,
  fvgTF3: 'Auto',
  fvgTH3: 0.7,
  fvgCb3: '#8BC34A',
  fvgCs3: '#E91E63',
  fvgLB3: 'Hide',
};

const HTF_OPTIONS: HtfOption[] = ['Chart', '5 Minutes', '15 Minutes', '1 Hour', '4 Hours', '1 Day', '1 Week', '1 Month'];
const FILL_OPTIONS: FillOption[] = ['Any Touch', 'Midpoint Reached', 'Wick Sweep', 'Body Beyond'];
const LTF_OPTIONS: LtfOption[] = ['Auto', '1S', '5S', '10S', '15S', '30S', '1m', '3m', '5m', '15m', '30m', '45m', '1H', '2H', '3H', '4H', 'D'];
const G1 = 'Fair Value Gaps #1, Chart/HTF';
const G2 = 'Fair Value Gaps #, Chart/HTF';
const G3 = 'Fair Value Gaps #3, LTF';
const SP = '  ';
const TF_TIP = 'Select the timeframe from which Fair Value Gaps (FVGs) will be detected.\n' +
  '• Chart — uses the current chart timeframe.\n' +
  '• Higher timeframes — plots FVGs derived from the selected timeframe above the chart.\n\n' +
  'If a lower timeframe than the chart is selected, the script automatically defaults to the chart timeframe.';
const FILL_TIP = 'Defines how a Fair Value Gap (FVG) is considered filled:\n' +
  '• Any Touch — when price (wick or body) touches any part of the imbalance zone.\n' +
  '• Midpoint Reached — when price trades to at least the midpoint (50%) of the zone.\n' +
  '• Wick Sweep — when a wick fully passes through the entire FVG and returns inside the zone.\n' +
  '• Body Beyond — when the candle body closes beyond the opposite edge of the FVG, confirming full repair.';
const LB_TIP = 'Controls the visibility of Fair Value Gap (FVG) labels.\n\n' +
  '• **Show** — displays labels directly on the chart. Each label indicates the timeframe and fill progress of the zone.\n' +
  '• **Hide** — hides on-chart labels, but tooltips remain accessible by hovering over the midpoint of each FVG zone.';
const MAX_TIP = 'This determines how far back the script will analyze for Fair Value Gaps.';
const LTF_TIP = 'Intrabar timeframe (lower timeframe, LTF) setting option. ' +
  'When set to "Auto", the lower timeframe is determined by the following algorithm:\n' +
  '  Chart Timeframe → Lower Timeframe\n' +
  '\t\t<= 3 min\t\t→ 15 sec\n' +
  '\t\t<= 30 min\t\t→ 1 min\n' +
  '\t\t<= 2 hour\t\t→ 5 min\n' +
  '\t\t<= 4 hour\t\t→ 15 min\n' +
  '\t\t<= 1 day\t\t→ 1 hour\n' +
  '\t\t<= 1 week\t\t→ 4 hour\n' +
  '\t\t<= 1 month\t→ 1 day\n' +
  '\t\t>  1 month\t→ 1 week';
const TH_TIP = 'Checks the significance of the detected fair value gap compared to a fixed-length average true range. ' +
  'Setting the value to 0 means that no filtering will be applied, whereas values greater than zero determine the filtering threshold value';
const LB3_TIP = 'Controls the visibility of lower-timeframe Fair Value Gap (FVG) labels.\n\n' +
  '• **Show** — displays labels for each detected LTF FVG, indicating the source lower timeframe of the zone.\n' +
  '• **Hide** — hides the on-chart labels, while tooltips remain available when hovering over the midpoint of each LTF FVG zone.';

// display = display.all - display.status_line: the input is not shown in the status line
export const inputConfig: InputConfig[] = [
  { id: 'fvgSH1', type: 'bool', title: 'Fair Value Gaps #1, Chart/HTF', defval: true, inline: 'fvg1', group: G1 },
  { id: 'fvgTF1', type: 'string', title: '', defval: 'Chart', options: HTF_OPTIONS, inline: 'fvg1', group: G1, tooltip: TF_TIP, display: 'none' },
  { id: 'fvgFill1', type: 'string', title: `${SP}FVG #1 Fill Method`, defval: 'Wick Sweep', options: FILL_OPTIONS, display: 'none', tooltip: FILL_TIP, group: G1 },
  { id: 'fvgCb1', type: 'color', title: `${SP}FVG #1 Zones${SP}${SP}`, defval: '#00B8D9', inline: 'fvg', group: G1 },
  { id: 'fvgCs1', type: 'color', title: '', defval: '#FF8B00', inline: 'fvg', group: G1 },
  { id: 'fvgLB1', type: 'string', title: `${SP}FVG #1 Labels`, defval: 'Show', options: ['Show', 'Hide'], tooltip: LB_TIP, display: 'none', group: G1 },
  { id: 'maxBars', type: 'int', title: `${SP}Max Bars Back`, defval: 360, min: 1, step: 20, group: G1, display: 'none', tooltip: MAX_TIP },
  { id: 'fvgSH2', type: 'bool', title: 'Fair Value Gaps #2, Chart/HTF', defval: false, inline: 'fvg2', group: G2 },
  { id: 'fvgTF2', type: 'string', title: '', defval: '1 Hour', options: HTF_OPTIONS, inline: 'fvg2', group: G2, tooltip: TF_TIP, display: 'none' },
  { id: 'fvgFill2', type: 'string', title: `${SP}FVG #2 Fill Method`, defval: 'Wick Sweep', options: FILL_OPTIONS, display: 'none', tooltip: FILL_TIP, group: G2 },
  { id: 'fvgCb2', type: 'color', title: `${SP}FVG #2 Zones${SP}${SP}`, defval: '#6EE7B7', inline: 'fvg', group: G2 },
  { id: 'fvgCs2', type: 'color', title: '', defval: '#FF6B6B', inline: 'fvg', group: G2 },
  { id: 'fvgLB2', type: 'string', title: `${SP}FVG #2 Labels`, defval: 'Hide', options: ['Show', 'Hide'], tooltip: LB_TIP, display: 'none', group: G2 },
  { id: 'maxBars2', type: 'int', title: `${SP}Max Bars Back`, defval: 360, min: 1, step: 20, group: G2, display: 'none', tooltip: MAX_TIP },
  { id: 'fvgSH3', type: 'bool', title: 'Fair Value Gaps #3, LTF', defval: false, inline: 'fvg3', group: G3 },
  { id: 'fvgTF3', type: 'string', title: '', defval: 'Auto', options: LTF_OPTIONS, inline: 'fvg3', display: 'none', group: G3, tooltip: LTF_TIP },
  { id: 'fvgTH3', type: 'float', title: `${SP}FVG Filter Threshold`, defval: 0.7, min: 0, step: 0.1, group: G3, tooltip: TH_TIP, display: 'none' },
  { id: 'fvgCb3', type: 'color', title: `${SP}FVG #3 Zones${SP}${SP}`, defval: '#8BC34A', inline: 'VD', group: G3 },
  { id: 'fvgCs3', type: 'color', title: '', defval: '#E91E63', inline: 'VD', group: G3 },
  { id: 'fvgLB3', type: 'string', title: `${SP}FVG #3 Labels`, defval: 'Hide', options: ['Show', 'Hide'], tooltip: LB3_TIP, display: 'none', group: G3 },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'linefill', 'table'];

export const metadata = {
  title: 'Fair Value Gaps by DGT',
  shortTitle: 'FVGs ☼☾',
  overlay: true,
};

const MAX_OBJECTS = 500;
const NO_COLOR = '#00000000';
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const avg = (a: number, b: number) => (a + b) / 2;

/** ltfTF(_t): the lower timeframe of an option ("1m" -> "1", "1H" -> "60"; seconds, "D" as they are) */
function ltfOf(option: LtfOption, chartSeconds: number): string {
  if (option === 'Auto') {
    const m = 60;
    if (chartSeconds <= 1 * m) return '5S';
    if (chartSeconds <= 3 * m) return '15S';
    if (chartSeconds <= 30 * m) return '1';
    if (chartSeconds <= 120 * m) return '5';
    if (chartSeconds <= 240 * m) return '15';
    if (chartSeconds <= 1440 * m) return '60';
    if (chartSeconds <= 7 * 1440 * m) return '240';
    if (chartSeconds <= 31 * 1440 * m) return 'D';
    return 'W';
  }
  if (/[SDWM]/.test(option)) return option;
  if (option.includes('m')) return option.replace('m', '');
  if (option.includes('H')) return str.tostring(Number(option.replace('H', '')) * 60);
  return '12M';
}

/** htfTF(usrTF): the timeframe of a set (the chart timeframe when the option is not above it) */
function htfOf(option: HtfOption, chartTf: string): string {
  const seconds = timeframe.in_seconds(chartTf);
  const minutes = seconds / 60;
  const intraday = seconds < 86400;
  const daily = !intraday && seconds < 7 * 86400;
  const weekly = !intraday && !daily && seconds < 28 * 86400;
  if (option === '5 Minutes' && minutes <= 5) return '5';
  if (option === '15 Minutes' && minutes <= 15) return '15';
  if (option === '1 Hour' && minutes <= 60) return '60';
  if (option === '4 Hours' && minutes <= 240) return '240';
  if (option === '1 Day' && intraday) return 'D';
  if (option === '1 Week' && (daily || intraday)) return 'W';
  if (option === '1 Month' && (weekly || daily || intraday)) return 'M';
  return chartTf;
}

/** The lower timeframe bars needed by set #3 (none when it is off or on the chart timeframe). */
export function requiredSymbols(inputs: Partial<FairValueGapsByDgtInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  if (!cfg.fvgSH3 || chartTf === '') return [];
  const ltf = ltfOf(cfg.fvgTF3, timeframe.in_seconds(chartTf));
  if (timeframe.in_seconds(ltf) >= timeframe.in_seconds(chartTf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: ltf }];
}

interface HTFBar {
  price: number;
  index: number;
}

interface HTFBarOHLC {
  open: HTFBar;
  high: HTFBar;
  low: HTFBar;
  close: HTFBar;
}

interface FVG {
  lbTxt: Label;
  lnTop: Line;
  lnAvg: Line;
  lnBtm: Line;
  mitPrice: number;
  mit: number;
  txt: string;
}

/** renderFvg(): one call site with its own `var` state; `run(i)` is a call on bar i. */
function fvgSet(
  bars: Bar[],
  tf: string,
  changes: boolean[],
  fvgTf: boolean,
  fill: FillOption,
  cBull: string,
  cBear: string,
  fvgLb: 'Show' | 'Hide',
): (i: number) => void {
  const bullFvgArray: FVG[] = [];
  const bearFvgArray: FVG[] = [];
  const barArray: HTFBarOHLC[] = [];
  let started = false;
  let barOpen: HTFBar;
  let barHigh: HTFBar;
  let barLow: HTFBar;
  let barClose: HTFBar;
  let barHist: HTFBarOHLC;
  let bullProcess = false;
  let bullCondition = false;
  let bearProcess = false;
  let bearCondition = false;
  const txt = fvgTf ? `Chart(${tf}) FVG` : `HTF(${tf}) FVG`;
  const lbText = fvgLb === 'Show' ? txt : '';
  const fmt = (v: number) => str.format('{0, number, #,###.##}', v);

  const update = (arr: FVG[], side: 'bull' | 'bear', i: number) => {
    const b = bars[i];
    for (let k = arr.length - 1; k >= 0; k--) {
      const t = arr[k];
      const filled = side === 'bull'
        ? le(fill === 'Body Beyond' ? b.close : b.low, t.mitPrice)
        : gt(fill === 'Body Beyond' ? b.close : b.high, t.mitPrice);
      if (filled) {
        arr.splice(k, 1);
        label.delete(t.lbTxt);
        line.delete(t.lnTop);
        line.delete(t.lnAvg);
        line.delete(t.lnBtm);
      } else {
        label.set_x(t.lbTxt, i + 1);
        line.set_x2(t.lnTop, i + 1);
        line.set_x2(t.lnAvg, i + 1);
        line.set_x2(t.lnBtm, i + 1);
        const top = line.get_y1(t.lnTop);
        const btm = line.get_y1(t.lnBtm);
        const fillRatio = side === 'bull' ? (top - b.low) / (top - btm) : (b.high - btm) / (top - btm);
        if (gt(fillRatio, t.mit)) {
          t.mit = fillRatio;
          label.set_text(t.lbTxt, fvgLb === 'Show' ? t.txt + str.format('{0,number,(#.#%)}', fillRatio) : '');
        }
      }
    }
  };

  return (i: number) => {
    const b = bars[i];
    const newBar = (price: number): HTFBar => ({ price, index: i });
    if (!started) {
      // var HTFBar barOpen = HTFBar.new(bar.open, bar.index), ...: made on the first call
      started = true;
      barOpen = newBar(b.open);
      barHigh = newBar(b.high);
      barLow = newBar(b.low);
      barClose = newBar(b.close);
      barHist = { open: barOpen, high: barHigh, low: barLow, close: barClose };
    }
    if (changes[i]) {
      bullProcess = false;
      bearProcess = false;
      if (barArray.length > 2) barArray.pop();
      barArray.unshift(barHist!);
      barOpen = newBar(b.open);
      barHigh = newBar(b.high);
      barLow = newBar(b.low);
      barClose = newBar(b.close);
      barHist = { open: barOpen, high: barHigh, low: barLow, close: barClose };
    } else {
      if (gt(b.high, barHigh!.price)) {
        barHigh!.price = b.high;
        barHigh!.index = i;
      }
      if (lt(b.low, barLow!.price)) {
        barLow!.price = b.low;
        barLow!.index = i;
      }
      barClose!.price = b.close;
      barClose!.index = i;
    }
    if (barArray.length > 2) {
      const [b0, b1, b2] = barArray;
      const bullG = gt(b0.low.price, b1.high.price) || gt(b1.low.price, b2.high.price);
      bullCondition = gt(b0.low.price, b2.high.price) && gt(b1.close.price, b2.high.price) && !bullG;
      const bearG = lt(b0.high.price, b1.low.price) || lt(b1.high.price, b2.low.price);
      bearCondition = lt(b0.high.price, b2.low.price) && lt(b1.close.price, b2.low.price) && !bearG;
    }
    if (bullCondition && !bullProcess) {
      bullProcess = true;
      const [b0, , b2] = barArray;
      const mid = avg(b0.low.price, b2.high.price);
      const lb = label.new(i + 1, mid, lbText, 'bar_index', 'price', NO_COLOR, 'label_left', cBull, 'small', 'center',
        `${fvgTf ? `Chart(${tf}) Bullish FVG` : `HTF(${tf}) Bullish FVG`}\n\nZone Top · ${fmt(b0.low.price)}\nZone Mid · ${fmt(mid)}\nZone Btm · ${fmt(b2.high.price)}`);
      const lnTop = line.new(b0.low.index, b0.low.price, i + 1, b0.low.price, 'bar_index', 'none', String(color.new(cBull, 65)));
      const lnAvg = line.new(Math.ceil(avg(b0.low.index, b2.high.index)), mid, i + 1, mid, 'bar_index', 'none', String(color.new(cBull, 25)), 'dotted');
      const lnBtm = line.new(b2.high.index, b2.high.price, i + 1, b2.high.price, 'bar_index', 'none', String(color.new(cBull, 50)), 'solid', 2);
      const mitPrice = fill === 'Midpoint Reached' ? avg(b2.low.price, b0.high.price) : fill === 'Any Touch' ? b0.low.price : b2.high.price;
      bullFvgArray.unshift({ lbTxt: lb, lnTop, lnAvg, lnBtm, mitPrice, mit: 0, txt });
      linefill.new(lnTop, lnBtm, String(color.new(cBull, 89)));
    }
    if (bearCondition && !bearProcess) {
      bearProcess = true;
      const [b0, , b2] = barArray;
      const mid = avg(b2.low.price, b0.high.price);
      const lb = label.new(i + 1, mid, lbText, 'bar_index', 'price', NO_COLOR, 'label_left', cBear, 'small', 'center',
        `${fvgTf ? `Chart(${tf}) Bearish FVG` : `HTF(${tf}) Bearish FVG`}\n\nZone Top · ${fmt(b2.low.price)}\nZone Mid · ${fmt(mid)}\nZone Btm · ${fmt(b0.high.price)}`);
      const lnTop = line.new(b2.low.index, b2.low.price, i + 1, b2.low.price, 'bar_index', 'none', String(color.new(cBear, 50)), 'solid', 2);
      const lnAvg = line.new(Math.ceil(avg(b2.low.index, b0.high.index)), mid, i + 1, mid, 'bar_index', 'none', String(color.new(cBear, 25)), 'dotted');
      const lnBtm = line.new(b0.high.index, b0.high.price, i + 1, b0.high.price, 'bar_index', 'none', String(color.new(cBear, 65)));
      const mitPrice = fill === 'Midpoint Reached' ? avg(b2.low.price, b0.high.price) : fill === 'Any Touch' ? b0.high.price : b2.low.price;
      bearFvgArray.unshift({ lbTxt: lb, lnTop, lnAvg, lnBtm, mitPrice, mit: 0, txt });
      linefill.new(lnTop, lnBtm, String(color.new(cBear, 89)));
    }
    update(bullFvgArray, 'bull', i);
    update(bearFvgArray, 'bear', i);
  };
}

export function calculate(bars: Bar[], inputs: Partial<FairValueGapsByDgtInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  if (n === 0) return base;
  const chartTf = chartTimeframe(bars, chart) || '1D';
  const chartSeconds = timeframe.in_seconds(chartTf);

  // set #3: request.security_lower_tf(tickerid, ltf, [open, high, low, close, ta.atr(13)])
  const ltf = ltfOf(cfg.fvgTF3, chartSeconds);
  let intrabars: (i: number) => { bars: Bar[]; atr: number[] } = () => ({ bars: [], atr: [] });
  if (cfg.fvgSH3) {
    if (timeframe.in_seconds(ltf) > chartSeconds) {
      throw new Error(`Fair Value Gaps by DGT: the lower timeframe "${ltf}" is above the chart timeframe "${chartTf}"`);
    }
    let ltfBars: Bar[];
    let ranges: Array<[number, number]>;
    if (timeframe.in_seconds(ltf) === chartSeconds) {
      ltfBars = bars;
      ranges = bars.map((_b, i) => [i, i + 1]);
    } else {
      [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: ltf }], chart);
      ranges = securityLowerTf(bars, ltfBars, ltf, otherSymbolChart(bars, chart), { other: { timezone: chart?.timezone, session: chart?.session } });
    }
    const atr = ta.atr(ltfBars as Bar[], 13).toArray().map((v) => v ?? NaN);
    intrabars = (i) => ({ bars: ltfBars.slice(ranges[i][0], ranges[i][1]), atr: atr.slice(ranges[i][0], ranges[i][1]) });
  }
  const changesOf = (tf: string) => (tf === chartTf ? periodChanges(bars, '', chart) : periodChanges(bars, tf, chart));
  const sets = [
    { show: cfg.fvgSH1, maxBars: cfg.maxBars, option: cfg.fvgTF1, fill: cfg.fvgFill1, cBull: cfg.fvgCb1, cBear: cfg.fvgCs1, lb: cfg.fvgLB1 },
    { show: cfg.fvgSH2, maxBars: cfg.maxBars2, option: cfg.fvgTF2, fill: cfg.fvgFill2, cBull: cfg.fvgCb2, cBear: cfg.fvgCs2, lb: cfg.fvgLB2 },
  ].map((s) => {
    if (!s.show) return null;
    const tf = htfOf(s.option, chartTf);
    return { maxBars: s.maxBars, run: fvgSet(bars, tf, changesOf(tf), tf === chartTf, s.fill, s.cBull, s.cBear, s.lb) };
  });

  const fvgLTFbx: Box[] = [];
  const fvgLTFlb: Label[] = [];
  const bull3Border = String(color.new(cfg.fvgCb3, 73));
  const bear3Border = String(color.new(cfg.fvgCs3, 73));
  const lb3Text = cfg.fvgLB3 === 'Show' ? `LTF(${ltf}) FVG` : '';
  const ltfChanges = periodChanges(bars, '', chart);
  // var table logo = table.new(position.bottom_right, 1, 1)
  const logo = table.new('bottom_right', 1, 1);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const intra = cfg.fvgSH3 && ltfChanges[i] ? intrabars(i) : null;
    if (intra && intra.bars.length > 0) {
      // BAR bar = BAR.new(): the lower-timeframe fields start na on each chart bar
      let ltfHigh = NaN, ltfHigh1 = NaN, ltfHigh2 = NaN, ltfLow = NaN, ltfLow1 = NaN, ltfLow2 = NaN, ltfClose = NaN, ltfClose1 = NaN;
      for (let k = 0; k < intra.bars.length; k++) {
        const lb = intra.bars[k];
        ltfClose1 = ltfClose;
        ltfClose = lb.close;
        ltfHigh2 = ltfHigh1;
        ltfHigh1 = ltfHigh;
        ltfHigh = lb.high;
        ltfLow2 = ltfLow1;
        ltfLow1 = ltfLow;
        ltfLow = lb.low;
        const atr = intra.atr[k];
        const bull = gt(ltfLow - ltfHigh2, atr * cfg.fvgTH3) && gt(ltfLow, ltfHigh2) && gt(ltfClose1, ltfHigh2);
        if (bull) {
          fvgLTFbx.push(box.new(i, ltfLow, i + 1, ltfHigh2, bull3Border, 1, 'solid', 'none', 'bar_index', bull3Border));
          fvgLTFlb.push(label.new(i + 1, avg(ltfLow, ltfHigh2), lb3Text, 'bar_index', 'price', NO_COLOR, 'label_left', cfg.fvgCb3, 'small', 'center', `LTF(${ltf}) Bullish FVG`));
        }
        const bear = gt(ltfLow2 - ltfHigh, atr * cfg.fvgTH3) && lt(ltfHigh, ltfLow2) && lt(ltfClose1, ltfLow2);
        if (bear) {
          fvgLTFbx.push(box.new(i, ltfLow2, i + 1, ltfHigh, bear3Border, 1, 'solid', 'none', 'bar_index', bear3Border));
          fvgLTFlb.push(label.new(i + 1, avg(ltfLow2, ltfHigh), lb3Text, 'bar_index', 'price', NO_COLOR, 'label_left', cfg.fvgCs3, 'small', 'center', `LTF(${ltf}) Bearish FVG`));
        }
        for (let bn = fvgLTFbx.length - 1; bn >= 0; bn--) {
          if (bn >= fvgLTFbx.length) continue;
          const cBX = fvgLTFbx[bn];
          const cLB = fvgLTFlb[bn];
          const tBX = box.get_top(cBX);
          const bBX = box.get_bottom(cBX);
          if (ge(ltfHigh, tBX) && le(ltfLow, bBX)) {
            box.delete(cBX);
            fvgLTFbx.splice(bn, 1);
            fvgLTFlb.splice(bn, 1);
            label.delete(cLB);
          } else {
            if (gt(ltfHigh, bBX) && lt(ltfHigh, tBX)) {
              box.set_bottom(cBX, ltfHigh);
              label.set_y(cLB, avg(box.get_top(cBX), ltfHigh));
            }
            if (lt(ltfLow, tBX) && gt(ltfLow, bBX)) {
              box.set_top(cBX, ltfLow);
              label.set_y(cLB, avg(box.get_bottom(cBX), ltfLow));
            }
          }
        }
        if (fvgLTFbx.length > 250) {
          box.delete(fvgLTFbx.shift()!);
          label.delete(fvgLTFlb.shift()!);
        }
      }
    }
    // the chart bar extends the lower-timeframe boxes or deletes those it crosses
    for (let bn = fvgLTFbx.length - 1; bn >= 0; bn--) {
      if (bn >= fvgLTFbx.length) continue;
      const cBX = fvgLTFbx[bn];
      const cLB = fvgLTFlb[bn];
      const tBX = box.get_top(cBX);
      const bBX = box.get_bottom(cBX);
      if (gt(b.high, tBX) && lt(b.low, bBX) && i > box.get_left(cBX)) {
        fvgLTFbx.splice(bn, 1);
        box.delete(cBX);
        fvgLTFlb.splice(bn, 1);
        label.delete(cLB);
      } else {
        box.set_right(cBX, i + 1);
        box.set_border_color(cBX, 'transparent');
        label.set_x(cLB, i + 1);
      }
    }
    // renderFvg on the last maxBars + 1 bars
    for (const s of sets) {
      if (s && n - 1 - i <= s.maxBars) s.run(i);
    }
    if (i === n - 1) {
      table.cell(logo, 0, 0, '☼☾  ', undefined, undefined, color.teal, undefined, undefined, 'normal', undefined, 'SoleMare Analytics');
    }
  }
  setDrawingBar(null);

  const ms = bars[0].time >= 1e12;
  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const FairValueGapsByDgt = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, requiredSymbols };
