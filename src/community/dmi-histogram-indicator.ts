/**
 * DMI Histogram Indicator
 *
 * Directional movement with Wilder smoothing: +DI is RMA-smoothed again (`Smoothed +DI Period`), -DI is not. The
 * histogram is +DI - -DI, coloured by its sign and by ADX against its SMA (strong / weak green, weak / strong red),
 * with a transparency of 100 - ADX * 1.9. Here ADX is 100 * EMA(|+DI - -DI| / (+DI + -DI), `ADX Signal Length`).
 * The same colours paint candles on the price pane. +DI - 20 and SMA(-DI) - 22 are drawn; -DI, ADX, its SMA and
 * RMA(5 + +DI - -DI, 3) are hidden. Triangles mark ADX crossing under its SMA (top: +DI above SMA(-DI); bottom:
 * SMA(-DI) above +DI), bright when ADX > 33.
 * Alerts (alertcondition, `alerts` of the result): the two ADX reversals (as the triangles, whether shown or not), ADX
 * crossing over +DI, over SMA(-DI) and over its SMA, and +DI crossing over / under SMA(-DI).
 *
 * Reference: "DMI Histogram Indicator" by Chart0bserver
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Chart0bserver
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DmiHistogramIndicatorInputs {
  /** EMA length of the ADX */
  lensig: number;
  /** DI length */
  len: number;
  /** RMA length of +DI */
  plusEma: number;
  /** SMA length of the ADX */
  smoothAdxPeriod: number;
  /** SMA length of -DI */
  smoothMinusPeriod: number;
  showColoredCandles: boolean;
  showAdxReversals: boolean;
}

