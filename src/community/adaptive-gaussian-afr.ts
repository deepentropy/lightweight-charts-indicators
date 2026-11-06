/**
 * Adaptive Gaussian AFR
 *
 * A 4-pole Gaussian filter of hl2 whose length adapts to volatility: length = max(2, round(base length /
 * max(ATR(lookback) / ATR(2 * lookback), 0.5))). A trailing range level (AFR) follows the filter at ATR * factor:
 * while the close is above the previous level it ratchets up to max(filter - ATR * factor, previous level),
 * otherwise it ratchets down to min(filter + ATR * factor, previous level). The level and the price candles are
 * blue when the close is above the previous level and purple otherwise.
 *
 * Reference: "Adaptive Gaussian AFR" by Mattes00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveGaussianAFRInputs {
  /** ATR period of the trailing range */
  atrLen: number;
  /** ATR factor of the trailing range */
  atrMult: number;
  /** Gaussian base length */
  gLen: number;
  /** Adaptive lookback (ATR(lookback) / ATR(2 * lookback)) */
  lookback: number;
}

export const defaultInputs: AdaptiveGaussianAFRInputs = {
  atrLen: 14,
  atrMult: 1.5,
  gLen: 20,
  lookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Period', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Factor', defval: 1.5, step: 0.05 },
  { id: 'gLen', type: 'int', title: 'Gaussian Base Length', defval: 20 },
  { id: 'lookback', type: 'int', title: 'Adaptive Lookback', defval: 10 },
];

const BULL_COL = String(color.rgb(45, 162, 252));
const BEAR_COL = String(color.rgb(113, 59, 249));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive Gaussian AFR', color: BULL_COL, lineWidth: 3 },
  { id: 'plot1', title: 'Gaussian Source', color: String(color.new(BULL_COL, 70)), lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Adaptive Gaussian AFR',
  shortTitle: 'AG-AFR',
  overlay: true,
};

const nz = (v: number) => (isNaN(v) ? 0 : v);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface AgaRun extends BarRunState<{ prevAfr: number }> {
  atrShort: ReturnType<typeof taStep.atr>;
  atrLong: ReturnType<typeof taStep.atr>;
  atrVal: ReturnType<typeof taStep.atr>;
  gSrc: number[];
  plot0: Point[];
  plot1: Point[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<AdaptiveGaussianAFRInputs>): BarStudy<AgaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const root = Math.pow(Math.sqrt(2), 2.0 / 4.0) - 1.0;
  const bullFaded = String(color.new(BULL_COL, 70));
  const bearFaded = String(color.new(BEAR_COL, 70));
  return {
    init() {
      const s: AgaRun = {
        // vol_ratio = ta.atr(lookback) / ta.atr(lookback * 2)
        atrShort: taStep.atr(cfg.lookback), atrLong: taStep.atr(cfg.lookback * 2), atrVal: taStep.atr(cfg.atrLen),
        gSrc: [], plot0: [], plot1: [], candles: [],
        // var float afr_level = 0.0
        steps: [], vars: { prevAfr: 0 }, lists: [], series: [],
      };
      s.steps = [s.atrShort, s.atrLong, s.atrVal];
      s.series = [s.gSrc, s.plot0, s.plot1, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const gSrc = s.gSrc;
      const atrShort = s.atrShort.step(b.high, b.low, b.close);
      const atrLong = s.atrLong.step(b.high, b.low, b.close);
      const atrVal = s.atrVal.step(b.high, b.low, b.close);
      // a plain division: x / 0 is +-infinity (math.max(inf, 0.5) is inf, g_len / inf is 0), 0 / 0 NaN
      const volRatio = atrShort / atrLong;
      // adaptive_len = math.max(2, math.round(g_len / math.max(vol_ratio, 0.5)))
      const adaptiveLen = max(2, Math.round(cfg.gLen / max(volRatio, 0.5)));
      const beta = (1 - Math.cos((2 * Math.PI) / adaptiveLen)) / root;
      const alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
      const g = (k: number) => (i - k >= 0 ? nz(gSrc[i - k]) : 0);
      const hl2 = (b.high + b.low) / 2;
      gSrc[i] = Math.pow(alpha, 4) * hl2
        + 4 * (1 - alpha) * g(1)
        - 6 * Math.pow(1 - alpha, 2) * g(2)
        + 4 * Math.pow(1 - alpha, 3) * g(3)
        - Math.pow(1 - alpha, 4) * g(4);

      const ol = gSrc[i] - atrVal * cfg.atrMult;
      const oh = gSrc[i] + atrVal * cfg.atrMult;
      const last = nz(s.vars.prevAfr);
      // is_bullish = close > nz(afr_level[1])
      const bull = b.close - last > 1e-10;
      const afr = bull ? max(ol, last) : min(oh, last);
      s.vars.prevAfr = afr;

      const col = bull ? BULL_COL : BEAR_COL;
      s.plot0[i] = { time: b.time as number, value: afr, color: col };
      // plot(g_src, "Gaussian Source", color = color.new(syscol, 70), display = display.none)
      s.plot1[i] = { time: b.time as number, value: gSrc[i], color: bull ? bullFaded : bearFaded };
      // plotcandle(open, high, low, close, 'BarColor', color = syscol, bordercolor = syscol, wickcolor = syscol, force_overlay = true)
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: col, borderColor: col, wickColor: col, forceOverlay: true,
      } as PlotCandleData;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        plotCandles: { BarColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveGaussianAFRInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveGaussianAFRInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveGaussianAFR = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
