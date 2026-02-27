/**
 * Intraday Volume Swings
 *
 * Detects 3-bar volume swing patterns (increasing volume + directional extremes).
 * Tracks swing high/low regions for current and previous day levels.
 * Fills between swing boundaries, markers for swing completion signals.
 *
 * Reference: TradingView "Intraday Volume Swings" by rumpypumpydumpy
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface IntradayVolumeSwingsInputs {
  markSwings: boolean;
  markNewDay: boolean;
  markGreaterSwings: boolean;
  plotCurrent: boolean;
}

export const defaultInputs: IntradayVolumeSwingsInputs = {
  markSwings: true,
  markNewDay: true,
  markGreaterSwings: true,
  plotCurrent: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'markSwings', type: 'bool', title: 'Mark all volume swings?', defval: true },
  { id: 'markNewDay', type: 'bool', title: 'Mark first bar of a new day?', defval: true },
  { id: 'markGreaterSwings', type: 'bool', title: 'Mark daily lower/higher swings?', defval: true },
  { id: 'plotCurrent', type: 'bool', title: 'Display levels as they form?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Current Swing Low Top', color: '#800000', lineWidth: 1 },
  { id: 'plot1', title: 'Current Swing Low Bottom', color: '#800000', lineWidth: 1 },
  { id: 'plot2', title: 'Current Swing High Top', color: '#008000', lineWidth: 1 },
  { id: 'plot3', title: 'Current Swing High Bottom', color: '#008000', lineWidth: 1 },
  { id: 'plot4', title: 'Swing Low Upper', color: 'transparent', lineWidth: 1 },
  { id: 'plot5', title: 'Swing Low Lower', color: 'transparent', lineWidth: 1 },
  { id: 'plot6', title: 'Swing High Upper', color: 'transparent', lineWidth: 1 },
  { id: 'plot7', title: 'Swing High Lower', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Intraday Volume Swings',
  shortTitle: 'IVS',
  overlay: true,
};

/** Check if bar starts a new day vs previous bar */
function isNewDay(bar: Bar, prevBar: Bar | null): boolean {
  if (!prevBar) return false;
  const d1 = new Date(bar.time * 1000);
  const d2 = new Date(prevBar.time * 1000);
  return d1.getUTCFullYear() !== d2.getUTCFullYear() ||
    d1.getUTCMonth() !== d2.getUTCMonth() ||
    d1.getUTCDate() !== d2.getUTCDate();
}

