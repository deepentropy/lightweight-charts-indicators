/**
 * Dynamic Volume Profile Oscillator | AlphaAlgos
 *
 * Every `profilePeriods` bars the last `lookback` prices and volumes are stored as a profile; on each bar the
 * volume-weighted mean price (VWAP) of that profile and the volume-weighted mean absolute deviation give the
 * mean-reversion oscillator 50 + (price - VWAP) / (deviation * sensitivity) * 25 (or, without mean reversion, the
 * SMA of the volume normalised between its lowest and highest value). It is smoothed with an EMA, with an adaptive
 * midline (SMA), zones at the midline +/- stdev * zone width drawn as gradients, fast / slow EMA signals, and bar
 * colours by direction.
 *
 * Reference: "Dynamic Volume Profile Oscillator | AlphaAlgos" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicVolumeProfileOscillatorInputs {
  priceSrc: SourceType;
  /** Volume source (Pine input.source, default volume) */
  volumeSrc: SourceType | 'volume';
  lookback: number;
  profilePeriods: number;
  smoothing: number;
  sensitivity: number;
  meanReversion: boolean;
  useAdaptiveMidline: boolean;
  midlinePeriod: number;
  zoneWidth: number;
  colorBars: boolean;
}

export const defaultInputs: DynamicVolumeProfileOscillatorInputs = {
  priceSrc: 'close',
  volumeSrc: 'volume',
  lookback: 50,
  profilePeriods: 10,
  smoothing: 5,
  sensitivity: 1.0,
  meanReversion: true,
  useAdaptiveMidline: true,
  midlinePeriod: 50,
  zoneWidth: 1.5,
  colorBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'priceSrc', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'volumeSrc', type: 'source', title: 'Volume Source', defval: 'volume',
    options: ['volume', 'open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'] },
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 50, min: 10 },
  { id: 'profilePeriods', type: 'int', title: 'Profile Calculation Periods', defval: 10, min: 5, max: 100 },
  { id: 'smoothing', type: 'int', title: 'Smoothing Length', defval: 5, min: 1, max: 50 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity', defval: 1.0, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'meanReversion', type: 'bool', title: 'Mean Reversion Mode', defval: true },
  { id: 'useAdaptiveMidline', type: 'bool', title: 'Use Adaptive Midline', defval: true },
  { id: 'midlinePeriod', type: 'int', title: 'Adaptive Midline Period', defval: 50, min: 10, max: 200 },
  { id: 'zoneWidth', type: 'float', title: 'Zone Width Multiplier', defval: 1.5, min: 0.5, max: 3.0, step: 0.1 },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
];

const BULL = 'rgb(0, 241, 255)';
const BEAR = 'rgb(255, 1, 154)';
/** Transparencies of the gradient lines 2..10 (and of the fills that end on them); the last fill uses 99 */
const GRAD_TRANSP = [70, 75, 80, 83, 86, 89, 92, 95, 98];
const c = (col: string, transp: number) => String(color.new(col, transp));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Profile Oscillator', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Fast Signal', color: BULL, lineWidth: 1 },
  { id: 'plot2', title: 'Slow Signal', color: BULL, lineWidth: 1 },
  { id: 'plot3', title: 'Adaptive Midline', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'Upper Zone', color: c(BEAR, 0), lineWidth: 1 },
  ...GRAD_TRANSP.map((tr, k) => ({ id: `plot${5 + k}`, title: `UG${k + 2}`, color: c(BEAR, tr), lineWidth: 1 })),
  { id: 'plot14', title: 'Lower Zone', color: c(BULL, 0), lineWidth: 1 },
  ...GRAD_TRANSP.map((tr, k) => ({ id: `plot${15 + k}`, title: `LG${k + 2}`, color: c(BULL, tr), lineWidth: 1 })),
];

