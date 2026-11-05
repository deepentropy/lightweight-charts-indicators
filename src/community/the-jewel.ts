/**
 * The Jewel
 *
 * A momentum panel with a stochastic, a simple DMI / ADX and an EMA trend filter. The stochastic of the close
 * (K length) is smoothed twice by SMAs (K and D), and each line is scaled to 0-100 over its last 50 bars. DI+ / DI-
 * use SMAs of the directional moves and of the true range; the ADX is the SMA of the DX. The EMA is scaled to 0-100
 * over its normalization lookback. The background is green on a buy signal (K crosses above D, RSI above the buy
 * level, ADX above the threshold, close above the EMA), red on a sell signal (the mirror) and yellow on a caution
 * signal (RSI and scaled K both overbought or both oversold).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal', 'Sell Signal' and 'Caution Signal', true on the bars
 * of each signal (a caution signal also on the bars that show a buy / sell background).
 *
 * Reference: "The Jewel" by afonso_77
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Trigooo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface TheJewelInputs {
  useEMAFilter: boolean;
  emaLength: number;
  /** Number of bars used to find the min / max of the EMA for the 0-100 scaling */
  emaNormLookback: number;
  rsiPeriod: number;
  rsiBuyLevel: number;
  rsiSellLevel: number;
  stochKLength: number;
  stochDLength: number;
  /** SMA smoothing of StochK */
  stochSmoothK: number;
  /** SMA smoothing of StochD */
  stochSmoothD: number;
  useADXFilter: boolean;
  adxPeriod: number;
  adxThreshold: number;
  useCaution: boolean;
  rsiCautionHigh: number;
  rsiCautionLow: number;
  stochCautionHigh: number;
  stochCautionLow: number;
  buyColor: string;
  sellColor: string;
  cautionColor: string;
  plotStochKColor: string;
  plotStochDColor: string;
  plotDIPlusColor: string;
  plotDIMinusColor: string;
  plotADXColor: string;
}

