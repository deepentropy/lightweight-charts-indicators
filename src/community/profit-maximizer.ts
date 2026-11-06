/**
 * Profit Maximizer (PMax)
 *
 * As the original: a moving average of the source (hl2 by default; SMA, EMA, WMA, TMA, VAR, WWMA, ZLEMA or TSF) with
 * an ATR trailing stop around it (the ATR, or the SMA of the true range with "Change ATR Calculation Method ?" off;
 * divided by the close with "Normalize ATR ?"). The long stop only rises while the MA stays above its previous value,
 * the short stop only falls while the MA stays below it; the direction turns up when the MA crosses above the
 * previous short stop, down when it crosses below the previous long stop. PMax is the long stop in an up direction,
 * the short stop in a down one.
 * Labels at PMax * 0.995 / 1.005 on the crosses of the MA with PMax (Buy shape0 / Sell shape1, "Show Crossing
 * Signals?") and of the source with PMax (shape2 / shape3, "Show Price/Pmax Crossing Signals?"). The two highlighter
 * fills are between a hidden ohlc4 plot and PMax: green while the MA is above PMax, red while it is below.
 * Alerts (alertcondition, `alerts` of the result): the original's six conditions, crosses of the MA and of the source
 * with PMax (any cross, crossover, crossunder).
 *
 * Reference: "Profit Maximizer PMax"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ProfitMaximizerInputs {
  src: SourceType;
  atrPeriod: number;
  atrMult: number;
  maType: string;
  maLength: number;
  changeATR: boolean;
  normalize: boolean;
  showSupport: boolean;
  showSignalsK: boolean;
  showSignalsC: boolean;
  highlighting: boolean;
}

export const defaultInputs: ProfitMaximizerInputs = {
  src: 'hl2',
  atrPeriod: 10,
  atrMult: 3.0,
  maType: 'EMA',
  maLength: 10,
  changeATR: true,
  normalize: false,
  showSupport: true,
  showSignalsK: true,
  showSignalsC: false,
  highlighting: true,
};

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF'];

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, step: 0.1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: MA_TYPES },
  { id: 'maLength', type: 'int', title: 'Moving Average Length', defval: 10, min: 1 },
  { id: 'changeATR', type: 'bool', title: 'Change ATR Calculation Method ?', defval: true },
  { id: 'normalize', type: 'bool', title: 'Normalize ATR ?', defval: false },
  { id: 'showSupport', type: 'bool', title: 'Show Moving Average?', defval: true },
  { id: 'showSignalsK', type: 'bool', title: 'Show Crossing Signals?', defval: true },
  { id: 'showSignalsC', type: 'bool', title: 'Show Price/Pmax Crossing Signals?', defval: false },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

/** Colours of the original (color.green / color.red; fills: transparency 90, the fill default) */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLUE_LABEL = '#0F18BF';
const UP_FILL = 'rgba(76, 175, 80, 0.1)';
const DOWN_FILL = 'rgba(255, 82, 82, 0.1)';
const NO_FILL = 'rgba(0,0,0,0)';

// Declaration order of the original: MA line, PMax, the hidden ohlc4 plot of the fills
export const plotConfig: PlotConfig[] = [
  { id: 'plot1', title: 'Moving Avg Line', color: '#0585E1', lineWidth: 2 },
  { id: 'plot0', title: 'PMax', color: RED, lineWidth: 2 },
  { id: 'plot2', title: '', color: '#2962FF', lineWidth: 0, style: 'circles', display: 'none' },
];

export const metadata = {
  title: 'Profit Maximizer',
  shortTitle: 'PMax',
  overlay: true,
};

const fin = (v: number | undefined) => v !== undefined && Number.isFinite(v);

/** The source of one bar (the original's sources; any other is the close) */
function sourceOf(b: Bar, src: SourceType): number {
  switch (src) {
    case 'open': return b.open;
    case 'high': return b.high;
    case 'low': return b.low;
    case 'hl2': return (b.high + b.low) / 2;
    case 'hlc3': return (b.high + b.low + b.close) / 3;
    case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
    case 'hlcc4': return (b.high + b.low + b.close + b.close) / 4;
    default: return b.close;
  }
}

/** One moving average of the source, one bar at a time: `src` holds the source of the bars up to bar `i` */
interface MaStep {
  step(src: number[], i: number): number;
  commit(): void;
}

/** A moving average with its own value of the previous bar (VAR, WWMA) */
abstract class RecursiveMa implements MaStep {
  protected prev = NaN;
  private pending = NaN;
  private stepped = false;

  protected abstract value(src: number[], i: number): number;

  step(src: number[], i: number): number {
    this.stepped = true;
    this.pending = this.value(src, i);
    return this.pending;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.pending;
  }
}

