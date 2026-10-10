/**
 * Fair Value Gap [LuxAlgo]
 *
 * Finds fair value gaps on the chart timeframe or on a higher timeframe. A bullish gap: the low is above the high of
 * two bars before, the close of the bar between them is above that high too, and the gap size relative to that high
 * is above the threshold. A bearish gap is the mirrored case (the size is relative to the high of the bar). The
 * threshold is a fixed percentage, or with "Auto" the cumulative average of (high - low) / low.
 *
 * Each gap is drawn as a box from two bars back to "Extend" bars after the bar. A bullish gap is mitigated when a
 * close is below its lower edge, a bearish gap when a close is above its upper edge: the box is removed and, with
 * "Mitigation Levels", a dashed line is drawn from the gap to that bar. "Unmitigated Levels" draws a line for the
 * most recent gaps that are still open. With "Dynamic" the boxes are replaced by two plotted bands: the open gap of
 * each side, whose edge follows the close into the gap. The dashboard shows the number of gaps and the percentage of
 * mitigated gaps. At most 500 boxes and 500 lines are kept.
 *
 * Timeframe: the higher-timeframe bars are built from the chart bars with the UTC calendar rule of the period
 * helper (see anchor-period.ts for its limits). The values of a higher-timeframe bar appear on the chart bar that
 * completes it: on symbols that trade every day, a bar whose close reaches the end of the period, else the first bar
 * of the next period; on other symbols the last bar of the period. Every bar is a closed bar. As in the original, a
 * higher timeframe gives a runtime error when the first chart bar does not complete a bar of that timeframe (the
 * record is na there). A timeframe lower than the chart timeframe needs data that the chart bars do not have: the
 * port throws an Error.
 *
 * Reference: "Fair Value Gap [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { str, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LineDrawingData, TableData, TableCellData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { periodStarts, chartTimeframe } from '../anchor-period';

export interface FairValueGapLuxalgoInputs {
  /** Smallest gap size, in percent */
  thresholdPer: number;
  /** Use the cumulative average bar range as threshold */
  auto: boolean;
  /** Number of unmitigated levels drawn on the last bar (0: none) */
  showLast: number;
  mitigationLevels: boolean;
  /** Timeframe of the gaps ('' = chart timeframe) */
  tf: string;
  /** Box length after the gap bar, in bars */
  extend: number;
  dynamic: boolean;
  bullCss: string;
  bearCss: string;
  showDash: boolean;
  dashLoc: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  textSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: FairValueGapLuxalgoInputs = {
  thresholdPer: 0,
  auto: false,
  showLast: 0,
  mitigationLevels: false,
  tf: '',
  extend: 20,
  dynamic: false,
  bullCss: 'rgba(8, 153, 129, 0.3)',
  bearCss: 'rgba(242, 54, 69, 0.3)',
  showDash: false,
  dashLoc: 'Top Right',
  textSize: 'Small',
};

