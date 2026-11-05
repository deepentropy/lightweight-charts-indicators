/**
 * ADX by cobra
 *
 * ADX with +DI/-DI lines and visual styling.
 * ADX colored green when rising, red when falling.
 * Manual Wilder's smoothing calculation for DM, DI, DX, ADX.
 *
 * Reference: "ADX" by cobra (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ADXCobraInputs {
  adxLen: number;
}

export const defaultInputs: ADXCobraInputs = {
  adxLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#EF5350', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 25, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Strong Trend' } },
];

export const metadata = {
  title: 'ADX by cobra',
  shortTitle: 'ADX Cobra',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface AdxCobraVars {
  smoothTR: number;
  smoothPlusDM: number;
  smoothMinusDM: number;
  adx: number;
  /** adx of the bar before */
  prevAdx: number;
}

interface AdxCobraRun extends BarRunState<AdxCobraVars> {
  adxPlot: Point[];
  plusPlot: Point[];
  minusPlot: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ADXCobraInputs>): BarStudy<AdxCobraRun, Result> {
  const { adxLen } = { ...defaultInputs, ...inputs };
  const warmup = adxLen;
  const adxWarmup = 2 * adxLen - 1;
  return {
    init() {
      const s: AdxCobraRun = {
        adxPlot: [], plusPlot: [], minusPlot: [], bgColors: [],
        steps: [],
        vars: { smoothTR: 0, smoothPlusDM: 0, smoothMinusDM: 0, adx: 0, prevAdx: NaN },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.adxPlot, s.plusPlot, s.minusPlot];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const high = bars[i].high;
      const low = bars[i].low;
      const prevHigh = i > 0 ? bars[i - 1].high : high;
      const prevLow = i > 0 ? bars[i - 1].low : low;
      const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const upMove = high - prevHigh;
      const downMove = prevLow - low;
      const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
      const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

      if (i <= adxLen) {
        v.smoothTR += tr;
        v.smoothPlusDM += plusDM;
        v.smoothMinusDM += minusDM;
      } else {
        v.smoothTR = v.smoothTR - v.smoothTR / adxLen + tr;
        v.smoothPlusDM = v.smoothPlusDM - v.smoothPlusDM / adxLen + plusDM;
        v.smoothMinusDM = v.smoothMinusDM - v.smoothMinusDM / adxLen + minusDM;
      }
      const { smoothTR, smoothPlusDM, smoothMinusDM } = v;

      const diPlus = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
      const diMinus = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
      const diSum = diPlus + diMinus;
      const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

      if (i === 2 * adxLen - 1) {
        v.adx = dx;
      } else if (i >= 2 * adxLen) {
        v.adx = (v.adx * (adxLen - 1) + dx) / adxLen;
      }
      const adx = v.adx;
      const prevAdx = v.prevAdx;
      v.prevAdx = adx;

      s.plusPlot[i] = { time, value: i < warmup ? NaN : diPlus };
      s.minusPlot[i] = { time, value: i < warmup ? NaN : diMinus };
      if (i < adxWarmup) {
        s.adxPlot[i] = { time, value: NaN };
      } else {
        const rising = i > adxWarmup && adx > prevAdx;
        s.adxPlot[i] = { time, value: adx, color: rising ? '#26A69A' : '#EF5350' };
      }

      // bgColors from Pine: 4 bgcolor() calls
      // 1. DIMOVS (DI- > 60) → lime/green background (transp=40)
      // 2. DIPOVB (DI+ > 60) → orange background (transp=20)
      // 3. DIPcross (DI+ > DI-) → green background (transp=60)
      // 4. DIPput (DI- > DI+) → red background (transp=60)
      if (i >= warmup) {
        // Priority: DIMOVS and DIPOVB are stronger signals, shown on top
        if (diMinus > 60) {
          s.bgColors.push({ time, color: 'rgba(0,255,0,0.60)' }); // lime, transp=40
        } else if (diPlus > 60) {
          s.bgColors.push({ time, color: 'rgba(255,165,0,0.80)' }); // orange, transp=20
        } else if (diPlus > diMinus) {
          s.bgColors.push({ time, color: 'rgba(0,128,0,0.40)' }); // green, transp=60
        } else if (diMinus > diPlus) {
          s.bgColors.push({ time, color: 'rgba(255,0,0,0.40)' }); // red, transp=60
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.adxPlot.slice(), 'plot1': s.plusPlot.slice(), 'plot2': s.minusPlot.slice() },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ADXCobraInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ADXCobraInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ADXCobra = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
