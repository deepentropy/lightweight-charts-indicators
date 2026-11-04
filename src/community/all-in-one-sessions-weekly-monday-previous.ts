/**
 * All-In-One Sessions, Weekly, Monday, Previous Highs/Lows
 *
 * Key levels drawn on the last bar, from `request.security` of the chart symbol (lookahead off):
 * - Monday high / low: each Monday among the last 7 daily bars (day of the week in the exchange time zone), from the
 *   Monday to the Monday plus (day of the week of the current time - 1) days;
 * - previous day high / low (daily bar [1], two days long), current and previous week high / low (weekly bars [0] /
 *   [1]), current and previous month high / low (monthly bars [0] / [1]), current week and month open;
 * each with an optional 50 % line, a label (abbreviated or full text, 0.01 % above the level, right aligned), an
 * offset of the end in chart bars, a width, a style and an "Extend?" option. The lines use bar times.
 * Sessions (Asia 22:00-07:00, London 08:00-17:00, New York 13:00-21:00 in the "Timezone" input): a box from the
 * session start that follows the session high / low (`ta.highest` / `ta.lowest` back to the bar before the last
 * session start), as long as the previous session, cut at the session end; with "Show Open?" a line and an "O"
 * label at the session open. Without "History?" each new session deletes the boxes of the one before. Six custom
 * levels (high / low / open of a time range on chosen week days) draw a line and a label the same way.
 * The crossing alerts are `ta.cross` calls inside the last-bar block: they run once and are never true.
 *
 * Notes on the port:
 * - The higher timeframe bars are built from the chart bars with the exchange calendar of the chart context. On a
 *   live last bar (`lastBarConfirmed` false) they include the developing bar, else the last completed one, as the
 *   original. A weekly or monthly chart (daily values from a lower timeframe) throws an Error.
 * - `syminfo.timezone` and `timenow` come from the chart context (UTC and the computer clock without it).
 * - The original also requests 97 bars of 15-minute highs / lows and never uses them: not ported.
 *
 * Reference: "All-In-One Sessions, Weekly, Monday, Previous Highs/Lows" by Texmoonbeam
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Texmoonbeam
 */

