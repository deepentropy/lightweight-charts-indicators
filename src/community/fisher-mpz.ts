/**
 * Fisher MPz
 *
 * A weighted composite of three Fisher transforms (short / medium / long periods) of hl2, optionally winsorized
 * (capped at its 5th / 95th nearest-rank percentiles over a lookback). Each transform takes a robust z-score
 * ((src - median) / (1.4826 * median absolute deviation)), clips it at a level (fixed, or 0.05 to 0.2 from the
 * ratio of the ATR to its SMA), normalises it to -1..1, smooths it (Kalman filter or EMA-like), and applies the
 * Fisher transform 0.5 * ln((1 + x) / (1 - x)) followed by a second Kalman filter (or a 0.5 feedback). The trigger
 * is the composite of the previous bar, optionally smoothed by a 2-period EMA. Classic style: cyan composite and
 * white trigger; Filled style: both lines and a fill coloured by the direction (composite >= trigger).
 * Alerts (alert() calls, `alertCalls` of the result, once per bar), with "Enable Alerts" on: "Fisher MPz: Bullish
 * Crossover - Composite crossed above Trigger" (with "Alert on Bullish Crossover") and "Fisher MPz: Bearish Crossover -
 * Composite crossed below Trigger" (with "Alert on Bearish Crossover") on the bars where the composite crosses the
 * trigger.
 *
 * Reference: "Fisher MPz" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface FisherMPzInputs {
  /** Classic: cyan line with white trigger; Filled: directional colours and fill */
  visualStyle: 'Classic' | 'Filled';
  length1: number;
  length2: number;
  length3: number;
  weight1: number;
  weight2: number;
  weight3: number;
  useWinsorization: boolean;
  winsorLookback: number;
  lowerPercentile: number;
  upperPercentile: number;
  useKalman: boolean;
  /** Smoothing factor (when the Kalman filter is off) */
  smoothFactor: number;
  kalmanQ: number;
  kalmanR: number;
  useDynamicClip: boolean;
  zScoreClip: number;
  dynamicClipLength: number;
  /** 2-period EMA on the trigger line */
  smoothTrigger: boolean;
  showIndividual: boolean;
  compositeColor: string;
  triggerColor: string;
  bullishColor: string;
  bearishColor: string;
  /** Fill transparency (0 = solid, 100 = invisible) */
  fillOpacity: number;
  shortColor: string;
  mediumColor: string;
  longColor: string;
  /** Alert inputs: the alert() calls (`alertCalls`) */
  enableAlerts: boolean;
  alertOnBullish: boolean;
  alertOnBearish: boolean;
}

