/**
 * Buy Low Sell High Composite Upgraded V6
 *
 * Six indicators, each normalised to about -1..+1 with normalize(x, lo, hi) = -1 + 2 * (x - lo) / (hi - lo):
 * RSI (25..75), the EMA(5) - EMA(35) difference ("Elliott Wave", +-2 ATR(9)), CMO (-50..50), the MACD histogram
 * (MACD - SMA of MACD, +-2 ATR(9)), MFI of hlc3 (25..75) and the ADX signed by the +DI / -DI direction (-50..50).
 * A disabled indicator adds 0. The sum is normalised over -4..4 and smoothed by an EMA (or a triple EMA). The area
 * is red at or below 0, lime above; the outer line is lime / red / gray by the EMA of the bar-to-bar slope against
 * the slope threshold.
 *
 * Reference: "Buy Low Sell High Composite Upgraded V6 [kristian6ncqq]" by kristian6ncqq
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © kristian6ncqq
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuyLowSellHighCompositeUpgradedV6Inputs {
  useRSI: boolean;
  /** Use the EMA(5) - EMA(35) difference ("Elliott Wave") */
  useEW: boolean;
  useCMO: boolean;
  useMACD: boolean;
  useMFI: boolean;
  useADX: boolean;
  /** Triple EMA smoothing of the composite instead of one EMA */
  useTEMA: boolean;
  rsiLength: number;
  cmoLength: number;
  macdFast: number;
  macdSlow: number;
  macdSignalLen: number;
  mfiLength: number;
  adxLen: number;
  diLen: number;
  smoothingLength: number;
  slopeSmoothingLen: number;
  slopeThreshold: number;
}

export const defaultInputs: BuyLowSellHighCompositeUpgradedV6Inputs = {
  useRSI: true,
  useEW: true,
  useCMO: true,
  useMACD: true,
  useMFI: true,
  useADX: true,
  useTEMA: false,
  rsiLength: 14,
  cmoLength: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignalLen: 9,
  mfiLength: 14,
  adxLen: 14,
  diLen: 14,
  smoothingLength: 4,
  slopeSmoothingLen: 3,
  slopeThreshold: 0.02,
};

export const inputConfig: InputConfig[] = [
  { id: 'useRSI', type: 'bool', title: 'Use RSI', defval: true },
  { id: 'useEW', type: 'bool', title: 'Use EW', defval: true },
  { id: 'useCMO', type: 'bool', title: 'Use CMO', defval: true },
  { id: 'useMACD', type: 'bool', title: 'Use MACD', defval: true },
  { id: 'useMFI', type: 'bool', title: 'Use MFI', defval: true },
  { id: 'useADX', type: 'bool', title: 'Use ADX', defval: true },
  { id: 'useTEMA', type: 'bool', title: 'Use TEMA', defval: false },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'cmoLength', type: 'int', title: 'CMO Length', defval: 14, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'macdSignalLen', type: 'int', title: 'MACD Signal Length', defval: 9, min: 1 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing Length', defval: 14, min: 1 },
  { id: 'diLen', type: 'int', title: 'Directional Index Length', defval: 14, min: 1 },
  { id: 'smoothingLength', type: 'int', title: 'Composite Smoothing Length', defval: 4, min: 1 },
  { id: 'slopeSmoothingLen', type: 'int', title: 'Slope Smoothing Length', defval: 3, min: 1 },
  { id: 'slopeThreshold', type: 'float', title: 'Slope Threshold', defval: 0.02, min: 0.001, step: 0.001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Composite Inner', color: String(color.new(color.lime, 60)), lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'Composite Outer', color: color.gray, lineWidth: 3 },
];

export const metadata = {
  title: 'Buy Low Sell High Composite Upgraded V6 [kristian6ncqq]',
  shortTitle: 'BLSH',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** normalize(value, minValue, maxValue): delta = maxValue - minValue == 0 ? 0.0001 : maxValue - minValue */
function normalize(value: number, minValue: number, maxValue: number): number {
  const delta = eq(maxValue - minValue, 0) ? 0.0001 : maxValue - minValue;
  return -1 + ((value - minValue) / delta) * 2;
}

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number): number; commit(): void };

