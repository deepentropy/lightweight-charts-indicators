/**
 * Spira Alligator
 *
 * A Williams Alligator (lips, teeth and jaw: moving averages of the source, by default SMMA of hl2 with lengths 5, 8
 * and 13, drawn 3, 5 and 8 bars ahead) with a trend line (EMA 144 of the close). The moving average type of the
 * Alligator and of the trend line can be one of 26 types. The signals use the values without the plot offset:
 * - a pullback for a sell is seen when the lips cross above the teeth with the close below the trend line (reset
 *   when the close is above it); SELL when the lips then cross below the teeth with the close below the trend line;
 * - a pullback for a buy is seen when the lips cross below the teeth (reset when the close is below the trend line);
 *   BUY when the lips then cross above the teeth with the close above the trend line.
 * Signals draw a label and a background colour.
 * Alerts (alertcondition, `alerts` of the result): 'BUY Signal' and 'SELL Signal', true on the bars of the signals.
 *
 * Reference: "Spira Alligator" by Markedsignaler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

const MA_TYPES = ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA', 'HullMA', 'TMA', 'HybridMA',
  'ZeroLagEMA', 'SuperEMA', 'TrendMA', 'HMA', 'THMA', 'EHMA', 'DEMA', 'TEMA',
  'TDEMA', 'TTEMA', 'ZLEMA', 'ZLDEMA', 'ZLTEMA', 'DZLEMA', 'TZLEMA',
  'LLEMA', 'NMA', 'SmoothedMA'];

export interface SpiraAlligatorInputs {
  showAli: boolean;
  /** Moving average type of the lips, teeth and jaw */
  aliType: string;
  /** Source of the Alligator */
  aliSrc: SourceType;
  lipsLength: number;
  /** Plot offset of the lips (display only) */
  lipsOffset: number;
  lipsColor: string;
  teethLength: number;
  teethOffset: number;
  teethColor: string;
  jawLength: number;
  jawOffset: number;
  jawColor: string;
  showTrend: boolean;
  /** Moving average type of the trend line (of the close) */
  trendType: string;
  trendLength: number;
  trendColor: string;
  showSignals: boolean;
  /** Background colour on the signal bars */
  showBg: boolean;
}

export const defaultInputs: SpiraAlligatorInputs = {
  showAli: true,
  aliType: 'SMMA (RMA)',
  aliSrc: 'hl2',
  lipsLength: 5,
  lipsOffset: 3,
  lipsColor: '#00E676',
  teethLength: 8,
  teethOffset: 5,
  teethColor: '#F44336',
  jawLength: 13,
  jawOffset: 8,
  jawColor: '#2196F3',
  showTrend: true,
  trendType: 'EMA',
  trendLength: 144,
  trendColor: color.yellow,
  showSignals: true,
  showBg: true,
};

const G_ALI = '🐊 Williams Alligator';
const G_TREND = '🟡 Trendlinje — EMA 144';
const G_SIG = '🔔 Signalinnstillinger';

