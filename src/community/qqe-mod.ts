/**
 * QQE MOD
 *
 * Dual QQE (Quantitative Qualitative Estimation) with Bollinger Bands overlay.
 * Primary QQE: RSI smoothed via EMA, with dynamic ATR-RSI bands.
 * Secondary QQE: Same logic, different parameters.
 * BB on primary QQE trend line highlights strong momentum zones.
 *
 * Reference: TradingView "QQE MOD"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface QQEModInputs {
  rsiLengthPrimary: number;
  rsiSmoothingPrimary: number;
  qqeFactorPrimary: number;
  rsiLengthSecondary: number;
  rsiSmoothingSecondary: number;
  qqeFactorSecondary: number;
  thresholdSecondary: number;
  bollingerLength: number;
  bollingerMultiplier: number;
}

export const defaultInputs: QQEModInputs = {
  rsiLengthPrimary: 6,
  rsiSmoothingPrimary: 5,
  qqeFactorPrimary: 3.0,
  rsiLengthSecondary: 6,
  rsiSmoothingSecondary: 5,
  qqeFactorSecondary: 1.61,
  thresholdSecondary: 3.0,
  bollingerLength: 50,
  bollingerMultiplier: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLengthPrimary', type: 'int', title: 'Primary RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothingPrimary', type: 'int', title: 'Primary RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactorPrimary', type: 'float', title: 'Primary QQE Factor', defval: 3.0, min: 0.01, step: 0.01 },
  { id: 'rsiLengthSecondary', type: 'int', title: 'Secondary RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothingSecondary', type: 'int', title: 'Secondary RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactorSecondary', type: 'float', title: 'Secondary QQE Factor', defval: 1.61, min: 0.01, step: 0.01 },
  { id: 'thresholdSecondary', type: 'float', title: 'Secondary Threshold', defval: 3.0, min: 0 },
  { id: 'bollingerLength', type: 'int', title: 'BB Length', defval: 50, min: 1 },
  { id: 'bollingerMultiplier', type: 'float', title: 'BB Multiplier', defval: 0.35, min: 0.001, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Secondary QQE Trend Line', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot1', title: 'Secondary RSI Histogram', color: '#707070', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'QQE Up Signal', color: '#00c3ff', lineWidth: 1 },
  { id: 'plot3', title: 'QQE Down Signal', color: '#ff0062', lineWidth: 1 },
];

export const metadata = {
  title: 'QQE MOD',
  shortTitle: 'QQEM',
  overlay: false,
};

function calculateQQE(
  bars: Bar[],
  source: Series,
  rsiLength: number,
  smoothingFactor: number,
  qqeFactor: number,
): { trendLine: number[]; smoothedRsi: number[] } {
  const wildersLength = rsiLength * 2 - 1;
  const rsi = ta.rsi(source, rsiLength);
  const smoothedRsiSeries = ta.ema(rsi, smoothingFactor);
  const smoothedRsiArr = smoothedRsiSeries.toArray();

  // atrRsi = abs(smoothedRsi[1] - smoothedRsi)
  const n = bars.length;
  const atrRsiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? (smoothedRsiArr[i - 1] ?? 0) : 0;
    const cur = smoothedRsiArr[i] ?? 0;
    atrRsiRaw[i] = Math.abs(prev - cur);
  }
  const atrRsiSeries = Series.fromArray(bars, atrRsiRaw);
  const smoothedAtrRsiArr = ta.ema(atrRsiSeries, wildersLength).toArray();

  const longBand: number[] = new Array(n);
  const shortBand: number[] = new Array(n);
  const trendDir: number[] = new Array(n);
  const trendLine: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const sr = smoothedRsiArr[i] ?? 0;
    const prevSr = i > 0 ? (smoothedRsiArr[i - 1] ?? 0) : 0;
    const dar = (smoothedAtrRsiArr[i] ?? 0) * qqeFactor;
    const newLong = sr - dar;
    const newShort = sr + dar;

    if (i === 0) {
      longBand[i] = newLong;
      shortBand[i] = newShort;
      trendDir[i] = 0;
    } else {
      longBand[i] = (prevSr > longBand[i - 1] && sr > longBand[i - 1])
        ? Math.max(longBand[i - 1], newLong)
        : newLong;
      shortBand[i] = (prevSr < shortBand[i - 1] && sr < shortBand[i - 1])
        ? Math.min(shortBand[i - 1], newShort)
        : newShort;

      // Cross detection
      const crossLong = (prevSr <= longBand[i - 1] && sr > longBand[i - 1]) ||
                         (prevSr >= longBand[i - 1] && sr < longBand[i - 1]);
      // Use crossover for short (RSI crosses above shortBand)
      const crossoverShort = prevSr <= shortBand[i - 1] && sr > shortBand[i - 1];
      if (crossoverShort || (prevSr < shortBand[i - 1] && sr >= shortBand[i - 1])) {
        trendDir[i] = 1;
      } else if (crossLong) {
        trendDir[i] = -1;
      } else {
        trendDir[i] = trendDir[i - 1];
      }
    }
    trendLine[i] = trendDir[i] === 1 ? longBand[i] : shortBand[i];
  }

  return { trendLine, smoothedRsi: smoothedRsiArr.map((v) => v ?? 0) };
}

export function calculate(bars: Bar[], inputs: Partial<QQEModInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const close = new Series(bars, (b) => b.close);

  const primary = calculateQQE(bars, close, cfg.rsiLengthPrimary, cfg.rsiSmoothingPrimary, cfg.qqeFactorPrimary);
  const secondary = calculateQQE(bars, close, cfg.rsiLengthSecondary, cfg.rsiSmoothingSecondary, cfg.qqeFactorSecondary);

  // Bollinger on primary QQE trend line - 50
  const qqeMinus50 = Series.fromArray(bars, primary.trendLine.map((v) => v - 50));
  const [bbBasis] = ta.bb(qqeMinus50, cfg.bollingerLength, cfg.bollingerMultiplier);
  const bbDev = ta.stdev(qqeMinus50, cfg.bollingerLength);
  const bbBasisArr = bbBasis.toArray();
  const bbDevArr = bbDev.toArray();

  const warmup = Math.max(cfg.rsiLengthPrimary * 2, cfg.rsiLengthSecondary * 2, cfg.bollingerLength);

  const plot0: Array<{ time: number; value: number }> = [];
  const plot1: Array<{ time: number; value: number }> = [];
  const plot2: Array<{ time: number; value: number }> = [];
  const plot3: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    const w = i < warmup;
    const secTrend50 = secondary.trendLine[i] - 50;
    const secRsi50 = secondary.smoothedRsi[i] - 50;
    const priRsi50 = primary.smoothedRsi[i] - 50;
    const bbUp = (bbBasisArr[i] ?? 0) + (bbDevArr[i] ?? 0) * cfg.bollingerMultiplier;
    const bbLo = (bbBasisArr[i] ?? 0) - (bbDevArr[i] ?? 0) * cfg.bollingerMultiplier;

    plot0.push({ time: t, value: w ? NaN : secTrend50 });
    plot1.push({ time: t, value: w ? NaN : secRsi50 });
    plot2.push({ time: t, value: w ? NaN : (secRsi50 > cfg.thresholdSecondary && priRsi50 > bbUp ? secRsi50 : NaN) });
    plot3.push({ time: t, value: w ? NaN : (secRsi50 < -cfg.thresholdSecondary && priRsi50 < bbLo ? secRsi50 : NaN) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } }],
  };
}

export const QQEMod = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
