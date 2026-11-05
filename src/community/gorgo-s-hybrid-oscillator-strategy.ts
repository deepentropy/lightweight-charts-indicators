/**
 * Gorgo's Hybrid Oscillator STrategy (GHOST)
 *
 * The oscillator is the average of the RSI (hlc3, 24) and the Ultimate Oscillator (7 / 14 / 28). A zero-lag
 * accumulation of the oscillator a = lag * osc + (1 - lag) * b[25] + a[1] (lag 1.4) gives the ZLMA line
 * b = change(a, 50) / 50. The stochastic of the CCI (hlc3, 28; stoch 28, smoothed 3 and 3) marks overbought /
 * oversold circles. The ADX (14) is drawn as columns, coloured by the DI direction above the ADX threshold and
 * lighter when it falls. Buy / sell conditions (oscillator, stochastic CCI, ADX, volume above its SMA) colour the
 * background. Optional volume panel: volume candles coloured by the volume level, the highest volume (30) and the
 * volume SMA and excess levels of the previous bar.
 * Alerts (alertcondition, `alerts` of the result): 'BUY' and 'SELL', on the bars of the buy / sell conditions.
 *
 * Reference: "Gorgo's Hybrid Oscillator STrategy" by Gorgomannaro
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface GorgosHybridOscillatorStrategyInputs {
  /** Overbought level of the stochastic CCI and of the oscillator */
  overboughtLevel: number;
  /** Oversold level of the stochastic CCI and of the oscillator */
  oversoldLevel: number;
  /** ADX threshold */
  adxThreshold: number;
  /** Show the ADX */
  showAdx: boolean;
  /** Volume SMA length */
  volumeLength: number;
  /** Volume excess multiplier of the volume SMA */
  volumeExcess: number;
  /** Show the volume panel */
  showVsa: boolean;
}

export const defaultInputs: GorgosHybridOscillatorStrategyInputs = {
  overboughtLevel: 69.0,
  oversoldLevel: 35.0,
  adxThreshold: 24.0,
  showAdx: true,
  volumeLength: 9,
  volumeExcess: 2.7,
  showVsa: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'overboughtLevel', type: 'float', title: 'overbought_level', defval: 69.0 },
  { id: 'oversoldLevel', type: 'float', title: 'oversold_level', defval: 35.0 },
  { id: 'adxThreshold', type: 'float', title: 'adx_threshold', defval: 24.0 },
  { id: 'showAdx', type: 'bool', title: 'Mostra ADX', defval: true },
  { id: 'volumeLength', type: 'int', title: 'media_volume', defval: 9 },
  { id: 'volumeExcess', type: 'float', title: 'eccesso_volumetrico', defval: 2.7, step: 0.1 },
  { id: 'showVsa', type: 'bool', title: 'Mostra i Volumi', defval: false },
];

const OSC_COLOR = String(color.new('#00d0ff', 25));
const OB_COLOR = String(color.new('#ff0000', 50));
const OS_COLOR = String(color.new('#00ff00', 50));
const STOCH_COLOR = '#7878787a';
const HIGHEST_COLOR = String(color.rgb(255, 255, 255, 90));
const AZZURRO = 'rgb(0, 149, 255)'; // color.rgb(0, 149, 255)
const ROSSO = 'rgb(255, 0, 0)'; // color.rgb(255, 0, 0)
const BIANCO = 'rgb(255, 225, 255)'; // color.rgb(255, 225, 255)
const GRIGIO = 'rgb(68, 68, 68)'; // color.rgb(68, 68, 68)
const LEVEL_COLOR = String(color.new(color.white, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLMA', color: '#ac0b00', lineWidth: 1 },
  { id: 'plot1', title: 'Oscillator', color: OSC_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Overbought', color: OB_COLOR, lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'Oversold', color: OS_COLOR, lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Stochastic CCI', color: STOCH_COLOR, lineWidth: 1 },
  { id: 'plot5', title: 'ADX', color: String(color.new('#4a4a4a', 75)), lineWidth: 1, style: 'columns' },
  { id: 'plot6', title: 'Highest Volume (lookback)', color: HIGHEST_COLOR, lineWidth: 2, style: 'columns' },
  { id: 'plot7', title: 'media_volume', color: String(color.new(AZZURRO, 0)), lineWidth: 1 },
  { id: 'plot8', title: 'eccesso_volumetrico', color: String(color.new(ROSSO, 0)), lineWidth: 1 },
];

/** hline(overbought_level / oversold_level / adx_threshold) with the default values */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 69, title: 'Overbought line', color: LEVEL_COLOR, linestyle: 'dotted' },
  { id: 'hline_os', price: 35, title: 'Overbought line', color: LEVEL_COLOR, linestyle: 'dotted' },
  { id: 'hline_adx', price: 24, title: 'ADX threshold', color: LEVEL_COLOR, linestyle: 'dashed' },
];

