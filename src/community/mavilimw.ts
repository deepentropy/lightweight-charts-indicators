/**
 * MavilimW
 *
 * Cascaded WMA chain: each level feeds into the next with increasing Fibonacci-like periods.
 * M1(fmal) → M2(smal) → M3(fmal+smal) → M4(smal+tmal) → M5(tmal+Fmal) → MAVW(Fmal+Ftmal)
 *
 * Reference: TradingView "MavilimW" by KivancOzbilgic
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MavilimWInputs {
  firstMALength: number;
  secondMALength: number;
}

export const defaultInputs: MavilimWInputs = {
  firstMALength: 3,
  secondMALength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'firstMALength', type: 'int', title: 'First MA Length', defval: 3, min: 1 },
  { id: 'secondMALength', type: 'int', title: 'Second MA Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MavilimW', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MavWOld', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'MavilimW',
  shortTitle: 'MAVW',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MavilimWInputs> = {}): IndicatorResult {
  const { firstMALength, secondMALength } = { ...defaultInputs, ...inputs };

  const fmal = firstMALength;
  const smal = secondMALength;
  const tmal = fmal + smal;
  const Fmal = smal + tmal;
  const Ftmal = tmal + Fmal;
  const Smal = Fmal + Ftmal;

  const close = getSourceSeries(bars, 'close');
  const m1 = ta.wma(close, fmal);
  const m2 = ta.wma(m1, smal);
  const m3 = ta.wma(m2, tmal);
  const m4 = ta.wma(m3, Fmal);
  const m5 = ta.wma(m4, Ftmal);
  const mavw = ta.wma(m5, Smal);

  const mavwArr = mavw.toArray();
  const warmup = Smal;
  const plot0 = mavwArr.map((v, i) => {
    const val = i < warmup ? NaN : (v ?? NaN);
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (mavwArr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#2962FF' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: val, color };
  });

  // MavWOld: fixed Fibonacci periods 3/5/8/13/21/34
  const m1Old = ta.wma(close, 3);
  const m2Old = ta.wma(m1Old, 5);
  const m3Old = ta.wma(m2Old, 8);
  const m4Old = ta.wma(m3Old, 13);
  const m5Old = ta.wma(m4Old, 21);
  const mavwOld = ta.wma(m5Old, 34);
  const mavwOldArr = mavwOld.toArray();
  const warmupOld = 34;
  const plot1 = mavwOldArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmupOld || v == null || isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const MavilimW = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
