/**
 * Auto Fib Retracement
 *
 * Fibonacci retracement levels on the last leg of a zigzag.
 * - Zigzag (ZigZag library v7): pivots of `Depth / 2` bars on each side (at least 2); a pivot of the other kind
 *   starts a new leg when it moves more than the deviation threshold from the last pivot, a pivot of the same kind
 *   moves the end of the last leg when it goes further. The threshold is ATR(10) / close x 100 x `Deviation` (a
 *   percentage), computed on each bar. The zigzag draws its legs with an na colour (width 2): they are not visible
 *   but count in the 50-line limit, as in the original.
 * - Levels: start + (end - start) x ratio for each ratio switched on, with start = end of the last leg and end =
 *   its start ("Reverse" swaps them), drawn as horizontal lines over the last leg with a text (ratio and / or price)
 *   and a fill between each level and the one before. The last leg is drawn as a dashed grey line.
 *
 * Based on the standard Auto Fib Retracement indicator.
 *
 * The prices of the texts are rounded to the symbol tick (format.mintick): the port reads it from the chart context
 * (third argument of calculate); without it the tick is 0.01. With fewer than two pivots on the last bar the port
 * throws the error message of the original.
 *
 * Alerts (alert() calls, `alertCalls` of the result): on each bar with a last leg, each level switched on that the
 * close crossed since the previous close (the level strictly between the two closes) makes the call
 * "Autofib: <ticker> crossing level <ratio>", once per bar.
 */

import {
  ZigZag as ZigZagEngine,
  color,
  drawingOutputs,
  holdDrawing,
  label,
  line,
  linefill,
  resetDrawings,
  setDrawingBar,
  str,
  ta,
  type Bar,
  type IndicatorResult,
  type InputConfig,
  type PlotConfig,
  type ZigZagPivot,
  type ZigZagPoint,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, LinefillData } from '../types';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';

type Line = ReturnType<typeof line.new>;
type Label = ReturnType<typeof label.new>;

/** Keys of the 22 levels, in the order of their inputs */
const LEVEL_KEYS = [
  '0', '0_236', '0_382', '0_5', '0_618', '0_65', '0_786', '1', '1_272', '1_414', '1_618', '1_65', '2_618', '2_65',
  '3_618', '3_65', '4_236', '4_618', 'neg_0_236', 'neg_0_382', 'neg_0_618', 'neg_0_65',
] as const;
type LevelKey = (typeof LEVEL_KEYS)[number];

/** Default [show, value, colour] of each level */
const LEVEL_DEFAULTS: Record<LevelKey, [boolean, number, string]> = {
  '0': [true, 0, '#787b86'],
  '0_236': [true, 0.236, '#f44336'],
  '0_382': [true, 0.382, '#81c784'],
  '0_5': [true, 0.5, '#4caf50'],
  '0_618': [true, 0.618, '#009688'],
  '0_65': [false, 0.65, '#009688'],
  '0_786': [true, 0.786, '#64b5f6'],
  '1': [true, 1, '#787b86'],
  '1_272': [false, 1.272, '#81c784'],
  '1_414': [false, 1.414, '#f44336'],
  '1_618': [true, 1.618, '#2962ff'],
  '1_65': [false, 1.65, '#2962ff'],
  '2_618': [true, 2.618, '#f44336'],
  '2_65': [false, 2.65, '#f44336'],
  '3_618': [true, 3.618, '#9c27b0'],
  '3_65': [false, 3.65, '#9c27b0'],
  '4_236': [true, 4.236, '#e91e63'],
  '4_618': [false, 4.618, '#81c784'],
  neg_0_236: [false, -0.236, '#f44336'],
  neg_0_382: [false, -0.382, '#81c784'],
  neg_0_618: [false, -0.618, '#009688'],
  neg_0_65: [false, -0.65, '#009688'],
};

