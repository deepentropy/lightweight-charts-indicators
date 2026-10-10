/**
 * Order Blocks & Breaker Blocks [LuxAlgo]
 *
 * Swing highs and lows come from a market state `os`: 0 when high[length] is above the highest high of the last
 * `length` bars (a swing high at that bar), 1 when low[length] is below the lowest low (a swing low). When the close
 * crosses the last swing high for the first time, a bullish order block is made from the bar with the lowest low
 * (or lowest body, 'Use Candle Body') since the swing; a close below the last swing low makes a bearish order block
 * from the bar with the highest high. An order block becomes a breaker block when the body goes through it
 * (min(close, open) below the bottom of a bullish block, max(close, open) above the top of a bearish block); a
 * breaker block is removed when the close goes back through its other side. On the last bar the newest blocks of
 * each side are drawn: a box and two lines that extend to the right, and for a breaker block a first part up to the
 * break bar and a dashed second part in the break colour. 'Show Historical Polarity Changes' adds a small arrow on
 * the swing when it falls inside a shown breaker block.
 *
 * Pine details kept: the display loop reads `min(show - 1, size)` blocks, so with fewer blocks than the number to
 * show the script stops with a runtime error; the port throws the same error. The right side of a breaker part is
 * `time + 1` (1 ms after the last bar): the port gives it the time of the last bar, where it is drawn.
 *
 * Reference: "Order Blocks & Breaker Blocks [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line, label } from 'oakscriptjs/script';
import type { BoxData, LabelData, LineDrawingData } from '../types';

export interface OrderBlocksBreakerBlocksInputs {
  /** Swing Lookback */
  length: number;
  showBull: number;
  showBear: number;
  useBody: boolean;
  bullCss: string;
  bullBreakCss: string;
  bearCss: string;
  bearBreakCss: string;
  showLabels: boolean;
}