import {
  box, line, label, callsite, color, time as pineTime, timeframe, resetDrawings, setDrawingBar, varDrawing,
  drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import { lastBarConfirmedOf, nowOf, timezoneOf, type ChartContext } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

type LineStyleOption = 'sol' | 'dot' | 'dsh';
type SizeOption = 'tiny' | 'small' | 'normal' | 'large' | 'huge';
type LevelType = 'high' | 'low' | 'open';

/** Inputs of one high / low level group (Show, Extend, Label, 50 %, colours, width, offset, style) */
type LevelInputs<S extends string, C extends string> =
  Record<`Show${S}` | `Extend${S}` | `Label${S}` | `Mid${S}`, boolean>
  & Record<`${C}HighCol` | `${C}LowCol` | `${C}MidCol`, string>
  & Record<`${C}Width` | `${C}Off`, number>
  & Record<`${C}Style`, LineStyleOption>;

/** Inputs of one open level (week or month) */
type OpenInputs<S extends string> =
  Record<`Show${S}` | `Extend${S}` | `Label${S}`, boolean>
  & Record<`${S}Col`, string> & Record<`${S}Width`, number> & Record<`${S}Style`, LineStyleOption>;

/** Inputs of one session */
type SessionInputs<S extends string> =
  Record<`Show${S}` | `Extend${S}` | `${S}Open`, boolean>
  & Record<`${S}OpenCol` | `${S}Session` | `${S}Col`, string>;

/** Inputs of one custom level */
type CustomInputs<K extends number> =
  Record<`Custom${K}` | `ExtendCustom${K}` | `Custom${K}History`, boolean>
  & Record<`Custom${K}Label` | `Custom${K}Time` | `Custom${K}Days` | `Custom${K}Col`, string>
  & Record<`Custom${K}Type`, LevelType> & Record<`Custom${K}Style`, LineStyleOption>;

export interface AllInOneSessionsInputs extends
  LevelInputs<'Monday', 'Mon'>, LevelInputs<'PrevDay', 'PrevDay'>, LevelInputs<'CurWeek', 'CurWeek'>,
  LevelInputs<'PrevWeek', 'PrevWeek'>, LevelInputs<'CurMth', 'CurMth'>, LevelInputs<'PrevMth', 'PrevMth'>,
  OpenInputs<'WeekOpen'>, OpenInputs<'MthOpen'>,
  SessionInputs<'Asia'>, SessionInputs<'Lon'>, SessionInputs<'NY'>,
  CustomInputs<1>, CustomInputs<2>, CustomInputs<3>, CustomInputs<4>, CustomInputs<5>, CustomInputs<6> {
  /** Abbreviate the label texts */
  abr: boolean;
  /** Label size */
  labelsz: SizeOption;
  /** Time zone of the sessions and custom levels */
  zone: string;
  /** Keep the boxes of earlier sessions */
  i_show_history: boolean;
  /** Line style of the session boxes and lines */
  i_sess_border_style: LineStyleOption;
  /** Line width of the session boxes and lines */
  i_sess_border_width: number;
  /** Transparency of the session backgrounds */
  i_sess_bgopacity: number;
}

const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLUE = '#2962ff';
const BLACK = '#363A45';
const G1 = 'Mondays, Weekly, Monthly';
const E = ' ';

/** Level groups: input name parts, label texts (abbreviated, full), default Show / Label, inline keys */
const LEVELS = [
  { s: 'Monday', c: 'Mon', show: 'Show Monday High/Low', on: true, k: '1' },
  { s: 'PrevDay', c: 'PrevDay', show: 'Show Prev Day High/Low', on: true, k: '2' },
  { s: 'CurWeek', c: 'CurWeek', show: 'Show Current Week High/Low', on: false, k: '3' },
  { s: 'PrevWeek', c: 'PrevWeek', show: 'Show Previous Week High/Low', on: true, k: '4' },
  { s: 'CurMth', c: 'CurMth', show: 'Show Current Month High/Low', on: false, k: '5' },
  { s: 'PrevMth', c: 'PrevMth', show: 'Show Previous Month High/Low', on: true, k: '6' },
] as const;
const OPENS = [
  { s: 'WeekOpen', show: 'Show Current Week Open', k: '3' },
  { s: 'MthOpen', show: 'Show Current Month Open', k: '4' },
] as const;
const SESSIONS = [
  { s: 'Asia', show: `Show Asia Session${E}${E}${E}`, title: `Asia Session${E}${E}${E}`, session: '2200-0700:1234567', col: '76, 175, 80', k: ['1', '2'] },
  { s: 'Lon', show: 'Show London Session', title: 'London Session', session: '0800-1700:1234567', col: '255, 82, 82', k: ['4', '5'] },
  { s: 'NY', show: `Show NY Session${E}${E}${E}${E}`, title: `NY Session${E}${E}${E}${E}`, session: '1300-2100:1234567', col: '0, 188, 212', k: ['7', '8'] },
] as const;
const CUSTOM_TIMES = ['0000-2345', '0015-2345', '1200-1400', '0000-2345', '0015-2345', '1200-1400'];
const ZONES = ['GMT-11', 'GMT-10', 'GMT-9', 'GMT-8', 'GMT-7', 'GMT-6', 'GMT-5', 'GMT-4', 'GMT-3', 'GMT-2', 'GMT-1', 'GMT',
  'GMT+1', 'GMT+2', 'GMT+3', 'GMT+330', 'GMT+4', 'GMT+430', 'GMT+5', 'GMT+530', 'GMT+6', 'GMT+7', 'GMT+8', 'GMT+9',
  'GMT+10', 'GMT+11', 'GMT+12'];
const STYLE_OPTIONS: LineStyleOption[] = ['sol', 'dot', 'dsh'];
const DAYS_TOOLTIP = 'Enter a digit for each day of the week\n1 = Sunday, 2 = Monday, 3 = Tuesday, etc\nFor example Monday to Friday would be 23456.\nFor a continous line through all included days, use time 00:00 - 00:00\nFor a separate line per day, use any time from 00:00 - 23:45.';

function buildDefaults(): AllInOneSessionsInputs {
  const d: Record<string, unknown> = { abr: true, labelsz: 'small' };
  for (const l of LEVELS) {
    Object.assign(d, {
      [`Show${l.s}`]: l.on, [`Extend${l.s}`]: false, [`Label${l.s}`]: l.on, [`Mid${l.s}`]: false,
      [`${l.c}HighCol`]: GREEN, [`${l.c}LowCol`]: RED, [`${l.c}MidCol`]: GREEN, [`${l.c}Width`]: 1, [`${l.c}Off`]: 0,
      [`${l.c}Style`]: 'sol',
    });
  }
  for (const o of OPENS) {
    Object.assign(d, {
      [`Show${o.s}`]: false, [`Extend${o.s}`]: false, [`Label${o.s}`]: false, [`${o.s}Col`]: BLUE, [`${o.s}Width`]: 1,
      [`${o.s}Style`]: 'sol',
    });
  }
  d.zone = 'GMT+1';
  for (const s of SESSIONS) {
    Object.assign(d, {
      [`Show${s.s}`]: true, [`Extend${s.s}`]: false, [`${s.s}Open`]: false,
      [`${s.s}OpenCol`]: `rgba(${s.col}, 0.75)`, [`${s.s}Session`]: s.session, [`${s.s}Col`]: `rgba(${s.col}, 0.1)`,
    });
  }
  Object.assign(d, { i_show_history: false, i_sess_border_style: 'sol', i_sess_border_width: 1, i_sess_bgopacity: 80 });
  for (let k = 1; k <= 6; k++) {
    Object.assign(d, {
      [`Custom${k}`]: false, [`Custom${k}Label`]: '', [`Custom${k}Type`]: 'high', [`Custom${k}Time`]: CUSTOM_TIMES[k - 1],
      [`Custom${k}Days`]: '23456', [`Custom${k}Col`]: BLACK, [`ExtendCustom${k}`]: false, [`Custom${k}History`]: false,
      [`Custom${k}Style`]: 'sol',
    });
  }
  return d as unknown as AllInOneSessionsInputs;
}

export const defaultInputs: AllInOneSessionsInputs = buildDefaults();

function buildInputConfig(): InputConfig[] {
  const c: InputConfig[] = [
    { id: 'abr', type: 'bool', title: 'Abbreviate Labels', defval: true, group: G1, inline: '0a' },
    { id: 'labelsz', type: 'string', title: 'Size', defval: 'small', options: ['tiny', 'small', 'normal', 'large', 'huge'], group: G1, inline: '0a' },
  ];
  for (const l of LEVELS) {
    c.push(
      { id: `Show${l.s}`, type: 'bool', title: l.show, defval: l.on, group: G1, inline: `${l.k}a` },
      { id: `Extend${l.s}`, type: 'bool', title: 'Extend?', defval: false, group: G1, inline: `${l.k}a` },
      { id: `Label${l.s}`, type: 'bool', title: 'Label?', defval: l.on, group: G1, inline: `${l.k}a` },
      { id: `Mid${l.s}`, type: 'bool', title: '50%?', defval: false, group: G1, inline: `${l.k}a` },
      { id: `${l.c}HighCol`, type: 'color', title: 'High', defval: GREEN, group: G1, inline: `${l.k}c` },
      { id: `${l.c}LowCol`, type: 'color', title: 'Low', defval: RED, group: G1, inline: `${l.k}c` },
      { id: `${l.c}MidCol`, type: 'color', title: '0.5', defval: GREEN, group: G1, inline: `${l.k}c` },
      { id: `${l.c}Width`, type: 'int', title: 'Width', defval: 1, min: 1, max: 4, group: G1, inline: `${l.k}c` },
      {
        id: `${l.c}Off`, type: 'int', title: 'Label & Line Offset', defval: 0, group: G1, inline: `${l.k}d`,
        ...(l.s === 'Monday' ? { tooltip: 'Offsets are measured in bars of the current chart timeframe' } : {}),
      },
      { id: `${l.c}Style`, type: 'string', title: 'Line Style', defval: 'sol', options: STYLE_OPTIONS, group: G1, inline: `${l.k}d` },
    );
  }
  for (const o of OPENS) {
    c.push(
      { id: `Show${o.s}`, type: 'bool', title: o.show, defval: false, group: 'Opens', inline: `${o.k}a` },
      { id: `Extend${o.s}`, type: 'bool', title: 'Extend?', defval: false, group: 'Opens', inline: `${o.k}a` },
      { id: `Label${o.s}`, type: 'bool', title: 'Label?', defval: false, group: 'Opens', inline: `${o.k}a` },
      { id: `${o.s}Col`, type: 'color', title: 'Open', defval: BLUE, group: 'Opens', inline: `${o.k}c` },
      { id: `${o.s}Width`, type: 'int', title: 'Width', defval: 1, min: 1, max: 4, group: 'Opens', inline: `${o.k}c` },
      { id: `${o.s}Style`, type: 'string', title: 'Line Style', defval: 'sol', options: STYLE_OPTIONS, group: 'Opens', inline: `${o.k}c` },
    );
  }
  c.push({
    id: 'zone', type: 'string', title: 'Timezone', defval: 'GMT+1', options: ZONES, group: 'Sessions',
    tooltip: "e.g. 'America/New_York', 'Asia/Tokyo', 'GMT-4', 'GMT+9'...",
  });
  for (const s of SESSIONS) {
    c.push(
      { id: `Show${s.s}`, type: 'bool', title: s.show, defval: true, group: 'Sessions', inline: s.k[0] },
      { id: `Extend${s.s}`, type: 'bool', title: 'Extend?', defval: false, group: 'Sessions', inline: s.k[0] },
      { id: `${s.s}Open`, type: 'bool', title: 'Show Open?', defval: false, group: 'Sessions', inline: s.k[0] },
      { id: `${s.s}OpenCol`, type: 'color', title: 'Open Colour', defval: `rgba(${s.col}, 0.75)`, group: 'Sessions', inline: s.k[0] },
      { id: `${s.s}Session`, type: 'session', title: s.title, defval: s.session, group: 'Sessions', inline: s.k[1] },
      { id: `${s.s}Col`, type: 'color', title: 'Colour', defval: `rgba(${s.col}, 0.1)`, group: 'Sessions', inline: s.k[1] },
    );
  }
  c.push(
    { id: 'i_show_history', type: 'bool', title: 'History?', defval: false, group: 'Sessions', inline: 'A' },
    { id: 'i_sess_border_style', type: 'string', title: 'Line Style', defval: 'sol', options: STYLE_OPTIONS, group: 'Sessions', inline: 'B' },
    { id: 'i_sess_border_width', type: 'int', title: 'Line Width', defval: 1, min: 0, group: 'Sessions', inline: 'B' },
    {
      id: 'i_sess_bgopacity', type: 'int', title: 'Background Transparency', defval: 80, min: 0, max: 100, step: 1,
      group: 'Sessions', tooltip: '100 = No Background', inline: 'C',
    },
  );
  for (let k = 1; k <= 6; k++) {
    const g = 'Custom Levels';
    c.push(
      { id: `Custom${k}`, type: 'bool', title: `Show Custom Level ${k}${E}${E}`, defval: false, group: g, inline: `${k}` },
      { id: `Custom${k}Label`, type: 'string', title: 'Label', defval: '', group: g, inline: `${k}` },
      { id: `Custom${k}Type`, type: 'string', title: `${E}${E}Level`, defval: 'high', options: ['high', 'low', 'open'], group: g, inline: `${k}` },
      {
        id: `Custom${k}Time`, type: 'session', title: 'Custom Time Range', defval: CUSTOM_TIMES[k - 1], group: g, inline: `${k}a`,
        ...(k === 2 || k === 5 ? { tooltip: '' } : {}),
      },
      {
        id: `Custom${k}Days`, type: 'string', title: `Days Included${E}${E}${E}${E}${E}`, defval: '23456', group: g,
        inline: `${k}a`, tooltip: DAYS_TOOLTIP,
      },
      { id: `Custom${k}Col`, type: 'color', title: `Custom Level ${k} Colour`, defval: BLACK, group: g, inline: `${k}b` },
      { id: `ExtendCustom${k}`, type: 'bool', title: 'Extend?', defval: false, group: g, inline: `${k}b` },
      { id: `Custom${k}History`, type: 'bool', title: 'History?', defval: false, group: g, inline: `${k}b` },
      { id: `Custom${k}Style`, type: 'string', title: 'Line Style', defval: 'sol', options: STYLE_OPTIONS, group: g, inline: `${k}b` },
    );
  }
  return c;
}

export const inputConfig: InputConfig[] = buildInputConfig();

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const alertConditions: AlertConditionDecl[] = [
  ['Crossing Monday High', 'Price Crossing Monday High'],
  ['Crossing Monday Low', 'Price Crossing Monday Low'],
  ['Crossing Monday Mid', 'Price Crossing Monday Mid'],
  ['Crossing ANY Monday Level', 'Price Crossing A Monday Level'],
  ['Crossing Prev Day High', 'Price Crossing Prev Day High'],
  ['Crossing Prev Day Low', 'Price Crossing Prev Day Low'],
  ['Crossing Prev Day Mid', 'Price Crossing Prev Day Mid'],
  ['Crossing ANY Prev Day Level', 'Price Crossing a Prev Day Level'],
  ['Crossing Current Week High', 'Price Crossing Current Week High'],
  ['Crossing Current Week Low', 'Price Crossing Current Week Low'],
  ['Crossing Current Week Mid', 'Price Crossing Current Week Mid'],
  ['Crossing Current Week Open', 'Price Crossing Current Week Open'],
  ['Crossing ANY Weekly Level', 'Price Crossing a Weekly Level'],
  ['Crossing Prev Week High', 'Price Crossing Prev Week High'],
  ['Crossing Prev Week Low', 'Price Crossing Prev Week Low'],
  ['Crossing Prev Week Mid', 'Price Crossing Prev Week Mid'],
  ['Crossing ANY Prev Week Level', 'Price Crossing a Prev Weekly Level'],
  ['Crossing Current Month High', 'Price Crossing Current Month High'],
  ['Crossing Current Month Low', 'Price Crossing Current Month Low'],
  ['Crossing Current Month Mid', 'Price Crossing Current Month Mid'],
  ['Crossing Current Month Open', 'Price Crossing Current Month Open'],
  ['Crossing ANY Monthly Level', 'Price Crossing a Monthly Level'],
  ['Crossing Prev Month High', 'Price Crossing Prev Month High'],
  ['Crossing Prev Month Low', 'Price Crossing Prev Month Low'],
  ['Crossing Prev Month Mid', 'Price Crossing Prev Month Mid'],
  ['Crossing ANY Prev Monthly Level', 'Price Crossing a Prev Monthly Level'],
].map(([title, message], k) => ({ id: `alert${k}`, title, message }));

export const metadata = {
  title: 'All-In-One Sessions, Weekly, Monday, Previous Highs/Lows',
  shortTitle: 'All-In-One Sessions, Weekly, Monday, Previous Highs/Lows',
  overlay: true,
};

const LINE_STYLE = { sol: 'solid', dot: 'dotted', dsh: 'dashed' } as const;
const DAY_MS = 86400000;
const MAX_BARS = 500;
const LOOKBACK = 12 * 120;

/** ResolutionToSec(timeframe.period): the bar length in ms of the listed resolutions, else 0 */
function resolutionMs(tf: string): number {
  const mins: Record<string, number> = {
    '1': 1, '3': 3, '5': 5, '10': 10, '15': 15, '30': 30, '45': 45, '60': 60, '120': 120, '180': 180, '240': 240,
    D: 1440, '1D': 1440, W: 10080, '1W': 10080, M: 43200, '1M': 43200,
  };
  return (mins[tf] ?? 0) * 60 * 1000;
}

/** Values of `high[n]`, `low[n]`, `open[n]`, `time[n]` (ms) of a timeframe on the last bar, n = 0 .. count - 1 */
interface HtfValues {
  high: number[];
  low: number[];
  open: number[];
  time: number[];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AllInOneSessionsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs } as AllInOneSessionsInputs;
  const get = <T>(key: string) => (cfg as unknown as Record<string, T>)[key];
  const n = bars.length;
  const ms = n > 0 && bars[0].time < 1e12 ? 1000 : 1;
  const tz = timezoneOf(chart);
  const now = nowOf(chart);
  const tf = chartTimeframe(bars, chart);
  const barLen = resolutionMs(tf);
  const sz = cfg.labelsz;

  // ---- request.security(syminfo.tickerid, tf, ...) of the daily, weekly and monthly bars, on the last bar
  const chartSec = tf === '' ? NaN : timeframe.in_seconds(tf);
  const htfValues = (htfTf: string, count: number): HtfValues => {
    const out: HtfValues = { high: [], low: [], open: [], time: [] };
    if (n === 0) return out;
    const sec = timeframe.in_seconds(htfTf);
    let src: Bar[];
    let g0: number;
    if (sec === chartSec) {
      src = bars;
      g0 = n - 1;
    } else if (sec < chartSec) {
      throw new Error(`All-In-One Sessions: the "${htfTf}" values need a timeframe below the chart timeframe "${tf}"`);
    } else {
      const res = higherTimeframeBars(bars, htfTf, chart);
      src = res.htf;
      // a live last bar shows the developing bar of the timeframe, a closed one the last completed bar
      g0 = lastBarConfirmedOf(chart) ? res.latest[n - 1] : res.group[n - 1];
    }
    for (let k = 0; k < count; k++) {
      const b = g0 - k >= 0 ? src[g0 - k] : undefined;
      out.high.push(b ? b.high : NaN);
      out.low.push(b ? b.low : NaN);
      out.open.push(b ? b.open : NaN);
      out.time.push(b ? b.time * ms : NaN);
    }
    return out;
  };
  const mDay = htfValues('1D', 7);
  const mWeek = htfValues('1W', 2);
  const mMonth = htfValues('1M', 2);

  // ---- session flags: time(timeframe.period, session, zone) is not na
  const barMs = tf === '' ? undefined : timeframe.in_seconds(tf) * 1000;
  const flags = (session: string) => bars.map((b) => pineTime.inSession(b.time * ms, session, cfg.zone, barMs));

  resetDrawings({ line: 500, label: 500, box: 500 });

  // ---- one session (draw + f_render_session) or custom level (drawcustom + f_render_custom) call site
  const makeSite = (sess: boolean[], custom: boolean) => {
    const s = (j: number) => j >= 0 && sess[j];
    const hi = callsite.highest();
    const lo = callsite.lowest();
    const myBox = varDrawing<Box>();
    const myLine = varDrawing<Line>();
    const myLabel = varDrawing<Label>();
    const boxHist: (Box | undefined)[] = [];
    const lineHist: (Line | undefined)[] = [];
    const labelHist: (Label | undefined)[] = [];
    const starts: number[] = [];
    let lastEnd = NaN;
    let sessionOpen = 0;
    let level = 0;
    return (i: number, o: {
      show: boolean; showOpen?: boolean; color: string; openColor?: string; extend: boolean; history: boolean;
      label?: string; type?: LevelType; style: LineStyleOption;
    }): void => {
      const b = bars[i];
      // f_get_period: bars back to the bar before the last session start (from 1 bar back)
      let max = 1;
      for (let k = 1; k <= LOOKBACK; k++) {
        if (!s(i - k - 1) && s(i - k)) {
          max = k + 1;
          break;
        }
      }
      const top = hi(b.high, max);
      const bottom = lo(b.low, max);
      const isStarted = !s(i - 1) && s(i);
      const isEnded = !s(i) && s(i - 1);
      const deleteHistory = !o.history || o.extend;
      if (isStarted) starts.push(i);
      if (isEnded) lastEnd = i;
      const x01 = starts.length >= 2 ? starts[starts.length - 2] : NaN;
      const x02 = lastEnd;
      const style = LINE_STYLE[o.style];
      const width = cfg.i_sess_border_width;
      if (o.show) {
        if (custom) level = o.type === 'high' ? top : o.type === 'low' ? bottom : sessionOpen;
        if (isStarted) {
          const diff = Math.abs(x02 - x01);
          const x1 = i;
          const x2 = i + Math.min(diff, MAX_BARS);
          if (!custom) {
            const op = cfg.i_sess_bgopacity;
            myBox.value = box.new(x1, top, x2, bottom, String(color.new(o.color, op / 1.1)), width, style, 'none',
              'bar_index', String(color.new(o.color, op)));
            if (o.showOpen) {
              myLine.value = line.new(x1, b.open, x2, b.open, 'bar_index', 'none', o.openColor, style, width);
              myLabel.value = label.new(x2 - 2, b.open, cfg.abr ? 'O' : 'Open', 'bar_index', 'price', '#FFFFFF', 'none',
                o.openColor, 'small', 'left');
            }
          } else {
            myLine.value = line.new(x1, level, x2, level, 'bar_index', 'none', o.color, style, width);
            myLabel.value = label.new(x2 - 2, level, o.label ?? '', 'bar_index', 'price', '#FFFFFF', 'none', o.color, sz, 'left');
          }
          sessionOpen = b.open;
          if (o.extend) {
            if (!custom && myBox.value) box.set_extend(myBox.value, 'right');
            if (myLine.value) line.set_extend(myLine.value, 'right');
          }
          if (deleteHistory) {
            const prevBox = boxHist[i - 1];
            const prevLine = lineHist[i - 1];
            const prevLabel = labelHist[i - 1];
            if (!custom && prevBox) box.delete(prevBox);
            if (prevLine) line.delete(prevLine);
            if (prevLabel) label.delete(prevLabel);
          } else if (!custom) {
            // back = 2000 * 60 / int(str.tonumber(timeframe.period)), at most 4999; na on "D" / "W" / "M" charts,
            // where my_box[na] is the box of this bar
            const period = tf === '' ? NaN : Math.trunc(Number(tf));
            const q = (2000 * 60) / period;
            const back = q >= 5000 ? 4999 : q;
            const target = Number.isFinite(back) ? boxHist[i - Math.trunc(back)] : myBox.value;
            if (target) box.delete(target);
          }
        } else if (s(i)) {
          if (!custom) {
            if (myBox.value) {
              box.set_top(myBox.value, top);
              box.set_bottom(myBox.value, bottom);
            }
          } else {
            if (myLine.value) {
              line.set_y1(myLine.value, level);
              line.set_y2(myLine.value, level);
            }
            if (myLabel.value) label.set_y(myLabel.value, level);
          }
        } else if (isEnded) {
          sessionOpen = NaN;
          if (!custom) {
            if (myBox.value) box.set_right(myBox.value, i);
          } else {
            if (myLine.value) line.set_x2(myLine.value, i);
            if (myLabel.value) label.set_x(myLabel.value, i);
          }
        }
      }
      boxHist[i] = myBox.value;
      lineHist[i] = myLine.value;
      labelHist[i] = myLabel.value;
    };
  };

  const sessionSites = SESSIONS.map((s) => ({ s, site: makeSite(flags(get<string>(`${s.s}Session`)), false) }));
  const customSites = [1, 2, 3, 4, 5, 6].map((k) => ({
    k, site: makeSite(flags(`${get<string>(`Custom${k}Time`)}:${get<string>(`Custom${k}Days`)}`), true),
  }));

  // ---- crossing flags of the last-bar block (ta.cross calls that run only once: never true)
  const crossFlags: boolean[][] = alertConditions.map(() => new Array(n).fill(false));

  // ---- the last-bar block: level lines and labels
  const lastBarBlock = (i: number) => {
    const close = bars[i].close;
    const dow = pineTime.dayofweek(now, tz);
    const dom = pineTime.dayofmonth(now, tz);
    const t = (abbr: string, full: string) => (cfg.abr ? abbr : full);
    const lvl = (
      x1: number, x2: number, y: number, ext: boolean, col: string, style: LineStyleOption, width: number,
    ) => line.new(x1, y, x2, y, 'bar_time', ext ? 'right' : 'none', col, LINE_STYLE[style], width);
    const lab = (x: number, y: number, text: string, col: string, size: string = sz) => label.new(x, y, text, 'bar_time',
      'price', '#FFFFFF', 'none', col, size, 'right');
    const cross = (a: number, b: number) => callsite.cross()(a, b);
    const flag = (k: number, v: boolean) => {
      crossFlags[k][i] = v;
    };

    /** High / low level group: lines, crossings, 50 % line, labels */
    const group = (
      s: string, c: string, x1: number, x2: number, h: number, l: number, texts: [string, string, string],
      alert: [number, number, number], midLabelY: number, midSize: string = sz,
    ) => {
      const ext = get<boolean>(`Extend${s}`);
      const style = get<LineStyleOption>(`${c}Style`);
      const width = get<number>(`${c}Width`);
      const hc = get<string>(`${c}HighCol`);
      const lc = get<string>(`${c}LowCol`);
      const mc = get<string>(`${c}MidCol`);
      lvl(x1, x2, h, ext, hc, style, width);
      lvl(x1, x2, l, ext, lc, style, width);
      flag(alert[0], cross(close, h));
      flag(alert[1], cross(close, l));
      const mid = h - (h - l) / 2;
      if (get<boolean>(`Mid${s}`)) {
        lvl(x1, x2, mid, ext, mc, style, width);
        flag(alert[2], cross(close, mid));
      }
      if (get<boolean>(`Label${s}`)) {
        lab(x2, h * 1.0001, texts[0], hc);
        lab(x2, l * 1.0001, texts[1], lc);
        if (get<boolean>(`Mid${s}`)) lab(x2, midLabelY, texts[2], mc, midSize);
      }
    };

    // Monday high / low: each Monday among the 7 daily bars
    for (let x = 0; x <= mDay.high.length - 1; x++) {
      const st = mDay.time[x];
      if (!Number.isNaN(st) && pineTime.dayofweek(st, tz) === 2 && cfg.ShowMonday) {
        const x2 = st + DAY_MS * (dow - 1) + barLen * cfg.MonOff;
        const h = mDay.high[x];
        const l = mDay.low[x];
        group('Monday', 'Mon', st, x2, h, l, [t('MH', 'Mon High'), t('ML', 'Mon Low'), t('M.5', 'Mon 0.5')], [0, 1, 2],
          (h - (h - l) / 2) * 1.0001);
      }
    }
    // the 50 % labels of the other groups are h - (h - l) / 2 * 1.0001 in the original
    const midY = (h: number, l: number) => h - ((h - l) / 2) * 1.0001;
    if (cfg.ShowPrevDay) {
      const h = mDay.high[1];
      const l = mDay.low[1];
      group('PrevDay', 'PrevDay', mDay.time[1], mDay.time[1] + DAY_MS * 2 + barLen * cfg.PrevDayOff, h, l,
        [t('PDH', 'Prev Day High'), t('PDL', 'Prev Day Low'), t('PD.5', 'Prev Day 0.5')], [4, 5, 6], midY(h, l));
    }
    if (cfg.ShowPrevWeek) {
      const h = mWeek.high[1];
      const l = mWeek.low[1];
      group('PrevWeek', 'PrevWeek', mWeek.time[1], mWeek.time[1] + DAY_MS * (dow + 6) + barLen * cfg.PrevWeekOff, h, l,
        [t('PWH', 'Prev Week High'), t('PWL', 'Prev Week Low'), t('PW.5', 'Prev Week 0.5')], [13, 14, 15], midY(h, l));
    }
    if (cfg.ShowCurWeek) {
      const h = mWeek.high[0];
      const l = mWeek.low[0];
      group('CurWeek', 'CurWeek', mWeek.time[0], mWeek.time[0] + DAY_MS * (dow - 1) + barLen * cfg.CurWeekOff, h, l,
        [t('WH', 'Weekly High'), t('WL', 'Weekly Low'), t('W.5', 'Weekly 0.5')], [8, 9, 10], midY(h, l));
    }
    if (cfg.ShowPrevMth) {
      const h = mMonth.high[1];
      const l = mMonth.low[1];
      group('PrevMth', 'PrevMth', mMonth.time[1], mMonth.time[1] + DAY_MS * (dom + 31) + barLen * cfg.PrevMthOff, h, l,
        [t('PMthH', 'Prev Month High'), t('PMthL', 'Prev Month Low'), t('PMth.5', 'Prev Month 0.5')], [22, 23, 24],
        midY(h, l));
    }
    if (cfg.ShowCurMth) {
      const h = mMonth.high[0];
      const l = mMonth.low[0];
      // the 50 % label of the current month is always small in the original
      group('CurMth', 'CurMth', mMonth.time[0], mMonth.time[0] + DAY_MS * dom + barLen * cfg.CurMthOff, h, l,
        [t('MthH', 'Month High'), t('MthL', 'Month Low'), t('Mth.5', 'Month 0.5')], [17, 18, 19], midY(h, l), 'small');
    }
    if (cfg.ShowWeekOpen) {
      const x2 = mWeek.time[0] + DAY_MS * (dow - 1);
      const y = mWeek.open[0];
      lvl(mWeek.time[0], x2, y, cfg.ExtendWeekOpen, cfg.WeekOpenCol, cfg.WeekOpenStyle, cfg.WeekOpenWidth);
      flag(11, cross(close, y));
      if (cfg.LabelWeekOpen) lab(x2, y * 1.0001, t('WO', 'Week Open'), cfg.WeekOpenCol);
    }
    if (cfg.ShowMthOpen) {
      const x2 = mMonth.time[0] + DAY_MS * dom;
      const y = mMonth.open[0];
      lvl(mMonth.time[0], x2, y, cfg.ExtendMthOpen, cfg.MthOpenCol, cfg.MthOpenStyle, cfg.MthOpenWidth);
      flag(20, cross(close, y));
      if (cfg.LabelMthOpen) lab(x2, y * 1.0001, t('MthO', 'Month Open'), cfg.MthOpenCol);
    }
    // "ANY" alerts: the or of their group
    const any = (k: number, parts: number[]) => flag(k, parts.some((p) => crossFlags[p][i]));
    any(3, [0, 1, 2]);
    any(7, [4, 5, 6]);
    any(12, [8, 9, 10, 11]);
    any(16, [13, 14, 15]);
    any(21, [17, 18, 19, 20]);
    any(25, [22, 23, 24]);
  };

  // drawcustom: levels 4 to 6 take the Extend? input of levels 1 to 3, as the original
  const customExtend = [1, 2, 3, 1, 2, 3];
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (i === n - 1) lastBarBlock(i);
    for (const { s, site } of sessionSites) {
      site(i, {
        show: get<boolean>(`Show${s.s}`), showOpen: get<boolean>(`${s.s}Open`), color: get<string>(`${s.s}Col`),
        openColor: get<string>(`${s.s}OpenCol`), extend: get<boolean>(`Extend${s.s}`), history: cfg.i_show_history,
        style: cfg.i_sess_border_style,
      });
    }
    for (const { k, site } of customSites) {
      site(i, {
        show: get<boolean>(`Custom${k}`), color: get<string>(`Custom${k}Col`), label: get<string>(`Custom${k}Label`),
        type: get<LevelType>(`Custom${k}Type`), extend: get<boolean>(`ExtendCustom${customExtend[k - 1]}`),
        history: get<boolean>(`Custom${k}History`), style: get<LineStyleOption>(`Custom${k}Style`),
      });
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, crossFlags),
  };
}

export const AllInOneSessions = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
