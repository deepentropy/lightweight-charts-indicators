/**
 * Big Trades Bubbles, Absorptions and Deep Pressure
 *
 * Buy and sell pressure proxies from the close location in the bar range times the volume:
 * buy = (close - low) / range * volume, sell = (high - close) / range * volume. A proxy is an anomaly when its
 * z-score against the SMA / standard deviation of the previous `lookback` bars is above the sigma threshold.
 * Anomalies with a close in the upper (buy) or lower (sell) part of the bar and a large enough body give bubbles,
 * in three sizes by the z-score. Anomalies with a small body and a close that fights the direction give absorption
 * diamonds. Deep pressure dots mark bars where the SMA and the EMA of the net pressure (buy - sell) agree with the
 * close location.
 * Alerts (alertcondition, `alerts` of the result): big buy / sell, bull / bear absorption, deep buy / sell pressure.
 *
 * Reference: "Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure" by samet_lezki
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © samet_lezki
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PineSize } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface BigTradesBubblesInputs {
  /** Lookback of the proxy SMA / standard deviation (previous bars) */
  lookback: number;
  /** Base sigma threshold of the z-score */
  sigmaBase: number;
  /** Show the small (weak) bubbles */
  showWeak: boolean;
  buyColor: string;
  sellColor: string;
  /** Bubble position: 'Inside Candle' or 'Above/Below Candle' */
  posMode: 'Inside Candle' | 'Above/Below Candle';
  /** Minimum body / range of a bubble bar */
  minBodyRatio: number;
  /** Require volume > the average volume of the previous `lookback` bars */
  useVolFilter: boolean;
  showAbsorption: boolean;
  /** Maximum body / range of an absorption bar */
  absBodyMax: number;
  absBuyColor: string;
  absSellColor: string;
  showDeepPressure: boolean;
  /** SMA length of the net pressure */
  dpLen: number;
  /** EMA length of the net pressure */
  dpEmaLen: number;
  dpBuyColor: string;
  dpSellColor: string;
}

const BUY_COLOR = String(color.new(color.lime, 51));
const SELL_COLOR = String(color.new(color.red, 51));
const ABS_BUY_COLOR = String(color.new(color.aqua, 0));
const ABS_SELL_COLOR = String(color.new(color.orange, 0));
const DP_BUY_COLOR = String(color.new(color.green, 0));
const DP_SELL_COLOR = String(color.new(color.maroon, 0));

