/**
 * KD-NewAuto Trade
 *
 * A fast and a slow EMA of the close. A BUY triangle (and a green background) is drawn when the fast EMA crosses
 * over the slow EMA, the RSI is above the buy level and, with the ADX filter on, the ADX of ta.dmi is above the
 * minimum. A SELL triangle (and a red background) is drawn on a cross under with the RSI below the sell level and
 * the same ADX filter.
 * Alerts (alertcondition, `alerts` of the result): 'BUY ALERT' and 'SELL ALERT' on the bars of the BUY / SELL signals.
 *
 * Reference: "KD-NewAutoTrade for Future Trading - Heikin Ashi candles" by krish16887
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KdNewAutoTradeInputs {
  fastLength: number;
  slowLength: number;
  rsiLength: number;
  /** DI length of ta.dmi */
  adxLength: number;
  /** ADX smoothing of ta.dmi */
  adxSmooth: number;
  adxMin: number;
  adxFilter: boolean;
  rsiBuyLvl: number;
  rsiSellLvl: number;
}

export const defaultInputs: KdNewAutoTradeInputs = {
  fastLength: 10,
  slowLength: 20,
  rsiLength: 14,
  adxLength: 14,
  adxSmooth: 14,
  adxMin: 25,
  adxFilter: true,
  rsiBuyLvl: 55,
  rsiSellLvl: 45,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 10 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 20 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smooth', defval: 14 },
  { id: 'adxMin', type: 'int', title: 'ADX Min', defval: 25 },
  { id: 'adxFilter', type: 'bool', title: 'Enable ADX Filter', defval: true },
  { id: 'rsiBuyLvl', type: 'int', title: 'RSI Buy Level', defval: 55 },
  { id: 'rsiSellLvl', type: 'int', title: 'RSI Sell Level', defval: 45 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 10', color: String(color.new(color.green, 0)), lineWidth: 2 },
  { id: 'plot1', title: 'EMA 20', color: String(color.new(color.orange, 0)), lineWidth: 2 },
];

export const metadata = {
  title: 'KD-NewAuto Trade',
  shortTitle: 'KD-NewAuto Trade',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface KdRun extends BarRunState<Record<string, never>> {
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  dmi: ReturnType<typeof taStep.dmi>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<KdNewAutoTradeInputs>): BarStudy<KdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(color.green, 0));
  const sellColor = String(color.new(color.red, 0));
  const buyBg = String(color.new(color.green, 85));
  const sellBg = String(color.new(color.red, 85));
  const slowColor = String(color.new(color.orange, 0));
  return {
    init() {
      const emaFast = taStep.ema(cfg.fastLength);
      const emaSlow = taStep.ema(cfg.slowLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const dmi = taStep.dmi(cfg.adxLength, cfg.adxSmooth);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: KdRun = {
        emaFast, emaSlow, rsi, dmi, over, under, plot0: [], plot1: [], flags: [[], []], times: [[], []], markers: [],
        bgColors: [], steps: [emaFast, emaSlow, rsi, dmi, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.bgColors];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const fast = s.emaFast.step(b.close);
      const slow = s.emaSlow.step(b.close);
      const rsi = s.rsi.step(b.close);
      const adx = s.dmi.step(b.high, b.low, b.close)[2];
      // ta.crossover / ta.crossunder: exact comparisons
      const bullishCross = s.over.step(fast, slow);
      const bearishCross = s.under.step(fast, slow);
      const trendStrong = !cfg.adxFilter || gt(adx, cfg.adxMin);
      const longCond = !!bullishCross && gt(rsi, cfg.rsiBuyLvl) && trendStrong;
      const shortCond = !!bearishCross && lt(rsi, cfg.rsiSellLvl) && trendStrong;
      s.flags[0][i] = longCond;
      s.flags[1][i] = shortCond;
      if (longCond) s.times[0].push(t as number);
      if (shortCond) s.times[1].push(t as number);
      // plotshape(..., size = size.large, text = "BUY"): no textcolor, the Pine default text colour (color.blue)
      if (longCond) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: buyColor, text: 'BUY',
          textColor: color.blue, size: 'large' });
      }
      if (shortCond) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: sellColor, text: 'SELL',
          textColor: color.blue, size: 'large' });
      }
      // bgcolor(longCond ? color.new(color.green, 85) : shortCond ? color.new(color.red, 85) : na)
      if (longCond) s.bgColors.push({ time: t, color: buyBg });
      else if (shortCond) s.bgColors.push({ time: t, color: sellBg });
      s.plot0[i] = { time: t, value: fast, color: buyColor };
      s.plot1[i] = { time: t, value: slow, color: slowColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(longCond, "BUY ALERT") / alertcondition(shortCond, "SELL ALERT")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KdNewAutoTradeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KdNewAutoTradeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY ALERT', message: 'BUY: EMA 10 crossed above EMA 20 with RSI & ADX confirmation.' },
  { id: 'alert1', title: 'SELL ALERT', message: 'SELL: EMA 10 crossed below EMA 20 with RSI & ADX confirmation.' },
];

export const KdNewAutoTrade = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
