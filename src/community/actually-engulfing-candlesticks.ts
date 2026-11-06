/**
 * Actually Engulfing Candlesticks
 *
 * Bullish engulfing: volume above its SMA, the previous low is the lowest low of the last `reversalLookback` bars
 * before the current bar, the close is above the highest high of the last `engulfingLookback` bars before the current
 * bar, and the RSI is below 50 and above its own SMA. Bearish engulfing is the mirror (previous high is the highest
 * high, close below the lowest low, RSI above 50 and below its SMA). Lime circles below the bar mark bullish
 * signals, fuchsia circles above the bar mark bearish signals.
 *
 * Alerts (alert() calls, `alertCalls` of the result): "Bullish Engulfing" on each bullish bar and "Bearish Engulfing"
 * on each bearish bar, once per bar close.
 *
 * Reference: "Actually Engulfing Candlesticks" by llbot
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © llbot
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface ActuallyEngulfingCandlesticksInputs {
  reversalLookback: number;
  engulfingLookback: number;
  rsiLookback: number;
  useBullishEngulfing: boolean;
  useBearishEngulfing: boolean;
}

export const defaultInputs: ActuallyEngulfingCandlesticksInputs = {
  reversalLookback: 5,
  engulfingLookback: 2,
  rsiLookback: 14,
  useBullishEngulfing: true,
  useBearishEngulfing: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'reversalLookback', type: 'int', title: 'Reversal Lookback', defval: 5 },
  { id: 'engulfingLookback', type: 'int', title: 'Engulfing Lookback', defval: 2 },
  { id: 'rsiLookback', type: 'int', title: 'RSI Lookback', defval: 14 },
  { id: 'useBullishEngulfing', type: 'bool', title: 'Bullish Engulfing', defval: true },
  { id: 'useBearishEngulfing', type: 'bool', title: 'Bearish Engulfing', defval: true },
];

// Only markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Actually Engulfing Candlesticks',
  shortTitle: 'Actually Engulfing Candlesticks',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface EngulfingRun extends BarRunState<Record<string, never>> {
  volumeAverage: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiAverage: WindowSma;
  reversalLow: WindowExtreme;
  engulfingHigh: WindowExtreme;
  reversalHigh: WindowExtreme;
  engulfingLow: WindowExtreme;
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<ActuallyEngulfingCandlesticksInputs>): BarStudy<EngulfingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // in the order of the ta calls (the same first runtime error)
      const volumeAverage = new WindowSma(cfg.reversalLookback);
      const rsi = taStep.rsi(cfg.rsiLookback);
      const rsiAverage = new WindowSma(cfg.rsiLookback);
      const reversalLow = new WindowExtreme(true, cfg.reversalLookback);
      const engulfingHigh = new WindowExtreme(false, cfg.engulfingLookback);
      const reversalHigh = new WindowExtreme(false, cfg.reversalLookback);
      const engulfingLow = new WindowExtreme(true, cfg.engulfingLookback);
      const s: EngulfingRun = {
        volumeAverage, rsi, rsiAverage, reversalLow, engulfingHigh, reversalHigh, engulfingLow,
        markers: [], alertCalls: [],
        steps: [volumeAverage, rsi, rsiAverage, reversalLow, engulfingHigh, reversalHigh, engulfingLow],
        vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const low1 = i > 0 ? bars[i - 1].low : NaN;
      const high1 = i > 0 ? bars[i - 1].high : NaN;
      const volumeAverage = s.volumeAverage.step(volume);
      const rsi = s.rsi.step(b.close);
      const rsiAverage = s.rsiAverage.step(rsi);
      const reversalLow = s.reversalLow.step(low1);
      const engulfingHigh = s.engulfingHigh.step(high1);
      const reversalHigh = s.reversalHigh.step(high1);
      const engulfingLow = s.engulfingLow.step(low1);

      const close = b.close;
      const bullishEngulfing = gt(volume, volumeAverage) && eq(reversalLow, low1)
        && gt(close, engulfingHigh) && lt(rsi, 50) && gt(rsi, rsiAverage);
      const bearishEngulfing = gt(volume, volumeAverage) && eq(reversalHigh, high1)
        && lt(close, engulfingLow) && gt(rsi, 50) && lt(rsi, rsiAverage);
      const bullish = cfg.useBullishEngulfing && bullishEngulfing;
      const bearish = cfg.useBearishEngulfing && bearishEngulfing;
      // plotshape(bullish, 'Bullish Engulfing', shape.circle, location.belowbar, color.lime, size = size.tiny)
      if (bullish) s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: color.lime, size: 'tiny' });
      // plotshape(bearish, 'Bearish Engulfing', shape.circle, location.abovebar, color.fuchsia, size = size.tiny)
      if (bearish) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: color.fuchsia, size: 'tiny' });
      // if bullish: alert('Bullish Engulfing', alert.freq_once_per_bar_close); if bearish: alert('Bearish Engulfing', ...)
      if (bullish) s.alertCalls.push({ time: b.time, message: 'Bullish Engulfing', freq: 'once_per_bar_close' });
      if (bearish) s.alertCalls.push({ time: b.time, message: 'Bearish Engulfing', freq: 'once_per_bar_close' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ActuallyEngulfingCandlesticksInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ActuallyEngulfingCandlesticksInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const hasAlertFunction = true;

export const ActuallyEngulfingCandlesticks = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
