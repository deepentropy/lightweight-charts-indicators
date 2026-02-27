/**
 * Zero-Lag MA Trend Levels
 *
 * Zero-lag EMA: zlema = 2*EMA(src) - EMA(EMA(src)).
 * Detects trend changes when ZLEMA direction flips.
 * Plots support level (last bullish flip price) and resistance level (last bearish flip price).
 *
 * Reference: TradingView "Zero-Lag MA Trend Levels" (TV#861)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BoxData, LabelData } from '../types';

export interface ZlmaTrendLevelsInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ZlmaTrendLevelsInputs = {
  length: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLMA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Support', color: '#26A69A', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Resistance', color: '#EF5350', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Zero-Lag MA Trend Levels',
  shortTitle: 'ZLMA-TL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZlmaTrendLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[] } {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  // Pine: emaValue = ema(close, length), correction = close + (close - emaValue), zlma = ema(correction, length)
  const ema1 = ta.ema(source, length);
  const ema2 = ta.ema(ema1, length);
  const zlema = ema1.mul(2).sub(ema2);
  const zlArr = zlema.toArray();
  const emaArr = ema1.toArray();

  // ATR for box height (Pine: atr = ta.atr(200))
  const atrLen = Math.min(200, n);
  const atrSeries = ta.atr(bars, atrLen);
  const atrArr = atrSeries ? atrSeries.toArray() : new Array(n).fill(0);

  const warmup = length * 2;
  let support = NaN;
  let resistance = NaN;

  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  const fillColors: string[] = [];
  const boxes: BoxData[] = [];
  const labels: LabelData[] = [];

  // Track current box for label logic
  let boxTop = NaN;
  let boxBot = NaN;
  let boxStartTime = 0;
  let checkSignalsPrev = false;
  let emaAboveZlmaPrev = false;

  for (let i = 0; i < n; i++) {
    const val = i < warmup ? NaN : (zlArr[i] ?? NaN);
    const prev3 = (i >= 3 && i >= warmup) ? (zlArr[i - 3] ?? NaN) : NaN;
    const prev = i > 0 ? (zlArr[i - 1] ?? NaN) : NaN;
    const emaVal = emaArr[i] ?? NaN;
    const emaPrev = i > 0 ? (emaArr[i - 1] ?? NaN) : NaN;
    const atr = atrArr[i] ?? 0;

    // Pine: zlma_color = zlma > zlma[3] ? up : zlma < zlma[3] ? dn : na
    let zlmaColor = '#787B86';
    if (!isNaN(val) && !isNaN(prev3)) {
      zlmaColor = val > prev3 ? '#30d453' : val < prev3 ? '#4043f1' : '#787B86';
    }

    // Pine: ema_col = emaValue < zlma ? up : dn
    let emaColor = '#787B86';
    if (!isNaN(val) && !isNaN(emaVal)) {
      emaColor = emaVal < val ? '#30d453' : '#4043f1';
    }

    // Pine: signalUp = crossover(zlma, emaValue), signalDn = crossunder(zlma, emaValue)
    let signalUp = false;
    let signalDn = false;
    if (i >= warmup && !isNaN(val) && !isNaN(emaVal) && !isNaN(prev) && !isNaN(emaPrev)) {
      signalUp = prev <= emaPrev && val > emaVal;
      signalDn = prev >= emaPrev && val < emaVal;
      if (signalUp) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: '#30d453', text: 'Up' });
      }
      if (signalDn) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: '#4043f1', text: 'Dn' });
      }
    }

    const checkSignals = signalUp || signalDn;

    // Detect trend flip and set levels + boxes
    if (signalUp && !isNaN(val) && !isNaN(atr)) {
      support = val;
      // Pine: box1 := up.draw_box(zlma, zlma - atr, close)
      boxTop = val;
      boxBot = val - atr;
      boxStartTime = bars[i].time;
      boxes.push({
        time1: bars[i].time, price1: boxTop,
        time2: bars[i].time, price2: boxBot,
        borderColor: '#30d453', bgColor: 'rgba(48,212,83,0.1)',
      });
    } else if (signalDn && !isNaN(val) && !isNaN(atr)) {
      resistance = val;
      // Pine: box1 := dn.draw_box(zlma + atr, zlma, close)
      boxTop = val + atr;
      boxBot = val;
      boxStartTime = bars[i].time;
      boxes.push({
        time1: bars[i].time, price1: boxTop,
        time2: bars[i].time, price2: boxBot,
        borderColor: '#4043f1', bgColor: 'rgba(64,67,241,0.1)',
      });
    }

    // Extend box right side (update time2 of last box)
    if (boxes.length > 0 && !checkSignals) {
      boxes[boxes.length - 1].time2 = bars[i].time;
    }

    // Pine: label when price crosses box boundaries
    if (i >= warmup && !isNaN(boxTop) && !isNaN(boxBot) && !checkSignals && !checkSignalsPrev) {
      // Pine: crossunder(high, box.get_bottom()) and emaValue > zlma => bearish label
      if (i > 0 && bars[i - 1].high >= boxBot && bars[i].high < boxBot && emaVal > val) {
        labels.push({
          time: bars[i].time, price: bars[i].high,
          text: '\u25BC', textColor: '#4043f1',
          style: 'label_down', size: 'tiny',
        });
      }
      // Pine: crossover(low, box.get_top()) and emaValue < zlma => bullish label
      if (i > 0 && bars[i - 1].low <= boxTop && bars[i].low > boxTop && emaVal < val) {
        labels.push({
          time: bars[i].time, price: bars[i].low,
          text: '\u25B2', textColor: '#30d453',
          style: 'label_up', size: 'tiny',
        });
      }
    }

    checkSignalsPrev = checkSignals;
    emaAboveZlmaPrev = emaVal > val;

    // Fill between ZLMA and EMA: Pine fill(p1, p2, zlma, emaValue, color.new(zlma_color, 80), color.new(ema_col, 80))
    if (i < warmup || isNaN(val) || isNaN(emaVal)) {
      fillColors.push('rgba(0,0,0,0)');
    } else {
      fillColors.push(val > emaVal ? 'rgba(48,212,83,0.2)' : 'rgba(64,67,241,0.2)');
    }

    plot0.push({ time: bars[i].time, value: val, color: zlmaColor });
    plot1.push({ time: bars[i].time, value: i < warmup ? NaN : emaVal, color: emaColor });
    plot2.push({ time: bars[i].time, value: support });
    plot3.push({ time: bars[i].time, value: resistance });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(48,212,83,0.2)' }, colors: fillColors }],
    markers,
    boxes,
    labels,
  };
}

export const ZlmaTrendLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
