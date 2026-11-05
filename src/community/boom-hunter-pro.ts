/**
 * Boom Hunter Pro
 *
 * Three Ehlers Even Better Sinewave / Roofing Filter oscillators (EOT1, EOT2, EOT3)
 * with different periods. Uses Ehlers Highpass filter (100-bar) into SuperSmoother,
 * then Fast Attack / Slow Decay normalization. Quotient transform with K parameters.
 * LSMA WaveTrend using linreg for additional confluence.
 * Entry signals from crossover conditions on quotient + trigger.
 *
 * Markers as the original's plotshape outputs (ids shape0..shape9): exit warnings (orange circle, red "Overbought"),
 * the four "Long" labels (gray, yellow, blue, lime), the "Short" label, the "Continuation" triangle (break of the
 * resistance pivot of the main oscillator after a support break) and the two "Bounce" triangles of the LSMA wave
 * trend (wt2 = SMA 6 of avg(TCI, MF, RSI 3) of hlc3, at wt2 + 9 / wt2 - 9). The lengths of the LSMA wave trend and of
 * the support / resistance pivots are the original's default inputs.
 *
 * Alerts (alertcondition, `alerts` of the result): the original's 16 conditions.
 *
 * Reference: "Boom Hunter Pro" by veryfid
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions (all with the default message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Crossover', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Crossunder', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Long', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Entry Zone', message: 'Alert Fired!' },
  { id: 'alert4', title: 'Break Resistance', message: 'Alert Fired!' },
  { id: 'alert5', title: 'Break Support', message: 'Alert Fired!' },
  { id: 'alert6', title: 'Crossover - Market Low', message: 'Alert Fired!' },
  { id: 'alert7', title: 'Crossunder - Market High', message: 'Alert Fired!' },
  { id: 'alert8', title: 'Crossover With Pressure', message: 'Alert Fired!' },
  { id: 'alert9', title: 'Crossunder With Pressure', message: 'Alert Fired!' },
  { id: 'alert10', title: 'Continuation', message: 'Alert Fired!' },
  { id: 'alert11', title: 'Orange - Overbought', message: 'Alert Fired!' },
  { id: 'alert12', title: 'Red - Overbought', message: 'Alert Fired!' },
  { id: 'alert13', title: 'Bounce down', message: 'Alert Fired!' },
  { id: 'alert14', title: 'Bounce up', message: 'Alert Fired!' },
  { id: 'alert15', title: 'Short', message: 'Alert Fired!' },
];

export interface BoomHunterProInputs {
  lpPeriod: number;
  k1: number;
  trigLen: number;
  lpPeriod2: number;
  k12: number;
  k22: number;
  lpPeriod3: number;
  k13: number;
  square: boolean;
  showLongs: boolean;
  showShorts: boolean;
  /** Show Entry and Exit Points? (the exit warning circles) */
  showEntry: boolean;
}

