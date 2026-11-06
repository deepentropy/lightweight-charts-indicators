/**
 * Price Action Trading System v0.3
 *
 * Price action patterns with MA filter. Detects hammer, engulfing patterns.
 * In uptrend (close > SMA): bullish engulfing or hammer = buy.
 * In downtrend: bearish engulfing or shooting star = sell.
 *
 * Reference: "Price Action Trading System v0.3" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;


export interface PriceActionSystemInputs {
  maLen: number;
  atrLen: number;
  src: SourceType;
}

export const defaultInputs: PriceActionSystemInputs = {
  maLen: 50,
  atrLen: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Low Price Line', color: '#787B86', lineWidth: 2 },
  { id: 'plot2', title: 'High Price Line', color: '#787B86', lineWidth: 2 },
  { id: 'plot3', title: 'Median Price Line', color: '#FF9800', lineWidth: 2 },
  { id: 'plot4', title: 'Slow EMA Trend Line', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Price Action Trading System',
  shortTitle: 'PATS',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
type Ema = ReturnType<typeof taStep.ema>;

interface PasRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  emaLo: Ema;
  emaHi: Ema;
  emaMe: Ema;
  cci: ReturnType<typeof taStep.cci>;
  fastMC: Ema;
  slowMC: Ema;
  macdSignal: WindowSma;
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<PriceActionSystemInputs>): BarStudy<PasRun, Result> {
  const { maLen, atrLen } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(maLen, atrLen);
  return {
    init() {
      const s: PasRun = {
        sma: new WindowSma(maLen),
        // Pine price channel: emaLo = ema(low, 5), emaHi = ema(high, 5), emaMe = ema(hl2, 4)
        emaLo: taStep.ema(5), emaHi: taStep.ema(5), emaMe: taStep.ema(4),
        // CCI for bar coloring (Pine uses CCI > 75 = aqua, CCI < -75 = black)
        cci: taStep.cci(14),
        fastMC: taStep.ema(12), slowMC: taStep.ema(17), macdSignal: new WindowSma(8),
        plots: Array.from({ length: 5 }, () => []), markers: [], barColors: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sma, s.emaLo, s.emaHi, s.emaMe, s.cci, s.fastMC, s.slowMC, s.macdSignal];
      s.lists = [s.markers, s.barColors, s.bgColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const curr = bars[i];
      const t = curr.time;
      const maValue = s.sma.step(curr.close);
      const emaLo = s.emaLo.step(curr.low);
      const emaHi = s.emaHi.step(curr.high);
      const emaMe = s.emaMe.step((curr.high + curr.low) / 2);
      const cciVal = s.cci.step(curr.close);
      // MACD for background coloring: Pine: bgcolor(OutputSignal>0?red: OutputSignal<0?green:yellow, transp=90)
      // OutputSignal = signal > macd ? 1 : signal < macd ? -1 : 0
      const slowMC = s.slowMC.step(curr.close);
      const macdVal = (s.fastMC.step(curr.close) ?? 0) - (slowMC ?? 0);
      const macdSignal = s.macdSignal.step(macdVal);

      const p = s.plots;
      p[0][i] = { time: t, value: (maValue == null || i < warmup) ? NaN : maValue };
      const toPlot = (v: number) => ({ time: t, value: (v == null || i < 5) ? NaN : v });
      p[1][i] = toPlot(emaLo);
      p[2][i] = toPlot(emaHi);
      p[3][i] = toPlot(emaMe);
      p[4][i] = toPlot(slowMC);

      if (i < warmup + 1) return;
      const prev = bars[i - 1];
      const close = curr.close;
      const open = curr.open;
      const high = curr.high;
      const low = curr.low;
      const maVal = maValue ?? 0;

      const body = Math.abs(close - open);
      const range = high - low;
      if (range === 0) return;

      const upperShadow = high - Math.max(close, open);
      const lowerShadow = Math.min(close, open) - low;

      const prevBullish = gt(prev.close, prev.open);
      const prevBearish = lt(prev.close, prev.open);
      const bullish = gt(close, open);
      const bearish = lt(close, open);

      const uptrend = gt(close, maVal);
      const downtrend = lt(close, maVal);

      // Hammer: lower shadow > body*2, upper shadow < body*0.3
      const isHammer = gt(lowerShadow, body * 2) && lt(upperShadow, body * 0.3) && gt(range, 0);
      // Shooting star: upper shadow > body*2, lower shadow < body*0.3
      const isShootingStar = gt(upperShadow, body * 2) && lt(lowerShadow, body * 0.3) && gt(range, 0);

      // Bullish engulfing: prev bearish, curr bullish, curr body engulfs prev body
      const isBullishEngulfing = prevBearish && bullish &&
        gt(close, prev.open) && lt(open, prev.close);
      // Bearish engulfing: prev bullish, curr bearish, curr body engulfs prev body
      const isBearishEngulfing = prevBullish && bearish &&
        lt(close, prev.open) && gt(open, prev.close);

      if (uptrend && (isBullishEngulfing || isHammer)) {
        s.markers.push({ time: curr.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      } else if (downtrend && (isBearishEngulfing || isShootingStar)) {
        s.markers.push({ time: curr.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }

      // Bar colors: CCI > 75 = aqua (#00BCD4), CCI < -75 = black (#000000)
      if (cciVal != null && !isNaN(cciVal)) {
        if (gt(cciVal, 75)) {
          s.barColors.push({ time: curr.time, color: '#00BCD4' });
        } else if (lt(cciVal, -75)) {
          s.barColors.push({ time: curr.time, color: '#000000' });
        }
      }

      // Background: Pine OutputSignal = signal > macd ? 1 (red) : signal < macd ? -1 (green) : 0 (yellow)
      const macdSig = macdSignal ?? 0;
      if (macdSig > macdVal) {
        s.bgColors.push({ time: curr.time, color: 'rgba(239,83,80,0.1)' });
      } else if (macdSig < macdVal) {
        s.bgColors.push({ time: curr.time, color: 'rgba(38,166,154,0.1)' });
      } else {
        s.bgColors.push({ time: curr.time, color: 'rgba(255,235,59,0.1)' });
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceActionSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceActionSystemInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceActionSystem = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig };
