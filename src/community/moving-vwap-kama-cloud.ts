/**
 * Moving VWAP-KAMA Cloud
 *
 * Moving VWAP = EMA(EMA(VWAP, mvwapLength), mvwapSmooth). KAMA of the Moving VWAP: er = |MVWAP - MVWAP[kamaLength]| /
 * sum(|MVWAP - MVWAP[1]|, kamaLength) (0 when the sum is 0 or na), sc = (er * (fastest - slowest) + slowest)^2 with
 * fastest = 2 / (kamaFastest + 1), slowest = 2 / (kamaSlowest + 1), kama = kama[1] + sc * (MVWAP - kama[1]) (seeded
 * with the MVWAP). A cloud between the two lines: bullish colour when MVWAP >= KAMA, bearish colour otherwise. The
 * lines are hidden by default; when shown, MVWAP is olive when rising (maroon otherwise) and KAMA green when rising
 * (red otherwise).
 *
 * Timeframes: Pine `ta.vwap` resets on each new trading day (anchor timeframe.change("1D")). When each bar is one
 * trading day or more, it resets on every bar, so the VWAP is hlc3 of the bar (na when the volume is 0 or na). On
 * intraday bars (barInterval, the most frequent gap between bars, below one day) the reset needs the exchange time
 * zone and the session of the symbol: the port reads them from the optional third argument (see
 * src/chart-context.ts) and sums from the first bar of each trading day (from the first bar on the first day).
 * Without them calculate() throws an Error on intraday bars. With fewer than 2 bars (or no positive gap)
 * barInterval is 0 and no error is thrown: a single bar is the start of its anchor period, so its VWAP is hlc3 on
 * any timeframe.
 *
 * Alerts (alertcondition, `alerts` of the result): the close crossing above / below the Moving VWAP, the Moving VWAP
 * crossing above / below the KAMA, and the close crossing above / below the KAMA.
 *
 * Reference: "Moving VWAP-KAMA Cloud" by SovereignCharts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval } from '../bar-time';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

import { executeScript, ta as scriptTa, hlc3 as scriptHlc3 } from 'oakscriptjs/script';

export interface MovingVwapKamaCloudInputs {
  /** EMA length applied to the VWAP */
  mvwapLength: number;
  /** EMA length of the second smoothing */
  mvwapSmooth: number;
  /** KAMA efficiency ratio length */
  kamaLength: number;
  /** KAMA fastest period */
  kamaFastest: number;
  /** KAMA slowest period */
  kamaSlowest: number;
  /** Show the Moving VWAP and KAMA lines */
  showLines: boolean;
  /** Cloud transparency (0-100) */
  cloudTransparency: number;
  /** Input of the Pine script (not used by its plots) */
  mvwapColor: string;
  /** Input of the Pine script (not used by its plots) */
  kamaColor: string;
  bullishCloudColor: string;
  bearishCloudColor: string;
}

export const defaultInputs: MovingVwapKamaCloudInputs = {
  mvwapLength: 30,
  mvwapSmooth: 10,
  kamaLength: 10,
  kamaFastest: 10,
  kamaSlowest: 30,
  showLines: false,
  cloudTransparency: 70,
  mvwapColor: '#14b8a6',
  kamaColor: '#06b6d4',
  bullishCloudColor: '#14b8a6',
  bearishCloudColor: '#a855f7',
};

