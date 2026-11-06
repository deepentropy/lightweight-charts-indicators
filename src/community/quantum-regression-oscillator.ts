/**
 * Quantum Regression Oscillator [ICN]
 *
 * The RSI of the source is smoothed by a linear regression (reg_len bars, offset 0) and then by an EMA. The line is
 * the bullish colour when it rises, else the bearish colour. Bollinger bands (SMA and 2 standard deviations of 50
 * bars) of the oscillator are hidden plots with a fill in the line colour. Divergences: a price pivot low and an
 * oscillator pivot low on the same bar, with a lower low in price and a higher oscillator value than 5 bars before
 * the pivot (bearish: the opposite on pivot highs), drawn as circles at the bottom / top of the pane on the pivot
 * bar.
 * Alerts (alertcondition, `alerts` of the result): 'Oversold Bounce' (the oscillator crosses over the lower band),
 * 'Overbought Rejection' (crosses under the upper band), 'Bullish Divergence' / 'Bearish Divergence' (on the bar that
 * confirms the pivot, not shifted back as the circles).
 *
 * Reference: "Quantum Regression Oscillator [ICN]" by abgthecoder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { barTime } from '../bar-time';

export interface QuantumRegressionOscillatorInputs {
  src: SourceType;
  /** RSI length */
  len: number;
  /** EMA smoothing length */
  smooth: number;
  /** Linear regression length */
  regLen: number;
  colBull: string;
  colBear: string;
  /** Show the volatility bands (not used by the Pine outputs) */
  showBands: boolean;
  showDiv: boolean;
  /** Pivot left / right bars of the divergence detection */
  divLook: number;
}

export const defaultInputs: QuantumRegressionOscillatorInputs = {
  src: 'close',
  len: 14,
  smooth: 3,
  regLen: 9,
  colBull: '#00bcd4',
  colBear: '#ff5252',
  showBands: true,
  showDiv: true,
  divLook: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smoothing Factor', defval: 3, min: 1 },
  { id: 'regLen', type: 'int', title: 'Linear Regression Length', defval: 9, min: 2 },
  { id: 'colBull', type: 'color', title: 'Bullish Color', defval: '#00bcd4' },
  { id: 'colBear', type: 'color', title: 'Bearish Color', defval: '#ff5252' },
  { id: 'showBands', type: 'bool', title: 'Show Volatility Bands', defval: true },
  { id: 'showDiv', type: 'bool', title: 'Show Divergences', defval: true },
  { id: 'divLook', type: 'int', title: 'Divergence Lookback', defval: 5, min: 1 },
];

const BAND_COLOR = String(color.new(color.gray, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Quantum Oscillator', color: '#00bcd4', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: BAND_COLOR, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Lower Band', color: BAND_COLOR, lineWidth: 1, display: 'none' },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Oversold Bounce', message: 'QRO bounced from lower band' },
  { id: 'alert1', title: 'Overbought Rejection', message: 'QRO rejected from upper band' },
  { id: 'alert2', title: 'Bullish Divergence', message: 'Bullish Divergence Detected' },
  { id: 'alert3', title: 'Bearish Divergence', message: 'Bearish Divergence Detected' },
];

export const metadata = {
  title: 'Quantum Regression Oscillator [ICN]',
  shortTitle: 'QRO [ICN]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QroRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  reg: ReturnType<typeof taStep.linreg>;
  ema: ReturnType<typeof taStep.ema>;
  basis: WindowSma;
  dev: WindowStdev;
  plPrice: PivotStep;
  phPrice: PivotStep;
  plOsc: PivotStep;
  phOsc: PivotStep;
  qro: number[];
  upper: number[];
  lower: number[];
  oscColor: string[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QuantumRegressionOscillatorInputs>): BarStudy<QroRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const lb = cfg.divLook;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: QroRun = {
        rsi: taStep.rsi(cfg.len), reg: taStep.linreg(cfg.regLen, 0), ema: taStep.ema(cfg.smooth),
        basis: new WindowSma(50), dev: new WindowStdev(50),
        plPrice: new PivotStep(lb, lb, false), phPrice: new PivotStep(lb, lb, true),
        plOsc: new PivotStep(lb, lb, false), phOsc: new PivotStep(lb, lb, true),
        qro: [], upper: [], lower: [], oscColor: [], plot0: [], plot1: [], plot2: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, s.reg, s.ema, s.basis, s.dev, s.plPrice, s.phPrice, s.plOsc, s.phOsc];
      s.lists = [s.markers, ...s.times];
      s.series = [s.qro, s.upper, s.lower, s.oscColor, s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const rawRsi = s.rsi.step(value(b));
      const regRsi = s.reg.step(rawRsi);
      const q = s.ema.step(regRsi);
      const qro = s.qro;
      qro[i] = q;
      const basis = s.basis.step(q);
      const dev = s.dev.step(q);
      const upper = basis + 2.0 * dev;
      const lower = basis - 2.0 * dev;
      s.upper[i] = upper;
      s.lower[i] = lower;

      // Divergences
      const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);
      const lowAt = (k: number) => (k >= 0 ? bars[k].low : NaN);
      const highAt = (k: number) => (k >= 0 ? bars[k].high : NaN);
      const plPrice = s.plPrice.step(i, b.low);
      const phPrice = s.phPrice.step(i, b.high);
      const plOsc = s.plOsc.step(i, q);
      const phOsc = s.phOsc.step(i, q);
      const bullDiv = !isNaN(plPrice) && !isNaN(plOsc)
        && lt(lowAt(i - lb), lowAt(i - lb - 5)) && gt(at(qro, i - lb), at(qro, i - lb - 5));
      const bearDiv = !isNaN(phPrice) && !isNaN(phOsc)
        && gt(highAt(i - lb), highAt(i - lb - 5)) && lt(at(qro, i - lb), at(qro, i - lb - 5));

      // osc_color = qro > qro[1] ? col_bull : col_bear
      const oscColor = gt(q, at(qro, i - 1)) ? cfg.colBull : cfg.colBear;
      s.oscColor[i] = oscColor;

      // plotshape(..., offset = -div_look): the shape of bar i is drawn on bar i - div_look
      if (cfg.showDiv && i - lb >= 0) {
        const t = barTime(bars, i - lb);
        if (bullDiv) s.markers.push({ time: t, position: 'bottom', shape: 'circle', color: cfg.colBull, size: 'tiny' });
        if (bearDiv) s.markers.push({ time: t, position: 'top', shape: 'circle', color: cfg.colBear, size: 'tiny' });
      }

      s.plot0[i] = { time, value: fin(q), color: oscColor };
      s.plot1[i] = { time, value: fin(upper), color: BAND_COLOR };
      s.plot2[i] = { time, value: fin(lower), color: BAND_COLOR };

      // alertcondition(ta.crossover(qro, lower_band)), (ta.crossunder(qro, upper_band)), (bull_div), (bear_div)
      const pq = i > 0 ? qro[i - 1] : NaN;
      const pl = i > 0 ? s.lower[i - 1] : NaN;
      const pu = i > 0 ? s.upper[i - 1] : NaN;
      const flags = [q > lower && pq <= pl, q < upper && pq >= pu, bullDiv, bearDiv];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: 50, options: { title: 'Midline', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Volatility Background' },
            colors: s.oscColor.map((c) => String(color.new(c, 90))) },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QuantumRegressionOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QuantumRegressionOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QuantumRegressionOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
