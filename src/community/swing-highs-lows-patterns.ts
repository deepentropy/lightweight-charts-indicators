/**
 * Swing Highs/Lows & Candle Patterns
 *
 * Identifies swing highs/lows using ta.pivothigh/ta.pivotlow, classifies them as
 * HH/LH or HL/LL, and detects candle patterns (hammer, inverted hammer,
 * bullish engulfing, hanging man, shooting star, bearish engulfing) at pivot points.
 *
 * Reference: TradingView "Swing Highs/Lows & Candle Patterns [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData } from '../types';

export interface SwingHighsLowsPatternsInputs {
  length: number;
}

export const defaultInputs: SwingHighsLowsPatternsInputs = {
  length: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchor', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Swing Highs/Lows & Candle Patterns',
  shortTitle: 'SwingPat',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SwingHighsLowsPatternsInputs> = {}): IndicatorResult & { markers: MarkerData[]; labels: LabelData[] } {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();

  const markers: MarkerData[] = [];
  const labels: LabelData[] = [];
  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  let prevPhy = NaN; // previous pivot high value
  let prevPly = NaN; // previous pivot low value

  const swinghCss = '#EF5350'; // red
  const swinglCss = '#26A69A'; // teal

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const hasPh = ph != null && !isNaN(ph) && ph !== 0;
    const hasPl = pl != null && !isNaN(pl) && pl !== 0;

    // Candle data at the pivot bar (offset by length)
    const pivotIdx = i - length;
    if (pivotIdx < 0) continue;

    const o = bars[pivotIdx].open;
    const h = bars[pivotIdx].high;
    const l = bars[pivotIdx].low;
    const c = bars[pivotIdx].close;
    const d = Math.abs(c - o);

    // Pattern detection
    // Hammer: pl and min(o,c)-l > d and h-max(c,o) < d
    const isHammer = hasPl && (Math.min(o, c) - l > d) && (h - Math.max(c, o) < d);
    // Inverted Hammer: pl and h-max(c,o) > d and min(c,o)-l < d
    const isInvHammer = hasPl && (h - Math.max(c, o) > d) && (Math.min(c, o) - l < d);
    // Bullish Engulfing: c > o and c[1] < o[1] and c > o[1] and o < c[1]
    let isBullEng = false;
    if (pivotIdx >= 1) {
      const po = bars[pivotIdx - 1].open;
      const pc = bars[pivotIdx - 1].close;
      isBullEng = c > o && pc < po && c > po && o < pc;
    }
    // Hanging Man: ph and min(c,o)-l > d and h-max(o,c) < d
    const isHanging = hasPh && (Math.min(c, o) - l > d) && (h - Math.max(o, c) < d);
    // Shooting Star: ph and h-max(o,c) > d and min(c,o)-l < d
    const isShooting = hasPh && (h - Math.max(o, c) > d) && (Math.min(c, o) - l < d);
    // Bearish Engulfing: c > o and c[1] < o[1] and c > o[1] and o < c[1]
    // Note: Pine source has identical condition to bullish engulfing (likely a bug in source)
    let isBearEng = false;
    if (pivotIdx >= 1) {
      const po = bars[pivotIdx - 1].open;
      const pc = bars[pivotIdx - 1].close;
      isBearEng = c > o && pc < po && c > po && o < pc;
    }

    // Determine pattern name (priority order from Pine)
    let patternName = 'None';
    if (isHammer) patternName = 'Hammer';
    else if (isInvHammer) patternName = 'Inverted Hammer';
    else if (isBullEng) patternName = 'Bullish Engulfing';
    else if (isHanging) patternName = 'Hanging Man';
    else if (isShooting) patternName = 'Shooting Star';
    else if (isBearEng) patternName = 'Bearish Engulfing';

    if (hasPh) {
      const phVal = ph;
      const label = !isNaN(prevPhy) ? (phVal > prevPhy ? 'HH' : 'LH') : 'HH';

      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'labelDown',
        color: swinghCss,
        text: label + '\n' + patternName,
      });

      labels.push({
        time: bars[i].time,
        price: phVal,
        text: label + '\n' + patternName,
        textColor: swinghCss,
        style: 'label_down',
        size: 'small',
      });

      prevPhy = phVal;
    }

    if (hasPl) {
      const plVal = pl;
      const label = !isNaN(prevPly) ? (plVal < prevPly ? 'LL' : 'HL') : 'HL';

      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'labelUp',
        color: swinglCss,
        text: label + '\n' + patternName,
      });

      labels.push({
        time: bars[i].time,
        price: plVal,
        text: label + '\n' + patternName,
        textColor: swinglCss,
        style: 'label_up',
        size: 'small',
      });

      prevPly = plVal;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
    labels,
  };
}

export const SwingHighsLowsPatterns = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