export const inputConfig: InputConfig[] = [
  { id: 'mvwapLength', type: 'int', title: 'Moving VWAP Period', defval: 30, min: 1 },
  { id: 'mvwapSmooth', type: 'int', title: 'MVWAP Smoothing', defval: 10, min: 1 },
  { id: 'kamaLength', type: 'int', title: 'KAMA Length', defval: 10, min: 1 },
  { id: 'kamaFastest', type: 'int', title: 'KAMA Fastest', defval: 10, min: 1 },
  { id: 'kamaSlowest', type: 'int', title: 'KAMA Slowest', defval: 30, min: 1 },
  { id: 'showLines', type: 'bool', title: 'Display Lines', defval: false },
  { id: 'cloudTransparency', type: 'int', title: 'Cloud Transparency', defval: 70, min: 0, max: 100 },
  { id: 'mvwapColor', type: 'color', title: 'Moving VWAP Color', defval: '#14b8a6' },
  { id: 'kamaColor', type: 'color', title: 'KAMA Color', defval: '#06b6d4' },
  { id: 'bullishCloudColor', type: 'color', title: 'Bullish Cloud Color', defval: '#14b8a6' },
  { id: 'bearishCloudColor', type: 'color', title: 'Bearish Cloud Color', defval: '#a855f7' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving VWAP', color: '#2962ff', lineWidth: 1 },
  { id: 'plot1', title: 'KAMA', color: '#2962ff', lineWidth: 3 },
];

export const metadata = {
  title: 'Moving VWAP-KAMA Cloud',
  shortTitle: 'Moving VWAP-KAMA Cloud',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

const DAY_SECONDS = 86400;

/**
 * ta.vwap(hlc3) on intraday bars: the script API function with its default anchor, a new trading day of the exchange
 * (from the time zone and the session of the chart context); as in Pine, the sums start on the first bar
 */
function intradayVwap(bars: Bar[], chart: ChartContext): number[] {
  let vwap: number[] = [];
  const context = { ...chart, timeframe: chart.timeframe ?? timeframe.from_seconds(barInterval(bars)) };
  executeScript(() => { vwap = scriptTa.vwap(scriptHlc3).toArray().map((v) => v ?? NaN); }, bars, {}, context);
  return vwap;
}

/** The exchange time zone and session of the chart context, read by the intraday ta.vwap */
const hasSessionContext = (chart?: ChartContext) => chart?.timezone !== undefined && chart.session !== undefined;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface MvkVars {
  /** var float kama = na */
  kama: number;
}

interface MvkRun extends BarRunState<MvkVars> {
  /** ta.vwap of the intraday bars (from the script API, on every bar: a full run) */
  vwap: number[] | null;
  mvwap: ReturnType<typeof taStep.ema>;
  smooth: ReturnType<typeof taStep.ema>;
  vol: WindowSum;
  sm: number[];
  kama: number[];
  plot0: Point[];
  plot1: Point[];
  cloud: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MovingVwapKamaCloudInputs>): BarStudy<MvkRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fastestSc = 2.0 / (cfg.kamaFastest + 1);
  const slowestSc = 2.0 / (cfg.kamaSlowest + 1);
  const isIntraday = (bars: Bar[]) => {
    const interval = barInterval(bars);
    return interval > 0 && interval < DAY_SECONDS;
  };
  return {
    // the chart timeframe from the bar gaps (intraday or not)
    key: (bars) => String(isIntraday(bars)),
    // the trading days of the intraday ta.vwap come from the exchange calendar of the whole bar set
    fullRunReason: (chart) => (hasSessionContext(chart) ? 'exchange calendar trading days' : null),
    init(bars, chart) {
      const intraday = isIntraday(bars);
      if (intraday && !hasSessionContext(chart)) {
        throw new Error(
          'Moving VWAP-KAMA Cloud supports daily and higher timeframes only: on intraday bars ta.vwap resets on each '
          + 'trading day, which needs the exchange time zone and session.',
        );
      }
      // MVWAP = ta.ema(ta.vwap, mvwap_length); MVWAP_smoothed = ta.ema(MVWAP, mvwap_smooth)
      const mvwap = taStep.ema(cfg.mvwapLength);
      const smooth = taStep.ema(cfg.mvwapSmooth);
      // kama_volatility = math.sum(math.abs(MVWAP_smoothed - MVWAP_smoothed[1]), kama_length)
      const vol = new WindowSum(cfg.kamaLength);
      const s: MvkRun = {
        vwap: intraday ? intradayVwap(bars, chart) : null,
        mvwap, smooth, vol, sm: [], kama: [], plot0: [], plot1: [], cloud: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [mvwap, smooth, vol], vars: { kama: NaN }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.sm, s.kama, s.plot0, s.plot1, s.cloud, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);
      // ta.vwap (hlc3, anchor timeframe.change("1D")). Intraday bars: the sums restart on each trading day of the
      // exchange. Daily or higher bars: a new anchor on every bar, so sum(hlc3 * volume) / sum(volume) over the bar
      // alone (0 / 0 = na when the volume is 0, na when it is na)
      let vwap: number;
      if (s.vwap) {
        vwap = s.vwap[i];
      } else {
        const v = b.volume ?? NaN;
        const hlc3 = (b.high + b.low + b.close) / 3;
        vwap = (hlc3 * v) / v;
      }
      const sm = s.smooth.step(s.mvwap.step(vwap));
      s.sm[i] = sm;

      const vol = s.vol.step(Math.abs(sm - at(s.sm, i - 1)));
      const change = Math.abs(sm - at(s.sm, i - cfg.kamaLength));
      // er = kama_volatility != 0 ? kama_change / kama_volatility : 0 (na != 0 is false)
      const er = !isNaN(vol) && Math.abs(vol) > EPS ? change / vol : 0;
      const sc = Math.pow(er * (fastestSc - slowestSc) + slowestSc, 2);
      // kama := nz(kama[1], MVWAP_smoothed) + sc * (MVWAP_smoothed - nz(kama[1], MVWAP_smoothed))
      const v = s.vars;
      const base = isNaN(v.kama) ? sm : v.kama;
      v.kama = base + sc * (sm - base);
      const kama = v.kama;
      s.kama[i] = kama;

      const t = b.time;
      // color = show_lines ? (MVWAP_smoothed >= MVWAP_smoothed[1] ? color.olive : color.maroon) : na
      const mCol = cfg.showLines ? (ge(sm, at(s.sm, i - 1)) ? color.olive : color.maroon) : 'transparent';
      // color = show_lines ? (kama >= kama[1] ? color.green : color.red) : na
      const kCol = cfg.showLines ? (ge(kama, at(s.kama, i - 1)) ? color.green : color.red) : 'transparent';
      s.plot0[i] = { time: t, value: Number.isFinite(sm) ? sm : NaN, color: mCol };
      s.plot1[i] = { time: t, value: Number.isFinite(kama) ? kama : NaN, color: kCol };
      // cloud_color = MVWAP_smoothed >= kama ? bullish_cloud_color : bearish_cloud_color
      const c = ge(sm, kama) ? cfg.bullishCloudColor : cfg.bearishCloudColor;
      s.cloud[i] = String(color.new(c, cfg.cloudTransparency));

      // alertcondition(ta.crossover / ta.crossunder of (close, MVWAP_smoothed), (MVWAP_smoothed, kama), (close, kama)):
      // a > b now and a <= b on the bar before (crossedOver / crossedUnder of the alert states)
      const close = b.close;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const psm = at(s.sm, i - 1);
      const pk = at(s.kama, i - 1);
      const flag = (k: number, f: boolean) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t as number);
      };
      flag(0, close > sm && pc <= psm);
      flag(1, close < sm && pc >= psm);
      flag(2, sm > kama && psm <= pk);
      flag(3, sm < kama && psm >= pk);
      flag(4, close > kama && pc <= pk);
      flag(5, close < kama && pc >= pk);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'VWAP-KAMA Cloud' }, colors: s.cloud.slice() }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MovingVwapKamaCloudInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MovingVwapKamaCloudInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Above MVWAP', message: 'Price crossed above Moving VWAP' },
  { id: 'alert1', title: 'Price Below MVWAP', message: 'Price crossed below Moving VWAP' },
  { id: 'alert2', title: 'MVWAP Above KAMA', message: 'Moving VWAP crossed above KAMA' },
  { id: 'alert3', title: 'MVWAP Below KAMA', message: 'Moving VWAP crossed below KAMA' },
  { id: 'alert4', title: 'Price Above KAMA', message: 'Price crossed above KAMA' },
  { id: 'alert5', title: 'Price Below KAMA', message: 'Price crossed below KAMA' },
];

export const MovingVwapKamaCloud = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
