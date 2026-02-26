/**
 * CM Laguerre PPO PercentileRank
 *
 * Laguerre filter-based PPO with percentile rank.
 * 4-element Laguerre filter produces a smoothed RSI, centered as PPO.
 * Percentile rank measures where current PPO sits relative to history.
 *
 * Reference: TradingView "CM_Laguerre PPO PercentileRank" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMLaguerrePPOInputs {
  gamma: number;
  pctLen: number;
}

export const defaultInputs: CMLaguerrePPOInputs = {
  gamma: 0.7,
  pctLen: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'gamma', type: 'float', title: 'Gamma', defval: 0.7, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'pctLen', type: 'int', title: 'Percentile Length', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre PPO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Percentile Rank', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Laguerre PPO PercentileRank',
  shortTitle: 'LagPPO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMLaguerrePPOInputs> = {}): IndicatorResult {
  const { gamma, pctLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Laguerre filter
  let L0 = 0, L1 = 0, L2 = 0, L3 = 0;
  const lagRsiArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const src = bars[i].close;
    const prevL0 = L0, prevL1 = L1, prevL2 = L2;

    L0 = (1 - gamma) * src + gamma * prevL0;
    L1 = -gamma * L0 + prevL0 + gamma * prevL1;
    L2 = -gamma * L1 + prevL1 + gamma * prevL2;
    L3 = -gamma * L2 + prevL2 + gamma * L3;

    // CU = sum of positive differences, CD = sum of negative differences
    let CU = 0, CD = 0;
    if (L0 >= L1) CU += (L0 - L1); else CD += (L1 - L0);
    if (L1 >= L2) CU += (L1 - L2); else CD += (L2 - L1);
    if (L2 >= L3) CU += (L2 - L3); else CD += (L3 - L2);

    lagRsiArr[i] = (CU + CD === 0) ? 0 : (CU / (CU + CD)) * 100;
  }

  // PPO centered at 50
  const ppoArr = lagRsiArr.map(v => v - 50);

  // Percentile rank over pctLen
  const pctRankArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < pctLen - 1) {
      pctRankArr[i] = NaN;
      continue;
    }
    let count = 0;
    for (let j = i - pctLen + 1; j <= i; j++) {
      if (ppoArr[j] <= ppoArr[i]) count++;
    }
    pctRankArr[i] = (count / pctLen) * 100;
  }

  const warmup = pctLen;

  const plot0 = ppoArr.map((v, i) => ({
    time: bars[i].time,
    value: i < 4 ? NaN : v,
  }));

  const plot1 = pctRankArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
      { value: 20, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const CMLaguerrePPO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