export const defaultInputs: BigTradesBubblesInputs = {
  lookback: 2,
  sigmaBase: 1.5,
  showWeak: true,
  buyColor: BUY_COLOR,
  sellColor: SELL_COLOR,
  posMode: 'Inside Candle',
  minBodyRatio: 0.15,
  useVolFilter: false,
  showAbsorption: true,
  absBodyMax: 0.55,
  absBuyColor: ABS_BUY_COLOR,
  absSellColor: ABS_SELL_COLOR,
  showDeepPressure: true,
  dpLen: 10,
  dpEmaLen: 20,
  dpBuyColor: DP_BUY_COLOR,
  dpSellColor: DP_SELL_COLOR,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 2, min: 1 },
  { id: 'sigmaBase', type: 'float', title: 'Base Sigma Threshold', defval: 1.5, min: 0.5, step: 0.1 },
  { id: 'showWeak', type: 'bool', title: 'Show Weak Signals', defval: true },
  { id: 'buyColor', type: 'color', title: 'Buy Bubble', defval: BUY_COLOR },
  { id: 'sellColor', type: 'color', title: 'Sell Bubble', defval: SELL_COLOR },
  { id: 'posMode', type: 'string', title: 'Bubble Position', defval: 'Inside Candle', options: ['Inside Candle', 'Above/Below Candle'] },
  { id: 'minBodyRatio', type: 'float', title: 'Min Body/Range Filter', defval: 0.15, min: 0.0, max: 1.0, step: 0.01 },
  { id: 'useVolFilter', type: 'bool', title: 'Require Volume > Average', defval: false },
  { id: 'showAbsorption', type: 'bool', title: 'Show Absorption Bars', defval: true },
  { id: 'absBodyMax', type: 'float', title: 'Max Body/Range For Absorption', defval: 0.55, min: 0.05, max: 1.0, step: 0.01 },
  { id: 'absBuyColor', type: 'color', title: 'Bull Absorption Color', defval: ABS_BUY_COLOR },
  { id: 'absSellColor', type: 'color', title: 'Bear Absorption Color', defval: ABS_SELL_COLOR },
  { id: 'showDeepPressure', type: 'bool', title: 'Show Deep Pressure', defval: true },
  { id: 'dpLen', type: 'int', title: 'Deep Pressure Length', defval: 10, min: 2, max: 20 },
  { id: 'dpEmaLen', type: 'int', title: 'Pressure EMA Length', defval: 20, min: 1, max: 20 },
  { id: 'dpBuyColor', type: 'color', title: 'Deep Buy Color', defval: DP_BUY_COLOR },
  { id: 'dpSellColor', type: 'color', title: 'Deep Sell Color', defval: DP_SELL_COLOR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure',
  shortTitle: 'BigTrades & Absorption & Presure',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

/** Non-overlapping partials of an exact sum (Shewchuk), in a typed array with a count */
class Partials {
  p = new Float64Array(32);
  n = 0;

  copyFrom(o: Partials): void {
    if (this.p.length < o.p.length) this.p = new Float64Array(o.p.length);
    this.p.set(o.p.subarray(0, o.n));
    this.n = o.n;
  }

  add(x: number): void {
    const p = this.p;
    const n = this.n;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = p[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) p[i++] = lo;
      x = hi;
    }
    if (i === p.length) {
      const grown = new Float64Array(p.length * 2);
      grown.set(p);
      this.p = grown;
    }
    this.p[i] = x;
    this.n = i + 1;
  }

  /** The exact sum rounded once (round half to even) */
  round(): number {
    const p = this.p;
    let n = this.n;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }
}