interface BlshVars {
  /** fixnan(plus) / fixnan(minus): the last non-na values */
  lastPlus: number;
  lastMinus: number;
}

interface BlshRun extends BarRunState<BlshVars> {
  atr: ReturnType<typeof taStep.atr>;
  rsi: ReturnType<typeof taStep.rsi>;
  e5: Ma;
  e35: Ma;
  cmoUp: ReturnType<typeof taStep.sum>;
  cmoDown: ReturnType<typeof taStep.sum>;
  fast: Ma;
  slow: Ma;
  signal: ReturnType<typeof taStep.sma>;
  mfi: ReturnType<typeof taStep.mfi>;
  tr: ReturnType<typeof taStep.tr>;
  trRma: Ma;
  plusRma: Ma;
  minusRma: Ma;
  adxRma: Ma;
  ema1: Ma;
  ema2: Ma;
  ema3: Ma;
  slopeEma: Ma;
  smoothed: number[];
  inner: Point[];
  outer: Point[];
}

function study(inputs: Partial<BuyLowSellHighCompositeUpgradedV6Inputs>): BarStudy<BlshRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const innerRed = String(color.new(color.red, 60));
  const innerLime = String(color.new(color.lime, 60));
  return {
    init() {
      const atr = taStep.atr(9);
      const rsi = taStep.rsi(cfg.rsiLength);
      const e5 = taStep.ema(5);
      const e35 = taStep.ema(35);
      const cmoUp = taStep.sum();
      const cmoDown = taStep.sum();
      const fast = taStep.ema(cfg.macdFast);
      const slow = taStep.ema(cfg.macdSlow);
      const signal = taStep.sma();
      const mfi = taStep.mfi(cfg.mfiLength);
      const tr = taStep.tr(false);
      const trRma = taStep.rma(cfg.diLen);
      const plusRma = taStep.rma(cfg.diLen);
      const minusRma = taStep.rma(cfg.diLen);
      const adxRma = taStep.rma(cfg.adxLen);
      const ema1 = taStep.ema(cfg.smoothingLength);
      const ema2 = taStep.ema(cfg.smoothingLength);
      const ema3 = taStep.ema(cfg.smoothingLength);
      const slopeEma = taStep.ema(cfg.slopeSmoothingLen);
      const s: BlshRun = {
        atr, rsi, e5, e35, cmoUp, cmoDown, fast, slow, signal, mfi, tr, trRma, plusRma, minusRma, adxRma, ema1, ema2,
        ema3, slopeEma, smoothed: [], inner: [], outer: [],
        steps: [
          atr, ...(cfg.useRSI ? [rsi] : []), ...(cfg.useEW ? [e5, e35] : []), ...(cfg.useCMO ? [cmoUp, cmoDown] : []),
          ...(cfg.useMACD ? [fast, slow, signal] : []), ...(cfg.useMFI ? [mfi] : []),
          ...(cfg.useADX ? [tr, trRma, plusRma, minusRma, adxRma] : []), ema1, ...(cfg.useTEMA ? [ema2, ema3] : []),
          slopeEma,
        ],
        vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.series = [s.smoothed, s.inner, s.outer];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const prev = i > 0 ? bars[i - 1] : null;
      // atrValue = ta.atr(9); priceRange = 2 * atrValue
      const atr = s.atr.step(b.high, b.low, b.close);
      const priceRange = 2 * atr;

      // RSI
      let rsiN = 0;
      if (cfg.useRSI) rsiN = normalize(s.rsi.step(close), 25, 75);
      // Elliott Wave: ta.ema(close, 5) - ta.ema(close, 35)
      let ewN = 0;
      if (cfg.useEW) ewN = normalize(s.e5.step(close) - s.e35.step(close), -priceRange, priceRange);
      // CMO: mom = ta.change(close), sm1 = math.sum(mom >= 0 ? mom : 0), sm2 = math.sum(mom >= 0 ? 0 : -mom)
      let cmoN = 0;
      if (cfg.useCMO) {
        const mom = prev ? close - prev.close : NaN;
        const sm1 = s.cmoUp.step(mom >= 0 ? mom : 0, cfg.cmoLength);
        const sm2 = s.cmoDown.step(mom >= 0 ? 0 : -mom, cfg.cmoLength);
        cmoN = normalize((100 * (sm1 - sm2)) / (sm1 + sm2), -50, 50);
      }
      // MACD histogram: macd - ta.sma(macd, macdSignalLen)
      let macdN = 0;
      if (cfg.useMACD) {
        const macd = s.fast.step(close) - s.slow.step(close);
        const signal = s.signal.step(macd, cfg.macdSignalLen);
        macdN = normalize(macd - signal, -priceRange, priceRange);
      }
      // MFI of hlc3
      let mfiN = 0;
      if (cfg.useMFI) mfiN = normalize(s.mfi.step((b.high + b.low + b.close) / 3, b.volume ?? NaN), 25, 75);
      // ADX signed by the direction: pdi > mdi ? adx : -adx
      let adxN = 0;
      if (cfg.useADX) {
        const v = s.vars;
        // dirmov(diLen)
        const up = prev ? b.high - prev.high : NaN; // ta.change(high)
        const down = prev ? -(b.low - prev.low) : NaN; // -ta.change(low)
        const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
        const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
        const truerange = s.trRma.step(s.tr.step(b.high, b.low, b.close));
        const plusRma = s.plusRma.step(plusDM);
        const minusRma = s.minusRma.step(minusDM);
        // plain divisions: x / 0 is +-infinity (kept by fixnan), 0 / 0 is na (replaced by fixnan)
        let plus = (100 * plusRma) / truerange;
        let minus = (100 * minusRma) / truerange;
        if (Number.isNaN(plus)) plus = v.lastPlus;
        else v.lastPlus = plus;
        if (Number.isNaN(minus)) minus = v.lastMinus;
        else v.lastMinus = minus;
        // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxLen)
        const sum = plus + minus;
        const ratio = Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum);
        const adx = 100 * s.adxRma.step(ratio);
        adxN = normalize(gt(plus, minus) ? adx : -adx, -50, 50);
      }

      // Composite (Pine addition order)
      const compositeNormalized = normalize(ewN + rsiN + macdN + mfiN + cmoN + adxN, -4, 4);
      let smoothed: number;
      if (cfg.useTEMA) {
        const step1 = s.ema1.step(compositeNormalized);
        const step2 = s.ema2.step(step1);
        const step3 = s.ema3.step(step2);
        smoothed = step1 * 3 - step2 * 3 + step3;
      } else {
        smoothed = s.ema1.step(compositeNormalized);
      }
      s.smoothed[i] = smoothed;

      // slope = smoothed - smoothed[1]; slopeSmoothed = ta.ema(slope, slopeSmoothingLen)
      const slope = i > 0 ? smoothed - s.smoothed[i - 1] : NaN;
      const slopeSmoothed = s.slopeEma.step(slope);

      const t = b.time;
      const val = Number.isFinite(smoothed) ? smoothed : NaN;
      // compositeColor = smoothed <= 0 ? color.red : color.lime
      s.inner[i] = { time: t, value: val, color: le(smoothed, 0) ? innerRed : innerLime };
      const isUptrend = gt(slopeSmoothed, cfg.slopeThreshold);
      const isDowntrend = gt(-cfg.slopeThreshold, slopeSmoothed);
      s.outer[i] = { time: t, value: val, color: isUptrend ? color.lime : isDowntrend ? color.red : color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.inner.slice(), plot1: s.outer.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyLowSellHighCompositeUpgradedV6Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyLowSellHighCompositeUpgradedV6Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}
export const BuyLowSellHighCompositeUpgradedV6 = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