/** VAR: vud1 / vdd1, the up / down moves (0 on the first bar), summed over 9 bars; VAR uses |CMO| * alpha */
class VarMa extends RecursiveMa {
  /** vud1 / vdd1 of the bars, indexed by bar */
  private readonly vud1: number[] = [];
  private readonly vdd1: number[] = [];

  constructor(private readonly valpha: number) {
    super();
  }

  private static sum9(a: number[], i: number): number {
    if (i < 8) return NaN;
    let s = 0;
    for (let k = i - 8; k <= i; k++) s += a[k];
    return s;
  }

  protected value(src: number[], i: number): number {
    const v = src[i];
    this.vud1[i] = i > 0 && v > src[i - 1] ? v - src[i - 1] : 0;
    this.vdd1[i] = i > 0 && v < src[i - 1] ? src[i - 1] - v : 0;
    const vUD = VarMa.sum9(this.vud1, i);
    const vDD = VarMa.sum9(this.vdd1, i);
    const cmoRaw = (vUD - vDD) / (vUD + vDD);
    const cmo = fin(cmoRaw) ? cmoRaw : 0;
    const a = this.valpha * Math.abs(cmo);
    const term = a * v;
    return (fin(term) ? term : 0) + (1 - a) * (fin(this.prev) ? this.prev : 0);
  }
}

/** WWMA: a * src + (1 - a) * nz(WWMA[1]), a = 1 / length */
class WwmaMa extends RecursiveMa {
  constructor(private readonly a: number) {
    super();
  }

  protected value(src: number[], i: number): number {
    return this.a * src[i] + (1 - this.a) * (fin(this.prev) ? this.prev : 0);
  }
}

