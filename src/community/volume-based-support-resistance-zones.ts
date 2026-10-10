/**
 * Volume-based Support & Resistance Zones V2
 *
 * Support and resistance zones from volume fractals on up to four timeframes of the chart symbol. On the bars of a
 * timeframe, a fractal high is a bar whose high is above the two highs before it and followed by two lower highs,
 * with a volume above its moving average (the mirror for a fractal low). Each fractal high opens a resistance zone
 * between the high and the top of the candle body, each fractal low a support zone between the low and the bottom
 * of the body. A zone is two lines with a fill; it starts at the fractal bar and ends where the next zone of the
 * same kind starts, and the latest zone extends to the right. Each timeframe keeps its last `numZones` zones.
 * A text label names the timeframe of the latest zones; zones at the same price on two timeframes share one label.
 *
 * Timeframes: the bars of a higher timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts) and, as in the original, a value of a period shows from the chart bar that
 * completes it. The last period of the bars counts as complete when the last bar closes at its end (symbols that
 * trade every day); on other symbols it stays open. A timeframe below the chart timeframe draws nothing, as in the
 * original. Its values are only needed for the labels in two cases (label location "Left", or a time frame set below
 * the chart timeframe while a lower-numbered time frame is drawn): the bars do not carry them and the port throws an
 * Error.
 *
 * Limits of the built bars: exact on symbols that trade every day (after the first period of the bars). On other
 * symbols a period ends on its last bar (the original waits for the next period when a day off is not in its
 * calendar), and on intraday charts of stocks the daily and weekly bars of the exchange (official open and close,
 * consolidated volume) differ from the bars built from the chart bars, so the zones of these timeframes can differ.
 *
 * Not ported: the table shown when the symbol has no volume includes the symbol name in the original; the port has
 * no symbol name and leaves it out of the text. The 32 alert() calls have no output.
 *
 * Reference: "Volume-based Support & Resistance Zones V2" by tommyf1001
 * Original notice: Original script is thanks to synapticex and additional modifications is thanks to Lij_MC.
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, barInterval, barTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, LabelData, LinefillData, TableData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

type Menu = 'S/R' | 'S/R Zones' | 'Disable';
type StyleName = 'Solid' | 'Dotted' | 'Dashed';

export interface VolumeBasedSupportResistanceZonesInputs {
  /** Extend all S/R Zones to Next Zone */
  extendLines1: boolean;
  /** Extend active S/R Zones to Right */
  extActive: boolean;
  /** Show Time Frame Label? */
  showLabel: boolean;
  /** Label Location */
  labelLoc: 'Left' | 'Right';
  /** Right Label Offset (bars after the last bar) */
  labelOffset: number;
  /** Show High/Low Line */
  showHL: boolean;
  /** Show Open/Close Line */
  showClose: boolean;
  lineStyleHL: StyleName;
  lineWidthHL: number;
  lineStyleClose: StyleName;
  lineWidthClose: number;

  tf1Menu: Menu;
  /** Time Frame 1: 'Chart' or '1m' ... '12M' */
  tf1Input: string;
  tf1VolMA: number;
  tf1NumZones: number;
  tf1ExtRight: boolean;
  tf1ResLinesColor: string;
  tf1ResZoneColor: string;
  tf1SupLinesColor: string;
  tf1SupZoneColor: string;
  tf1Alerts: string;

  tf2Menu: Menu;
  tf2Input: string;
  tf2VolMA: number;
  tf2NumZones: number;
  tf2ExtRight: boolean;
  tf2ResLinesColor: string;
  tf2ResZoneColor: string;
  tf2SupLinesColor: string;
  tf2SupZoneColor: string;
  tf2Alerts: string;

  tf3Menu: Menu;
  tf3Input: string;
  tf3VolMA: number;
  tf3NumZones: number;
  tf3ExtRight: boolean;
  tf3ResLinesColor: string;
  tf3ResZoneColor: string;
  tf3SupLinesColor: string;
  tf3SupZoneColor: string;
  tf3Alerts: string;

  tf4Menu: Menu;
  tf4Input: string;
  tf4VolMA: number;
  tf4NumZones: number;
  tf4ExtRight: boolean;
  tf4ResLinesColor: string;
  tf4ResZoneColor: string;
  tf4SupLinesColor: string;
  tf4SupZoneColor: string;
  tf4Alerts: string;
}

