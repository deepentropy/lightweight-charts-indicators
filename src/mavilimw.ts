/**
 * MavilimW
 *
 * Cascaded WMA chain: each level feeds into the next with increasing Fibonacci-like periods.
 * M1(fmal) → M2(smal) → M3(fmal+smal) → M4(smal+tmal) → M5(tmal+Fmal) → MAVW(Fmal+Ftmal)
 *
 * Reference: TradingView "MavilimW" by KivancOzbilgic
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

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
  const plot0 = mavwArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : (v ?? NaN) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const MavilimW = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
