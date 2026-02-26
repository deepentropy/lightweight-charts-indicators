/**
 * Vervoort Heiken-Ashi LongTerm Candlestick Oscillator
 *
 * TEMA-smoothed OHLC → Heiken Ashi candles → oscillator from HA close vs open.
 * Oscillator = (haClose - haOpen) / haClose * 100
 *
 * Reference: TradingView "Vervoort Heiken Ashi Longterm Candlestick Oscillator [LazyBear]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VervoortHAOscillatorInputs {
  temaLength: number;
}

export const defaultInputs: VervoortHAOscillatorInputs = {
  temaLength: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'temaLength', type: 'int', title: 'TEMA Length', defval: 55, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Vervoort HA LT Candlestick Oscillator',
  shortTitle: 'VHO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VervoortHAOscillatorInputs> = {}): IndicatorResult {
  const { temaLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const openSeries = new Series(bars, (b) => b.open);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = new Series(bars, (b) => b.close);

  // TEMA for each OHLC component: TEMA = 3*ema1 - 3*ema2 + ema3
  const ema1O = ta.ema(openSeries, temaLength).toArray();
  const ema1H = ta.ema(highSeries, temaLength).toArray();
  const ema1L = ta.ema(lowSeries, temaLength).toArray();
  const ema1C = ta.ema(closeSeries, temaLength).toArray();

  const ema1OSeries = new Series(bars, (_b, i) => isNaN(ema1O[i]) ? bars[i].open : ema1O[i]);
  const ema1HSeries = new Series(bars, (_b, i) => isNaN(ema1H[i]) ? bars[i].high : ema1H[i]);
  const ema1LSeries = new Series(bars, (_b, i) => isNaN(ema1L[i]) ? bars[i].low : ema1L[i]);
  const ema1CSeries = new Series(bars, (_b, i) => isNaN(ema1C[i]) ? bars[i].close : ema1C[i]);

  const ema2O = ta.ema(ema1OSeries, temaLength).toArray();
  const ema2H = ta.ema(ema1HSeries, temaLength).toArray();
  const ema2L = ta.ema(ema1LSeries, temaLength).toArray();
  const ema2C = ta.ema(ema1CSeries, temaLength).toArray();

  const ema2OSeries = new Series(bars, (_b, i) => isNaN(ema2O[i]) ? bars[i].open : ema2O[i]);
  const ema2HSeries = new Series(bars, (_b, i) => isNaN(ema2H[i]) ? bars[i].high : ema2H[i]);
  const ema2LSeries = new Series(bars, (_b, i) => isNaN(ema2L[i]) ? bars[i].low : ema2L[i]);
  const ema2CSeries = new Series(bars, (_b, i) => isNaN(ema2C[i]) ? bars[i].close : ema2C[i]);

  const ema3O = ta.ema(ema2OSeries, temaLength).toArray();
  const ema3H = ta.ema(ema2HSeries, temaLength).toArray();
  const ema3L = ta.ema(ema2LSeries, temaLength).toArray();
  const ema3C = ta.ema(ema2CSeries, temaLength).toArray();

  // Compute TEMA values for each bar
  const temaO: number[] = new Array(n);
  const temaH: number[] = new Array(n);
  const temaL: number[] = new Array(n);
  const temaC: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const e1o = isNaN(ema1O[i]) ? bars[i].open : ema1O[i];
    const e2o = isNaN(ema2O[i]) ? bars[i].open : ema2O[i];
    const e3o = isNaN(ema3O[i]) ? bars[i].open : ema3O[i];
    temaO[i] = 3 * e1o - 3 * e2o + e3o;

    const e1h = isNaN(ema1H[i]) ? bars[i].high : ema1H[i];
    const e2h = isNaN(ema2H[i]) ? bars[i].high : ema2H[i];
    const e3h = isNaN(ema3H[i]) ? bars[i].high : ema3H[i];
    temaH[i] = 3 * e1h - 3 * e2h + e3h;

    const e1l = isNaN(ema1L[i]) ? bars[i].low : ema1L[i];
    const e2l = isNaN(ema2L[i]) ? bars[i].low : ema2L[i];
    const e3l = isNaN(ema3L[i]) ? bars[i].low : ema3L[i];
    temaL[i] = 3 * e1l - 3 * e2l + e3l;

    const e1c = isNaN(ema1C[i]) ? bars[i].close : ema1C[i];
    const e2c = isNaN(ema2C[i]) ? bars[i].close : ema2C[i];
    const e3c = isNaN(ema3C[i]) ? bars[i].close : ema3C[i];
    temaC[i] = 3 * e1c - 3 * e2c + e3c;
  }

  // Build Heiken Ashi on TEMA-smoothed OHLC
  const haClose: number[] = new Array(n);
  const haOpen: number[] = new Array(n);
  const haHigh: number[] = new Array(n);
  const haLow: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    haClose[i] = (temaO[i] + temaH[i] + temaL[i] + temaC[i]) / 4;

    if (i === 0) {
      haOpen[i] = (temaO[i] + temaC[i]) / 2;
    } else {
      haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
    }

    haHigh[i] = Math.max(temaH[i], haOpen[i], haClose[i]);
    haLow[i] = Math.min(temaL[i], haOpen[i], haClose[i]);
  }

  // Oscillator = (haClose - haOpen) / haClose * 100
  const warmup = temaLength * 3;

  const plot0 = bars.map((b, i) => {
    if (i < warmup) return { time: b.time, value: NaN };
    const osc = haClose[i] !== 0 ? (haClose[i] - haOpen[i]) / haClose[i] * 100 : 0;
    const color = osc >= 0 ? '#26A69A' : '#EF5350';
    return { time: b.time, value: osc, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const VervoortHAOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
