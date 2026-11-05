/**
 * VWAP Predictive Breakout + RSI + OB + Trend/Chop
 *
 * The VWAP line with breakout signals. A long signal when the close crosses above the VWAP (close > VWAP, close[1] <
 * VWAP) after three closes above it, on a volume spike (volume > SMA(volume, 20) * multiplier), with a strong body
 * (body / (range + 0.001) > min), a rising RSI below the upper limit, a low near the last bullish engulfing low
 * (low < engulfing low + ATR(5)) and a clean candle (body > ATR * min and wicks / (body + 0.001) < ratio). The short
 * signal mirrors it. As in the source, the cross needs close[1] < VWAP and the three-close confirmation needs
 * close[1] > VWAP, so the long / short signals never fire. Circles mark the bullish / bearish engulfing bars. The background is green when trending
 * (ADX > threshold, |EMA fast - EMA slow| > 0.15 * ATR and a clean candle), red otherwise (choppy).
 * Alerts (alertcondition, `alerts` of the result): 'Predictive Long Entry' and 'Predictive Short Entry', true on the
 * bars of the long / short signals (so, as in the original, never).
 *
 * Timeframes: Pine `ta.vwap` resets on each new trading day (anchor timeframe.change("1D")). When each bar is one
 * trading day or more, it resets on every bar, so the VWAP is hlc3 of the bar (na when the volume is 0 or na). On
 * intraday bars (barInterval, the most frequent gap between bars, below one day) the reset needs the exchange time
 * zone and the session of the symbol: the port reads them from the optional third argument (see
 * src/chart-context.ts) and sums from the first bar of each trading day (from the first bar on the first day).
 * Without them calculate() throws an Error on intraday bars.
 *
 * Reference: "VWAP Predictive Breakout + RSI + OB + Trend/Chop" by Viggy02
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © vignesh_coumarane1994
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { barInterval } from '../bar-time';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';
import { executeScript, ta as scriptTa, hlc3 as scriptHlc3 } from 'oakscriptjs/script';

export interface VwapPredictiveBreakoutRsiObTrendChopInputs {
  /** Volume spike multiplier */
  volMultiplier: number;
  /** Min body size (as part of the range) */
  bodyStrength: number;
  /** RSI period */
  rsiPeriod: number;
  /** Max RSI for long */
  rsiUpper: number;
  /** Min RSI for short */
  rsiLower: number;
  /** ADX length */
  adxLen: number;
  /** ADX trend threshold */
  adxThreshold: number;
  /** ATR length */
  atrLen: number;
  /** Fast EMA length */
  emaFast: number;
  /** Slow EMA length */
  emaSlow: number;
  /** Bollinger band length */
  bbLen: number;
  /** Bollinger band multiplier */
  bbMult: number;
  /** Min body size (as part of the ATR) */
  candleBodyMin: number;
  /** Wick-to-body ratio threshold */
  wickRatioThreshold: number;
}

