/**
 * ICT HTF Candles (fadi)
 *
 * Draws the last candles of up to six higher timeframes to the right of the last bar. Each timeframe ("HTF 1" to
 * "HTF 6", with the number of candles to show) is used when it is above the chart timeframe and, for an intraday
 * timeframe, a whole multiple of it; "Limit to next HTFs only" caps the number of sets. A candle starts on the chart
 * bar where `time(tf)` changes (with "Custom daily candle open", the daily candle starts at New York midnight, 8:30 or
 * 9:30) and follows the chart bars until the next one: open of its first bar, highest high, lowest low, close of the
 * latest bar. On the last bar the candles of each set are placed side by side ("padding from current candles",
 * "space between candles", "space between Higher Timeframes", "Candle Width"), with the timeframe name above and below
 * the sets (aligned on all sets or on each set), the time left in the current candle, and optional letters per candle
 * ("Interval Value": day of the week, minute, hour or month). Between the candles of a set, the script marks the fair
 * value gaps (a candle whose low is above the high of the candle two places before, bodies apart too) and the volume
 * imbalances (bodies apart while the wicks overlap). "Trace lines" draws lines from the open, close, high and low of
 * the current candle of one set back to the chart bars where they happened, with optional price labels.
 *
 * Chart context (optional third argument): the exchange time zone and session give the periods of the timeframes
 * (`time(tf)`, `time_tradingday`; without them the UTC rule of anchor-period.ts). The remaining time is computed only
 * when the last bar receives live updates (`chart.realtime`, `barstate.isrealtime`), from `chart.now`; otherwise it
 * shows "n/a", as the original on historical bars.
 *
 * Reference: "ICT HTF Candles (fadi)" by fadizeidan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fadizeidan
 */

import {
  str, time as ptime, timeframe, line, box, label, resetDrawings, setDrawingBar, drawingOutputs, periodClose,
  chartSessions, type SessionContext, type Bar, type Box, type Label, type Line, type IndicatorResult, type InputConfig,
  type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, hasCalendar, periodStarts, tradingDays } from '../anchor-period';
import { nowOf, type ChartContext } from '../chart-context';

type Size = 'tiny' | 'small' | 'normal' | 'large' | 'huge';
type TraceStyle = '⎯⎯⎯' | '----' | '····';

export interface IctHtfCandlesInputs {
  htf1Show: boolean;
  htf1: string;
  htf1Max: number;
  htf2Show: boolean;
  htf2: string;
  htf2Max: number;
  htf3Show: boolean;
  htf3: string;
  htf3Max: number;
  htf4Show: boolean;
  htf4: string;
  htf4Max: number;
  htf5Show: boolean;
  htf5: string;
  htf5Max: number;
  htf6Show: boolean;
  htf6: string;
  htf6Max: number;
  maxSets: number;
  useCustomDaily: boolean;
  customDaily: 'Midnight' | '8:30' | '9:30';
  bullBody: string;
  bearBody: string;
  bullBorder: string;
  bearBorder: string;
  bullWick: string;
  bearWick: string;
  offset: number;
  buffer: number;
  htfBuffer: number;
  width: number;
  htfLabelShow: boolean;
  htfLabelColor: string;
  htfLabelSize: Size;
  labelPosition: 'Both' | 'Top' | 'Bottom';
  labelAlignment: 'Align' | 'Follow Candles';
  htfTimerShow: boolean;
  htfTimerColor: string;
  htfTimerSize: Size;
  dailyName: boolean;
  dowColor: string;
  dowSize: Size;
  fvgShow: boolean;
  fvgColor: string;
  viShow: boolean;
  viColor: string;
  traceShow: boolean;
  traceOColor: string;
  traceOStyle: TraceStyle;
  traceOSize: number;
  traceCColor: string;
  traceCStyle: TraceStyle;
  traceCSize: number;
  traceHColor: string;
  traceHStyle: TraceStyle;
  traceHSize: number;
  traceLColor: string;
  traceLStyle: TraceStyle;
  traceLSize: number;
  traceAnchor: 'First Timeframe' | 'Last Timeframe';
  labelShow: boolean;
  labelColor: string;
  labelSize: Size;
}

