/**
 * Order Block Detector [LuxAlgo]
 *
 * A pivot high of the volume (`length` bars on each side) marks an order block on the pivot bar. The block is
 * bullish when the market state `os` is 1 and bearish when it is 0: os becomes 0 when high[length] is above the
 * highest high of the last `length` bars and 1 when low[length] is below the lowest low of the last `length` bars.
 * A bullish block goes from the low to hl2 of the pivot bar, a bearish block from hl2 to the high; the average
 * line is in the middle. A bullish block is removed (mitigated) when the lowest low (or lowest close, 'Close'
 * method) of the last `length` bars is below its bottom, a bearish block when the highest high (or close) is above
 * its top. On the last bar the newest blocks of each side are drawn as boxes and lines that extend to the right.
 * Two hidden plots (display none) give the price of each new block, `length` bars back.
 *
 * Pine details kept: the mitigation loop is `for element in array` with removals inside, so the element after a
 * removed one is skipped on that bar. The average line ends 1 ms after its start in Pine (x in bar time): the port
 * gives it the time of the next bar, where the line is drawn. Blocks that do not exist leave their box and line
 * without coordinates: they are not in the output. The 4 alert conditions have no output.
 *
 * Reference: "Order Block Detector [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line } from 'oakscriptjs/script';
import type { BoxData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface OrderBlockDetectorInputs {
  /** Volume Pivot Length */
  length: number;
  /** Number of bullish order blocks shown */
  bullExtLast: number;
  bgBullCss: string;
  bullCss: string;
  bullAvgCss: string;
  /** Number of bearish order blocks shown */
  bearExtLast: number;
  bgBearCss: string;
  bearCss: string;
  bearAvgCss: string;
  lineStyle: '⎯⎯⎯' | '----' | '····';
  lineWidth: number;
  mitigation: 'Wick' | 'Close';
}

