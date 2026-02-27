/**
 * Multiple Divergences NON-REPAINT
 *
 * Detects divergences across 10 oscillators (RSI, MACD, MACD Histogram,
 * Stochastic, CCI, Momentum, OBV, DI Oscillator, VW-MACD, CMF) at pivot
 * points. Counts how many oscillators show the same divergence type
 * simultaneously and displays markers when count >= threshold.
 *
 * Reference: TradingView "Multiple Divergences NON-REPAINT" by PeterO
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MultipleDivergencesInputs {
  minDivCount: number;
  lbR: number;
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: MultipleDivergencesInputs = {
  minDivCount: 2,
  lbR: 1,
  lbL: 3,
  rangeUpper: 60,
  rangeLower: 1,
  plotBull: true,
  plotHiddenBull: true,
  plotBear: true,
  plotHiddenBear: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'minDivCount', type: 'int', title: 'Min Divergence Count', defval: 2, min: 1, max: 10 },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 1, min: 1 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 3, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max Bars Back', defval: 60, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min Bars Back', defval: 1, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Show Regular Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Show Hidden Bullish', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Show Regular Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Show Hidden Bearish', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dummy', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Multiple Divergences',
  shortTitle: 'Multi Div',
  overlay: true,
};

/**
 * Detect if bar at idx is a pivot low within the given arrays.
 * Pivot confirmed at idx means osc[idx] is lower than all surrounding bars in [idx-lbL, idx+lbR].
 */
function isPivotLow(arr: number[], idx: number, lbL: number, lbR: number): boolean {
  const val = arr[idx];
  if (val == null || isNaN(val)) return false;
  for (let j = 1; j <= lbL; j++) {
    const left = arr[idx - j];
    if (left == null || isNaN(left) || left <= val) return false;
  }
  for (let j = 1; j <= lbR; j++) {
    const right = arr[idx + j];
    if (right == null || isNaN(right) || right <= val) return false;
  }
  return true;
}

function isPivotHigh(arr: number[], idx: number, lbL: number, lbR: number): boolean {
  const val = arr[idx];
  if (val == null || isNaN(val)) return false;
  for (let j = 1; j <= lbL; j++) {
    const left = arr[idx - j];
    if (left == null || isNaN(left) || left >= val) return false;
  }
  for (let j = 1; j <= lbR; j++) {
    const right = arr[idx + j];
    if (right == null || isNaN(right) || right >= val) return false;
  }
  return true;
}

interface PivotState {
  lastLowVal: number;
  lastLowPrice: number;
  lastLowBar: number;
  lastHighVal: number;
  lastHighPrice: number;
  lastHighBar: number;
}

