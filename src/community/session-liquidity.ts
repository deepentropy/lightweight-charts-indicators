/**
 * Session Liquidity
 *
 * Horizontal lines at the high and the low of up to three time spans of the day (sessions read in New York time),
 * to show the liquidity pools above and below them. For each session a new pair of lines starts on the first bar of
 * each day of its "Line Start Day Timezone". On the bar whose New York hour (and exchange-time minute) is the session
 * start the lines start at that bar's high and low; on every bar of the session they follow the highest high and the
 * lowest low and run to the next bar. A label with the session text sits at the middle of the lines (the low label
 * half a 10-bar standard deviation of the close below the low line); only the latest high and low labels of each
 * session stay. Nothing is drawn on timeframes of 60 minutes or more, or on bars more than "Display Only Days Back"
 * days before the current time.
 *
 * The current time (timenow) and the exchange time zone (bar time fields, timestamp(), minute(time)) come from the
 * chart context (fallbacks: the computer clock and UTC). At most 50 lines and 50 labels are kept.
 *
 * Reference: "Session Liquidity" by Infinity_Trading_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Infinity_Trading_
 */

import {
  ta, str, time, timeframe, color, line, label, resetDrawings, setDrawingBar, varDrawing, getSourceSeries,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, PineSize } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe } from '../anchor-period';
import { nowOf, timezoneOf, type ChartContext } from '../chart-context';

type DayZone = 'America/New_York' | 'Europe/London' | 'Asia/Shanghai';
type TextSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge' | 'Auto';
type LineStyleName = 'solid (─)' | 'dotted (┈)' | 'dashed (╌)';

export interface SessionLiquidityInputs {
  /** Only bars less than this many days before the current time draw */
  i_display_days_back: number;
  i_1st_session_high_line_toggle: boolean;
  i_1st_session_high_label_toggle: boolean;
  i_1st_session_low_line_toggle: boolean;
  i_1st_session_low_label_toggle: boolean;
  /** Time zone whose midnight starts new lines */
  i_1st_session_start_day: DayZone;
  /** Session in New York time */
  i_1st_session_time: string;
  i_1st_session_text_char: string;
  i_1st_session_text_color: string;
  i_1st_session_text_size: TextSize;
  i_1st_session_line_high_color: string;
  i_1st_session_line_high_style: LineStyleName;
  i_1st_session_line_high_width: number;
  i_1st_session_line_low_color: string;
  i_1st_session_line_low_style: LineStyleName;
  i_1st_session_line_low_width: number;
  i_2nd_session_high_line_toggle: boolean;
  i_2nd_session_high_label_toggle: boolean;
  i_2nd_session_low_line_toggle: boolean;
  i_2nd_session_low_label_toggle: boolean;
  i_2nd_session_start_day: DayZone;
  i_2nd_session_time: string;
  i_2nd_session_text_char: string;
  i_2nd_session_text_color: string;
  i_2nd_session_text_size: TextSize;
  i_2nd_session_line_high_color: string;
  i_2nd_session_line_high_style: LineStyleName;
  i_2nd_session_line_high_width: number;
  i_2nd_session_line_low_color: string;
  i_2nd_session_line_low_style: LineStyleName;
  i_2nd_session_line_low_width: number;
  i_3rd_session_high_line_toggle: boolean;
  i_3rd_session_high_label_toggle: boolean;
  i_3rd_session_low_line_toggle: boolean;
  i_3rd_session_low_label_toggle: boolean;
  i_3rd_session_start_day: DayZone;
  i_3rd_session_time: string;
  i_3rd_session_text_char: string;
  i_3rd_session_text_color: string;
  i_3rd_session_text_size: TextSize;
  i_3rd_session_line_high_color: string;
  i_3rd_session_line_high_style: LineStyleName;
  i_3rd_session_line_high_width: number;
  i_3rd_session_line_low_color: string;
  i_3rd_session_line_low_style: LineStyleName;
  i_3rd_session_line_low_width: number;
}

