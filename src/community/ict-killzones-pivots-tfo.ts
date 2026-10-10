/**
 * ICT Killzones & Pivots [TFO]
 *
 * Up to six killzones (ASIA, LNDN, NYAM, NYL, NYPM, RTH), each with its own hours read in the time zone of the
 * input 'Timezone'. On chart timeframes up to 'Timeframe Limit':
 * - Killzone: a box from the first to the last bar of the zone, from its high to its low
 * - Pivots: a line at the high and at the low of the zone (and an optional midpoint line), with a label. The lines
 *   go on after the zone until the price goes through them. The script counts how often each pivot is hit
 * - Range levels: lines above and below the open of the zone, at multiples of the average (or median, or standard
 *   deviation) range of the last zones
 * - Day / week / month: the open, the previous high / low / midline and a divider line; labels at the same price
 *   are merged on the last bar
 * - Opening prices: a horizontal line from the open of the bar at each listed time
 * - Timestamps: a vertical line on the bar at each listed time
 * - Day of week labels (characters along the top or the bottom of the chart)
 * - A data table on the last bar: the current range of each killzone and the hit rates
 *
 * Pine details kept: in the timestamp and opening price lists, an entry is not drawn on a bar that follows a bar of
 * the last entry of the list (the previous bar test of the loop reads the last entry).
 *
 * Limits of the port:
 * - New days / weeks / months come from the UTC calendar and the bars (see anchor-period): equal on UTC symbols
 *   and on symbols whose trading day is inside one UTC day.
 * - The original rounds range levels, the average range of the table and the prices of merged labels with the
 *   symbol price tick. Bars carry no symbol info: the port uses a tick of 0.01.
 * - chart.fg_color / chart.bg_color: the port has no chart theme and uses the colours of a dark chart
 *   (#DBDBDB text, #0F0F0F background).
 * - Drawings whose price is na (the previous high / low of the first period) are not in the result.
 * - The chart timeframe is read from the bars (the most frequent gap between two bars). With fewer than 2 bars it
 *   is not known and only the table header is given.
 * - With a time zone that has summer time (America/New_York), on the day the clocks go forward the original puts
 *   the bars from 01:00 to 01:59 inside a session that starts at 02:00; the session test of oakscriptjs does not.
 *   The other days are equal.
 *
 * Reference: "ICT Killzones & Pivots [TFO]" by tradeforopp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tradeforopp
 */

import { array, color, math, str, timeframe, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, periodStarts } from '../anchor-period';
import type { BoxData, LabelData, LabelStyle, LineDrawingData, MarkerData, PineSize, TableCellData, TableData, TablePosition } from '../types';

type LineType = 'Solid' | 'Dotted' | 'Dashed';
type SizeName = 'Auto' | 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
type History = 'Most Recent' | 'Session Limit' | 'Unlimited';

export interface IctKillzonesPivotsTfoInputs {
  show_kz: boolean;
  /** Session Limit */
  max_days: number;
  use_kz1: boolean;
  kz1_color: string;
  kz1_txt: string;
  kz1_session: string;
  use_kz2: boolean;
  kz2_color: string;
  kz2_txt: string;
  kz2_session: string;
  use_kz3: boolean;
  kz3_color: string;
  kz3_txt: string;
  kz3_session: string;
  use_kz4: boolean;
  kz4_color: string;
  kz4_txt: string;
  kz4_session: string;
  use_kz5: boolean;
  kz5_color: string;
  kz5_txt: string;
  kz5_session: string;
  use_kz6: boolean;
  kz6_color: string;
  kz6_txt: string;
  kz6_session: string;
  show_pivots: boolean;
  kzp_style: LineType;
  kzp_width: number;
  show_midpoints: boolean;
  kzm_style: LineType;
  kzm_width: number;
  show_labels: boolean;
  label_right: 'Left' | 'Right';
  use_alerts: boolean;
  ext_pivots: 'Until Mitigated' | 'Past Mitigation';
  ext_which: 'Most Recent' | 'All';
  show_data: boolean;
  data_loc: string;
  data_size: SizeName;
  show_pivot_stats: boolean;
  show_level_stats: boolean;
  show_dwm_stats: boolean;
  data_lookback: number;
  range_measure: 'Average' | 'Median' | 'Standard Deviation';
  show_levels: boolean;
  levels_input: string;
  lv_style: LineType;
  lv_width: number;
  dwm_history: History;
  alert_HL: boolean;
  show_d_open: boolean;
  dhl: boolean;
  dmid: boolean;
  ds: boolean;
  d_color: string;
  show_w_open: boolean;
  whl: boolean;
  wmid: boolean;
  ws: boolean;
  w_color: string;
  show_m_open: boolean;
  mhl: boolean;
  mmid: boolean;
  ms: boolean;
  m_color: string;
  htf_style: LineType;
  htf_width: number;
  dow_labels: boolean;
  dow_yloc: 'Top' | 'Bottom';
  dow_xloc: 'Midnight' | 'Midday';
  dow_hide_wknd: boolean;
  show_opens: boolean;
  open_history: History;
  opens_input: string;
  hz_style: LineType;
  hz_width: number;
  def_hz_color: string;
  show_timestamps: boolean;
  v_history: History;
  timestamps_input: string;
  vl_style: LineType;
  vl_width: number;
  def_vl_color: string;
  use_cutoff: boolean;
  cutoff: string;
  gmt_tz: string;
  lbl_size: SizeName;
  tf_limit: string;
}

export const defaultInputs: IctKillzonesPivotsTfoInputs = {
  show_kz: true,
  max_days: 3,
  use_kz1: true,
  kz1_color: 'rgba(41, 98, 255, 0.4)',
  kz1_txt: 'ASIA',
  kz1_session: '2000-0000',
  use_kz2: true,
  kz2_color: 'rgba(242, 54, 69, 0.4)',
  kz2_txt: 'LNDN',
  kz2_session: '0200-0500',
  use_kz3: true,
  kz3_color: 'rgba(8, 153, 129, 0.4)',
  kz3_txt: 'NYAM',
  kz3_session: '0930-1100',
  use_kz4: false,
  kz4_color: 'rgba(255, 152, 0, 0.4)',
  kz4_txt: 'NYL',
  kz4_session: '1200-1300',
  use_kz5: true,
  kz5_color: 'rgba(224, 64, 251, 0.4)',
  kz5_txt: 'NYPM',
  kz5_session: '1330-1600',
  use_kz6: false,
  kz6_color: 'rgba(54, 58, 69, 0.4)',
  kz6_txt: 'RTH',
  kz6_session: '0930-1600',
  show_pivots: true,
  kzp_style: 'Solid',
  kzp_width: 1,
  show_midpoints: false,
  kzm_style: 'Dotted',
  kzm_width: 1,
  show_labels: true,
  label_right: 'Right',
  use_alerts: true,
  ext_pivots: 'Until Mitigated',
  ext_which: 'Most Recent',
  show_data: true,
  data_loc: 'Top Right',
  data_size: 'Small',
  show_pivot_stats: true,
  show_level_stats: true,
  show_dwm_stats: true,
  data_lookback: 20,
  range_measure: 'Average',
  show_levels: false,
  levels_input: '0.25\n0.5\n1.0\n// 1.5\n// 2.0',
  lv_style: 'Dotted',
  lv_width: 1,
  dwm_history: 'Session Limit',
  alert_HL: false,
  show_d_open: false,
  dhl: true,
  dmid: true,
  ds: false,
  d_color: '#2962FF',
  show_w_open: false,
  whl: true,
  wmid: true,
  ws: false,
  w_color: '#089981',
  show_m_open: false,
  mhl: true,
  mmid: true,
  ms: false,
  m_color: '#F23645',
  htf_style: 'Dotted',
  htf_width: 1,
  dow_labels: false,
  dow_yloc: 'Bottom',
  dow_xloc: 'Midnight',
  dow_hide_wknd: true,
  show_opens: true,
  open_history: 'Most Recent',
  opens_input: '0930, blue, NY Open\n1200, orange, Midday\n1600, #ff0000, Close\n// 0000, yellow, Midnight',
  hz_style: 'Dashed',
  hz_width: 1,
  def_hz_color: '#787B86',
  show_timestamps: true,
  v_history: 'Most Recent',
  timestamps_input: '0930, green\n1200, orange\n1600, red\n// 0000, yellow',
  vl_style: 'Dotted',
  vl_width: 1,
  def_vl_color: '#787B86',
  use_cutoff: false,
  cutoff: '1800-1801',
  gmt_tz: 'America/New_York',
  lbl_size: 'Tiny',
  tf_limit: '30',
};

