/**
 * TMA Overlay
 *
 * Four smoothed moving averages of the close (21, 50, 100 and 200 bars; each starts with the SMA and then follows
 * (previous * (length - 1) + close) / length), with a fill between a hidden EMA(2) and the 200 SMMA: green when the
 * EMA is above, red when it is below. "3 Line Strike" triangles: three candles in one direction followed by a close
 * beyond the open of the previous candle. "Big candle" triangles: an engulfing candle (open beyond the previous
 * close and open, close beyond the previous open). Two background colours mark a trade session: from the analysis
 * start to the session end, and from the session start to the session end, in the time zone of the inputs, on the
 * chosen week days.
 *
 * The session is tested on the opening time of each bar, with the date of that bar in the chosen time zone. The
 * "Label" input is not used by the original script. The options "Asia/Sydney" and "Europe/Frankfurt" are not time
 * zone names: they throw the runtime error of the original script.
 *
 * Reference: "TMA Overlay" by ArtyFXC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, time, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface TmaOverlayInputs {
  show100: boolean;
  trendFill: boolean;
  showBearStrike: boolean;
  showBullStrike: boolean;
  showBearEngulfing: boolean;
  showBullEngulfing: boolean;
  showSession: boolean;
  timezone: 'Asia/Sydney' | 'Asia/Tokyo' | 'Europe/Frankfurt' | 'Europe/London' | 'UTC' | 'America/New_York' | 'America/Chicago';
  /** For easy identification (not used in the computation) */
  label: string;
  startHour: number;
  startMinute: number;
  sessionStartHour: number;
  sessionStartMinute: number;
  sessionEndHour: number;
  sessionEndMinute: number;
  rangeColor: string;
  showMon: boolean;
  showTue: boolean;
  showWed: boolean;
  showThu: boolean;
  showFri: boolean;
  showSat: boolean;
  showSun: boolean;
}

export const defaultInputs: TmaOverlayInputs = {
  show100: true,
  trendFill: true,
  showBearStrike: true,
  showBullStrike: true,
  showBearEngulfing: true,
  showBullEngulfing: true,
  showSession: true,
  timezone: 'America/Chicago',
  label: 'CME Open',
  startHour: 7,
  startMinute: 0,
  sessionStartHour: 8,
  sessionStartMinute: 30,
  sessionEndHour: 12,
  sessionEndMinute: 0,
  rangeColor: '#1976D21F',
  showMon: true,
  showTue: true,
  showWed: true,
  showThu: true,
  showFri: true,
  showSat: false,
  showSun: false,
};

const MA_GROUP = 'Smoothed MA Inputs';
const STRIKE_GROUP = '3 Line Strike';
const CANDLE_GROUP = 'Big A$$ Candles';
const SESSION_GROUP = 'Trade Session';