const BLACK90 = 'rgba(54, 58, 69, 0.9)';
const GRAY50 = 'rgba(120, 123, 134, 0.5)';
const DOTS: TraceStyle = '····';

export const defaultInputs: IctHtfCandlesInputs = {
  htf1Show: true,
  htf1: '5',
  htf1Max: 10,
  htf2Show: true,
  htf2: '15',
  htf2Max: 10,
  htf3Show: true,
  htf3: '60',
  htf3Max: 10,
  htf4Show: true,
  htf4: '240',
  htf4Max: 10,
  htf5Show: true,
  htf5: '1D',
  htf5Max: 10,
  htf6Show: true,
  htf6: '1W',
  htf6Max: 10,
  maxSets: 6,
  useCustomDaily: false,
  customDaily: 'Midnight',
  bullBody: 'rgba(76, 175, 80, 0.9)',
  bearBody: 'rgba(242, 54, 69, 0.9)',
  bullBorder: BLACK90,
  bearBorder: BLACK90,
  bullWick: BLACK90,
  bearWick: BLACK90,
  offset: 10,
  buffer: 1,
  htfBuffer: 10,
  width: 1,
  htfLabelShow: true,
  htfLabelColor: BLACK90,
  htfLabelSize: 'large',
  labelPosition: 'Both',
  labelAlignment: 'Align',
  htfTimerShow: true,
  htfTimerColor: BLACK90,
  htfTimerSize: 'normal',
  dailyName: false,
  dowColor: '#363A45',
  dowSize: 'small',
  fvgShow: true,
  fvgColor: 'rgba(120, 123, 134, 0.2)',
  viShow: true,
  viColor: 'rgba(242, 54, 69, 0.5)',
  traceShow: false,
  traceOColor: GRAY50,
  traceOStyle: DOTS,
  traceOSize: 1,
  traceCColor: GRAY50,
  traceCStyle: DOTS,
  traceCSize: 1,
  traceHColor: GRAY50,
  traceHStyle: DOTS,
  traceHSize: 1,
  traceLColor: GRAY50,
  traceLStyle: DOTS,
  traceLSize: 1,
  traceAnchor: 'First Timeframe',
  labelShow: false,
  labelColor: BLACK90,
  labelSize: 'small',
};

const SIZES: Size[] = ['tiny', 'small', 'normal', 'large', 'huge'];
const STYLES: TraceStyle[] = ['⎯⎯⎯', '----', DOTS];
const gStyle = 'Styling  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const gLabel = 'Label Settings  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const gImb = 'Imbalance  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const gTrace = 'Trace  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const sp = (k: number) => ' '.repeat(k);

const htfInputs = (k: number, tf: string): InputConfig[] => [
  { id: `htf${k}Show`, type: 'bool', title: `HTF ${k}${sp(6)}`, defval: true, inline: `htf${k}` },
  { id: `htf${k}`, type: 'timeframe', title: '', defval: tf, inline: `htf${k}` },
  { id: `htf${k}Max`, type: 'int', title: '', defval: 10, inline: `htf${k}` },
];
const traceInputs = (key: 'O' | 'C' | 'H' | 'L', title: string, inline: string): InputConfig[] => [
  { id: `trace${key}Color`, type: 'color', title, defval: GRAY50, inline, group: gTrace },
  { id: `trace${key}Style`, type: 'string', title: '', defval: DOTS, options: STYLES, inline, group: gTrace },
  { id: `trace${key}Size`, type: 'int', title: '', defval: 1, min: 1, max: 4, inline, group: gTrace }, // Pine options = [1, 2, 3, 4]
];