// Input colour defaults: color.new(c, 20) is alpha 0.8, color.new(c, 90) is alpha 0.1
export const defaultInputs: VolumeBasedSupportResistanceZonesInputs = {
  extendLines1: true,
  extActive: true,
  showLabel: true,
  labelLoc: 'Right',
  labelOffset: 15,
  showHL: true,
  showClose: true,
  lineStyleHL: 'Solid',
  lineWidthHL: 1,
  lineStyleClose: 'Solid',
  lineWidthClose: 1,

  tf1Menu: 'S/R Zones',
  tf1Input: 'Chart',
  tf1VolMA: 6,
  tf1NumZones: 30,
  tf1ExtRight: false,
  tf1ResLinesColor: 'rgba(255, 82, 82, 0.8)',
  tf1ResZoneColor: 'rgba(255, 82, 82, 0.1)',
  tf1SupLinesColor: 'rgba(0, 230, 118, 0.8)',
  tf1SupZoneColor: 'rgba(0, 230, 118, 0.1)',
  tf1Alerts: 'None',

  tf2Menu: 'S/R Zones',
  tf2Input: '4h',
  tf2VolMA: 6,
  tf2NumZones: 30,
  tf2ExtRight: false,
  tf2ResLinesColor: 'rgba(224, 64, 251, 0.8)',
  tf2ResZoneColor: 'rgba(224, 64, 251, 0.1)',
  tf2SupLinesColor: 'rgba(76, 175, 80, 0.8)',
  tf2SupZoneColor: 'rgba(76, 175, 80, 0.1)',
  tf2Alerts: 'None',

  tf3Menu: 'S/R Zones',
  tf3Input: 'D',
  tf3VolMA: 6,
  tf3NumZones: 30,
  tf3ExtRight: false,
  tf3ResLinesColor: 'rgba(255, 152, 0, 0.8)',
  tf3ResZoneColor: 'rgba(255, 152, 0, 0.1)',
  tf3SupLinesColor: 'rgba(41, 98, 255, 0.8)',
  tf3SupZoneColor: 'rgba(41, 98, 255, 0.1)',
  tf3Alerts: 'None',

  tf4Menu: 'S/R Zones',
  tf4Input: 'W',
  tf4VolMA: 6,
  tf4NumZones: 30,
  tf4ExtRight: false,
  tf4ResLinesColor: 'rgba(136, 14, 79, 0.8)',
  tf4ResZoneColor: 'rgba(136, 14, 79, 0.1)',
  tf4SupLinesColor: 'rgba(0, 137, 123, 0.8)',
  tf4SupZoneColor: 'rgba(0, 137, 123, 0.1)',
  tf4Alerts: 'None',
};

const GENERAL = '*** General Settings ***';
const MENU_OPTIONS = ['S/R', 'S/R Zones', 'Disable'];
const STYLE_OPTIONS = ['Solid', 'Dotted', 'Dashed'];
const TF_OPTIONS = ['1m', '3m', '5m', '15m', '30m', '45m', '1h', '2h', '3h', '4h', '6h', '8h', '12h', 'D', '3D', 'W', '2W', '1M', '12M'];
const ALERT_OPTIONS = ['None', 'Price Enters Resistance Zone', 'Price Enters Support Zone', 'Price Enters Either S/R Zone',
  'Price Breaks Up Resistance', 'Price Breaks Down Support', 'Price Breaks Either S/R', 'New S/R Zone Found', 'All Alerts On'];
const ALERT_TOOLTIP = 'Select the type of alert you would like, then save settings. On chart, right click on SR indicator and click \'Add Alert\' then save. If you would like to change the alert, delete existing alert, change alert settings on indicator, then create new alert';

