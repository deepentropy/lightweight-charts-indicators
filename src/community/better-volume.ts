/**
 * BetterVolume
 *
 * Analyzes volume distribution to detect climax, churn, and low volume conditions.
 * Divides volume into bull/bear components based on open/close within the true range,
 * then identifies specific volume patterns across a lookback period.
 *
 * Reference: TradingView "Better Volume Indicator [LazyBear]" by LazyBear
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface BetterVolumeInputs {
  length: number;
  enableBarColors: boolean;
  use2Bars: boolean;
  lowVol: boolean;
  climaxUp: boolean;
  climaxDown: boolean;
  churn: boolean;
  climaxChurn: boolean;
}

export const defaultInputs: BetterVolumeInputs = {
  length: 8,
  enableBarColors: false,
  use2Bars: true,
  lowVol: true,
  climaxUp: true,
  climaxDown: true,
  churn: true,
  climaxChurn: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback', defval: 8, min: 1 },
  { id: 'enableBarColors', type: 'bool', title: 'Enable Bar Colors', defval: false },
  { id: 'use2Bars', type: 'bool', title: 'Use 2 Bars', defval: true },
  { id: 'lowVol', type: 'bool', title: 'Low Volume', defval: true },
  { id: 'climaxUp', type: 'bool', title: 'Climax Up', defval: true },
  { id: 'climaxDown', type: 'bool', title: 'Climax Down', defval: true },
  { id: 'churn', type: 'bool', title: 'Churn', defval: true },
  { id: 'climaxChurn', type: 'bool', title: 'Climax Churn', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'vol', title: 'Volume', color: '#00FFFF', lineWidth: 1, style: 'columns' },
  { id: 'sma', title: 'SMA', color: '#FFA500', lineWidth: 2 },
];

export const metadata = {
  title: 'Better Volume Indicator',
  shortTitle: 'BVI',
  overlay: false,
};

const LOW_VOL_COLOR = '#FFFF00';     // yellow
const CLIMAX_UP_COLOR = '#FF0000';   // red
const CLIMAX_DOWN_COLOR = '#FFFFFF'; // white
const CHURN_COLOR = '#00FF00';       // green
const CLIMAX_CHURN_COLOR = '#8B008B'; // dark magenta
const DEF_COLOR = '#00FFFF';         // cyan

export function calculate(bars: Bar[], inputs: Partial<BetterVolumeInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;

  // Pre-compute true range, volume, and components
  const trArr = ta.tr(bars).toArray();
  const volArr = bars.map(b => b.volume ?? 0);

  // v1 (buy volume), v2 (sell volume) per Pine formula
  const v1Arr: number[] = new Array(n);
  const v2Arr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const range = trArr[i] ?? 0;
    const v = volArr[i];
    const o = bars[i].open;
    const c = bars[i].close;

    if (range === 0) {
      v1Arr[i] = v / 2;
      v2Arr[i] = v / 2;
    } else if (c >= o) {
      // Pine: v * ((range) / ((2+(range*range)/10) * range + (open - close)))
      const denom = (2 + (range * range) / 10) * range + (o - c);
      v1Arr[i] = denom === 0 ? v / 2 : v * (range / denom);
      v2Arr[i] = v - v1Arr[i];
    } else {
      // Pine: v * (((range + close - open)) / (2+(range*range)/10) * range + (close - open))
      const denom = (2 + (range * range) / 10) * range + (c - o);
      v1Arr[i] = denom === 0 ? v / 2 : v * ((range + c - o) / denom);
      v2Arr[i] = v - v1Arr[i];
    }
  }

  // Compute derived series
  const v3Arr: number[] = new Array(n);  // v1 + v2 = v
  const v4Arr: number[] = new Array(n);  // v1 * range
  const v5Arr: number[] = new Array(n);  // (v1 - v2) * range
  const v6Arr: number[] = new Array(n);  // v2 * range
  const v7Arr: number[] = new Array(n);  // (v2 - v1) * range
  const v8Arr: number[] = new Array(n);  // v1 / range
  const v9Arr: number[] = new Array(n);  // (v1 - v2) / range
  const v10Arr: number[] = new Array(n); // v2 / range
  const v11Arr: number[] = new Array(n); // (v2 - v1) / range
  const v12Arr: number[] = new Array(n); // v3 / range
  const v13Arr: number[] = new Array(n); // use2Bars: v3 + v3[1]
  const v14Arr: number[] = new Array(n);
  const v15Arr: number[] = new Array(n);
  const v16Arr: number[] = new Array(n);
  const v17Arr: number[] = new Array(n);
  const v18Arr: number[] = new Array(n);
  const v19Arr: number[] = new Array(n);
  const v20Arr: number[] = new Array(n);
  const v21Arr: number[] = new Array(n);
  const v22Arr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const range = trArr[i] ?? 0;
    const v1 = v1Arr[i];
    const v2 = v2Arr[i];
    v3Arr[i] = v1 + v2;
    v4Arr[i] = v1 * range;
    v5Arr[i] = (v1 - v2) * range;
    v6Arr[i] = v2 * range;
    v7Arr[i] = (v2 - v1) * range;
    v8Arr[i] = range !== 0 ? v1 / range : 1;
    v9Arr[i] = range !== 0 ? (v1 - v2) / range : 1;
    v10Arr[i] = range !== 0 ? v2 / range : 1;
    v11Arr[i] = range !== 0 ? (v2 - v1) / range : 1;
    v12Arr[i] = range !== 0 ? v3Arr[i] / range : 1;

    if (cfg.use2Bars && i > 0) {
      v13Arr[i] = v3Arr[i] + v3Arr[i - 1];
      const hh2 = Math.max(bars[i].high, bars[i - 1].high);
      const ll2 = Math.min(bars[i].low, bars[i - 1].low);
      const range2 = hh2 - ll2;
      v14Arr[i] = (v1 + v1Arr[i - 1]) * range2;
      v15Arr[i] = (v1 + v1Arr[i - 1] - v2 - v2Arr[i - 1]) * range2;
      v16Arr[i] = (v2 + v2Arr[i - 1]) * range2;
      v17Arr[i] = (v2 + v2Arr[i - 1] - v1 - v1Arr[i - 1]) * range2;
      v18Arr[i] = range2 !== 0 ? (v1 + v1Arr[i - 1]) / range2 : 1;
      v19Arr[i] = range2 !== 0 ? (v1 + v1Arr[i - 1] - v2 - v2Arr[i - 1]) / range2 : 1;
      v20Arr[i] = range2 !== 0 ? (v2 + v2Arr[i - 1]) / range2 : 1;
      v21Arr[i] = range2 !== 0 ? (v2 + v2Arr[i - 1] - v1 - v1Arr[i - 1]) / range2 : 1;
      v22Arr[i] = range2 !== 0 ? v13Arr[i] / range2 : 1;
    } else {
      v13Arr[i] = 1;
      v14Arr[i] = 1;
      v15Arr[i] = 1;
      v16Arr[i] = 1;
      v17Arr[i] = 1;
      v18Arr[i] = 1;
      v19Arr[i] = 1;
      v20Arr[i] = 1;
      v21Arr[i] = 1;
      v22Arr[i] = 1;
    }
  }

  // Rolling highest/lowest functions
  function rollingHighest(arr: number[], period: number): number[] {
    const out = new Array(arr.length).fill(NaN);
    for (let i = 0; i < arr.length; i++) {
      let max = -Infinity;
      const start = Math.max(0, i - period + 1);
      for (let j = start; j <= i; j++) max = Math.max(max, arr[j]);
      out[i] = max;
    }
    return out;
  }

  function rollingLowest(arr: number[], period: number): number[] {
    const out = new Array(arr.length).fill(NaN);
    for (let i = 0; i < arr.length; i++) {
      let min = Infinity;
      const start = Math.max(0, i - period + 1);
      for (let j = start; j <= i; j++) min = Math.min(min, arr[j]);
      out[i] = min;
    }
    return out;
  }

  const hv3 = rollingLowest(v3Arr, len);
  const hv4 = rollingHighest(v4Arr, len);
  const hv5 = rollingHighest(v5Arr, len);
  const hv6 = rollingHighest(v6Arr, len);
  const hv7 = rollingHighest(v7Arr, len);
  const lv8 = rollingLowest(v8Arr, len);
  const lv9 = rollingLowest(v9Arr, len);
  const lv10 = rollingLowest(v10Arr, len);
  const lv11 = rollingLowest(v11Arr, len);
  const hv12 = rollingHighest(v12Arr, len);
  const hv13 = rollingLowest(v13Arr, len);
  const hv14 = rollingHighest(v14Arr, len);
  const hv15 = rollingHighest(v15Arr, len);
  const lv16 = rollingLowest(v16Arr, len);
  const lv17 = rollingLowest(v17Arr, len);
  const lv18 = rollingLowest(v18Arr, len);
  const lv19 = rollingLowest(v19Arr, len);
  const lv20 = rollingLowest(v20Arr, len);
  const lv21 = rollingLowest(v21Arr, len);
  const lv22 = rollingLowest(v22Arr, len);

  // Compute condition flags and color per bar
  const colorArr: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const isUp = bars[i].close >= bars[i].open;
    const isDn = bars[i].close < bars[i].open;
    const prevUp = i > 0 ? bars[i - 1].close >= bars[i - 1].open : false;
    const prevDn = i > 0 ? bars[i - 1].close < bars[i - 1].open : false;

    const c1 = v3Arr[i] === hv3[i];
    const c2 = v4Arr[i] === hv4[i] && isUp;
    const c3 = v5Arr[i] === hv5[i] && isUp;
    const c4 = v6Arr[i] === hv6[i] && isDn;
    const c5 = v7Arr[i] === hv7[i] && isDn;
    const c6 = v8Arr[i] === lv8[i] && isDn;
    const c7 = v9Arr[i] === lv9[i] && isDn;
    const c8 = v10Arr[i] === lv10[i] && isUp;
    const c9 = v11Arr[i] === lv11[i] && isUp;
    const c10 = v12Arr[i] === hv12[i];
    const c11 = cfg.use2Bars && v13Arr[i] === hv13[i] && isUp && prevUp;
    const c12 = cfg.use2Bars && v14Arr[i] === hv14[i] && isUp && prevUp;
    const c13 = cfg.use2Bars && v15Arr[i] === hv15[i] && isUp && prevDn;
    const c14 = cfg.use2Bars && v16Arr[i] === lv16[i] && isDn && prevDn;
    const c15 = cfg.use2Bars && v17Arr[i] === lv17[i] && isDn && prevDn;
    const c16 = cfg.use2Bars && v18Arr[i] === lv18[i] && isDn && prevDn;
    const c17 = cfg.use2Bars && v19Arr[i] === lv19[i] && isUp && prevDn;
    const c18 = cfg.use2Bars && v20Arr[i] === lv20[i] && isUp && prevUp;
    const c19 = cfg.use2Bars && v21Arr[i] === lv21[i] && isUp && prevUp;
    const c20 = cfg.use2Bars && v22Arr[i] === lv22[i];

    // c0: climax up/down or churn or default
    let c0 = DEF_COLOR;
    if (cfg.climaxUp && (c2 || c3 || c8 || c9 || c12 || c13 || c18 || c19)) {
      c0 = CLIMAX_UP_COLOR;
    } else if (cfg.climaxDown && (c4 || c5 || c6 || c7 || c14 || c15 || c16 || c17)) {
      c0 = CLIMAX_DOWN_COLOR;
    } else if (cfg.churn && (c10 || c20)) {
      c0 = CHURN_COLOR;
    }

    // v_color: climaxChurn overrides, then lowVol, then c0
    let vColor = c0;
    if (cfg.climaxChurn && (c10 || c20) && (c2 || c3 || c4 || c5 || c6 || c7 || c8 || c9)) {
      vColor = CLIMAX_CHURN_COLOR;
    } else if (cfg.lowVol && (c1 || c11)) {
      vColor = LOW_VOL_COLOR;
    }

    colorArr[i] = vColor;
  }

  // SMA of volume
  const smaArr = ta.sma(new Series(bars, (b) => b.volume ?? 0), len).toArray();

  const warmup = len;

  // Plots: volume columns (colored) and SMA overlay
  // Pine: plot when NOT enableBarColors
  const volPlot = volArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.enableBarColors ? NaN : v),
    color: colorArr[i],
  }));

  const smaPlot = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (cfg.enableBarColors ? NaN : (v ?? NaN)),
  }));

  // barcolor when enableBarColors is true
  const barColors: BarColorData[] = [];
  if (cfg.enableBarColors) {
    for (let i = warmup; i < n; i++) {
      barColors.push({ time: bars[i].time, color: colorArr[i] });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { vol: volPlot, sma: smaPlot },
    barColors,
  };
}

export const BetterVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
