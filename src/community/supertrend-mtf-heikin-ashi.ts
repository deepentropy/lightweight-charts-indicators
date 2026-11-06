/**
 * Supertrend MTF Heikin Ashi
 *
 * Two Supertrend lines computed on Heikin Ashi bars: one on the chart timeframe (bands at the Heikin Ashi hl2 -+
 * ATR Factor * the ATR of the Heikin Ashi bars, trend flips when the Heikin Ashi close crosses the band of the bar
 * before) and one on a higher timeframe. The higher timeframe values are those of the previous completed Heikin Ashi
 * bar of that timeframe (`high[1]` with lookahead, no repaint); its trend logic runs on the chart bars. Circles mark
 * the trend changes of the higher timeframe line. The line colour is na on the bar of a trend change.
 *
 * Higher timeframe "Auto": 1 -> 5, 3 / 5 -> 15, 15 -> 60, 30 / 45 -> 120, 60 -> 240, 120 / 180 -> 240, 240 -> D,
 * D -> W, W -> 5W, else D. The Heikin Ashi bars of the higher timeframe are built from the chart bars (periods of
 * the exchange calendar of the chart context, else the UTC rule of anchor-period.ts). A timeframe below the chart
 * timeframe needs lower-timeframe data: the port throws an Error.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Supertrend Trend Up' / 'Supertrend  Trend Down' on the trend
 * changes of the chart timeframe line, 'Supertrend HTF Trend Up' / 'Supertrend HTF Trend Down' on those of the higher
 * timeframe line.
 *
 * Reference: "Supertrend MTF Heikin Ashi" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { taCore, taStep, timeframe, heikinAshi, mapToChart, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupertrendMtfHeikinAshiInputs {
  /** HTF Method: the higher timeframe from the chart timeframe ("Auto") or the timeframe input */
  mode: 'Auto' | 'User Defined';
  /** Higher timeframe when the method is "User Defined" */
  htfUser: string;
  /** ATR factor */
  mult: number;
  /** ATR period */
  period: number;
}

export const defaultInputs: SupertrendMtfHeikinAshiInputs = {
  mode: 'Auto',
  htfUser: '5',
  mult: 2.0,
  period: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'HTF Method', defval: 'Auto', options: ['Auto', 'User Defined'] },
  { id: 'htfUser', type: 'timeframe', title: 'Time Frame (if HTF Method=User Defined)', defval: '5' },
  { id: 'mult', type: 'float', title: 'ATR Factor', defval: 2.0, min: 0.5, max: 100, step: 0.1 },
  { id: 'period', type: 'int', title: 'ATR Period', defval: 7, min: 1, max: 100 },
];

