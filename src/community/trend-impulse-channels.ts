/**
 * Trend Impulse Channels (Zeiierman)
 *
 * ATR-based trend-following channel indicator. A "trend" level steps
 * in the trend direction each bar. Flips occur when price exceeds
 * the trigger threshold (ATR * multiplier). Volatility bands are
 * drawn around the trend line. Retest and step signals are generated: the retest triangles below / above the bar, the
 * step circles on the high (bullish) or the low (bearish), each drawn twice as in the original (a tiny circle and a
 * small half-transparent one).
 *
 * Reference: "Trend Impulse Channels (Zeiierman)" by Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TicRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  trend: number[];
  dir: number[];
  barsInTrend: number[];
  holdArr: number[];
  extension: number[];
  upperArr: number[];
  lowerArr: number[];
  plotTrend: { time: number; value: number; color: string }[];
  plotUpper: { time: number; value: number }[];
  plotLower: { time: number; value: number }[];
  fillColor: Array<string | null>;
  trendVal: number[];
  upperVal: number[];
  lowerVal: number[];
  markers: MarkerData[];
}

function study(inputs: Partial<TrendImpulseChannelsInputs>): BarStudy<TicRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const warmup = 200;
  const colorUp = '#00E676';
  const colorDown = '#FF1744';
  const colorGray = '#808080';
  // Pine: fill(plotUpper, plotMid, upper, trend, showFill ? color.new(trendColor, 60) : na, na)
  //      fill(plotLower, plotMid, lower, trend, showFill ? color.new(trendColor, 60) : na, na)
  // Pine: colorUp = input.color(color.lime), colorDown = input.color(color.red) (//@version=6 palette)
  // Pine: trendColor = dir == 1 ? colorUp : dir == -1 ? colorDown : color.gray
  const fillUp = color.new_color(color.lime, 60) as string;
  const fillDown = color.new_color(color.red, 60) as string;
  const fillGray = color.new_color(color.gray, 60) as string;
  const stepUp = String(color.new(colorUp, 50));
  const stepDown = String(color.new(colorDown, 50));
  return {
    init() {
      const atr = taStep.atr(200);
      const s: TicRun = {
        atr, trend: [], dir: [], barsInTrend: [], holdArr: [], extension: [], upperArr: [], lowerArr: [],
        plotTrend: [], plotUpper: [], plotLower: [], fillColor: [], trendVal: [], upperVal: [], lowerVal: [], markers: [],
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [
        s.trend, s.dir, s.barsInTrend, s.holdArr, s.extension, s.upperArr, s.lowerArr, s.plotTrend, s.plotUpper,
        s.plotLower, s.fillColor, s.trendVal, s.upperVal, s.lowerVal,
      ];
      return s;
    },
    bar(s, i, bars) {
      const { trend, dir, barsInTrend, holdArr, extension, upperArr, lowerArr } = s;
      const b = bars[i];
      const atr = s.atr.step(b.high, b.low, b.close) ?? 0;
      const close = b.close;
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

      const time = b.time;
      const d = dir[i];
      s.plotTrend[i] = { time, value: i < warmup ? NaN : trend[i], color: d === 1 ? colorUp : d === -1 ? colorDown : colorGray };
      s.plotUpper[i] = { time, value: i < warmup || !cfg.showFill ? NaN : upperArr[i] };
      s.plotLower[i] = { time, value: i < warmup || !cfg.showFill ? NaN : lowerArr[i] };
      s.fillColor[i] = cfg.showFill ? (d === 1 ? fillUp : d === -1 ? fillDown : fillGray) : null;
      s.trendVal[i] = i < warmup ? NaN : trend[i];
      s.upperVal[i] = i < warmup ? NaN : upperArr[i];
      s.lowerVal[i] = i < warmup ? NaN : lowerArr[i];

      // Markers: retest signals and step signals
      if (i < warmup + 1) return;
      // Retest signals
      if (cfg.showRetestSignals) {
        const crossUnder = b.low < lowerArr[i] && bars[i - 1].low >= lowerArr[i - 1];
        const crossOver = b.high > upperArr[i] && bars[i - 1].high <= upperArr[i - 1];
        const trendDir = d;

        let showCrossUnder = crossUnder;
        let showCrossOver = crossOver;
        if (cfg.trendFilter) {
          showCrossUnder = crossUnder && trendDir === 1;
          showCrossOver = crossOver && trendDir === -1;
        }

        if (showCrossUnder) {
          s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: colorUp, text: '', id: 'shape0' });
        }
        if (showCrossOver) {
          s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: colorDown, text: '', id: 'shape1' });
        }
      }

      // Step signals
      if (cfg.showStepSignals) {
        const trendStep = d !== 0 && trend[i] !== trend[i - 1] &&
          ((trend[i] > trend[i - 1] && d === 1) || (trend[i] < trend[i - 1] && d === -1));
        // plotshape(trendStep and dir == 1 and TrendStepSignal ? high : na, "Bullish Step", location.absolute, shape.circle,
        //   colorUp3, size.tiny), then the same with color.new(colorUp3, 50) and size.small; Bearish Step: low, colorDown3
        if (trendStep && d === 1) {
          s.markers.push({ time, position: 'atPriceMiddle', price: b.high, shape: 'circle', color: colorUp, size: 'tiny', id: 'shape2' });
        }
        if (trendStep && d === -1) {
          s.markers.push({ time, position: 'atPriceMiddle', price: b.low, shape: 'circle', color: colorDown, size: 'tiny', id: 'shape3' });
        }
        if (trendStep && d === 1) {
          s.markers.push({ time, position: 'atPriceMiddle', price: b.high, shape: 'circle', color: stepUp, size: 'small', id: 'shape4' });
        }
        if (trendStep && d === -1) {
          s.markers.push({ time, position: 'atPriceMiddle', price: b.low, shape: 'circle', color: stepDown, size: 'small', id: 'shape5' });
        }
      }
    },
    result(s, bars) {
      const fillColor = s.fillColor.slice();
      const naColor: Array<string | null> = new Array(bars.length).fill(null);
      const trendVal = s.trendVal.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'trend': s.plotTrend.slice(), 'upper': s.plotUpper.slice(), 'lower': s.plotLower.slice() },
        fills: [
          {
            plot1: 'upper', plot2: 'trend',
            gradient: { topValue: s.upperVal.slice(), bottomValue: trendVal, topColor: fillColor, bottomColor: naColor },
          },
          {
            plot1: 'lower', plot2: 'trend',
            gradient: { topValue: s.lowerVal.slice(), bottomValue: trendVal, topColor: fillColor, bottomColor: naColor },
          },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendImpulseChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendImpulseChannelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendImpulseChannels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
