/**
 * Trend Impulse Channels (Zeiierman)
 *
 * ATR-based trend-following channel indicator. A "trend" level steps
 * in the trend direction each bar. Flips occur when price exceeds
 * the trigger threshold (ATR * multiplier). Volatility bands are
 * drawn around the trend line. Retest and step signals are generated.
 *
 * Reference: TradingView "Trend Impulse Channels (Zeiierman)" by Zeiierman
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface TrendImpulseChannelsInputs {
  flipMult: number;
  maxStepAtr: number;
  bandMult: number;
  holdBars: number;
  showFill: boolean;
  showRetestSignals: boolean;
  trendFilter: boolean;
  showStepSignals: boolean;
}

export const defaultInputs: TrendImpulseChannelsInputs = {
  flipMult: 2.86,
  maxStepAtr: -0.034,
  bandMult: 2.02,
  holdBars: 0,
  showFill: true,
  showRetestSignals: true,
  trendFilter: true,
  showStepSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'flipMult', type: 'float', title: 'Trigger Threshold', defval: 2.86, min: 0, step: 0.01 },
  { id: 'maxStepAtr', type: 'float', title: 'Max Step Size', defval: -0.034, step: 0.001 },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 2.02, min: 0, step: 0.01 },
  { id: 'holdBars', type: 'int', title: 'Trend Hold', defval: 0, min: 0 },
  { id: 'showFill', type: 'bool', title: 'Channel Fill', defval: true },
  { id: 'showRetestSignals', type: 'bool', title: 'Retest Signals', defval: true },
  { id: 'trendFilter', type: 'bool', title: 'Filter by Trend', defval: true },
  { id: 'showStepSignals', type: 'bool', title: 'Trend Step Signals', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'trend', title: 'Trend Line', color: '#00E676', lineWidth: 2 },
  { id: 'upper', title: 'Upper Band', color: 'transparent', lineWidth: 1 },
  { id: 'lower', title: 'Lower Band', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Impulse Channels',
  shortTitle: 'TIC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendImpulseChannelsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, 200).toArray();
  const highArr = new Series(bars, (b) => b.high).toArray();
  const lowArr = new Series(bars, (b) => b.low).toArray();
  const closeArr = new Series(bars, (b) => b.close).toArray();

  const trend: number[] = new Array(n);
  const dir: number[] = new Array(n).fill(0);
  const barsInTrend: number[] = new Array(n).fill(0);
  const holdArr: number[] = new Array(n).fill(0);
  const extension: number[] = new Array(n).fill(0);
  const upperArr: number[] = new Array(n);
  const lowerArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const atr = atrArr[i] ?? 0;
    const close = closeArr[i];
    const stepBase = atr * 2.52;
    const maxStep = atr * cfg.maxStepAtr;
    const trigger = atr * cfg.flipMult;

    if (i === 0) {
      trend[i] = close;
      dir[i] = 0;
      barsInTrend[i] = 0;
      holdArr[i] = trigger;
      extension[i] = 0;
    } else {
      const prevTrend = trend[i - 1];
      const startLong = close > prevTrend + trigger;
      const startShort = close < prevTrend - trigger;
      const flip = (startLong || startShort) && barsInTrend[i - 1] >= 0;
      const stepSize = Math.min(stepBase + 0.0093 * barsInTrend[i - 1] * atr, maxStep);

      if (flip && extension[i - 1] <= 0) {
        trend[i] = close;
        dir[i] = startLong ? 1 : -1;
        barsInTrend[i] = 1;
        holdArr[i] = trigger;
        extension[i] = cfg.holdBars;
      } else {
        trend[i] = prevTrend + (dir[i - 1] === 1 ? stepSize : dir[i - 1] === -1 ? -stepSize : 0);
        dir[i] = dir[i - 1];
        barsInTrend[i] = barsInTrend[i - 1] + 1;
        holdArr[i] = holdArr[i - 1];
        extension[i] = Math.max(extension[i - 1] - 1, 0);
      }
    }

    upperArr[i] = trend[i] + atr * cfg.bandMult;
    lowerArr[i] = trend[i] - atr * cfg.bandMult;
  }

  const warmup = 200;
  const colorUp = '#00E676';
  const colorDown = '#FF1744';
  const colorGray = '#808080';

  const plotTrend = trend.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: dir[i] === 1 ? colorUp : dir[i] === -1 ? colorDown : colorGray,
  }));

  const plotUpper = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || !cfg.showFill ? NaN : v,
  }));

  const plotLower = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || !cfg.showFill ? NaN : v,
  }));

  // Fill colors
  const upperFillColors = trend.map((_, i) => {
    if (i < warmup) return 'transparent';
    const c = dir[i] === 1 ? colorUp : dir[i] === -1 ? colorDown : colorGray;
    return c + '99'; // 60% opacity
  });
  const lowerFillColors = upperFillColors;

  // Markers: retest signals and step signals
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    // Retest signals
    if (cfg.showRetestSignals) {
      const crossUnder = lowArr[i] < lowerArr[i] && lowArr[i - 1] >= lowerArr[i - 1];
      const crossOver = highArr[i] > upperArr[i] && highArr[i - 1] <= upperArr[i - 1];
      const trendDir = dir[i];

      let showCrossUnder = crossUnder;
      let showCrossOver = crossOver;
      if (cfg.trendFilter) {
        showCrossUnder = crossUnder && trendDir === 1;
        showCrossOver = crossOver && trendDir === -1;
      }

      if (showCrossUnder) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: colorUp, text: '' });
      }
      if (showCrossOver) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: colorDown, text: '' });
      }
    }

    // Step signals
    if (cfg.showStepSignals) {
      const trendStep = dir[i] !== 0 && trend[i] !== trend[i - 1] &&
        ((trend[i] > trend[i - 1] && dir[i] === 1) || (trend[i] < trend[i - 1] && dir[i] === -1));
      if (trendStep && dir[i] === 1) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: colorUp, text: '' });
      }
      if (trendStep && dir[i] === -1) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: colorDown, text: '' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'trend': plotTrend, 'upper': plotUpper, 'lower': plotLower },
    fills: cfg.showFill ? [
      { plot1: 'trend', plot2: 'upper', options: { color: 'rgba(0,230,118,0.38)' }, colors: upperFillColors },
      { plot1: 'lower', plot2: 'trend', options: { color: 'rgba(0,230,118,0.38)' }, colors: lowerFillColors },
    ] : [],
    markers,
  };
}

export const TrendImpulseChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
