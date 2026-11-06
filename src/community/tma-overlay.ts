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
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Engulfing' and 'Bearish Engulfing', true on the bars of
 * an engulfing candle (also when its triangles are not shown).
 *
 * The session is tested on the opening time of each bar, with the date of that bar in the chosen time zone. The
 * "Label" input is not used by the original script. The options "Asia/Sydney" and "Europe/Frankfurt" are not time
 * zone names: they throw the runtime error of the original script.
 *
 * Reference: "TMA Overlay" by ArtyFXC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, time, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers' | 'bgColors'> & { markers: MarkerData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

const SMMA_LENGTHS = [21, 50, 100, 200];

interface TmaRun extends BarRunState<Record<string, never>> {
  smas: ReturnType<typeof taStep.sma>[];
  ema: ReturnType<typeof taStep.ema>;
  /** smma1 .. smma4 of each bar */
  smma: number[][];
  lines: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TmaOverlayInputs>): BarStudy<TmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // fill(ema2plot, sma4plot, ema2 > smma4 and trendFill ? green : ema2 < smma4 and trendFill ? red : na, transp = 85)
  const fillUp = String(color.new(GREEN, 85));
  const fillDown = String(color.new(RED, 85));
  const tz = cfg.timezone;
  const days = [cfg.showSun, cfg.showMon, cfg.showTue, cfg.showWed, cfg.showThu, cfg.showFri, cfg.showSat];
  return {
    init() {
      const smas = SMMA_LENGTHS.map(() => taStep.sma());
      const ema = taStep.ema(2);
      const s: TmaRun = {
        smas, ema, smma: [[], [], [], []], lines: [[], [], [], [], []], fillColors: [], markers: [], bgColors: [],
        flags: [[], []], times: [[], []],
        steps: [...smas, ema], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [...s.smma, ...s.lines, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time0 = b.time;
      // year(time, tz) runs on every bar, also when the session is not shown: a name that is not a time zone
      // ("Asia/Sydney" and "Europe/Frankfurt" of the options list) is a runtime error of the original script
      if (i === 0) {
        try {
          time.year(b.time * 1000, tz);
        } catch {
          throw new Error(`Incorrect \`timezone\` value for the year() function: "${tz}". The value must be a string in either `
            + 'UTC/GMT notation (e.g. "UTC-5", "GMT+0530") or an IANA time zone database name (e.g. "America/New_York").');
        }
      }
      // smma := na(smma[1]) ? sma(close, len) : (smma[1] * (len - 1) + close) / len
      for (let k = 0; k < 4; k++) {
        const len = SMMA_LENGTHS[k];
        const out = s.smma[k];
        const sma = s.smas[k].step(b.close, len);
        const prev = i > 0 ? out[i - 1] : NaN;
        out[i] = isNaN(prev) ? sma : (prev * (len - 1) + b.close) / len;
      }
      const ema2 = s.ema.step(b.close);
      const smma4 = s.smma[3][i];
      s.lines[0][i] = { time: time0, value: s.smma[0][i] };
      s.lines[1][i] = { time: time0, value: s.smma[1][i] };
      s.lines[2][i] = { time: time0, value: cfg.show100 ? s.smma[2][i] : NaN };
      s.lines[3][i] = { time: time0, value: smma4 };
      s.lines[4][i] = { time: time0, value: ema2 };
      s.fillColors[i] = cfg.trendFill && gt(ema2, smma4) ? fillUp : cfg.trendFill && lt(ema2, smma4) ? fillDown : 'transparent';

      const O = (j: number) => (j >= 0 ? bars[j].open : NaN);
      const C = (j: number) => (j >= 0 ? bars[j].close : NaN);
      // 3 Line Strike
      const bearSig = gt(C(i - 3), O(i - 3)) && gt(C(i - 2), O(i - 2)) && gt(C(i - 1), O(i - 1)) && lt(C(i), O(i - 1));
      const bullSig = lt(C(i - 3), O(i - 3)) && lt(C(i - 2), O(i - 2)) && lt(C(i - 1), O(i - 1)) && gt(C(i), O(i - 1));
      if (cfg.showBullStrike && bullSig) {
        s.markers.push({ time: time0, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small', text: '3s-Bull', textColor: BLUE });
      }
      if (cfg.showBearStrike && bearSig) {
        s.markers.push({ time: time0, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small', text: '3s-Bear', textColor: BLUE });
      }
      // Engulfing candles
      const bullishEngulfing = le(O(i), C(i - 1)) && lt(O(i), O(i - 1)) && gt(C(i), O(i - 1));
      const bearishEngulfing = ge(O(i), C(i - 1)) && gt(O(i), O(i - 1)) && lt(C(i), O(i - 1));
      s.flags[0][i] = bullishEngulfing;
      s.flags[1][i] = bearishEngulfing;
      if (bullishEngulfing) s.times[0].push(time0 as number);
      if (bearishEngulfing) s.times[1].push(time0 as number);
      if (cfg.showBullEngulfing && bullishEngulfing) {
        s.markers.push({ time: time0, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'tiny' });
      }
      if (cfg.showBearEngulfing && bearishEngulfing) {
        s.markers.push({ time: time0, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'tiny' });
      }

      // Trade session: the bar time against times of the same day in the time zone
      if (!cfg.showSession) return;
      const ms = time0 * 1000;
      const y = time.year(ms, tz);
      const mo = time.month(ms, tz);
      const d = time.dayofmonth(ms, tz);
      const dow = time.dayofweek(ms, tz); // 1 = Sunday ... 7 = Saturday
      const dayOn = days[dow - 1];
      if (!dayOn) return;
      const endTime = time.timestamp(tz, y, mo, d, cfg.sessionEndHour, cfg.sessionEndMinute);
      const startTime = time.timestamp(tz, y, mo, d, cfg.startHour, cfg.startMinute);
      const startTime2 = time.timestamp(tz, y, mo, d, cfg.sessionStartHour, cfg.sessionStartMinute);
      // Two bgcolor calls with the same colour (ids bgcolor0 / bgcolor1): the second is drawn on top of the first
      if (startTime <= ms && ms <= endTime) s.bgColors.push({ id: 'bgcolor0', time: time0, color: cfg.rangeColor });
      if (startTime2 <= ms && ms <= endTime) s.bgColors.push({ id: 'bgcolor1', time: time0, color: cfg.rangeColor });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0].slice(),
          plot1: s.lines[1].slice(),
          plot2: s.lines[2].slice(),
          plot3: s.lines[3].slice(),
          plot4: s.lines[4].slice(),
        },
        fills: [{ plot1: 'plot4', plot2: 'plot3', options: { title: 'Trend Fill' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(bullishEngulfing, "Bullish Engulfing") / alertcondition(bearishEngulfing, "Bearish Engulfing")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TmaOverlayInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TmaOverlayInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Engulfing', message: '[CurrencyPair] [TimeFrame], Bullish candle engulfing previous candle' },
  { id: 'alert1', title: 'Bearish Engulfing', message: '[CurrencyPair] [TimeFrame], Bearish candle engulfing previous candle' },
];

export const TmaOverlay = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
