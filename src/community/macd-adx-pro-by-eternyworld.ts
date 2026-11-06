/**
 * Macd + Adx PRO
 *
 * MACD (EMA fast - EMA slow of the close, EMA signal, histogram) coloured with the ADX / DMI. "Sensitive" mode: the
 * histogram is dark green when positive and rising, light green when positive and not rising, red when negative and
 * falling, light red otherwise; the MACD and signal lines are green when the histogram is positive. "Filtered" mode:
 * with a strong trend (ADX >= threshold) the histogram is green when +DI > -DI (dark while the ADX is not falling,
 * else mid / light green as +DI rises or not) and red otherwise (light while the ADX falls); without a strong trend
 * it is grey (light while the ADX falls); the lines are green when +DI > -DI. The ADX and the threshold can be shown.
 * Alerts (alertcondition, `alerts` of the result): 'Strong Buy' (the histogram turns positive; in "Filtered" mode also
 * +DI > -DI) and 'Strong Sell' (it turns negative; in "Filtered" mode also -DI > +DI).
 *
 * Reference: "Macd + Adx Pro by @Eternyworld" by ETERNYWORLD
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MacdAdxProMode = 'Sensitive' | 'Filtered';

export interface MacdAdxProByEternyworldInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  /** DI length of ta.dmi */
  adxLength: number;
  /** ADX smoothing of ta.dmi */
  adxSmoothing: number;
  /** ADX level of a strong trend */
  adxThreshold: number;
  showAdx: boolean;
  showAdxThreshold: boolean;
  mode: MacdAdxProMode;
}

export const defaultInputs: MacdAdxProByEternyworldInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  adxLength: 14,
  adxSmoothing: 14,
  adxThreshold: 22,
  showAdx: false,
  showAdxThreshold: false,
  mode: 'Sensitive',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: ' Fast Length ', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: ' Slow Length ', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: ' Signal Length ', defval: 9, min: 1 },
  { id: 'adxLength', type: 'int', title: ' ADX Length ', defval: 14, min: 1 },
  { id: 'adxSmoothing', type: 'int', title: ' ADX Smoothing ', defval: 14, min: 1 },
  { id: 'adxThreshold', type: 'int', title: ' ADX Threshold ', defval: 22, min: 10 },
  { id: 'showAdx', type: 'bool', title: 'Show ADX', defval: false },
  { id: 'showAdxThreshold', type: 'bool', title: 'Show ADX Threshold', defval: false },
  { id: 'mode', type: 'string', title: 'mode', defval: 'Sensitive', options: ['Sensitive', 'Filtered'] },
];

const LIME_DARK = '#026D42';
const LIME_LIGHT = '#A0F3CB';
const LIME_MID = '#A0F3CB';
const RED_DARK = '#FF0000';
const RED_LIGHT = '#F3C2C2';
const GRAY_DARK = '#f6f6f8a6';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Histogram', color: LIME_DARK, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'MACD Line', color: LIME_DARK, lineWidth: 2 },
  { id: 'plot2', title: 'Signal Line', color: String(color.new(LIME_DARK, 30)), lineWidth: 2 },
  { id: 'plot3', title: 'ADX', color: 'rgb(246, 246, 247)', lineWidth: 1 },
  { id: 'plot4', title: 'ADX Threshold', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Macd + Adx PRO by @ETERNYWORLD',
  shortTitle: 'Macd + Adx PRO by @ETERNYWORLD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface MacdAdxRun extends BarRunState<Record<string, never>> {
  macd: ReturnType<typeof taStep.macd>;
  dmi: ReturnType<typeof taStep.dmi>;
  hist: number[];
  diplus: number[];
  adx: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdAdxProByEternyworldInputs>): BarStudy<MacdAdxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const sensitive = cfg.mode === 'Sensitive';
  const grayLight = String(color.new('#F6F6F8', 60));
  const limeSignal = String(color.new(LIME_DARK, 30));
  const redSignal = String(color.new(RED_DARK, 30));
  const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !gt(a, b);
  return {
    init() {
      const s: MacdAdxRun = {
        macd: taStep.macd(cfg.fastLength, cfg.slowLength, cfg.signalLength),
        dmi: taStep.dmi(cfg.adxLength, cfg.adxSmoothing),
        hist: [], diplus: [], adx: [], plots: [[], [], [], [], []], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.macd, s.dmi];
      s.lists = s.times;
      s.series = [s.hist, s.diplus, s.adx, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const [macdLine, signalLine, h] = s.macd.step(b.close);
      const [diplus, diminus, adx] = s.dmi.step(b.high, b.low, b.close);
      const prevHist = i > 0 ? s.hist[i - 1] : NaN;
      const prevAdx = i > 0 ? s.adx[i - 1] : NaN;
      const prevPlus = i > 0 ? s.diplus[i - 1] : NaN;
      s.hist[i] = h;
      s.adx[i] = adx;
      s.diplus[i] = diplus;
      const strongTrend = ge(adx, cfg.adxThreshold);
      const bullish = gt(diplus, diminus);
      const adxWeakening = lt(adx, prevAdx);
      const diplusRising = gt(diplus, prevPlus);
      const histColor = sensitive
        ? (ge(h, 0) ? (gt(h, prevHist) ? LIME_DARK : LIME_LIGHT) : (lt(h, prevHist) ? RED_DARK : RED_LIGHT))
        : strongTrend
          ? (bullish ? (adxWeakening ? (diplusRising ? LIME_MID : LIME_LIGHT) : LIME_DARK) : (adxWeakening ? RED_LIGHT : RED_DARK))
          : (adxWeakening ? grayLight : GRAY_DARK);
      const up = sensitive ? gt(h, 0) : bullish;
      // alertcondition(hist > 0 and hist[1] <= 0 and (mode == "Sensitive" or bullish_direction), "Strong Buy")
      const buy = gt(h, 0) && le(prevHist, 0) && (sensitive || bullish);
      // alertcondition(hist < 0 and hist[1] >= 0 and (mode == "Sensitive" or bearish_direction), "Strong Sell")
      const sell = lt(h, 0) && ge(prevHist, 0) && (sensitive || gt(diminus, diplus));
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t as number);
      if (sell) s.times[1].push(t as number);
      const p = s.plots;
      p[0][i] = { time: t, value: h, color: histColor };
      p[1][i] = { time: t, value: macdLine, color: up ? LIME_DARK : RED_DARK };
      p[2][i] = { time: t, value: signalLine, color: up ? limeSignal : redSignal };
      p[3][i] = { time: t, value: cfg.showAdx ? adx : NaN, color: 'rgb(246, 246, 247)' };
      p[4][i] = { time: t, value: cfg.showAdxThreshold ? cfg.adxThreshold : NaN, color: color.orange };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdAdxProByEternyworldInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdAdxProByEternyworldInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Strong Buy', message: 'MACD Bullish Cross' },
  { id: 'alert1', title: 'Strong Sell', message: 'MACD Bearish Cross' },
];

export const MacdAdxProByEternyworld = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
