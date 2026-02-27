/**
 * RSI Based Automatic Supply and Demand
 *
 * RSI-based supply and demand zone indicator. Tracks when RSI stays
 * OB/OS for consecutive bars (confirmation count). When confirmation
 * bars are met, records the high/low of that bar as zone boundaries.
 * Uses fixnan (carry forward last non-NaN) to maintain zone levels.
 * Simplified from 4 RSI periods to 1 configurable RSI.
 *
 * Reference: TradingView "RSI Supply/Demand" by shtcoinr / Lij_MC
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RsiSupplyDemandInputs {
  rsiLength: number;
  obLevel: number;
  osLevel: number;
  confirmationBars: number;
  showSD: boolean;
  showSupport: boolean;
  showResistance: boolean;
}

export const defaultInputs: RsiSupplyDemandInputs = {
  rsiLength: 14,
  obLevel: 70,
  osLevel: 30,
  confirmationBars: 3,
  showSD: true,
  showSupport: false,
  showResistance: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought Level', defval: 70, min: 50, max: 100 },
  { id: 'osLevel', type: 'int', title: 'Oversold Level', defval: 30, min: 0, max: 50 },
  { id: 'confirmationBars', type: 'int', title: 'Confirmation Bars', defval: 3, min: 1 },
  { id: 'showSD', type: 'bool', title: 'Show Supply/Demand Zone', defval: true },
  { id: 'showSupport', type: 'bool', title: 'Show Support Zone', defval: false },
  { id: 'showResistance', type: 'bool', title: 'Show Resistance Zone', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'sdHigh', title: 'S/D Zone High', color: '#3366FF', lineWidth: 1 },
  { id: 'sdLow', title: 'S/D Zone Low', color: '#3366FF', lineWidth: 1 },
  { id: 'resistanceHigh', title: 'Resistance High', color: '#FF3333', lineWidth: 1 },
  { id: 'resistanceLow', title: 'Resistance Low', color: '#FF3333', lineWidth: 1 },
  { id: 'supportHigh', title: 'Support High', color: '#33FF33', lineWidth: 1 },
  { id: 'supportLow', title: 'Support Low', color: '#33FF33', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Supply/Demand',
  shortTitle: 'RSI S/D',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RsiSupplyDemandInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closeSeries = new Series(bars, b => b.close);
  const rsiArr = ta.rsi(closeSeries, cfg.rsiLength).toArray();

  const warmup = cfg.rsiLength + 1;

  // Combined S/D zone (OB or OS)
  const rsx: number[] = new Array(n).fill(0);
  const sdRawH: number[] = new Array(n).fill(NaN);
  const sdRawL: number[] = new Array(n).fill(NaN);

  // Resistance zone (OB only)
  const rsu: number[] = new Array(n).fill(0);
  const resRawH: number[] = new Array(n).fill(NaN);
  const resRawL: number[] = new Array(n).fill(NaN);

  // Support zone (OS only)
  const rsd: number[] = new Array(n).fill(0);
  const supRawH: number[] = new Array(n).fill(NaN);
  const supRawL: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    const rsiVal = rsiArr[i] ?? NaN;
    const isOB = rsiVal > cfg.obLevel;
    const isOS = rsiVal < cfg.osLevel;
    const isEither = isOB || isOS;

    // Combined S/D counter
    if (isEither) {
      rsx[i] = (i > 0 ? rsx[i - 1] : 0) + 1;
    } else {
      rsx[i] = 0;
    }

    if (rsx[i] >= cfg.confirmationBars) {
      sdRawH[i] = bars[i].high;
      sdRawL[i] = bars[i].low;
    }

    // Resistance counter (OB)
    if (isOB) {
      rsu[i] = (i > 0 ? rsu[i - 1] : 0) + 1;
    } else {
      rsu[i] = 0;
    }

    if (rsu[i] >= cfg.confirmationBars) {
      resRawH[i] = bars[i].high;
      resRawL[i] = bars[i].low;
    }

    // Support counter (OS)
    if (isOS) {
      rsd[i] = (i > 0 ? rsd[i - 1] : 0) + 1;
    } else {
      rsd[i] = 0;
    }

    if (rsd[i] >= cfg.confirmationBars) {
      supRawH[i] = bars[i].high;
      supRawL[i] = bars[i].low;
    }
  }

  // fixnan: carry forward last non-NaN value
  function fixnan(arr: number[]): number[] {
    const result: number[] = new Array(arr.length).fill(NaN);
    let lastVal = NaN;
    for (let i = 0; i < arr.length; i++) {
      if (!isNaN(arr[i])) lastVal = arr[i];
      result[i] = lastVal;
    }
    return result;
  }

  const sdH = fixnan(sdRawH);
  const sdL = fixnan(sdRawL);
  const resH = fixnan(resRawH);
  const resL = fixnan(resRawL);
  const supH = fixnan(supRawH);
  const supL = fixnan(supRawL);

  // Colors: transparent when zone changes (new != prev), normal otherwise
  const sdColor = 'rgba(51,102,255,0.15)';
  const resColor = 'rgba(255,51,51,0.08)';
  const supColor = 'rgba(51,255,51,0.08)';
  const transparent = 'transparent';

  const sdFillColors: string[] = new Array(n).fill(transparent);
  const resFillColors: string[] = new Array(n).fill(transparent);
  const supFillColors: string[] = new Array(n).fill(transparent);

  for (let i = 0; i < n; i++) {
    if (i < warmup) continue;
    // S/D: gap color when zone changes
    sdFillColors[i] = (i > 0 && sdH[i] !== sdH[i - 1]) ? transparent : sdColor;
    resFillColors[i] = (i > 0 && resH[i] !== resH[i - 1]) ? transparent : resColor;
    supFillColors[i] = (i > 0 && supL[i] !== supL[i - 1]) ? transparent : supColor;
  }

  // Markers when price enters S/D zone
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    if (i < warmup || isNaN(sdH[i]) || isNaN(sdL[i])) continue;
    // Zone must be stable (not just changed)
    if (sdH[i] !== sdH[i - 1]) continue;
    const inZone = bars[i].close <= sdH[i] && bars[i].close >= sdL[i];
    const prevInZone = bars[i - 1].close <= sdH[i - 1] && bars[i - 1].close >= sdL[i - 1];
    if (inZone && !prevInZone) {
      markers.push({
        time: bars[i].time,
        position: 'inBar',
        shape: 'diamond',
        color: '#3366FF',
        text: 'S/D',
      });
    }
  }

  // Build plots
  const plotSdHigh = sdH.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showSD) ? NaN : v }));
  const plotSdLow = sdL.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showSD) ? NaN : v }));
  const plotResHigh = resH.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showResistance) ? NaN : v }));
  const plotResLow = resL.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showResistance) ? NaN : v }));
  const plotSupHigh = supH.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showSupport) ? NaN : v }));
  const plotSupLow = supL.map((v, i) => ({ time: bars[i].time, value: (i < warmup || !cfg.showSupport) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      sdHigh: plotSdHigh,
      sdLow: plotSdLow,
      resistanceHigh: plotResHigh,
      resistanceLow: plotResLow,
      supportHigh: plotSupHigh,
      supportLow: plotSupLow,
    },
    fills: [
      { plot1: 'sdHigh', plot2: 'sdLow', options: { color: sdColor }, colors: sdFillColors },
      { plot1: 'resistanceHigh', plot2: 'resistanceLow', options: { color: resColor }, colors: resFillColors },
      { plot1: 'supportHigh', plot2: 'supportLow', options: { color: supColor }, colors: supFillColors },
    ],
    markers,
  };
}

export const RsiSupplyDemand = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
