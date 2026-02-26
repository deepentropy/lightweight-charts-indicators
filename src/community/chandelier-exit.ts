/**
 * Chandelier Exit
 *
 * ATR-based trailing stop system.
 * Long stop: highest high - ATR*mult (ratchets up only)
 * Short stop: lowest low + ATR*mult (ratchets down only)
 * Direction flips when price crosses the opposite stop.
 *
 * Reference: TradingView "Chandelier Exit" by everget
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ChandelierExitInputs {
  atrPeriod: number;
  atrMult: number;
  useClose: boolean;
}

export const defaultInputs: ChandelierExitInputs = {
  atrPeriod: 22,
  atrMult: 3.0,
  useClose: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.01, step: 0.1 },
  { id: 'useClose', type: 'bool', title: 'Use Close for Extremums', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop', color: '#26A69A', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Short Stop', color: '#EF5350', lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Mid Price', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Chandelier Exit',
  shortTitle: 'CE',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ChandelierExitInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { atrPeriod, atrMult, useClose } = { ...defaultInputs, ...inputs };

  const atrSeries = ta.atr(bars, atrPeriod);
  const atrArr = atrSeries.toArray();

  const closeSeries = new Series(bars, (bar) => bar.close);
  const highSeries = new Series(bars, (bar) => bar.high);
  const lowSeries = new Series(bars, (bar) => bar.low);

  const highestSrc = useClose ? ta.highest(closeSeries, atrPeriod) : ta.highest(highSeries, atrPeriod);
  const lowestSrc = useClose ? ta.lowest(closeSeries, atrPeriod) : ta.lowest(lowSeries, atrPeriod);
  const highestArr = highestSrc.toArray();
  const lowestArr = lowestSrc.toArray();

  const longStopArr: number[] = [];
  const shortStopArr: number[] = [];
  const dirArr: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const atrVal = (atrArr[i] ?? 0) * atrMult;
    let longStop = (highestArr[i] ?? bars[i].high) - atrVal;
    let shortStop = (lowestArr[i] ?? bars[i].low) + atrVal;

    if (i > 0) {
      const prevLongStop = longStopArr[i - 1];
      const prevShortStop = shortStopArr[i - 1];
      const prevClose = bars[i - 1].close;

      // Ratchet: only move stop in favorable direction
      if (prevClose > prevLongStop) {
        longStop = Math.max(longStop, prevLongStop);
      }
      if (prevClose < prevShortStop) {
        shortStop = Math.min(shortStop, prevShortStop);
      }

      // Direction
      const prevDir = dirArr[i - 1];
      const close = bars[i].close;
      if (close > prevShortStop) {
        dirArr.push(1);
      } else if (close < prevLongStop) {
        dirArr.push(-1);
      } else {
        dirArr.push(prevDir);
      }
    } else {
      dirArr.push(1);
    }

    longStopArr.push(longStop);
    shortStopArr.push(shortStop);
  }

  const warmup = atrPeriod;
  const longData = longStopArr.map((value, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (dirArr[i] === 1 ? value : NaN),
  }));

  const shortData = shortStopArr.map((value, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (dirArr[i] === -1 ? value : NaN),
  }));

  // Hidden ohlc4 plot for fills
  const midData = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup ? NaN : (b.open + b.high + b.low + b.close) / 4,
  }));

  // Markers: buy/sell on direction change
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    if (dirArr[i] !== dirArr[i - 1]) {
      if (dirArr[i] === 1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      } else {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
    }
  }

  // Dynamic fill colors: green when long (dir=1), red when short (dir=-1)
  const longFillColors = bars.map((_b, i) => {
    if (i < warmup) return 'transparent';
    return dirArr[i] === 1 ? 'rgba(38,166,154,0.15)' : 'transparent';
  });
  const shortFillColors = bars.map((_b, i) => {
    if (i < warmup) return 'transparent';
    return dirArr[i] === -1 ? 'rgba(239,83,80,0.15)' : 'transparent';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': longData, 'plot1': shortData, 'plot2': midData },
    fills: [
      { plot1: 'plot2', plot2: 'plot0', options: { color: 'rgba(38,166,154,0.15)' }, colors: longFillColors },
      { plot1: 'plot2', plot2: 'plot1', options: { color: 'rgba(239,83,80,0.15)' }, colors: shortFillColors },
    ],
    markers,
  };
}

export const ChandelierExit = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