function timeFrameInputs(k: 1 | 2 | 3 | 4): InputConfig[] {
  const group = `*** Time Frame ${k} ***`;
  const d = defaultInputs as unknown as Record<string, unknown>;
  const id = (name: string) => `tf${k}${name}`;
  return [
    { id: id('Menu'), type: 'string', title: 'Display Lines Only, With Zones, or Disable     ', defval: d[id('Menu')], options: MENU_OPTIONS, group },
    { id: id('Input'), type: 'string', title: `Time Frame ${k}`, defval: d[id('Input')], options: k === 1 ? ['Chart', ...TF_OPTIONS] : TF_OPTIONS, group },
    { id: id('VolMA'), type: 'int', title: 'Volume MA - Threshold', defval: 6, group },
    {
      id: id('NumZones'), type: 'int', title: 'Number of Zones Back', defval: 30, min: 1, max: 100, group,
      tooltip: `Change how many zones back you would like on the chart for time frame ${k} (this number applies to both # of support zones and # of resistance zones back). Be mindful of setting too high with other zones, as the maximum total lines allowed on the chart is 500.`,
    },
    { id: id('ExtRight'), type: 'bool', title: 'Extend S/R Zones to Right', defval: false, group },
    { id: id('ResLinesColor'), type: 'color', title: 'Resistance Lines Color', defval: d[id('ResLinesColor')], inline: '1', group },
    { id: id('ResZoneColor'), type: 'color', title: 'Resistance Zone Color', defval: d[id('ResZoneColor')], inline: '2', group },
    { id: id('SupLinesColor'), type: 'color', title: '        Support Lines Color', defval: d[id('SupLinesColor')], inline: '1', group },
    { id: id('SupZoneColor'), type: 'color', title: '         Support Zone Color', defval: d[id('SupZoneColor')], inline: '2', group },
    { id: id('Alerts'), type: 'string', title: 'Alerts', defval: 'None', options: ALERT_OPTIONS, tooltip: ALERT_TOOLTIP, group },
  ];
}

export const inputConfig: InputConfig[] = [
  { id: 'extendLines1', type: 'bool', title: 'Extend all S/R Zones to Next Zone', defval: true, inline: 'extline', group: GENERAL },
  { id: 'extActive', type: 'bool', title: 'Extend active S/R Zones to Right', defval: true, inline: 'extline', group: GENERAL },
  { id: 'showLabel', type: 'bool', title: 'Show Time Frame Label?', defval: true, group: GENERAL },
  { id: 'labelLoc', type: 'string', title: 'Label Location', defval: 'Right', options: ['Left', 'Right'], inline: '1', group: GENERAL },
  {
    id: 'labelOffset', type: 'int', title: '  Right Label Offset', defval: 15, inline: '1', group: GENERAL,
    tooltip: 'Adjust how far to the right you\'d like the time frame label to appear.',
  },
  { id: 'showHL', type: 'bool', title: 'Show High/Low Line     ', defval: true, inline: '1b', group: GENERAL },
  { id: 'showClose', type: 'bool', title: 'Show Open/Close Line', defval: true, inline: '1b', group: GENERAL },
  { id: 'lineStyleHL', type: 'string', title: 'Line Style (H/L)', defval: 'Solid', options: STYLE_OPTIONS, inline: '2', group: GENERAL },
  { id: 'lineWidthHL', type: 'int', title: '  Line Width (H/L)', defval: 1, inline: '2', group: GENERAL },
  { id: 'lineStyleClose', type: 'string', title: 'Line Style (O/C)', defval: 'Solid', options: STYLE_OPTIONS, inline: '3', group: GENERAL },
  { id: 'lineWidthClose', type: 'int', title: '  Line Width (O/C)', defval: 1, inline: '3', group: GENERAL },
  ...timeFrameInputs(1),
  ...timeFrameInputs(2),
  ...timeFrameInputs(3),
  ...timeFrameInputs(4),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume-based Support & Resistance Zones V2',
  shortTitle: 'Vol S/R Zones V2',
  overlay: true,
};

/** Pine: indicator(max_lines_count = 500): above 505 lines the oldest are deleted until 500 remain */
const MAX_LINES = 500;
/** Pine: indicator(max_bars_back = 4999) */
const MAX_BARS_BACK = 4999;

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** a != b as a Pine v5 bool: null (na) when a value is na */
const neq = (a: number, b: number): boolean | null => (Number.isNaN(a) || Number.isNaN(b) ? null : Math.abs(a - b) > EPS);

/** f_TFx: the timeframe string of an input value ('Chart' = the chart timeframe) */
const TF_STRING: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '45m': '45', '1h': '60', '2h': '120', '3h': '180',
  '4h': '240', '6h': '360', '8h': '480', '12h': '720', D: 'D', '3D': '3D', W: 'W', '2W': '2W', '1M': '1M', '12M': '12M',
};

