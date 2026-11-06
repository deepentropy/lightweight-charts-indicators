/**
 * ReadyFor401ks Just Tell Me When!
 *
 * A baseline moving average (JMA by default, or EMA / DEMA / TEMA / HMA / SMA / VAMA / WMA) of the close with a
 * Keltner channel (baseline +- EMA of the true range * multiplier): the baseline, the channel edges, their fill and
 * the bars are aqua above the channel, red below it and gray inside. Three SSL channels (moving averages of the high
 * and of the low) give a trend side each: the continuation SSL is drawn as circles, green / purple when the close is
 * beyond the baseline and the continuation line with the ATR criterion, white otherwise; crosses of the close and of
 * the exit SSL give yellow exit arrows (`arrows` of the result, the original's plotarrow). A cross marks candles whose body is larger than the ATR while the ATR bands
 * contain the baseline. Optional ATR bands (close +- ATR * multiplier).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Long or Sell Short' (the close crosses over the exit SSL) and
 * 'Sell Long or Buy Short' (the exit SSL crosses over the close).
 *
 * Reference: "ReadyFor401ks Just Tell Me When!" by ReadyFor401k
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ArrowData } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type MaType = 'EMA' | 'DEMA' | 'TEMA' | 'HMA' | 'JMA' | 'SMA' | 'VAMA' | 'WMA';
const MA_TYPES: MaType[] = ['EMA', 'DEMA', 'TEMA', 'HMA', 'JMA', 'SMA', 'VAMA', 'WMA'];

export interface Readyfor401ksJustTellMeWhenInputs {
  showBaseline: boolean;
  showAtr: boolean;
  showColorBar: boolean;
  atrLength: number;
  atrMult: number;
  /** ATR smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA' */
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
  /** Baseline (trend power) moving average type and length */
  maType: MaType;
  length: number;
  /** Continuation SSL moving average type and length */
  ssl2Type: MaType;
  length2: number;
  /** Exit SSL moving average type and length */
  ssl3Type: MaType;
  length3: number;
  /** Source of the Keltner baseline ("Source of Exit Calculation") */
  src: SourceType;
  jurikPhase: number;
  jurikPower: number;
  /** VAMA volatility lookback */
  volatilityLookback: number;
  useTrueRange: boolean;
  /** Keltner channel multiplier */
  multy: number;
  /** ATR continuation criteria */
  atrCrit: number;
}

export const defaultInputs: Readyfor401ksJustTellMeWhenInputs = {
  showBaseline: true,
  showAtr: false,
  showColorBar: true,
  atrLength: 14,
  atrMult: 1,
  smoothing: 'WMA',
  maType: 'JMA',
  length: 30,
  ssl2Type: 'JMA',
  length2: 5,
  ssl3Type: 'JMA',
  length3: 8,
  src: 'close',
  jurikPhase: 20,
  jurikPower: 2,
  volatilityLookback: 6,
  useTrueRange: true,
  multy: 0.2,
  atrCrit: 0.9,
};