/**
 * `math.sum(x, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * finite values, NaN while fewer exist; a bar with an na value keeps the previous result (the doubles of the `taStep`
 * sums, without a copy of the state per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private kept = new Partials();
  private next = new Partials();
  private last = NaN;
  private pendingX = NaN;
  private pendingSum = NaN;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(x: number): number {
    this.stepped = true;
    this.pendingX = x;
    if (!Number.isFinite(x)) return (this.pendingSum = this.last);
    const q = this.next;
    q.copyFrom(this.kept);
    const count = this.values.length;
    if (count >= this.length) q.add(-this.values[count - this.length]!);
    q.add(x);
    return (this.pendingSum = count + 1 >= this.length ? q.round() : NaN);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.pendingSum;
    if (!Number.isFinite(this.pendingX)) return;
    const k = this.kept;
    this.kept = this.next;
    this.next = k;
    this.values.push(this.pendingX);
    if (this.values.length > this.length + 4096) this.values = this.values.slice(-this.length);
  }
}

interface BigTradesRun extends BarRunState<Record<string, never>> {
  /** Window sums of the proxies, of their squares (ta.sma / ta.stdev) and of the volume */
  sumBuy: WindowSum;
  sqBuy: WindowSum;
  sumSell: WindowSum;
  sqSell: WindowSum;
  sumVol: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  pMean: WindowSum;
  pEma: ReturnType<typeof taStep.ema>;
  /** ta.sma / ta.stdev of the proxies and ta.sma(volume) of each bar (read on the next bar: [1]) */
  smaBuy: number[];
  sdBuy: number[];
  smaSell: number[];
  sdSell: number[];
  smaVol: number[];
  plot0: { time: number; value: number; color: string }[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.stdev (biased) from the window sums of the values and of their squares */
function stdev(sum: number, sq: number, len: number): number {
  const mean = sum / len;
  const v = sq / len - mean * mean;
  return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
}

function study(inputs: Partial<BigTradesBubblesInputs>): BarStudy<BigTradesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const inside = cfg.posMode === 'Inside Candle';
  const strong = cfg.sigmaBase + 1.5;
  const large = cfg.sigmaBase + 3.0;
  return {
    init() {
      const sumBuy = new WindowSum(cfg.lookback);
      const sqBuy = new WindowSum(cfg.lookback);
      const sumSell = new WindowSum(cfg.lookback);
      const sqSell = new WindowSum(cfg.lookback);
      const sumVol = new WindowSum(cfg.lookback);
      const atr = taStep.atr(14);
      const pMean = new WindowSum(cfg.dpLen);
      const pEma = taStep.ema(cfg.dpEmaLen);
      const s: BigTradesRun = {
        sumBuy, sqBuy, sumSell, sqSell, sumVol, atr, pMean, pEma,
        smaBuy: [], sdBuy: [], smaSell: [], sdSell: [], smaVol: [], plot0: [], markers: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [sumBuy, sqBuy, sumSell, sqSell, sumVol, atr, pMean, pEma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.smaBuy, s.sdBuy, s.smaSell, s.sdSell, s.smaVol, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);
      // id: the plotshape output (shape0..9 in the original's order)
      const shape = (id: string, price: number, sh: 'circle' | 'diamond', c: string, size: PineSize) => {
        // plotshape(cond ? y : na, location = location.absolute): nothing drawn when y is na
        if (!isNaN(price)) s.markers.push({ id, time: t, position: 'atPriceMiddle', price, shape: sh, color: c, size });
      };

      // Base calculations
      const rng = b.high - b.low;
      const bodyRatio = gt(rng, 0) ? Math.abs(b.close - b.open) / rng : 0.0;
      const closeLoc = gt(rng, 0) ? (b.close - b.low) / rng : 0.5;
      const volume = b.volume ?? NaN;
      const buyProxy = gt(rng, 0) ? ((b.close - b.low) / rng) * volume : 0.0;
      const sellProxy = gt(rng, 0) ? ((b.high - b.close) / rng) * volume : 0.0;
      const netPressure = buyProxy - sellProxy;

      // ta.sma / ta.stdev of the proxies and ta.sma(volume) of the previous bars ([1])
      const len = cfg.lookback;
      const sumBuy = s.sumBuy.step(buyProxy);
      s.smaBuy[i] = sumBuy / len;
      s.sdBuy[i] = stdev(sumBuy, s.sqBuy.step(buyProxy * buyProxy), len);
      const sumSell = s.sumSell.step(sellProxy);
      s.smaSell[i] = sumSell / len;
      s.sdSell[i] = stdev(sumSell, s.sqSell.step(sellProxy * sellProxy), len);
      s.smaVol[i] = s.sumVol.step(volume) / len;
      const atrVal = s.atr.step(b.high, b.low, b.close);
      const pressureMean = s.pMean.step(netPressure) / cfg.dpLen;
      const pressureEma = s.pEma.step(netPressure);

      const avgBuy = prev(s.smaBuy);
      const stdBuy = prev(s.sdBuy);
      const avgSell = prev(s.smaSell);
      const stdSell = prev(s.sdSell);
      const avgVol = prev(s.smaVol);

      const buyZ = !isNaN(stdBuy) && gt(stdBuy, 0) ? (buyProxy - avgBuy) / stdBuy : 0.0;
      const sellZ = !isNaN(stdSell) && gt(stdSell, 0) ? (sellProxy - avgSell) / stdSell : 0.0;
      const buyAnomaly = gt(buyZ, cfg.sigmaBase);
      const sellAnomaly = gt(sellZ, cfg.sigmaBase);

      const buyQuality = gt(closeLoc, 0.55) && ge(bodyRatio, cfg.minBodyRatio);
      const sellQuality = lt(closeLoc, 0.45) && ge(bodyRatio, cfg.minBodyRatio);
      const volPass = !cfg.useVolFilter || gt(volume, avgVol);

      const finalBuy = buyAnomaly && buyQuality && volPass;
      const finalSell = sellAnomaly && sellQuality && volPass;
      const buyPlot = finalBuy && (cfg.showWeak || gt(buyZ, strong));
      const sellPlot = finalSell && (cfg.showWeak || gt(sellZ, strong));

      // Positioning
      const buyY = inside ? (b.low + b.close) / 2 : b.low - atrVal * 0.15;
      const sellY = inside ? (b.high + b.close) / 2 : b.high + atrVal * 0.15;

      // Size buckets
      const buySmall = buyPlot && le(buyZ, strong);
      const buyMedium = finalBuy && gt(buyZ, strong) && le(buyZ, large);
      const buyLarge = finalBuy && gt(buyZ, large);
      const sellSmall = sellPlot && le(sellZ, strong);
      const sellMedium = finalSell && gt(sellZ, strong) && le(sellZ, large);
      const sellLarge = finalSell && gt(sellZ, large);

      // Absorption
      const bullAbsorption = cfg.showAbsorption && buyAnomaly && volPass && le(bodyRatio, cfg.absBodyMax)
        && lt(closeLoc, 0.70);
      const bearAbsorption = cfg.showAbsorption && sellAnomaly && volPass && le(bodyRatio, cfg.absBodyMax)
        && gt(closeLoc, 0.30);

      // Deep pressure
      const deepBuy = cfg.showDeepPressure && gt(pressureMean, 0) && gt(pressureEma, 0) && gt(closeLoc, 0.45)
        && !finalSell;
      const deepSell = cfg.showDeepPressure && lt(pressureMean, 0) && lt(pressureEma, 0) && lt(closeLoc, 0.55)
        && !finalBuy;

      // Pine plotshape order: buy small / medium / large, sell small / medium / large, absorptions, deep pressure
      if (buySmall) shape('shape0', buyY, 'circle', cfg.buyColor, 'small');
      if (buyMedium) shape('shape1', buyY, 'circle', cfg.buyColor, 'normal');
      if (buyLarge) shape('shape2', buyY, 'circle', cfg.buyColor, 'large');
      if (sellSmall) shape('shape3', sellY, 'circle', cfg.sellColor, 'small');
      if (sellMedium) shape('shape4', sellY, 'circle', cfg.sellColor, 'normal');
      if (sellLarge) shape('shape5', sellY, 'circle', cfg.sellColor, 'large');
      if (bullAbsorption) shape('shape6', b.low - atrVal * 0.08, 'diamond', cfg.absBuyColor, 'tiny');
      if (bearAbsorption) shape('shape7', b.high + atrVal * 0.08, 'diamond', cfg.absSellColor, 'tiny');
      if (deepBuy) shape('shape8', b.low - atrVal * 0.03, 'circle', cfg.dpBuyColor, 'tiny');
      if (deepSell) shape('shape9', b.high + atrVal * 0.03, 'circle', cfg.dpSellColor, 'tiny');
      // plot(close)
      s.plot0[i] = { time: t, value: b.close, color: '#2962FF' };
      // alertcondition(finalBuy / finalSell / bullAbsorption / bearAbsorption / deepBuyPressure / deepSellPressure)
      const f = s.flags;
      f[0][i] = finalBuy;
      f[1][i] = finalSell;
      f[2][i] = bullAbsorption;
      f[3][i] = bearAbsorption;
      f[4][i] = deepBuy;
      f[5][i] = deepSell;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BigTradesBubblesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BigTradesBubblesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Big Buy', message: 'Big Buy pressure detected' },
  { id: 'alert1', title: 'Big Sell', message: 'Big Sell pressure detected' },
  { id: 'alert2', title: 'Bull Absorption', message: 'Bull absorption detected' },
  { id: 'alert3', title: 'Bear Absorption', message: 'Bear absorption detected' },
  { id: 'alert4', title: 'Deep Buy Pressure', message: 'Deep buy pressure detected' },
  { id: 'alert5', title: 'Deep Sell Pressure', message: 'Deep sell pressure detected' },
];

export const BigTradesBubbles = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
