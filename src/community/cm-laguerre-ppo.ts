/**
 * CM Laguerre PPO PercentileRank
 *
 * Laguerre filter-based PPO with percentile rank.
 * 4-element Laguerre filter produces a smoothed RSI, centered as PPO.
 * Percentile rank measures where current PPO sits relative to history.
 *
 * Reference: "CM_Laguerre PPO PercentileRank" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMLaguerrePPOInputs {
  gamma: number;
  pctLen: number;
  pctile: number;
  wrnPctile: number;
}

export const defaultInputs: CMLaguerrePPOInputs = {
  gamma: 0.7,
  pctLen: 50,
  pctile: 90,
  wrnPctile: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'gamma', type: 'float', title: 'Gamma', defval: 0.7, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'pctLen', type: 'int', title: 'Percentile Length', defval: 50, min: 1 },
  { id: 'pctile', type: 'int', title: 'Extreme Threshold', defval: 90, min: 1, max: 100 },
  { id: 'wrnPctile', type: 'int', title: 'Warning Threshold', defval: 70, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre PPO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Percentile Rank Top', color: '#787B86', lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Percentile Rank Bottom', color: '#C0C0C0', lineWidth: 2, style: 'columns' },
  { id: 'zeroLine', title: '0 Line', color: '#C0C0C0', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'CM Laguerre PPO PercentileRank',
  shortTitle: 'LagPPO',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface LagVars {
  /** Laguerre filter state */
  L0: number;
  L1: number;
  L2: number;
  L3: number;
}

interface LagRun extends BarRunState<LagVars> {
  ppo: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  zeroLine: Point[];
}

function study(inputs: Partial<CMLaguerrePPOInputs>): BarStudy<LagRun, IndicatorResult> {
  const { gamma, pctLen, pctile, wrnPctile } = { ...defaultInputs, ...inputs };
  const warmup = pctLen;
  return {
    init() {
      const s: LagRun = {
        ppo: [], plot0: [], plot1: [], plot2: [], zeroLine: [],
        steps: [], vars: { L0: 0, L1: 0, L2: 0, L3: 0 }, lists: [], series: [],
      };
      s.series = [s.ppo, s.plot0, s.plot1, s.plot2, s.zeroLine];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v = s.vars;
      // Laguerre filter
      const src = b.close;
      const prevL0 = v.L0, prevL1 = v.L1, prevL2 = v.L2;

      const L0 = (1 - gamma) * src + gamma * prevL0;
      const L1 = -gamma * L0 + prevL0 + gamma * prevL1;
      const L2 = -gamma * L1 + prevL1 + gamma * prevL2;
      const L3 = -gamma * L2 + prevL2 + gamma * v.L3;
      v.L0 = L0; v.L1 = L1; v.L2 = L2; v.L3 = L3;

      // CU = sum of positive differences, CD = sum of negative differences
      let CU = 0, CD = 0;
      if (L0 >= L1) CU += (L0 - L1); else CD += (L1 - L0);
      if (L1 >= L2) CU += (L1 - L2); else CD += (L2 - L1);
      if (L2 >= L3) CU += (L2 - L3); else CD += (L3 - L2);

      const lagRsi = (CU + CD === 0) ? 0 : (CU / (CU + CD)) * 100;

      // PPO centered at 50
      const ppo = lagRsi - 50;
      const ppoArr = s.ppo;
      ppoArr[i] = ppo;

      // Percentile rank over pctLen
      let pctRank: number;
      if (i < pctLen - 1) {
        pctRank = NaN;
      } else {
        let count = 0;
        for (let j = i - pctLen + 1; j <= i; j++) {
          if (ppoArr[j]! <= ppoArr[i]!) count++;
        }
        pctRank = (count / pctLen) * 100;
      }

      s.plot0[i] = { time, value: i < 4 ? NaN : ppo };

      // Pine: pctRankT colored columns (positive percentile rank)
      // colT = pctRankT >= pctile ? red : pctRankT >= wrnpctile ? orange : gray
      // Pine: pctRankB = percentrank(ppoB, lkbB) * -1, colored columns (negative percentile rank)
      // colB = pctRankB <= -pctile ? lime : pctRankB <= -wrnpctile ? green : silver
      // We compute bottom rank as (100 - pctRankT) * -1 to approximate
      if (i < warmup || isNaN(pctRank)) {
        s.plot1[i] = { time, value: NaN };
        s.plot2[i] = { time, value: NaN };
      } else {
        const color = pctRank >= pctile ? '#EF5350' : pctRank >= wrnPctile ? '#FF9800' : '#787B86';
        s.plot1[i] = { time, value: pctRank, color };
        const bVal = -(100 - pctRank);
        const absBVal = Math.abs(bVal);
        const colorB = absBVal >= pctile ? '#00E676' : absBVal >= wrnPctile ? '#4CAF50' : '#C0C0C0';
        s.plot2[i] = { time, value: bVal, color: colorB };
      }

      // Pine: plot(0, title="0 Line Circles Plot", style=circles, linewidth=4, color=silver)
      s.zeroLine[i] = { time, value: 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'zeroLine': s.zeroLine.slice() },
        hlines: [
          { value: pctile, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Extreme Top' } },
          { value: wrnPctile, options: { color: '#FF9800', linestyle: 'solid' as const, title: 'Warning Top' } },
          { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
          { value: -wrnPctile, options: { color: '#4CAF50', linestyle: 'solid' as const, title: 'Warning Bottom' } },
          { value: -pctile, options: { color: '#00E676', linestyle: 'solid' as const, title: 'Extreme Bottom' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMLaguerrePPOInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMLaguerrePPOInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CMLaguerrePPO = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