export const inputConfig: InputConfig[] = [
  { id: 'showBaseline', type: 'bool', title: 'Show Trend Power?', defval: true },
  { id: 'showAtr', type: 'bool', title: 'Show ATR?', defval: false },
  { id: 'showColorBar', type: 'bool', title: 'Color Bars based off Trend?', defval: true },
  { id: 'atrLength', type: 'int', title: 'ATR Period:', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multi:', defval: 1, step: 0.1 },
  { id: 'smoothing', type: 'string', title: 'ATR Smoothing:', defval: 'WMA', options: ['RMA', 'SMA', 'EMA', 'WMA'] },
  { id: 'maType', type: 'string', title: 'Trend Power based off of:', defval: 'JMA', options: MA_TYPES },
  { id: 'length', type: 'int', title: 'Trend Power Period:', defval: 30 },
  { id: 'ssl2Type', type: 'string', title: 'Continuation Type:', defval: 'JMA', options: MA_TYPES },
  { id: 'length2', type: 'int', title: 'Continuation Length:', defval: 5 },
  { id: 'ssl3Type', type: 'string', title: 'Calculate Exit of what MA?:', defval: 'JMA', options: MA_TYPES },
  { id: 'length3', type: 'int', title: 'Calculate Exit off what Period?', defval: 8 },
  { id: 'src', type: 'source', title: 'Source of Exit Calculation:', defval: 'close' },
  { id: 'jurikPhase', type: 'int', title: 'JMA Phase *APPLIES TO JMA ONLY', defval: 20 },
  { id: 'jurikPower', type: 'int', title: 'JMA Power *APPLIES TO JMA ONLY', defval: 2 },
  { id: 'volatilityLookback', type: 'int', title: 'Volatility Lookback Period *APPLIES TO VAMA ONLY', defval: 6 },
  { id: 'useTrueRange', type: 'bool', title: 'Use True Range for Channel?', defval: true },
  { id: 'multy', type: 'float', title: 'Base Channel Multiplier', defval: 0.2, step: 0.05 },
  { id: 'atrCrit', type: 'float', title: 'ATR Continuation Criteria', defval: 0.9, step: 0.1 },
];

const AQUA = String(color.new('#00ffbd', 0));
const RED = String(color.new('#ff0000', 0));
const YELLOW = String(color.new('#ffeb3b', 0));
const ATR_COL = String(color.rgb(0, 255, 0, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA Baseline', color: color.gray, lineWidth: 4 },
  { id: 'plot1', title: 'Upper Channel Edge', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Channel Edge', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Trend Continuation', color: color.white, lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'ATR High Color', color: ATR_COL, lineWidth: 1 },
  { id: 'plot5', title: 'ATR Low Color', color: ATR_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'ReadyFor401ks Just Tell Me When!',
  shortTitle: 'ReadyFor401k JTMW!',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[]; barColors: BarColorData[] }
  & { alerts: AlertConditionState[] };

/** One moving average call stepped bar by bar */
type Ma = { step(v: number): number };

/** The Jurik moving average of the original, one bar at a time (its e0 / e1 / e2 / jma of the bar before) */
class JmaStep implements Committable {
  private e0 = NaN;
  private e1 = NaN;
  private e2 = NaN;
  private jma = NaN;
  private next: [number, number, number, number] | null = null;

  constructor(private readonly alpha: number, private readonly beta: number, private readonly phaseRatio: number) {}

  step(s: number): number {
    const { alpha, beta, phaseRatio } = this;
    const nz = (v: number) => (isNaN(v) ? 0 : v);
    const e0 = (1 - alpha) * s + alpha * nz(this.e0);
    const e1 = (s - e0) * (1 - beta) + beta * nz(this.e1);
    const e2 = (e0 + phaseRatio * e1 - nz(this.jma)) * Math.pow(1 - alpha, 2) + Math.pow(alpha, 2) * nz(this.e2);
    const jma = e2 + nz(this.jma);
    this.next = [e0, e1, e2, jma];
    return jma;
  }

  commit(): void {
    if (this.next) [this.e0, this.e1, this.e2, this.jma] = this.next;
    this.next = null;
  }
}

interface JtmwVars {
  /** var int Hlv of the continuation and exit SSL */
  hlv2: number;
  hlvExit: number;
  /** ta.crossover(close, sslExit): close and sslExit of the last bar where both were not na */
  prevC: number;
  prevX: number;
}

interface JtmwRun extends BarRunState<JtmwVars> {
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  arrows: ArrowData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<Readyfor401ksJustTellMeWhenInputs>): BarStudy<JtmwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcValue = barSource(cfg.src);
  const num = (v: number) => (Number.isFinite(v) ? v : NaN);

  // ma(type, src, length): one call site per use (each keeps its own history); the branch is constant
  const maStep = (type: MaType, length: number, steps: Committable[]): Ma => {
    const add = <T extends Committable>(m: T): T => { steps.push(m); return m; };
    switch (type) {
      case 'SMA': {
        const m = add(taStep.sma());
        return { step: (v) => m.step(v, length) };
      }
      case 'EMA': {
        const m = add(taStep.ema(length));
        return { step: (v) => m.step(v) };
      }
      case 'DEMA': {
        const e = add(taStep.ema(length));
        const ee = add(taStep.ema(length));
        return { step: (v) => { const x = e.step(v); return 2 * x - ee.step(x); } };
      }
      case 'TEMA': {
        // 3 * (e - ta.ema(e, length)) + ta.ema(ta.ema(e, length), length)
        const e = add(taStep.ema(length));
        const e2 = add(taStep.ema(length));
        const e2b = add(taStep.ema(length));
        const e3 = add(taStep.ema(length));
        return { step: (v) => { const x = e.step(v); const y = e2.step(x); return 3 * (x - y) + e3.step(e2b.step(x)); } };
      }
      case 'WMA': {
        const m = add(taStep.wma());
        return { step: (v) => m.step(v, length) };
      }
      case 'VAMA': {
        const mid = add(taStep.ema(length));
        const up = add(taStep.highest());
        const down = add(taStep.lowest());
        return {
          step: (v) => {
            const m = mid.step(v);
            const dev = v - m;
            return m + (up.step(dev, cfg.volatilityLookback) + down.step(dev, cfg.volatilityLookback)) / 2;
          },
        };
      }
      case 'HMA': {
        // ta.wma(2 * ta.wma(src, length / 2) - ta.wma(src, length), math.round(math.sqrt(length)))
        // length / 2 is fractional for an odd length; the wma length argument keeps its integer part
        const half = add(taStep.wma());
        const full = add(taStep.wma());
        const out = add(taStep.wma());
        return {
          step: (v) => out.step(2 * half.step(v, Math.trunc(length / 2)) - full.step(v, length), Math.round(Math.sqrt(length))),
        };
      }
      case 'JMA':
      default: {
        const jp = cfg.jurikPhase;
        const phaseRatio = jp < -100 ? 0.5 : jp > 100 ? 2.5 : jp / 100 + 1.5;
        const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2);
        const alpha = Math.pow(beta, cfg.jurikPower);
        const m = add(new JmaStep(alpha, beta, phaseRatio));
        return { step: (v) => m.step(v) };
      }
    }
  };

  let atrMa: Ma;
  let trTrue: ReturnType<typeof taStep.tr>;
  let trFalse: ReturnType<typeof taStep.tr>;
  let rangema: ReturnType<typeof taStep.ema>;
  let bbmcMa: Ma;
  let keltMa: Ma;
  let maHighMa: Ma;
  let maLowMa: Ma;
  let exitHighMa: Ma;
  let exitLowMa: Ma;

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const steps: Committable[] = [];
      // atr_slen = ma_function(ta.tr(true), atrlen)
      trTrue = taStep.tr(true);
      steps.push(trTrue);
      if (cfg.smoothing === 'RMA') { const m = taStep.rma(cfg.atrLength); steps.push(m); atrMa = { step: (v) => m.step(v) }; }
      else if (cfg.smoothing === 'SMA') { const m = taStep.sma(); steps.push(m); atrMa = { step: (v) => m.step(v, cfg.atrLength) }; }
      else if (cfg.smoothing === 'EMA') { const m = taStep.ema(cfg.atrLength); steps.push(m); atrMa = { step: (v) => m.step(v) }; }
      else { const m = taStep.wma(); steps.push(m); atrMa = { step: (v) => m.step(v, cfg.atrLength) }; }
      bbmcMa = maStep(cfg.maType, cfg.length, steps);
      keltMa = maStep(cfg.maType, cfg.length, steps);
      trFalse = taStep.tr(false);
      rangema = taStep.ema(cfg.length);
      steps.push(trFalse, rangema);
      maHighMa = maStep(cfg.ssl2Type, cfg.length2, steps);
      maLowMa = maStep(cfg.ssl2Type, cfg.length2, steps);
      exitHighMa = maStep(cfg.ssl3Type, cfg.length3, steps);
      exitLowMa = maStep(cfg.ssl3Type, cfg.length3, steps);
      const s: JtmwRun = {
        plots: Array.from({ length: 6 }, () => []), fillColors: [], markers: [], arrows: [], barColors: [],
        flags: [[], []], times: [[], []],
        steps, vars: { hlv2: NaN, hlvExit: NaN, prevC: NaN, prevX: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.arrows, s.barColors, ...s.times];
      s.series = [...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const c = b.close;
      const v = s.vars;
      const atrSlen = atrMa.step(trTrue.step(b.high, b.low, b.close));

      // ATR bands
      const upperBand = c + atrSlen * cfg.atrMult;
      const lowerBand = c - atrSlen * cfg.atrMult;

      // Keltner baseline channel
      const BBMC = bbmcMa.step(c);
      const keltma = keltMa.step(srcValue(b));
      const rangeVal = cfg.useTrueRange ? trFalse.step(b.high, b.low, b.close) : b.high - b.low;
      const rm = rangema.step(rangeVal);
      const upperk = keltma + rm * cfg.multy;
      const lowerk = keltma - rm * cfg.multy;

      // SSL channels
      const maHigh = maHighMa.step(b.high);
      const maLow = maLowMa.step(b.low);
      const exitHigh = exitHighMa.step(b.high);
      const exitLow = exitLowMa.step(b.low);
      // var int Hlv = na; Hlv := close > hi ? 1 : close < lo ? -1 : nz(Hlv[1]); Hlv < 0 ? hi : lo
      // sslDown (SSL1) is computed in the Pine source but not drawn (color_ssl1 is unused)
      v.hlv2 = gt(c, maHigh) ? 1 : lt(c, maLow) ? -1 : isNaN(v.hlv2) ? 0 : v.hlv2;
      const s2 = v.hlv2 < 0 ? maHigh : maLow;
      v.hlvExit = gt(c, exitHigh) ? 1 : lt(c, exitLow) ? -1 : isNaN(v.hlvExit) ? 0 : v.hlvExit;
      const x = v.hlvExit < 0 ? exitHigh : exitLow;

      // plotshape(candlesize_violation, style = shape.cross, location = location.top, white, size.small)
      const atrViolation = gt(Math.abs(c - b.open), atrSlen);
      const inRange = gt(upperBand, BBMC) && lt(lowerBand, BBMC);
      if (atrViolation && inRange) {
        s.markers.push({ time: t, position: 'top', shape: 'cross', color: String(color.new(color.white, 0)), size: 'small', id: 'shape0' });
      }

      // plotarrow(codiff, "Exit Arrows"): up arrow for 1, down arrow for -1 (both yellow)
      // ta.crossover / ta.crossover(sslExit, close): exact comparisons with the last bar where both values were not na
      let crossLong = false;
      let crossShort = false;
      if (!isNaN(c) && !isNaN(x)) {
        if (!isNaN(v.prevC) && !isNaN(v.prevX)) {
          crossLong = c > x && v.prevC <= v.prevX;
          crossShort = x > c && v.prevX <= v.prevC;
        }
        v.prevC = c;
        v.prevX = x;
      }
      if (crossLong) s.arrows.push({ time: t, id: 'arrow0', value: 1, color: YELLOW });
      else if (crossShort) s.arrows.push({ time: t, id: 'arrow0', value: -1, color: YELLOW });
      s.flags[0][i] = crossLong;
      s.flags[1][i] = crossShort;
      if (crossLong) s.times[0].push(t as number);
      if (crossShort) s.times[1].push(t as number);

      const colorBar = gt(c, upperk) ? AQUA : lt(c, lowerk) ? RED : color.gray;
      const p = s.plots;
      p[0][i] = { time: t, value: cfg.showBaseline ? num(BBMC) : NaN, color: colorBar };
      if (cfg.showColorBar) s.barColors.push({ time: t, color: colorBar });
      p[1][i] = { time: t, value: cfg.showBaseline ? num(upperk) : NaN, color: colorBar };
      p[2][i] = { time: t, value: cfg.showBaseline ? num(lowerk) : NaN, color: colorBar };
      s.fillColors[i] = colorBar;

      // ATR continuation
      const buyInatr = lt(c - atrSlen * cfg.atrCrit, s2);
      const sellInatr = gt(c + atrSlen * cfg.atrCrit, s2);
      const sellCont = lt(c, BBMC) && lt(c, s2);
      const buyCont = gt(c, BBMC) && gt(c, s2);
      const atrFill = buyInatr && buyCont ? String(color.rgb(0, 255, 0))
        : sellInatr && sellCont ? String(color.rgb(144, 0, 255)) : color.white;
      p[3][i] = { time: t, value: num(s2), color: atrFill };
      p[4][i] = { time: t, value: cfg.showAtr ? num(upperBand) : NaN, color: ATR_COL };
      p[5][i] = { time: t, value: cfg.showAtr ? num(lowerBand) : NaN, color: ATR_COL };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // fill(up_channel, low_channel, color = color_bar)
        fills: [{ plot1: 'plot1', plot2: 'plot2', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(ta.crossover(close, sslExit), ...) / alertcondition(ta.crossover(sslExit, close), ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Readyfor401ksJustTellMeWhenInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<Readyfor401ksJustTellMeWhenInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[]; barColors: BarColorData[] }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Long or Sell Short', message: 'In Long or Out Short.' },
  { id: 'alert1', title: 'Sell Long or Buy Short', message: 'Out Long or In Short.' },
];

export const Readyfor401ksJustTellMeWhen = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