export const inputConfig: InputConfig[] = [
  { id: 'showAli', type: 'bool', title: 'Vis Alligator', defval: true, group: G_ALI },
  { id: 'aliType', type: 'string', title: 'MA Type', defval: 'SMMA (RMA)', options: MA_TYPES, group: G_ALI },
  { id: 'aliSrc', type: 'source', title: 'Kilde (standard: HL2)', defval: 'hl2', group: G_ALI },
  { id: 'lipsLength', type: 'int', title: 'Lips — Lengde', defval: 5, min: 1, group: G_ALI },
  { id: 'lipsOffset', type: 'int', title: 'Lips — Offset (kun visuelt)', defval: 3, min: 0, group: G_ALI },
  { id: 'lipsColor', type: 'color', title: 'Lips — Farge', defval: '#00E676', group: G_ALI },
  { id: 'teethLength', type: 'int', title: 'Teeth — Lengde', defval: 8, min: 1, group: G_ALI },
  { id: 'teethOffset', type: 'int', title: 'Teeth — Offset (kun visuelt)', defval: 5, min: 0, group: G_ALI },
  { id: 'teethColor', type: 'color', title: 'Teeth — Farge', defval: '#F44336', group: G_ALI },
  { id: 'jawLength', type: 'int', title: 'Jaw — Lengde', defval: 13, min: 1, group: G_ALI },
  { id: 'jawOffset', type: 'int', title: 'Jaw — Offset (kun visuelt)', defval: 8, min: 0, group: G_ALI },
  { id: 'jawColor', type: 'color', title: 'Jaw — Farge', defval: '#2196F3', group: G_ALI },
  { id: 'showTrend', type: 'bool', title: 'Vis trendlinje', defval: true, group: G_TREND },
  { id: 'trendType', type: 'string', title: 'MA Type', defval: 'EMA', options: MA_TYPES, group: G_TREND },
  { id: 'trendLength', type: 'int', title: 'Lengde (Fibonacci)', defval: 144, min: 1, group: G_TREND },
  { id: 'trendColor', type: 'color', title: 'Farge', defval: color.yellow, group: G_TREND },
  { id: 'showSignals', type: 'bool', title: 'Vis BUY/SELL signaler', defval: true, group: G_SIG },
  { id: 'showBg', type: 'bool', title: 'Bakgrunnsfarge ved signal', defval: true, group: G_SIG },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trendlinje EMA 144', color: color.yellow, lineWidth: 3 },
  { id: 'plot1', title: 'Lips (Grønn)', color: '#00E676', lineWidth: 1 },
  { id: 'plot2', title: 'Teeth (Rød)', color: '#F44336', lineWidth: 1 },
  { id: 'plot3', title: 'Jaw (Blå)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot4', title: 'SPKOA Lips', color: '#2962FF', lineWidth: 1, display: 'data_window' },
  { id: 'plot5', title: 'SPKOA Teeth', color: '#2962FF', lineWidth: 1, display: 'data_window' },
  { id: 'plot6', title: 'SPKOA Jaw', color: '#2962FF', lineWidth: 1, display: 'data_window' },
  { id: 'plot7', title: 'SPKOA Trend MA', color: '#2962FF', lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Spira Alligator',
  shortTitle: 'Spira Alligator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Arr = number[];
/** x[k]: na before the first bar */
const hist = (x: Arr, i: number, k: number) => (i - k >= 0 ? x[i - k] : NaN);

/** x[k] of one series computed bar by bar: the committed values of the earlier bars and the value of this bar */
class History implements Committable {
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;

  constructor(private readonly keep: number) {}

  push(v: number): void {
    this.pending = v;
    this.stepped = true;
  }

  /** x[k]: na before the first bar */
  back(k: number): number {
    if (k === 0) return this.pending;
    const j = this.values.length - k;
    return j >= 0 ? this.values[j] : NaN;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.keep * 2 + 1024) this.values = this.values.slice(-this.keep);
  }
}

/** The value of the previous bar of a recursive series (s[1]) */
class Prev implements Committable {
  value = NaN;
  private next = NaN;
  private stepped = false;

  set(v: number): void {
    this.next = v;
    this.stepped = true;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.value = this.next;
  }
}

type F = (v: number) => number;

/**
 * Moving averages of the Pine script, one bar at a time; each call has its own history (one Pine call site per call).
 * The machines go into `steps`; `bar` gives the volume and the ATR of the bar.
 */
function makeMa(steps: Committable[], bar: { volume: number; atr: number }) {
  const add = <T extends Committable>(m: T): T => {
    steps.push(m);
    return m;
  };
  const sma = (len: number): F => { const m = add(new WindowSma(len)); return (v) => m.step(v); };
  const ema = (len: number): F => { const m = add(taStep.ema(len)); return (v) => m.step(v); };
  const rma = (len: number): F => { const m = add(taStep.rma(len)); return (v) => m.step(v); };
  const wma = (len: number): F => { const m = add(taStep.wma()); return (v) => m.step(v, len); };
  const vwma = (len: number): F => { const m = add(new WindowVwma(len)); return (v) => m.step(v, bar.volume); };

  /** wma_custom(src, length): a Pine `for i = 0 to length - 1` loop (length can be fractional: length / 2) */
  const wmaCustom = (length: number): F => {
    const x = add(new History(Math.ceil(Math.abs(length)) + 2));
    const end = length - 1;
    // for i = 0 to end: counts down when end < 0
    const step = end >= 0 ? 1 : -1;
    return (v) => {
      x.push(v);
      let sum = 0.0;
      let norm = 0.0;
      for (let i = 0; step > 0 ? i <= end : i >= end; i += step) {
        const weight = length - i;
        sum += x.back(i) * weight;
        norm += weight;
      }
      return sum / norm;
    };
  };
  const zlema = (length: number): F => {
    const lag = Math.round((length - 1) / 2);
    const x = add(new History(Math.abs(lag) + 2));
    const e = ema(length);
    return (v) => {
      x.push(v);
      return e(v + (v - x.back(lag)));
    };
  };
  const hma = (length: number): F => {
    const half = wmaCustom(length / 2);
    const full = wmaCustom(length);
    const out = wmaCustom(Math.round(Math.sqrt(length)));
    return (v) => out(2 * half(v) - full(v));
  };
  const dema = (length: number): F => {
    const e1 = ema(length);
    const e2 = ema(length);
    return (v) => {
      const a = e1(v);
      return 2 * a - e2(a);
    };
  };
  const tema = (length: number): F => {
    const e1 = ema(length);
    const e2 = ema(length);
    const e3 = ema(length);
    return (v) => {
      const a = e1(v);
      const b = e2(a);
      return 3 * (a - b) + e3(b);
    };
  };
  /** 3 * (f1 - f2) + f3 of three chained calls of one function */
  const triple = (f: (length: number) => F, length: number): F => {
    const f1 = f(length);
    const f2 = f(length);
    const f3 = f(length);
    return (v) => {
      const a = f1(v);
      const b = f2(a);
      return 3 * (a - b) + f3(b);
    };
  };
  const hybrid = (length: number): F => {
    const basic = sma(length);
    const prev = add(new Prev());
    return (v) => {
      const p = prev.value;
      const b = basic(v);
      const out = isNaN(p) ? b : (p * (length - 1) + b) / length;
      prev.set(out);
      return out;
    };
  };
  const smoothed = (length: number): F => {
    // s := na(s[1]) ? ta.sma(src, length) : (s[1] * (length - 1) + src) / length; the ta.sma only runs (and keeps
    // its history) on the bars where s[1] is na
    const received = sma(length);
    const prev = add(new Prev());
    return (v) => {
      const p = prev.value;
      const out = isNaN(p) ? received(v) : (p * (length - 1) + v) / length;
      prev.set(out);
      return out;
    };
  };

  return (type: string, length: number): F => {
    switch (type) {
      case 'SMA': return sma(length);
      case 'EMA': return ema(length);
      case 'SMMA (RMA)': return rma(length);
      case 'WMA': return wma(length);
      case 'VWMA': return vwma(length);
      case 'HullMA':
      case 'HMA': return hma(length);
      case 'TMA': {
        const s1 = sma(length);
        const s2 = sma(length);
        return (v) => s2(s1(v));
      }
      case 'HybridMA': return hybrid(length);
      case 'ZeroLagEMA': {
        const e1 = ema(length);
        const e2 = ema(length);
        return (v) => {
          const a = e1(v);
          return a + (a - e2(a));
        };
      }
      case 'SuperEMA':
      case 'TEMA': return tema(length);
      case 'TrendMA': {
        const e = ema(length);
        const s = sma(length);
        const atrSma = sma(length);
        // trend = atrSeries / ta.sma(atrSeries, length): a plain division
        return (v) => {
          const ev = e(v);
          const sv = s(v);
          const a = bar.atr;
          const trend = a / atrSma(a);
          return ev * trend + sv * (1 - trend);
        };
      }
      case 'THMA': {
        const w1 = wmaCustom(length / 3);
        const w2 = wmaCustom(length / 2);
        const w3 = wmaCustom(length);
        const out = wmaCustom(length);
        return (v) => out(w1(v) * 3 - w2(v) - w3(v));
      }
      case 'EHMA': {
        // ta.ema with the fractional length / 2
        const half = ema(length / 2);
        const full = ema(length);
        const out = ema(Math.round(Math.sqrt(length)));
        return (v) => out(2 * half(v) - full(v));
      }
      case 'DEMA': return dema(length);
      case 'TDEMA': return triple(dema, length);
      case 'TTEMA': return triple(tema, length);
      case 'ZLEMA': return zlema(length);
      case 'ZLDEMA':
      case 'DZLEMA': {
        const z1 = zlema(length);
        const z2 = zlema(length);
        return (v) => {
          const a = z1(v);
          return 2 * a - z2(a);
        };
      }
      case 'ZLTEMA':
      case 'TZLEMA': return triple(zlema, length);
      case 'LLEMA': {
        const x = add(new History(3));
        const e = ema(length);
        return (v) => {
          x.push(v);
          return e(0.25 * v + 0.5 * x.back(1) + 0.25 * x.back(2));
        };
      }
      case 'NMA': {
        const lambda = length / 26;
        const alpha = (lambda * (length - 1)) / (length - lambda);
        const e1 = ema(length);
        const e2 = ema(26);
        return (v) => {
          const a = e1(v);
          return (1 + alpha) * a - alpha * e2(a);
        };
      }
      case 'SmoothedMA': return smoothed(length);
      default: return () => NaN;
    }
  };
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface SpiraVars {
  /** var bool */
  bearPullbackSeen: boolean;
  /** var bool */
  bullPullbackSeen: boolean;
}

interface SpiraRun extends BarRunState<SpiraVars> {
  atr: ReturnType<typeof taStep.atr>;
  bar: { volume: number; atr: number };
  lipsMa: F;
  teethMa: F;
  jawMa: F;
  trendMa: F;
  /** lips, teeth, jaw, trend of each bar */
  values: Arr[];
  /** The offset plots: the point of bar i written by bar i + offset (the time of that bar) */
  shiftedPlots: Point[][];
  plainPlots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SpiraAlligatorInputs>): BarStudy<SpiraRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf = barSource(cfg.aliSrc);
  const buyBg = String(color.new(color.lime, 88));
  const sellBg = String(color.new(color.red, 88));
  // plot(..., offset = k): the value of bar i is drawn on bar i + k (trend, lips, teeth, jaw)
  const shifts: Array<{ show: boolean; col: string; k: number; value: number }> = [
    { show: cfg.showTrend, col: cfg.trendColor, k: 0, value: 3 },
    { show: cfg.showAli, col: cfg.lipsColor, k: cfg.lipsOffset, value: 0 },
    { show: cfg.showAli, col: cfg.teethColor, k: cfg.teethOffset, value: 1 },
    { show: cfg.showAli, col: cfg.jawColor, k: cfg.jawOffset, value: 2 },
  ];
  /** The offsets written by the bars (else every point is built in `result`) */
  const direct = shifts.map(({ k }) => Number.isInteger(k) && k >= 0);
  return {
    fullRunReason: () => (isBarSource(cfg.aliSrc) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(14);
      const steps: Committable[] = [atr];
      const bar = { volume: NaN, atr: NaN };
      const ma = makeMa(steps, bar);
      const lipsMa = ma(cfg.aliType, cfg.lipsLength);
      const teethMa = ma(cfg.aliType, cfg.teethLength);
      const jawMa = ma(cfg.aliType, cfg.jawLength);
      const trendMa = ma(cfg.trendType, cfg.trendLength);
      const s: SpiraRun = {
        atr, bar, lipsMa, teethMa, jawMa, trendMa, values: [[], [], [], []],
        shiftedPlots: [[], [], [], []], plainPlots: [[], [], [], []], markers: [], bgColors: [],
        flags: [[], []], times: [[], []],
        steps, vars: { bearPullbackSeen: false, bullPullbackSeen: false }, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [...s.values, ...s.shiftedPlots, ...s.plainPlots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const c = b.close;
      s.bar.volume = b.volume ?? NaN;
      s.bar.atr = s.atr.step(b.high, b.low, c);
      const src = srcOf(b);
      const [lips, teeth, jaw, trend] = s.values;
      lips[i] = s.lipsMa(src);
      teeth[i] = s.teethMa(src);
      jaw[i] = s.jawMa(src);
      trend[i] = s.trendMa(c);

      // (lips > teeth) and (lips[1] <= teeth[1]); (lips < teeth) and (lips[1] >= teeth[1])
      const crossUp = gt(lips[i], teeth[i]) && le(hist(lips, i, 1), hist(teeth, i, 1));
      const crossDown = lt(lips[i], teeth[i]) && ge(hist(lips, i, 1), hist(teeth, i, 1));
      if (crossUp && lt(c, trend[i])) v.bearPullbackSeen = true;
      if (gt(c, trend[i])) v.bearPullbackSeen = false;
      if (crossDown) v.bullPullbackSeen = true;
      if (lt(c, trend[i])) v.bullPullbackSeen = false;
      const sell = v.bearPullbackSeen && crossDown && lt(c, trend[i]);
      const buy = v.bullPullbackSeen && crossUp && gt(c, trend[i]);
      if (sell) v.bearPullbackSeen = false;
      if (buy) v.bullPullbackSeen = false;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      const time = b.time;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);

      if (cfg.showSignals && buy) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'alligator',
          textColor: color.black, size: 'tiny' });
      }
      if (cfg.showSignals && sell) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'alligator',
          textColor: color.white, size: 'tiny' });
      }
      if (cfg.showBg && buy) s.bgColors.push({ time, color: buyBg });
      if (cfg.showBg && sell) s.bgColors.push({ time, color: sellBg });

      // the point of bar i - k is drawn at the time of this bar (its only writer)
      for (let p = 0; p < 4; p++) {
        const { show, col, k, value } = shifts[p];
        if (direct[p] && i - k >= 0) {
          const x = s.values[value][i - k];
          s.shiftedPlots[p][i - k] = { time, value: show && Number.isFinite(x) ? x : NaN, color: col };
        }
        const y = s.values[p][i];
        s.plainPlots[p][i] = { time, value: Number.isFinite(y) ? y : NaN };
      }
    },
    result(s, bars) {
      const n = bars.length;
      // the points drawn after the last bar: the times of the bar interval (barTime)
      let interval: number | undefined;
      const shifted = (p: number): Point[] => {
        const { show, col, k, value } = shifts[p];
        const known = direct[p] ? Math.max(0, n - k) : 0;
        const out = s.shiftedPlots[p].slice(0, known);
        for (let i = known; i < n; i++) {
          if (interval === undefined) interval = barInterval(bars);
          const x = s.values[value][i];
          out.push({ time: barTime(bars, i + k, interval), value: show && Number.isFinite(x) ? x : NaN, color: col });
        }
        return out;
      };
      const [plot4, plot5, plot6, plot7] = s.plainPlots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: shifted(0),
          plot1: shifted(1),
          plot2: shifted(2),
          plot3: shifted(3),
          plot4,
          plot5,
          plot6,
          plot7,
        },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(buy_signal, "BUY Signal") / alertcondition(sell_signal, "SELL Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SpiraAlligatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SpiraAlligatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY Signal', message: '🟢 SPKOA BUY  — Lips krysset over Teeth, pris over EMA 144' },
  { id: 'alert1', title: 'SELL Signal', message: '🔴 SPKOA SELL — Lips krysset under Teeth, pris under EMA 144' },
];

export const SpiraAlligator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
