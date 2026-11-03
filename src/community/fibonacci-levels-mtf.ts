/**
 * Fibonacci levels MTF
 *
 * Fibonacci levels of a candle of a higher timeframe ("D" by default), built from the chart bars of each period:
 * the open of its first bar, the highest high, the lowest low and the close of its last bar. With "Last" the levels
 * come from the previous (completed) candle, with "Current" from the candle in progress. A bullish candle (close >=
 * open) gives high - range * level, a bearish one low + range * level. The levels are not drawn on the first bar of
 * each period (line breaks). On the last bar a label at the right of each enabled level shows its ratio and price
 * (rounded to the symbol tick). The higher-timeframe candle can be drawn with three boxes (body and two wicks).
 *
 * Periods and the chart context (optional third argument of calculate): the period of each bar is `time(tf)`
 * (src/anchor-period.ts); with the exchange time zone and the session of the symbol they are those of the exchange
 * calendar, else the UTC calendar and the bars. The label prices are rounded to the symbol tick of the context
 * (0.01 without one).
 *
 * Reference: "Fibonacci levels MTF" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  math, str, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Box,
} from 'oakscriptjs';
import { periodChanges } from '../anchor-period';
import { mintickOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface FibonacciLevelsMtfInputs {
  timeframe: string;
  currentlast: 'Current' | 'Last';
  showfibolabels: boolean;
  showhtfcandle: boolean;
  upcol: string;
  downcol: string;
  wickcol: string;
  enable0: boolean;
  level0: number;
  color0: string;
  enable1: boolean;
  level1: number;
  color1: string;
  enable2: boolean;
  level2: number;
  color2: string;
  enable3: boolean;
  level3: number;
  color3: string;
  enable4: boolean;
  level4: number;
  color4: string;
  enable5: boolean;
  level5: number;
  color5: string;
  enable100: boolean;
  level100: number;
  color100: string;
  enable6: boolean;
  level6: number;
  color6: string;
  enable7: boolean;
  level7: number;
  color7: string;
}

export const defaultInputs: FibonacciLevelsMtfInputs = {
  timeframe: 'D',
  currentlast: 'Last',
  showfibolabels: true,
  showhtfcandle: false,
  upcol: 'rgba(0, 255, 0, 0.25)',
  downcol: 'rgba(255, 0, 0, 0.25)',
  wickcol: 'rgba(120, 123, 134, 0.25)',
  enable0: true,
  level0: 0,
  color0: '#2962FF',
  enable1: true,
  level1: 0.236,
  color1: '#00E676',
  enable2: true,
  level2: 0.382,
  color2: '#FF5252',
  enable3: true,
  level3: 0.5,
  color3: '#FF9800',
  enable4: true,
  level4: 0.618,
  color4: '#00897B',
  enable5: true,
  level5: 0.786,
  color5: '#311B92',
  enable100: true,
  level100: 1,
  color100: '#2962FF',
  enable6: false,
  level6: -0.382,
  color6: '#787B86',
  enable7: false,
  level7: 1.236,
  color7: '#787B86',
};

const FIB = 'Fibonacci Levels';
const levelInputs = (k: string, title: string): InputConfig[] => {
  const d = defaultInputs as unknown as Record<string, number | string | boolean>;
  return [
    { id: `enable${k}`, type: 'bool', title, defval: d[`enable${k}`] as boolean, inline: k, group: FIB },
    { id: `level${k}`, type: 'float', title: '', defval: d[`level${k}`] as number, inline: k, group: FIB },
    { id: `color${k}`, type: 'color', title: '', defval: d[`color${k}`] as string, inline: k, group: FIB },
  ];
};

export const inputConfig: InputConfig[] = [
  { id: 'timeframe', type: 'timeframe', title: 'Higher Time Frame', defval: 'D' },
  { id: 'currentlast', type: 'string', title: 'Current or Last HTF Candle', defval: 'Last', options: ['Current', 'Last'] },
  { id: 'showfibolabels', type: 'bool', title: 'Price Labels', defval: true },
  { id: 'showhtfcandle', type: 'bool', title: 'Show HTF Candles', defval: false, inline: 'candle' },
  { id: 'upcol', type: 'color', title: '', defval: defaultInputs.upcol, inline: 'candle' },
  { id: 'downcol', type: 'color', title: '', defval: defaultInputs.downcol, inline: 'candle' },
  { id: 'wickcol', type: 'color', title: '', defval: defaultInputs.wickcol, inline: 'candle' },
  ...levelInputs('0', 'Level 0'),
  ...levelInputs('1', 'Level 1'),
  ...levelInputs('2', 'Level 2'),
  ...levelInputs('3', 'Level 3'),
  ...levelInputs('4', 'Level 4'),
  ...levelInputs('5', 'Level 5'),
  ...levelInputs('100', 'Level 6'),
  ...levelInputs('6', 'Level 7'),
  ...levelInputs('7', 'Level 8'),
];

/**
 * The nine plots in the order of the original arrays: level100, level7, level6, level5 ... level0. The colour of
 * the third one is color7 (`colors` holds color7 twice in the original).
 */
