/**
 * SWING TRADE SIGNALS
 *
 * Swing trading signals using SMA with 3-color RSI-based coloring.
 * Single SMA plot colored: yellow when RSI extreme (>=85 or <=15),
 * lime when low > SMA (uptrend), red when high < SMA (downtrend), yellow otherwise.
 * Buy/Sell signals on SMA/EMA crossover.
 * RSI exit markers on overbought/oversold crossback.
 * Alerts (alertcondition, `alerts` of the result): 'Reversal' (RSI back under the overbought or over the oversold
 * limit) and 'Buy/Sale Swing Signal' (SMA / EMA cross with the bar condition), from the original's expressions.
 *
 * Reference: "SWING CALLS" by nicks1008
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Reversal', message: 'Possible Reversal on Swing Signal Alert' },
  { id: 'alert1', title: 'Buy/Sale Swing Signal', message: 'Swing Signal Entry Alert' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export interface SwingTradeSignalsInputs {
  emaValue: number;
  smaValue: number;
  rsiLen: number;
  overbought: number;
  oversold: number;
  src: SourceType;
}

export const defaultInputs: SwingTradeSignalsInputs = {
  emaValue: 5,
  smaValue: 50,
  rsiLen: 14,
  overbought: 80,
  oversold: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaValue', type: 'int', title: 'EMA Length', defval: 5, min: 1 },
  { id: 'smaValue', type: 'int', title: 'SMA Length', defval: 50, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'overbought', type: 'int', title: 'Overbought limit of RSI', defval: 80, min: 50, max: 100 },
  { id: 'oversold', type: 'int', title: 'Oversold limit of RSI', defval: 20, min: 0, max: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long SMA', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Swing Trade Signals',
  shortTitle: 'STS',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface SwingRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  rsiStep: ReturnType<typeof taStep.rsi>;
  ema1: number[];
  sma2: number[];
  rsi: number[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** crossedOver / crossedUnder of one bar: the values of the bar and of the bar before (na compares false) */
const over = (v: number, w: number, pv: number, pw: number) => v > w && pv <= pw;
const under = (v: number, w: number, pv: number, pw: number) => v < w && pv >= pw;

function study(inputs: Partial<SwingTradeSignalsInputs>): BarStudy<SwingRun, Result> {
  const { emaValue, smaValue, rsiLen, overbought, oversold, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(smaValue, rsiLen);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema = taStep.ema(emaValue);
      const sma = new WindowSma(smaValue);
      const rsiStep = taStep.rsi(rsiLen);
      const s: SwingRun = {
        ema, sma, rsiStep, ema1: [], sma2: [], rsi: [], plot0: [], markers: [], flags: [[], []], times: [[], []],
        steps: [ema, sma, rsiStep], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.ema1, s.sma2, s.rsi, s.plot0, ...s.flags];
      return s;
    },
    bar(st, i, bars) {
      const b = bars[i];
      const source = value(b);
      const e = st.ema.step(source);
      const sm = st.sma.step(source);
      const r = st.rsiStep.step(source);
      st.ema1[i] = e;
      st.sma2[i] = sm;
      st.rsi[i] = r;

      // Pine: mycolor = iff(rs>=85 or rs<=15, yellow, iff(low>sma2, lime, iff(high<sma2, red, yellow)))
      const s = sm;
      if (i < warmup || s == null || isNaN(s)) {
        st.plot0[i] = { time: b.time, value: NaN };
      } else {
        const rs = r ?? 50;
        let color: string;
        if (rs >= 85 || rs <= 15) {
          color = '#FFFF00'; // yellow
        } else if (b.low > s) {
          color = '#00FF00'; // lime
        } else if (b.high < s) {
          color = '#FF0000'; // red
        } else {
          color = '#FFFF00'; // yellow
        }
        st.plot0[i] = { time: b.time, value: s, color };
      }

      if (i >= warmup + 1) {
        const rs = r ?? 50;
        const prevRs = st.rsi[i - 1] ?? 50;
        const currSma = sm ?? 0;
        const prevSma = st.sma2[i - 1] ?? 0;
        const currEma = e ?? 0;
        const prevEma = st.ema1[i - 1] ?? 0;

        // Pine: buyexit = crossunder(rs, hl) - RSI crosses below overbought
        if (prevRs >= overbought && rs < overbought) {
          st.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: '#008080', text: '↓\n↓' });
        }
        // Pine: sellexit = crossover(rs, ll) - RSI crosses above oversold
        if (prevRs <= oversold && rs > oversold) {
          st.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: '#008080', text: '↑\n↑' });
        }

        // Pine: buycall = crossunder(sma2, ema1) and high > sma2
        if (prevSma >= prevEma && currSma < currEma && b.high > currSma) {
          st.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: '#00FFFF', text: 'B' });
        }
        // Pine: sellcall = crossover(sma2, ema1) and open > close
        if (prevSma <= prevEma && currSma > currEma && b.open > b.close) {
          st.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'S' });
        }
      }

      // Alerts from the original's expressions (na is false): buyexit = crossunder(rs, hl), sellexit = crossover(rs, ll),
      // sellcall = crossover(sma2, ema1) and open > close, buycall = crossunder(sma2, ema1) and high > sma2
      const pr = i > 0 ? st.rsi[i - 1] ?? NaN : NaN;
      const ps = i > 0 ? st.sma2[i - 1] ?? NaN : NaN;
      const pe = i > 0 ? st.ema1[i - 1] ?? NaN : NaN;
      const rv = r ?? NaN;
      const sv = sm ?? NaN;
      const ev = e ?? NaN;
      const buyExit = under(rv, overbought, pr, overbought);
      const sellExit = over(rv, oversold, pr, oversold);
      const smaOver = over(sv, ev, ps, pe);
      const smaUnder = under(sv, ev, ps, pe);
      const reversal = buyExit || sellExit;
      const entry = (smaOver && gt(b.open, b.close)) || (smaUnder && gt(b.high, sm ?? NaN));
      // alertcondition(buyexit or sellexit, 'Reversal') / alertcondition(buycall or sellcall, 'Buy/Sale Swing Signal')
      st.flags[0][i] = reversal;
      st.flags[1][i] = entry;
      if (reversal) st.times[0].push(b.time as number);
      if (entry) st.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => !!f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SwingTradeSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SwingTradeSignalsInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const SwingTradeSignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
