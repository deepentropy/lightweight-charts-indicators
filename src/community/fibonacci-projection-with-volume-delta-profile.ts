/**
 * Fibonacci Projection with Volume & Delta Profile (Zeiierman)
 *
 * The swing high is the last bar whose high is the highest high of 'Period' bars, the swing low the last bar whose
 * low is the lowest low of 'Period' bars. Everything is drawn again on each bar, so the result is the drawing of
 * the last bar:
 * - a line at the swing high and one at the swing low, from the swing bar to the last bar;
 * - five retracement lines (23.6 % to 78.6 % of the swing range, counted from the newest swing) from the newest
 *   swing bar to the last bar, with optional labels;
 * - a projection of three segments after the last bar, each as long as the distance in bars between the two swings
 *   (125 bars at most): from the newest swing price to the 'Projection Level' retracement, then the same share
 *   back, then to the 1.272 extension. Each segment has a box around its end (a tenth of the move high) with the
 *   level as text, and a label with the move in percent at its middle;
 * - the volume profile of the bars between the two swings: 'Rows' price rows between the swing prices, the volume of
 *   a bar goes to the row of its (high + low + close) / 3, as up volume when close > open, else as down volume. Each
 *   row is drawn from the older swing bar, the down volume first (or the up volume first with 'Flip Bull/Bear');
 *   the widest row is as wide as the distance between the swings;
 * - with 'Fib Volume Delta': the up volume less the down volume of the same bars in each band between two
 *   retracement prices, as a box to the left of the older swing bar ('Max Width' bars for the largest).
 * When the same bar is the swing high and the swing low the two profiles are not drawn again: those of the last bar
 * where the swings were two different bars stay.
 *
 * Box count: the script keeps the default limit of 50 boxes (when a creation brings the count above 55 the oldest
 * boxes are deleted until 50 remain), so with many rows part of the boxes is missing, as in the original.
 *
 * Reference: "Fibonacci Projection with Volume & Delta Profile (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { color, math, str, barTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, PineSize } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type SizeName = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';

export interface FibonacciProjectionWithVolumeDeltaProfileInputs {
  /** Period: bars of the highest high / lowest low that make a swing */
  prd: number;
  /** Projection Level */
  lvl: number;
  fibColor236: string;
  fibColor382: string;
  fibColor500: string;
  fibColor618: string;
  fibColor786: string;
  /** Fib Line Width */
  fibLineWidth: number;
  /** Fib Labels */
  showlab: boolean;
  fibLabelColor: string;
  fibLabelSizeStr: SizeName;
  /** Low Line */
  loLineColor: string;
  /** High Line */
  hiLineColor: string;
  hiloLineWidth: number;
  /** Fib Volume Profile */
  showFibProfile: boolean;
  rows: number;
  /** Flip Bull/Bear */
  flipOrder: boolean;
  bullColor: string;
  bearColor: string;
  /** Fib Volume Delta */
  showFibDelta: boolean;
  deltaMaxWidth: number;
  deltaBullColor: string;
  deltaBearColor: string;
  projLineBullColor: string;
  projLineBearColor: string;
  projLineWidth: number;
  projLineStyleStr: 'Solid' | 'Dashed' | 'Dotted' | 'Arrow Left' | 'Arrow Right';
  projPercBullColor: string;
  projPercBearColor: string;
  projPercTextColor: string;
  projPercLabelSizeStr: SizeName;
  projBoxBgOn: boolean;
  projBoxBgColor: string;
  projBoxBorderOn: boolean;
  projBoxBorderCol: string;
  projBoxBorderW: number;
  projBoxBorderStyleStr: 'Solid' | 'Dashed' | 'Dotted';
  projBoxTextHAlignStr: 'Left' | 'Center' | 'Right';
  projBoxTextVAlignStr: 'Top' | 'Center' | 'Bottom';
  projBoxTextColor: string;
  projBoxTextSizeStr: SizeName;
}

