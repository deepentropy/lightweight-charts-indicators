/**
 * Institutional Volume RSI [Adaptive]
 *
 * RSI of the volume-weighted moving average of the close (or of the close: standard RSI), with Bollinger bands on
 * the RSI: basis = SMA(RSI, bands length), bands = basis +/- multiplier * stdev(RSI, bands length). The RSI line is
 * green above the basis and red below; a fill shades the zone between the bands. White circles mark the bars where
 * the RSI crosses over the upper band or under the lower band.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Volatility Breakout' / 'Bearish Volatility Breakout', true
 * on the bars of those crosses.
 *
 * Reference: "Institutional Volume RSI [Adaptive]" by abgthecoder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InstitutionalVolumeRSIInputs {
  /** RSI length (also the VWMA length) */
  rsiLen: number;
  /** RSI source: VWMA of the close or the close */
  srcType: 'VWMA (Volume Weighted)' | 'Close (Standard)';
  /** Bands length */
  bbLen: number;
  /** Bands multiplier (standard deviations) */
  bbMult: number;
}

export const defaultInputs: InstitutionalVolumeRSIInputs = {
  rsiLen: 14,
  srcType: 'VWMA (Volume Weighted)',
  bbLen: 20,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'srcType', type: 'string', title: 'Source Type', defval: 'VWMA (Volume Weighted)', options: ['VWMA (Volume Weighted)', 'Close (Standard)'] },
  { id: 'bbLen', type: 'int', title: 'Bands Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'Bands Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

const BAND_COL = String(color.new(color.gray, 50));
const BASE_COL = String(color.new(color.white, 70));
const FILL_COL = String(color.new(color.blue, 95));
const BULL_COL = '#00E676';
const BEAR_COL = '#FF5252';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Baseline', color: BASE_COL, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Institutional RSI', color: BULL_COL, lineWidth: 2 },
  { id: 'plot4', title: 'Bullish Extreme', color: color.white, lineWidth: 3, style: 'circles' },
  { id: 'plot5', title: 'Bearish Extreme', color: color.white, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Institutional Volume RSI [Adaptive]',
  shortTitle: 'IV-RSI [Adaptive]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface IvRsiVars {
  /** rsi_val[1], upper[1], lower[1] of the crosses */
  prevRsi: number;
  prevUpper: number;
  prevLower: number;
}

interface IvRsiRun extends BarRunState<IvRsiVars> {
  vwma: WindowVwma | null;
  rsi: ReturnType<typeof taStep.rsi>;
  basis: WindowSma;
  dev: WindowStdev;
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<InstitutionalVolumeRSIInputs>): BarStudy<IvRsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const useVwma = cfg.srcType === 'VWMA (Volume Weighted)';
  return {
    init() {
      const vwma = useVwma ? new WindowVwma(cfg.rsiLen) : null;
      const rsi = taStep.rsi(cfg.rsiLen);
      const basis = new WindowSma(cfg.bbLen);
      const dev = new WindowStdev(cfg.bbLen);
      const s: IvRsiRun = {
        vwma, rsi, basis, dev, plots: Array.from({ length: 6 }, () => []), flags: [[], []], times: [[], []],
        steps: [...(vwma ? [vwma] : []), rsi, basis, dev],
        vars: { prevRsi: NaN, prevUpper: NaN, prevLower: NaN },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // rsi_src = src_type == "VWMA (Volume Weighted)" ? ta.vwma(close, rsi_len) : close
      const rsiSrc = s.vwma ? s.vwma.step(b.close, b.volume ?? NaN) : b.close;
      const rsi = s.rsi.step(rsiSrc);
      const basis = s.basis.step(rsi);
      const dev = s.dev.step(rsi);
      const upper = basis + dev * cfg.bbMult;
      const lower = basis - dev * cfg.bbMult;

      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]
      // (exact comparisons, no 1e-10 tolerance; na gives false)
      const crossUp = i > 0 && rsi > upper && v.prevRsi <= v.prevUpper;
      const crossDn = i > 0 && rsi < lower && v.prevRsi >= v.prevLower;
      v.prevRsi = rsi;
      v.prevUpper = upper;
      v.prevLower = lower;

      const p = s.plots;
      p[0][i] = { time, value: upper, color: BAND_COL };
      p[1][i] = { time, value: lower, color: BAND_COL };
      p[2][i] = { time, value: basis, color: BASE_COL };
      // rsi_color = rsi_val > basis ? #00E676 : #FF5252
      p[3][i] = { time, value: rsi, color: gt(rsi, basis) ? BULL_COL : BEAR_COL };
      p[4][i] = { time, value: crossUp ? rsi : NaN, color: color.white };
      p[5][i] = { time, value: crossDn ? rsi : NaN, color: color.white };
      // alertcondition(cross_up, ...) / alertcondition(cross_dn, ...)
      s.flags[0][i] = crossUp;
      s.flags[1][i] = crossDn;
      if (crossUp) s.times[0].push(time as number);
      if (crossDn) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3, plot4, plot5] = s.plots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
        // fill(p_upper, p_lower, color = color.new(color.blue, 95), title = "Volatility Zone")
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Volatility Zone', color: FILL_COL } }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InstitutionalVolumeRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<InstitutionalVolumeRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Volatility Breakout', message: 'IV-RSI broke above Upper Band' },
  { id: 'alert1', title: 'Bearish Volatility Breakout', message: 'IV-RSI broke below Lower Band' },
];

export const InstitutionalVolumeRSI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
