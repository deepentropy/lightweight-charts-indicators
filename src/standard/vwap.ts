/**
 * Volume Weighted Average Price (VWAP)
 *
 * Cumulative volume-weighted average of the source (ta.vwap), restarted on each new anchor period, with up to three
 * pairs of bands around it:
 *
 *   vwap   = sum(volume * src) / sum(volume)                    (since the last anchor bar)
 *   stdev  = sqrt( sum(volume*src^2)/sum(volume) - vwap^2 )
 *   basis  = stdev ('Standard Deviation') or vwap * 1% ('Percentage')
 *   band k = vwap +/- basis * multiplier k
 *
 * Bands #1 are shown by default; each band pair has its fill (green / olive / teal, 95% transparency). A hidden band
 * keeps its values (as the original): its plots are hidden through `visible` (= showBandK) and its fill is left out.
 * 'Hide VWAP on 1D or Above' gives na on daily, weekly and monthly bars (the chart timeframe of the chart context,
 * the optional third argument of calculate; without it the bar interval, the most frequent gap between two bars,
 * is one day or more). Offset shifts every plot by that number of bars.
 *
 * Anchor periods: the original resets on timeframe.change("D" / "W" / "M" / "3M" / "12M") in the exchange time zone,
 * Decade / Century on a new year divisible by 10 / 100, and always on the first bar. With the time zone and the
 * session of the chart context the periods are those of the exchange calendar (see src/anchor-period.ts) and the
 * year is read in the exchange time zone. Without them the port takes the calendar of the bar time in UTC (weeks
 * start on Monday): exact on daily and higher bars and on UTC 24x7 symbols; on intraday bars whose trading day
 * differs from the UTC day (sessions crossing UTC midnight) the reset bar can differ.
 * Earnings / Dividends / Splits: the original resets on the corporate events of the symbol (request.earnings /
 * dividends / splits) and never on the first bar. The bars carry no such events, so the port has no anchor bar and
 * the VWAP and bands are na on every bar, as the original gives on a symbol without these events.
 *
 * Based on the standard "Volume Weighted Average Price" indicator.
 */

