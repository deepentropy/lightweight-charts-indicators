/**
 * Impulse MACD
 *
 * SMMA channel (high/low) + ZLEMA of hlc3.
 * When ZLEMA > SMMA(high): impulse = ZLEMA - SMMA(high) (bullish)
 * When ZLEMA < SMMA(low): impulse = ZLEMA - SMMA(low) (bearish)
 * Otherwise: 0 (neutral, filtering whipsaw)
 * Bar colours (barcolor, as the original): only with "Enable bar colors" (off by default), in the colours of the
 * ImpulseMACD histogram (lime / green / red / orange; an na value compares false, so orange while the averages
 * warm up).
 *
 * Reference: "Impulse MACD" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ImpulseMACDInputs {
  lengthMA: number;
  lengthSignal: number;
  /** Enable bar colors (off by default, as the original) */
  ebc: boolean;
}

export const defaultInputs: ImpulseMACDInputs = {
  lengthMA: 34,
  lengthSignal: 9,
  ebc: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthMA', type: 'int', title: 'Length MA', defval: 34, min: 1 },
  { id: 'lengthSignal', type: 'int', title: 'Length Signal', defval: 9, min: 1 },
  { id: 'ebc', type: 'bool', title: 'Enable bar colors', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ImpulseMACD', color: '#2962FF', lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: '#800000', lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: '#0000FF', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Impulse MACD',
  shortTitle: 'IMACD',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface ImpulseRun extends BarRunState<Record<string, never>> {
  hi: ReturnType<typeof taStep.rma>;
  lo: ReturnType<typeof taStep.rma>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  mdArr: number[];
  mdPlot: Point[];
  sbPlot: Point[];
  shPlot: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<ImpulseMACDInputs>): BarStudy<ImpulseRun, Result> {
  const { lengthMA, lengthSignal, ebc } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // SMMA = RMA in oakscriptjs
      const hi = taStep.rma(lengthMA);
      const lo = taStep.rma(lengthMA);
      const ema1 = taStep.ema(lengthMA);
      const ema2 = taStep.ema(lengthMA);
      const s: ImpulseRun = {
        hi, lo, ema1, ema2, mdArr: [], mdPlot: [], sbPlot: [], shPlot: [], barColors: [],
        steps: [hi, lo, ema1, ema2], vars: {}, lists: [], series: [],
      };
      s.series = [s.mdArr, s.mdPlot, s.sbPlot, s.shPlot, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = (b.high + b.low + b.close) / 3;
      const h = s.hi.step(b.high);
      const l = s.lo.step(b.low);
      // ZLEMA = EMA + (EMA - EMA(EMA))
      const e1 = s.ema1.step(src);
      const e2 = s.ema2.step(e1);
      const m = e1 + (e1 - e2); // zlema = ema1 + (ema1 - ema2)

      // Impulse: above hi channel = bullish, below lo channel = bearish, else 0
      let md: number;
      if (isNaN(m) || isNaN(h) || isNaN(l)) md = NaN;
      else if (m > h) md = m - h;
      else if (m < l) md = m - l;
      else md = 0;
      s.mdArr[i] = md;

      // Signal = SMA of md
      // We need to compute SMA manually since md is a plain array
      let sb: number;
      if (i < lengthSignal - 1 || isNaN(md)) {
        sb = NaN;
      } else {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < lengthSignal; j++) {
          const v = s.mdArr[i - j];
          if (!isNaN(v)) { sum += v; count++; }
        }
        sb = count > 0 ? sum / count : NaN;
      }
      const sh = isNaN(md) || isNaN(sb) ? NaN : md - sb;

      // plot(md, color=mdc): mdc = src>mi ? src>hi ? lime : green : src<lo ? red : orange (the original's colours; na
      // compares false)
      const color = src > m ? (src > h ? '#00FF00' : '#008000') : (src < l ? '#FF0000' : '#FF7F00');
      s.mdPlot[i] = { time, value: isNaN(md) ? NaN : md, color };
      s.sbPlot[i] = { time, value: isNaN(sb) ? NaN : sb };
      s.shPlot[i] = { time, value: isNaN(sh) ? NaN : sh };

      // barcolor(ebc ? mdc : na): mdc = src>mi?src>hi?lime:green:src<lo?red:orange (never na: na compares false)
      if (ebc) s.barColors[i] = { id: 'barcolor0', time, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.mdPlot.slice(), 'plot1': s.sbPlot.slice(), 'plot2': s.shPlot.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } }],
        barColors: ebc ? s.barColors.slice() : [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ImpulseMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ImpulseMACDInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ImpulseMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
