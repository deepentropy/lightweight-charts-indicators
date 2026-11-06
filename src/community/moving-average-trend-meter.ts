/**
 * Moving Average Trend Meter
 *
 * A baseline moving average is compared with a fast, a medium and a slow moving average (same type and source).
 * Three stacked candle rows (Fast at 2..3, Medium at 1..2, Slow at 0..1) are coloured per bar:
 * - Classic mode: bullish transition when baseline > MA and close < MA, bullish when baseline > MA, bearish
 *   transition when baseline < MA and close > MA, else bearish.
 * - Optimized mode: the same states, but only when the fast, medium and slow MAs are stacked in the same direction
 *   (else gray), and with close compared with the MA of the row.
 * A circle at the top of the pane shows the combined state of all three MAs. A transparent candle (3..4) keeps the
 * space above the rows.
 *
 * Reference: "Moving Average Trend Meter [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © UkutaLabs
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MaTrendMeterSource =
  'Open' | 'Close' | 'High' | 'Low' | '(H+L)/2' | '(H+L+C)/3' | '(O+H+L+C)/4' | '(H+L+C+C)/4';

export interface MovingAverageTrendMeterInputs {
  /** 'Classic' or 'Optimized' */
  displayMode: 'Classic' | 'Optimized';
  /** Price of the moving averages */
  maSource: MaTrendMeterSource;
  /** Moving average type */
  maType: 'EMA' | 'SMA' | 'VWMA' | 'WMA' | 'HMA' | 'RMA';
  /** Baseline MA length */
  source: number;
  /** Fast MA length */
  fast: number;
  /** Medium MA length */
  med: number;
  /** Slow MA length */
  slow: number;
  bullish: string;
  bearish: string;
  bullishTransition: string;
  bearishTransition: string;
}

export const defaultInputs: MovingAverageTrendMeterInputs = {
  displayMode: 'Classic',
  maSource: 'Close',
  maType: 'EMA',
  source: 13,
  fast: 21,
  med: 34,
  slow: 55,
  bullish: color.green,
  bearish: color.red,
  bullishTransition: color.orange,
  bearishTransition: color.purple,
};

export const inputConfig: InputConfig[] = [
  { id: 'displayMode', type: 'string', title: 'Display Mode', defval: 'Classic', options: ['Classic', 'Optimized'], group: 'Configuration' },
  { id: 'maSource', type: 'string', title: 'MA Source', defval: 'Close', options: ['Open', 'Close', 'High', 'Low', '(H+L)/2', '(H+L+C)/3', '(O+H+L+C)/4', '(H+L+C+C)/4'], group: 'Configuration' },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA', 'VWMA', 'WMA', 'HMA', 'RMA'], group: 'Configuration' },
  { id: 'source', type: 'int', title: 'Baseline MA', defval: 13, group: 'Configuration' },
  { id: 'fast', type: 'int', title: 'Fast MA', defval: 21, group: 'Configuration' },
  { id: 'med', type: 'int', title: 'Med MA', defval: 34, group: 'Configuration' },
  { id: 'slow', type: 'int', title: 'Slow MA', defval: 55, group: 'Configuration' },
  { id: 'bullish', type: 'color', title: 'Bullish Color', defval: color.green, group: 'Colors' },
  { id: 'bearish', type: 'color', title: 'Bearish Color', defval: color.red, group: 'Colors' },
  { id: 'bullishTransition', type: 'color', title: 'Bullish Transition Color', defval: color.orange, group: 'Colors' },
  { id: 'bearishTransition', type: 'color', title: 'Bearish Transition Color', defval: color.purple, group: 'Colors' },
];

/** No plot: the outputs are the candle rows and the circle marker */
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'fast', title: 'Fast' },
  { id: 'medium', title: 'Medium' },
  { id: 'slow', title: 'Slow' },
  { id: 'blank', title: 'blank' },
];

