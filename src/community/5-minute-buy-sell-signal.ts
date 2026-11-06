/**
 * 5-Minute Buy/Sell Signal
 *
 * An EMA of the close on the price chart, with BUY / SELL labels. BUY: MACD histogram (MACD line - signal line) above
 * 0, RSI below the oversold level, close above the EMA and volume above its SMA. SELL: MACD histogram below 0, RSI
 * above the overbought level, close below the EMA and volume above its SMA.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of each signal.
 *
 * Reference: "5-Minute Buy/Sell Signal" by Waqas_Khalid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FiveMinuteBuySellSignalInputs {
  macdFastLength: number;
  macdSlowLength: number;
  macdSignalSmoothing: number;
  rsiLength: number;
  rsiOverbought: number;
  rsiOversold: number;
  emaLength: number;
  /** SMA length of the volume */
  volumeLength: number;
}

export const defaultInputs: FiveMinuteBuySellSignalInputs = {
  macdFastLength: 12,
  macdSlowLength: 26,
  macdSignalSmoothing: 9,
  rsiLength: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  emaLength: 50,
  volumeLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'macdFastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'macdSlowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'macdSignalSmoothing', type: 'int', title: 'MACD Signal Smoothing', defval: 9 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold Level', defval: 30 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 50 },
  { id: 'volumeLength', type: 'int', title: 'Volume Moving Average Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 50', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: '5-Minute Buy/Sell Signal',
  shortTitle: '5-Minute Buy/Sell Signal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FiveMinRun extends BarRunState<Record<string, never>> {
  macd: ReturnType<typeof taStep.macd>;
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  volMa: WindowSma;
  emaData: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FiveMinuteBuySellSignalInputs>): BarStudy<FiveMinRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const macd = taStep.macd(cfg.macdFastLength, cfg.macdSlowLength, cfg.macdSignalSmoothing);
      const rsi = taStep.rsi(cfg.rsiLength);
      const ema = taStep.ema(cfg.emaLength);
      const volMa = new WindowSma(cfg.volumeLength);
      const s: FiveMinRun = {
        macd, rsi, ema, volMa, emaData: [], markers: [], flags: [[], []], times: [[], []],
        steps: [macd, rsi, ema, volMa], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.emaData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      const volume = b.volume ?? NaN;
      const [macdLine, signalLine] = s.macd.step(c);
      const rsi = s.rsi.step(c);
      const ema50 = s.ema.step(c);
      const volMA = s.volMa.step(volume);
      const macdHist = macdLine - signalLine;
      // buySignal = macdHist > 0 and rsi < rsiOversold and close > ema50 and volume > volMA
      const buy = gt(macdHist, 0) && lt(rsi, cfg.rsiOversold) && gt(c, ema50) && gt(volume, volMA);
      // sellSignal = macdHist < 0 and rsi > rsiOverbought and close < ema50 and volume > volMA
      const sell = lt(macdHist, 0) && gt(rsi, cfg.rsiOverbought) && lt(c, ema50) && gt(volume, volMA);
      // plotshape(..., color.green / color.red, shape.labelup / labeldown, location.belowbar / abovebar, size.small);
      // no textcolor: Pine default blue
      if (buy) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.blue, size: 'small' });
      }
      if (sell) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.blue, size: 'small' });
      }
      s.emaData[i] = { time: b.time, value: ema50, color: color.orange };
      [buy, sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.emaData.slice() },
        markers: s.markers.slice(),
        // alertcondition(buySignal, 'Buy Signal', ...) / alertcondition(sellSignal, 'Sell Signal', ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FiveMinuteBuySellSignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FiveMinuteBuySellSignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal: MACD bullish, RSI oversold, price above EMA50' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal: MACD bearish, RSI overbought, price below EMA50' },
];

export const FiveMinuteBuySellSignal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
