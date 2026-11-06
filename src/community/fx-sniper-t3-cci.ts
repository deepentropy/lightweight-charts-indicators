/**
 * FX Sniper T3-CCI
 *
 * CCI smoothed with Tillson T3 moving average.
 * T3 uses a 6-stage EMA cascade with factor-based coefficients.
 * Pine plots both a line (blue) and a histogram (green >= 0, red < 0) of the same T3-CCI value.
 *
 * Reference: "FX Sniper T3-CCI" community indicator
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FXSniperT3CCIInputs {
  cciLength: number;
  t3Length: number;
  t3Factor: number;
  src: SourceType;
}

export const defaultInputs: FXSniperT3CCIInputs = {
  cciLength: 14,
  t3Length: 5,
  t3Factor: 0.618,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 't3Length', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Factor', defval: 0.618, min: 0.0, max: 1.0, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3-CCI', color: '#2962FF', lineWidth: 2 },
  { id: 'histogram', title: 'CCIH', color: '#008000', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'FX Sniper T3-CCI',
  shortTitle: 'T3CCI',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface T3CciVars {
  /** The previous value of each of the 6 EMAs of the cascade */
  prev: number[];
  pos: number;
}

interface T3CciRun extends BarRunState<T3CciVars> {
  sma: WindowSma;
  /** The values of the 6 EMAs on the bar (scratch) */
  e: number[];
  srcArr: number[];
  plot0: Point[];
  histogram: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<FXSniperT3CCIInputs>): BarStudy<T3CciRun, Result> {
  const { cciLength, t3Length, t3Factor, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

  // T3 smoothing: 6-stage EMA cascade
  // T3 coefficients: b = t3Factor
  // c1 = -b^3, c2 = 3b^2 + 3b^3, c3 = -6b^2 - 3b - 3b^3, c4 = 1 + 3b + b^3 + 3b^2
  const b = t3Factor;
  const b2 = b * b;
  const b3 = b2 * b;
  const c1 = -b3;
  const c2 = 3 * b2 + 3 * b3;
  const c3 = -6 * b2 - 3 * b - 3 * b3;
  const c4 = 1 + 3 * b + b3 + 3 * b2;

  // Pine: nr = 1 + 0.5*(nn-1), w1 = 2/(nr+1), w2 = 1-w1
  // This is EMA with period = nr (not t3Length directly)
  const nn = Math.max(1, t3Length);
  const nr = 1 + 0.5 * (nn - 1);
  const w1 = 2 / (nr + 1);
  const w2 = 1 - w1;

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(cciLength);
      const s: T3CciRun = {
        sma, e: [NaN, NaN, NaN, NaN, NaN, NaN], srcArr: [], plot0: [], histogram: [], barColors: [],
        steps: [sma], vars: { prev: [NaN, NaN, NaN, NaN, NaN, NaN], pos: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.srcArr, s.plot0, s.histogram];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v0 = value(bars[i]);
      s.srcArr[i] = v0;

      // Manual CCI on source
      const sma: number | null = s.sma.step(v0);
      let cci: number;
      if (sma == null || i < cciLength - 1) {
        cci = NaN;
      } else {
        let sumDev = 0;
        for (let j = 0; j < cciLength; j++) {
          sumDev += Math.abs((s.srcArr[i - j] ?? 0) - sma);
        }
        const meanDev = sumDev / cciLength;
        cci = meanDev === 0 ? 0 : ((s.srcArr[i] ?? 0) - sma) / (0.015 * meanDev);
      }

      // EMA helper using Pine's w1/w2 weighting, one stage after the other
      const prev = s.vars.prev;
      const e = s.e;
      let input = cci;
      for (let k = 0; k < 6; k++) {
        const p = prev[k]!;
        let r: number;
        if (isNaN(input)) {
          r = p;
        } else if (isNaN(p)) {
          prev[k] = input;
          r = input;
        } else {
          prev[k] = w1 * input + w2 * p;
          r = prev[k]!;
        }
        e[k] = r;
        input = r;
      }

      const t3 = i < cciLength - 1 || isNaN(e[5]!) ? NaN : c1 * e[5]! + c2 * e[4]! + c3 * e[3]! + c4 * e[2]!;

      // Pine: plot(xccir, color=blue, title="T3-CCI") -- line plot
      s.plot0[i] = { time, value: isNaN(t3) ? NaN : t3 };
      // Pine: plot(xccir, color=cciHcolor, title="CCIH", style=histogram)
      // cciHcolor = xccir >= 0 ? green : xccir < 0 ? red : black
      s.histogram[i] = { time, value: isNaN(t3) ? NaN : t3, color: isNaN(t3) ? undefined : (t3 >= 0 ? '#008000' : '#FF0000') };

      // Pine: pos = xccir > 0 ? 1 : xccir < 0 ? -1 : pos[1]
      // barcolor(pos == -1 ? red : pos == 1 ? green : blue)
      if (!isNaN(t3)) {
        if (t3 > 0) s.vars.pos = 1;
        else if (t3 < 0) s.vars.pos = -1;
      }
      if (i >= cciLength - 1 && !isNaN(t3)) {
        const pos = s.vars.pos;
        const color = pos === 1 ? '#008000' : pos === -1 ? '#FF0000' : '#0000FF'; // green/red/blue
        s.barColors.push({ time: time as number, color });
      }
    },
    copyVars: (v) => ({ prev: v.prev.slice(), pos: v.pos }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'histogram': s.histogram.slice() },
        hlines: [
          { value: 0, options: { color: '#800080', linestyle: 'solid', title: 'Zero' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FXSniperT3CCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FXSniperT3CCIInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const FXSniperT3CCI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