const ORDER = ['100', '7', '6', '5', '4', '3', '2', '1', '0'] as const;
const COLOR_OF = ['100', '7', '7', '5', '4', '3', '2', '1', '0'] as const;
const TITLES = ['Level 6', 'Level 8', 'Level 7', 'Level 5', 'Level 4', 'Level 3', 'Level 2', 'Level 1', 'Level 0'];

export const plotConfig: PlotConfig[] = ORDER.map((_k, x) => ({
  id: `plot${x}`,
  title: TITLES[x],
  color: (defaultInputs as unknown as Record<string, string>)[`color${COLOR_OF[x]}`],
  lineWidth: 1,
  style: 'linebr' as const,
}));

/** Drawings of the script: price labels and the boxes of the higher-timeframe candle */
export const drawingKinds: StudyDrawingKind[] = ['label', 'box'];

export const metadata = {
  title: 'Fibonacci levels MTF',
  shortTitle: 'Fibonacci levels MTF',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<FibonacciLevelsMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const get = cfg as unknown as Record<string, number | string | boolean>;
  const enabled = ORDER.map((k) => Boolean(get[`enable${k}`]));
  const levels = ORDER.map((k) => Number(get[`level${k}`]));
  const colors = COLOR_OF.map((k) => String(get[`color${k}`]));
  const mintick = mintickOf(chart);

  // newbar = ta.change(time(timeframe)) != 0 (false on the first bar)
  const newbars = periodChanges(bars, cfg.timeframe, chart);

  resetDrawings({ box: 50, label: 50 });
  const plotValues: number[][] = ORDER.map(() => new Array(n).fill(NaN));

  let htfhigh = n > 0 ? bars[0].high : NaN;
  let htflow = n > 0 ? bars[0].low : NaN;
  let htfopen = n > 0 ? bars[0].open : NaN;
  let counter = 0;
  let prevHigh = NaN;
  let prevLow = NaN;
  let prevOpen = NaN;
  let prevClose = NaN;
  // var candle = array.new_box(3, na)
  const candle: Array<Box | undefined> = [undefined, undefined, undefined];
  let open_ = NaN;
  let high_ = NaN;
  let low_ = NaN;
  let close_ = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const newbar = newbars[i];
    const htfclose = b.close;
    if (newbar) {
      htfhigh = b.high;
      htflow = b.low;
      htfopen = b.open;
      counter = 0;
    } else {
      htfhigh = Math.max(htfhigh, b.high);
      htflow = Math.min(htflow, b.low);
      counter += 1;
    }
    if (cfg.showhtfcandle) {
      if (!newbar) for (const c of candle) if (c) box.delete(c);
      const top = Math.max(htfopen, htfclose);
      const bottom = Math.min(htfopen, htfclose);
      candle[0] = box.new(i - counter, top, i, bottom, undefined, 0, undefined, undefined, undefined,
        ge(htfclose, htfopen) ? cfg.upcol : cfg.downcol);
      candle[1] = box.new(i - counter, htfhigh, i, top, undefined, 0, undefined, undefined, undefined, cfg.wickcol);
      candle[2] = box.new(i - counter, bottom, i, htflow, undefined, 0, undefined, undefined, undefined, cfg.wickcol);
    }

    if (cfg.currentlast === 'Last' && newbar) {
      open_ = prevOpen;
      high_ = prevHigh;
      low_ = prevLow;
      close_ = prevClose;
    } else if (cfg.currentlast === 'Current') {
      open_ = htfopen;
      high_ = htfhigh;
      low_ = htflow;
      close_ = htfclose;
    }

    const mlevels = new Array(ORDER.length).fill(NaN);
    if (!newbar) {
      for (let x = 0; x < ORDER.length; x++) {
        mlevels[x] = enabled[x]
          ? ge(close_, open_) ? high_ - (high_ - low_) * levels[x] : low_ + (high_ - low_) * levels[x]
          : NaN;
      }
    }
    for (let x = 0; x < ORDER.length; x++) plotValues[x][i] = mlevels[x];

    if (i === n - 1 && cfg.showfibolabels) {
      const mid = (high_ + low_) / 2;
      for (let x = 0; x < ORDER.length; x++) {
        if (!enabled[x]) continue;
        const level = mlevels[x];
        const stl = gt(level, mid) ? 'label_lower_left' : lt(level, mid) ? 'label_upper_left' : 'label_left';
        label.new(i + 1, level,
          `${str.tostring(math.round(levels[x], 3))} (${str.tostring(math.round_to_mintick(level, mintick))})`,
          undefined, undefined, colors[x], stl, '#FFFFFF');
      }
    }

    prevHigh = htfhigh;
    prevLow = htflow;
    prevOpen = htfopen;
    prevClose = htfclose;
  }
  setDrawingBar(null);

  const plots: IndicatorResult['plots'] = {};
  ORDER.forEach((_k, x) => {
    plots[`plot${x}`] = bars.map((b, i) => ({ time: b.time, value: plotValues[x][i], color: colors[x] }));
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    ...drawingOutputs(bars),
  };
}

export const FibonacciLevelsMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