/** getMA(src, length) of the original */
function movingAverage(length: number, type: string): MaStep {
  switch (type) {
    case 'SMA': {
      const m = new WindowSma(length);
      return { step: (src, i) => m.step(src[i]), commit: () => m.commit() };
    }
    case 'WMA': {
      const m = taStep.wma();
      return { step: (src, i) => m.step(src[i], length), commit: () => m.commit() };
    }
    case 'TMA': {
      const m1 = new WindowSma(Math.ceil(length / 2));
      const m2 = new WindowSma(Math.floor(length / 2) + 1);
      return { step: (src, i) => m2.step(m1.step(src[i])), commit: () => { m1.commit(); m2.commit(); } };
    }
    case 'VAR': return new VarMa(2 / (length + 1));
    case 'WWMA': return new WwmaMa(1 / length);
    case 'ZLEMA': {
      const lag = length / 2 === Math.round(length / 2) ? length / 2 : (length - 1) / 2;
      const m = taStep.ema(length);
      return {
        step: (src, i) => m.step(i - lag >= 0 ? src[i] + (src[i] - src[i - lag]) : NaN),
        commit: () => m.commit(),
      };
    }
    case 'TSF': {
      const lrc = taStep.linreg(length, 0);
      const lrc1 = taStep.linreg(length, 1);
      return {
        step: (src, i) => {
          const v = lrc.step(src[i]);
          return v + (v - lrc1.step(src[i]));
        },
        commit: () => { lrc.commit(); lrc1.commit(); },
      };
    }
    default: {
      const m = taStep.ema(length);
      return { step: (src, i) => m.step(src[i]), commit: () => m.commit() };
    }
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PmaxVars {
  longStopLast: number;
  shortStopLast: number;
  dir: number;
}

interface PmaxRun extends BarRunState<PmaxVars> {
  atr: { step(high: number, low: number, close: number): number; commit(): void };
  ma: MaStep;
  src: number[];
  maVals: number[];
  pmaxVals: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  upFillColors: string[];
  downFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** crossedOver / crossedUnder of one bar: the values of the bar and of the bar before (na compares false) */
const over = (v: number, w: number, pv: number, pw: number) => v > w && pv <= pw;
const under = (v: number, w: number, pv: number, pw: number) => v < w && pv >= pw;

function study(inputs: Partial<ProfitMaximizerInputs>): BarStudy<PmaxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { atrPeriod, atrMult, maLength, normalize } = cfg;
  const maType = String(cfg.maType).toUpperCase();
  const num = (v: number) => (fin(v) ? v : NaN);
  return {
    init() {
      // atr = changeATR ? atr(Periods) : sma(tr, Periods) (tr is na on the first bar)
      let atr: PmaxRun['atr'];
      if (cfg.changeATR) {
        atr = taStep.atr(atrPeriod);
      } else {
        const tr = taStep.tr(false);
        const sma = new WindowSma(atrPeriod);
        atr = { step: (h, l, c) => sma.step(tr.step(h, l, c)), commit: () => { tr.commit(); sma.commit(); } };
      }
      const ma = movingAverage(maLength, maType);
      const s: PmaxRun = {
        atr, ma, src: [], maVals: [], pmaxVals: [], plot0: [], plot1: [], plot2: [], upFillColors: [], downFillColors: [],
        markers: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [atr, ma], vars: { longStopLast: NaN, shortStopLast: NaN, dir: 1 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.src, s.maVals, s.pmaxVals, s.plot0, s.plot1, s.plot2, s.upFillColors, s.downFillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const srcV = sourceOf(b, cfg.src);
      s.src[i] = srcV;
      const atr = s.atr.step(b.high, b.low, b.close);
      const m = s.ma.step(s.src, i);

      const band = normalize ? atrMult * atr / b.close : atrMult * atr;
      let longStop = m - band;
      const longStopPrev = fin(v.longStopLast) ? v.longStopLast : longStop;
      longStop = m > longStopPrev ? Math.max(longStop, longStopPrev) : longStop;
      let shortStop = m + band;
      const shortStopPrev = fin(v.shortStopLast) ? v.shortStopLast : shortStop;
      shortStop = m < shortStopPrev ? Math.min(shortStop, shortStopPrev) : shortStop;
      v.dir = v.dir === -1 && m > shortStopPrev ? 1 : v.dir === 1 && m < longStopPrev ? -1 : v.dir;
      const pmax = v.dir === 1 ? longStop : shortStop;
      v.longStopLast = longStop;
      v.shortStopLast = shortStop;

      const p = num(pmax);
      const mv = num(m);
      s.pmaxVals[i] = p;
      s.maVals[i] = mv;

      const pm = i > 0 ? s.maVals[i - 1] : NaN;
      const pp = i > 0 ? s.pmaxVals[i - 1] : NaN;
      const ps = i > 0 ? s.src[i - 1] ?? NaN : NaN;
      const sv = srcV ?? NaN;
      const maOver = over(mv, p, pm, pp), maUnder = under(mv, p, pm, pp);
      const pxOver = over(sv, p, ps, pp), pxUnder = under(sv, p, ps, pp);

      if (cfg.showSignalsK && maOver) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: p * 0.995, shape: 'labelUp', color: GREEN, text: 'Buy', textColor: '#FFFFFF', size: 'tiny' });
      }
      if (cfg.showSignalsK && maUnder) {
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceTop', price: p * 1.005, shape: 'labelDown', color: RED, text: 'Sell', textColor: '#FFFFFF', size: 'tiny' });
      }
      if (cfg.showSignalsC && pxOver) {
        s.markers.push({ id: 'shape2', time: t, position: 'atPriceBottom', price: p * 0.995, shape: 'labelUp', color: BLUE_LABEL, text: 'Buy', textColor: '#FFFFFF', size: 'tiny' });
      }
      if (cfg.showSignalsC && pxUnder) {
        s.markers.push({ id: 'shape3', time: t, position: 'atPriceTop', price: p * 1.005, shape: 'labelDown', color: BLUE_LABEL, text: 'Sell', textColor: '#FFFFFF', size: 'tiny' });
      }

      // fill(mPlot, pALL): ohlc4 to PMax; green when MAvg > PMax, red when MAvg < PMax (na: no fill)
      s.upFillColors[i] = cfg.highlighting && mv > p ? UP_FILL : NO_FILL;
      s.downFillColors[i] = cfg.highlighting && mv < p ? DOWN_FILL : NO_FILL;

      s.plot0[i] = { time: t, value: p };
      s.plot1[i] = { time: t, value: cfg.showSupport ? mv : NaN };
      s.plot2[i] = { time: t, value: (b.open + b.high + b.low + b.close) / 4 };

      const flags = [maOver || maUnder, maOver, maUnder, pxOver || pxUnder, pxOver, pxUnder];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'UpTrend Highligter', color: UP_FILL }, colors: s.upFillColors.slice() },
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'DownTrend Highligter', color: DOWN_FILL }, colors: s.downFillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => !!f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ProfitMaximizerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ProfitMaximizerInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'PMax - Moving Avg Crossing!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'Moving Avg BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'Moving Avg SELL SIGNAL!' },
  { id: 'alert3', title: 'Price Cross Alert', message: 'PMax - Price Crossing!' },
  { id: 'alert4', title: 'Price Crossover Alarm', message: 'PRICE OVER PMax - BUY SIGNAL!' },
  { id: 'alert5', title: 'Price Crossunder Alarm', message: 'PRICE UNDER PMax - SELL SIGNAL!' },
];

export const ProfitMaximizer = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
