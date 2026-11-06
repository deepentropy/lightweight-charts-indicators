/**
 * Rhokeo-VW-RSI Histogram
 *
 * Volume-weighted RSI: the change of the source times the volume is split into gains and losses, both smoothed with
 * an RMA; rs = avgGain / avgLoss (999999 when avgLoss is 0), RSI = 100 - 100 / (1 + rs). The RSI is normalized to
 * -1..+1 ((RSI - 50) / 50), smoothed with a moving average (SMA / EMA / RMA / WMA / VWMA) and clamped to -1..+1.
 * The histogram has four colour zones (above the OB level, above 0, above the OS level, below it); the zero line is
 * green above 0 and red below. Shaded zones from +0.7 to +1 and from -0.7 to -1, dashed lines at +0.4 / -0.4.
 *
 * Reference: "Rhokeo-VW-RSI Histogram" by nabil007
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type RhokeoMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface RhokeoVwRsiHistogramInputs {
  /** RSI price source */
  rsiPrice: SourceType;
  rsiLength: number;
  /** Moving average of the normalized VW-RSI */
  rsiMaType: RhokeoMaType;
  rsiMaLength: number;
  /** Overbought shading level (shaded from this level to +1) */
  obLevel: number;
  /** Oversold shading level (shaded from this level to -1) */
  osLevel: number;
  vwrsiObLevel: number;
  vwrsiOsLevel: number;
  histColorAboveOb: string;
  histColorAboveZero: string;
  histColorBelowZero: string;
  histColorBelowOs: string;
  zeroUpColor: string;
  zeroDnColor: string;
  obShadeColor: string;
  osShadeColor: string;
  ceilingFloorColor: string;
  obLineColor: string;
  osLineColor: string;
}

