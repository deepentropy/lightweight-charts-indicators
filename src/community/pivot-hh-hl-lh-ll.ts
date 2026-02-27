/**
 * Pivot Points HH/HL/LH/LL
 *
 * Detects pivot highs and lows, then classifies them as:
 * Higher High (HH), Higher Low (HL), Lower High (LH), Lower Low (LL).
 * Plots: pivot avg stepline, top/bottom level circles, breakout/breakdown markers,
 * and labels at pivot price points.
 *
 * Reference: TradingView "Pivot Points High Low (HH/HL/LH/LL) [Anan]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData } from '../types';

export interface PivotHhHlLhLlInputs {
  leftBars: number;
  rightBars: number;
  showFB: boolean;
}

export const defaultInputs: PivotHhHlLhLlInputs = {
  leftBars: 4,
  rightBars: 2,
  showFB: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 4, min: 0 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 2, min: 0 },
  { id: 'showFB', type: 'bool', title: 'Show Fractal Break', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot Avg', color: '#26A69A', lineWidth: 1, style: 'stepline' },
  { id: 'plot1', title: 'Top Levels', color: 'rgba(0,128,128,0.5)', lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Bottom Levels', color: 'rgba(255,0,0,0.5)', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Pivot Points HH/HL/LH/LL',
  shortTitle: 'PivotHHLL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PivotHhHlLhLlInputs> = {}): IndicatorResult & { markers: MarkerData[]; labels: LabelData[] } {
  const { leftBars, rightBars, showFB } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, leftBars, rightBars).toArray();
  const plArr = ta.pivotlow(lowSeries, leftBars, rightBars).toArray();

  let lastPivotHigh = NaN;
  let lastPivotLow = NaN;
  // Pine uses valuewhen: track previous pivot values for HH/LH/HL/LL classification
  let prevPivotHighValue = NaN;
  let prevPivotLowValue = NaN;
  const markers: MarkerData[] = [];
  const labels: LabelData[] = [];

  // Pine: pvtH holds last pivot high value, pvtL holds last pivot low value
  let pvtH = NaN;
  let pvtL = NaN;
  // Pine: fixnan(ph) and fixnan(pl) - last non-NaN pivot value
  let fixnanPh = NaN;
  let fixnanPl = NaN;

  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number; color?: string }[] = [];
  const plot2: { time: number; value: number; color?: string }[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    const pl = plArr[i];
    const hasPh = ph != null && !isNaN(ph) && ph !== 0;
    const hasPl = pl != null && !isNaN(pl) && pl !== 0;

    // Pine: ph_value = srcH[rightLenH] (the source value at the pivot point)
    const phValue = hasPh ? bars[Math.max(0, i - rightBars)].high : NaN;
    const plValue = hasPl ? bars[Math.max(0, i - rightBars)].low : NaN;

    // HH/LH/HL/LL classification using Pine's valuewhen pattern
    if (hasPh) {
      const isHH = !isNaN(prevPivotHighValue) && phValue > prevPivotHighValue;
      const isLH = !isNaN(prevPivotHighValue) && phValue <= prevPivotHighValue;

      if (!isNaN(prevPivotHighValue)) {
        if (isHH) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(0,128,128,0.5)', text: 'HH' });
        } else {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(0,128,128,0.5)', text: 'LH' });
        }
      }

      // Pine: label.new with pivot price
      labels.push({
        time: bars[i].time, price: phValue,
        text: '[' + phValue.toFixed(2) + ']',
        textColor: 'rgba(0,128,128,0.5)',
        style: 'label_down', size: 'tiny',
      });

      prevPivotHighValue = phValue;
      pvtH = phValue;
    }

    if (hasPl) {
      const isHL = !isNaN(prevPivotLowValue) && plValue > prevPivotLowValue;
      const isLL = !isNaN(prevPivotLowValue) && plValue <= prevPivotLowValue;

      if (!isNaN(prevPivotLowValue)) {
        if (isHL) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: 'rgba(255,0,0,0.5)', text: 'HL' });
        } else {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: 'rgba(255,0,0,0.5)', text: 'LL' });
        }
      }

      // Pine: label.new with pivot price
      labels.push({
        time: bars[i].time, price: plValue,
        text: '[' + plValue.toFixed(2) + ']',
        textColor: 'rgba(255,0,0,0.5)',
        style: 'label_up', size: 'tiny',
      });

      prevPivotLowValue = plValue;
      pvtL = plValue;
    }

    // Update fixnan values
    if (hasPh) fixnanPh = ph;
    if (hasPl) fixnanPl = pl;

    // Pine: pivot_avg = (fixnan(ph) + fixnan(pl)) / 2
    // Pine: plot(showCL ? pivot_avg : na, style=stepline, color = close > pivot_avg ? colorH : colorL)
    const pivotAvg = (!isNaN(fixnanPh) && !isNaN(fixnanPl)) ? (fixnanPh + fixnanPl) / 2 : NaN;
    const avgColor = !isNaN(pivotAvg) && bars[i].close > pivotAvg ? 'rgba(0,128,128,0.5)' : 'rgba(255,0,0,0.5)';
    plot0.push({ time: bars[i].time, value: pivotAvg, color: avgColor });

    // Pine: Top Levels (pvtHighToShow) - circles at last pivot high level
    // Pine: color = pvtH != pvtH[1] ? na : colorH (break line when value changes)
    const prevPvtH = i > 0 ? plot1[i - 1]?.value : NaN;
    const topVal = isNaN(pvtH) ? NaN : (pvtH !== prevPvtH && i > 0 ? NaN : pvtH);
    plot1.push({ time: bars[i].time, value: topVal });

    // Pine: Bottom Levels (pvtLowToShow) - circles at last pivot low level
    const prevPvtL = i > 0 ? plot2[i - 1]?.value : NaN;
    const botVal = isNaN(pvtL) ? NaN : (pvtL !== prevPvtL && i > 0 ? NaN : pvtL);
    plot2.push({ time: bars[i].time, value: botVal });

    // Pine: Fractal Break: buy = close > pvtH and open <= pvtH, sell = close < pvtL and open >= pvtL
    if (showFB && !isNaN(pvtH) && !isNaN(pvtL)) {
      const buy = bars[i].close > pvtH && bars[i].open <= pvtH;
      const sell = bars[i].close < pvtL && bars[i].open >= pvtL;
      if (buy) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: 'rgba(0,128,128,0.5)', text: '\u2191\u2191' });
      }
      if (sell) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(255,0,0,0.5)', text: '\u2193\u2193' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    markers,
    labels,
  };
}

export const PivotHhHlLhLl = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