export function calculate(bars: Bar[], inputs: Partial<MultipleDivergencesInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { minDivCount, lbR, lbL, rangeUpper, rangeLower, plotBull, plotHiddenBull, plotBear, plotHiddenBear } =
    { ...defaultInputs, ...inputs };

  const n = bars.length;
  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const volumeSeries = new Series(bars, (b) => b.volume ?? 0);

  // ---- Compute all 10 oscillators ----
  // 1. RSI
  const rsiArr = ta.rsi(closeSeries, 14).toArray().map((v) => v ?? NaN);

  // 2. MACD line (EMA12 - EMA26)
  const ema12 = ta.ema(closeSeries, 12).toArray();
  const ema26 = ta.ema(closeSeries, 26).toArray();
  const macdLine: number[] = new Array(n);
  for (let i = 0; i < n; i++) macdLine[i] = (ema12[i] ?? 0) - (ema26[i] ?? 0);

  // 3. MACD histogram (macd - signal where signal = EMA9 of macd)
  const macdSeries = Series.fromArray(bars, macdLine);
  const signalArr = ta.ema(macdSeries, 9).toArray();
  const macdHist: number[] = new Array(n);
  for (let i = 0; i < n; i++) macdHist[i] = macdLine[i] - (signalArr[i] ?? 0);

  // 4. Stochastic %K smoothed (stoch k=14, sma k=3)
  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, 14);
  const stochArr = ta.sma(rawK, 3).toArray().map((v) => v ?? NaN);

  // 5. CCI
  const cciArr = ta.cci(closeSeries, 10).toArray().map((v) => v ?? NaN);

  // 6. Momentum
  const momArr = ta.mom(closeSeries, 10).toArray().map((v) => v ?? NaN);

  // 7. OBV (cumulative sum of signed volume)
  const obvArr: number[] = new Array(n);
  obvArr[0] = 0;
  for (let i = 1; i < n; i++) {
    const dir = bars[i].close > bars[i - 1].close ? 1 : bars[i].close < bars[i - 1].close ? -1 : 0;
    obvArr[i] = obvArr[i - 1] + dir * (bars[i].volume ?? 0);
  }

  // 8. DI Oscillator: (plus_dm smoothed / atr) - (minus_dm smoothed / atr)
  // plus_dm = change(high) > -change(low) && change(high) > 0 ? change(high) : 0
  // minus_dm = -change(low) > change(high) && -change(low) > 0 ? -change(low) : 0
  const diLen = 14;
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }
  const plusDMSmoothed = ta.rma(Series.fromArray(bars, plusDM), diLen).toArray();
  const minusDMSmoothed = ta.rma(Series.fromArray(bars, minusDM), diLen).toArray();
  const trArr = ta.tr(bars).toArray();
  const atrArr = ta.rma(ta.tr(bars), diLen).toArray();
  const diOscArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = atrArr[i] ?? 0;
    if (a === 0) { diOscArr[i] = 0; continue; }
    const plusDI = ((plusDMSmoothed[i] ?? 0) / a) * 100;
    const minusDI = ((minusDMSmoothed[i] ?? 0) / a) * 100;
    diOscArr[i] = plusDI - minusDI;
  }

  // 9. VW-MACD: VWMA(close,12) - VWMA(close,26)
  const vwma12 = ta.vwma(closeSeries, 12, volumeSeries).toArray();
  const vwma26 = ta.vwma(closeSeries, 26, volumeSeries).toArray();
  const vwMacdArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) vwMacdArr[i] = (vwma12[i] ?? 0) - (vwma26[i] ?? 0);

  // 10. CMF: SMA(((close-low)-(high-close))/(high-low)*volume, 21) / SMA(volume, 21)
  const cmfRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hl = bars[i].high - bars[i].low;
    if (hl === 0) { cmfRaw[i] = 0; continue; }
    cmfRaw[i] = ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / hl * (bars[i].volume ?? 0);
  }
  const cmfNum = ta.sma(Series.fromArray(bars, cmfRaw), 21).toArray();
  const cmfDen = ta.sma(volumeSeries, 21).toArray();
  const cmfArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const d = cmfDen[i] ?? 0;
    cmfArr[i] = d === 0 ? 0 : (cmfNum[i] ?? 0) / d;
  }

  const oscillators: number[][] = [rsiArr, macdLine, macdHist, stochArr, cciArr, momArr, obvArr, diOscArr, vwMacdArr, cmfArr];

  // ---- Divergence detection per oscillator ----
  // For the non-repaint version, pivot is confirmed at bar (pivotBar + lbR).
  // The confirmation bar is where we emit the signal.
  // We scan from the perspective of the pivot bar itself, checking pivot conditions.

  const lowArr = bars.map((b) => b.low);
  const highArr = bars.map((b) => b.high);

  // Per-oscillator pivot tracking
  const states: PivotState[] = oscillators.map(() => ({
    lastLowVal: NaN, lastLowPrice: NaN, lastLowBar: -999,
    lastHighVal: NaN, lastHighPrice: NaN, lastHighBar: -999,
  }));

  // Per-bar divergence counts
  const regBullCount: number[] = new Array(n).fill(0);
  const regBearCount: number[] = new Array(n).fill(0);
  const hidBullCount: number[] = new Array(n).fill(0);
  const hidBearCount: number[] = new Array(n).fill(0);

  const warmup = 30; // enough for all oscillators to stabilize

  // Scan each bar as a potential pivot center
  for (let pivotBar = lbL; pivotBar < n - lbR; pivotBar++) {
    const confirmBar = pivotBar + lbR; // non-repaint: signal appears here
    if (confirmBar < warmup) continue;

    // Check price pivots
    const isPricePL = isPivotLow(lowArr, pivotBar, lbL, lbR);
    const isPricePH = isPivotHigh(highArr, pivotBar, lbL, lbR);

    for (let o = 0; o < oscillators.length; o++) {
      const osc = oscillators[o];
      const st = states[o];

      // Check oscillator pivot low
      if (isPricePL && isPivotLow(osc, pivotBar, lbL, lbR)) {
        const barsSince = pivotBar - st.lastLowBar;
        const inRange = barsSince >= rangeLower && barsSince <= rangeUpper;

        if (inRange && !isNaN(st.lastLowVal)) {
          // Regular Bullish: price LL, osc HL
          if (lowArr[pivotBar] < st.lastLowPrice && osc[pivotBar] > st.lastLowVal) {
            regBullCount[confirmBar]++;
          }
          // Hidden Bullish: price HL, osc LL
          if (lowArr[pivotBar] > st.lastLowPrice && osc[pivotBar] < st.lastLowVal) {
            hidBullCount[confirmBar]++;
          }
        }

        st.lastLowVal = osc[pivotBar];
        st.lastLowPrice = lowArr[pivotBar];
        st.lastLowBar = pivotBar;
      }

      // Check oscillator pivot high
      if (isPricePH && isPivotHigh(osc, pivotBar, lbL, lbR)) {
        const barsSince = pivotBar - st.lastHighBar;
        const inRange = barsSince >= rangeLower && barsSince <= rangeUpper;

        if (inRange && !isNaN(st.lastHighVal)) {
          // Regular Bearish: price HH, osc LH
          if (highArr[pivotBar] > st.lastHighPrice && osc[pivotBar] < st.lastHighVal) {
            regBearCount[confirmBar]++;
          }
          // Hidden Bearish: price LH, osc HH
          if (highArr[pivotBar] < st.lastHighPrice && osc[pivotBar] > st.lastHighVal) {
            hidBearCount[confirmBar]++;
          }
        }

        st.lastHighVal = osc[pivotBar];
        st.lastHighPrice = highArr[pivotBar];
        st.lastHighBar = pivotBar;
      }
    }
  }

  // ---- Generate markers ----
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    if (plotBull && regBullCount[i] >= minDivCount) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#008080', text: String(regBullCount[i]) });
    }
    if (plotBear && regBearCount[i] >= minDivCount) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: String(regBearCount[i]) });
    }
    if (plotHiddenBull && hidBullCount[i] >= minDivCount) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: String(hidBullCount[i]) });
    }
    if (plotHiddenBear && hidBearCount[i] >= minDivCount) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FFA500', text: String(hidBearCount[i]) });
    }
  }

  // Dummy plot (overlay indicator needs at least one plot)
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const MultipleDivergences = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