export const defaultInputs: FisherMPzInputs = {
  visualStyle: 'Classic',
  length1: 8,
  length2: 13,
  length3: 26,
  weight1: 4.0,
  weight2: 2.0,
  weight3: 1.0,
  useWinsorization: true,
  winsorLookback: 20,
  lowerPercentile: 5.0,
  upperPercentile: 95.0,
  useKalman: true,
  smoothFactor: 0.18,
  kalmanQ: 0.01,
  kalmanR: 0.1,
  useDynamicClip: true,
  zScoreClip: 0.7,
  dynamicClipLength: 20,
  smoothTrigger: true,
  showIndividual: false,
  compositeColor: '#00D9FF',
  triggerColor: '#FFFFFF',
  bullishColor: '#00FFFF',
  bearishColor: '#FF3366',
  fillOpacity: 50,
  shortColor: '#A78BFA',
  mediumColor: '#FBBF24',
  longColor: '#34D399',
  enableAlerts: false,
  alertOnBullish: false,
  alertOnBearish: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'visualStyle', type: 'string', title: 'Visual Style', defval: 'Classic', options: ['Classic', 'Filled'], group: 'Visual Style' },
  { id: 'length1', type: 'int', title: 'Short Period', defval: 8, min: 1, group: 'Periods' },
  { id: 'length2', type: 'int', title: 'Medium Period', defval: 13, min: 1, group: 'Periods' },
  { id: 'length3', type: 'int', title: 'Long Period', defval: 26, min: 1, group: 'Periods' },
  { id: 'weight1', type: 'float', title: 'Short Weight', defval: 4.0, min: 0.1, group: 'Weights' },
  { id: 'weight2', type: 'float', title: 'Medium Weight', defval: 2.0, min: 0.1, group: 'Weights' },
  { id: 'weight3', type: 'float', title: 'Long Weight', defval: 1.0, min: 0.1, group: 'Weights' },
  { id: 'useWinsorization', type: 'bool', title: 'Use Winsorization', defval: true, group: 'Winsorization' },
  { id: 'winsorLookback', type: 'int', title: 'Winsorization Lookback', defval: 20, min: 10, max: 200, group: 'Winsorization' },
  { id: 'lowerPercentile', type: 'float', title: 'Lower Percentile', defval: 5.0, min: 0.1, max: 49.9, group: 'Winsorization' },
  { id: 'upperPercentile', type: 'float', title: 'Upper Percentile', defval: 95.0, min: 50.1, max: 99.9, group: 'Winsorization' },
  { id: 'useKalman', type: 'bool', title: 'Use Kalman Filter', defval: true, group: 'Fisher Parameters' },
  { id: 'smoothFactor', type: 'float', title: 'Smoothing Factor (if Kalman off)', defval: 0.18, min: 0.01, max: 0.99, group: 'Fisher Parameters' },
  { id: 'kalmanQ', type: 'float', title: 'Kalman Process Noise (Q)', defval: 0.01, min: 0.001, max: 0.1, group: 'Fisher Parameters' },
  { id: 'kalmanR', type: 'float', title: 'Kalman Measurement Noise (R)', defval: 0.1, min: 0.01, max: 1.0, group: 'Fisher Parameters' },
  { id: 'useDynamicClip', type: 'bool', title: 'Use Dynamic Z-Score Clipping', defval: true, group: 'Fisher Parameters' },
  { id: 'zScoreClip', type: 'float', title: 'Base Z-Score Clip Level', defval: 0.7, min: 0.1, max: 5.0, group: 'Fisher Parameters' },
  { id: 'dynamicClipLength', type: 'int', title: 'Dynamic Clip Lookback', defval: 20, min: 5, max: 100, group: 'Fisher Parameters' },
  { id: 'smoothTrigger', type: 'bool', title: 'Add Smoothing to Trigger', defval: true, group: 'Fisher Parameters' },
  { id: 'showIndividual', type: 'bool', title: 'Show Individual Periods', defval: false, group: 'Display' },
  { id: 'compositeColor', type: 'color', title: 'Composite Fisher Color (Classic)', defval: '#00D9FF', group: 'Classic Style Colors' },
  { id: 'triggerColor', type: 'color', title: 'Trigger Line Color (Classic)', defval: '#FFFFFF', group: 'Classic Style Colors' },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color (Filled)', defval: '#00FFFF', group: 'Filled Style Colors' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color (Filled)', defval: '#FF3366', group: 'Filled Style Colors' },
  { id: 'fillOpacity', type: 'int', title: 'Fill Opacity', defval: 50, min: 0, max: 100, group: 'Filled Style Colors' },
  { id: 'shortColor', type: 'color', title: 'Short Period Color', defval: '#A78BFA', group: 'Individual Period Colors' },
  { id: 'mediumColor', type: 'color', title: 'Medium Period Color', defval: '#FBBF24', group: 'Individual Period Colors' },
  { id: 'longColor', type: 'color', title: 'Long Period Color', defval: '#34D399', group: 'Individual Period Colors' },
  { id: 'enableAlerts', type: 'bool', title: 'Enable Alerts', defval: false, group: 'Alerts' },
  { id: 'alertOnBullish', type: 'bool', title: 'Alert on Bullish Crossover', defval: false, group: 'Alerts' },
  { id: 'alertOnBearish', type: 'bool', title: 'Alert on Bearish Crossover', defval: false, group: 'Alerts' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite Fisher', color: '#00D9FF', lineWidth: 2 },
  { id: 'plot1', title: 'Trigger', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot2', title: 'Short Period', color: String(color.new('#A78BFA', 30)), lineWidth: 1 },
  { id: 'plot3', title: 'Medium Period', color: String(color.new('#FBBF24', 30)), lineWidth: 1 },
  { id: 'plot4', title: 'Long Period', color: String(color.new('#34D399', 30)), lineWidth: 1 },
];

/** hline(0, color = color.new(color.gray, 50), linestyle = hline.style_dotted, title = "Zero Line") */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: String(color.new(color.gray, 50)), linestyle: 'dotted' },
];

