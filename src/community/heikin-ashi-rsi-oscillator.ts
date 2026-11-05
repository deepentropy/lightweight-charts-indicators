/**
 * Heikin Ashi RSI Oscillator
 *
 * Zero-centered RSI displayed as Heikin Ashi candles.
 * Includes smoothed RSI overlay line and optional Stochastic RSI.
 * OB/OS bands at configurable levels.
 * Stochastic of the RSI line (Show Stoch RSI): K / D lines (transparent with Ribbon) and the ribbon fill between them.
 *
 * Reference: "Heikin Ashi RSI Oscillator" by JayRogers
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HeikinAshiRsiOscillatorInputs {
  lenHARSI: number;
  openSmoothing: number;
  lenRSI: number;
  smoothedMode: boolean;
  showPlot: boolean;
  showHist: boolean;
  showStoch: boolean;
  /** Stochastic as a ribbon fill (K / D lines transparent) */
  ribbon: boolean;
  smoothK: number;
  smoothD: number;
  stochLen: number;
  stochFit: number;
  upper: number;
  upperExtreme: number;
  lower: number;
  lowerExtreme: number;
}

export const defaultInputs: HeikinAshiRsiOscillatorInputs = {
  lenHARSI: 14,
  openSmoothing: 1,
  lenRSI: 7,
  smoothedMode: true,
  showPlot: true,
  showHist: true,
  showStoch: false,
  ribbon: true,
  smoothK: 3,
  smoothD: 3,
  stochLen: 14,
  stochFit: 80,
  upper: 20,
  upperExtreme: 30,
  lower: -20,
  lowerExtreme: -30,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenHARSI', type: 'int', title: 'HA RSI Length', defval: 14, min: 1 },
  { id: 'openSmoothing', type: 'int', title: 'Open Smoothing', defval: 1, min: 1 },
  { id: 'lenRSI', type: 'int', title: 'RSI Overlay Length', defval: 7, min: 1 },
  { id: 'smoothedMode', type: 'bool', title: 'Smoothed RSI', defval: true },
  { id: 'showPlot', type: 'bool', title: 'Show RSI Line', defval: true },
  { id: 'showHist', type: 'bool', title: 'Show Histogram', defval: true },
  { id: 'showStoch', type: 'bool', title: 'Show Stoch RSI', defval: false },
  { id: 'ribbon', type: 'bool', title: 'Ribbon?', defval: true },
  { id: 'smoothK', type: 'int', title: 'Stoch Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Stoch Smooth D', defval: 3, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'stochFit', type: 'int', title: 'Stoch Scale %', defval: 80, min: 1 },
  { id: 'upper', type: 'int', title: 'Upper Band', defval: 20 },
  { id: 'upperExtreme', type: 'int', title: 'Upper Extreme', defval: 30 },
  { id: 'lower', type: 'int', title: 'Lower Band', defval: -20 },
  { id: 'lowerExtreme', type: 'int', title: 'Lower Extreme', defval: -30 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Line', color: '#FAC832', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Extreme', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'Lower Extreme', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Histogram', color: '#787B86', lineWidth: 1, style: 'histogram' },
  { id: 'plot6', title: 'Stoch K', color: '#0094FF', lineWidth: 1 },
  { id: 'plot7', title: 'Stoch D', color: '#FF6A00', lineWidth: 1 },
];

const COL_NONE = 'rgba(0, 0, 0, 0)';
const COL_STOCH_K = '#0094FF';
const COL_STOCH_D = '#FF6A00';
const COL_STOCH_K_FILL = 'rgba(0, 148, 255, 0.5)';
const COL_STOCH_D_FILL = 'rgba(255, 106, 0, 0.5)';

export const plotCandleConfig = [
  { id: 'harsi', title: 'HA RSI Candles' },
];

export const metadata = {
  title: 'Heikin Ashi RSI Oscillator',
  shortTitle: 'HA-RSI',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface HarsiRun extends BarRunState<Record<string, never>> {
  rsiClose: ReturnType<typeof taStep.rsi>;
  rsiHigh: ReturnType<typeof taStep.rsi>;
  rsiLow: ReturnType<typeof taStep.rsi>;
  rsiOverlay: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  kSma: ReturnType<typeof taStep.sma>;
  dSma: ReturnType<typeof taStep.sma>;
  zrsiClose: number[];
  haOpen: number[];
  haClose: number[];
  rsiLine: number[];
  candles: PlotCandleData[];
  plots: Point[][];
  fillStoch: string[];
}

function study(inputs: Partial<HeikinAshiRsiOscillatorInputs>): BarStudy<HarsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const warmup = cfg.lenHARSI;
  const s0 = cfg.openSmoothing;
  return {
    init() {
      const s: HarsiRun = {
        rsiClose: taStep.rsi(cfg.lenHARSI), rsiHigh: taStep.rsi(cfg.lenHARSI), rsiLow: taStep.rsi(cfg.lenHARSI),
        rsiOverlay: taStep.rsi(cfg.lenRSI), stoch: taStep.stoch(cfg.stochLen), kSma: taStep.sma(), dSma: taStep.sma(),
        zrsiClose: [], haOpen: [], haClose: [], rsiLine: [], candles: [], plots: Array.from({ length: 8 }, () => []),
        fillStoch: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsiClose, s.rsiHigh, s.rsiLow, s.rsiOverlay, s.stoch, s.kSma, s.dSma];
      s.series = [s.zrsiClose, s.haOpen, s.haClose, s.rsiLine, s.candles, ...s.plots, s.fillStoch];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;

      // Zero-median RSI: RSI - 50
      const zrsiClose = s.rsiClose.step(b.close) - 50;
      const zrsiHigh = s.rsiHigh.step(b.high) - 50;
      const zrsiLow = s.rsiLow.step(b.low) - 50;
      s.zrsiClose[i] = zrsiClose;

      // HA RSI candle components
      // openRSI = nz(closeRSI[1], closeRSI)
      const openRSI = i > 0 && !isNaN(s.zrsiClose[i - 1]) ? s.zrsiClose[i - 1] : zrsiClose;
      // highRSI = max of zrsi(high) and zrsi(low), lowRSI = min
      const highRSI = Math.max(zrsiHigh, zrsiLow);
      const lowRSI = Math.min(zrsiHigh, zrsiLow);
      // HA close = (openRSI + highRSI + lowRSI + closeRSI) / 4
      const haClose = (openRSI + highRSI + lowRSI + zrsiClose) / 4;
      s.haClose[i] = haClose;
      // HA open with smoothing: open[i] = na(open[s]) ? (openRSI + closeRSI)/2 : (open[i-1]*s + close[i-1])/(s+1)
      const haOpen = i < s0 || isNaN(s.haOpen[i - 1])
        ? (openRSI + zrsiClose) / 2
        : (s.haOpen[i - 1] * s0 + s.haClose[i - 1]) / (s0 + 1);
      s.haOpen[i] = haOpen;
      // HA high = max(highRSI, haOpen, haClose), HA low = min(lowRSI, haOpen, haClose)
      const haHigh = Math.max(highRSI, haOpen, haClose);
      const haLow = Math.min(lowRSI, haOpen, haClose);

      // Plot candles
      if (i < warmup || isNaN(haClose)) {
        s.candles[i] = { time: time as number, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        const bullish = haClose > haOpen;
        const color = bullish ? '#26A69A' : '#EF5350';
        s.candles[i] = { time: time as number, open: haOpen, high: haHigh, low: haLow, close: haClose, color, borderColor: color, wickColor: color };
      }

      // RSI overlay line
      const zrsiOverlay = s.rsiOverlay.step(b.close) - 50;
      // Smoothed mode: smoothed = (smoothed[1] + zrsi) / 2
      let rsiLine: number;
      if (cfg.smoothedMode) {
        if (isNaN(zrsiOverlay)) rsiLine = NaN;
        else if (i === 0 || isNaN(s.rsiLine[i - 1])) rsiLine = zrsiOverlay;
        else rsiLine = (s.rsiLine[i - 1] + zrsiOverlay) / 2;
      } else {
        rsiLine = zrsiOverlay;
      }
      s.rsiLine[i] = rsiLine;

      const p = s.plots;
      p[0][i] = { time, value: cfg.showPlot && i >= warmup ? rsiLine : NaN };
      // Band lines (constant)
      p[1][i] = { time, value: cfg.upper };
      p[2][i] = { time, value: cfg.lower };
      p[3][i] = { time, value: cfg.upperExtreme };
      p[4][i] = { time, value: cfg.lowerExtreme };
      // Histogram: RSI value as histogram bars
      p[5][i] = {
        time,
        value: cfg.showHist && i >= warmup ? rsiLine : NaN,
        color: rsiLine > 0 ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
      };

      // StochK = f_zstoch(RSI, stochLen, smoothK, stochFit): (sma(stoch(RSI, RSI, RSI, len) - 50, smoothK) / 100) * scale;
      // StochD = sma(StochK, smoothD)
      const zstoch = s.stoch.step(rsiLine, rsiLine, rsiLine) - 50;
      const stochK = (s.kSma.step(zstoch, cfg.smoothK) / 100) * cfg.stochFit;
      const stochD = s.dSma.step(stochK, cfg.smoothD);
      // plot(i_showStoch ? StochK : na, "Stoch K", not i_ribbon ? colStochK : colNone) / "Stoch D"
      p[6][i] = { time, value: cfg.showStoch ? stochK : NaN, color: cfg.ribbon ? COL_NONE : COL_STOCH_K };
      p[7][i] = { time, value: cfg.showStoch ? stochD : NaN, color: cfg.ribbon ? COL_NONE : COL_STOCH_D };
      // fill(plot_stochK, plot_stochD, i_ribbon ? colStochFill : na): colStochFill = StochK >= StochD ? K colour : D colour (50 %)
      s.fillStoch[i] = !cfg.ribbon ? 'transparent' : !(stochD - stochK > 1e-10) && !isNaN(stochK) && !isNaN(stochD)
        ? COL_STOCH_K_FILL : COL_STOCH_D_FILL;
    },
    result(s, bars) {
      const n = bars.length;
      // Fills: upper to upperExtreme (red), upper to lower (blue), lower to lowerExtreme (green)
      const constant = (c: string): string[] => new Array(n).fill(c);
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice(),
          'plot5': p[5].slice(), 'plot6': p[6].slice(), 'plot7': p[7].slice(),
        },
        plotCandles: { harsi: s.candles.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot3', colors: constant('rgba(255,0,0,0.1)') },
          { plot1: 'plot1', plot2: 'plot2', colors: constant('rgba(33,150,243,0.05)') },
          { plot1: 'plot2', plot2: 'plot4', colors: constant('rgba(0,255,0,0.1)') },
          // untitled fill of the original: its default title
          { plot1: 'plot6', plot2: 'plot7', options: { title: 'Plots Background' }, colors: s.fillStoch.slice() },
        ],
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HeikinAshiRsiOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HeikinAshiRsiOscillatorInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const HeikinAshiRsiOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
