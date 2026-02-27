/**
 * RedK Trader Pressure Index (TPX v1.0)
 *
 * Measures bull/bear pressure from high/low changes relative to
 * a 2-bar range baseline. Bull pressure = how far bulls pull
 * highs and lows up; bear pressure = how far bears push them down.
 * Net pressure (TPX) is the WMA-smoothed difference.
 *
 * Reference: TradingView "RedK Trader Pressure Index (TPX)" by RedKTrader
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RedKTPXInputs {
  length: number;
  smooth: number;
  controlLevel: number;
}

export const defaultInputs: RedKTPXInputs = {
  length: 7,
  smooth: 3,
  controlLevel: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Avg Length', defval: 7, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 3, min: 1 },
  { id: 'controlLevel', type: 'int', title: 'Control Level', defval: 30, min: 5, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Pressure', color: '#33ff0099', lineWidth: 3 },
  { id: 'plot1', title: 'Bear Pressure', color: '#ff111166', lineWidth: 3 },
  { id: 'plot2', title: 'Net Pressure', color: '#ffffff', lineWidth: 3 },
];

export const metadata = {
  title: 'RedK Trader Pressure Index',
  shortTitle: 'RedK TPX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RedKTPXInputs> = {}): IndicatorResult {
  const { length, smooth, controlLevel } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  // 2-bar range: R = highest(2) - lowest(2)
  const highest2Arr = ta.highest(high, 2).toArray();
  const lowest2Arr = ta.lowest(low, 2).toArray();

  // Change in high and low (1-bar)
  const hiChangeArr = ta.change(high, 1).toArray();
  const loChangeArr = ta.change(low, 1).toArray();

  // Calculate raw bull and bear pressure bar-by-bar
  const bullsArr: number[] = new Array(n);
  const bearsArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const h2 = highest2Arr[i];
    const l2 = lowest2Arr[i];
    const R = (h2 != null && l2 != null && !isNaN(h2) && !isNaN(l2)) ? h2 - l2 : 0;

    const hiChg = hiChangeArr[i];
    const loChg = loChangeArr[i];

    if (R === 0 || i === 0) {
      bullsArr[i] = 0;
      bearsArr[i] = 0;
      continue;
    }

    // Bull pressure: how far bulls pull high and low up
    const hiup = Math.max(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
    const loup = Math.max(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
    bullsArr[i] = Math.min((hiup + loup) / R, 1) * 100;

    // Bear pressure: how far bears push high and low down (converted to positive)
    const hidn = Math.min(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
    const lodn = Math.min(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
    bearsArr[i] = Math.max((hidn + lodn) / R, -1) * -100;
  }

  // WMA of bull and bear pressure
  const bullsSeries = Series.fromArray(bars, bullsArr);
  const bearsSeries = Series.fromArray(bars, bearsArr);
  const avgBullsArr = ta.wma(bullsSeries, length).toArray();
  const avgBearsArr = ta.wma(bearsSeries, length).toArray();

  // Net = avgBulls - avgBears, then WMA smooth
  const netArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ab = avgBullsArr[i];
    const abear = avgBearsArr[i];
    const abVal = (ab != null && !isNaN(ab)) ? ab : 0;
    const abearVal = (abear != null && !isNaN(abear)) ? abear : 0;
    netArr[i] = abVal - abearVal;
  }

  const netSeries = Series.fromArray(bars, netArr);
  const tpxArr = ta.wma(netSeries, smooth).toArray();

  const warmup = length + smooth;

  const plot0 = avgBullsArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  const plot1 = avgBearsArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  const plot2 = tpxArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [
      { value: 0, options: { color: '#ffee00', linestyle: 'solid' as const, title: 'Zero' } },
      { value: controlLevel, options: { color: '#ffee00', linestyle: 'dotted' as const, title: 'Control Level' } },
    ],
  };
}

export const RedKTPX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
