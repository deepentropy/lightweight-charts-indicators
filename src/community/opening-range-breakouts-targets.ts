/**
 * Opening Range with Breakouts & Targets [LuxAlgo]
 *
 * The opening range (OR) is the high / low range of the first bars of each session: from the first bar of the
 * session until the "Time Period" timeframe changes, or a custom session with its own time zone. During the range a
 * box follows its high and low. When the range ends, three lines start (ORH, ORL and the dashed middle) with a fill
 * between ORH and ORL: green when the middle is above the middle of the previous range, red when below. Targets are
 * lines at multiples of a percentage of the range width above ORH and below ORL; a new target is drawn each time the
 * price (close, or high / low) goes through the last one. A breakout signal (a triangle label) is made when the close
 * crosses over ORH or under ORL; it is armed again when the close comes back through the middle. With "Daily Bias"
 * a signal against the direction of the day waits for the first target. A moving average that restarts on each
 * session can be shown.
 *
 * Limits of the port:
 * - The first bar of the session (session.isfirstbar) and the periods of "Time Period" (timeframe.change) need the
 *   exchange session, which the bars do not carry. The port uses the UTC calendar: on symbols with weekend bars the
 *   session starts at 00:00 UTC; on other symbols the session starts on the first bar of each UTC day. Equal on UTC
 *   24x7 symbols and on symbols whose session is inside one UTC day without extended hours (e.g. US stocks). The
 *   first bar of the bars is a session start only when it is not later in the day than the first bar of the next day.
 * - Tooltips of the labels are prices printed with the price tick of the symbol; the port uses a tick of 0.01.
 * - The moving average type WMA needs a weighted average with a length that changes on each bar, which the
 *   library does not have: the port throws an Error for it.
 * - The Pine script stops with an error on daily and higher bars; the port throws the same error.
 *
 * Reference: "Opening Range with Breakouts & Targets [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, Series, color, str, callsite, timeframe, time as pineTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { LineDrawingData, BoxData, LabelData, LinefillData, PineSize } from '../types';
import { barInterval, barTime } from '../bar-time';
import { periodStarts, chartTimeframe } from '../anchor-period';

export interface OpeningRangeBreakoutsTargetsInputs {
  /** Keep the drawings of the previous sessions */
  showHist: boolean;
  /** Length of the opening range (timeframe) */
  orTF: string;
  /** Use the custom session for the opening range */
  crTog: boolean;
  crSesh: string;
  /** Time zone of the custom session */
  tz: string;
  sigTog: boolean;
  useBias: 'No Bias' | 'Daily Bias';
  sigSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
  upSigColor: string;
  downSigColor: string;
  tTog: boolean;
  /** Target distance in percent of the range width */
  tPer: number;
  tSrc: 'Close' | 'Highs/Lows';
  tDispType: 'Adaptive' | 'Extended';
  maTog: boolean;
  maLen: number;
  maType: 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'VWMA';
  maColor: string;
  green: string;
  red: string;
  greenFill: string;
  redFill: string;
  orColor: string;
  orFillColor: string;
  tStyle: '___' | '- - -' | '. . .';
  txtSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
}

export const defaultInputs: OpeningRangeBreakoutsTargetsInputs = {
  showHist: true,
  orTF: '30',
  crTog: false,
  crSesh: '0930-0945',
  tz: 'UTC-5',
  sigTog: true,
  useBias: 'No Bias',
  sigSize: 'Small',
  upSigColor: '#089981',
  downSigColor: '#f23645',
  tTog: true,
  tPer: 50,
  tSrc: 'Close',
  tDispType: 'Adaptive',
  maTog: false,
  maLen: 20,
  maType: 'EMA',
  maColor: '#FF9800',
  // input.color(color.new(c, 60)) is stored with an alpha of 2 decimals
  green: 'rgba(8, 153, 129, 0.4)',
  red: 'rgba(242, 54, 69, 0.4)',
  greenFill: 'rgba(8, 153, 129, 0.2)',
  redFill: 'rgba(242, 54, 69, 0.2)',
  orColor: '#787b86',
  orFillColor: 'rgba(120, 123, 134, 0.4)',
  tStyle: '___',
  txtSize: 'Small',
};