const g_KZ = 'Killzones';
const g_LABELS = 'Pivots';
const g_DATA = 'Range Data & Levels';
const g_DWM = 'Day - Week - Month';
const g_OPEN = 'Opening Prices';
const g_VERTICAL = 'Timestamps';
const g_GLOBAL = 'Global';
const LINE_TYPES = ['Solid', 'Dotted', 'Dashed'];
const SIZES = ['Auto', 'Tiny', 'Small', 'Normal', 'Large', 'Huge'];
const POSITIONS = ['Bottom Center', 'Bottom Left', 'Bottom Right', 'Middle Center', 'Middle Left', 'Middle Right', 'Top Center', 'Top Left', 'Top Right'];
const HISTORY = ['Most Recent', 'Session Limit', 'Unlimited'];
const TIMEZONES = ['America/New_York', 'GMT-12', 'GMT-11', 'GMT-10', 'GMT-9', 'GMT-8', 'GMT-7', 'GMT-6', 'GMT-5', 'GMT-4', 'GMT-3', 'GMT-2', 'GMT-1', 'GMT+0', 'GMT+1', 'GMT+2', 'GMT+3', 'GMT+4', 'GMT+5', 'GMT+6', 'GMT+7', 'GMT+8', 'GMT+9', 'GMT+10', 'GMT+11', 'GMT+12', 'GMT+13', 'GMT+14'];

const kzInputs = (k: 1 | 2 | 3 | 4 | 5 | 6): InputConfig[] => [
  { id: `use_kz${k}`, type: 'bool', title: '', defval: defaultInputs[`use_kz${k}`], inline: `KZ${k}`, group: g_KZ },
  { id: `kz${k}_color`, type: 'color', title: '', defval: defaultInputs[`kz${k}_color`], inline: `KZ${k}`, group: g_KZ },
  { id: `kz${k}_txt`, type: 'string', title: '', defval: defaultInputs[`kz${k}_txt`], inline: `KZ${k}`, group: g_KZ },
  { id: `kz${k}_session`, type: 'session', title: '', defval: defaultInputs[`kz${k}_session`], inline: `KZ${k}`, group: g_KZ },
];

export const inputConfig: InputConfig[] = [
  { id: 'show_kz', type: 'bool', title: 'Show Boxes', defval: true, tooltip: 'Killzone session times follow the Timezone setting in the Global section', group: g_KZ },
  { id: 'max_days', type: 'int', title: 'Session Limit', defval: 3, min: 1, tooltip: 'Only this many drawings will be kept on the chart, for each selected drawing type (killzone boxes, pivot lines, open lines, range levels, etc.)', group: g_KZ },
  ...kzInputs(1), ...kzInputs(2), ...kzInputs(3), ...kzInputs(4), ...kzInputs(5), ...kzInputs(6),
  { id: 'show_pivots', type: 'bool', title: 'Show Pivots', defval: true, inline: 'KZP', group: g_LABELS },
  { id: 'kzp_style', type: 'string', title: '', defval: 'Solid', options: LINE_TYPES, inline: 'KZP', group: g_LABELS },
  { id: 'kzp_width', type: 'int', title: '', defval: 1, inline: 'KZP', group: g_LABELS },
  { id: 'show_midpoints', type: 'bool', title: 'Midpoints', defval: false, inline: 'KZM', group: g_LABELS },
  { id: 'kzm_style', type: 'string', title: '', defval: 'Dotted', options: LINE_TYPES, inline: 'KZM', group: g_LABELS },
  { id: 'kzm_width', type: 'int', title: '', defval: 1, inline: 'KZM', group: g_LABELS },
  { id: 'show_labels', type: 'bool', title: 'Pivot Labels', defval: true, inline: 'KZL', tooltip: "Show labels denoting each killzone's high and low", group: g_LABELS },
  { id: 'label_right', type: 'string', title: '', defval: 'Right', options: ['Left', 'Right'], inline: 'KZL', group: g_LABELS },
  { id: 'use_alerts', type: 'bool', title: 'Alert Broken Pivots', defval: true, tooltip: 'The desired killzones must be enabled at the time that an alert is created, along with the show pivots option, in order for alerts to work', group: g_LABELS },
  { id: 'ext_pivots', type: 'string', title: 'Extend Pivots...', defval: 'Until Mitigated', options: ['Until Mitigated', 'Past Mitigation'], group: g_LABELS },
  { id: 'ext_which', type: 'string', title: '...From Which Sessions', defval: 'Most Recent', options: ['Most Recent', 'All'], tooltip: "Also sets the hit rate tracking window - a pivot counts toward hit rate stats for as long as its lines remain active. With Most Recent, each pivot is tracked until the killzone's next session begins. With All, pivots are tracked until the Session Limit removes them", group: g_LABELS },
  { id: 'show_data', type: 'bool', title: 'Show Data Table', defval: true, inline: 'DATA', tooltip: 'Show the most recent ranges of each selected killzone, from high to low', group: g_DATA },
  { id: 'data_loc', type: 'string', title: '', defval: 'Top Right', options: POSITIONS, inline: 'DATA', group: g_DATA },
  { id: 'data_size', type: 'string', title: '', defval: 'Small', options: SIZES, inline: 'DATA', group: g_DATA },
  { id: 'show_pivot_stats', type: 'bool', title: 'Pivot Stats', defval: true, inline: 'STATS', tooltip: "Choose which stat categories appear in the data table. Pivot stats show how often each killzone's high and low get hit - requires Show Pivots. Level stats show how often each range level gets hit, above (top) and below (bottom) the opening price - requires Show Range Levels. D/W/M stats show how often the previous day, week, and month highs and lows get hit - requires the corresponding High/Low options", group: g_DATA },
  { id: 'show_level_stats', type: 'bool', title: 'Range Level Stats', defval: true, inline: 'STATS', group: g_DATA },
  { id: 'show_dwm_stats', type: 'bool', title: 'D/W/M Stats', defval: true, inline: 'STATS', group: g_DATA },
  { id: 'data_lookback', type: 'int', title: 'Data Lookback', defval: 20, min: 1, tooltip: "Used to calculate range measurements and show N number of recent events in the data table tooltips. Will use the maximum value possible if the current chart doesn't contain enough data for the specified lookback", group: g_DATA },
  { id: 'range_measure', type: 'string', title: 'Range Measurement', defval: 'Average', options: ['Average', 'Median', 'Standard Deviation'], tooltip: "Average and Median are calculated from each killzone's session ranges (high to low). Standard Deviation is calculated from price's displacement away from the session's opening price, sampled on every bar of each session", group: g_DATA },
  { id: 'show_levels', type: 'bool', title: 'Show Range Levels', defval: false, tooltip: "Plot levels above and below each killzone's opening price, calculated by applying each multiplier to the selected range measurement over the data lookback", group: g_DATA },
  { id: 'levels_input', type: 'string', title: 'Multiplier, Color (one per line)', defval: defaultInputs.levels_input, tooltip: "For example, '1.5' will plot lines 1.5 times the selected range measurement above and below each killzone's opening price. The multiplier applies per side for every measurement type, so the distance from +0.5 to -0.5 spans one full range measurement. Levels inherit their killzone's color by default - optionally define a color to override it, ex. '1.5, purple'. Colors support all which are available in pine script (ex. red, green, blue), or a hex code (ex. #FFFFFF). Lines starting with '//' are ignored, allowing entries to be disabled without deleting them.", group: g_DATA },
  { id: 'lv_style', type: 'string', title: 'Style', defval: 'Dotted', options: LINE_TYPES, inline: 'R0', group: g_DATA },
  { id: 'lv_width', type: 'int', title: '', defval: 1, inline: 'R0', group: g_DATA },
  { id: 'dwm_history', type: 'string', title: 'History', defval: 'Session Limit', options: HISTORY, tooltip: 'Most Recent will only show the latest drawings for each selected type. Unlimited will show as many of the selected lines as possible. Otherwise, the session limit will be used', group: g_DWM },
  { id: 'alert_HL', type: 'bool', title: 'Alert High/Low Break', defval: false, tooltip: "Alert when any selected highs and lows are traded through. The desired timeframe's high/low option must be enabled at the time that an alert is created", group: g_DWM },
  { id: 'show_d_open', type: 'bool', title: 'D Open', defval: false, inline: 'DO', group: g_DWM },
  { id: 'dhl', type: 'bool', title: 'High/Low', defval: true, inline: 'DO', group: g_DWM },
  { id: 'dmid', type: 'bool', title: 'Midline', defval: true, inline: 'DO', tooltip: "Plot the midpoint of the previous day's range - requires High/Low", group: g_DWM },
  { id: 'ds', type: 'bool', title: 'Divider', defval: false, inline: 'DO', tooltip: 'Mark where a new day begins', group: g_DWM },
  { id: 'd_color', type: 'color', title: '', defval: '#2962FF', inline: 'DO', group: g_DWM },
  { id: 'show_w_open', type: 'bool', title: 'W Open', defval: false, inline: 'WO', group: g_DWM },
  { id: 'whl', type: 'bool', title: 'High/Low', defval: true, inline: 'WO', group: g_DWM },
  { id: 'wmid', type: 'bool', title: 'Midline', defval: true, inline: 'WO', tooltip: "Plot the midpoint of the previous week's range - requires High/Low", group: g_DWM },
  { id: 'ws', type: 'bool', title: 'Divider', defval: false, inline: 'WO', tooltip: 'Mark where a new week begins', group: g_DWM },
  { id: 'w_color', type: 'color', title: '', defval: '#089981', inline: 'WO', group: g_DWM },
  { id: 'show_m_open', type: 'bool', title: 'M Open', defval: false, inline: 'MO', group: g_DWM },
  { id: 'mhl', type: 'bool', title: 'High/Low', defval: true, inline: 'MO', group: g_DWM },
  { id: 'mmid', type: 'bool', title: 'Midline', defval: true, inline: 'MO', tooltip: "Plot the midpoint of the previous month's range - requires High/Low", group: g_DWM },
  { id: 'ms', type: 'bool', title: 'Divider', defval: false, inline: 'MO', tooltip: 'Mark where a new month begins', group: g_DWM },
  { id: 'm_color', type: 'color', title: '', defval: '#F23645', inline: 'MO', group: g_DWM },
  { id: 'htf_style', type: 'string', title: 'Style', defval: 'Dotted', options: LINE_TYPES, inline: 'D0', group: g_DWM },
  { id: 'htf_width', type: 'int', title: '', defval: 1, inline: 'D0', group: g_DWM },
  { id: 'dow_labels', type: 'bool', title: 'Day of Week Labels', defval: false, inline: 'DOW', group: g_DWM },
  { id: 'dow_yloc', type: 'string', title: '', defval: 'Bottom', options: ['Top', 'Bottom'], inline: 'DOW', group: g_DWM },
  { id: 'dow_xloc', type: 'string', title: '', defval: 'Midnight', options: ['Midnight', 'Midday'], inline: 'DOW', group: g_DWM },
  { id: 'dow_hide_wknd', type: 'bool', title: 'Hide Weekend Labels', defval: true, group: g_DWM },
  { id: 'show_opens', type: 'bool', title: 'Show Opening Prices', defval: true, group: g_OPEN },
  { id: 'open_history', type: 'string', title: 'History', defval: 'Most Recent', options: HISTORY, tooltip: 'Most Recent will only show the latest line for each configured time. Unlimited will show as many of the selected lines as possible. Otherwise, the session limit will be used', group: g_OPEN },
  { id: 'opens_input', type: 'string', title: 'Time, Color, Label (one per line)', defval: defaultInputs.opens_input, tooltip: "Times are formatted as HHMM - 0930, 930, and 09:30 are all accepted; the color and label are both optional. For example, '0930, red, NY Open' will plot a red horizontal line at the 09:30 open price. Colors support all which are available in pine script (ex. red, green, blue), or a hex code (ex. #FFFFFF). Lines starting with '//' are ignored, allowing entries to be disabled without deleting them.", group: g_OPEN },
  { id: 'hz_style', type: 'string', title: 'Style', defval: 'Dashed', options: LINE_TYPES, inline: 'H0', tooltip: 'The color input sets the default color for entries without a specified color', group: g_OPEN },
  { id: 'hz_width', type: 'int', title: '', defval: 1, inline: 'H0', group: g_OPEN },
  { id: 'def_hz_color', type: 'color', title: '', defval: '#787B86', inline: 'H0', group: g_OPEN },
  { id: 'show_timestamps', type: 'bool', title: 'Show Timestamps', defval: true, group: g_VERTICAL },
  { id: 'v_history', type: 'string', title: 'History', defval: 'Most Recent', options: HISTORY, tooltip: 'Most Recent will only show the latest line for each configured time. Unlimited will show as many of the selected lines as possible. Otherwise, the session history limit will be used', group: g_VERTICAL },
  { id: 'timestamps_input', type: 'string', title: 'Time, Color (one per line)', defval: defaultInputs.timestamps_input, tooltip: "Times are formatted as HHMM - 0930, 930, and 09:30 are all accepted; the color is optional. For example, '1200, black' will plot a black vertical line at 12:00. Colors support all which are available in pine script (ex. red, green, blue), or a hex code (ex. #FFFFFF). Lines starting with '//' are ignored, allowing entries to be disabled without deleting them.", group: g_VERTICAL },
  { id: 'vl_style', type: 'string', title: 'Style', defval: 'Dotted', options: LINE_TYPES, inline: 'V0', tooltip: 'The color input sets the default color for entries without a specified color', group: g_VERTICAL },
  { id: 'vl_width', type: 'int', title: '', defval: 1, inline: 'V0', group: g_VERTICAL },
  { id: 'def_vl_color', type: 'color', title: '', defval: '#787B86', inline: 'V0', group: g_VERTICAL },
  { id: 'use_cutoff', type: 'bool', title: 'Drawing Cutoff Time', defval: false, inline: 'CO', tooltip: 'When enabled, all pivots, midpoints, open price lines, and range levels will stop extending at this time. Pivot hit rate stats also stop counting at the cutoff - a pivot first broken after the cutoff is recorded as a miss. Does not apply to Day/Week/Month lines, whose lifetime is managed by their History setting. Range levels always stop at their session close, so the cutoff only affects them when a session is still open at the cutoff time', group: g_GLOBAL },
  { id: 'cutoff', type: 'session', title: '', defval: '1800-1801', inline: 'CO', group: g_GLOBAL },
  { id: 'gmt_tz', type: 'string', title: 'Timezone', defval: 'America/New_York', options: TIMEZONES, tooltip: 'Note GMT is not adjusted to reflect Daylight Saving Time changes', group: g_GLOBAL },
  { id: 'lbl_size', type: 'string', title: 'Label Size', defval: 'Tiny', options: SIZES, tooltip: 'The size of all labels', group: g_GLOBAL },
  { id: 'tf_limit', type: 'timeframe', title: 'Timeframe Limit', defval: '30', tooltip: 'Drawings will not appear on timeframes greater than or equal to this', group: g_GLOBAL },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ICT Killzones & Pivots [TFO]',
  shortTitle: 'KZP [TFO]',
  overlay: true,
};

