/**
 * Easy Entry/Exit Trend Colors
 *
 * MACD oscillator with Bollinger Bands envelope, zero line, and golden/death cross signals.
 * Plots: Upper BB band, Lower BB band, Zero line, MACD triangles at MACD value.
 * Pine plots triangleup (lime when MACD >= Upper) and triangledown (red when MACD <= Upper)
 * at the MACD value position on every bar.
 * Death/golden cross from 50/200 SMA crossover.
 *
 * Reference: "Easy Entry/Exit Trend Colors (With Alerts)" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };

interface EasyTrendRun extends BarRunState<Record<string, never>> {
  fastEma: ReturnType<typeof taStep.ema>;
  slowEma: ReturnType<typeof taStep.ema>;
  /** math.sum of the MACD and of its squares: the SMA and the biased stdev of the bands (WindowSma / WindowStdev) */
  macdSum: WindowSum;
  macdSq: WindowSum;
  fastSma: WindowSma;
  slowSma: WindowSma;
  macdArr: number[];
  macdSmaArr: number[];
  macdStdArr: number[];
  fastSmaArr: number[];
  slowSmaArr: number[];
  upperPlot: Point[];
  lowerPlot: Point[];
  zeroPlot: Point[];
  macdUpPlot: Point[];
  macdDnPlot: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<EasyTrendColorsInputs>): BarStudy<EasyTrendRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const bbWarmup = Math.max(cfg.slowLength, cfg.bbLength);
  const smaWarmup = cfg.slowSmaPeriod;
  const bbLen = Math.floor(cfg.bbLength);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: EasyTrendRun = {
        fastEma: taStep.ema(cfg.fastLength), slowEma: taStep.ema(cfg.slowLength), macdSum: new WindowSum(cfg.bbLength),
        macdSq: new WindowSum(cfg.bbLength), fastSma: new WindowSma(cfg.fastSmaPeriod), slowSma: new WindowSma(cfg.slowSmaPeriod),
        macdArr: [], macdSmaArr: [], macdStdArr: [], fastSmaArr: [], slowSmaArr: [], upperPlot: [], lowerPlot: [],
        zeroPlot: [], macdUpPlot: [], macdDnPlot: [], markers: [], barColors: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fastEma, s.slowEma, s.macdSum, s.macdSq, s.fastSma, s.slowSma];
      s.lists = [s.markers, s.barColors, s.bgColors];
      s.series = [
        s.macdArr, s.macdSmaArr, s.macdStdArr, s.fastSmaArr, s.slowSmaArr, s.upperPlot, s.lowerPlot, s.zeroPlot,
        s.macdUpPlot, s.macdDnPlot,
      ];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const src = value(bars[i]);
      // MACD = EMA(fast) - EMA(slow)
      const macd = (s.fastEma.step(src) ?? 0) - (s.slowEma.step(src) ?? 0);
      s.macdArr[i] = macd;
      // BB on MACD: Upper = SMA(macd, bbLen) + dev * stdev(macd, bbLen)
      const sum = s.macdSum.step(macd);
      const sq = s.macdSq.step(Number.isFinite(macd) ? macd * macd : NaN);
      const mean = sum / bbLen;
      const variance = sq / bbLen - mean * mean;
      s.macdSmaArr[i] = mean;
      s.macdStdArr[i] = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
      // Death/golden cross from 50/200 SMA
      s.fastSmaArr[i] = s.fastSma.step(src);
      s.slowSmaArr[i] = s.slowSma.step(src);

      // Pine: plotshape(macd, color=mcl, style=shape.triangleup) where mcl = macd >= Upper ? lime : na
      // Pine: plotshape(macd, color=mcr, style=shape.triangledown) where mcr = macd <= Upper ? red : na
      // These are per-bar triangle shapes at MACD value position
      if (i < bbWarmup) {
        s.upperPlot[i] = { time: t, value: NaN };
        s.lowerPlot[i] = { time: t, value: NaN };
        s.zeroPlot[i] = { time: t, value: NaN };
        s.macdUpPlot[i] = { time: t, value: NaN };
        s.macdDnPlot[i] = { time: t, value: NaN };
        return;
      }

      const sma = s.macdSmaArr[i] ?? 0;
      const std = s.macdStdArr[i] ?? 0;
      const upper = sma + std * cfg.bbDev;
      const lower = sma - std * cfg.bbDev;

      s.upperPlot[i] = { time: t, value: upper };
      s.lowerPlot[i] = { time: t, value: lower };
      s.zeroPlot[i] = { time: t, value: 0 };

      // Pine plotshape triangleup: shown when macd >= Upper (lime), otherwise na
      // Pine plotshape triangledown: shown when macd <= Upper (red), otherwise na
      // Pine plots BOTH shapes every bar: lime triangleUp when above upper, red triangleDown when not
      if (macd >= upper) {
        s.macdUpPlot[i] = { time: t, value: macd, color: '#00FF00' };
        s.macdDnPlot[i] = { time: t, value: NaN };
        // Per-bar MACD triangle shape (visible MACD representation)
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#00FF00' });
      } else {
        s.macdUpPlot[i] = { time: t, value: NaN };
        s.macdDnPlot[i] = { time: t, value: macd, color: '#FF0000' };
        // Per-bar MACD triangle shape (visible MACD representation)
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000' });
      }

      // Pine barcolor: yellow when macd > Upper, aqua when macd < Lower
      if (macd > upper) {
        s.barColors.push({ time: t, color: '#FFFF00' });
      } else if (macd < lower) {
        s.barColors.push({ time: t, color: '#00FFFF' });
      }

      // Pine markers: MACD crossing Upper band
      if (i > bbWarmup) {
        const prevMacd = s.macdArr[i - 1];
        const prevUpper = (s.macdSmaArr[i - 1] ?? 0) + (s.macdStdArr[i - 1] ?? 0) * cfg.bbDev;
        const crossUp = prevMacd <= prevUpper && macd > upper;
        const crossDown = prevMacd >= prevUpper && macd < upper;

        if (crossDown) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'xcross', color: '#FF0000', text: 'Bear' });
        }
        if (crossUp) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'diamond', color: '#00FF00', text: 'Bull' });
        }

        // Death/golden cross (only when SMA data available)
        if (i >= smaWarmup) {
          const pf = s.fastSmaArr[i - 1] ?? 0;
          const ps = s.slowSmaArr[i - 1] ?? 0;
          const cf = s.fastSmaArr[i] ?? 0;
          const cs = s.slowSmaArr[i] ?? 0;
          const goldenCross = (pf <= ps && cf > cs);
          const deathCross = (ps <= pf && cs > cf);

          if (deathCross) {
            s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: '#880E4F', text: 'Death Cross' });
            s.bgColors.push({ time: t, color: 'rgba(136,14,79,0.90)' });
          }
          if (goldenCross) {
            s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Golden Cross' });
            s.bgColors.push({ time: t, color: 'rgba(0,255,0,0.90)' });
          }
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          upper: s.upperPlot.slice(), lower: s.lowerPlot.slice(), zeroline: s.zeroPlot.slice(), macdUp: s.macdUpPlot.slice(),
          macdDn: s.macdDnPlot.slice(),
        },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        fills: [{ plot1: 'upper', plot2: 'lower', options: { color: '#2196F3', transp: 75, title: 'Fill' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EasyTrendColorsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EasyTrendColorsInputs> = {}): Omit<IndicatorResult, 'markers'> {
  return fullResult(createRun(inputs).update(bars));
}

export const EasyTrendColors = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
