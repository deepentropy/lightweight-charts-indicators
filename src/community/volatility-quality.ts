/**
 * Volatility Quality [Alpha Extract]
 *
 * Volatility quality index: the true range signed by the candle direction (+1 up, -1 down, 0 doji), smoothed by an
 * EMA of `vqiLen` and an EMA of `vqiSmoothingLen`. Standard deviation bands (1, 2, 3 x the stdev of the smoothed
 * line over `vqiLen`) are drawn around it. The line and the bands are normalised to -100..100 with the highest and
 * the lowest smoothed value over `normalizationLength` bars (when that range is positive). The line is lime at or
 * above 0, red below. Optional candles on the price pane coloured by the sign; overbought / oversold characters when
 * the normalised 3-stdev band reaches +200 / -200.
 *
 * Reference: "Volatility Quality [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityQualityInputs {
  vqiLen: number;
  vqiSmoothingLen: number;
  stdevMultiplier1: number;
  stdevMultiplier2: number;
  stdevMultiplier3: number;
  normalizationLength: number;
  /** Histogram style for the main line (the plot style of the configuration stays a line) */
  displayAsColumns: boolean;
  showCandles: boolean;
}

export const defaultInputs: VolatilityQualityInputs = {
  vqiLen: 14,
  vqiSmoothingLen: 5,
  stdevMultiplier1: 1.0,
  stdevMultiplier2: 2.0,
  stdevMultiplier3: 3.0,
  normalizationLength: 200,
  displayAsColumns: false,
  showCandles: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'vqiLen', type: 'int', title: 'VQI Length', defval: 14 },
  { id: 'vqiSmoothingLen', type: 'int', title: 'VQI Smoothing Length', defval: 5 },
  { id: 'stdevMultiplier1', type: 'float', title: 'Stdev Multiplier #1', defval: 1.0 },
  { id: 'stdevMultiplier2', type: 'float', title: 'Stdev Multiplier #2', defval: 2.0 },
  { id: 'stdevMultiplier3', type: 'float', title: 'Stdev Multiplier #3', defval: 3.0 },
  { id: 'normalizationLength', type: 'int', title: 'Normalization Lookback', defval: 200, min: 50 },
  { id: 'displayAsColumns', type: 'bool', title: 'Display as Columns?', defval: false },
  { id: 'showCandles', type: 'bool', title: 'Show Candles', defval: false },
];

const UP_COL = color.lime;
const DOWN_COL = String(color.rgb(255, 0, 0));
const U1 = String(color.new(color.teal, 0));
const U2 = String(color.new(color.teal, 30));
const U3 = String(color.new(color.teal, 60));
const L1 = String(color.new('#ffffff', 0));
const L2 = String(color.new('#a8a8a8', 30));
const L3 = String(color.new('#353434', 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AVQ', color: UP_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1 stdev', color: U1, lineWidth: 1 },
  { id: 'plot2', title: 'Upper 2 stdev', color: U2, lineWidth: 1 },
  { id: 'plot3', title: 'Upper 3 stdev', color: U3, lineWidth: 1 },
  { id: 'plot4', title: 'Lower 1 stdev', color: L1, lineWidth: 1 },
  { id: 'plot5', title: 'Lower 2 stdev', color: L2, lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3 stdev', color: L3, lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility Quality [Alpha Extract]',
  shortTitle: 'Volatility Quality [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface VqRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  emaRaw: ReturnType<typeof taStep.ema>;
  emaSmooth: ReturnType<typeof taStep.ema>;
  dev: WindowStdev;
  hi: WindowExtreme;
  lo: WindowExtreme;
  plots: Point[][];
  markers: MarkerData[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<VolatilityQualityInputs>): BarStudy<VqRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const normalizeVQI = true;
  const mults = [cfg.stdevMultiplier1, cfg.stdevMultiplier2, cfg.stdevMultiplier3];
  const cols = [U1, U2, U3, L1, L2, L3];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const tr = taStep.tr(false);
      const emaRaw = taStep.ema(cfg.vqiLen);
      const emaSmooth = taStep.ema(cfg.vqiSmoothingLen);
      const dev = new WindowStdev(cfg.vqiLen);
      const hi = new WindowExtreme(false, cfg.normalizationLength);
      const lo = new WindowExtreme(true, cfg.normalizationLength);
      const s: VqRun = {
        tr, emaRaw, emaSmooth, dev, hi, lo, plots: [[], [], [], [], [], [], []], markers: [], candles: [],
        steps: [tr, emaRaw, emaSmooth, dev, hi, lo], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.candles];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // barRange = ta.tr(false); direction = close > open ? 1 : close < open ? -1 : 0
      const barRange = s.tr.step(b.high, b.low, b.close);
      const weightedVol = barRange * (gt(b.close, b.open) ? 1 : gt(b.open, b.close) ? -1 : 0);
      const sm = s.emaSmooth.step(s.emaRaw.step(weightedVol));
      const sd = s.dev.step(sm);
      // `if normalizeVQI` is always true: ta.highest / ta.lowest run on every bar
      const hiV = s.hi.step(sm);
      const loV = s.lo.step(sm);
      const range = hiV - loV;
      // if vqiRange > 0: ((x - vqiLowest) / vqiRange - 0.5) * 200
      const doNorm = normalizeVQI && gt(range, 0);
      const f = (x: number) => (doNorm ? ((x - loV) / range - 0.5) * 200 : x);
      const norm = f(sm);
      const p = s.plots;
      // plot(vqiNormalized, color = vqiNormalized >= 0 ? color.lime : color.rgb(255, 0, 0), linewidth = 2)
      p[0][i] = { time, value: fin(norm), color: ge(norm, 0) ? UP_COL : DOWN_COL };
      let up3 = NaN;
      let lo3 = NaN;
      for (let k = 0; k < 6; k++) {
        const raw = k < 3 ? sm + sd * mults[k] : sm - sd * mults[k - 3];
        const v = f(raw);
        if (k === 2) up3 = v;
        if (k === 5) lo3 = v;
        p[k + 1][i] = { time, value: fin(v), color: cols[k] };
      }

      if (cfg.showCandles) {
        // candle_col = vqiPositive ? color.lime : color.red (vqiNormalized >= 0)
        const c = ge(norm, 0) ? color.lime : color.red;
        s.candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
          borderColor: c, forceOverlay: true });
      }
      // plotchar(overboughtSignal ? high : na, '⌄', location.abovebar, color.red, size.tiny, force_overlay = true)
      if (normalizeVQI && ge(up3, 200)) {
        s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '⌄',
          textColor: color.red, size: 'tiny', forceOverlay: true });
      }
      // plotchar(oversoldSignal ? low : na, '⌃', location.belowbar, color.lime, size.tiny, force_overlay = true)
      if (normalizeVQI && le(lo3, -200)) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '⌃',
          textColor: color.lime, size: 'tiny', forceOverlay: true });
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
          { value: 100, options: { title: '+100', color: String(color.new(color.white, 70)), linestyle: 'dotted' } },
          { value: -100, options: { title: '-100', color: String(color.new(color.white, 70)), linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
        plotCandles: { vqiCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityQualityInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolatilityQualityInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolatilityQuality = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