export const inputConfig: InputConfig[] = [
  { id: 'thresholdPer', type: 'float', title: 'Threshold %', defval: 0, min: 0, max: 100, step: 0.1, inline: 'threshold' },
  { id: 'auto', type: 'bool', title: 'Auto', defval: false, inline: 'threshold' },
  { id: 'showLast', type: 'int', title: 'Unmitigated Levels', defval: 0, min: 0 },
  { id: 'mitigationLevels', type: 'bool', title: 'Mitigation Levels', defval: false },
  { id: 'tf', type: 'timeframe', title: 'Timeframe', defval: '' },
  { id: 'extend', type: 'int', title: 'Extend', defval: 20, min: 0, inline: 'extend', group: 'Style' },
  { id: 'dynamic', type: 'bool', title: 'Dynamic', defval: false, inline: 'extend', group: 'Style' },
  { id: 'bullCss', type: 'color', title: 'Bullish FVG', defval: 'rgba(8, 153, 129, 0.3)', group: 'Style' },
  { id: 'bearCss', type: 'color', title: 'Bearish FVG', defval: 'rgba(242, 54, 69, 0.3)', group: 'Style' },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: false, group: 'Dashboard' },
  { id: 'dashLoc', type: 'string', title: 'Location', defval: 'Top Right', options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: 'Dashboard' },
  { id: 'textSize', type: 'string', title: 'Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], group: 'Dashboard' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish FVG Top', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'Bullish FVG Bottom', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Bearish FVG Top', color: 'transparent', lineWidth: 1 },
  { id: 'plot3', title: 'Bearish FVG Bottom', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Fair Value Gap [LuxAlgo]',
  shortTitle: 'LuxAlgo - Fair Value Gap',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** A gap record (type fvg): t is the time of the bar that made it, in its timeframe */
interface Fvg {
  max: number;
  min: number;
  isbull: boolean;
  t: number;
}
interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
  deleted: boolean;
}
interface Level {
  time1: number;
  time2: number;
  price: number;
  color: string;
  dashed: boolean;
}

/**
 * request.security(syminfo.tickerid, tf, ...) without lookahead: the bars of timeframe `tf` built from the chart
 * bars, and for each chart bar the index of the latest completed bar of that timeframe (-1: none yet).
 */
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; latest: number[] } {
  const chart = chartTimeframe(bars);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, latest: bars.map((_b, i) => i) };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`Fair Value Gap: the timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data`);
  }
  const n = bars.length;
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  bars.forEach((b, i) => {
    if (i === 0 || starts[i] !== starts[i - 1]) {
      // the time of a bar of the timeframe: its first chart bar (a level line starts on that bar)
      htf.push({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = htf[htf.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    group.push(htf.length - 1);
  });

  // A bar completes its period when its close reaches the end of the period. Symbols that trade every day follow
  // the UTC calendar: the period of the close time is another period. Other symbols: the last bar of a period.
  const ms = n > 0 && bars[0].time >= 1e12;
  const weekend = (t: number) => {
    const wd = new Date(ms ? t : t * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  };
  const interval = barInterval(bars);
  const closes = bars.map((b) => ({ time: b.time + interval }));
  const calendar = bars.some((b) => weekend(b.time)) && closes.some((b) => weekend(b.time));
  const closeStarts = calendar ? periodStarts(closes, tf) : [];
  const latest: number[] = [];
  for (let i = 0; i < n; i++) {
    let done = i === 0 ? -1 : latest[i - 1];
    if (i > 0 && group[i] !== group[i - 1]) done = Math.max(done, group[i] - 1);
    const ends = i === n - 1 || starts[i + 1] !== starts[i];
    const reaches = !calendar || closeStarts[i] !== starts[i];
    if (ends && reaches) done = Math.max(done, group[i]);
    latest.push(done);
  }
  return { htf, latest };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FairValueGapLuxalgoInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'lines' | 'tables'> & { boxes: BoxData[]; lines: LineDrawingData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const { bullCss, bearCss, dynamic } = cfg;

  // detect() on the bars of the timeframe
  const { htf, latest } = timeframeBars(bars, cfg.tf);
  // `new_fvg.t` is read on every bar: when the first chart bar does not complete a bar of the timeframe, the
  // record is na there and the script stops with a runtime error
  if (n > 0 && latest[0] < 0) {
    throw new Error("Error on bar 0: Cannot access the 'fvg.t' field of an undefined object. The object is 'na'.");
  }
  const bullAt: boolean[] = [];
  const bearAt: boolean[] = [];
  const fvgAt: Array<Fvg | null> = [];
  {
    let newFvg: Fvg | null = null; // var new_fvg = fvg.new(na, na, na, na): no gap yet
    let cum = 0;
    for (let k = 0; k < htf.length; k++) {
      const b = htf[k];
      cum += (b.high - b.low) / b.low;
      const threshold = cfg.auto ? cum / k : cfg.thresholdPer / 100;
      const high2 = k >= 2 ? htf[k - 2].high : NaN;
      const low2 = k >= 2 ? htf[k - 2].low : NaN;
      const close1 = k >= 1 ? htf[k - 1].close : NaN;
      const bull = gt(b.low, high2) && gt(close1, high2) && gt((b.low - high2) / high2, threshold);
      const bear = lt(b.high, low2) && lt(close1, low2) && gt((low2 - b.high) / b.high, threshold);
      if (bull) newFvg = { max: b.low, min: high2, isbull: true, t: b.time };
      else if (bear) newFvg = { max: low2, min: b.high, isbull: false, t: b.time };
      bullAt.push(bull);
      bearAt.push(bear);
      fvgAt.push(newFvg);
    }
  }

  // Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
  // max remain
  const allBoxes: Area[] = [];
  const newBox = (b: Omit<Area, 'deleted'>): Area => {
    const o = { ...b, deleted: false };
    allBoxes.push(o);
    if (allBoxes.length > MAX_OBJECTS + 5) for (const old of allBoxes.splice(0, allBoxes.length - MAX_OBJECTS)) old.deleted = true;
    return o;
  };
  const deleteBox = (b: Area | undefined) => {
    if (!b || b.deleted) return;
    b.deleted = true;
    allBoxes.splice(allBoxes.indexOf(b), 1);
  };
  let allLines: Level[] = [];
  const newLine = (l: Level) => {
    allLines.push(l);
    if (allLines.length > MAX_OBJECTS + 5) allLines = allLines.slice(allLines.length - MAX_OBJECTS);
  };

  let maxBull = NaN;
  let minBull = NaN;
  let bullCount = 0;
  let bullMitigated = 0;
  let maxBear = NaN;
  let minBear = NaN;
  let bearCount = 0;
  let bearMitigated = 0;
  let t = 0;
  const records: Fvg[] = [];
  const areas: Area[] = [];
  const plot0: number[] = [];
  const plot1: number[] = [];
  const plot2: number[] = [];
  const plot3: number[] = [];

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const time = bars[i].time;
    const k = latest[i];
    const bull = k >= 0 && bullAt[k];
    const bear = k >= 0 && bearAt[k];
    const fvg = k >= 0 ? fvgAt[k] : null;
    const isNew = fvg !== null && fvg.t !== t;

    if (bull && isNew) {
      if (dynamic) {
        maxBull = fvg!.max;
        minBull = fvg!.min;
      } else {
        areas.unshift(newBox({ left: i - 2, top: fvg!.max, right: i + cfg.extend, bottom: fvg!.min, bg: bullCss }));
      }
      records.unshift(fvg!);
      bullCount += 1;
      t = fvg!.t;
    } else if (dynamic) {
      maxBull = Math.max(Math.min(close, maxBull), minBull);
    }

    if (bear && fvg !== null && fvg.t !== t) {
      if (dynamic) {
        maxBear = fvg.max;
        minBear = fvg.min;
      } else {
        areas.unshift(newBox({ left: i - 2, top: fvg.max, right: i + cfg.extend, bottom: fvg.min, bg: bearCss }));
      }
      records.unshift(fvg);
      bearCount += 1;
      t = fvg.t;
    } else if (dynamic) {
      minBear = Math.min(Math.max(close, minBear), maxBear);
    }

    // Test for mitigation, from the oldest gap
    for (let j = records.length - 1; j >= 0; j--) {
      const get = records[j];
      if (get.isbull) {
        if (lt(close, get.min)) {
          if (cfg.mitigationLevels) newLine({ time1: get.t, time2: time, price: get.min, color: bullCss, dashed: true });
          if (!dynamic) deleteBox(areas.splice(j, 1)[0]);
          records.splice(j, 1);
          bullMitigated += 1;
        }
      } else if (gt(close, get.max)) {
        if (cfg.mitigationLevels) newLine({ time1: get.t, time2: time, price: get.max, color: bearCss, dashed: true });
        if (!dynamic) deleteBox(areas.splice(j, 1)[0]);
        records.splice(j, 1);
        bearMitigated += 1;
      }
    }

    // Unmitigated lines (barstate.islast)
    if (i === last && cfg.showLast > 0 && records.length > 0) {
      for (let j = 0; j <= Math.min(cfg.showLast - 1, records.length - 1); j++) {
        const get = records[j];
        const price = get.isbull ? get.min : get.max;
        newLine({ time1: get.t, time2: time, price, color: get.isbull ? bullCss : bearCss, dashed: false });
      }
    }

    plot0.push(maxBull);
    plot1.push(minBull);
    plot2.push(maxBear);
    plot3.push(minBear);
  }

  // Dashboard: the table exists also when it is not shown (no cell)
  const cellSize = cfg.textSize === 'Tiny' ? 'tiny' : cfg.textSize === 'Small' ? 'small' : 'normal';
  const solid = (c: string) => String(color.rgb(color.r(c), color.g(c), color.b(c)));
  const cells: TableCellData[] = [];
  if (cfg.showDash && n > 0) {
    const cell = (column: number, row: number, text: string, textColor: string) => {
      cells.push({ column, row, text, textColor, textSize: cellSize });
    };
    cell(1, 0, 'Bullish', solid(bullCss));
    cell(2, 0, 'Bearish', solid(bearCss));
    cell(0, 1, 'Count', '#FFFFFF');
    cell(0, 2, 'Mitigated', '#FFFFFF');
    cell(1, 1, str.tostring(bullCount), solid(bullCss));
    cell(2, 1, str.tostring(bearCount), solid(bearCss));
    cell(1, 2, str.tostring((bullMitigated / bullCount) * 100, 'percent'), solid(bullCss));
    cell(2, 2, str.tostring((bearMitigated / bearCount) * 100, 'percent'), solid(bearCss));
  }
  const table: TableData = {
    position: cfg.dashLoc === 'Bottom Left' ? 'bottom_left' : cfg.dashLoc === 'Top Right' ? 'top_right' : 'bottom_right',
    columns: 3,
    rows: 3,
    cells,
    bgColor: '#1E222D',
    borderColor: '#373A46',
    borderWidth: 1,
    frameColor: '#373A46',
    frameWidth: 1,
  };

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const P = (values: number[]) => values.map((value, i) => ({ time: bars[i].time, value }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: P(plot0), plot1: P(plot1), plot2: P(plot2), plot3: P(plot3) },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', colors: bars.map(() => bullCss) },
      { plot1: 'plot2', plot2: 'plot3', colors: bars.map(() => bearCss) },
    ],
    boxes: allBoxes.map((b) => ({
      time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent',
    })),
    lines: allLines.map((l) => ({
      time1: l.time1, price1: l.price, time2: l.time2, price2: l.price, color: l.color,
      ...(l.dashed ? { style: 'dashed' as const } : {}),
    })),
    tables: n > 0 ? [table] : [],
  };
}

export const FairValueGapLuxalgo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