export const inputConfig: InputConfig[] = [
  { id: 'show100', type: 'bool', title: 'Show 100 Line', defval: true, group: MA_GROUP },
  { id: 'trendFill', type: 'bool', title: 'Show Trend Fill', defval: true, group: MA_GROUP },
  { id: 'showBearStrike', type: 'bool', title: 'Show Bearish 3 Line Strike', defval: true, group: STRIKE_GROUP },
  { id: 'showBullStrike', type: 'bool', title: 'Show Bullish 3 Line Strike', defval: true, group: STRIKE_GROUP },
  { id: 'showBearEngulfing', type: 'bool', title: 'Show Bearish Big A$$ Candles', defval: true, group: CANDLE_GROUP },
  { id: 'showBullEngulfing', type: 'bool', title: 'Show Bullish Big A$$ Candles', defval: true, group: CANDLE_GROUP },
  { id: 'showSession', type: 'bool', title: 'Show Trade Session', defval: true, group: SESSION_GROUP },
  {
    id: 'timezone', type: 'string', title: 'Timezone', defval: 'America/Chicago', group: SESSION_GROUP,
    options: ['Asia/Sydney', 'Asia/Tokyo', 'Europe/Frankfurt', 'Europe/London', 'UTC', 'America/New_York', 'America/Chicago'],
  },
  { id: 'label', type: 'string', title: 'Label', defval: 'CME Open', group: SESSION_GROUP, tooltip: 'For easy identification' },
  { id: 'startHour', type: 'int', title: 'analysis Start hour', defval: 7, min: 0, max: 23, group: SESSION_GROUP },
  { id: 'startMinute', type: 'int', title: 'analysis Start minute', defval: 0, min: 0, max: 59, group: SESSION_GROUP },
  { id: 'sessionStartHour', type: 'int', title: 'Session Start hour', defval: 8, min: 0, max: 23, group: SESSION_GROUP },
  { id: 'sessionStartMinute', type: 'int', title: 'Session Start minute', defval: 30, min: 0, max: 59, group: SESSION_GROUP },
  { id: 'sessionEndHour', type: 'int', title: 'Session End hour', defval: 12, min: 0, max: 23, group: SESSION_GROUP },
  { id: 'sessionEndMinute', type: 'int', title: 'Session End minute', defval: 0, min: 0, max: 59, group: SESSION_GROUP },
  { id: 'rangeColor', type: 'color', title: 'Color', defval: '#1976D21F', group: SESSION_GROUP },
  { id: 'showMon', type: 'bool', title: 'Monday', defval: true, group: SESSION_GROUP },
  { id: 'showTue', type: 'bool', title: 'Tuesday', defval: true, group: SESSION_GROUP },
  { id: 'showWed', type: 'bool', title: 'Wednesday', defval: true, group: SESSION_GROUP },
  { id: 'showThu', type: 'bool', title: 'Thursday', defval: true, group: SESSION_GROUP },
  { id: 'showFri', type: 'bool', title: 'Friday', defval: true, group: SESSION_GROUP },
  { id: 'showSat', type: 'bool', title: 'Saturday', defval: false, group: SESSION_GROUP },
  { id: 'showSun', type: 'bool', title: 'Sunday', defval: false, group: SESSION_GROUP },
];

// Colours of the original script version
const GREEN = '#4CAF50';
const RED = '#FF5252';
/** Default text colour of a shape (blue of the original script version) */
const BLUE = '#2196F3';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '21 SMMA', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot1', title: '50 SMMA', color: '#6AFF00', lineWidth: 2 },
  { id: 'plot2', title: '100 SMMA', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot3', title: '200 SMMA', color: '#FF0500', lineWidth: 2 },
  // plot(ema2, color = #2ecc71, transp = 100, editable = false): a fully transparent line, used by the fill
  { id: 'plot4', title: 'EMA(2)', color: String(color.new('#2ECC71', 100)), lineWidth: 1 },
];