export const defaultInputs: FibonacciProjectionWithVolumeDeltaProfileInputs = {
  prd: 100,
  lvl: 0.618,
  fibColor236: '#f23645',
  fibColor382: '#81c784',
  fibColor500: '#4caf50',
  fibColor618: '#089981',
  fibColor786: '#64b5f6',
  fibLineWidth: 2,
  showlab: false,
  fibLabelColor: '#FFFFFF',
  fibLabelSizeStr: 'Small',
  loLineColor: '#4CAF50',
  hiLineColor: '#F23645',
  hiloLineWidth: 2,
  showFibProfile: true,
  rows: 10,
  flipOrder: false,
  bullColor: '#089981B3',
  bearColor: '#FF9800B3',
  showFibDelta: false,
  deltaMaxWidth: 30,
  deltaBullColor: '#00E67633',
  deltaBearColor: '#F2364533',
  projLineBullColor: '#4CAF50',
  projLineBearColor: '#F23645',
  projLineWidth: 2,
  projLineStyleStr: 'Arrow Right',
  projPercBullColor: '#4CAF50',
  projPercBearColor: '#F23645',
  projPercTextColor: '#FFFFFF',
  projPercLabelSizeStr: 'Small',
  projBoxBgOn: true,
  projBoxBgColor: '#2962FF33',
  projBoxBorderOn: true,
  projBoxBorderCol: '#FFFFFF',
  projBoxBorderW: 1,
  projBoxBorderStyleStr: 'Solid',
  projBoxTextHAlignStr: 'Center',
  projBoxTextVAlignStr: 'Center',
  projBoxTextColor: '#FFFFFF',
  projBoxTextSizeStr: 'Normal',
};

const SIZES: SizeName[] = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];
const FIB_TIP = '0.236 Color:\nLine and label color for the 23.6% Fibonacci retracement level.\n\n'
  + '0.382 Color:\nLine and label color for the 38.2% Fibonacci retracement level.\n\n'
  + '0.500 Color:\nLine and label color for the 50.0% Fibonacci retracement level.\n\n'
  + '0.618 Color:\nLine and label color for the 61.8% Fibonacci retracement level.\n\n'
  + '0.786 Color:\nLine and label color for the 78.6% Fibonacci retracement level.\n\n'
  + 'Fib Line Width:\nThickness of all horizontal Fibonacci retracement lines.';

