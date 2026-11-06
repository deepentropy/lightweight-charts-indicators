/**
 * TTrades Daily Bias [TFO]
 *
 * On each new day (and, with 'Weekly Bias', each new week) the period that just ended is compared with the period
 * before it (previous high PH, previous low PL) and a bias is set for the new period:
 * - close above PH: bias PH (1); close below PL: bias PL (-1)
 * - high above PH but close back inside: bias PL; low below PL but close back inside: bias PH
 * - inside period: the bias follows the direction of the period before (up: PH, down: PL)
 * - outside period that closed inside: no bias (0)
 * The high and low of the ended period are drawn as lines over the new period. When the price reaches one of them
 * the line takes the 'After Hit' colour and a triangle is plotted. A label tells the reason of the bias, a square at
 * the top / bottom of the pane shows the bias of each bar, and vertical lines separate the days and weeks.
 * The table shows, for each side, how often the level of the bias was reached (success rate), how often the period
 * then closed through it (close through rate) and the number of periods with that bias.
 * Lines, labels and triangles are only drawn on a chart timeframe below the period (daily: intraday charts).
 *
 * Drawings are kept up to 500 lines and 500 labels (the oldest are removed).
 *
 * Chart values (optional third argument of calculate): the chart timeframe (`timeframe`; without it, it is read from
 * the bar spacing), the exchange time zone and session for the days and weeks (without them: the UTC calendar and
 * the bars, see src/anchor-period.ts), and the chart foreground / background colours (labels and table; without
 * them: the dark theme colours #DBDBDB / #0F0F0F).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Bias PDH' / 'Bias PDL' / 'No Daily Bias' on the first bar of a
 * day with that daily bias, the same three for the weeks, and 'Hit PDH' / 'Hit PDL' / 'Hit PWH' / 'Hit PWL' on the
 * bars that reach a level. alert() calls (`alertCalls`, once per bar): "Bias P<D|W>H" / "Bias P<D|W>L" when a new
 * period gets a bias, "Hit P<D|W>H" / "Hit P<D|W>L" when a level is reached.
 *
 * Reference: "TTrades Daily Bias [TFO]" by tradeforopp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tradeforopp
 */

import { chartSessions, color, periodTime, str, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SessionContext } from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, MarkerData, PineSize, TableCellData, TablePosition } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { chartTimeframe, hasCalendar } from '../anchor-period';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type Location = 'Top' | 'Bottom';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface TtradesDailyBiasInputs {
  /** Daily Bias */
  dStats: boolean;
  /** Weekly Bias */
  wStats: boolean;
  /** Show Bias Reasoning */
  biasReason: boolean;
  /** Bull / Bear Bias Colors */
  bullColor: string;
  bearColor: string;
  /** Plot Daily Bias */
  dBiasPlot: boolean;
  /** Plot Weekly Bias */
  wBiasPlot: boolean;
  dBiasLoc: Location;
  wBiasLoc: Location;
  /** Before / After Hit Colors */
  beforeRaidColor: string;
  afterRaidColor: string;
  /** Stop Extending Lines After Hit */
  stopExt: boolean;
  /** Day Separator */
  useDSep: boolean;
  /** Week Separator */
  useWSep: boolean;
  dSep: string;
  wSep: string;
  /** Line Width */
  lineWidth: number;
  /** Show Statistics */
  tblShowStats: boolean;
  /** Position (table) */
  tblLoc: string;
  /** Size (table) */
  tblSize: string;
}

export const defaultInputs: TtradesDailyBiasInputs = {
  dStats: true,
  wStats: false,
  biasReason: true,
  bullColor: '#00897B',
  bearColor: '#FF5252',
  dBiasPlot: true,
  wBiasPlot: true,
  dBiasLoc: 'Top',
  wBiasLoc: 'Bottom',
  beforeRaidColor: '#2962FF',
  afterRaidColor: '#FF5252',
  stopExt: false,
  useDSep: true,
  useWSep: true,
  dSep: 'rgba(54, 58, 69, 0.2)',
  wSep: 'rgba(54, 58, 69, 0.7)',
  lineWidth: 1,
  tblShowStats: true,
  tblLoc: 'Top Right',
  tblSize: 'Normal',
};

