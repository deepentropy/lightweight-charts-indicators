/**
 * Market sessions and Volume profile - By Leviathan
 *
 * Splits the chart into sessions (Tokyo, London, New York by UTC hours, or the day, week, month, quarter, year) and
 * draws a volume profile for each finished session: the price range of the session is cut into `resolution` rows
 * and the volume of each bar is spread over the rows that its body and wicks cover (the body volume goes to the up
 * or down side by the bar direction, each wick half to each side). Each row is drawn as an up-volume box followed
 * by a down-volume box, scaled so that the largest row takes about 70 % of the session width. A dashed box marks the
 * session, with its name above it, and three lines mark the point of control (row with the most volume) and the
 * value area high and low (rows around the point of control that hold the value area percentage of the volume).
 * The session in progress is drawn in the same way on the last bar ("Live Zone"). "Show Forex Sessions" adds a
 * dashed box and a name for the Tokyo, London and New York sessions.
 *
 * Notes on the port:
 * - The original reads the bars through a lower timeframe request with an empty timeframe, which is the chart
 *   timeframe: each bar gives one bar. The port uses the chart bars.
 * - "Profile Data Type" = "Open Interest" needs the open interest of another ticker (<symbol>_OI), which the bars do
 *   not carry: the port throws an Error for it.
 * - New days, weeks, months, quarters and years are read in the exchange time zone, as in the original. The port
 *   reads the time zone from the chart context (third argument of calculate). Without it the port uses UTC: equal
 *   on UTC symbols and on symbols whose trading day is inside one UTC day (e.g. US stocks).
 * - The session box border and the session names use the chart foreground colour (chart.fg_color), read from the
 *   chart context. Without it the port uses #DBDBDB, the foreground colour of a dark chart.
 * - The original stops with a runtime error when a session is longer than 5,000 bars (history reference limit,
 *   e.g. "Yearly" on 60-minute bars). The port has no such limit and draws the session.
 * - The original stops with a runtime error when a session never starts for 15,000 bars (e.g. the London session
 *   on a symbol without bars before 07:00 UTC): the port throws the same error (window limit of the library).
 * - Drawing counts (500 boxes, 50 lines, 50 labels) and the runtime error of a bar index more than 10,000 bars back
 *   follow the drawing registry of the library.
 *
 * Chart timeframe: `timeframe` of the chart context (optional third argument of calculate) when given; without it
 * the chart timeframe is read from the bar spacing (the most frequent gap between two bars).
 *
 * Reference: "Market sessions and Volume profile - By Leviathan" by LeviathanCapital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Leviathan. Some Volume Profile elements are inspired by @LonesomeTheBlue's volume profile script
 */

