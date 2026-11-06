/**
 * [CT] Trend Pulse Oscillator
 *
 * The spread between a fast and a slow EMA of the source is divided by the ATR (0 while the ATR is not > 0) and
 * bounded to 0..100: osc = 50 + 50 * (2 / pi) * atan(spread / atr * speed). The signal line is an EMA of the
 * oscillator; the pulse histogram is osc - signal. The fill between the oscillator and the signal, the histogram and
 * the optional bar colours use the bull colour when osc >= signal, else the bear colour. Dashed levels at 50 and at
 * the overbought / oversold values.
 * Alerts (alertcondition, `alerts` of the result): the oscillator crossing over / under the signal, over / under 50,
 * over the overbought level and under the oversold level.
 *
 * Reference: "[CT] Trend Pulse Oscillator" by ChaosTrader63
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendPulseOscillatorInputs {
  src: SourceType;
  /** Fast EMA length */
  fastLen: number;
  /** Slow EMA length */
  slowLen: number;
  /** ATR length */
  atrLen: number;
  /** Speed (sensitivity): multiplier of the normalized spread */
  speed: number;
  /** Signal EMA length */
  sigLen: number;
  /** Overbought level */
  ob: number;
  /** Oversold level */
  os: number;
  /** Fill between the oscillator and the signal */
  showFill: boolean;
  /** Transparency of the fill */
  fillOpacity: number;
  /** Show the pulse histogram (osc - signal) */
  showHist: boolean;
  /** Colour the price bars */
  showBars: boolean;
  bullCol: string;
  bearCol: string;
  sigCol: string;
  oscCol: string;
}

export const defaultInputs: TrendPulseOscillatorInputs = {
  src: 'close',
  fastLen: 9,
  slowLen: 21,
  atrLen: 14,
  speed: 2.0,
  sigLen: 9,
  ob: 80,
  os: 20,
  showFill: true,
  fillOpacity: 85,
  showHist: true,
  showBars: false,
  bullCol: color.lime,
  bearCol: color.red,
  sigCol: color.aqua,
  oscCol: color.teal,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastLen', type: 'int', title: 'Fast EMA', defval: 9, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow EMA', defval: 21, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'speed', type: 'float', title: 'Speed (Sensitivity)', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'ob', type: 'float', title: 'Overbought', defval: 80, min: 0, max: 100 },
  { id: 'os', type: 'float', title: 'Oversold', defval: 20, min: 0, max: 100 },
  { id: 'showFill', type: 'bool', title: 'Fill Between Osc & Signal', defval: true },
  { id: 'fillOpacity', type: 'int', title: 'Fill Opacity', defval: 85, min: 0, max: 100 },
  { id: 'showHist', type: 'bool', title: 'Show Pulse Histogram (Osc - Signal)', defval: true },
  { id: 'showBars', type: 'bool', title: 'Color Price Bars (on chart)', defval: false },
  { id: 'bullCol', type: 'color', title: 'Bull Color', defval: color.lime },
  { id: 'bearCol', type: 'color', title: 'Bear Color', defval: color.red },
  { id: 'sigCol', type: 'color', title: 'Signal Color', defval: color.aqua },
  { id: 'oscCol', type: 'color', title: 'Osc Color', defval: color.teal },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Osc', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: color.aqua, lineWidth: 2 },
  { id: 'plot2', title: 'Pulse (Osc - Signal)', color: color.lime, lineWidth: 2, style: 'histogram' },
];