const SIZES = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];
const TIMEZONES = ['UTC-10', 'UTC-8', 'UTC-7', 'UTC-6', 'UTC-5', 'UTC-4', 'UTC-3', 'UTC+0', 'UTC+1', 'UTC+2', 'UTC+3',
  'UTC+3:30', 'UTC+4', 'UTC+5', 'UTC+5:30', 'UTC+5:45', 'UTC+6', 'UTC+6:30', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC+9:30',
  'UTC+10', 'UTC+11', 'UTC+12', 'UTC+12:45', 'UTC+13'];

export const inputConfig: InputConfig[] = [
  { id: 'showHist', type: 'bool', title: 'Show Historical Data', defval: true, group: 'Historical Display',
    tooltip: 'Displays All Data from Previous Sessions' },
  { id: 'orTF', type: 'timeframe', title: 'Time Period', defval: '30', group: 'Opening Range',
    tooltip: 'Sets the Length of Time used for determining Opening Range.' },
  { id: 'crTog', type: 'bool', title: '', defval: false, group: 'Custom Range', inline: 'Custom' },
  { id: 'crSesh', type: 'session', title: '', defval: '0930-0945', group: 'Custom Range', inline: 'Custom' },
  { id: 'tz', type: 'string', title: '', defval: 'UTC-5', options: TIMEZONES, group: 'Custom Range', inline: 'Custom' },
  { id: 'sigTog', type: 'bool', title: 'Show Breakout Signals', defval: true, group: 'Breakout Signals' },
  { id: 'useBias', type: 'string', title: 'Signal Bias', defval: 'No Bias', options: ['No Bias', 'Daily Bias'],
    group: 'Breakout Signals',
    tooltip: 'OR Fill Color is directional based on if the current Day/Session ORM is Above or Below the Previous ORM.\nExamples\nNo Bias: Signals Occur Regardless of OR Color\nDaily Bias: Signals do not fire until Target 1 when Breakout is in opposite direction of OR Color.' },
  { id: 'sigSize', type: 'string', title: 'Signal Size', defval: 'Small', options: SIZES, group: 'Breakout Signals' },
  { id: 'upSigColor', type: 'color', title: 'Up Color', defval: '#089981', group: 'Breakout Signals', inline: 'Colors' },
  { id: 'downSigColor', type: 'color', title: 'Down Color', defval: '#f23645', group: 'Breakout Signals', inline: 'Colors' },
  { id: 'tTog', type: 'bool', title: 'Show Targets', defval: true, group: 'Targets' },
  { id: 'tPer', type: 'float', title: 'Target % of Range', defval: 50, min: 1, group: 'Targets',
    tooltip: 'Uses this % of OR Width to use as the distance for targets.' },
  { id: 'tSrc', type: 'string', title: 'Target Cross Source', defval: 'Close', options: ['Close', 'Highs/Lows'],
    group: 'Targets', tooltip: 'Uses this Source to tell the script when a target is hit in order to draw the next target.' },
  { id: 'tDispType', type: 'string', title: 'Target Display', defval: 'Adaptive', options: ['Adaptive', 'Extended'],
    group: 'Targets',
    tooltip: 'Adaptive: Displays and hides targets Adaptivly based on the current price.\nExtended: Extends all targets to the current bar and does not hide any targets after generation.' },
  { id: 'maTog', type: 'bool', title: '', defval: false, group: 'Session Moving Average', inline: 'MA' },
  { id: 'maLen', type: 'int', title: '', defval: 20, group: 'Session Moving Average', inline: 'MA' },
  { id: 'maType', type: 'string', title: '', defval: 'EMA', options: ['SMA', 'EMA', 'RMA', 'WMA', 'VWMA'],
    group: 'Session Moving Average', inline: 'MA' },
  { id: 'maColor', type: 'color', title: '', defval: '#FF9800', group: 'Session Moving Average', inline: 'MA',
    tooltip: 'Moving average resets on the start of each session (at Opening Range Start).' },
  { id: 'green', type: 'color', title: ' Bull Target Color', defval: 'rgba(8, 153, 129, 0.4)', group: 'Style', inline: 'Bull' },
  { id: 'red', type: 'color', title: 'Bear Target Color', defval: 'rgba(242, 54, 69, 0.4)', group: 'Style', inline: 'Bear' },
  { id: 'greenFill', type: 'color', title: ' Bull Fill Color', defval: 'rgba(8, 153, 129, 0.2)', group: 'Style', inline: 'Bull' },
  { id: 'redFill', type: 'color', title: 'Bear Fill Color', defval: 'rgba(242, 54, 69, 0.2)', group: 'Style', inline: 'Bear' },
  { id: 'orColor', type: 'color', title: '   OR Levels Color', defval: '#787b86', group: 'Style', inline: 'Range' },
  { id: 'orFillColor', type: 'color', title: 'OR Highlight Color', defval: 'rgba(120, 123, 134, 0.4)', group: 'Style',
    inline: 'Range' },
  { id: 'tStyle', type: 'string', title: 'Target Style', defval: '___', options: ['___', '- - -', '. . .'], group: 'Style' },
  { id: 'txtSize', type: 'string', title: 'Text Size', defval: 'Small', options: SIZES, group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  // display = maTog ? display.all : display.none: hidden with the default inputs
  { id: 'plot0', title: 'Moving Average', color: '#FF9800', lineWidth: 1, style: 'linebr', display: 'none' },
];

export const metadata = {
  title: 'Opening Range with Breakouts & Targets [LuxAlgo]',
  shortTitle: 'LuxAlgo - ORB & Targets',
  overlay: true,
};

/** max_lines_count / max_labels_count / max_boxes_count of the script */
const MAX_OBJECTS = 500;
/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;
/** invis = color.rgb(0, 0, 0, 100) */
const INVIS = 'rgba(0, 0, 0, 0)';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);