export const defaultInputs: BoomHunterProInputs = {
  lpPeriod: 6,
  k1: 0,
  trigLen: 2,
  lpPeriod2: 27,
  k12: 0.8,
  k22: 0.3,
  lpPeriod3: 11,
  k13: 0.99,
  square: true,
  showLongs: true,
  showShorts: true,
  showEntry: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lpPeriod', type: 'int', title: 'EOT1 LPPeriod', defval: 6, min: 1 },
  { id: 'k1', type: 'float', title: 'EOT1 K1', defval: 0, step: 0.1 },
  { id: 'trigLen', type: 'int', title: 'Trigger Length', defval: 2, min: 1 },
  { id: 'lpPeriod2', type: 'int', title: 'EOT2 LPPeriod', defval: 27, min: 1 },
  { id: 'k12', type: 'float', title: 'EOT2 K1', defval: 0.8, step: 0.1 },
  { id: 'k22', type: 'float', title: 'EOT2 K2', defval: 0.3, step: 0.1 },
  { id: 'lpPeriod3', type: 'int', title: 'EOT3 LPPeriod', defval: 11, min: 1 },
  { id: 'k13', type: 'float', title: 'EOT3 K1', defval: 0.99, step: 0.01 },
  { id: 'square', type: 'bool', title: 'Square Line', defval: true },
  { id: 'showLongs', type: 'bool', title: 'Show Long Entries', defval: true },
  { id: 'showShorts', type: 'bool', title: 'Show Short Entries', defval: true },
  { id: 'showEntry', type: 'bool', title: 'Show Entry and Exit Points?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Quotient1', color: '#0000FF', lineWidth: 2 },
  { id: 'plot1', title: 'Trigger', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot2', title: 'Q3 (Red Wave)', color: '#FF000080', lineWidth: 1 },
  { id: 'plot3', title: 'Q5 (Yellow)', color: '#FFFF00', lineWidth: 1 },
  { id: 'plot4', title: 'Q6 (Blue Boom)', color: '#0000FF', lineWidth: 1 },
  { id: 'plot5', title: 'Q4 (Red Wave)', color: '#FF000080', lineWidth: 1 },
];

export const metadata = {
  title: 'Boom Hunter Pro',
  shortTitle: 'Boom Pro',
  overlay: false,
};

/**
 * Ehlers Highpass + SuperSmoother + Fast Attack/Slow Decay + Quotient transform, one bar at a time.
 * Writes the two quotients for the K1 and K2 parameters of bar `i` (HP, Filt and Peak kept per bar).
 */
class EhlersEot {
  readonly HP: number[] = [];
  readonly Filt: number[] = [];
  readonly Peak: number[] = [];
  readonly q1: number[] = [];
  readonly q2: number[] = [];
  private readonly alpha1: number;
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;

  constructor(lpPeriod: number, private readonly paramK1: number, private readonly paramK2: number, private readonly hpDivisor: number = 2) {
    const pi = Math.PI;
    // Highpass filter: period=100
    this.alpha1 = (Math.cos(0.707 * 2 * pi / 100) + Math.sin(0.707 * 2 * pi / 100) - 1) / Math.cos(0.707 * 2 * pi / 100);
    // SuperSmoother
    const a1 = Math.exp(-1.414 * pi / lpPeriod);
    const b1 = 2 * a1 * Math.cos(1.414 * pi / lpPeriod);
    this.c2 = b1;
    this.c3 = -a1 * a1;
    this.c1 = 1 - this.c2 - this.c3;
  }

  get series(): number[][] {
    return [this.HP, this.Filt, this.Peak, this.q1, this.q2];
  }

  step(closeArr: number[], i: number): void {
    const { alpha1, hpDivisor, HP, Filt, Peak, c1, c2, c3 } = this;
    HP[i] = i < 2 ? 0 : (1 - alpha1 / hpDivisor) * (1 - alpha1 / 2) * (closeArr[i] - 2 * closeArr[i - 1] + closeArr[i - 2])
      + 2 * (1 - alpha1) * HP[i - 1]
      - (1 - alpha1) * (1 - alpha1) * HP[i - 2];
    Filt[i] = i < 2 ? 0 : c1 * (HP[i] + HP[i - 1]) / 2 + c2 * Filt[i - 1] + c3 * Filt[i - 2];

    // Fast Attack / Slow Decay
    let X = 0;
    if (i === 0) {
      Peak[i] = 0;
    } else {
      Peak[i] = 0.991 * Peak[i - 1];
      if (Math.abs(Filt[i]) > Peak[i]) Peak[i] = Math.abs(Filt[i]);
      if (Peak[i] !== 0) X = Filt[i] / Peak[i];
    }

    // Quotient transform
    const denom1 = this.paramK1 * X + 1;
    this.q1[i] = denom1 !== 0 ? (X + this.paramK1) / denom1 : 0;
    const denom2 = this.paramK2 * X + 1;
    this.q2[i] = denom2 !== 0 ? (X + this.paramK2) / denom2 : 0;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface BoomVars {
  /** ta.barssince: the last bar of each condition (-1: none yet) */
  lastWarn2: number;
  lastWarn3: number;
  lastUp20: number;
  lastUp80: number;
  lastDn0: number;
  lastDn20: number;
  lastWtUp80: number;
  lastWtDn20: number;
  /** fixnan of the pivots */
  fixHigh: number;
  fixLow: number;
  /** var dbreak / ubreak */
  dbreak: number;
  ubreak: number;
}

interface BoomRun extends BarRunState<BoomVars> {
  eot1: EhlersEot;
  eot2: EhlersEot;
  eot3: EhlersEot;
  trig: ReturnType<typeof taStep.sma>;
  emaSrc: ReturnType<typeof taStep.ema>;
  absDev: ReturnType<typeof taStep.ema>;
  tciEma: ReturnType<typeof taStep.ema>;
  upSum: ReturnType<typeof taStep.sum>;
  dnSum: ReturnType<typeof taStep.sum>;
  rsi3: ReturnType<typeof taStep.rsi>;
  wt2Sma: ReturnType<typeof taStep.sma>;
  ph: PivotStep;
  pl: PivotStep;
  close: number[];
  src: number[];
  q1: number[];
  trigger: number[];
  crossState: number[];
  drag: number[];
  phArr: number[];
  plArr: number[];
  highUse: number[];
  lowUse: number[];
  wt2: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BoomHunterProInputs>): BarStudy<BoomRun, Result> {
  const { lpPeriod, k1, trigLen, lpPeriod2, k12, k22, lpPeriod3, k13, square, showLongs, showShorts, showEntry } = { ...defaultInputs, ...inputs };
  const K2 = 0.3;
  const esize = 60;
  const ey = 50;

  // EOT3: K13/K33 with square option
  let finalK13 = k13;
  let k33 = -k13;
  if (square) {
    finalK13 = 0.9999;
    k33 = -0.9999;
  }
  const dragNo = 3;
  const warmup = 5;

  // LSMA wave trend: wt1 = tradition(hlc3) = avg(tci, mf, rsi(src, n3)), wt2 = sma(wt1, 6) (n1 = 9, n2 = 6, n3 = 3)
  const n1 = 9;
  const n2 = 6;
  const n3 = 3;

  // version 5 colour constants: color.red #FF5252, color.yellow #FFEB3B
  const RED = '#FF5252';
  const YELLOW = '#FFEB3B';
  const longText = String(color.new(color.white, 20));
  const label = (time: number, c: string, text: string, id: string): MarkerData => (
    { time, position: 'top', shape: 'labelDown', color: String(color.new(c, 20)), text, textColor: longText, size: 'tiny', id });

  return {
    init() {
      const s: BoomRun = {
        // EOT 1: main oscillator (hp divisor = 2)
        eot1: new EhlersEot(lpPeriod, k1, K2, 2),
        // EOT 2: red wave (hp divisor = 2)
        eot2: new EhlersEot(lpPeriod2, k12, k22, 2),
        // EOT 3: yellow line (hp divisor = 3 per Pine source line 170: (1-alpha/3)*(1-alpha/2))
        eot3: new EhlersEot(lpPeriod3, finalK13, k33, 3),
        trig: taStep.sma(), emaSrc: taStep.ema(n1), absDev: taStep.ema(n1), tciEma: taStep.ema(n2),
        upSum: taStep.sum(), dnSum: taStep.sum(), rsi3: taStep.rsi(n3), wt2Sma: taStep.sma(),
        ph: new PivotStep(1, 1, true), pl: new PivotStep(5, 5, false),
        close: [], src: [], q1: [], trigger: [], crossState: [], drag: [], phArr: [], plArr: [], highUse: [],
        lowUse: [], wt2: [], plots: Array.from({ length: 6 }, () => []), markers: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [],
        vars: {
          lastWarn2: -1, lastWarn3: -1, lastUp20: -1, lastUp80: -1, lastDn0: -1, lastDn20: -1, lastWtUp80: -1,
          lastWtDn20: -1, fixHigh: NaN, fixLow: NaN, dbreak: 0, ubreak: 0,
        },
        lists: [], series: [],
      };
      s.steps = [s.trig, s.emaSrc, s.absDev, s.tciEma, s.upSum, s.dnSum, s.rsi3, s.wt2Sma, s.ph, s.pl];
      s.lists = [s.markers, ...s.times];
      s.series = [
        ...s.eot1.series, ...s.eot2.series, ...s.eot3.series, s.close, s.src, s.q1, s.trigger, s.crossState, s.drag,
        s.phArr, s.plArr, s.highUse, s.lowUse, s.wt2, ...s.plots, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      s.close[i] = b.close;
      s.eot1.step(s.close, i);
      s.eot2.step(s.close, i);
      s.eot3.step(s.close, i);
      const Q1 = s.eot1.q1;
      const Q2 = s.eot1.q2;
      const Q3 = s.eot2.q1;
      const Q4 = s.eot2.q2;
      const Q5 = s.eot3.q1;
      const Q6 = s.eot3.q2;

      // Scale to chart: q * esize + ey
      const q1v = Q1[i] * esize + ey;
      const q3v = Q3[i] * esize + ey;
      const q4v = Q4[i] * esize + ey;
      const q5v = Q5[i] * esize + ey;
      const q6v = Q6[i] * esize + ey;
      s.q1[i] = q1v;

      // Trigger = SMA(q1, trigLen)
      const t = s.trig.step(q1v, trigLen);
      s.trigger[i] = t;

      // Track crossover state for coloring
      if (i === 0) {
        s.crossState[i] = 0;
      } else {
        const prevQ1 = s.q1[i - 1];
        const prevT = s.trigger[i - 1] ?? 0;
        if (prevQ1 <= prevT && q1v > (t ?? 0)) s.crossState[i] = 1;
        else if (prevQ1 >= prevT && q1v < (t ?? 0)) s.crossState[i] = 0;
        else s.crossState[i] = s.crossState[i - 1];
      }

      // Drag counter: consecutive bars with Quotient1 <= -1
      if (i === 0) s.drag[i] = 0;
      else if (Q1[i] <= -1) s.drag[i] = s.drag[i - 1] + 1;
      else if (Q1[i - 1] <= -0.9 && Q1[i] > -0.9) s.drag[i] = 0;
      else s.drag[i] = s.drag[i - 1];

      // Plot 0: q1 colored by state
      const p = s.plots;
      if (i < warmup || isNaN(q1v)) {
        p[0][i] = { time, value: NaN };
      } else {
        let col: string;
        if (s.crossState[i] === 1) col = '#00FFAA';
        else if (s.drag[i] >= dragNo) col = '#800080';
        else if (Q1[i] <= -0.8) col = '#FFFF00';
        else if (Q3[i] <= -0.9) col = '#FFFFFF';
        else if (s.crossState[i] === 0) col = '#FF0000';
        else col = '#808080';
        p[0][i] = { time, value: q1v, color: col };
      }
      // Plot 1: trigger line
      p[1][i] = { time, value: (i < warmup || t == null || isNaN(t)) ? NaN : t };
      // Plot 2: q3 (red wave EOT2)
      p[2][i] = { time, value: (i < warmup || isNaN(q3v)) ? NaN : q3v };
      // Plot 3: q5 (yellow EOT3)
      p[3][i] = { time, value: (i < warmup || isNaN(q5v)) ? NaN : q5v };
      // Plot 4: q6 (blue boom line EOT3)
      p[4][i] = { time, value: (i < warmup || isNaN(q6v)) ? NaN : q6v };
      // Plot 5: q4 (EOT2, Quotient 2 of the red wave), filled with q3
      p[5][i] = { time, value: (i < warmup || isNaN(q4v)) ? NaN : q4v };

      // Conditions of the original (ta.crossover / ta.crossunder / ta.cross, ta.barssince: na before the first true bar)
      const at = (x: number[] | number, k: number) => (typeof x === 'number' ? x : k >= 0 ? x[k] ?? NaN : NaN);
      const xo = (a: number[], c: number[] | number) => a[i] > at(c, i) && at(a, i - 1) <= at(c, i - 1);
      const xu = (a: number[], c: number[] | number) => a[i] < at(c, i) && at(a, i - 1) >= at(c, i - 1);
      const cross = (a: number[], c: number[] | number) => xo(a, c) || xu(a, c);
      const since = (last: number) => (last < 0 ? NaN : i - last);

      // LSMA wave trend
      const src = (b.high + b.low + b.close) / 3;
      s.src[i] = src;
      const volume = b.volume ?? NaN;
      const emaSrc = s.emaSrc.step(src);
      const absDev = s.absDev.step(Math.abs(src - emaSrc));
      const tci = s.tciEma.step((src - emaSrc) / (0.025 * absDev)) + 50;
      const change = i > 0 ? src - s.src[i - 1] : NaN;
      const upSum = s.upSum.step(volume * (change <= 0 ? 0 : src), n3);
      const dnSum = s.dnSum.step(volume * (change >= 0 ? 0 : src), n3);
      const mf = 100.0 - 100.0 / (1.0 + upSum / dnSum);
      const rsi3 = s.rsi3.step(src);
      const wt1 = (tci + mf + rsi3) / 3;
      const wt2v = s.wt2Sma.step(wt1, 6);
      s.wt2[i] = wt2v;

      // Support / resistance pivots of q1: fixnan(ta.pivothigh(q1, 1, 1)[1]), fixnan(ta.pivotlow(q1, 5, 5)[1])
      s.phArr[i] = s.ph.step(i, q1v);
      s.plArr[i] = s.pl.step(i, q1v);
      const phPrev = i > 0 ? s.phArr[i - 1] : NaN;
      const plPrev = i > 0 ? s.plArr[i - 1] : NaN;
      if (!isNaN(phPrev)) v.fixHigh = phPrev;
      if (!isNaN(plPrev)) v.fixLow = plPrev;
      s.highUse[i] = v.fixHigh;
      s.lowUse[i] = v.fixLow;

      const q1 = s.q1;
      const crossover = xo(q1, s.trigger);
      const crossunder = xu(q1, s.trigger);
      const entry = xu(Q2, -0.9);
      const breakRes = xo(q1, s.highUse);
      const breakSup = xu(q1, s.lowUse);
      // var dbreak / ubreak: support breaks since the last entry, resistance breaks after them
      if (breakSup) v.dbreak += 1;
      if (entry) {
        v.dbreak = 0;
        v.ubreak = 0;
      }
      if (breakRes && v.dbreak >= 1) v.ubreak += 1;
      const continuation = breakRes && v.dbreak >= 1 && v.ubreak <= 1;

      const over = cross(Q5, Q6) && Q5[i] > 0.5;
      const over3 = cross(Q3, Q4) && Q3[i] > 0;
      if (xo(Q1, -0.9)) v.lastWarn2 = i;
      if (xu(Q1, 0.9)) v.lastWarn3 = i;
      if (xo(q1, 20)) v.lastUp20 = i;
      if (xo(q1, 80)) v.lastUp80 = i;
      if (q1v <= 0 && crossunder) v.lastDn0 = i;
      if (q1v <= 20 && crossunder) v.lastDn20 = i;
      const sinceWarn2 = since(v.lastWarn2);
      const sinceWarn3 = since(v.lastWarn3);
      const sinceUp20 = since(v.lastUp20);
      const sinceUp80 = since(v.lastUp80);
      const sinceDn0 = since(v.lastDn0);
      const sinceDn20 = since(v.lastDn20);
      const enter3 = Q3[i] <= -0.9 && crossover && sinceWarn2 <= 7 && q1v <= 20 && sinceUp20 <= 21;
      const enter5 = sinceDn0 <= 5 && crossover;
      const enter6 = sinceDn20 <= 11 && crossover;
      const enter7 = Q3[i] <= -0.9 && crossover;
      const senter3 = Q3[i] >= -0.9 && crossunder && sinceWarn3 <= 7 && q1v >= 99 && sinceUp80 <= 21;
      if (xo(s.wt2, 80)) v.lastWtUp80 = i;
      if (xu(s.wt2, 20)) v.lastWtDn20 = i;
      const sinceWtUp80 = since(v.lastWtUp80);
      const sinceWtDn20 = since(v.lastWtDn20);
      const wtDn80 = xu(s.wt2, 80);
      const wtUp20 = xo(s.wt2, 20);
      const bounceDown = sinceWtUp80 <= 1 && wtDn80;
      const bounceUp = sinceWtDn20 <= 1 && wtUp20;

      // plotshape outputs of the original, in declaration order (id shape<k>)
      const markers = s.markers;
      // plotshape(showentry ? over : na, 'Exit Warning', location.bottom, shape.circle, size.tiny, orange)
      if (showEntry && over) markers.push({ time, position: 'bottom', shape: 'circle', color: color.orange, size: 'tiny', id: 'shape0' });
      // plotshape(showentry ? over3 : na, 'Exit Warning', location.bottom, shape.circle, size.tiny, red, 'Overbought')
      if (showEntry && over3) {
        markers.push({ time, position: 'bottom', shape: 'circle', color: RED, text: 'Overbought', size: 'tiny', id: 'shape1' });
      }
      // 'Long gray' (enter6 and q1 <= 60), 'Long yellow' (enter7), 'Long blue' (enter5), 'Long Lime' (enter3)
      if (showLongs && enter6 && q1v <= 60) markers.push(label(time, color.silver, 'Long', 'shape2'));
      if (showLongs && enter7) markers.push(label(time, YELLOW, 'Long', 'shape3'));
      if (showLongs && enter5) markers.push(label(time, color.blue, 'Long', 'shape4'));
      if (showLongs && enter3) markers.push(label(time, color.lime, 'Long', 'shape5'));
      // plotshape(showshorts ? senter3 : na, 'Break', text = 'Short', labeldown, location.top, red)
      if (showShorts && senter3) markers.push(label(time, RED, 'Short', 'shape6'));
      // plotshape(crossover(q1, highUsePivot) and dbreak >= 1 and ubreak <= 1, 'Break', triangleup, location.bottom)
      if (continuation) {
        markers.push({ time, position: 'bottom', shape: 'triangleUp', color: '#00ffaa', text: 'Continuation', size: 'tiny', id: 'shape7' });
      }
      // plotshape(bounce down ? wt2 + 9 : na, location.absolute, triangledown, yellow), bounce up at wt2 - 9
      if (bounceDown) {
        markers.push({ time, position: 'atPriceMiddle', price: wt2v + 9, shape: 'triangleDown', color: YELLOW, size: 'tiny', id: 'shape8' });
      }
      if (bounceUp) {
        markers.push({ time, position: 'atPriceMiddle', price: wt2v - 9, shape: 'triangleUp', color: YELLOW, size: 'tiny', id: 'shape9' });
      }

      const flag = (k: number, f: boolean) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      };
      flag(0, crossover);
      flag(1, crossunder);
      flag(2, enter6 || enter7 || enter5 || enter3);
      flag(3, xu(Q5, -0.9));
      flag(4, breakRes);
      flag(5, breakSup);
      flag(6, Q1[i] <= -0.9 && crossover);
      flag(7, Q1[i] >= 0.9 && crossunder);
      flag(8, wt2v <= 20 && crossover);
      flag(9, wt2v >= 80 && crossunder);
      flag(10, continuation);
      flag(11, over);
      flag(12, over3);
      flag(13, bounceDown);
      flag(14, bounceUp);
      flag(15, senter3);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice(), 'plot5': p[5].slice() },
        hlines: [],
        // fill(Plot33, Plot44, color = color.new(color.red, 90))
        fills: [{ plot1: 'plot2', plot2: 'plot5', options: { color: String(color.new('#FF5252', 90)), title: 'Plots Background' } }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BoomHunterProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BoomHunterProInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BoomHunterPro = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
