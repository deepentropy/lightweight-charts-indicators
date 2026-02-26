/**
 * Trend Magic
 *
 * CCI-directed ATR trailing stop.
 * When CCI >= 0: trailing support (bufferUp) ratchets upward.
 * When CCI <= 0: trailing resistance (bufferDn) ratchets downward.
 * On CCI zero-cross, the opposite buffer seeds from the previous value.
 *
 * Reference: TradingView "Trend Magic"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TrendMagicInputs {
  cciPeriod: number;
  atrPeriod: number;
  atrMultiplier: number;
}

export const defaultInputs: TrendMagicInputs = {
  cciPeriod: 20,
  atrPeriod: 5,
  atrMultiplier: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciPeriod', type: 'int', title: 'CCI Period', defval: 20, min: 1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 5, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 1, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Magic', color: '#26A69A', lineWidth: 3 },
];

export const metadata = {
  title: 'Trend Magic',
  shortTitle: 'TM',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendMagicInputs> = {}): IndicatorResult {
  const { cciPeriod, atrPeriod, atrMultiplier } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const cciArr = ta.cci(close, cciPeriod).toArray();
  // PineScript uses sma(tr, period) not ta.atr for Trend Magic
  const trSeries = ta.tr(bars);
  const atrArr = ta.sma(trSeries, atrPeriod).toArray();

  const bufferUp: number[] = new Array(n);
  const bufferDn: number[] = new Array(n);
  const tmArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const thisCCI = cciArr[i] ?? 0;
    const lastCCI = i > 0 ? (cciArr[i - 1] ?? 0) : 0;
    const atr = (atrArr[i] ?? 0) * atrMultiplier;

    bufferDn[i] = bars[i].high + atr;
    bufferUp[i] = bars[i].low - atr;

    if (thisCCI >= 0 && lastCCI < 0) {
      bufferUp[i] = i > 0 ? bufferDn[i - 1] : bufferDn[i];
    }
    if (thisCCI <= 0 && lastCCI > 0) {
      bufferDn[i] = i > 0 ? bufferUp[i - 1] : bufferUp[i];
    }

    if (thisCCI >= 0) {
      if (i > 0 && bufferUp[i] < bufferUp[i - 1]) {
        bufferUp[i] = bufferUp[i - 1];
      }
    } else {
      if (i > 0 && bufferDn[i] > bufferDn[i - 1]) {
        bufferDn[i] = bufferDn[i - 1];
      }
    }

    tmArr[i] = thisCCI >= 0 ? bufferUp[i] : bufferDn[i];
  }

  const warmup = Math.max(cciPeriod, atrPeriod);
  const plot0 = tmArr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const TrendMagic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
