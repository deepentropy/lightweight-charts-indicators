/**
 * CM Modified Heikin-Ashi TrendBars
 *
 * Modified Heikin-Ashi using EMA smoothing on HA values.
 * First computes standard HA candles, then smooths each OHLC with EMA.
 *
 * Reference: "CM_Modified_HeikinAshi" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface ModifiedHeikinAshiInputs {
  emaLen: number;
  showEma: boolean;
}

export const defaultInputs: ModifiedHeikinAshiInputs = {
  emaLen: 6,
  showEma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 6, min: 1 },
  { id: 'showEma', type: 'bool', title: 'Show EMA Trend Line?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'emaTrend', title: 'EMA Trend', color: '#00FF00', lineWidth: 3 },
];

export const plotCandleConfig = [
  { id: 'candle0', title: 'Modified HA' },
];

export const metadata = {
  title: 'Modified Heikin-Ashi',
  shortTitle: 'ModHA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] };
type Ema = ReturnType<typeof taStep.ema>;

interface ModHaVars {
  /** haOpen / haClose of the bar before */
  haOpen: number;
  haClose: number;
}

interface ModHaRun extends BarRunState<ModHaVars> {
  emaO: Ema;
  emaH: Ema;
  emaL: Ema;
  emaC: Ema;
  smoothO: number[];
  smoothC: number[];
  candles: PlotCandleData[];
  emaTrend: { time: number; value: number; color?: string }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<ModifiedHeikinAshiInputs>): BarStudy<ModHaRun, Result> {
  const { emaLen, showEma } = { ...defaultInputs, ...inputs };
  const warmup = emaLen;
  return {
    init() {
      const emaO = taStep.ema(emaLen);
      const emaH = taStep.ema(emaLen);
      const emaL = taStep.ema(emaLen);
      const emaC = taStep.ema(emaLen);
      const s: ModHaRun = {
        emaO, emaH, emaL, emaC, smoothO: [], smoothC: [], candles: [], emaTrend: [], barColors: [],
        steps: [emaO, emaH, emaL, emaC], vars: { haOpen: NaN, haClose: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.smoothO, s.smoothC, s.candles, s.emaTrend];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { open, high, low, close } = bars[i];
      const time = bars[i].time as number;

      // Step 1: Standard HA candles
      const haClose = (open + high + low + close) / 4;
      const haOpen = i === 0 ? (open + close) / 2 : (v.haOpen + v.haClose) / 2;
      const haHigh = Math.max(high, haOpen, haClose);
      const haLow = Math.min(low, haOpen, haClose);
      v.haOpen = haOpen;
      v.haClose = haClose;

      // Step 2: EMA smooth each HA component
      const o = s.emaO.step(haOpen);
      const h = s.emaH.step(haHigh);
      const l = s.emaL.step(haLow);
      const c = s.emaC.step(haClose);
      s.smoothO[i] = o;
      s.smoothC[i] = c;

      const skip = i < warmup || o == null || c == null;
      if (skip) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        const col = c >= o ? '#26A69A' : '#EF5350';
        s.candles[i] = { time, open: o, high: h, low: l, close: c, color: col, borderColor: col, wickColor: col };
      }

      // Pine: barcolor(heikUpColor() ? lime: heikDownColor() ? red : na)
      // heikUpColor = hlc3 >= emaAvg, heikDownColor = hlc3 < emaAvg
      // emaAvg = (ema(haclose, uema) + ema(haopen, dema)) / 2
      // smoothC = ema(haClose, emaLen), smoothO = ema(haOpen, emaLen)
      const hlc3 = (high + low + close) / 3;
      if (!skip) {
        const emaAvg = (c + o) / 2;
        if (hlc3 >= emaAvg) {
          s.barColors.push({ time, color: '#00FF00' }); // lime
        } else {
          s.barColors.push({ time, color: '#FF0000' }); // red
        }
      }

      // Pine: plot(shema and emaAvg ? emaAvg : na, title="EMA UpTrend", style=line, linewidth=3, color=col)
      // col = hlc3 >= emaAvg[1] ? lime : hlc3 < emaAvg[1] ? red : white
      if (!showEma || skip) {
        s.emaTrend[i] = { time, value: NaN };
      } else {
        const emaAvg = (c + o) / 2;
        let col = '#FFFFFF'; // white default
        if (i > warmup && s.smoothO[i - 1] != null && s.smoothC[i - 1] != null) {
          const prevEmaAvg = (s.smoothC[i - 1]! + s.smoothO[i - 1]!) / 2;
          col = hlc3 >= prevEmaAvg ? '#00FF00' : '#FF0000';
        }
        s.emaTrend[i] = { time, value: emaAvg, color: col };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { emaTrend: s.emaTrend.slice() },
        plotCandles: { candle0: s.candles.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ModifiedHeikinAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ModifiedHeikinAshiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ModifiedHeikinAshi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
