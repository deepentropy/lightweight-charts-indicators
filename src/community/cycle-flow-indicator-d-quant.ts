/**
 * Cycle & Flow Indicator - D_Quant
 *
 * Three votes of +1 / -1 (or 0): a Schaff Trend Cycle direction (MACD of EMAs, two stochastic + EMA passes; +1 above
 * 25, -1 below 75 while falling, the second rule wins), the Parabolic SAR side of the close and the sign of an SMA of
 * the Ease of Movement. Their average above the bullish threshold gives a bullish state, below the bearish threshold
 * a bearish state, else neutral. A Hull MA of the close is the baseline, coloured by the state, with a cloud to the
 * close; the HMA + ATR band shows in the bullish state, the HMA - ATR band in the bearish state. Candles take the
 * state colour.
 * Alerts (alertcondition, `alerts` of the result): 'CFA Bullish Cycle' / 'CFA Bearish Cycle', true on the bars where
 * the state (-1 / 0 / 1) crosses above / below 0.
 *
 * Reference: "Cycle & Flow Indicator - D_Quant" by D_QUANT
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © D_QUANT
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CycleFlowIndicatorDQuantInputs {
  /** STC stochastic / EMA length */
  stcLength: number;
  /** STC MACD fast EMA length */
  stcFast: number;
  /** STC MACD slow EMA length */
  stcSlow: number;
  /** Parabolic SAR start */
  psarStart: number;
  /** Parabolic SAR increment */
  psarInc: number;
  /** Parabolic SAR maximum */
  psarMax: number;
  /** Ease of Movement SMA length */
  eomLength: number;
  /** Ease of Movement volume divisor */
  eomDiv: number;
  /** Bullish threshold of the average vote */
  treshBull: number;
  /** Bearish threshold of the average vote */
  treshBear: number;
}

export const defaultInputs: CycleFlowIndicatorDQuantInputs = {
  stcLength: 10,
  stcFast: 23,
  stcSlow: 50,
  psarStart: 0.02,
  psarInc: 0.02,
  psarMax: 0.2,
  eomLength: 14,
  eomDiv: 100000000,
  treshBull: 0.2,
  treshBear: -0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'stcLength', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'stcFast', type: 'int', title: 'Fast Length', defval: 23, min: 1 },
  { id: 'stcSlow', type: 'int', title: 'Slow Length', defval: 50, min: 1 },
  { id: 'psarStart', type: 'float', title: 'Start', defval: 0.02, step: 0.001 },
  { id: 'psarInc', type: 'float', title: 'Increment', defval: 0.02, step: 0.001 },
  { id: 'psarMax', type: 'float', title: 'Maximum', defval: 0.2, step: 0.01 },
  { id: 'eomLength', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'eomDiv', type: 'int', title: 'Divisor', defval: 100000000 },
  { id: 'treshBull', type: 'float', title: 'Bullish Threshold', defval: 0.2, step: 0.1 },
  { id: 'treshBear', type: 'float', title: 'Bearish Threshold', defval: -0.2, step: 0.1 },
];

