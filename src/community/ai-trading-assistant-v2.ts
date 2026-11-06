/**
 * AI Trading Assistant v2
 *
 * A VWAP line, a dynamic structure (resistance = highest high and support = lowest low over the lookback) and a volume
 * delta proxy: the EMA of +volume on an up close, -volume on a down close, 0 otherwise. Signals: LONG when the close
 * breaks above the previous resistance with a positive delta and a close above the VWAP; SHORT when the close is
 * below the previous resistance on a down bar with a negative delta and a close below the VWAP; TRAP long when the low
 * pierces the previous support but the close is back above it with a positive delta; TRAP short when the high pierces
 * the previous resistance but the close is back below it with a negative delta. A dot marks a volume spike (volume
 * above the SMA of the volume times a multiplier).
 *
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal', 'Short Signal', 'Trap Long Signal' and 'Trap Short
 * Signal', true on the bars of each signal.
 *
 * Timeframes: Pine `ta.vwap` resets on each new trading day (anchor timeframe.change("1D")). When each bar is one
 * trading day or more, it resets on every bar, so the VWAP is hlc3 of the bar (na when the volume is 0 or na). On
 * intraday bars (barInterval, the most frequent gap between bars, below one day) the reset needs the exchange time
 * zone and the session of the symbol: the port reads them from the optional third argument (see
 * src/chart-context.ts) and sums from the first bar of each trading day (from the first bar on the first day).
 * Without them calculate() throws an Error on intraday bars.
 *
 * Reference: "AI Trading Assistant v2" by Alchemical_Carpenter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval } from '../bar-time';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { executeScript, ta as scriptTa, hlc3 as scriptHlc3 } from 'oakscriptjs/script';

export interface AiTradingAssistantV2Inputs {
  /** Lookback of the structure (highest / lowest) and of the volume SMA */
  lookback: number;
  /** EMA length of the volume delta proxy */
  dLen: number;
  /** Volume spike multiplier */
  vMult: number;
  /** Show the VWAP line */
  showVWAP: boolean;
}