export const inputConfig: InputConfig[] = [
  ...htfInputs(1, '5'),
  ...htfInputs(2, '15'),
  ...htfInputs(3, '60'),
  ...htfInputs(4, '240'),
  ...htfInputs(5, '1D'),
  ...htfInputs(6, '1W'),
  { id: 'maxSets', type: 'int', title: 'Limit to next HTFs only', defval: 6, min: 1, max: 6 },
  { id: 'useCustomDaily', type: 'bool', title: `Custom daily candle open${sp(5)}`, defval: false, inline: 'customdaily' },
  { id: 'customDaily', type: 'string', title: '', defval: 'Midnight', options: ['Midnight', '8:30', '9:30'], inline: 'customdaily' },
  { id: 'bullBody', type: 'color', title: `Body${sp(2)}`, defval: defaultInputs.bullBody, inline: 'body', group: gStyle },
  { id: 'bearBody', type: 'color', title: '', defval: defaultInputs.bearBody, inline: 'body', group: gStyle },
  { id: 'bullBorder', type: 'color', title: 'Borders', defval: BLACK90, inline: 'borders', group: gStyle },
  { id: 'bearBorder', type: 'color', title: '', defval: BLACK90, inline: 'borders', group: gStyle },
  { id: 'bullWick', type: 'color', title: `Wick${sp(2)}`, defval: BLACK90, inline: 'wick', group: gStyle },
  { id: 'bearWick', type: 'color', title: '', defval: BLACK90, inline: 'wick', group: gStyle },
  { id: 'offset', type: 'int', title: 'padding from current candles', defval: 10, min: 1, group: gStyle },
  { id: 'buffer', type: 'int', title: 'space between candles', defval: 1, min: 1, max: 4, group: gStyle },
  { id: 'htfBuffer', type: 'int', title: 'space between Higher Timeframes', defval: 10, min: 1, max: 10, group: gStyle },
  { id: 'width', type: 'int', title: 'Candle Width', defval: 1, min: 1, max: 4, group: gStyle },
  { id: 'htfLabelShow', type: 'bool', title: `HTF Label${sp(11)}`, defval: true, group: gLabel, inline: 'HTFlabel' },
  { id: 'htfLabelColor', type: 'color', title: '', defval: BLACK90, group: gLabel, inline: 'HTFlabel' },
  { id: 'htfLabelSize', type: 'string', title: '', defval: 'large', options: SIZES, group: gLabel, inline: 'HTFlabel' },
  { id: 'labelPosition', type: 'string', title: 'Label Positions', defval: 'Both', options: ['Both', 'Top', 'Bottom'], group: gLabel },
  { id: 'labelAlignment', type: 'string', title: 'Label Alignment', defval: 'Align', options: ['Align', 'Follow Candles'], group: gLabel },
  { id: 'htfTimerShow', type: 'bool', title: `Remaining time${sp(6)}`, defval: true, inline: 'timer', group: gLabel },
  { id: 'htfTimerColor', type: 'color', title: '', defval: BLACK90, inline: 'timer', group: gLabel },
  { id: 'htfTimerSize', type: 'string', title: '', defval: 'normal', options: SIZES, group: gLabel, inline: 'timer' },
  { id: 'dailyName', type: 'bool', title: `Interval Value${sp(8)}`, defval: false, group: gLabel, inline: 'dow' },
  { id: 'dowColor', type: 'color', title: '', defval: '#363A45', group: gLabel, inline: 'dow' },
  { id: 'dowSize', type: 'string', title: '', defval: 'small', options: SIZES, group: gLabel, inline: 'dow' },
  { id: 'fvgShow', type: 'bool', title: `Fair Value Gap${sp(3)}`, defval: true, group: gImb, inline: 'fvg' },
  { id: 'fvgColor', type: 'color', title: '', defval: defaultInputs.fvgColor, inline: 'fvg', group: gImb },
  { id: 'viShow', type: 'bool', title: 'Volume Imbalance', defval: true, group: gImb, inline: 'vi' },
  { id: 'viColor', type: 'color', title: '', defval: defaultInputs.viColor, inline: 'vi', group: gImb },
  { id: 'traceShow', type: 'bool', title: 'Trace lines', defval: false, group: gTrace },
  ...traceInputs('O', `Open${sp(4)}`, '1'),
  ...traceInputs('C', `Close${sp(4)}`, '2'),
  ...traceInputs('H', `High${sp(5)}`, '3'),
  ...traceInputs('L', `Low${sp(5)}`, '4'),
  { id: 'traceAnchor', type: 'string', title: 'Anchor to', defval: 'First Timeframe', options: ['First Timeframe', 'Last Timeframe'], group: gTrace },
  { id: 'labelShow', type: 'bool', title: `Price Label${sp(11)}`, defval: false, inline: 'label' },
  { id: 'labelColor', type: 'color', title: '', defval: BLACK90, inline: 'label' },
  { id: 'labelSize', type: 'string', title: '', defval: 'small', options: SIZES, inline: 'label' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'ICT HTF Candles (fadi)',
  shortTitle: 'ICT HTF Candles (fadi)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const NY = 'America/New_York';
const TRANSPARENT = '#ffffff00';
/** Box text colour of Pine v6 (box.new without text_color) */
const BOX_TEXT = '#ffffff';

interface Candle {
  o: number;
  c: number;
  h: number;
  l: number;
  oTime: number;
  oIdx: number;
  cIdx: number;
  hIdx: number;
  lIdx: number;
  dow: string;
  body: Box;
  wickUp: Line;
  wickDown: Line;
  dowLabel: Label | null;
}

interface CandleSet {
  show: boolean;
  htf: string;
  maxDisplay: number;
  candles: Candle[];
  imbalances: Box[];
  tfNameTop: Label | null;
  tfNameBottom: Label | null;
  tfTimerTop: Label | null;
  tfTimerBottom: Label | null;
  /** time(htf) of each bar */
  starts: number[];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IctHtfCandlesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings({ line: 500, box: 500, label: 500 });
  if (n === 0) return base;

  const msUnit = bars[0].time >= 1e12 ? 1 : 1000;
  const tMs = (i: number) => bars[i].time * msUnit;
  const width = Math.trunc(cfg.width) * 2;
  const buffer = Math.trunc(cfg.buffer);
  const htfBuffer = Math.trunc(cfg.htfBuffer);
  const maxSets = Math.trunc(cfg.maxSets);
  const chartTf = chartTimeframe(bars, chart);
  const chartSec = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
  const realtime = chart?.realtime === true;

  // method ValidTimeframe(HTF)
  const validTimeframe = (htf: string) => {
    const n2 = timeframe.in_seconds(htf);
    if (n2 >= timeframe.in_seconds('D') && n2 > chartSec) return true;
    const n1 = chartSec;
    return n1 < n2 && Math.round(n2 / n1) === n2 / n1;
  };

  const raw: Array<[boolean, string, number]> = [
    [cfg.htf1Show, cfg.htf1, cfg.htf1Max], [cfg.htf2Show, cfg.htf2, cfg.htf2Max], [cfg.htf3Show, cfg.htf3, cfg.htf3Max],
    [cfg.htf4Show, cfg.htf4, cfg.htf4Max], [cfg.htf5Show, cfg.htf5, cfg.htf5Max], [cfg.htf6Show, cfg.htf6, cfg.htf6Max],
  ];
  const valid = raw.map(([show, htf]) => show && validTimeframe(htf));
  const sets: CandleSet[] = raw.map(([show, htf, max], k) => ({
    show, htf, maxDisplay: Math.trunc(max), candles: [], imbalances: [],
    tfNameTop: null, tfNameBottom: null, tfTimerTop: null, tfTimerBottom: null,
    // time(htf, 'america/New_York'): the second argument is a session string; the periods are those of the symbol
    starts: valid[k] ? periodStarts(bars, htf, chart) : [],
  }));

  // method HTFEnabled()
  const enabled = raw.filter(([show]) => show).length;
  const lastSet = Math.min(enabled, maxSets);
  /** The sets that the script uses, in order (show, valid timeframe, and fewer than `lastSet` before) */
  const used: boolean[] = [];
  {
    let cnt = 0;
    for (let k = 0; k < 6; k++) {
      used.push(valid[k] && (k === 0 || cnt < lastSet));
      if (used[k]) cnt += 1;
    }
  }

  // time_tradingday (00:00 UTC of the trading day) of each bar, in ms
  const tradingDay = (() => {
    const days = tradingDays(bars, chart);
    return (i: number) => (days ? days[i] * msUnit : Math.floor(tMs(i) / 86400000) * 86400000);
  })();

  // Exchange calendar for time_close(htf) (remaining time on a live last bar)
  let calendar: SessionContext | null = null;
  if (hasCalendar(chart) && chartTf !== '') {
    calendar = {
      timeframe: chartTf, timezone: chart!.timezone, session: chart!.session, regularSession: chart!.regularSession,
      timeUnit: msUnit === 1 ? 'ms' : 's',
    };
    try {
      chartSessions(calendar);
    } catch {
      calendar = null;
    }
  }

  // method RemainingTime(HTF): only on a realtime bar
  const remainingTime = (set: CandleSet, i: number) => {
    if (!(realtime && i === n - 1)) return 'n/a';
    // time_close(htf): ms from the library calendar
    let close = calendar ? periodClose(bars[i].time, set.htf, calendar) : NaN;
    if (Number.isNaN(close)) close = nextPeriodStart(set.starts[i] * msUnit, set.htf);
    const timeRemaining = (close - nowOf(chart)) / 1000;
    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining - days * 86400) / 3600);
    const minutes = Math.floor((timeRemaining - days * 86400 - hours * 3600) / 60);
    const seconds = Math.floor(timeRemaining - days * 86400 - hours * 3600 - minutes * 60);
    let r = str.tostring(seconds, '00');
    if (minutes > 0 || hours > 0 || days > 0) r = `${str.tostring(minutes, '00')}:${r}`;
    if (hours > 0 || days > 0) r = `${str.tostring(hours, '00')}:${r}`;
    if (days > 0) r = `${str.tostring(days)}D ${r}`;
    return r;
  };

  // method HTFName(HTF)
  const htfName = (htf: string) => {
    const seconds = timeframe.in_seconds(htf);
    if (seconds < 60) return `${str.tostring(seconds)}s`;
    if (seconds / 60 < 60) return `${str.tostring(seconds / 60)}m`;
    if (seconds / 60 / 60 < 24) return `${str.tostring(seconds / 60 / 60)}H`;
    return htf;
  };

  // method DayofWeek(index): as the original (1 is the Sunday of dayofweek)
  const dayLetter = (index: number) => (['', 'M', 'T', 'W', 'T', 'F', 'S', 'S'][index] ?? '');

  const candleSetHigh = (candles: Candle[], h: number) => {
    let out = h;
    for (const c of candles) if (gt(c.h, out)) out = c.h;
    return out;
  };
  const candleSetLow = (candles: Candle[], l: number) => {
    let out = l;
    for (const c of candles) if (lt(c.l, out)) out = c.l;
    return out;
  };
  const candlesHigh = (candles: Candle[]) => {
    let h = 0;
    for (let k = 0; k < 6; k++) if (used[k]) h = candleSetHigh(sets[k].candles, h);
    return candleSetHigh(candles, h);
  };
  const candlesLow = (candles: Candle[], h: number) => {
    let l = h;
    for (let k = 0; k < 6; k++) if (used[k]) l = candleSetLow(sets[k].candles, l);
    return candleSetLow(candles, l);
  };

  const lineStyle = (style: string) => (style === '----' ? 'dashed' : style === DOTS ? 'dotted' : 'solid');

  // var Trace trace
  const trace: { o: Line | null; c: Line | null; h: Line | null; l: Line | null;
    oL: Label | null; cL: Label | null; hL: Label | null; lL: Label | null } = {
    o: null, c: null, h: null, l: null, oL: null, cL: null, hL: null, lL: null,
  };

  const barMs = n > 1 ? tMs(n - 1) - tMs(n - 2) : 60000;
  const inSession = (i: number, session: string) => ptime.inSession(tMs(i), session, NY, barMs);

  // method Monitor()
  const monitor = (set: CandleSet, i: number) => {
    const st = set.starts;
    let isNew = i > 0 && st[i] - st[i - 1] > 0;
    if (cfg.useCustomDaily && set.htf === '1D') {
      if (cfg.customDaily === 'Midnight') {
        isNew = i > 0 && ptime.dayofweek(tMs(i), NY) !== ptime.dayofweek(tMs(i - 1), NY);
      } else {
        const session = cfg.customDaily === '8:30' ? '0830-0831:123456' : '0930-0931:123456';
        isNew = inSession(i, session) && (i === 0 || !inSession(i - 1, session));
      }
    }
    if (!isNew) return;
    const b = bars[i];
    const oTime = tMs(i);
    const num = str.tonumber(set.htf);
    const numOk = num !== null && !Number.isNaN(num);
    const dow = set.htf === '1D' ? dayLetter(ptime.dayofweek(tradingDay(i), NY))
      : numOk && num < 60 ? str.format_time(oTime, 'm', NY)
        : numOk && num >= 60 ? str.format_time(oTime, 'H', NY)
          : set.htf === '1M' ? str.format_time(oTime, 'M', NY) : '';
    const bull = gt(b.close, b.open);
    const top = Math.max(b.open, b.close);
    const bottom = Math.min(b.open, b.close);
    const candle: Candle = {
      o: b.open, c: b.close, h: b.high, l: b.low, oTime, oIdx: i, cIdx: i, hIdx: i, lIdx: i, dow,
      body: box.new(i, top, i + 2, bottom, bull ? cfg.bullBorder : cfg.bearBorder, 1, undefined, undefined, undefined,
        bull ? cfg.bullBody : cfg.bearBody, undefined, undefined, BOX_TEXT),
      wickUp: line.new(i + 1, b.high, i, top, 'bar_index', undefined, bull ? cfg.bullWick : cfg.bearWick),
      wickDown: line.new(i + 1, bottom, i, b.low, 'bar_index', undefined, bull ? cfg.bullWick : cfg.bearWick),
      dowLabel: null,
    };
    set.candles.unshift(candle);
    if (set.candles.length > set.maxDisplay) {
      const del = set.candles.pop()!;
      box.delete(del.body);
      line.delete(del.wickUp);
      line.delete(del.wickDown);
      if (del.dowLabel) label.delete(del.dowLabel);
    }
  };

  // method Reorder(offset)
  const reorder = (set: CandleSet, i: number, offset: number) => {
    const size = set.candles.length;
    for (let k = size - 1; k >= 0; k--) {
      const candle = set.candles[k];
      const tBuffer = offset + (width + buffer) * (size - k - 1);
      box.set_left(candle.body, i + tBuffer);
      box.set_right(candle.body, i + width + tBuffer);
      const x = i + width / 2 + tBuffer;
      line.set_x1(candle.wickUp, x);
      line.set_x2(candle.wickUp, x);
      line.set_x1(candle.wickDown, x);
      line.set_x2(candle.wickDown, x);
      if (cfg.dailyName) {
        if (candle.dowLabel) {
          label.set_y(candle.dowLabel, candle.h);
          label.set_x(candle.dowLabel, x);
          label.set_text(candle.dowLabel, candle.dow);
        } else {
          candle.dowLabel = label.new(x, candle.h, candle.dow, 'bar_index', 'price', TRANSPARENT, 'label_down',
            cfg.dowColor, cfg.dowSize);
        }
      }
    }
    let top = 0;
    let bottom = 0;
    if (cfg.labelAlignment === 'Align') {
      top = candlesHigh(set.candles);
      bottom = candlesLow(set.candles, top);
    }
    if (cfg.labelAlignment === 'Follow Candles') {
      top = candleSetHigh(set.candles, 0);
      bottom = candleSetLow(set.candles, top);
    }
    // a fractional x of label.new / set_xy is truncated
    const left = Math.trunc(i + offset + ((width + buffer) * (size - 1)) / 2);
    if (!cfg.htfLabelShow) return;
    let lblt = htfName(set.htf);
    let lbll = lblt;
    if (cfg.htfTimerShow) {
      lblt += '\n';
      lbll = `\n${lbll}`;
    }
    if (cfg.dailyName) lblt += '\n';
    const tmr = `(${remainingTime(set, i)})${cfg.dailyName ? '\n' : ''}`;
    if (cfg.labelPosition === 'Both' || cfg.labelPosition === 'Top') {
      if (set.tfNameTop) label.set_xy(set.tfNameTop, left, top);
      else set.tfNameTop = label.new(left, top, lblt, 'bar_index', 'price', TRANSPARENT, 'label_down', cfg.htfLabelColor, cfg.htfLabelSize);
      if (cfg.htfTimerShow) {
        if (set.tfTimerTop) label.set_xy(set.tfTimerTop, left, top);
        else set.tfTimerTop = label.new(left, top, tmr, 'bar_index', 'price', TRANSPARENT, 'label_down', cfg.htfTimerColor, cfg.htfTimerSize);
      }
    }
    if (cfg.labelPosition === 'Both' || cfg.labelPosition === 'Bottom') {
      if (set.tfNameBottom) label.set_xy(set.tfNameBottom, left, bottom);
      else set.tfNameBottom = label.new(left, bottom, lbll, 'bar_index', 'price', TRANSPARENT, 'label_up', cfg.htfLabelColor, cfg.htfLabelSize);
      if (cfg.htfTimerShow) {
        if (set.tfTimerBottom) label.set_xy(set.tfTimerBottom, left, bottom);
        else set.tfTimerBottom = label.new(left, bottom, tmr, 'bar_index', 'price', TRANSPARENT, 'label_up', cfg.htfTimerColor, cfg.htfTimerSize);
      }
    }
  };

  /** One trace line (and its price label) from the bar of a price to the candle */
  const traceLine = (key: 'o' | 'c' | 'h' | 'l', idx: number, price: number, x2: number, xLabel: number,
    col: string, style: string, size: number, i: number) => {
    if (!(i - idx < 5000)) return;
    const ln = trace[key];
    if (!ln) trace[key] = line.new(idx, price, x2, price, 'bar_index', undefined, col, lineStyle(style), size);
    else {
      line.set_xy1(ln, idx, price);
      line.set_xy2(ln, x2, price);
    }
    if (!cfg.labelShow) return;
    const lk = `${key}L` as 'oL' | 'cL' | 'hL' | 'lL';
    const lb = trace[lk];
    if (!lb) {
      trace[lk] = label.new(xLabel, price, str.tostring(price), 'bar_index', 'price', TRANSPARENT, 'label_left',
        cfg.labelColor, cfg.labelSize, 'center');
    } else {
      label.set_xy(lb, xLabel, price);
      label.set_text(lb, str.tostring(price));
    }
  };

  // method Update(offset, showTrace)
  const update = (set: CandleSet, i: number, offset: number, showTrace: boolean) => {
    if (set.candles.length === 0) return;
    const b = bars[i];
    const candle = set.candles[0];
    candle.hIdx = gt(b.high, candle.h) ? i : candle.hIdx;
    candle.h = gt(b.high, candle.h) ? b.high : candle.h;
    candle.lIdx = lt(b.low, candle.l) ? i : candle.lIdx;
    candle.l = lt(b.low, candle.l) ? b.low : candle.l;
    candle.c = b.close;
    candle.cIdx = i;
    const bull = gt(candle.c, candle.o);
    box.set_top(candle.body, candle.o);
    box.set_bottom(candle.body, candle.c);
    box.set_bgcolor(candle.body, bull ? cfg.bullBody : cfg.bearBody);
    box.set_border_color(candle.body, bull ? cfg.bullBorder : cfg.bearBorder);
    line.set_color(candle.wickUp, bull ? cfg.bullWick : cfg.bearWick);
    line.set_color(candle.wickDown, bull ? cfg.bullWick : cfg.bearWick);
    line.set_y1(candle.wickUp, candle.h);
    line.set_y2(candle.wickUp, Math.max(candle.o, candle.c));
    line.set_y1(candle.wickDown, candle.l);
    line.set_y2(candle.wickDown, Math.min(candle.o, candle.c));
    if (i !== n - 1) return;
    reorder(set, i, offset);
    if (!(cfg.traceShow && showTrace)) return;
    const right = box.get_right(candle.body);
    traceLine('o', candle.oIdx, candle.o, box.get_left(candle.body), right, cfg.traceOColor, cfg.traceOStyle, cfg.traceOSize, i);
    traceLine('c', candle.cIdx, candle.c, box.get_left(candle.body), right, cfg.traceCColor, cfg.traceCStyle, cfg.traceCSize, i);
    traceLine('h', candle.hIdx, candle.h, line.get_x1(candle.wickUp), right, cfg.traceHColor, cfg.traceHStyle, cfg.traceHSize, i);
    traceLine('l', candle.lIdx, candle.l, line.get_x1(candle.wickDown), right, cfg.traceLColor, cfg.traceLStyle, cfg.traceLSize, i);
  };

  // method FindImbalance()
  const findImbalance = (set: CandleSet, i: number) => {
    if (i !== n - 1) return;
    for (let k = set.imbalances.length - 1; k >= 0; k--) {
      box.delete(set.imbalances[k]);
      set.imbalances.pop();
    }
    const cs = set.candles;
    const imb = (left: number, top: number, right: number, bottom: number, col: string) => {
      set.imbalances.push(box.new(left, top, right, bottom, TRANSPARENT, undefined, undefined, undefined, undefined, col,
        undefined, undefined, BOX_TEXT));
    };
    if (cs.length > 3 && cfg.fvgShow) {
      for (let k = 0; k <= cs.length - 3; k++) {
        const c1 = cs[k];
        const c2 = cs[k + 2];
        const c3 = cs[k + 1];
        if (gt(c1.l, c2.h) && gt(Math.min(c1.o, c1.c), Math.max(c2.o, c2.c))) {
          imb(box.get_left(c2.body), c2.h, box.get_right(c1.body), c1.l, cfg.fvgColor);
        }
        if (lt(c1.h, c2.l) && lt(Math.max(c1.o, c1.c), Math.min(c2.o, c2.c))) {
          imb(box.get_right(c1.body), c1.h, box.get_left(c2.body), c2.l, cfg.fvgColor);
        }
        const temp = box.copy(c3.body);
        box.delete(c3.body);
        c3.body = temp;
      }
    }
    if (cs.length > 2 && cfg.viShow) {
      for (let k = 0; k <= cs.length - 2; k++) {
        const c1 = cs[k];
        const c2 = cs[k + 1];
        if (lt(c1.l, c2.h) && gt(Math.min(c1.o, c1.c), Math.max(c2.o, c2.c))) {
          imb(box.get_left(c2.body), Math.min(c1.o, c1.c), box.get_right(c1.body), Math.max(c2.o, c2.c), cfg.viColor);
        }
        if (gt(c1.h, c2.l) && lt(Math.max(c1.o, c1.c), Math.min(c2.o, c2.c))) {
          imb(box.get_right(c1.body), Math.min(c2.o, c2.c), box.get_left(c2.body), Math.max(c1.o, c1.c), cfg.viColor);
        }
      }
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    let cnt = 0;
    let offset = Math.trunc(cfg.offset);
    for (let k = 0; k < 6; k++) {
      if (!used[k]) continue;
      const set = sets[k];
      let showTrace = false;
      if (k === 0) {
        showTrace = cfg.traceAnchor === 'First Timeframe' || (cfg.traceAnchor === 'Last Timeframe' && maxSets === 1);
      } else if (k < 5) {
        showTrace = (cfg.traceAnchor === 'First Timeframe' && cnt === 0) || (cfg.traceAnchor === 'Last Timeframe' && cnt === lastSet - 1);
      } else {
        showTrace = (cfg.traceAnchor === 'First Timeframe' && cnt === 0) || cfg.traceAnchor === 'Last Timeframe';
      }
      // UpdateTime() only changes the timer labels of an earlier update of a realtime bar
      monitor(set, i);
      update(set, i, offset, showTrace);
      findImbalance(set, i);
      cnt += 1;
      const size = set.candles.length;
      offset += size * width + (size > 0 ? (size - 1) * buffer : 0) + htfBuffer;
    }
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, msUnit === 1 ? 'ms' : 's') };
}

/** Start (ms) of the period after the one that starts at `start`, without the exchange calendar (UTC rule). */
function nextPeriodStart(start: number, htf: string): number {
  const info = timeframe.info(htf);
  if (info.ismonthly) {
    const d = new Date(start);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + info.multiplier, 1);
  }
  return start + timeframe.in_seconds(htf) * 1000;
}

export const IctHtfCandles = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