const G_VIS = 'Bias';
const G_PLT = 'Plotting';
const G_STY = 'Style';
const G_TBL = 'Table';
const POSITIONS = ['Bottom Center', 'Bottom Left', 'Bottom Right', 'Middle Center', 'Middle Left', 'Middle Right', 'Top Center', 'Top Left', 'Top Right'];

export const inputConfig: InputConfig[] = [
  { id: 'dStats', type: 'bool', title: 'Daily Bias', defval: true, group: G_VIS, tooltip: 'Apply TTrades bias concepts to the 1 Day timeframe' },
  { id: 'wStats', type: 'bool', title: 'Weekly Bias', defval: false, group: G_VIS, tooltip: 'Apply TTrades bias concepts to the 1 Week timeframe' },
  { id: 'biasReason', type: 'bool', title: 'Show Bias Reasoning', defval: true, group: G_VIS, tooltip: 'Show the reason why a given bias is being established' },
  { id: 'bullColor', type: 'color', title: 'Bull / Bear Bias Colors', defval: '#00897B', inline: 'COLOR', group: G_PLT },
  { id: 'bearColor', type: 'color', title: '', defval: '#FF5252', inline: 'COLOR', group: G_PLT },
  { id: 'dBiasPlot', type: 'bool', title: 'Plot Daily Bias', defval: true, inline: 'DBIAS', group: G_PLT },
  { id: 'wBiasPlot', type: 'bool', title: 'Plot Weekly Bias', defval: true, inline: 'WBIAS', group: G_PLT },
  { id: 'dBiasLoc', type: 'string', title: '', defval: 'Top', options: ['Top', 'Bottom'], inline: 'DBIAS', group: G_PLT },
  { id: 'wBiasLoc', type: 'string', title: '', defval: 'Bottom', options: ['Top', 'Bottom'], inline: 'WBIAS', group: G_PLT },
  {
    id: 'beforeRaidColor', type: 'color', title: 'Before / After Hit Colors', defval: '#2962FF', inline: 'HIT', group: G_STY,
    tooltip: 'All previous high and low lines will start out as this color',
  },
  {
    id: 'afterRaidColor', type: 'color', title: '', defval: '#FF5252', inline: 'HIT', group: G_STY,
    tooltip: 'Once a previous high or low line is reached, it will become this color',
  },
  {
    id: 'stopExt', type: 'bool', title: 'Stop Extending Lines After Hit', defval: false, group: G_STY,
    tooltip: 'Once a previous high or low line is reached, its line will stop extending',
  },
  { id: 'useDSep', type: 'bool', title: 'Day Separator', defval: true, inline: 'DSEP', group: G_STY },
  { id: 'useWSep', type: 'bool', title: 'Week Separator', defval: true, inline: 'WSEP', group: G_STY },
  { id: 'dSep', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.2)', inline: 'DSEP', group: G_STY },
  { id: 'wSep', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.7)', inline: 'WSEP', group: G_STY },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 1, group: G_STY },
  {
    id: 'tblShowStats', type: 'bool', title: 'Show Statistics', defval: true, group: G_TBL,
    tooltip: 'Show statistics on bias accuracy\n\nSuccess Rate: how often has price successfully reached the assigned draw on liquidity?\n\nClose Thru Rate: from the number of times that price reached the assigned draw on liquidity, how often did it close through that level?\n\nSample Size: the total number of times that a given bias was assigned',
  },
  { id: 'tblLoc', type: 'string', title: 'Position', defval: 'Top Right', options: POSITIONS, group: G_TBL },
  { id: 'tblSize', type: 'string', title: 'Size', defval: 'Normal', options: ['Auto', 'Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: G_TBL },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Daily Bias', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Weekly Bias', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'TTrades Daily Bias [TFO]',
  shortTitle: 'TTrades Daily Bias [TFO]',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;

/** `info` of the script: the levels of the period before, the running period and the counters */
interface Info {
  ph: number;
  pl: number;
  ch: number;
  cl: number;
  co: number;
  pUp: boolean;
  bias: number;
  biasPh: number;
  biasPl: number;
  hitPh: number;
  hitPl: number;
  closePh: number;
  closePl: number;
}

const newInfo = (): Info => ({
  ph: NaN, pl: NaN, ch: NaN, cl: NaN, co: NaN, pUp: false, bias: 0, biasPh: 0, biasPl: 0, hitPh: 0, hitPl: 0, closePh: 0, closePl: 0,
});

/**
 * `lines` of the script: the two lines of the period before and whether they were reached. The lines are kept in the
 * list of every line by their position (-1: none); their colour and right end, changed by a hit, are kept here and
 * written to the list when the next period replaces them.
 */
interface Levels {
  ph: number;
  pl: number;
  hitPh: boolean;
  hitPl: boolean;
  phTime2: number;
  plTime2: number;
  phColor: string;
  plColor: string;
}

const newLevels = (): Levels => ({ ph: -1, pl: -1, hitPh: false, hitPl: false, phTime2: NaN, plTime2: NaN, phColor: '', plColor: '' });

/**
 * register(): the count of objects of one kind kept by the drawing limit of Pine after one more is created (above
 * max + 5 objects of one kind the oldest are deleted until max remain)
 */
const kept = (count: number) => (count + 1 > MAX_OBJECTS + 5 ? MAX_OBJECTS : count + 1);

type Result = IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] };

interface TtradesVars {
  dInfo: Info;
  wInfo: Info;
  dLevels: Levels;
  wLevels: Levels;
  /** Lines / labels kept by the drawing limit (the last ones of the lists) */
  lineCount: number;
  labelCount: number;
}

interface TtradesRun extends BarRunState<TtradesVars> {
  /** time("D") / time("W") of each bar (with the exchange calendar) */
  dayStarts: number[];
  weekStarts: number[];
  lines: LineDrawingData[];
  labels: LabelData[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
  flags: boolean[][];
  times: number[][];
  dBias: Array<{ time: number; value: number; color: string }>;
  wBias: Array<{ time: number; value: number; color: string }>;
}

/**
 * The session context of the exchange calendar of periodStarts (anchor-period): the chart timeframe of the whole set,
 * the time zone and session of the context, the unit of the bar times; null without it or when the library cannot read
 * the time zone or the session (the UTC calendar of the bars is used)
 */
function calendarContext(bars: Bar[], chart: ChartContext): SessionContext | null {
  if (!hasCalendar(chart) || bars.length === 0) return null;
  const tf = chartTimeframe(bars, chart);
  if (tf === '') return null;
  const context: SessionContext = {
    timeframe: tf, timezone: chart.timezone, session: chart.session, regularSession: chart.regularSession,
    timeUnit: bars[0].time >= 1e12 ? 'ms' : 's',
  };
  try {
    chartSessions(context);
    periodTime(bars[0].time, '1D', context);
  } catch {
    return null;
  }
  return context;
}

function study(inputs: Partial<TtradesDailyBiasInputs>): BarStudy<TtradesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const daySeconds = timeframe.in_seconds('D');
  const weekSeconds = timeframe.in_seconds('W');
  let chartFg = '';
  let chartBg = '';
  let unit = 1;
  let tfSeconds = NaN;
  let canPlotD = false;
  let canPlotW = false;
  let cal: SessionContext | null = null;
  let calSessions: ReturnType<typeof chartSessions>['bars'] | null = null;
  let calUnit = 1;
  let ms = false;

  /** register(): the line or label added to its list, the kept count of the drawing limit */
  const addLine = (s: TtradesRun, line: LineDrawingData): number => {
    s.lines.push(line);
    s.vars.lineCount = kept(s.vars.lineCount);
    return s.lines.length - 1;
  };
  const addLabel = (s: TtradesRun, label: LabelData) => {
    s.labels.push(label);
    s.vars.labelCount = kept(s.vars.labelCount);
  };

  /**
   * new_day = timeframe.change("D"), new_week = timeframe.change("W"): false on the first bar. periodStarts of the
   * bars changes on bar i: without the calendar, when the UTC day (the UTC week from Monday) changes; with it, when
   * time(tf) of bar i (the period of bar i - 1 for a stray bar after an early close, the bar time when the calendar
   * finds no day) differs from bar i - 1's (the rules of periodStarts)
   */
  const periodChange = (s: TtradesRun, bars: Bar[], i: number, tf: 'D' | 'W'): boolean => {
    if (cal) {
      const starts = tf === 'D' ? s.dayStarts : s.weekStarts;
      const b = bars[i];
      const t = periodTime(b.time, tf, cal);
      starts[i] = !Number.isNaN(t) ? t / calUnit : i > 0 && calSessions!.stray(b.time * calUnit) ? starts[i - 1] : b.time;
      return i > 0 && starts[i] !== starts[i - 1];
    }
    if (i === 0) return false;
    const key = (time: number) => {
      const t = ms ? time : time * 1000;
      const day = Math.floor(t / 86400000) * 86400000;
      if (tf === 'D') return day;
      return day - ((new Date(day).getUTCDay() + 6) % 7) * 86400000;
    };
    return key(bars[i].time) !== key(bars[i - 1].time);
  };

  const alertCall = (s: TtradesRun, bars: Bar[], i: number, message: string) => {
    s.alertCalls.push({ time: bars[i].time as number, message, freq: 'once_per_bar' });
  };

  /** handle_bias(): the bias of the new period, its label and its counters */
  const handleBias = (s: TtradesRun, bars: Bar[], info: Info, tf: 'D' | 'W', i: number) => {
    const canPlot = tf === 'D' ? canPlotD : canPlotW;
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    let txt: string;
    if (gt(prevClose, info.ph)) {
      if (info.bias === 1) info.closePh += 1;
      info.bias = 1;
      txt = `Close Above P${tf}H\nBias P${tf}H`;
    } else if (gt(info.pl, prevClose)) {
      if (info.bias === -1) info.closePl += 1;
      info.bias = -1;
      txt = `Close Below P${tf}L\nBias P${tf}L`;
    } else if (gt(info.ph, prevClose) && gt(prevClose, info.pl) && gt(info.ch, info.ph) && gt(info.cl, info.pl)) {
      info.bias = -1;
      txt = `Failed to Close Above P${tf}H\nBias P${tf}L`;
    } else if (gt(prevClose, info.pl) && gt(info.ph, prevClose) && gt(info.ph, info.ch) && gt(info.pl, info.cl)) {
      info.bias = 1;
      txt = `Failed to Close Below P${tf}L\nBias P${tf}H`;
    } else if (ge(info.ph, info.ch) && ge(info.cl, info.pl)) {
      info.bias = info.pUp ? 1 : -1;
      txt = `Close Inside\nBias P${tf}${info.pUp ? 'H' : 'L'}`;
    } else {
      info.bias = 0;
      txt = 'Outside Bar but Closed Inside\nNo Bias';
    }
    if (cfg.biasReason && canPlot) {
      addLabel(s, {
        time: bars[i].time, price: tf === 'D' ? info.cl : info.ch, text: txt, textColor: chartFg, color: chartBg,
        style: tf === 'D' ? 'label_up' : 'label_down',
      });
    }
    // alert("Bias P" + tf + "H" / "L", alert.freq_once_per_bar)
    if (info.bias === 1) {
      info.biasPh += 1;
      alertCall(s, bars, i, `Bias P${tf}H`);
    } else if (info.bias === -1) {
      info.biasPl += 1;
      alertCall(s, bars, i, `Bias P${tf}L`);
    }
  };

  /** update_info(): on a new period the running period becomes the period before */
  const updateInfo = (s: TtradesRun, bars: Bar[], info: Info, tf: 'D' | 'W', isNew: boolean, i: number) => {
    const bar = bars[i];
    if (isNew && !Number.isNaN(info.ch)) {
      handleBias(s, bars, info, tf, i);
      // close[1] >= n.co
      info.pUp = i > 0 && ge(bars[i - 1].close, info.co);
      info.ph = info.ch;
      info.pl = info.cl;
      info.ch = bar.high;
      info.cl = bar.low;
      info.co = bar.open;
    }
    if (Number.isNaN(info.ch)) {
      // n.ch := high, then n.ch := low (as in the script: the low of the first period stays na)
      info.ch = bar.low;
    } else {
      info.ch = Math.max(bar.high, info.ch);
      // math.min(low, na) is na
      info.cl = Number.isNaN(info.cl) ? NaN : Math.min(bar.low, info.cl);
    }
  };

  /** The line at position `k` with the colour and right end of its levels */
  const withState = (line: LineDrawingData, time2: number, lineColor: string): LineDrawingData =>
    line.time2 === time2 && line.color === lineColor ? line : { ...line, time2, color: lineColor };

  /** update_lines(): the lines of the period before and their hits; returns [hit_high, hit_low] */
  const updateLines = (s: TtradesRun, bars: Bar[], levels: Levels, info: Info, tf: 'D' | 'W', isNew: boolean, i: number): [boolean, boolean] => {
    const bar = bars[i];
    const canPlot = tf === 'D' ? canPlotD : canPlotW;
    let hitHigh = false;
    let hitLow = false;
    if (isNew) {
      // the lines replaced: their final state in the list (the same on every run of this bar)
      if (levels.ph >= 0) s.lines[levels.ph] = withState(s.lines[levels.ph], levels.phTime2, levels.phColor);
      if (levels.pl >= 0) s.lines[levels.pl] = withState(s.lines[levels.pl], levels.plTime2, levels.plColor);
      const right = bar.time + (tf === 'D' ? daySeconds : weekSeconds) * unit;
      const lineColor = canPlot ? cfg.beforeRaidColor : 'transparent';
      const make = (y: number): number => addLine(s, {
        time1: bar.time, price1: y, time2: right, price2: y, color: lineColor,
        style: tf === 'D' ? 'solid' : 'dashed', width: cfg.lineWidth,
      });
      levels.ph = make(info.ph);
      levels.pl = make(info.pl);
      levels.hitPh = false;
      levels.hitPl = false;
      levels.phTime2 = right;
      levels.plTime2 = right;
      levels.phColor = lineColor;
      levels.plColor = lineColor;
    }
    if (levels.ph >= 0 && levels.pl >= 0) {
      if (ge(bar.high, s.lines[levels.ph].price1) && !levels.hitPh) {
        if (cfg.stopExt) levels.phTime2 = bar.time;
        if (info.bias === 1) info.hitPh += 1;
        levels.hitPh = true;
        if (canPlot) levels.phColor = cfg.afterRaidColor;
        hitHigh = true;
        alertCall(s, bars, i, `Hit P${tf}H`);
      }
      if (ge(s.lines[levels.pl].price1, bar.low) && !levels.hitPl) {
        if (cfg.stopExt) levels.plTime2 = bar.time;
        if (info.bias === -1) info.hitPl += 1;
        levels.hitPl = true;
        if (canPlot) levels.plColor = cfg.afterRaidColor;
        hitLow = true;
        alertCall(s, bars, i, `Hit P${tf}L`);
      }
    }
    return [hitHigh, hitLow];
  };

  const biasColor = (bias: number) => (bias === 1 ? cfg.bullColor : bias === -1 ? cfg.bearColor : undefined);

  return {
    // the chart timeframe comes from the bar gaps (or the context), the time unit from the first bar
    key: (bars, chart) => `${chartTimeframe(bars, chart)}|${bars.length > 0 && bars[0].time >= 1e12}`,
    init(bars, chart) {
      // chart.fg_color, chart.bg_color
      chartFg = foregroundColorOf(chart);
      chartBg = backgroundColorOf(chart);
      // bar times in seconds or in ms
      ms = bars.length > 0 && bars[0].time >= 1e12;
      unit = ms ? 1000 : 1;
      // timeframe.in_seconds() of the chart (unknown with fewer than 2 bars and no chart timeframe: nothing is computed)
      const chartTf = chartTimeframe(bars, chart);
      tfSeconds = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
      canPlotD = tfSeconds < daySeconds;
      canPlotW = tfSeconds < weekSeconds;
      cal = calendarContext(bars, chart);
      calSessions = cal ? chartSessions(cal).bars : null;
      calUnit = ms ? 1 : 1000;
      const s: TtradesRun = {
        dayStarts: [], weekStarts: [], lines: [], labels: [], markers: [], alertCalls: [],
        // alertcondition flags, in the original's order
        flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []),
        dBias: [], wBias: [], steps: [],
        vars: { dInfo: newInfo(), wInfo: newInfo(), dLevels: newLevels(), wLevels: newLevels(), lineCount: 0, labelCount: 0 },
        lists: [], series: [],
      };
      s.lists = [s.lines, s.labels, s.markers, s.alertCalls, ...s.times];
      s.series = [s.dayStarts, s.weekStarts, s.dBias, s.wBias, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, dInfo: { ...v.dInfo }, wInfo: { ...v.wInfo }, dLevels: { ...v.dLevels }, wLevels: { ...v.wLevels } }),
    bar(s, i, bars) {
      const bar = bars[i];
      const v = s.vars;
      const { dInfo, wInfo } = v;
      const newDay = periodChange(s, bars, i, 'D');
      const newWeek = periodChange(s, bars, i, 'W');

      // Separators
      if (cfg.useDSep && newDay && canPlotD) {
        addLine(s, { time1: bar.time, price1: bar.high * 1.000001, time2: bar.time, price2: bar.low, color: cfg.dSep, extend: 'both', width: cfg.lineWidth });
      }
      if (cfg.useWSep && newWeek && canPlotW) {
        addLine(s, { time1: bar.time, price1: bar.high * 1.000001, time2: bar.time, price2: bar.low, color: cfg.wSep, extend: 'both', width: cfg.lineWidth });
      }

      let dHitHigh = false;
      let dHitLow = false;
      let wHitHigh = false;
      let wHitLow = false;
      if (cfg.dStats && tfSeconds <= daySeconds) {
        updateInfo(s, bars, dInfo, 'D', newDay, i);
        [dHitHigh, dHitLow] = updateLines(s, bars, v.dLevels, dInfo, 'D', newDay, i);
      }
      if (cfg.wStats && tfSeconds <= weekSeconds) {
        updateInfo(s, bars, wInfo, 'W', newWeek, i);
        [wHitHigh, wHitLow] = updateLines(s, bars, v.wLevels, wInfo, 'W', newWeek, i);
      }

      // alertcondition(new_day and d_info.bias == 1 / -1 / 0), the same for the weeks, then the hits
      const f = [
        newDay && dInfo.bias === 1, newDay && dInfo.bias === -1, newDay && dInfo.bias === 0,
        newWeek && wInfo.bias === 1, newWeek && wInfo.bias === -1, newWeek && wInfo.bias === 0,
        dHitHigh, dHitLow, wHitHigh, wHitLow,
      ];
      for (let k = 0; k < 10; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(bar.time as number);
      }

      // PDH / PDL / PWH / PWL raids
      const markers = s.markers;
      if (canPlotD && dHitHigh) markers.push({ id: 'shape0', time: bar.time, position: 'aboveBar', shape: 'triangleUp', color: cfg.afterRaidColor, size: 'tiny' });
      if (canPlotD && dHitLow) markers.push({ id: 'shape1', time: bar.time, position: 'belowBar', shape: 'triangleDown', color: cfg.afterRaidColor, size: 'tiny' });
      if (canPlotW && wHitHigh) markers.push({ id: 'shape2', time: bar.time, position: 'aboveBar', shape: 'triangleUp', color: cfg.afterRaidColor, size: 'tiny' });
      if (canPlotW && wHitLow) markers.push({ id: 'shape3', time: bar.time, position: 'belowBar', shape: 'triangleDown', color: cfg.afterRaidColor, size: 'tiny' });

      // Daily / weekly bias squares: no colour (nothing drawn) without a bias
      const dCol = biasColor(dInfo.bias);
      if (cfg.dBiasPlot && dCol) {
        markers.push({ id: 'shape4', time: bar.time, position: cfg.dBiasLoc === 'Top' ? 'top' : 'bottom', shape: 'square', color: dCol, size: 'tiny' });
      }
      const wCol = biasColor(wInfo.bias);
      if (cfg.wBiasPlot && wCol) {
        markers.push({ id: 'shape5', time: bar.time, position: cfg.wBiasLoc === 'Top' ? 'top' : 'bottom', shape: 'square', color: wCol, size: 'tiny' });
      }

      s.dBias[i] = { time: bar.time, value: dInfo.bias, color: 'transparent' };
      s.wBias[i] = { time: bar.time, value: wInfo.bias, color: 'transparent' };
    },
    result(s, bars) {
      const n = bars.length;
      const { dInfo, wInfo, dLevels, wLevels, lineCount, labelCount } = s.vars;
      // Table (cells are set on the last bar)
      const position = cfg.tblLoc.toLowerCase().replace(' ', '_') as TablePosition;
      const textSize = cfg.tblSize.toLowerCase() as PineSize;
      const cells: TableCellData[] = [];
      if (n > 0) {
        const cell = (column: number, row: number, text: string, bgColor?: string) => {
          cells.push({ column, row, text, textColor: chartFg, textSize, ...(bgColor ? { bgColor } : {}) });
        };
        // format_result(): math.floor(hit / bias * 1000) / 10
        const result = (hit: number, bias: number) => `${bias > 0 ? str.tostring(Math.floor((hit / bias) * 1000) / 10) : '0'}%`;
        // format_color(): the level of the current bias, in the colour of its line
        const cellColor = (bull: boolean, info: Info, levels: Levels) => {
          if (bull ? info.bias !== 1 : info.bias !== -1) return undefined;
          const hit = bull ? levels.hitPh : levels.hitPl;
          return String(color.new(hit ? cfg.afterRaidColor : cfg.beforeRaidColor, 50));
        };
        const rows = (row: number, tf: 'D' | 'W', info: Info, levels: Levels) => {
          cell(0, row, `P${tf}H`, cellColor(true, info, levels));
          cell(0, row + 1, `P${tf}L`, cellColor(false, info, levels));
          if (cfg.tblShowStats) {
            cell(1, row, result(info.hitPh, info.biasPh));
            cell(1, row + 1, result(info.hitPl, info.biasPl));
            cell(2, row, result(info.closePh, info.hitPh));
            cell(2, row + 1, result(info.closePl, info.hitPl));
            cell(3, row, str.tostring(info.biasPh));
            cell(3, row + 1, str.tostring(info.biasPl));
          }
        };
        cell(0, 0, 'Bias');
        if (cfg.tblShowStats) {
          cell(1, 0, 'Success\nRate');
          cell(2, 0, 'Close Thru\nRate');
          cell(3, 0, 'Sample\nSize');
        }
        if (cfg.dStats) rows(1, 'D', dInfo, dLevels);
        if (cfg.wStats) rows(3, 'W', wInfo, wLevels);
      }

      // the lines kept by the drawing limit, the current lines of each period with their colour and right end
      const first = s.lines.length - lineCount;
      const lines = s.lines.slice(first);
      for (const lv of [dLevels, wLevels]) {
        if (lv.ph >= first) lines[lv.ph - first] = withState(lines[lv.ph - first], lv.phTime2, lv.phColor);
        if (lv.pl >= first) lines[lv.pl - first] = withState(lines[lv.pl - first], lv.plTime2, lv.plColor);
      }
      // A line or a label with an na price is not drawn
      const drawnLines = lines.filter((ln) => !Number.isNaN(ln.price1) && !Number.isNaN(ln.price2));
      const drawnLabels = s.labels.slice(s.labels.length - labelCount).filter((lb) => !Number.isNaN(lb.price));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.dBias.slice(), plot1: s.wBias.slice() },
        markers: s.markers.slice(),
        lines: drawnLines,
        labels: drawnLabels,
        tables: [{
          position, columns: 20, rows: 20, bgColor: chartBg, frameColor: chartFg, frameWidth: 2, borderColor: chartFg, borderWidth: 1, cells,
        }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TtradesDailyBiasInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TtradesDailyBiasInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bias PDH', message: 'Bias PDH' },
  { id: 'alert1', title: 'Bias PDL', message: 'Bias PDL' },
  { id: 'alert2', title: 'No Daily Bias', message: 'No Daily Bias' },
  { id: 'alert3', title: 'Bias PWH', message: 'Bias PWH' },
  { id: 'alert4', title: 'Bias PWL', message: 'Bias PWL' },
  { id: 'alert5', title: 'No Weekly Bias', message: 'No Weekly Bias' },
  { id: 'alert6', title: 'Hit PDH', message: 'Hit PDH' },
  { id: 'alert7', title: 'Hit PDL', message: 'Hit PDL' },
  { id: 'alert8', title: 'Hit PWH', message: 'Hit PWH' },
  { id: 'alert9', title: 'Hit PWL', message: 'Hit PWL' },
];

export const TtradesDailyBias = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, hasAlertFunction };
