/**
 * Smart Money Setup 01 (Double Order Blocks Confirmation)
 *
 * A zigzag of pivot highs and lows (`ta.pivothigh` / `ta.pivotlow` with `Pivot Period` bars on each side) is kept as
 * a list of points typed H / HH / LH and L / HL / LL: a new pivot either extends the list or replaces the last point
 * when it goes further in the same direction (with close confirmations when the last point is LH or HL). When the
 * list has more than 8 points, the last 8 types, prices and bars are read. On the bar where the newest point is
 * found:
 * - bearish setup: types LL, HH, HL, LH, LL, LH, LL (newest first), point 0 above point 4 and point 5 above point 1;
 * - bullish setup: types HH, LL, LH, HL, HH, HL, HH, point 0 below point 4 and point 5 below point 1.
 * When the low of the candle of point 5 is at or below the high of the candle of point 1 (bearish), or the low of
 * point 1 at or below the high of point 5 (bullish), a marker is drawn on the pivot bar and two boxes are made: the
 * candle range of point 5 ("Supply OB" / "Demand OB", as far right of the bar as point 5 is left of it) and the
 * candle range of point 1 ("Supply OB LTF" / "Demand OB LTF", 20 bars to the right). At most 500 boxes are kept.
 *
 * Reference: "Smart Money Setup 01 [TradingFinder]Double Order Blocks Proof" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab, © chartbox90
 */

import {
  ta, color, box, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type MarkerData, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface SmartMoneySetup01Inputs {
  /** Bars on each side of a pivot */
  PP: number;
}

export const defaultInputs: SmartMoneySetup01Inputs = {
  PP: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'PP', type: 'int', title: 'Pivot Period', defval: 2, min: 2 },
];

export const plotConfig: PlotConfig[] = [];

const BEAR_COLOR = String(color.rgb(179, 2, 2));
const BEAR_TEXT = String(color.rgb(179, 2, 22));
const BULL_COLOR = String(color.rgb(47, 156, 38));

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bear Setup04', style: 'arrowup', location: 'belowbar', color: BEAR_COLOR, text: 'Bear Setup04', textcolor: BEAR_TEXT },
  { id: 'shape1', kind: 'shape', title: 'Bull Setup04', style: 'arrowdown', location: 'abovebar', color: BULL_COLOR, text: 'Bull Setup04', textcolor: BULL_COLOR },
];

export const drawingKinds: StudyDrawingKind[] = ['box'];