/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;
/** chart.fg_color / chart.bg_color of a dark chart (the port has no chart theme) */
const CHART_FG = '#DBDBDB';
const CHART_BG = '#0F0F0F';
/** max_lines_count, max_labels_count, max_boxes_count */
const MAX_COUNT = 500;
const NA_COLOR = 'transparent';
const TRANSPARENT = '#ffffff00';
const DEFAULT_TRANSPARENCY = 60;
const T_TXT = '🟩';
const F_TXT = '🟥';
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

type LineStyle = 'solid' | 'dotted' | 'dashed';
interface Ln {
  x1: number; y1: number; x2: number; y2: number;
  /** xloc.bar_time: x values are times (ms); else bar indexes */
  byTime: boolean;
  color: string; style: LineStyle; width: number; extend?: 'both'; dead: boolean;
}
interface Bx { left: number; top: number; right: number; bottom: number; border: string; bg: string; dead: boolean }
interface Lb {
  x: number; y: number; byTime: boolean; text: string; color: string; textColor: string; style: LabelStyle;
  size: PineSize; tooltip: string; dead: boolean;
}

/** Live drawings of one kind: above max + 5 objects the oldest are deleted until max remain */
class Live<T extends { dead: boolean }> {
  readonly list: T[] = [];
  add(o: T): T {
    this.list.push(o);
    if (this.list.length > MAX_COUNT + 5) for (const old of this.list.splice(0, this.list.length - MAX_COUNT)) old.dead = true;
    return o;
  }
  del(o: T | undefined): void {
    if (!o || o.dead) return;
    o.dead = true;
    this.list.splice(this.list.indexOf(o), 1);
  }
}

