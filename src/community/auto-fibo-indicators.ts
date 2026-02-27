/**
 * AutoFiboIndicators
 *
 * Auto Fibonacci Retracement Levels on various oscillator indicators.
 * Calculates Fibonacci retracement levels on a selectable indicator
 * (RSI/CCI/MFI/Stoch/CMO), auto-detecting highs/lows over a lookback period.
 *
 * Reference: TradingView "Auto Fibo on Indicators" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoFiboIndicatorsInputs {
  fiboLen: number;
  indLen: number;
  indicator: 'RSI' | 'CCI' | 'MFI' | 'STOCHASTIC' | 'CMO';
  showOBOS: boolean;
  overbought: number;
  oversold: number;
  midLine: number;
  adjFiboLevel: number;
  showAdjFibo: boolean;
  showFibo1618: boolean;
  showFibo2618: boolean;
  showFibo3618: boolean;
}

export const defaultInputs: AutoFiboIndicatorsInputs = {
  fiboLen: 144,
  indLen: 14,
  indicator: 'RSI',
  showOBOS: true,
  overbought: 70,
  oversold: 30,
  midLine: 50,
  adjFiboLevel: 1.272,
  showAdjFibo: false,
  showFibo1618: false,
  showFibo2618: false,
  showFibo3618: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'fiboLen', type: 'int', title: 'Auto Fibo Length', defval: 144, min: 1 },
  { id: 'indLen', type: 'int', title: 'Indicator Length', defval: 14, min: 1 },
  { id: 'indicator', type: 'string', title: 'Target Indicator', defval: 'RSI', options: ['RSI', 'CCI', 'MFI', 'STOCHASTIC', 'CMO'] },
  { id: 'showOBOS', type: 'bool', title: 'Show OB/OS Levels', defval: true },
  { id: 'overbought', type: 'int', title: 'Overbought Level', defval: 70 },
  { id: 'oversold', type: 'int', title: 'Oversold Level', defval: 30 },
  { id: 'midLine', type: 'int', title: 'Middle Line', defval: 50 },
  { id: 'adjFiboLevel', type: 'float', title: 'Adjustable Fibo Level', defval: 1.272, step: 0.001 },
  { id: 'showAdjFibo', type: 'bool', title: 'Show Adjustable Fibo Level', defval: false },
  { id: 'showFibo1618', type: 'bool', title: 'Show 1.618 Fibo Level', defval: false },
  { id: 'showFibo2618', type: 'bool', title: 'Show 2.618 Fibo Level', defval: false },
  { id: 'showFibo3618', type: 'bool', title: 'Show 3.618 Fibo Level', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'low', title: 'LOW', color: '#4B0082', lineWidth: 3 },
  { id: 'high', title: 'HIGH', color: '#4B0082', lineWidth: 3 },
  { id: 'f236', title: '0.236', color: '#000000', lineWidth: 1 },
  { id: 'f382', title: '0.382', color: '#0000FF', lineWidth: 1 },
  { id: 'f500', title: '0.5', color: '#060CBA', lineWidth: 2 },
  { id: 'f618', title: '0.618', color: '#0F8000', lineWidth: 3 },
  { id: 'f786', title: '0.786', color: '#000000', lineWidth: 1 },
  { id: 'f1272', title: '1.272', color: '#E252FF', lineWidth: 2 },
  { id: 'f1618', title: '1.618', color: '#E252FF', lineWidth: 2 },
  { id: 'f2618', title: '2.618', color: '#E252FF', lineWidth: 2 },
  { id: 'f3618', title: '3.618', color: '#E252FF', lineWidth: 2 },
  { id: 'ind', title: 'IND', color: '#C25757', lineWidth: 3 },
];

export const metadata = {
  title: 'Auto Fibo on Indicators',
  shortTitle: 'AutoFibo',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AutoFiboIndicatorsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  // Compute selected indicator
  const indArr: number[] = new Array(n);
  if (cfg.indicator === 'RSI') {
    const arr = ta.rsi(close, cfg.indLen).toArray();
    for (let i = 0; i < n; i++) indArr[i] = arr[i] ?? NaN;
  } else if (cfg.indicator === 'CCI') {
    const arr = ta.cci(close, cfg.indLen).toArray();
    for (let i = 0; i < n; i++) indArr[i] = arr[i] ?? NaN;
  } else if (cfg.indicator === 'MFI') {
    const hlc3 = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
    const vol = new Series(bars, (b) => b.volume ?? 0);
    const arr = ta.mfi(hlc3, cfg.indLen, vol).toArray();
    for (let i = 0; i < n; i++) indArr[i] = arr[i] ?? NaN;
  } else if (cfg.indicator === 'STOCHASTIC') {
    const arr = ta.stoch(close, high, low, cfg.indLen).toArray();
    for (let i = 0; i < n; i++) indArr[i] = arr[i] ?? NaN;
  } else if (cfg.indicator === 'CMO') {
    const arr = ta.cmo(close, cfg.indLen).toArray();
    for (let i = 0; i < n; i++) indArr[i] = arr[i] ?? NaN;
  }

  // Highest/lowest of indicator over fiboLen
  const indSeries = Series.fromArray(bars, indArr);
  const h1Arr = ta.highest(indSeries, cfg.fiboLen).toArray();
  const l1Arr = ta.lowest(indSeries, cfg.fiboLen).toArray();

  // highestbars/lowestbars on price to determine fib direction
  const hbArr = ta.highestbars(high, cfg.fiboLen).toArray();
  const lbArr = ta.lowestbars(low, cfg.fiboLen).toArray();

  const warmup = Math.max(cfg.fiboLen, cfg.indLen);

  const makePlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  const lowPlot: number[] = new Array(n);
  const highPlot: number[] = new Array(n);
  const f236Arr: number[] = new Array(n);
  const f382Arr: number[] = new Array(n);
  const f500Arr: number[] = new Array(n);
  const f618Arr: number[] = new Array(n);
  const f786Arr: number[] = new Array(n);
  const f1272Arr: number[] = new Array(n);
  const f1618Arr: number[] = new Array(n);
  const f2618Arr: number[] = new Array(n);
  const f3618Arr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const h1 = h1Arr[i] ?? NaN;
    const l1 = l1Arr[i] ?? NaN;
    const fark = h1 - l1;

    lowPlot[i] = l1;
    highPlot[i] = h1;

    // Pine: hbars = -ta.highestbars(high, len), lbars = -ta.lowestbars(low, len)
    // highestbars returns negative offset, so negate to get positive bars-ago
    const hbars = -(hbArr[i] ?? 0);
    const lbars = -(lbArr[i] ?? 0);

    // When high bar is more bars ago than low bar, fib goes up (hl*); otherwise goes down (lh*)
    if (hbars > lbars) {
      f236Arr[i] = l1 + fark * 0.236;
      f382Arr[i] = l1 + fark * 0.382;
      f500Arr[i] = l1 + fark * 0.5;
      f618Arr[i] = l1 + fark * 0.618;
      f786Arr[i] = l1 + fark * 0.786;
      f1272Arr[i] = l1 + fark * cfg.adjFiboLevel;
      f1618Arr[i] = l1 + fark * 1.618;
      f2618Arr[i] = l1 + fark * 2.618;
      f3618Arr[i] = l1 + fark * 3.618;
    } else {
      f236Arr[i] = h1 - fark * 0.236;
      f382Arr[i] = h1 - fark * 0.382;
      f500Arr[i] = h1 - fark * 0.5;
      f618Arr[i] = h1 - fark * 0.618;
      f786Arr[i] = h1 - fark * 0.786;
      f1272Arr[i] = h1 - fark * cfg.adjFiboLevel;
      f1618Arr[i] = h1 - fark * 1.618;
      f2618Arr[i] = h1 - fark * 2.618;
      f3618Arr[i] = h1 - fark * 3.618;
    }
  }

  // Build conditional plots for extended fib levels
  const f1272Plot = f1272Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.showAdjFibo ? v : NaN),
  }));
  const f1618Plot = f1618Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.showFibo1618 ? v : NaN),
  }));
  const f2618Plot = f2618Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.showFibo2618 ? v : NaN),
  }));
  const f3618Plot = f3618Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.showFibo3618 ? v : NaN),
  }));

  const result: IndicatorResult & { hlines?: any[]; fills?: any[] } = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      low: makePlot(lowPlot),
      high: makePlot(highPlot),
      f236: makePlot(f236Arr),
      f382: makePlot(f382Arr),
      f500: makePlot(f500Arr),
      f618: makePlot(f618Arr),
      f786: makePlot(f786Arr),
      f1272: f1272Plot,
      f1618: f1618Plot,
      f2618: f2618Plot,
      f3618: f3618Plot,
      ind: indArr.map((v, i) => ({ time: bars[i].time, value: v })),
    },
  };

  // OB/OS hlines and fill (only when showOBOS is false in Pine => "Do not Show" is unchecked)
  if (!cfg.showOBOS) {
    result.hlines = [
      { value: cfg.overbought, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Overbought Level' } },
      { value: cfg.midLine, options: { color: 'rgba(120,123,134,0.5)', linestyle: 'solid' as const, title: 'Middle Line' } },
      { value: cfg.oversold, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Oversold Level' } },
    ];
    result.fills = [
      { plot1: 'hlineOB', plot2: 'hlineOS', options: { color: 'rgba(126,87,194,0.10)' } },
    ];
  }

  return result;
}

export const AutoFiboIndicators = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
