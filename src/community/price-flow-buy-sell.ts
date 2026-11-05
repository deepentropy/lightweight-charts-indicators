/**
 * Price Flow - Buy Sell
 *
 * A Gaussian kernel endpoint estimate of the source: y = sum(w_i * src[i]) / sum(w_i), i = 0..lookback,
 * w_i = exp(-i^2 / (2 * h^2)), with the bandwidth h = base bandwidth * clamp(ATR(20) / SMA(ATR(20), 100), 0.5, 2)
 * when the adaptive volatility is on. Inner and outer envelopes at the mean absolute error (SMA over the lookback)
 * times the inner / outer multipliers. The line colour is a gradient of the EMA(5) of the velocity (y - y[1]),
 * saturated at 2 standard deviations (20) of the velocity. BUY / SELL labels on a first rejection of an envelope
 * (outer when trending, inner when ranging) with a weakening move (velocity and acceleration of opposite signs),
 * optionally alternating. Alerts (alertcondition, `alerts` of the result): 'BUY Alert' and 'SELL Alert', true on the
 * bars of a BUY / SELL signal (whatever the label input).
 *
 * Reference: "Price Flow - Buy Sell" by IVTrader1990
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, math,
  type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceFlowBuySellInputs {
  /** Base bandwidth (h) of the Gaussian kernel */
  hVal: number;
  /** Lookback window of the kernel regression and of the MAE */
  lookback: number;
  /** Bandwidth expands with the volatility */
  useVol: boolean;
  /** Inner band multiplier */
  multIn: number;
  /** Outer band multiplier */
  multOut: number;
  src: SourceType;
  /** Range filter: inner band signals need a weakening move */
  filterRng: boolean;
  showBuySell: boolean;
  /** A BUY must be followed by a SELL before another BUY, and the reverse */
  strictAlternation: boolean;
  colBull: string;
  colBear: string;
  colNeut: string;
}

export const defaultInputs: PriceFlowBuySellInputs = {
  hVal: 8.0,
  lookback: 50,
  useVol: true,
  multIn: 1.5,
  multOut: 2.8,
  src: 'hlc3',
  filterRng: true,
  showBuySell: true,
  strictAlternation: false,
  colBull: '#00ffaa',
  colBear: '#ff0044',
  colNeut: '#434651',
};

const GRP_KERNEL = 'Kernel Physics';
const GRP_ENV = 'Envelope Statistics';
const GRP_RISK = 'Risk Management';
const GRP_SIG = 'Buy / Sell Signals';
const GRP_VIS = 'Visuals';