export const defaultInputs: AiTradingAssistantV2Inputs = {
  lookback: 50,
  dLen: 14,
  vMult: 1.5,
  showVWAP: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Structure Lookback', defval: 50, min: 1 },
  { id: 'dLen', type: 'int', title: 'Delta Smoothing', defval: 14, min: 1 },
  { id: 'vMult', type: 'float', title: 'Volume Spike Multiplier', defval: 1.5, min: 0.1 },
  { id: 'showVWAP', type: 'bool', title: 'Show VWAP', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'Resistance', color: '#f23645', lineWidth: 1 },
  { id: 'plot2', title: 'Support', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Trading Assistant v2',
  shortTitle: 'AI Assistant v2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

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

type Point = { time: Bar['time']; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AiVars {
  /** res[1], sup[1], close[1] */
  prevRes: number;
  prevSup: number;
  prevClose: number;
}

interface AiRun extends BarRunState<AiVars> {
  /** ta.vwap of every bar on intraday bars (each update of intraday bars is a full run) */
  intradayVwap: number[] | null;
  sDelta: ReturnType<typeof taStep.ema>;
  volSma: WindowSma;
  res: WindowExtreme;
  sup: WindowExtreme;
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

const isIntraday = (bars: Bar[]) => {
  const interval = barInterval(bars);
  return interval > 0 && interval < DAY_SECONDS;
};

function study(inputs: Partial<AiTradingAssistantV2Inputs>): BarStudy<AiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let fullRuns = 0;
  const P = (val: number) => (Number.isFinite(val) ? val : NaN);
  return {
    // the timeframe from the bar gaps; on intraday bars the trading days of ta.vwap come from the whole set of bars
    // (the library's session rules): every update is a full run
    key: (bars) => (isIntraday(bars) ? `intraday ${++fullRuns}` : 'dwm'),
    init(bars, chart) {
      const intraday = isIntraday(bars);
      if (intraday && (chart?.timezone === undefined || chart.session === undefined)) {
        throw new Error(
          'AI Trading Assistant v2 supports daily and higher timeframes only: on intraday bars ta.vwap resets '
          + 'on each trading day, which needs the exchange time zone and session.',
        );
      }
      const sDelta = taStep.ema(cfg.dLen);
      const volSma = new WindowSma(cfg.lookback);
      const res = new WindowExtreme(false, cfg.lookback);
      const sup = new WindowExtreme(true, cfg.lookback);
      const s: AiRun = {
        intradayVwap: intraday ? intradayVwap(bars, chart) : null,
        sDelta, volSma, res, sup, plots: [[], [], []], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [sDelta, volSma, res, sup],
        vars: { prevRes: NaN, prevSup: NaN, prevClose: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const vol = b.volume ?? NaN;
      // vVal = ta.vwap (hlc3, anchor timeframe.change("1D")). Intraday bars: the sums restart on each trading day of the
      // exchange. Daily or higher bars: a new anchor on every bar, so sum(hlc3 * volume) / sum(volume) over the bar
      // alone (0 / 0 = na when the volume is 0, na when it is na)
      const vwap = s.intradayVwap ? s.intradayVwap[i] : (((b.high + b.low + b.close) / 3) * vol) / vol;

      // deltaVal = close > close[1] ? volume : close < close[1] ? -volume : 0; sDelta = ta.ema(deltaVal, dLen)
      const prev = i > 0 ? v.prevClose : NaN;
      const deltaVal = gt(b.close, prev) ? vol : lt(b.close, prev) ? -vol : 0;
      const sDelta = s.sDelta.step(deltaVal);
      const volSma = s.volSma.step(vol);
      const res = s.res.step(b.high);
      const sup = s.sup.step(b.low);
      const res1 = i > 0 ? v.prevRes : NaN;
      const sup1 = i > 0 ? v.prevSup : NaN;
      v.prevClose = b.close;
      v.prevRes = res;
      v.prevSup = sup;

      // isSpike = volume > ta.sma(volume, lookback) * vMult
      if (gt(vol, volSma * cfg.vMult)) {
        s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'circle', color: '#e1b311', size: 'tiny' });
      }
      const isL = gt(b.close, res1) && gt(sDelta, 0) && gt(b.close, vwap);
      const isS = lt(b.close, res1) && lt(b.close, b.open) && lt(sDelta, 0) && lt(b.close, vwap);
      const isTL = lt(b.low, sup1) && gt(b.close, sup1) && gt(sDelta, 0);
      const isTS = gt(b.high, res1) && lt(b.close, res1) && lt(sDelta, 0);
      const f = [isL, isS, isTL, isTS];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(t as number);
      }
      if (isL) {
        s.markers.push({ id: 'shape1', time: t, position: 'belowBar', shape: 'labelUp', color: '#089981', text: 'LONG', textColor: color.white });
      }
      if (isS) {
        s.markers.push({ id: 'shape2', time: t, position: 'aboveBar', shape: 'labelDown', color: '#f23645', text: 'SHORT', textColor: color.white });
      }
      if (isTL) {
        s.markers.push({ id: 'shape3', time: t, position: 'belowBar', shape: 'labelUp', color: '#5b9cf6', text: 'TRAP', textColor: color.white });
      }
      if (isTS) {
        s.markers.push({ id: 'shape4', time: t, position: 'aboveBar', shape: 'labelDown', color: color.orange, text: 'TRAP', textColor: color.white });
      }

      s.plots[0][i] = { time: t, value: cfg.showVWAP ? P(vwap) : NaN, color: color.orange };
      s.plots[1][i] = { time: t, value: P(res), color: '#f23645' };
      s.plots[2][i] = { time: t, value: P(sup), color: '#089981' };
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2 },
        markers: s.markers.slice(),
        // alertcondition(isL) / (isS) / (isTL) / (isTS)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AiTradingAssistantV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AiTradingAssistantV2Inputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Long' },
  { id: 'alert1', title: 'Short Signal', message: 'Short' },
  { id: 'alert2', title: 'Trap Long Signal', message: 'Trap Long' },
  { id: 'alert3', title: 'Trap Short Signal', message: 'Trap Short' },
];

export const AiTradingAssistantV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