export const defaultInputs: SessionLiquidityInputs = {
  i_display_days_back: 15,
  i_1st_session_high_line_toggle: true,
  i_1st_session_high_label_toggle: true,
  i_1st_session_low_line_toggle: true,
  i_1st_session_low_label_toggle: true,
  i_1st_session_start_day: 'Asia/Shanghai',
  i_1st_session_time: '1900-0259',
  i_1st_session_text_char: 'First Session',
  i_1st_session_text_color: '#131722',
  i_1st_session_text_size: 'Normal',
  i_1st_session_line_high_color: '#00BCD4',
  i_1st_session_line_high_style: 'solid (─)',
  i_1st_session_line_high_width: 2,
  i_1st_session_line_low_color: '#00BCD4',
  i_1st_session_line_low_style: 'solid (─)',
  i_1st_session_line_low_width: 2,
  i_2nd_session_high_line_toggle: true,
  i_2nd_session_high_label_toggle: true,
  i_2nd_session_low_line_toggle: true,
  i_2nd_session_low_label_toggle: true,
  i_2nd_session_start_day: 'Europe/London',
  i_2nd_session_time: '0300-0929',
  i_2nd_session_text_char: 'Second Session',
  i_2nd_session_text_color: '#131722',
  i_2nd_session_text_size: 'Normal',
  i_2nd_session_line_high_color: '#F2A03A',
  i_2nd_session_line_high_style: 'solid (─)',
  i_2nd_session_line_high_width: 2,
  i_2nd_session_line_low_color: '#F2A03A',
  i_2nd_session_line_low_style: 'solid (─)',
  i_2nd_session_line_low_width: 2,
  i_3rd_session_high_line_toggle: false,
  i_3rd_session_high_label_toggle: false,
  i_3rd_session_low_line_toggle: false,
  i_3rd_session_low_label_toggle: false,
  i_3rd_session_start_day: 'America/New_York',
  i_3rd_session_time: '0930-1559',
  i_3rd_session_text_char: 'Third Session',
  i_3rd_session_text_color: '#131722',
  i_3rd_session_text_size: 'Normal',
  i_3rd_session_line_high_color: '#467DEB',
  i_3rd_session_line_high_style: 'solid (─)',
  i_3rd_session_line_high_width: 2,
  i_3rd_session_line_low_color: '#467DEB',
  i_3rd_session_line_low_style: 'solid (─)',
  i_3rd_session_line_low_width: 2,
};

const TOOLTIP_1 = 'If the user increments/decrements this integer field and nothing happens, that is because the user is moving throught a weekend or holiday. Please continue incrementing/decrementing and after 2-3 clicks the user will see backgrounds/labels appear or disappear. The algorithm for Days Back is counting every 24-hour period which is why this behavior occurs.';
const TOOLTIP_2 = "To make the lines start over each day the code must know when to start the day. Since the user is entering times, a static start time won't work. Use midnight EST in the three timezone options as the starting point. If the users lines fits in the Asian Session then choose Asia/Shanghai. If the lines are within the London Session then choose Europe/London. And the same goes for the New York Session.";
const TOOLTIP_3 = "Please specify a start & end time within the same 'day' where the 'day' starts at midnight of the timezone selected by the user in the dropdown Start Day Timezone";
const ZONES: DayZone[] = ['America/New_York', 'Europe/London', 'Asia/Shanghai'];
const SIZES: TextSize[] = ['Tiny', 'Small', 'Normal', 'Large', 'Huge', 'Auto'];
const STYLES: LineStyleName[] = ['solid (─)', 'dotted (┈)', 'dashed (╌)'];
const Q = ' ';

/** The 15 inputs of one session group, in the original order */
function sessionInputs(k: '1st' | '2nd' | '3rd', n: number, group: string): InputConfig[] {
  const p = `i_${k}_session_` as const;
  const d = defaultInputs as unknown as Record<string, string | number | boolean>;
  const row = (key: string, rest: Omit<InputConfig, 'id' | 'defval'>): InputConfig =>
    ({ id: p + key, defval: d[p + key], group, ...rest }) as InputConfig;
  return [
    row('high_line_toggle', { type: 'bool', title: `High Line On/Off${Q.repeat(6)}`, inline: `high-${n}` }),
    row('high_label_toggle', { type: 'bool', title: 'High Label On/Off', inline: `high-${n}` }),
    row('low_line_toggle', { type: 'bool', title: `Low Line On/Off${Q.repeat(6)}`, inline: `low-${n}` }),
    row('low_label_toggle', { type: 'bool', title: 'Low Label On/Off', inline: `low-${n}` }),
    row('start_day', { type: 'string', title: 'Line Start Day Timezone', options: ZONES, tooltip: TOOLTIP_2 }),
    row('time', { type: 'session', title: 'Line Start & End Times', tooltip: TOOLTIP_3 }),
    row('text_char', { type: 'string', title: `Text Style${Q.repeat(5)}`, inline: `text${n}` }),
    row('text_color', { type: 'color', title: '', inline: `text${n}` }),
    row('text_size', { type: 'string', title: '', options: SIZES, inline: `text${n}` }),
    row('line_high_color', { type: 'color', title: `Line Style - High${Q.repeat(2)}`, inline: `line-high${n}` }),
    row('line_high_style', { type: 'string', title: '', options: STYLES, inline: `line-high${n}` }),
    row('line_high_width', { type: 'int', title: '', min: 1, max: 20, inline: `line-high${n}` }),
    row('line_low_color', { type: 'color', title: `Line Style - Low${Q.repeat(2)}`, inline: `line-low${n}` }),
    row('line_low_style', { type: 'string', title: '', options: STYLES, inline: `line-low${n}` }),
    row('line_low_width', { type: 'int', title: '', min: 1, max: 20, inline: `line-low${n}` }),
  ];
}

