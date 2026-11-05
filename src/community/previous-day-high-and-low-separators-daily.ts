/**
 * Previous Day High and Low + Separators Daily/Weekly
 *
 * On the first bar of each day (the day of week of the bar time plus 'UTC Offset' changes): a vertical separator
 * line through the bar (extended both ways), a transparent box with the full weekday name at the top (from the R3 to
 * the S2 level of the Traditional pivot points), which grows to the right until the day ends, and a label at the S3
 * level with the date and time of the bar ("Mon 5 Jan '26 09:30"). On the first bar of each week (week of year
 * change): a thicker grey separator line. The pivot levels are those of the previous period of an automatic
 * timeframe (a day below 30-minute charts, a week on hourly charts, a month on daily charts, a year on weekly and
 * monthly charts, else a week); when the pivot changes, every box and label made so far moves to the new levels.
 *
 * Previous day high and low: a line and a label ("HOD" above, "LOD" below) from the bar of the high / low of the
 * previous day to the current bar (bar times), moved on the first bar of each day.
 *
 * At most 500 lines, 500 boxes and 500 labels are kept (the two previous-day lines and labels are always kept).
 * The 'Style' and 'Width' inputs of the previous-day lines are not used by the original (solid lines, width 1).
 *
 * Pivot levels: the port calls the pivot point levels function of oakscriptjs, which takes the levels from the
 * high, low and close of the anchor bar, while the original takes them from the previous period (from the anchor
 * before to the bar before the anchor): the boxes and the date labels are at other prices until the library follows
 * that rule.
 *
 * Chart values read: the exchange time zone (day of week, week of year, date and time of the labels; UTC without a
 * chart context) and the chart timeframe (`timeframe` of the chart context, else from the bar spacing).
 *
 * Reference: "Previous Day High and Low + Separators Daily/Weekly" by Algoryze
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Algoryze
 */

import {
  color, str, time as ptime, timeframe, taCore, line, box, label, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Box, type Label, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData } from '../types';
import { chartTimeframe, periodChanges } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';

export interface PreviousDayHighAndLowSeparatorsDailyInputs {
  /** UTC Offset (in hours), added to the bar time for the day / week changes and the label dates */
  utcOffset: number;
  dailySeparatorColor: string;
  dailySeparatorStyleInput: 'Solid' | 'Dotted';
  dailySeparatorWidthInput: number;
  dailySeparatorLabelTextColor: string;
  weeklySeparatorColorInput: string;
  weeklySeparatorStyleInput: 'Solid' | 'Dotted';
  weeklySeparatorWidthInput: number;
  prevDayHLColorInput: string;
  prevDayHLTextColorInput: string;
  /** Not used by the original */
  prevDayHLStyleInput: 'Solid' | 'Dotted';
  /** Not used by the original */
  prevDayHLWidthInput: number;
}

export const defaultInputs: PreviousDayHighAndLowSeparatorsDailyInputs = {
  utcOffset: 0,
  dailySeparatorColor: '#FF9800',
  dailySeparatorStyleInput: 'Solid',
  dailySeparatorWidthInput: 1,
  dailySeparatorLabelTextColor: '#FFFFFF',
  weeklySeparatorColorInput: '#787B86',
  weeklySeparatorStyleInput: 'Solid',
  weeklySeparatorWidthInput: 3,
  prevDayHLColorInput: '#787B86',
  prevDayHLTextColorInput: '#FF9800',
  prevDayHLStyleInput: 'Dotted',
  prevDayHLWidthInput: 3,
};

const DAILY = 'Daily Separator';
const WEEKLY = 'Weekly Separator';
const PREV = 'Previous Day H&L';

