/**
 * RVOL Relative Volume - Intraday
 *
 * Relative volume at the same time of day. The cumulative volume of the current session is kept for each minute of
 * a 48-hour day (UTC hour and minute of the bar; a session that wraps past midnight goes on in the second 24 hours),
 * with one such row for each of the last `Number of Days` sessions plus the current one. RVOL is the current
 * cumulative volume divided by the average of the cumulative volumes of the past sessions at the same minute (when a
 * past session has no value there, the last earlier minute of that session with a value). 0 while that average is 0.
 * `Daylight saving on last weekend` adds hours to the bar hour in the last week of the chart (the week of the last
 * bar). A dashed vertical line, extended right, marks the first bar of each session.
 *
 * Plots: RVOL as columns (green shades on up bars, red shades on down bars: channel max(min(RVOL * 130, 255), 130)),
 * and a zero line (red, blue on a bar without volume). Levels at 0, 0.5, 1, 1.5 and 2.
 * The chart timeframe must be intraday and at least 1 minute, else the script stops with its error.
 *
 * Reference: "RVOL Relative Volume - Intraday" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import {
  color, timeframe, line, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar,
} from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, periodChanges, periodStarts } from '../anchor-period';

export interface RvolRelativeVolumeIntradayInputs {
  /** Number of past sessions in the average */
  period: number;
  /** Hours added to the bar hour in the last week of the chart */
  dls: number;
}

export const defaultInputs: RvolRelativeVolumeIntradayInputs = {
  period: 5,
  dls: 0,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'period', type: 'int', title: 'Number of Days', defval: 5, min: 1, max: 55,
    tooltip: 'The more recent the data is, the more relevant it is.  Longer period baselines have lower volumes. This creates too much noise when we generate our results.',
  },
  {
    id: 'dls', type: 'int', title: 'Daylight saving on last weekend', defval: 0,
    tooltip: 'Please enter ±1 if Daylight saving last weekend, Otherwise please keep it 0',
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVOL', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Zero', color: '#FF5252', lineWidth: 1 },
];

/** hline(0, solid), hline(0.5, dotted), hline(1, dashed), hline(1.5, dotted), hline(2, dashed): default colour */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, title: 'Level', color: '#787B86', linestyle: 'solid' },
  { id: 'hline_1', price: 0.5, title: 'Level', color: '#787B86', linestyle: 'dotted' },
  { id: 'hline_2', price: 1, title: 'Level', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_3', price: 1.5, title: 'Level', color: '#787B86', linestyle: 'dotted' },
  { id: 'hline_4', price: 2, title: 'Level', color: '#787B86', linestyle: 'dashed' },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'RVOL Relative Volume - Intraday',
  shortTitle: 'RVOL',
  overlay: false,
};

const DAY_SLOTS = 2880; // 48 hours of minutes

/** Pine `==` / `!=` with 0: within 1e-10, false on na */
const isZero = (x: number) => !Number.isNaN(x) && Math.abs(x) <= 1e-10;
const notZero = (x: number) => !Number.isNaN(x) && Math.abs(x) > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<RvolRelativeVolumeIntradayInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[] } {
  const { period, dls } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const result = (plot0: IndicatorResult['plots'][string], plot1: IndicatorResult['plots'][string], lines: LineDrawingData[]) => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots: { plot0, plot1 },
    hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
    lines,
  });
  const tf = chartTimeframe(bars, chart);
  if (n === 0 || tf === '') return result([], [], []);
  const info = timeframe.info(tf);
  // if not timeframe.isintraday or timeframe.isseconds: runtime.error(...)
  if (!info.isintraday || info.isseconds) {
    throw new Error('Chart time frame must be less than 1 Day and greater/equal 1 minute');
  }

  const toMs = bars[0].time >= 1e12 ? 1 : 1000;
  // ta.change(time('D')) != 0 (false on the first bar and around an na time('D'))
  const newdays = periodChanges(bars, 'D', chart);
  // lbi == cbi: the weekly bar of the bar is the last weekly bar (request.security 'W' last_bar_index / bar_index)
  const weeks = periodStarts(bars, 'W', chart);
  const lastWeek = weeks[n - 1];

  const size = DAY_SLOTS * (period + 1);
  // var rvols = array.new_float(24 * 60 * 2 * (period + 1), 0)
  const rvols = new Float64Array(size);
  const outOfBounds = (idx: number) => new Error(`Index ${idx} is out of bounds, array size is ${size}`);
  /** array.get: an na index gives na */
  const get = (idx: number): number => {
    if (Number.isNaN(idx)) return NaN;
    if (idx < 0 || idx >= size) throw outOfBounds(idx);
    return rvols[idx];
  };

  resetDrawings({ line: 500 });
  let plus24 = 0;
  let ctimeRawPrev = NaN;
  let ctimePrev = NaN;
  const plot0: IndicatorResult['plots'][string] = [];
  const plot1: IndicatorResult['plots'][string] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const tMs = b.time * toMs;
    const hour = (Math.floor(tMs / 3600000) % 24) + (weeks[i] === lastWeek ? dls : 0);
    const minute = Math.floor(tMs / 60000) % 60;
    const newday = newdays[i];

    if (newday) {
      plus24 = 0;
      // 2880 x (array.shift + array.push(0))
      rvols.copyWithin(0, DAY_SLOTS);
      rvols.fill(0, size - DAY_SLOTS);
    }
    const ctimeRaw = hour * 60 + minute;
    if (ctimeRaw < ctimeRawPrev && !newday) plus24 = 1440;
    const ctime = ctimeRaw + plus24;

    if (newday) line.new(i, 0, i, 1, 'bar_index', 'right', '#787B86', 'dashed');

    const volume = b.volume ?? NaN;
    const setIdx = period * DAY_SLOTS + ctime;
    if (setIdx < 0 || setIdx >= size) throw outOfBounds(setIdx);
    rvols[setIdx] = newday ? volume : get(period * DAY_SLOTS + ctimePrev) + volume;

    // relativeVolume()
    let hvol = 0;
    for (let x = 0; x <= period - 1; x++) {
      let svol = get(x * DAY_SLOTS + ctime);
      if (isZero(svol)) {
        // for y = x * 2880 + ctime to x * 2880 (counts down)
        const from = x * DAY_SLOTS + ctime;
        const to = x * DAY_SLOTS;
        const step = from >= to ? -1 : 1;
        for (let y = from; step < 0 ? y >= to : y <= to; y += step) {
          svol = get(y);
          if (notZero(svol)) break;
        }
      }
      hvol += svol / period;
    }
    const cvol = get(period * DAY_SLOTS + ctime);
    const rvol = isZero(hvol) ? 0 : cvol / hvol;

    const ch = Math.max(Math.min(rvol * 130, 255), 130);
    const up = b.close - b.open >= -1e-10;
    plot0.push({
      time: b.time,
      value: Number.isFinite(rvol) ? rvol : NaN,
      color: String(up ? color.rgb(0, ch, 0, 0) : color.rgb(ch, 0, 0, 0)),
    });
    plot1.push({ time: b.time, value: 0, color: Number.isNaN(volume) ? '#2962FF' : '#FF5252' });

    ctimeRawPrev = ctimeRaw;
    ctimePrev = ctime;
  }
  setDrawingBar(null);

  return result(plot0, plot1, drawingOutputs(bars).lines ?? []);
}

export const RvolRelativeVolumeIntraday = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, drawingKinds,
};