/** f_resInMinutes: the length of a timeframe in minutes (a month is 30.4375 days) */
function resInMinutes(tf: string): number {
  const info = timeframe.info(tf);
  const unit = info.isseconds ? 1 / 60 : info.isminutes ? 1 : info.isdaily ? 60 * 24 : info.isweekly ? 60 * 24 * 7
    : info.ismonthly ? 60 * 24 * 30.4375 : NaN;
  return info.multiplier * unit;
}

/** A line of the script (x in bar indexes; NaN = na) */
interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  style: 'solid' | 'dotted' | 'dashed';
  width: number;
  extend: 'right' | 'none';
  deleted: boolean;
}
interface Lbl {
  x: number;
  y: number;
  text: string;
  /** Background colour; undefined = the Pine default */
  color?: string;
  textColor: string;
  style: 'none' | 'label_right';
}

/** The series of one time frame on the chart bars */
interface TimeFrame {
  input: string;
  menuOn: boolean;
  zones: boolean;
  numZones: number;
  extRight: boolean;
  resLines: string;
  resZone: string;
  supLines: string;
  supZone: string;
  /** False for a timeframe below the chart timeframe: its values are not in the bars */
  known: boolean;
  /** f_tfResInMinutes(TF): na until the first period of a higher timeframe is complete */
  minutes: number[];
  fractalUp: number[];
  fractalDown: number[];
  resZoneAt: number[];
  supZoneAt: number[];
  /** ta.change(time(TF)) != 0 */
  starts: number[];
  upperRes: Array<Ln | null>;
  lowerRes: Array<Ln | null>;
  upperSup: Array<Ln | null>;
  lowerSup: Array<Ln | null>;
  resLabel: Lbl | null;
  supLabel: Lbl | null;
  /** barssince(FractalUp != FractalUp[1]) / barssince(FractalDown != FractalDown[1]) is not na */
  upChanged: boolean;
  downChanged: boolean;
  /** Bars where a new period starts, in order */
  newBars: number[];
  /** TFx_bb1 and TFx_br of each bar */
  bb1: number[];
  br: number[];
}

/**
 * The script on the bars of one timeframe (the functions run by request.security): the fractal high / low kept
 * from the last volume fractal, and the body edge of that bar. na until the first fractal.
 */
function fractals(tfBars: Bar[], volLen: number) {
  const m = tfBars.length;
  const vol = tfBars.map((b) => b.volume ?? NaN);
  const volMA = ta.sma(Series.fromArray(tfBars, vol), volLen).toArray().map((v) => v ?? NaN);
  const H = (i: number) => (i >= 0 ? tfBars[i].high : NaN);
  const L = (i: number) => (i >= 0 ? tfBars[i].low : NaN);
  const fractalUp: number[] = [];
  const fractalDown: number[] = [];
  const upZone: number[] = [];
  const downZone: number[] = [];
  for (let i = 0; i < m; i++) {
    const volOk = i >= 3 && gt(vol[i - 3], volMA[i - 3]);
    const up = gt(H(i - 3), H(i - 4)) && gt(H(i - 4), H(i - 5)) && lt(H(i - 2), H(i - 3)) && lt(H(i - 1), H(i - 2)) && volOk;
    const down = lt(L(i - 3), L(i - 4)) && lt(L(i - 4), L(i - 5)) && gt(L(i - 2), L(i - 3)) && gt(L(i - 1), L(i - 2)) && volOk;
    const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);
    const o3 = i >= 3 ? tfBars[i - 3].open : NaN;
    const c3 = i >= 3 ? tfBars[i - 3].close : NaN;
    fractalUp.push(up ? H(i - 3) : prev(fractalUp));
    fractalDown.push(down ? L(i - 3) : prev(fractalDown));
    upZone.push(up && ge(c3, o3) ? c3 : up && lt(c3, o3) ? o3 : prev(upZone));
    downZone.push(down && ge(c3, o3) ? o3 : down && lt(c3, o3) ? c3 : prev(downZone));
  }
  return { fractalUp, fractalDown, upZone, downZone };
}

/**
 * Bars of a higher timeframe built from the chart bars, and for each chart bar the last complete period (-1: none).
 * request.security rule (no lookahead): a period shows from the chart bar that completes it. A bar completes its
 * period when it is the last bar of the period and closes at the end of the period; when the last bars of a period
 * are missing, the first bar of the next period completes it. On symbols that do not trade every day the end of a
 * period is not known from the bars: the last bar of a period completes it, and the last period of the bars is open.
 */
