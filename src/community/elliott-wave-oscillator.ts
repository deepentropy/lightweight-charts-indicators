/**
 * Elliott Wave Oscillator Signals (EWO-S)
 *
 * Overlay indicator. Computes EWO = (EMA(5)/EMA(34) - 1) * 100 and its signal line.
 * Crossover/crossunder of EWO vs signal generates buy/sell markers on price chart.
 *
 * - Strong Long: crossover when EWO < -threshold (dark green labelUp)
 * - Long: crossover when EWO > -threshold (green labelUp)
 * - Strong Short: crossunder when EWO > threshold (dark red labelDown)
 * - Short: crossunder when EWO < threshold (red labelDown)
 *
 * The Pine also draws an EWO histogram via line.new on the price chart, but that
 * is a complex overlay rendering. We represent it as a secondary panel-less
 * visual reference and focus on the key trading signals (markers).
 *
 * Reference: TradingView "Elliott Wave Oscillator Signals by DGT"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ElliottWaveOscInputs {
  useEma: boolean;
  signalDelay: number;
  strengthThreshold: number;
}

export const defaultInputs: ElliottWaveOscInputs = {
  useEma: true,
  signalDelay: 5,
  strengthThreshold: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'useEma', type: 'bool', title: 'Use Exponential MA', defval: true },
  { id: 'signalDelay', type: 'int', title: 'Signal Delay', defval: 5, min: 2 },
  { id: 'strengthThreshold', type: 'int', title: 'Strength Threshold', defval: 13, min: 1 },
];

// Overlay indicator - no separate panel plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Elliott Wave Oscillator Signals',
  shortTitle: 'EWO-S',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ElliottWaveOscInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { useEma, signalDelay, strengthThreshold } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'close');

  // EWO = (fast_ma / slow_ma - 1) * 100
  const fastMa = useEma ? ta.ema(src, 5) : ta.sma(src, 5);
  const slowMa = useEma ? ta.ema(src, 34) : ta.sma(src, 34);
  const fastArr = fastMa.toArray();
  const slowArr = slowMa.toArray();

  const n = bars.length;
  const ewoArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = fastArr[i];
    const s = slowArr[i];
    if (f == null || s == null || s === 0) {
      ewoArr[i] = NaN;
    } else {
      ewoArr[i] = (f / s - 1) * 100;
    }
  }

  // Signal line = MA of EWO
  const ewoSeries = new Series(bars, (_b, i) => ewoArr[i] ?? 0);
  const ewoSignalArr = (useEma ? ta.ema(ewoSeries, signalDelay) : ta.sma(ewoSeries, signalDelay)).toArray();

  const warmup = 34; // slowest MA length
  const t = strengthThreshold;

  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const cur = ewoArr[i];
    const prev = ewoArr[i - 1];
    const curSig = ewoSignalArr[i];
    const prevSig = ewoSignalArr[i - 1];
    if (isNaN(cur) || isNaN(prev) || curSig == null || prevSig == null) continue;

    const crossOver = prev <= prevSig && cur > curSig;
    const crossUnder = prev >= prevSig && cur < curSig;

    if (crossOver && cur < -t) {
      // Strong Long
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#006400', text: 'SL' });
    } else if (crossOver && cur > -t) {
      // Long
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'L' });
    }

    if (crossUnder && cur > t) {
      // Strong Short
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#910000', text: 'SS' });
    } else if (crossUnder && cur < t) {
      // Short
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'S' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const ElliottWaveOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
