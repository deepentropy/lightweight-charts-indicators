/**
 * Universal Large Orders Proxy
 *
 * Buy / sell pressure of each bar: volume * close position in the range (or 1 - position) * (1 + body / range).
 * Each pressure gets a z-score against the SMA and the standard deviation of the previous `lookback` bars. A buy
 * signal needs a z-score above `sigma`, a volume above `volMult` times the previous average volume, a range above
 * `rangeMult` times the previous average range, a bullish body of at least `bodyMin` of the range, a close near the
 * high and a small upper wick (and the close above the EMA with the trend filter); sell signals mirror it. A cooldown
 * of `cooldownBars` bars applies after a signal. Circles at (low + close) / 2 (buy) or (high + close) / 2 (sell) are
 * small, medium or large for a z-score above sigma, sigma + 1 or sigma + 2.
 * Alerts (alertcondition, `alerts` of the result): 'Large Buy Pressure' / 'Large Sell Pressure' on every buy / sell
 * signal (z-score above sigma), 'Extreme Buy Pressure' / 'Extreme Sell Pressure' above sigma + 2.
 *
 * Reference: "Universal Large Orders Proxy" by boss11233
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UniversalLargeOrdersProxyInputs {
  lookback: number;
  /** Pressure z-score threshold */
  sigma: number;
  /** Minimal volume vs the average volume */
  volMult: number;
  /** Minimal range vs the average range */
  rangeMult: number;
  /** Minimal body part of the range */
  bodyMin: number;
  /** Close near the extreme (part of the range) */
  extremePct: number;
  /** Maximal opposite wick part of the range */
  wickMax: number;
  useTrend: boolean;
  emaLen: number;
  cooldownBars: number;
  buyColor: string;
  sellColor: string;
  showBuys: boolean;
  showSells: boolean;
  showEMA: boolean;
}

export const defaultInputs: UniversalLargeOrdersProxyInputs = {
  lookback: 30,
  sigma: 2.3,
  volMult: 1.35,
  rangeMult: 1.15,
  bodyMin: 0.45,
  extremePct: 0.8,
  wickMax: 0.35,
  useTrend: false,
  emaLen: 50,
  cooldownBars: 1,
  buyColor: 'rgba(0, 230, 118, 0.65)',
  sellColor: 'rgba(242, 54, 69, 0.65)',
  showBuys: true,
  showSells: true,
  showEMA: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 30, min: 10, max: 200 },
  { id: 'sigma', type: 'float', title: 'Pressure Sigma', defval: 2.3, min: 0.5, step: 0.1 },
  { id: 'volMult', type: 'float', title: 'Min Volume vs Average', defval: 1.35, min: 1.0, step: 0.05 },
  { id: 'rangeMult', type: 'float', title: 'Min Range vs Average', defval: 1.15, min: 1.0, step: 0.05 },
  { id: 'bodyMin', type: 'float', title: 'Min Body % of Range', defval: 0.45, min: 0.1, max: 1.0, step: 0.05 },
  { id: 'extremePct', type: 'float', title: 'Close Near Extreme %', defval: 0.8, min: 0.5, max: 1.0, step: 0.05 },
  { id: 'wickMax', type: 'float', title: 'Max Opposite Wick %', defval: 0.35, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'useTrend', type: 'bool', title: 'Use Trend Filter', defval: false },
  { id: 'emaLen', type: 'int', title: 'Trend EMA Length', defval: 50, min: 1 },
  { id: 'cooldownBars', type: 'int', title: 'Signal Cooldown Bars', defval: 1, min: 0, max: 20 },
  { id: 'buyColor', type: 'color', title: 'Buy Circle', defval: 'rgba(0, 230, 118, 0.65)' },
  { id: 'sellColor', type: 'color', title: 'Sell Circle', defval: 'rgba(242, 54, 69, 0.65)' },
  { id: 'showBuys', type: 'bool', title: 'Show Buy Signals', defval: true },
  { id: 'showSells', type: 'bool', title: 'Show Sell Signals', defval: true },
  { id: 'showEMA', type: 'bool', title: 'Show EMA', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: String(color.new(color.yellow, 0)), lineWidth: 1 },
];

