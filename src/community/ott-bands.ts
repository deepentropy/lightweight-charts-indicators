/**
 * OTT Bands
 *
 * OTT with upper and lower percentage bands.
 * Support line (VAR MA) with upper band and lower band
 * derived from the OTT trailing stop percentage offsets.
 *
 * Reference: TradingView "OTT Bands" (TV#492)
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface OTTBandsInputs {
  period: number;
  percent: number;
  upperCoeff: number;
  lowerCoeff: number;
  showFiboLines: boolean;
  showSupport: boolean;
  src: SourceType;
}

export const defaultInputs: OTTBandsInputs = {
  period: 2,
  percent: 15,
  upperCoeff: 0.1,
  lowerCoeff: 0.077,
  showFiboLines: false,
  showSupport: false,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'OTT Moving Average Length', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Optimization Coeff', defval: 15, min: 0, step: 0.1 },
  { id: 'upperCoeff', type: 'float', title: 'OTT Upper Band Coeff', defval: 0.1, min: 0, step: 0.001 },
  { id: 'lowerCoeff', type: 'float', title: 'OTT Lower Band Coeff', defval: 0.077, min: 0, step: 0.001 },
  { id: 'showFiboLines', type: 'bool', title: 'Show Fibonacci Levels?', defval: false },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ottMain', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  { id: 'support', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
  { id: 'ottUpper', title: 'OTT UPPER', color: '#4500C4', lineWidth: 2 },
  { id: 'ottUpperHalf', title: 'OTT UPPER HALF', color: '#8400FF', lineWidth: 1 },
  { id: 'ottUpperFibo', title: 'OTT UPPER FIBO', color: '#C830FF', lineWidth: 1 },
  { id: 'ottLower', title: 'OTT LOWER', color: '#00A6FF', lineWidth: 2 },
  { id: 'ottLowerHalf', title: 'OTT LOWER HALF', color: '#007BBD', lineWidth: 1 },
  { id: 'ottLowerFibo', title: 'OTT LOWER FIBO', color: '#024DE3', lineWidth: 1 },
];

export const metadata = {
  title: 'OTT Bands',
  shortTitle: 'OTTBands',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<OTTBandsInputs> = {}): IndicatorResult {
  const { period, percent, upperCoeff, lowerCoeff, showFiboLines, showSupport, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // VAR (Variable Index Dynamic Average) calculation
  const valpha = 2 / (period + 1);
  const mavg: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i] ?? 0;
    let vUD = 0;
    let vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      const cur = srcArr[j] ?? 0;
      const prev = j > 0 ? (srcArr[j - 1] ?? 0) : cur;
      if (cur > prev) vUD += cur - prev;
      if (cur < prev) vDD += prev - cur;
    }
    const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
    mavg[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * mavg[i - 1];
  }

  // OTT trailing stop logic
  const fark = mavg.map((v) => v * percent * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mavg[i] - fark[i];
    shortStop[i] = mavg[i] + fark[i];

    if (i > 0) {
      if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = period + 9;
  const X3 = upperCoeff;
  const X5 = lowerCoeff;

  // Pine: OTTMAIN=plot(nz(OTT[2]), color=#B800D9, linewidth=2)
  const ottMain = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] };
  });

  // Pine: plot(showsupport ? MAvg : na, color=OTTC, linewidth=2, title="Support Line")
  const support = mavg.map((v, i) => {
    if (i < warmup || !showSupport) return { time: bars[i].time, value: NaN };
    const color = (i > 0 && v > mavg[i - 1]) ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Pine: OTTUST=plot(nz(OTT[2])*(1+X3), color=#4500C4, linewidth=2)
  const ottUpper = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] * (1 + X3) };
  });

  // Pine: OTTUSTYARI=plot(showfibolines ? nz(OTT[2])*(1+X3*0.618) : nz(OTT[2])*(1+X3/2))
  const ottUpperHalf = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const base = ott[i - 2];
    return { time: bars[i].time, value: showFiboLines ? base * (1 + X3 * 0.618) : base * (1 + X3 / 2) };
  });

  // Pine: OTTFIBOUST2=plot(showfibolines ? nz(OTT[2])*(1+X3*0.382) : na)
  const ottUpperFibo = ott.map((_v, i) => {
    if (i < warmup + 2 || !showFiboLines) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] * (1 + X3 * 0.382) };
  });

  // Pine: OTTALT=plot(nz(OTT[2])*(1-X5), color=#00A6FF, linewidth=2)
  const ottLower = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] * (1 - X5) };
  });

  // Pine: OTTALTYARI=plot(showfibolines ? nz(OTT[2])*(1-X5*0.618) : nz(OTT[2])*(1-X5/2))
  const ottLowerHalf = ott.map((_v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const base = ott[i - 2];
    return { time: bars[i].time, value: showFiboLines ? base * (1 - X5 * 0.618) : base * (1 - X5 / 2) };
  });

  // Pine: OTTALTFIBO2=plot(showfibolines ? nz(OTT[2])*(1-X5*0.382) : na)
  const ottLowerFibo = ott.map((_v, i) => {
    if (i < warmup + 2 || !showFiboLines) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: ott[i - 2] * (1 - X5 * 0.382) };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'ottMain': ottMain, 'support': support,
      'ottUpper': ottUpper, 'ottUpperHalf': ottUpperHalf, 'ottUpperFibo': ottUpperFibo,
      'ottLower': ottLower, 'ottLowerHalf': ottLowerHalf, 'ottLowerFibo': ottLowerFibo,
    },
    fills: [
      // Pine: fill(OTTUST, OTTUSTYARI, color=#4500C4, transp=88)
      { plot1: 'ottUpper', plot2: 'ottUpperHalf', options: { color: 'rgba(69,0,196,0.12)' } },
      // Pine: fill(OTTFIBOUST2, OTTUSTYARI, color=#8400FF, transp=88)
      { plot1: 'ottUpperFibo', plot2: 'ottUpperHalf', options: { color: 'rgba(132,0,255,0.12)' } },
      // Pine: fill(OTTUSTYARI, OTTMAIN, color=#C810FF, transp=88)
      { plot1: 'ottUpperHalf', plot2: 'ottMain', options: { color: 'rgba(200,16,255,0.12)' } },
      // Pine: fill(OTTFIBOUST2, OTTMAIN, color=#C810FF, transp=88)
      { plot1: 'ottUpperFibo', plot2: 'ottMain', options: { color: 'rgba(200,16,255,0.12)' } },
      // Pine: fill(OTTALT, OTTALTYARI, color=#00A6FF, transp=88)
      { plot1: 'ottLower', plot2: 'ottLowerHalf', options: { color: 'rgba(0,166,255,0.12)' } },
      // Pine: fill(OTTALTFIBO2, OTTALTYARI, color=#007BBD, transp=88)
      { plot1: 'ottLowerFibo', plot2: 'ottLowerHalf', options: { color: 'rgba(0,123,189,0.12)' } },
      // Pine: fill(OTTALTYARI, OTTMAIN, color=#024DE3, transp=88)
      { plot1: 'ottLowerHalf', plot2: 'ottMain', options: { color: 'rgba(2,77,227,0.12)' } },
    ],
  };
}

export const OTTBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
