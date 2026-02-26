/**
 * MACD Leader [LazyBear] / Siligardos
 *
 * Enhanced MACD with a "Leader" line that reacts faster to price changes.
 * Leader = (EMA(fast) + EMA(src - EMA(fast), fast)) - (EMA(slow) + EMA(src - EMA(slow), slow))
 *
 * Reference: TradingView "MACD Leader" by LazyBear
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACDLeaderInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACDLeaderInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Leader', color: '#26A69A', lineWidth: 2 },
  { id: 'plot3', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'MACD Leader',
  shortTitle: 'MACDLeader',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDLeaderInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  const emaFast = ta.ema(source, fastLength);
  const emaSlow = ta.ema(source, slowLength);
  const emaFastArr = emaFast.toArray();
  const emaSlowArr = emaSlow.toArray();

  // src - emaFast series, then EMA it
  const srcMinusFastArr: number[] = new Array(bars.length);
  const srcMinusSlowArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const s = srcArr[i] ?? 0;
    srcMinusFastArr[i] = s - (emaFastArr[i] ?? 0);
    srcMinusSlowArr[i] = s - (emaSlowArr[i] ?? 0);
  }

  const emaSrcMinusFast = ta.ema(new Series(bars, (_b, i) => srcMinusFastArr[i]), fastLength).toArray();
  const emaSrcMinusSlow = ta.ema(new Series(bars, (_b, i) => srcMinusSlowArr[i]), slowLength).toArray();

  const macdArr: number[] = new Array(bars.length);
  const leaderArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const ef = emaFastArr[i] ?? NaN;
    const es = emaSlowArr[i] ?? NaN;
    macdArr[i] = ef - es;
    const i1 = ef + (emaSrcMinusFast[i] ?? 0);
    const i2 = es + (emaSrcMinusSlow[i] ?? 0);
    leaderArr[i] = i1 - i2;
  }

  const signalArr = ta.ema(new Series(bars, (_b, i) => macdArr[i]), signalLength).toArray();

  const warmup = slowLength;

  const plot0 = macdArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  const plot2 = leaderArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot3 = macdArr.map((v, i) => {
    const sig = signalArr[i] ?? NaN;
    if (i < warmup || isNaN(sig)) return { time: bars[i].time, value: NaN };
    const hist = v - sig;
    const prevMacd = i > 0 ? macdArr[i - 1] : NaN;
    const prevSig = i > 0 ? (signalArr[i - 1] ?? NaN) : NaN;
    const prevHist = isNaN(prevMacd) || isNaN(prevSig) ? NaN : prevMacd - prevSig;
    let color: string;
    if (hist >= 0) {
      color = (!isNaN(prevHist) && hist >= prevHist) ? '#26A69A' : '#B2DFDB';
    } else {
      color = (!isNaN(prevHist) && hist < prevHist) ? '#EF5350' : '#FFCDD2';
    }
    return { time: bars[i].time, value: hist, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const MACDLeader = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