export const defaultInputs: DmiHistogramIndicatorInputs = {
  lensig: 20,
  len: 14,
  plusEma: 4,
  smoothAdxPeriod: 8,
  smoothMinusPeriod: 8,
  showColoredCandles: true,
  showAdxReversals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lensig', type: 'int', title: 'ADX Signal Length', defval: 20, min: 3 },
  { id: 'len', type: 'int', title: 'DI Length', defval: 14, min: 1 },
  { id: 'plusEma', type: 'int', title: 'Smoothed +DI Period', defval: 4, min: 3 },
  { id: 'smoothAdxPeriod', type: 'int', title: 'Smoothed ADX Period', defval: 8, min: 3 },
  { id: 'smoothMinusPeriod', type: 'int', title: 'Smoothed -DI Period', defval: 8, min: 3 },
  { id: 'showColoredCandles', type: 'bool', title: 'Show Colored Candles', defval: true, group: 'Display Options' },
  { id: 'showAdxReversals', type: 'bool', title: 'Show ADX Reversals', defval: true, group: 'Display Options' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI Histogram', color: '#26a63d', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: '+DI', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: color.orange, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'ADX', color: color.purple, lineWidth: 2, display: 'none' },
  { id: 'plot4', title: 'Smooth ADX', color: color.white, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Smooth -DI', color: color.orange, lineWidth: 1 },
  { id: 'plot6', title: 'PM Gap', color: color.silver, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'DMI Histogram Indicator',
  shortTitle: 'DMI Histogram',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface DmiVars {
  /** fixnan of the +DI / -DI ratios: the last non-na values */
  lastPlus: number;
  lastMinus: number;
}

interface DmiRun extends BarRunState<DmiVars> {
  tr: ReturnType<typeof taStep.tr>;
  trur: Ma;
  rmaPlus: Ma;
  rmaMinus: Ma;
  plusRma: Ma;
  gap: Ma;
  adxEma: Ma;
  smoothMinus: ReturnType<typeof taStep.sma>;
  smoothAdx: ReturnType<typeof taStep.sma>;
  reversal: ReturnType<typeof taStep.crossunder>;
  plus: number[];
  adx: number[];
  smoothMinusArr: number[];
  smoothAdxArr: number[];
  plots: Point[][];
  candles: PlotCandleData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DmiHistogramIndicatorInputs>): BarStudy<DmiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const blue = String(color.new(color.blue, 0));
  const orange = String(color.new(color.orange, 0));
  const purple = String(color.new(color.purple, 0));
  const white = String(color.new(color.white, 0));
  const silver = String(color.new(color.silver, 0));
  return {
    init() {
      const tr = taStep.tr(false);
      const trur = taStep.rma(cfg.len);
      const rmaPlus = taStep.rma(cfg.len);
      const rmaMinus = taStep.rma(cfg.len);
      const plusRma = taStep.rma(cfg.plusEma);
      const gap = taStep.rma(3);
      const adxEma = taStep.ema(cfg.lensig);
      const smoothMinus = taStep.sma();
      const smoothAdx = taStep.sma();
      const reversal = taStep.crossunder();
      const s: DmiRun = {
        tr, trur, rmaPlus, rmaMinus, plusRma, gap, adxEma, smoothMinus, smoothAdx, reversal,
        plus: [], adx: [], smoothMinusArr: [], smoothAdxArr: [], plots: [[], [], [], [], [], [], []], candles: [],
        markers: [], flags: [[], [], [], [], [], [], []], times: [[], [], [], [], [], [], []],
        steps: [tr, trur, rmaPlus, rmaMinus, plusRma, gap, adxEma, smoothMinus, smoothAdx, reversal],
        vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plus, s.adx, s.smoothMinusArr, s.smoothAdxArr, ...s.plots, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const p = i > 0 ? bars[i - 1] : null;
      // up = ta.change(high); down = -ta.change(low)
      const up = p ? b.high - p.high : NaN;
      const down = p ? -(b.low - p.low) : NaN;
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const trur = s.trur.step(s.tr.step(b.high, b.low, b.close));
      const rmaPlus = s.rmaPlus.step(plusDM);
      const rmaMinus = s.rmaMinus.step(minusDM);
      // fixnan(100 * ta.rma(dm, len) / trur): a plain division (x / 0 is +-infinity, kept by fixnan; 0 / 0 is na)
      const plusRaw = (100 * rmaPlus) / trur;
      const minusRaw = (100 * rmaMinus) / trur;
      if (!isNaN(plusRaw)) v.lastPlus = plusRaw;
      if (!isNaN(minusRaw)) v.lastMinus = minusRaw;
      const plus = s.plusRma.step(v.lastPlus);
      const minus = v.lastMinus;
      const plusMinusGap = s.gap.step(5 + (plus - minus));
      // adx = 100 * ta.ema(math.abs(plus - minus) / (sum == 0 ? 1 : sum), lensig)
      const sum = plus + minus;
      const dx = Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum);
      const adx = 100 * s.adxEma.step(dx);
      const smoothMinus = s.smoothMinus.step(minus, cfg.smoothMinusPeriod);
      const smoothADX = s.smoothAdx.step(adx, cfg.smoothAdxPeriod);
      s.plus[i] = plus;
      s.adx[i] = adx;
      s.smoothMinusArr[i] = smoothMinus;
      s.smoothAdxArr[i] = smoothADX;

      // adxTrendReversal = ta.crossunder(adx, smoothADX) (exact comparison)
      const reversal = s.reversal.step(adx, smoothADX);

      const diDifference = plus - minus;
      const op = 100 - adx * 1.9;
      const histColor = String(ge(diDifference, 0)
        ? (lt(smoothADX, adx) ? color.new('#26a63d', op) : color.new('#b2dfbb', op))
        : (lt(adx, smoothADX) ? color.new('#FFCDD2', op) : color.new('#FF5252', op)));

      if (cfg.showColoredCandles) {
        s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close,
          color: histColor, wickColor: histColor, borderColor: histColor, forceOverlay: true };
      }

      // bearishReversal = adxTrendReversal and plus > smoothMinus; bullishReversal = ... and smoothMinus > plus
      const bearishReversal = reversal && gt(plus, smoothMinus);
      const bullishReversal = reversal && gt(smoothMinus, plus);
      if (cfg.showAdxReversals && reversal) {
        if (bearishReversal) {
          s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: gt(adx, 33) ? color.red : '#561f1f', size: 'tiny' });
        }
        if (bullishReversal) {
          s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: gt(adx, 33) ? color.green : '#0d2f0e', size: 'tiny' });
        }
      }

      // Alert conditions: bearishReversal / bullishReversal, ta.crossover(adx, plus) / (adx, smoothMinus) /
      // (adx, smoothADX), bullishDI = ta.crossover(plus, smoothMinus), bearishDI = ta.crossunder(plus, smoothMinus)
      const pAdx = i > 0 ? s.adx[i - 1] : NaN;
      const pPlus = i > 0 ? s.plus[i - 1] : NaN;
      const pSmoothMinus = i > 0 ? s.smoothMinusArr[i - 1] : NaN;
      const pSmoothAdx = i > 0 ? s.smoothAdxArr[i - 1] : NaN;
      const flags = s.flags;
      flags[0][i] = bearishReversal;
      flags[1][i] = bullishReversal;
      flags[2][i] = adx > plus && pAdx <= pPlus;
      flags[3][i] = adx > smoothMinus && pAdx <= pSmoothMinus;
      flags[4][i] = adx > smoothADX && pAdx <= pSmoothAdx;
      flags[5][i] = plus > smoothMinus && pPlus <= pSmoothMinus;
      flags[6][i] = plus < smoothMinus && pPlus >= pSmoothMinus;
      for (let k = 0; k < 7; k++) if (flags[k][i]) s.times[k].push(t as number);

      const pl = s.plots;
      pl[0][i] = { time: t, value: fin(diDifference), color: histColor };
      pl[1][i] = { time: t, value: fin(plus - 20), color: blue };
      pl[2][i] = { time: t, value: fin(minus), color: orange };
      pl[3][i] = { time: t, value: fin(adx), color: purple };
      pl[4][i] = { time: t, value: fin(smoothADX), color: white };
      pl[5][i] = { time: t, value: fin(smoothMinus - 22), color: orange };
      pl[6][i] = { time: t, value: fin(plusMinusGap), color: silver };
    },
    result(s, bars) {
      const n = bars.length;
      const levelColor = String(color.new(color.gray, 70));
      const pl = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: pl[0].slice(), plot1: pl[1].slice(), plot2: pl[2].slice(), plot3: pl[3].slice(), plot4: pl[4].slice(),
          plot5: pl[5].slice(), plot6: pl[6].slice(),
        },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new(color.white, 100)), linestyle: 'solid' } },
          { value: 10, options: { title: '10 Level', color: levelColor, linestyle: 'dashed' } },
          { value: -10, options: { title: '-10 Level', color: levelColor, linestyle: 'dashed' } },
          { value: 20, options: { title: '20 Level', color: levelColor, linestyle: 'dashed' } },
          { value: -20, options: { title: '-20 Level', color: levelColor, linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
        plotCandles: { dmiColoredCandles: cfg.showColoredCandles ? s.candles.slice() : [] },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DmiHistogramIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DmiHistogramIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ADX Bear Trend Reversal? ', message: 'Possible Bearish Reversal - ADX pivot downward while +DI > -DI' },
  { id: 'alert1', title: 'ADX Bull Trend Reversal?', message: 'Possible Bullish Reversal - ADX pivot downward while -DI > +DI' },
  { id: 'alert2', title: 'ADX Cross Above +DI', message: 'ADX crossed above +DI' },
  { id: 'alert3', title: 'ADX Cross Above -DI', message: 'ADX crossed above -DI' },
  { id: 'alert4', title: "ADX Cross Above it's MA", message: 'Possible Trend Strengthening - ADX pivot upward' },
  { id: 'alert5', title: 'Bullish DI Cross', message: '+DI crossed above -DI (Possibly Bullish)' },
  { id: 'alert6', title: 'Bearish DI Cross', message: '+DI crossed below -DI (Possibly Bearish)' },
];

export const DmiHistogramIndicator = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
