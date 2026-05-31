/**
 * Volatility Stop
 *
 * An ATR-based trailing stop (SAR-like). Flips between long and short when price
 * crosses the stop. Mirrors TradingView's built-in "Volatility Stop"
 * (STD;Volatility_Stop):
 *
 *   atrM = nz(atr(length) * factor, tr)
 *   max  = max(max, src);  min = min(min, src)
 *   stop = uptrend ? max(stop, max - atrM) : min(stop, min + atrM)
 *   uptrend = src - stop >= 0
 *   on flip: reset max/min to src and stop to the opposite band
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolatilityStopInputs {
  /** ATR length */
  length: number;
  /** ATR multiplier */
  factor: number;
}

export const defaultInputs: VolatilityStopInputs = {
  length: 20,
  factor: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'factor', type: 'float', title: 'ATR Factor', defval: 2.0, min: 0.25, step: 0.25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volatility Stop (Long)', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Volatility Stop (Short)', color: '#F23645', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Volatility Stop',
  shortTitle: 'VStop',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolatilityStopInputs> = {}): IndicatorResult {
  const { length, factor } = { ...defaultInputs, ...inputs };

  const trArr = ta.tr(bars, true).toArray();                    // true range (handlena)
  const atrArr = ta.rma(ta.tr(bars, true), length).toArray();    // atr = rma(tr, length)

  const longData: { time: number; value: number }[] = [];
  const shortData: { time: number; value: number }[] = [];

  let max = NaN;
  let min = NaN;
  let uptrend: boolean = true;
  let stop = NaN;

  for (let i = 0; i < bars.length; i++) {
    const src = bars[i].close;
    const atr = atrArr[i];
    const atrM = atr != null && !isNaN(atr) ? atr * factor : (trArr[i] ?? 0);

    if (i === 0) {
      max = src;
      min = src;
    } else {
      max = Math.max(max, src);
      min = Math.min(min, src);
    }

    // stop := nz(uptrend ? max(stop, max - atrM) : min(stop, min + atrM), src)
    let next: number = uptrend
      ? (isNaN(stop) ? max - atrM : Math.max(stop, max - atrM))
      : (isNaN(stop) ? min + atrM : Math.min(stop, min + atrM));
    if (isNaN(next)) next = src;
    stop = next;

    const prevUptrend: boolean = uptrend;
    uptrend = src - stop >= 0;

    if (uptrend !== prevUptrend) {
      max = src;
      min = src;
      stop = uptrend ? max - atrM : min + atrM;
    }

    longData.push({ time: bars[i].time, value: uptrend ? stop : NaN });
    shortData.push({ time: bars[i].time, value: uptrend ? NaN : stop });
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': longData,
      'plot1': shortData,
    },
  };
}

export const VolatilityStop = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
