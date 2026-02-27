/**
 * RSI + BB (EMA) + Dispersion
 *
 * RSI with Bollinger Bands overlay computed on the RSI values.
 * Basis = SMA(RSI, bbLen), bands = basis +/- bbMult * stdev(RSI, bbLen).
 *
 * Reference: TradingView "RSI + BB (EMA) + Dispersion"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';

export interface RSIBBDispersionInputs {
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  forSigma: number;
  src: SourceType;
}

export const defaultInputs: RSIBBDispersionInputs = {
  rsiLen: 14,
  bbLen: 20,
  bbMult: 2.0,
  forSigma: 0.1,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'forSigma', type: 'float', title: 'Dispersion', defval: 0.1, min: 0.01, max: 1, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'BB Upper', color: '#00FFF0', lineWidth: 2 },
  { id: 'plot2', title: 'BB Lower', color: '#00FFF0', lineWidth: 2 },
  { id: 'plot3', title: 'BB Basis', color: '#000000', lineWidth: 1 },
  { id: 'dispUp', title: 'Dispersion Upper', color: '#FFFFFF', lineWidth: 1 },
  { id: 'dispDown', title: 'Dispersion Lower', color: '#FFFFFF', lineWidth: 1 },
  { id: 'hline70', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'hline30', title: 'OS Level', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'RSI + BB + Dispersion',
  shortTitle: 'RSIBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RSIBBDispersionInputs> = {}): IndicatorResult {
  const { rsiLen, bbLen, bbMult, forSigma, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Pine uses EMA for basis: basis = ema(current_rsi, for_ma)
  // and stdev for deviation: dev = for_mult * stdev(current_rsi, for_ma)
  const rsiSeries = new Series(bars, (_b, i) => rsiArr[i] ?? NaN);
  const basisSeries = ta.ema(rsiSeries, bbLen);
  const basisArr = basisSeries.toArray();

  // Compute stdev of RSI manually (population stdev matching Pine's stdev)
  const stdevArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < bbLen - 1 + rsiLen) {
      stdevArr[i] = NaN;
      continue;
    }
    let sum = 0, count = 0;
    for (let j = i - bbLen + 1; j <= i; j++) {
      const v = rsiArr[j];
      if (v != null) { sum += v; count++; }
    }
    if (count < 2) { stdevArr[i] = NaN; continue; }
    const mean = sum / count;
    let sqSum = 0;
    for (let j = i - bbLen + 1; j <= i; j++) {
      const v = rsiArr[j];
      if (v != null) sqSum += (v - mean) * (v - mean);
    }
    stdevArr[i] = Math.sqrt(sqSum / count);
  }

  const warmup = rsiLen + bbLen;

  // Compute upper/lower BB and dispersion bands
  const upperArr: number[] = new Array(n);
  const lowerArr: number[] = new Array(n);
  const dispUpArr: number[] = new Array(n);
  const dispDownArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const b = basisArr[i] ?? NaN;
    const s = stdevArr[i] ?? NaN;
    if (isNaN(b) || isNaN(s) || i < warmup) {
      upperArr[i] = NaN;
      lowerArr[i] = NaN;
      dispUpArr[i] = NaN;
      dispDownArr[i] = NaN;
    } else {
      const dev = bbMult * s;
      upperArr[i] = b + dev;
      lowerArr[i] = b - dev;
      // Pine: disp_up = basis + ((upper - lower) * for_sigma)
      const bandWidth = upperArr[i] - lowerArr[i];
      dispUpArr[i] = b + bandWidth * forSigma;
      dispDownArr[i] = b - bandWidth * forSigma;
    }
  }

  // Pine: color_rsi = current_rsi >= disp_up ? lime : current_rsi <= disp_down ? red : #ffea00
  const plot0 = rsiArr.map((v, i) => {
    if (v == null || i < rsiLen) return { time: bars[i].time, value: NaN };
    let color = '#FFEA00'; // yellow default
    if (!isNaN(dispUpArr[i]) && v >= dispUpArr[i]) color = '#00FF00'; // lime/green
    else if (!isNaN(dispDownArr[i]) && v <= dispDownArr[i]) color = '#FF0000'; // red
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  const plot3 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || isNaN(v as number) || i < warmup) ? NaN : v as number,
  }));

  const dispUpPlot = dispUpArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  const dispDownPlot = dispDownArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  // Invisible anchor plots at 70 and 30 for hline band fill
  const hline70Plot = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : 70 }));
  const hline30Plot = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : 30 }));

  const fills: FillData[] = [
    // Pine: fill(s1, s2, color=white, transp=80) - dispersion band fill
    { plot1: 'dispUp', plot2: 'dispDown', options: { color: 'rgba(255,255,255,0.20)', title: 'Dispersion Fill' } },
    // Pine: fill(h1, h2, transp=95) - hline band fill between 70/30
    { plot1: 'hline70', plot2: 'hline30', options: { color: 'rgba(128,128,128,0.05)', title: 'OB/OS Band' } },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'dispUp': dispUpPlot, 'dispDown': dispDownPlot, 'hline70': hline70Plot, 'hline30': hline30Plot },
    hlines: [
      { value: 70, options: { color: '#D4D4D4', linestyle: 'dotted' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#D4D4D4', linestyle: 'dotted' as const, title: 'Oversold' } },
    ],
    fills,
  };
}

export const RSIBBDispersion = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
