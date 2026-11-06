/**
 * RSI Candles
 *
 * Applies RSI individually to open, high, low, close to produce RSI-OHLC values.
 * These can be rendered as candles in an oscillator pane (0-100 scale).
 *
 * Reference: "RSI Chart Bars" by Glaz
 *
 * PineScript display:
 *   plotcandle(rsiOpen, rsiHigh, rsiLow, rsiClose, "RSI", color=col, bordercolor=col, wickcolor=col)
 *   hline(70), hline(50), hline(30)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSICandlesInputs {
  length: number;
}

export const defaultInputs: RSICandlesInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'rsi', title: 'RSI Candles' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, color: '#787B86', linestyle: 'dashed', title: 'Overbought' },
  { id: 'hline_mid', price: 50, color: '#787B86', linestyle: 'dashed', title: 'Middle' },
  { id: 'hline_os', price: 30, color: '#787B86', linestyle: 'dashed', title: 'Oversold' },
];

export const metadata = {
  title: 'RSI Candles',
  shortTitle: 'RSIC',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] };
type Rsi = ReturnType<typeof taStep.rsi>;

interface RsiCandlesRun extends BarRunState<Record<string, never>> {
  rsiOpen: Rsi;
  rsiHigh: Rsi;
  rsiLow: Rsi;
  rsiClose: Rsi;
  candles: PlotCandleData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<RSICandlesInputs>): BarStudy<RsiCandlesRun, Result> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsiOpen = taStep.rsi(length);
      const rsiHigh = taStep.rsi(length);
      const rsiLow = taStep.rsi(length);
      const rsiClose = taStep.rsi(length);
      const s: RsiCandlesRun = {
        rsiOpen, rsiHigh, rsiLow, rsiClose, candles: [], barColors: [],
        steps: [rsiOpen, rsiHigh, rsiLow, rsiClose], vars: {}, lists: [], series: [],
      };
      s.series = [s.candles];
      s.lists = [s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const o = s.rsiOpen.step(b.open);
      const h = s.rsiHigh.step(b.high);
      const l = s.rsiLow.step(b.low);
      const c = s.rsiClose.step(b.close);

      if (o == null || c == null || h == null || l == null) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        const col = c >= o ? '#26A69A' : '#EF5350';
        s.candles[i] = { time, open: o, high: h, low: l, close: c, color: col, borderColor: col, wickColor: col };
      }

      // barcolor: green when RSI close > 70, red when < 30
      if (c != null) {
        if (c > 70) s.barColors.push({ time, color: '#26A69A' });
        else if (c < 30) s.barColors.push({ time, color: '#EF5350' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { rsi: s.candles.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSICandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSICandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSICandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, hlineConfig };