/** Inline group of each pair of levels */
const LEVEL_INLINE: Record<LevelKey, string> = {
  '0': 'Level0', '0_236': 'Level0', '0_382': 'Level1', '0_5': 'Level1', '0_618': 'Level2', '0_65': 'Level2',
  '0_786': 'Level3', '1': 'Level3', '1_272': 'Level4', '1_414': 'Level4', '1_618': 'Level5', '1_65': 'Level5',
  '2_618': 'Level6', '2_65': 'Level6', '3_618': 'Level7', '3_65': 'Level7', '4_236': 'Level8', '4_618': 'Level8',
  neg_0_236: 'Level9', neg_0_382: 'Level9', neg_0_618: 'Level10', neg_0_65: 'Level10',
};

/** Order in which the levels are drawn (each fill joins a level to the one drawn before) */
const PROCESS_ORDER: LevelKey[] = [
  'neg_0_65', 'neg_0_618', 'neg_0_382', 'neg_0_236', '0', '0_236', '0_382', '0_5', '0_618', '0_65', '0_786', '1',
  '1_272', '1_414', '1_618', '1_65', '2_618', '2_65', '3_618', '3_65', '4_236', '4_618',
];

type LevelInputs = {
  [K in LevelKey as `show_${K}`]: boolean;
} & {
  [K in LevelKey as `value_${K}`]: number;
} & {
  [K in LevelKey as `color_${K}`]: string;
};

export interface AutoFibRetracementInputs extends LevelInputs {
  /** Multiplier of the ATR-based deviation threshold */
  thresholdMultiplier: number;
  /** Pivot depth in bars (half on each side) */
  depth: number;
  /** Swap the start and the end of the leg */
  reverse: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  /** Show the price in the level texts */
  prices: boolean;
  /** Show the ratio in the level texts */
  levels: boolean;
  levelsFormat: 'Values' | 'Percent';
  labelsPosition: 'Left' | 'Right';
  /** Transparency (0-100) of the fills between levels */
  backgroundTransparency: number;
}

const levelDefaults = Object.fromEntries(
  LEVEL_KEYS.flatMap((k) => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    return [[`show_${k}`, show], [`value_${k}`, value], [`color_${k}`, css]];
  }),
) as LevelInputs;

export const defaultInputs: AutoFibRetracementInputs = {
  thresholdMultiplier: 3,
  depth: 10,
  reverse: false,
  extendLeft: false,
  extendRight: true,
  prices: true,
  levels: true,
  levelsFormat: 'Values',
  labelsPosition: 'Left',
  backgroundTransparency: 85,
  ...levelDefaults,
};

const DEV_TOOLTIP =
  'Deviation is a multiplier that affects how much the price should deviate from the previous pivot in order for the bar to become a new pivot.';
const DEPTH_TOOLTIP = 'The minimum number of bars that will be taken into account when calculating the indicator.';

export const inputConfig: InputConfig[] = [
  { id: 'thresholdMultiplier', type: 'float', title: 'Deviation', defval: 3, min: 0, tooltip: DEV_TOOLTIP },
  { id: 'depth', type: 'int', title: 'Depth', defval: 10, min: 2, tooltip: DEPTH_TOOLTIP },
  { id: 'reverse', type: 'bool', title: 'Reverse', defval: false, display: 'data_window' },
  {
    id: 'extendLeft', type: 'bool', title: 'Extend Left    |    Extend Right', defval: false,
    inline: 'Extend Lines', display: 'none',
  },
  { id: 'extendRight', type: 'bool', title: '', defval: true, inline: 'Extend Lines', display: 'none' },
  { id: 'prices', type: 'bool', title: 'Show Prices', defval: true, display: 'data_window' },
  { id: 'levels', type: 'bool', title: 'Show Levels', defval: true, inline: 'Levels', display: 'data_window' },
  {
    id: 'levelsFormat', type: 'string', title: '', defval: 'Values', options: ['Values', 'Percent'], inline: 'Levels',
    display: 'data_window', active: 'levels',
  },
  { id: 'labelsPosition', type: 'string', title: 'Labels Position', defval: 'Left', options: ['Left', 'Right'], display: 'data_window' },
  { id: 'backgroundTransparency', type: 'int', title: 'Background Transparency', defval: 85, min: 0, max: 100, display: 'data_window' },
  ...LEVEL_KEYS.flatMap((k): InputConfig[] => {
    const [show, value, css] = LEVEL_DEFAULTS[k];
    const inline = LEVEL_INLINE[k];
    return [
      { id: `show_${k}`, type: 'bool', title: '', defval: show, inline, display: 'data_window' },
      // input(0) and input(1) are int inputs, the other values float inputs
      { id: `value_${k}`, type: Number.isInteger(value) ? 'int' : 'float', title: '', defval: value, inline, display: 'data_window', active: `show_${k}` },
      { id: `color_${k}`, type: 'color', title: '', defval: css, inline, display: 'data_window', active: `show_${k}` },
    ];
  }),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Fib Retracement',
  shortTitle: 'Auto Fib Retracement',
  overlay: true,
};

