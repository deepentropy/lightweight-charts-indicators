/**
 * Zero-Lag MA Trend Levels [ChartPrime]
 *
 * Pine: emaValue = ema(close, length)
 *       correction = close + (close - emaValue)
 *       zlma = ema(correction, length)
 * Detects trend changes when ZLMA crosses EMA.
 * Draws boxes at crossover/crossunder levels, with labels when price
 * crosses box boundaries.
 *
 * Plots: p1 = zlma (colored by direction vs zlma[3])
 *        p2 = emaValue (colored by ema < zlma)
 *        fill(p1, p2) gradient fill between ZLMA and EMA
 *        plotshape diamonds at zlma on signalUp/signalDn
 *        box.new at signal with ATR-based height and price text
 *        label.new when price crosses box boundaries
 *
 * Reference: TradingView "Zero-Lag MA Trend Levels [ChartPrime]"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BoxData, LabelData } from '../types';

export interface ZlmaTrendLevelsInputs {
  length: number;
  showLevels: boolean;
}

export const defaultInputs: ZlmaTrendLevelsInputs = {
  length: 15,
  showLevels: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 15, min: 1 },
  { id: 'showLevels', type: 'bool', title: 'Trend Levels', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLMA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Zero-Lag MA Trend Levels',
  shortTitle: 'ZLMA-TL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZlmaTrendLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[] } {
  const { length, showLevels } = { ...defaultInputs, ...inputs };
  const close = getSourceSeries(bars, 'close');
  const n = bars.length;

  // Pine: emaValue = ta.ema(close, length)
  const ema1 = ta.ema(close, length);
  const emaArr = ema1.toArray();

  // Pine: correction = close + (close - emaValue), zlma = ta.ema(correction, length)
  const closeArr = close.toArray();
  const correctionArr = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = closeArr[i] ?? NaN;
    const e = emaArr[i] ?? NaN;
    correctionArr[i] = c + (c - e);
  }
  // Compute EMA of correction series manually (ta.ema expects a Series, so build from array)
  const zlArr = new Array(n).fill(NaN);
  {
    const alpha = 2 / (length + 1);
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = correctionArr[i];
      if (isNaN(v)) continue;
      if (!started) {
        zlArr[i] = v;
        started = true;
      } else {
        zlArr[i] = alpha * v + (1 - alpha) * (zlArr[i - 1] ?? v);
      }
    }
  }

  // ATR for box height: Pine uses ta.atr(200)
  const atrLen = Math.min(200, n);
  const atrSeries = ta.atr(bars, atrLen);
  const atrArr = atrSeries ? atrSeries.toArray() : new Array(n).fill(0);

  const warmup = length * 2;

  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];
  const markers: MarkerData[] = [];
  const fillColors: string[] = [];
  const boxes: BoxData[] = [];
  const labels: LabelData[] = [];

  // Box state (Pine: var box1 = box(na))
  let boxTop = NaN;
  let boxBot = NaN;
  let lastBoxIdx = -1; // index into boxes[]
  let checkSignalsPrev = false;

  for (let i = 0; i < n; i++) {
    const val = i < warmup ? NaN : (zlArr[i] ?? NaN);
    const prev3 = (i >= 3 && i >= warmup) ? (zlArr[i - 3] ?? NaN) : NaN;
    const prev = i > 0 ? (zlArr[i - 1] ?? NaN) : NaN;
    const emaVal = i < warmup ? NaN : (emaArr[i] ?? NaN);
    const emaPrev = (i > 0 && i - 1 >= warmup) ? (emaArr[i - 1] ?? NaN) : NaN;
    const atr = atrArr[i] ?? 0;
    const closeVal = closeArr[i] ?? NaN;

    // Pine: zlma_color = zlma > zlma[3] ? up : zlma < zlma[3] ? dn : na
    let zlmaColor: string | undefined;
    if (!isNaN(val) && !isNaN(prev3)) {
      zlmaColor = val > prev3 ? '#30d453' : val < prev3 ? '#4043f1' : undefined;
    }

    // Pine: ema_col = emaValue < zlma ? up : dn
    let emaColor = '#787B86';
    if (!isNaN(val) && !isNaN(emaVal)) {
      emaColor = emaVal < val ? '#30d453' : '#4043f1';
    }

    // Pine: signalUp = ta.crossover(zlma, emaValue), signalDn = ta.crossunder(zlma, emaValue)
    let signalUp = false;
    let signalDn = false;
    if (i >= warmup && !isNaN(val) && !isNaN(emaVal) && !isNaN(prev) && !isNaN(emaPrev)) {
      signalUp = prev <= emaPrev && val > emaVal;
      signalDn = prev >= emaPrev && val < emaVal;
    }

    // Pine: plotshape(signalUp ? zlma : na, "", shape.diamond, location.absolute, color=up, size=size.tiny)
    if (signalUp) {
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'diamond', color: '#30d453', text: '' });
    }
    if (signalDn) {
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'diamond', color: '#4043f1', text: '' });
    }

    // Trend levels: boxes and labels (Pine: if show_levl)
    if (showLevels) {
      const checkSignals = signalUp || signalDn;

      // Pine: switch - draw box on signal
      if (signalUp && !isNaN(val) && !isNaN(atr)) {
        // Pine: box1 := up.draw_box(zlma, zlma - atr, close)
        boxTop = val;
        boxBot = val - atr;
        const priceText = String(Math.round(closeVal * 100) / 100);
        boxes.push({
          time1: bars[i].time, price1: boxTop,
          time2: bars[i].time, price2: boxBot,
          borderColor: '#30d453', borderWidth: 1,
          bgColor: 'rgba(48,212,83,0.1)',
          text: priceText, textSize: 'tiny', textColor: '#787B86', textHAlign: 'right',
        });
        lastBoxIdx = boxes.length - 1;
      } else if (signalDn && !isNaN(val) && !isNaN(atr)) {
        // Pine: box1 := dn.draw_box(zlma + atr, zlma, close)
        boxTop = val + atr;
        boxBot = val;
        const priceText = String(Math.round(closeVal * 100) / 100);
        boxes.push({
          time1: bars[i].time, price1: boxTop,
          time2: bars[i].time, price2: boxBot,
          borderColor: '#4043f1', borderWidth: 1,
          bgColor: 'rgba(64,67,241,0.1)',
          text: priceText, textSize: 'tiny', textColor: '#787B86', textHAlign: 'right',
        });
        lastBoxIdx = boxes.length - 1;
      }

      // Pine: not signalUp or not signalDn => box1.set_right(bar_index + 4)
      // This is true whenever NOT (signalUp AND signalDn), i.e., almost always
      if (lastBoxIdx >= 0 && !(signalUp && signalDn)) {
        // Extend box right edge. Use time of bar+4 if available, else current bar time.
        const rightIdx = Math.min(i + 4, n - 1);
        boxes[lastBoxIdx].time2 = bars[rightIdx].time;
      }

      // Pine labels: created when price crosses box boundaries
      // label at bar_index-1 with high[1]/low[1]
      if (i > 0 && !isNaN(boxTop) && !isNaN(boxBot) && !checkSignals && !checkSignalsPrev) {
        const highPrev = bars[i - 1].high;
        const highCurr = bars[i].high;
        const lowPrev = bars[i - 1].low;
        const lowCurr = bars[i].low;

        // Pine: ta.crossunder(high, box1.get_bottom()) and emaValue > zlma
        if (highPrev >= boxBot && highCurr < boxBot && !isNaN(emaVal) && !isNaN(val) && emaVal > val) {
          labels.push({
            time: bars[i - 1].time, price: highPrev,
            text: '\u25BC', textColor: '#4043f1',
            style: 'label_down', size: 'tiny',
          });
        }
        // Pine: ta.crossover(low, box1.get_top()) and emaValue < zlma
        if (lowPrev <= boxTop && lowCurr > boxTop && !isNaN(emaVal) && !isNaN(val) && emaVal < val) {
          labels.push({
            time: bars[i - 1].time, price: lowPrev,
            text: '\u25B2', textColor: '#30d453',
            style: 'label_up', size: 'tiny',
          });
        }
      }

      checkSignalsPrev = checkSignals;
    }

    // Fill between ZLMA and EMA: Pine fill(p1, p2, zlma, emaValue, color.new(zlma_color, 80), color.new(ema_col, 80))
    if (i < warmup || isNaN(val) || isNaN(emaVal)) {
      fillColors.push('rgba(0,0,0,0)');
    } else {
      // Gradient fill: top part gets zlma_color, bottom gets ema_col
      // Simplified: use zlma_color when zlma > ema, ema_col when ema > zlma
      if (val > emaVal) {
        fillColors.push(zlmaColor === '#30d453' ? 'rgba(48,212,83,0.2)' : zlmaColor === '#4043f1' ? 'rgba(64,67,241,0.2)' : 'rgba(0,0,0,0)');
      } else {
        fillColors.push(emaColor === '#30d453' ? 'rgba(48,212,83,0.2)' : 'rgba(64,67,241,0.2)');
      }
    }

    plot0.push({ time: bars[i].time, value: val, color: zlmaColor });
    plot1.push({ time: bars[i].time, value: emaVal, color: emaColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(48,212,83,0.2)' }, colors: fillColors }],
    markers,
    boxes,
    labels,
  };
}

export const ZlmaTrendLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