export const metadata = {
  title: 'Universal Large Orders Proxy',
  shortTitle: 'Large Orders Final',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface UloRun extends BarRunState<{ lastBuyBar: number; lastSellBar: number }> {
  avgBuy: WindowSma;
  stdBuy: WindowStdev;
  avgSell: WindowSma;
  stdSell: WindowStdev;
  avgVol: WindowSma;
  avgRange: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  /** ta.sma / ta.stdev of each bar (read one bar later: [1]) */
  aBuy: number[];
  sBuy: number[];
  aSell: number[];
  sSell: number[];
  aVol: number[];
  aRange: number[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<UniversalLargeOrdersProxyInputs>): BarStudy<UloRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = cfg.lookback;
  const emaColor = String(color.new(color.yellow, 0));
  return {
    init() {
      const s: UloRun = {
        avgBuy: new WindowSma(lb), stdBuy: new WindowStdev(lb), avgSell: new WindowSma(lb), stdSell: new WindowStdev(lb),
        avgVol: new WindowSma(lb), avgRange: new WindowSma(lb), ema: taStep.ema(cfg.emaLen),
        aBuy: [], sBuy: [], aSell: [], sSell: [], aVol: [], aRange: [], plot0: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { lastBuyBar: NaN, lastSellBar: NaN }, lists: [], series: [],
      };
      s.steps = [s.avgBuy, s.stdBuy, s.avgSell, s.stdSell, s.avgVol, s.avgRange, s.ema];
      s.lists = [...s.times, s.markers];
      s.series = [s.aBuy, s.sBuy, s.aSell, s.sSell, s.aVol, s.aRange, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // Core candle stats
      const r = b.high - b.low;
      const zero = eq(r, 0.0);
      const body = Math.abs(b.close - b.open);
      const bodyPct = zero ? 0.0 : body / r;
      const upperWick = zero ? 0.0 : (b.high - Math.max(b.open, b.close)) / r;
      const lowerWick = zero ? 0.0 : (Math.min(b.open, b.close) - b.low) / r;
      const closePos = zero ? 0.5 : (b.close - b.low) / r;
      const rangeBoost = zero ? 0.0 : 1.0 + bodyPct;
      const volume = b.volume ?? NaN;
      const buyPressure = zero ? 0.0 : volume * closePos * rangeBoost;
      const sellPressure = zero ? 0.0 : volume * (1.0 - closePos) * rangeBoost;

      // ta.*(x, lookback)[1]
      s.aBuy[i] = s.avgBuy.step(buyPressure);
      s.sBuy[i] = s.stdBuy.step(buyPressure);
      s.aSell[i] = s.avgSell.step(sellPressure);
      s.sSell[i] = s.stdSell.step(sellPressure);
      s.aVol[i] = s.avgVol.step(volume);
      s.aRange[i] = s.avgRange.step(r);
      const avgBuy = i > 0 ? s.aBuy[i - 1] : NaN;
      const stdBuy = i > 0 ? s.sBuy[i - 1] : NaN;
      const avgSell = i > 0 ? s.aSell[i - 1] : NaN;
      const stdSell = i > 0 ? s.sSell[i - 1] : NaN;
      const avgVol = i > 0 ? s.aVol[i - 1] : NaN;
      const avgRange = i > 0 ? s.aRange[i - 1] : NaN;
      const ema = s.ema.step(b.close);

      // A plain division: x / 0 is +-infinity (0 / 0 NaN); stdBuy == 0.0 is the Pine guard
      const buyZ = eq(stdBuy, 0.0) ? 0.0 : (buyPressure - avgBuy) / stdBuy;
      const sellZ = eq(stdSell, 0.0) ? 0.0 : (sellPressure - avgSell) / stdSell;
      const highVol = gt(volume, avgVol * cfg.volMult);
      const wideRange = gt(r, avgRange * cfg.rangeMult);
      const closeNearHigh = ge(closePos, cfg.extremePct);
      const closeNearLow = le(closePos, 1.0 - cfg.extremePct);
      const goodBullShape = gt(b.close, b.open) && ge(bodyPct, cfg.bodyMin) && closeNearHigh
        && le(upperWick, cfg.wickMax);
      const goodBearShape = lt(b.close, b.open) && ge(bodyPct, cfg.bodyMin) && closeNearLow
        && le(lowerWick, cfg.wickMax);
      const bullTrendOk = !cfg.useTrend || gt(b.close, ema);
      const bearTrendOk = !cfg.useTrend || lt(b.close, ema);

      const buyBase = cfg.showBuys && highVol && wideRange && goodBullShape && bullTrendOk;
      const sellBase = cfg.showSells && highVol && wideRange && goodBearShape && bearTrendOk;
      const rawBuy1 = buyBase && gt(buyZ, cfg.sigma);
      const rawBuy2 = buyBase && gt(buyZ, cfg.sigma + 1.0);
      const rawBuy3 = buyBase && gt(buyZ, cfg.sigma + 2.0);
      const rawSell1 = sellBase && gt(sellZ, cfg.sigma);
      const rawSell2 = sellBase && gt(sellZ, cfg.sigma + 1.0);
      const rawSell3 = sellBase && gt(sellZ, cfg.sigma + 2.0);

      // Cooldown filter (integer bar counts)
      const buyCooldownOk = isNaN(v.lastBuyBar) || i - v.lastBuyBar > cfg.cooldownBars;
      const sellCooldownOk = isNaN(v.lastSellBar) || i - v.lastSellBar > cfg.cooldownBars;
      const buy1 = rawBuy1 && buyCooldownOk;
      const buy2 = rawBuy2 && buyCooldownOk;
      const buy3 = rawBuy3 && buyCooldownOk;
      const sell1 = rawSell1 && sellCooldownOk;
      const sell2 = rawSell2 && sellCooldownOk;
      const sell3 = rawSell3 && sellCooldownOk;
      if (buy1 || buy2 || buy3) v.lastBuyBar = i;
      if (sell1 || sell2 || sell3) v.lastSellBar = i;
      // alertcondition(buy1) / (sell1) / (buy3) / (sell3)
      const f = s.flags;
      f[0][i] = buy1;
      f[1][i] = sell1;
      f[2][i] = buy3;
      f[3][i] = sell3;
      for (let k = 0; k < 4; k++) if (f[k][i]) s.times[k].push(b.time as number);

      // math.avg(low, close) / math.avg(high, close); plotshape(..., shape.circle, location.absolute)
      const buyPos = (b.low + b.close) / 2;
      const sellPos = (b.high + b.close) / 2;
      const circle = (price: number, c: string, size: 'small' | 'normal' | 'large', id: string) => {
        if (!isNaN(price)) s.markers.push({ time: b.time, position: 'atPriceMiddle', price, shape: 'circle', color: c, size, id });
      };
      if (buy1 && !buy2) circle(buyPos, cfg.buyColor, 'small', 'shape0');
      if (buy2 && !buy3) circle(buyPos, cfg.buyColor, 'normal', 'shape1');
      if (buy3) circle(buyPos, cfg.buyColor, 'large', 'shape2');
      if (sell1 && !sell2) circle(sellPos, cfg.sellColor, 'small', 'shape3');
      if (sell2 && !sell3) circle(sellPos, cfg.sellColor, 'normal', 'shape4');
      if (sell3) circle(sellPos, cfg.sellColor, 'large', 'shape5');

      s.plot0[i] = { time: b.time, value: cfg.showEMA ? ema : NaN, color: emaColor };
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
export function createRun(inputs: Partial<UniversalLargeOrdersProxyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UniversalLargeOrdersProxyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Large Buy Pressure', message: 'Large buy pressure detected' },
  { id: 'alert1', title: 'Large Sell Pressure', message: 'Large sell pressure detected' },
  { id: 'alert2', title: 'Extreme Buy Pressure', message: 'Extreme buy pressure detected' },
  { id: 'alert3', title: 'Extreme Sell Pressure', message: 'Extreme sell pressure detected' },
];

export const UniversalLargeOrdersProxy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
