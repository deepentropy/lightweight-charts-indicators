/**
 * Ichimoku EMA Bands
 *
 * Ichimoku cloud with EMA-based ATR bands.
 * Base EMA + ATR upper/lower bands, standard Tenkan/Kijun with conditional color,
 * and displaced Senkou spans with cloud fill.
 *
 * Reference: "Ichimoku EMA Bands" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IchimokuEMABandsInputs {
  convLen: number;
  baseLen: number;
  emaLen: number;
  atrLength: number;
  atrMult: number;
  laggingSpan2Periods: number;
  displacement: number;
}

export const defaultInputs: IchimokuEMABandsInputs = {
  convLen: 5,
  baseLen: 26,
  emaLen: 26,
  atrLength: 200,
  atrMult: 2.272,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'convLen', type: 'int', title: 'Conversion Length', defval: 5, min: 1 },
  { id: 'baseLen', type: 'int', title: 'Base Length', defval: 26, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 26, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 2.272, min: 0.1, step: 0.001 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Lagging Span 2 Periods', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  // Pine: plot(out, title="EMA", color=orange, transp=85)
  { id: 'ema', title: 'EMA', color: 'rgba(255,165,0,0.15)', lineWidth: 1 },
  // Pine: plot(emaup, title="EMAUP", color=red)
  { id: 'emaUp', title: 'EMA Upper Band', color: '#EF5350', lineWidth: 1 },
  // Pine: plot(emadw, title="EMADW", color=green)
  { id: 'emaDw', title: 'EMA Lower Band', color: '#26A69A', lineWidth: 1 },
  // Pine: plot(conversionLine, color=red)
  { id: 'conversion', title: 'Conversion Line', color: '#EF5350', lineWidth: 1 },
  // Pine: plot(baseLine, color=kjuncol, linewidth=2, transp=5) — conditional color per bar
  { id: 'base', title: 'Base Line', color: '#2962FF', lineWidth: 2 },
  // Pine: plot(leadLine1, offset=displacement, color=green, transp=85)
  { id: 'lead1', title: 'Senkou Span A', color: 'rgba(38,166,154,0.15)', lineWidth: 1 },
  // Pine: plot(leadLine2, offset=displacement, color=red, transp=85)
  { id: 'lead2', title: 'Senkou Span B', color: 'rgba(239,83,80,0.15)', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku EMA Bands',
  shortTitle: 'Ichi EMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface IchiRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  convHigh: WindowExtreme;
  convLow: WindowExtreme;
  baseHigh: WindowExtreme;
  baseLow: WindowExtreme;
  span2High: WindowExtreme;
  span2Low: WindowExtreme;
  tenkanVals: number[];
  kijunVals: number[];
  span2HighArr: number[];
  span2LowArr: number[];
  emaPlot: Point[];
  emaUpPlot: Point[];
  emaDwPlot: Point[];
  convPlot: Point[];
  basePlot: Point[];
  lead1Plot: Point[];
  lead2Plot: Point[];
}

function study(inputs: Partial<IchimokuEMABandsInputs>): BarStudy<IchiRun, IndicatorResult> {
  const { convLen, baseLen, emaLen, atrLength, atrMult, laggingSpan2Periods, displacement } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(convLen, baseLen, emaLen, atrLength);
  return {
    init() {
      // Pine: out = ema(src, len)
      const ema = taStep.ema(emaLen);
      // Pine: ATR = rma(tr(true), ATRlength)
      const atr = taStep.atr(atrLength);
      // Ichimoku donchian channels
      const convHigh = new WindowExtreme(false, convLen);
      const convLow = new WindowExtreme(true, convLen);
      const baseHigh = new WindowExtreme(false, baseLen);
      const baseLow = new WindowExtreme(true, baseLen);
      const span2High = new WindowExtreme(false, laggingSpan2Periods);
      const span2Low = new WindowExtreme(true, laggingSpan2Periods);
      const s: IchiRun = {
        ema, atr, convHigh, convLow, baseHigh, baseLow, span2High, span2Low,
        tenkanVals: [], kijunVals: [], span2HighArr: [], span2LowArr: [],
        emaPlot: [], emaUpPlot: [], emaDwPlot: [], convPlot: [], basePlot: [], lead1Plot: [], lead2Plot: [],
        steps: [ema, atr, convHigh, convLow, baseHigh, baseLow, span2High, span2Low], vars: {}, lists: [], series: [],
      };
      s.series = [
        s.tenkanVals, s.kijunVals, s.span2HighArr, s.span2LowArr, s.emaPlot, s.emaUpPlot, s.emaDwPlot, s.convPlot,
        s.basePlot, s.lead1Plot, s.lead2Plot,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const e = s.ema.step(b.close);
      const a = s.atr.step(b.high, b.low, b.close);
      const convH = s.convHigh.step(b.high);
      const convL = s.convLow.step(b.low);
      const baseH = s.baseHigh.step(b.high);
      const baseL = s.baseLow.step(b.low);
      s.span2HighArr[i] = s.span2High.step(b.high);
      s.span2LowArr[i] = s.span2Low.step(b.low);

      // Pre-compute tenkan and kijun values
      const conv = i < convLen ? NaN : (convH + convL) / 2;
      const base = i < baseLen ? NaN : (baseH + baseL) / 2;
      s.tenkanVals[i] = conv;
      s.kijunVals[i] = base;

      // Pine: plot(out, title="EMA", color=orange, transp=85)
      s.emaPlot[i] = { time, value: (e == null || i < emaLen) ? NaN : e };

      // Pine: emaup = out+(ATR*ATRMult), emadw = out-(ATR*ATRMult)
      if (e == null || a == null || i < warmup) {
        s.emaUpPlot[i] = { time, value: NaN };
        s.emaDwPlot[i] = { time, value: NaN };
      } else {
        s.emaUpPlot[i] = { time, value: e + a * atrMult };
        s.emaDwPlot[i] = { time, value: e - a * atrMult };
      }

      // Pine: plot(conversionLine, color=red)
      s.convPlot[i] = { time, value: conv };

      // Pine: kjuncol = conversionLine > baseLine ? blue : conversionLine < baseLine ? red : orange
      // plot(baseLine, color=kjuncol, linewidth=2)
      let color: string;
      if (isNaN(conv) || isNaN(base)) {
        color = '#FFA500'; // orange
      } else if (conv > base) {
        color = '#2962FF'; // blue
      } else if (conv < base) {
        color = '#EF5350'; // red
      } else {
        color = '#FFA500'; // orange
      }
      s.basePlot[i] = { time, value: base, color };

      // Lead lines with displacement
      const srcIdx = i - displacement;
      if (srcIdx < 0 || isNaN(s.tenkanVals[srcIdx]) || isNaN(s.kijunVals[srcIdx])) {
        s.lead1Plot[i] = { time, value: NaN };
      } else {
        s.lead1Plot[i] = { time, value: (s.tenkanVals[srcIdx] + s.kijunVals[srcIdx]) / 2 };
      }

      if (srcIdx < 0 || srcIdx < laggingSpan2Periods) {
        s.lead2Plot[i] = { time, value: NaN };
      } else {
        s.lead2Plot[i] = { time, value: (s.span2HighArr[srcIdx] + s.span2LowArr[srcIdx]) / 2 };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'ema': s.emaPlot.slice(),
          'emaUp': s.emaUpPlot.slice(),
          'emaDw': s.emaDwPlot.slice(),
          'conversion': s.convPlot.slice(),
          'base': s.basePlot.slice(),
          'lead1': s.lead1Plot.slice(),
          'lead2': s.lead2Plot.slice(),
        },
        fills: [
          // Pine: fill(p1, p2, silver) — default transp=90 → 10% opacity
          { plot1: 'lead1', plot2: 'lead2', options: { color: 'rgba(192,192,192,0.10)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuEMABandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuEMABandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuEMABands = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
