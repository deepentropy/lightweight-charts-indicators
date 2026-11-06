/**
 * Candle Range Trading (CRT) with Alerts
 *
 * Two-candle range pattern.
 * Bearish CRT: the previous candle is bullish, the current candle is bearish, makes a higher high than the previous
 * candle and closes inside the previous candle range (low[1] <= close <= high[1]).
 * Bullish CRT: the previous candle is bearish, the current candle is bullish, makes a lower low than the previous
 * candle and closes inside the previous candle range.
 * A triangle marks each pattern, and on the pattern bar the CRT High / CRT Low plots give the highest high and the
 * lowest low of the two candles (na on the other bars).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish CRT Alert' and 'Bearish CRT Alert', true on the pattern
 * bars.
 *
 * Reference: "Candle Range Trading (CRT) with Alerts" by marcostan93
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CandleRangeTradingInputs {
  /** Show the CRT High / CRT Low plots */
  showBox: boolean;
}

export const defaultInputs: CandleRangeTradingInputs = {
  showBox: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBox', type: 'bool', title: 'Show CRT High/Low', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CRT High', color: color.gray, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'CRT Low', color: color.gray, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Candle Range Trading (CRT) with Alerts',
  shortTitle: 'CRT',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CrtRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CandleRangeTradingInputs>): BarStudy<CrtRun, Result> {
  const { showBox } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CrtRun = { plot0: [], plot1: [], markers: [], flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // open[1], close[1], high[1], low[1] are na on the first bar: every comparison with them is false
      const open1 = i > 0 ? bars[i - 1].open : NaN;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const high1 = i > 0 ? bars[i - 1].high : NaN;
      const low1 = i > 0 ? bars[i - 1].low : NaN;

      const bearishCRT = close1 > open1 && b.close < b.open && b.high > high1 && b.close <= high1 && b.close >= low1;
      const bullishCRT = close1 < open1 && b.close > b.open && b.low < low1 && b.close <= high1 && b.close >= low1;

      // plotshape(bullishCRT, 'Bullish CRT', shape.triangleup, location.belowbar, color.green, size = size.small)
      if (bullishCRT) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      // plotshape(bearishCRT, 'Bearish CRT', shape.triangledown, location.abovebar, color.red, size = size.small)
      if (bearishCRT) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }

      // boxHigh = showBox and (bullishCRT or bearishCRT) ? math.max(high0, high1) : na (boxLow with math.min of the lows)
      const on = showBox && (bullishCRT || bearishCRT);
      s.plot0[i] = { time: b.time, value: on ? Math.max(b.high, high1) : NaN };
      s.plot1[i] = { time: b.time, value: on ? Math.min(b.low, low1) : NaN };
      [bullishCRT, bearishCRT].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        // alertcondition(bullishCRT, 'Bullish CRT Alert') / alertcondition(bearishCRT, 'Bearish CRT Alert')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleRangeTradingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandleRangeTradingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish CRT Alert', message: 'Bullish CRT Pattern Detected' },
  { id: 'alert1', title: 'Bearish CRT Alert', message: 'Bearish CRT Pattern Detected' },
];

export const CandleRangeTrading = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