import {
  ta, Series, array, callsite, time as pineTime, box, line, label, periodTime,
  resetDrawings, setDrawingBar, type SessionContext, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { LineDrawingData, BoxData, LabelData } from '../types';
import { barInterval } from '../bar-time';
import { chartTimeframe } from '../anchor-period';
import { foregroundColorOf, timezoneOf, type ChartContext } from '../chart-context';

export interface MarketSessionsVolumeProfileInputs {
  sessionType: 'Tokyo' | 'London' | 'New York' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  showProf: boolean;
  /** Not used by the original script (the session box is always drawn) */
  showSbox: boolean;
  showPoc: boolean;
  showVA: boolean;
  showVAb: boolean;
  /** Draw the session in progress on the last bar */
  showCur: boolean;
  showLabels: boolean;
  showFx: boolean;
  /** Number of rows of a profile */
  resolution: number;
  /** Value area volume in percent */
  VAwid: number;
  dispMode: 'Mode 1' | 'Mode 2' | 'Mode 3';
  volType: 'Volume' | 'Open Interest';
  smoothVol: boolean;
  bullCol: string;
  bearCol: string;
  VAbCol: string;
  pocCol: string;
  pocWid: number;
  vahCol: string;
  vahWid: number;
  valCol: string;
  valWid: number;
  boxBg: string;
  boxWid: number;
}

export const defaultInputs: MarketSessionsVolumeProfileInputs = {
  sessionType: 'Daily',
  showProf: true,
  showSbox: true,
  showPoc: true,
  showVA: true,
  showVAb: false,
  showCur: true,
  showLabels: true,
  showFx: false,
  resolution: 30,
  VAwid: 70,
  dispMode: 'Mode 2',
  volType: 'Volume',
  smoothVol: false,
  // input.color(color.rgb(r, g, b, t)) is stored with an alpha of 2 decimals
  bullCol: 'rgba(76, 175, 79, 0.5)',
  bearCol: 'rgba(255, 82, 82, 0.5)',
  VAbCol: 'rgba(107, 159, 255, 0.1)',
  pocCol: '#FF5252',
  pocWid: 1,
  vahCol: '#00BCD4',
  vahWid: 1,
  valCol: '#00BCD4',
  valWid: 1,
  boxBg: 'rgba(255, 153, 0, 0)',
  boxWid: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'sessionType', type: 'string', title: 'Session Type', defval: 'Daily',
    options: ['Tokyo', 'London', 'New York', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] },
  { id: 'showProf', type: 'bool', title: 'Show Volume Profile', defval: true, group: 'Display' },
  { id: 'showSbox', type: 'bool', title: 'Show Session Box', defval: true, group: 'Display' },
  { id: 'showPoc', type: 'bool', title: 'Show POC', defval: true, group: 'Display' },
  { id: 'showVA', type: 'bool', title: 'Show VAH and VAL', defval: true, group: 'Display' },
  { id: 'showVAb', type: 'bool', title: 'Show Value Area Box', defval: false, group: 'Display' },
  { id: 'showCur', type: 'bool', title: 'Show Live Zone', defval: true, group: 'Display' },
  { id: 'showLabels', type: 'bool', title: 'Show Session Lables', defval: true, group: 'Display' },
  { id: 'showFx', type: 'bool', title: 'Show Forex Sessions (no profile)', defval: false, group: 'Display' },
  { id: 'resolution', type: 'int', title: 'Resolution', defval: 30, min: 5, group: 'Volume Profile Settings',
    tooltip: 'The higher the value, the more refined of a profile, but less profiles shown on chart' },
  { id: 'VAwid', type: 'int', title: 'Value Area Volume %', defval: 70, min: 1, max: 100, group: 'Volume Profile Settings' },
  { id: 'dispMode', type: 'string', title: 'Bar Mode', defval: 'Mode 2', options: ['Mode 1', 'Mode 2', 'Mode 3'],
    group: 'Volume Profile Settings' },
  { id: 'volType', type: 'string', title: 'Profile Data Type', defval: 'Volume', options: ['Volume', 'Open Interest'],
    group: 'Volume Profile Settings' },
  { id: 'smoothVol', type: 'bool', title: 'Smooth Volume Data', defval: false, group: 'Volume Profile Settings',
    tooltip: 'Useful for assets that have very large spikes in volume over large bars - helps create better profiles' },
  { id: 'bullCol', type: 'color', title: 'Up Volume', defval: 'rgba(76, 175, 79, 0.5)', group: 'Appearance' },
  { id: 'bearCol', type: 'color', title: 'Down Volume', defval: 'rgba(255, 82, 82, 0.5)', group: 'Appearance' },
  { id: 'VAbCol', type: 'color', title: 'Value Area Box', defval: 'rgba(107, 159, 255, 0.1)', group: 'Appearance' },
  { id: 'pocCol', type: 'color', title: 'POC', defval: '#FF5252', group: 'Appearance', inline: 'p' },
  { id: 'pocWid', type: 'int', title: 'Thickness', defval: 1, group: 'Appearance', inline: 'p' },
  { id: 'vahCol', type: 'color', title: 'VAH', defval: '#00BCD4', group: 'Appearance', inline: 'h' },
  { id: 'vahWid', type: 'int', title: 'Thickness', defval: 1, group: 'Appearance', inline: 'h' },
  { id: 'valCol', type: 'color', title: 'VAL', defval: '#00BCD4', group: 'Appearance', inline: 'l' },
  { id: 'valWid', type: 'int', title: 'Thickness', defval: 1, group: 'Appearance', inline: 'l' },
  { id: 'boxBg', type: 'color', title: 'Box', defval: 'rgba(255, 153, 0, 0)', group: 'Appearance', inline: 'm' },
  { id: 'boxWid', type: 'int', title: 'Thickness', defval: 1, group: 'Appearance', inline: 'm' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Market sessions and Volume profile - By Leviathan',
  shortTitle: 'Market sessions and Volume profile - By Leviathan',
  overlay: true,
};

/** indicator(max_boxes_count = 500); lines and labels keep the default of 50 */
const MAX_BOXES = 500;
const MAX_LINES = 50;
const MAX_LABELS = 50;
/** color.rgb(0, 0, 0, 100) and color.rgb(54, 58, 69, 100) */
const NO_COLOR = 'rgba(0, 0, 0, 0)';
const VA_BOX_BORDER = 'rgba(54, 58, 69, 0)';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);