export const inputConfig: InputConfig[] = [
  {
    id: 'prd', type: 'int', title: 'Period', defval: 100, group: 'Fib Settings', inline: 'fibColor',
    tooltip: 'Period:\nNumber of bars used to detect swing highs and swing lows. Larger values give fewer but larger swings.',
  },
  {
    id: 'lvl', type: 'float', title: 'Projection Level', defval: 0.618, options: ['0.236', '0.382', '0.5', '0.618', '0.786'], group: 'Fib Settings',
    tooltip: 'Projection Level:\nFibonacci ratio used to calculate the projected future swing targets (e.g. 61.8%).',
  },
  { id: 'fibColor236', type: 'color', title: '0.236', defval: '#f23645', group: 'Fib Levels Style', inline: 'fibColor' },
  { id: 'fibColor382', type: 'color', title: '0.382', defval: '#81c784', group: 'Fib Levels Style', inline: 'fibColor' },
  { id: 'fibColor500', type: 'color', title: '0.500', defval: '#4caf50', group: 'Fib Levels Style', inline: 'fibColor' },
  { id: 'fibColor618', type: 'color', title: '0.618', defval: '#089981', group: 'Fib Levels Style', inline: 'fibColor' },
  { id: 'fibColor786', type: 'color', title: '0.786', defval: '#64b5f6', group: 'Fib Levels Style', inline: 'fibColor' },
  {
    id: 'fibLineWidth', type: 'int', title: 'Fib Line Width', defval: 2, min: 1, max: 5, group: 'Fib Levels Style', inline: 'fibColor',
    tooltip: FIB_TIP,
  },
  { id: 'showlab', type: 'bool', title: 'Fib Labels', defval: false, group: 'Fib Levels Style', inline: 'fiblab' },
  { id: 'fibLabelColor', type: 'color', title: '', defval: '#FFFFFF', group: 'Fib Levels Style', inline: 'fiblab' },
  {
    id: 'fibLabelSizeStr', type: 'string', title: '', defval: 'Small', options: SIZES, group: 'Fib Levels Style', inline: 'fiblab',
    tooltip: 'Fib Labels:\nShow or hide percentage labels at each Fibonacci retracement line.\n\n'
      + 'Fib Label Text Color:\nText color of Fibonacci retracement labels.\n\n'
      + 'Fib Label Size:\nFont size of Fibonacci retracement labels.',
  },
  { id: 'loLineColor', type: 'color', title: 'Low Line', defval: '#4CAF50', group: 'Swing High/Low Lines Style', inline: 'hi' },
  { id: 'hiLineColor', type: 'color', title: 'High Line', defval: '#F23645', group: 'Swing High/Low Lines Style', inline: 'hi' },
  {
    id: 'hiloLineWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 5, group: 'Swing High/Low Lines Style', inline: 'hi',
    tooltip: 'Low Line Color:\nColor for the most recent swing low horizontal guide line.\n\n'
      + 'High Line Color:\nColor for the most recent swing high horizontal guide line.\n\n'
      + 'Swing Line Width:\nThickness of both swing high and swing low guide lines.',
  },
  { id: 'showFibProfile', type: 'bool', title: 'Fib Volume Profile', defval: true, group: 'Fib Volume Profile', inline: 'fibprof' },
  { id: 'rows', type: 'int', title: 'Rows', defval: 10, min: 2, max: 100, group: 'Fib Volume Profile', inline: 'fibprof' },
  {
    id: 'flipOrder', type: 'bool', title: 'Flip Bull/Bear', defval: false, group: 'Fib Volume Profile', inline: 'fibprof',
    tooltip: 'Fib Volume Profile:\nEnable or disable the main volume profile drawn between the last swing high and low.\n\n'
      + 'Rows:\nNumber of price rows (bins) used in the Fib volume profile. More rows = finer detail.\n\n'
      + 'Flip Bull/Bear:\nSwap the horizontal position of bullish and bearish volume bars in the profile.',
  },
  { id: 'bullColor', type: 'color', title: 'Bull', defval: '#089981B3', group: 'Fib Volume Profile', inline: 'volColor' },
  {
    id: 'bearColor', type: 'color', title: 'Bear', defval: '#FF9800B3', group: 'Fib Volume Profile', inline: 'volColor',
    tooltip: 'Bull Volume Color:\nBase color used for bullish (up-bar) volume in the Fib volume profile.\n\n'
      + 'Bear Volume Color:\nBase color used for bearish (down-bar) volume in the Fib volume profile.',
  },
  { id: 'showFibDelta', type: 'bool', title: 'Fib Volume Delta', defval: false, group: 'Fib Volume Delta Profile', inline: 'delta' },
  {
    id: 'deltaMaxWidth', type: 'int', title: 'Max Width', defval: 30, min: 5, max: 200, group: 'Fib Volume Delta Profile', inline: 'delta',
    tooltip: 'Fib Volume Delta:\nEnable or disable the separate volume delta profile between Fibonacci price bands.\n\n'
      + 'Delta Max Width:\nMaximum horizontal width (in bars) used to scale delta boxes from smallest to largest.',
  },
  { id: 'deltaBullColor', type: 'color', title: 'Bullish Delta', defval: '#00E67633', group: 'Fib Volume Delta Profile', inline: 'deltaColor' },
  {
    id: 'deltaBearColor', type: 'color', title: 'Bearish Delta', defval: '#F2364533', group: 'Fib Volume Delta Profile', inline: 'deltaColor',
    tooltip: 'Bullish Delta Color:\nFill color for bands where bullish volume exceeds bearish volume (positive delta).\n\n'
      + 'Bearish Delta Color:\nFill color for bands where bearish volume exceeds bullish volume (negative delta).',
  },
  { id: 'projLineBullColor', type: 'color', title: 'Bullish', defval: '#4CAF50', group: 'Projection Lines Style', inline: 'plc' },
  { id: 'projLineBearColor', type: 'color', title: 'Bearish', defval: '#F23645', group: 'Projection Lines Style', inline: 'plc' },
  { id: 'projLineWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 5, group: 'Projection Lines Style', inline: 'plc' },
  {
    id: 'projLineStyleStr', type: 'string', title: '', defval: 'Arrow Right', options: ['Solid', 'Dashed', 'Dotted', 'Arrow Left', 'Arrow Right'],
    group: 'Projection Lines Style', inline: 'plc',
    tooltip: 'Bullish Projection Line Color:\nColor of projected segments when price is projected upward.\n\n'
      + 'Bearish Projection Line Color:\nColor of projected segments when price is projected downward.\n\n'
      + 'Projection Line Width:\nThickness of projected swing segments.\n\n'
      + 'Projection Line Style:\nVisual style of projected lines (solid, dashed, dotted, or arrows).',
  },
  { id: 'projPercBullColor', type: 'color', title: 'Bullish Bg', defval: '#4CAF50', group: 'Projection Labels Style', inline: 'plc' },
  { id: 'projPercBearColor', type: 'color', title: 'Bearish Bg', defval: '#F23645', group: 'Projection Labels Style', inline: 'plc' },
  { id: 'projPercTextColor', type: 'color', title: 'Text', defval: '#FFFFFF', group: 'Projection Labels Style', inline: 'plc' },
  {
    id: 'projPercLabelSizeStr', type: 'string', title: '', defval: 'Small', options: SIZES, group: 'Projection Labels Style', inline: 'plc',
    tooltip: 'Bullish Label Background:\nBackground color for percentage labels on upward projection segments.\n\n'
      + 'Bearish Label Background:\nBackground color for percentage labels on downward projection segments.\n\n'
      + 'Projection Label Text Color:\nText color of projection percentage labels.\n\n'
      + 'Projection Label Size:\nFont size of projection percentage labels.',
  },
  { id: 'projBoxBgOn', type: 'bool', title: 'Background', defval: true, group: 'Projection Box Style', inline: 'pbg' },
  { id: 'projBoxBgColor', type: 'color', title: '', defval: '#2962FF33', group: 'Projection Box Style', inline: 'pbg' },
  { id: 'projBoxBorderOn', type: 'bool', title: 'Border', defval: true, group: 'Projection Box Style', inline: 'pbg' },
  { id: 'projBoxBorderCol', type: 'color', title: '', defval: '#FFFFFF', group: 'Projection Box Style', inline: 'pbg' },
  { id: 'projBoxBorderW', type: 'int', title: '', defval: 1, min: 1, max: 5, group: 'Projection Box Style', inline: 'pbg' },
  {
    id: 'projBoxBorderStyleStr', type: 'string', title: '', defval: 'Solid', options: ['Solid', 'Dashed', 'Dotted'],
    group: 'Projection Box Style', inline: 'pbg',
    tooltip: 'Projection Box Background:\nToggle the background fill of projection boxes on or off.\n\n'
      + 'Projection Box Background Color:\nFill color used for projection boxes (when background is enabled).\n\n'
      + 'Projection Box Border:\nToggle drawing a border around projection boxes.\n\n'
      + 'Projection Box Border Color:\nColor of the border around projection boxes.\n\n'
      + 'Projection Box Border Width:\nThickness of projection box borders.\n\n'
      + 'Projection Box Border Style:\nLine style for projection box borders (solid/dashed/dotted).',
  },
  {
    id: 'projBoxTextHAlignStr', type: 'string', title: 'H Align', defval: 'Center', options: ['Left', 'Center', 'Right'],
    group: 'Projection Box Style', inline: 'ptxt',
  },
  {
    id: 'projBoxTextVAlignStr', type: 'string', title: 'V Align', defval: 'Center', options: ['Top', 'Center', 'Bottom'],
    group: 'Projection Box Style', inline: 'ptxt',
    tooltip: 'Projection Box Horizontal Align:\nHorizontal alignment of text inside projection boxes (left/center/right).\n\n'
      + 'Projection Box Vertical Align:\nVertical alignment of text inside projection boxes (top/center/bottom).',
  },
  { id: 'projBoxTextColor', type: 'color', title: 'Text', defval: '#FFFFFF', group: 'Projection Box Style', inline: 'ptxt2' },
  {
    id: 'projBoxTextSizeStr', type: 'string', title: '', defval: 'Normal', options: SIZES, group: 'Projection Box Style', inline: 'ptxt2',
    tooltip: 'Projection Box Text Color:\nText color for the projection level values shown inside the boxes.\n\n'
      + 'Projection Box Text Size:\nFont size of the projection level values shown inside the boxes.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Fibonacci Projection with Volume & Delta Profile (Zeiierman)',
  shortTitle: 'Fibonacci Projection (Zeiierman)',
  overlay: true,
};

/** Default box limit of indicator(): 50 */
const MAX_BOXES = 50;
const FIB_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];

/** Pine float comparisons: 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

const sizeOf = (name: SizeName): PineSize =>
  (name === 'Tiny' ? 'tiny' : name === 'Small' ? 'small' : name === 'Large' ? 'large' : name === 'Huge' ? 'huge' : 'normal');
const lower = <T extends string>(name: T) => name.toLowerCase() as Lowercase<T>;

/** fibbFunc(v, last, h, l) */
const fibb = (v: number, last: boolean, h: number, l: number) => (last ? h - (h - l) * v : l + (h - l) * v);

/** A box with its bars as bar indexes */
interface BoxObj extends Omit<BoxData, 'time1' | 'time2'> {
  left: number;
  right: number;
}

/**
 * Index of the price band of `price`: the first band r with levels[r] <= price < levels[r + 1], or -1. The bands
 * are searched from an estimate when they are wide enough for it, else one by one.
 */
function bandOf(levels: number[], price: number): number {
  const bands = levels.length - 1;
  const width = (levels[bands] - levels[0]) / bands;
  let from = 0;
  let to = bands - 1;
  if (width > 1e-6 && Number.isFinite(price)) {
    const estimate = Math.floor((price - levels[0]) / width);
    from = Math.max(0, estimate - 2);
    to = Math.min(bands - 1, estimate + 2);
  }
  for (let r = from; r <= to; r++) {
    if (ge(price, levels[r]) && gt(levels[r + 1], price)) return r;
  }
  return -1;
}

type Result = IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[] };