import { barInterval, barTime, chartSessions, periodTime, time as pineTime, timeframe as pineTimeframe, type SessionContext, type FillData, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

import { calendarOf, hasCalendar, periodStarts, chartTimeframe } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VWAPAnchor = 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';

export interface VWAPInputs {
  /** Hide VWAP on 1D or Above (na on daily, weekly and monthly bars) */
  hideOnDWM: boolean;
  /** Anchor period: the sums restart on each new period */
  anchor: VWAPAnchor;
  src: SourceType;
  /** Plot offset in bars */
  offset: number;
  /** Bands distance unit: standard deviations, or percent of the VWAP */
  calcMode: 'Standard Deviation' | 'Percentage';
  showBand1: boolean;
  bandMult1: number;
  showBand2: boolean;
  bandMult2: number;
  showBand3: boolean;
  bandMult3: number;
}

export const defaultInputs: VWAPInputs = {
  hideOnDWM: false,
  anchor: 'Session',
  src: 'hlc3',
  offset: 0,
  calcMode: 'Standard Deviation',
  showBand1: true,
  bandMult1: 1.0,
  showBand2: false,
  bandMult2: 2.0,
  showBand3: false,
  bandMult3: 3.0,
};

const CALC_MODE_TOOLTIP = "Determines the units used to calculate the distance of the bands. When 'Percentage' is selected, a multiplier of 1 means 1%.";

export const inputConfig: InputConfig[] = [
  { id: 'hideOnDWM', type: 'bool', title: 'Hide VWAP on 1D or Above', defval: false, group: 'VWAP Settings', display: 'none' },
  { id: 'anchor', type: 'string', title: 'Anchor Period', defval: 'Session', options: ['Session', 'Week', 'Month', 'Quarter', 'Year', 'Decade', 'Century', 'Earnings', 'Dividends', 'Splits'], group: 'VWAP Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3', group: 'VWAP Settings', display: 'none' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, group: 'VWAP Settings', display: 'none' },
  { id: 'calcMode', type: 'string', title: 'Bands Calculation Mode', defval: 'Standard Deviation', options: ['Standard Deviation', 'Percentage'], group: 'Bands Settings', tooltip: CALC_MODE_TOOLTIP, display: 'none' },
  { id: 'showBand1', type: 'bool', title: '', defval: true, group: 'Bands Settings', inline: 'band_1', display: 'none' },
  { id: 'bandMult1', type: 'float', title: 'Bands Multiplier #1', defval: 1.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_1', display: 'none', active: 'showBand1' },
  { id: 'showBand2', type: 'bool', title: '', defval: false, group: 'Bands Settings', inline: 'band_2', display: 'none' },
  { id: 'bandMult2', type: 'float', title: 'Bands Multiplier #2', defval: 2.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_2', display: 'none', active: 'showBand2' },
  { id: 'showBand3', type: 'bool', title: '', defval: false, group: 'Bands Settings', inline: 'band_3', display: 'none' },
  { id: 'bandMult3', type: 'float', title: 'Bands Multiplier #3', defval: 3.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_3', display: 'none', active: 'showBand3' },
];

// display = showBandK ? display.all : display.none: PlotConfig `visible` = the showBandK input (result.visibility entry)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band #1', color: '#4CAF50', lineWidth: 1, visible: 'showBand1' },
  { id: 'plot2', title: 'Lower Band #1', color: '#4CAF50', lineWidth: 1, visible: 'showBand1' },
  { id: 'plot3', title: 'Upper Band #2', color: '#808000', lineWidth: 1, visible: 'showBand2' },
  { id: 'plot4', title: 'Lower Band #2', color: '#808000', lineWidth: 1, visible: 'showBand2' },
  { id: 'plot5', title: 'Upper Band #3', color: '#089981', lineWidth: 1, visible: 'showBand3' },
  { id: 'plot6', title: 'Lower Band #3', color: '#089981', lineWidth: 1, visible: 'showBand3' },
];

export const metadata = {
  title: 'Volume Weighted Average Price',
  shortTitle: 'VWAP',
  overlay: true,
};

/** Timeframe of timeframe.change() of each calendar anchor (Decade and Century: a new year) */
const ANCHOR_TIMEFRAME: Partial<Record<VWAPAnchor, string>> = { Session: 'D', Week: 'W', Month: 'M', Quarter: '3M', Year: '12M' };

/** UTC calendar of a bar time (seconds or milliseconds) */
function utcDate(time: number): Date {
  return new Date(time < 1e12 ? time * 1000 : time);
}

/** Key of the anchor period that contains the bar (timeframe.change(tf) = the key changes from the previous bar) */
function periodKey(d: Date, anchor: VWAPAnchor): number {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (anchor) {
    case 'Session': return Math.floor(d.getTime() / 86400000);
    // weeks start on Monday: day number of the Monday of the week
    case 'Week': return Math.floor(d.getTime() / 86400000) - ((d.getUTCDay() + 6) % 7);
    case 'Month': return y * 12 + m;
    case 'Quarter': return y * 4 + Math.floor(m / 3);
    default: return y;
  }
}

type Point = { time: number; value: number };
type Result = IndicatorResult & { visibility: Record<string, boolean> };

interface VwapVars {
  /** Period key of the previous bar */
  prevKey: number;
  /** Sums of ta.vwap since the last anchor bar */
  sumPV: number;
  sumV: number;
  sumPPV: number;
}

interface VwapRun extends BarRunState<VwapVars> {
  /** VWAP and the six bands of each bar */
  values: number[][];
  /** Their points (offset 0) */
  points: Point[][];
}

function study(inputs: Partial<VWAPInputs>): BarStudy<VwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { anchor, offset } = cfg;
  const value = barSource(cfg.src);
  const isEsdAnchor = anchor === 'Earnings' || anchor === 'Dividends' || anchor === 'Splits';
  const tf = ANCHOR_TIMEFRAME[anchor] ?? '12M';
  const mults = [cfg.bandMult1, cfg.bandMult2, cfg.bandMult3];
  /** Set by init: the exchange calendar, the time zone and the hidden state (they read the chart and the bars) */
  let calendar: { chart: SessionContext; unit: number } | null = null;
  let timezone = timezoneOf({});
  /** The year in the exchange time zone with the calendar of the context */
  let exchangeYear = false;
  let hidden = false;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    key: (bars, c) => {
      const n = bars.length;
      return `${n > 0}|${n > 0 && bars[0].time < 1e12}|${barInterval(bars)}|${hasCalendar(c) ? chartTimeframe(bars, c) : ''}`;
    },
    init(bars, c) {
      calendar = isEsdAnchor ? null : calendarOf(bars, c);
      timezone = timezoneOf(c);
      exchangeYear = !isEsdAnchor && hasCalendar(c);
      // timeframe.isdwm: the chart timeframe of the context, else the bar interval is one day or more
      const n = bars.length;
      const interval = barInterval(bars);
      const day = n > 0 && bars[0].time < 1e12 ? 86400 : 86400000;
      const isDwm = c?.timeframe ? pineTimeframe.info(chartTimeframe(bars, c)).isdwm : interval >= day;
      hidden = cfg.hideOnDWM && isDwm;
      const s: VwapRun = {
        values: [[], [], [], [], [], [], []], points: offset === 0 ? [[], [], [], [], [], [], []] : [],
        // na until the first anchor
        vars: { prevKey: NaN, sumPV: NaN, sumV: NaN, sumPPV: NaN },
        steps: [], lists: [], series: [],
      };
      s.series = [...s.values, ...s.points];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      // isNewPeriod: timeframe.change(...) per anchor; Earnings / Dividends / Splits: no event data (never)
      let isNew = false;
      if (!isEsdAnchor) {
        // With the exchange calendar of the chart context: timeframe.change(tf) of the anchor timeframe, and the year
        // in the exchange time zone. Else the UTC calendar of the bar times.
        const d = utcDate(b.time);
        let key: number;
        if (calendar) {
          // periodStarts: time(tf) of the bar; na after an early close: the period of the bar before it
          const t = periodTime(b.time, tf, calendar.chart);
          if (!Number.isNaN(t)) key = t / calendar.unit;
          else key = i > 0 && chartSessions(calendar.chart).bars.stray(b.time * calendar.unit) ? v.prevKey : b.time;
        } else {
          key = periodKey(d, anchor);
        }
        const change = i > 0 && key !== v.prevKey;
        v.prevKey = key;
        isNew = change;
        const year = exchangeYear ? pineTime.year(d.getTime(), timezone) : d.getUTCFullYear();
        if (anchor === 'Decade') isNew = change && year % 10 === 0;
        else if (anchor === 'Century') isNew = change && year % 100 === 0;
        // if na(src[1]) and not isEsdAnchor: isNewPeriod := true
        if (i === 0 || Number.isNaN(value(bars[i - 1]))) isNew = true;
      }

      let vw = NaN;
      const bands = [NaN, NaN, NaN, NaN, NaN, NaN];
      if (!hidden) {
        // [_vwap, _stdevUpper, _] = ta.vwap(src, isNewPeriod, 1)
        const vol = b.volume ?? NaN;
        if (isNew) {
          v.sumPV = src * vol;
          v.sumV = vol;
          v.sumPPV = src * src * vol;
        } else {
          // An na source or volume makes the sums na until the next anchor
          v.sumPV += src * vol;
          v.sumV += vol;
          v.sumPPV += src * src * vol;
        }
        vw = v.sumV === 0 ? NaN : v.sumPV / v.sumV;
        const sd = Math.sqrt(Math.max(0, v.sumPPV / v.sumV - vw * vw));
        const stdevUpper = vw + 1 * sd;
        const stdevAbs = stdevUpper - vw;
        const bandBasis = cfg.calcMode === 'Standard Deviation' ? stdevAbs : vw * 0.01;
        for (let k = 0; k < 3; k++) {
          bands[2 * k] = vw + bandBasis * mults[k];
          bands[2 * k + 1] = vw - bandBasis * mults[k];
        }
      }
      s.values[0][i] = vw;
      for (let k = 0; k < 6; k++) s.values[k + 1][i] = bands[k];
      if (offset === 0) {
        for (let k = 0; k < 7; k++) s.points[k][i] = { time: b.time, value: s.values[k][i] };
      }
    },
    result(s, bars) {
      const n = bars.length;
      // plot(..., offset = offset): the value of bar i is drawn on bar i + offset
      let plots: Point[][];
      if (offset === 0) {
        plots = s.points.map((p) => p.slice());
      } else {
        const interval = barInterval(bars);
        plots = s.values.map((values) => {
          const out: Point[] = [];
          for (let i = 0; i < n; i++) {
            if (i + offset < 0) continue;
            out.push({ time: barTime(bars, i + offset, interval), value: values[i] });
          }
          return out;
        });
      }

      const show = [cfg.showBand1, cfg.showBand2, cfg.showBand3];
      // fill(upperBand_k, lowerBand_k, color.new(<band colour>, 95), display = displayBandK)
      const fills: FillData[] = [
        { plot1: 'plot1', plot2: 'plot2', options: { color: '#4CAF50', transp: 95, title: 'Bands Fill #1' } },
        { plot1: 'plot3', plot2: 'plot4', options: { color: '#808000', transp: 95, title: 'Bands Fill #2' } },
        { plot1: 'plot5', plot2: 'plot6', options: { color: '#089981', transp: 95, title: 'Bands Fill #3' } },
      ].filter((_f, k) => show[k]);

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': plots[0],
          'plot1': plots[1],
          'plot2': plots[2],
          'plot3': plots[3],
          'plot4': plots[4],
          'plot5': plots[5],
          'plot6': plots[6],
        },
        fills,
        visibility: { showBand1: cfg.showBand1, showBand2: cfg.showBand2, showBand3: cfg.showBand3 },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VWAPInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VWAPInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VWAP = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