export const metadata = {
  title: 'Fisher MPz',
  shortTitle: 'Fisher MPz',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/**
 * The sorted window of `ta.percentile_nearest_rank(source, length, p)` stepped bar by bar, with the rules of the
 * oakscriptjs array function: every value is kept (na values too, after the values they do not compare with), a new
 * value goes before the first value that is >= it, the value of bar i - length leaves the window, the result is the
 * value of rank `rank` (na before bar length - 1). One window serves several percentages.
 */
class SortedWindow {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  /** The step of the current bar: its value, its insertion index, the post-insertion index of the value that leaves */
  private v = NaN;
  private k = 0;
  private out = -1;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(v: number): void {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.v = v;
    this.k = k;
    const i = this.count;
    if (i >= this.length) {
      const o = this.bars.indexOf(i - this.length);
      this.out = o < k ? o : o + 1;
    } else {
      this.out = -1;
    }
    this.stepped = true;
  }

  /** The value of rank `rank` (1-based) of the window with the value of the current bar */
  at(rank: number): number {
    if (this.count < this.length - 1) return NaN;
    const r = rank - 1;
    // the index in the window with the new value, before the removal
    const p = this.out >= 0 && r >= this.out ? r + 1 : r;
    if (p < this.k) return this.values[p]!;
    if (p === this.k) return this.v;
    return this.values[p - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count;
    this.values.splice(this.k, 0, this.v);
    this.bars.splice(this.k, 0, i);
    if (this.out >= 0) {
      this.values.splice(this.out, 1);
      this.bars.splice(this.out, 1);
    }
    this.count++;
  }
}

type Point = { time: number; value: number; color: string };

interface FisherVars {
  /** kalmanFilter(src, Q, R) call sites (var x = na, var P = na): two per transform */
  kx: number[];
  kP: number[];
  /** var float nValue1 = 0.0 / var float fisher = 0.0 of each transform */
  nValue1: number[];
  fisher: number[];
}

interface FisherRun extends BarRunState<FisherVars> {
  window: SortedWindow | null;
  atr: ReturnType<typeof taStep.atr> | null;
  atrSma: ReturnType<typeof taStep.sma> | null;
  medians: ReturnType<typeof taStep.median>[];
  mads: ReturnType<typeof taStep.median>[];
  trig: ReturnType<typeof taStep.ema>;
  composite: number[];
  trigger: number[];
  plots: Point[][];
  colors: string[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<FisherMPzInputs>): BarStudy<FisherRun, IndicatorResult & { alertCalls: AlertCall[] }> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.length1, cfg.length2, cfg.length3];
  const Q = cfg.kalmanQ;
  const R = cfg.kalmanR;
  const totalWeight = cfg.weight1 + cfg.weight2 + cfg.weight3;
  const isClassic = cfg.visualStyle === 'Classic';
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const indivColors = [cfg.shortColor, cfg.mediumColor, cfg.longColor].map((c) => String(color.new(c, 30)));
  const look = cfg.winsorLookback;
  const rankOf = (percentage: number) => Math.min(look, Math.max(1, Math.ceil((percentage / 100) * look)));
  /** kalmanFilter(src, Q, R) of call site k */
  const kalman = (v: FisherVars, k: number, src: number): number => {
    if (isNaN(v.kx[k])) {
      v.kx[k] = src;
      v.kP[k] = 1.0;
    }
    const xPrior = v.kx[k];
    const pPrior = v.kP[k] + Q;
    const K = pPrior / (pPrior + R);
    v.kx[k] = xPrior + K * (src - xPrior);
    v.kP[k] = (1 - K) * pPrior;
    return v.kx[k];
  };
  return {
    init() {
      let window: SortedWindow | null = null;
      if (cfg.useWinsorization) {
        // the length check of ta.percentile_nearest_rank
        taCore.percentile_nearest_rank([], look, cfg.lowerPercentile);
        window = new SortedWindow(look);
      }
      const atr = cfg.useDynamicClip ? taStep.atr(cfg.dynamicClipLength) : null;
      const atrSma = cfg.useDynamicClip ? taStep.sma() : null;
      const medians = lengths.map((l) => taStep.median(l));
      const mads = lengths.map((l) => taStep.median(l));
      const trig = taStep.ema(2);
      const s: FisherRun = {
        window, atr, atrSma, medians, mads, trig, composite: [], trigger: [],
        plots: [[], [], [], [], []], colors: [], alertCalls: [],
        steps: [...(window ? [window] : []), ...(atr ? [atr] : []), ...(atrSma ? [atrSma] : []), ...medians, ...mads, trig],
        vars: { kx: [NaN, NaN, NaN, NaN, NaN, NaN], kP: [NaN, NaN, NaN, NaN, NaN, NaN], nValue1: [0.0, 0.0, 0.0], fisher: [0.0, 0.0, 0.0] },
        lists: [], series: [],
      };
      s.lists = [s.alertCalls];
      s.series = [s.composite, s.trigger, ...s.plots, s.colors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const v = s.vars;
      // priceSource = useWinsorization ? winsorize(hl2, winsorLookback, lowerPercentile, upperPercentile) : hl2
      const rawPrice = (b.high + b.low) / 2;
      let priceSource = rawPrice;
      if (s.window) {
        s.window.step(rawPrice);
        const lowerT = s.window.at(rankOf(cfg.lowerPercentile));
        const upperT = s.window.at(rankOf(cfg.upperPercentile));
        priceSource = Math.max(lowerT, Math.min(rawPrice, upperT));
      }

      // calcDynamicClip(dynamicClipLength): the same on the three fisherTransform calls
      let clip = cfg.zScoreClip;
      if (s.atr && s.atrSma) {
        const a = s.atr.step(b.high, b.low, b.close);
        const atrSma = s.atrSma.step(a, cfg.dynamicClipLength);
        const volatilityRatio = gt(atrSma, 0) ? a / atrSma : 1.0;
        const normalizedVol = Math.min(Math.max((volatilityRatio - 0.5) / 1.5, 0), 1);
        clip = 0.05 + normalizedVol * (0.2 - 0.05);
      }

      const fishers = [NaN, NaN, NaN];
      for (let k = 0; k < 3; k++) {
        // calcRobustZScore(src, length)
        const median = s.medians[k].step(priceSource);
        const absDeviation = Math.abs(priceSource - median);
        const mad = s.mads[k].step(absDeviation);
        const robustStdDev = mad * 1.4826;
        const zScore = gt(robustStdDev, 0) ? (priceSource - median) / robustStdDev : 0.0;
        const zScoreClipped = Math.min(Math.max(zScore, -clip), clip);
        const normalized = zScoreClipped / clip;
        if (cfg.useKalman) v.nValue1[k] = kalman(v, 2 * k, normalized);
        else v.nValue1[k] = cfg.smoothFactor * normalized + (1 - cfg.smoothFactor) * nz(v.nValue1[k]);
        const nValue2 = Math.min(Math.max(v.nValue1[k], -0.999), 0.999);
        const raw = 0.5 * Math.log((1 + nValue2) / (1 - nValue2));
        if (cfg.useKalman) v.fisher[k] = kalman(v, 2 * k + 1, raw);
        else v.fisher[k] = raw + 0.5 * nz(v.fisher[k]);
        fishers[k] = v.fisher[k];
      }

      const composite = (fishers[0] * cfg.weight1 + fishers[1] * cfg.weight2 + fishers[2] * cfg.weight3) / totalWeight;
      s.composite[i] = composite;
      const compositePrev = i > 0 ? s.composite[i - 1] : NaN;
      // trigger = smoothTrigger ? ta.ema(composite[1], 2) : composite[1]
      const emaPrev = s.trig.step(compositePrev);
      const trigger = cfg.smoothTrigger ? emaPrev : compositePrev;
      s.trigger[i] = trigger;

      // bullishCross = ta.crossover(composite, trigger); bearishCross = ta.crossunder(composite, trigger)
      // if enableAlerts and alertOnBullish and bullishCross: alert("...", alert.freq_once_per_bar); bearish alike
      const pc = compositePrev;
      const pt = i > 0 ? s.trigger[i - 1] : NaN;
      const bullishCross = composite > trigger && pc <= pt;
      const bearishCross = composite < trigger && pc >= pt;
      if (cfg.enableAlerts && cfg.alertOnBullish && bullishCross) {
        s.alertCalls.push({ time: time as number, message: 'Fisher MPz: Bullish Crossover - Composite crossed above Trigger', freq: 'once_per_bar' });
      }
      if (cfg.enableAlerts && cfg.alertOnBearish && bearishCross) {
        s.alertCalls.push({ time: time as number, message: 'Fisher MPz: Bearish Crossover - Composite crossed below Trigger', freq: 'once_per_bar' });
      }

      const dirColor = ge(composite, trigger) ? cfg.bullishColor : cfg.bearishColor;
      s.plots[0][i] = { time, value: fin(composite), color: isClassic ? cfg.compositeColor : dirColor };
      s.plots[1][i] = { time, value: fin(trigger), color: isClassic ? cfg.triggerColor : dirColor };
      for (let k = 0; k < 3; k++) s.plots[2 + k][i] = { time, value: cfg.showIndividual ? fin(fishers[k]) : NaN, color: indivColors[k] };
      // fill(p1, p2, color = isClassic ? na : color.new(isBullish ? bullishColor : bearishColor, fillOpacity))
      s.colors[i] = isClassic ? 'transparent' : String(color.new(dirColor, cfg.fillOpacity));
    },
    copyVars: (v) => ({ kx: v.kx.slice(), kP: v.kP.slice(), nValue1: v.nValue1.slice(), fisher: v.fisher.slice() }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.colors.slice(), options: { title: 'Direction Fill' } }],
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FisherMPzInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult & { alertCalls: AlertCall[] }> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FisherMPzInputs> = {}): IndicatorResult & { alertCalls: AlertCall[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const FisherMPz = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
  createRun,
};
