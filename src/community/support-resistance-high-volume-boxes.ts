/**
 * Support and Resistance (High Volume Boxes) [ChartPrime]
 *
 * The delta volume of a bar is its volume, positive on an up bar and negative on a down bar (a bar with
 * close = open keeps the last direction). A pivot low of the close with a delta volume above the highest of
 * delta / 2.5 over `volLen` bars makes a support box, from the pivot price down by ATR(200) * `boxWidth`. A pivot
 * high with a delta volume below the lowest of delta / 2.5 makes a resistance box, from the pivot price up by the
 * same width. The box colour is a gradient of the delta volume against its 25-bar extreme; the box text is the delta
 * volume. Only the latest support box and the latest resistance box follow the price to the right.
 * A support box turns red and dashed when the high crosses under its bottom, and back when the low crosses over its
 * top; a resistance box turns green and dashed when the low crosses over its top, and back when the high crosses
 * under its level. Diamonds mark the holds and the retests (drawn one bar back); "Break Sup" / "Break Res" labels
 * mark the first break of a level.
 *
 * The Pine script uses chart.fg_color for the box and label texts. A port has no chart theme: the colour is #DBDBDB,
 * the value of the reference runs (dark theme).
 * The Pine script keeps at most 50 boxes and 50 labels (the oldest are deleted).
 *
 * Reference: "Support and Resistance (High Volume Boxes) [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import { ta, Series, color, str, math, callsite, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BoxData, LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface SupportResistanceHighVolumeBoxesInputs {
  /** Pivot length (left and right) */
  lookbackPeriod: number;
  /** Window of the delta volume filter */
  volLen: number;
  /** Box width, in ATR(200) */
  boxWidth: number;
}

export const defaultInputs: SupportResistanceHighVolumeBoxesInputs = {
  lookbackPeriod: 20,
  volLen: 2,
  boxWidth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Lookback Period', defval: 20, min: 1, group: 'Settings' },
  { id: 'volLen', type: 'int', title: 'Delta Volume Filter Length', defval: 2, group: 'Settings',
    tooltip: 'Higher input, will filter low volume boxes' },
  { id: 'boxWidth', type: 'float', title: 'Adjust Box Width', defval: 1, min: 0, max: 1000, step: 0.1 },
];

// No plot(): the outputs are boxes, labels and plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support and Resistance (High Volume Boxes) [ChartPrime]',
  shortTitle: 'SR Breaks and Retests [ChartPrime]',
  overlay: true,
};

// Pine v5 colour constants
const GREEN = '#4CAF50';
const RED = '#FF5252';
/** chart.fg_color of the reference runs (dark theme) */
const CHART_FG = '#DBDBDB';
// indicator(..., max_boxes_count = 50); labels: default 50
const MAX_BOXES = 50;
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** A box as the script holds it: x in bar indexes */
interface BoxObj {
  left: number; top: number; right: number; bottom: number;
  bgColor: string; borderColor: string; borderStyle: 'solid' | 'dashed'; text: string; deleted: boolean;
}
interface LabelObj { x: number; y: number; text: string; style: 'label_up' | 'label_down'; color: string }