export const metadata = {
  title: 'Moving Average Trend Meter [UkutaLabs]',
  shortTitle: 'Moving Average Trend Meter [UkutaLabs]',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;

/** plotcandle without wickcolor / bordercolor: the style defaults of the plotcandle */
const DEFAULT_WICK = '#737375';
const DEFAULT_BORDER = '#000000';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface MatmRun extends BarRunState<Record<string, never>> {
  maBaseline: Ma;
  maSlow: Ma;
  maMed: Ma;
  maFast: Ma;
  fast: PlotCandleData[];
  medium: PlotCandleData[];
  slow: PlotCandleData[];
  blank: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<MovingAverageTrendMeterInputs>): BarStudy<MatmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // GetMASource()
  const srcOf = (b: Bar): number => {
    switch (cfg.maSource) {
      case 'Open': return b.open;
      case 'Close': return b.close;
      case 'High': return b.high;
      case 'Low': return b.low;
      case '(H+L)/2': return (b.high + b.low) / 2;
      case '(H+L+C)/3': return (b.high + b.low + b.close) / 3;
      case '(O+H+L+C)/4': return (b.open + b.high + b.low + b.close) / 4;
      case '(H+L+C+C)/4': return (b.high + b.low + b.close + b.close) / 4;
      default: return b.close;
    }
  };
  const ma = (len: number): Ma => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      default: { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };

  const optimized = cfg.displayMode === 'Optimized';
  const bull = String(color.new(cfg.bullish, 0));
  const bear = String(color.new(cfg.bearish, 0));
  const bullT = String(color.new(cfg.bullishTransition, 0));
  const bearT = String(color.new(cfg.bearishTransition, 0));
  const gray = String(color.new(color.gray, 0));
  const blankColor = String(color.new(color.black, 100));

  return {
    init() {
      const maBaseline = ma(cfg.source);
      const maSlow = ma(cfg.slow);
      const maMed = ma(cfg.med);
      const maFast = ma(cfg.fast);
      const s: MatmRun = {
        maBaseline, maSlow, maMed, maFast, fast: [], medium: [], slow: [], blank: [], markers: [],
        steps: [maBaseline, maSlow, maMed, maFast], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.fast, s.medium, s.slow, s.blank];
      return s;
    },
    bar(st, i, bars) {
      const bar = bars[i];
      const t = bar.time;
      const close = bar.close;
      const src = srcOf(bar);
      const volume = bar.volume ?? NaN;
      const base = st.maBaseline.step(src, volume) ?? NaN;
      const s = st.maSlow.step(src, volume) ?? NaN;
      const m = st.maMed.step(src, volume) ?? NaN;
      const f = st.maFast.step(src, volume) ?? NaN;
      const stackUp = gt(f, m) && gt(m, s);
      const stackDown = lt(f, m) && lt(m, s);

      // Colour of the row of moving average x (FastPlotColor / MediumPlotColor / SlowPlotColor)
      const rowColor = (x: number): string => {
        if (optimized) {
          if (gt(base, x) && gt(close, x) && stackUp) return bull;
          if (lt(base, x) && lt(close, x) && stackDown) return bear;
          if (gt(base, x) && lt(close, x) && stackUp) return bullT;
          if (lt(base, x) && gt(close, x) && stackDown) return bearT;
          return gray;
        }
        if (gt(base, x) && lt(close, x)) return bullT;
        if (gt(base, x)) return bull;
        if (lt(base, x) && gt(close, x)) return bearT;
        return bear;
      };
      const candle = (o: number, h: number, l: number, c: number, col: string): PlotCandleData => ({
        time: t, open: o, high: h, low: l, close: c, color: col, wickColor: DEFAULT_WICK, borderColor: DEFAULT_BORDER,
      });
      // plotcandle(2, 3, 2, 3, "Fast", FastPlotColor); (1, 2, 1, 2) "Medium"; (0, 1, 0, 1) "Slow"
      st.fast[i] = candle(2, 3, 2, 3, rowColor(f));
      st.medium[i] = candle(1, 2, 1, 2, rowColor(m));
      st.slow[i] = candle(0, 1, 0, 1, rowColor(s));
      // plotcandle(3, 4, 3, 4, "blank", color.new(color.black, 100), bordercolor = na)
      st.blank[i] = { time: t, open: 3, high: 4, low: 3, close: 4, color: blankColor, wickColor: DEFAULT_WICK, borderColor: 'transparent' };

      // allGreen() / allRed() / allBullishTrans() / allBearishTrans()
      let allGreen: boolean;
      let allRed: boolean;
      let allBullTrans: boolean;
      let allBearTrans: boolean;
      if (optimized) {
        allGreen = stackUp && gt(base, f) && gt(close, base);
        allRed = stackDown && lt(base, f) && lt(close, base);
        allBullTrans = stackUp && gt(base, f) && lt(close, base);
        allBearTrans = stackDown && lt(base, f) && gt(close, base);
      } else {
        allGreen = gt(base, s) && gt(close, s) && gt(base, m) && gt(close, m) && gt(base, f) && gt(close, f);
        allRed = lt(base, s) && lt(close, s) && lt(base, m) && lt(close, m) && lt(base, f) && lt(close, f);
        allBullTrans = gt(base, s) && lt(close, s) && gt(base, m) && lt(close, m) && gt(base, f) && lt(close, f);
        allBearTrans = lt(base, s) && gt(close, s) && lt(base, m) && gt(close, m) && lt(base, f) && gt(close, f);
      }
      // plotshape(true, "Circle", shape.circle, location.top, size.tiny, color = ...): the colour is
      // color.new(color.black, 100) (nothing drawn) in the Classic mode when no state applies: no marker then
      const circleColor = allGreen ? bull : allBullTrans ? bullT : allRed ? bear : allBearTrans ? bearT
        : optimized ? gray : null;
      if (circleColor !== null) st.markers.push({ time: t, position: 'top', shape: 'circle', color: circleColor, size: 'tiny' });
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: st.markers.slice(),
        plotCandles: { fast: st.fast.slice(), medium: st.medium.slice(), slow: st.slow.slice(), blank: st.blank.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MovingAverageTrendMeterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MovingAverageTrendMeterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MovingAverageTrendMeter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
