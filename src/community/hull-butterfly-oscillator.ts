/**
 * Hull Butterfly Oscillator [LuxAlgo]
 *
 * Computes HMA and inverse HMA using custom WMA convolution coefficients.
 * hso = hma - inv_hma (Hull Squeeze Oscillator)
 * cmean = cumulative_mean(abs(hso)) * mult (dynamic levels)
 * Direction tracking with bullish/bearish dot signals at transitions.
 *
 * Reference: TradingView "Hull Butterfly Oscillator [LuxAlgo]"
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface HullButterflyOscInputs {
  length: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: HullButterflyOscInputs = {
  length: 14,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HSO Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'HSO Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Level', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Half', color: '#787B8680', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Half', color: '#787B8680', lineWidth: 1 },
  { id: 'plot5', title: 'Lower Level', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Hull Butterfly Oscillator',
  shortTitle: 'HBO',
  overlay: false,
};

function buildHullCoeffs(length: number): number[] {
  const shortLen = Math.floor(length / 2);
  const hullLen = Math.floor(Math.sqrt(length));

  const den1 = shortLen * (shortLen + 1) / 2;
  const den2 = length * (length + 1) / 2;
  const den3 = hullLen * (hullLen + 1) / 2;

  // Build linearly combined WMA coefficients
  const lcwaLen = length + hullLen - 1;
  const lcwaCoeffs: number[] = new Array(lcwaLen).fill(0);
  for (let i = 0; i < length; i++) {
    const sum1 = Math.max(shortLen - i, 0);
    const sum2 = length - i;
    const coeff = 2 * (sum1 / den1) - (sum2 / den2);
    lcwaCoeffs[length - 1 - i] = coeff;
  }

  // Convolve with WMA (hull_len window)
  const hullCoeffs: number[] = [];
  for (let i = hullLen; i <= lcwaLen; i++) {
    let sum3 = 0;
    for (let j = i - hullLen; j < i; j++) {
      sum3 += lcwaCoeffs[j] * (i - j);
    }
    hullCoeffs.unshift(sum3 / den3);
  }

  return hullCoeffs;
}

export function calculate(bars: Bar[], inputs: Partial<HullButterflyOscInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  const hullCoeffs = buildHullCoeffs(length);
  const coeffLen = hullCoeffs.length;
  const warmup = coeffLen;

  const hsoArr: number[] = [];
  const cmeanArr: number[] = [];
  let absSum = 0;
  let absCount = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i < warmup - 1) {
      hsoArr.push(NaN);
      cmeanArr.push(NaN);
      continue;
    }

    // HMA: sum(src[k] * hullCoeffs[k]) where k indexes back from current bar
    let hma = 0;
    let invHma = 0;
    let valid = true;
    for (let k = 0; k < coeffLen; k++) {
      const idx = i - k;
      if (idx < 0 || srcArr[idx] == null || isNaN(srcArr[idx])) {
        valid = false;
        break;
      }
      hma += srcArr[idx] * hullCoeffs[k];
      // Inverse HMA: reversed source order
      const invIdx = i - (coeffLen - 1 - k);
      invHma += srcArr[invIdx] * hullCoeffs[k];
    }

    if (!valid) {
      hsoArr.push(NaN);
      cmeanArr.push(NaN);
      continue;
    }

    const hso = hma - invHma;
    hsoArr.push(hso);

    // Cumulative mean of abs(hso)
    absSum += Math.abs(hso);
    absCount++;
    cmeanArr.push((absSum / absCount) * mult);
  }

  // Direction tracking (os)
  const osArr: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const hso = hsoArr[i];
    const prevHso = hsoArr[i - 1];
    const cm = cmeanArr[i];
    if (isNaN(hso) || isNaN(cm)) {
      osArr[i] = 0;
      continue;
    }
    const prevOs = osArr[i - 1];

    if (hso > cm) {
      // Above upper level: check if declining
      osArr[i] = (!isNaN(prevHso) && hso < prevHso) ? -1 : 0;
    } else if (hso < -cm) {
      // Below lower level: check if rising
      osArr[i] = (!isNaN(prevHso) && hso > prevHso) ? 1 : 0;
    } else {
      osArr[i] = prevOs;
    }
  }

  // Histogram plot with gradient coloring
  const histPlot = hsoArr.map((hso, i) => {
    if (isNaN(hso)) return { time: bars[i].time, value: NaN };
    const cm = cmeanArr[i];
    let color: string;
    if (hso > 0) {
      // Green gradient based on how close to cmean
      const ratio = !isNaN(cm) && cm > 0 ? Math.min(hso / cm, 1) : 0.5;
      const g = Math.round(100 + 155 * ratio);
      color = `rgb(0,${g},0)`;
    } else {
      const ratio = !isNaN(cm) && cm > 0 ? Math.min(Math.abs(hso) / cm, 1) : 0.5;
      const r = Math.round(100 + 155 * ratio);
      color = `rgb(${r},0,0)`;
    }
    return { time: bars[i].time, value: hso, color };
  });

  // HSO line
  const linePlot = hsoArr.map((hso, i) => ({
    time: bars[i].time,
    value: isNaN(hso) ? NaN : hso,
  }));

  // Level lines
  const upperPlot = cmeanArr.map((cm, i) => ({
    time: bars[i].time,
    value: isNaN(cm) ? NaN : cm,
  }));
  const upperHalfPlot = cmeanArr.map((cm, i) => ({
    time: bars[i].time,
    value: isNaN(cm) ? NaN : cm / 2,
  }));
  const lowerHalfPlot = cmeanArr.map((cm, i) => ({
    time: bars[i].time,
    value: isNaN(cm) ? NaN : -cm / 2,
  }));
  const lowerPlot = cmeanArr.map((cm, i) => ({
    time: bars[i].time,
    value: isNaN(cm) ? NaN : -cm,
  }));

  // Markers at direction changes
  const markers: MarkerData[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (isNaN(hsoArr[i])) continue;
    if (osArr[i] === 1 && osArr[i - 1] !== 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: '#00E676', text: '' });
    }
    if (osArr[i] === -1 && osArr[i - 1] !== -1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: '#FF5252', text: '' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': histPlot,
      'plot1': linePlot,
      'plot2': upperPlot,
      'plot3': upperHalfPlot,
      'plot4': lowerHalfPlot,
      'plot5': lowerPlot,
    },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid', linewidth: 1, title: 'Zero' } }],
    markers,
  };
}

export const HullButterflyOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
