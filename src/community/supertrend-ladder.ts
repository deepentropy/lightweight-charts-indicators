/**
 * SuperTrend Ladder ATR
 *
 * Multiple supertrend levels at different ATR multipliers creating a "ladder".
 * Three supertrend lines at mult1, mult2, mult3 for layered support/resistance.
 *
 * Reference: TradingView "SuperTrend Ladder ATR" (TV#681)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SupertrendLadderInputs {
  atrPeriod: number;
  mult1: number;
  mult2: number;
  mult3: number;
}

export const defaultInputs: SupertrendLadderInputs = {
  atrPeriod: 10,
  mult1: 1.0,
  mult2: 2.0,
  mult3: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 10, min: 1 },
  { id: 'mult1', type: 'float', title: 'Multiplier 1', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'mult2', type: 'float', title: 'Multiplier 2', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'mult3', type: 'float', title: 'Multiplier 3', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ST 1', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: 'ST 2', color: '#FF9800', lineWidth: 2 },
  { id: 'plot2', title: 'ST 3', color: '#F44336', lineWidth: 2 },
];

export const metadata = {
  title: 'SuperTrend Ladder ATR',
  shortTitle: 'STLadder',
  overlay: true,
};

function calcSupertrend(bars: Bar[], atrArr: (number | null)[], factor: number): { st: number[]; dir: number[] } {
  const n = bars.length;
  const st: number[] = new Array(n);
  const dir: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = ((atrArr[i] ?? 0) as number) * factor;
    const up = hl2 - atr;
    const dn = hl2 + atr;

    if (i === 0) {
      st[i] = up;
      dir[i] = 1;
      continue;
    }

    const prevDir = dir[i - 1];
    const prevSt = st[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) {
        dir[i] = -1;
        st[i] = trailDn;
      } else {
        dir[i] = 1;
        st[i] = trailUp;
      }
    } else {
      if (close > trailDn) {
        dir[i] = 1;
        st[i] = trailUp;
      } else {
        dir[i] = -1;
        st[i] = trailDn;
      }
    }
  }

  return { st, dir };
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendLadderInputs> = {}): IndicatorResult {
  const { atrPeriod, mult1, mult2, mult3 } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrPeriod).toArray();

  const st1 = calcSupertrend(bars, atrArr, mult1);
  const st2 = calcSupertrend(bars, atrArr, mult2);
  const st3 = calcSupertrend(bars, atrArr, mult3);

  const warmup = atrPeriod;

  const makePlot = (data: { st: number[]; dir: number[] }) =>
    data.st.map((v, i) => {
      if (i < warmup) return { time: bars[i].time, value: NaN };
      const color = data.dir[i] === 1 ? '#26A69A' : '#EF5350';
      return { time: bars[i].time, value: v, color };
    });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': makePlot(st1), 'plot1': makePlot(st2), 'plot2': makePlot(st3) },
  };
}

export const SupertrendLadder = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