/** get_vol(): the part of `vol` (spread over `height`) inside the overlap of the ranges y11..y12 and y21..y22; nz() */
function getVol(y11: number, y12: number, y21: number, y22: number, height: number, vol: number): number {
  const r = (Math.max(Math.min(Math.max(y11, y12), Math.max(y21, y22)) - Math.max(Math.min(y11, y12), Math.min(y21, y22)), 0) * vol) / height;
  return Number.isFinite(r) ? r : 0;
}

/**
 * The output data of the drawing objects of one kind, in creation order. The live objects of the registry keep the
 * creation order, so they are read by walking both lists together (no map: a long history creates hundreds of
 * thousands of boxes). The objects deleted by the maximum count are dropped each time the list has grown by `max`.
 */
function drawingData<T>(all: () => object[], max: number) {
  const objs: object[] = [];
  const data: T[] = [];
  let room = 2 * max;
  /** Keeps the live objects only */
  const compact = () => {
    const live = all();
    let kept = 0;
    for (let k = 0; k < objs.length && kept < live.length; k++) {
      if (objs[k] === live[kept]) {
        objs[kept] = objs[k];
        data[kept] = data[k];
        kept++;
      }
    }
    objs.length = kept;
    data.length = kept;
  };
  return {
    set(obj: object, d: T) {
      objs.push(obj);
      data.push(d);
      if (objs.length > room) {
        compact();
        room = objs.length + max;
      }
    },
    live: () => {
      compact();
      return data;
    },
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketSessionsVolumeProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  /** chart.fg_color (#DBDBDB, the foreground colour of a dark chart, without a chart context) */
  const CHART_FG_COLOR = foregroundColorOf(chart);
  /** syminfo.timezone, the time zone of dayofweek, weekofyear, dayofmonth, month and year (UTC without a chart context) */
  const tz = timezoneOf(chart);
  if (cfg.volType === 'Open Interest') {
    throw new Error('Market sessions and Volume profile: "Open Interest" needs the open interest ticker of the symbol '
      + '(<symbol>_OI), which the bars do not carry.');
  }
  const n = bars.length;
  const resolution = Math.trunc(cfg.resolution);
  const inMs = n > 0 && bars[0].time >= 1e12;
  const interval = barInterval(bars);
  // time(timeframe.period, '0000-2400', 'GMT'): the start of the chart timeframe period that contains the bar, with
  // periods counted from 00:00 GMT (measured: 13:30 gives 13:00 on 60-minute bars, 12:00 on 240-minute bars, and
  // 00:00 of the day on daily and higher bars), from the library (the chart session is not read)
  const chartTf = chartTimeframe(bars, chart);
  const gmtCtx: SessionContext | null = chartTf === ''
    ? null : { timeframe: chartTf, timezone: 'GMT', session: '0000-2400', timeUnit: 'ms' };
  const sessionTime = (tMs: number) => (gmtCtx === null ? tMs : periodTime(tMs, chartTf, gmtCtx, '0000-2400', 'GMT'));
  /** Time of a bar index (a bar before the first bar: by the bar interval) */
  const timeOf = (index: number) => (index >= 0 ? bars[Math.min(index, n - 1)].time : bars[0].time + index * interval);

  // vol(): smoothVol ? ta.ema(volume, 5) : volume
  const rawVolume = bars.map((b) => b.volume ?? NaN);
  const vol = cfg.smoothVol
    ? ta.ema(Series.fromArray(bars, rawVolume), 5).toArray().map((v) => v ?? NaN)
    : rawVolume;

  // Drawings: library objects (bar index x) in the drawing registry, for the counts (a creation above max + 5
  // deletes the oldest until max remain, with the rules of the last bar) and the runtime error of a bar index more
  // than 10,000 bars back; the output data of each object in a list beside them
  resetDrawings({ box: MAX_BOXES, line: MAX_LINES, label: MAX_LABELS });
  const lineData = drawingData<LineDrawingData>(line.all, MAX_LINES);
  const boxData = drawingData<BoxData>(box.all, MAX_BOXES);
  const labelData = drawingData<LabelData>(label.all, MAX_LABELS);
  const lines = { add: (x1: number, x2: number, d: LineDrawingData) => lineData.set(line.new(x1, d.price1, x2, d.price2), d) };
  const boxes = { add: (x1: number, x2: number, d: BoxData) => boxData.set(box.new(x1, d.price1, x2, d.price2), d) };
  const labels = { add: (x: number, d: LabelData) => labelData.set(label.new(x, d.price), d) };

  let zoneStart = 0, tokyoStart = 0, londonStart = 0, nyStart = 0;
  let activeZone = false;
  const vpGreen: number[] = new Array(resolution).fill(0);
  const vpRed: number[] = new Array(resolution).fill(0);
  const zoneBounds: number[] = new Array(resolution).fill(0);
  // bars of the session so far (the lower timeframe arrays of the original: one chart bar each)
  let ltf: number[] = [];

  // ta.highest / ta.lowest call sites (the library throws the runtime error of a window above 15,000 bars)
  const highestSite = callsite.highest();
  const lowestSite = callsite.lowest();
  const fxSites = [callsite.highest(), callsite.highest(), callsite.highest(), callsite.lowest(), callsite.lowest(), callsite.lowest()];
  let prevHigh = NaN, prevLow = NaN; // ta.highest(high, lookback + 1)[1], ta.lowest(low, lookback + 1)[1]
  let prev = { dow: NaN, week: NaN, dom: NaN, year: NaN, month: NaN, hour: NaN };

  /** profileAdd(): spreads one bar over the rows */
  const profileAdd = (o: number, h: number, l: number, c: number, v: number, g: number) => {
    for (let k = 0; k < resolution; k++) {
      const zoneTop = zoneBounds[k];
      const zoneBot = zoneTop - g;
      const bodyTop = Math.max(c, o);
      const bodyBot = Math.min(c, o);
      const itsgreen = ge(c, o);
      const topwick = h - bodyTop;
      const bottomwick = bodyBot - l;
      const body = bodyTop - bodyBot;
      const denom = 2 * topwick + 2 * bottomwick + body;
      const bodyvol = (body * v) / denom;
      const topwickvol = (2 * topwick * v) / denom;
      const bottomwickvol = (2 * bottomwick * v) / denom;
      const bodyPart = getVol(zoneBot, zoneTop, bodyBot, bodyTop, body, bodyvol);
      const topPart = getVol(zoneBot, zoneTop, bodyTop, h, topwick, topwickvol) / 2;
      const bottomPart = getVol(zoneBot, zoneTop, bodyBot, l, bottomwick, bottomwickvol) / 2;
      vpGreen[k] = vpGreen[k] + (itsgreen ? bodyPart : 0) + topPart + bottomPart;
      vpRed[k] = vpRed[k] + (itsgreen ? 0 : bodyPart) + topPart + bottomPart;
    }
  };

  /** pocLevel(): middle of the row with the most volume; na when it is the last row */
  const pocLevel = () => {
    let maxVol = 0;
    let levelInd = 0;
    for (let k = 0; k < resolution; k++) {
      if (gt(vpRed[k] + vpGreen[k], maxVol)) {
        maxVol = vpRed[k] + vpGreen[k];
        levelInd = k;
      }
    }
    return levelInd !== resolution - 1 ? zoneBounds[levelInd] - (zoneBounds[levelInd] - zoneBounds[levelInd + 1]) / 2 : NaN;
  };

  /** valueLevels(): [val, vah] */
  const valueLevels = (poc: number, profHigh: number, profLow: number): [number, number] => {
    const gap = (profHigh - profLow) / resolution;
    const volSum = (array.sum(vpRed) as number) + (array.sum(vpGreen) as number);
    let volCnt = 0;
    let vah = profHigh;
    let val = profLow;
    let pocInd = 0;
    for (let k = 0; k <= resolution - 2; k++) {
      if (ge(zoneBounds[k], poc) && lt(zoneBounds[k + 1], poc)) pocInd = k;
    }
    const limit = volSum * (cfg.VAwid / 100);
    volCnt += vpRed[pocInd] + vpGreen[pocInd];
    for (let k = 1; k <= resolution; k++) {
      if (pocInd + k >= 0 && pocInd + k < resolution) {
        volCnt += vpRed[pocInd + k] + vpGreen[pocInd + k];
        if (ge(volCnt, limit)) break;
        else val = zoneBounds[pocInd + k] - gap;
      }
      if (pocInd - k >= 0 && pocInd - k < resolution) {
        volCnt += vpRed[pocInd - k] + vpGreen[pocInd - k];
        if (ge(volCnt, limit)) break;
        else vah = zoneBounds[pocInd - k];
      }
    }
    return [val, vah];
  };

  /** drawNewZone() / drawCurZone(): the drawings of one session, on bar i */
  const drawZone = (i: number, lookback: number, profHigh: number, profLow: number) => {
    const gap = (profHigh - profLow) / resolution;
    // bar_index[lookback] and bar_index[int(lookback / 1.4)]
    const leftMax = i - lookback;
    const rightMax = i - Math.trunc(lookback / 1.4);
    const rightMaxVol = (array.max(vpGreen) as number) + (array.max(vpRed) as number);
    const buffer = gap / 10;
    const tLeft = timeOf(leftMax);
    const tEnd = timeOf(i - 1);
    if (cfg.showLabels) {
      const x = Math.trunc((i - 1 + leftMax) / 2);
      labels.add(x, { time: timeOf(x), price: profHigh, text: cfg.sessionType, color: NO_COLOR, textColor: CHART_FG_COLOR });
    }
    if (cfg.showProf) {
      for (let k = 0; k < resolution; k++) {
        const greenEnd = Math.trunc(leftMax + (rightMax - leftMax) * (vpGreen[k] / rightMaxVol));
        const redEnd = Math.trunc(greenEnd + (rightMax - leftMax) * (vpRed[k] / rightMaxVol));
        const top = zoneBounds[k] - buffer;
        const bottom = zoneBounds[k] - gap + buffer;
        boxes.add(leftMax, greenEnd,
          { time1: tLeft, price1: top, time2: timeOf(greenEnd), price2: bottom, bgColor: cfg.bullCol, borderWidth: 0 });
        if (cfg.dispMode === 'Mode 2') {
          boxes.add(greenEnd, redEnd,
            { time1: timeOf(greenEnd), price1: top, time2: timeOf(redEnd), price2: bottom, bgColor: cfg.bearCol, borderWidth: 0 });
        } else if (cfg.dispMode !== 'Mode 1') {
          boxes.add(leftMax - redEnd + greenEnd, leftMax, {
            time1: timeOf(leftMax - redEnd + greenEnd), price1: top, time2: tLeft, price2: bottom, bgColor: cfg.bearCol,
            borderWidth: 0,
          });
        }
      }
    }
    boxes.add(leftMax, i - 1, {
      time1: tLeft, price1: profHigh, time2: tEnd, price2: profLow, borderColor: CHART_FG_COLOR,
      borderWidth: Math.trunc(cfg.boxWid), borderStyle: 'dashed', bgColor: cfg.boxBg,
    });
    const poc = pocLevel();
    const [val, vah] = valueLevels(poc, profHigh, profLow);
    if (cfg.showPoc) {
      lines.add(leftMax, i - 1, { time1: tLeft, price1: poc, time2: tEnd, price2: poc, color: cfg.pocCol, width: Math.trunc(cfg.pocWid) });
    }
    if (cfg.showVA) {
      lines.add(leftMax, i - 1, { time1: tLeft, price1: vah, time2: tEnd, price2: vah, color: cfg.vahCol, width: Math.trunc(cfg.vahWid) });
      lines.add(leftMax, i - 1, { time1: tLeft, price1: val, time2: tEnd, price2: val, color: cfg.valCol, width: Math.trunc(cfg.valWid) });
    }
    if (cfg.showVAb) {
      boxes.add(leftMax, i - 1, { time1: tLeft, price1: vah, time2: tEnd, price2: val, borderColor: VA_BOX_BORDER, bgColor: cfg.VAbCol });
    }
  };

  /** drawForexBox() */
  const drawForexBox = (i: number, startBar: number, title: string, top: number, bottom: number) => {
    boxes.add(startBar, i - 1, {
      time1: timeOf(startBar), price1: top, time2: timeOf(i - 1), price2: bottom, borderColor: CHART_FG_COLOR,
      borderWidth: Math.trunc(cfg.boxWid), borderStyle: 'dashed', bgColor: cfg.boxBg,
    });
    if (cfg.showLabels) {
      const x = Math.trunc((i - 1 + startBar) / 2);
      labels.add(x, { time: timeOf(x), price: top, text: title, color: NO_COLOR, textColor: CHART_FG_COLOR });
    }
  };

  try {
    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const tMs = inMs ? bar.time : bar.time * 1000;
      const last = i === n - 1;
      setDrawingBar(i, last);
      const lookback = i - zoneStart;
      // profHigh = ta.highest(high, lookback + 1)[1], profLow = ta.lowest(low, lookback + 1)[1]
      const profHigh = prevHigh;
      const profLow = prevLow;
      prevHigh = highestSite(bar.high, lookback + 1, i);
      prevLow = lowestSite(bar.low, lookback + 1, i);

      // Session starts: calendar fields in the exchange time zone
      const cur = {
        dow: pineTime.dayofweek(tMs, tz), week: pineTime.weekofyear(tMs, tz), dom: pineTime.dayofmonth(tMs, tz),
        year: pineTime.year(tMs, tz), month: pineTime.month(tMs, tz),
        // utcHour = hour(time(timeframe.period, '0000-2400', 'GMT'), 'GMT')
        hour: pineTime.hour(sessionTime(tMs), 'GMT'),
      };
      const has = i > 0;
      const newDaily = has && cur.dow !== prev.dow;
      const newWeekly = has && cur.week !== prev.week;
      const newMonthly = has && cur.dom !== prev.dom + 1 && cur.dom !== prev.dom;
      const newYearly = has && cur.year !== prev.year;
      const newQuarterly = has && cur.month !== prev.month && (cur.month - 1) % 3 === 0;
      const newTokyo = has && cur.hour !== prev.hour + 1 && cur.hour !== prev.hour;
      const endTokyo = has && cur.hour >= 9 && prev.hour < 9;
      const newLondon = has && cur.hour >= 7 && prev.hour < 7;
      const endLondon = has && cur.hour >= 16 && prev.hour < 16;
      const newNewYork = has && cur.hour >= 13 && prev.hour < 13;
      const endNewYork = has && cur.hour >= 22 && prev.hour < 22;
      prev = cur;

      let newSession: boolean;
      let zoneEnd: boolean;
      switch (cfg.sessionType) {
        case 'Tokyo': newSession = newTokyo; zoneEnd = endTokyo; break;
        case 'London': newSession = newLondon; zoneEnd = endLondon; break;
        case 'New York': newSession = newNewYork; zoneEnd = endNewYork; break;
        case 'Weekly': newSession = zoneEnd = newWeekly; break;
        case 'Monthly': newSession = zoneEnd = newMonthly; break;
        case 'Yearly': newSession = zoneEnd = newYearly; break;
        case 'Quarterly': newSession = zoneEnd = newQuarterly; break;
        default: newSession = zoneEnd = newDaily;
      }

      // calcSession(zoneEnd or (barstate.islast and showCur)): bar_index > lookback is zoneStart > 0
      const update = zoneEnd || (last && cfg.showCur);
      vpGreen.fill(0);
      vpRed.fill(0);
      if (zoneStart > 0 && update) {
        const gap = (profHigh - profLow) / resolution;
        for (let k = 0; k < resolution; k++) zoneBounds[k] = profHigh - gap * k;
        for (const j of ltf) profileAdd(bars[j].open, bars[j].high, bars[j].low, bars[j].close, vol[j], gap);
      }
      const hasVolume = () => gt((array.sum(vpGreen) as number) + (array.sum(vpRed) as number), 0);
      // drawNewZone(zoneEnd)
      if (zoneStart > 0 && zoneEnd && hasVolume()) drawZone(i, lookback, profHigh, profLow);
      // drawCurZone(barstate.islast and not zoneEnd and showCur and activeZone, zoneEnd): the session in progress. Its
      // delete branch only removes drawings of an earlier call, and there is none in one pass over the bars
      if (last && !zoneEnd && cfg.showCur && activeZone && zoneStart > 0 && hasVolume()) drawZone(i, lookback, profHigh, profLow);

      // resetProfile(newSession), updateIntra()
      if (newSession) {
        vpGreen.fill(0);
        vpRed.fill(0);
        ltf = [];
      }
      ltf.push(i);

      if (zoneEnd) activeZone = false;
      if (newSession) {
        zoneStart = i;
        activeZone = true;
      }
      if (newLondon) londonStart = i;
      if (newTokyo) tokyoStart = i;
      if (newNewYork) nyStart = i;

      // londonHigh = ta.highest(high, bar_index - londonStart + 1) ...: computed on every bar, as in the original (the
      // library throws when a session does not start for 15,000 bars)
      const lenLondon = i - londonStart + 1;
      const lenTokyo = i - tokyoStart + 1;
      const lenNy = i - nyStart + 1;
      const londonHigh = fxSites[0](bar.high, lenLondon, i);
      const tokyoHigh = fxSites[1](bar.high, lenTokyo, i);
      const nyHigh = fxSites[2](bar.high, lenNy, i);
      const londonLow = fxSites[3](bar.low, lenLondon, i);
      const tokyoLow = fxSites[4](bar.low, lenTokyo, i);
      const nyLow = fxSites[5](bar.low, lenNy, i);
      if (cfg.showFx) {
        if (endLondon) drawForexBox(i, londonStart, 'London', londonHigh, londonLow);
        if (endNewYork) drawForexBox(i, nyStart, 'New York', nyHigh, nyLow);
        if (endTokyo) drawForexBox(i, tokyoStart, 'Tokyo', tokyoHigh, tokyoLow);
      }
    }
  } finally {
    setDrawingBar(null);
  }

  // The live objects; a line with an na price (no point of control) is an object of the script but is not drawn
  const drawn = lineData.live().filter((l) => Number.isFinite(l.price1) && Number.isFinite(l.price2));
  const liveBoxes = boxData.live();
  const liveLabels = labelData.live();
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: drawn,
    boxes: liveBoxes,
    labels: liveLabels,
  };
}

export const MarketSessionsVolumeProfile = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