const COL_BULL = '#089981';
const COL_BEAR = '#f23645';
const COL_NEUT = String(color.new(color.gray, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Baseline', color: COL_BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Ghost Source', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Volatility', color: COL_BULL, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Lower Volatility', color: COL_BEAR, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Cycle & Flow Indicator - D_Quant',
  shortTitle: '|C|F|A|',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, `x != 0` false within 1e-10 or with na */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne0 = (x: number) => !Number.isNaN(x) && Number.isFinite(x) ? Math.abs(x) > EPS : false;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

/** ta.sar(start, inc, max): the state of the oakscriptjs loop at the end of the last bar (same operations) */
interface CfaVars {
  sarValue: number;
  extremePoint: number;
  acceleration: number;
  isUpTrend: boolean;
}

interface CfaRun extends BarRunState<CfaVars> {
  emaFast: Ema;
  emaSlow: Ema;
  lo1: WindowExtreme;
  hi1: WindowExtreme;
  d1: Ema;
  lo2: WindowExtreme;
  hi2: WindowExtreme;
  stc: Ema;
  eom: WindowSma;
  hma: ReturnType<typeof taStep.hma>;
  atr: ReturnType<typeof taStep.atr>;
  stcArr: number[];
  state: number[];
  plots: Point[][];
  cloud: string[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

const CLOUD_BULL = String(color.new(COL_BULL, 60));
const CLOUD_BEAR = String(color.new(COL_BEAR, 60));
const CLOUD_NEUT = String(color.new(color.gray, 90));
const EXT_BULL = String(color.new(COL_BULL, 85));
const EXT_BEAR = String(color.new(COL_BEAR, 85));

function study(inputs: Partial<CycleFlowIndicatorDQuantInputs>): BarStudy<CfaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  // math_stoch(src, len): max - min != 0 ? 100 * (src - min) / (max - min) : 0.0
  const stoch = (v: number, lo: number, hi: number) => (ne0(hi - lo) ? (100 * (v - lo)) / (hi - lo) : 0.0);
  return {
    init() {
      const s: CfaRun = {
        emaFast: taStep.ema(cfg.stcFast), emaSlow: taStep.ema(cfg.stcSlow), lo1: new WindowExtreme(true, 14),
        hi1: new WindowExtreme(false, 14), d1: taStep.ema(cfg.stcLength), lo2: new WindowExtreme(true, cfg.stcLength),
        hi2: new WindowExtreme(false, cfg.stcLength), stc: taStep.ema(cfg.stcLength), eom: new WindowSma(cfg.eomLength), hma: taStep.hma(20),
        atr: taStep.atr(14), stcArr: [], state: [], plots: Array.from({ length: 4 }, () => []), cloud: [], candles: [],
        flags: [[], []], times: [[], []], steps: [],
        vars: { sarValue: NaN, extremePoint: NaN, acceleration: cfg.psarStart, isUpTrend: false },
        lists: [], series: [],
      };
      s.steps = [s.emaFast, s.emaSlow, s.lo1, s.hi1, s.d1, s.lo2, s.hi2, s.stc, s.eom, s.hma, s.atr];
      s.lists = s.times;
      s.series = [s.stcArr, s.state, ...s.plots, s.cloud, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;

      // calc_stc
      const macd = s.emaFast.step(close) - s.emaSlow.step(close);
      const k1 = stoch(macd, s.lo1.step(macd), s.hi1.step(macd));
      const d1 = s.d1.step(k1);
      const k2 = stoch(d1, s.lo2.step(d1), s.hi2.step(d1));
      const stc = s.stc.step(k2);
      s.stcArr[i] = stc;

      // calc_psar: close > ta.sar(start, inc, max) ? 1 : -1
      let sar = NaN;
      if (i > 0) {
        const v = s.vars;
        const { psarStart: start, psarInc: inc, psarMax: max } = cfg;
        const high = b.high;
        const low = b.low;
        let isFirstTrendBar = false;
        if (i === 1) {
          if (close > bars[i - 1].close) {
            v.isUpTrend = true;
            v.extremePoint = high;
            v.sarValue = bars[i - 1].low;
          } else {
            v.isUpTrend = false;
            v.extremePoint = low;
            v.sarValue = bars[i - 1].high;
          }
          isFirstTrendBar = true;
          v.acceleration = start;
        }
        v.sarValue = v.sarValue + v.acceleration * (v.extremePoint - v.sarValue);
        if (v.isUpTrend) {
          if (v.sarValue > low) {
            isFirstTrendBar = true;
            v.isUpTrend = false;
            v.sarValue = Math.max(high, v.extremePoint);
            v.extremePoint = low;
            v.acceleration = start;
          }
        } else if (v.sarValue < high) {
          isFirstTrendBar = true;
          v.isUpTrend = true;
          v.sarValue = Math.min(low, v.extremePoint);
          v.extremePoint = high;
          v.acceleration = start;
        }
        if (!isFirstTrendBar) {
          if (v.isUpTrend) {
            if (high > v.extremePoint) {
              v.extremePoint = high;
              v.acceleration = Math.min(v.acceleration + inc, max);
            }
          } else if (low < v.extremePoint) {
            v.extremePoint = low;
            v.acceleration = Math.min(v.acceleration + inc, max);
          }
        }
        if (v.isUpTrend) {
          v.sarValue = Math.min(v.sarValue, bars[i - 1].low);
          if (i > 1) v.sarValue = Math.min(v.sarValue, bars[i - 2].low);
        } else {
          v.sarValue = Math.max(v.sarValue, bars[i - 1].high);
          if (i > 1) v.sarValue = Math.max(v.sarValue, bars[i - 2].high);
        }
        sar = v.sarValue;
      }

      // calc_eom
      const dist = i > 0 ? (b.high + b.low) / 2 - (bars[i - 1].high + bars[i - 1].low) / 2 : NaN;
      const range = b.high - b.low;
      const boxRatio = ne0(range) ? b.volume! / cfg.eomDiv / range : 0.0;
      const rawEom = ne0(boxRatio) ? dist / boxRatio : 0.0;
      const smoothEom = s.eom.step(rawEom);

      let dir = 0;
      if (gt(stc, 25)) dir = 1;
      if (lt(stc, 75) && lt(stc, i > 0 ? s.stcArr[i - 1] : NaN)) dir = -1;
      const sigPsar = gt(close, sar) ? 1 : -1;
      const sigEom = gt(smoothEom, 0) ? 1 : -1;
      // the three votes are never na: score_cnt is 3
      const avg = (0.0 + dir + sigPsar + sigEom) / 3;
      const state = gt(avg, cfg.treshBull) ? 1 : lt(avg, cfg.treshBear) ? -1 : 0;
      s.state[i] = state;
      const colTrend = state === 1 ? COL_BULL : state === -1 ? COL_BEAR : COL_NEUT;

      const baseMean = s.hma.step(close);
      const atr = s.atr.step(b.high, b.low, close);

      s.candles[i] = {
        time, open: b.open, high: b.high, low: b.low, close,
        color: colTrend, wickColor: colTrend, borderColor: colTrend, forceOverlay: true,
      };
      const p = s.plots;
      // plot(base_mean, "Baseline", color = col_trend, linewidth = 2)
      p[0][i] = { time, value: fin(baseMean), color: colTrend };
      // plot(close, "Ghost Source", color = na, display = display.none)
      p[1][i] = { time, value: close, color: 'transparent' };
      // plot(trend_state == 1 ? band_top : na, "Upper Volatility", col_bull, style = plot.style_linebr)
      p[2][i] = { time, value: state === 1 ? fin(baseMean + atr) : NaN, color: COL_BULL };
      // plot(trend_state == -1 ? band_bot : na, "Lower Volatility", col_bear, style = plot.style_linebr)
      p[3][i] = { time, value: state === -1 ? fin(baseMean - atr) : NaN, color: COL_BEAR };
      s.cloud[i] = state === 1 ? CLOUD_BULL : state === -1 ? CLOUD_BEAR : CLOUD_NEUT;

      // tx_bull = ta.crossover(trend_state, 0) / tx_bear = ta.crossunder(trend_state, 0)
      const prev = i > 0 ? s.state[i - 1] : NaN;
      const flags = [state > 0 && prev <= 0, state < 0 && prev >= 0];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Momentum Cloud' }, colors: s.cloud.slice() },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Bullish Extension', color: EXT_BULL }, colors: new Array<string>(n).fill(EXT_BULL) },
          { plot1: 'plot0', plot2: 'plot3', options: { title: 'Bearish Extension', color: EXT_BEAR }, colors: new Array<string>(n).fill(EXT_BEAR) },
        ],
        plotCandles: { quantCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CycleFlowIndicatorDQuantInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CycleFlowIndicatorDQuantInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'CFA Bullish Cycle', message: 'Cycle Flow: Bullish Trend Started' },
  { id: 'alert1', title: 'CFA Bearish Cycle', message: 'Cycle Flow: Bearish Trend Started' },
];

export const CycleFlowIndicatorDQuant = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