/**
 * Live drawings of one kind, in creation order. Pine keeps at most max objects: a creation that brings the count
 * above max + 5 deletes the oldest until max remain. An object that a `var` variable of the script still refers to
 * (here the box of the range and the middle line) is not deleted; objects kept in arrays or in fields of other
 * objects are (measured on the original platform).
 */
class Live<T extends object> {
  items: T[] = [];
  private held = new Map<string, T | null>();
  add(o: T): T {
    this.items.push(o);
    if (this.items.length > MAX_OBJECTS + 5) {
      const kept = new Set(this.held.values());
      let excess = this.items.length - MAX_OBJECTS;
      this.items = this.items.filter((x) => kept.has(x) || excess-- <= 0);
    }
    return o;
  }
  /** The `var` variable `name` now refers to `o` */
  hold(name: string, o: T): T {
    this.held.set(name, o);
    return o;
  }
  delete(o: T | null): void {
    if (!o) return;
    const k = this.items.lastIndexOf(o);
    if (k >= 0) this.items.splice(k, 1);
  }
  has(o: T): boolean {
    return this.items.includes(o);
  }
}

/** type target: a line and its label */
interface Target {
  ln: LineDrawingData | null;
  lab: LabelData | null;
}

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<OpeningRangeBreakoutsTargetsInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; linefills: LinefillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  // if timeframe.in_seconds(timeframe.period) >= timeframe.in_seconds("D") => runtime.error(...)
  const chartTf = chartTimeframe(bars);
  if (chartTf !== '' && timeframe.in_seconds(chartTf) >= timeframe.in_seconds('D')) {
    throw new Error('Timeframe is too High! Please Reduce Timeframe to be Less-Than 1 Day.');
  }
  if (cfg.maType === 'WMA') {
    throw new Error('Opening Range with Breakouts & Targets: the moving average type WMA needs ta.wma with a length '
      + 'that changes on each bar, which oakscriptjs does not have.');
  }
  const useBias = cfg.useBias !== 'No Bias';
  const sigSize = cfg.sigSize.toLowerCase() as PineSize;
  const txtSize = cfg.txtSize.toLowerCase() as PineSize;
  const tPer = cfg.tPer * 0.01;
  const maLen = Math.trunc(cfg.maLen);
  const targetStyle = cfg.tStyle === '___' ? 'solid' : cfg.tStyle === '- - -' ? 'dashed' : 'dotted';
  const greenText = String(color.new(cfg.green, 0));
  const redText = String(color.new(cfg.red, 0));
  const orText = String(color.new(cfg.orColor, 0));
  const interval = barInterval(bars);
  const inMs = n > 0 && bars[0].time >= 1e12;
  const tick = (v: number) => str.tostring(v, 'mintick', MINTICK);

  // Opening range session: or_sesh
  const orSesh: boolean[] = new Array(n).fill(false);
  if (cfg.crTog) {
    // or_sesh := not na(time(timeframe.period, crSesh, tz))
    for (let i = 0; i < n; i++) {
      orSesh[i] = pineTime.inSession(inMs ? bars[i].time : bars[i].time * 1000, cfg.crSesh, cfg.tz);
    }
  } else {
    // session.isfirstbar: the first bar of the trading day; timeframe.change(orTF): a new period of the timeframe
    const day = periodStarts(bars, 'D');
    const period = periodStarts(bars, cfg.orTF);
    // The session of bar 0 can have started before the bars: bar 0 is a first bar when it is not later in the day (UTC)
    // than the first bar of the next day
    const daySec = inMs ? 86400000 : 86400;
    const nextDay = day.findIndex((d) => d !== day[0]);
    const firstIsStart = n > 0 && (nextDay < 0 || bars[0].time % daySec <= bars[nextDay].time % daySec);
    let state = false;
    for (let i = 0; i < n; i++) {
      const firstBar = i === 0 ? firstIsStart : day[i] !== day[i - 1];
      const newTf = i === 0 || period[i] !== period[i - 1];
      if (firstBar) state = true;
      else if (newTf) state = false;
      orSesh[i] = state;
    }
  }
  const orStart = orSesh.map((s, i) => s && !(i > 0 && orSesh[i - 1]));

  // day_ma(): v_len = min(bars since the range start (1 on the start bar), maLen); maLen before the first start
  const sinceStart = callsite.barssince();
  const vLen = orStart.map((s) => {
    const since = sinceStart(s);
    const bsNd = since === 0 ? 1 : since;
    return bsNd < maLen ? bsNd : maLen;
  });
  const closes = bars.map((b) => b.close);
  const toArray = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const vLenSeries = Series.fromArray(bars, vLen);
  let maSeries: number[] | null = null;
  if (cfg.maType === 'SMA') {
    maSeries = toArray(ta.sma(Series.fromArray(bars, closes), vLenSeries));
  } else if (cfg.maType === 'VWMA') {
    // ta.vwma(s, len) = ta.sma(s * volume, len) / ta.sma(volume, len)
    const pv = toArray(ta.sma(Series.fromArray(bars, bars.map((b) => b.close * (b.volume ?? NaN))), vLenSeries));
    const v = toArray(ta.sma(Series.fromArray(bars, bars.map((b) => b.volume ?? NaN)), vLenSeries));
    maSeries = pv.map((x, i) => x / v[i]);
  }

  const lines = new Live<LineDrawingData>();
  const boxes = new Live<BoxData>();
  const labels = new Live<LabelData>();
  const fills: Array<{ line1: LineDrawingData; line2: LineDrawingData; color: string }> = [];

  let upTargs: Target[] = [];
  let downTargs: Target[] = [];
  const signals: LabelData[] = [];
  let orToken = false;
  let orh = NaN, orl = NaN, hst = NaN, lst = NaN, prevOrm = NaN;
  let upCount = NaN, downCount = NaN;
  let orBx: BoxData | null = null;
  let dayDir = 0;
  let downCheck = false, upCheck = false;
  let hLn: Target = { ln: null, lab: null };
  let lLn: Target = { ln: null, lab: null };
  let mLn: LineDrawingData | null = null;
  let prevOrmSeries = NaN; // orm[1]
  let ma = NaN;

  const xdownSite = callsite.crossunder();
  const xdown2Site = callsite.crossunder();
  const xdown3Site = callsite.crossunder();
  const xupSite = callsite.crossover();
  const xup2Site = callsite.crossover();
  const xup3Site = callsite.crossover();

  // get_1up(_val) => (_val - math.floor(_val)) > 0 ? int(math.floor(_val) + 1) : int(_val)
  const get1up = (v: number) => (gt(v - Math.floor(v), 0) ? Math.trunc(Math.floor(v) + 1) : Math.trunc(v));
  const targetLabel = (i: number, y: number, text: string, textColor: string): LabelData => labels.add({
    time: bars[i].time, price: y, text, tooltip: tick(y), style: 'label_left', color: INVIS, textColor, size: txtSize,
  });

  const plot0: Point[] = [];
  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const t = bar.time;
    const { close, high, low } = bar;
    let downSignal = false;
    let upSignal = false;

    const orm = (orh + orl) / 2;
    const orw = Math.abs(orh - orl);
    const hSrc = cfg.tSrc === 'Close' ? close : high;
    const lSrc = cfg.tSrc === 'Close' ? close : low;
    const sesh = orSesh[i];
    const orEnd = i > 0 && orSesh[i - 1] && !sesh;

    // On Start of OR Session
    if (orStart[i]) {
      for (const targ of upTargs) {
        if (!cfg.showHist) lines.delete(targ.ln);
        labels.delete(targ.lab);
      }
      for (const targ of downTargs) {
        if (!cfg.showHist) lines.delete(targ.ln);
        labels.delete(targ.lab);
      }
      if (!cfg.showHist) {
        for (const lab of signals) labels.delete(lab);
        boxes.delete(orBx);
        lines.delete(hLn.ln);
        lines.delete(lLn.ln);
        lines.delete(mLn);
      }
      labels.delete(hLn.lab);
      labels.delete(lLn.lab);
      upTargs = [];
      downTargs = [];

      orh = high;
      orl = low;
      prevOrm = prevOrmSeries;
      upCount = 0;
      downCount = 0;
      upCheck = true;
      downCheck = true;
      orBx = boxes.hold('or_bx', boxes.add({ time1: t, price1: high, time2: t, price2: low, bgColor: cfg.orFillColor, borderWidth: 0 }));
      orToken = false;
    }

    // Running while OR Session is Live
    if (sesh) {
      if (gt(high, orh)) orh = high;
      if (lt(low, orl)) orl = low;
      if (orBx) {
        orBx.price1 = orh;
        orBx.price2 = orl;
        orBx.time2 = t;
      }
      if (Math.abs(orh - orl) > EPS) orToken = true;
    }

    // On End of OR Session
    if (orEnd && orToken) {
      hLn = {
        ln: lines.add({ time1: t, price1: orh, time2: t, price2: orh, color: cfg.orColor }),
        lab: targetLabel(i, orh, 'ORH', orText),
      };
      lLn = {
        ln: lines.add({ time1: t, price1: orl, time2: t, price2: orl, color: cfg.orColor }),
        lab: targetLabel(i, orl, 'ORL', orText),
      };
      mLn = lines.hold('m_ln', lines.add({ time1: t, price1: orm, time2: t, price2: orm, style: 'dashed', color: cfg.orColor }));
      hst = orh + orw * tPer;
      lst = orl - orw * tPer;
      dayDir = gt(orm, prevOrm) ? 1 : lt(orm, prevOrm) ? -1 : 0;
      fills.push({
        line1: hLn.ln as LineDrawingData, line2: lLn.ln as LineDrawingData,
        color: dayDir === 1 ? cfg.greenFill : dayDir === -1 ? cfg.redFill : INVIS,
      });
    }

    // Running outside of OR Session
    if (!sesh && orToken) {
      if (hLn.ln) hLn.ln.time2 = t;
      if (lLn.ln) lLn.ln.time2 = t;
      if (hLn.lab) hLn.lab.time = t;
      if (lLn.lab) lLn.lab.time = t;
      if (mLn) mLn.time2 = t;
    }

    // Target Calculations
    if (gt(hSrc, hst)) hst = hSrc;
    if (lt(lSrc, lst)) lst = lSrc;
    const step = orw * tPer;
    const upMax = get1up((hst - orh) / step);
    const downMax = get1up((orl - lst) / step);
    // math.max(0, na) is na
    const upCurRaw = get1up((hSrc - orh) / step);
    const downCurRaw = get1up((orl - lSrc) / step);
    const upCur = Number.isNaN(upCurRaw) ? NaN : Math.max(0, upCurRaw);
    const downCur = Number.isNaN(downCurRaw) ? NaN : Math.max(0, downCurRaw);

    // Signal Calcs
    if (gt(close, orm) && !downCheck) downCheck = true;
    const xdown = xdownSite(close, orl);
    const xdown2 = xdown2Site(close, orl - orw * tPer);
    const downCross = useBias ? ((dayDir !== 1 && xdown) || (dayDir === 1 && xdown2)) : xdown3Site(close, orl);
    if (downCross && downCheck) {
      downSignal = true;
      downCheck = false;
    }
    if (lt(close, orm) && !upCheck) upCheck = true;
    const xup = xupSite(close, orh);
    const xup2 = xup2Site(close, orh + orw * tPer);
    const upCross = useBias ? ((dayDir !== -1 && xup) || (dayDir === -1 && xup2)) : xup3Site(close, orh);
    if (upCross && upCheck) {
      upSignal = true;
      upCheck = false;
    }

    // Targets
    if (!sesh && orToken) {
      const tPrev = i > 0 ? bars[i - 1].time : t - interval;
      if (upCount < upMax && cfg.tTog) {
        if (!Number.isFinite(upMax)) throw new Error('Opening Range with Breakouts & Targets: the target count is not finite.');
        for (let k = upCount + 1; k <= upMax; k++) {
          const y = orh + orw * tPer * k;
          upTargs.push({
            ln: lines.add({ time1: tPrev, price1: y, time2: t, price2: y, color: cfg.green, style: targetStyle }),
            lab: targetLabel(i, y, str.tostring(k), greenText),
          });
          if (k === upMax) upCount = upMax;
        }
      }
      if (downCount < downMax && cfg.tTog) {
        if (!Number.isFinite(downMax)) throw new Error('Opening Range with Breakouts & Targets: the target count is not finite.');
        for (let k = downCount + 1; k <= downMax; k++) {
          const y = orl - orw * tPer * k;
          downTargs.push({
            ln: lines.add({ time1: tPrev, price1: y, time2: t, price2: y, color: cfg.red, style: targetStyle }),
            lab: targetLabel(i, y, str.tostring(k), redText),
          });
          if (k === downMax) downCount = downMax;
        }
      }
    }

    // Extending to Current Bar
    if (cfg.tDispType === 'Extended' && cfg.tTog) {
      for (const targ of [...upTargs, ...downTargs]) {
        if (targ.ln) targ.ln.time2 = t;
        if (targ.lab) targ.lab.time = t;
      }
    }
    if (cfg.tDispType === 'Adaptive' && cfg.tTog) {
      const next = barTime(bars, i + 1, interval);
      for (const targ of upTargs) {
        const y1 = (targ.ln as LineDrawingData).price1;
        if (le(y1, orh + orw * tPer * upCur) && ge(y1, orh + orw * tPer * (upCur - 2))) {
          (targ.ln as LineDrawingData).time2 = next;
          (targ.lab as LabelData).time = next;
        }
      }
      for (const targ of downTargs) {
        const y1 = (targ.ln as LineDrawingData).price1;
        if (le(y1, orl - orw * tPer * (downCur - 2)) && ge(y1, orl - orw * tPer * downCur)) {
          (targ.ln as LineDrawingData).time2 = next;
          (targ.lab as LabelData).time = next;
        }
      }
    }

    // Moving Average: day_ma(or_start, maType, close, maLen)
    if (cfg.maType === 'EMA') {
      const k = 2 / (vLen[i] + 1);
      ma = close * k + (Number.isNaN(ma) ? 0 : ma) * (1 - k);
    } else if (cfg.maType === 'RMA') {
      const a = 1 / vLen[i];
      ma = a * close + (1 - a) * (Number.isNaN(ma) ? 0 : ma);
    } else if (maSeries) {
      ma = maSeries[i];
    }
    plot0.push({ time: t, value: orStart[i] || !Number.isFinite(ma) ? NaN : ma, color: cfg.maColor });

    // Signals
    if (upSignal && cfg.sigTog) {
      signals.push(labels.add({
        time: t, price: orl, style: 'label_center', text: '\n▲', color: INVIS, textColor: cfg.upSigColor, size: sigSize,
      }));
    }
    if (downSignal && cfg.sigTog) {
      signals.push(labels.add({
        time: t, price: orh, style: 'label_center', text: '▼\n', color: INVIS, textColor: cfg.downSigColor, size: sigSize,
      }));
    }
    prevOrmSeries = orm;
  }

  // A linefill lives as long as its two lines
  const linefills: LinefillData[] = fills
    .filter((f) => lines.has(f.line1) && lines.has(f.line2))
    .map((f) => ({ line1: f.line1, line2: f.line2, color: f.color }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    lines: lines.items,
    boxes: boxes.items,
    labels: labels.items,
    linefills,
  };
}

export const OpeningRangeBreakoutsTargets = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