export const defaultInputs: OrderBlockDetectorInputs = {
  length: 5,
  bullExtLast: 3,
  bgBullCss: 'rgba(22, 148, 0, 0.2)',
  bullCss: '#169400',
  bullAvgCss: 'rgba(149, 152, 161, 0.63)',
  bearExtLast: 3,
  bgBearCss: 'rgba(255, 17, 0, 0.2)',
  bearCss: '#ff1100',
  bearAvgCss: 'rgba(149, 152, 161, 0.63)',
  lineStyle: '⎯⎯⎯',
  lineWidth: 1,
  mitigation: 'Wick',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volume Pivot Length', defval: 5, min: 1 },
  { id: 'bullExtLast', type: 'int', title: 'Bullish OB ', defval: 3, min: 1, inline: 'bull' },
  { id: 'bgBullCss', type: 'color', title: '', defval: 'rgba(22, 148, 0, 0.2)', inline: 'bull' },
  { id: 'bullCss', type: 'color', title: '', defval: '#169400', inline: 'bull' },
  { id: 'bullAvgCss', type: 'color', title: '', defval: 'rgba(149, 152, 161, 0.63)', inline: 'bull' },
  { id: 'bearExtLast', type: 'int', title: 'Bearish OB', defval: 3, min: 1, inline: 'bear' },
  { id: 'bgBearCss', type: 'color', title: '', defval: 'rgba(255, 17, 0, 0.2)', inline: 'bear' },
  { id: 'bearCss', type: 'color', title: '', defval: '#ff1100', inline: 'bear' },
  { id: 'bearAvgCss', type: 'color', title: '', defval: 'rgba(149, 152, 161, 0.63)', inline: 'bear' },
  { id: 'lineStyle', type: 'string', title: 'Average Line Style', defval: '⎯⎯⎯', options: ['⎯⎯⎯', '----', '····'] },
  { id: 'lineWidth', type: 'int', title: 'Average Line Width', defval: 1, min: 1 },
  { id: 'mitigation', type: 'string', title: 'Mitigation Methods', defval: 'Wick', options: ['Wick', 'Close'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull OB', color: '#169400', lineWidth: 2, style: 'linebr', display: 'none' },
  { id: 'plot1', title: 'Bear OB', color: '#ff1100', lineWidth: 2, style: 'linebr', display: 'none' },
];

export const metadata = {
  title: 'Order Block Detector [LuxAlgo]',
  shortTitle: 'Order Block Detector [LuxAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** Coordinates of the order blocks of one side, newest first (Pine get_coordinates arrays) */
interface Blocks {
  top: number[];
  btm: number[];
  avg: number[];
  /** Bar time of the block in ms */
  left: number[];
}

/** Pine array.indexof: the first element equal to x (Pine ==), else -1 */
const indexOf = (arr: number[], x: number) => arr.findIndex((v) => eq(v, x));

/**
 * Pine remove_mitigated: `for element in target_array` reads the array at the loop index on each step, so a removal
 * moves the next element under the index that was just read (it is skipped on this bar).
 */
function removeMitigated(blocks: Blocks, target: number, bull: boolean): boolean {
  let mitigated = false;
  const targetArray = bull ? blocks.btm : blocks.top;
  for (let k = 0; k < targetArray.length; k++) {
    const element = targetArray[k];
    const idx = indexOf(targetArray, element);
    if (bull ? gt(element, target) : gt(target, element)) {
      mitigated = true;
      blocks.top.splice(idx, 1);
      blocks.btm.splice(idx, 1);
      blocks.avg.splice(idx, 1);
      blocks.left.splice(idx, 1);
    }
  }
  return mitigated;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderBlockDetectorInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const closeS = new Series(bars, (b) => b.close);
  const upper = A(ta.highest(highS, length));
  const lower = A(ta.lowest(lowS, length));
  const closeMode = cfg.mitigation === 'Close';
  // target_bull / target_bear: lowest / highest close ('Close') or low / high ('Wick') of the last `length` bars
  const targetBull = closeMode ? A(ta.lowest(closeS, length)) : lower;
  const targetBear = closeMode ? A(ta.highest(closeS, length)) : upper;
  const phv = A(ta.pivothigh(new Series(bars, (b) => b.volume ?? NaN), length, length));

  const style = cfg.lineStyle === '----' ? 'dashed' : cfg.lineStyle === '····' ? 'dotted' : 'solid';
  const interval = barInterval(bars);
  const bullOb = new Array<number>(n).fill(NaN);
  const bearOb = new Array<number>(n).fill(NaN);

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_boxes_count: 500, max_labels_count: 500, max_lines_count: 500 });
    const bull: Blocks = { top: [], btm: [], avg: [], left: [] };
    const bear: Blocks = { top: [], btm: [], avg: [], left: [] };

    // set_order_blocks, barstate.isfirst: ext_last boxes and lines without coordinates (newest first in the arrays)
    const makeDrawings = (extLast: number, bgCss: string, borderCss: string, lvlCss: string) => {
      const obBox: ReturnType<typeof box.new>[] = [];
      const obLvl: ReturnType<typeof line.new>[] = [];
      for (let i = 0; i <= extLast - 1; i++) {
        obBox.unshift(box.new(NaN, NaN, NaN, NaN, String(color.new(borderCss, 70)), undefined, undefined, 'right', 'bar_time', bgCss));
        obLvl.unshift(line.new(NaN, NaN, NaN, NaN, 'bar_time', 'right', lvlCss, style, cfg.lineWidth));
      }
      return { obBox, obLvl };
    };
    const bullDrawings = n > 0 ? makeDrawings(cfg.bullExtLast, cfg.bgBullCss, cfg.bullCss, cfg.bullAvgCss) : null;
    const bearDrawings = n > 0 ? makeDrawings(cfg.bearExtLast, cfg.bgBearCss, cfg.bearCss, cfg.bearAvgCss) : null;

    let os = 0;
    for (let i = 0; i < n; i++) {
      // os := high[length] > upper ? 0 : low[length] < lower ? 1 : os[1]
      const back = i >= length ? bars[i - length] : undefined;
      if (back && gt(back.high, upper[i])) os = 0;
      else if (back && gt(lower[i], back.low)) os = 1;

      // `phv and os == ...`: a pivot value that is na or 0 is false
      const isPivot = back !== undefined && !Number.isNaN(phv[i]) && phv[i] !== 0;
      if (isPivot && back && os === 1) {
        const top = (back.high + back.low) / 2;
        bull.top.unshift(top);
        bull.btm.unshift(back.low);
        bull.avg.unshift((top + back.low) / 2);
        bull.left.unshift(back.time * 1000);
        bullOb[i] = back.low;
      }
      if (isPivot && back && os === 0) {
        const btm = (back.high + back.low) / 2;
        bear.top.unshift(back.high);
        bear.btm.unshift(btm);
        bear.avg.unshift((back.high + btm) / 2);
        bear.left.unshift(back.time * 1000);
        bearOb[i] = back.high;
      }

      removeMitigated(bull, targetBull[i], true);
      removeMitigated(bear, targetBear[i], false);
    }

    // barstate.islast: the newest blocks get a box and an average line
    const setOrderBlocks = (blocks: Blocks, extLast: number, d: ReturnType<typeof makeDrawings>) => {
      if (blocks.top.length === 0) return;
      for (let i = 0; i <= Math.min(extLast - 1, blocks.top.length - 1); i++) {
        const left = blocks.left[i];
        box.set_lefttop(d.obBox[i], left, blocks.top[i]);
        box.set_rightbottom(d.obBox[i], left, blocks.btm[i]);
        line.set_xy1(d.obLvl[i], left, blocks.avg[i]);
        // Pine: left + 1 (1 ms later), drawn on the next bar
        const barIndex = bars.findIndex((b) => b.time * 1000 === left);
        line.set_xy2(d.obLvl[i], barTime(bars, barIndex + 1, interval) * 1000, blocks.avg[i]);
      }
    };
    if (bullDrawings) setOrderBlocks(bull, cfg.bullExtLast, bullDrawings);
    if (bearDrawings) setOrderBlocks(bear, cfg.bearExtLast, bearDrawings);
  }, bars);

  // plot(bull_ob, offset = -length): the value of bar i is drawn on bar i - length
  const shifted = (values: number[], css: string) =>
    bars.map((b, i) => ({ time: b.time, value: i + length < n ? values[i + length] : NaN, color: css }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shifted(bullOb, cfg.bullCss), plot1: shifted(bearOb, cfg.bearCss) },
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
  };
}

export const OrderBlockDetector = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
