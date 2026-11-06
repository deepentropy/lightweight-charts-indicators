/**
 * MAD Trend Detector
 *
 * Bands around a moving average (EMA or SMA of the source) with the mean absolute deviation from the median:
 * med = median(src, MAD length), mad = sma(|src - med|, MAD length) * multiplier; upper = ma + mad * upper strength,
 * lower = ma - mad * lower strength. A close above the upper band sets the trend up (blue candles), a close below the
 * lower band sets it down (red candles); no colour before the first signal. The candles are drawn in the indicator
 * pane and on the price pane.
 *
 * Reference: "MAD Trend Detector ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MadTrendDetectorInputs {
  src: SourceType;
  /** MA length */
  maLength: number;
  /** Length of the median and of the mean absolute deviation */
  madLength: number;
  madMultiplier: number;
  /** Upper Band Strength */
  upperDeviation: number;
  /** Lower Band Strength */
  lowerDeviation: number;
  maType: 'EMA' | 'SMA';
}

export const defaultInputs: MadTrendDetectorInputs = {
  src: 'close',
  maLength: 8,
  madLength: 20,
  madMultiplier: 0.9,
  upperDeviation: 1.0,
  lowerDeviation: 1.0,
  maType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 8, min: 1 },
  { id: 'madLength', type: 'int', title: 'MAD Length', defval: 20, min: 1 },
  { id: 'madMultiplier', type: 'float', title: 'MAD Multiplier', defval: 0.9, min: 0.1, step: 0.1 },
  { id: 'upperDeviation', type: 'float', title: 'Upper Band Strength', defval: 1.0, min: 0.1, max: 10, step: 0.02 },
  { id: 'lowerDeviation', type: 'float', title: 'Lower Band Strength', defval: 1.0, min: 0.1, max: 10, step: 0.02 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'MAD Trend Detector ~ C H I P A',
  shortTitle: 'MAD Trend Detector ~ C H I P A',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface MadRun extends BarRunState<{ signal: number }> {
  ma: { step(v: number): number; commit(): void };
  med: ReturnType<typeof taStep.median>;
  mad: WindowSma;
  pane: PlotCandleData[];
  overlay: PlotCandleData[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
}

function study(inputs: Partial<MadTrendDetectorInputs>): BarStudy<MadRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const up = String(color.rgb(0, 180, 255));
  const down = String(color.rgb(255, 80, 60));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // ma = ma_type == "EMA" ? ta.ema(src, ma_length) : ta.sma(src, ma_length) (the input is constant: one branch on
      // every bar)
      const ma = cfg.maType === 'EMA' ? taStep.ema(cfg.maLength) : new WindowSma(cfg.maLength);
      const med = taStep.median(cfg.madLength);
      const mad = new WindowSma(cfg.madLength);
      const s: MadRun = {
        ma, med, mad, pane: [], overlay: [], plot0: [], plot1: [],
        steps: [ma, med, mad], vars: { signal: 0 }, lists: [], series: [],
      };
      s.series = [s.pane, s.overlay, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      const ma = s.ma.step(src);
      const med = s.med.step(src);
      const mad = s.mad.step(Math.abs(src - med));
      const madScaled = mad * cfg.madMultiplier;
      const upper = ma + madScaled * cfg.upperDeviation;
      const lower = ma - madScaled * cfg.lowerDeviation;
      // var int signal = 0
      if (gt(b.close, upper)) s.vars.signal = 1;
      if (gt(lower, b.close)) s.vars.signal = -1;
      const signal = s.vars.signal;
      s.plot0[i] = { time: b.time as number, value: upper };
      s.plot1[i] = { time: b.time as number, value: lower };
      // coloring = signal == 1 ? rgb(0, 180, 255) : signal == -1 ? rgb(255, 80, 60) : na
      const c = signal === 1 ? up : signal === -1 ? down : 'transparent';
      const candle = { time: b.time as number, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
      s.pane[i] = candle;
      // the second plotcandle has force_overlay = true
      s.overlay[i] = { ...candle, forceOverlay: true };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: [],
        plotCandles: { barColoring: s.pane.slice(), barColoringOverlay: s.overlay.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MadTrendDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MadTrendDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MadTrendDetector = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
