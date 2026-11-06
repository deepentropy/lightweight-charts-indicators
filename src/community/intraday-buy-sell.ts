/**
 * Intraday BUY_SELL
 *
 * Pine-faithful intraday scalping indicator with SMA, RSI-based signals,
 * conditional SMA coloring, buy/sell markers, and RSI reversal markers.
 *
 * Alerts (alertcondition, `alerts` of the result), from the original's expressions on every bar: 'Both Reversal
 * Signal' (RSI crosses under the higher level, or over the lower level on a green bar), 'Buy & Sell Signal Both',
 * 'Only Buy Signal', 'Only Sell Signal', 'Reversal from Top', 'Reversal from Down'. The SMA plot, markers, bar
 * colours and alerts all start as soon as the original's values exist (the SMA from bar smaLength - 1, the crosses
 * one bar later), as the original. SMA colour (transparency 30): yellow while the RSI is at or beyond a level, else
 * lime when the low is above the SMA, red when the high is below it, yellow otherwise.
 *
 * Reference: "Intraday BUY_SELL" (community) by nicks1008
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IntradayBuySellInputs {
  rsiLength: number;
  rsiHL: number;
  rsiLL: number;
  smaLength: number;
}

export const defaultInputs: IntradayBuySellInputs = {
  rsiLength: 14,
  rsiHL: 80,
  rsiLL: 20,
  smaLength: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiHL', type: 'int', title: 'RSI Higher Level', defval: 80, min: 1 },
  { id: 'rsiLL', type: 'int', title: 'RSI Lower Level', defval: 20, min: 1 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 70, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'sma', title: 'SMA', color: '#2962ff', lineWidth: 1 },
];

export const metadata = {
  title: 'Intraday BUY_SELL',
  shortTitle: 'IBS',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface IbsRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  sma: WindowSma;
  rsArr: number[];
  smaArr: number[];
  smaPlot: { time: number; value: number; color?: string }[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

// Pine float comparisons: a > b only when a - b > 1e-10 (na compares false)
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

function study(inputs: Partial<IntradayBuySellInputs>): BarStudy<IbsRun, Result> {
  const { rsiLength, rsiHL, rsiLL, smaLength } = { ...defaultInputs, ...inputs };
  // plot(sma1, 'SMA', color = mycolor), all at transparency 30:
  // iff_1 = high < sma1 ? red : yellow; iff_2 = low > sma1 ? lime : iff_1; mycolor = rs >= hl or rs <= ll ? yellow : iff_2
  const YELLOW = 'rgba(255,235,59,0.7)'; // color.new(color.yellow, 30)
  const LIME = 'rgba(0,230,118,0.7)'; // color.new(color.lime, 30)
  const RED = 'rgba(255,82,82,0.7)'; // color.new(color.red, 30)
  return {
    init() {
      const rsi = taStep.rsi(rsiLength);
      const sma = new WindowSma(smaLength);
      const s: IbsRun = {
        rsi, sma, rsArr: [], smaArr: [], smaPlot: [], markers: [], barColors: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [rsi, sma], vars: {}, lists: [], series: [],
      };
      s.series = [s.rsArr, s.smaArr, s.smaPlot, ...s.flags];
      s.lists = [s.markers, s.barColors, ...s.times];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const rs = s.rsi.step(b.close) ?? NaN;
      const sma = s.sma.step(b.close) ?? NaN;
      s.rsArr[i] = rs;
      s.smaArr[i] = sma;
      if (isNaN(sma)) {
        s.smaPlot[i] = { time: t, value: NaN };
      } else {
        const rsOut = (!isNaN(rs) && !lt(rs, rsiHL)) || (!isNaN(rs) && !gt(rs, rsiLL));
        const color = rsOut ? YELLOW : gt(b.low, sma) ? LIME : lt(b.high, sma) ? RED : YELLOW;
        s.smaPlot[i] = { time: t, value: sma, color };
      }

      // Alert conditions, the original's expressions (na compares false):
      // hlrev_s = ta.crossunder(rs, hl); llrev_b = ta.crossover(rs, ll) and open < close
      // BUY = ta.crossover(close[1], sma1) and close[1] > open[1] and high > high[1] and close > open
      // SELL = ta.crossunder(low[1], sma1) and close[1] < open[1] and low < low[1] and close < open
      // (crosses with the bar before: a > b now and a <= b on the bar before)
      const p = i > 0 ? bars[i - 1] : undefined;
      const pp = i > 1 ? bars[i - 2] : undefined;
      const close1 = p ? p.close : NaN;
      const low1 = p ? p.low : NaN;
      const prevClose1 = pp ? pp.close : NaN;
      const prevLow1 = pp ? pp.low : NaN;
      const prevSma = i > 0 ? s.smaArr[i - 1] : NaN;
      const prevRs = i > 0 ? s.rsArr[i - 1] : NaN;
      const closeUp = close1 > sma && prevClose1 <= prevSma;
      const lowDown = low1 < sma && prevLow1 >= prevSma;
      const rsDown = rs < rsiHL && prevRs >= (i > 0 ? rsiHL : NaN);
      const rsUp = rs > rsiLL && prevRs <= (i > 0 ? rsiLL : NaN);
      const buy = !!p && closeUp && gt(p.close, p.open) && gt(b.high, p.high) && gt(b.close, b.open);
      const sell = !!p && lowDown && lt(p.close, p.open) && lt(b.low, p.low) && lt(b.close, b.open);
      const hlrev = rsDown;
      const llrev = rsUp && lt(b.open, b.close);

      // Markers and bar colours on every bar where the original's expressions are true (no warm-up of their own:
      // the crosses compare false while the SMA / RSI are na)
      if (sell) s.markers.push({ id: 'shape0', time: t, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255,82,82,0.7)', text: 'S', textColor: 'rgba(0,0,0,0.7)' });
      if (buy) s.markers.push({ id: 'shape1', time: t, position: 'belowBar', shape: 'labelUp', color: 'rgba(0,188,212,0.7)', text: 'B', textColor: 'rgba(0,0,0,0.7)' });
      if (hlrev) s.markers.push({ id: 'shape2', time: t, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255,235,59,0.8)', text: '!', textColor: 'rgba(0,0,0,0.8)' });
      if (llrev) s.markers.push({ id: 'shape3', time: t, position: 'belowBar', shape: 'labelUp', color: 'rgba(255,235,59,0.8)', text: '!', textColor: 'rgba(0,0,0,0.8)' });
      // barcolor(BUY ? green : SELL ? maroon(30) : hlrev_s or llrev_b ? yellow : na)
      if (buy) s.barColors.push({ id: 'barcolor0', time: t, color: '#4CAF50' });
      else if (sell) s.barColors.push({ id: 'barcolor0', time: t, color: 'rgba(136,14,79,0.7)' });
      else if (hlrev || llrev) s.barColors.push({ id: 'barcolor0', time: t, color: '#FFEB3B' });

      const f = s.flags;
      f[0][i] = hlrev || llrev;
      f[1][i] = sell || buy;
      f[2][i] = buy;
      f[3][i] = sell;
      f[4][i] = hlrev;
      f[5][i] = llrev;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'sma': s.smaPlot.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IntradayBuySellInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IntradayBuySellInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Both Reversal Signal', message: 'Reversal Alert' },
  { id: 'alert1', title: 'Buy & Sell Signal Both', message: 'Buy/Sell Alert' },
  { id: 'alert2', title: 'Only Buy Signal', message: 'Buy Alert' },
  { id: 'alert3', title: 'Only Sell Signal', message: 'Sell Alert' },
  { id: 'alert4', title: 'Reversal from Top', message: 'Down Reversal Alert' },
  { id: 'alert5', title: 'Reversal from Down', message: 'Up Reversal Alert' },
];

export const IntradayBuySell = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
