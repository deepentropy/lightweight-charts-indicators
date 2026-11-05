/**
 * SSL Hybrid
 *
 * A baseline moving average with a channel of its smoothed range, coloured by the close position (above the
 * channel, below it, or inside); an SSL line made of the baseline averages of the high and the low (the side
 * switches when the close gets beyond them); a second, faster SSL line (circles) coloured when the close continues
 * beyond the baseline within an ATR distance; exit arrows when the close crosses a third SSL line; white diamonds on
 * candles larger than one ATR near the baseline; optional ATR bands. The transparency of the colours grows with the
 * percentile rank of the ATR (risk gradient). A table on the last bar gives the risk level, the distance of the
 * close from the baseline in ATR, the volatility percentile and the ATR.
 * The exit arrows are the original's plotarrow (`arrows` of the result, id arrow0); the diamonds have the id shape0.
 * Alerts (alertcondition, `alerts` of the result): exits (close crossing the exit line), SSL2 continuations, close
 * crossing the channel bands and the baseline, high risk entry (ATR percentile above 75 and the close 2 ATR or more
 * from the baseline), false breakout warning (the diamond condition) and extreme volatility (percentile above 90).
 *
 * Reference: "SSL Hybrid" by Mihkel00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, str, math,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ArrowData } from 'oakscriptjs';
import type { MarkerData, BarColorData, TableData, TableCellData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

type DisplayMode = 'Baseline Only' | 'Baseline + SSL' | 'SSL Only' | 'Entry/Exit Only' | 'Full Display';
type MaType =
  | 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'LSMA' | 'WMA' | 'MF' | 'VAMA' | 'TMA' | 'HMA' | 'JMA' | 'Kijun v2' | 'EDSMA' | 'McGinley';

export interface SslHybridInputs {
  displayMode: DisplayMode;
  colorBars: boolean;
  /** Show Signal Diamonds: candle larger than 1 ATR within the baseline range */
  showSignals: boolean;
  showRiskTable: boolean;
  bullishColor: string;
  bearishColor: string;
  maType: MaType;
  len: number;
  src: SourceType;
  showBaselineChannel: boolean;
  multy: number;
  useTrueRange: boolean;
  ssl2Type: MaType;
  len2: number;
  atrCrit: number;
  ssl3Type: MaType;
  len3: number;
  atrLen: number;
  mult: number;
  smoothing: 'RMA' | 'SMA' | 'EMA' | 'WMA';
  showAtrBands: boolean;
  riskLookback: number;
  riskSensitivity: number;
  enableRiskGradient: boolean;
  jurikPhase: number;
  jurikPower: number;
  kidiv: number;
  volatilityLookback: number;
  beta: number;
  feedback: boolean;
  z: number;
  ssfLength: number;
  ssfPoles: number;
}

export const defaultInputs: SslHybridInputs = {
  displayMode: 'Full Display',
  colorBars: true,
  showSignals: true,
  showRiskTable: true,
  bullishColor: '#00c3ff',
  bearishColor: '#ff0062',
  maType: 'HMA',
  len: 60,
  src: 'close',
  showBaselineChannel: true,
  multy: 0.2,
  useTrueRange: true,
  ssl2Type: 'JMA',
  len2: 5,
  atrCrit: 0.9,
  ssl3Type: 'HMA',
  len3: 15,
  atrLen: 14,
  mult: 1.0,
  smoothing: 'WMA',
  showAtrBands: false,
  riskLookback: 100,
  riskSensitivity: 2,
  enableRiskGradient: true,
  jurikPhase: 3,
  jurikPower: 1,
  kidiv: 1,
  volatilityLookback: 10,
  beta: 0.8,
  feedback: false,
  z: 0.5,
  ssfLength: 20,
  ssfPoles: 2,
};

const G_DISPLAY = 'Display Controls';
const G_COLORS = 'Colors';
const G_BASE = 'Baseline Settings';
const G_SSL = 'SSL Settings';
const G_EXIT = 'Exit Settings';
const G_ATR = 'ATR Settings';
const G_RISK = 'Risk Assessment';
const G_JMA = 'Jurik (JMA) Settings';
const G_MF = 'Modular Filter Settings';
const G_EDSMA = 'EDSMA Settings';

