/**
 * Evil MACD Trading System
 *
 * MACD of the close: DIF = EMA(fast) - EMA(slow), DEA = EMA(DIF, signal), MACD bar = DIF - DEA (green columns above
 * 0, red otherwise). Trend filter: uptrend when the close is above the EMA of the trend period, downtrend when it is
 * below (green / red background). Buy when DIF crosses over DEA in an uptrend, sell when DIF crosses under DEA in a
 * downtrend; with the volume filter on, the volume must also be above 1.2 times its 20-bar SMA. Buy triangles are
 * drawn 1 bar back and the "买" labels 5 bars back; sell triangles 1 bar ahead and the "卖" labels 5 bars ahead.
 *
 * Reference: "Evil MACD Trading System (Pine Script v6)" by daves723
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EvilMacdTradingSystemInputs {
  /** Fast EMA length (快线周期) */
  fastLength: number;
  /** Slow EMA length (慢线周期) */
  slowLength: number;
  /** Signal EMA length (信号线周期) */
  signalLength: number;
  /** EMA length of the trend filter (趋势过滤均线周期) */
  trendFilterPeriod: number;
  /** Volume filter (启用成交量过滤) */
  volFilter: boolean;
  /** Signal offset (信号偏移量); not used by the script */
  signalOffset: number;
}

export const defaultInputs: EvilMacdTradingSystemInputs = {
  fastLength: 14,
  slowLength: 28,
  signalLength: 8,
  trendFilterPeriod: 60,
  volFilter: true,
  signalOffset: 0.001,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: '快线周期', defval: 14, min: 1, max: 50 },
  { id: 'slowLength', type: 'int', title: '慢线周期', defval: 28, min: 1, max: 100 },
  { id: 'signalLength', type: 'int', title: '信号线周期', defval: 8, min: 1, max: 50 },
  { id: 'trendFilterPeriod', type: 'int', title: '趋势过滤均线周期', defval: 60, min: 10, max: 200 },
  { id: 'volFilter', type: 'bool', title: '启用成交量过滤', defval: true },
  { id: 'signalOffset', type: 'float', title: '信号偏移量', defval: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DIF', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'DEA', color: color.red, lineWidth: 2 },
  { id: 'plot2', title: 'MACD Bar', color: color.green, lineWidth: 1, style: 'columns' },
];

/** hline(0, "0轴", color = color.gray, linestyle = hline.style_dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: '0轴', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: '邪修MACD交易系统',
  shortTitle: 'XX_MACD',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

interface EvilRun extends BarRunState<Record<string, never>> {
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  dea: ReturnType<typeof taStep.ema>;
  trend: ReturnType<typeof taStep.ema>;
  volSma: WindowSma;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDn: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  bgColors: BgColorData[];
  /** Bars of the buy / sell signals and their kind (0: buy, 1: sell): the markers are placed in the result */
  sigBars: number[];
  sigKinds: number[];
}

function study(inputs: Partial<EvilMacdTradingSystemInputs>): BarStudy<EvilRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  const bgUp = String(color.new(color.green, 90));
  const bgDn = String(color.new(color.red, 90));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: EvilRun = {
        emaFast: taStep.ema(cfg.fastLength), emaSlow: taStep.ema(cfg.slowLength), dea: taStep.ema(cfg.signalLength),
        trend: taStep.ema(cfg.trendFilterPeriod), volSma: new WindowSma(20), crossUp: taStep.crossover(),
        crossDn: taStep.crossunder(), plots: [[], [], []], bgColors: [], sigBars: [], sigKinds: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.emaFast, s.emaSlow, s.dea, s.trend, s.volSma, s.crossUp, s.crossDn];
      s.lists = [s.bgColors, s.sigBars, s.sigKinds];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const close = b.close;
      const dif = s.emaFast.step(close) - s.emaSlow.step(close);
      const dea = s.dea.step(dif);
      const macdBar = dif - dea;
      const trendMA = s.trend.step(close);
      const volume = b.volume ?? NaN;
      const volSma = s.volSma.step(volume);
      // ta.crossover / ta.crossunder compare exactly
      const crossUp = s.crossUp.step(dif, dea);
      const crossDn = s.crossDn.step(dif, dea);

      const uptrend = gt(close, trendMA);
      const downtrend = lt(close, trendMA);
      // volRatio = volume / ta.sma(volume, 20); volCondition = volRatio > 1.2 (x / 0 is +-infinity, 0 / 0 na)
      const volCondition = gt(volume / volSma, 1.2);
      let buySignal = crossUp && uptrend;
      if (cfg.volFilter) buySignal = buySignal && volCondition;
      let sellSignal = crossDn && downtrend;
      if (cfg.volFilter) sellSignal = sellSignal && volCondition;

      s.plots[0][i] = { time: t, value: fin(dif), color: color.blue };
      s.plots[1][i] = { time: t, value: fin(dea), color: color.red };
      // color = macdBar > 0 ? color.green : color.red
      s.plots[2][i] = { time: t, value: fin(macdBar), color: gt(macdBar, 0) ? color.green : color.red };

      if (buySignal) { s.sigBars.push(i); s.sigKinds.push(0); }
      if (sellSignal) { s.sigBars.push(i); s.sigKinds.push(1); }

      // bgcolor(uptrend ? color.new(color.green, 90) : downtrend ? color.new(color.red, 90) : na)
      if (uptrend) s.bgColors.push({ time: t, color: bgUp });
      else if (downtrend) s.bgColors.push({ time: t, color: bgDn });
    },
    result(s, bars) {
      const n = bars.length;
      const sb = s.sigBars;
      // the times of the bars after the last one: the bar interval of the whole set
      const interval = sb.length > 0 && sb[sb.length - 1] + 5 >= n ? barInterval(bars) : undefined;
      const markers: MarkerData[] = [];
      for (let k = 0; k < sb.length; k++) {
        const i = sb[k];
        if (s.sigKinds[k] === 0) {
          // plotshape(buySignal, "买入", location.belowbar, offset = -1, shape.triangleup, size.small)
          if (i - 1 >= 0) {
            markers.push({ time: barTime(bars, i - 1, interval), position: 'belowBar', shape: 'triangleUp', color: green, size: 'small' });
          }
          // plotshape(buySignal, "买入文字", location.belowbar, offset = -5, shape.labelup, text "买", size.tiny)
          if (i - 5 >= 0) {
            markers.push({ time: barTime(bars, i - 5, interval), position: 'belowBar', shape: 'labelUp', color: green,
              text: '买', textColor: color.white, size: 'tiny' });
          }
        } else {
          // plotshape(sellSignal, "卖出", location.abovebar, offset = 1, shape.triangledown, size.small)
          markers.push({ time: barTime(bars, i + 1, interval), position: 'aboveBar', shape: 'triangleDown', color: red, size: 'small' });
          // plotshape(sellSignal, "卖出文字", location.abovebar, offset = 5, shape.labeldown, text "卖", size.tiny)
          markers.push({ time: barTime(bars, i + 5, interval), position: 'aboveBar', shape: 'labelDown', color: red,
            text: '卖', textColor: color.white, size: 'tiny' });
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [{ value: 0, options: { title: '0轴', color: color.gray, linestyle: 'dashed' } }],
        markers,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EvilMacdTradingSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EvilMacdTradingSystemInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EvilMacdTradingSystem = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