const LIME = '#00E676';
const RED = '#FF5252';
const BLUE = '#2196F3';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: LIME, lineWidth: 2 },
  { id: 'plot1', title: 'Supertrend HTF', color: BLUE, lineWidth: 3 },
  { id: 'plot2', title: 'Supertrend HTF Trend Up', color: BLUE, lineWidth: 4, style: 'circles' },
  { id: 'plot3', title: 'Supertrend HTF Trend Down', color: RED, lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Supertrend MTF Heikin Ashi',
  shortTitle: 'Supertrend MTF Heikin Ashi',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** v4 `timeframe.period` of a chart timeframe ("60", "D", "W", ...) */
function v4Period(tf: string): string {
  const info = timeframe.info(tf);
  if (info.isdaily || info.isweekly || info.ismonthly) {
    const unit = info.isdaily ? 'D' : info.isweekly ? 'W' : 'M';
    return info.multiplier === 1 ? unit : `${info.multiplier}${unit}`;
  }
  return info.period;
}

/** The higher timeframe of the "Auto" method */
function autoTimeframe(period: string): string {
  const map: Record<string, string> = {
    '1': '5', '3': '15', '5': '15', '15': '60', '30': '120', '45': '120', '60': '240', '120': '240', '180': '240',
    '240': 'D', D: 'W', W: '5W',
  };
  return map[period] ?? 'D';
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

/** Supertrend state of one line (TUp[1], TDown[1], Trend[1]) */
interface StState {
  tUp: number;
  tDown: number;
  trend: number;
}

/**
 * One bar of the supertrend of one line: the bands follow the close of the bar before, the trend the bands of the bar
 * before. Changes `st`; gives the trailing line (the trend is in `st.trend`).
 */
function supertrendStep(st: StState, hl2: number, atr: number, c: number, c1: number, mult: number): number {
  const up = hl2 - mult * atr;
  const dn = hl2 + mult * atr;
  const prevUp = st.tUp;
  const prevDown = st.tDown;
  // TUp := c[1] > TUp[1] ? max(Up, TUp[1]) : Up; TDown := c[1] < TDown[1] ? min(Dn, TDown[1]) : Dn
  st.tUp = gt(c1, prevUp) ? Math.max(up, prevUp) : up;
  st.tDown = lt(c1, prevDown) ? Math.min(dn, prevDown) : dn;
  // Trend := c > TDown[1] ? 1 : c < TUp[1] ? -1 : nz(Trend[1], 1)
  const t = gt(c, prevDown) ? 1 : lt(c, prevUp) ? -1 : Number.isNaN(st.trend) ? 1 : st.trend;
  st.trend = t;
  return t === 1 ? st.tUp : st.tDown;
}

interface StVars {
  st: StState;
  stH: StState;
}

interface StRun extends BarRunState<StVars> {
  atr: ReturnType<typeof taStep.atr>;
  /** The higher timeframe values on the chart bars (another timeframe, calculated by init), else null */
  pre: { high: number[]; low: number[]; close: number[]; atr: number[] } | null;
  haOpen: number[];
  haHigh: number[];
  haLow: number[];
  haClose: number[];
  haAtr: number[];
  trend: number[];
  trendH: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SupertrendMtfHeikinAshiInputs>): BarStudy<StRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const v = (x: number) => (Number.isFinite(x) ? x : NaN);
  // Higher timeframe: security(heikinashi(syminfo.tickerid), HTF, x[1], lookahead = barmerge.lookahead_on)
  const htfOf = (bars: Bar[], chart?: ChartContext) => {
    const chartTf = chartTimeframe(bars, chart);
    const htf = cfg.mode === 'Auto' ? autoTimeframe(chartTf === '' ? '' : v4Period(chartTf)) : cfg.htfUser;
    const same = htf.trim() === '' || chartTf === '' || timeframe.in_seconds(htf) === timeframe.in_seconds(chartTf);
    return { chartTf, htf, same };
  };
  /** Another timeframe on the bars of the last update (set by key) */
  let other = false;
  return {
    key(bars, chart) {
      const { chartTf, htf, same } = htfOf(bars, chart);
      other = !same;
      return `${chartTf}|${htf}`;
    },
    // another timeframe: the periods and their Heikin Ashi bars from the whole bar set
    fullRunReason: () => (other ? 'another timeframe, calculated on the whole bar set' : null),
    init(bars, chart) {
      const { chartTf, htf, same } = htfOf(bars, chart);
      let pre: StRun['pre'] = null;
      if (!same) {
        if (timeframe.in_seconds(htf) < timeframe.in_seconds(chartTf)) {
          throw new Error(`Supertrend MTF Heikin Ashi: the timeframe "${htf}" is lower than the chart timeframe "${chartTf}": the chart bars do not have that data`);
        }
        // the value of the Heikin Ashi bar of the timeframe before the one of the chart bar
        const sec = higherTimeframeBars(bars, htf, chart);
        const hha = heikinAshi(sec.htf);
        const hh = hha.map((b) => b.high);
        const hl = hha.map((b) => b.low);
        const hc = hha.map((b) => b.close);
        const ha2 = taCore.atr(cfg.period, hh, hl, hc);
        const toChart = (a: number[]) => mapToChart(a.map((_x, g) => (g > 0 ? a[g - 1] : NaN)), sec.group, sec.latest, true, false);
        pre = { high: toChart(hh), low: toChart(hl), close: toChart(hc), atr: toChart(ha2) };
      }
      const s: StRun = {
        atr: taStep.atr(cfg.period), pre,
        haOpen: [], haHigh: [], haLow: [], haClose: [], haAtr: [], trend: [], trendH: [],
        plots: [[], [], [], []], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [],
        vars: { st: { tUp: NaN, tDown: NaN, trend: NaN }, stH: { tUp: NaN, tDown: NaN, trend: NaN } },
        lists: [], series: [],
      };
      s.steps = [s.atr];
      s.lists = [...s.times];
      s.series = [s.haOpen, s.haHigh, s.haLow, s.haClose, s.haAtr, s.trend, s.trendH, ...s.plots, ...s.flags];
      return s;
    },
    copyVars: (x) => ({ st: { ...x.st }, stH: { ...x.stH } }),
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // Chart timeframe: security(heikinashi(syminfo.tickerid), timeframe.period, high / low / close / atr(Period))
      // (Heikin Ashi bars: close = ohlc4, open = average of the previous Heikin Ashi open and close)
      const haC = (b.open + b.high + b.low + b.close) / 4;
      const haO = i > 0 ? (s.haOpen[i - 1] + s.haClose[i - 1]) / 2 : (b.open + b.close) / 2;
      const haH = Math.max(b.high, haO, haC);
      const haL = Math.min(b.low, haO, haC);
      s.haOpen[i] = haO;
      s.haHigh[i] = haH;
      s.haLow[i] = haL;
      s.haClose[i] = haC;
      const atr = s.atr.step(haH, haL, haC);
      s.haAtr[i] = atr;
      const trailing = supertrendStep(s.vars.st, (haH + haL) / 2, atr, haC, i > 0 ? s.haClose[i - 1] : NaN, cfg.mult);
      const tr = s.vars.st.trend;
      s.trend[i] = tr;

      // the higher timeframe values: the bar before on the chart timeframe
      let hHigh: number, hLow: number, hClose: number, hClose1: number, hAtr: number;
      if (s.pre) {
        hHigh = s.pre.high[i];
        hLow = s.pre.low[i];
        hClose = s.pre.close[i];
        hClose1 = i > 0 ? s.pre.close[i - 1] : NaN;
        hAtr = s.pre.atr[i];
      } else {
        hHigh = i > 0 ? s.haHigh[i - 1] : NaN;
        hLow = i > 0 ? s.haLow[i - 1] : NaN;
        hClose = i > 0 ? s.haClose[i - 1] : NaN;
        hClose1 = i > 1 ? s.haClose[i - 2] : NaN;
        hAtr = i > 0 ? s.haAtr[i - 1] : NaN;
      }
      // Uphtf = abs(highhtf + lowhtf) / 2 - (Mult * HTfatr)
      const trailingH = supertrendStep(s.vars.stH, Math.abs(hHigh + hLow) / 2, hAtr, hClose, hClose1, cfg.mult);
      const th = s.vars.stH.trend;
      s.trendH[i] = th;

      const tr1 = i > 0 ? s.trend[i - 1] : 0; // nz(Trend[1])
      // linecolor = Trend == 1 and nz(Trend[1]) == 1 ? color.lime : Trend == -1 and nz(Trend[1]) == -1 ? color.red : na
      const col = tr === 1 && tr1 === 1 ? LIME : tr === -1 && tr1 === -1 ? RED : 'transparent';
      s.plots[0][i] = { time: t, value: v(trailing), color: col };
      const th1 = i > 0 ? s.trendH[i - 1] : NaN;
      const colH = th === 1 && th1 === 1 ? BLUE : th === -1 && th1 === -1 ? RED : 'transparent';
      s.plots[1][i] = { time: t, value: v(trailingH), color: colH };
      // TrendHtf == 1 and TrendHtf[1] == -1 ? TrailingslHtf : na (and the reverse)
      s.plots[2][i] = { time: t, value: th === 1 && th1 === -1 ? v(trailingH) : NaN };
      s.plots[3][i] = { time: t, value: th === -1 && th1 === 1 ? v(trailingH) : NaN };
      // alertcondition(Trend == 1 and Trend[1] == -1) / (Trend == -1 and Trend[1] == 1), the same with TrendHtf
      // (Trend[1] is na on the first bar: false)
      const trp = i > 0 ? s.trend[i - 1] : NaN;
      const flags = [tr === 1 && trp === -1, tr === -1 && trp === 1, th === 1 && th1 === -1, th === -1 && th1 === 1];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupertrendMtfHeikinAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupertrendMtfHeikinAshiInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Supertrend Trend Up', message: 'Supertrend Trend Up' },
  { id: 'alert1', title: 'Supertrend  Trend Down', message: 'Supertrend Trend Down' },
  { id: 'alert2', title: 'Supertrend HTF Trend Up', message: 'Supertrend HTF Trend Upl' },
  { id: 'alert3', title: 'Supertrend HTF Trend Down', message: 'Supertrend HTF Trend Down' },
];

export const SupertrendMtfHeikinAshi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
