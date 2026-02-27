/**
 * Easy Entry/Exit Trend Colors
 *
 * MACD oscillator with Bollinger Bands envelope, zero line, and golden/death cross signals.
 * Plots: Upper BB band, Lower BB band, Zero line, MACD triangles at MACD value.
 * Pine plots triangleup (lime when MACD >= Upper) and triangledown (red when MACD <= Upper)
 * at the MACD value position on every bar.
 * Death/golden cross from 50/200 SMA crossover.
 *
 * Reference: TradingView "Easy Entry/Exit Trend Colors (With Alerts)" (community)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface EasyTrendColorsInputs {
  bbLength: number;
  bbDev: number;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  fastSmaPeriod: number;
  slowSmaPeriod: number;
  src: SourceType;
}

export const defaultInputs: EasyTrendColorsInputs = {
  bbLength: 10,
  bbDev: 1,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  fastSmaPeriod: 50,
  slowSmaPeriod: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Periods', defval: 10, min: 1 },
  { id: 'bbDev', type: 'float', title: 'Deviations', defval: 1, min: 0.0001 },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upper', title: 'Upper Band', color: '#787B86', lineWidth: 2 },
  { id: 'lower', title: 'Lower Band', color: '#787B86', lineWidth: 2 },
  { id: 'zeroline', title: 'Zero Line', color: '#FF7F00', lineWidth: 1 },
  { id: 'macdUp', title: 'MACD Up', color: '#00FF00', lineWidth: 1, style: 'circles' },
  { id: 'macdDn', title: 'MACD Down', color: '#FF0000', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Easy Entry/Exit Trend Colors',
  shortTitle: 'EasyTrend',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<EasyTrendColorsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, cfg.src);

  // MACD = EMA(fast) - EMA(slow)
  const fastEma = ta.ema(srcSeries, cfg.fastLength).toArray();
  const slowEma = ta.ema(srcSeries, cfg.slowLength).toArray();
  const macdArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    macdArr[i] = (fastEma[i] ?? 0) - (slowEma[i] ?? 0);
  }

  // BB on MACD: Upper = SMA(macd, bbLen) + dev * stdev(macd, bbLen)
  const macdSeries = new Series(bars, (_b, i) => macdArr[i]);
  const macdSmaArr = ta.sma(macdSeries, cfg.bbLength).toArray();
  const macdStdArr = ta.stdev(macdSeries, cfg.bbLength).toArray();

  // Death/golden cross from 50/200 SMA
  const fastSma = ta.sma(srcSeries, cfg.fastSmaPeriod).toArray();
  const slowSma = ta.sma(srcSeries, cfg.slowSmaPeriod).toArray();

  const bbWarmup = Math.max(cfg.slowLength, cfg.bbLength);
  const smaWarmup = cfg.slowSmaPeriod;

  const upperPlot: { time: number; value: number }[] = [];
  const lowerPlot: { time: number; value: number }[] = [];
  const zeroPlot: { time: number; value: number }[] = [];
  // Pine: plotshape(macd, color=mcl, style=shape.triangleup) where mcl = macd >= Upper ? lime : na
  // Pine: plotshape(macd, color=mcr, style=shape.triangledown) where mcr = macd <= Upper ? red : na
  // These are per-bar triangle shapes at MACD value position
  const macdUpPlot: Array<{ time: number; value: number; color?: string }> = [];
  const macdDnPlot: Array<{ time: number; value: number; color?: string }> = [];

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < bbWarmup) {
      upperPlot.push({ time: t, value: NaN });
      lowerPlot.push({ time: t, value: NaN });
      zeroPlot.push({ time: t, value: NaN });
      macdUpPlot.push({ time: t, value: NaN });
      macdDnPlot.push({ time: t, value: NaN });
      continue;
    }

    const sma = macdSmaArr[i] ?? 0;
    const std = macdStdArr[i] ?? 0;
    const upper = sma + std * cfg.bbDev;
    const lower = sma - std * cfg.bbDev;

    upperPlot.push({ time: t, value: upper });
    lowerPlot.push({ time: t, value: lower });
    zeroPlot.push({ time: t, value: 0 });

    // Pine plotshape triangleup: shown when macd >= Upper (lime), otherwise na
    // Pine plotshape triangledown: shown when macd <= Upper (red), otherwise na
    // Pine plots BOTH shapes every bar: lime triangleUp when above upper, red triangleDown when not
    if (macdArr[i] >= upper) {
      macdUpPlot.push({ time: t, value: macdArr[i], color: '#00FF00' });
      macdDnPlot.push({ time: t, value: NaN });
      // Per-bar MACD triangle shape (visible MACD representation)
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#00FF00' });
    } else {
      macdUpPlot.push({ time: t, value: NaN });
      macdDnPlot.push({ time: t, value: macdArr[i], color: '#FF0000' });
      // Per-bar MACD triangle shape (visible MACD representation)
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000' });
    }

    // Pine barcolor: yellow when macd > Upper, aqua when macd < Lower
    if (macdArr[i] > upper) {
      barColors.push({ time: t, color: '#FFFF00' });
    } else if (macdArr[i] < lower) {
      barColors.push({ time: t, color: '#00FFFF' });
    }

    // Pine markers: MACD crossing Upper band
    if (i > bbWarmup) {
      const prevMacd = macdArr[i - 1];
      const prevUpper = (macdSmaArr[i - 1] ?? 0) + (macdStdArr[i - 1] ?? 0) * cfg.bbDev;
      const crossUp = prevMacd <= prevUpper && macdArr[i] > upper;
      const crossDown = prevMacd >= prevUpper && macdArr[i] < upper;

      if (crossDown) {
        markers.push({ time: t, position: 'aboveBar', shape: 'xcross', color: '#FF0000', text: 'Bear' });
      }
      if (crossUp) {
        markers.push({ time: t, position: 'belowBar', shape: 'diamond', color: '#00FF00', text: 'Bull' });
      }

      // Death/golden cross (only when SMA data available)
      if (i >= smaWarmup) {
        const pf = fastSma[i - 1] ?? 0;
        const ps = slowSma[i - 1] ?? 0;
        const cf = fastSma[i] ?? 0;
        const cs = slowSma[i] ?? 0;
        const goldenCross = (pf <= ps && cf > cs);
        const deathCross = (ps <= pf && cs > cf);

        if (deathCross) {
          markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: '#880E4F', text: 'Death Cross' });
          bgColors.push({ time: t, color: 'rgba(136,14,79,0.90)' });
        }
        if (goldenCross) {
          markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Golden Cross' });
          bgColors.push({ time: t, color: 'rgba(0,255,0,0.90)' });
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { upper: upperPlot, lower: lowerPlot, zeroline: zeroPlot, macdUp: macdUpPlot, macdDn: macdDnPlot },
    markers,
    barColors,
    bgColors,
    fills: [{ plot1: 'upper', plot2: 'lower', options: { color: '#2196F3', transp: 75, title: 'Fill' } }],
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const EasyTrendColors = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