export const defaultInputs: RhokeoVwRsiHistogramInputs = {
  rsiPrice: 'ohlc4',
  rsiLength: 9,
  rsiMaType: 'EMA',
  rsiMaLength: 14,
  obLevel: 0.7,
  osLevel: -0.7,
  vwrsiObLevel: 0.4,
  vwrsiOsLevel: -0.4,
  histColorAboveOb: color.aqua,
  histColorAboveZero: color.blue,
  histColorBelowZero: color.maroon,
  histColorBelowOs: color.red,
  zeroUpColor: String(color.new(color.lime, 0)),
  zeroDnColor: String(color.new(color.red, 0)),
  obShadeColor: String(color.new(color.red, 85)),
  osShadeColor: String(color.new(color.green, 85)),
  ceilingFloorColor: String(color.new(color.gray, 85)),
  obLineColor: String(color.new(color.red, 70)),
  osLineColor: String(color.new(color.lime, 70)),
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiPrice', type: 'source', title: 'RSI Price Source', defval: 'ohlc4', group: 'VW-RSI Settings' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 9, min: 1, group: 'VW-RSI Settings' },
  { id: 'rsiMaType', type: 'string', title: 'RSI MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'VW-RSI Settings' },
  { id: 'rsiMaLength', type: 'int', title: 'RSI MA Length', defval: 14, min: 1, group: 'VW-RSI Settings' },
  { id: 'obLevel', type: 'float', title: 'Overbought Shading Level', defval: 0.7, min: 0.1, max: 0.99, group: 'Level Settings' },
  { id: 'osLevel', type: 'float', title: 'Oversold Shading Level', defval: -0.7, min: -0.99, max: -0.1, group: 'Level Settings' },
  { id: 'vwrsiObLevel', type: 'float', title: 'VW-RSI OB Level', defval: 0.4, min: 0.1, max: 0.99, group: 'Level Settings' },
  { id: 'vwrsiOsLevel', type: 'float', title: 'VW-RSI OS Level', defval: -0.4, min: -0.99, max: -0.1, group: 'Level Settings' },
  { id: 'histColorAboveOb', type: 'color', title: 'Above OB (Strong Bull)', defval: color.aqua, group: 'Histogram Colors' },
  { id: 'histColorAboveZero', type: 'color', title: 'Above Zero (Weak Bull)', defval: color.blue, group: 'Histogram Colors' },
  { id: 'histColorBelowZero', type: 'color', title: 'Below Zero (Weak Bear)', defval: color.maroon, group: 'Histogram Colors' },
  { id: 'histColorBelowOs', type: 'color', title: 'Below OS (Strong Bear)', defval: color.red, group: 'Histogram Colors' },
  { id: 'zeroUpColor', type: 'color', title: 'Zero Line Bull Color', defval: defaultInputs.zeroUpColor, group: 'Lines & Shading' },
  { id: 'zeroDnColor', type: 'color', title: 'Zero Line Bear Color', defval: defaultInputs.zeroDnColor, group: 'Lines & Shading' },
  { id: 'obShadeColor', type: 'color', title: 'OB Shading Color', defval: defaultInputs.obShadeColor, group: 'Lines & Shading' },
  { id: 'osShadeColor', type: 'color', title: 'OS Shading Color', defval: defaultInputs.osShadeColor, group: 'Lines & Shading' },
  { id: 'ceilingFloorColor', type: 'color', title: 'Ceiling/Floor Color', defval: defaultInputs.ceilingFloorColor, group: 'Lines & Shading' },
  { id: 'obLineColor', type: 'color', title: 'OB Line Color', defval: defaultInputs.obLineColor, group: 'Lines & Shading' },
  { id: 'osLineColor', type: 'color', title: 'OS Line Color', defval: defaultInputs.osLineColor, group: 'Lines & Shading' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OB Level', color: String(color.new(color.red, 100)), lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Ceiling Shading Edge', color: String(color.new(color.red, 100)), lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'OS Level', color: String(color.new(color.lime, 100)), lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Floor Shading Edge', color: String(color.new(color.lime, 100)), lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Zero Line', color: color.lime, lineWidth: 2 },
  { id: 'plot5', title: 'VW-RSI Histogram', color: color.blue, lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Rhokeo-VW-RSI Histogram',
  shortTitle: 'VW-RSI for Cumulative Delta',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface RhokeoRun extends BarRunState<Record<string, never>> {
  gain: ReturnType<typeof taStep.rma>;
  loss: ReturnType<typeof taStep.rma>;
  ma: { step(v: number, volume: number): number; commit(): void };
  src: number[];
  zero: Point[];
  hist: Point[];
}

function study(inputs: Partial<RhokeoVwRsiHistogramInputs>): BarStudy<RhokeoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiPrice);
  const len = cfg.rsiMaLength;
  const maStep = (): RhokeoRun['ma'] => {
    switch (cfg.rsiMaType) {
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const histColor = (v: number) => (ge(v, cfg.vwrsiObLevel) ? cfg.histColorAboveOb
    : ge(v, 0) ? cfg.histColorAboveZero
      : ge(v, cfg.vwrsiOsLevel) ? cfg.histColorBelowZero
        : cfg.histColorBelowOs);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const redNone = String(color.new(color.red, 100));
  const limeNone = String(color.new(color.lime, 100));
  return {
    fullRunReason: () => (isBarSource(cfg.rsiPrice) ? null : 'source of another study'),
    init() {
      const gain = taStep.rma(cfg.rsiLength);
      const loss = taStep.rma(cfg.rsiLength);
      const ma = maStep();
      const s: RhokeoRun = { gain, loss, ma, src: [], zero: [], hist: [], steps: [gain, loss, ma], vars: {}, lists: [], series: [] };
      s.series = [s.src, s.zero, s.hist];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const src = value(b);
      s.src[i] = src;
      // price_change = src - src[1]; gains / losses times the volume (0.0 when the change is na or not > / < 0)
      const pc = i > 0 ? src - s.src[i - 1] : NaN;
      const vwGain = gt(pc, 0) ? pc * volume : 0.0;
      const vwLoss = lt(pc, 0) ? Math.abs(pc) * volume : 0.0;
      const avgGain = s.gain.step(vwGain);
      const avgLoss = s.loss.step(vwLoss);
      const rs = eq(avgLoss, 0) ? 999999.0 : avgGain / avgLoss;
      const rsi = 100.0 - 100.0 / (1.0 + rs);
      const normalized = (rsi - 50.0) / 50.0;
      const x = s.ma.step(normalized, volume);
      // clamp(x, -1, 1) = x < lo ? lo : x > hi ? hi : x (na stays na)
      const clamped = lt(x, -1.0) ? -1.0 : gt(x, 1.0) ? 1.0 : x;
      s.zero[i] = { time: b.time, value: 0, color: ge(clamped, 0) ? cfg.zeroUpColor : cfg.zeroDnColor };
      s.hist[i] = { time: b.time, value: fin(clamped), color: histColor(clamped) };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: bars.map((b) => ({ time: b.time, value: cfg.obLevel, color: redNone })),
          plot1: bars.map((b) => ({ time: b.time, value: 1.0, color: redNone })),
          plot2: bars.map((b) => ({ time: b.time, value: cfg.osLevel, color: limeNone })),
          plot3: bars.map((b) => ({ time: b.time, value: -1.0, color: limeNone })),
          plot4: s.zero.slice(),
          plot5: s.hist.slice(),
        },
        hlines: [
          { value: 1, options: { title: 'Ceiling', color: cfg.ceilingFloorColor, linestyle: 'dashed' } },
          { value: -1, options: { title: 'Floor', color: cfg.ceilingFloorColor, linestyle: 'dashed' } },
          { value: cfg.vwrsiObLevel, options: { title: 'VW-RSI OB', color: cfg.obLineColor, linestyle: 'dashed' } },
          { value: cfg.vwrsiOsLevel, options: { title: 'VW-RSI OS', color: cfg.osLineColor, linestyle: 'dashed' } },
        ],
        fills: [
          // fill(pOB, pTOP, color = ob_shade_color); fill(pOS, pBOT, color = os_shade_color)
          { plot1: 'plot0', plot2: 'plot1', options: { color: cfg.obShadeColor }, colors: new Array<string>(n).fill(cfg.obShadeColor) },
          { plot1: 'plot2', plot2: 'plot3', options: { color: cfg.osShadeColor }, colors: new Array<string>(n).fill(cfg.osShadeColor) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RhokeoVwRsiHistogramInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RhokeoVwRsiHistogramInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RhokeoVwRsiHistogram = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