export const metadata = {
  title: 'Smart Money Setup 01 [TradingFinder] Double Order Blocks Confirmation',
  shortTitle: 'SMC Setup Order Blocks 01 TFlab',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

const MAX_BOXES = 500;
// Box colours of the script; the box border and text keep the language defaults (blue, #363A45)
const HTF_BG = String(color.rgb(197, 200, 202, 57));
const SUPPLY_LTF_BG = String(color.rgb(252, 231, 48, 57));
const DEMAND_LTF_BG = String(color.rgb(48, 252, 242, 57));
const BORDER = '#2962FF';
const TEXT = '#363A45';

export function calculate(bars: Bar[], inputs: Partial<SmartMoneySetup01Inputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const PP = Math.trunc(cfg.PP);
  const n = bars.length;

  const ph = ta.pivothigh(new Series(bars, (b) => b.high), PP, PP).toArray().map((v) => v ?? NaN);
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), PP, PP).toArray().map((v) => v ?? NaN);
  // A pivot value used as a condition: na and 0 are false
  const on = (v: number) => !Number.isNaN(v) && v !== 0;

  // var arrays of the zigzag points
  const types: string[] = [];
  const values: number[] = [];
  const indexes: number[] = [];
  const last = () => types[types.length - 1];
  const lastValue = () => values[types.length - 1];
  const removeLast = () => {
    types.pop();
    values.pop();
    indexes.pop();
  };
  // array.push(ArrayType, size > 2 ? (value[size - 2] < v ? up : down) : first), then the value and the bar
  const push = (v: number, idx: number, up: string, down: string, first: string) => {
    const size = types.length;
    types.push(size > 2 ? (lt(values[size - 2], v) ? up : down) : first);
    values.push(v);
    indexes.push(idx);
  };

  let highValue = NaN;
  let lowValue = NaN;
  let highIndex = NaN;
  let lowIndex = NaN;

  // var TypePoint0..7, PricePoint0..7, IndexPoint0..7
  const typePoint: string[] = new Array(8).fill('');
  const pricePoint: number[] = new Array(8).fill(0);
  const indexPoint: number[] = new Array(8).fill(0);

  resetDrawings({ box: MAX_BOXES, line: 500, label: 500 });
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const hp = ph[i];
    const lp = pl[i];
    const isH = on(hp);
    const isL = on(lp);
    if (isH) {
      highValue = bars[i - PP].high;
      highIndex = i - PP;
    }
    if (isL) {
      lowValue = bars[i - PP].low;
      lowIndex = i - PP;
    }
    const close = bars[i].close;
    const pushH = () => push(highValue, highIndex, 'HH', 'LH', 'H');
    const pushL = () => push(lowValue, lowIndex, 'HL', 'LL', 'L');

    if (isH && isL) {
      if (types.length >= 1) {
        const t = last();
        if (t === 'L' || t === 'LL') {
          if (lt(lp, lastValue())) {
            removeLast();
            pushL();
          } else {
            pushH();
          }
        } else if (t === 'H' || t === 'HH') {
          if (gt(hp, lastValue())) {
            removeLast();
            pushH();
          } else {
            pushL();
          }
        } else if (t === 'LH') {
          if (lt(hp, lastValue())) {
            pushL();
          } else if (gt(hp, lastValue())) {
            if (lt(close, lastValue())) {
              removeLast();
              pushH();
            } else if (gt(close, lastValue())) {
              pushL();
            }
          }
        } else if (t === 'HL') {
          if (gt(lp, lastValue())) {
            pushH();
          } else if (lt(lp, lastValue())) {
            if (gt(close, lastValue())) {
              removeLast();
              pushL();
            } else if (lt(close, lastValue())) {
              pushH();
            }
          }
        }
      }
    } else if (isH) {
      if (types.length === 0) {
        types.unshift('H');
        values.unshift(highValue);
        indexes.unshift(highIndex);
      } else {
        const t = last();
        if (t === 'L' || t === 'HL' || t === 'LL') {
          if (gt(hp, lastValue())) {
            pushH();
          } else if (lt(hp, lastValue())) {
            removeLast();
            pushL();
          }
        } else if (t === 'H' || t === 'HH' || t === 'LH') {
          if (lt(values[values.length - 1], highValue)) {
            removeLast();
            pushH();
          }
        }
      }
    } else if (isL) {
      if (types.length === 0) {
        types.unshift('L');
        values.unshift(lowValue);
        indexes.unshift(lowIndex);
      } else {
        const t = last();
        if (t === 'H' || t === 'HH' || t === 'LH') {
          if (lt(lp, lastValue())) {
            pushL();
          } else if (gt(lp, lastValue())) {
            removeLast();
            pushH();
          }
        } else if (t === 'L' || t === 'HL' || t === 'LL') {
          if (gt(values[values.length - 1], lowValue)) {
            removeLast();
            pushL();
          }
        }
      }
    }

    if (types.length > 8) {
      for (let k = 0; k < 8; k++) {
        typePoint[k] = types[types.length - 1 - k];
        pricePoint[k] = values[types.length - 1 - k];
        indexPoint[k] = indexes[types.length - 1 - k];
      }
    }

    const tp = typePoint;
    const pp = pricePoint;
    const newest = indexPoint[0] === i - PP;
    const bearSetup = tp[0] === 'LL' && tp[1] === 'HH' && tp[2] === 'HL' && tp[3] === 'LH' && tp[4] === 'LL'
      && tp[5] === 'LH' && tp[6] === 'LL' && gt(pp[0], pp[4]) && gt(pp[5], pp[1]) && newest;
    const bullSetup = tp[0] === 'HH' && tp[1] === 'LL' && tp[2] === 'LH' && tp[3] === 'HL' && tp[4] === 'HH'
      && tp[5] === 'HL' && tp[6] === 'HH' && gt(pp[4], pp[0]) && gt(pp[1], pp[5]) && newest;
    // Candles of points 1 and 5 (open[bar_index - IndexPoint] ...); 0 when there is no setup
    const p1 = bars[indexPoint[1]];
    const p5 = bars[indexPoint[5]];
    const bear = bearSetup && le(p5.low, p1.high);
    const bull = bullSetup && le(p1.low, p5.high);

    // plotshape(..., offset = -PP): drawn on the pivot bar
    if (bear && i - PP >= 0) {
      markers.push({
        id: 'shape0', time: bars[i - PP].time, position: 'belowBar', shape: 'arrowUp', color: BEAR_COLOR,
        text: 'Bear Setup04', textColor: BEAR_TEXT,
      });
    }
    if (bull && i - PP >= 0) {
      markers.push({
        id: 'shape1', time: bars[i - PP].time, position: 'aboveBar', shape: 'arrowDown', color: BULL_COLOR,
        text: 'Bull Setup04', textColor: BULL_COLOR,
      });
    }

    const zone = (left: number, right: number, c: Bar, bg: string, text: string) => {
      box.new(left, c.high, right, c.low, BORDER, 1, 'solid', 'none', 'bar_index', bg, text, 'tiny', TEXT,
        'center', 'center');
    };
    if (bear) {
      zone(indexPoint[5], i + (i - indexPoint[5]), p5, HTF_BG, 'Supply OB');
      zone(indexPoint[1], i + 20, p1, SUPPLY_LTF_BG, 'Supply OB LTF');
    }
    if (bull) {
      zone(indexPoint[5], i + (i - indexPoint[5]), p5, HTF_BG, 'Demand OB');
      zone(indexPoint[1], i + 20, p1, DEMAND_LTF_BG, 'Demand OB LTF');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
  };
}

export const SmartMoneySetup01 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
};