/** hline(50 / ob / os) with the default levels */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Mid', color: String(color.new(color.gray, 60)), linestyle: 'dashed' },
  { id: 'hline_ob', price: 80, title: 'Overbought', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
  { id: 'hline_os', price: 20, title: 'Oversold', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
];

/** fill(pOsc, pSig): per-bar colours in the result (bull colour when osc >= signal) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_osc_sig', plot1: 'plot0', plot2: 'plot1', color: String(color.new(color.lime, 85)), title: 'Osc/Signal Fill' },
];

export const metadata = {
  title: '[CT] Trend Pulse Oscillator',
  shortTitle: '[CT] TPO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

interface TpoRun extends BarRunState<Record<string, never>> {
  fast: Ema;
  slow: Ema;
  atr: ReturnType<typeof taStep.atr>;
  sigMa: Ema;
  osc: number[];
  sig: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendPulseOscillatorInputs>): BarStudy<TpoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fillBull = String(color.new(cfg.bullCol, cfg.fillOpacity));
  const fillBear = String(color.new(cfg.bearCol, cfg.fillOpacity));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(cfg.fastLen);
      const slow = taStep.ema(cfg.slowLen);
      const atr = taStep.atr(cfg.atrLen);
      const sigMa = taStep.ema(cfg.sigLen);
      const s: TpoRun = {
        fast, slow, atr, sigMa, osc: [], sig: [], plot0: [], plot1: [], plot2: [], fillColors: [], barColors: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [fast, slow, atr, sigMa], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.osc, s.sig, s.plot0, s.plot1, s.plot2, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = value(b);
      const fast = s.fast.step(v);
      const slow = s.slow.step(v);
      const atr = s.atr.step(b.high, b.low, b.close);

      // norm = atr > 0 ? spread / atr : 0.0 (an na ATR gives 0); osc = 50 + 50 * (2 / pi) * atan(norm * speed)
      const spread = fast - slow;
      const norm = gt(atr, 0) ? spread / atr : 0.0;
      const osc = 50.0 + 50.0 * (2.0 / Math.PI) * Math.atan(norm * cfg.speed);
      const sig = s.sigMa.step(osc);
      s.osc[i] = osc;
      s.sig[i] = sig;
      const pulse = osc - sig;

      // osc >= sig (na compares false: bear colour)
      const bull = ge(osc, sig);
      const dirColor = bull ? cfg.bullCol : cfg.bearCol;
      if (cfg.showBars) s.barColors.push({ time: t, color: dirColor });

      s.plot0[i] = { time: t, value: osc, color: cfg.oscCol };
      s.plot1[i] = { time: t, value: sig, color: cfg.sigCol };
      s.plot2[i] = { time: t, value: cfg.showHist ? pulse : NaN, color: dirColor };
      s.fillColors[i] = cfg.showFill ? (bull ? fillBull : fillBear) : 'transparent';

      // alertcondition(ta.crossover(osc, sig)) / crossunder(osc, sig) / crossover(osc, 50) / crossunder(osc, 50) /
      // crossover(osc, ob) / crossunder(osc, os)
      const po = i > 0 ? s.osc[i - 1] : NaN;
      const ps = i > 0 ? s.sig[i - 1] : NaN;
      const pl = i > 0 ? 50 : NaN;
      const pob = i > 0 ? cfg.ob : NaN;
      const pos = i > 0 ? cfg.os : NaN;
      const flags = [
        osc > sig && po <= ps, osc < sig && po >= ps, osc > 50 && po <= pl, osc < 50 && po >= pl,
        osc > cfg.ob && po <= pob, osc < cfg.os && po >= pos,
      ];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 50, options: { title: 'Mid', color: String(color.new(color.gray, 60)), linestyle: 'dashed' } },
          { value: cfg.ob, options: { title: 'Overbought', color: String(color.new(color.gray, 70)), linestyle: 'dashed' } },
          { value: cfg.os, options: { title: 'Oversold', color: String(color.new(color.gray, 70)), linestyle: 'dashed' } },
        ],
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Osc/Signal Fill' }, colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendPulseOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendPulseOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Osc Cross Up Signal', message: 'TPO: Osc crossed ABOVE Signal (bull)' },
  { id: 'alert1', title: 'Osc Cross Down Signal', message: 'TPO: Osc crossed BELOW Signal (bear)' },
  { id: 'alert2', title: 'Osc Cross Up 50', message: 'TPO: Osc crossed ABOVE 50' },
  { id: 'alert3', title: 'Osc Cross Down 50', message: 'TPO: Osc crossed BELOW 50' },
  { id: 'alert4', title: 'Osc Cross Up OB', message: 'TPO: Osc crossed ABOVE Overbought' },
  { id: 'alert5', title: 'Osc Cross Down OS', message: 'TPO: Osc crossed BELOW Oversold' },
];

export const TrendPulseOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
