/**
 * Adaptive Nadaraya-Watson (Non Repainting)
 *
 * Endpoint Gaussian kernel regression of the source over the last `lookback` + 1 bars: weights
 * exp(-i^2 / (2 h^2)) for i = 0..lookback. With the adaptive volatility the bandwidth h is the base bandwidth times
 * ATR(20) / SMA(ATR(20), 100), clamped to 0.5..2. Envelopes at the SMA of the absolute error (MAE) times the inner and
 * outer multipliers. The colour is a gradient of the EMA(5) of the slope against 2 standard deviations of the slope.
 * Signals: a rejection of the outer band (high above / low below, close back inside, against the candle direction)
 * with a weakening move while trending; in a range the inner band, with or without the weakening check.
 *
 * Reference: "Adaptive Nadaraya-Watson [Metrify]" by Metrify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @Metrify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveNadarayaWatsonInputs {
  /** Base bandwidth (h) */
  hVal: number;
  /** Lookback window of the kernel regression (and of the MAE) */
  lookback: number;
  /** Bandwidth adapts to volatility */
  useVol: boolean;
  /** Inner band multiplier */
  multIn: number;
  /** Outer band multiplier */
  multOut: number;
  /** Source price */
  src: SourceType;
  /** Range filter: inner band signals need a weakening move */
  filterRng: boolean;
  colBull: string;
  colBear: string;
  colNeut: string;
}

export const defaultInputs: AdaptiveNadarayaWatsonInputs = {
  hVal: 8.0,
  lookback: 50,
  useVol: true,
  multIn: 1.5,
  multOut: 2.8,
  src: 'hlc3',
  filterRng: true,
  colBull: '#00ffaa',
  colBear: '#ff0044',
  colNeut: '#434651',
};