export const metadata = {
  title: 'TMA Overlay',
  shortTitle: 'TMA Overlay',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<TmaOverlayInputs> = {},
): Omit<IndicatorResult, 'markers' | 'bgColors'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closeSeries = new Series(bars, (b) => b.close);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // smma := na(smma[1]) ? sma(close, len) : (smma[1] * (len - 1) + close) / len
  const smma = (len: number): number[] => {
    const sma = A(ta.sma(closeSeries, len));
    const out: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? out[i - 1] : NaN;
      out[i] = isNaN(prev) ? sma[i] : (prev * (len - 1) + bars[i].close) / len;
    }
    return out;
  };
  const smma1 = smma(21);
  const smma2 = smma(50);
  const smma3 = smma(100);
  const smma4 = smma(200);
  const ema2 = A(ta.ema(closeSeries, 2));

  const t = (i: number) => bars[i].time;
  const line = (v: number[], on = true) => v.map((x, i) => ({ time: t(i), value: on ? x : NaN }));
  const plots = {
    plot0: line(smma1),
    plot1: line(smma2),
    plot2: line(smma3, cfg.show100),
    plot3: line(smma4),
    plot4: line(ema2),
  };

  // fill(ema2plot, sma4plot, ema2 > smma4 and trendFill ? green : ema2 < smma4 and trendFill ? red : na, transp = 85)
  const fillUp = String(color.new(GREEN, 85));
  const fillDown = String(color.new(RED, 85));
  const fillColors = bars.map((_b, i) => (cfg.trendFill && gt(ema2[i], smma4[i]) ? fillUp
    : cfg.trendFill && lt(ema2[i], smma4[i]) ? fillDown : 'transparent'));

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const O = (i: number) => (i >= 0 ? bars[i].open : NaN);
  const C = (i: number) => (i >= 0 ? bars[i].close : NaN);
  const tz = cfg.timezone;
  // year(time, tz) runs on every bar, also when the session is not shown: a name that is not a time zone
  // ("Asia/Sydney" and "Europe/Frankfurt" of the options list) is a runtime error of the original script
  if (n > 0) {
    try {
      time.year(bars[0].time * 1000, tz);
    } catch {
      throw new Error(`Incorrect \`timezone\` value for the year() function: "${tz}". The value must be a string in either `
        + 'UTC/GMT notation (e.g. "UTC-5", "GMT+0530") or an IANA time zone database name (e.g. "America/New_York").');
    }
  }
  for (let i = 0; i < n; i++) {
    // 3 Line Strike
    const bearSig = gt(C(i - 3), O(i - 3)) && gt(C(i - 2), O(i - 2)) && gt(C(i - 1), O(i - 1)) && lt(C(i), O(i - 1));
    const bullSig = lt(C(i - 3), O(i - 3)) && lt(C(i - 2), O(i - 2)) && lt(C(i - 1), O(i - 1)) && gt(C(i), O(i - 1));
    if (cfg.showBullStrike && bullSig) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small', text: '3s-Bull', textColor: BLUE });
    }
    if (cfg.showBearStrike && bearSig) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small', text: '3s-Bear', textColor: BLUE });
    }
    // Engulfing candles
    const bullishEngulfing = le(O(i), C(i - 1)) && lt(O(i), O(i - 1)) && gt(C(i), O(i - 1));
    const bearishEngulfing = ge(O(i), C(i - 1)) && gt(O(i), O(i - 1)) && lt(C(i), O(i - 1));
    if (cfg.showBullEngulfing && bullishEngulfing) {
      markers.push({ time: t(i), position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'tiny' });
    }
    if (cfg.showBearEngulfing && bearishEngulfing) {
      markers.push({ time: t(i), position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'tiny' });
    }

    // Trade session: the bar time against times of the same day in the time zone
    if (!cfg.showSession) continue;
    const ms = t(i) * 1000;
    const y = time.year(ms, tz);
    const mo = time.month(ms, tz);
    const d = time.dayofmonth(ms, tz);
    const dow = time.dayofweek(ms, tz); // 1 = Sunday ... 7 = Saturday
    const dayOn = [cfg.showSun, cfg.showMon, cfg.showTue, cfg.showWed, cfg.showThu, cfg.showFri, cfg.showSat][dow - 1];
    if (!dayOn) continue;
    const endTime = time.timestamp(tz, y, mo, d, cfg.sessionEndHour, cfg.sessionEndMinute);
    const startTime = time.timestamp(tz, y, mo, d, cfg.startHour, cfg.startMinute);
    const startTime2 = time.timestamp(tz, y, mo, d, cfg.sessionStartHour, cfg.sessionStartMinute);
    // Two bgcolor calls with the same colour: the second is drawn on top of the first
    if (startTime <= ms && ms <= endTime) bgColors.push({ time: t(i), color: cfg.rangeColor });
    if (startTime2 <= ms && ms <= endTime) bgColors.push({ time: t(i), color: cfg.rangeColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [{ plot1: 'plot4', plot2: 'plot3', options: { title: 'Trend Fill' }, colors: fillColors }],
    markers,
    bgColors,
  };
}

export const TmaOverlay = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