export const defaultInputs: VwapPredictiveBreakoutRsiObTrendChopInputs = {
  volMultiplier: 1.5,
  bodyStrength: 0.6,
  rsiPeriod: 14,
  rsiUpper: 65,
  rsiLower: 35,
  adxLen: 7,
  adxThreshold: 18,
  atrLen: 7,
  emaFast: 9,
  emaSlow: 21,
  bbLen: 12,
  bbMult: 1.5,
  candleBodyMin: 0.4,
  wickRatioThreshold: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'volMultiplier', type: 'float', title: 'Volume Spike Multiplier', defval: 1.5 },
  { id: 'bodyStrength', type: 'float', title: 'Min Body Size (as % of Range)', defval: 0.6 },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14 },
  { id: 'rsiUpper', type: 'int', title: 'Max RSI for Long', defval: 65 },
  { id: 'rsiLower', type: 'int', title: 'Min RSI for Short', defval: 35 },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 7 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Trend Threshold', defval: 18 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 7 },
  { id: 'emaFast', type: 'int', title: 'Fast EMA', defval: 9 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA', defval: 21 },
  { id: 'bbLen', type: 'int', title: 'Bollinger Band Length', defval: 12 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 1.5 },
  { id: 'candleBodyMin', type: 'float', title: 'Min Body Size (as % of ATR)', defval: 0.4 },
  { id: 'wickRatioThreshold', type: 'float', title: 'Wick-to-Body Ratio Threshold', defval: 1.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'VWAP Predictive Breakout + RSI + OB + Trend/Chop',
  shortTitle: 'VWAP Predictive Breakout + RSI + OB + Trend/Chop',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const DAY_SECONDS = 86400;

/**
 * ta.vwap(hlc3) on intraday bars: the script API function with its default anchor, a new trading day of the exchange
 * (from the time zone and the session of the chart context); as in Pine, the sums start on the first bar
 */
function intradayVwap(bars: Bar[], chart: ChartContext): number[] {
  let vwap: number[] = [];
  const context = { ...chart, timeframe: chart.timeframe ?? timeframe.from_seconds(barInterval(bars)) };
  executeScript(() => { vwap = scriptTa.vwap(scriptHlc3).toArray().map((v) => v ?? NaN); }, bars, {}, context);
  return vwap;
}

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (exact partials, as the oakscriptjs window sums: the same doubles), the previous result on a bar with
 * an na value. The kept partials are copied into a second buffer on a step (no allocation per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private p = new Float64Array(16);
  private n = 0;
  private q = new Float64Array(16);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  /** Adds `x` to the partials of `q` exactly (Shewchuk) */
  private add(x: number): void {
    let q = this.q;
    const n = this.qn;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = q[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) q[i++] = lo;
      x = hi;
    }
    if (i === q.length) {
      const grown = new Float64Array(q.length * 2);
      grown.set(q);
      this.q = q = grown;
    }
    q[i] = x;
    this.qn = i + 1;
  }

  /** The exact sum of the partials of `q` rounded once (round half to even) */
  private round(): number {
    const p = this.q;
    let n = this.qn;
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

  step(value: number): number {
    this.stepped = true;
    if (!(this.len >= 1)) { this.pending = NaN; this.next = NaN; return NaN; }
    if (value === undefined || value === null || !Number.isFinite(value)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    this.q.set(this.p.subarray(0, this.n));
    this.qn = this.n;
    const count = this.values.length;
    if (count >= this.len) this.add(-this.values[count - this.len]!);
    this.add(value);
    this.pending = value;
    this.next = count + 1 >= this.len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    const p = this.p;
    this.p = this.q;
    this.n = this.qn;
    this.q = p;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/** `ta.sma(source, length)` with a constant length: {@link WindowSum} divided by the length */
class WindowSma extends WindowSum {
  private readonly div: number;

  constructor(length: number) {
    super(length);
    this.div = Math.floor(length);
  }

  override step(value: number): number {
    return super.step(value) / this.div;
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface VwapVars {
  obBullLow: number; // var float obBullLow = na
  obBearHigh: number; // var float obBearHigh = na
}

interface VwapRun extends BarRunState<VwapVars> {
  /** ta.vwap of every bar on intraday bars (each update of intraday bars is a full run) */
  intradayVwap: number[] | null;
  volumeAvg: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  rmaPlus: ReturnType<typeof taStep.rma>;
  rmaMinus: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  atrOB: ReturnType<typeof taStep.atr>;
  atr: ReturnType<typeof taStep.atr>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  rsiArr: number[];
  plot: Array<{ time: number; value: number }>;
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

const isIntraday = (bars: Bar[]) => {
  const interval = barInterval(bars);
  return interval > 0 && interval < DAY_SECONDS;
};

function study(inputs: Partial<VwapPredictiveBreakoutRsiObTrendChopInputs>): BarStudy<VwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgTrend = String(color.new(color.green, 85));
  const bgChop = String(color.new(color.red, 85));
  let fullRuns = 0;
  return {
    // the timeframe from the bar gaps; on intraday bars the trading days of ta.vwap come from the whole set of bars
    // (the library's session rules): every update is a full run
    key: (bars) => (isIntraday(bars) ? `intraday ${++fullRuns}` : 'dwm'),
    init(bars, chart) {
      const intraday = isIntraday(bars);
      if (intraday && (chart?.timezone === undefined || chart.session === undefined)) {
        throw new Error(
          'VWAP Predictive Breakout + RSI + OB + Trend/Chop supports daily and higher timeframes only: on intraday bars '
          + 'ta.vwap resets on each trading day, which needs the exchange time zone and session.',
        );
      }
      const s: VwapRun = {
        intradayVwap: intraday ? intradayVwap(bars, chart) : null,
        volumeAvg: new WindowSma(20), rsi: taStep.rsi(cfg.rsiPeriod), tr: taStep.tr(), trur: taStep.rma(cfg.adxLen),
        rmaPlus: taStep.rma(cfg.adxLen), rmaMinus: taStep.rma(cfg.adxLen), adx: taStep.rma(cfg.adxLen),
        atrOB: taStep.atr(5), atr: taStep.atr(cfg.atrLen), ema1: taStep.ema(cfg.emaFast), ema2: taStep.ema(cfg.emaSlow),
        rsiArr: [], plot: [], markers: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { obBullLow: NaN, obBearHigh: NaN }, lists: [], series: [],
      };
      s.steps = [s.volumeAvg, s.rsi, s.tr, s.trur, s.rmaPlus, s.rmaMinus, s.adx, s.atrOB, s.atr, s.ema1, s.ema2];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.rsiArr, s.plot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const vars = s.vars;
      const b = bars[i];
      const c = b.close;
      const vol = b.volume ?? NaN;
      const prevBar = i > 0 ? bars[i - 1] : null;
      // ta.vwap (hlc3, anchor timeframe.change("1D")). Intraday bars: the sums restart on each trading day of the
      // exchange. Daily or higher bars: a new anchor on every bar, so sum(hlc3 * volume) / sum(volume) over the bar
      // alone (0 / 0 = na when the volume is 0, na when it is na)
      const v = s.intradayVwap ? s.intradayVwap[i] : (((b.high + b.low + b.close) / 3) * vol) / vol;
      const volumeAvg = s.volumeAvg.step(vol);
      const rsi = s.rsi.step(c);
      s.rsiArr[i] = rsi;

      // Trend / chop: hand-written ADX
      let plusDM = 0;
      let minusDM = 0;
      if (prevBar) {
        const upMove = b.high - prevBar.high;
        const downMove = prevBar.low - b.low;
        plusDM = gt(upMove, downMove) && gt(upMove, 0) ? upMove : 0;
        minusDM = gt(downMove, upMove) && gt(downMove, 0) ? downMove : 0;
      }
      const trur = s.trur.step(s.tr.step(b.high, b.low, c));
      // Plain divisions: x / 0 is +-infinity, 0 / 0 na (ta.rma skips both)
      const plusDI = (100 * s.rmaPlus.step(plusDM)) / trur;
      const minusDI = (100 * s.rmaMinus.step(minusDM)) / trur;
      const adx = s.adx.step((100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI));

      const atrOB = s.atrOB.step(b.high, b.low, c);
      const atr = s.atr.step(b.high, b.low, c);
      const ema1 = s.ema1.step(c);
      const ema2 = s.ema2.step(c);
      // basis / dev / bbWidth feed breakoutUp / breakoutDown, which the script does not plot: not computed

      const c1 = i > 0 ? bars[i - 1].close : NaN;
      const c2 = i > 1 ? bars[i - 2].close : NaN;
      const o1 = i > 0 ? bars[i - 1].open : NaN;

      const volSpike = gt(vol, volumeAvg * cfg.volMultiplier);
      const candleRange = b.high - b.low;
      const candleBody = Math.abs(c - b.open);
      const strongBody = gt(candleBody / (candleRange + 0.001), cfg.bodyStrength);

      const rsiPrev = i > 0 ? s.rsiArr[i - 1] : NaN;
      const rsiBull = lt(rsi, cfg.rsiUpper) && gt(rsi, rsiPrev);
      const rsiBear = gt(rsi, cfg.rsiLower) && lt(rsi, rsiPrev);

      const crossUp = gt(c, v) && lt(c1, v);
      const crossDown = lt(c, v) && gt(c1, v);
      const aboveConfirm = gt(c, v) && gt(c1, v) && gt(c2, v);
      const belowConfirm = lt(c, v) && lt(c1, v) && lt(c2, v);

      // Order block (engulfing)
      const bullEngulf = gt(c, b.open) && lt(b.open, c1) && gt(c, o1);
      const bearEngulf = lt(c, b.open) && gt(b.open, c1) && lt(c, o1);
      if (bullEngulf) vars.obBullLow = b.low;
      if (bearEngulf) vars.obBearHigh = b.high;
      const nearBullOB = !isNaN(vars.obBullLow) && lt(b.low, vars.obBullLow + atrOB);
      const nearBearOB = !isNaN(vars.obBearHigh) && gt(b.high, vars.obBearHigh - atrOB);

      // Candle behaviour
      const bodySize = Math.abs(c - b.open);
      const upperWick = b.high - Math.max(c, b.open);
      const lowerWick = Math.min(c, b.open) - b.low;
      const wickToBodyRatio = (upperWick + lowerWick) / (bodySize + 0.001);
      const strongCandle = gt(bodySize, atr * cfg.candleBodyMin);
      const lowWickRatio = lt(wickToBodyRatio, cfg.wickRatioThreshold);
      const cleanCandle = strongCandle && lowWickRatio;

      const emaDistance = Math.abs(ema1 - ema2);
      const isTrending = gt(adx, cfg.adxThreshold) && gt(emaDistance, atr * 0.15) && cleanCandle;

      const predictUp = crossUp && volSpike && strongBody && aboveConfirm && rsiBull && nearBullOB && cleanCandle;
      const predictDown = crossDown && volSpike && strongBody && belowConfirm && rsiBear && nearBearOB && cleanCandle;
      // alertcondition(predictUp, "Predictive Long Entry") / alertcondition(predictDown, "Predictive Short Entry")
      s.flags[0][i] = predictUp;
      s.flags[1][i] = predictDown;
      if (predictUp) s.times[0].push(b.time as number);
      if (predictDown) s.times[1].push(b.time as number);

      if (predictUp) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: '↑BUY',
          textColor: '#2962FF', size: 'small' });
      }
      if (predictDown) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: '↓SELL',
          textColor: '#2962FF', size: 'small' });
      }
      if (bullEngulf) s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: color.green, size: 'tiny' });
      if (bearEngulf) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: color.red, size: 'tiny' });

      // bgcolor(isTrending ? green 85 : na); bgcolor(isChoppy ? red 85 : na) with isChoppy = not isTrending
      s.bgColors.push({ time: b.time, color: isTrending ? bgTrend : bgChop });
      s.plot[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwapPredictiveBreakoutRsiObTrendChopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwapPredictiveBreakoutRsiObTrendChopInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Predictive Long Entry', message: 'Long: VWAP breakout + RSI + OB + Clean Candle' },
  { id: 'alert1', title: 'Predictive Short Entry', message: 'Short: VWAP breakdown + RSI + OB + Clean Candle' },
];

export const VwapPredictiveBreakoutRsiObTrendChop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