export function calculate(bars: Bar[], inputs: Partial<IntradayVolumeSwingsInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { markSwings, markNewDay, markGreaterSwings, plotCurrent } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Pre-compute highest(high,3) and lowest(low,3)
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hh3Arr = ta.highest(highSeries, 3).toArray();
  const ll3Arr = ta.lowest(lowSeries, 3).toArray();

  // Arrays for per-bar state
  const newDay: boolean[] = new Array(n).fill(false);
  const incVol: boolean[] = new Array(n).fill(false);
  const lowerLow: boolean[] = new Array(n).fill(false);
  const higherHigh: boolean[] = new Array(n).fill(false);
  const highBar: boolean[] = new Array(n).fill(false);
  const lowBar: boolean[] = new Array(n).fill(false);
  const swingLow: boolean[] = new Array(n).fill(false);
  const swingHigh: boolean[] = new Array(n).fill(false);
  const confirmedSwingLow: boolean[] = new Array(n).fill(false);
  const confirmedSwingHigh: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    newDay[i] = isNewDay(bars[i], i > 0 ? bars[i - 1] : null);
    incVol[i] = i > 0 && (bars[i].volume ?? 0) > (bars[i - 1].volume ?? 0);
    lowerLow[i] = i > 0 && bars[i].low < bars[i - 1].low;
    higherHigh[i] = i > 0 && bars[i].high > bars[i - 1].high;
    highBar[i] = incVol[i] && higherHigh[i];
    lowBar[i] = incVol[i] && lowerLow[i];
    swingLow[i] = lowBar[i] && (i >= 1 && lowBar[i - 1]) && (i >= 2 && lowBar[i - 2]);
    swingHigh[i] = highBar[i] && (i >= 1 && highBar[i - 1]) && (i >= 2 && highBar[i - 2]);
    confirmedSwingLow[i] = !swingLow[i] && (i > 0 && swingLow[i - 1]);
    confirmedSwingHigh[i] = !swingHigh[i] && (i > 0 && swingHigh[i - 1]);
  }

  // Track swing region boundaries
  const swingLowTop: number[] = new Array(n).fill(NaN);
  const swingLowBot: number[] = new Array(n).fill(NaN);
  const swingHighTop: number[] = new Array(n).fill(NaN);
  const swingHighBot: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (swingLow[i] && (i === 0 || !swingLow[i - 1])) {
      swingLowTop[i] = hh3Arr[i] ?? bars[i].high;
      swingLowBot[i] = ll3Arr[i] ?? bars[i].low;
    } else if (swingLow[i] && swingLow[i - 1]) {
      swingLowTop[i] = Math.max(swingLowTop[i - 1] || -Infinity, bars[i].high);
      swingLowBot[i] = Math.min(swingLowBot[i - 1] || Infinity, bars[i].low);
    }
    // else stays NaN

    if (swingHigh[i] && (i === 0 || !swingHigh[i - 1])) {
      swingHighTop[i] = hh3Arr[i] ?? bars[i].high;
      swingHighBot[i] = ll3Arr[i] ?? bars[i].low;
    } else if (swingHigh[i] && swingHigh[i - 1]) {
      swingHighTop[i] = Math.max(swingHighTop[i - 1] || -Infinity, bars[i].high);
      swingHighBot[i] = Math.min(swingHighBot[i - 1] || Infinity, bars[i].low);
    }
  }

  // Daily swing tracking (var = persistent across bars)
  const dailySwingLowTop: number[] = new Array(n).fill(NaN);
  const dailySwingLowBot: number[] = new Array(n).fill(NaN);
  const dailySwingHighTop: number[] = new Array(n).fill(NaN);
  const dailySwingHighBot: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    // Carry forward from previous bar (var behavior)
    if (i > 0) {
      dailySwingLowTop[i] = dailySwingLowTop[i - 1];
      dailySwingLowBot[i] = dailySwingLowBot[i - 1];
      dailySwingHighTop[i] = dailySwingHighTop[i - 1];
      dailySwingHighBot[i] = dailySwingHighBot[i - 1];
    }

    // Daily Lowest Swing Low
    if (newDay[i] && !swingLow[i] && !confirmedSwingLow[i]) {
      dailySwingLowTop[i] = NaN;
      dailySwingLowBot[i] = NaN;
    }
    if (newDay[i] && swingLow[i]) {
      dailySwingLowTop[i] = swingLowTop[i];
      dailySwingLowBot[i] = swingLowBot[i];
    }
    if (newDay[i] && confirmedSwingLow[i]) {
      dailySwingLowTop[i] = swingLowTop[i - 1] ?? NaN;
      dailySwingLowBot[i] = swingLowBot[i - 1] ?? NaN;
    }
    if (!newDay[i] && confirmedSwingLow[i] && isNaN(dailySwingLowBot[i])) {
      dailySwingLowTop[i] = swingLowTop[i - 1] ?? NaN;
      dailySwingLowBot[i] = swingLowBot[i - 1] ?? NaN;
    }
    if (!newDay[i] && confirmedSwingLow[i] && !isNaN(dailySwingLowBot[i]) &&
      !isNaN(swingLowBot[i - 1]) && (swingLowBot[i - 1] ?? Infinity) < dailySwingLowBot[i]) {
      dailySwingLowTop[i] = swingLowTop[i - 1] ?? NaN;
      dailySwingLowBot[i] = swingLowBot[i - 1] ?? NaN;
    }

    // Daily Highest Swing High
    if (newDay[i] && !swingHigh[i] && !confirmedSwingHigh[i]) {
      dailySwingHighTop[i] = NaN;
      dailySwingHighBot[i] = NaN;
    }
    if (newDay[i] && swingHigh[i]) {
      dailySwingHighTop[i] = swingHighTop[i];
      dailySwingHighBot[i] = swingHighBot[i];
    }
    if (newDay[i] && confirmedSwingHigh[i]) {
      dailySwingHighTop[i] = swingHighTop[i - 1] ?? NaN;
      dailySwingHighBot[i] = swingHighBot[i - 1] ?? NaN;
    }
    if (!newDay[i] && confirmedSwingHigh[i] && isNaN(dailySwingHighBot[i])) {
      dailySwingHighTop[i] = swingHighTop[i - 1] ?? NaN;
      dailySwingHighBot[i] = swingHighBot[i - 1] ?? NaN;
    }
    if (!newDay[i] && confirmedSwingHigh[i] && !isNaN(dailySwingHighTop[i]) &&
      !isNaN(swingHighTop[i - 1]) && (swingHighTop[i - 1] ?? -Infinity) > dailySwingHighTop[i]) {
      dailySwingHighTop[i] = swingHighTop[i - 1] ?? NaN;
      dailySwingHighBot[i] = swingHighBot[i - 1] ?? NaN;
    }
  }

  // Previous day's levels using valuewhen(new_day, ..., 0) and valuewhen(new_day, ..., 1)
  const prevSwingLowTop: number[] = new Array(n).fill(NaN);
  const prevSwingLowBot: number[] = new Array(n).fill(NaN);
  const prevSwingHighTop: number[] = new Array(n).fill(NaN);
  const prevSwingHighBot: number[] = new Array(n).fill(NaN);
  const prevSwingLowBot2: number[] = new Array(n).fill(NaN);
  const prevSwingHighTop2: number[] = new Array(n).fill(NaN);

  // valuewhen(new_day, daily_xxx[1], occurrence) - find the value of daily_xxx[1] at the Nth occurrence of new_day
  {
    // Track occurrence 0 and 1 for new_day
    let lastNewDayVal_slt = NaN;
    let lastNewDayVal_slb = NaN;
    let lastNewDayVal_sht = NaN;
    let lastNewDayVal_shb = NaN;
    let prevNewDayVal_slb = NaN;
    let prevNewDayVal_sht = NaN;

    for (let i = 0; i < n; i++) {
      if (newDay[i] && i > 0) {
        // Shift previous values to "occurrence 1"
        prevNewDayVal_slb = lastNewDayVal_slb;
        prevNewDayVal_sht = lastNewDayVal_sht;
        // Store current "occurrence 0"
        lastNewDayVal_slt = dailySwingLowTop[i - 1];
        lastNewDayVal_slb = dailySwingLowBot[i - 1];
        lastNewDayVal_sht = dailySwingHighTop[i - 1];
        lastNewDayVal_shb = dailySwingHighBot[i - 1];
      }
      prevSwingLowTop[i] = lastNewDayVal_slt;
      prevSwingLowBot[i] = lastNewDayVal_slb;
      prevSwingHighTop[i] = lastNewDayVal_sht;
      prevSwingHighBot[i] = lastNewDayVal_shb;
      prevSwingLowBot2[i] = prevNewDayVal_slb;
      prevSwingHighTop2[i] = prevNewDayVal_sht;
    }
  }

  // Build plots
  const plot0Data: { time: number; value: number }[] = [];
  const plot1Data: { time: number; value: number }[] = [];
  const plot2Data: { time: number; value: number }[] = [];
  const plot3Data: { time: number; value: number }[] = [];
  const plot4Data: { time: number; value: number }[] = [];
  const plot5Data: { time: number; value: number }[] = [];
  const plot6Data: { time: number; value: number }[] = [];
  const plot7Data: { time: number; value: number }[] = [];

  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const fillColors4_5: string[] = [];
  const fillColors6_7: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;

    // Current day levels (plot_current)
    plot0Data.push({ time: t, value: plotCurrent ? dailySwingLowTop[i] : NaN });
    plot1Data.push({ time: t, value: plotCurrent ? dailySwingLowBot[i] : NaN });
    plot2Data.push({ time: t, value: plotCurrent ? dailySwingHighTop[i] : NaN });
    plot3Data.push({ time: t, value: plotCurrent ? dailySwingHighBot[i] : NaN });

    // Previous day levels
    plot4Data.push({ time: t, value: prevSwingLowTop[i] });
    plot5Data.push({ time: t, value: prevSwingLowBot[i] });
    plot6Data.push({ time: t, value: prevSwingHighTop[i] });
    plot7Data.push({ time: t, value: prevSwingHighBot[i] });

    // Fill colors
    fillColors4_5.push(
      isNaN(prevSwingLowTop[i]) || isNaN(prevSwingLowBot[i]) ? 'transparent' : 'rgba(255,0,0,0.3)',
    );
    fillColors6_7.push(
      isNaN(prevSwingHighTop[i]) || isNaN(prevSwingHighBot[i]) ? 'transparent' : 'rgba(0,255,0,0.3)',
    );

    // Markers for confirmed swings
    if (markSwings && confirmedSwingLow[i]) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#FF0000', text: '' });
    }
    if (markSwings && confirmedSwingHigh[i]) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#00FF00', text: '' });
    }

    // Markers for higher swing high / lower swing low labels
    if (markGreaterSwings) {
      const higherSwingHigh = !isNaN(prevSwingHighTop[i]) && !isNaN(prevSwingHighTop2[i]) &&
        prevSwingHighTop[i] > prevSwingHighTop2[i];
      const lowerSwingLow = !isNaN(prevSwingLowBot[i]) && !isNaN(prevSwingLowBot2[i]) &&
        prevSwingLowBot[i] < prevSwingLowBot2[i];

      if (higherSwingHigh && newDay[i]) {
        markers.push({
          time: t, position: 'aboveBar', shape: 'labelDown',
          color: '#008000', text: 'HSH',
        });
      }
      if (lowerSwingLow && newDay[i]) {
        markers.push({
          time: t, position: 'belowBar', shape: 'labelUp',
          color: '#FF0000', text: 'LSL',
        });
      }
    }

    // BgColor for new day
    if (markNewDay && newDay[i]) {
      bgColors.push({ time: t, color: 'rgba(255,255,0,0.2)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0Data, 'plot1': plot1Data,
      'plot2': plot2Data, 'plot3': plot3Data,
      'plot4': plot4Data, 'plot5': plot5Data,
      'plot6': plot6Data, 'plot7': plot7Data,
    },
    fills: [
      { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(255,0,0,0.3)' }, colors: fillColors4_5 },
      { plot1: 'plot6', plot2: 'plot7', options: { color: 'rgba(0,255,0,0.3)' }, colors: fillColors6_7 },
    ],
    markers,
    bgColors,
  };
}

export const IntradayVolumeSwings = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
