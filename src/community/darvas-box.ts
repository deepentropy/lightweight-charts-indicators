/**
 * DARVAS BOX
 *
 * Darvas Box trading method. Tracks N-bar highs to define box tops,
 * with box bottom as the lowest low during the lookback.
 * Box persists until price breaks above top or below bottom.
 *
 * Reference: TradingView "DARVAS BOX" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DarvasBoxInputs {
  boxLength: number;
}

export const defaultInputs: DarvasBoxInputs = {
  boxLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'boxLength', type: 'int', title: 'Box Length', defval: 5, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Box Top', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Box Bottom', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Darvas Box',
  shortTitle: 'Darvas',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<DarvasBoxInputs> = {}): IndicatorResult {
  const { boxLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hhArr = ta.highest(highSeries, boxLength).toArray();
  const llArr = ta.lowest(lowSeries, boxLength).toArray();

  const topArr: number[] = new Array(n).fill(NaN);
  const botArr: number[] = new Array(n).fill(NaN);

  let boxTop = NaN;
  let boxBot = NaN;

  for (let i = boxLength; i < n; i++) {
    const hh = hhArr[i] ?? bars[i].high;
    const ll = llArr[i] ?? bars[i].low;

    // Detect new high (potential new box)
    if (bars[i].high >= hh) {
      // New box: top = current high, bottom = lowest of lookback
      boxTop = bars[i].high;
      boxBot = ll;
    } else if (!isNaN(boxTop)) {
      // Check for breakout
      if (bars[i].close > boxTop) {
        // Upside breakout: start new box search
        boxTop = bars[i].high;
        boxBot = ll;
      } else if (bars[i].close < boxBot) {
        // Downside breakout: invalidate box
        boxTop = hh;
        boxBot = ll;
      }
    }

    topArr[i] = boxTop;
    botArr[i] = boxBot;
  }

  const plot0 = topArr.map((v, i) => ({
    time: bars[i].time,
    value: i < boxLength ? NaN : v,
  }));

  const plot1 = botArr.map((v, i) => ({
    time: bars[i].time,
    value: i < boxLength ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const DarvasBox = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
