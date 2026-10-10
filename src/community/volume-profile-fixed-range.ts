/**
 * Volume Profile / Fixed Range
 *
 * Volume profile of the last "Number of Bars" bars, drawn on the last bar. The price range of these bars is cut
 * into "Row Size" rows. The volume of each candle is shared between its body and its wicks (a wick counts twice in
 * the weights) and given to the rows they cross; the body volume goes to the up side of an up candle and to the down
 * side of a down candle, the wick volume is split half and half. Each row is drawn with two boxes from the left of
 * the range: up volume, then down volume. The row with the largest volume is the point of control (POC): a line
 * extended to the right and a label. The value area is grown from the POC row, towards the larger neighbour row,
 * until it holds "Value Area Volume %" of the volume; its rows use the value area colours.
 *
 * These are the drawings of the last bar: they move when a bar is added. Nothing is drawn with fewer bars than
 * "Number of Bars".
 * The POC label rounds the price to the tick of the symbol; the port has no symbol information and uses a tick of
 * 0.01.
 *
 * Reference: "Volume Profile / Fixed Range" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { array, compare, math, str, nz, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData } from '../types';
import { barTime } from '../bar-time';

export interface VolumeProfileFixedRangeInputs {
  /** Number of Bars */
  bbars: number;
  /** Row Size */
  cnum: number;
  /** Value Area Volume % */
  percent: number;
  pocColor: string;
  pocWidth: number;
  vupColor: string;
  vdownColor: string;
  upColor: string;
  downColor: string;
  /** Show POC Label */
  showPoc: boolean;
}