export const inputConfig: InputConfig[] = [
  {
    id: 'displayMode', type: 'string', title: 'Display Mode', defval: 'Full Display',
    options: ['Baseline Only', 'Baseline + SSL', 'SSL Only', 'Entry/Exit Only', 'Full Display'], group: G_DISPLAY,
  },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true, group: G_DISPLAY },
  {
    id: 'showSignals', type: 'bool', title: 'Show Signal Diamonds', defval: true, group: G_DISPLAY,
    tooltip: 'Candle > 1 ATR within baseline range - Potential false breakout warning',
  },
  { id: 'showRiskTable', type: 'bool', title: 'Show Risk Table', defval: true, group: G_DISPLAY },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00c3ff', group: G_COLORS },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0062', group: G_COLORS },
  {
    id: 'maType', type: 'string', title: 'Baseline Type', defval: 'HMA',
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'LSMA', 'WMA', 'MF', 'VAMA', 'TMA', 'HMA', 'JMA', 'Kijun v2', 'EDSMA', 'McGinley'], group: G_BASE,
  },
  { id: 'len', type: 'int', title: 'Baseline Length', defval: 60, group: G_BASE },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G_BASE },
  { id: 'showBaselineChannel', type: 'bool', title: 'Show Baseline Channel', defval: true, group: G_BASE },
  { id: 'multy', type: 'float', title: 'Channel Multiplier', defval: 0.2, step: 0.05, group: G_BASE },
  { id: 'useTrueRange', type: 'bool', title: 'Use True Range for Channel', defval: true, group: G_BASE },
  {
    id: 'ssl2Type', type: 'string', title: 'SSL2 Type', defval: 'JMA',
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'WMA', 'MF', 'VAMA', 'TMA', 'HMA', 'JMA', 'McGinley'], group: G_SSL,
  },
  { id: 'len2', type: 'int', title: 'SSL2 Length', defval: 5, group: G_SSL },
  { id: 'atrCrit', type: 'float', title: 'Continuation ATR Criteria', defval: 0.9, step: 0.1, group: G_SSL },
  {
    id: 'ssl3Type', type: 'string', title: 'Exit Type', defval: 'HMA',
    options: ['DEMA', 'TEMA', 'LSMA', 'VAMA', 'TMA', 'HMA', 'JMA', 'Kijun v2', 'McGinley', 'MF'], group: G_EXIT,
  },
  { id: 'len3', type: 'int', title: 'Exit Length', defval: 15, group: G_EXIT },
  { id: 'atrLen', type: 'int', title: 'ATR Period', defval: 14, group: G_ATR },
  { id: 'mult', type: 'float', title: 'ATR Multiplier', defval: 1.0, step: 0.1, group: G_ATR },
  { id: 'smoothing', type: 'string', title: 'ATR Smoothing', defval: 'WMA', options: ['RMA', 'SMA', 'EMA', 'WMA'], group: G_ATR },
  { id: 'showAtrBands', type: 'bool', title: 'Show ATR Bands', defval: false, group: G_ATR },
  { id: 'riskLookback', type: 'int', title: 'Risk Lookback Period', defval: 100, min: 50, max: 500, group: G_RISK },
  { id: 'riskSensitivity', type: 'float', title: 'Risk Sensitivity', defval: 2, min: 0.2, max: 3.0, step: 0.1, group: G_RISK },
  { id: 'enableRiskGradient', type: 'bool', title: 'Enable Risk Gradient', defval: true, group: G_RISK },
  { id: 'jurikPhase', type: 'int', title: 'Phase', defval: 3, group: G_JMA },
  { id: 'jurikPower', type: 'int', title: 'Power', defval: 1, group: G_JMA },
  { id: 'kidiv', type: 'int', title: 'Kijun MOD Divider', defval: 1, max: 4, group: 'Kijun Settings' },
  { id: 'volatilityLookback', type: 'int', title: 'Volatility Lookback Length', defval: 10, group: 'VAMA Settings' },
  { id: 'beta', type: 'float', title: 'Beta', defval: 0.8, min: 0, max: 1, step: 0.1, group: G_MF },
  { id: 'feedback', type: 'bool', title: 'Feedback', defval: false, group: G_MF },
  { id: 'z', type: 'float', title: 'Feedback Weighting', defval: 0.5, step: 0.1, min: 0, max: 1, group: G_MF },
  { id: 'ssfLength', type: 'int', title: 'Super Smoother Filter Length', defval: 20, min: 1, group: G_EDSMA },
  // input.int(2, options = [2, 3])
  { id: 'ssfPoles', type: 'int', title: 'Super Smoother Filter Poles', defval: 2, min: 2, max: 3, group: G_EDSMA },
];