export const metadata = {
  title: "Gorgo's Hybrid Oscillator STrategy",
  shortTitle: 'GHOST',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
/** Plots show na for +-infinity */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (na and +-infinity skipped; a bar with an na value keeps the previous result), with the exact partials
 * of the library window sum changed in the same order (the value that leaves, then the one that enters): the same
 * doubles. `step` works on a copy of the few partials of the kept window, `commit` keeps it.
 */
class WindowSum implements Committable {
  private readonly values: number[] = [];
  private p = new Partials();
  private next = new Partials();
  private last = NaN;
  private pendingValue = NaN;
  private pendingResult = NaN;
  private stepped = false;

  constructor(private readonly len: number) {}

  step(v: number): number {
    this.stepped = true;
    if (v === undefined || v === null || !Number.isFinite(v)) {
      this.pendingValue = NaN;
      return this.last;
    }
    const q = this.next;
    q.copy(this.p);
    const count = this.values.length;
    if (count >= this.len) q.add(-this.values[count - this.len]);
    q.add(v);
    this.pendingValue = v;
    this.pendingResult = count + 1 >= this.len ? q.round() : NaN;
    return this.pendingResult;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (Number.isNaN(this.pendingValue)) return;
    this.values.push(this.pendingValue);
    const t = this.p;
    this.p = this.next;
    this.next = t;
    this.last = this.pendingResult;
  }
}

/** Non-overlapping partials of increasing magnitude of an exact sum (Shewchuk, as Python `math.fsum`) */
class Partials {
  private p = new Float64Array(16);
  private n = 0;

  copy(o: Partials): void {
    if (this.p.length < o.p.length) this.p = new Float64Array(o.p.length);
    this.p.set(o.p.subarray(0, o.n));
    this.n = o.n;
  }

  /** Adds `x` exactly */
  add(x: number): void {
    const p = this.p;
    const n = this.n;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = p[j];
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

  /** The exact sum rounded once to a double (round half to even) */
  round(): number {
    const p = this.p;
    let n = this.n;
    if (n === 0) return 0;
    let hi = p[--n];
    while (n > 0) {
      const x = hi;
      const y = p[--n];
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        // half-way case: the rest has the same sign, so round away from the tie
        if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) {
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

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface GhostVars {
  /** fixnan of the +DI / -DI: the last non-na value */
  lastPlus: number;
  lastMinus: number;
}

interface GhostRun extends BarRunState<GhostVars> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  bpSums: WindowSum[];
  trSums: WindowSum[];
  cciMean: WindowSum;
  hlc3: number[];
  cciLast: number[];
  stoch: ReturnType<typeof taStep.stoch>;
  kSma: WindowSum;
  dSma: WindowSum;
  tr: ReturnType<typeof taStep.tr>;
  trRma: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adxRma: ReturnType<typeof taStep.rma>;
  volSma: ReturnType<typeof taStep.sma>;
  highestVol: ReturnType<typeof taStep.highest>;
  osc: number[];
  adx: number[];
  za: number[];
  zb: number[];
  mediaVolume: number[];
  eccesso: number[];
  highest: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

const buyBg = String(color.new('#ff0000', 75));
const sellBg = String(color.new('#ffffff', 75));
const wick = String(color.new(color.black, 100));
const AZZURRO_0 = String(color.new(AZZURRO, 0));
const ROSSO_0 = String(color.new(ROSSO, 0));

function study(inputs: Partial<GorgosHybridOscillatorStrategyInputs>): BarStudy<GhostRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const ob = cfg.overboughtLevel;
  const os = cfg.oversoldLevel;
  const thr = cfg.adxThreshold;
  const midline = (ob + os) / 2.0;
  const length = 50;
  const lag = 1.4;
  const half = Math.trunc(length / 2);
  return {
    init() {
      const s: GhostRun = {
        up: taStep.rma(24), down: taStep.rma(24), bpSums: [new WindowSum(7), new WindowSum(14), new WindowSum(28)],
        trSums: [new WindowSum(7), new WindowSum(14), new WindowSum(28)], cciMean: new WindowSum(28), hlc3: [], cciLast: [], stoch: taStep.stoch(28),
        kSma: new WindowSum(3), dSma: new WindowSum(3), tr: taStep.tr(), trRma: taStep.rma(14), plusRma: taStep.rma(14),
        minusRma: taStep.rma(14), adxRma: taStep.rma(14), volSma: taStep.sma(), highestVol: taStep.highest(),
        osc: [], adx: [], za: [], zb: [], mediaVolume: [], eccesso: [], highest: [],
        plots: Array.from({ length: 9 }, () => []), bgColors: [], candles: [], flags: [[], []], times: [[], []],
        steps: [], vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.up, s.down, ...s.bpSums, ...s.trSums, s.cciMean, s.stoch, s.kSma, s.dSma, s.tr, s.trRma, s.plusRma, s.minusRma,
        s.adxRma, s.volSma, ...(cfg.showVsa ? [s.highestVol] : []),
      ];
      s.lists = [s.bgColors, s.candles, ...s.times];
      s.series = [s.hlc3, s.cciLast, s.osc, s.adx, s.za, s.zb, s.mediaVolume, s.eccesso, s.highest, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const pb = i > 0 ? bars[i - 1] : null;
      const prev = (a: number[]) => (i > 0 ? a[i - 1] : NaN);
      const volume = b.volume ?? NaN;
      const hlc3 = (b.high + b.low + b.close) / 3;

      // RSI of hlc3, length 24
      const change = pb ? hlc3 - (pb.high + pb.low + pb.close) / 3 : NaN;
      const up = s.up.step(isNaN(change) ? NaN : Math.max(change, 0));
      const down = s.down.step(isNaN(change) ? NaN : -Math.min(change, 0));
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);

      // Ultimate oscillator: average(bp, tr_, length) = math.sum(bp, length) / math.sum(tr_, length)
      const prevClose = pb ? pb.close : NaN;
      const highU = Math.max(b.high, prevClose); // math.max(high, close[1]): na on bar 0
      const lowU = Math.min(b.low, prevClose);
      const bp = b.close - lowU;
      const trU = highU - lowU;
      const avg7 = s.bpSums[0].step(bp) / s.trSums[0].step(trU);
      const avg14 = s.bpSums[1].step(bp) / s.trSums[1].step(trU);
      const avg28 = s.bpSums[2].step(bp) / s.trSums[2].step(trU);
      const out = (100 * (4 * avg7 + 2 * avg14 + avg28)) / 7;

      // CCI stochastic
      // ta.cci(hlc3, 28) = (hlc3 - sma) / (0.015 * dev): a zero dev keeps the previous value (0 at the start); dev =
      // the mean of |hlc3 - sma| over the last 28 bars, summed from the current bar back (the doubles of ta.cci)
      s.hlc3[i] = hlc3;
      const mean = s.cciMean.step(hlc3) / 28;
      let cci = i > 0 ? s.cciLast[i - 1] : 0;
      if (i < 27 || Number.isNaN(mean)) cci = NaN;
      else {
        let sum = 0;
        for (let k = 0; k < 28; k++) sum += Math.abs(s.hlc3[i - k] - mean);
        const dev = sum / 28;
        if (Number.isNaN(dev)) cci = NaN;
        else if (!eq(dev, 0)) cci = (hlc3 - mean) / (0.015 * dev);
      }
      // the value kept for the next bars (an na result keeps it)
      s.cciLast[i] = Number.isNaN(cci) ? (i > 0 ? s.cciLast[i - 1] : 0) : cci;
      // ta.sma(x, 3) = math.sum(x, 3) / 3
      const stochK = s.kSma.step(s.stoch.step(cci, cci, cci)) / 3;
      const sd = s.dSma.step(stochK) / 3;

      // osc = math.avg(out, rsi)
      const osc = (out + rsi) / 2;
      s.osc[i] = osc;

      // ADX + DI
      const u = pb ? b.high - pb.high : NaN; // ta.change(high)
      const d = pb ? -(b.low - pb.low) : NaN; // -ta.change(low)
      const plusDM = isNaN(u) ? NaN : gt(u, d) && gt(u, 0) ? u : 0;
      const minusDM = isNaN(d) ? NaN : gt(d, u) && gt(d, 0) ? d : 0;
      const truerange = s.trRma.step(s.tr.step(b.high, b.low, b.close));
      // fixnan(100 * ta.rma(dm, dilen) / truerange): a plain division (x / 0 is +-infinity, kept by fixnan; 0 / 0 is na)
      const v = s.vars;
      const plusRaw = (100 * s.plusRma.step(plusDM)) / truerange;
      const minusRaw = (100 * s.minusRma.step(minusDM)) / truerange;
      const plus = isNaN(plusRaw) ? v.lastPlus : (v.lastPlus = plusRaw);
      const minus = isNaN(minusRaw) ? v.lastMinus : (v.lastMinus = minusRaw);
      // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
      const sum = plus + minus;
      const adx = 100 * s.adxRma.step(Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum));
      s.adx[i] = adx;

      // ZLMA: var a = 0.0, var b = 0.0; a := nz(lag * src + (1 - lag) * b[25] + a[1], src); b := ta.change(a, 50) / 50
      const bLag = i - half >= 0 ? s.zb[i - half] : NaN;
      const aPrev = i > 0 ? s.za[i - 1] : NaN;
      const x = lag * osc + (1 - lag) * bLag + aPrev;
      s.za[i] = isNaN(x) ? osc : x;
      const zb = (i - length >= 0 ? s.za[i] - s.za[i - length] : NaN) / length;
      s.zb[i] = zb;

      // Signals
      const mediaVolume = s.volSma.step(volume, cfg.volumeLength);
      s.mediaVolume[i] = mediaVolume;
      s.eccesso[i] = mediaVolume * cfg.volumeExcess;
      const oscPrev = prev(s.osc);
      const mvPrev = prev(s.mediaVolume);
      let buy = le(b.close, b.open)
        && (lt(sd, 20.0) ? gt(adx, 15.0) : ge(adx, thr))
        && lt(osc, oscPrev)
        && lt(osc, os)
        && lt(sd, midline)
        && ge(volume, mvPrev);
      buy = buy || (ge(volume, prev(s.eccesso)) && le(osc, oscPrev) && le(osc, 40.0));
      let sell = ge(b.close, b.open)
        && gt(adx, prev(s.adx))
        && (gt(sd, 90.0) ? gt(adx, 15.0) : ge(adx, thr))
        && ge(osc, oscPrev)
        && ge(osc, ob)
        && ge(sd, midline)
        && ge(volume, mvPrev);
      sell = sell || (ge(volume, mvPrev * 2.0) && ge(osc, oscPrev) && ge(osc, 60.0));
      // alertcondition(buy_signal, 'BUY') / alertcondition(sell_signal, 'SELL')
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);
      // sfondo := buy ? red 75 : sfondo; sfondo := sell ? white 75 : sfondo
      const bg = sell ? sellBg : buy ? buyBg : null;
      if (bg) s.bgColors.push({ time, color: bg });

      // Volume panel
      s.highest[i] = cfg.showVsa ? s.highestVol.step(volume, 30) : NaN;
      if (cfg.showVsa) {
        const col = gt(volume, prev(s.eccesso)) ? String(color.new(ROSSO, 0))
          : gt(volume, prev(s.highest)) ? String(color.new(BIANCO, 0))
            : ge(volume, prev(s.mediaVolume)) ? String(color.new(AZZURRO, 30)) : String(color.new(GRIGIO, 30));
        // plotcandle(0, volume, 0, volume): no candle when the volume is na
        if (!isNaN(volume)) {
          s.candles.push({ time, open: 0, high: volume, low: 0, close: volume, color: col, wickColor: wick, borderColor: wick });
        }
      }

      const t = gt(adx, prev(s.adx)) ? 25 : 75;
      const adxColor = String(ge(adx, thr) ? (ge(plus, minus) ? color.new('#ff0000', t) : color.new('#00ff00', t))
        : color.new('#4a4a4a', t));
      const p = s.plots;
      p[0][i] = { time, value: fin(zb), color: '#ac0b00' };
      p[1][i] = { time, value: fin(osc), color: OSC_COLOR };
      // plot(cci_ob ? overbought_level : na): cci_ob = stoch_cci_d >= overbought_level
      p[2][i] = { time, value: fin(ge(sd, ob) ? ob : NaN), color: OB_COLOR };
      // plot(cci_os ? oversold_level : na): cci_os = stoch_cci_d < oversold_level
      p[3][i] = { time, value: fin(lt(sd, os) ? os : NaN), color: OS_COLOR };
      p[4][i] = { time, value: fin(sd), color: STOCH_COLOR };
      p[5][i] = { time, value: fin(cfg.showAdx ? adx : NaN), color: adxColor };
      p[6][i] = { time, value: fin(cfg.showVsa ? prev(s.highest) : NaN), color: HIGHEST_COLOR };
      p[7][i] = { time, value: fin(cfg.showVsa ? mvPrev : NaN), color: AZZURRO_0 };
      p[8][i] = { time, value: fin(cfg.showVsa ? prev(s.eccesso) : NaN), color: ROSSO_0 };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots,
        hlines: [
          { value: ob, options: { title: 'Overbought line', color: LEVEL_COLOR, linestyle: 'dotted' } },
          { value: os, options: { title: 'Overbought line', color: LEVEL_COLOR, linestyle: 'dotted' } },
          // hline(show_adx ? adx_threshold : na): no line when the ADX is hidden
          ...(cfg.showAdx ? [{ value: thr, options: { title: 'ADX threshold', color: LEVEL_COLOR, linestyle: 'dashed' as const } }] : []),
        ],
        bgColors: s.bgColors.slice(),
        plotCandles: { volume: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GorgosHybridOscillatorStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GorgosHybridOscillatorStrategyInputs> = {},
): IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY', message: '00_buy signal @ {{close}}' },
  { id: 'alert1', title: 'SELL', message: '00_sell signal @ {{close}}' },
];

export const GorgosHybridOscillatorStrategy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