function higherTimeframe(bars: Bar[], starts: number[], tf: string): { tfBars: Bar[]; latest: number[] } {
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const everyDay = bars.some((b) => {
    const wd = new Date(ms ? b.time : b.time * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  });
  const interval = barInterval(bars);
  // The period of the time at which each bar closes
  const closeStarts = everyDay ? periodStarts(bars.map((b) => ({ time: b.time + interval })), tf) : [];
  const tfBars: Bar[] = [];
  const latest: number[] = [];
  let done = -1;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (i === 0 || starts[i] !== starts[i - 1]) {
      // a new period completes all the earlier ones
      done = tfBars.length - 1;
      tfBars.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = tfBars[tfBars.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    const ends = i === n - 1 || starts[i + 1] !== starts[i];
    const reaches = everyDay ? closeStarts[i] !== starts[i] : i < n - 1;
    if (ends && reaches) done = tfBars.length - 1;
    latest.push(done);
  }
  return { tfBars, latest };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeBasedSupportResistanceZonesInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const result = (lines: LineDrawingData[], labels: LabelData[], linefills: LinefillData[], tables: TableData[]) => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
    linefills,
    tables,
  });
  const chartTf = chartTimeframe(bars);
  if (n === 0 || chartTf === '') return result([], [], [], []);

  const styleOf = (s: StyleName) => (s === 'Dotted' ? 'dotted' : s === 'Dashed' ? 'dashed' : 'solid');
  const styleHL = styleOf(cfg.lineStyleHL);
  const styleClose = styleOf(cfg.lineStyleClose);
  const left = cfg.labelLoc === 'Left';
  const right = cfg.labelLoc === 'Right';
  const noColor = String(color.new(color.white, 100));

  // timeframe.period: "D" / "W" / "M" without the multiplier 1
  const info = timeframe.info(chartTf);
  const period = info.multiplier === 1 && (info.isdaily || info.isweekly || info.ismonthly) ? chartTf.slice(1) : chartTf;
  const currentMinutes = resInMinutes(chartTf);

  const raw = cfg as unknown as Record<string, unknown>;
  const tfs: TimeFrame[] = [1, 2, 3, 4].map((k) => {
    const get = <T,>(name: string) => raw[`tf${k}${name}`] as T;
    const input = get<string>('Input');
    const menu = get<Menu>('Menu');
    const numZones = get<number>('NumZones');
    const tf = input === 'Chart' ? period : TF_STRING[input];
    if (tf === undefined) throw new RangeError(`Unsupported time frame "${input}"`);
    const minutes = resInMinutes(tf);
    const base = {
      input,
      menuOn: menu === 'S/R Zones' || menu === 'S/R',
      zones: menu === 'S/R Zones',
      numZones,
      extRight: get<boolean>('ExtRight'),
      resLines: get<string>('ResLinesColor'),
      resZone: get<string>('ResZoneColor'),
      supLines: get<string>('SupLinesColor'),
      supZone: get<string>('SupZoneColor'),
      upperRes: new Array<Ln | null>(numZones).fill(null),
      lowerRes: new Array<Ln | null>(numZones).fill(null),
      upperSup: new Array<Ln | null>(numZones).fill(null),
      lowerSup: new Array<Ln | null>(numZones).fill(null),
      resLabel: null,
      supLabel: null,
      upChanged: false,
      downChanged: false,
      newBars: [],
      bb1: [],
      br: [],
    };
    const na = () => new Array<number>(n).fill(NaN);
    if (lt(minutes, currentMinutes)) {
      // A timeframe below the chart timeframe: no value from the bars; chartOnLowerTF is false, nothing is drawn
      return { ...base, known: false, minutes: new Array<number>(n).fill(minutes), fractalUp: na(), fractalDown: na(), resZoneAt: na(), supZoneAt: na(), starts: [] };
    }
    const volLen = get<number>('VolMA');
    if (eq(minutes, currentMinutes)) {
      const f = fractals(bars, volLen);
      return {
        ...base, known: true, minutes: new Array<number>(n).fill(minutes), fractalUp: f.fractalUp, fractalDown: f.fractalDown,
        resZoneAt: f.upZone, supZoneAt: f.downZone, starts: bars.map((b) => b.time),
      };
    }
    const starts = periodStarts(bars, tf);
    const { tfBars, latest } = higherTimeframe(bars, starts, tf);
    const f = fractals(tfBars, volLen);
    const map = (values: number[]) => latest.map((p) => (p < 0 ? NaN : values[p]));
    return {
      ...base, known: true, minutes: latest.map((p) => (p < 0 ? NaN : minutes)), fractalUp: map(f.fractalUp),
      fractalDown: map(f.fractalDown), resZoneAt: map(f.upZone), supZoneAt: map(f.downZone), starts,
    };
  });

  // ---- Drawings
  const allLines: Ln[] = [];
  let liveLines = 0;
  const fills: Array<{ a: Ln; b: Ln; color: string }> = [];
  const filled = new Map<Ln, Set<Ln>>();
  const newLine = (x1: number, y: number, x2: number, col: string, style: Ln['style'], width: number): Ln => {
    const l: Ln = { x1, y1: y, x2, y2: y, color: col, style, width, extend: 'right', deleted: false };
    allLines.push(l);
    liveLines++;
    if (liveLines > MAX_LINES + 5) {
      for (const old of allLines) {
        if (liveLines <= MAX_LINES) break;
        if (!old.deleted) {
          old.deleted = true;
          liveLines--;
        }
      }
    }
    return l;
  };
  const deleteLine = (l: Ln | null | undefined) => {
    if (l && !l.deleted) {
      l.deleted = true;
      liveLines--;
    }
  };
  /** One side of a zone: the new line closes the previous one of its array, which loses its oldest line */
  const pushLine = (arr: Array<Ln | null>, tf: TimeFrame, x1: number, y: number, i: number, col: string, style: Ln['style'], width: number) => {
    const l = newLine(x1, y, i, col, style, width);
    const prev = arr[tf.numZones - 1];
    if (prev) {
      prev.extend = tf.extRight ? 'right' : 'none';
      if (cfg.extendLines1) prev.x2 = x1;
    }
    arr.push(l);
    deleteLine(arr.shift());
  };
  /** TF_ResistanceLineA / B and TF_SupportLineA / B: `x1` is the left bar of the lines, `labelX` that of a left label */
  const zone = (tf: TimeFrame, res: boolean, i: number, x1: number, labelX: number, text: string) => {
    const edge = res ? tf.fractalUp[i] : tf.fractalDown[i];
    const body = res ? tf.resZoneAt[i] : tf.supZoneAt[i];
    const col = res ? tf.resLines : tf.supLines;
    const upper = res ? tf.upperRes : tf.upperSup;
    const lower = res ? tf.lowerRes : tf.lowerSup;
    if (res) {
      if (cfg.showHL) pushLine(upper, tf, x1, edge, i, col, styleHL, cfg.lineWidthHL);
      if (cfg.showClose) pushLine(lower, tf, x1, body, i, col, styleClose, cfg.lineWidthClose);
    } else {
      if (cfg.showClose) pushLine(upper, tf, x1, body, i, col, styleClose, cfg.lineWidthClose);
      if (cfg.showHL) pushLine(lower, tf, x1, edge, i, col, styleHL, cfg.lineWidthHL);
    }
    if (cfg.showLabel && left) {
      const l: Lbl = { x: labelX, y: edge, text: text + (res ? '(R)' : '(S)'), color: noColor, textColor: col, style: 'label_right' };
      if (res) tf.resLabel = l;
      else tf.supLabel = l;
    }
  };

  // ta.highestbars(high, length) / ta.lowestbars(low, length) for each length used (the length is a series in the
  // original; each value is the library function with that length, read at the bar)
  const highSeries = Series.fromArray(bars, bars.map((b) => b.high));
  const lowSeries = Series.fromArray(bars, bars.map((b) => b.low));
  const extremeCache = new Map<string, number[]>();
  const extremeBars = (j: number, length: number, lowest: boolean): number => {
    const key = `${lowest ? 'l' : 'h'}${length}`;
    let values = extremeCache.get(key);
    if (!values) {
      values = (lowest ? ta.lowestbars(lowSeries, length) : ta.highestbars(highSeries, length)).toArray().map((v) => v ?? NaN);
      extremeCache.set(key, values);
    }
    return values[j];
  };
  /** TFx_Hi_Bi / TFx_Lo_Bi at bar i: bars back to the highest high / lowest low of the fractal periods */
  const extremeBack = (tf: TimeFrame, i: number, lowest: boolean): number => {
    const bb1 = tf.bb1[i];
    const br = tf.br[i];
    if (bb1 > MAX_BARS_BACK || bb1 + br > MAX_BARS_BACK) return MAX_BARS_BACK;
    // math.abs(ta.highestbars(high, nz(br, 1)))[bb1] + bb1 (a history offset na reads the current bar)
    const j = Number.isNaN(bb1) ? i : i - bb1;
    if (j < 0) return NaN;
    const length = Number.isNaN(tf.br[j]) ? 1 : tf.br[j];
    return Math.abs(extremeBars(j, length, lowest)) + bb1;
  };
  const back = (i: number, k: number) => (Number.isNaN(k) ? i : i - k >= 0 ? i - k : NaN);

  const lower = (message: string): never => {
    throw new Error(`${message} is below the chart timeframe "${chartTf}": the chart bars do not carry its data.`);
  };

  for (let i = 0; i < n; i++) {
    const chartOnLower = (tf: TimeFrame) => !Number.isNaN(tf.minutes[i]) && !gt(currentMinutes, tf.minutes[i]);
    const chartEqual = (tf: TimeFrame) => eq(currentMinutes, tf.minutes[i]) && tf.menuOn;
    // TF1_text
    const m1 = tfs[0].minutes[i];
    const tf1String = tfs[0].input === 'Chart' ? period : TF_STRING[tfs[0].input];
    const tf1Text = ge(m1, 60) && lt(m1, 1440) ? `${m1 / 60}h` : lt(m1, 60) ? `${tf1String}m` : tf1String;
    const names = [tf1Text, tfs[1].input, tfs[2].input, tfs[3].input];
    // TF1 is hidden when another time frame is the chart timeframe
    const tf1Free = !chartEqual(tfs[1]) && !chartEqual(tfs[2]) && !chartEqual(tfs[3]);

    tfs.forEach((tf, k) => {
      if (tf.known) {
        // TFx_bi1 / TFx_bi5: the bar of the new period 1 / 5 occurrences back
        if (i > 0 && tf.starts[i] !== tf.starts[i - 1]) tf.newBars.push(i);
        const c = tf.newBars.length;
        const bi1 = c >= 2 ? tf.newBars[c - 2] : NaN;
        const bi5 = c >= 6 ? tf.newBars[c - 6] : NaN;
        tf.bb1.push(i - bi1);
        tf.br.push((i - bi5) - (i - bi1));
      }
      const on = chartOnLower(tf) && (k > 0 || tf1Free);
      for (const res of [true, false]) {
        const f = res ? tf.fractalUp : tf.fractalDown;
        const changed = neq(f[i], i > 0 ? f[i - 1] : NaN);
        if (changed === true) {
          if (res) tf.upChanged = true;
          else tf.downChanged = true;
        }
        const everChanged = res ? tf.upChanged : tf.downChanged;
        if (tf.menuOn && changed === true && on) {
          // A new zone: from the bar of the fractal (the highest / lowest bar of its periods on another timeframe)
          const x1 = tf.input !== 'Chart' ? back(i, extremeBack(tf, i, !res)) : back(i, 3);
          zone(tf, res, i, x1, tf.input !== 'Chart' ? x1 : back(i, 2), names[k]);
        } else if (tf.menuOn && changed === null && on && !everChanged) {
          // No change of the fractal yet (the first zone, and the bars before it with an na price)
          zone(tf, res, i, back(i, 3), back(i, 3), names[k]);
        }
        // linefill.new(last upper line, last lower line, zone colour): one fill per pair of lines
        if (tf.zones) {
          const a = (res ? tf.upperRes : tf.upperSup)[tf.numZones - 1];
          const b = (res ? tf.lowerRes : tf.lowerSup)[tf.numZones - 1];
          if (a && b && !a.deleted && !b.deleted && !filled.get(a)?.has(b)) {
            if (!filled.has(a)) filled.set(a, new Set());
            filled.get(a)!.add(b);
            fills.push({ a, b, color: res ? tf.resZone : tf.supZone });
          }
        }
        // A label after the last bar, made again on every bar
        if (cfg.showLabel && tf.menuOn && on && right) {
          const l: Lbl = { x: i + cfg.labelOffset, y: f[i], text: names[k] + (res ? '(R)' : '(S)'), textColor: res ? tf.resLines : tf.supLines, style: 'none' };
          if (res) tf.resLabel = l;
          else tf.supLabel = l;
        }
      }
      if (!cfg.extActive && i === n - 1) {
        for (const arr of [tf.upperRes, tf.lowerRes, tf.upperSup, tf.lowerSup]) {
          const l = arr[tf.numZones - 1];
          if (l) {
            l.extend = 'none';
            l.x2 = i;
          }
        }
      }
    });

    // One label for a zone found on two time frames: the label of the higher-numbered time frame names both,
    // the other label gets a transparent text
    for (const res of [true, false]) {
      const suffix = res ? '(R)' : '(S)';
      const labelOf = (tf: TimeFrame) => (res ? tf.resLabel : tf.supLabel);
      for (const [hi, lo] of [[3, 2], [3, 1], [3, 0], [2, 1], [2, 0], [1, 0]]) {
        const a = tfs[hi];
        const b = tfs[lo];
        const fa = res ? a.fractalUp : a.fractalDown;
        const fb = res ? b.fractalUp : b.fractalDown;
        const menus = a.menuOn && b.menuOn;
        if (!menus) continue;
        if (chartOnLower(b) && (lo > 0 || chartOnLower(a)) && !chartEqual(a)) {
          if (!a.known && (labelOf(a) || labelOf(b))) lower(`Time Frame ${hi + 1} ("${a.input}", compared with Time Frame ${lo + 1})`);
          if (eq(fa[i], fb[i])) {
            const lb = labelOf(b);
            const la = labelOf(a);
            if (lb) lb.textColor = noColor;
            if (la) la.text = `${names[lo]}/${names[hi]}${suffix}`;
          }
        }
        if (left) {
          // The label gets its own text again when the two zones are no longer at the same price
          const la = labelOf(a);
          if (!a.known || !b.known) {
            if (la) lower(`Time Frame ${(a.known ? lo : hi) + 1} ("${(a.known ? b : a).input}", needed by the labels on the left)`);
          } else if (i > 0 && eq(fa[i - 1], fb[i - 1]) && neq(fa[i], fb[i]) === true && la) {
            la.text = `${names[hi]}${suffix}`;
          }
        }
      }
    }
  }

  // ---- Outputs: the objects alive after the last bar; an object with an na coordinate is not drawn
  const interval = barInterval(bars);
  const tOf = (x: number) => barTime(bars, x, interval);
  const drawn = (l: Ln) => !l.deleted && !Number.isNaN(l.x1) && !Number.isNaN(l.x2) && !Number.isNaN(l.y1);
  const toLine = (l: Ln): LineDrawingData => ({
    time1: tOf(l.x1), price1: l.y1, time2: tOf(l.x2), price2: l.y2, color: l.color, width: l.width,
    ...(l.style !== 'solid' ? { style: l.style } : {}),
    ...(l.extend !== 'none' ? { extend: l.extend } : {}),
  });
  const lines = allLines.filter(drawn).map(toLine);
  const linefills = fills.filter((f) => drawn(f.a) && drawn(f.b)).map((f) => ({ line1: toLine(f.a), line2: toLine(f.b), color: f.color }));
  const labels: LabelData[] = [];
  for (const tf of tfs) {
    for (const l of [tf.resLabel, tf.supLabel]) {
      if (!l || Number.isNaN(l.x) || Number.isNaN(l.y)) continue;
      labels.push({
        time: tOf(l.x), price: l.y, text: l.text, textColor: l.textColor, style: l.style, size: 'normal',
        ...(l.color !== undefined ? { color: l.color } : {}),
      });
    }
  }

  // vol_check = na(volume) or volume[1] == 0, on the last bar
  const tables: TableData[] = [];
  const lastVolume = bars[n - 1].volume;
  if (lastVolume === undefined || lastVolume === null || Number.isNaN(lastVolume) || (n > 1 && bars[n - 2].volume === 0)) {
    tables.push({
      position: 'middle_right', columns: 1, rows: 1, frameColor: '#FF5252', frameWidth: 1,
      cells: [{
        column: 0, row: 0, textColor: '#FF5252',
        text: 'There is no volume data for this symbol\n Please use a different symbol with volume data',
      }],
    });
  }

  return result(lines, labels, linefills, tables);
}

export const VolumeBasedSupportResistanceZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
