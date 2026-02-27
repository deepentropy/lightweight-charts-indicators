/**
 * Ehlers MESA Adaptive Moving Average
 *
 * John Ehlers' MESA Adaptive Moving Average using Hilbert Transform
 * cycle measurement to derive an adaptive alpha for MAMA/FAMA.
 *
 * Reference: TradingView "MESA Adaptive Moving Average" by Ehlers
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface EhlersMESAMAInputs {
  fastLimit: number;
  slowLimit: number;
  src: SourceType;
}

export const defaultInputs: EhlersMESAMAInputs = {
  fastLimit: 0.5,
  slowLimit: 0.05,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLimit', type: 'float', title: 'Fast Limit', defval: 0.5, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'slowLimit', type: 'float', title: 'Slow Limit', defval: 0.05, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MAMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'FAMA', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Ehlers MESA Adaptive Moving Average',
  shortTitle: 'MESA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EhlersMESAMAInputs> = {}): IndicatorResult {
  const { fastLimit, slowLimit, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const srcArr = getSourceSeries(bars, src).toArray();

  const smooth: number[] = new Array(n).fill(0);
  const detrender: number[] = new Array(n).fill(0);
  const I1: number[] = new Array(n).fill(0);
  const Q1: number[] = new Array(n).fill(0);
  const jI: number[] = new Array(n).fill(0);
  const jQ: number[] = new Array(n).fill(0);
  const I2: number[] = new Array(n).fill(0);
  const Q2: number[] = new Array(n).fill(0);
  const Re: number[] = new Array(n).fill(0);
  const Im: number[] = new Array(n).fill(0);
  const period: number[] = new Array(n).fill(0);
  const smoothPeriod: number[] = new Array(n).fill(0);
  const phase: number[] = new Array(n).fill(0);
  const mama: number[] = new Array(n).fill(0);
  const fama: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const s = (idx: number) => (idx >= 0 && idx < n ? (srcArr[idx] ?? 0) : 0);

    // Smooth = (4*src + 3*src[1] + 2*src[2] + src[3]) / 10
    smooth[i] = (4 * s(i) + 3 * s(i - 1) + 2 * s(i - 2) + s(i - 3)) / 10;

    const prevPeriod = i > 0 ? period[i - 1] : 0;
    const hilbertCoeff = 0.075 * prevPeriod + 0.54;

    // Detrender
    const sm = (arr: number[], idx: number) => (idx >= 0 ? arr[idx] : 0);
    detrender[i] = (0.0962 * smooth[i] + 0.5769 * sm(smooth, i - 2) - 0.5769 * sm(smooth, i - 4) - 0.0962 * sm(smooth, i - 6)) * hilbertCoeff;

    // Q1
    Q1[i] = (0.0962 * detrender[i] + 0.5769 * sm(detrender, i - 2) - 0.5769 * sm(detrender, i - 4) - 0.0962 * sm(detrender, i - 6)) * hilbertCoeff;

    // I1 = detrender[3]
    I1[i] = sm(detrender, i - 3);

    // jI
    jI[i] = (0.0962 * I1[i] + 0.5769 * sm(I1, i - 2) - 0.5769 * sm(I1, i - 4) - 0.0962 * sm(I1, i - 6)) * hilbertCoeff;

    // jQ
    jQ[i] = (0.0962 * Q1[i] + 0.5769 * sm(Q1, i - 2) - 0.5769 * sm(Q1, i - 4) - 0.0962 * sm(Q1, i - 6)) * hilbertCoeff;

    // I2, Q2 with smoothing
    let rawI2 = I1[i] - jQ[i];
    let rawQ2 = Q1[i] + jI[i];
    const prevI2 = i > 0 ? I2[i - 1] : 0;
    const prevQ2 = i > 0 ? Q2[i - 1] : 0;
    I2[i] = 0.2 * rawI2 + 0.8 * prevI2;
    Q2[i] = 0.2 * rawQ2 + 0.8 * prevQ2;

    // Re, Im with smoothing
    const rawRe = I2[i] * prevI2 + Q2[i] * prevQ2;
    const rawIm = I2[i] * prevQ2 - Q2[i] * prevI2;
    const prevRe = i > 0 ? Re[i - 1] : 0;
    const prevIm = i > 0 ? Im[i - 1] : 0;
    Re[i] = 0.2 * rawRe + 0.8 * prevRe;
    Im[i] = 0.2 * rawIm + 0.8 * prevIm;

    // Period
    if (Im[i] !== 0 && Re[i] !== 0) {
      period[i] = 2 * Math.PI / Math.atan(Im[i] / Re[i]);
    } else {
      period[i] = prevPeriod;
    }
    // Clamp period
    if (period[i] > 1.5 * prevPeriod) period[i] = 1.5 * prevPeriod;
    if (period[i] < 0.67 * prevPeriod) period[i] = 0.67 * prevPeriod;
    if (period[i] < 6) period[i] = 6;
    if (period[i] > 50) period[i] = 50;

    // SmoothPeriod
    const prevSP = i > 0 ? smoothPeriod[i - 1] : 0;
    smoothPeriod[i] = 0.33 * period[i] + 0.67 * prevSP;

    // Phase
    if (I1[i] !== 0) {
      phase[i] = Math.atan(Q1[i] / I1[i]) * 180 / Math.PI;
    } else {
      phase[i] = i > 0 ? phase[i - 1] : 0;
    }

    // DeltaPhase and alpha
    let deltaPhase = (i > 0 ? phase[i - 1] : 0) - phase[i];
    if (deltaPhase < 1) deltaPhase = 1;

    let alpha = fastLimit / deltaPhase;
    if (alpha < slowLimit) alpha = slowLimit;
    if (alpha > fastLimit) alpha = fastLimit;

    // MAMA and FAMA
    const prevMama = i > 0 ? mama[i - 1] : s(i);
    const prevFama = i > 0 ? fama[i - 1] : s(i);
    mama[i] = alpha * s(i) + (1 - alpha) * prevMama;
    fama[i] = 0.5 * alpha * mama[i] + (1 - 0.5 * alpha) * prevFama;
  }

  const warmup = 50;
  const mamaPlot = mama.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v };
  });

  const famaPlot = fama.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v };
  });

  // markers: arrows on MAMA/FAMA crossover (Pine: plotarrow(cross(mama,fama) ? mama<fama?-1:1 : na))
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const prevMamaAbove = mama[i - 1] > fama[i - 1];
    const currMamaAbove = mama[i] > fama[i];
    if (prevMamaAbove !== currMamaAbove) {
      if (mama[i] > fama[i]) {
        // MAMA crossed above FAMA -> bullish arrow up
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#26A69A',
          text: 'Cross',
        });
      } else {
        // MAMA crossed below FAMA -> bearish arrow down
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: '#EF5350',
          text: 'Cross',
        });
      }
    }
  }

  // barcolor: lime when MAMA > FAMA, red otherwise (Pine: barcolor(mama>fama?lime:red))
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time,
      color: mama[i] > fama[i] ? '#00E676' : '#EF5350',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': mamaPlot, 'plot1': famaPlot },
    // fill between MAMA and FAMA (Pine: fill(duml, mamal, red, transp=70) and fill(duml, famal, green, transp=70))
    // Simplified as a single fill between plot0 (MAMA) and plot1 (FAMA)
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(38, 166, 154, 0.2)' } },
    ],
    markers,
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const EhlersMESAMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