/** Pine drawing limit: when a creation brings the count above max + 5, the oldest are deleted until max remain. */
function register<T>(list: T[], obj: T, max: number, onDelete?: (o: T) => void): void {
  list.push(obj);
  if (list.length > max + 5) {
    const removed = list.splice(0, list.length - max);
    if (onDelete) removed.forEach(onDelete);
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceHighVolumeBoxesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lookback = Math.trunc(cfg.lookbackPeriod);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // upAndDownVolume(): var isBuyVolume = true; close > open -> true, close < open -> false
  const vol: number[] = new Array(n);
  let isBuyVolume = true;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (gt(b.close, b.open)) isBuyVolume = true;
    else if (lt(b.close, b.open)) isBuyVolume = false;
    const v = b.volume ?? NaN;
    vol[i] = isBuyVolume ? 0 + v : 0 - v;
  }
  const volScaled = S(vol.map((v) => v / 2.5));
  const volHi = A(ta.highest(volScaled, cfg.volLen));
  const volLo = A(ta.lowest(volScaled, cfg.volLen));

  const closeSeries = new Series(bars, (b) => b.close);
  const pivotHigh = A(ta.pivothigh(closeSeries, lookback, lookback));
  const pivotLow = A(ta.pivotlow(closeSeries, lookback, lookback));
  const atr = A(ta.atr(bars, 200));

  // ta.highest(Vol, 25) / ta.lowest(Vol, 25) inside the `if` blocks: one site per Pine call
  const volHighest25 = callsite.highest();
  const volLowest25 = callsite.lowest();
  // ta.crossover / ta.crossunder: one site per Pine call
  const brekoutResSite = callsite.crossover();
  const resHoldsSite = callsite.crossunder();
  const supHoldsSite = callsite.crossover();
  const brekoutSupSite = callsite.crossunder();

  const boxObjs: BoxObj[] = [];
  const labelObjs: LabelObj[] = [];
  const markers: MarkerData[] = [];

  // var state of calcSupportResistance
  let supportLevel = NaN, supportLevel1 = NaN, resistanceLevel = NaN, resistanceLevel1 = NaN;
  let sup: BoxObj | null = null;
  let res: BoxObj | null = null;
  let supColor = 'transparent'; // var color sup_color = na
  let resColor = 'transparent';
  // var bool res_is_sup = na, sup_is_res = na (na reads as false)
  let resIsSup = false, supIsRes = false;
  const live = (b: BoxObj | null): b is BoxObj => b !== null && !b.deleted;
  const volText = (v: number) => 'Vol: ' + str.tostring(math.round(v, 2));
  const supGreen30 = String(color.new(GREEN, 30));
  const resRed30 = String(color.new(RED, 30));
  const red80 = String(color.new(RED, 80));
  const green80 = String(color.new(GREEN, 80));

  for (let i = 0; i < n; i++) {
    const { high, low } = bars[i];
    const v = vol[i];
    const withd = atr[i] * cfg.boxWidth;
    const prevSupportLevel = supportLevel; // supportLevel[1]
    const prevResistanceLevel = resistanceLevel; // resistanceLevel[1]

    // Support levels with positive volume
    if (!isNaN(pivotLow[i]) && gt(v, volHi[i])) {
      supportLevel = pivotLow[i];
      supportLevel1 = supportLevel - withd;
      // color.from_gradient(Vol, 0, ta.highest(Vol, 25), color(na), color.new(color.green, 30))
      supColor = String(color.from_gradient(v, 0, volHighest25(v, 25), null as unknown as string, supGreen30));
      sup = { left: i - lookback, top: supportLevel, right: i, bottom: supportLevel1, bgColor: supColor,
        borderColor: GREEN, borderStyle: 'solid', text: volText(v), deleted: false };
      register(boxObjs, sup, MAX_BOXES, (o) => { o.deleted = true; });
    }
    // Resistance levels with negative volume
    if (!isNaN(pivotHigh[i]) && lt(v, volLo[i])) {
      resistanceLevel = pivotHigh[i];
      resistanceLevel1 = resistanceLevel + withd;
      // color.from_gradient(Vol, ta.lowest(Vol, 25), 0, color.new(color.red, 30), color(na))
      resColor = String(color.from_gradient(v, volLowest25(v, 25), 0, resRed30, null as unknown as string));
      res = { left: i - lookback, top: resistanceLevel, right: i, bottom: resistanceLevel1, bgColor: resColor,
        borderColor: RED, borderStyle: 'solid', text: volText(v), deleted: false };
      register(boxObjs, res, MAX_BOXES, (o) => { o.deleted = true; });
    }

    // Adaptive box length
    if (live(sup)) sup.right = i + 1;
    if (live(res)) res.right = i + 1;

    // Breaks and holds
    const brekoutRes = brekoutResSite(low, resistanceLevel1);
    const resHolds = resHoldsSite(high, resistanceLevel);
    const supHolds = supHoldsSite(low, supportLevel);
    const brekoutSup = brekoutSupSite(high, supportLevel1);

    if (brekoutSup && live(sup)) {
      sup.bgColor = red80;
      sup.borderColor = RED;
      sup.borderStyle = 'dashed';
    }
    if (supHolds && live(sup)) {
      sup.bgColor = supColor;
      sup.borderColor = GREEN;
      sup.borderStyle = 'solid';
    }
    if (brekoutRes && live(res)) {
      res.bgColor = green80;
      res.borderColor = GREEN;
      res.borderStyle = 'dashed';
    }
    if (resHolds && live(res)) {
      res.bgColor = resColor;
      res.borderColor = RED;
      res.borderStyle = 'solid';
    }

    // Resistance became support / support became resistance
    const prevResIsSup = resIsSup; // res_is_sup[1]
    const prevSupIsRes = supIsRes; // sup_is_res[1]
    if (brekoutRes) resIsSup = true;
    else if (resHolds) resIsSup = false;
    if (brekoutSup) supIsRes = true;
    else if (supHolds) supIsRes = false;

    // plotchar(..., "◆", size = size.tiny, offset = -1): drawn on the previous bar
    if (i > 0) {
      const t1 = bars[i - 1].time;
      const diamond = (position: 'aboveBar' | 'belowBar', col: string) => markers.push({
        time: t1, position, shape: 'circle', color: 'transparent', text: '◆', textColor: col, size: 'tiny',
      });
      if (resHolds) diamond('aboveBar', '#e92929'); // Resistance Holds
      if (supHolds) diamond('belowBar', '#20ca26'); // Support Holds
      if (brekoutRes && prevResIsSup) diamond('belowBar', '#20ca26'); // Resistance as Support Holds
      if (brekoutSup && prevSupIsRes) diamond('aboveBar', '#e92929'); // Support as Resistance Holds
    }

    // Break labels: label.new(bar_index[1], level[1], ...)
    if (brekoutSup && !prevSupIsRes) {
      register(labelObjs, { x: i > 0 ? i - 1 : NaN, y: prevSupportLevel, text: 'Break Sup', style: 'label_down',
        color: '#7e1e1e' }, MAX_LABELS);
    }
    if (brekoutRes && !prevResIsSup) {
      register(labelObjs, { x: i > 0 ? i - 1 : NaN, y: prevResistanceLevel, text: 'Break Res', style: 'label_up',
        color: '#2b6d2d' }, MAX_LABELS);
    }
  }

  // Output: a drawing with an na coordinate is not drawn
  const interval = barInterval(bars);
  const tm = (x: number) => barTime(bars, x, interval);
  const boxes: BoxData[] = [];
  for (const b of boxObjs) {
    if (isNaN(b.top) || isNaN(b.bottom) || b.left < 0) continue;
    const out: BoxData = { time1: tm(b.left), price1: b.top, time2: tm(b.right), price2: b.bottom, bgColor: b.bgColor,
      borderColor: b.borderColor, borderWidth: 1, text: b.text, textColor: CHART_FG, textSize: 'small' };
    if (b.borderStyle !== 'solid') out.borderStyle = b.borderStyle;
    boxes.push(out);
  }
  const labels: LabelData[] = [];
  for (const l of labelObjs) {
    if (isNaN(l.x) || isNaN(l.y)) continue;
    labels.push({ time: tm(l.x), price: l.y, text: l.text, color: l.color, style: l.style, textColor: CHART_FG,
      size: 'small' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    boxes,
    labels,
  };
}

export const SupportResistanceHighVolumeBoxes = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