export const defaultInputs: TheJewelInputs = {
  useEMAFilter: true,
  emaLength: 200,
  emaNormLookback: 100,
  rsiPeriod: 14,
  rsiBuyLevel: 55,
  rsiSellLevel: 45,
  stochKLength: 14,
  stochDLength: 3,
  stochSmoothK: 3,
  stochSmoothD: 3,
  useADXFilter: true,
  adxPeriod: 14,
  adxThreshold: 20,
  useCaution: true,
  rsiCautionHigh: 70,
  rsiCautionLow: 30,
  stochCautionHigh: 80,
  stochCautionLow: 20,
  buyColor: String(color.new(color.green, 65)),
  sellColor: String(color.new(color.red, 65)),
  cautionColor: String(color.new(color.yellow, 65)),
  plotStochKColor: color.aqua,
  plotStochDColor: color.blue,
  plotDIPlusColor: color.green,
  plotDIMinusColor: color.red,
  plotADXColor: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'useEMAFilter', type: 'bool', title: 'Use EMA Trend Filter?', defval: true },
  { id: 'emaLength', type: 'int', title: 'EMA Trend Length', defval: 200 },
  { id: 'emaNormLookback', type: 'int', title: 'EMA Normalization Lookback', defval: 100 },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14 },
  { id: 'rsiBuyLevel', type: 'float', title: 'RSI Buy Level', defval: 55 },
  { id: 'rsiSellLevel', type: 'float', title: 'RSI Sell Level', defval: 45 },
  { id: 'stochKLength', type: 'int', title: 'Stoch K Length', defval: 14 },
  { id: 'stochDLength', type: 'int', title: 'Stoch D Length', defval: 3 },
  { id: 'stochSmoothK', type: 'int', title: 'Stoch K Smoothing', defval: 3 },
  { id: 'stochSmoothD', type: 'int', title: 'Stoch D Smoothing', defval: 3 },
  { id: 'useADXFilter', type: 'bool', title: 'Use ADX Filter?', defval: true },
  { id: 'adxPeriod', type: 'int', title: 'ADX Period', defval: 14 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'useCaution', type: 'bool', title: 'Enable Caution Signals?', defval: true },
  { id: 'rsiCautionHigh', type: 'float', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiCautionLow', type: 'float', title: 'RSI Oversold Level', defval: 30 },
  { id: 'stochCautionHigh', type: 'float', title: 'Stoch Overbought Level', defval: 80 },
  { id: 'stochCautionLow', type: 'float', title: 'Stoch Oversold Level', defval: 20 },
  { id: 'buyColor', type: 'color', title: 'Buy BG Color', defval: String(color.new(color.green, 65)) },
  { id: 'sellColor', type: 'color', title: 'Sell BG Color', defval: String(color.new(color.red, 65)) },
  { id: 'cautionColor', type: 'color', title: 'Caution BG Color', defval: String(color.new(color.yellow, 65)) },
  { id: 'plotStochKColor', type: 'color', title: 'StochK Plot Color', defval: color.aqua },
  { id: 'plotStochDColor', type: 'color', title: 'StochD Plot Color', defval: color.blue },
  { id: 'plotDIPlusColor', type: 'color', title: 'DI+ Plot Color', defval: color.green },
  { id: 'plotDIMinusColor', type: 'color', title: 'DI- Plot Color', defval: color.red },
  { id: 'plotADXColor', type: 'color', title: 'ADX Plot Color', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA Filter (Normalized 0–100)', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: 'StochK', color: color.aqua, lineWidth: 2 },
  { id: 'plot2', title: 'StochD', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: 'DI+', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: 'DI-', color: color.red, lineWidth: 1 },
  { id: 'plot5', title: 'ADX', color: color.white, lineWidth: 1 },
];

/** hline(0, "Zero Line") / hline(100, "Max Line"), gray, Pine default style (dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_max', price: 100, title: 'Max Line', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: 'The Jewel',
  shortTitle: 'The Jewel',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, in constant time per bar (a
 * queue of the values that can still be the extreme): the extreme of the last `length` non-na values, na before bar
 * `length - 1`; +0 wins over -0 for the highest, -0 for the lowest (the doubles of taStep.highest / lowest).
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `b` (newer) replaces `a` in the queue: it is as extreme (the preferred zero is kept) */
  private replaces(a: number, b: number): boolean {
    if (this.lowest) return a > b || (a === b && !(Object.is(a, -0) && Object.is(b, 0)));
    return a < b || (a === b && !(Object.is(a, 0) && Object.is(b, -0)));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (this.bars < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    if (h >= this.ids.length) return value;
    const q = this.vals[h]!;
    if (!own) return q;
    return this.lowest ? Math.min(q, value) : Math.max(q, value);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const id = this.kept++;
    while (this.vals.length > this.head && this.replaces(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.ids.push(id);
    // the values out of the window of the next bars
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
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

type Sma = WindowSma;

interface JewelRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  emaMin: WindowExtreme;
  emaMax: WindowExtreme;
  rsi: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  stochDRaw: Sma;
  stochKSmooth: Sma;
  stochDSmooth: Sma;
  stochKMin: WindowExtreme;
  stochKMax: WindowExtreme;
  stochDMin: WindowExtreme;
  stochDMax: WindowExtreme;
  smthTR: Sma;
  smthPlusDM: Sma;
  smthMinusDM: Sma;
  adx: Sma;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TheJewelInputs>): BarStudy<JewelRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: JewelRun = {
        ema: taStep.ema(cfg.emaLength), emaMin: new WindowExtreme(true, cfg.emaNormLookback), emaMax: new WindowExtreme(false, cfg.emaNormLookback), rsi: taStep.rsi(cfg.rsiPeriod),
        stoch: taStep.stoch(cfg.stochKLength), stochDRaw: new WindowSma(cfg.stochDLength), stochKSmooth: new WindowSma(cfg.stochSmoothK),
        stochDSmooth: new WindowSma(cfg.stochSmoothD),
        stochKMin: new WindowExtreme(true, 50), stochKMax: new WindowExtreme(false, 50),
        stochDMin: new WindowExtreme(true, 50), stochDMax: new WindowExtreme(false, 50),
        smthTR: new WindowSma(cfg.adxPeriod), smthPlusDM: new WindowSma(cfg.adxPeriod),
        smthMinusDM: new WindowSma(cfg.adxPeriod), adx: new WindowSma(cfg.adxPeriod),
        crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        plots: Array.from({ length: 6 }, () => []),
        bgColors: [],
        flags: [[], [], []],
        times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.ema, s.emaMin, s.emaMax, s.rsi, s.stoch, s.stochDRaw, s.stochKSmooth, s.stochDSmooth, s.stochKMin, s.stochKMax,
        s.stochDMin, s.stochDMax, s.smthTR, s.smthPlusDM, s.smthMinusDM, s.adx, s.crossUp, s.crossDown,
      ];
      s.lists = [s.bgColors, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;

      // EMA trend filter, normalized to 0-100 for the plot
      const emaVal = s.ema.step(c);
      const emaMin = s.emaMin.step(emaVal);
      const emaMax = s.emaMax.step(emaVal);
      let emaRange = emaMax - emaMin;
      if (eq(emaRange, 0.0)) emaRange = NaN; // emaRange := emaRange == 0.0 ? na : emaRange
      const emaNorm = (100 * (emaVal - emaMin)) / emaRange;

      const rsiVal = s.rsi.step(c);

      // Stochastic with smoothing, each line scaled to 0-100 over 50 bars
      const stochKRaw = s.stoch.step(c, b.high, b.low);
      const stochDRaw = s.stochDRaw.step(stochKRaw);
      const stochKSmooth = s.stochKSmooth.step(stochKRaw);
      const stochDSmooth = s.stochDSmooth.step(stochDRaw);
      const stochKMin = s.stochKMin.step(stochKSmooth);
      const stochKMax = s.stochKMax.step(stochKSmooth);
      const stochDMin = s.stochDMin.step(stochDSmooth);
      const stochDMax = s.stochDMax.step(stochDSmooth);
      const stochK = (100 * (stochKSmooth - stochKMin)) / Math.max(stochKMax - stochKMin, 1);
      const stochD = (100 * (stochDSmooth - stochDMin)) / Math.max(stochDMax - stochDMin, 1);

      // ADX / DMI with SMAs
      const p = i > 0 ? bars[i - 1] : undefined;
      const upMove = p ? b.high - p.high : NaN;
      const downMove = p ? p.low - b.low : NaN;
      const plusDM = gt(upMove, downMove) && gt(upMove, 0) ? upMove : 0;
      const minusDM = gt(downMove, upMove) && gt(downMove, 0) ? downMove : 0;
      // math.max(math.max(high - low, math.abs(high - close[1])), math.abs(low - close[1])): na on bar 0
      const trueRange = p ? Math.max(Math.max(b.high - b.low, Math.abs(b.high - p.close)), Math.abs(b.low - p.close)) : NaN;
      const smthTR = s.smthTR.step(trueRange);
      const smthPlusDM = s.smthPlusDM.step(plusDM);
      const smthMinusDM = s.smthMinusDM.step(minusDM);
      // Plain divisions: x / 0 is +-infinity (0 / 0 NaN), as in Pine; ta.sma skips the infinite values
      const diPlus = 100 * (smthPlusDM / smthTR);
      const diMinus = 100 * (smthMinusDM / smthTR);
      const dx = (100 * Math.abs(diPlus - diMinus)) / Math.max(diPlus + diMinus, 1);
      const adxVal = s.adx.step(dx);

      // Signals
      const stochCrossUp = s.crossUp.step(stochK, stochD);
      const stochCrossDown = s.crossDown.step(stochK, stochD);
      const buySignalBasic = stochCrossUp && gt(rsiVal, cfg.rsiBuyLevel);
      const sellSignalBasic = stochCrossDown && lt(rsiVal, cfg.rsiSellLevel);
      const adxCondition = !cfg.useADXFilter || gt(adxVal, cfg.adxThreshold);
      const trendConditionBuy = !cfg.useEMAFilter || gt(c, emaVal);
      const trendConditionSell = !cfg.useEMAFilter || lt(c, emaVal);
      const finalBuySignal = buySignalBasic && adxCondition && trendConditionBuy;
      const finalSellSignal = sellSignalBasic && adxCondition && trendConditionSell;
      const cautionSignal = cfg.useCaution
        && ((gt(rsiVal, cfg.rsiCautionHigh) && gt(stochK, cfg.stochCautionHigh))
          || (lt(rsiVal, cfg.rsiCautionLow) && lt(stochK, cfg.stochCautionLow)));
      const bg = finalBuySignal ? cfg.buyColor : finalSellSignal ? cfg.sellColor : cautionSignal ? cfg.cautionColor : null;
      if (bg !== null) s.bgColors.push({ time, color: bg });
      s.flags[0][i] = finalBuySignal;
      s.flags[1][i] = finalSellSignal;
      s.flags[2][i] = cautionSignal;
      if (finalBuySignal) s.times[0].push(time as number);
      if (finalSellSignal) s.times[1].push(time as number);
      if (cautionSignal) s.times[2].push(time as number);

      s.plots[0][i] = { time, value: fin(cfg.useEMAFilter ? emaNorm : NaN), color: color.yellow };
      s.plots[1][i] = { time, value: fin(stochK), color: cfg.plotStochKColor };
      s.plots[2][i] = { time, value: fin(stochD), color: cfg.plotStochDColor };
      s.plots[3][i] = { time, value: fin(diPlus), color: cfg.plotDIPlusColor };
      s.plots[4][i] = { time, value: fin(diMinus), color: cfg.plotDIMinusColor };
      s.plots[5][i] = { time, value: fin(adxVal), color: cfg.plotADXColor };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
          { value: 100, options: { title: 'Max Line', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TheJewelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TheJewelInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy: Stoch cross up + RSI > level + (Optional ADX/EMA confirm)' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell: Stoch cross down + RSI < level + (Optional ADX/EMA confirm)' },
  { id: 'alert2', title: 'Caution Signal', message: 'Caution: RSI & Stoch both at extreme levels' },
];

export const TheJewel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
