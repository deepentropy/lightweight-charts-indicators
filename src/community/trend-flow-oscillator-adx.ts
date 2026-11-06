/**
 * Trend Flow Oscillator (CMF + MFI) + ADX
 *
 * TFO = CMF + scaled MFI, optionally smoothed with an SMA. MFI = ta.mfi(source, mfiLen) scaled to -1..+1
 * ((mfi - 50) / 50). CMF = sum(ad, cmfLen) / sum(volume, cmfLen) with ad = ((2 * close - high - low) / (high - low))
 * * volume (0 when high == low). The TFO line is light blue when >= 0 and rising, dark blue when >= 0 and not
 * rising, red when < 0 and falling, maroon otherwise. The ADX (DMI with Wilder smoothing) is scaled with
 * (adx - 25) / 25. A grey background marks the bars where |TFO| > 1. CMF and scaled MFI are hidden plots.
 *
 * Reference: "Trend Flow Oscillator (CMF + MFI) + ADX" by WalrusQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VP_Futures
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendFlowOscillatorAdxInputs {
  /** MFI length */
  mfiLen: number;
  /** CMF length */
  cmfLen: number;
  /** Price source of the MFI */
  src: SourceType;
  /** SMA length of the TFO (1 = no smoothing) */
  smoothLen: number;
  /** ADX smoothing */
  adxLen: number;
  /** DI length */
  diLen: number;
}

export const defaultInputs: TrendFlowOscillatorAdxInputs = {
  mfiLen: 14,
  cmfLen: 20,
  src: 'hlc3',
  smoothLen: 2,
  adxLen: 14,
  diLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'mfiLen', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'cmfLen', type: 'int', title: 'CMF Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'smoothLen', type: 'int', title: 'TFO Smoothing', defval: 2, min: 1, max: 10 },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14 },
];

const COL_UP_RISING = String(color.new('#46abe1', 20));
const COL_UP_FALLING = String(color.new('#1040df', 20));
const COL_DOWN_FALLING = String(color.new(color.red, 20));
const COL_DOWN_RISING = String(color.new(color.maroon, 20));
const BG_EXTREME = String(color.new(color.gray, 95));
const BAND_COL = String(color.new(color.gray, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TFO', color: COL_UP_RISING, lineWidth: 2 },
  { id: 'plot1', title: 'ADX (scaled)', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'CMF', color: String(color.new(color.blue, 70)), lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'MFI Scaled', color: String(color.new(color.orange, 70)), lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_upper', price: 0.7, title: 'Upper', color: BAND_COL, linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.7, title: 'Lower', color: BAND_COL, linestyle: 'dashed' },
];

export const metadata = {
  title: 'Trend Flow Oscillator (CMF + MFI) + ADX',
  shortTitle: 'TFO+ADX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface TfoVars {
  /** fixnan(plus) / fixnan(minus): the last non-na values */
  plus: number;
  minus: number;
}

interface TfoRun extends BarRunState<TfoVars> {
  mfi: ReturnType<typeof taStep.mfi>;
  sumAd: WindowSum;
  sumVol: WindowSum;
  tfoSma: WindowSma;
  tr: ReturnType<typeof taStep.tr>;
  trRma: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adxRma: ReturnType<typeof taStep.rma>;
  tfo: number[];
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<TrendFlowOscillatorAdxInputs>): BarStudy<TfoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: TfoRun = {
        mfi: taStep.mfi(cfg.mfiLen), sumAd: new WindowSum(cfg.cmfLen), sumVol: new WindowSum(cfg.cmfLen),
        tfoSma: new WindowSma(cfg.smoothLen), tr: taStep.tr(false), trRma: taStep.rma(cfg.diLen),
        plusRma: taStep.rma(cfg.diLen), minusRma: taStep.rma(cfg.diLen), adxRma: taStep.rma(cfg.adxLen),
        tfo: [], plots: [[], [], [], []], bgColors: [],
        vars: { plus: NaN, minus: NaN }, steps: [], lists: [], series: [],
      };
      s.steps = [
        s.mfi, s.sumAd, s.sumVol, ...(cfg.smoothLen > 1 ? [s.tfoSma] : []), s.tr, s.trRma, s.plusRma, s.minusRma, s.adxRma,
      ];
      s.lists = [s.bgColors];
      s.series = [s.tfo, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const vol = b.volume ?? NaN;

      // mfi = (ta.mfi(src, mfiLen) - 50) / 50
      const mfi = ((s.mfi.step(value(b), vol) ?? NaN) - 50.0) / 50.0;

      // ad = high == low ? 0 : ((2 * close - high - low) / (high - low)) * volume
      const ad = eq(b.high, b.low) ? 0.0 : ((2.0 * b.close - b.high - b.low) / (b.high - b.low)) * vol;
      const sumAd = s.sumAd.step(ad);
      const sumVol = s.sumVol.step(vol);
      // plain division: x / 0 is +-infinity, 0 / 0 na
      const cmf = sumAd / sumVol;

      // tfo = smoothLen > 1 ? ta.sma(cmf + mfi, smoothLen) : cmf + mfi
      const tfoRaw = cmf + mfi;
      const tfo = cfg.smoothLen > 1 ? s.tfoSma.step(tfoRaw) : tfoRaw;
      s.tfo[i] = tfo;

      // dirmov(diLen)
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? -(b.low - bars[i - 1].low) : NaN;
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const trRma = s.trRma.step(s.tr.step(b.high, b.low, b.close) ?? NaN) ?? NaN;
      const plusRaw = (100 * (s.plusRma.step(plusDM) ?? NaN)) / trRma;
      const minusRaw = (100 * (s.minusRma.step(minusDM) ?? NaN)) / trRma;
      if (!isNaN(plusRaw)) v.plus = plusRaw;
      if (!isNaN(minusRaw)) v.minus = minusRaw;
      const plus = v.plus;
      const minus = v.minus;
      // adx = 100 * ta.rma(math.abs(p - m) / (sumDM == 0 ? 1 : sumDM), adxLen)
      const sumDM = plus + minus;
      const dx = Math.abs(plus - minus) / (eq(sumDM, 0) ? 1 : sumDM);
      const adxRaw = 100 * (s.adxRma.step(dx) ?? NaN);
      const adxNorm = (adxRaw - 25) / 25;

      const prev = i > 0 ? s.tfo[i - 1] : NaN;
      const c = ge(tfo, 0)
        ? (gt(tfo, prev) ? COL_UP_RISING : COL_UP_FALLING)
        : (lt(tfo, prev) ? COL_DOWN_FALLING : COL_DOWN_RISING);
      s.plots[0][i] = { time, value: fin(tfo), color: c };
      s.plots[1][i] = { time, value: fin(adxNorm), color: color.yellow };
      s.plots[2][i] = { time, value: fin(cmf) };
      s.plots[3][i] = { time, value: fin(mfi) };
      // bgcolor(math.abs(tfo) > 1.0 ? color.new(color.gray, 95) : na)
      if (gt(Math.abs(tfo), 1.0)) s.bgColors.push({ time, color: BG_EXTREME });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendFlowOscillatorAdxInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendFlowOscillatorAdxInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendFlowOscillatorAdx = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