const NEUTRAL = String(color.new('#666666', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Baseline', color: '#00c3ff', lineWidth: 3 },
  { id: 'plot1', title: 'Upper Channel', color: '#00c3ff', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Channel', color: '#00c3ff', lineWidth: 1 },
  { id: 'plot3', title: 'SSL1', color: '#00c3ff', lineWidth: 2 },
  { id: 'plot4', title: 'SSL2', color: '#00c3ff', lineWidth: 2, style: 'circles' },
  { id: 'plot5', title: '+ATR', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot6', title: '-ATR', color: NEUTRAL, lineWidth: 1 },
];

export const metadata = {
  title: 'SSL Hybrid',
  shortTitle: 'SSL Hybrid',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz(x, y): na and the infinities are replaced */
const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers' | 'barColors' | 'tables'> & {
  markers: MarkerData[]; arrows: ArrowData[]; barColors: BarColorData[]; tables: TableData[]; alerts: AlertConditionState[];
};

/**
 * One moving average call, one bar at a time: `step(i, value, bar)` on bar i (again on the same bar for a live update).
 * Its recursive values are kept by bar (written again on the forming bar), its ta.* machines are in the run's steps.
 */
interface MaCall {
  step(i: number, value: number, bar: Bar): number;
}

const prevOf = (a: number[], i: number, k = 1) => (i >= k ? a[i - k] : NaN);

interface SslVars {
  /** Hlv of the three SSL lines */
  hlv1: number;
  hlv2: number;
  hlv3: number;
}

interface SslRun extends BarRunState<SslVars> {
  bbmc: MaCall;
  keltMa: MaCall;
  emaHigh: MaCall;
  emaLow: MaCall;
  maHigh: MaCall;
  maLow: MaCall;
  exitHigh: MaCall;
  exitLow: MaCall;
  trueRange: ReturnType<typeof taStep.tr>;
  atrMa: { step(v: number): number };
  atrPercentile: ReturnType<typeof taStep.percentrank>;
  rangeTr: ReturnType<typeof taStep.tr>;
  rangeMa: ReturnType<typeof taStep.ema>;
  crossLong: ReturnType<typeof taStep.crossover>;
  crossShort: ReturnType<typeof taStep.crossover>;
  close: number[];
  bbmcArr: number[];
  atrArr: number[];
  pctArr: number[];
  sslExit: number[];
  upperKs: number[];
  lowerKs: number[];
  buyAtrs: boolean[];
  sellAtrs: boolean[];
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  arrows: ArrowData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SslHybridInputs>): BarStudy<SslRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const srcOf = barSource(cfg.src);

  // ---- Moving averages (each call has its own state)
  const ma = (type: MaType, len: number, steps: Committable[]): MaCall => {
    const add = <T extends Committable>(m: T): T => { steps.push(m); return m; };
    switch (type) {
      case 'TMA': {
        const s1 = add(taStep.sma());
        const s2 = add(taStep.sma());
        return { step: (_i, v) => s2.step(s1.step(v, Math.ceil(len / 2)), Math.floor(len / 2) + 1) };
      }
      case 'MF': {
        // Modular filter
        const alpha = 2 / (len + 1);
        const bA: number[] = [];
        const cA: number[] = [];
        const osA: number[] = [];
        const tsA: number[] = [];
        return {
          step: (i, v) => {
            const ts1 = prevOf(tsA, i);
            const a = cfg.feedback ? cfg.z * v + (1 - cfg.z) * nz(ts1, v) : v;
            const up = alpha * a + (1 - alpha) * nz(prevOf(bA, i), a);
            const b = gt(a, up) ? a : up;
            const dn = alpha * a + (1 - alpha) * nz(prevOf(cA, i), a);
            const c = lt(a, dn) ? a : dn;
            const os = eq(a, b) ? 1 : eq(a, c) ? 0 : prevOf(osA, i);
            const upper = cfg.beta * b + (1 - cfg.beta) * c;
            const lower = cfg.beta * c + (1 - cfg.beta) * b;
            const ts = os * upper + (1 - os) * lower;
            bA[i] = b;
            cA[i] = c;
            osA[i] = os;
            tsA[i] = ts;
            return ts;
          },
        };
      }
      case 'LSMA': {
        const m = add(taStep.linreg(len, 0));
        return { step: (_i, v) => m.step(v) };
      }
      case 'SMA': {
        const m = add(taStep.sma());
        return { step: (_i, v) => m.step(v, len) };
      }
      case 'EMA': {
        const m = add(taStep.ema(len));
        return { step: (_i, v) => m.step(v) };
      }
      case 'DEMA': {
        const m1 = add(taStep.ema(len));
        const m2 = add(taStep.ema(len));
        return { step: (_i, v) => { const e = m1.step(v); return 2 * e - m2.step(e); } };
      }
      case 'TEMA': {
        const m1 = add(taStep.ema(len));
        const m2 = add(taStep.ema(len));
        const m3 = add(taStep.ema(len));
        return { step: (_i, v) => { const e = m1.step(v); const e2 = m2.step(e); return 3 * (e - e2) + m3.step(e2); } };
      }
      case 'WMA': {
        const m = add(taStep.wma());
        return { step: (_i, v) => m.step(v, len) };
      }
      case 'VAMA': {
        // Volatility adjusted moving average
        const mid = add(taStep.ema(len));
        const hi = add(taStep.highest());
        const lo = add(taStep.lowest());
        return {
          step: (_i, v) => {
            const m = mid.step(v);
            const dev = v - m;
            return m + (hi.step(dev, cfg.volatilityLookback) + lo.step(dev, cfg.volatilityLookback)) / 2;
          },
        };
      }
      case 'HMA': {
        // len / 2 is a float in Pine v6: the length argument takes its integer part
        const half = add(taStep.wma());
        const full = add(taStep.wma());
        const outer = add(taStep.wma());
        const sqrtLen = math.round(Math.sqrt(len)) as number;
        return { step: (_i, v) => outer.step(2 * half.step(v, Math.trunc(len / 2)) - full.step(v, len), sqrtLen) };
      }
      case 'JMA': {
        const phase = cfg.jurikPhase;
        const phaseRatio = phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
        const beta = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2);
        const alpha = Math.pow(beta, cfg.jurikPower);
        const e0A: number[] = [];
        const e1A: number[] = [];
        const e2A: number[] = [];
        const jA: number[] = [];
        return {
          step: (i, v) => {
            const jma1 = prevOf(jA, i);
            const e0 = (1 - alpha) * v + alpha * nz(prevOf(e0A, i));
            const e1 = (v - e0) * (1 - beta) + beta * nz(prevOf(e1A, i));
            const e2 = (e0 + phaseRatio * e1 - nz(jma1)) * Math.pow(1 - alpha, 2) + Math.pow(alpha, 2) * nz(prevOf(e2A, i));
            const jma = e2 + nz(jma1);
            e0A[i] = e0;
            e1A[i] = e1;
            e2A[i] = e2;
            jA[i] = jma;
            return jma;
          },
        };
      }
      case 'Kijun v2': {
        // Uses the low and the high of the bars, whatever the source
        const kLow = add(taStep.lowest());
        const kHigh = add(taStep.highest());
        // len / kidiv is a float in Pine v6: ta.lowest / ta.highest take its integer part
        const convLen = len / cfg.kidiv;
        const cLow = add(taStep.lowest());
        const cHigh = add(taStep.highest());
        return {
          step: (_i, _v, b) => ((kLow.step(b.low, len) + kHigh.step(b.high, len)) / 2
            + (cLow.step(b.low, convLen) + cHigh.step(b.high, convLen)) / 2) / 2,
        };
      }
      case 'McGinley': {
        // mg := na(mg[1]) ? ta.ema(src, len) : mg[1] + (src - mg[1]) / (len * math.pow(src / mg[1], 4))
        // The EMA only runs on the bars where the previous value is na: its history is those bars
        const m = add(taStep.ema(len));
        const mgA: number[] = [];
        return {
          step: (i, v) => {
            const mg1 = prevOf(mgA, i);
            const mg = Number.isNaN(mg1) ? m.step(v) : mg1 + (v - mg1) / (len * Math.pow(v / mg1, 4));
            mgA[i] = mg;
            return mg;
          },
        };
      }
      case 'EDSMA': {
        // Ehlers deviation scaled moving average
        const srcA: number[] = [];
        const zeros: number[] = [];
        const ssfA: number[] = [];
        const edA: number[] = [];
        const dev = add(taStep.stdev());
        const PI = 2 * Math.asin(1);
        // superSmoother(avgZeros)
        let ssfStep: (i: number, x: number) => number;
        if (cfg.ssfPoles === 2) {
          const arg = (Math.sqrt(2) * PI) / cfg.ssfLength;
          const a1 = Math.exp(-arg);
          const b1 = 2 * a1 * Math.cos(arg);
          const c2 = b1;
          const c3 = -Math.pow(a1, 2);
          const c1 = 1 - c2 - c3;
          ssfStep = (i, x) => c1 * x + c2 * nz(prevOf(ssfA, i)) + c3 * nz(prevOf(ssfA, i, 2));
        } else {
          const arg = PI / cfg.ssfLength;
          const a1 = Math.exp(-arg);
          const b1 = 2 * a1 * Math.cos(1.738 * arg);
          const c1 = Math.pow(a1, 2);
          const coef2 = b1 + c1;
          const coef3 = -(c1 + b1 * c1);
          const coef4 = Math.pow(c1, 2);
          const coef1 = 1 - coef2 - coef3 - coef4;
          ssfStep = (i, x) => coef1 * x + coef2 * nz(prevOf(ssfA, i)) + coef3 * nz(prevOf(ssfA, i, 2))
            + coef4 * nz(prevOf(ssfA, i, 3));
        }
        return {
          step: (i, v) => {
            srcA[i] = v;
            const zero = v - nz(prevOf(srcA, i, 2));
            zeros[i] = zero;
            const avgZeros = (zero + prevOf(zeros, i)) / 2;
            const ssf = ssfStep(i, avgZeros);
            ssfA[i] = ssf;
            const stdev = dev.step(ssf, len);
            // stdev != 0 (false for na)
            const scaledFilter = Math.abs(stdev) > EPS ? ssf / stdev : 0;
            const alpha = (5 * Math.abs(scaledFilter)) / len;
            const edsma = alpha * v + (1 - alpha) * nz(prevOf(edA, i));
            edA[i] = edsma;
            return edsma;
          },
        };
      }
      default:
        return { step: () => NaN };
    }
  };

  /** Transparency of the bullish / bearish colours: grows with the ATR percentile */
  const riskSaturation = (pct: number): number => {
    if (!cfg.enableRiskGradient) return 0;
    const adjusted = Math.pow(pct / 100, cfg.riskSensitivity) * 100;
    if (le(adjusted, 25)) return 0;
    if (le(adjusted, 50)) return 10;
    return math.round(25 + ((adjusted - 50) / 50) * 25) as number;
  };

  const mode = cfg.displayMode;
  const showBaseline = mode === 'Baseline Only' || mode === 'Baseline + SSL' || mode === 'Full Display';
  const showSsl1 = mode === 'SSL Only' || mode === 'Baseline + SSL' || mode === 'Full Display';
  const showSsl2 = mode === 'SSL Only' || mode === 'Full Display';
  const showExit = mode === 'Entry/Exit Only' || mode === 'Full Display';
  const showChannel = showBaseline && cfg.showBaselineChannel;
  const white = String(color.white);
  const transparentNeutral = String(color.new('#666666', 80));
  const flagsNow = new Array<boolean>(11);

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const steps: Committable[] = [];
      // ---- ATR and risk
      const trueRange = taStep.tr(true);
      steps.push(trueRange);
      const atrMa = ((): SslRun['atrMa'] => {
        switch (cfg.smoothing) {
          case 'RMA': { const m = taStep.rma(cfg.atrLen); steps.push(m); return { step: (v) => m.step(v) }; }
          case 'SMA': { const m = taStep.sma(); steps.push(m); return { step: (v) => m.step(v, cfg.atrLen) }; }
          case 'EMA': { const m = taStep.ema(cfg.atrLen); steps.push(m); return { step: (v) => m.step(v) }; }
          default: { const m = taStep.wma(); steps.push(m); return { step: (v) => m.step(v, cfg.atrLen) }; }
        }
      })();
      const atrPercentile = taStep.percentrank(cfg.riskLookback);
      const rangeTr = taStep.tr(false);
      const rangeMa = taStep.ema(cfg.len);
      const crossLong = taStep.crossover();
      const crossShort = taStep.crossover();
      steps.push(atrPercentile, rangeTr, rangeMa, crossLong, crossShort);
      const s: SslRun = {
        // ---- Baseline, SSL lines
        bbmc: ma(cfg.maType, cfg.len, steps),
        keltMa: ma(cfg.maType, cfg.len, steps),
        emaHigh: ma(cfg.maType, cfg.len, steps),
        emaLow: ma(cfg.maType, cfg.len, steps),
        maHigh: ma(cfg.ssl2Type, cfg.len2, steps),
        maLow: ma(cfg.ssl2Type, cfg.len2, steps),
        exitHigh: ma(cfg.ssl3Type, cfg.len3, steps),
        exitLow: ma(cfg.ssl3Type, cfg.len3, steps),
        trueRange, atrMa, atrPercentile, rangeTr, rangeMa, crossLong, crossShort,
        close: [], bbmcArr: [], atrArr: [], pctArr: [], sslExit: [], upperKs: [], lowerKs: [], buyAtrs: [], sellAtrs: [],
        plots: Array.from({ length: 7 }, () => []), fillColors: [], markers: [], arrows: [], barColors: [],
        flags: Array.from({ length: 11 }, () => []), times: Array.from({ length: 11 }, () => []),
        steps, vars: { hlv1: NaN, hlv2: NaN, hlv3: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.arrows, s.barColors, ...s.times];
      s.series = [
        s.close, s.bbmcArr, s.atrArr, s.pctArr, s.sslExit, s.upperKs, s.lowerKs, s.buyAtrs, s.sellAtrs, ...s.plots,
        s.fillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const { time, open } = bar;
      const v = s.vars;
      const c = bar.close;
      s.close[i] = c;

      const atr = s.atrMa.step(s.trueRange.step(bar.high, bar.low, c));
      s.atrArr[i] = atr;
      const pct = s.atrPercentile.step(atr);
      s.pctArr[i] = pct;

      const bbmc = s.bbmc.step(i, c, bar);
      s.bbmcArr[i] = bbmc;
      const keltMa = s.keltMa.step(i, srcOf(bar), bar);
      const rangeValue = cfg.useTrueRange ? s.rangeTr.step(bar.high, bar.low, c) : bar.high - bar.low;
      const rangeMa = s.rangeMa.step(rangeValue);
      const emaHigh = s.emaHigh.step(i, bar.high, bar);
      const emaLow = s.emaLow.step(i, bar.low, bar);
      const maHigh = s.maHigh.step(i, bar.high, bar);
      const maLow = s.maLow.step(i, bar.low, bar);
      const exitHigh = s.exitHigh.step(i, bar.high, bar);
      const exitLow = s.exitLow.step(i, bar.low, bar);
      /** Hlv := close > hi ? 1 : close < lo ? -1 : Hlv[1]; the line is the high average while Hlv < 0, else the low one */
      v.hlv1 = gt(c, emaHigh) ? 1 : lt(c, emaLow) ? -1 : v.hlv1;
      const sslDown = v.hlv1 < 0 ? emaHigh : emaLow;
      v.hlv2 = gt(c, maHigh) ? 1 : lt(c, maLow) ? -1 : v.hlv2;
      const sslDown2 = v.hlv2 < 0 ? maHigh : maLow;
      v.hlv3 = gt(c, exitHigh) ? 1 : lt(c, exitLow) ? -1 : v.hlv3;
      const sslExit = v.hlv3 < 0 ? exitHigh : exitLow;
      s.sslExit[i] = sslExit;

      // ---- Signals
      const crossLong = s.crossLong.step(c, sslExit);
      const crossShort = s.crossShort.step(sslExit, c);

      const saturation = riskSaturation(pct);
      const bullishColor = String(color.new(cfg.bullishColor, saturation));
      const bearishColor = String(color.new(cfg.bearishColor, saturation));
      const transparentBull = String(color.new(cfg.bullishColor, Math.max(80, saturation + 20)));
      const transparentBear = String(color.new(cfg.bearishColor, Math.max(80, saturation + 20)));

      const upperBand = atr * cfg.mult + c;
      const lowerBand = c - atr * cfg.mult;
      const upperK = keltMa + rangeMa * cfg.multy;
      const lowerK = keltMa - rangeMa * cfg.multy;

      // Baseline violation candle: larger than the ATR, with the baseline inside the ATR bands
      const atrViolation = gt(Math.abs(c - open), atr);
      const inRange = gt(upperBand, bbmc) && lt(lowerBand, bbmc);
      const candleSizeViolation = atrViolation && inRange;

      // SSL2 continuation
      const upperHalf = atr * cfg.atrCrit + c;
      const lowerHalf = c - atr * cfg.atrCrit;
      const sellAtr = gt(upperHalf, sslDown2) && lt(c, bbmc) && lt(c, sslDown2);
      const buyAtr = lt(lowerHalf, sslDown2) && gt(c, bbmc) && gt(c, sslDown2);

      const baselineColor = gt(c, upperK) ? bullishColor : lt(c, lowerK) ? bearishColor : NEUTRAL;
      const sslColor = gt(c, sslDown) ? bullishColor : lt(c, sslDown) ? bearishColor : NEUTRAL;
      const ssl2Color = buyAtr ? bullishColor : sellAtr ? bearishColor : NEUTRAL;
      const channelFillColor = gt(c, upperK) ? transparentBull : lt(c, lowerK) ? transparentBear : transparentNeutral;

      const P = s.plots;
      P[0][i] = { time, value: showBaseline ? bbmc : NaN, color: baselineColor };
      P[1][i] = { time, value: showChannel ? upperK : NaN, color: baselineColor };
      P[2][i] = { time, value: showChannel ? lowerK : NaN, color: baselineColor };
      s.fillColors[i] = showChannel ? channelFillColor : 'transparent';
      P[3][i] = { time, value: showSsl1 ? sslDown : NaN, color: sslColor };
      P[4][i] = { time, value: showSsl2 ? sslDown2 : NaN, color: ssl2Color };
      P[5][i] = { time, value: cfg.showAtrBands ? upperBand : NaN };
      P[6][i] = { time, value: cfg.showAtrBands ? lowerBand : NaN };

      // plotarrow(show_exit ? codiff : na, colorup = bullish_color, colordown = bearish_color, maxheight = 20)
      if (showExit) {
        if (crossLong) s.arrows.push({ time, id: 'arrow0', value: 1, color: bullishColor });
        else if (crossShort) s.arrows.push({ time, id: 'arrow0', value: -1, color: bearishColor });
      }
      // plotshape(show_signals and candlesize_violation, ..., title = "Signal Diamonds")
      if (cfg.showSignals && candleSizeViolation) {
        s.markers.push({ time, position: 'top', shape: 'diamond', color: white, size: 'tiny', id: 'shape0' });
      }
      s.upperKs[i] = upperK;
      s.lowerKs[i] = lowerK;
      s.buyAtrs[i] = buyAtr;
      s.sellAtrs[i] = sellAtr;
      if (cfg.colorBars) s.barColors.push({ time, color: baselineColor });

      // ---- One flag per bar for each alertcondition of the original
      const pc = i > 0 ? s.close[i - 1] : NaN;
      const pExit = i > 0 ? s.sslExit[i - 1] : NaN;
      // exit_long = ta.crossunder(close, sslExit); exit_short = ta.crossover(close, sslExit)
      flagsNow[0] = c < sslExit && pc >= pExit;
      flagsNow[1] = c > sslExit && pc <= pExit;
      // ssl2_buy_signal = buy_atr and not buy_atr[1] (the same for sell)
      flagsNow[2] = buyAtr && !(i > 0 && s.buyAtrs[i - 1]);
      flagsNow[3] = sellAtr && !(i > 0 && s.sellAtrs[i - 1]);
      // baseline_bullish = ta.crossover(close, upperk); baseline_bearish = ta.crossunder(close, lowerk)
      flagsNow[4] = c > upperK && pc <= (i > 0 ? s.upperKs[i - 1] : NaN);
      flagsNow[5] = c < lowerK && pc >= (i > 0 ? s.lowerKs[i - 1] : NaN);
      // price_above_baseline = close > BBMC and close[1] <= BBMC (the same for below)
      flagsNow[6] = i > 0 && gt(c, bbmc) && le(pc, bbmc);
      flagsNow[7] = i > 0 && lt(c, bbmc) && ge(pc, bbmc);
      // high_risk_entry = risk_level == "High" and entry_distance == "Far" (a na distance is "Far")
      const distance = Math.abs(c - bbmc) / atr;
      flagsNow[8] = gt(pct, 75) && !lt(distance, 1) && !lt(distance, 2);
      flagsNow[9] = candleSizeViolation;
      // extreme_volatility = atr_percentile > 90
      flagsNow[10] = gt(pct, 90);
      for (let k = 0; k < 11; k++) {
        s.flags[k][i] = flagsNow[k];
        if (flagsNow[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      // ---- Risk table (last bar)
      const tables: TableData[] = [];
      if (n > 0 && cfg.showRiskTable) {
        const last = n - 1;
        const saturation = riskSaturation(s.pctArr[last]);
        const bullishColor = String(color.new(cfg.bullishColor, saturation));
        const bearishColor = String(color.new(cfg.bearishColor, saturation));
        const percentile = s.pctArr[last];
        const distance = Math.abs(s.close[last] - s.bbmcArr[last]) / s.atrArr[last];
        const entryDistance = lt(distance, 1) ? 'Near' : lt(distance, 2) ? 'Extended' : 'Far';
        const riskLevel = gt(percentile, 75) ? 'High' : lt(percentile, 25) ? 'Low' : 'Normal';
        const cells: TableCellData[] = [];
        const cell = (column: number, row: number, text: string, textColor: string) => {
          cells.push({ column, row, text, textColor, textSize: 'small' });
        };
        cell(0, 0, 'Risk Level', white);
        cell(1, 0, riskLevel, riskLevel === 'High' ? bearishColor : riskLevel === 'Low' ? bullishColor : NEUTRAL);
        cell(0, 1, 'Entry Distance', white);
        cell(1, 1, entryDistance, entryDistance === 'Near' ? bullishColor : entryDistance === 'Extended' ? String(color.yellow) : bearishColor);
        cell(0, 2, 'Vol %ile', white);
        cell(1, 2, str.tostring(math.round(percentile, 1)) + '%', white);
        cell(0, 3, 'ATR', white);
        cell(1, 3, str.tostring(s.atrArr[last], '#.####'), white);
        tables.push({
          position: 'bottom_right', columns: 2, rows: 4, cells, bgColor: String(color.new('#1a1a1a', 5)), borderWidth: 1,
        });
      }
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 7; k++) plots[`plot${k}`] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // fill(upper_channel, lower_channel, title = "Baseline Channel")
        fills: [{ plot1: 'plot1', plot2: 'plot2', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
        tables,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SslHybridInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SslHybridInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'EXIT LONG Signal', message: 'EXIT LONG Signal – see chart for price and risk details' },
  { id: 'alert1', title: 'EXIT SHORT Signal', message: 'EXIT SHORT Signal – see chart for price and risk details' },
  { id: 'alert2', title: 'SSL2 BUY Continuation', message: 'SSL2 BUY Continuation – see chart for ATR details' },
  { id: 'alert3', title: 'SSL2 SELL Continuation', message: 'SSL2 SELL Continuation – see chart for ATR details' },
  { id: 'alert4', title: 'Price Above Upper Channel', message: 'Price Above Upper Channel – price has broken above upper band' },
  { id: 'alert5', title: 'Price Below Lower Channel', message: 'Price Below Lower Channel – price has broken below lower band' },
  { id: 'alert6', title: 'Price Crossed Above Baseline', message: 'Price Crossed Above Baseline' },
  { id: 'alert7', title: 'Price Crossed Below Baseline', message: 'Price Crossed Below Baseline' },
  { id: 'alert8', title: 'HIGH RISK Entry Conditions', message: 'HIGH RISK Entry – check chart for context' },
  { id: 'alert9', title: 'FALSE BREAKOUT WARNING', message: 'FALSE BREAKOUT WARNING – possible trap candle' },
  { id: 'alert10', title: 'EXTREME VOLATILITY', message: 'EXTREME VOLATILITY – check ATR levels on chart' },
];

export const SslHybrid = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
