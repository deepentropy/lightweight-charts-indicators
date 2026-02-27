/**
 * Candlestick Reversal System
 *
 * Four reversal detection systems with swing high/low trend context:
 * 1. Wick Reversal - wick-to-body ratio detection
 * 2. Extreme Reversal - body size vs historical average
 * 3. Outside Reversal - price breaks previous bar's range
 * 4. Doji Reversal - doji pattern with trend context
 *
 * Uses pivothigh/pivotlow(5,0) for trend direction context.
 * Optional SMA overlay.
 *
 * Reference: TradingView "Candlestick Reversal System" by LonesomeTheBlue (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CandlestickReversalInputs {
  pivotLen: number;
  showMA: boolean;
  maLen: number;
  enableWick: boolean;
  wickMultiplier: number;
  wickBodyPct: number;
  enableExtreme: boolean;
  bodySize: number;
  extremeBarsBack: number;
  bodyMultiplier: number;
  enableOutside: boolean;
  barMultiplier: number;
  outsideBarsBack: number;
  enableDoji: boolean;
  dojiPct: number;
}

export const defaultInputs: CandlestickReversalInputs = {
  pivotLen: 5,
  showMA: false,
  maLen: 10,
  enableWick: true,
  wickMultiplier: 2.5,
  wickBodyPct: 0.25,
  enableExtreme: true,
  bodySize: 0.525,
  extremeBarsBack: 50,
  bodyMultiplier: 2,
  enableOutside: true,
  barMultiplier: 1.25,
  outsideBarsBack: 50,
  enableDoji: true,
  dojiPct: 0.10,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Length to Highest/Lowest', defval: 5, min: 1 },
  { id: 'showMA', type: 'bool', title: 'Show SMA', defval: false },
  { id: 'maLen', type: 'int', title: 'SMA Length', defval: 10, min: 1 },
  { id: 'enableWick', type: 'bool', title: 'Enable Wick Reversal System', defval: true },
  { id: 'wickMultiplier', type: 'float', title: 'Wick Multiplier', defval: 2.5, step: 0.5, max: 20 },
  { id: 'wickBodyPct', type: 'float', title: 'Wick Body Percentage', defval: 0.25, step: 0.1, max: 1 },
  { id: 'enableExtreme', type: 'bool', title: 'Enable Extreme Reversal System', defval: true },
  { id: 'bodySize', type: 'float', title: 'Body Size', defval: 0.525, step: 0.05, max: 1 },
  { id: 'extremeBarsBack', type: 'int', title: 'Extreme Bars Back', defval: 50, max: 50 },
  { id: 'bodyMultiplier', type: 'float', title: 'Body Multiplier', defval: 2, step: 0.25, max: 5 },
  { id: 'enableOutside', type: 'bool', title: 'Enable Outside Reversal System', defval: true },
  { id: 'barMultiplier', type: 'float', title: 'Outside Bar Multiplier', defval: 1.25, step: 0.05, max: 3.5 },
  { id: 'outsideBarsBack', type: 'int', title: 'Outside Bars Back', defval: 50, max: 250 },
  { id: 'enableDoji', type: 'bool', title: 'Enable Doji Reversal System', defval: true },
  { id: 'dojiPct', type: 'float', title: 'Doji Body Percentage', defval: 0.10, step: 0.1, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Candlestick Reversal System',
  shortTitle: 'CdlRev',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CandlestickReversalInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    pivotLen, showMA, maLen,
    enableWick, wickMultiplier, wickBodyPct,
    enableExtreme, bodySize, extremeBarsBack, bodyMultiplier,
    enableOutside, barMultiplier, outsideBarsBack,
    enableDoji, dojiPct,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const markers: MarkerData[] = [];

  // --- Pivot high/low for trend context (left=pivotLen, right=0) ---
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = new Series(bars, (b) => b.close);

  const pivotHighArr = ta.pivothigh(highSeries, pivotLen, 0).toArray();
  const pivotLowArr = ta.pivotlow(lowSeries, pivotLen, 0).toArray();

  // --- Optional SMA ---
  const smaArr = ta.sma(closeSeries, maLen).toArray();

  const plot0 = bars.map((b, i) => ({
    time: b.time,
    value: showMA && smaArr[i] != null ? smaArr[i]! : NaN,
  }));

  // --- SMA for wick system (range average over 50 bars) ---
  const rangeSeries = new Series(bars, (b) => b.high - b.low);
  const rangeAvg50Arr = ta.sma(rangeSeries, 50).toArray();

  // --- Extreme system: body and candle size averages ---
  const bodySizeSeries = new Series(bars, (b) => Math.abs(b.close - b.open));
  const candleSizeSeries = new Series(bars, (b) => b.high - b.low);
  const avgBodyArr = ta.sma(bodySizeSeries, extremeBarsBack).toArray();
  const avgCandleArr = ta.sma(candleSizeSeries, extremeBarsBack).toArray();

  // --- Outside system: candle average ---
  const avgCandleOutsideArr = ta.sma(candleSizeSeries, outsideBarsBack).toArray();

  // --- Doji system: SMA(close, 10) ---
  const sma10Arr = ta.sma(closeSeries, 10).toArray();

  const warmup = Math.max(pivotLen, extremeBarsBack, outsideBarsBack, 50, 10);

  for (let i = warmup; i < n; i++) {
    const O = bars[i].open;
    const C = bars[i].close;
    const H = bars[i].high;
    const L = bars[i].low;
    const time = bars[i].time as number;

    const highleftempty = pivotHighArr[i] != null && !isNaN(pivotHighArr[i]!);
    const lowleftempty = pivotLowArr[i] != null && !isNaN(pivotLowArr[i]!);

    // --- Wick Reversal System ---
    let Wlongsignal = false;
    let Wshortsignal = false;

    if (enableWick) {
      const rangeAvg = rangeAvg50Arr[i];
      const hl = H - L;

      Wlongsignal =
        ((C > O) && (O - L) >= ((C - O) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
        ((C < O) && (C - L) >= ((O - C) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
        ((C === O && C !== H) && hl >= ((H - C) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
        ((O === H && C === H) && rangeAvg != null && hl >= rangeAvg);

      Wshortsignal =
        ((C < O) && (H - O) >= ((O - C) * wickMultiplier) && (C - L) <= (hl * wickBodyPct)) ||
        ((C > O) && (H - C) >= ((C - O) * wickMultiplier) && (C - L) <= (hl * wickBodyPct)) ||
        ((C === O && C !== L) && hl >= ((C - L) * wickMultiplier) && (C - L) <= (hl * wickBodyPct)) ||
        ((O === L && C === L) && rangeAvg != null && hl >= rangeAvg);
    }

    // --- Extreme Reversal System ---
    let Elongsignal = false;
    let Eshortsignal = false;

    if (enableExtreme && i >= 1) {
      const O1 = bars[i - 1].open;
      const C1 = bars[i - 1].close;
      const H1 = bars[i - 1].high;
      const L1 = bars[i - 1].low;
      const avgBody = avgBodyArr[i];
      const avgCandle = avgCandleArr[i];

      if (avgBody != null && avgCandle != null) {
        // Previous bar bearish with large body => current bar bullish = long
        Elongsignal = (O1 - C1) >= (bodySize * (H1 - L1)) &&
          (H1 - L1) > (avgCandle * bodyMultiplier) &&
          (O1 - C1) > avgBody &&
          C > O;

        // Previous bar bullish with large body => current bar bearish = short
        Eshortsignal = (C1 - O1) >= (bodySize * (H1 - L1)) &&
          (H1 - L1) > (avgCandle * bodyMultiplier) &&
          (C1 - O1) > avgBody &&
          O > C;
      }
    }

    // --- Outside Reversal System ---
    let Olongsignal = false;
    let Oshortsignal = false;

    if (enableOutside && i >= 1) {
      const H1 = bars[i - 1].high;
      const L1 = bars[i - 1].low;
      const avgCandle1 = avgCandleOutsideArr[i];

      if (avgCandle1 != null) {
        Olongsignal = L < L1 && C > H1 && (H - L) >= avgCandle1 * barMultiplier;
        Oshortsignal = H > H1 && C < L1 && (H - L) >= avgCandle1 * barMultiplier;
      }
    }

    // --- Doji Reversal System ---
    let Dlongsignal = false;
    let Dshortsignal = false;

    if (enableDoji && i >= 2) {
      const H1 = bars[i - 1].high;
      const L1 = bars[i - 1].low;
      const O1 = bars[i - 1].open;
      const C1 = bars[i - 1].close;
      const H2 = bars[i - 2].high;
      const L2 = bars[i - 2].low;
      const C1_val = bars[i - 1].close;
      const frangehl = H1 - L1;
      const frangeco = Math.abs(C1 - O1);
      const sma10 = sma10Arr[i];

      if (sma10 != null) {
        Dshortsignal =
          (frangeco <= frangehl * dojiPct && C < L1 && L1 > sma10 && C < O) ||
          (C < L2 && C1_val >= L2 && frangeco <= frangeco * dojiPct && C < O && L2 > sma10);

        Dlongsignal =
          (frangeco <= frangehl * dojiPct && C > H1 && H1 < sma10 && C > O) ||
          (C > H2 && C1_val <= H2 && frangeco <= frangeco * dojiPct && C > O && H2 < sma10);
      }
    }

    // --- Combined signals with pivot context ---
    const longsignal = lowleftempty && (
      (enableWick && Wlongsignal) ||
      (enableExtreme && Elongsignal) ||
      (enableOutside && Olongsignal) ||
      (enableDoji && Dlongsignal)
    );

    // Note: Pine source line 72 has a bug using Wlongsignal for short. We use Wshortsignal.
    const shortsignal = highleftempty && (
      (enableWick && Wshortsignal) ||
      (enableExtreme && Eshortsignal) ||
      (enableOutside && Oshortsignal) ||
      (enableDoji && Dshortsignal)
    );

    if (longsignal) {
      // Determine which system triggered for label
      let text = 'Long';
      let color = '#2196F3'; // blue default
      if (enableWick && Wlongsignal) { text = 'WickL'; color = '#2196F3'; }
      else if (enableExtreme && Elongsignal) { text = 'ExtrL'; color = '#00BCD4'; }
      else if (enableOutside && Olongsignal) { text = 'OutsL'; color = '#4CAF50'; }
      else if (enableDoji && Dlongsignal) { text = 'DojiL'; color = '#9C27B0'; }

      markers.push({
        time, position: 'belowBar', shape: 'triangleUp', color, text,
      });
    }

    if (shortsignal) {
      let text = 'Short';
      let color = '#EF5350'; // red default
      if (enableWick && Wshortsignal) { text = 'WickS'; color = '#EF5350'; }
      else if (enableExtreme && Eshortsignal) { text = 'ExtrS'; color = '#FF5722'; }
      else if (enableOutside && Oshortsignal) { text = 'OutsS'; color = '#FF9800'; }
      else if (enableDoji && Dshortsignal) { text = 'DojiS'; color = '#E91E63'; }

      markers.push({
        time, position: 'aboveBar', shape: 'triangleDown', color, text,
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const CandlestickReversal = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