export const inputConfig: InputConfig[] = [
  {
    id: 'i_display_days_back', type: 'int', title: 'Display Only 🔢 Days Back', defval: 15, min: 1, max: 80,
    group: 'Limit Past Lines', tooltip: TOOLTIP_1,
  },
  ...sessionInputs('1st', 1, 'First Session Lines'),
  ...sessionInputs('2nd', 2, 'Second Session Lines'),
  ...sessionInputs('3rd', 3, 'Third Session Lines'),
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Session Liquidity',
  shortTitle: 'Session Liquidity',
  overlay: true,
};

const NY = 'America/New_York';
const MS_IN_DAY = 24 * 60 * 60 * 1000;
/** color.new(#131722, 100) */
const LABEL_BG = String(color.new('#131722', 100));

const lineStyleOf = (s: string): 'solid' | 'dotted' | 'dashed' =>
  s === 'dotted (┈)' ? 'dotted' : s === 'dashed (╌)' ? 'dashed' : 'solid';
const textSizeOf = (s: string): PineSize =>
  (({ Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large', Huge: 'huge', Auto: 'auto' }) as Record<string, PineSize>)[s];

export function calculate(
  bars: Bar[],
  inputs: Partial<SessionLiquidityInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tz = timezoneOf(chart);
  const interval = barInterval(bars);
  const toMs = n > 0 && bars[0].time >= 1e12 ? 1 : 1000;
  const barMs = interval * toMs;
  const tfString = chartTimeframe(bars, chart);
  const tf = tfString ? timeframe.info(tfString) : null;
  const isIntraday = tf?.isintraday ?? false;
  const minutesBelow60 = (tf?.isminutes ?? false) && (tf?.multiplier ?? 0) < 60;
  const stdev = ta.stdev(getSourceSeries(bars, 'close'), 10).toArray().map((v) => v ?? NaN);

  // DAYS BACK: timestamp() of the fields of timenow and of the bar time, in the exchange time zone
  const now = nowOf(chart);
  const stamp = (t: number) => time.timestamp(tz, time.year(t, tz), time.month(t, tz), time.dayofmonth(t, tz),
    time.hour(t, tz), time.minute(t, tz), time.second(t, tz));
  const lastBarDate = stamp(now);

  resetDrawings({ line: 50, label: 50 });

  /** session_liquidity_lines_function(): one call site with its own `var` variables */
  const session = (k: '1st' | '2nd' | '3rd') => {
    const get = <T>(key: string) => (cfg as unknown as Record<string, T>)[`i_${k}_session_${key}`];
    const highLineOn = get<boolean>('high_line_toggle');
    const lowLineOn = get<boolean>('low_line_toggle');
    const highLabelOn = get<boolean>('high_label_toggle');
    const lowLabelOn = get<boolean>('low_label_toggle');
    const sessionTime = get<string>('time');
    const startDay = get<string>('start_day');
    const highColor = get<string>('line_high_color');
    const lowColor = get<string>('line_low_color');
    const highStyle = lineStyleOf(get<string>('line_high_style'));
    const lowStyle = lineStyleOf(get<string>('line_low_style'));
    const highWidth = get<number>('line_high_width');
    const lowWidth = get<number>('line_low_width');
    const textColor = get<string>('text_color');
    const textChar = get<string>('text_char');
    const textSize = textSizeOf(get<string>('text_size'));
    const startHour = str.tonumber(sessionTime.substring(0, 2)) ?? NaN;
    const startMinutes = str.tonumber(sessionTime.substring(2, 4)) ?? NaN;

    let sessionHigh = 0.0;
    let sessionLow = 0.0;
    const lineLow = varDrawing<Line>();
    const lineHigh = varDrawing<Line>();
    const labelLow = varDrawing<Label>();
    const labelHigh = varDrawing<Label>();
    let prevDay = NaN;

    return (i: number, inRange: boolean) => {
      const b = bars[i];
      const t = b.time * toMs;
      // newDay...StartLine: dayofmonth(time, zone) != dayofmonth(time, zone)[1] and timeframe.isintraday
      const day = time.dayofmonth(t, startDay);
      const newDay = !isNaN(prevDay) && day !== prevDay && isIntraday;
      prevDay = day;
      // label.delete(session_label_*[1]): the value of the variable on the bar before
      const prevLabelHigh = labelHigh.value;
      const prevLabelLow = labelLow.value;

      const inWindow = time.inSession(t, sessionTime, NY, barMs);
      const startTime = time.hour(t, NY) === startHour && time.minute(t, tz) === startMinutes;
      const standardized = stdev[i] / 2;

      if (!inRange || !minutesBelow60) return;
      if (newDay) {
        if (highLineOn) lineHigh.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', highColor, highStyle, highWidth);
        if (lowLineOn) lineLow.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', lowColor, lowStyle, lowWidth);
        return;
      }
      if (startTime) {
        sessionHigh = b.high;
        sessionLow = b.low;
        if (highLineOn && lineHigh.value) {
          line.set_x1(lineHigh.value, i);
          line.set_y1(lineHigh.value, sessionHigh);
          line.set_x2(lineHigh.value, i + 1);
          line.set_y2(lineHigh.value, sessionHigh);
        }
        if (lowLineOn && lineLow.value) {
          line.set_x1(lineLow.value, i);
          line.set_y1(lineLow.value, sessionLow);
          line.set_x2(lineLow.value, i + 1);
          line.set_y2(lineLow.value, sessionLow);
        }
      }
      if (inWindow) {
        sessionHigh = Math.max(sessionHigh, b.high);
        sessionLow = Math.min(sessionLow, b.low);
        if (highLineOn && lineHigh.value) {
          line.set_y1(lineHigh.value, sessionHigh);
          line.set_x2(lineHigh.value, i + 1);
          line.set_y2(lineHigh.value, sessionHigh);
        }
        if (lowLineOn && lineLow.value) {
          line.set_y1(lineLow.value, sessionLow);
          line.set_x2(lineLow.value, i + 1);
          line.set_y2(lineLow.value, sessionLow);
        }
        // x_middle = (line.get_x2(session_line_low) - line.get_x1(session_line_low)) / 2 (na without a low line)
        const low = lineLow.value;
        const xMiddle = low ? (line.get_x2(low) - line.get_x1(low)) / 2 : NaN;
        if (highLabelOn) {
          const price = lineHigh.value ? line.get_price(lineHigh.value, i) : NaN;
          labelHigh.value = label.new(i - xMiddle, price, textChar, 'bar_index', 'price', LABEL_BG, 'label_down',
            textColor, textSize, 'center', str.tostring(price));
          if (prevLabelHigh) label.delete(prevLabelHigh);
        }
        if (lowLabelOn) {
          const price = low ? line.get_price(low, i) : NaN;
          labelLow.value = label.new(i - xMiddle, price - standardized, textChar, 'bar_index', 'price', LABEL_BG,
            'label_down', textColor, textSize, 'center', str.tostring(price));
          if (prevLabelLow) label.delete(prevLabelLow);
        }
      }
    };
  };

  const first = session('1st');
  const second = session('2nd');
  const third = session('3rd');
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const daysLeft = Math.floor((lastBarDate - stamp(bars[i].time * toMs)) / MS_IN_DAY);
    const inRange = daysLeft < cfg.i_display_days_back;
    first(i, inRange);
    second(i, inRange);
    third(i, inRange);
  }
  setDrawingBar(null);

  const T = (index: number) => barTime(bars, index, interval);
  // a line or a label with an na coordinate is not drawn
  const lines: LineDrawingData[] = line.all()
    .filter((l) => ![l.x1, l.y1, l.x2, l.y2].some((v) => Number.isNaN(v)))
    .map((l) => ({
      time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width,
      ...(l.style && l.style !== 'solid' ? { style: l.style } : {}),
    }));
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: LABEL_BG, textColor: String(l.textcolor),
      size: l.size as PineSize, tooltip: l.tooltip ?? '',
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
  };
}

export const SessionLiquidity = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