export const metadata = {
  title: 'Dynamic Volume Profile Oscillator | AlphaAlgos',
  shortTitle: 'Dynamic Volume Profile Oscillator',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface DvpoVars {
  /** calculate_volume_profile(): var arrays (replaced when refreshed, never changed in place) */
  prices: number[];
  profile: number[];
}

interface DvpoRun extends BarRunState<DvpoVars> {
  svSma: ReturnType<typeof taStep.sma>;
  lo: ReturnType<typeof taStep.lowest>;
  hi: ReturnType<typeof taStep.highest>;
  oscEma: ReturnType<typeof taStep.ema>;
  midSma: ReturnType<typeof taStep.sma>;
  sdStdev: ReturnType<typeof taStep.stdev>;
  fastEma: ReturnType<typeof taStep.ema>;
  slowEma: ReturnType<typeof taStep.ema>;
  plotData: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<DynamicVolumeProfileOscillatorInputs>): BarStudy<DvpoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const priceOf = barSource(cfg.priceSrc);
  const volOf = cfg.volumeSrc === 'volume' ? (b: Bar) => b.volume ?? NaN : barSource(cfg.volumeSrc);
  return {
    fullRunReason: () => (isBarSource(cfg.priceSrc) && isBarSource(cfg.volumeSrc) ? null : 'source of another study'),
    init() {
      const svSma = taStep.sma();
      const lo = taStep.lowest();
      const hi = taStep.highest();
      const oscEma = taStep.ema(cfg.smoothing);
      const midSma = taStep.sma();
      const sdStdev = taStep.stdev();
      const fastEma = taStep.ema(5);
      const slowEma = taStep.ema(15);
      const s: DvpoRun = {
        svSma, lo, hi, oscEma, midSma, sdStdev, fastEma, slowEma,
        plotData: Array.from({ length: 24 }, () => []), barColors: [],
        steps: [...(cfg.meanReversion ? [] : [svSma, lo, hi]), oscEma, ...(cfg.useAdaptiveMidline ? [midSma] : []), sdStdev, fastEma, slowEma],
        vars: { prices: [], profile: [] }, lists: [], series: [],
      };
      s.series = [...s.plotData, ...(cfg.colorBars ? [s.barColors] : [])];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const p = priceOf(b) ?? NaN;
      const v = s.vars;
      // calculate_volume_profile(): var arrays refreshed when empty or on bar_index % profile_periods == 0
      if (v.profile.length === 0 || i % cfg.profilePeriods === 0) {
        const prices: number[] = [];
        const profile: number[] = [];
        for (let k = 0; k <= Math.min(cfg.lookback - 1, i); k++) {
          prices.push(priceOf(bars[i - k]) ?? NaN);
          profile.push(volOf(bars[i - k]) ?? NaN);
        }
        v.prices = prices;
        v.profile = profile;
      }
      const { prices, profile } = v;
      const sumVol = profile.reduce((a, x) => a + x, 0);
      let vwap: number;
      let dev: number;
      if (sumVol > 0) {
        let spv = 0;
        for (let k = 0; k < prices.length; k++) spv += prices[k] * profile[k];
        const vw = spv / sumVol;
        let sd = 0;
        for (let k = 0; k < prices.length; k++) sd += Math.abs(prices[k] - vw) * (profile[k] / sumVol);
        vwap = vw;
        dev = sd;
      } else {
        vwap = p;
        dev = 0;
      }

      let raw: number;
      if (cfg.meanReversion) {
        // A deviation of 0 (profile of one bar) gives +-Infinity in Pine (0 / 0: NaN). The value only feeds ta.ema,
        // which skips an infinite value as na, so NaN gives the same result.
        const d = dev * cfg.sensitivity;
        raw = d === 0 ? NaN : 50 + ((p - vwap) / d) * 25;
      } else {
        // normalize(sma(volume), lowest(sma(volume), lookback), highest(sma(volume), lookback))
        const sv = s.svSma.step(volOf(b) ?? NaN, cfg.smoothing) ?? NaN;
        const lo = s.lo.step(sv, cfg.lookback) ?? NaN;
        const hi = s.hi.step(sv, cfg.lookback) ?? NaN;
        const range = hi - lo;
        raw = range <= 0 ? 50 : Math.min(100, Math.max(0, ((sv - lo) / range) * 100));
      }
      const osc = s.oscEma.step(raw) ?? NaN;
      const mid = cfg.useAdaptiveMidline ? s.midSma.step(osc, cfg.midlinePeriod) ?? NaN : 50;
      const sd = (s.sdStdev.step(osc, cfg.midlinePeriod) ?? NaN) * cfg.zoneWidth;
      const fast = s.fastEma.step(osc) ?? NaN;
      const slow = s.slowEma.step(osc) ?? NaN;

      const plots = s.plotData;
      const bullish = osc > mid || fast > slow;
      const main = bullish ? BULL : BEAR;
      plots[0][i] = { time: t, value: osc, color: main };
      plots[1][i] = { time: t, value: fast, color: c(main, 40) };
      plots[2][i] = { time: t, value: slow, color: c(main, 70) };
      plots[3][i] = { time: t, value: mid };
      const upper = mid + sd;
      const lower = mid - sd;
      const upStep = (upper - mid) / 10;
      const loStep = (mid - lower) / 10;
      plots[4][i] = { time: t, value: upper };
      plots[14][i] = { time: t, value: lower };
      for (let k = 1; k <= 9; k++) {
        plots[4 + k][i] = { time: t, value: upper - upStep * k };
        plots[14 + k][i] = { time: t, value: lower + loStep * k };
      }
      if (cfg.colorBars) s.barColors[i] = { time: t, color: main };
    },
    copyVars: (v) => ({ ...v }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 24; k++) plots[`plot${k}`] = s.plotData[k].slice();

      // fill(gradK, gradK+1, color.new(zone colour, transparency of gradK+1)); fill(grad10, mid_line, transparency 99)
      const fills: IndicatorResult['fills'] = [];
      for (const [first, col] of [[4, BEAR], [14, BULL]] as const) {
        for (let k = 0; k < 9; k++) {
          fills.push({ plot1: `plot${first + k}`, plot2: `plot${first + k + 1}`, options: { color: c(col, GRAD_TRANSP[k]) } });
        }
        fills.push({ plot1: `plot${first + 9}`, plot2: 'plot3', options: { color: c(col, 99) } });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<DynamicVolumeProfileOscillatorInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicVolumeProfileOscillatorInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicVolumeProfileOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