// Pine v5 colours as input defaults: color.new(color.blue, 30) = #2962FF with alpha 0.7,
// color.new(color.orange, 30) = #FF9800 with alpha 0.7, transparency 75 = alpha 0.25
export const defaultInputs: VolumeProfileFixedRangeInputs = {
  bbars: 150,
  cnum: 24,
  percent: 70,
  pocColor: '#ff0000',
  pocWidth: 2,
  vupColor: 'rgba(41,98,255,0.7)',
  vdownColor: 'rgba(255,152,0,0.7)',
  upColor: 'rgba(41,98,255,0.25)',
  downColor: 'rgba(255,152,0,0.25)',
  showPoc: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbars', type: 'int', title: 'Number of Bars', defval: 150, min: 1, max: 500 },
  { id: 'cnum', type: 'int', title: 'Row Size', defval: 24, min: 5, max: 100 },
  { id: 'percent', type: 'float', title: 'Value Area Volume %', defval: 70, min: 0, max: 100 },
  { id: 'pocColor', type: 'color', title: 'POC Color', defval: '#ff0000', inline: 'poc' },
  { id: 'pocWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 5, inline: 'poc' },
  { id: 'vupColor', type: 'color', title: 'Value Area Up', defval: 'rgba(41,98,255,0.7)' },
  { id: 'vdownColor', type: 'color', title: 'Value Area Down', defval: 'rgba(255,152,0,0.7)' },
  { id: 'upColor', type: 'color', title: 'UP Volume', defval: 'rgba(41,98,255,0.25)' },
  { id: 'downColor', type: 'color', title: 'Down Volume', defval: 'rgba(255,152,0,0.25)' },
  { id: 'showPoc', type: 'bool', title: 'Show POC Label', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Profile / Fixed Range',
  shortTitle: 'Volume Profile / Fixed Range',
  overlay: true,
};

/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;
/** Default label text colour of the original Pine version (color.black of Pine v5) */
const LABEL_TEXT = '#363A45';

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** Pine array.get / array.set: an index outside the array is a runtime error */
function check(arr: number[], i: number): number {
  if (!(i >= 0 && i < arr.length)) throw new Error(`Index ${i} is out of bounds, array size is ${arr.length}`);
  return i;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfileFixedRangeInputs> = {},
): IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { bbars, cnum, percent } = cfg;
  const n = bars.length;
  const boxes: BoxData[] = [];
  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    lines,
    labels,
  });
  if (n === 0) return result();

  // if barstate.islast
  const last = n - 1;
  // x[k] on the last bar (na before the first bar)
  const bar = (k: number): Bar | undefined => (last - k >= 0 ? bars[last - k] : undefined);

  // top = ta.highest(bbars), bot = ta.lowest(bbars): na with fewer than bbars bars
  let top = NaN;
  let bot = NaN;
  if (n >= bbars) {
    top = -Infinity;
    bot = Infinity;
    for (let k = 0; k < bbars; k++) {
      top = Math.max(top, bars[last - k].high);
      bot = Math.min(bot, bars[last - k].low);
    }
  }
  const dist = (top - bot) / 500;
  const step = (top - bot) / cnum;

  // calculate/keep channel levels
  const levels: number[] = new Array(cnum + 1).fill(NaN);
  for (const x of pineRange(0, cnum)) levels[check(levels, x)] = bot + step * x;
  const level = (x: number) => levels[check(levels, x)];

  // get the volume if there is intersection
  const getVol = (y11: number, y12: number, y21: number, y22: number, height: number, vol: number) =>
    nz((Math.max(Math.min(Math.max(y11, y12), Math.max(y21, y22)) - Math.max(Math.min(y11, y12), Math.min(y21, y22)), 0) * vol) / height);

  // calculate/get volume for each channel and candle
  const volumes: number[] = new Array(cnum * 2).fill(0);
  for (const k of pineRange(0, bbars - 1)) {
    const b = bar(k);
    const open = b ? b.open : NaN;
    const high = b ? b.high : NaN;
    const low = b ? b.low : NaN;
    const close = b ? b.close : NaN;
    const volume = b ? (b.volume ?? NaN) : NaN;
    const bodyTop = Math.max(close, open);
    const bodyBot = Math.min(close, open);
    const itsgreen = compare.ge(close, open);

    const topwick = high - bodyTop;
    const bottomwick = bodyBot - low;
    const body = bodyTop - bodyBot;

    const bodyvol = (body * volume) / (2 * topwick + 2 * bottomwick + body);
    const topwickvol = (2 * topwick * volume) / (2 * topwick + 2 * bottomwick + body);
    const bottomwickvol = (2 * bottomwick * volume) / (2 * topwick + 2 * bottomwick + body);
    for (const x of pineRange(0, cnum - 1)) {
      const l0 = level(x);
      const l1 = level(x + 1);
      volumes[check(volumes, x)] = volumes[x]
        + (itsgreen ? getVol(l0, l1, bodyBot, bodyTop, body, bodyvol) : 0)
        + getVol(l0, l1, bodyTop, high, topwick, topwickvol) / 2
        + getVol(l0, l1, bodyBot, low, bottomwick, bottomwickvol) / 2;
      volumes[check(volumes, x + cnum)] = volumes[x + cnum]
        + (itsgreen ? 0 : getVol(l0, l1, bodyBot, bodyTop, body, bodyvol))
        + getVol(l0, l1, bodyTop, high, topwick, topwickvol) / 2
        + getVol(l0, l1, bodyBot, low, bottomwick, bottomwickvol) / 2;
    }
  }

  const totalvols: number[] = new Array(cnum).fill(0);
  for (const x of pineRange(0, cnum - 1)) totalvols[check(totalvols, x)] = volumes[check(volumes, x)] + volumes[check(volumes, x + cnum)];

  const poc = array.indexof(totalvols, array.max(totalvols));

  // calculate value area
  const totalmax = (array.sum(totalvols) * percent) / 100;
  let vaTotal = totalvols[check(totalvols, poc)];
  let up = poc;
  let down = poc;
  for (let x = 0; x <= cnum - 1; x++) {
    if (compare.ge(vaTotal, totalmax)) break;
    const uppervol = up < cnum - 1 ? totalvols[check(totalvols, up + 1)] : 0;
    const lowervol = down > 0 ? totalvols[check(totalvols, down - 1)] : 0;
    if (compare.eq(uppervol, 0) && compare.eq(lowervol, 0)) break;
    if (compare.ge(uppervol, lowervol)) {
      vaTotal += uppervol;
      up += 1;
    } else {
      vaTotal += lowervol;
      down -= 1;
    }
  }

  const maxvol = array.max(totalvols);
  for (const x of pineRange(0, cnum * 2 - 1)) volumes[check(volumes, x)] = (volumes[x] * bbars) / (3 * maxvol);

  // Draw VP rows: an object with an na coordinate is not drawn
  const left = last - bbars + 1;
  const addBox = (x1: number, topPrice: number, x2: number, bottomPrice: number, bgColor: string) => {
    if (![x1, topPrice, x2, bottomPrice].every(Number.isFinite) || x1 < 0 || x2 < 0) return;
    // box.new(..., border_width = 0, bgcolor = ...)
    boxes.push({ time1: barTime(bars, x1), price1: topPrice, time2: barTime(bars, x2), price2: bottomPrice, borderWidth: 0, bgColor });
  };
  for (const x of pineRange(0, cnum - 1)) {
    const inArea = x >= down && x <= up;
    const upLen = math.round(volumes[check(volumes, x)]);
    const downLen = math.round(volumes[check(volumes, x + cnum)]);
    addBox(left, level(x + 1) - dist, left + upLen, level(x) + dist, inArea ? cfg.vupColor : cfg.upColor);
    addBox(left + upLen, level(x + 1) - dist, left + upLen + downLen, level(x) + dist, inArea ? cfg.vdownColor : cfg.downColor);
  }

  // Draw POC line and label
  const pocLevel = (level(poc) + level(poc + 1)) / 2;
  if (Number.isFinite(pocLevel) && left >= 0) {
    // line.new(bar_index - bbars + 1, poc_level, bar_index - bbars + 2, poc_level, extend = extend.right,
    //   color = poc_color, width = poc_width)
    lines.push({
      time1: barTime(bars, left), price1: pocLevel, time2: barTime(bars, left + 1), price2: pocLevel,
      color: cfg.pocColor, width: cfg.pocWidth, extend: 'right',
    });
  }
  if (cfg.showPoc && Number.isFinite(pocLevel)) {
    // label.new(bar_index + 15, poc_level, text = "POC: " + str.tostring(math.round_to_mintick(poc_level)),
    //   style = close >= poc_level ? label.style_label_up : label.style_label_down)
    labels.push({
      time: barTime(bars, last + 15),
      price: pocLevel,
      text: 'POC: ' + str.tostring(math.round_to_mintick(pocLevel, MINTICK)),
      style: compare.ge(bars[last].close, pocLevel) ? 'label_up' : 'label_down',
      textColor: LABEL_TEXT,
    });
  }

  return result();
}

export const VolumeProfileFixedRange = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