export const inputConfig: InputConfig[] = [
  { id: 'utcOffset', type: 'int', title: 'UTC Offset (in hours)', defval: 0, min: -12, max: 12 },
  { id: 'dailySeparatorColor', type: 'color', title: 'Color', defval: '#FF9800', group: DAILY },
  { id: 'dailySeparatorStyleInput', type: 'string', title: 'Style', defval: 'Solid', options: ['Solid', 'Dotted'], group: DAILY },
  { id: 'dailySeparatorWidthInput', type: 'int', title: 'Width', defval: 1, min: 1, group: DAILY },
  { id: 'dailySeparatorLabelTextColor', type: 'color', title: 'Label Text Color', defval: '#FFFFFF', group: DAILY },
  { id: 'weeklySeparatorColorInput', type: 'color', title: 'Color', defval: '#787B86', group: WEEKLY },
  { id: 'weeklySeparatorStyleInput', type: 'string', title: 'Style', defval: 'Solid', options: ['Solid', 'Dotted'], group: WEEKLY },
  { id: 'weeklySeparatorWidthInput', type: 'int', title: 'Width', defval: 3, min: 1, group: WEEKLY },
  { id: 'prevDayHLColorInput', type: 'color', title: 'Color', defval: '#787B86', group: PREV },
  { id: 'prevDayHLTextColorInput', type: 'color', title: 'Text Color', defval: '#FF9800', group: PREV },
  { id: 'prevDayHLStyleInput', type: 'string', title: 'Style', defval: 'Dotted', options: ['Solid', 'Dotted'], group: PREV },
  { id: 'prevDayHLWidthInput', type: 'int', title: 'Width', defval: 3, min: 1, group: PREV },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Previous Day High and Low + Separators Daily/Weekly',
  shortTitle: 'Previous Day High and Low + Separators Daily/Weekly',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_FULL = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
/** `a != b` of Pine: false when one side is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<PreviousDayHighAndLowSeparatorsDailyInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tz = timezoneOf(chart);
  const msUnit = n > 0 && bars[0].time >= 1e12;
  const ms = (t: number) => (msUnit ? t : t * 1000);
  const offsetMs = Math.trunc(cfg.utcOffset) * 60 * 60 * 1000;
  const dailyStyle = cfg.dailySeparatorStyleInput === 'Solid' ? 'solid' : 'dotted';
  const weeklyStyle = cfg.weeklySeparatorStyleInput === 'Solid' ? 'solid' : 'dotted';
  const transpColor = String(color.new('#FFFFFF', 100));

  // tfAuto: the anchor timeframe of the pivot levels
  const chartTf = chartTimeframe(bars, chart);
  let tfAuto = 'W';
  if (chartTf !== '') {
    const info = timeframe.info(chartTf);
    const mult = info.multiplier;
    const isHourly = info.isminutes && mult % 60 === 0;
    const isMinuteLessThan30 = info.isminutes && mult < 30;
    tfAuto = info.isseconds || isMinuteLessThan30 ? 'D'
      : isHourly ? 'W'
      : info.isdaily ? 'M'
      : info.isweekly || info.ismonthly ? '12M'
      : 'W';
  }
  // ta.pivot_point_levels('Traditional', timeframe.change(tfAuto)): [P, R1, S1, R2, S2, R3, S3, ...]
  const levels = taCore.pivot_point_levels('Traditional', periodChanges(bars, tfAuto, chart), false,
    bars.map((b) => b.high), bars.map((b) => b.low), bars.map((b) => b.close)) as number[][];
  const pivot = levels[0];
  const boxTop = levels[5];
  const boxBottom = levels[4];
  const labelLevel = levels[6];

  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: MAX_OBJECTS });
  const topBox = varDrawing<Box>();
  const topBoxes: Box[] = [];
  const bottomLabels: Label[] = [];
  const highLine = varDrawing<Line>();
  const highLabel = varDrawing<Label>();
  const lowLine = varDrawing<Line>();
  const lowLabel = varDrawing<Label>();

  // _getPreviousDayHighLow() state
  let prevDayHigh = NaN;
  let prevDayHighTime = NaN;
  let prevDayLow = NaN;
  let prevDayLowTime = NaN;
  let dayHigh = NaN;
  let dayHighTime = NaN;
  let dayLow = NaN;
  let dayLowTime = NaN;

  let prevDow = NaN;
  let prevWeek = NaN;
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = ms(b.time);
    const dow = ptime.dayofweek(t + offsetMs, tz);
    const week = ptime.weekofyear(t + offsetMs, tz);
    const isNewDay = ne(dow, prevDow);
    const isNewWeek = ne(week, prevWeek);
    const isNewPivot = i > 0 && ne(pivot[i], pivot[i - 1]);

    if (isNewDay) {
      line.new(i, b.low, i, b.high, 'bar_index', 'both', cfg.dailySeparatorColor, dailyStyle, cfg.dailySeparatorWidthInput);
      topBox.value = box.new(i, boxTop[i], i, boxBottom[i], transpColor, 1, 'solid', 'none', 'bar_index', transpColor,
        WEEKDAYS_FULL[dow], 'small', cfg.dailySeparatorColor, 'center', 'top');
      topBoxes.push(topBox.value);
      const tl = t + offsetMs;
      const text = `${WEEKDAYS_SHORT[ptime.dayofweek(tl, tz)]} ${ptime.dayofmonth(tl, tz)} ${MONTHS[ptime.month(tl, tz)]}`
        + ` '${str.substring(String(ptime.year(tl, tz)), 2)} ${str.format_time(t, 'HH:mm', tz)}`;
      bottomLabels.push(label.new(i, labelLevel[i], text, 'bar_index', 'price', cfg.dailySeparatorColor, 'label_up',
        cfg.dailySeparatorLabelTextColor));
    } else if (topBox.value) {
      box.set_right(topBox.value, i);
    }

    if (isNewPivot && topBoxes.length > 0) {
      // a box or label deleted by the maximum count is na for good (x getter na, setters do nothing): the pairs
      // whose box and label are both gone are dropped, so that this loop does not grow with the history
      let kept = 0;
      for (let k = 0; k < topBoxes.length; k++) {
        if (Number.isNaN(box.get_left(topBoxes[k])) && Number.isNaN(label.get_x(bottomLabels[k]))) continue;
        box.set_top(topBoxes[k], boxTop[i]);
        box.set_bottom(topBoxes[k], boxBottom[i]);
        label.set_y(bottomLabels[k], labelLevel[i]);
        topBoxes[kept] = topBoxes[k];
        bottomLabels[kept] = bottomLabels[k];
        kept++;
      }
      topBoxes.length = kept;
      bottomLabels.length = kept;
    }

    if (isNewWeek) {
      line.new(i, b.low, i, b.high, 'bar_index', 'both', cfg.weeklySeparatorColorInput, weeklyStyle, cfg.weeklySeparatorWidthInput);
    }

    // _getPreviousDayHighLow(): its own day change (same values as isNewDay)
    if (i === 0) {
      prevDayHigh = b.high;
      prevDayHighTime = t;
      prevDayLow = b.low;
      prevDayLowTime = t;
      dayHigh = b.high;
      dayHighTime = t;
      dayLow = b.low;
      dayLowTime = t;
    }
    if (isNewDay) {
      // dayHigh[1] ... are the values at the end of the bar before: read them before the reset
      prevDayHigh = dayHigh;
      prevDayHighTime = dayHighTime;
      prevDayLow = dayLow;
      prevDayLowTime = dayLowTime;
      dayHigh = b.high;
      dayHighTime = t;
      dayLow = b.low;
      dayLowTime = t;
    } else if (i > 0) {
      if (lt(dayHigh, b.high)) {
        dayHigh = b.high;
        dayHighTime = t;
      }
      if (lt(b.low, dayLow)) {
        dayLow = b.low;
        dayLowTime = t;
      }
    }

    if (i === 0) {
      highLine.value = line.new(t, prevDayHigh, t, prevDayHigh, 'bar_time', 'none', cfg.prevDayHLColorInput, 'solid', 1);
      highLabel.value = label.new(t, prevDayHigh, 'HOD', 'bar_time', 'price', transpColor, 'label_down', cfg.prevDayHLTextColorInput);
      lowLine.value = line.new(t, prevDayLow, t, prevDayLow, 'bar_time', 'none', cfg.prevDayHLColorInput, 'solid', 1);
      lowLabel.value = label.new(t, prevDayLow, 'LOD', 'bar_time', 'price', transpColor, 'label_up', cfg.prevDayHLTextColorInput);
    }
    if (isNewDay) {
      line.set_xy1(highLine.value!, prevDayHighTime, prevDayHigh);
      line.set_xy2(highLine.value!, prevDayHighTime, prevDayHigh);
      label.set_xy(highLabel.value!, prevDayHighTime, prevDayHigh);
      line.set_xy1(lowLine.value!, prevDayLowTime, prevDayLow);
      line.set_xy2(lowLine.value!, prevDayLowTime, prevDayLow);
      label.set_xy(lowLabel.value!, prevDayLowTime, prevDayLow);
    } else {
      line.set_x2(highLine.value!, t);
      label.set_x(highLabel.value!, t);
      line.set_x2(lowLine.value!, t);
      label.set_x(lowLabel.value!, t);
    }

    prevDow = dow;
    prevWeek = week;
  }
  setDrawingBar(null);

  const out = drawingOutputs(bars, msUnit ? 'ms' : 's');
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: out.lines ?? [],
    boxes: out.boxes ?? [],
    labels: out.labels ?? [],
  };
}

export const PreviousDayHighAndLowSeparatorsDaily = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