/** Pine types */
interface Track { history: boolean[]; price: number; hitLevel: boolean; success: number; total: number }
interface Lvl {
  mult: number; col: string; hiLine: Ln[]; loLine: Ln[]; hiLabel: Lb[]; loLabel: Lb[]; hitHi: Track; hitLo: Track;
  hiValid: boolean; loValid: boolean; active: boolean;
}
interface Kz {
  title: string; kzColor: string; use: boolean; session: string;
  startTime: number[]; box: Bx[];
  hiLine: Ln[]; mdLine: Ln[]; loLine: Ln[]; hiLabel: Lb[]; loLabel: Lb[];
  hiValid: boolean[]; mdValid: boolean[]; loValid: boolean[]; extStop: boolean[];
  rangeStore: number[]; hitHi: Track; hitLo: Track; rangeCurrent: number;
  sdPool: number[]; sdSizes: number[]; sdCurrent: number[]; sessionOpen: number; sdValue: number;
  levels: Lvl[];
  /** t_kz of the bar and of the previous bar */
  t: boolean; t1: boolean;
}
interface DwmHl {
  hiLine: Ln[]; loLine: Ln[]; hiLabel: Lb[]; loLabel: Lb[]; mdLine: Ln[]; mdLabel: Lb[]; trackHi: Track; trackLo: Track;
  hitHigh: boolean; hitLow: boolean;
}
interface DwmInfo { tf: 'D' | 'W' | 'M'; o: number; h: number; l: number; ph: number; pl: number; t: number; pt: number }
interface Hz { LN: Ln[]; LB: Lb[]; CO: boolean[]; session: string; col: string; txt: string; tip: string }

const lineType = (s: LineType): LineStyle => (s === 'Dotted' ? 'dotted' : s === 'Dashed' ? 'dashed' : 'solid');
const newTrack = (): Track => ({ history: [], price: NaN, hitLevel: false, success: 0, total: 0 });

/** get_HHMM: the first field of a line, without spaces and colons */
function getHHMM(raw: string): string {
  const c = raw.indexOf(',');
  const s = c >= 0 ? raw.substring(0, c) : raw;
  return s.split(' ').join('').split(':').join('');
}

const toNumber = (s: string): number => str.tonumber(s) ?? NaN;

/** str_to_session: "930" / "0930" gives the one-minute session "0930-0931"; null when the text is not a time */
function strToSession(token: string): string | null {
  let s = token;
  if (s.length === 3) s = '0' + s;
  if (s.length !== 4 || Number.isNaN(toNumber(s))) return null;
  const hh = Math.trunc(toNumber(s.substring(0, 2)));
  const mm = Math.trunc(toNumber(s.substring(2, 4)));
  if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) return null;
  const endMin = hh * 60 + mm + 1;
  const eh = Math.trunc(endMin / 60);
  const em = endMin % 60;
  const two = (v: number) => (v < 10 ? '0' : '') + String(v);
  return two(hh) + two(mm) + '-' + two(eh) + two(em);
}

const NAMED: Record<string, string> = {
  black: color.black, white: color.white, red: color.red, lime: color.lime, green: color.green, blue: color.blue,
  aqua: color.aqua, teal: color.teal, navy: color.navy, purple: color.purple, fuchsia: color.fuchsia,
  maroon: color.maroon, olive: color.olive, orange: color.orange, yellow: color.yellow, silver: color.silver,
  gray: color.gray, grey: color.gray,
};

/** str_to_color: a colour name or "#RRGGBB" / "#RRGGBBTT" (TT: 00 opaque, FF transparent); else the default */
function strToColor<D extends string | null>(raw: string, def: D): string | D {
  const s = raw.split(' ').join('').toLowerCase();
  if (s.startsWith('#')) {
    const hex = s.substring(1);
    if (hex.length === 6 || hex.length === 8) {
      const pair = (p: string) => {
        const hi = '0123456789abcdef'.indexOf(p.charAt(0));
        const lo = '0123456789abcdef'.indexOf(p.charAt(1));
        return hi < 0 || lo < 0 ? NaN : hi * 16 + lo;
      };
      const r = pair(hex.substring(0, 2));
      const g = pair(hex.substring(2, 4));
      const b = pair(hex.substring(4, 6));
      const tt = hex.length === 8 ? pair(hex.substring(6, 8)) : 0;
      if (![r, g, b, tt].some(Number.isNaN)) return String(color.rgb(r, g, b, (tt / 255.0) * 100.0));
    }
    return def;
  }
  return Object.prototype.hasOwnProperty.call(NAMED, s) ? String(NAMED[s]) : def;
}