export const inputConfig: InputConfig[] = [
  { id: 'hVal', type: 'float', title: 'Base Bandwidth (h)', defval: 8.0, min: 1.0, group: 'Kernel Physics' },
  { id: 'lookback', type: 'int', title: 'Lookback Window', defval: 50, min: 10, max: 500, group: 'Kernel Physics' },
  { id: 'useVol', type: 'bool', title: 'Enable Adaptive Volatility', defval: true, group: 'Kernel Physics' },
  { id: 'multIn', type: 'float', title: 'Inner Band Multiplier (Balanced)', defval: 1.5, step: 0.1, group: 'Envelope Statistics' },
  { id: 'multOut', type: 'float', title: 'Outer Band Multiplier (Precision)', defval: 2.8, step: 0.1, group: 'Envelope Statistics' },
  { id: 'src', type: 'source', title: 'Source Price', defval: 'hlc3', group: 'Envelope Statistics' },
  { id: 'filterRng', type: 'bool', title: 'Range Filter', defval: true, group: 'Risk Management' },
  { id: 'colBull', type: 'color', title: 'Bullish', defval: '#00ffaa', group: 'Visuals' },
  { id: 'colBear', type: 'color', title: 'Bearish', defval: '#ff0044', group: 'Visuals' },
  { id: 'colNeut', type: 'color', title: 'Neutral/Grey', defval: '#434651', group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fair Value Core', color: '#434651', lineWidth: 2 },
  { id: 'plot1', title: 'Fair Value Glow 1', color: String(color.new('#434651', 50)), lineWidth: 4 },
  { id: 'plot2', title: 'Fair Value Glow 2', color: String(color.new('#434651', 80)), lineWidth: 8 },
  { id: 'plot3', title: 'Fair Value (fill base)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Upper Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot5', title: 'Lower Inner', color: String(color.new('#434651', 80)), lineWidth: 1 },
  { id: 'plot6', title: 'Upper Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
  { id: 'plot7', title: 'Lower Outer', color: String(color.new('#434651', 60)), lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive Nadaraya-Watson [Metrify]',
  shortTitle: 'Adaptive Nadaraya-Watson [Metrify]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AnwVars {
  prevSellOut: boolean;
  prevBuyOut: boolean;
  prevSellIn: boolean;
  prevBuyIn: boolean;
}

interface AnwRun extends BarRunState<AnwVars> {
  volRaw: ReturnType<typeof taStep.atr>;
  volBase: ReturnType<typeof taStep.sma>;
  mae: ReturnType<typeof taStep.sma>;
  velVis: ReturnType<typeof taStep.ema>;
  velStdev: ReturnType<typeof taStep.stdev>;
  src: number[];
  yHat: number[];
  velocity: number[];
  plots: Point[][];
  fill90: string[];
  fill80: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<AdaptiveNadarayaWatsonInputs>): BarStudy<AnwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const L = cfg.lookback;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const withT = (c: string, tr: number) => String(color.new(c, tr));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AnwRun = {
        volRaw: taStep.atr(20), volBase: taStep.sma(), mae: taStep.sma(), velVis: taStep.ema(5), velStdev: taStep.stdev(),
        src: [], yHat: [], velocity: [], plots: Array.from({ length: 8 }, () => []), fill90: [], fill80: [], markers: [],
        steps: [],
        vars: { prevSellOut: false, prevBuyOut: false, prevSellIn: false, prevBuyIn: false },
        lists: [], series: [],
      };
      s.steps = [s.volRaw, s.volBase, s.mae, s.velVis, s.velStdev];
      s.lists = [s.markers];
      s.series = [s.src, s.yHat, s.velocity, ...s.plots, s.fill90, s.fill80];
      return s;
    },
    bar(s, b, bars) {
      const v = s.vars;
      const { high, low, close, open, time } = bars[b];
      const src = s.src;
      src[b] = value(bars[b]);

      // Volatility adjustment
      const volRaw = s.volRaw.step(high, low, close);
      const volBase = s.volBase.step(volRaw, 100);

      // Kernel regression (endpoint estimator)
      // vol_ratio = use_vol ? vol_raw / (vol_base == 0 ? 1 : vol_base) : 1.0 (na == 0 is false: na ratio)
      const volRatio = cfg.useVol ? volRaw / (eq(volBase, 0) ? 1 : volBase) : 1.0;
      // math.max(0.5, math.min(vol_ratio, 2.0)): na stays na
      const volMod = isNaN(volRatio) ? NaN : Math.max(0.5, Math.min(volRatio, 2.0));
      const hEff = cfg.hVal * volMod;
      let num = 0.0;
      let den = 0.0;
      for (let i = 0; i <= L; i++) {
        const w = Math.exp(-Math.pow(i, 2) / (2 * Math.pow(hEff, 2)));
        // src[i] before the first bar is na
        num = num + w * (b - i >= 0 ? src[b - i] : NaN);
        den = den + w;
      }
      const yHat = num / den;
      s.yHat[b] = yHat;

      // Statistical bounds (MAE)
      const mae = s.mae.step(Math.abs(src[b] - yHat), L);
      const upperIn = yHat + mae * cfg.multIn;
      const lowerIn = yHat - mae * cfg.multIn;
      const upperOut = yHat + mae * cfg.multOut;
      const lowerOut = yHat - mae * cfg.multOut;

      // Velocity and acceleration
      const velocity = b > 0 ? yHat - s.yHat[b - 1] : NaN;
      s.velocity[b] = velocity;
      const accel = b > 0 ? velocity - s.velocity[b - 1] : NaN;
      const velVis = s.velVis.step(velocity);
      const velStdev = s.velStdev.step(velocity, 20);

      const velMax = velStdev * 2.0;
      const dynCol = gt(velVis, 0)
        ? String(color.from_gradient(velVis, 0, velMax, cfg.colNeut, cfg.colBull))
        : String(color.from_gradient(velVis, -velMax, 0, cfg.colBear, cfg.colNeut));

      // Signals
      const isTrending = gt(Math.abs(velocity), velStdev * 0.5);
      const bullWeaken = gt(velocity, 0) && lt(accel, 0);
      const bearWeaken = lt(velocity, 0) && gt(accel, 0);
      const sellOut = gt(high, upperOut) && lt(close, upperOut) && lt(close, open);
      const buyOut = lt(low, lowerOut) && gt(close, lowerOut) && gt(close, open);
      const sellIn = gt(high, upperIn) && lt(close, upperIn) && lt(close, open);
      const buyIn = lt(low, lowerIn) && gt(close, lowerIn) && gt(close, open);
      const newSellOut = sellOut && !v.prevSellOut;
      const newBuyOut = buyOut && !v.prevBuyOut;
      const newSellIn = sellIn && !v.prevSellIn;
      const newBuyIn = buyIn && !v.prevBuyIn;
      v.prevSellOut = sellOut;
      v.prevBuyOut = buyOut;
      v.prevSellIn = sellIn;
      v.prevBuyIn = buyIn;

      let signalShort: boolean;
      let signalLong: boolean;
      if (isTrending) {
        signalShort = newSellOut && bullWeaken;
        signalLong = newBuyOut && bearWeaken;
      } else if (cfg.filterRng) {
        signalShort = newSellIn && bullWeaken;
        signalLong = newBuyIn && bearWeaken;
      } else {
        signalShort = newSellIn;
        signalLong = newBuyIn;
      }
      // plotshape(signal_short, 'Short Opportunity', shape.triangledown, location.abovebar, col_bear, size.tiny)
      if (signalShort) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.colBear, text: '', textColor: cfg.colBear, size: 'tiny' });
      }
      if (signalLong) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.colBull, text: '', textColor: cfg.colBull, size: 'tiny' });
      }

      const t = time as number;
      const p = s.plots;
      p[0][b] = { time: t, value: fin(yHat), color: dynCol };
      p[1][b] = { time: t, value: fin(yHat), color: withT(dynCol, 50) };
      p[2][b] = { time: t, value: fin(yHat), color: withT(dynCol, 80) };
      // p_mid = plot(y_hat, display = display.none)
      p[3][b] = { time: t, value: fin(yHat) };
      p[4][b] = { time: t, value: fin(upperIn), color: withT(dynCol, 80) };
      p[5][b] = { time: t, value: fin(lowerIn), color: withT(dynCol, 80) };
      p[6][b] = { time: t, value: fin(upperOut), color: withT(dynCol, 60) };
      p[7][b] = { time: t, value: fin(lowerOut), color: withT(dynCol, 60) };
      s.fill90[b] = withT(dynCol, 90);
      s.fill80[b] = withT(dynCol, 80);
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(),
          plot4: p[4].slice(), plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(),
        },
        fills: [
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bull Zone' }, colors: s.fill90.slice() },
          { plot1: 'plot3', plot2: 'plot5', options: { title: 'Bear Zone' }, colors: s.fill90.slice() },
          { plot1: 'plot4', plot2: 'plot6', options: { title: 'Bull Extreme' }, colors: s.fill80.slice() },
          { plot1: 'plot5', plot2: 'plot7', options: { title: 'Bear Extreme' }, colors: s.fill80.slice() },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveNadarayaWatsonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveNadarayaWatsonInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveNadarayaWatson = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