/** A box creation of the script, counted for the box limit: 'area' boxes are the projection boxes (index k) */
type Entry = { kind: 'area' | 'profile' | 'delta'; box: BoxObj | null; k: number };

interface FibVars {
  /** The live boxes when the box limit can be reached (changed in place: copied by copyVars) */
  alive: Entry[];
}

interface FibRun extends BarRunState<FibVars> {
  hiStep: WindowExtreme;
  loStep: WindowExtreme;
  hiBarAt: number[];
  loBarAt: number[];
  /** The last bar up to each bar where the profiles are made again (-1: none) */
  lastRebuild: number[];
}

function study(inputs: Partial<FibonacciProjectionWithVolumeDeltaProfileInputs>): BarStudy<FibRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { prd, rows } = cfg;
  // the level comes from a list of options: a number, or its text
  const lvl = Number(cfg.lvl);
  const fibColors = [cfg.fibColor236, cfg.fibColor382, cfg.fibColor500, cfg.fibColor618, cfg.fibColor786];
  const mostBoxes = 3 + (cfg.showFibProfile ? 2 * rows : 0) + (cfg.showFibDelta ? FIB_LEVELS.length + 1 : 0);
  /** The box limit can be reached: the creations of every bar are counted */
  const limited = mostBoxes > MAX_BOXES + 5;

  // the bars and the swings read by the drawing functions (set by bar() and result())
  let bars: Bar[] = [];
  let hiBarAt: number[] = [];
  let loBarAt: number[] = [];

  /** True on the bars where the script draws (both swings exist) */
  const draws = (i: number) => hiBarAt[i]! >= 0 && loBarAt[i]! >= 0;
  /** The profiles are made again only on the bars where the two swings are different bars */
  const rebuilds = (i: number) => draws(i) && hiBarAt[i] !== loBarAt[i];

  /** Up and down volume of the bars between the swings of bar i, by price band */
  const volumeByBand = (i: number, levels: number[]) => {
    const up: number[] = new Array(levels.length - 1).fill(0);
    const down: number[] = new Array(levels.length - 1).fill(0);
    const startBar = Math.min(hiBarAt[i]!, loBarAt[i]!);
    const endBar = Math.max(hiBarAt[i]!, loBarAt[i]!);
    for (let bi = startBar; bi <= endBar; bi++) {
      const b = bars[bi]!;
      const r = bandOf(levels, (b.high + b.low + b.close) / 3);
      if (r < 0) continue;
      if (gt(b.close, b.open)) up[r] += b.volume ?? NaN;
      else down[r] += b.volume ?? NaN;
    }
    return { up, down, startBar, endBar };
  };

  /** The boxes of the projection of bar i (the script draws them again on every bar) */
  const projection = (i: number): { lines: LineDrawingData[]; boxes: BoxObj[]; labels: LabelData[] } => {
    const hiPrice = bars[hiBarAt[i]!]!.high;
    const loPrice = bars[loBarAt[i]!]!.low;
    const HB = i - hiBarAt[i]!;
    const LB = i - loBarAt[i]!;
    const level = fibb(lvl, LB > HB, hiPrice, loPrice);
    const level2 = LB < HB ? fibb(lvl, true, level, loPrice) : fibb(lvl, false, hiPrice, level);
    const trend = fibb(1.272, LB > HB, hiPrice, loPrice);
    const forecast = [HB < LB ? hiPrice : loPrice, level, level2, trend];
    const segment = Math.min(Math.abs(HB - LB), Math.floor(500.0 / 4.0));
    const out = { lines: [] as LineDrawingData[], boxes: [] as BoxObj[], labels: [] as LabelData[] };
    let future = i;
    for (let k = 0; k <= forecast.length - 2; k++) {
      const x1 = Math.min(future, i + 500);
      const x2 = Math.min(future + segment, i + 500);
      const y1 = forecast[k]!;
      const y2 = forecast[k + 1]!;
      out.lines.push({
        time1: barTime(bars, x1), price1: y1, time2: barTime(bars, x2), price2: y2,
        color: gt(y2, y1) ? cfg.projLineBullColor : cfg.projLineBearColor, width: cfg.projLineWidth,
        style: lower(cfg.projLineStyleStr).replace(' ', '_') as LineDrawingData['style'],
      });
      const quarter = math.round((x1 - x2) / 4.0) as number;
      const boxHeight = Math.abs(y1 - y2) / 10.0;
      out.boxes.push({
        left: x2 - quarter, price1: y2 + boxHeight, right: x2 + quarter, price2: y2 - boxHeight,
        bgColor: cfg.projBoxBgOn ? cfg.projBoxBgColor : String(color.new(cfg.projBoxBgColor, 100)),
        borderColor: cfg.projBoxBorderOn ? cfg.projBoxBorderCol : String(color.new(cfg.projBoxBorderCol, 100)),
        borderStyle: lower(cfg.projBoxBorderStyleStr), borderWidth: cfg.projBoxBorderW,
        text: k === forecast.length - 2 ? '1.272' : str.tostring(lvl * 100, '#.##'),
        textHAlign: lower(cfg.projBoxTextHAlignStr), textVAlign: lower(cfg.projBoxTextVAlignStr),
        textColor: cfg.projBoxTextColor, textSize: sizeOf(cfg.projBoxTextSizeStr),
      });
      // the label at the middle bar of the segment, on the line (line.get_price)
      const change = (y2 - y1) / y1;
      const midX = Math.trunc((x1 + x2) / 2);
      const midY = y1 + ((y2 - y1) * (midX - x1)) / (x2 - x1);
      if (Number.isFinite(midY)) {
        out.labels.push({
          time: barTime(bars, midX), price: midY, text: str.tostring(change * 100, 'percent'),
          color: gt(change, 0) ? cfg.projPercBullColor : cfg.projPercBearColor,
          style: k === 1 ? 'label_lower_right' : 'label_lower_left', textColor: cfg.projPercTextColor,
          size: sizeOf(cfg.projPercLabelSizeStr),
        });
      }
      future += segment;
    }
    return out;
  };

  /** The boxes of the volume profile of bar i */
  const profile = (i: number): BoxObj[] => {
    const hiPrice = bars[hiBarAt[i]!]!.high;
    const loPrice = bars[loBarAt[i]!]!.low;
    const top = Math.max(hiPrice, loPrice);
    const bottom = Math.min(hiPrice, loPrice);
    const out: BoxObj[] = [];
    if (eq(top, bottom)) return out;
    const step = (top - bottom) / rows;
    const levels: number[] = [];
    for (let k = 0; k <= rows; k++) levels.push(bottom + step * k);
    const { up, down, startBar, endBar } = volumeByBand(i, levels);
    let maxTot = 0.0;
    for (let r = 0; r < rows; r++) maxTot = math.max(maxTot, up[r]! + down[r]!) as number;
    const span = endBar - startBar + 1;
    if (!gt(maxTot, 0)) return out;
    for (let r = 0; r < rows; r++) {
      const normUp = eq(up[r]!, 0) ? 0 : Math.trunc((up[r]! / maxTot) * span);
      const normDn = eq(down[r]!, 0) ? 0 : Math.trunc((down[r]! / maxTot) * span);
      const row = (base: string, left: number, right: number): BoxObj => {
        const rowColor = color.from_gradient(r, 0, rows - 1, color.new(base, 80), color.new(base, 10));
        return {
          left, price1: levels[r + 1]!, right, price2: levels[r]!, bgColor: String(rowColor), borderColor: String(color.new(rowColor, 0)),
          borderStyle: 'dotted', textColor: '#FFFFFF',
        };
      };
      if (normUp > 0) {
        out.push(cfg.flipOrder ? row(cfg.bullColor, startBar, startBar + normUp) : row(cfg.bullColor, startBar + normDn, startBar + normDn + normUp));
      }
      if (normDn > 0) {
        out.push(cfg.flipOrder ? row(cfg.bearColor, startBar + normUp, startBar + normUp + normDn) : row(cfg.bearColor, startBar, startBar + normDn));
      }
    }
    return out;
  };

  /** The bands between the retracement prices are not of equal height: searched one by one */
  const volumeByBandPlain = (i: number, levels: number[]) => {
    const bands = levels.length - 1;
    const up: number[] = new Array(bands).fill(0);
    const down: number[] = new Array(bands).fill(0);
    const startBar = Math.min(hiBarAt[i]!, loBarAt[i]!);
    const endBar = Math.max(hiBarAt[i]!, loBarAt[i]!);
    for (let bi = startBar; bi <= endBar; bi++) {
      const b = bars[bi]!;
      const price = (b.high + b.low + b.close) / 3;
      for (let r = 0; r < bands; r++) {
        if (ge(price, levels[r]!) && gt(levels[r + 1]!, price)) {
          if (gt(b.close, b.open)) up[r] += b.volume ?? NaN;
          else down[r] += b.volume ?? NaN;
          break;
        }
      }
    }
    return { up, down, startBar };
  };

  /** The boxes of the volume delta of bar i, one per band between two retracement prices */
  const deltaProfile = (i: number): BoxObj[] => {
    const hiPrice = bars[hiBarAt[i]!]!.high;
    const loPrice = bars[loBarAt[i]!]!.low;
    const last = i - hiBarAt[i]! < i - loBarAt[i]!;
    const sorted = [hiPrice, ...FIB_LEVELS.map((e) => fibb(e, last, hiPrice, loPrice)), loPrice].sort((a, b) => a - b);
    const bands = sorted.length - 1;
    const { up, down, startBar } = volumeByBandPlain(i, sorted);
    const out: BoxObj[] = [];
    let maxAbsDelta = 0.0;
    for (let b = 0; b < bands; b++) maxAbsDelta = math.max(maxAbsDelta, Math.abs(up[b]! - down[b]!)) as number;
    if (!gt(maxAbsDelta, 0)) return out;
    for (let b = 0; b < bands; b++) {
      const delta = up[b]! - down[b]!;
      if (eq(delta, 0)) continue;
      const widthBars = Math.max(Math.trunc((Math.abs(delta) / maxAbsDelta) * cfg.deltaMaxWidth), 1);
      const col = ge(delta, 0) ? cfg.deltaBullColor : cfg.deltaBearColor;
      out.push({
        left: startBar - widthBars, price1: sorted[b + 1]!, right: startBar, price2: sorted[b]!, bgColor: col,
        borderColor: String(color.new(col, 0)), borderStyle: 'solid', text: `Δ ${str.tostring(delta, 'volume')}`,
        textColor: '#FFFFFF', textHAlign: 'center', textVAlign: 'center',
      });
    }
    return out;
  };

  return {
    init() {
      const hiStep = new WindowExtreme(false, prd);
      const loStep = new WindowExtreme(true, prd);
      const s: FibRun = {
        hiStep, loStep, hiBarAt: [], loBarAt: [], lastRebuild: [],
        steps: [hiStep, loStep], vars: { alive: [] }, lists: [], series: [],
      };
      s.series = [s.hiBarAt, s.loBarAt, s.lastRebuild];
      return s;
    },
    copyVars: (v) => ({ alive: v.alive.slice() }),
    bar(s, i, barsNow) {
      bars = barsNow;
      hiBarAt = s.hiBarAt;
      loBarAt = s.loBarAt;
      const b = bars[i]!;
      const hi = s.hiStep.step(b.high);
      const lo = s.loStep.step(b.low);
      // Swings at each bar: the last bar whose high (low) is the highest (lowest) of the period
      hiBarAt[i] = eq(b.high, hi) ? i : i > 0 ? hiBarAt[i - 1]! : -1;
      loBarAt[i] = eq(b.low, lo) ? i : i > 0 ? loBarAt[i - 1]! : -1;
      s.lastRebuild[i] = rebuilds(i) ? i : i > 0 ? s.lastRebuild[i - 1]! : -1;
      if (!limited || !draws(i)) return;
      // The box limit can be reached: the creations of every bar are counted, in the order of the script. When a
      // creation brings the count above max + 5, the oldest boxes are deleted until max remain.
      const v = s.vars;
      const create = (kind: Entry['kind'], box: BoxObj | null, k: number) => {
        v.alive.push({ kind, box, k });
        if (v.alive.length > MAX_BOXES + 5) v.alive = v.alive.slice(v.alive.length - MAX_BOXES);
      };
      const clear = (kind: Entry['kind']) => {
        v.alive = v.alive.filter((e) => e.kind !== kind);
      };
      clear('area');
      // the content of the projection boxes is only needed on the last bar (made in result)
      for (let k = 0; k < 3; k++) create('area', null, k);
      if (!rebuilds(i)) return;
      if (cfg.showFibProfile) {
        clear('profile');
        for (const bx of profile(i)) create('profile', bx, 0);
      }
      if (cfg.showFibDelta) {
        clear('delta');
        for (const bx of deltaProfile(i)) create('delta', bx, 0);
      }
    },
    result(s, barsNow) {
      bars = barsNow;
      hiBarAt = s.hiBarAt;
      loBarAt = s.loBarAt;
      const n = bars.length;
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      let boxes: BoxObj[] = [];
      const last = n - 1;

      if (n > 0 && draws(last)) {
        const hiBar = hiBarAt[last]!;
        const loBar = loBarAt[last]!;
        const hiPrice = bars[hiBar]!.high;
        const loPrice = bars[loBar]!.low;
        const time = (index: number) => barTime(bars, index);
        // hiLine, loLine
        lines.push({ time1: time(hiBar), price1: hiPrice, time2: time(last), price2: hiPrice, color: cfg.hiLineColor, width: cfg.hiloLineWidth });
        lines.push({ time1: time(loBar), price1: loPrice, time2: time(last), price2: loPrice, color: cfg.loLineColor, width: cfg.hiloLineWidth });
        // retracement lines from the newest swing
        const xFibStart = Math.max(hiBar, loBar);
        FIB_LEVELS.forEach((e, k) => {
          const f = fibb(e, hiBar > loBar, hiPrice, loPrice);
          lines.push({ time1: time(xFibStart), price1: f, time2: time(last), price2: f, color: fibColors[k]!, width: cfg.fibLineWidth });
          if (cfg.showlab) {
            labels.push({
              time: time(last + 1), price: f, text: `${str.tostring(e * 100, '#.##')}%`, textColor: cfg.fibLabelColor,
              style: 'label_left', size: sizeOf(cfg.fibLabelSizeStr), color: fibColors[k],
            });
          }
        });
        const proj = projection(last);
        lines.push(...proj.lines);
        labels.push(...proj.labels);

        // Boxes. The profiles are made again only on the bars where the two swings are different bars.
        if (!limited) {
          // The box limit is never reached: the profiles of the last bar that made them, and the projection of the last bar
          const at = s.lastRebuild[last]!;
          if (at >= 0 && cfg.showFibProfile) boxes.push(...profile(at));
          if (at >= 0 && cfg.showFibDelta) boxes.push(...deltaProfile(at));
          boxes.push(...proj.boxes);
        } else {
          // the live projection boxes are the ones of the last bar (it draws)
          boxes = s.vars.alive
            .map((e) => (e.kind === 'area' ? proj.boxes[e.k]! : e.box))
            .filter((b): b is BoxObj => b !== null);
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines,
        boxes: boxes.map(({ left, right, ...rest }) => ({ time1: barTime(bars, left), time2: barTime(bars, right), ...rest })),
        labels,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciProjectionWithVolumeDeltaProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciProjectionWithVolumeDeltaProfileInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciProjectionWithVolumeDeltaProfile = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