/** get_color: the second field of a line as a colour */
function getColor<D extends string | null>(raw: string, def: D): string | D {
  const c = raw.indexOf(',');
  if (c < 0) return def;
  let cs = raw.substring(c + 1);
  const c2 = cs.indexOf(',');
  if (c2 >= 0) cs = cs.substring(0, c2);
  return cs.split(' ').join('').length > 0 ? strToColor(cs, def) : def;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IctKillzonesPivotsTfoInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; tables: TableData[]; markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const tMs = bars.map((b) => (ms ? b.time : b.time * 1000));
  const tz = cfg.gmt_tz;
  const tfName = chartTimeframe(bars);
  const chartSec = tfName === '' ? NaN : timeframe.in_seconds(tfName);
  const limitSec = cfg.tf_limit.trim() === '' ? chartSec : timeframe.in_seconds(cfg.tf_limit);
  // timeframe.in_seconds("") <= timeframe.in_seconds(tf_limit)
  const tfOK = chartSec <= limitSec;
  const isIntraday = tfName !== '' && timeframe.info(tfName).isintraday;

  const { max_days: maxDays, show_pivots: showPivots, show_midpoints: showMidpoints, show_labels: showLabels, data_lookback: lookback } = cfg;
  const labelRight = cfg.label_right === 'Right';
  const extCurrent = cfg.ext_which === 'Most Recent';
  const extPast = cfg.ext_pivots === 'Past Mitigation';
  const lblSize = cfg.lbl_size.toLowerCase() as PineSize;
  const dataSize = cfg.data_size.toLowerCase() as PineSize;
  const kzpStyle = lineType(cfg.kzp_style);
  const kzmStyle = lineType(cfg.kzm_style);
  const lvStyle = lineType(cfg.lv_style);
  const htfStyle = lineType(cfg.htf_style);
  const hzStyle = lineType(cfg.hz_style);
  const vlStyle = lineType(cfg.vl_style);
  const sepUnlimited = cfg.dwm_history === 'Unlimited';
  const dwmRecent = cfg.dwm_history === 'Most Recent';
  const openUnlimited = cfg.open_history === 'Unlimited';
  const openRecent = cfg.open_history === 'Most Recent';
  const vUnlimited = cfg.v_history === 'Unlimited';
  const vRecent = cfg.v_history === 'Most Recent';
  const rangeMedian = cfg.range_measure === 'Median';
  const rangeAvg = cfg.range_measure === 'Average';
  const lvlSuffix = rangeAvg ? ' avg' : rangeMedian ? ' med' : 'σ';
  const measurement = cfg.range_measure.toLowerCase();
  const opaque = (c: string) => String(color.new(c, 0));
  const fmtDate = (t: number) => str.format_time(t, 'M/d/yyyy', tz);
  const roundTick = (v: number) => math.round_to_mintick(v, MINTICK) as number;

  const lines = new Live<Ln>();
  const boxes = new Live<Bx>();
  const labels = new Live<Lb>();
  const markers: MarkerData[] = [];
  const newLine = (x1: number, y1: number, x2: number, y2: number, byTime: boolean, css: string, style: LineStyle, width: number, extend?: 'both') =>
    lines.add({ x1, y1, x2, y2, byTime, color: css, style, width, extend, dead: false });
  const newLabel = (x: number, y: number, byTime: boolean, text: string, textColor: string, style: LabelStyle, tooltip: string) =>
    labels.add({ x, y, byTime, text, color: TRANSPARENT, textColor, style, size: lblSize, tooltip, dead: false });

  const kzs: Kz[] = ([1, 2, 3, 4, 5, 6] as const).map((k) => ({
    title: cfg[`kz${k}_txt`], kzColor: cfg[`kz${k}_color`], use: cfg[`use_kz${k}`], session: cfg[`kz${k}_session`],
    startTime: [], box: [], hiLine: [], mdLine: [], loLine: [], hiLabel: [], loLabel: [],
    hiValid: [], mdValid: [], loValid: [], extStop: [], rangeStore: [], hitHi: newTrack(), hitLo: newTrack(),
    rangeCurrent: NaN, sdPool: [], sdSizes: [], sdCurrent: [], sessionOpen: NaN, sdValue: NaN, levels: [], t: false, t1: false,
  }));

  const setTrack = (T: Track, P = NaN) => {
    T.hitLevel = false;
    T.total += 1;
    T.history.unshift(false);
    if (!Number.isNaN(P)) T.price = roundTick(P);
  };
  const pivotTip = (k: Kz, what: string, price: number, T: Track) => str.format(
    '{0}: {1}\nDate: {2}\n{3,number,percent} hit rate over {4} sessions (counted after each session ends), dating back to {5}',
    k.title + what, price, fmtDate(k.startTime[0]), T.success / T.total, T.total, fmtDate(k.startTime[k.startTime.length - 1]));
  const rangeValue = (k: Kz) => (rangeAvg ? array.avg(k.rangeStore) : rangeMedian ? array.median(k.rangeStore) : k.sdValue);

  // Day / week / month
  const newHl = (): DwmHl => ({
    hiLine: [], loLine: [], hiLabel: [], loLabel: [], mdLine: [], mdLabel: [], trackHi: newTrack(), trackLo: newTrack(),
    hitHigh: false, hitLow: false,
  });
  const newInfo = (tf: 'D' | 'W' | 'M'): DwmInfo => ({ tf, o: NaN, h: NaN, l: NaN, ph: NaN, pl: NaN, t: NaN, pt: NaN });
  const dwmSets = [
    { tf: 'D' as const, period: 'Day', open: cfg.show_d_open, hl: cfg.dhl, mid: cfg.dmid, sep: cfg.ds, col: cfg.d_color },
    { tf: 'W' as const, period: 'Week', open: cfg.show_w_open, hl: cfg.whl, mid: cfg.wmid, sep: cfg.ws, col: cfg.w_color },
    { tf: 'M' as const, period: 'Month', open: cfg.show_m_open, hl: cfg.mhl, mid: cfg.mmid, sep: cfg.ms, col: cfg.m_color },
  ].map((d) => ({
    ...d, info: newInfo(d.tf), data: newHl(), sepLines: [] as Ln[], openLines: [] as Ln[], openLabels: [] as Lb[],
    starts: periodStarts(bars, d.tf),
  }));
  const dwmLimit = dwmRecent ? 1 : maxDays;
  const dwmTip = (period: string, what: string, price: number, t0: number, T: Track | null) => {
    let s = str.format('Previous {0} {1}: {2}', period, what, price);
    if (!Number.isNaN(t0)) s += '\nDate: ' + fmtDate(t0);
    if (T && T.total > 0) s += str.format('\n{0,number,percent} hit rate over {1} {2}s', T.success / T.total, T.total, period.toLowerCase());
    return s;
  };

  // Timestamps and opening prices (read on the first bar)
  const stampSessions: string[] = [];
  const stampCols: string[] = [];
  let badStamps = 0;
  for (const lineStr of cfg.timestamps_input.split('\n')) {
    if (lineStr.trim().startsWith('//')) continue;
    const sess = strToSession(getHHMM(lineStr));
    if (sess !== null) {
      stampSessions.push(sess);
      stampCols.push(getColor(lineStr, cfg.def_vl_color));
    } else if (lineStr.trim().length > 0) badStamps += 1;
  }
  const hzs: Hz[] = [];
  let badOpens = 0;
  for (const lineStr of cfg.opens_input.split('\n')) {
    if (lineStr.trim().startsWith('//')) continue;
    const c1 = lineStr.indexOf(',');
    const tRaw = c1 < 0 ? lineStr : lineStr.substring(0, c1);
    const rest = c1 < 0 ? '' : lineStr.substring(c1 + 1);
    const c2 = rest.indexOf(',');
    const cRaw = c2 < 0 ? rest : rest.substring(0, c2);
    const lRaw = c2 < 0 ? '' : rest.substring(c2 + 1);
    const tok = tRaw.split(' ').join('').split(':').join('');
    const sess = strToSession(tok);
    if (sess !== null) {
      const txt = lRaw.trim();
      const tip = txt.length > 0 ? txt : (tok.length === 3 ? '0' + tok : tok) + ' Open';
      hzs.push({ LN: [], LB: [], CO: [], session: sess, col: strToColor(cRaw, cfg.def_hz_color), txt, tip });
    } else if (lineStr.trim().length > 0) badOpens += 1;
  }
  let badLevels = 0;
  for (const lineStr of cfg.levels_input.split('\n')) {
    if (lineStr.trim().startsWith('//')) continue;
    const mult = toNumber(getHHMM(lineStr));
    if (!Number.isNaN(mult) && mult > 0) {
      const c = getColor(lineStr, null);
      for (const k of kzs) {
        k.levels.push({
          mult, col: c === null ? k.kzColor : c, hiLine: [], loLine: [], hiLabel: [], loLabel: [],
          hitHi: newTrack(), hitLo: newTrack(), hiValid: false, loValid: false, active: false,
        });
      }
    } else if (lineStr.trim().length > 0) badLevels += 1;
  }
  const vlLines: Ln[] = [];
  const vlOwner: number[] = [];
  // In the loops over the lists, the previous bar value is the one of the last entry of the list
  let lastStampPrev = false;
  let lastHzPrev = false;
  let dowPrev = NaN;
  const lvlTip = (k: Kz, txt: string, T: Track) => str.format(
    "{0}: {1}\nDate: {2}\n{3,number,percent} hit rate over {4} sessions (counted during the level''s session only), dating back to {5}\n\nLevels calculated using the {6} of the last {7} sessions",
    k.title + ' ' + txt, T.price, fmtDate(k.startTime[0]), T.success / T.total, T.total, fmtDate(k.startTime[k.startTime.length - 1]), measurement, lookback);
  const multText = (l: Lvl) => str.tostring(l.mult) + lvlSuffix;

  const live = <X extends { dead: boolean }>(o: X | undefined): o is X => o !== undefined && !o.dead;
  const tables: TableData[] = [];

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const { open, high, low, close } = bar;
    const t = tMs[i];
    const tCo = cfg.use_cutoff && pineTime.inSession(t, cfg.cutoff, tz);
    const last = i === n - 1;

    // Killzones
    for (const kz of kzs) {
      kz.t1 = kz.t;
      kz.t = pineTime.inSession(t, kz.session, tz);
    }
    for (const kz of kzs) {
      if (!(tfOK && kz.use)) continue;
      const inKz = kz.t;
      if (inKz && !kz.t1) {
        const c = kz.kzColor;
        const cOpaque = opaque(c);
        kz.box.unshift(boxes.add({ left: t, top: high, right: t, bottom: low, border: cfg.show_kz ? c : NA_COLOR, bg: cfg.show_kz ? c : NA_COLOR, dead: false }));
        kz.startTime.unshift(t);
        if (kz.sdCurrent.length > 0) {
          kz.sdSizes.push(kz.sdCurrent.length);
          kz.sdPool.push(...kz.sdCurrent);
          kz.sdCurrent = [];
          while (kz.sdSizes.length > lookback) kz.sdPool.splice(0, kz.sdSizes.shift()!);
        }
        kz.sessionOpen = open;
        kz.sdValue = kz.sdPool.length > 1 ? array.stdev(kz.sdPool) : NaN;
        if (showPivots) {
          kz.hiLine.unshift(newLine(t, high, t, high, true, cOpaque, kzpStyle, cfg.kzp_width));
          kz.loLine.unshift(newLine(t, low, t, low, true, cOpaque, kzpStyle, cfg.kzp_width));
          setTrack(kz.hitHi);
          setTrack(kz.hitLo);
          if (showMidpoints) {
            kz.mdLine.unshift(newLine(t, (high + low) / 2, t, (high + low) / 2, true, cOpaque, kzmStyle, cfg.kzm_width));
            kz.mdValid.unshift(true);
          }
          kz.hiValid.unshift(true);
          kz.loValid.unshift(true);
          kz.extStop.unshift(false);
          if (showLabels) {
            kz.hiLabel.unshift(newLabel(t, high, true, kz.title + ' High', cOpaque, labelRight ? 'label_left' : 'label_down', pivotTip(kz, ' High', high, kz.hitHi)));
            kz.loLabel.unshift(newLabel(t, low, true, kz.title + ' Low', cOpaque, labelRight ? 'label_left' : 'label_up', pivotTip(kz, ' Low', low, kz.hitLo)));
          }
        }
        // del_kz
        if (kz.box.length > maxDays) boxes.del(kz.box.pop());
        if (kz.hiLine.length > maxDays) {
          lines.del(kz.hiLine.pop());
          lines.del(kz.loLine.pop());
          kz.hiValid.pop();
          kz.loValid.pop();
          kz.extStop.pop();
          if (showMidpoints) {
            lines.del(kz.mdLine.pop());
            kz.mdValid.pop();
          }
        }
        if (kz.hiLabel.length > maxDays) {
          labels.del(kz.hiLabel.pop());
          labels.del(kz.loLabel.pop());
        }
      }

      // adjust_in_kz
      if (inKz) {
        const bx = kz.box[0];
        if (live(bx)) {
          bx.right = t;
          bx.top = Math.max(bx.top, high);
          bx.bottom = Math.min(bx.bottom, low);
        }
        kz.rangeCurrent = live(bx) ? bx.top - bx.bottom : NaN;
        if (showPivots && kz.hiLine.length > 0) {
          const hi = kz.hiLine[0];
          const lo = kz.loLine[0];
          if (live(hi)) {
            hi.x2 = t;
            if (high > hi.y1) {
              hi.x1 = t;
              hi.y1 = high;
              hi.x2 = t;
              hi.y2 = high;
            }
          }
          if (live(lo)) {
            lo.x2 = t;
            if (low < lo.y1) {
              lo.x1 = t;
              lo.y1 = low;
              lo.x2 = t;
              lo.y2 = low;
            }
          }
          if (showMidpoints) {
            const md = kz.mdLine[0];
            const mid = ((live(hi) ? hi.y2 : NaN) + (live(lo) ? lo.y2 : NaN)) / 2;
            if (live(md)) {
              md.x1 = t;
              md.y1 = mid;
              md.x2 = t;
              md.y2 = mid;
            }
          }
        }
        if (showLabels && kz.hiLabel.length > 0) {
          const hi = kz.hiLabel[0];
          const lo = kz.loLabel[0];
          if (labelRight) {
            if (live(hi)) hi.x = t;
            if (live(lo)) lo.x = t;
          }
          if (live(hi) && high > hi.y) {
            hi.x = t;
            hi.y = high;
            hi.tooltip = pivotTip(kz, ' High', high, kz.hitHi);
          }
          if (live(lo) && low < lo.y) {
            lo.x = t;
            lo.y = low;
            lo.tooltip = pivotTip(kz, ' Low', low, kz.hitLo);
          }
        }
      }

      // adjust_out_kz
      if (!inKz && kz.box.length > 0 && kz.t1) {
        kz.rangeStore.unshift(kz.rangeCurrent);
        if (kz.rangeStore.length > lookback) kz.rangeStore.pop();
      }
      if (kz.box.length > 0 && showPivots) {
        for (let k = 0; k < kz.box.length; k++) {
          if (extCurrent && k !== 0) continue;
          const side = (ln: Ln[], lb: Lb[], valid: boolean[], track: Track, hit: (y: number) => boolean, hitStyle: LabelStyle) => {
            if ((extPast || valid[k] === true) && !kz.extStop[k]) {
              if (live(ln[k])) ln[k].x2 = t;
              if (showLabels && labelRight && live(lb[k])) lb[k].x = t;
            }
            if (hit(live(ln[k]) ? ln[k].y1 : NaN) && valid[k] === true) {
              valid[k] = false;
              track.success += 1;
              track.hitLevel = true;
              track.history[k] = true;
              if (showLabels && labelRight && live(lb[0])) lb[0].style = hitStyle;
            } else if (tCo) valid[k] = false;
          };
          side(kz.hiLine, kz.hiLabel, kz.hiValid, kz.hitHi, (y) => high > y, 'label_down');
          side(kz.loLine, kz.loLabel, kz.loValid, kz.hitLo, (y) => low < y, 'label_up');
          if (showMidpoints && !inKz && !kz.extStop[k]) {
            const md = kz.mdLine[k];
            if (live(md)) md.x2 = t;
            const y = live(md) ? md.y1 : NaN;
            if (kz.mdValid[k] === true && low <= y && high >= y) kz.mdValid[k] = false;
          }
          if (tCo) kz.extStop[k] = true;
        }
      }
      if (inKz && !Number.isNaN(kz.sessionOpen)) kz.sdCurrent.push(close - kz.sessionOpen);
    }

    // Day / week / month
    const changes = dwmSets.map((d) => i > 0 && d.starts[i] !== d.starts[i - 1]);
    dwmSets.forEach((d, k) => {
      if (!(d.hl || d.open)) return;
      const nfo = d.info;
      if (changes[k]) {
        nfo.ph = nfo.h;
        nfo.pl = nfo.l;
        nfo.o = open;
        nfo.h = high;
        nfo.l = low;
        nfo.pt = nfo.t;
        nfo.t = t;
      } else {
        nfo.h = Number.isNaN(nfo.h) ? NaN : Math.max(high, nfo.h);
        nfo.l = Number.isNaN(nfo.l) ? NaN : Math.min(low, nfo.l);
      }
    });
    if (tfOK) {
      // Separators
      dwmSets.forEach((d, k) => {
        if (d.sep && changes[k]) {
          d.sepLines.unshift(newLine(i, high * 1.0001, i, low, false, d.col, htfStyle, cfg.htf_width, 'both'));
          if (!sepUnlimited && d.sepLines.length > dwmLimit) lines.del(d.sepLines.pop());
        }
      });
      // Open lines
      dwmSets.forEach((d, k) => {
        if (!d.open) return;
        if (d.openLines.length > 0) {
          if (live(d.openLines[0])) d.openLines[0].x2 = t;
          if (live(d.openLabels[0])) d.openLabels[0].x = t;
        }
        if (changes[k]) {
          const o = d.info.o;
          d.openLines.unshift(newLine(t, o, t, o, true, d.col, htfStyle, cfg.htf_width));
          d.openLabels.unshift(newLabel(t, o, true, d.tf + ' OPEN', opaque(d.col), 'label_left',
            str.format('{0} Open: {1}\nDate: {2}', d.period, o, fmtDate(t))));
          if (!sepUnlimited && d.openLines.length > dwmLimit) {
            lines.del(d.openLines.pop());
            labels.del(d.openLabels.pop());
          }
        }
      });
      // Highs and lows
      dwmSets.forEach((d, k) => {
        if (!d.hl) return;
        const hl = d.data;
        const nfo = d.info;
        if (hl.hiLine.length > 0) {
          if (live(hl.hiLine[0])) hl.hiLine[0].x2 = t;
          if (live(hl.loLine[0])) hl.loLine[0].x2 = t;
          if (live(hl.hiLabel[0])) hl.hiLabel[0].x = t;
          if (live(hl.loLabel[0])) hl.loLabel[0].x = t;
        }
        if (d.mid && hl.mdLine.length > 0) {
          if (live(hl.mdLine[0])) hl.mdLine[0].x2 = t;
          if (live(hl.mdLabel[0])) hl.mdLabel[0].x = t;
        }
        if (changes[k]) {
          const tc = opaque(d.col);
          hl.hiLine.unshift(newLine(t, nfo.ph, t, nfo.ph, true, d.col, htfStyle, cfg.htf_width));
          hl.loLine.unshift(newLine(t, nfo.pl, t, nfo.pl, true, d.col, htfStyle, cfg.htf_width));
          hl.hiLabel.unshift(newLabel(t, nfo.ph, true, 'P' + d.tf + 'H', tc, 'label_left', ''));
          hl.loLabel.unshift(newLabel(t, nfo.pl, true, 'P' + d.tf + 'L', tc, 'label_left', ''));
          if (d.mid) {
            const m = (nfo.ph + nfo.pl) / 2;
            hl.mdLine.unshift(newLine(t, m, t, m, true, d.col, htfStyle, cfg.htf_width));
            hl.mdLabel.unshift(newLabel(t, m, true, 'P' + d.tf + 'M', tc, 'label_left', dwmTip(d.period, 'Midline', m, nfo.pt, null)));
          }
          hl.hitHigh = false;
          hl.hitLow = false;
          if (!Number.isNaN(nfo.ph)) {
            setTrack(hl.trackHi, nfo.ph);
            setTrack(hl.trackLo, nfo.pl);
          }
          hl.hiLabel[0].tooltip = dwmTip(d.period, 'High', nfo.ph, nfo.pt, hl.trackHi);
          hl.loLabel[0].tooltip = dwmTip(d.period, 'Low', nfo.pl, nfo.pt, hl.trackLo);
          if (!sepUnlimited && hl.hiLine.length > dwmLimit) {
            lines.del(hl.hiLine.pop());
            lines.del(hl.loLine.pop());
            labels.del(hl.hiLabel.pop());
            labels.del(hl.loLabel.pop());
          }
          if (!sepUnlimited && hl.mdLine.length > dwmLimit) {
            lines.del(hl.mdLine.pop());
            labels.del(hl.mdLabel.pop());
          }
        }
        if (hl.hiLine.length > 0) {
          const hiY = live(hl.hiLine[0]) ? hl.hiLine[0].y1 : NaN;
          const loY = live(hl.loLine[0]) ? hl.loLine[0].y1 : NaN;
          if (!hl.hitHigh && high > hiY) {
            hl.hitHigh = true;
            if (hl.trackHi.history.length > 0) {
              hl.trackHi.success += 1;
              hl.trackHi.hitLevel = true;
              hl.trackHi.history[0] = true;
              if (live(hl.hiLabel[0])) hl.hiLabel[0].tooltip = dwmTip(d.period, 'High', hiY, nfo.pt, hl.trackHi);
            }
          }
          if (!hl.hitLow && low < loY) {
            hl.hitLow = true;
            if (hl.trackLo.history.length > 0) {
              hl.trackLo.success += 1;
              hl.trackLo.hitLevel = true;
              hl.trackLo.history[0] = true;
              if (live(hl.loLabel[0])) hl.loLabel[0].tooltip = dwmTip(d.period, 'Low', loY, nfo.pt, hl.trackLo);
            }
          }
        }
      });
    }

    // Labels at the same price are merged on the last bar
    if (last) {
      const mg: Array<{ lb: Lb | undefined; txt: string; tip: string }> = [];
      for (const d of dwmSets) {
        const hl = d.data;
        const nfo = d.info;
        const y = (lb: Lb | undefined) => (live(lb) ? lb.y : NaN);
        if (d.open && d.openLabels.length > 0) {
          mg.push({ lb: d.openLabels[0], txt: d.tf + ' OPEN', tip: str.format('{0} Open: {1}\nDate: {2}', d.period, nfo.o, fmtDate(nfo.t)) });
        }
        if (d.hl && hl.hiLabel.length > 0) {
          mg.push({ lb: hl.hiLabel[0], txt: 'P' + d.tf + 'H', tip: dwmTip(d.period, 'High', y(hl.hiLabel[0]), nfo.pt, hl.trackHi) });
          mg.push({ lb: hl.loLabel[0], txt: 'P' + d.tf + 'L', tip: dwmTip(d.period, 'Low', y(hl.loLabel[0]), nfo.pt, hl.trackLo) });
          if (d.mid && hl.mdLabel.length > 0) {
            mg.push({ lb: hl.mdLabel[0], txt: 'P' + d.tf + 'M', tip: dwmTip(d.period, 'Midline', y(hl.mdLabel[0]), nfo.pt, null) });
          }
        }
      }
      const setText = (lb: Lb | undefined, txt: string, tip: string) => {
        if (live(lb)) {
          lb.text = txt;
          lb.tooltip = tip;
        }
      };
      for (const m of mg) setText(m.lb, m.txt, m.tip);
      const consumed = mg.map(() => false);
      const priceOf = (lb: Lb | undefined) => roundTick(live(lb) ? lb.y : NaN);
      for (let a = 0; a < mg.length - 1; a++) {
        if (consumed[a]) continue;
        let txt = mg[a].txt;
        let tip = mg[a].tip;
        let merged = false;
        for (let b = a + 1; b < mg.length; b++) {
          // Pine `==`: equal within 1e-10, false with na
          if (!consumed[b] && Math.abs(priceOf(mg[a].lb) - priceOf(mg[b].lb)) <= 1e-10) {
            merged = true;
            consumed[b] = true;
            txt += ' / ' + mg[b].txt;
            tip += '\n\n' + mg[b].tip;
            setText(mg[b].lb, '', '');
          }
        }
        if (merged) setText(mg[a].lb, txt, tip);
      }
    }

    // Day of week labels: plotchar with an empty character and the day name as text
    const dowTime = cfg.dow_xloc === 'Midday' ? t - (timeframe.in_seconds('D') / 2) * 1000 : t;
    const dow = pineTime.dayofweek(dowTime, tz);
    const newDay = i > 0 && dow !== dowPrev;
    dowPrev = dow;
    if (cfg.dow_labels && isIntraday && newDay && !((dow === 1 || dow === 7) && cfg.dow_hide_wknd)) {
      markers.push({
        time: bar.time, position: cfg.dow_yloc === 'Top' ? 'top' : 'bottom', shape: 'square', color: NA_COLOR,
        text: DAY_NAMES[dow - 1], textColor: CHART_FG,
      });
    }

    // Timestamps
    if (cfg.show_timestamps && tfOK && stampSessions.length > 0) {
      const t1 = i === 0 ? true : lastStampPrev;
      for (let k = 0; k < stampSessions.length; k++) {
        const inStamp = pineTime.inSession(t, stampSessions[k], tz);
        if (inStamp && !t1) {
          vlLines.unshift(newLine(i, high * 1.0001, i, low, false, stampCols[k], vlStyle, cfg.vl_width, 'both'));
          vlOwner.unshift(k);
          if (!vUnlimited && vlOwner.filter((o) => o === k).length > (vRecent ? 1 : maxDays)) {
            const j = vlOwner.lastIndexOf(k);
            lines.del(vlLines[j]);
            vlLines.splice(j, 1);
            vlOwner.splice(j, 1);
          }
        }
        if (k === stampSessions.length - 1) lastStampPrev = inStamp;
      }
    }

    // Opening prices
    if (cfg.show_opens && tfOK && hzs.length > 0) {
      const tPrev = lastHzPrev;
      for (let k = 0; k < hzs.length; k++) {
        const h = hzs[k];
        const inOpen = pineTime.inSession(t, h.session, tz);
        if (inOpen && !tPrev) {
          h.LN.unshift(newLine(i, open, i, open, false, h.col, hzStyle, cfg.hz_width));
          h.LB.unshift(newLabel(i, open, false, h.txt, opaque(h.col), 'label_left', str.format('{0}: {1}\nDate: {2}', h.tip, open, fmtDate(t))));
          h.CO.unshift(false);
          if (!openUnlimited && h.LN.length > (openRecent ? 1 : maxDays)) {
            lines.del(h.LN.pop());
            labels.del(h.LB.pop());
            h.CO.pop();
          }
        }
        if (!inOpen && h.CO.length > 0 && !h.CO[0]) {
          if (live(h.LN[0])) h.LN[0].x2 = i;
          if (live(h.LB[0])) h.LB[0].x = i;
          if (tCo) h.CO[0] = true;
        }
        if (k === hzs.length - 1) lastHzPrev = inOpen;
      }
    }

    // Range levels
    for (const kz of kzs) {
      if (!(tfOK && kz.use && cfg.show_levels && kz.levels.length > 0)) continue;
      if (kz.t && !kz.t1) {
        const m = rangeValue(kz);
        const ready = !Number.isNaN(m) && m > 0;
        for (const l of kz.levels) {
          l.active = ready;
          if (!ready) continue;
          const c = opaque(l.col);
          const hiTxt = '+' + multText(l);
          const loTxt = '-' + multText(l);
          setTrack(l.hitHi, open + l.mult * m);
          setTrack(l.hitLo, open - l.mult * m);
          l.hiValid = true;
          l.loValid = true;
          l.hiLine.unshift(newLine(t, l.hitHi.price, t, l.hitHi.price, true, c, lvStyle, cfg.lv_width));
          l.loLine.unshift(newLine(t, l.hitLo.price, t, l.hitLo.price, true, c, lvStyle, cfg.lv_width));
          l.hiLabel.unshift(newLabel(t, l.hitHi.price, true, hiTxt, c, 'label_left', lvlTip(kz, hiTxt, l.hitHi)));
          l.loLabel.unshift(newLabel(t, l.hitLo.price, true, loTxt, c, 'label_left', lvlTip(kz, loTxt, l.hitLo)));
          if (l.hiLine.length > maxDays) {
            lines.del(l.hiLine.pop());
            lines.del(l.loLine.pop());
            labels.del(l.hiLabel.pop());
            labels.del(l.loLabel.pop());
          }
        }
      }
      if (kz.t) {
        for (const l of kz.levels) {
          if (!l.active) continue;
          if (live(l.hiLine[0])) l.hiLine[0].x2 = t;
          if (live(l.loLine[0])) l.loLine[0].x2 = t;
          if (live(l.hiLabel[0])) l.hiLabel[0].x = t;
          if (live(l.loLabel[0])) l.loLabel[0].x = t;
          if (l.hiValid && high >= l.hitHi.price) {
            l.hiValid = false;
            l.hitHi.success += 1;
            l.hitHi.hitLevel = true;
            l.hitHi.history[0] = true;
            if (live(l.hiLabel[0])) l.hiLabel[0].tooltip = lvlTip(kz, '+' + multText(l), l.hitHi);
          }
          if (l.loValid && low <= l.hitLo.price) {
            l.loValid = false;
            l.hitLo.success += 1;
            l.hitLo.hitLevel = true;
            l.hitLo.history[0] = true;
            if (live(l.loLabel[0])) l.loLabel[0].tooltip = lvlTip(kz, '-' + multText(l), l.hitLo);
          }
          if (tCo) {
            l.active = false;
            l.hiValid = false;
            l.loValid = false;
          }
        }
      }
    }

    // Data table and input warnings (last bar)
    if (last) {
      const statsPivots = cfg.show_pivot_stats && showPivots;
      const statsDwm = cfg.show_dwm_stats && (cfg.dhl || cfg.whl || cfg.mhl);
      const statsLevels = cfg.show_level_stats && cfg.show_levels;
      const lastInstances = (B: boolean[]) => {
        let txt = '';
        const len = Math.min(B.length, lookback) - 1;
        if (B.length > 0) {
          for (let k = 0; k <= len; k++) {
            txt += B[len - k] ? T_TXT : F_TXT;
            if ((k + 1) % 10 === 0) txt += '\n';
          }
        }
        return txt.trim();
      };
      const pct = (v: number) => str.format('{0,number,percent}', v);
      if (cfg.show_data) {
        const cells = new Map<string, TableCellData>();
        const cell = (column: number, row: number, text: string, bg?: string, tooltip?: string) => {
          cells.set(`${column},${row}`, {
            row, column, text, textSize: dataSize, textColor: CHART_FG,
            ...(bg !== undefined ? { bgColor: bg } : {}), ...(tooltip !== undefined ? { tooltip } : {}),
          });
        };
        let c = 1;
        cell(c, 0, 'Range');
        c += 1;
        if (statsPivots || statsDwm) {
          cell(c, 0, 'High');
          c += 1;
          cell(c, 0, 'Low');
          c += 1;
        }
        if (statsLevels) {
          for (const l of kzs[0].levels) {
            if (c < 20) {
              cell(c, 0, '±' + multText(l));
              c += 1;
            }
          }
        }
        kzs.forEach((kz, k) => {
          const row = k + 1;
          if (!(kz.use && kz.box.length > 0)) return;
          let col = 0;
          const avg = roundTick(rangeValue(kz));
          const ratio = kz.rangeCurrent / avg;
          cell(col, row, kz.title, kz.kzColor);
          col += 1;
          const rangeTip = Number.isNaN(avg)
            ? str.format('Current range is {0,number}\n\nNot enough completed sessions to calculate the {1} yet', kz.rangeCurrent, measurement)
            : str.format('Current range is {0,number}, or {1,number,percent} of the {2} ({3,number}) calculated using the last {4} sessions\n\nA colored cell indicates that the current day has exceeded the measured value', kz.rangeCurrent, ratio, measurement, avg, lookback);
          cell(col, row, str.format('{0,number}', kz.rangeCurrent), ratio >= 1.0 ? kz.kzColor : undefined, rangeTip);
          col += 1;
          const stat = (column: number, T: Track) => {
            if (T.total > 0) {
              cell(column, row, pct(T.success / T.total), T.hitLevel ? kz.kzColor : undefined, str.format(
                '{0,number,percent} hit rate over {1} sessions (counted after each session ends), dating back to {2}\n\nLast {3} events (least to most recent):\n{4}',
                T.success / T.total, T.total, fmtDate(kz.startTime[kz.startTime.length - 1]), lookback, lastInstances(T.history)));
            } else cell(column, row, '-');
          };
          if (statsPivots) {
            stat(col, kz.hitHi);
            col += 1;
            stat(col, kz.hitLo);
            col += 1;
          } else if (statsDwm) col += 2;
          if (statsLevels) {
            for (const l of kz.levels) {
              if (col >= 20) continue;
              if (l.hitHi.total > 0) {
                cell(col, row, str.format('{0,number,percent}\n{1,number,percent}', l.hitHi.success / l.hitHi.total, l.hitLo.success / l.hitLo.total),
                  l.hitHi.hitLevel || l.hitLo.hitLevel ? kz.kzColor : undefined, str.format(
                    '+{0}: {1,number,percent} hit rate over {2} sessions\nLast {3} events (least to most recent):\n{4}\n\n-{0}: {5,number,percent} hit rate over {6} sessions\nLast {3} events (least to most recent):\n{7}\n\nA colored cell indicates that a level was hit during the current session',
                    multText(l), l.hitHi.success / l.hitHi.total, l.hitHi.total, lookback, lastInstances(l.hitHi.history),
                    l.hitLo.success / l.hitLo.total, l.hitLo.total, lastInstances(l.hitLo.history)));
              } else cell(col, row, '-');
              col += 1;
            }
          }
        });
        dwmSets.forEach((d, k) => {
          const row = 7 + k;
          const hl = d.data;
          if (!(cfg.show_dwm_stats && d.hl && hl.trackHi.total > 0)) return;
          const col = String(color.new(d.col, DEFAULT_TRANSPARENCY));
          const period = d.period.toLowerCase();
          const curRange = d.info.h - d.info.l;
          const prevRange = d.info.ph - d.info.pl;
          const ratio = curRange / prevRange;
          cell(0, row, 'P' + d.tf, col);
          cell(1, row, str.format('{0,number}', curRange), ratio >= 1.0 ? col : undefined, str.format(
            'Current range is {0,number}, or {1,number,percent} of the previous {2} range ({3,number})\n\nA colored cell indicates that the current {2} has exceeded the previous {2} range',
            curRange, ratio, period, prevRange));
          const stat = (column: number, T: Track, txt: string) => {
            cell(column, row, pct(T.success / T.total), T.hitLevel ? col : undefined, str.format(
              '{0}: {1,number,percent} hit rate over {2} {3}\n\nLast {4} events (least to most recent):\n{5}',
              txt, T.success / T.total, T.total, period + 's', lookback, lastInstances(T.history)));
          };
          stat(2, hl.trackHi, 'P' + d.tf + 'H');
          stat(3, hl.trackLo, 'P' + d.tf + 'L');
        });
        tables.push({
          position: cfg.data_loc.toLowerCase().replace(' ', '_') as TablePosition, columns: 20, rows: 20, cells: [...cells.values()],
          bgColor: CHART_BG, frameColor: CHART_FG, frameWidth: 2, borderColor: CHART_FG, borderWidth: 1,
        });
      }
      if (badOpens + badStamps + badLevels > 0) {
        let msg = 'Some settings could not be read:';
        const entries = (count: number) => (count === 1 ? 'entry' : 'entries');
        if (badOpens > 0) msg += str.format('\n- {0} Opening Prices {1}', badOpens, entries(badOpens));
        if (badStamps > 0) msg += str.format('\n- {0} Timestamps {1}', badStamps, entries(badStamps));
        if (badLevels > 0) msg += str.format('\n- {0} Range Levels {1}', badLevels, entries(badLevels));
        msg += "\n\nExpected formats (one per line):\nOpening Prices: 'Time, Color, Label' - ex. '0930, red, NY Open'\nTimestamps: 'Time, Color' - ex. '1200, black'\nRange Levels: 'Multiplier, Color' - ex. '1.5, purple'\n\nColor and label fields are optional. Times accept 0930, 930, or 09:30. Lines starting with '//' are skipped";
        tables.push({
          position: 'bottom_right', columns: 1, rows: 1,
          cells: [{ row: 0, column: 0, text: '⚠ Settings', textSize: 'small', textColor: CHART_FG, tooltip: msg }],
          bgColor: String(color.new(color.red, 80)), frameColor: CHART_FG, frameWidth: 1, borderColor: CHART_FG, borderWidth: 1,
        });
      }
    }
  }

  // Output (drawings with an na coordinate are not drawn)
  const t2bar = new Map(tMs.map((t, k) => [t, k]));
  const X = (x: number, byTime: boolean) => bars[byTime ? t2bar.get(x)! : x].time;
  const drawn = (...v: number[]) => v.every((x) => !Number.isNaN(x));
  const outLines: LineDrawingData[] = lines.list.filter((l) => drawn(l.x1, l.y1, l.x2, l.y2)).map((l) => ({
    time1: X(l.x1, l.byTime), price1: l.y1, time2: X(l.x2, l.byTime), price2: l.y2, color: l.color, width: l.width, style: l.style,
    ...(l.extend ? { extend: l.extend } : {}),
  }));
  const outBoxes: BoxData[] = boxes.list.filter((b) => drawn(b.left, b.top, b.right, b.bottom)).map((b) => ({
    time1: X(b.left, true), price1: b.top, time2: X(b.right, true), price2: b.bottom, borderColor: b.border, bgColor: b.bg,
  }));
  const outLabels: LabelData[] = labels.list.filter((l) => drawn(l.x, l.y)).map((l) => ({
    time: X(l.x, l.byTime), price: l.y, text: l.text, color: l.color, style: l.style, textColor: l.textColor, size: l.size,
    ...(l.tooltip !== '' ? { tooltip: l.tooltip } : {}),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: outLines,
    boxes: outBoxes,
    labels: outLabels,
    tables,
    markers,
  };
}

export const IctKillzonesPivotsTfo = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