export const defaultInputs: OrderBlocksBreakerBlocksInputs = {
  length: 10,
  showBull: 3,
  showBear: 3,
  useBody: false,
  bullCss: 'rgba(33, 87, 243, 0.2)',
  bullBreakCss: 'rgba(255, 17, 0, 0.2)',
  bearCss: 'rgba(255, 93, 0, 0.2)',
  bearBreakCss: 'rgba(12, 181, 26, 0.2)',
  showLabels: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Swing Lookback', defval: 10, min: 3 },
  { id: 'showBull', type: 'int', title: 'Show Last Bullish OB', defval: 3, min: 0 },
  { id: 'showBear', type: 'int', title: 'Show Last Bearish OB', defval: 3, min: 0 },
  { id: 'useBody', type: 'bool', title: 'Use Candle Body', defval: false },
  { id: 'bullCss', type: 'color', title: 'Bullish OB', defval: 'rgba(33, 87, 243, 0.2)', inline: 'bullcss', group: 'Style' },
  { id: 'bullBreakCss', type: 'color', title: 'Bullish Break', defval: 'rgba(255, 17, 0, 0.2)', inline: 'bullcss', group: 'Style' },
  { id: 'bearCss', type: 'color', title: 'Bearish OB', defval: 'rgba(255, 93, 0, 0.2)', inline: 'bearcss', group: 'Style' },
  { id: 'bearBreakCss', type: 'color', title: 'Bearish Break', defval: 'rgba(12, 181, 26, 0.2)', inline: 'bearcss', group: 'Style' },
  { id: 'showLabels', type: 'bool', title: 'Show Historical Polarity Changes', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Order Blocks & Breaker Blocks [LuxAlgo]',
  shortTitle: 'Order Blocks & Breaker Blocks [LuxAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** Pine type ob */
interface Ob {
  top: number;
  btm: number;
  /** Bar time in ms */
  loc: number;
  breaker: boolean;
  breakLoc: number;
}

/** Pine type swing */
interface Swing {
  y: number;
  x: number;
  crossed: boolean;
}

/** An na colour (drawn transparent) */
const NA_COLOR = NaN;

/** Pine method notransp: the colour without its transparency */
const notransp = (css: string): string => String(color.rgb(color.r(css), color.g(css), color.b(css)));

export function calculate(
  bars: Bar[],
  inputs: Partial<OrderBlocksBreakerBlocksInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, showBull, showBear } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const upper = A(ta.highest(new Series(bars, (b) => b.high), length));
  const lower = A(ta.lowest(new Series(bars, (b) => b.low), length));
  // max / min: the candle body or the high / low
  const max = bars.map((b) => (cfg.useBody ? Math.max(b.close, b.open) : b.high));
  const min = bars.map((b) => (cfg.useBody ? Math.min(b.close, b.open) : b.low));
  const ms = (i: number) => bars[i].time * 1000;

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_lines_count: 500, max_labels_count: 500, max_boxes_count: 500 });
    let os = 0;
    let top: Swing = { y: NaN, x: NaN, crossed: false };
    let btm: Swing = { y: NaN, x: NaN, crossed: false };
    const bullishOb: Ob[] = [];
    const bearishOb: Ob[] = [];
    let prevBullConf = NaN;
    let prevBearConf = NaN;

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      // swings(length)
      const prevOs = i > 0 ? os : NaN; // os[1] (na on the first bar)
      if (i >= length && gt(bars[i - length].high, upper[i])) os = 0;
      else if (i >= length && gt(lower[i], bars[i - length].low)) os = 1;
      // `os[1] != 0` is false when os[1] is na
      if (os === 0 && !Number.isNaN(prevOs) && prevOs !== 0) top = { y: bars[i - length].high, x: i - length, crossed: false };
      if (os === 1 && !Number.isNaN(prevOs) && prevOs !== 1) btm = { y: bars[i - length].low, x: i - length, crossed: false };

      // Bullish OB
      let bullBreakConf = 0;
      if (gt(bar.close, top.y) && !top.crossed) {
        top.crossed = true;
        let minima = max[i - 1];
        let maxima = min[i - 1];
        let loc = ms(i - 1);
        // for i = 1 to (n - top.x) - 1 (counts down when the end is below 1)
        const end = i - top.x - 1;
        for (let k = 1; end >= 1 ? k <= end : k >= end; k += end >= 1 ? 1 : -1) {
          minima = Math.min(min[i - k], minima);
          if (eq(minima, min[i - k])) {
            maxima = max[i - k];
            loc = ms(i - k);
          }
        }
        bullishOb.unshift({ top: maxima, btm: minima, loc, breaker: false, breakLoc: NaN });
      }
      for (let k = bullishOb.length - 1; k >= 0; k--) {
        const element = bullishOb[k];
        if (!element.breaker) {
          if (gt(element.btm, Math.min(bar.close, bar.open))) {
            element.breaker = true;
            element.breakLoc = ms(i);
          }
        } else if (gt(bar.close, element.top)) {
          bullishOb.splice(k, 1);
        } else if (k < showBull && gt(element.top, top.y) && gt(top.y, element.btm)) {
          bullBreakConf = 1;
        }
      }
      if (bullBreakConf > prevBullConf && cfg.showLabels) {
        label.new(top.x, top.y, '▼', undefined, undefined, NA_COLOR, 'label_down', notransp(cfg.bearCss), 'tiny');
      }
      prevBullConf = bullBreakConf;

      // Bearish OB
      let bearBreakConf = 0;
      if (gt(btm.y, bar.close) && !btm.crossed) {
        btm.crossed = true;
        let minima = min[i - 1];
        let maxima = max[i - 1];
        let loc = ms(i - 1);
        const end = i - btm.x - 1;
        for (let k = 1; end >= 1 ? k <= end : k >= end; k += end >= 1 ? 1 : -1) {
          maxima = Math.max(max[i - k], maxima);
          if (eq(maxima, max[i - k])) {
            minima = min[i - k];
            loc = ms(i - k);
          }
        }
        bearishOb.unshift({ top: maxima, btm: minima, loc, breaker: false, breakLoc: NaN });
      }
      for (let k = bearishOb.length - 1; k >= 0; k--) {
        const element = bearishOb[k];
        if (!element.breaker) {
          if (gt(Math.max(bar.close, bar.open), element.top)) {
            element.breaker = true;
            element.breakLoc = ms(i);
          }
        } else if (gt(element.btm, bar.close)) {
          bearishOb.splice(k, 1);
        } else if (k < showBear && gt(btm.y, element.btm) && gt(element.top, btm.y)) {
          bearBreakConf = 1;
        }
      }
      if (bearBreakConf > prevBearConf && cfg.showLabels) {
        label.new(btm.x, btm.y, '▲', undefined, undefined, NA_COLOR, 'label_up', notransp(cfg.bullCss), 'tiny');
      }
      prevBearConf = bearBreakConf;
    }

    // Set Order Blocks (barstate.islast; boxes and lines of earlier bars are deleted on every bar)
    if (n === 0) return;
    const time = ms(n - 1);
    const timeNext = time; // Pine time + 1 (1 ms later): drawn on the last bar
    const display = (id: Ob, css: string, breakCss: string) => {
      if (id.breaker) {
        box.new(id.loc, id.top, id.breakLoc, id.btm, notransp(css), undefined, undefined, undefined, 'bar_time', css);
        box.new(id.breakLoc, id.top, timeNext, id.btm, NA_COLOR, undefined, undefined, 'right', 'bar_time', breakCss);
        line.new(id.loc, id.top, id.breakLoc, id.top, 'bar_time', undefined, notransp(css));
        line.new(id.loc, id.btm, id.breakLoc, id.btm, 'bar_time', undefined, notransp(css));
        line.new(id.breakLoc, id.top, timeNext, id.top, 'bar_time', 'right', notransp(breakCss), 'dashed');
        line.new(id.breakLoc, id.btm, timeNext, id.btm, 'bar_time', 'right', notransp(breakCss), 'dashed');
      } else {
        box.new(id.loc, id.top, time, id.btm, NA_COLOR, undefined, undefined, 'right', 'bar_time', css);
        line.new(id.loc, id.top, time, id.top, 'bar_time', 'right', notransp(css));
        line.new(id.loc, id.btm, time, id.btm, 'bar_time', 'right', notransp(css));
      }
    };
    const displayAll = (obs: Ob[], show: number, css: string, breakCss: string) => {
      if (show <= 0) return;
      // for i = 0 to math.min(show - 1, size): array.get(size) is a Pine runtime error
      for (let k = 0; k <= Math.min(show - 1, obs.length); k++) {
        if (k >= obs.length) throw new Error(`In 'array.get()' function. Index ${k} is out of bounds, array size is ${obs.length}.`);
        display(obs[k], css, breakCss);
      }
    };
    displayAll(bullishOb, showBull, cfg.bullCss, cfg.bullBreakCss);
    displayAll(bearishOb, showBear, cfg.bearCss, cfg.bearBreakCss);
  }, bars);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
    labels: run.result.labels ?? [],
  };
}

export const OrderBlocksBreakerBlocks = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