export const inputConfig: InputConfig[] = [
  { id: 'hVal', type: 'float', title: 'Base Bandwidth (h)', defval: 8.0, min: 1.0, group: GRP_KERNEL,
    tooltip: 'Defaults to 8.0 for signal stability (noise reduction).' },
  { id: 'lookback', type: 'int', title: 'Lookback Window', defval: 50, min: 10, max: 500, group: GRP_KERNEL,
    tooltip: 'Number of historical bars used for kernel regression at each point.' },
  { id: 'useVol', type: 'bool', title: 'Enable Adaptive Volatility', defval: true, group: GRP_KERNEL,
    tooltip: 'If enabled, bandwidth expands during high volatility to reduce noise.' },
  { id: 'multIn', type: 'float', title: 'Inner Band Multiplier (Balanced)', defval: 1.5, step: 0.1, group: GRP_ENV },
  { id: 'multOut', type: 'float', title: 'Outer Band Multiplier (Precision)', defval: 2.8, step: 0.1, group: GRP_ENV },
  { id: 'src', type: 'source', title: 'Source Price', defval: 'hlc3', group: GRP_ENV },
  { id: 'filterRng', type: 'bool', title: 'Range Filter', defval: true, group: GRP_RISK,
    tooltip: 'If enabled, signals in the Ranging Zone (Inner Band) only appear when momentum weakens. Helps prevent catching falling knives during breakouts.' },
  { id: 'showBuySell', type: 'bool', title: 'Show Buy / Sell Labels', defval: true, group: GRP_SIG },
  { id: 'strictAlternation', type: 'bool', title: 'Strict Buy/Sell Alternation', defval: false, group: GRP_SIG,
    tooltip: 'When enabled, a BUY must be followed by a SELL before another BUY can appear, and vice versa.' },
  { id: 'colBull', type: 'color', title: 'Bullish', defval: '#00ffaa', group: GRP_VIS },
  { id: 'colBear', type: 'color', title: 'Bearish', defval: '#ff0044', group: GRP_VIS },
  { id: 'colNeut', type: 'color', title: 'Neutral/Grey', defval: '#434651', group: GRP_VIS },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fair Value Core', color: '#434651', lineWidth: 2 },
  { id: 'plot1', title: 'Fair Value Glow 1', color: String(color.new('#434651', 50)), lineWidth: 4 },
  { id: 'plot2', title: 'Fair Value Glow 2', color: String(color.new('#434651', 80)), lineWidth: 8 },
  { id: 'plot3', title: 'Fair Value (fill)', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Upper Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot5', title: 'Lower Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot6', title: 'Upper Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
  { id: 'plot7', title: 'Lower Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', title: 'Bull Zone' },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot5', title: 'Bear Zone' },
  { id: 'fill2', plot1: 'plot4', plot2: 'plot6', title: 'Bull Extreme' },
  { id: 'fill3', plot1: 'plot5', plot2: 'plot7', title: 'Bear Extreme' },
];

export const metadata = {
  title: 'Price Flow - Buy Sell',
  shortTitle: 'Price Flow - Buy Sell',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false); a == b within 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface FlowVars {
  prevSellOut: boolean;
  prevBuyOut: boolean;
  prevSellIn: boolean;
  prevBuyIn: boolean;
  lastSignal: number; // var int last_signal = 0
}

interface FlowRun extends BarRunState<FlowVars> {
  atr: ReturnType<typeof taStep.atr>;
  volBase: ReturnType<typeof taStep.sma>;
  mae: ReturnType<typeof taStep.sma>;
  velVis: ReturnType<typeof taStep.ema>;
  velStdev: ReturnType<typeof taStep.stdev>;
  src: number[];
  yHat: number[];
  velocity: number[];
  plots: Point[][];
  c90: string[];
  c80: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PriceFlowBuySellInputs>): BarStudy<FlowRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // Volatility adjustment
      const atr = taStep.atr(20);
      const volBase = taStep.sma();
      const mae = taStep.sma();
      const velVis = taStep.ema(5);
      const velStdev = taStep.stdev();
      const s: FlowRun = {
        atr, volBase, mae, velVis, velStdev,
        src: [], yHat: [], velocity: [],
        plots: Array.from({ length: 8 }, () => []),
        c90: [], c80: [], markers: [], flags: [[], []], times: [[], []],
        steps: [atr, volBase, mae, velVis, velStdev],
        vars: { prevSellOut: false, prevBuyOut: false, prevSellIn: false, prevBuyIn: false, lastSignal: 0 },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.src, s.yHat, s.velocity, ...s.plots, s.c90, s.c80, ...s.flags];
      return s;
    },
    bar(s, k, bars) {
      const b = bars[k];
      const t = b.time;
      const v = s.vars;
      s.src[k] = value(b);
      const volRaw = s.atr.step(b.high, b.low, b.close);
      const volBase = s.volBase.step(volRaw, 100);
      // Kernel regression loop (var float y_hat = 0.0, assigned on every bar)
      const volRatio = cfg.useVol ? volRaw / (eq(volBase, 0) ? 1 : volBase) : 1.0;
      // math.min / math.max with na give na
      const volMod = Math.max(0.5, Math.min(volRatio, 2.0));
      const hEff = cfg.hVal * volMod;
      let num = 0.0;
      let den = 0.0;
      for (let i = 0; i <= cfg.lookback; i++) {
        const dist = i;
        const w = math.exp(-math.pow(dist, 2) / (2 * math.pow(hEff, 2))) as number;
        num = num + w * (k - i >= 0 ? s.src[k - i] : NaN);
        den = den + w;
      }
      const yHat = num / den;
      s.yHat[k] = yHat;
      // Statistical bounds (MAE)
      const mae = s.mae.step(Math.abs(s.src[k] - yHat), cfg.lookback);
      const upperIn = yHat + mae * cfg.multIn;
      const lowerIn = yHat - mae * cfg.multIn;
      const upperOut = yHat + mae * cfg.multOut;
      const lowerOut = yHat - mae * cfg.multOut;
      // Velocity and acceleration
      const vel = k > 0 ? yHat - s.yHat[k - 1] : NaN;
      s.velocity[k] = vel;
      const accel = k > 0 ? vel - s.velocity[k - 1] : NaN;
      const velVis = s.velVis.step(vel);
      const velStdev = s.velStdev.step(vel, 20);

      const isTrending = gt(Math.abs(vel), velStdev * 0.5);
      const velMax = velStdev * 2.0;
      const dynCol = gt(velVis, 0)
        ? color.from_gradient(velVis, 0, velMax, cfg.colNeut, cfg.colBull)
        : color.from_gradient(velVis, -velMax, 0, cfg.colBear, cfg.colNeut);
      const bullWeaken = gt(vel, 0) && lt(accel, 0);
      const bearWeaken = lt(vel, 0) && gt(accel, 0);
      const { high, low, close, open } = b;
      const sellRejOut = gt(high, upperOut) && lt(close, upperOut) && lt(close, open);
      const buyRejOut = lt(low, lowerOut) && gt(close, lowerOut) && gt(close, open);
      const sellRejIn = gt(high, upperIn) && lt(close, upperIn) && lt(close, open);
      const buyRejIn = lt(low, lowerIn) && gt(close, lowerIn) && gt(close, open);
      const newSellOut = sellRejOut && !v.prevSellOut;
      const newBuyOut = buyRejOut && !v.prevBuyOut;
      const newSellIn = sellRejIn && !v.prevSellIn;
      const newBuyIn = buyRejIn && !v.prevBuyIn;
      v.prevSellOut = sellRejOut;
      v.prevBuyOut = buyRejOut;
      v.prevSellIn = sellRejIn;
      v.prevBuyIn = buyRejIn;
      let signalShort: boolean;
      let signalLong: boolean;
      if (isTrending) {
        signalShort = newSellOut && bullWeaken;
        signalLong = newBuyOut && bearWeaken;
      } else if (cfg.filterRng) {
        signalShort = newSellIn && bullWeaken;
        signalLong = newBuyIn && bearWeaken;
      } else {
        signalShort = newSellIn;
        signalLong = newBuyIn;
      }
      const buySignal = signalLong && (!cfg.strictAlternation || v.lastSignal !== 1);
      const sellSignal = signalShort && (!cfg.strictAlternation || v.lastSignal !== -1);
      s.flags[0][k] = buySignal;
      s.flags[1][k] = sellSignal;
      if (buySignal) s.times[0].push(t as number);
      if (sellSignal) s.times[1].push(t as number);
      if (buySignal) v.lastSignal = 1;
      else if (sellSignal) v.lastSignal = -1;
      // plotshape(show_buy_sell and buy_signal, 'BUY', shape.labelup, location.belowbar, col_bull, 'BUY', black, small)
      if (cfg.showBuySell && buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.colBull, text: 'BUY',
          textColor: color.black, size: 'small' });
      }
      // plotshape(show_buy_sell and sell_signal, 'SELL', shape.labeldown, location.abovebar, col_bear, 'SELL', white, small)
      if (cfg.showBuySell && sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.colBear, text: 'SELL',
          textColor: color.white, size: 'small' });
      }

      const c50 = String(color.new(dynCol, 50));
      const c60 = String(color.new(dynCol, 60));
      const c80 = String(color.new(dynCol, 80));
      s.c90[k] = String(color.new(dynCol, 90));
      s.c80[k] = c80;
      s.plots[0][k] = { time: t, value: yHat, color: dynCol };
      s.plots[1][k] = { time: t, value: yHat, color: c50 };
      s.plots[2][k] = { time: t, value: yHat, color: c80 };
      s.plots[3][k] = { time: t, value: yHat };
      s.plots[4][k] = { time: t, value: upperIn, color: c80 };
      s.plots[5][k] = { time: t, value: lowerIn, color: c80 };
      s.plots[6][k] = { time: t, value: upperOut, color: c60 };
      s.plots[7][k] = { time: t, value: lowerOut, color: c60 };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bull Zone' }, colors: s.c90.slice() },
          { plot1: 'plot3', plot2: 'plot5', options: { title: 'Bear Zone' }, colors: s.c90.slice() },
          { plot1: 'plot4', plot2: 'plot6', options: { title: 'Bull Extreme' }, colors: s.c80.slice() },
          { plot1: 'plot5', plot2: 'plot7', options: { title: 'Bear Extreme' }, colors: s.c80.slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(buy_signal, 'BUY Alert') / alertcondition(sell_signal, 'SELL Alert')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceFlowBuySellInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceFlowBuySellInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Alert', message: 'BUY signal on {{ticker}} at {{close}}' },
  { id: 'alert1', title: 'SELL Alert', message: 'SELL signal on {{ticker}} at {{close}}' },
];

export const PriceFlowBuySell = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  alertConditions,
};