export interface AutoFibRetracementResult extends IndicatorResult {
  lines: LineDrawingData[];
  labels: LabelData[];
  linefills: LinefillData[];
  /** The alert() calls: a level crossed by the close */
  alertCalls: AlertCall[];
}

/** Pine float comparison: a > b only when a - b > 1e-10 */
const gt = (a: number, b: number) => a - b > 1e-10;

/** Text that pads the level labels (a line break, right-to-left marks and spaces, a line break) */
const LABEL_PAD = '\n ' + '‏  '.repeat(34) + '‏ \n';

const NOT_ENOUGH_DATA =
  "Not enough data to calculate Auto Fib Retracement on the current symbol. Change the chart's timeframe to a lower one or select a smaller calculation depth using the indicator's `Depth` settings.";

const GRAY = '#787B86';

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoFibRetracementInputs> = {},
  chart?: ChartContext,
): AutoFibRetracementResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tick = mintickOf(chart);
  const meta = { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay };
  if (n === 0) return { metadata: meta, plots: {}, lines: [], labels: [], linefills: [], alertCalls: [] };

  // Drawings use xloc.bar_time as the original: times in ms
  const toMs = chart?.timeUnit === 'ms' ? 1 : 1000;
  const timeMs = (t: number) => t * toMs;
  const extending = cfg.extendLeft && cfg.extendRight ? 'both' : cfg.extendLeft ? 'left' : cfg.extendRight ? 'right' : 'none';
  const atr = ta.atr(bars, 10).toArray().map((v) => v ?? NaN);
  const fmt = (v: number) => str.tostring(v, 'mintick', tick);
  const left = cfg.labelsPosition === 'Left';

  resetDrawings();
  const zigZag = new ZigZagEngine({ devThreshold: cfg.thresholdMultiplier, depth: cfg.depth, extendLast: false });
  // The library draws one line per pivot (settings.draw = true, colour na, width 2)
  const pivotLines: Line[] = [];
  // ZigZag v7: the start of the first pivot moves with its end (the library engine keeps the first point)
  const startOf = (p: ZigZagPivot): ZigZagPoint => (p === zigZag.pivots[0] ? p.end : p.start);

  let lastP: ZigZagPivot | null = null;
  let lineLast: Line | null = null;
  let startPrice = NaN;
  let height = NaN;
  const levelLines = new Map<LevelKey, Line>();
  const levelLabels = new Map<LevelKey, Label>();
  const alertCalls: AlertCall[] = [];
  const ticker = tickerOf(chart);
  // The label text of a level only changes with its price: formatting it on every bar is most of the run time
  const levelTexts = new Map<LevelKey, { r: number; text: string }>();
  const levelText = (k: LevelKey, m: number, r: number) => {
    const last = levelTexts.get(k);
    if (last && Object.is(last.r, r)) return last.text;
    const lv = cfg.levelsFormat === 'Values' ? str.tostring(m) : str.tostring(m * 100) + '%';
    const txt = (cfg.levels ? lv : '') + (cfg.prices ? '(' + fmt(r) + ')' : '');
    const text = (left ? txt : '       ' + txt) + LABEL_PAD;
    levelTexts.set(k, { r, text });
    return text;
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (i === n - 1 && zigZag.pivots.length < 2) {
      setDrawingBar(null);
      throw new Error(NOT_ENOUGH_DATA);
    }
    zigZag.settings.devThreshold = (atr[i] / bars[i].close) * 100 * cfg.thresholdMultiplier;
    const before = zigZag.pivots.length;
    const lastEnd = before > 0 ? zigZag.pivots[before - 1].end : null;
    const changed = zigZag.update(bars[i], i);

    // Pivot lines of the library: the last pivot moved (updatePivot), then the new pivots (newPivot)
    if (before > 0 && zigZag.pivots[before - 1].end !== lastEnd) {
      const p = zigZag.pivots[before - 1];
      const ln = pivotLines[before - 1];
      if (before === 1) line.set_xy1(ln, timeMs(p.end.time), p.end.price);
      line.set_xy2(ln, timeMs(p.end.time), p.end.price);
    }
    for (let k = before; k < zigZag.pivots.length; k++) {
      const p = zigZag.pivots[k];
      const s = startOf(p);
      pivotLines.push(line.new(timeMs(s.time), s.price, timeMs(p.end.time), p.end.price, 'bar_time', 'none', 'transparent', 'solid', 2));
    }

    if (changed) {
      lastP = zigZag.lastPivot();
      if (lastP) {
        const s = startOf(lastP);
        if (!lineLast) {
          lineLast = holdDrawing(
            line.new(timeMs(s.time), s.price, timeMs(lastP.end.time), lastP.end.price, 'bar_time', 'none', GRAY, 'dashed', 1),
          );
        } else {
          line.set_xy1(lineLast, timeMs(s.time), s.price);
          line.set_xy2(lineLast, timeMs(lastP.end.time), lastP.end.price);
        }
        startPrice = cfg.reverse ? s.price : lastP.end.price;
        const endPrice = cfg.reverse ? lastP.end.price : s.price;
        height = (gt(startPrice, endPrice) ? -1 : 1) * Math.abs(startPrice - endPrice);
      }
    }

    if (!lastP) continue;
    const s = startOf(lastP);
    const e = lastP.end;
    let other: Line | null = null;
    for (const k of PROCESS_ORDER) {
      if (!cfg[`show_${k}`]) continue;
      const m = cfg[`value_${k}`];
      const css = cfg[`color_${k}`];
      const r = startPrice + height * m;
      // _crossing_level(close, r): the level between this close and the previous one
      const c0 = bars[i].close;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      if ((gt(r, c0) && gt(c1, r)) || (gt(c0, r) && gt(r, c1))) {
        alertCalls.push({ time: bars[i].time, message: 'Autofib: ' + ticker + ' crossing level ' + str.tostring(m), freq: 'once_per_bar' });
      }
      // _draw_line
      let id = levelLines.get(k);
      if (!id) {
        id = holdDrawing(line.new(timeMs(s.time), s.price, timeMs(bars[i].time), r, 'bar_time', extending, css, 'solid', 1));
        levelLines.set(k, id);
      }
      line.set_xy1(id, timeMs(s.time), r);
      line.set_xy2(id, timeMs(e.time), r);
      // _draw_label
      const text = levelText(k, m, r);
      const x = timeMs(left ? s.time : !cfg.extendRight ? e.time : bars[i].time);
      let lb = levelLabels.get(k);
      if (!lb) {
        lb = holdDrawing(
          label.new(x, r, text, 'bar_time', 'price', '#00000000', left ? 'label_right' : 'label_left', css, undefined, left ? 'right' : 'left'),
        );
        levelLabels.set(k, lb);
      }
      label.set_xy(lb, x, r);
      label.set_text(lb, text);
      label.set_textcolor(lb, css);
      if (other) linefill.new(id, other, color.new(css, cfg.backgroundTransparency));
      other = id;
    }
  }
  setDrawingBar(null);

  const out = drawingOutputs(bars, toMs === 1 ? 'ms' : 's');
  return {
    metadata: meta,
    plots: {},
    lines: out.lines ?? [],
    labels: out.labels ?? [],
    linefills: out.linefills ?? [],
    alertCalls,
  };
}

export const AutoFibRetracement = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction: true };
