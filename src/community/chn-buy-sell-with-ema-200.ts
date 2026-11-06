/**
 * CHN BUY SELL with EMA 200
 *
 * RSI (7) colours the bars: yellow at or above the overbought level, purple at or below the oversold level. A BUY
 * label shows when the close is above the EMA (200) on a yellow bar, a SELL label when the close is below the EMA on
 * a purple bar; a new label of the same side needs at least `signalCooldown` bars since the last one.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Signal', 'SELL Signal' and 'BUY and SELL' (either), true on
 * the bars of the labels.
 *
 * Reference: "CHN BUY SELL with EMA 200" by CHNTeam
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChnBuySellWithEma200Inputs {
  /** RSI length */
  rsi7Length: number;
  /** EMA length */
  emaLength: number;
  /** RSI overbought level (yellow bars) */
  rsi7Overbought: number;
  /** RSI oversold level (purple bars) */
  rsi7Oversold: number;
  /** Minimum bars between two signals of the same side */
  signalCooldown: number;
}

export const defaultInputs: ChnBuySellWithEma200Inputs = {
  rsi7Length: 7,
  emaLength: 200,
  rsi7Overbought: 70,
  rsi7Oversold: 30,
  signalCooldown: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsi7Length', type: 'int', title: 'RSI 7 Length', defval: 7, min: 1 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 200, min: 1 },
  { id: 'rsi7Overbought', type: 'int', title: 'RSI 7 Overbought Level', defval: 70, min: 50, max: 100 },
  { id: 'rsi7Oversold', type: 'int', title: 'RSI 7 Oversold Level', defval: 30, min: 0, max: 50 },
  { id: 'signalCooldown', type: 'int', title: 'Signal Cooldown (candles)', defval: 5, min: 1, max: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 200', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'CHN BUY SELL with EMA 200',
  shortTitle: 'CHN+EMA200',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface ChnRun extends BarRunState<{ lastBuyBar: number; lastSellBar: number }> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ChnBuySellWithEma200Inputs>): BarStudy<ChnRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsi7Length);
      const ema = taStep.ema(cfg.emaLength);
      const s: ChnRun = {
        rsi, ema, plot0: [], barColors: [], markers: [], flags: [[], [], []], times: [[], [], []],
        // var int last_buy_bar = 0, var int last_sell_bar = 0 (bar_index of the last signal)
        steps: [rsi, ema], vars: { lastBuyBar: 0, lastSellBar: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.markers, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const rsi7 = s.rsi.step(b.close);
      const ema200 = s.ema.step(b.close);
      const v = s.vars;
      const isYellow = ge(rsi7, cfg.rsi7Overbought);
      const isPurple = le(rsi7, cfg.rsi7Oversold);
      // barcolor(is_yellow_candle ? color.yellow : is_purple_candle ? color.purple : na, title = "Candle Colors")
      if (isYellow) s.barColors.push({ time: t, color: color.yellow });
      else if (isPurple) s.barColors.push({ time: t, color: color.purple });

      const buy = gt(b.close, ema200) && isYellow && i - v.lastBuyBar >= cfg.signalCooldown;
      const sell = lt(b.close, ema200) && isPurple && i - v.lastSellBar >= cfg.signalCooldown;
      if (buy) v.lastBuyBar = i;
      if (sell) v.lastSellBar = i;
      if (buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'normal' });
      }
      if (sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'normal' });
      }
      s.plot0[i] = { time: t as number, value: ema200, color: color.blue };
      // alertcondition(buy_condition), (sell_condition), (buy_condition or sell_condition)
      [buy, sell, buy || sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChnBuySellWithEma200Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChnBuySellWithEma200Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Signal', message: 'CHN BUY SELL: BUY signal' },
  { id: 'alert1', title: 'SELL Signal', message: 'CHN BUY SELL: SELL signal' },
  { id: 'alert2', title: 'BUY and SELL', message: 'CHN BUY SELL: Trading signal generated' },
];

export const ChnBuySellWithEma200 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
