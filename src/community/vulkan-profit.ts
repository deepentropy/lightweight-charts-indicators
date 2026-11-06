/**
 * Vulkan Profit
 *
 * Two short WMAs (3, 8) and two longer EMAs (18, 28) of the close. Bullish when both WMAs are above both EMAs,
 * bearish when both are below. A buy (sell) triangle marks the first bar of a bullish (bearish) state. A signal line
 * under the lows (low - ATR(14) * offset) is green in the bullish state, red in the bearish state and grey before the
 * first state.
 * Alerts (alertcondition, `alerts` of the result): 'Vulkan Profit Buy Signal' and 'Vulkan Profit Sell Signal', true on
 * the bars of a buy / sell signal (whether or not the triangles are shown).
 *
 * Reference: "Vulkan Profit" by AlgoCollective
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoCollective
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VulkanProfitInputs {
  fastWmaPeriod: number;
  mediumWmaPeriod: number;
  fastEmaPeriod: number;
  slowEmaPeriod: number;
  showMas: boolean;
  showSignals: boolean;
  showColoredLine: boolean;
  /** Width of the signal line (the plot width stays 2) */
  lineWidth: number;
  /** Distance of the signal line under the low, in ATR units */
  lineOffset: number;
}

export const defaultInputs: VulkanProfitInputs = {
  fastWmaPeriod: 3,
  mediumWmaPeriod: 8,
  fastEmaPeriod: 18,
  slowEmaPeriod: 28,
  showMas: true,
  showSignals: true,
  showColoredLine: true,
  lineWidth: 2,
  lineOffset: 0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastWmaPeriod', type: 'int', title: 'Fast WMA Period', defval: 3, min: 1, max: 50 },
  { id: 'mediumWmaPeriod', type: 'int', title: 'Medium WMA Period', defval: 8, min: 1, max: 50 },
  { id: 'fastEmaPeriod', type: 'int', title: 'Fast EMA Period', defval: 18, min: 1, max: 100 },
  { id: 'slowEmaPeriod', type: 'int', title: 'Slow EMA Period', defval: 28, min: 1, max: 100 },
  { id: 'showMas', type: 'bool', title: 'Show Moving Averages', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Signals', defval: true },
  { id: 'showColoredLine', type: 'bool', title: 'Show Colored Line', defval: true },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 5 },
  { id: 'lineOffset', type: 'float', title: 'Line Offset (% of ATR)', defval: 0.5, min: 0.1, max: 3.0, step: 0.1 },
];

const BULL = '#00C176';
const BEAR = '#FF6B6B';
const NEUTRAL = '#B2B5BE';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Signal Line', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Fast WMA (3)', color: '#1E88E5', lineWidth: 1 },
  { id: 'plot2', title: 'Medium WMA (8)', color: '#42A5F5', lineWidth: 1 },
  { id: 'plot3', title: 'Fast EMA (18)', color: '#FFA726', lineWidth: 1 },
  { id: 'plot4', title: 'Slow EMA (28)', color: '#FF7043', lineWidth: 2 },
];

export const metadata = {
  title: 'Vulkan Profit',
  shortTitle: 'Vulkan Profit',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Wma = ReturnType<typeof taStep.wma>;
type Ema = ReturnType<typeof taStep.ema>;

interface VulkanVars {
  prevBullish: boolean;
  prevBearish: boolean;
  signalState: number;
}

interface VulkanRun extends BarRunState<VulkanVars> {
  fastWma: Wma;
  mediumWma: Wma;
  fastEma: Ema;
  slowEma: Ema;
  atr: ReturnType<typeof taStep.atr>;
  signalLine: Point[];
  ma: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

const bullColor = String(color.new(BULL, 0));
const bearColor = String(color.new(BEAR, 0));
const neutralColor = String(color.new(NEUTRAL, 0));
const MA_COLORS = [String(color.new('#1E88E5', 0)), String(color.new('#42A5F5', 0)), String(color.new('#FFA726', 0)), String(color.new('#FF7043', 0))];

function study(inputs: Partial<VulkanProfitInputs>): BarStudy<VulkanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fastWma = taStep.wma();
      const mediumWma = taStep.wma();
      const fastEma = taStep.ema(cfg.fastEmaPeriod);
      const slowEma = taStep.ema(cfg.slowEmaPeriod);
      const atr = taStep.atr(14);
      const s: VulkanRun = {
        fastWma, mediumWma, fastEma, slowEma, atr, signalLine: [], ma: [[], [], [], []], markers: [],
        flags: [[], []], times: [[], []],
        steps: [fastWma, mediumWma, fastEma, slowEma, atr],
        vars: { prevBullish: false, prevBearish: false, signalState: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.signalLine, ...s.ma, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const fastWma = s.fastWma.step(b.close, cfg.fastWmaPeriod);
      const mediumWma = s.mediumWma.step(b.close, cfg.mediumWmaPeriod);
      const fastEma = s.fastEma.step(b.close);
      const slowEma = s.slowEma.step(b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const v = s.vars;
      // math.min / math.max give na when an argument is na
      const minShort = Math.min(fastWma, mediumWma);
      const maxShort = Math.max(fastWma, mediumWma);
      const minLong = Math.min(fastEma, slowEma);
      const maxLong = Math.max(fastEma, slowEma);
      const bullish = gt(minShort, maxLong);
      const bearish = gt(minLong, maxShort);
      const buy = bullish && !v.prevBullish;
      const sell = bearish && !v.prevBearish;
      v.prevBullish = bullish;
      v.prevBearish = bearish;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t as number);
      if (sell) s.times[1].push(t as number);
      if (buy) v.signalState = 1;
      else if (sell) v.signalState = -1;
      else if (bullish && v.signalState !== 1) v.signalState = 1;
      else if (bearish && v.signalState !== -1) v.signalState = -1;

      const c = v.signalState === 1 ? bullColor : v.signalState === -1 ? bearColor : neutralColor;
      const pos = b.low - atr * cfg.lineOffset;
      s.signalLine[i] = { time: t, value: cfg.showColoredLine ? pos : NaN, color: c };

      if (cfg.showSignals && buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: bullColor, size: 'normal' });
      }
      if (cfg.showSignals && sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: bearColor, size: 'normal' });
      }
      const mas = [fastWma, mediumWma, fastEma, slowEma];
      for (let k = 0; k < 4; k++) s.ma[k][i] = { time: t, value: cfg.showMas ? mas[k] : NaN, color: MA_COLORS[k] };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.signalLine.slice(),
          plot1: s.ma[0].slice(),
          plot2: s.ma[1].slice(),
          plot3: s.ma[2].slice(),
          plot4: s.ma[3].slice(),
        },
        markers: s.markers.slice(),
        // alertcondition(buy_signal, ...) / alertcondition(sell_signal, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VulkanProfitInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VulkanProfitInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Vulkan Profit Buy Signal', message: 'Vulkan Profit: BUY Signal' },
  { id: 'alert1', title: 'Vulkan Profit Sell Signal', message: 'Vulkan Profit: SELL Signal' },
];

export const VulkanProfit = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
